// Test: AI-GM Extension Mount — Phase 2 Engine
// Validates manifest.json and index.js structure for ST Extension compatibility

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'manifest.json');
const INDEX = path.join(ROOT, 'index.js');
const STYLE = path.join(ROOT, 'style.css');

const errors = [];
const warnings = [];

function checkManifest() {
  if (!fs.existsSync(MANIFEST)) {
    errors.push('manifest.json 不存在');
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
  } catch (err) {
    errors.push(`manifest.json 解析失败: ${err.message}`);
    return;
  }

  const required = ['display_name', 'js', 'loading_order'];
  for (const key of required) {
    if (!manifest[key]) {
      errors.push(`manifest.json 缺少必填字段: ${key}`);
    }
  }

  if (manifest.js !== 'index.js') {
    warnings.push(`manifest.js = ${manifest.js} (推荐 'index.js')`);
  }

  if (!manifest.css) {
    warnings.push('manifest.json 缺少 css 字段');
  }

  if (!manifest.hooks || !manifest.hooks.activate) {
    errors.push('manifest.json 缺少 hooks.activate（ST 加载扩展时调用）');
  } else if (manifest.hooks.activate !== 'init') {
    warnings.push(`hooks.activate = ${manifest.hooks.activate} (推荐 'init')`);
  }

  if (!manifest.display_name) {
    errors.push('manifest.json 缺少 display_name');
  }

  console.log('✅ manifest.json 检查通过');
}

function checkIndex() {
  if (!fs.existsSync(INDEX)) {
    errors.push('index.js 不存在');
    return;
  }

  const src = fs.readFileSync(INDEX, 'utf-8');

  // 检查导出 init 函数
  if (!src.includes('export async function init')) {
    errors.push('index.js 缺少 export async function init()');
  }

  // 检查 ST API 导入
  const requiredImports = [
    { pattern: /from\s+['"]\.\.\/\.\.\/\.\.\/\.\.\/script\.js['"]/, name: 'script.js' },
    { pattern: /from\s+['"]\.\.\/\.\.\/\.\.\/extensions\.js['"]/, name: 'extensions.js' },
  ];
  for (const imp of requiredImports) {
    if (!imp.pattern.test(src)) {
      warnings.push(`index.js 可能缺少从 ${imp.name} 的导入`);
    }
  }

  // 检查事件绑定
  if (!src.includes('eventSource.on')) {
    errors.push('index.js 缺少 eventSource.on 事件绑定');
  }
  if (!src.includes('event_types.CHAT_CHANGED')) {
    warnings.push('index.js 未绑定 CHAT_CHANGED 事件');
  }
  if (!src.includes('event_types.CHARACTER_MESSAGE_RENDERED')) {
    warnings.push('index.js 未绑定 CHARACTER_MESSAGE_RENDERED 事件');
  }
  if (!src.includes('event_types.USER_MESSAGE_RENDERED')) {
    warnings.push('index.js 未绑定 USER_MESSAGE_RENDERED 事件');
  }

  // 检查 UI 挂载
  if (!src.includes('extensionsMenu')) {
    errors.push('index.js 未引用 #extensionsMenu（ST 扩展菜单）');
  }
  if (!src.includes('extensions_settings')) {
    errors.push('index.js 未引用 #extensions_settings（ST 扩展设置面板）');
  }

  // 检查 UI 模块加载
  if (!src.includes('ui/panel.js')) {
    warnings.push('index.js 未加载 ui/panel.js');
  }
  if (!src.includes('ui/npc-card.js')) {
    warnings.push('index.js 未加载 ui/npc-card.js');
  }
  if (!src.includes('ui/scene-renderer.js')) {
    warnings.push('index.js 未加载 ui/scene-renderer.js');
  }
  if (!src.includes('ui/game-controller.js')) {
    warnings.push('index.js 未加载 ui/game-controller.js');
  }

  console.log('✅ index.js 检查通过');
}

function checkStyle() {
  if (!fs.existsSync(STYLE)) {
    warnings.push('style.css 不存在（manifest 引用了 css）');
  } else {
    console.log('✅ style.css 存在');
  }
}

function run() {
  console.log('=== AI-GM Extension Mount Test ===\n');

  checkManifest();
  checkIndex();
  checkStyle();

  console.log('\n--- 结果 ---');
  if (errors.length === 0) {
    console.log('✅ 所有关键检查通过');
  } else {
    console.log(`❌ 发现 ${errors.length} 个错误:`);
    errors.forEach(e => console.log(`  - ${e}`));
  }
  if (warnings.length > 0) {
    console.log(`⚠️  发现 ${warnings.length} 个警告:`);
    warnings.forEach(w => console.log(`  - ${w}`));
  }

  if (errors.length > 0) {
    process.exit(1);
  }
}

run();
