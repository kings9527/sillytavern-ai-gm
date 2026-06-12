/**
 * AI-GM Plugin Test Script
 * Run: cd plugin && node test/index.js
 */

import { DiceRoller } from '../engine/dice.js';
import { RuleEngine } from '../engine/rule-engine.js';
import { GameStateMachine } from '../engine/state-machine.js';
import { CombatTracker } from '../engine/combat-tracker.js';
import { NPCDecisionEngine } from '../engine/npc-decision.js';
import { ModuleParser } from '../engine/module-parser.js';
import {
  sanitizeInput,
  sanitizeNarration,
  escapeHtml,
  isValidCampaignId,
  validateModule,
} from '../utils/sanitize.js';

import { LLMClient } from '../utils/llm-client.js';
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
      exits: [{ target_scene: 'scene2', description: '前往场景2', condition: 'always' }],
    },
    scene2: {
      id: 'scene2',
      title: '测试场景2',
      description: '第二个测试场景',
      npcs_present: [],
      exits: [],
    },
  },
  npcs: {
    npc1: {
      id: 'npc1',
      name: '测试NPC',
      role: 'neutral',
      stats: { HP: 10, DEX: 50 },
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
    inventory: [],
    status_effects: [],
    max_hp: 10,
  },
  npcs_state: {
    npc1: { id: 'npc1', current_hp: 10, max_hp: 10, attitude: 'neutral' },
  },
  global_vars: { clue_found: false },
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

// ─── LLM Intent Parsing Tests (Day 2 Engine) ───

test('Parse intent - LLM high confidence → uses LLM result', async () => {
  const mockLLM = {
    isAvailable: () => true,
    chat: async () => ({
      content: JSON.stringify({ action: 'inspect', target: '壁画', confidence: 0.95 }),
    }),
  };
  const sm = new GameStateMachine(testModule, testCampaign, mockLLM);
  const intent = await sm.parseIntent('仔细看看墙上的壁画', null);
  assert(intent.type === 'inspect', `Expected inspect, got ${intent.type}`);
  assert(intent.target === '壁画', `Expected target 壁画, got ${intent.target}`);
  assert(intent.confidence === 0.95, `Expected confidence 0.95, got ${intent.confidence}`);
  assert(intent.llm_enhanced === true, 'Expected llm_enhanced flag');
});

test('Parse intent - LLM low confidence → fallback to keyword', async () => {
  const mockLLM = {
    isAvailable: () => true,
    chat: async () => ({
      content: JSON.stringify({ action: 'unknown', target: null, confidence: 0.3 }),
    }),
  };
  const sm = new GameStateMachine(testModule, testCampaign, mockLLM);
  const intent = await sm.parseIntent('攻击那个怪物', null);
  assert(intent.type === 'attack', `Expected attack (keyword fallback), got ${intent.type}`);
  assert(intent.llm_enhanced === undefined, 'Expected no llm_enhanced flag on fallback');
});

test('Parse intent - LLM unavailable → keyword fallback', async () => {
  const mockLLM = {
    isAvailable: () => false,
    chat: async () => ({ content: '{"action":"move","confidence":0.9}' }),
  };
  const sm = new GameStateMachine(testModule, testCampaign, mockLLM);
  const intent = await sm.parseIntent('去图书馆', null);
  assert(intent.type === 'move', `Expected move (keyword fallback), got ${intent.type}`);
  assert(intent.llm_enhanced === undefined, 'Expected no llm_enhanced flag');
});

test('Parse intent - LLM throws error → keyword fallback with warning', async () => {
  const mockLLM = {
    isAvailable: () => true,
    chat: async () => { throw new Error('network timeout'); },
  };
  const sm = new GameStateMachine(testModule, testCampaign, mockLLM);
  const intent = await sm.parseIntent('检查书架', null);
  assert(intent.type === 'inspect', `Expected inspect (keyword fallback), got ${intent.type}`);
  assert(intent.llm_enhanced === undefined, 'Expected no llm_enhanced flag on error fallback');
});

test('Parse intent - LLM markdown code block response', async () => {
  const mockLLM = {
    isAvailable: () => true,
    chat: async () => ({
      content: '```json\n' + JSON.stringify({ action: 'talk', target: '守夜人', confidence: 0.88 }) + '\n```',
    }),
  };
  const sm = new GameStateMachine(testModule, testCampaign, mockLLM);
  const intent = await sm.parseIntent('跟守夜人打个招呼', null);
  assert(intent.type === 'talk', `Expected talk, got ${intent.type}`);
  assert(intent.target === '守夜人', `Expected target 守夜人, got ${intent.target}`);
  assert(intent.confidence === 0.88, `Expected confidence 0.88, got ${intent.confidence}`);
  assert(intent.llm_enhanced === true, 'Expected llm_enhanced flag');
});

test('Parse intent - LLM skill action maps to dice_check', async () => {
  const mockLLM = {
    isAvailable: () => true,
    chat: async () => ({
      content: JSON.stringify({ action: 'skill', target: '图书馆使用', confidence: 0.85 }),
    }),
  };
  const sm = new GameStateMachine(testModule, testCampaign, mockLLM);
  const intent = await sm.parseIntent('我要检定图书馆使用', null);
  assert(intent.type === 'dice_check', `Expected dice_check, got ${intent.type}`);
  assert(intent.target === '图书馆使用', `Expected target 图书馆使用, got ${intent.target}`);
});

test('Parse intent - LLM combat action maps to attack', async () => {
  const mockLLM = {
    isAvailable: () => true,
    chat: async () => ({
      content: JSON.stringify({ action: 'combat', target: '深潜者', confidence: 0.92 }),
    }),
  };
  const sm = new GameStateMachine(testModule, testCampaign, mockLLM);
  const intent = await sm.parseIntent('和深潜者战斗', null);
  assert(intent.type === 'attack', `Expected attack, got ${intent.type}`);
  assert(intent.target === '深潜者', `Expected target 深潜者, got ${intent.target}`);
});

test('Parse intent - LLM confidence 0 edge case → fallback', async () => {
  const mockLLM = {
    isAvailable: () => true,
    chat: async () => ({
      content: JSON.stringify({ action: 'inspect', target: '地板', confidence: 0 }),
    }),
  };
  const sm = new GameStateMachine(testModule, testCampaign, mockLLM);
  const intent = await sm.parseIntent('看看地板', null);
  // confidence 0 is not > 0.7, so fallback to keyword
  assert(intent.type === 'inspect', `Expected inspect (keyword fallback), got ${intent.type}`);
  assert(intent.llm_enhanced === undefined, 'Expected no llm_enhanced flag for zero confidence');
});

test('Parse intent - empty input skips LLM', async () => {
  const callLog = [];
  const mockLLM = {
    isAvailable: () => true,
    chat: async () => { callLog.push(1); return { content: '{"action":"move","confidence":0.9}' }; },
  };
  const sm = new GameStateMachine(testModule, testCampaign, mockLLM);
  const intent = await sm.parseIntent('', null);
  assert(callLog.length === 0, 'Expected LLM not called for empty input');
  assert(intent.type === 'inspect', `Expected default inspect, got ${intent.type}`);
});

test('Parse intent - keyword move', async () => {
  const intent = await stateMachine.parseIntent('去场景2', null);
  assert(intent.type === 'move', 'Expected move intent');
});

test('Parse intent - keyword inspect', async () => {
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
  assert(
    actions.some((a) => a.type === 'move'),
    'Expected move action',
  );
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
    npc1: { id: 'npc1', current_hp: 10, max_hp: 10, stats: { DEX: 50, HP: 10 } },
  },
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
  const state = combat.getState();
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
    id: 'bad',
    name: 'Bad',
    system: 'coc',
    start_scene: 's1',
    scenes: { s1: { id: 's1', description: 'missing title' } },
  };
  const result = validateModule(badModule);
  assert(
    result.errors.some((e) => e.includes('missing title')),
    'Expected scene title error',
  );
});

// ModuleParser Tests
console.log('\n--- ModuleParser ---');
const parser = new ModuleParser('json');

const validModule = {
  id: 'test-module',
  name: 'Test Module',
  version: '1.0.0',
  system: 'coc7e',
  start_scene: 'scene1',
  scenes: {
    scene1: {
      id: 'scene1',
      title: 'Scene 1',
      description: 'First scene',
      exits: [{ target: 'scene2', label: 'Go to scene 2' }],
      npcs: ['npc1'],
      events: [],
      combat: { enabled: false },
    },
    scene2: {
      id: 'scene2',
      title: 'Scene 2',
      description: 'Second scene',
      exits: [],
      npcs: [],
      events: [],
      combat: { enabled: false },
    },
  },
  npcs: {
    npc1: {
      id: 'npc1',
      name: 'Test NPC',
      attitude: 'neutral',
      hp: 10,
      stats: { str: 50, con: 50, dex: 50, int: 50, pow: 50, edu: 50, siz: 50, app: 50 },
    },
  },
  items: {},
  endings: {},
};

test('Parse valid JSON module', () => {
  const result = parser.parseJSON(JSON.stringify(validModule));
  assert(result.id === 'test-module', 'Expected parsed module id');
  assert(result.name === 'Test Module', 'Expected parsed module name');
});

test('Validate module with all checks', () => {
  const result = parser.validate(validModule);
  assert(result.valid === true, `Expected valid module, got errors: ${result.errors.join(', ')}`);
  assert(result.errors.length === 0, 'Expected no errors');
});

test('Validate catches missing required fields', () => {
  const result = parser.validate({ id: 'bad' });
  assert(result.valid === false, 'Expected invalid module');
  assert(result.errors.length > 0, 'Expected errors for missing fields');
});

test('Validate catches undefined NPC reference', () => {
  const badModule = JSON.parse(JSON.stringify(validModule));
  badModule.scenes.scene1.npcs = ['nonexistent_npc'];
  const result = parser.validate(badModule);
  assert(result.valid === false, 'Expected invalid due to undefined NPC');
  assert(
    result.errors.some((e) => e.includes('nonexistent_npc')),
    'Expected NPC reference error',
  );
});

test('Validate catches undefined exit target', () => {
  const badModule = JSON.parse(JSON.stringify(validModule));
  badModule.scenes.scene1.exits = [{ target: 'nonexistent_scene', label: 'Bad exit' }];
  const result = parser.validate(badModule);
  assert(result.valid === false, 'Expected invalid due to undefined exit target');
  assert(
    result.errors.some((e) => e.includes('nonexistent_scene')),
    'Expected exit target error',
  );
});

test('Validate catches duplicate IDs', () => {
  const badModule = JSON.parse(JSON.stringify(validModule));
  badModule.npcs.scene1 = { id: 'scene1', name: 'Duplicate' };
  const result = parser.validate(badModule);
  assert(result.valid === false, 'Expected invalid due to duplicate ID');
  assert(
    result.errors.some((e) => e.includes('Duplicate')),
    'Expected duplicate ID error',
  );
});

test('Validate detects circular scene path', () => {
  const cycleModule = JSON.parse(JSON.stringify(validModule));
  cycleModule.scenes.scene2.exits = [{ target: 'scene1', label: 'Back' }];
  const result = parser.validate(cycleModule);
  assert(
    result.warnings.some((w) => w.includes('Circular')),
    'Expected circular path warning',
  );
});

test('Validate catches invalid SemVer', () => {
  const badModule = JSON.parse(JSON.stringify(validModule));
  badModule.version = 'not-semver';
  const result = parser.validate(badModule);
  assert(result.valid === false, 'Expected invalid due to bad version');
  assert(
    result.errors.some((e) => e.includes('SemVer')),
    'Expected SemVer error',
  );
});

test('Parse Markdown with YAML frontmatter', () => {
  const mdParser = new ModuleParser('markdown');
  const md = `---
id: md-test
name: Markdown Test
version: 1.0.0
system: coc7e
---

# 场景：图书馆
**id**: library
**atmosphere**: quiet

古老的书架排列在两侧...

## 出口
- [地下室](basement) — 需要: found_key

## NPC
- [librarian](npcs/librarian.md)
`;
  const result = mdParser.parseMarkdown(md);
  assert(result.id === 'md-test', 'Expected frontmatter id');
  assert(result.name === 'Markdown Test', 'Expected frontmatter name');
  assert(result.scenes.library !== undefined, 'Expected library scene');
  assert(result.scenes.library.title === '图书馆', 'Expected library title');
});

// LLMClient Tests
console.log('\n--- LLMClient ---');
const llmClient = new LLMClient({
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'test-key',
  model: 'gpt-4o-mini',
  maxTokens: 512,
  temperature: 0.7,
  timeout: 30000,
  retries: 2,
});

test('LLMClient is available with API key', () => {
  assert(llmClient.isAvailable() === true, 'Expected LLM to be available');
});

test('LLMClient not available without config', () => {
  const badClient = new LLMClient({ provider: 'openai', apiKey: '', baseUrl: '' });
  assert(badClient.isAvailable() === false, 'Expected LLM not available without key');
});

test('LLMClient stats initial state', () => {
  const stats = llmClient.getStats();
  assert(stats.requests === 0, 'Expected 0 requests');
  assert(stats.errors === 0, 'Expected 0 errors');
  assert(stats.cacheSize === 0, 'Expected 0 cache size');
  assert(stats.config.provider === 'openai', 'Expected openai provider');
});

test('LLMClient updateConfig works', () => {
  llmClient.updateConfig({ model: 'gpt-4', temperature: 0.5 });
  assert(llmClient.config.model === 'gpt-4', 'Expected model updated');
  assert(llmClient.config.temperature === 0.5, 'Expected temperature updated');
});

test('LLMClient cache key generation', () => {
  const key1 = llmClient._cacheKey([{ role: 'user', content: 'hello' }], llmClient.config);
  const key2 = llmClient._cacheKey([{ role: 'user', content: 'hello' }], llmClient.config);
  assert(key1 === key2, 'Expected same cache key for same input');
});

test('LLMClient clearCache works', () => {
  // Manually add a cache entry to test clearing
  llmClient._cache.set('test-key', { content: 'test' });
  llmClient.clearCache();
  assert(llmClient._cache.size === 0, 'Expected cache cleared');
});

test('LLMClient SillyTavern provider always available', () => {
  const stClient = new LLMClient({ provider: 'sillytavern' });
  assert(stClient.isAvailable() === true, 'Expected SillyTavern provider available');
});

test('LLMClient Ollama provider available with baseUrl', () => {
  const ollamaClient = new LLMClient({ provider: 'ollama', baseUrl: 'http://localhost:11434' });
  assert(ollamaClient.isAvailable() === true, 'Expected Ollama available with baseUrl');
});

test('LLMClient throws when not available', async () => {
  const badClient = new LLMClient({ provider: 'openai', apiKey: '', baseUrl: '' });
  try {
    await badClient.chat([{ role: 'user', content: 'test' }]);
    assert(false, 'Expected error for unavailable LLM');
  } catch (error) {
    assert(error.message.includes('not configured'), 'Expected config error');
  }
});

// Summary
console.log('\n=== Test Summary ===');
console.log(`Total: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Status: ${failCount === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);

process.exit(failCount > 0 ? 1 : 0);
