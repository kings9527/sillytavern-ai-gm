/**
 * STChatBridge End-to-End Tests
 * Verifies: STChatBridge → StateMachine → NPCDecision chat history flow
 * Run: cd plugin && node test/stchatbridge-end-to-end.test.js
 */

import { GameStateMachine } from '../engine/state-machine.js';
import { NPCDecisionEngine } from '../engine/npc-decision.js';
import { STChatBridge } from '../utils/st-chat-bridge.js';

/* ---------- Test fixtures ---------- */

const testModule = {
  id: 'e2e_test_module',
  name: 'E2E Test Module',
  system: 'coc',
  start_scene: 'tavern',
  scenes: {
    tavern: {
      id: 'tavern',
      title: '旧酒馆',
      description: '一间破旧的酒馆，角落里坐着一个神秘人。',
      npcs: ['stranger'],
      exits: [{ target: 'street', description: '出门' }],
    },
    street: {
      id: 'street',
      title: '街道',
      description: '冷冷清清的街道。',
      npcs: [],
      exits: [],
    },
  },
  npcs: {
    stranger: {
      id: 'stranger',
      name: '神秘人',
      role: 'neutral',
      attitude: 'neutral',
      hp: 12,
      sanity: 50,
      stats: { STR: 50, DEX: 60, INT: 70 },
    },
  },
};

const testCampaign = {
  id: 'e2e_campaign',
  module_id: 'e2e_test_module',
  current_scene: 'tavern',
  scene_history: ['tavern'],
  player: {
    id: 'player_1',
    name: '调查员',
    hp: 12,
    max_hp: 12,
    sanity: 60,
    max_sanity: 60,
    stats: { STR: 50, CON: 50, DEX: 50, INT: 70, POW: 60 },
  },
  npcs_state: {
    stranger: {
      id: 'stranger',
      current_hp: 12,
      attitude: 'neutral',
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      turns_in_scene: 0,
      is_alive: true,
    },
  },
  flags: {},
  turn: 1,
  combat_state: null,
  module: testModule,
};

/* ---------- Mock helpers ---------- */

class MockGameController {
  constructor() {
    this.receivedActions = [];
  }
  async handleAction(action) {
    this.receivedActions.push(action);
    return { success: true };
  }
}

class MockLLMClient {
  constructor(opts = {}) {
    this._available = opts.available !== false;
    this._response =
      opts.response ||
      '{"action":"talk","confidence":0.8,"reasoning":"回应玩家","mood":"neutral","target_id":"player_1"}';
    this._calls = [];
  }
  isAvailable() {
    return this._available;
  }
  async chat(messages) {
    this._calls.push({ messages });
    return { content: this._response };
  }
  async sendMessages(messages) {
    return this.chat(messages);
  }
  getCalls() {
    return this._calls;
  }
}

/* ---------- Test harness ---------- */

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

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passCount++;
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    failCount++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`);
}

/* ---------- Tests ---------- */

console.log('=== STChatBridge End-to-End Tests ===\n');

// 1. STChatBridge unit: caching and context retrieval
console.log('--- STChatBridge Context ---');

let bridge, mockCtrl;

function setupBridge() {
  mockCtrl = new MockGameController();
  bridge = new STChatBridge(mockCtrl, { maxContextMessages: 5, autoParse: true });
  bridge.start();
}

setupBridge();

bridge.onUserMessage(1, '你好，有人在吗？');
bridge.onCharacterMessage(2, '……谁？');
bridge.onUserMessage(3, '我叫调查员，来这里打听消息。');

const ctx = bridge.getRecentContext(10);
test('getRecentContext returns formatted chat history', () => {
  assert(ctx.includes('玩家: 你好，有人在吗？'), 'Missing first user msg');
  assert(ctx.includes('AI: ……谁？'), 'Missing character msg');
  assert(ctx.includes('玩家: 我叫调查员'), 'Missing second user msg');
});

test('getRecentContext respects limit', () => {
  const limited = bridge.getRecentContext(2);
  const lines = limited.split('\n').filter((l) => l.trim());
  assertEqual(lines.length, 2, 'Should return exactly 2 messages');
});

// 2. STChatBridge integration: enriched action includes chat_history
console.log('\n--- STChatBridge Action Enrichment ---');

setupBridge();
bridge.onUserMessage(1, '调查桌子');

test('_sendAction enriches action with chat_history', () => {
  assert(mockCtrl.receivedActions.length > 0, 'Action should have been sent');
  const action = mockCtrl.receivedActions[0];
  assert(action.chat_history !== undefined, 'chat_history field missing');
  assert(action.chat_history.includes('玩家: 调查桌子'), 'chat_history should include user input');
});

// 3. GameStateMachine → handleTalk → NPCDecision with chatHistory
console.log('\n--- StateMachine → NPCDecision Chat History ---');

async function testStateMachineChatHistory() {
  const campaign = structuredClone(testCampaign);
  const gsm = new GameStateMachine(testModule, campaign);
  // (removed unused: mockLLM)

  const chatHistory = '玩家: 你在这里做什么？\nAI: 这不关你的事。\n玩家: 别紧张，我只是想聊聊。';

  const result = await gsm.processAction({
    action_type: 'talk',
    player_input: '和神秘人说话',
    chat_history: chatHistory,
  });

  testAsync('processAction handleTalk passes chat_history through', async () => {
    assertEqual(result.type, 'interaction', 'Expected interaction result');
    assertEqual(result.interaction_type, 'talk', 'Expected talk interaction');
    assert(result.npc_decision, 'Expected npc_decision in result');
  });
}

await testStateMachineChatHistory();

// 4. NPCDecisionEngine decides() receives chatHistory in LLM prompt
console.log('\n--- NPCDecision LLM Prompt Integration ---');

async function testNpcDecisionPrompt() {
  const campaign = structuredClone(testCampaign);
  const engine = new NPCDecisionEngine(campaign, 'stranger');
  const mockLLM = new MockLLMClient({
    response:
      '{"action":"talk","confidence":0.85,"reasoning":"玩家表现友好","mood":"friendly","target_id":"player_1"}',
  });

  const chatHistory = '玩家: 你在这里做什么？\nAI: 这不关你的事。';

  await engine.decide({ type: 'player_talk', player_input: '我想和你聊聊' }, mockLLM, chatHistory);

  testAsync('NPCDecision LLM prompt includes chat history', async () => {
    const calls = mockLLM.getCalls();
    assert(calls.length > 0, 'LLM should have been called');
    const userMsg = calls[0].messages.find((m) => m.role === 'user');
    assert(userMsg, 'User message should exist');
    assert(
      userMsg.content.includes('Recent conversation'),
      'Prompt should contain "Recent conversation" header',
    );
    assert(userMsg.content.includes('你在这里做什么'), 'Prompt should include actual chat content');
  });
}

await testNpcDecisionPrompt();

// 5. Full pipeline: STChatBridge cache → getRecentContext → action enrichment
console.log('\n--- Full Pipeline: Cache → Context → Action ---');

async function testFullPipeline() {
  const ctrl = new MockGameController();
  const br = new STChatBridge(ctrl, { maxContextMessages: 10, autoParse: true });
  br.start();

  // Simulate a short conversation
  br.onCharacterMessage(1, '深夜的酒馆里，一个披着斗篷的陌生人抬起头。');
  br.onUserMessage(2, '和神秘人说话');
  br.onCharacterMessage(3, '……有什么事？');
  // Use a message with game action keyword to trigger _sendAction
  br.onUserMessage(4, '告诉神秘人我知道真相');

  // The last user message should trigger action enrichment
  const lastAction = ctrl.receivedActions[ctrl.receivedActions.length - 1];

  testAsync('Full pipeline: action.chat_history contains multi-turn context', async () => {
    assert(lastAction, 'An action should have been sent');
    const hist = lastAction.chat_history || '';
    assert(hist.includes('深夜的酒馆里'), 'Should include earlier character msg');
    assert(hist.includes('……有什么事？'), 'Should include mid-conversation msg');
    assert(hist.includes('告诉神秘人我知道真相'), 'Should include latest user msg');
  });
}

await testFullPipeline();

// 6. Edge case: empty cache still produces string (not undefined)
console.log('\n--- Edge Cases ---');

async function testEmptyCache() {
  const ctrl = new MockGameController();
  const br = new STChatBridge(ctrl, { maxContextMessages: 5, autoParse: true });
  br.start();

  // No messages cached prior to this; onUserMessage caches then sends
  br.onUserMessage(1, '检查');

  testAsync('Empty prior cache: chat_history contains current user message', async () => {
    assert(ctrl.receivedActions.length > 0, 'Action should be sent');
    const hist = ctrl.receivedActions[0].chat_history || '';
    assert(hist.includes('玩家: 检查'), 'Current user message should appear in chat_history');
  });
}

await testEmptyCache();

async function testCacheTruncation() {
  const ctrl = new MockGameController();
  const br = new STChatBridge(ctrl, { maxContextMessages: 3, autoParse: true });
  br.start();

  // Fill cache beyond limit
  br.onUserMessage(1, '第一条');
  br.onCharacterMessage(2, '回复一');
  br.onUserMessage(3, '第二条');
  br.onCharacterMessage(4, '回复二');
  br.onUserMessage(5, '第三条');

  const hist = br.getRecentContext(10);

  testAsync('Cache respects maxContextMessages limit', async () => {
    const lines = hist.split('\n').filter((l) => l.trim());
    assertEqual(lines.length, 3, 'Should only retain 3 messages');
    assert(!hist.includes('第一条'), 'Oldest message should be evicted');
    assert(hist.includes('第三条'), 'Newest message should remain');
  });
}

await testCacheTruncation();

/* ---------- Summary ---------- */

console.log('\n=== Test Summary ===');
console.log(`Total: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Status: ${failCount === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);

process.exit(failCount > 0 ? 1 : 0);
