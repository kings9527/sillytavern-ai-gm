/**
 * AI-GM Extension 挂载测试 — Day 2 Engine Part 1
 * 验证 index.js 的 ESM 导出、init 调用流程、DOM 结构创建
 */

const { JSDOM } = require('jsdom');
const assert = require('assert');

// ---- 构建最小 DOM 环境 ----
const dom = new JSDOM(
  `<!DOCTYPE html>
<html>
<body>
  <div id="extensionsMenu"></div>
  <div id="extensions_settings"></div>
</body>
</html>`,
  { runScripts: 'dangerously', url: 'http://localhost' },
);

global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;

// ---- 模拟 ST 全局模块 ----
const mockEventListeners = new Map();
const mockEventSource = {
  on: (event, handler) => {
    if (!mockEventListeners.has(event)) mockEventListeners.set(event, []);
    mockEventListeners.get(event).push(handler);
  },
  emit: (event, ...args) => {
    (mockEventListeners.get(event) || []).forEach((h) => h(...args));
  },
};

const mockEventTypes = {
  CHAT_CHANGED: 'chat_changed',
  CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
  USER_MESSAGE_RENDERED: 'user_message_rendered',
};

let settingsSaved = false;
const mockSaveSettingsDebounced = () => {
  settingsSaved = true;
};

const mockExtensionSettings = {};
const mockGetContext = () => ({ chatId: 'test-chat-123', name: 'TestChar' });

// 将模拟模块挂载到 window，供 index.js 在 ESM 中引用
// 注意：真实 ST 环境是通过 import 解析的，这里用简单 mock 验证逻辑导出
global.window.eventSource = mockEventSource;
global.window.event_types = mockEventTypes;
global.window.saveSettingsDebounced = mockSaveSettingsDebounced;
global.window.extension_settings = mockExtensionSettings;
global.window.getContext = mockGetContext;
global.window.renderExtensionTemplateAsync = async () => '<div>mock</div>';

// 模拟 UI 组件挂载到 window（index.js 会检查这些全局对象）
global.window.AiGmPanel = {
  initPanel: (container) => {
    container.innerHTML = '<div class="mock-panel">PANEL</div>';
  },
  updatePanel: () => {},
};
global.window.AiGmNpc = {
  initNpcContainer: () => {},
  renderNpcs: () => {},
  updateNpcState: () => {},
};
global.window.AiGmScene = {
  initSceneRenderer: () => {},
  renderScene: () => {},
  setAtmosphere: () => {},
};
global.window.AiGmGameController = {
  initGameController: () => {},
  destroy: () => {},
  refreshState: () => {},
  handleAction: () => {},
  syncToUI: () => {},
};

// ---- 加载被测模块（模拟 ESM 导出） ----
// 由于 Node.js 不直接支持 ESM 中相对路径 import ST 模块，我们直接 eval index.js 内容并注入全局变量
const fs = require('fs');
const path = require('path');
const indexPath = path.join(__dirname, '..', 'index.js');
const indexCode = fs.readFileSync(indexPath, 'utf-8');

// 替换所有 import/export 语句，使代码能在 Node 执行
const patchedCode = indexCode
  .replace(/import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?\n?/g, '')
  .replace(/import\s+['"][^'"]+['"];?\n?/g, '')
  .replace(/export\s+/g, '');

// 将 index.js 作为函数执行，提取导出
const moduleExports = {};
const wrapped = new Function(
  'exports',
  'document',
  'window',
  'eventSource',
  'event_types',
  'saveSettingsDebounced',
  'getContext',
  'renderExtensionTemplateAsync',
  'extension_settings',
  patchedCode + '\nreturn { init, onEnable, onDisable };',
);
const exported = wrapped(
  moduleExports,
  global.document,
  global.window,
  mockEventSource,
  mockEventTypes,
  mockSaveSettingsDebounced,
  mockGetContext,
  global.window.renderExtensionTemplateAsync,
  mockExtensionSettings,
);

const { init, onEnable, onDisable } = exported;

// ---- 测试用例 ----

function testExports() {
  assert.strictEqual(typeof init, 'function', 'init 必须是函数');
  assert.strictEqual(typeof onEnable, 'function', 'onEnable 必须是函数');
  assert.strictEqual(typeof onDisable, 'function', 'onDisable 必须是函数');
  console.log('✅ ESM 导出检查通过');
}

async function testInitCreatesButton() {
  await init();
  const btn = document.getElementById('ai-gm-menu-btn');
  assert.ok(btn, '必须在 #extensionsMenu 中创建 AI-GM 按钮');
  assert.ok(btn.querySelector('.fa-gamepad'), '按钮必须包含 gamepad 图标');
  assert.ok(btn.textContent.includes('AI-GM'), '按钮文本必须包含 AI-GM');
  console.log('✅ 工具栏按钮创建通过');
}

async function testInitCreatesPanel() {
  const container = document.getElementById('ai-gm-settings-container');
  assert.ok(container, '必须创建 #ai-gm-settings-container');
  assert.ok(container.querySelector('.inline-drawer'), '必须包含 inline-drawer 结构');
  assert.ok(document.getElementById('ai-gm-panel'), '必须包含 #ai-gm-panel');
  assert.ok(document.getElementById('ai-gm-npc'), '必须包含 #ai-gm-npc');
  assert.ok(document.getElementById('ai-gm-scene'), '必须包含 #ai-gm-scene');
  assert.ok(document.getElementById('ai-gm-status'), '必须包含 #ai-gm-status');
  console.log('✅ 设置面板创建通过');
}

function testEventBindings() {
  assert.strictEqual(
    mockEventListeners.has(mockEventTypes.CHAT_CHANGED),
    true,
    '必须绑定 CHAT_CHANGED',
  );
  assert.strictEqual(
    mockEventListeners.has(mockEventTypes.CHARACTER_MESSAGE_RENDERED),
    true,
    '必须绑定 CHARACTER_MESSAGE_RENDERED',
  );
  assert.strictEqual(
    mockEventListeners.has(mockEventTypes.USER_MESSAGE_RENDERED),
    true,
    '必须绑定 USER_MESSAGE_RENDERED',
  );
  console.log('✅ ST 事件绑定通过');
}

function testTogglePanel() {
  const btn = document.getElementById('ai-gm-menu-btn');
  assert.ok(btn, '按钮必须存在才能点击');
  // 模拟点击展开面板
  btn.click();
  const content = document.querySelector('.inline-drawer-content');
  assert.strictEqual(content.style.display, 'block', '点击后面板必须展开');
  console.log('✅ 面板展开/收起通过');
}

function testSettingsPersistence() {
  const checkbox = document.getElementById('ai-gm-enabled');
  assert.ok(checkbox, '启用复选框必须存在');
  // 默认应为选中（defaultSettings.enabled = true）
  assert.strictEqual(checkbox.checked, true, '默认必须启用');
  console.log('✅ 设置持久化检查通过');
}

function testOnDisableCleanup() {
  onDisable();
  // onDisable 会销毁 gameController，但此处 gameController 是 null，不应报错
  console.log('✅ onDisable 清理逻辑通过');
}

// ---- 执行 ----
(async () => {
  try {
    testExports();
    await testInitCreatesButton();
    await testInitCreatesPanel();
    testEventBindings();
    testTogglePanel();
    testSettingsPersistence();
    testOnDisableCleanup();
    console.log('\n🎉 全部 Day-2 挂载测试通过！');
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
