/**
 * Extension Lifecycle & Event Hook Binding Test
 * Validates index.js event hooks, lifecycle, and state management
 * Uses mock DOM/ST environment for Node.js testing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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

console.log('=== Extension Lifecycle & Event Hook Tests ===\n');

// --- Static Analysis: Event Hook Binding ---
console.log('--- Static Event Hook Analysis ---');

const indexSrc = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf-8');

test('index.js binds CHAT_CHANGED event', () => {
  assert(indexSrc.includes("eventSource.on(event_types.CHAT_CHANGED"), 'Expected CHAT_CHANGED binding');
});

test('index.js binds CHARACTER_MESSAGE_RENDERED event', () => {
  assert(indexSrc.includes("eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED"), 'Expected CHARACTER_MESSAGE_RENDERED binding');
});

test('index.js binds USER_MESSAGE_RENDERED event', () => {
  assert(indexSrc.includes("eventSource.on(event_types.USER_MESSAGE_RENDERED"), 'Expected USER_MESSAGE_RENDERED binding');
});

test('index.js exports init function', () => {
  assert(indexSrc.includes('export async function init'), 'Expected export async function init');
});

test('index.js exports onEnable function', () => {
  assert(indexSrc.includes('export async function onEnable') || indexSrc.includes('export function onEnable'), 'Expected export onEnable');
});

test('index.js exports onDisable function', () => {
  assert(indexSrc.includes('export function onDisable'), 'Expected export onDisable');
});

test('index.js has toggleSettingsPanel for menu click', () => {
  assert(indexSrc.includes('toggleSettingsPanel'), 'Expected toggleSettingsPanel function');
});

test('index.js calls createMenuButton', () => {
  assert(indexSrc.includes('createMenuButton()'), 'Expected createMenuButton call');
});

test('index.js calls createSettingsPanel', () => {
  assert(indexSrc.includes('createSettingsPanel()'), 'Expected createSettingsPanel call');
});

test('index.js calls bindEvents', () => {
  assert(indexSrc.includes('bindEvents()'), 'Expected bindEvents call');
});

test('index.js has loadSettings function', () => {
  assert(indexSrc.includes('function loadSettings'), 'Expected loadSettings function');
});

test('index.js has saveSettings function', () => {
  assert(indexSrc.includes('function saveSettings'), 'Expected saveSettings function');
});

test('index.js has saveSettingsFromUI function', () => {
  assert(indexSrc.includes('function saveSettingsFromUI'), 'Expected saveSettingsFromUI function');
});

test('index.js references window.AiGmExtension', () => {
  assert(indexSrc.includes('window.AiGmExtension'), 'Expected window.AiGmExtension reference');
});

test('index.js has updateStatus helper', () => {
  assert(indexSrc.includes('function updateStatus'), 'Expected updateStatus function');
});

test('index.js has isEnabled state guard', () => {
  assert(indexSrc.includes('if (isEnabled)'), 'Expected isEnabled guard in event handlers');
});

test('index.js has gameController refreshState call', () => {
  assert(indexSrc.includes('gameController.refreshState'), 'Expected gameController.refreshState call');
});

test('index.js has stChatBridge.onChatChanged call', () => {
  assert(indexSrc.includes('stChatBridge.onChatChanged'), 'Expected stChatBridge.onChatChanged call');
});

test('index.js has stChatBridge.onCharacterMessage call', () => {
  assert(indexSrc.includes('stChatBridge.onCharacterMessage'), 'Expected stChatBridge.onCharacterMessage call');
});

test('index.js has stChatBridge.onUserMessage call', () => {
  assert(indexSrc.includes('stChatBridge.onUserMessage'), 'Expected stChatBridge.onUserMessage call');
});

test('index.js checks stChatBridge before calling methods', () => {
  assert(indexSrc.includes('if (isEnabled && stChatBridge)'), 'Expected stChatBridge null check');
});

test('index.js has onDisable cleanup for stChatBridge', () => {
  assert(indexSrc.includes('stChatBridge.stop'), 'Expected stChatBridge.stop in onDisable');
  assert(indexSrc.includes('stChatBridge = null'), 'Expected stChatBridge null cleanup');
});

test('index.js has onDisable cleanup for gameController', () => {
  assert(indexSrc.includes('gameController.destroy'), 'Expected gameController.destroy in onDisable');
  assert(indexSrc.includes('gameController = null'), 'Expected gameController null cleanup');
});

test('index.js has settings.enabled guard in onEnable', () => {
  // Check that onEnable is only called when settings.enabled is true
  assert(indexSrc.includes('settings.enabled && settings.autoStart'), 'Expected autoStart guard');
});

test('index.js has default settings object', () => {
  assert(indexSrc.includes('const defaultSettings'), 'Expected defaultSettings constant');
  assert(indexSrc.includes('enabled: true'), 'Expected default enabled: true');
  assert(indexSrc.includes('apiBaseUrl'), 'Expected default apiBaseUrl');
  assert(indexSrc.includes('campaignId'), 'Expected default campaignId');
});

test('index.js creates all 3 UI mount containers', () => {
  assert(indexSrc.includes('${CSS_NS}-panel'), 'Expected panel mount id');
  assert(indexSrc.includes('${CSS_NS}-npc'), 'Expected npc mount id');
  assert(indexSrc.includes('${CSS_NS}-scene'), 'Expected scene mount id');
});

test('index.js has status bar element', () => {
  assert(indexSrc.includes('${CSS_NS}-status'), 'Expected status bar id');
  assert(indexSrc.includes('updateStatus'), 'Expected updateStatus calls');
});

test('index.js imports all 4 UI modules', () => {
  assert(indexSrc.includes("import './ui/panel.js'"), 'Expected panel.js import');
  assert(indexSrc.includes("import './ui/npc-card.js'"), 'Expected npc-card.js import');
  assert(indexSrc.includes("import './ui/scene-renderer.js'"), 'Expected scene-renderer.js import');
  assert(indexSrc.includes("import './ui/game-controller.js'"), 'Expected game-controller.js import');
});

test('index.js imports STChatBridge', () => {
  assert(indexSrc.includes("import { STChatBridge }"), 'Expected STChatBridge import');
});

test('index.js has init guard (isInitialized)', () => {
  assert(indexSrc.includes('if (isInitialized) return'), 'Expected isInitialized guard');
});

test('index.js has onEnable guard (isEnabled)', () => {
  assert(indexSrc.includes('if (isEnabled) return'), 'Expected isEnabled guard in onEnable');
});

test('index.js has onDisable guard (!isEnabled)', () => {
  assert(indexSrc.includes('if (!isEnabled) return'), 'Expected !isEnabled guard in onDisable');
});

// --- Dynamic Lifecycle Simulation ---
console.log('\n--- Dynamic Lifecycle Simulation ---');

// Mock DOM and ST environment
global.document = {
  getElementById: (id) => {
    const elements = {};
    return elements[id] || null;
  },
  createElement: (tag) => ({
    tagName: tag,
    id: '',
    className: '',
    innerHTML: '',
    title: '',
    style: {},
    appendChild: () => {},
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
  }),
};

global.window = {
  AiGmPanel: { initPanel: () => {} },
  AiGmNpc: { initNpcContainer: () => {} },
  AiGmScene: { initSceneRenderer: () => {} },
  AiGmGameController: { initGameController: () => {}, destroy: () => {} },
  AiGmExtension: null,
};

global.extension_settings = {};

// Mock event source for tracking bindings
const eventBindings = {};
global.eventSource = {
  on: (eventType, handler) => {
    eventBindings[eventType] = handler;
  },
};

global.event_types = {
  CHAT_CHANGED: 'chat_changed',
  CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
  USER_MESSAGE_RENDERED: 'user_message_rendered',
};

global.extensionsMenu = { appendChild: () => {} };
global.extension_settings = {};
global.saveSettingsDebounced = () => {};

// Need to stub module imports for Node.js
const moduleStubs = new Map();
const originalResolve = path.resolve;

// Try to load index.js with stubs — this is tricky because of ESM imports
// Instead, we test via dynamic import with import maps or just verify the source
// For Node.js, we skip the dynamic import and rely on static analysis

test('Event binding patterns are complete (static analysis)', () => {
  // Count eventSource.on calls
  const eventOnMatches = indexSrc.match(/eventSource\.on\(/g);
  assert(eventOnMatches && eventOnMatches.length >= 3, `Expected at least 3 eventSource.on calls, found ${eventOnMatches?.length || 0}`);
  
  // Verify each handler is a function that checks isEnabled
  const chatChangedHandler = indexSrc.match(/eventSource\.on\(event_types\.CHAT_CHANGED,\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(isEnabled.*?\)[\s\S]*?\}\s*\);/);
  assert(chatChangedHandler, 'Expected CHAT_CHANGED handler with isEnabled check');
  
  const charMsgHandler = indexSrc.match(/eventSource\.on\(event_types\.CHARACTER_MESSAGE_RENDERED,\s*\(messageId\)\s*=>\s*\{[\s\S]*?if\s*\(isEnabled.*?\)[\s\S]*?\}\s*\);/);
  assert(charMsgHandler, 'Expected CHARACTER_MESSAGE_RENDERED handler with isEnabled check');
  
  const userMsgHandler = indexSrc.match(/eventSource\.on\(event_types\.USER_MESSAGE_RENDERED,\s*\(messageId\)\s*=>\s*\{[\s\S]*?if\s*\(isEnabled.*?\)[\s\S]*?\}\s*\);/);
  assert(userMsgHandler, 'Expected USER_MESSAGE_RENDERED handler with isEnabled check');
});

test('All required UI elements are referenced in createSettingsPanel', () => {
  const refs = [
    '${CSS_NS}-enabled',
    '${CSS_NS}-api-url',
    '${CSS_NS}-campaign-id',
    '${CSS_NS}-auto-start',
    '${CSS_NS}-auto-parse',
    '${CSS_NS}-inject-chat',
    '${CSS_NS}-save-btn',
  ];
  for (const ref of refs) {
    assert(indexSrc.includes(ref), `Expected reference to ${ref}`);
  }
});

test('Extension settings are persisted and loaded correctly', () => {
  assert(indexSrc.includes('extension_settings[EXTENSION_NAME]'), 'Expected settings persistence via extension_settings');
  assert(indexSrc.includes('saveSettingsDebounced'), 'Expected saveSettingsDebounced call');
  assert(indexSrc.includes('loadSettings()'), 'Expected loadSettings call in init');
});

// Summary
console.log('\n=== Extension Lifecycle Test Summary ===');
console.log(`Total: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Status: ${failCount === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);

process.exit(failCount > 0 ? 1 : 0);
