/**
 * Campaign Storage SQLite Mock Test Suite
 * Tests: SQLite path coverage via mock better-sqlite3
 * Covers: saveCampaign, loadCampaign, saveSnapshot, loadSnapshot,
 *         getSnapshots, deleteSnapshot, logAction, getHistory,
 *         getFullCampaignLog, clearCampaign, init fallback, close error
 */

import { register } from 'node:module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setMockThrowOn, clearMockThrow } from './mocks/better-sqlite3-mock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, 'test-campaign.db');

// Register mock loader before any campaign.js import
register('./mocks/sqlite-mock-loader.mjs', import.meta.url);

// Dynamically import campaign.js so it resolves our mock better-sqlite3
const { CampaignStorage } = await import('../storage/campaign.js');

let passCount = 0;
let failCount = 0;

async function test(name, fn) {
  try {
    await fn();
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

function _deepEqual(a, b, message) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(message || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

function cleanup() {
  try {
    fs.unlinkSync(TEST_DB);
  } catch {
    /* ignore */
  }
}

const sampleCampaign = {
  id: 'campaign_test_001',
  module_id: 'test_module',
  player: { name: '调查员', hp: 12, sanity: 60 },
  current_scene: 'scene1',
  scene_history: ['scene1'],
  npcs_state: {},
  flags: { started: true },
  created_at: new Date().toISOString(),
};

console.log('=== Campaign Storage SQLite Mock Tests ===\n');

// --- init() ---
console.log('--- init() ---');

await test('Init with mock SQLite creates tables', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  assert(storage.sqliteEnabled === true, 'Expected sqlite enabled');
  assert(storage.db !== null, 'Expected db instance');
  storage.close();
});

await test('Init fallback when new Database throws', async () => {
  cleanup();
  setMockThrowOn('new');
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  assert(storage.sqliteEnabled === false, 'Expected sqlite disabled after init failure');
  clearMockThrow();
});

// --- saveCampaign / loadCampaign ---
console.log('\n--- saveCampaign / loadCampaign ---');

await test('saveCampaign inserts/updates via SQLite', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  const result = storage.saveCampaign(sampleCampaign);
  assert(result.success === true, 'Expected success');
  assert(result.id === 'campaign_test_001', 'Expected id');
  assert(result.storage === 'sqlite', 'Expected sqlite storage');
  storage.close();
});

await test('loadCampaign retrieves via SQLite', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  storage.saveCampaign(sampleCampaign);
  const loaded = storage.loadCampaign('campaign_test_001');
  assert(loaded !== null, 'Expected loaded');
  assert(loaded.id === 'campaign_test_001', 'Expected id match');
  assert(loaded.player.name === '调查员', 'Expected player name');
  storage.close();
});

await test('loadCampaign returns null for missing campaign', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  const loaded = storage.loadCampaign('nonexistent');
  assert(loaded === null, 'Expected null');
  storage.close();
});

// --- saveSnapshot / loadSnapshot / getSnapshots / deleteSnapshot ---
console.log('\n--- Snapshots ---');

await test('saveSnapshot stores via SQLite', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  const result = storage.saveSnapshot('campaign_test_001', 1, '手动存档', sampleCampaign);
  assert(result.success === true, 'Expected success');
  assert(result.slot === 1, 'Expected slot');
  assert(result.label === '手动存档', 'Expected label');
  assert(result.storage === 'sqlite', 'Expected sqlite storage');
  storage.close();
});

await test('loadSnapshot retrieves via SQLite', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  storage.saveSnapshot('campaign_test_001', 1, '手动存档', sampleCampaign);
  const loaded = storage.loadSnapshot('campaign_test_001', 1);
  assert(loaded !== null, 'Expected loaded');
  assert(loaded.slot === 1, 'Expected slot');
  assert(loaded.label === '手动存档', 'Expected label');
  storage.close();
});

await test('loadSnapshot returns null for missing slot', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  const loaded = storage.loadSnapshot('campaign_test_001', 99);
  assert(loaded === null, 'Expected null');
  storage.close();
});

await test('getSnapshots lists via SQLite', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  storage.saveSnapshot('campaign_test_001', 1, '存档1', sampleCampaign);
  storage.saveSnapshot('campaign_test_001', 2, '存档2', sampleCampaign);
  const list = storage.getSnapshots('campaign_test_001');
  assert(list.length === 2, `Expected 2, got ${list.length}`);
  assert(list[0].slot === 1, 'Expected slot 1');
  assert(list[1].slot === 2, 'Expected slot 2');
  storage.close();
});

await test('getSnapshots returns empty for missing campaign', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  const list = storage.getSnapshots('nonexistent');
  assert(list.length === 0, 'Expected empty');
  storage.close();
});

await test('deleteSnapshot removes via SQLite', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  storage.saveSnapshot('del_test', 1, 'to delete', sampleCampaign);
  const before = storage.loadSnapshot('del_test', 1);
  assert(before !== null, 'Expected before');
  const del = storage.deleteSnapshot('del_test', 1);
  assert(del.success === true, 'Expected delete success');
  const after = storage.loadSnapshot('del_test', 1);
  assert(after === null, 'Expected null after delete');
  storage.close();
});

// --- Logging ---
console.log('\n--- Logging ---');

await test('logAction inserts via SQLite', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  const result = storage.logAction('campaign_test_001', 'move', 'player', '前往图书馆');
  assert(result.success === true, 'Expected log success');
  assert(result.log_id !== undefined, 'Expected log_id');
  storage.close();
});

await test('getHistory retrieves via SQLite', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  storage.logAction('campaign_test_001', 'move', 'player', '前往图书馆');
  storage.logAction('campaign_test_001', 'combat', 'npc1', '攻击');
  const history = storage.getHistory('campaign_test_001', 10);
  assert(history.length === 2, `Expected 2, got ${history.length}`);
  assert(history[0].type === 'move', 'Expected move');
  assert(history[1].type === 'combat', 'Expected combat');
  storage.close();
});

await test('getHistory returns empty for missing campaign', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  const history = storage.getHistory('no_logs', 10);
  assert(history.length === 0, 'Expected empty');
  storage.close();
});

await test('getHistory limit works via SQLite', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  for (let i = 0; i < 5; i++) {
    storage.logAction('limit_test', 'test', 'system', `entry ${i}`);
  }
  const history = storage.getHistory('limit_test', 3);
  assert(history.length === 3, `Expected 3, got ${history.length}`);
  // chronological order: last 3 entries
  assert(history[0].content === 'entry 2', `Expected entry 2, got ${history[0].content}`);
  assert(history[2].content === 'entry 4', `Expected entry 4, got ${history[2].content}`);
  storage.close();
});

// --- Log Summary ---
console.log('\n--- Log Summary ---');

await test('getFullCampaignLog counts saves via SQLite', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  storage.logAction('sum_test', 'move', 'player', '移动');
  storage.logAction('sum_test', 'combat', 'npc1', '攻击');
  storage.logAction('sum_test', 'combat', 'npc2', '攻击');
  storage.saveSnapshot('sum_test', 1, 'snap1', sampleCampaign);

  const full = storage.getFullCampaignLog('sum_test');
  assert(full.campaign_id === 'sum_test', 'Expected campaign id');
  assert(full.total_entries === 3, `Expected 3 entries, got ${full.total_entries}`);
  assert(full.save_count === 1, `Expected 1 save, got ${full.save_count}`);
  assert(full.summary.total_actions === 3, 'Expected 3 total');
  assert(full.summary.combat_rounds === 2, 'Expected 2 combat');
  storage.close();
});

await test('getFullCampaignLog with no logs', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  const full = storage.getFullCampaignLog('empty_test');
  assert(full.campaign_id === 'empty_test', 'Expected id');
  assert(full.total_entries === 0, 'Expected 0 entries');
  assert(full.save_count === 0, 'Expected 0 saves');
  storage.close();
});

// --- Clear Campaign ---
console.log('\n--- Clear Campaign ---');

await test('clearCampaign deletes via SQLite', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  storage.saveCampaign(sampleCampaign);
  storage.saveSnapshot('campaign_test_001', 1, 'save', sampleCampaign);
  storage.logAction('campaign_test_001', 'move', 'player', 'test');

  const result = storage.clearCampaign('campaign_test_001');
  assert(result.success === true, 'Expected success');
  assert(result.campaign_id === 'campaign_test_001', 'Expected id');

  const loaded = storage.loadCampaign('campaign_test_001');
  assert(loaded === null, 'Expected null campaign');
  const snaps = storage.getSnapshots('campaign_test_001');
  assert(snaps.length === 0, 'Expected 0 snapshots');
  const hist = storage.getHistory('campaign_test_001', 10);
  assert(hist.length === 0, 'Expected 0 history');
  storage.close();
});

// --- Error Paths ---
console.log('\n--- SQLite Error Paths ---');

await test('All methods fall back to memory when prepare throws', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();

  // Populate with data using normal path first
  storage.saveCampaign(sampleCampaign);
  storage.saveSnapshot('campaign_test_001', 1, 's1', sampleCampaign);
  storage.logAction('campaign_test_001', 'move', 'player', 'test');

  setMockThrowOn('prepare');

  // saveCampaign catch block (no memory storage for campaigns, just returns success)
  const saveResult = storage.saveCampaign(sampleCampaign);
  assert(saveResult.success === true, 'saveCampaign fallback failed');

  // loadCampaign catch block — returns null (no memory fallback for campaigns)
  const loadResult = storage.loadCampaign('campaign_test_001');
  assert(loadResult === null, 'loadCampaign should return null when SQLite fails');

  // saveSnapshot catch block — stores to memorySaves
  const snapResult = storage.saveSnapshot('campaign_test_001', 2, 's2', sampleCampaign);
  assert(snapResult.success === true, 'saveSnapshot fallback failed');

  // loadSnapshot catch block — reads from memorySaves (slot 2 was saved during fallback)
  const loadSnap = storage.loadSnapshot('campaign_test_001', 2);
  assert(loadSnap !== null, 'loadSnapshot fallback failed');

  // getSnapshots catch block — reads from memorySaves
  const snaps = storage.getSnapshots('campaign_test_001');
  assert(snaps.length > 0, 'getSnapshots fallback failed');

  // deleteSnapshot catch block
  const delResult = storage.deleteSnapshot('campaign_test_001', 99);
  assert(delResult.success === true, 'deleteSnapshot fallback failed');

  // logAction catch block — stores to memoryLogs
  const logResult = storage.logAction('campaign_test_001', 'test', 'sys', 't');
  assert(logResult.success === true, 'logAction fallback failed');

  // getHistory catch block — reads from memoryLogs
  const hist = storage.getHistory('campaign_test_001', 10);
  assert(hist.length > 0, 'getHistory fallback failed');

  // getFullCampaignLog catch block — saveCount stays 0, logs from memory fallback
  const full = storage.getFullCampaignLog('campaign_test_001');
  assert(full.total_entries > 0, 'getFullCampaignLog fallback failed');
  assert(full.save_count === 0, 'saveCount should be 0 when count query fails');

  // clearCampaign catch block
  const clearResult = storage.clearCampaign('campaign_test_001');
  assert(clearResult.success === true, 'clearCampaign fallback failed');

  clearMockThrow();
  storage.close();
});

await test('Close with db.close() error', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  setMockThrowOn('close');
  storage.close(); // Should not throw despite mock error
  clearMockThrow();
  assert(storage.sqliteEnabled === false, 'Expected sqlite disabled after close');
});

// --- Close ---
console.log('\n--- Close ---');

await test('Close storage without error', async () => {
  cleanup();
  const storage = new CampaignStorage(TEST_DB);
  await storage.init();
  storage.close();
  const status = storage.getStatus();
  assert(status.sqliteEnabled === false, 'Expected sqlite disabled after close');
});

// Summary
console.log('\n=== Campaign SQLite Mock Test Summary ===');
console.log(`Total: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Status: ${failCount === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);

// Cleanup
cleanup();

process.exit(failCount > 0 ? 1 : 0);
