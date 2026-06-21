/**
 * Dev-mode & ST Chat Bridge Smoke Tests
 * Basic coverage for dev utilities and chat bridge core
 */

import { MOCK_CAMPAIGN, MOCK_MODULE, createMockCampaign, createMockModule, isMockMode, devLog, devTimer, resetDevData } from '../utils/dev-mode.js';
import { STChatBridge } from '../utils/st-chat-bridge.js';

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

console.log('=== Dev-mode & STChatBridge Smoke Tests ===\n');

// ====== dev-mode exports ======
console.log('--- dev-mode exports ---');

test('MOCK_CAMPAIGN has required fields', () => {
  assert(MOCK_CAMPAIGN.id, 'should have id');
  assert(MOCK_CAMPAIGN.player, 'should have player');
  assert(MOCK_CAMPAIGN.player.name, 'player should have name');
  assert(Array.isArray(MOCK_CAMPAIGN.player.inventory), 'inventory should be array');
});

test('MOCK_MODULE has required fields', () => {
  assert(MOCK_MODULE.id, 'should have id');
  assert(MOCK_MODULE.scenes, 'should have scenes');
  assert(MOCK_MODULE.scenes.library, 'should have library scene');
});

test('createMockCampaign returns valid campaign', () => {
  const campaign = createMockCampaign();
  assert(campaign.id, 'should have id');
  assert(campaign.player, 'should have player');
});

test('createMockModule returns valid module', () => {
  const mod = createMockModule();
  assert(mod.id, 'should have id');
  assert(mod.scenes, 'should have scenes');
});

test('isMockMode returns boolean', () => {
  const val = isMockMode();
  assert(typeof val === 'boolean', 'should be boolean');
});

test('devLog does not throw', () => {
  devLog('test message');
  assert(true, 'devLog ran without error');
});

test('devTimer returns object with end method', () => {
  const timer = devTimer('test');
  assert(typeof timer.end === 'function', 'should have end method');
  timer.end();
});

test('resetDevData does not throw', () => {
  const campaigns = new Map();
  const modules = new Map();
  resetDevData(campaigns, modules);
  assert(true, 'resetDevData ran without error');
});

// ====== STChatBridge core ======
console.log('\n--- STChatBridge core ---');

test('STChatBridge constructor sets defaults', () => {
  const bridge = new STChatBridge(null);
  assert(bridge.maxContextMessages === 20, 'default maxContextMessages 20');
  assert(bridge.autoParse === true, 'default autoParse true');
  assert(bridge.injectToChat === false, 'default injectToChat false');
  assert(bridge.isEnabled === false, 'initially disabled');
});

test('STChatBridge constructor accepts options', () => {
  const bridge = new STChatBridge(null, { maxContextMessages: 10, autoParse: false, injectToChat: true });
  assert(bridge.maxContextMessages === 10, 'custom maxContextMessages');
  assert(bridge.autoParse === false, 'custom autoParse');
  assert(bridge.injectToChat === true, 'custom injectToChat');
});

test('STChatBridge start enables bridge', () => {
  const bridge = new STChatBridge(null);
  bridge.start();
  assert(bridge.isEnabled === true, 'should be enabled after start');
});

test('STChatBridge stop disables and clears cache', () => {
  const bridge = new STChatBridge(null);
  bridge.start();
  bridge.messageCache.push({ role: 'user', text: 'test' });
  bridge.stop();
  assert(bridge.isEnabled === false, 'should be disabled');
  assert(bridge.messageCache.length === 0, 'cache should be cleared');
});

test('STChatBridge onUserMessage does nothing when disabled', () => {
  const bridge = new STChatBridge(null);
  bridge.stop();
  const result = bridge.onUserMessage(1, 'hello');
  assert(result === undefined, 'should return undefined when disabled');
});

test('STChatBridge onUserMessage does nothing without gameController', () => {
  const bridge = new STChatBridge(null);
  bridge.start();
  const result = bridge.onUserMessage(1, 'hello');
  assert(result === undefined, 'should return undefined without gameController');
});

test('STChatBridge onCharacterMessage does nothing when disabled', () => {
  const bridge = new STChatBridge(null);
  bridge.stop();
  const result = bridge.onCharacterMessage(1, 'hello');
  assert(result === undefined, 'should return undefined when disabled');
});

test('STChatBridge getContext returns empty when disabled', () => {
  const bridge = new STChatBridge(null);
  bridge.stop();
  const ctx = bridge.getContext();
  assert(ctx.length === 0, 'should return empty array');
});

test('STChatBridge getContext returns cached messages when enabled', () => {
  const bridge = new STChatBridge(null);
  bridge.start();
  bridge.messageCache = [{ role: 'user', text: 'hi' }, { role: 'gm', text: 'hello' }];
  const ctx = bridge.getContext();
  assert(ctx.length === 2, 'should return 2 messages');
});

test('STChatBridge getContext respects maxContextMessages', () => {
  const bridge = new STChatBridge(null, { maxContextMessages: 2 });
  bridge.start();
  bridge.messageCache = [
    { role: 'user', text: '1' },
    { role: 'user', text: '2' },
    { role: 'user', text: '3' },
  ];
  const ctx = bridge.getContext();
  assert(ctx.length === 2, 'should return at most 2');
  assert(ctx[0].text === '2', 'should return last 2');
});

test('STChatBridge clearCache empties message cache', () => {
  const bridge = new STChatBridge(null);
  bridge.start();
  bridge.messageCache = [{ role: 'user', text: 'test' }];
  bridge.clearCache();
  assert(bridge.messageCache.length === 0, 'cache should be empty');
});

// ====== Summary ======
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
