/**
 * State Machine Intent Parsing Tests — Day 2 Engine
 * Tests LLM-primary + keyword-fallback coexistence in GameStateMachine.parseIntent()
 */

import { GameStateMachine } from '../engine/state-machine.js';

// ========== Mock LLM Client ==========

function createMockLLMClient(responses) {
  let callIndex = 0;
  return {
    isAvailable: () => true,
    chat: async (messages, options) => {
      const response = responses[callIndex++];
      if (response instanceof Error) throw response;
      return response;
    },
    getCallCount: () => callIndex,
  };
}

// ========== Test Harness ==========

let passCount = 0;
let failCount = 0;

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passCount++;
    return;
  }
  failCount++;
  console.error(`  FAIL: ${message}`);
  console.error(`    Expected: ${expected}`);
  console.error(`    Actual: ${actual}`);
}

function assertTrue(actual, message) {
  if (actual) {
    passCount++;
    return;
  }
  failCount++;
  console.error(`  FAIL: ${message}`);
  console.error(`    Expected truthy, got: ${actual}`);
}

function assertObjectEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passCount++;
    return;
  }
  failCount++;
  console.error(`  FAIL: ${message}`);
  console.error(`    Expected: ${e}`);
  console.error(`    Actual: ${a}`);
}

// ========== Minimal Test Fixtures ==========

const TEST_MODULE = {
  scenes: {
    basement: {
      id: 'basement',
      title: '地下室',
      description: '潮湿的地下室...',
      exits: [{ target: 'hallway', label: '走廊' }],
      npcs: ['librarian'],
      interactables: ['key'],
    },
  },
  npcs: {
    librarian: { name: '老图书管理员' },
  },
  items: {
    key: { name: '古老钥匙' },
  },
};

const TEST_CAMPAIGN = {
  current_scene: 'basement',
  player: { sanity: 50, inventory: [] },
  global_vars: {},
  scene_history: [],
};

// ========== Tests ==========

async function runTests() {
  console.log('=== GameStateMachine.parseIntent() — LLM Primary + Keyword Fallback Tests ===\n');

  // Test 1: LLM high confidence → adopts LLM result, bypasses keyword
  console.log('Test 1: LLM high confidence (0.85) → LLM result adopted');
  {
    const mockLLM = createMockLLMClient([
      { content: '{"action": "move", "target": "hallway", "confidence": 0.85}' },
    ]);
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('我想去走廊看看');
    assertEqual(result.type, 'move', 'High confidence LLM result type should be "move"');
    assertEqual(result.llm_enhanced, true, 'Should be marked as llm_enhanced');
    assertEqual(result.confidence, 0.85, 'Confidence should match LLM output');
    assertEqual(result.target, 'hallway', 'Target should be extracted from LLM');
    assertTrue(mockLLM.getCallCount() === 1, 'LLM should be called exactly once');
  }

  // Test 2: LLM low confidence (0.5) → falls back to keyword
  console.log('Test 2: LLM low confidence (0.5) → fallback to keyword');
  {
    const mockLLM = createMockLLMClient([
      { content: '{"action": "talk", "target": null, "confidence": 0.5}' },
    ]);
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('攻击邪教信徒'); // keyword "攻击" matches attack
    assertEqual(result.type, 'attack', 'Low confidence should fallback to keyword "attack"');
    assertTrue(result.llm_enhanced !== true, 'Should NOT be llm_enhanced when fallback');
    assertTrue(mockLLM.getCallCount() === 1, 'LLM called once, then fallback');
  }

  // Test 3: LLM unavailable → pure keyword path
  console.log('Test 3: LLM unavailable → pure keyword path');
  {
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, null);
    const result = await gsm.parseIntent('去走廊');
    assertEqual(result.type, 'move', 'Keyword "去" should match "move"');
    assertTrue(result.llm_enhanced !== true, 'Should NOT be llm_enhanced without LLM');
  }

  // Test 4: LLM throws error → fallback to keyword
  console.log('Test 4: LLM throws error → fallback to keyword');
  {
    const mockLLM = createMockLLMClient([
      new Error('Network timeout'),
    ]);
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('打开铁门');
    assertEqual(result.type, 'interact', 'LLM error should fallback to keyword "interact"');
    assertTrue(result.llm_enhanced !== true, 'Should NOT be llm_enhanced on error');
    assertTrue(mockLLM.getCallCount() === 1, 'LLM called once, then caught error');
  }

  // Test 5: LLM returns malformed JSON → fallback to keyword
  console.log('Test 5: LLM returns malformed JSON → fallback to keyword');
  {
    const mockLLM = createMockLLMClient([
      { content: 'not valid json at all' },
    ]);
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('做个骰子检定');
    assertEqual(result.type, 'dice_check', 'Malformed JSON should fallback to keyword "dice_check"');
    assertTrue(result.llm_enhanced !== true, 'Should NOT be llm_enhanced on parse error');
  }

  // Test 6: LLM returns JSON inside markdown code block → parsed correctly
  console.log('Test 6: LLM JSON inside markdown code block → parsed correctly');
  {
    const mockLLM = createMockLLMClient([
      { content: '```json\n{"action": "talk", "target": "librarian", "confidence": 0.92}\n```' },
    ]);
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('和老图书管理员说话');
    assertEqual(result.type, 'talk', 'Code block JSON should parse to "talk"');
    assertEqual(result.llm_enhanced, true, 'Should be llm_enhanced');
    assertEqual(result.confidence, 0.92, 'Confidence should be extracted');
    assertEqual(result.target, 'librarian', 'Target should be extracted from code block');
  }

  // Test 7: LLM action type mapping — examine → inspect
  console.log('Test 7: LLM action mapping — examine → inspect');
  {
    const mockLLM = createMockLLMClient([
      { content: '{"action": "examine", "target": "key", "confidence": 0.88}' },
    ]);
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('检查那个古老钥匙');
    assertEqual(result.type, 'inspect', 'LLM "examine" should map to "inspect"');
    assertEqual(result.llm_enhanced, true, 'Should be llm_enhanced');
  }

  // Test 8: LLM action type mapping — combat → attack
  console.log('Test 8: LLM action mapping — combat → attack');
  {
    const mockLLM = createMockLLMClient([
      { content: '{"action": "combat", "target": "deep_one", "confidence": 0.95}' },
    ]);
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('战斗！');
    assertEqual(result.type, 'attack', 'LLM "combat" should map to "attack"');
  }

  // Test 9: LLM action type mapping — skill → dice_check
  console.log('Test 9: LLM action mapping — skill → dice_check');
  {
    const mockLLM = createMockLLMClient([
      { content: '{"action": "skill", "target": "图书馆使用", "confidence": 0.81}' },
    ]);
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('检定图书馆使用');
    assertEqual(result.type, 'dice_check', 'LLM "skill" should map to "dice_check"');
    assertEqual(result.llm_enhanced, true, 'Should be llm_enhanced');
  }

  // Test 10: LLM action type mapping — item → interact
  console.log('Test 10: LLM action mapping — item → interact');
  {
    const mockLLM = createMockLLMClient([
      { content: '{"action": "item", "target": "key", "confidence": 0.80}' },
    ]);
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('拿起钥匙');
    assertEqual(result.type, 'interact', 'LLM "item" should map to "interact"');
  }

  // Test 11: Empty input → no LLM call, returns default
  console.log('Test 11: Empty input → no LLM call, returns default');
  {
    let callCount = 0;
    const mockLLM = {
      isAvailable: () => true,
      chat: async () => { callCount++; return { content: '{"action": "move", "confidence": 0.9}' }; },
    };
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('', 'inspect');
    assertEqual(result.type, 'inspect', 'Empty input should use actionType fallback');
    assertTrue(callCount === 0, 'LLM should NOT be called for empty input');
  }

  // Test 12: LLM returns unknown action → falls back to keyword
  console.log('Test 12: LLM returns unknown action (confidence 0.6) → falls back to keyword');
  {
    const mockLLM = createMockLLMClient([
      { content: '{"action": "unknown", "target": null, "confidence": 0.6}' },
    ]);
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('使用古老钥匙'); // keyword "使用" matches use
    assertEqual(result.type, 'use', 'Unknown with low confidence should fallback to keyword');
    assertTrue(result.llm_enhanced !== true, 'Should NOT be llm_enhanced on unknown fallback');
  }

  // Test 13: Confidence boundary — exactly 0.7
  console.log('Test 13: Confidence boundary — exactly 0.7 (threshold)');
  {
    const mockLLM = createMockLLMClient([
      { content: '{"action": "flee", "target": null, "confidence": 0.7}' },
    ]);
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('快跑');
    // 0.7 is > 0.7? No, it's NOT > 0.7, so it falls back to keyword
    // Wait: the code says `llmResult.confidence > 0.7` — 0.7 is NOT greater than 0.7
    // So it should fall back. "跑" in keyword matches flee
    assertEqual(result.type, 'flee', 'Confidence exactly 0.7 should fallback (not > 0.7)');
    assertTrue(result.llm_enhanced !== true, 'Should NOT be llm_enhanced at boundary');
  }

  // Test 14: Confidence just above threshold — 0.71
  console.log('Test 14: Confidence just above threshold — 0.71');
  {
    const mockLLM = createMockLLMClient([
      { content: '{"action": "flee", "target": null, "confidence": 0.71}' },
    ]);
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('快跑');
    assertEqual(result.type, 'flee', 'Confidence 0.71 should be accepted');
    assertEqual(result.llm_enhanced, true, 'Should be llm_enhanced above threshold');
  }

  // Test 15: LLM returns confidence > 1.0 → clamped to 1.0
  console.log('Test 15: LLM returns out-of-range confidence → clamped');
  {
    const mockLLM = createMockLLMClient([
      { content: '{"action": "move", "target": "hallway", "confidence": 1.5}' },
    ]);
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('去走廊');
    assertEqual(result.type, 'move', 'Type should be move');
    assertEqual(result.confidence, 1.0, 'Confidence should be clamped to 1.0');
  }

  // Test 16: LLM returns negative confidence → clamped to 0
  console.log('Test 16: LLM returns negative confidence → clamped to 0');
  {
    const mockLLM = createMockLLMClient([
      { content: '{"action": "move", "target": "hallway", "confidence": -0.3}' },
    ]);
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('去走廊');
    assertEqual(result.confidence, undefined, 'Confidence should be undefined on keyword fallback');
    // 0 is NOT > 0.7, so falls back to keyword
    assertTrue(result.llm_enhanced !== true, 'Should NOT be llm_enhanced with clamped 0');
  }

  // Test 17: processAction integration — LLM parseIntent feeds into downstream handlers
  console.log('Test 17: Integration — parseIntent result feeds into processAction');
  {
    const mockLLM = createMockLLMClient([
      { content: '{"action": "inspect", "target": null, "confidence": 0.90}' },
    ]);
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const action = {
      action_type: 'player_action',
      player_input: '环顾四周',
      action_data: {},
    };
    const result = await gsm.processAction(action);
    assertEqual(result.type, 'interaction', 'processAction should handle inspect intent');
    assertTrue(result.narration.includes('地下室'), 'Narration should reflect scene description on inspect');
  }

  // Test 18: LLM isAvailable returns false → keyword path
  console.log('Test 18: LLM isAvailable false → keyword path');
  {
    const mockLLM = {
      isAvailable: () => false,
      chat: async () => { throw new Error('should not be called'); },
    };
    const gsm = new GameStateMachine(TEST_MODULE, TEST_CAMPAIGN, mockLLM);
    const result = await gsm.parseIntent('攻击敌人');
    assertEqual(result.type, 'attack', 'Unavailable LLM should use keyword');
    assertTrue(result.llm_enhanced !== true, 'Should NOT be llm_enhanced');
  }

  // Summary
  console.log('\n=== Results ===');
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total:  ${passCount + failCount}`);

  if (failCount > 0) {
    console.log('\nSome tests failed!');
    process.exit(1);
  } else {
    console.log('\nAll tests passed!');
    process.exit(0);
  }
}

runTests();
