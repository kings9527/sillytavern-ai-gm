/**
 * IntentParser Edge & Boundary Tests
 * Covers: LLM paths, batch parse, constructor options, input validation, helper edge cases
 */

import { IntentParser } from '../utils/intent-parser.js';

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
}

async function runTests() {
  console.log('=== IntentParser Edge Tests ===\n');

  const testContext = {
    scene: { title: '地下室', id: 'basement' },
    npcs: {
      librarian: { name: '老图书管理员', role: 'neutral' },
      cultist: { name: '邪教信徒', role: 'enemy' },
    },
    exits: {
      upstairs: { name: '楼梯' },
      door: { name: '铁门' },
    },
    items: {
      key: { name: '古老钥匙' },
      book: { name: '死灵之书' },
    },
    enemies: {
      deep_one: { name: '深潜者' },
    },
  };

  // ====== Constructor Options ======
  console.log('Test: Constructor defaults and overrides');
  {
    const parser1 = new IntentParser();
    assertEqual(parser1.useLLM, true, 'default useLLM should be true');
    assertEqual(parser1.llmThreshold, 0.6, 'default threshold should be 0.6');
    assertEqual(parser1.llmClient, null, 'default llmClient should be null');

    const parser2 = new IntentParser({ useLLM: false, llmThreshold: 0.8 });
    assertEqual(parser2.useLLM, false, 'useLLM override');
    assertEqual(parser2.llmThreshold, 0.8, 'threshold override');

    const parser3 = new IntentParser({ llmThreshold: 0 });
    assertEqual(parser3.llmThreshold, 0, 'threshold zero');

    const parser4 = new IntentParser({ useLLM: true });
    assertEqual(parser4.useLLM, true, 'explicit true');
  }

  // ====== Input Validation ======
  console.log('Test: Invalid inputs');
  {
    const parser = new IntentParser({ useLLM: false });
    const cases = [
      { input: undefined, expectType: 'unknown' },
      { input: 123, expectType: 'unknown' },
      { input: {}, expectType: 'unknown' },
      { input: [], expectType: 'unknown' },
      { input: true, expectType: 'unknown' },
    ];
    for (const c of cases) {
      const result = await parser.parse(c.input, testContext);
      assertEqual(result.type, c.expectType, `parse(${JSON.stringify(c.input)}).type`);
      assertEqual(result.confidence, 0, `parse(${JSON.stringify(c.input)}).confidence should be 0`);
    }
  }

  // ====== High-confidence rule bypasses LLM ======
  console.log('Test: High-confidence rule result bypasses LLM');
  {
    let llmCalled = false;
    const mockLLM = {
      isAvailable: () => true,
      chatJSON: async () => { llmCalled = true; return { intent: 'talk', confidence: 0.99, target: 'librarian', params: {}, reasoning: 'mock' }; },
    };
    const parser = new IntentParser({ llmClient: mockLLM, useLLM: true, llmThreshold: 0.6 });
    const result = await parser.parse('攻击深潜者', testContext); // attack confidence 0.92
    assertEqual(result.type, 'attack', 'should be attack');
    assertTrue(!llmCalled, 'LLM should NOT be called for high-confidence rule match');
  }

  // ====== Medium confidence triggers LLM ======
  console.log('Test: Medium confidence triggers LLM fallback');
  {
    let llmCalled = false;
    const mockLLM = {
      isAvailable: () => true,
      chatJSON: async () => {
        llmCalled = true;
        return { intent: 'investigate', confidence: 0.95, target: 'basement', params: {}, reasoning: 'mock' };
      },
    };
    const parser = new IntentParser({ llmClient: mockLLM, useLLM: true, llmThreshold: 0.6 });
    // "random text" has rule confidence 0.3, below threshold 0.6 -> should trigger LLM
    const result = await parser.parse('random text', testContext);
    assertTrue(llmCalled, 'LLM SHOULD be called for low-confidence rule match');
    assertEqual(result.type, 'investigate', 'should use LLM result when higher confidence');
  }

  // ====== LLM not available falls back to rule ======
  console.log('Test: LLM unavailable falls back to rule');
  {
    const mockLLM = { isAvailable: () => false };
    const parser = new IntentParser({ llmClient: mockLLM, useLLM: true });
    const result = await parser.parse('help the wounded', testContext);
    assertEqual(result.type, 'help', 'should fallback to rule when LLM unavailable');
  }

  // ====== LLM throws error falls back gracefully ======
  console.log('Test: LLM error falls back gracefully');
  {
    const mockLLM = {
      isAvailable: () => true,
      chatJSON: async () => { throw new Error('Network timeout'); },
    };
    const parser = new IntentParser({ llmClient: mockLLM, useLLM: true });
    const result = await parser.parse('help the wounded', testContext);
    assertEqual(result.type, 'help', 'should fallback to rule on LLM error');
  }

  // ====== LLM returns lower confidence than rule ======
  console.log('Test: LLM lower confidence keeps rule result');
  {
    const mockLLM = {
      isAvailable: () => true,
      chatJSON: async () => ({ intent: 'unknown', confidence: 0.2, target: null, params: {}, reasoning: 'mock' }),
    };
    const parser = new IntentParser({ llmClient: mockLLM, useLLM: true });
    const result = await parser.parse('help the wounded', testContext);
    assertEqual(result.type, 'help', 'should keep rule result when LLM confidence lower');
  }

  // ====== useLLM disabled ======
  console.log('Test: useLLM disabled never calls LLM');
  {
    let llmCalled = false;
    const mockLLM = {
      isAvailable: () => true,
      chatJSON: async () => { llmCalled = true; return { intent: 'move', confidence: 0.99, target: 'upstairs', params: {}, reasoning: 'mock' }; },
    };
    const parser = new IntentParser({ llmClient: mockLLM, useLLM: false });
    const result = await parser.parse('help the wounded', testContext);
    assertTrue(!llmCalled, 'LLM should not be called when useLLM=false');
    assertEqual(result.type, 'help', 'should use rule result');
  }

  // ====== Batch parse ======
  console.log('Test: Batch parse');
  {
    const parser = new IntentParser({ useLLM: false });
    const inputs = ['攻击深潜者', '去楼梯', '读死灵之书'];
    const results = await parser.parseBatch(inputs, testContext);
    assertEqual(results.length, 3, 'batch should return 3 results');
    assertEqual(results[0].type, 'attack', 'first should be attack');
    assertEqual(results[1].type, 'move', 'second should be move');
    assertEqual(results[2].type, 'read', 'third should be read');
  }

  // ====== Batch parse with empty array ======
  console.log('Test: Batch parse empty array');
  {
    const parser = new IntentParser({ useLLM: false });
    const results = await parser.parseBatch([], testContext);
    assertEqual(results.length, 0, 'empty batch should return empty array');
  }

  // ====== Stats ======
  console.log('Test: Stats with LLM available');
  {
    const mockLLM = { isAvailable: () => true };
    const parser = new IntentParser({ llmClient: mockLLM, useLLM: true, llmThreshold: 0.7 });
    const stats = parser.getStats();
    assertEqual(stats.useLLM, true, 'stats.useLLM');
    assertEqual(stats.llmAvailable, true, 'stats.llmAvailable');
    assertEqual(stats.threshold, 0.7, 'stats.threshold');
  }

  // ====== Dice roll edge cases ======
  console.log('Test: Dice roll edge cases');
  {
    const parser = new IntentParser({ useLLM: false });
    const cases = [
      { input: '1d100', expectType: 'dice_roll' },
      { input: '2d6+3', expectType: 'dice_roll' },
      { input: '/roll 3d8', expectType: 'dice_roll' },
      { input: '/r 1d4', expectType: 'dice_roll' },
      { input: 'd20', expectType: 'dice_roll' },
    ];
    for (const c of cases) {
      const result = await parser.parse(c.input, testContext);
      assertEqual(result.type, c.expectType, `parse("${c.input}").type`);
    }
  }

  // ====== Skill extraction edge cases ======
  console.log('Test: Skill extraction edge cases');
  {
    const parser = new IntentParser({ useLLM: false });
    const cases = [
      { input: '使用图书馆技能搜索线索', expectSkill: 'library use' },
      { input: '侦查地下室', expectSkill: 'spot hidden' },
      { input: '聆听声音', expectSkill: 'listen' },
      { input: '心理学分析邪教信徒', expectSkill: 'psychology' },
      { input: '医学急救', expectSkill: 'medicine' },
      { input: '历史研究', expectSkill: 'history' },
      { input: '追踪脚印', expectSkill: 'track' },
    ];
    for (const c of cases) {
      const result = await parser.parse(c.input, testContext);
      assertEqual(result.params?.skill, c.expectSkill, `parse("${c.input}").params.skill`);
    }
  }

  // ====== Talk patterns edge cases ======
  console.log('Test: Talk patterns edge cases');
  {
    const parser = new IntentParser({ useLLM: false });
    const cases = [
      { input: '"直接说话没有目标"', expectType: 'talk', expectTarget: 'librarian' },
      { input: 'say hello to the 老图书管理员', expectType: 'talk', expectTarget: 'librarian' },
    ];
    for (const c of cases) {
      const result = await parser.parse(c.input, testContext);
      assertEqual(result.type, c.expectType, `parse("${c.input}").type`);
      assertEqual(result.target, c.expectTarget, `parse("${c.input}").target`);
    }
  }

  // ====== Move patterns with exit matching ======
  console.log('Test: Move patterns with partial matching');
  {
    const parser = new IntentParser({ useLLM: false });
    const result = await parser.parse('go 楼梯', testContext);
    assertEqual(result.type, 'move', 'should parse move');
    assertEqual(result.target, 'upstairs', 'should match exit by partial name');
  }

  // ====== Attack with weapon parsing ======
  console.log('Test: Attack with weapon');
  {
    const parser = new IntentParser({ useLLM: false });
    const result = await parser.parse('wield 古老钥匙 against 深潜者', testContext);
    assertEqual(result.type, 'attack', 'should parse attack with weapon');
    assertEqual(result.params.weapon, 'key', 'should extract weapon');
    assertEqual(result.target, 'deep_one', 'should extract target');
  }

  // ====== Flee with destination ======
  console.log('Test: Flee with destination');
  {
    const parser = new IntentParser({ useLLM: false });
    // English flee pattern has no capture group; destination only works for Chinese
    const result = await parser.parse('逃命到楼梯', testContext);
    assertEqual(result.type, 'flee', 'should parse flee');
    assertEqual(result.target, '到楼梯', 'should fallback to raw captured text');
  }

  // ====== Social patterns: deceive / bribe ======
  console.log('Test: Social deceive and bribe');
  {
    const parser = new IntentParser({ useLLM: false });
    const r1 = await parser.parse('deceive the 邪教信徒', testContext);
    assertEqual(r1.type, 'deceive', 'should parse deceive');

    const r2 = await parser.parse('bribe the guard', testContext);
    assertEqual(r2.type, 'bribe', 'should parse bribe');
  }

  // ====== Context with empty entity maps ======
  console.log('Test: Empty context entity maps');
  {
    const parser = new IntentParser({ useLLM: false });
    const emptyContext = {};
    const result = await parser.parse('攻击深潜者', emptyContext);
    assertEqual(result.type, 'attack', 'should still parse attack pattern');
    assertEqual(result.target, '深潜者', 'should fallback to raw text when no entity map');
  }

  // ====== Summary ======
  console.log('\n=== Results ===');
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total: ${passCount + failCount}`);

  if (failCount > 0) {
    console.log('\nSome tests failed!');
    process.exit(1);
  } else {
    console.log('\nAll tests passed!');
    process.exit(0);
  }
}

runTests();
