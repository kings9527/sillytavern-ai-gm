/**
 * Intent Parser Tests
 * Phase 4 - LLM Intent Parsing Upgrade
 */

import { IntentParser } from '../utils/intent-parser.js';

// Test harness
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

async function runTests() {
  console.log('=== IntentParser Tests ===\n');

  const parser = new IntentParser({ useLLM: false });

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

  // Test 1: Talk
  console.log('Test 1: Talk patterns');
  {
    const cases = [
      { input: '和老图书管理员说话', expectType: 'talk', expectTarget: 'librarian' },
      { input: '问问邪教信徒关于仪式的事', expectType: 'talk', expectTarget: 'cultist' },
      { input: '"你好，这里是什么地方？"', expectType: 'talk', expectTarget: 'librarian' },
      { input: 'talk to 老图书管理员', expectType: 'talk', expectTarget: 'librarian' },
      { input: 'ask the 邪教信徒 about the cult', expectType: 'talk', expectTarget: 'cultist' },
    ];
    for (const c of cases) {
      const result = await parser.parse(c.input, testContext);
      assertEqual(result.type, c.expectType, `parse("${c.input}").type`);
      assertEqual(result.target, c.expectTarget, `parse("${c.input}").target`);
      assertTrue(
        result.confidence >= 0.85,
        `parse("${c.input}").confidence >= 0.85 (got ${result.confidence})`,
      );
    }
  }

  // Test 2: Move
  console.log('Test 2: Move patterns');
  {
    const cases = [
      { input: '去楼梯', expectType: 'move', expectTarget: 'upstairs' },
      { input: 'enter the 铁门', expectType: 'move', expectTarget: 'door' },
      { input: 'go upstairs', expectType: 'move', expectTarget: 'upstairs' },
      { input: 'follow 邪教信徒', expectType: 'follow', expectTarget: 'cultist' },
    ];
    for (const c of cases) {
      const result = await parser.parse(c.input, testContext);
      assertEqual(result.type, c.expectType, `parse("${c.input}").type`);
      assertEqual(result.target, c.expectTarget, `parse("${c.input}").target`);
      assertTrue(result.confidence >= 0.85, `parse("${c.input}").confidence >= 0.85`);
    }
  }

  // Test 3: Attack
  console.log('Test 3: Attack patterns');
  {
    const cases = [
      { input: '攻击深潜者', expectType: 'attack', expectTarget: 'deep_one' },
      { input: 'shoot the 邪教信徒', expectType: 'attack', expectTarget: 'cultist' },
      { input: 'fight 邪教信徒', expectType: 'attack', expectTarget: 'cultist' },
    ];
    for (const c of cases) {
      const result = await parser.parse(c.input, testContext);
      assertEqual(result.type, c.expectType, `parse("${c.input}").type`);
      assertEqual(result.target, c.expectTarget, `parse("${c.input}").target`);
      assertTrue(result.confidence >= 0.9, `parse("${c.input}").confidence >= 0.9`);
    }
  }

  // Test 4: Investigate
  console.log('Test 4: Investigate patterns');
  {
    const cases = [
      { input: '调查地下室', expectType: 'investigate', expectTarget: 'basement' },
      { input: 'search for clues', expectType: 'investigate', expectTarget: null },
      { input: '检查古老钥匙', expectType: 'investigate', expectTarget: 'key' },
      { input: 'look around', expectType: 'look', expectTarget: null },
    ];
    for (const c of cases) {
      const result = await parser.parse(c.input, testContext);
      assertEqual(result.type, c.expectType, `parse("${c.input}").type`);
      if (c.expectTarget) {
        assertEqual(result.target, c.expectTarget, `parse("${c.input}").target`);
      }
      assertTrue(result.confidence >= 0.85, `parse("${c.input}").confidence >= 0.85`);
    }
  }

  // Test 5: Item interaction
  console.log('Test 5: Item interaction');
  {
    const cases = [
      { input: '拿起古老钥匙', expectType: 'take', expectTarget: 'key' },
      { input: 'pick up the 死灵之书', expectType: 'take', expectTarget: 'book' },
      { input: 'use 古老钥匙 on 铁门', expectType: 'use_item', expectTarget: 'door' },
      { input: 'give 死灵之书 to 老图书管理员', expectType: 'give', expectTarget: 'librarian' },
      { input: 'open 铁门', expectType: 'open', expectTarget: 'door' },
    ];
    for (const c of cases) {
      const result = await parser.parse(c.input, testContext);
      assertEqual(result.type, c.expectType, `parse("${c.input}").type`);
      assertEqual(result.target, c.expectTarget, `parse("${c.input}").target`);
    }
  }

  // Test 6: Read
  console.log('Test 6: Read patterns');
  {
    const cases = [
      { input: '读死灵之书', expectType: 'read', expectTarget: 'book' },
      { input: 'read the 古老钥匙', expectType: 'read', expectTarget: 'key' },
      { input: 'study the ancient text', expectType: 'read', expectTarget: null },
    ];
    for (const c of cases) {
      const result = await parser.parse(c.input, testContext);
      assertEqual(result.type, c.expectType, `parse("${c.input}").type`);
    }
  }

  // Test 7: Social
  console.log('Test 7: Social patterns');
  {
    const cases = [
      { input: '帮助老图书管理员', expectType: 'help', expectTarget: 'librarian' },
      { input: 'threaten 邪教信徒', expectType: 'threaten', expectTarget: 'cultist' },
      { input: 'help the wounded', expectType: 'help', expectTarget: null },
    ];
    for (const c of cases) {
      const result = await parser.parse(c.input, testContext);
      assertEqual(result.type, c.expectType, `parse("${c.input}").type`);
    }
  }

  // Test 8: Stealth
  console.log('Test 8: Stealth patterns');
  {
    const cases = [
      { input: '躲藏起来', expectType: 'hide', expectTarget: null },
      { input: 'sneak past 邪教信徒', expectType: 'sneak', expectTarget: 'cultist' },
      { input: 'follow 深潜者', expectType: 'follow', expectTarget: 'deep_one' },
      { input: 'listen to the door', expectType: 'listen', expectTarget: 'door' },
    ];
    for (const c of cases) {
      const result = await parser.parse(c.input, testContext);
      assertEqual(result.type, c.expectType, `parse("${c.input}").type`);
    }
  }

  // Test 9: Magic
  console.log('Test 9: Magic patterns');
  {
    const cases = [
      { input: '施放防护法术', expectType: 'cast', expectTarget: null },
      { input: 'cast a spell', expectType: 'cast', expectTarget: null },
      { input: 'perform the ritual', expectType: 'cast', expectTarget: null },
    ];
    for (const c of cases) {
      const result = await parser.parse(c.input, testContext);
      assertEqual(result.type, c.expectType, `parse("${c.input}").type`);
    }
  }

  // Test 10: Rest / Flee / Look
  console.log('Test 10: Rest / Flee / Look');
  {
    const cases = [
      { input: '休息一下', expectType: 'rest', expectTarget: null },
      { input: '逃跑', expectType: 'flee', expectTarget: null },
      { input: 'run away from here', expectType: 'flee', expectTarget: null },
      { input: 'look around', expectType: 'look', expectTarget: null },
    ];
    for (const c of cases) {
      const result = await parser.parse(c.input, testContext);
      assertEqual(result.type, c.expectType, `parse("${c.input}").type`);
    }
  }

  // Test 11: Skill extraction
  console.log('Test 11: Skill extraction');
  {
    const cases = [
      { input: '使用图书馆技能搜索线索', expectSkill: 'library use' },
      { input: '侦查地下室', expectSkill: 'spot hidden' },
      { input: '聆听声音', expectSkill: 'listen' },
      { input: '心理学分析邪教信徒', expectSkill: 'psychology' },
    ];
    for (const c of cases) {
      const result = await parser.parse(c.input, testContext);
      assertEqual(result.params?.skill, c.expectSkill, `parse("${c.input}").params.skill`);
    }
  }

  // Test 12: Edge cases
  console.log('Test 12: Edge cases');
  {
    const result1 = await parser.parse('', testContext);
    assertEqual(result1.type, 'unknown', 'Empty input -> unknown');
    assertEqual(result1.confidence, 0, 'Empty input -> confidence 0');

    const result2 = await parser.parse(null, testContext);
    assertEqual(result2.type, 'unknown', 'Null input -> unknown');

    const result3 = await parser.parse('   ', testContext);
    assertEqual(result3.type, 'unknown', 'Whitespace input -> unknown');

    const result4 = await parser.parse('1d100', testContext);
    assertEqual(result4.type, 'dice_roll', 'Dice roll detected');

    const result5 = await parser.parse('/roll 2d6+3', testContext);
    assertEqual(result5.type, 'dice_roll', 'Slash roll detected');
  }

  // Test 13: Stats
  console.log('Test 13: Stats');
  {
    const stats = parser.getStats();
    assertEqual(stats.useLLM, false, 'stats.useLLM === false');
    assertEqual(stats.llmAvailable, false, 'stats.llmAvailable === false');
    assertEqual(stats.threshold, 0.6, 'stats.threshold === 0.6');
  }

  // Summary
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
