// AI-GM Extension DOM Integration Test
// 验证 index.js 在模拟 ST 环境中正确挂载到 DOM

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { runInNewContext } from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

/* ---------- manifest.json 检查 ---------- */
function checkManifest() {
  const manifestPath = path.join(ROOT, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push('manifest.json 不存在');
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    errors.push(`manifest.json 解析失败: ${err.message}`);
    return;
  }

  if (!manifest.css) errors.push('manifest.json 缺少 css 字段');
  if (!manifest.js || manifest.js !== 'index.js') errors.push('manifest.json js 字段不正确');
  if (!manifest.hooks || !manifest.hooks.activate) errors.push('manifest.json 缺少 hooks.activate');
  if (manifest.hooks?.activate !== 'init') warnings.push(`hooks.activate = ${manifest.hooks?.activate}`);

  console.log('✅ manifest.json 字段检查通过');
}

/* ---------- DOM 挂载测试 ---------- */
async function testDomMount() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <div id="extensionsMenu"></div>
    <div id="extensions_settings"></div>
  </body></html>`);

  const mockEventSource = { events: {} };
  const mockEventTypes = {
    CHAT_CHANGED: 'chat_changed',
    CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
    USER_MESSAGE_RENDERED: 'user_message_rendered',
  };
  const mockContext = {
    chatId: 'test-campaign-123',
    name: 'Test Campaign',
    chat: [],
  };

  // 读取 index.js 并替换外部依赖为 mock
  let src = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf-8');

  src = src.replace(
    /import\s+\{\s*eventSource\s*,\s*event_types\s*,\s*saveSettingsDebounced\s*\}\s+from\s+['"][^'"]+['"]\s*;?/,
    `const eventSource = { on: (type, handler) => { mockEventSource.events[type] = handler; } }; ` +
    `const event_types = ${JSON.stringify(mockEventTypes)}; ` +
    `const saveSettingsDebounced = () => {};`
  );

  src = src.replace(
    /import\s+\{\s*getContext\s*,\s*renderExtensionTemplateAsync\s*,\s*extension_settings\s*\}\s+from\s+['"][^'"]+['"]\s*;?/,
    `const getContext = () => mockContext; ` +
    `const renderExtensionTemplateAsync = () => Promise.resolve(''); ` +
    `const extension_settings = {};`
  );

  // 移除 UI 模块静态导入（在 VM 中不需要实际文件）
  src = src.replace(/import\s+['"]\.\/ui\/[^'"]+['"]\s*;?/g, '');

  // 移除 export 关键字（VM 中直接声明）
  src = src.replace(/export\s+async\s+function\s+init/, 'async function init');
  src = src.replace(/export\s+function\s+onEnable/, 'function onEnable');
  src = src.replace(/export\s+function\s+onDisable/, 'function onDisable');

  // 构建执行上下文
  const context = {
    console,
    document: dom.window.document,
    window: {
      AiGmPanel: { initPanel: () => {}, updatePanel: () => {} },
      AiGmNpc: { initNpcContainer: () => {}, renderNpcs: () => {} },
      AiGmScene: { initSceneRenderer: () => {}, renderScene: () => {}, setAtmosphere: () => {} },
      AiGmGameController: { initGameController: () => {}, destroy: () => {} },
    },
    setTimeout,
    clearInterval,
    setInterval,
    clearTimeout,
    Date,
    JSON,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Promise,
    Error,
    CustomEvent: dom.window.CustomEvent,
    fetch: () => Promise.resolve({ ok: true, json: () => ({}) }),
    mockEventSource,
    mockContext,
  };

  try {
    runInNewContext(src, context);
  } catch (err) {
    errors.push(`index.js 执行失败: ${err.message}`);
    console.log('❌ index.js 执行失败:', err.message);
    return;
  }

  // 调用 init()
  try {
    await context.init();
    console.log('✅ init() 执行成功');
  } catch (err) {
    errors.push(`init() 执行失败: ${err.message}`);
    console.log('❌ init() 执行失败:', err.message);
    return;
  }

  // 验证 DOM 元素
  const doc = dom.window.document;
  const checks = [
    { id: 'ai-gm-menu-btn', name: '扩展菜单按钮' },
    { id: 'ai-gm-settings-container', name: '设置面板容器' },
    { id: 'ai-gm-panel', name: '游戏面板' },
    { id: 'ai-gm-npc', name: 'NPC 面板' },
    { id: 'ai-gm-scene', name: '场景面板' },
    { id: 'ai-gm-status', name: '状态面板' },
    { id: 'ai-gm-enabled', name: '启用复选框' },
    { id: 'ai-gm-api-url', name: 'API URL 输入' },
    { id: 'ai-gm-start-btn', name: '启动按钮' },
  ];

  for (const check of checks) {
    const el = doc.getElementById(check.id);
    if (!el) {
      errors.push(`${check.name} (#${check.id}) 未创建`);
    } else {
      console.log(`✅ ${check.name} (#${check.id}) 已创建`);
    }
  }

  // 验证事件绑定
  if (mockEventSource.events['chat_changed']) {
    console.log('✅ CHAT_CHANGED 事件已绑定');
  } else {
    errors.push('CHAT_CHANGED 事件未绑定');
  }

  if (mockEventSource.events['character_message_rendered']) {
    console.log('✅ CHARACTER_MESSAGE_RENDERED 事件已绑定');
  } else {
    errors.push('CHARACTER_MESSAGE_RENDERED 事件未绑定');
  }

  if (mockEventSource.events['user_message_rendered']) {
    console.log('✅ USER_MESSAGE_RENDERED 事件已绑定');
  } else {
    errors.push('USER_MESSAGE_RENDERED 事件未绑定');
  }
}

/* ---------- 运行 ---------- */
function run() {
  console.log('=== AI-GM Extension DOM Integration Test ===\n');
  checkManifest();
  testDomMount().then(() => {
    console.log('\n--- 结果 ---');
    if (errors.length === 0) {
      console.log('✅ 所有检查通过');
    } else {
      console.log(`❌ 发现 ${errors.length} 个错误:`);
      errors.forEach(e => console.log(`  - ${e}`));
    }
    if (warnings.length > 0) {
      console.log(`⚠️  发现 ${warnings.length} 个警告:`);
      warnings.forEach(w => console.log(`  - ${w}`));
    }
    process.exit(errors.length > 0 ? 1 : 0);
  }).catch(err => {
    console.error('测试运行异常:', err);
    process.exit(1);
  });
}

run();
