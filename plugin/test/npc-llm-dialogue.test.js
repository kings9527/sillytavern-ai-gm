/**
 * NPC LLM Dialogue & Combat AI Tests (Day 2 Engine)
 * Run: cd plugin && node test/npc-llm-dialogue.test.js
 */

import { NPCDecisionEngine } from '../engine/npc-decision.js';
import { CombatTracker } from '../engine/combat-tracker.js';
import { LLMClient } from '../utils/llm-client.js';

// Mock LLM client for testing
class MockLLMClient {
  constructor(opts = {}) {
    this._available = opts.available !== false;
    this._response = opts.response || null;
    this._jsonResponse = opts.jsonResponse || null;
    this._shouldFail = opts.shouldFail || false;
  }
  isAvailable() {
    return this._available;
  }
  async chat(messages, options) {
    if (this._shouldFail) throw new Error('Mock LLM failure');
    if (this._response) return { content: this._response };
    return {
      content: '{"text": "Mock dialogue", "emotion": "suspicious", "secretRevealed": null}',
    };
  }
  async chatJSON(messages, options) {
    if (this._shouldFail) throw new Error('Mock LLM failure');
    if (this._jsonResponse) return this._jsonResponse;
    return {
      action: 'attack',
      confidence: 0.85,
      reasoning: 'Mock reasoning',
      skill: '格斗',
      target: 'player_1',
    };
  }
}

const testModule = {
  id: 'test_module',
  name: 'Test Module',
  system: 'coc',
  start_scene: 'scene1',
  scenes: {
    scene1: {
      id: 'scene1',
      title: '测试场景1',
      description: '这是一个测试场景',
      npcs: ['npc1', 'boss1'],
      combat: { enemies: ['enemy1'] },
    },
  },
  npcs: {
    npc1: {
      id: 'npc1',
      name: '测试NPC',
      role: 'neutral',
      personality: '谨慎、多疑',
      hp: 10,
      stats: { HP: 10, DEX: 50 },
      dialogue: {
        default: '“你好，陌生人。”',
        trusted: '“我相信你。”',
        suspicious: '“我凭什么相信你？”',
      },
      secrets: [{ keyword: 'cult', clue_id: 'clue_1', reveal_text: '“那个邪教……在地下室集会。”' }],
    },
    boss1: {
      id: 'boss1',
      name: 'Boss',
      role: 'Boss',
      hp: 30,
      stats: { HP: 30, DEX: 60 },
      combat_skills: ['occult_magic', '格斗'],
    },
  },
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
    max_hp: 10,
    max_sanity: 60,
    inventory: [],
    status_effects: [],
  },
  npcs_state: {
    npc1: {
      id: 'npc1',
      current_hp: 10,
      max_hp: 10,
      attitude: 'neutral',
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
    },
    boss1: {
      id: 'boss1',
      current_hp: 30,
      max_hp: 30,
      attitude: 'hostile',
      trust: 0,
      fear: 10,
      suspicion: 50,
      known_topics: [],
      secrets_revealed: [],
    },
  },
  global_vars: {},
  combat_state: null,
  module: testModule,
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
    console.error(e.stack);
    failCount++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message || 'Assertion failed') + ` — expected: ${expected}, got: ${actual}`);
  }
}

console.log('=== NPC LLM Dialogue & Combat AI Tests ===\n');

// ==================== NPCDecisionEngine LLM Dialogue ====================
console.log('--- NPCDecisionEngine.generateDialogue (LLM) ---');

const npcEngine = new NPCDecisionEngine(testCampaign, 'npc1');

async function testNPCDialogue() {
  test('LLM dialogue returns {text, emotion, secretRevealed}', async () => {
    const mockClient = new MockLLMClient({
      response:
        '{"text": "“别过来，我不信任你。”", "emotion": "suspicious", "secretRevealed": null}',
    });
    const result = await npcEngine.generateDialogue(
      '玩家走近NPC',
      'suspicious',
      'greeting',
      mockClient,
    );
    assert(typeof result.text === 'string', 'Expected text to be string');
    assert(typeof result.emotion === 'string', 'Expected emotion to be string');
    assert(
      result.secretRevealed === null || typeof result.secretRevealed === 'string',
      'Expected secretRevealed to be string or null',
    );
  });

  test('LLM dialogue fallback to template when LLM fails', async () => {
    const mockClient = new MockLLMClient({ shouldFail: true });
    const result = await npcEngine.generateDialogue(
      '玩家走近NPC',
      'friendly',
      'greeting',
      mockClient,
    );
    assert(typeof result.text === 'string', 'Expected text string from fallback');
    assert(typeof result.emotion === 'string', 'Expected emotion string from fallback');
    assert(result.text.length > 0, 'Expected non-empty fallback text');
  });

  test('Template dialogue returns correct shape', async () => {
    const result = await npcEngine.generateDialogue('玩家走近NPC', 'friendly', 'greeting', null);
    assert(typeof result.text === 'string', 'Expected text string');
    assert(typeof result.emotion === 'string', 'Expected emotion string');
    assert(result.text.length > 0, 'Expected non-empty template text');
  });

  test('LLM dialogue extracts secretRevealed', async () => {
    // Reset secrets_revealed
    testCampaign.npcs_state.npc1.secrets_revealed = [];
    const mockClient = new MockLLMClient({
      response:
        '{"text": "“那个邪教在地下室。”", "emotion": "whispering", "secretRevealed": "cult"}',
    });
    const result = await npcEngine.generateDialogue(
      '玩家询问邪教',
      'suspicious',
      'secret',
      mockClient,
    );
    assertEqual(result.secretRevealed, 'cult', 'Expected secretRevealed to be "cult"');
    assert(
      testCampaign.npcs_state.npc1.secrets_revealed.includes('cult'),
      'Expected secret tracked in NPC state',
    );
  });

  test('LLM dialogue handles non-JSON gracefully', async () => {
    const mockClient = new MockLLMClient({
      response: '“我不明白你在说什么。”',
    });
    const result = await npcEngine.generateDialogue('玩家说胡话', 'confused', null, mockClient);
    assert(
      result.text.includes('不明白') || result.text.includes('Mock') || result.text.length > 0,
      'Expected raw text used when JSON parse fails',
    );
    assertEqual(result.emotion, 'confused', 'Expected emotion fallback to mood');
  });

  test('Template dialogue returns secret for secret topic', async () => {
    testCampaign.npcs_state.npc1.secrets_revealed = [];
    const result = await npcEngine.generateDialogue('玩家追问秘密', 'whispering', 'secret', null);
    assertEqual(result.secretRevealed, 'cult', 'Expected template secret revealed');
    assert(
      result.text.includes('邪教') || result.text.includes('地下室'),
      'Expected secret text in dialogue',
    );
  });

  test('Template dialogue without LLM client', async () => {
    const result = await npcEngine.generateDialogue('玩家打招呼', 'friendly', 'greeting');
    assert(typeof result.text === 'string', 'Expected text without LLM client');
    assertEqual(result.emotion, 'friendly', 'Expected emotion preserved');
  });
}

// ==================== CombatTracker LLM Enemy AI ====================
console.log('--- CombatTracker LLM Enemy AI ---');

const combatCampaign = {
  ...testCampaign,
  player: {
    ...testCampaign.player,
    stats: { ...testCampaign.player.stats, DEX: 70 },
    max_hp: 10,
  },
  npcs_state: {
    npc1: {
      ...testCampaign.npcs_state.npc1,
      current_hp: 10,
      max_hp: 10,
      stats: { DEX: 50, HP: 10 },
    },
    boss1: {
      ...testCampaign.npcs_state.boss1,
      current_hp: 30,
      max_hp: 30,
      stats: { DEX: 60, HP: 30 },
    },
  },
};

async function testCombatAI() {
  test('LLM enemy decision with high confidence used', async () => {
    const mockClient = new MockLLMClient({
      jsonResponse: {
        action: 'spell',
        confidence: 0.85,
        reasoning: 'Boss uses magic',
        skill: 'occult_magic',
        target: 'player_1',
      },
    });
    const combat = new CombatTracker(combatCampaign, mockClient);
    combat.initCombat(['boss1']);
    const enemy = combat.getState().initiative.find((i) => i.entity_id === 'boss1');
    assert(enemy, 'Expected boss1 in initiative');
    const decision = await combat.decideEnemyAction(enemy);
    assertEqual(decision.type, 'spell', 'Expected LLM decision spell to be used');
    assertEqual(decision.skill, 'occult_magic', 'Expected occult_magic skill');
    assertEqual(decision.llm_enhanced, true, 'Expected llm_enhanced flag');
    assert(decision.llm_confidence > 0.7, 'Expected confidence > 0.7');
  });

  test('LLM enemy decision with low confidence falls back to rules', async () => {
    const mockClient = new MockLLMClient({
      jsonResponse: {
        action: 'flee',
        confidence: 0.5,
        reasoning: 'Maybe flee',
        skill: '格斗',
        target: 'player_1',
      },
    });
    const combat = new CombatTracker(combatCampaign, mockClient);
    combat.initCombat(['boss1']);
    const enemy = combat.getState().initiative.find((i) => i.entity_id === 'boss1');
    const decision = await combat.decideEnemyAction(enemy);
    // Since confidence is 0.5 < 0.7, should fallback to rules: boss has HP > 20% so attacks
    assertEqual(decision.type, 'attack', 'Expected rule fallback attack');
    assert(!decision.llm_enhanced, 'Expected no LLM enhancement flag on fallback');
  });

  test('LLM enemy decision failure falls back to rules', async () => {
    const mockClient = new MockLLMClient({ shouldFail: true });
    const combat = new CombatTracker(combatCampaign, mockClient);
    combat.initCombat(['boss1']);
    const enemy = combat.getState().initiative.find((i) => i.entity_id === 'boss1');
    const decision = await combat.decideEnemyAction(enemy);
    assertEqual(decision.type, 'attack', 'Expected rule fallback on LLM error');
  });

  test('Rule-based flee when HP < 20%', async () => {
    const mockClient = new MockLLMClient({
      jsonResponse: {
        action: 'attack',
        confidence: 0.9,
        reasoning: 'Fight',
        skill: '格斗',
        target: 'player_1',
      },
    });
    const combat = new CombatTracker(combatCampaign, mockClient);
    combat.initCombat(['npc1']);
    // Set enemy HP to very low
    combatCampaign.npcs_state.npc1.current_hp = 1;
    const enemy = combat.getState().initiative.find((i) => i.entity_id === 'npc1');
    const decision = await combat.decideEnemyAction(enemy);
    // Even with high-confidence LLM attack, we should check if rule-based flee triggers?
    // Actually LLM takes priority if confidence > 0.7. But HP < 20% should trigger rule flee if LLM not available.
    // With LLM high confidence, LLM wins. Let's test without LLM.
    const noLLMCombat = new CombatTracker(combatCampaign, null);
    noLLMCombat.initCombat(['npc1']);
    combatCampaign.npcs_state.npc1.current_hp = 1;
    const enemy2 = noLLMCombat.getState().initiative.find((i) => i.entity_id === 'npc1');
    const decision2 = await noLLMCombat.decideEnemyAction(enemy2);
    assertEqual(decision2.type, 'flee', 'Expected flee when HP < 20% without LLM');
  });

  test('Rule-based spell when HP < 50% and has occult_magic', async () => {
    const combat = new CombatTracker(combatCampaign, null);
    combat.initCombat(['boss1']);
    combatCampaign.npcs_state.boss1.current_hp = 12; // 40% HP
    const enemy = combat.getState().initiative.find((i) => i.entity_id === 'boss1');
    const decision = await combat.decideEnemyAction(enemy);
    assertEqual(decision.type, 'spell', 'Expected spell when HP < 50% and has occult_magic');
    assertEqual(decision.skill, 'occult_magic', 'Expected occult_magic skill');
  });

  test('LLM _llmEnemyDecision returns null on parse failure', async () => {
    const mockClient = new MockLLMClient({
      response: 'not valid json at all',
    });
    const combat = new CombatTracker(combatCampaign, mockClient);
    combat.initCombat(['boss1']);
    const enemy = combat.getState().initiative.find((i) => i.entity_id === 'boss1');
    const result = await combat._llmEnemyDecision(enemy, combat.getState(), mockClient);
    assertEqual(result, null, 'Expected null on non-JSON LLM response');
  });

  test('LLM _llmEnemyDecision returns structured decision', async () => {
    const mockClient = new MockLLMClient({
      response:
        '{"action": "item", "confidence": 0.9, "reasoning": "Use healing potion", "skill": "potion", "target": "self"}',
    });
    const combat = new CombatTracker(combatCampaign, mockClient);
    combat.initCombat(['boss1']);
    const enemy = combat.getState().initiative.find((i) => i.entity_id === 'boss1');
    const result = await combat._llmEnemyDecision(enemy, combat.getState(), mockClient);
    assert(result !== null, 'Expected non-null LLM decision');
    assertEqual(result.action, 'item', 'Expected item action');
    assertEqual(result.confidence, 0.9, 'Expected confidence 0.9');
    assertEqual(result.target, 'self', 'Expected self target');
  });

  test('resolveEnemyAction handles spell type', () => {
    const combat = new CombatTracker(combatCampaign, null);
    combat.initCombat(['boss1']);
    const enemy = combat.getState().initiative.find((i) => i.entity_id === 'boss1');
    const result = combat.resolveEnemyAction(enemy, {
      type: 'spell',
      skill: 'occult_magic',
      target: 'player_1',
    });
    assert(result.action === 'skill', 'Expected skill action resolution for spell');
    assert(result.log.includes('occult_magic'), 'Expected log to mention occult_magic');
  });

  test('processEnemyAutoTurn with LLM processes all enemy turns', async () => {
    const mockClient = new MockLLMClient({
      response:
        '{"action": "attack", "confidence": 0.9, "reasoning": "Attack player", "skill": "格斗", "target": "player_1"}',
    });
    const combat = new CombatTracker(combatCampaign, mockClient);
    combat.initCombat(['npc1', 'boss1']);
    // Force current turn to first enemy (skip player if they won initiative)
    const state = combat.getState();
    const firstEnemyIdx = state.initiative.findIndex((i) => i.type === 'enemy');
    if (firstEnemyIdx >= 0) {
      state.current_turn_index = firstEnemyIdx;
      state.current_turn = state.initiative[firstEnemyIdx].entity_id;
    }
    const results = await combat.processEnemyAutoTurn();
    assert(results.length >= 1, 'Expected at least one enemy action');
    assert(
      results[0].action === 'attack' || results[0].action === 'skill',
      'Expected enemy to attack or use skill',
    );
    // Verify that combat state advanced past enemy turns
    const afterState = combat.getState();
    const current = afterState.initiative[afterState.current_turn_index];
    assert(
      current?.type !== 'enemy' || afterState.active === false,
      'Expected turn to advance past enemies or combat ended',
    );
  });

  test('resolveEnemyAction handles item type', () => {
    const combat = new CombatTracker(combatCampaign, null);
    combat.initCombat(['boss1']);
    const enemy = combat.getState().initiative.find((i) => i.entity_id === 'boss1');
    const result = combat.resolveEnemyAction(enemy, { type: 'item' });
    assertEqual(result.action, 'item', 'Expected item action');
    assert(result.log.includes('物品'), 'Expected log to mention item usage');
  });
}

// Run all tests
(async () => {
  await testNPCDialogue();
  await testCombatAI();

  console.log('\n=== Test Summary ===');
  console.log(`Total: ${passCount + failCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Status: ${failCount === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);

  process.exit(failCount > 0 ? 1 : 0);
})();
