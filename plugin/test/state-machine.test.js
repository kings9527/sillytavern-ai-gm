/**
 * State Machine Comprehensive Tests
 * Covers: processAction routing, handleInteract, handleTalk, handleCombatInitiation,
 *         handleDiceCheckInteraction, transitionTo (endings), checkSceneEvents,
 *         evaluateCondition, findMatchingExit, utilities
 */

import { GameStateMachine } from '../engine/state-machine.js';

// ========== Minimal Test Harness ==========

let passCount = 0;
let failCount = 0;

function assertEqual(actual, expected, message) {
  if (actual === expected) { passCount++; return; }
  failCount++;
  console.error(`  FAIL: ${message}`);
  console.error(`    Expected: ${expected}`);
  console.error(`    Actual:   ${actual}`);
}

function assertTrue(actual, message) {
  if (actual) { passCount++; return; }
  failCount++;
  console.error(`  FAIL: ${message}`);
  console.error(`    Expected truthy, got: ${actual}`);
}

function assertFalse(actual, message) {
  if (!actual) { passCount++; return; }
  failCount++;
  console.error(`  FAIL: ${message}`);
  console.error(`    Expected falsy, got: ${actual}`);
}

function assertIncludes(haystack, needle, message) {
  if (haystack && haystack.includes(needle)) { passCount++; return; }
  failCount++;
  console.error(`  FAIL: ${message}`);
  console.error(`    Expected to include: ${needle}`);
  console.error(`    Got: ${haystack}`);
}

function assertObjectEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passCount++; return; }
  failCount++;
  console.error(`  FAIL: ${message}`);
  console.error(`    Expected: ${e}`);
  console.error(`    Actual:   ${a}`);
}

// ========== Fixtures ==========

const SCENES = {
  basement: {
    id: 'basement',
    title: '地下室',
    description: '潮湿的地下室，墙壁渗水。',
    exits: [
      { target: 'hallway', label: '走廊', condition: 'always' },
      { target: 'secret_room', label: '暗门', condition: { key_found: true } },
    ],
    npcs: ['librarian'],
    interactables: ['key', 'note', 'potion'],
    combat: { enabled: true, enemies: ['deep_one'] },
  },
  hallway: {
    id: 'hallway',
    title: '走廊',
    description: '一条昏暗的走廊。',
    exits: [{ target: 'basement', label: '地下室', condition: 'always' }],
    npcs: [],
    interactables: [],
  },
  secret_room: {
    id: 'secret_room',
    title: '密室',
    description: '一间隐藏的密室。',
    exits: [],
    npcs: [],
    interactables: [],
  },
  ending_victory: {
    id: 'ending_victory',
    title: '胜利',
    description: '你成功逃脱了！',
    ending: { type: 'victory', description: '你带着真相活了下来。' },
  },
  ending_defeat: {
    id: 'ending_defeat',
    title: '失败',
    description: '你失去了意识...',
    ending: { type: 'defeat', description: '疯狂吞噬了你。' },
  },
  ending_secret: {
    id: 'ending_secret',
    title: '隐藏结局',
    description: '你发现了世界的真相。',
    ending: { type: 'secret', description: '真相往往比疯狂更可怕。', hidden: true },
  },
  combat_scene: {
    id: 'combat_scene',
    title: '战斗场景',
    description: '敌人埋伏在这里。',
    exits: [{ target: 'hallway', label: '逃跑', condition: 'always' }],
    combat: { enabled: true, enemies: ['boss'] },
  },
  empty_scene: {
    id: 'empty_scene',
    title: '空房间',
    description: '什么都没有。',
    exits: [],
    npcs: [],
    interactables: [],
  },
  no_combat_scene: {
    id: 'no_combat_scene',
    title: '和平房间',
    description: '这里没有敌人。',
    exits: [],
    npcs: [],
    interactables: [],
    combat: { enabled: false },
  },
  conditional_exit_scene: {
    id: 'conditional_exit_scene',
    title: '条件出口房间',
    description: '出口需要条件。',
    exits: [
      { target: 'secret_room', label: '暗门', condition: { key_found: true } },
      { target: 'hallway', label: '走廊', condition: { door_unlocked: true } },
    ],
    npcs: [],
    interactables: [],
  },
};

const NPCS = {
  librarian: { name: '老图书管理员', hp: 10, stats: { HP: 10 }, attitude: 'neutral' },
  deep_one: { name: '深潜者', hp: 20, stats: { HP: 20 } },
  boss: { name: '邪神化身', hp: 100, stats: { HP: 100 } },
};

const ITEMS = {
  key: { name: '古老钥匙', description: '一把生锈的钥匙。', readable: false, usable: false },
  note: { name: '神秘纸条', description: '一张泛黄的纸条。', readable: true, content: '「当月亮正确时，门会打开。」' },
  potion: { name: '治疗药水', description: '一瓶红色药水。', usable: true, effects: ['hp + 10'] },
  bomb: { name: '炸弹', description: '危险的炸弹。', usable: true, effects: [{ type: 'dice_check', skill: 'dodge', skill_value: 40 }] },
  cursed_book: { name: '诅咒之书', description: '散发着邪恶气息。', readable: true, effects: ['sanity_loss 1d3'] },
  stat_item: { name: '属性石', description: '增加力量。', effects: ['strength + 5'] },
};

const BASE_EVENTS = {
  trap_event: {
    description: '地板突然塌陷！',
    trigger: { scene: 'basement', action: 'move', chance: 1.0 },
    effect: { hp: -5 },
    repeatable: false,
  },
  secret_event: {
    description: '你发现了一个隐藏的符号。',
    trigger: { scene: 'basement', action: 'inspect', skill: ['library_use', '图书馆使用'] },
    effect: { clue_found: true },
    repeatable: false,
  },
  time_event: {
    description: '钟声敲响。',
    trigger: { scene: 'hallway', time: 'night' },
    effect: { tension: 1 },
    repeatable: true,
  },
  condition_event: {
    description: '条件触发。',
    trigger: { scene: 'basement', condition: { key_found: true } },
    effect: { bonus: 10 },
    repeatable: false,
  },
  sanity_event: {
    description: '你看到可怕的东西。',
    trigger: { scene: 'basement', action: 'inspect' },
    sanity_check: { target: 50, failure: '1d6' },
    effect: { trauma: 1 },
    repeatable: false,
  },
};

function createModule(events = {}) {
  return { scenes: SCENES, npcs: NPCS, items: ITEMS, events };
}

function createCampaign(overrides = {}) {
  return {
    current_scene: 'basement',
    player: {
      sanity: 50,
      hp: 20,
      max_hp: 20,
      inventory: [],
      stats: { library_use: 50, spot_hidden: 60 },
      status_effects: [],
    },
    global_vars: {},
    scene_history: ['hallway'],
    combat_state: null,
    npcs_state: {},
    module: createModule(),
    ...overrides,
  };
}

// Helper: deep clone a scene to avoid mutating shared fixtures
function cloneScene(scene) {
  return JSON.parse(JSON.stringify(scene));
}

// Helper: create a GSM with a cloned scene as current
function createGSMWithScene(sceneId, moduleOverrides = {}, campaignOverrides = {}) {
  const campaign = createCampaign(campaignOverrides);
  const mod = createModule();
  Object.assign(mod, moduleOverrides);
  mod.scenes = { ...mod.scenes, [sceneId]: cloneScene(mod.scenes[sceneId]) };
  const gsm = new GameStateMachine(mod, campaign);
  gsm.currentScene = mod.scenes[sceneId];
  return gsm;
}

// ========== Tests ==========

async function runTests() {
  console.log('=== GameStateMachine Comprehensive Tests ===\n');

  // ─── processAction routing ───
  console.log('--- processAction routing ---');

  console.log('Test 1: Invalid action throws');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    try {
      await gsm.processAction(null);
      failCount++;
      console.error('  FAIL: Should have thrown for null action');
    } catch (e) {
      passCount++;
      assertIncludes(e.message, 'Invalid action', 'Error message should mention invalid action');
    }
  }

  console.log('Test 2: Move intent with matched exit');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.processAction({
      action_type: 'player_action',
      player_input: '去走廊',
      action_data: { direction: 'hallway' },
    });
    assertEqual(result.type, 'scene_change', 'Move to hallway should be scene_change');
    assertEqual(result.to, 'hallway', 'Should transition to hallway');
  }

  console.log('Test 3: Move intent with no matched exit');
  {
    // Use a scene with only conditional exits and unmet conditions
    const mod = createModule();
    mod.scenes = { conditional_exit_scene: cloneScene(SCENES.conditional_exit_scene) };
    const campaign = createCampaign({ current_scene: 'conditional_exit_scene' });
    const gsm = new GameStateMachine(mod, campaign);
    gsm.currentScene = mod.scenes.conditional_exit_scene;
    const result = await gsm.processAction({
      action_type: 'player_action',
      player_input: '去不存在的地方',
      action_data: { direction: 'nowhere' },
    });
    assertEqual(result.type, 'interaction', 'No exit match should return interaction');
    assertIncludes(result.narration, '没有路', 'Should narrate no path');
  }

  console.log('Test 4: Dice check intent');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.processAction({
      action_type: 'dice_check',
      player_input: '检定图书馆使用',
      action_data: {},
    });
    assertEqual(result.type, 'dice_check', 'Dice check action should return dice_check');
    assertTrue(result.roll >= 1 && result.roll <= 100, 'Roll should be 1-100');
  }

  console.log('Test 5: Attack intent initiates combat');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.processAction({
      action_type: 'player_action',
      player_input: '攻击深潜者',
      action_data: {},
    });
    assertEqual(result.type, 'combat_start', 'Attack in combat scene should start combat');
    assertTrue(result.enemies.includes('deep_one'), 'Should include deep_one enemy');
  }

  console.log('Test 6: Inspect intent');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.processAction({
      action_type: 'player_action',
      player_input: '看看周围',
      action_data: {},
    });
    assertEqual(result.type, 'interaction', 'Inspect should return interaction');
    assertIncludes(result.narration, '地下室', 'Should include scene description');
  }

  console.log('Test 7: Flee intent');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.processAction({
      action_type: 'player_action',
      player_input: '逃跑',
      action_data: {},
    });
    assertEqual(result.type, 'interaction', 'Flee should return interaction');
    assertIncludes(result.narration, '逃跑', 'Should mention fleeing');
  }

  // ─── handleInteract ───
  console.log('\n--- handleInteract ---');

  console.log('Test 8: Interact with readable item');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = gsm.handleInteract({ type: 'interact' }, '阅读神秘纸条');
    assertEqual(result.interaction_type, 'item', 'Should be item interaction');
    assertEqual(result.item_id, 'note', 'Should match note item');
    assertIncludes(result.narration, '拿起神秘纸条开始阅读', 'Should describe reading');
    assertIncludes(result.narration, '当月亮正确时', 'Should include content');
  }

  console.log('Test 9: Interact with usable item (healing)');
  {
    const campaign = createCampaign();
    campaign.player.hp = 10;
    const gsm = new GameStateMachine(createModule(), campaign);
    const result = gsm.handleInteract({ type: 'interact' }, '使用治疗药水');
    assertEqual(result.item_id, 'potion', 'Should match potion');
    assertIncludes(result.narration, '使用了治疗药水', 'Should describe using');
    assertIncludes(result.narration, '效果：', 'Should mention effects');
    assertTrue(campaign.player.inventory.includes('potion'), 'Potion should be in inventory');
  }

  console.log('Test 10: Interact with item that has dice_check effect');
  {
    const gsm = createGSMWithScene('basement');
    gsm.currentScene.interactables = ['bomb'];
    const result = gsm.handleInteract({ type: 'interact' }, '使用炸弹');
    assertEqual(result.type, 'dice_check', 'Dice check effect should return dice_check type');
    assertEqual(result.skill, 'dodge', 'Should extract dodge skill');
  }

  console.log('Test 11: Interact with no matching item');
  {
    const gsm = createGSMWithScene('empty_scene');
    const result = gsm.handleInteract({ type: 'interact' }, '使用不存在的物品');
    assertEqual(result.type, 'interaction', 'No match should return generic interaction');
    // empty_scene has a description, so narration uses description instead of default fallback
    assertIncludes(result.narration, '什么都没有', 'Should give scene description when available');
  }

  console.log('Test 12: Interact with item that has sanity loss effect');
  {
    const gsm = createGSMWithScene('basement');
    gsm.currentScene.interactables = ['cursed_book'];
    const result = gsm.handleInteract({ type: 'interact' }, '阅读诅咒之书');
    assertIncludes(result.narration, '拿起诅咒之书开始阅读', 'Should describe reading');
    assertTrue(result.effects.length > 0, 'Should have effects');
  }

  console.log('Test 13: Interact with item that has stat increment effect');
  {
    const gsm = createGSMWithScene('basement');
    gsm.currentScene.interactables = ['stat_item'];
    const result = gsm.handleInteract({ type: 'interact' }, '使用属性石');
    assertIncludes(result.narration, '效果：', 'Should describe effect');
    assertTrue(gsm.campaign.global_vars.strength === 5, 'Strength should be set to 5');
  }

  // ─── handleTalk ───
  console.log('\n--- handleTalk ---');

  console.log('Test 14: Talk with no NPCs in scene');
  {
    const gsm = createGSMWithScene('hallway');
    const result = await gsm.handleTalk({ type: 'talk' }, '你好');
    assertEqual(result.type, 'interaction', 'No NPCs should return interaction');
    assertIncludes(result.narration, '没有可以交谈的人', 'Should say no one to talk to');
  }

  console.log('Test 15: Talk with single NPC (default match)');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.handleTalk({ type: 'talk' }, '你好');
    assertEqual(result.interaction_type, 'talk', 'Should be talk interaction');
    assertEqual(result.npc_id, 'librarian', 'Should match librarian');
    assertTrue(result.narration.includes('老图书管理员'), 'Should include NPC name');
  }

  console.log('Test 16: Talk matching specific NPC by name');
  {
    const gsm = createGSMWithScene('basement');
    gsm.currentScene.npcs = ['librarian', 'deep_one'];
    const result = await gsm.handleTalk({ type: 'talk' }, '和老图书管理员说话');
    assertEqual(result.npc_id, 'librarian', 'Should match librarian by name');
  }

  console.log('Test 17: Talk with multiple NPCs, no match');
  {
    const gsm = createGSMWithScene('basement');
    gsm.currentScene.npcs = ['librarian', 'deep_one'];
    const result = await gsm.handleTalk({ type: 'talk' }, '你好');
    assertIncludes(result.narration, '你想和谁交谈', 'Should ask who to talk to');
    assertTrue(result.available_actions.length >= 2, 'Should list NPC options');
  }

  // ─── handleCombatInitiation ───
  console.log('\n--- handleCombatInitiation ---');

  console.log('Test 18: Combat not enabled in scene');
  {
    const gsm = createGSMWithScene('no_combat_scene');
    const result = await gsm.handleCombatInitiation({ type: 'attack' }, '攻击');
    assertEqual(result.type, 'interaction', 'No combat should return interaction');
    assertIncludes(result.narration, '没有敌人', 'Should say no enemies');
  }

  console.log('Test 19: Combat enabled but no enemies');
  {
    const gsm = createGSMWithScene('basement');
    gsm.currentScene.combat = { enabled: true, enemies: [] };
    const result = await gsm.handleCombatInitiation({ type: 'attack' }, '攻击');
    assertEqual(result.type, 'interaction', 'No enemies should return interaction');
    assertIncludes(result.narration, '没有可攻击的敌人', 'Should say no attackable enemies');
  }

  console.log('Test 20: Combat with default first enemy');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.handleCombatInitiation({ type: 'attack' }, '攻击');
    assertEqual(result.type, 'combat_start', 'Should start combat');
    assertEqual(result.target, 'deep_one', 'Should default to first enemy');
    assertTrue(result.narration.includes('深潜者'), 'Should include enemy name');
  }

  console.log('Test 21: Combat targeting specific enemy');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    gsm.currentScene = SCENES.combat_scene;
    const result = await gsm.handleCombatInitiation({ type: 'attack' }, '攻击邪神化身');
    assertEqual(result.target, 'boss', 'Should match boss by name');
  }

  // ─── handleDiceCheckInteraction ───
  console.log('\n--- handleDiceCheckInteraction ---');

  console.log('Test 22: Dice check with no skill match');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = gsm.handleDiceCheckInteraction({}, '随便说说');
    assertEqual(result.type, 'interaction', 'No skill should return interaction');
    assertIncludes(result.narration, '检定什么技能', 'Should ask for skill');
  }

  console.log('Test 23: Dice check extracts skill from input');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = gsm.handleDiceCheckInteraction({}, '检定侦查');
    assertEqual(result.skill, '侦查', 'Should extract 侦查 skill');
    assertTrue(result.roll >= 1 && result.roll <= 100, 'Should have valid roll');
  }

  console.log('Test 24: Dice check with provided skill data');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = gsm.handleDiceCheckInteraction({ skill: 'listen', skill_value: 55, modifier: 5 }, '');
    assertEqual(result.skill, 'listen', 'Should use provided skill');
    assertEqual(result.target, 60, 'Should apply modifier (55+5)');
  }

  // ─── checkSceneEvents ───
  console.log('\n--- checkSceneEvents ---');

  console.log('Test 25: No events defined');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = gsm.checkSceneEvents({ type: 'move' });
    assertEqual(result, null, 'No events should return null');
  }

  console.log('Test 26: Event triggered by action type');
  {
    const gsm = new GameStateMachine(createModule(BASE_EVENTS), createCampaign());
    const result = gsm.checkSceneEvents({ type: 'move' });
    assertEqual(result.type, 'event', 'Should trigger trap event');
    assertEqual(result.event_id, 'trap_event', 'Should be trap_event');
    assertIncludes(result.narration, '地板突然塌陷', 'Should include event description');
  }

  console.log('Test 27: One-time event not triggered twice');
  {
    const campaign = createCampaign();
    const gsm = new GameStateMachine(createModule(BASE_EVENTS), campaign);
    gsm.checkSceneEvents({ type: 'move' });
    const result2 = gsm.checkSceneEvents({ type: 'move' });
    assertEqual(result2, null, 'One-time event should not trigger twice');
  }

  console.log('Test 28: Event with condition not met');
  {
    const mod = createModule({ condition_event: BASE_EVENTS.condition_event });
    const gsm = new GameStateMachine(mod, createCampaign());
    const result = gsm.checkSceneEvents({ type: 'move' });
    assertEqual(result, null, 'Condition event should not trigger without key_found');
  }

  console.log('Test 29: Event with random chance fails');
  {
    const events = JSON.parse(JSON.stringify(BASE_EVENTS));
    events.trap_event.trigger.chance = 0.0001;
    const mod = createModule(events);
    const gsm = new GameStateMachine(mod, createCampaign());
    // Force Math.random to return a value > 0.0001
    const origRandom = Math.random;
    Math.random = () => 0.5;
    const result = gsm.checkSceneEvents({ type: 'move' });
    assertEqual(result, null, 'Low chance event should not trigger when random > chance');
    Math.random = origRandom;
  }

  console.log('Test 30: Sanity check in event');
  {
    const mod = createModule({ sanity_event: BASE_EVENTS.sanity_event });
    const campaign = createCampaign();
    const gsm = new GameStateMachine(mod, campaign);
    const result = gsm.checkSceneEvents({ type: 'inspect' });
    assertEqual(result.type, 'event', 'Sanity event should trigger');
    assertTrue(
      result.narration.includes('SAN 检定') || result.narration.includes('你看到可怕的东西'),
      'Should include sanity check or description'
    );
  }

  // ─── transitionTo (endings) ───
  console.log('\n--- transitionTo (endings) ---');

  console.log('Test 31: Victory ending');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.transitionTo('ending_victory');
    assertEqual(result.type, 'ending', 'Should be ending type');
    assertEqual(result.ending.type, 'victory', 'Should be victory ending');
    assertIncludes(result.narration, '胜利', 'Should include victory title');
    assertIncludes(result.narration, '你带着真相活了下来', 'Should include ending description');
    assertTrue(result.available_actions.some((a) => a.type === 'restart'), 'Should offer restart');
  }

  console.log('Test 32: Defeat ending');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.transitionTo('ending_defeat');
    assertEqual(result.type, 'ending', 'Should be ending type');
    assertEqual(result.ending.type, 'defeat', 'Should be defeat ending');
    assertIncludes(result.narration, '失败', 'Should include defeat title');
  }

  console.log('Test 33: Secret ending (hidden)');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.transitionTo('ending_secret');
    assertEqual(result.type, 'ending', 'Should be ending type');
    assertEqual(result.ending.type, 'secret', 'Should be secret ending');
    assertTrue(result.ending.hidden, 'Should have hidden flag');
  }

  console.log('Test 34: Scene not found throws');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    try {
      await gsm.transitionTo('nonexistent');
      failCount++;
      console.error('  FAIL: Should have thrown for missing scene');
    } catch (e) {
      passCount++;
      assertIncludes(e.message, 'Scene not found', 'Should mention scene not found');
    }
  }

  console.log('Test 35: Combat scene entry');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.transitionTo('combat_scene');
    assertEqual(result.type, 'scene_change_combat', 'Should be scene_change_combat');
    assertTrue(result.combat.alert, 'Should have combat alert');
    assertTrue(result.narration.includes('敌人出现'), 'Should mention enemies appearing');
  }

  console.log('Test 36: Normal scene transition');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.transitionTo('hallway');
    assertEqual(result.type, 'scene_change', 'Should be scene_change');
    assertEqual(result.to, 'hallway', 'Should go to hallway');
    assertTrue(result.narration.includes('走廊'), 'Should include scene title');
    assertTrue(result.scene.npcs_present !== undefined, 'Should include npcs_present');
  }

  console.log('Test 37: Leaving combat scene clears combat_state');
  {
    const campaign = createCampaign({ current_scene: 'combat_scene', combat_state: { active: true } });
    const gsm = new GameStateMachine(createModule(), campaign);
    gsm.currentScene = SCENES.combat_scene;
    await gsm.transitionTo('hallway');
    assertEqual(campaign.combat_state, null, 'Should clear combat_state when leaving combat');
  }

  // ─── evaluateCondition ───
  console.log('\n--- evaluateCondition ---');

  console.log('Test 38: Range check [min, max]');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign({ global_vars: { score: 5 } }));
    assertTrue(gsm.evaluateCondition({ score: [1, 10] }), 'Value in range should pass');
    assertFalse(gsm.evaluateCondition({ score: [10, 20] }), 'Value below range should fail');
  }

  console.log('Test 39: Boolean check');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign({ global_vars: { flag: true } }));
    assertTrue(gsm.evaluateCondition({ flag: true }), 'True should match true');
    assertFalse(gsm.evaluateCondition({ flag: false }), 'True should not match false');
  }

  console.log('Test 40: Number equality');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign({ global_vars: { count: 3 } }));
    assertTrue(gsm.evaluateCondition({ count: 3 }), 'Exact number should match');
    assertFalse(gsm.evaluateCondition({ count: 4 }), 'Different number should fail');
  }

  console.log('Test 41: String equality');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign({ global_vars: { name: 'alice' } }));
    assertTrue(gsm.evaluateCondition({ name: 'alice' }), 'Exact string should match');
    assertFalse(gsm.evaluateCondition({ name: 'bob' }), 'Different string should fail');
  }

  console.log('Test 42: Multiple conditions (all must pass)');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign({ global_vars: { a: 1, b: true } }));
    assertTrue(gsm.evaluateCondition({ a: 1, b: true }), 'All matching should pass');
    assertFalse(gsm.evaluateCondition({ a: 1, b: false }), 'One failing should fail all');
  }

  // ─── findMatchingExit ───
  console.log('\n--- findMatchingExit ---');

  console.log('Test 43: Match by target');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const exit = gsm.findMatchingExit('hallway');
    assertTrue(exit && exit.target === 'hallway', 'Should match hallway by target');
  }

  console.log('Test 44: Match by label');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const exit = gsm.findMatchingExit('走廊');
    assertTrue(exit && exit.target === 'hallway', 'Should match by label');
  }

  console.log('Test 45: Always condition');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const exit = gsm.findMatchingExit('whatever', '');
    assertTrue(exit !== null, 'Always condition should match');
  }

  console.log('Test 46: Object condition evaluated');
  {
    // Use a cloned scene with conditional exits only (no always)
    const mod = createModule();
    mod.scenes.conditional_exit_scene = cloneScene(SCENES.conditional_exit_scene);
    const campaign = createCampaign({ current_scene: 'conditional_exit_scene', global_vars: { key_found: true } });
    const gsm = new GameStateMachine(mod, campaign);
    gsm.currentScene = mod.scenes.conditional_exit_scene;
    const exit = gsm.findMatchingExit('secret_room');
    assertTrue(exit && exit.target === 'secret_room', 'Should match when condition is met');
  }

  console.log('Test 47: Object condition not met');
  {
    const mod = createModule();
    mod.scenes.conditional_exit_scene = cloneScene(SCENES.conditional_exit_scene);
    const campaign = createCampaign({ current_scene: 'conditional_exit_scene' });
    const gsm = new GameStateMachine(mod, campaign);
    gsm.currentScene = mod.scenes.conditional_exit_scene;
    // Query a target that does not match any exit target/label, so condition checks matter
    const exit = gsm.findMatchingExit('nowhere');
    assertEqual(exit, undefined, 'Should not match when no target/label matches and conditions are unmet');
  }

  console.log('Test 48: Keyword match in input');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const exit = gsm.findMatchingExit(null, 'go to hallway');
    assertTrue(exit !== null, 'Should match by keyword in input');
  }

  console.log('Test 49: No exits');
  {
    const gsm = createGSMWithScene('empty_scene');
    const exit = gsm.findMatchingExit('anywhere');
    assertEqual(exit, undefined, 'No exits should return undefined');
  }

  // ─── applyEventEffects ───
  console.log('\n--- applyEventEffects ---');

  console.log('Test 50: Increment effect (+)');
  {
    const campaign = createCampaign({ global_vars: { score: 5 } });
    const gsm = new GameStateMachine(createModule(), campaign);
    gsm.applyEventEffects({ 'score+': 3 });
    assertEqual(campaign.global_vars.score, 8, 'Should increment by 3');
  }

  console.log('Test 51: Decrement effect (-)');
  {
    const campaign = createCampaign({ global_vars: { score: 10 } });
    const gsm = new GameStateMachine(createModule(), campaign);
    gsm.applyEventEffects({ 'score-': 4 });
    assertEqual(campaign.global_vars.score, 6, 'Should decrement by 4');
  }

  console.log('Test 52: Sanity loss effect');
  {
    const campaign = createCampaign();
    const gsm = new GameStateMachine(createModule(), campaign);
    gsm.applyEventEffects({ sanity_loss: '1d3' });
    assertTrue(campaign.player.sanity < 50, 'Sanity should decrease');
  }

  console.log('Test 53: Set effect');
  {
    const campaign = createCampaign();
    const gsm = new GameStateMachine(createModule(), campaign);
    gsm.applyEventEffects({ discovered: true });
    assertEqual(campaign.global_vars.discovered, true, 'Should set boolean value');
  }

  // ─── performSanityCheck ───
  console.log('\n--- performSanityCheck ---');

  console.log('Test 54: Sanity check success');
  {
    const campaign = createCampaign();
    const gsm = new GameStateMachine(createModule(), campaign);
    const origRandom = Math.random;
    Math.random = () => 0.1;
    const result = gsm.performSanityCheck({ target: 50, failure: '1d3' });
    assertTrue(result.success, 'Low roll should succeed');
    assertTrue(result.narration.includes('成功'), 'Should narrate success');
    Math.random = origRandom;
  }

  console.log('Test 55: Sanity check failure with loss');
  {
    const campaign = createCampaign();
    const gsm = new GameStateMachine(createModule(), campaign);
    const origRandom = Math.random;
    Math.random = () => 0.99;
    const result = gsm.performSanityCheck({ target: 50, failure: '1d3' });
    assertFalse(result.success, 'High roll should fail');
    assertTrue(result.narration.includes('失败'), 'Should narrate failure');
    assertTrue(campaign.player.sanity < 50, 'Sanity should decrease on failure');
    Math.random = origRandom;
  }

  console.log('Test 56: Sanity check with major loss (temporary insanity)');
  {
    const campaign = createCampaign();
    const gsm = new GameStateMachine(createModule(), campaign);
    const origRandom = Math.random;
    Math.random = () => 0.95;
    const origParseDice = gsm.parseDiceExpression;
    gsm.parseDiceExpression = () => 5;
    const result = gsm.performSanityCheck({ target: 50, failure: '1d10' });
    assertTrue(result.narration.includes('疯狂'), 'Major loss should mention insanity');
    assertTrue(campaign.player.status_effects.some((e) => e.type === 'temp_insanity'), 'Should add temp_insanity');
    gsm.parseDiceExpression = origParseDice;
    Math.random = origRandom;
  }

  // ─── Utilities ───
  console.log('\n--- Utilities ---');

  console.log('Test 57: sanitizeNarration removes script tags');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const dirty = '<script>alert("xss")</script>Hello';
    const clean = gsm.sanitizeNarration(dirty);
    assertFalse(clean.includes('<script>'), 'Should remove script tags');
    assertTrue(clean.includes('Hello'), 'Should keep safe text');
  }

  console.log('Test 58: sanitizeNarration removes javascript: protocol');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const dirty = 'javascript:alert(1)';
    const clean = gsm.sanitizeNarration(dirty);
    assertFalse(clean.includes('javascript:'), 'Should remove javascript protocol');
  }

  console.log('Test 59: parseEffectString handles increment');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = gsm.parseEffectString('hp + 5');
    assertObjectEqual(result, { target: 'hp', operation: '+', value: 5 }, 'Should parse increment');
  }

  console.log('Test 60: parseEffectString handles dice');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = gsm.parseEffectString('sanity_loss 1d6');
    assertObjectEqual(result, { target: 'sanity_loss', operation: 'dice', value: '1d6' }, 'Should parse dice effect');
  }

  console.log('Test 61: parseEffectString handles set');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = gsm.parseEffectString('level 10');
    assertObjectEqual(result, { target: 'level', operation: 'set', value: 10 }, 'Should parse set effect');
  }

  console.log('Test 62: parseEffectString returns null for invalid');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = gsm.parseEffectString('nonsense');
    assertEqual(result, null, 'Invalid string should return null');
  }

  console.log('Test 63: applyEffect increment');
  {
    const campaign = createCampaign({ global_vars: { hp: 10 } });
    const gsm = new GameStateMachine(createModule(), campaign);
    gsm.applyEffect({ target: 'hp', operation: '+', value: 5 });
    assertEqual(campaign.global_vars.hp, 15, 'Should increment');
  }

  console.log('Test 64: applyEffect decrement');
  {
    const campaign = createCampaign({ global_vars: { hp: 10 } });
    const gsm = new GameStateMachine(createModule(), campaign);
    gsm.applyEffect({ target: 'hp', operation: '-', value: 3 });
    assertEqual(campaign.global_vars.hp, 7, 'Should decrement');
  }

  console.log('Test 65: applyEffect dice sanity_loss');
  {
    const campaign = createCampaign();
    const gsm = new GameStateMachine(createModule(), campaign);
    gsm.applyEffect({ target: 'sanity_loss', operation: 'dice', value: '1d3' });
    assertTrue(campaign.player.sanity < 50, 'Should apply sanity loss');
  }

  console.log('Test 66: describeEffect increment');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const desc = gsm.describeEffect({ target: 'hp', operation: '+', value: 5 });
    assertEqual(desc, 'hp增加5', 'Should describe increment');
  }

  console.log('Test 67: describeEffect dice sanity_loss');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const desc = gsm.describeEffect({ target: 'sanity_loss', operation: 'dice', value: '1d6' });
    assertIncludes(desc, 'SAN', 'Should mention SAN');
  }

  console.log('Test 68: parseDiceExpression with number');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    assertEqual(gsm.parseDiceExpression(5), 5, 'Number should return itself');
  }

  console.log('Test 69: parseDiceExpression with invalid string');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    assertEqual(gsm.parseDiceExpression('invalid'), 0, 'Invalid should return 0');
  }

  console.log('Test 70: getCurrentTime returns valid time string');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const time = gsm.getCurrentTime();
    assertTrue(['night', 'morning', 'afternoon'].includes(time), 'Should return valid time');
  }

  // ─── getAvailableActions ───
  console.log('\n--- getAvailableActions ---');

  console.log('Test 71: Actions include exits, npcs, items, combat');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const actions = gsm.getAvailableActions();
    assertTrue(actions.some((a) => a.type === 'move'), 'Should have move actions');
    assertTrue(actions.some((a) => a.type === 'talk'), 'Should have talk actions');
    assertTrue(actions.some((a) => a.type === 'interact'), 'Should have interact actions');
    assertTrue(actions.some((a) => a.type === 'attack'), 'Should have attack action');
  }

  console.log('Test 72: Empty scene has minimal actions');
  {
    const gsm = createGSMWithScene('empty_scene');
    const actions = gsm.getAvailableActions();
    assertEqual(actions.length, 0, 'Empty scene should have no actions');
  }

  // ─── handleSceneInteraction ───
  console.log('\n--- handleSceneInteraction ---');

  console.log('Test 73: Inspect intent returns scene description');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.handleSceneInteraction({ type: 'inspect' });
    assertIncludes(result.narration, '地下室', 'Should include scene description');
  }

  console.log('Test 74: Flee intent shows exits');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.handleSceneInteraction({ type: 'flee' });
    assertIncludes(result.narration, '逃跑', 'Should mention fleeing');
    assertTrue(result.available_actions.some((a) => a.type === 'move'), 'Should list exits');
  }

  // ─── checkSkillSuccessEvents ───
  console.log('\n--- checkSkillSuccessEvents ---');

  console.log('Test 75: Skill success triggers event');
  {
    const campaign = createCampaign();
    const gsm = new GameStateMachine(createModule(BASE_EVENTS), campaign);
    const result = gsm.checkSkillSuccessEvents('图书馆使用', 30, 50);
    assertTrue(result !== null, 'Should trigger secret_event');
    assertTrue(result.narration.includes('隐藏的符号'), 'Should include event narration');
  }

  console.log('Test 76: Skill fail does not trigger event');
  {
    const campaign = createCampaign();
    const gsm = new GameStateMachine(createModule(BASE_EVENTS), campaign);
    campaign.global_vars = {};
    const result = gsm.checkSkillSuccessEvents('图书馆使用', 60, 50);
    assertEqual(result, null, 'Fail should not trigger event');
  }

  console.log('Test 77: No matching skill events');
  {
    const campaign = createCampaign();
    const gsm = new GameStateMachine(createModule(BASE_EVENTS), campaign);
    const result = gsm.checkSkillSuccessEvents('climb', 10, 50);
    assertEqual(result, null, 'No matching skill should return null');
  }

  // ─── processAction event integration ───
  console.log('\n--- processAction event integration ---');

  console.log('Test 78: processAction triggers scene event');
  {
    const campaign = createCampaign();
    const gsm = new GameStateMachine(createModule(BASE_EVENTS), campaign);
    const result = await gsm.processAction({
      action_type: 'player_action',
      player_input: '往前走',
      action_data: { direction: 'hallway' },
    });
    assertEqual(result.type, 'event', 'Should trigger event before move');
    assertEqual(result.event_id, 'trap_event', 'Should be trap_event');
  }

  console.log('Test 79: processAction with interact intent');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.processAction({
      action_type: 'player_action',
      player_input: '检查古老钥匙',
      action_data: {},
    });
    assertEqual(result.interaction_type, 'item', 'Should handle item interaction');
    assertEqual(result.item_id, 'key', 'Should match key');
  }

  console.log('Test 80: processAction with usable item via handleInteract');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.processAction({
      action_type: 'player_action',
      player_input: '使用治疗药水',
      action_data: {},
    });
    // Note: "使用" parses to use intent, which routes to handleSceneInteraction default.
    // To test actual item use through processAction, we need an inspect/interact intent.
    // The use intent currently falls through to handleSceneInteraction.
    assertEqual(result.type, 'interaction', 'Use intent falls through to scene interaction');
  }

  // ─── Additional edge cases ───
  console.log('\n--- Additional edge cases ---');

  console.log('Test 81: handleInteract inventory initialization');
  {
    const campaign = createCampaign();
    delete campaign.player.inventory;
    const gsm = new GameStateMachine(createModule(), campaign);
    gsm.handleInteract({ type: 'interact' }, '检查古老钥匙');
    assertTrue(Array.isArray(campaign.player.inventory), 'Should initialize inventory');
  }

  console.log('Test 82: handleSceneInteraction talk intent routes to handleTalk');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.handleSceneInteraction({ type: 'talk' });
    assertEqual(result.interaction_type, 'talk', 'Should route talk intent');
    assertEqual(result.npc_id, 'librarian', 'Should match librarian');
  }

  console.log('Test 83: transitionTo updates current scene');
  {
    const campaign = createCampaign();
    const gsm = new GameStateMachine(createModule(), campaign);
    await gsm.transitionTo('hallway');
    assertEqual(campaign.current_scene, 'hallway', 'Should update current_scene');
    assertEqual(gsm.currentScene.id, 'hallway', 'Should update gsm.currentScene');
  }

  console.log('Test 84: Event effect hp decrement');
  {
    const campaign = createCampaign();
    const gsm = new GameStateMachine(createModule(BASE_EVENTS), campaign);
    gsm.checkSceneEvents({ type: 'move' });
    assertTrue(campaign.global_vars.hp === -5, 'Should decrement hp by 5');
  }

  console.log('Test 85: Combat initiation with LLM client unavailable');
  {
    const campaign = createCampaign();
    const gsm = new GameStateMachine(createModule(), campaign);
    const result = await gsm.handleCombatInitiation({ type: 'attack' }, '攻击');
    assertEqual(result.type, 'combat_start', 'Should still start combat without LLM');
  }

  console.log('Test 86: processAction default scene interaction');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = await gsm.processAction({
      action_type: 'player_action',
      player_input: 'something weird',
      action_data: {},
    });
    assertEqual(result.type, 'interaction', 'Unknown intent should default to scene interaction');
  }

  console.log('Test 87: Dice check all result types');
  {
    const gsm = new GameStateMachine(createModule(), createCampaign());
    const result = gsm.handleDiceCheckInteraction({ skill: 'test', skill_value: 50 }, '');
    assertTrue(['critical', 'extreme', 'hard', 'success', 'fail', 'fumble'].includes(result.result), 'Should have valid result type');
    assertTrue(['extreme', 'hard', null].includes(result.degree), 'Should have valid degree');
  }

  console.log('Test 88: Time-based event respects current time');
  {
    const mod = createModule({ time_event: BASE_EVENTS.time_event });
    mod.scenes.hallway = cloneScene(SCENES.hallway);
    const campaign = createCampaign({ current_scene: 'hallway' });
    const gsm = new GameStateMachine(mod, campaign);
    gsm.currentScene = mod.scenes.hallway;
    const result = gsm.checkSceneEvents({ type: 'inspect' });
    if (gsm.getCurrentTime() === 'night') {
      assertEqual(result.type, 'event', 'Should trigger at night');
    } else {
      assertEqual(result, null, 'Should not trigger during day');
    }
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
