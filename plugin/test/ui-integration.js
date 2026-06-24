#!/usr/bin/env node
/**
 * Test: UI Components Integration — Phase 3 Surface
 * Validates all 4 UI modules export correctly and GameController can resolve them
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = path.resolve(__dirname, '../ui');

const errors = [];
const warnings = [];

const expectedModules = [
  { file: 'panel.js', exports: ['initPanel', 'updatePanel', 'appendLog', 'clearLog'] },
  { file: 'npc-card.js', exports: ['initNpcContainer', 'renderNpcs', 'updateNpcState'] },
  { file: 'scene-renderer.js', exports: ['initSceneRenderer', 'renderScene', 'setAtmosphere'] },
  { file: 'game-controller.js', exports: ['initGameController', 'destroy', 'getStatus'] },
];

function checkFileExists(file) {
  const p = path.join(UI_DIR, file);
  if (!fs.existsSync(p)) {
    errors.push(`${file} 不存在`);
    return null;
  }
  return fs.readFileSync(p, 'utf-8');
}

function checkExports(src, file, expected) {
  if (!src) return;

  // Check window assignment pattern: window.AiGmXxx = { ... }
  const windowMatch = src.match(/window\.AiGm\w+\s*=\s*\{([^}]+)\}/);
  if (!windowMatch) {
    warnings.push(`${file} 未使用 window.AiGmXxx = { ... } 模式导出`);
  }

  // Check each expected export is in the file
  for (const exp of expected) {
    if (!src.includes(exp)) {
      errors.push(`${file} 缺少导出: ${exp}`);
    }
  }

  // Check for global window assignment
  if (!src.includes('window.AiGm')) {
    errors.push(`${file} 未挂载到 window 全局对象`);
  }
}

function checkGameControllerDependencies() {
  const src = checkFileExists('game-controller.js');
  if (!src) return;

  const deps = [
    { name: 'Panel', pattern: /window\.AiGmPanel|const Panel/ },
    { name: 'Npc', pattern: /window\.AiGmNpc|const Npc/ },
    { name: 'Scene', pattern: /window\.AiGmScene|const Scene/ },
  ];

  for (const dep of deps) {
    if (!dep.pattern.test(src)) {
      errors.push(`game-controller.js 未引用 ${dep.name} 依赖`);
    }
  }

  // Check it calls init methods
  const initCalls = ['initPanel', 'initNpcContainer', 'initSceneRenderer'];
  for (const call of initCalls) {
    if (!src.includes(call)) {
      warnings.push(`game-controller.js 未调用 ${call}()`);
    }
  }
}

function run() {
  console.log('=== UI Components Integration Test ===\n');

  for (const mod of expectedModules) {
    const src = checkFileExists(mod.file);
    if (src) {
      checkExports(src, mod.file, mod.exports);
      console.log(`✅ ${mod.file} 存在，导出检查完成`);
    }
  }

  checkGameControllerDependencies();
  console.log('✅ game-controller.js 依赖检查完成');

  console.log('\n--- 结果 ---');
  if (errors.length === 0) {
    console.log('✅ 所有关键检查通过');
  } else {
    console.log(`❌ 发现 ${errors.length} 个错误:`);
    errors.forEach((e) => console.log(`  - ${e}`));
  }
  if (warnings.length > 0) {
    console.log(`⚠️  发现 ${warnings.length} 个警告:`);
    warnings.forEach((w) => console.log(`  - ${w}`));
  }

  if (errors.length > 0) {
    process.exit(1);
  }
}

run();
