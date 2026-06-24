/**
 * NPC Decision Engine LLM Integration Tests (Phase 2)
 * Tests: decide() LLM fallback path, chat history context, PromptBuilder integration
 * Run: cd plugin && node test/npc-decision-llm.test.js
 */

import { NPCDecisionEngine } from '../engine/npc-decision.js';

// Mock LLM client with configurable behavior
class MockLLMClient {
  constructor(opts = {}) {
    this._available = opts.available !== false;
    this._response = opts.response || null;
    this._shouldFail = opts.shouldFail || false;
    this._callLog = [];
  }
  isAvailable() {
    return this._available;
  }
  async chat(messages, options) {
    this._callLog.push({ messages, options });
    if (this._shouldFail) throw new Error('Mock LLM failure');
    if (this._response) return { content: this._response };
    return {
      content:
        '{"action":"talk","confidence":0.75,"reasoning":"Mock","mood":"neutral","target_id":"player"}',
    };
  }
  getCallLog() {
    return this._callLog;
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
      npcs: ['npc1', 'enemy1'],
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
    enemy1: {
      id: 'enemy1',
      name: '敌人',
      role: 'enemy',
      personality: '凶残、嗜血',
      hp: 20,
      stats: { HP: 20, DEX: 60 },
    },
  },
};

function makeCampaign(overrides = {}) {
  return {
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
      enemy1: {
        id: 'enemy1',
        current_hp: 20,
        max_hp: 20,
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
    ...overrides,
  };
}

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

console.log('=== NPC Decision Engine LLM Integration Tests ===\n');

// ==================== decide() Rule Bypass ====================
console.log('--- decide() Rule Bypass ---');

const campaign = makeCampaign();

async function testRuleBypass() {
  test('High-confidence rule bypasses LLM (dead NPC)', async () => {
    const deadCampaign = makeCampaign();
    deadCampaign.npcs_state.npc1.is_alive = false;
    deadCampaign.npcs_state.npc1.current_hp = 0;
    const engine = new NPCDecisionEngine(deadCampaign, 'npc1');
    const mockClient = new MockLLMClient({ response: '{"action":"attack"}' });
    const decision = await engine.decide({ type: 'player_talk' }, mockClient);
    assertEqual(decision.action, 'dead', 'Expected dead action');
    assertEqual(mockClient.getCallLog().length, 0, 'LLM should not be called');
  });

  test('High-confidence rule bypasses LLM (critical HP ally)', async () => {
    const hurtCampaign = makeCampaign();
    hurtCampaign.npcs_state.npc1.current_hp = 1; // 10% HP
    hurtCampaign.npcs_state.npc1.role = 'ally';
    hurtCampaign.module.npcs.npc1.role = 'ally';
    const engine = new NPCDecisionEngine(hurtCampaign, 'npc1');
    const mockClient = new MockLLMClient({ response: '{"action":"attack"}' });
    const decision = await engine.decide({ type: 'player_talk' }, mockClient);
    assertEqual(decision.action, 'flee', 'Expected flee for critical HP ally');
    assert(decision.confidence >= 0.85, 'Expected high confidence rule');
    assertEqual(mockClient.getCallLog().length, 0, 'LLM should not be called');
  });

  test('High-confidence rule bypasses LLM (combat attack)', async () => {
    const combatCampaign = makeCampaign();
    combatCampaign.combat_state = { active: true, current_turn: 'enemy1' };
    combatCampaign.module.npcs.npc1.role = 'enemy';
    combatCampaign.npcs_state.npc1.attitude = 'hostile';
    const engine = new NPCDecisionEngine(combatCampaign, 'npc1');
    const mockClient = new MockLLMClient({ response: '{"action":"flee"}' });
    const decision = await engine.decide({ type: 'combat_turn' }, mockClient);
    assertEqual(decision.action, 'attack', 'Expected attack in combat');
    assertEqual(mockClient.getCallLog().length, 0, 'LLM should not be called');
  });
}

// ==================== decide() LLM Fallback ====================
console.log('--- decide() LLM Fallback ---');

async function testLLMFallback() {
  test('LLM fallback triggers when rule confidence < 0.85', async () => {
    const engine = new NPCDecisionEngine(campaign, 'npc1');
    const mockClient = new MockLLMClient({
      response:
        '{"action":"talk","confidence":0.85,"reasoning":"试探","mood":"curious","target_id":"player","dialogue_topic":"greeting"}',
    });
    // Neutral attitude + non-combat + no critical state = low rule confidence
    const decision = await engine.decide({ type: 'player_talk', player_input: '你好' }, mockClient);
    assertEqual(decision.action, 'talk', 'Expected LLM talk action');
    assertEqual(decision.llm_enhanced, true, 'Expected llm_enhanced flag');
    assert(mockClient.getCallLog().length > 0, 'LLM should be called');
  });

  test('LLM fallback with chat history included in prompt', async () => {
    const engine = new NPCDecisionEngine(campaign, 'npc1');
    const mockClient = new MockLLMClient({
      response:
        '{"action":"talk","confidence":0.8,"reasoning":"回应","mood":"friendly","target_id":"player"}',
    });
    const chatHistory = '玩家: 你在这里做什么？\nNPC: 这不关你的事。';
    await engine.decide({ type: 'player_talk', player_input: '告诉我' }, mockClient, chatHistory);
    const calls = mockClient.getCallLog();
    assert(calls.length > 0, 'LLM should be called');
    const lastUserMsg = calls[0].messages.find((m) => m.role === 'user');
    assert(lastUserMsg.content.includes('Recent conversation'), 'Chat history should be in prompt');
    assert(lastUserMsg.content.includes('你在这里做什么'), 'Chat content should be in prompt');
  });

  test('LLM failure falls back to attitude-based decision', async () => {
    const engine = new NPCDecisionEngine(campaign, 'npc1');
    const mockClient = new MockLLMClient({ shouldFail: true });
    const decision = await engine.decide({ type: 'player_talk' }, mockClient);
    assertEqual(decision.action, 'talk', 'Expected attitude fallback talk');
    assertEqual(decision.confidence, 0.6, 'Expected attitude confidence');
  });

  test('LLM returns invalid JSON falls back to attitude', async () => {
    const engine = new NPCDecisionEngine(campaign, 'npc1');
    const mockClient = new MockLLMClient({ response: 'not json' });
    const decision = await engine.decide({ type: 'player_talk' }, mockClient);
    assertEqual(decision.action, 'talk', 'Expected fallback on bad JSON');
  });

  test('LLM returns null action falls back to attitude', async () => {
    const engine = new NPCDecisionEngine(campaign, 'npc1');
    const mockClient = new MockLLMClient({ response: '{"confidence":0.5}' });
    const decision = await engine.decide({ type: 'player_talk' }, mockClient);
    assertEqual(decision.action, 'talk', 'Expected fallback on missing action');
  });
}

// ==================== decide() Chat History Integration ====================
console.log('--- decide() Chat History Integration ---');

async function testChatHistory() {
  test('Empty chat history does not break prompt', async () => {
    const engine = new NPCDecisionEngine(campaign, 'npc1');
    const mockClient = new MockLLMClient({
      response:
        '{"action":"ignore","confidence":0.6,"reasoning":"无感","mood":"neutral","target_id":null}',
    });
    const decision = await engine.decide({ type: 'idle' }, mockClient, '');
    assertEqual(decision.action, 'ignore', 'Expected ignore action');
    const calls = mockClient.getCallLog();
    assert(calls.length > 0, 'LLM should be called');
    const userMsg = calls[0].messages.find((m) => m.role === 'user');
    assert(!userMsg.content.includes('Recent conversation'), 'Empty chat should be omitted');
  });

  test('Long chat history truncated gracefully in prompt', async () => {
    const engine = new NPCDecisionEngine(campaign, 'npc1');
    const mockClient = new MockLLMClient({
      response:
        '{"action":"talk","confidence":0.7,"reasoning":"回应","mood":"neutral","target_id":"player"}',
    });
    const longHistory = Array(50).fill('玩家: 测试').join('\n');
    await engine.decide({ type: 'player_talk' }, mockClient, longHistory);
    const calls = mockClient.getCallLog();
    assert(calls.length > 0, 'LLM should be called');
    const userMsg = calls[0].messages.find((m) => m.role === 'user');
    assert(userMsg.content.length > 0, 'Prompt should not be empty');
  });
}

// ==================== PromptBuilder Integration ====================
console.log('--- PromptBuilder Integration ---');

async function testPromptBuilderIntegration() {
  test('GM context from PromptBuilder is included in system prompt', async () => {
    const engine = new NPCDecisionEngine(campaign, 'npc1');
    const mockClient = new MockLLMClient({
      response:
        '{"action":"talk","confidence":0.75,"reasoning":"GM上下文","mood":"neutral","target_id":"player"}',
    });
    await engine.decide({ type: 'player_talk' }, mockClient);
    const calls = mockClient.getCallLog();
    assert(calls.length > 0, 'LLM should be called');
    const sysMsg = calls[0].messages.find((m) => m.role === 'system');
    assert(sysMsg.content.includes('Game Master'), 'GM context should be present');
    assert(sysMsg.content.includes('Current Scene'), 'Scene context should be present');
  });
}

// ==================== Edge Cases ====================
console.log('--- Edge Cases ---');

async function testEdgeCases() {
  test('No LLM client falls back to attitude', async () => {
    const engine = new NPCDecisionEngine(campaign, 'npc1');
    const decision = await engine.decide({ type: 'player_talk' }, null);
    assertEqual(decision.action, 'talk', 'Expected attitude fallback');
    assertEqual(decision.confidence, 0.6, 'Expected attitude confidence');
  });

  test('LLM unavailable falls back to attitude', async () => {
    const engine = new NPCDecisionEngine(campaign, 'npc1');
    const mockClient = new MockLLMClient({ available: false });
    const decision = await engine.decide({ type: 'player_talk' }, mockClient);
    assertEqual(decision.action, 'talk', 'Expected attitude fallback');
  });

  test('Hostile NPC attitude fallback is attack', async () => {
    const hostileCampaign = makeCampaign();
    hostileCampaign.npcs_state.npc1.attitude = 'hostile';
    hostileCampaign.module.npcs.npc1.role = 'enemy';
    const engine = new NPCDecisionEngine(hostileCampaign, 'npc1');
    const decision = await engine.decide({ type: 'player_talk' }, null);
    assertEqual(decision.action, 'attack', 'Expected hostile attack fallback');
  });

  test('Afraid NPC attitude fallback is flee', async () => {
    const afraidCampaign = makeCampaign();
    afraidCampaign.npcs_state.npc1.attitude = 'afraid';
    const engine = new NPCDecisionEngine(afraidCampaign, 'npc1');
    const decision = await engine.decide({ type: 'player_talk' }, null);
    assertEqual(decision.action, 'flee', 'Expected afraid flee fallback');
  });
}

// Run all tests
(async () => {
  await testRuleBypass();
  await testLLMFallback();
  await testChatHistory();
  await testPromptBuilderIntegration();
  await testEdgeCases();

  console.log('\n=== Test Summary ===');
  console.log(`Total: ${passCount + failCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Status: ${failCount === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);

  process.exit(failCount > 0 ? 1 : 0);
})();
