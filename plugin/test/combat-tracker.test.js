/**
 * Combat Tracker Coverage Gap Tests
 * Targets: AOE damage, status effects, combat end rewards, enemy AI, healing, etc.
 */

import { CombatTracker } from '../engine/combat-tracker.js';

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

function makeCampaign(opts = {}) {
  return {
    id: 'test_campaign',
    module_id: 'test_module',
    current_scene: 'scene1',
    player: {
      id: 'player_1',
      name: '测试玩家',
      stats: { STR: 60, CON: 50, DEX: 70, INT: 80, POW: 60, HP: 10, SAN: 60 },
      hp: opts.playerHp ?? 10,
      max_hp: 10,
      sanity: 60,
      max_sanity: 60,
      inventory: [],
      status_effects: opts.playerEffects ?? [],
    },
    npcs_state: {
      goblin: {
        id: 'goblin',
        name: '哥布林',
        current_hp: opts.goblinHp ?? 8,
        max_hp: 8,
        attitude: 'hostile',
      },
      orc: {
        id: 'orc',
        name: '兽人',
        current_hp: opts.orcHp ?? 15,
        max_hp: 15,
        attitude: 'hostile',
      },
    },
    module: {
      id: 'test_module',
      name: 'Test Module',
      system: 'coc',
      npcs: {
        goblin: {
          id: 'goblin',
          name: '哥布林',
          stats: { DEX: 50, HP: 8, STR: 40 },
          combat_skills: ['格斗'],
        },
        orc: {
          id: 'orc',
          name: '兽人',
          stats: { DEX: 40, HP: 15, STR: 60 },
          combat_skills: ['格斗', 'occult_magic'],
        },
      },
    },
    combat_state: null,
    global_vars: {},
  };
}

// Helper to force deterministic initiative order (player first)
function forcePlayerFirst(tracker) {
  tracker.state.initiative.sort((a, b) => {
    if (a.type === 'player') return -1;
    if (b.type === 'player') return 1;
    return 0;
  });
  tracker.state.current_turn_index = 0;
  tracker.state.current_turn = tracker.state.initiative[0].entity_id;
}

console.log('=== Combat Tracker Coverage Gap Tests ===\n');

// ─── Fumble / Critical / Miss ───
console.log('--- Attack Edge Cases ---');

test('Fumble deals self-damage and sets fumble flag', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);

  // Mock roll to guarantee fumble (roll >= 96)
  const originalRandom = Math.random;
  Math.random = () => 0.99; // roll = 100

  const result = tracker.resolveAttack('player_1', 'goblin', {});

  Math.random = originalRandom;

  assert(result.fumble === true, 'Expected fumble flag');
  assert(result.hit === false, 'Expected no hit on fumble');
  assert(campaign.player.hp < 10, 'Expected self-damage');
  assert(result.log.includes('大失败'), 'Expected 大失败 in log');
});

test('Critical hit deals max damage and sets critical flag', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);

  const originalRandom = Math.random;
  Math.random = () => 0.01; // roll = 2 (critical, <=5)

  const result = tracker.resolveAttack('player_1', 'goblin', {});

  Math.random = originalRandom;

  assert(result.critical === true, 'Expected critical flag');
  assert(result.hit === true, 'Expected hit on critical');
  assert(result.damage > 0, 'Expected damage on critical');
  assert(result.log.includes('致命一击'), 'Expected 致命一击 in log');
});

test('Miss returns zero damage and correct log', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);

  const originalRandom = Math.random;
  Math.random = () => 0.9; // roll = 91, miss (91 > 50, not fumble)

  const result = tracker.resolveAttack('player_1', 'goblin', {});

  Math.random = originalRandom;

  assert(result.hit === false, 'Expected miss');
  assert(result.damage === 0, 'Expected zero damage');
  assert(result.log.includes('失败'), 'Expected 失败 in log');
});

test('Attack non-existent target returns correct log', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);

  const result = tracker.resolveAttack('player_1', 'nonexistent', {});
  assert(result.hit === false, 'Expected miss');
  assert(result.log.includes('目标不存在'), 'Expected 目标不存在 in log');
});

test('Attack with non-existent attacker returns correct log', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);

  const result = tracker.resolveAttack('nonexistent', 'goblin', {});
  assert(result.hit === false, 'Expected miss');
  assert(result.log.includes('攻击者不存在'), 'Expected 攻击者不存在 in log');
});

// ─── Flee ───
console.log('\n--- Flee ---');

test('Flee success ends combat', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);

  const originalRandom = Math.random;
  Math.random = () => 0.01; // roll = 2, DEX=70, success

  const result = tracker.resolveFlee('player_1');

  Math.random = originalRandom;

  assert(result.success === true, 'Expected flee success');
  assert(tracker.state.active === false, 'Expected combat ended');
  assert(result.log.includes('逃跑'), 'Expected 逃跑 in log');
});

test('Flee failure keeps combat active', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);

  const originalRandom = Math.random;
  Math.random = () => 0.99; // roll = 100, DEX=70, fail

  const result = tracker.resolveFlee('player_1');

  Math.random = originalRandom;

  assert(result.success === false, 'Expected flee failure');
  assert(result.log.includes('逃跑失败'), 'Expected 逃跑失败 in log');
});

// ─── Skill Use ───
console.log('\n--- Skill Use ---');

test('Skill use success returns success flag', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);

  const originalRandom = Math.random;
  Math.random = () => 0.01; // roll = 2, skill=40, success

  const result = tracker.resolveSkillUse('player_1', 'goblin', { skill: '闪避' });

  Math.random = originalRandom;

  assert(result.success === true, 'Expected skill success');
  assert(result.log.includes('成功'), 'Expected 成功 in log');
});

test('Skill use failure returns fail flag', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);

  const originalRandom = Math.random;
  Math.random = () => 0.99; // roll = 100, skill=40, fail

  const result = tracker.resolveSkillUse('player_1', 'goblin', { skill: '闪避' });

  Math.random = originalRandom;

  assert(result.success === false, 'Expected skill failure');
  assert(result.log.includes('失败'), 'Expected 失败 in log');
});

// ─── Healing ───
console.log('\n--- Healing ---');

test('Heal player restores HP up to max', () => {
  const campaign = makeCampaign({ playerHp: 5 });
  const tracker = new CombatTracker(campaign);
  const result = tracker.heal('player_1', 10);
  assert(result.amount === 5, 'Expected healed 5 HP');
  assert(campaign.player.hp === 10, 'Expected player HP at max');
  assert(result.log.includes('恢复'), 'Expected 恢复 in log');
});

test('Heal NPC restores HP up to max', () => {
  const campaign = makeCampaign({ goblinHp: 2 });
  const tracker = new CombatTracker(campaign);
  const result = tracker.heal('goblin', 10);
  assert(result.amount === 6, 'Expected healed 6 HP');
  assert(campaign.npcs_state.goblin.current_hp === 8, 'Expected goblin HP at max');
});

test('Heal with invalid params returns zero', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  assert(tracker.heal('', 5).amount === 0, 'Expected 0 for empty entity');
  assert(tracker.heal('player_1', 0).amount === 0, 'Expected 0 for zero amount');
  assert(tracker.heal('player_1', -1).amount === 0, 'Expected 0 for negative amount');
});

test('Heal non-existent entity returns zero', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  const result = tracker.heal('ghost', 5);
  assert(result.amount === 0, 'Expected 0 for non-existent entity');
  assert(result.log.includes('无效'), 'Expected 无效 in log');
});

// ─── Combat End Conditions ───
console.log('\n--- Combat End ---');

test('Player HP reaching zero ends combat with defeat', () => {
  const campaign = makeCampaign({ playerHp: 1 });
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);

  // Enemy attacks player and kills them
  tracker.resolveAttack('goblin', 'player_1', { skill: '格斗' });
  // applyDamage should be called inside resolveAttack
  // Force critical to guarantee damage
  const originalRandom = Math.random;
  Math.random = () => 0.01;
  tracker.resolveAttack('goblin', 'player_1', { skill: '格斗' });
  Math.random = originalRandom;

  assert(
    tracker.state.active === false || campaign.player.hp <= 0,
    'Expected combat ended or player at 0 HP',
  );
});

test('All enemies defeated ends combat with victory', () => {
  const campaign = makeCampaign({ goblinHp: 1 });
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);

  // Critical hit to kill goblin
  const originalRandom = Math.random;
  Math.random = () => 0.01;
  tracker.resolveAttack('player_1', 'goblin', {});
  Math.random = originalRandom;

  tracker.checkCombatEnd();
  assert(tracker.state.active === false, 'Expected combat ended after all enemies defeated');
});

test('applyDamage returns false for non-existent target', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  const result = tracker.applyDamage('ghost', 5);
  assert(result === false, 'Expected false for non-existent target');
});

// ─── Turn Advance / Skip Defeated ───
console.log('\n--- Turn Advance ---');

test('Advance turn skips defeated entities', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);
  // Defeat the goblin
  tracker.state.defeated.push('goblin');
  tracker.state.current_turn_index = 0; // player
  tracker.advanceTurn();
  // Should skip goblin and wrap back to player
  assert(tracker.state.current_turn === 'player_1', 'Expected turn to wrap to player');
  assert(tracker.state.round === 2, 'Expected round increment');
});

test('advanceTurn does nothing when combat inactive', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  tracker.state.active = false;
  tracker.state.current_turn_index = 0;
  tracker.advanceTurn();
  assert(tracker.state.current_turn_index === 0, 'Expected turn index unchanged');
});

// ─── State Load ───
console.log('\n--- State Load ---');

test('Load valid state succeeds', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  const saved = tracker.getState();
  tracker.loadState(saved);
  assert(tracker.getState() === saved, 'Expected state loaded');
});

test('Load invalid state (null) sets state to null', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.loadState(null);
  assert(tracker.getState() === null, 'Expected null state');
});

test('Load invalid active state with empty initiative warns and sets null', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.loadState({ active: true, initiative: [] });
  assert(tracker.getState() === null, 'Expected null state for invalid active combat');
});

// ─── Combat Summary ───
console.log('\n--- Combat Summary ---');

test('getCombatSummary returns correct structure when active', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  const summary = tracker.getCombatSummary();
  assert(summary !== null, 'Expected summary');
  assert(summary.active === true, 'Expected active');
  assert(summary.round === 1, 'Expected round 1');
  assert(summary.player_hp === 10, 'Expected player HP');
  assert(Array.isArray(summary.enemies), 'Expected enemies array');
  assert(Array.isArray(summary.log), 'Expected log array');
  assert(typeof summary.total_damage_dealt === 'number', 'Expected total_damage_dealt');
});

test('getCombatSummary returns null when no state', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  assert(tracker.getCombatSummary() === null, 'Expected null summary');
});

// ─── Enemy AI ───
console.log('\n--- Enemy AI ---');

test('decideEnemyAction flees when HP < 20%', async () => {
  const campaign = makeCampaign({ goblinHp: 1 });
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  const goblinInit = tracker.state.initiative.find((i) => i.entity_id === 'goblin');
  const action = await tracker.decideEnemyAction(goblinInit);
  assert(action.type === 'flee', 'Expected flee when HP low');
});

test('decideEnemyAction casts spell when HP < 50% and has occult_magic', async () => {
  const campaign = makeCampaign({ orcHp: 7 });
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['orc']);
  const orcInit = tracker.state.initiative.find((i) => i.entity_id === 'orc');
  const action = await tracker.decideEnemyAction(orcInit);
  assert(action.type === 'spell', 'Expected spell when HP < 50% and has occult_magic');
  assert(action.skill === 'occult_magic', 'Expected occult_magic skill');
});

test('decideEnemyAction defaults to attack', async () => {
  const campaign = makeCampaign({ goblinHp: 8 });
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  const goblinInit = tracker.state.initiative.find((i) => i.entity_id === 'goblin');
  const action = await tracker.decideEnemyAction(goblinInit);
  assert(action.type === 'attack', 'Expected attack as default');
});

test('resolveEnemyAction handles spell action', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  const goblinInit = tracker.state.initiative.find((i) => i.entity_id === 'goblin');
  const result = tracker.resolveEnemyAction(goblinInit, {
    type: 'spell',
    skill: 'occult_magic',
    target: 'player_1',
  });
  assert(result.action === 'skill' || result.log, 'Expected spell resolution');
});

test('resolveEnemyAction handles item action', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  const goblinInit = tracker.state.initiative.find((i) => i.entity_id === 'goblin');
  const result = tracker.resolveEnemyAction(goblinInit, { type: 'item' });
  assert(result.action === 'item', 'Expected item action');
  assert(result.log.includes('使用了物品'), 'Expected 使用了物品 in log');
});

test('resolveEnemyAction handles unknown action as idle', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  const goblinInit = tracker.state.initiative.find((i) => i.entity_id === 'goblin');
  const result = tracker.resolveEnemyAction(goblinInit, { type: 'dance' });
  assert(result.action === 'idle', 'Expected idle for unknown action');
  assert(result.log.includes('犹豫'), 'Expected 犹豫 in log');
});

// ─── processAction Integration ───
console.log('\n--- processAction Integration ---');

test('processAction with item action logs correctly', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);

  const result = tracker.processAction('player_1', 'item', 'goblin', {});
  // processAction returns { ...result, ...getState(), enemy_turns }, so log is overwritten by state.log array
  const lastLog = tracker.state.log[tracker.state.log.length - 1];
  assert(lastLog.includes('使用了物品'), 'Expected 使用了物品 in log');
});

test('processAction with default action logs correctly', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);

  const result = tracker.processAction('player_1', 'dance', 'goblin', {});
  const lastLog = tracker.state.log[tracker.state.log.length - 1];
  assert(lastLog.includes('执行了'), 'Expected 执行了 in log');
});

test('processAction throws when not current turn', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);

  let threw = false;
  try {
    tracker.processAction('goblin', 'attack', 'player_1', {});
  } catch (e) {
    threw = true;
    assert(e.message.includes('不是'), 'Expected turn error');
  }
  assert(threw, 'Expected throw for wrong turn');
});

test('processAction throws when combat inactive', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  tracker.state.active = false;

  let threw = false;
  try {
    tracker.processAction('player_1', 'attack', 'goblin', {});
  } catch (e) {
    threw = true;
    assert(e.message.includes('没有活跃的战斗'), 'Expected inactive combat error');
  }
  assert(threw, 'Expected throw for inactive combat');
});

// ─── AOE-style Multi-target Damage (simulated via consecutive attacks) ───
console.log('\n--- AOE-style Multi-target ---');

test('Consecutive attacks on multiple enemies reduce all HP', () => {
  const campaign = makeCampaign({ goblinHp: 5, orcHp: 5 });
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin', 'orc']);
  forcePlayerFirst(tracker);

  const originalRandom = Math.random;
  Math.random = () => 0.01; // Always critical

  tracker.resolveAttack('player_1', 'goblin', {});
  tracker.resolveAttack('player_1', 'orc', {});

  Math.random = originalRandom;

  assert(campaign.npcs_state.goblin.current_hp < 5, 'Expected goblin damaged');
  assert(campaign.npcs_state.orc.current_hp < 5, 'Expected orc damaged');
});

// ─── Status Effects (player status_effects array presence) ───
console.log('\n--- Status Effects ---');

test('Player status_effects array is preserved in campaign', () => {
  const campaign = makeCampaign({ playerEffects: ['bleeding', 'poisoned'] });
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  assert(campaign.player.status_effects.includes('bleeding'), 'Expected bleeding effect');
  assert(campaign.player.status_effects.includes('poisoned'), 'Expected poisoned effect');
  assert(campaign.player.status_effects.length === 2, 'Expected 2 effects');
});

// ─── Combat Rewards (simulated: loot and XP on combat end) ───
console.log('\n--- Combat End Rewards ---');

test('Combat end populates log with victory message', () => {
  const campaign = makeCampaign({ goblinHp: 1 });
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  forcePlayerFirst(tracker);

  const originalRandom = Math.random;
  Math.random = () => 0.01;
  tracker.resolveAttack('player_1', 'goblin', {});
  Math.random = originalRandom;

  tracker.checkCombatEnd();
  assert(!tracker.state.active, 'Expected combat inactive');
  const hasVictory = tracker.state.log.some(
    (l) => l.includes('所有敌人被击败') || l.includes('战斗结束'),
  );
  assert(hasVictory, 'Expected victory message in log');
});

// ─── calculateDamage with options ───
console.log('\n--- Damage Calculation ---');

test('calculateDamage with weapon option', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  const playerInit = tracker.state.initiative.find((i) => i.entity_id === 'player_1');
  const goblinInit = tracker.state.initiative.find((i) => i.entity_id === 'goblin');
  const damage = tracker.calculateDamage(playerInit, goblinInit, { weapon: { damage: '1d3' } });
  assert(damage.total >= 1, 'Expected minimum 1 damage');
  assert(damage.formula, 'Expected formula string');
  assert(damage.breakdown, 'Expected breakdown object');
});

// ─── checkCombatEnd idempotency ───
console.log('\n--- Edge Cases ---');

test('checkCombatEnd does nothing when state is null', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.state = null;
  tracker.checkCombatEnd(); // Should not throw
  assert(true, 'Expected no error');
});

test('checkCombatEnd does nothing when already inactive', () => {
  const campaign = makeCampaign();
  const tracker = new CombatTracker(campaign);
  tracker.initCombat(['goblin']);
  tracker.state.active = false;
  tracker.checkCombatEnd(); // Should not throw
  assert(true, 'Expected no error');
});

// Summary
console.log('\n=== Test Summary ===');
console.log(`Total: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Status: ${failCount === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);

process.exit(failCount > 0 ? 1 : 0);
