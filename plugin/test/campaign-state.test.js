/**
 * Test: Campaign State Route + buildGameState
 * Verifies GET /campaign/:id/state route exists and buildGameState builds correct UI payload
 */

import { router, buildGameState } from '../server.js';

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAIL: ${message}`);
}

function testCampaignStateRouteExists() {
  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      method: Object.keys(layer.route.methods)[0].toUpperCase(),
      path: layer.route.path,
    }));
  const found = routes.some((r) => r.method === 'GET' && r.path === '/campaign/:id/state');
  assert(found, 'GET /campaign/:id/state route must exist in router');
  console.log('✅ testCampaignStateRouteExists passed');
}

function testBuildGameState() {
  const mockModule = {
    scenes: {
      scene1: {
        id: 'scene1',
        title: '图书馆',
        description: '古老的书架延伸到黑暗中...',
        atmosphere: 'mystery',
        backdrop: '/img/library.jpg',
        interactables: ['古书', '烛台'],
        world_info_keys: ['克苏鲁', '图书馆'],
        exits: [{ label: '去地下室', target: 'basement' }],
      },
    },
    npcs: {
      librarian: {
        name: '老管理员',
        hp: 15,
        sanity: 60,
        attitude: 'neutral',
        avatar: '/img/librarian.png',
        status_effects: [],
        description: '沉默的老人',
      },
    },
  };
  const mockCampaign = {
    id: 'camp-123',
    module_id: 'test-module',
    current_scene: 'scene1',
    player: {
      name: '调查员',
      hp: 12,
      max_hp: 12,
      sanity: 55,
      max_sanity: 60,
      stats: { HP: 12, SAN: 60, MP: 10 },
      inventory: [],
      status_effects: [],
    },
    npcs_state: {
      librarian: { hp: 15, sanity: 60, attitude: 'neutral', location: '图书馆' },
    },
    session_log: [],
  };
  const state = buildGameState(mockCampaign, mockModule);
  assert(state.title === '图书馆', `title must be '图书馆', got ${state.title}`);
  assert(state.scene.id === 'scene1', 'scene.id must be scene1');
  assert(state.scene.atmosphere === 'mystery', 'scene.atmosphere must be mystery');
  assert(state.npcs.length === 1, `npcs must have 1 entry, got ${state.npcs.length}`);
  assert(
    state.npcs[0].name === '老管理员',
    `npc[0].name must be '老管理员', got ${state.npcs[0].name}`,
  );
  assert(
    state.npcs[0].currentHp === 15,
    `npc[0].currentHp must be 15, got ${state.npcs[0].currentHp}`,
  );
  assert(state.exits.length === 1, `exits must have 1 entry, got ${state.exits.length}`);
  assert(state.exits[0].target === 'basement', 'exit target must be basement');
  assert(state.player.name === '调查员', `player.name must be '调查员', got ${state.player.name}`);
  assert(state.player.stats.hp === 12, `player.stats.hp must be 12, got ${state.player.stats.hp}`);
  assert(Array.isArray(state.log), 'log must be an array');
  console.log('✅ testBuildGameState passed');
}

function testBuildGameStateDefaults() {
  // Edge case: empty campaign / missing fields
  const state = buildGameState({}, {});
  assert(state.title === '未知场景', `default title must be '未知场景', got ${state.title}`);
  assert(state.npcs.length === 0, 'npcs must be empty for empty module');
  assert(
    state.player.name === '未知',
    `default player name must be '未知', got ${state.player.name}`,
  );
  console.log('✅ testBuildGameStateDefaults passed');
}

function runAll() {
  console.log('--- Campaign State Route Test ---');
  testCampaignStateRouteExists();
  testBuildGameState();
  testBuildGameStateDefaults();
  console.log('All tests passed ✅');
}

runAll();
