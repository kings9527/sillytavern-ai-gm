/**
 * AI-GM Extension 集成测试 — 验证 manifest.json 与 index.js 的匹配关系
 * 新增测试：Day 2 Engine Part 1 完整性验证
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');

function testManifestMatchesIndex() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf-8'));
  const indexSrc = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf-8');

  // manifest.js 必须指向 index.js
  assert.strictEqual(manifest.js, 'index.js', 'manifest.js 必须指向 index.js');

  // manifest.css 必须指向存在的 style.css
  assert.strictEqual(manifest.css, 'style.css', 'manifest.css 必须指向 style.css');
  assert.ok(fs.existsSync(path.join(ROOT, 'style.css')), 'style.css 必须存在');

  // manifest.hooks.activate 必须对应 index.js 中的 export init
  assert.strictEqual(manifest.hooks?.activate, 'init', 'hooks.activate 必须是 init');
  assert.ok(indexSrc.includes('export async function init'), 'index.js 必须 export init 函数');

  // index.js 必须包含 onEnable / onDisable
  assert.ok(indexSrc.includes('export async function onEnable'), 'index.js 必须 export onEnable');
  assert.ok(indexSrc.includes('export function onDisable'), 'index.js 必须 export onDisable');

  console.log('✅ manifest 与 index.js 一致性检查通过');
}

function testIndexImportsUImodules() {
  const indexSrc = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf-8');

  const requiredModules = [
    './ui/panel.js',
    './ui/npc-card.js',
    './ui/scene-renderer.js',
    './ui/game-controller.js',
  ];

  for (const mod of requiredModules) {
    assert.ok(
      indexSrc.includes(mod),
      `index.js 必须导入 ${mod}`
    );
  }

  console.log('✅ UI 模块导入检查通过');
}

function testIndexBindsSTEvents() {
  const indexSrc = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf-8');

  assert.ok(indexSrc.includes('eventSource.on'), 'index.js 必须使用 eventSource.on');
  assert.ok(indexSrc.includes('event_types.CHAT_CHANGED'), '必须绑定 CHAT_CHANGED');
  assert.ok(indexSrc.includes('event_types.CHARACTER_MESSAGE_RENDERED'), '必须绑定 CHARACTER_MESSAGE_RENDERED');
  assert.ok(indexSrc.includes('event_types.USER_MESSAGE_RENDERED'), '必须绑定 USER_MESSAGE_RENDERED');

  console.log('✅ ST 事件绑定检查通过');
}

function testIndexReferencesDOMTargets() {
  const indexSrc = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf-8');

  assert.ok(indexSrc.includes('extensionsMenu'), 'index.js 必须引用 extensionsMenu');
  assert.ok(indexSrc.includes('extensions_settings'), 'index.js 必须引用 extensions_settings');
  assert.ok(indexSrc.includes('-menu-btn'), '必须创建 menu-btn');
  assert.ok(indexSrc.includes('-settings-container'), '必须创建 settings-container');
  assert.ok(indexSrc.includes('-panel'), '必须创建 panel');
  assert.ok(indexSrc.includes('-npc'), '必须创建 npc');
  assert.ok(indexSrc.includes('-scene'), '必须创建 scene');
  assert.ok(indexSrc.includes('-status'), '必须创建 status');

  console.log('✅ DOM 目标引用检查通过');
}

function testExtensionSettingsIntegration() {
  const indexSrc = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf-8');

  assert.ok(indexSrc.includes('extension_settings'), 'index.js 必须引用 extension_settings');
  assert.ok(indexSrc.includes('saveSettingsDebounced'), 'index.js 必须引用 saveSettingsDebounced');
  assert.ok(indexSrc.includes('-enabled'), '必须包含 enabled 设置项');

  console.log('✅ 设置持久化集成检查通过');
}

// ---- 执行 ----
(() => {
  try {
    testManifestMatchesIndex();
    testIndexImportsUImodules();
    testIndexBindsSTEvents();
    testIndexReferencesDOMTargets();
    testExtensionSettingsIntegration();
    console.log('\n🎉 全部集成测试通过！');
  } catch (err) {
    console.error('\n❌ 集成测试失败:', err.message);
    process.exit(1);
  }
})();
