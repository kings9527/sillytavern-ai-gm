/**
 * RuleEngine Coverage Tests
 * Targets: Branch 55.17% → 70%+, Lines 89.42% → 95%+
 * Uncovered lines: 89-94 (dnd5e check), 127-132 (genericCheck), 150-159 (DB branches)
 */

import { RuleEngine } from '../engine/rule-engine.js';

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

console.log('=== RuleEngine Coverage Tests ===\n');

test('CoC check() routes to cocCheck', () => {
  const cocRules = new RuleEngine('coc');
  const result = cocRules.check('Spot Hidden', 60, 40);
  assert(result.result === 'success', `Expected success, got ${result.result}`);
  assert(result.roll === 40, `Expected roll 40, got ${result.roll}`);
  assert(result.target === 60, `Expected target 60, got ${result.target}`);
});

// ─── Cover lines 89-94: dnd5e check() → genericCheck() ───

test('D&D 5e check() routes to genericCheck (success)', () => {
  const dndRules = new RuleEngine('dnd5e');
  const result = dndRules.check('Athletics', 15, 10);
  assert(result.result === 'success', `Expected success, got ${result.result}`);
  assert(result.roll === 10, `Expected roll 10, got ${result.roll}`);
  assert(result.target === 15, `Expected target 15, got ${result.target}`);
});

test('D&D 5e check() routes to genericCheck (fail)', () => {
  const dndRules = new RuleEngine('dnd5e');
  const result = dndRules.check('Athletics', 15, 20);
  assert(result.result === 'fail', `Expected fail, got ${result.result}`);
  assert(result.roll === 20, `Expected roll 20, got ${result.roll}`);
  assert(result.target === 15, `Expected target 15, got ${result.target}`);
});

// ─── Cover lines 127-132: genericCheck() explicit branches ───

test('genericCheck() success branch', () => {
  const rules = new RuleEngine('dnd5e');
  const result = rules.genericCheck('Perception', 12, 8);
  assert(result.result === 'success', `Expected success, got ${result.result}`);
  assert(result.roll === 8, `Expected roll 8, got ${result.roll}`);
  assert(result.target === 12, `Expected target 12, got ${result.target}`);
});

test('genericCheck() fail branch', () => {
  const rules = new RuleEngine('dnd5e');
  const result = rules.genericCheck('Perception', 12, 15);
  assert(result.result === 'fail', `Expected fail, got ${result.result}`);
  assert(result.roll === 15, `Expected roll 15, got ${result.roll}`);
  assert(result.target === 12, `Expected target 12, got ${result.target}`);
});

// ─── Cover lines 150-159: calculateDamageBonus() high STR+SIZ branches ───

test('calculateDamageBonus +1d4 branch (STR+SIZ 125-164)', () => {
  const rules = new RuleEngine('coc');
  // STR=70, SIZ=70 → sum=140 → +1d4
  const result = rules.calculateDamageBonus({ STR: 70, SIZ: 70 });
  assert(result.total >= 1 && result.total <= 4, `Expected 1-4, got ${result.total}`);
  assert(result.formula.includes('+1d4'), `Expected +1d4 in formula, got ${result.formula}`);
  assert(result.formula.includes('125-164'), `Expected range 125-164, got ${result.formula}`);
});

test('calculateDamageBonus +1d6 branch (STR+SIZ 165-204)', () => {
  const rules = new RuleEngine('coc');
  // STR=90, SIZ=90 → sum=180 → +1d6
  const result = rules.calculateDamageBonus({ STR: 90, SIZ: 90 });
  assert(result.total >= 1 && result.total <= 6, `Expected 1-6, got ${result.total}`);
  assert(result.formula.includes('+1d6'), `Expected +1d6 in formula, got ${result.formula}`);
  assert(result.formula.includes('165-204'), `Expected range 165-204, got ${result.formula}`);
});

test('calculateDamageBonus +2d6 branch (STR+SIZ ≥ 205)', () => {
  const rules = new RuleEngine('coc');
  // STR=100, SIZ=110 → sum=210 → +2d6
  const result = rules.calculateDamageBonus({ STR: 100, SIZ: 110 });
  assert(result.total >= 2 && result.total <= 12, `Expected 2-12, got ${result.total}`);
  assert(result.formula.includes('+2d6'), `Expected +2d6 in formula, got ${result.formula}`);
  assert(result.formula.includes('≥ 205'), `Expected range ≥ 205, got ${result.formula}`);
});

// ─── Summary ───
console.log('\n=== Test Summary ===');
console.log(`Total: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Status: ${failCount === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);

process.exit(failCount > 0 ? 1 : 0);
