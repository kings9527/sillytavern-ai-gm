/**
 * AI-GM Extension Entry Test — 验证 ST Extension 挂载结构
 * 无需 ST 运行时，通过静态分析 + mock 环境验证
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

/* ---------- helpers ---------- */

function loadJson(path) {
  return JSON.parse(readFileSync(join(root, path), 'utf-8'));
}

function loadText(path) {
  return readFileSync(join(root, path), 'utf-8');
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAIL: ${msg}`);
}

function assertIncludes(haystack, needle, msg) {
  assert(haystack.includes(needle), `${msg} — missing: ${needle}`);
}

/* ---------- test manifest.json ---------- */

function testManifest() {
  const m = loadJson('manifest.json');

  assert(typeof m.display_name === 'string' && m.display_name.length > 0, 'manifest.display_name required');
  assert(typeof m.js === 'string' && m.js === 'index.js', 'manifest.js must be "index.js"');
  assert(typeof m.author === 'string' && m.author.length > 0, 'manifest.author required');
  assert(typeof m.version === 'string' && m.version.length > 0, 'manifest.version required');
  assert(typeof m.homePage === 'string' && m.homePage.startsWith('http'), 'manifest.homePage must be URL');
  assert(m.loading_order && typeof m.loading_order === 'number', 'manifest.loading_order must be number');
  assert(Array.isArray(m.requires), 'manifest.requires must be array');
  assert(Array.isArray(m.optional), 'manifest.optional must be array');
  assert(Array.isArray(m.dependencies), 'manifest.dependencies must be array');
  assert(m.hooks && typeof m.hooks.onEnable === 'string', 'manifest.hooks.onEnable required');
  assert(m.hooks && typeof m.hooks.onDisable === 'string', 'manifest.hooks.onDisable required');

  console.log('  ✓ manifest.json fields valid');
}

/* ---------- test index.js (static) ---------- */

function testExtensionEntry() {
  const code = loadText('index.js');

  // 必须导出生命周期钩子
  assertIncludes(code, 'export function onEnable', 'index.js must export onEnable');
  assertIncludes(code, 'export function onDisable', 'index.js must export onDisable');
  assertIncludes(code, 'export function init', 'index.js must export init');

  // 必须引用 ST 核心 API
  assertIncludes(code, "from '../../../../../../../script.js'", 'must import ST script.js');
  assertIncludes(code, "from '../../../../../../../extensions.js'", 'must import ST extensions.js');
  assertIncludes(code, 'eventSource', 'must use eventSource');
  assertIncludes(code, 'event_types', 'must use event_types');
  assertIncludes(code, 'extension_settings', 'must use extension_settings');

  // 必须挂载面板
  assertIncludes(code, 'extensions_menu', 'must target #extensions_menu');
  assertIncludes(code, 'ai-gm-toggle-btn', 'must create toggle button');
  assertIncludes(code, 'ai-gm-panel-container', 'must create panel container');
  assertIncludes(code, 'initPanel', 'must define initPanel');
  assertIncludes(code, 'destroyPanel', 'must define destroyPanel');

  // 必须连接事件
  assertIncludes(code, 'event_types.CHAT_CHANGED', 'must listen CHAT_CHANGED');
  assertIncludes(code, 'event_types.MESSAGE_RECEIVED', 'must listen MESSAGE_RECEIVED');
  assertIncludes(code, 'event_types.MESSAGE_SENT', 'must listen MESSAGE_SENT');

  // 必须加载 UI 子模块
  assertIncludes(code, './ui/panel.js', 'must load panel.js');
  assertIncludes(code, './ui/game-controller.js', 'must load game-controller.js');
  assertIncludes(code, 'AiGmPanel', 'must reference AiGmPanel');
  assertIncludes(code, 'AiGmGameController', 'must reference AiGmGameController');

  console.log('  ✓ index.js static structure valid');
}

/* ---------- test server.js preserved ---------- */

function testServerPreserved() {
  const code = loadText('server.js');
  assertIncludes(code, 'express', 'server.js must use express');
  assertIncludes(code, 'Router', 'server.js must use Router');
  assertIncludes(code, '/campaign/create', 'server.js must have /campaign/create');
  assertIncludes(code, '/api/plugins/ai-gm', 'server.js must reference ai-gm API');
  console.log('  ✓ server.js backend preserved');
}

/* ---------- test package.json updated ---------- */

function testPackageUpdated() {
  const pkg = loadJson('package.json');
  assert(pkg.main === 'server.js', 'package.json main must be server.js');
  console.log('  ✓ package.json main points to server.js');
}

/* ---------- runner ---------- */

function run() {
  console.log('AI-GM Extension Mount Test\n');
  const tests = [
    ['manifest.json', testManifest],
    ['extension entry', testExtensionEntry],
    ['server preserved', testServerPreserved],
    ['package updated', testPackageUpdated],
  ];

  let passed = 0;
  let failed = 0;

  for (const [name, fn] of tests) {
    try {
      fn();
      passed++;
    } catch (e) {
      console.error(`  ✗ ${name}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n${passed}/${tests.length} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
