/**
 * Dev Mode Utilities Test Suite
 * Coverage target: utils/dev-mode.js
 */

import {
  isMockMode,
  createMockCampaign,
  createMockModule,
  watchModule,
  devLog,
  devTimer,
  resetDevData,
  MOCK_CAMPAIGN,
  MOCK_MODULE,
} from '../utils/dev-mode.js';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_WATCH_FILE = join(__dirname, 'tmp-watch-test.json');

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

function deepEqual(a, b, message) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(message || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

console.log('=== Dev Mode Utilities Tests ===\n');

// --- isMockMode ---
console.log('--- isMockMode ---');

const originalMockMode = process.env.MOCK_MODE;
const originalNodeEnv = process.env.NODE_ENV;

test('isMockMode returns false by default', () => {
  delete process.env.MOCK_MODE;
  delete process.env.NODE_ENV;
  assert(isMockMode() === false, 'Expected false when no env vars');
});

test('isMockMode returns true with MOCK_MODE=true', () => {
  process.env.MOCK_MODE = 'true';
  delete process.env.NODE_ENV;
  assert(isMockMode() === true, 'Expected true with MOCK_MODE=true');
});

test('isMockMode returns true with NODE_ENV=development', () => {
  delete process.env.MOCK_MODE;
  process.env.NODE_ENV = 'development';
  assert(isMockMode() === true, 'Expected true with NODE_ENV=development');
});

test('isMockMode returns false with NODE_ENV=production', () => {
  delete process.env.MOCK_MODE;
  process.env.NODE_ENV = 'production';
  assert(isMockMode() === false, 'Expected false with NODE_ENV=production');
});

// Restore env
if (originalMockMode !== undefined) process.env.MOCK_MODE = originalMockMode;
else delete process.env.MOCK_MODE;
if (originalNodeEnv !== undefined) process.env.NODE_ENV = originalNodeEnv;
else delete process.env.NODE_ENV;

// --- createMockCampaign ---
console.log('\n--- createMockCampaign ---');

test('createMockCampaign returns valid campaign object', () => {
  const campaign = createMockCampaign();
  assert(campaign.id === 'mock-campaign-001', 'Expected campaign id');
  assert(campaign.name === 'Development Test', 'Expected campaign name');
  assert(campaign.module_id === 'arkham-night', 'Expected module id');
  assert(campaign.player.name === 'Test Investigator', 'Expected player name');
  assert(campaign.player.hp === 12, 'Expected player hp');
  assert(Array.isArray(campaign.player.inventory), 'Expected inventory array');
  assert(campaign.current_scene === 'library', 'Expected current scene');
});

test('createMockCampaign returns deep copy', () => {
  const a = createMockCampaign();
  const b = createMockCampaign();
  a.player.hp = 99;
  assert(b.player.hp === 12, 'Expected original hp unchanged');
  assert(a.player.hp === 99, 'Expected modified copy');
});

// --- createMockModule ---
console.log('\n--- createMockModule ---');

test('createMockModule returns valid module object', () => {
  const mod = createMockModule();
  assert(mod.id === 'arkham-night', 'Expected module id');
  assert(mod.name === '阿卡姆之夜', 'Expected module name');
  assert(mod.version === '1.0.0', 'Expected version');
  assert(mod.scenes.library !== undefined, 'Expected library scene');
  assert(mod.scenes.basement !== undefined, 'Expected basement scene');
  assert(mod.npcs.librarian !== undefined, 'Expected librarian npc');
  assert(mod.endings.madness !== undefined, 'Expected madness ending');
});

test('createMockModule returns deep copy', () => {
  const a = createMockModule();
  const b = createMockModule();
  a.scenes.library.title = 'Modified';
  assert(b.scenes.library.title === '密斯卡托尼克大学图书馆', 'Expected original unchanged');
});

// --- watchModule ---
console.log('\n--- watchModule ---');

test('watchModule returns cleanup function in non-mock mode', () => {
  delete process.env.MOCK_MODE;
  process.env.NODE_ENV = 'production';
  const cleanup = watchModule('/fake/path', () => {});
  assert(typeof cleanup === 'function', 'Expected cleanup function');
  cleanup();
});

test('watchModule returns cleanup function in mock mode', () => {
  process.env.MOCK_MODE = 'true';
  writeFileSync(TMP_WATCH_FILE, '{}');
  const cleanup = watchModule(TMP_WATCH_FILE, () => {});
  assert(typeof cleanup === 'function', 'Expected cleanup function');
  cleanup();
  try { unlinkSync(TMP_WATCH_FILE); } catch { /* ignore */ }
  delete process.env.MOCK_MODE;
});

// --- devLog ---
console.log('\n--- devLog ---');

test('devLog does nothing in production', () => {
  delete process.env.MOCK_MODE;
  process.env.NODE_ENV = 'production';
  let called = false;
  const orig = console.log;
  console.log = () => { called = true; };
  devLog('test message');
  console.log = orig;
  assert(called === false, 'Expected no console output in production');
});

test('devLog outputs in mock mode', () => {
  process.env.MOCK_MODE = 'true';
  let called = false;
  const orig = console.log;
  console.log = (...args) => {
    called = true;
    assert(args[0] === '[AI-GM Dev]', 'Expected dev prefix');
    assert(args[1] === 'test message', 'Expected message');
  };
  devLog('test message');
  console.log = orig;
  assert(called === true, 'Expected console output in mock mode');
  delete process.env.MOCK_MODE;
});

// --- devTimer ---
console.log('\n--- devTimer ---');

test('devTimer returns stub in production', () => {
  delete process.env.MOCK_MODE;
  process.env.NODE_ENV = 'production';
  const timer = devTimer('test');
  assert(typeof timer.end === 'function', 'Expected end method');
  timer.end();
});

test('devTimer measures time in mock mode', () => {
  process.env.MOCK_MODE = 'true';
  let called = false;
  const orig = console.log;
  console.log = (...args) => {
    called = true;
    assert(args[0].includes('[AI-GM Dev]'), 'Expected dev prefix');
    assert(args[0].includes('test:'), 'Expected label');
  };
  const timer = devTimer('test');
  timer.end();
  console.log = orig;
  assert(called === true, 'Expected console output in mock mode');
  delete process.env.MOCK_MODE;
});

// --- resetDevData ---
console.log('\n--- resetDevData ---');

test('resetDevData does nothing in production', () => {
  delete process.env.MOCK_MODE;
  process.env.NODE_ENV = 'production';
  const campaigns = new Map([['a', 1]]);
  const modules = new Map([['b', 2]]);
  resetDevData(campaigns, modules);
  assert(campaigns.size === 1, 'Expected campaigns unchanged');
  assert(modules.size === 1, 'Expected modules unchanged');
});

test('resetDevData clears data in mock mode', () => {
  process.env.MOCK_MODE = 'true';
  let called = false;
  const orig = console.log;
  console.log = (...args) => {
    called = true;
    assert(args[0].includes('[Dev] All campaign and module data reset'), 'Expected reset message');
  };
  const campaigns = new Map([['a', 1]]);
  const modules = new Map([['b', 2]]);
  resetDevData(campaigns, modules);
  console.log = orig;
  assert(campaigns.size === 0, 'Expected campaigns cleared');
  assert(modules.size === 0, 'Expected modules cleared');
  assert(called === true, 'Expected console output');
  delete process.env.MOCK_MODE;
});

// --- Exports verification ---
console.log('\n--- Exports verification ---');

test('MOCK_CAMPAIGN is exported', () => {
  assert(MOCK_CAMPAIGN.id === 'mock-campaign-001', 'Expected mock campaign export');
});

test('MOCK_MODULE is exported', () => {
  assert(MOCK_MODULE.id === 'arkham-night', 'Expected mock module export');
});

console.log(`\n=== Dev Mode Test Summary ===`);
console.log(`Total: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Status: ${failCount === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);

if (failCount > 0) process.exit(1);
