/**
 * AI-GM Day 5 Integration Test
 * End-to-end: Create campaign → Scene1 → Check → Scene2 → Combat → Ending
 */

import { GameStateMachine } from '../engine/state-machine.js';
import { CombatTracker } from '../engine/combat-tracker.js';
import { CampaignStorage } from '../storage/campaign.js';
import { MOCK_MODULE } from '../utils/dev-mode.js';

const testModule = {
  ...MOCK_MODULE,
  scenes: {
    ...MOCK_MODULE.scenes,
    entrance: {
      ...MOCK_MODULE.scenes.entrance,
      exits: [{ target: 'library', label: '进入图书馆', condition: null }],
      npcs: ['guard'],
      events: [],
      combat: { enabled: false },
    },
    library: {
      ...MOCK_MODULE.scenes.library,
      exits: [
        { target: 'basement', label: '地下室', condition: null },
        { target: 'entrance', label: '返回正门', condition: null },
      ],
      interactables: ['bookshelf'],
    },
    basement: {
      ...MOCK_MODULE.scenes.basement,
      exits: [
        { target: 'library', label: '返回图书馆', condition: null },
        { target: 'entrance', label: '返回正门', condition: null },
      ],
    },
  },
  npcs: {
    ...MOCK_MODULE.npcs,
    guard: {
      id: 'guard',
      name: '校园警卫',
      attitude: 'neutral',
      hp: 10,
      stats: { str: 50, con: 50, dex: 40, int: 40, pow: 40, edu: 50 },
      dialogue: {
        default: '晚上好，图书馆还开着。',
        inspect: '最近有些奇怪的人进出...',
      },
    },
    cultist: {
      id: 'cultist',
      name: '邪教徒',
      role: 'enemy',
      attitude: 'hostile',
      hp: 10,
      stats: { str: 55, con: 50, dex: 50, int: 40, pow: 60, edu: 30 },
      dialogue: { default: '...你不该来这里。' },
      secrets: [
        { keyword: '邪教', reveal_text: '“你知道得太多了……”', clue_id: 'cult_knowledge' }
      ]
    },
  },
  items: {
    ...MOCK_MODULE.items,
    bookshelf: {
      id: 'bookshelf',
      name: '书架',
      description: '摆满古旧书籍的书架。',
      readable: true,
      content: '关于本地邪教活动的剪报...',
      effects: [{ type: 'dice_check', skill: '图书馆使用', target: 50 }],
    },
  },
};

testModule.start_scene = 'entrance';

const testCampaign = {
  id: 'integration-test-001',
  module_id: 'arkham-night',
  player: {
    name: '测试调查员',
    hp: 12, max_hp: 12,
    sanity: 60, max_sanity: 60,
    stats: { str: 50, con: 50, dex: 70, int: 60, pow: 50, edu: 70, siz: 60, app: 60 },
    skills: { '图书馆使用': 25, '侦查': 40, '聆听': 30, '格斗': 50, '射击': 45, '闪避': 40 },
    inventory: ['手电筒', '笔记本', '手枪', '急救包'],
  },
  current_scene: 'entrance',
  turn: 1,
  flags: {},
  npcs_state: {},
  combat_state: null,
  scene_history: [],
  module: testModule,
};

let pass = 0, fail = 0;

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function step(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    pass++;
  } catch (e) {
    console.error(`  ❌ ${name}: ${e.message}`);
    fail++;
  }
}

async function runTests() {
  console.log('=== AI-GM Day 5 Integration Test ===\n');

  // Step 1: Create campaign
  console.log('Step 1: Campaign Creation');
  const storage = new CampaignStorage();
  await step('Campaign saved to slot 1', () => {
    storage.saveSnapshot('integration-test-001', 1, '初始存档', testCampaign);
    const list = storage.getSnapshots('integration-test-001');
    assert(list.length === 1, 'Should have 1 save');
  });

  // Step 2: Load scene
  console.log('\nStep 2: Scene Loading');
  const state = new GameStateMachine(testModule, testCampaign);
  await step('Start scene is entrance', () => {
    assert(testCampaign.current_scene === 'entrance', 'Should start at entrance');
  });
  await step('Entrance has guard NPC', () => {
    const scene = testModule.scenes.entrance;
    assert(scene.npcs.includes('guard'), 'Guard should be present');
  });

  // Step 3: NPC interaction
  console.log('\nStep 3: NPC Interaction');
  await step('Talk to guard', async () => {
    const result = await state.processAction({ action_type: 'interact', player_input: '和警卫对话', action_data: { target: 'guard', action: 'talk' } });
    assert(result.narration, 'Should have dialogue response');
    assert(result.narration.includes('警卫') || result.narration.includes('晚上好'), 'Should have guard dialogue');
  });
  await step('Inspect guard', async () => {
    const result = await state.processAction({ action_type: 'interact', player_input: '观察警卫', action_data: { target: 'guard', action: 'inspect' } });
    assert(result.narration, 'Should have inspect response');
  });

  // Step 4: Move to library
  console.log('\nStep 4: Scene Transition');
  await step('Move to library', async () => {
    const result = await state.processAction({ action_type: 'move', player_input: '去图书馆', action_data: { direction: 'library' } });
    assert(result.to === 'library', 'Should be in library');
    assert(testCampaign.current_scene === 'library', 'Campaign updated');
  });
  await step('Library has librarian', () => {
    const scene = testModule.scenes.library;
    assert(scene.npcs.includes('librarian'), 'Librarian should be present');
  });

  // Step 5: Library skill check
  console.log('\nStep 5: Skill Check (Library Use)');
  await step('Search with library_use', async () => {
    const result = await state.processAction({ action_type: 'interact', player_input: '搜索书架', action_data: { target: 'bookshelf', action: 'search' } });
    assert(result.type === 'dice_check', 'Should trigger dice check');
    assert(result.skill === '图书馆使用', 'Should be library use');
  });

  // Step 6: Move to basement
  console.log('\nStep 6: Basement Combat');
  await step('Move to basement', async () => {
    const result = await state.processAction({ action_type: 'move', player_input: '去地下室', action_data: { direction: 'basement' } });
    assert(result.to === 'basement', 'Should be in basement');
    assert(result.combat, 'Combat should be triggered');
    assert(result.combat.enemies.length > 0, 'Should have enemies');
  });

  // Step 7: Combat
  console.log('\nStep 7: Combat System');
  let combat;
  await step('Combat initialized', () => {
    try {
      combat = new CombatTracker(testCampaign);
      console.log('CombatTracker created, campaign combat_state:', testCampaign.combat_state);
      const enemies = testModule.scenes.basement.combat.enemies.map(id => ({
        id,
        ...testModule.npcs[id],
        hp: testModule.npcs[id].hp,
        max_hp: testModule.npcs[id].hp,
      }));
      console.log('Enemies:', enemies);
      combat.initCombat(enemies);
      console.log('Combat init success. Initiative:', combat.state.initiative);
      assert(combat.state && combat.state.initiative && combat.state.initiative.length > 0, 'Should have initiative order');
    } catch (e) {
      console.error('Combat init error:', e.message);
      console.error(e.stack);
      throw e;
    }
  });
  await step('Player turn attack', async () => {
    const attacker = combat.state.initiative.find(i => i.entity_id === combat.state.current_turn);
    if (attacker.entity_id === 'player_1') {
      const result = await combat.resolveAttack({ attacker_id: 'player', target_id: 'cultist', weapon: 'pistol' });
      assert(result.damage >= 0, 'Should have damage value');
    }
  });
  await step('Combat ends when enemy HP reaches 0', async () => {
    let safety = 0;
    while (combat.state.initiative.filter(i => i.type === 'enemy' && combat.campaign.npcs_state[i.entity_id]?.current_hp > 0).length > 0 && safety < 20) {
      const actor = combat.state.initiative.find(i => i.entity_id === combat.state.current_turn);
      if (actor.entity_id === 'player_1') {
        await combat.resolveAttack({ attacker_id: 'player', target_id: 'cultist', weapon: 'pistol' });
      } else {
        await combat.resolveAttack({ attacker_id: 'cultist', target_id: 'player', weapon: 'dagger' });
      }
      combat.advanceTurn();
      safety++;
    }
    combat.checkCombatEnd();
    assert(!combat.state.active, 'Combat should end');
    assert((combat.campaign.player?.hp || 0) > 0, 'Player should be alive');
  });

  // Step 8: Save/Load
  console.log('\nStep 8: Save/Load');
  await step('Save during combat cleared', () => {
    assert(!combat.state.active, 'Combat should be ended');
  });
  await step('Load returns correct scene', () => {
    storage.saveSnapshot('integration-test-001', 2, '地下室战斗后', testCampaign);
    const loaded = storage.loadSnapshot('integration-test-001', 2);
    assert(loaded, 'Should load successfully');
    assert(loaded && loaded.current_scene === 'basement', 'Should be in basement');
  });

  // Step 9: NPC Decision Engine
  console.log('\nStep 9: NPC Decision Engine');
  await step('NPC state initialized after talk', async () => {
    assert(testCampaign.npcs_state?.guard, 'Guard NPC state should be created');
    assert(testCampaign.npcs_state.guard.trust >= 30, 'Guard trust should be at least 30');
    assert(testCampaign.npcs_state.guard.attitude === 'neutral', 'Initial attitude should be neutral');
  });

  await step('NPC attitude shifts on friendly interaction', async () => {
    // Move back to entrance to talk to guard again
    const moveResult = await state.processAction({ action_type: 'move', player_input: '回正门', action_data: { direction: 'entrance' } });
    assert(moveResult.to === 'entrance', 'Should be back at entrance');
    const result = await state.processAction({ action_type: 'interact', player_input: '和警卫说谢谢', action_data: { target: 'guard', action: 'talk' } });
    assert(result.npc_decision, 'Should have npc_decision field');
    assert(result.npc_decision.mood === 'neutral' || result.npc_decision.mood === 'friendly', 'Guard should be neutral or friendly');
    assert(testCampaign.npcs_state.guard.trust > 30, 'Trust should increase after friendly talk');
  });

  await step('Hostile NPC (cultist) evades on cult topic', async () => {
    // From entrance, need to go library -> basement
    await state.processAction({ action_type: 'move', player_input: '去图书馆', action_data: { direction: 'library' } });
    await state.processAction({ action_type: 'move', player_input: '去地下室', action_data: { direction: 'basement' } });
    const result = await state.processAction({ action_type: 'interact', player_input: '问邪教徒关于邪教', action_data: { target: 'cultist', action: 'talk' } });
    assert(result.npc_decision.mood === 'suspicious' || result.npc_decision.mood === 'hostile', 'Cultist should react to cult topic');
    assert(testCampaign.npcs_state?.cultist, 'Cultist NPC state should be created');
  });

  await step('NPC decision engine state summary', () => {
    const guard = testCampaign.npcs_state.guard;
    const cultist = testCampaign.npcs_state?.cultist;
    assert(guard?.is_alive === true, 'Guard should be alive');
    assert(cultist?.is_alive === true, 'Cultist should be alive');
    assert(cultist?.attitude === 'hostile' || cultist?.attitude?.startsWith('hostile'), 'Cultist should be hostile');
  });

  // Summary
  console.log('\n=== Integration Test Summary ===');
  console.log(`Passed: ${pass}`);
  console.log(`Failed: ${fail}`);
  console.log(fail === 0 ? '\n✅ All integration tests passed!' : '\n❌ Some tests failed');
  process.exit(fail > 0 ? 1 : 0);
}

runTests();
