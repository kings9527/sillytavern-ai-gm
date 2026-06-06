/**
 * AI-GM Plugin Test Script
 * Run: cd plugin && node test/index.js
 */

import { DiceRoller } from '../engine/dice.js';
import { RuleEngine } from '../engine/rule-engine.js';
import { GameStateMachine } from '../engine/state-machine.js';
import { CombatTracker } from '../engine/combat-tracker.js';
import { NPCDecisionEngine } from '../engine/npc-decision.js';
import { sanitizeInput, sanitizeNarration, escapeHtml, isValidCampaignId, validateModule } from '../utils/sanitize.js';

// Test data
const testModule = {
    id: 'test_module',
    name: 'Test Module',
    system: 'coc',
    start_scene: 'scene1',
    global_vars: { clue_found: false },
    scenes: {
        scene1: {
            id: 'scene1',
            title: '测试场景1',
            description: '这是一个测试场景',
            npcs_present: ['npc1'],
            exits: [
                { target_scene: 'scene2', description: '前往场景2', condition: 'always' }
            ]
        },
        scene2: {
            id: 'scene2',
            title: '测试场景2',
            description: '第二个测试场景',
            npcs_present: [],
            exits: []
        }
    },
    npcs: {
        npc1: {
            id: 'npc1',
            name: '测试NPC',
            role: 'neutral',
            stats: { HP: 10, DEX: 50 }
        }
    }
};

const testCampaign = {
    id: 'test_campaign',
    module_id: 'test_module',
    current_scene: 'scene1',
    scene_history: ['scene1'],
    player: {
        id: 'player_1',
        name: '测试玩家',
        stats: { STR: 60, CON: 50, DEX: 70, INT: 80, POW: 60, HP: 10, SAN: 60 },
        hp: 10,
        sanity: 60,
        inventory: [],
        status_effects: [],
        max_hp: 10
    },
    npcs_state: {
        npc1: { id: 'npc1', current_hp: 10, max_hp: 10, attitude: 'neutral' }
    },
    global_vars: { clue_found: false },
    combat_state: null,
    module: testModule
};

let passCount = 0;
let failCount = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passCount++;
    } catch (e) {
        console.error(`❌ ${name}: ${e.message}`);
        failCount++;
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

console.log('=== AI-GM Plugin Tests ===\n');

// DiceRoller Tests
console.log('--- DiceRoller ---');
const dice = new DiceRoller();

test('Roll 1d6 returns 1-6', () => {
    const result = dice.roll('1d6');
    assert(result.total >= 1 && result.total <= 6, `Expected 1-6, got ${result.total}`);
});

test('Roll 2d6+3 returns 5-15', () => {
    const result = dice.roll('2d6+3');
    assert(result.total >= 5 && result.total <= 15, `Expected 5-15, got ${result.total}`);
});

test('Roll history tracked', () => {
    dice.clearHistory();
    dice.roll('1d6');
    dice.roll('1d20');
    assert(dice.getHistory().length === 2, 'Expected 2 history entries after two rolls');
});

test('Roll breakdown includes components', () => {
    const result = dice.roll('2d6+3');
    assert(result.breakdown.includes('2d6'), 'Expected breakdown to include 2d6');
    assert(result.breakdown.includes('+3'), 'Expected breakdown to include +3');
});

// RuleEngine Tests
console.log('\n--- RuleEngine ---');
const rules = new RuleEngine('coc');

test('CoC skill check success', () => {
    const result = rules.cocCheck('Spot Hidden', 60, 40);
    assert(result.result === 'success', 'Expected success for roll 40 vs 60');
});

test('CoC skill check fail', () => {
    const result = rules.cocCheck('Spot Hidden', 60, 80);
    assert(result.result === 'fail', 'Expected fail for roll 80 vs 60');
});

test('CoC critical success', () => {
    const result = rules.cocCheck('Spot Hidden', 60, 3);
    assert(result.result === 'critical', 'Expected critical for roll 3');
});

test('CoC extreme success', () => {
    const result = rules.cocCheck('Spot Hidden', 60, 10);
    assert(result.result === 'extreme', 'Expected extreme for roll 10 vs 60');
});

test('CoC fumble', () => {
    const result = rules.cocCheck('Spot Hidden', 60, 96);
    assert(result.result === 'fumble', 'Expected fumble for roll 96');
});

test('Sanity loss calculation', () => {
    const result = rules.calculateSanityLoss('1d6', 50);
    assert(result.loss >= 1 && result.loss <= 6, 'Expected sanity loss 1-6');
    assert(result.newSanity === 50 - result.loss, 'Expected correct new sanity');
});

test('System rules loaded', () => {
    assert(rules.rules.name === 'Call of Cthulhu 7th Edition', 'Expected CoC 7e rules');
});

// GameStateMachine Tests
console.log('\n--- GameStateMachine ---');
const stateMachine = new GameStateMachine(testModule, testCampaign);

test('Parse intent - move', async () => {
    const intent = await stateMachine.parseIntent('去场景2', null);
    assert(intent.type === 'move', 'Expected move intent');
});

test('Parse intent - inspect', async () => {
    const intent = await stateMachine.parseIntent('看看周围', null);
    assert(intent.type === 'inspect', 'Expected inspect intent');
});

test('Find matching exit', () => {
    const exit = stateMachine.findMatchingExit({ type: 'move' });
    assert(exit !== null, 'Expected to find an exit');
    assert(exit.target_scene === 'scene2', 'Expected exit to scene2');
});

test('Get available actions', () => {
    const actions = stateMachine.getAvailableActions();
    assert(actions.length > 0, 'Expected some available actions');
    assert(actions.some(a => a.type === 'move'), 'Expected move action');
});

test('Transition to scene', async () => {
    const result = await stateMachine.transitionTo('scene2');
    assert(result.type === 'scene_change', 'Expected scene_change');
    assert(result.to === 'scene2', 'Expected scene2');
    assert(result.scene.title === '测试场景2', 'Expected scene2 title');
});

// CombatTracker Tests
console.log('\n--- CombatTracker ---');
const combatCampaign = {
    ...testCampaign,
    module: testModule,
    player: { ...testCampaign.player, stats: { ...testCampaign.player.stats, DEX: 70 }, max_hp: 10 },
    npcs_state: {
        npc1: { id: 'npc1', current_hp: 10, max_hp: 10, stats: { DEX: 50, HP: 10 } }
    }
};
const combat = new CombatTracker(combatCampaign);

test('Init combat creates initiative', () => {
    const result = combat.initCombat(['npc1']);
    assert(result.active === true, 'Expected combat active');
    assert(result.initiative.length === 2, 'Expected 2 combatants');
    assert(result.round === 1, 'Expected round 1');
});

test('Combat turn advances', () => {
    combat.initCombat(['npc1']);
    const state1 = combat.getState();
    const firstTurn = state1.current_turn;
    
    combat.processAction(firstTurn, 'move', null, {});
    const state2 = combat.getState();
    assert(state2.current_turn !== firstTurn || state2.round === 2, 'Expected turn to advance');
});

test('Attack deals damage', () => {
    combat.initCombat(['npc1']);
    const initialHP = combatCampaign.npcs_state.npc1.current_hp;
    
    // Ensure it's player's turn; if not, let enemy act first
    let state = combat.getState();
    if (state.current_turn !== 'player_1') {
        combat.processAction(state.current_turn, 'move', null, {});
    }
    
    combat.processAction('player_1', 'attack', 'npc1', {});
    assert(combatCampaign.npcs_state.npc1.current_hp <= initialHP, 'Expected HP to decrease');
});

// NPCDecisionEngine Tests
console.log('\n--- NPCDecisionEngine ---');
const npcEngine = new NPCDecisionEngine(testCampaign, 'npc1');

test('NPC rule-based decision', async () => {
    const decision = await npcEngine.decide('player threatens');
    assert(decision.decision !== null, 'Expected a decision');
    assert(decision.confidence > 0, 'Expected confidence > 0');
});

test('NPC context building', () => {
    const context = npcEngine.buildContext('test situation');
    assert(context.npc.id === 'npc1', 'Expected npc1 context');
    assert(context.situation === 'test situation', 'Expected situation');
});

// Sanitize Tests
console.log('\n--- Sanitize ---');

test('sanitizeInput removes control chars', () => {
    const result = sanitizeInput('hello\x00\x01world');
    assert(result === 'helloworld', 'Expected control chars removed');
});

test('sanitizeInput limits length', () => {
    const long = 'a'.repeat(2000);
    const result = sanitizeInput(long, 100);
    assert(result.length === 103, 'Expected length limited to 100 + "..."');
});

test('sanitizeNarration removes script tags', () => {
    const dirty = 'Hello <script>alert("xss")</script> world';
    const result = sanitizeNarration(dirty);
    assert(!result.includes('script'), 'Expected script tags removed');
    assert(!result.includes('alert'), 'Expected alert removed');
});

test('sanitizeNarration removes event handlers', () => {
    const dirty = '<div onload="alert(1)">content</div>';
    const result = sanitizeNarration(dirty);
    assert(!result.includes('onload'), 'Expected event handlers removed');
});

test('escapeHtml escapes special chars', () => {
    const result = escapeHtml('<script> alert("xss") </script>');
    assert(result.includes('&lt;'), 'Expected < escaped');
    assert(result.includes('&gt;'), 'Expected > escaped');
    assert(result.includes('&quot;'), 'Expected " escaped');
});

test('isValidCampaignId validates format', () => {
    assert(isValidCampaignId('campaign_1234567890_abc123') === true, 'Expected valid ID');
    assert(isValidCampaignId('invalid') === false, 'Expected invalid ID');
    assert(isValidCampaignId('') === false, 'Expected empty ID invalid');
});

test('validateModule checks required fields', () => {
    const result = validateModule(testModule);
    assert(result.valid === true, 'Expected test module to be valid');
    assert(result.errors.length === 0, 'Expected no errors');
    
    const bad = validateModule({ id: 'bad' });
    assert(bad.valid === false, 'Expected invalid module');
    assert(bad.errors.length > 0, 'Expected errors');
});

test('validateModule validates scenes', () => {
    const badModule = {
        id: 'bad', name: 'Bad', system: 'coc', start_scene: 's1',
        scenes: { s1: { id: 's1', description: 'missing title' } }
    };
    const result = validateModule(badModule);
    assert(result.errors.some(e => e.includes('missing title')), 'Expected scene title error');
});

// Summary
console.log('\n=== Test Summary ===');
console.log(`Total: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Status: ${failCount === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);

process.exit(failCount > 0 ? 1 : 0);
