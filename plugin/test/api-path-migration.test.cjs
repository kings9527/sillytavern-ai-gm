/**
 * AI-GM API Path 迁移测试 — 验证 mock URL 移除与 ST 后端路径集成
 * 对应任务: Day 2 Engine Part 2 — 使用 ST 实际后端地址 /api/ai-gm/*
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const UI_DIR = path.join(ROOT, 'ui');

function testIndexJsDefaultApiPath() {
  const indexSrc = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf-8');

  // 1. defaultSettings 中 apiBaseUrl 必须为 /api/ai-gm，不能有 localhost:3001
  assert.ok(
    indexSrc.includes("apiBaseUrl: '/api/ai-gm'"),
    'index.js defaultSettings.apiBaseUrl 必须是 /api/ai-gm'
  );
  assert.ok(
    !indexSrc.includes("localhost:3001"),
    'index.js 不应再包含 localhost:3001 mock URL'
  );

  // 2. placeholder 也应更新
  assert.ok(
    indexSrc.includes("placeholder=\"/api/ai-gm\""),
    'index.js 输入框 placeholder 应为 /api/ai-gm'
  );

  console.log('✅ index.js API 路径默认配置检查通过');
}

function testGameControllerDefaults() {
  const gcSrc = fs.readFileSync(path.join(UI_DIR, 'game-controller.js'), 'utf-8');

  // 1. 必须存在 DEFAULT_API_BASE 常量且值为 /api/ai-gm
  assert.ok(
    gcSrc.includes("const DEFAULT_API_BASE = '/api/ai-gm'"),
    'game-controller.js 必须定义 DEFAULT_API_BASE = \'/api/ai-gm\''
  );

  // 2. 必须存在 DEFAULT_CAMPAIGN 默认战役 ID
  assert.ok(
    gcSrc.includes("const DEFAULT_CAMPAIGN = 'default'"),
    'game-controller.js 必须定义 DEFAULT_CAMPAIGN'
  );

  // 3. initGameController 中必须有 fallback 逻辑
  assert.ok(
    gcSrc.includes('apiBaseUrl = apiBaseUrl || DEFAULT_API_BASE') || gcSrc.includes('apiBaseUrl || DEFAULT_API_BASE'),
    'game-controller.js initGameController 必须对 apiBaseUrl 提供默认值'
  );

  // 4. 不应再包含 localhost:3001
  assert.ok(
    !gcSrc.includes('localhost:3001'),
    'game-controller.js 不应包含 localhost:3001 mock URL'
  );

  console.log('✅ game-controller.js 默认值与 fallback 检查通过');
}

function testApiPathConstruction() {
  const gcSrc = fs.readFileSync(path.join(UI_DIR, 'game-controller.js'), 'utf-8');

  // 验证 get/post 使用 apiBase + endpoint 拼接
  assert.ok(
    gcSrc.includes('${apiBase}${endpoint}'),
    'game-controller.js 必须使用 ${apiBase}${endpoint} 拼接 URL'
  );

  // 验证 apiBase 已去除尾部斜杠
  assert.ok(
    gcSrc.includes('apiBaseUrl.replace(/\\/+$/, \'\')') || gcSrc.includes('apiBaseUrl.replace(/\\/+$/, \'\')'),
    'game-controller.js 必须对 apiBaseUrl 去除尾部斜杠'
  );

  console.log('✅ API 路径拼接逻辑检查通过');
}

function testServerRouteAlignment() {
  const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf-8');

  // 验证 server.js 确实将路由挂载到 /api/ai-gm
  assert.ok(
    serverSrc.includes("app.use('/api/ai-gm', router)"),
    'server.js 必须将 router 挂载到 /api/ai-gm'
  );
  assert.ok(
    serverSrc.includes("app.use('/api/ai-gm', errorHandler)"),
    'server.js 必须将 errorHandler 挂载到 /api/ai-gm'
  );

  console.log('✅ server.js 路由挂载对齐检查通过');
}

// ---- 执行 ----
(() => {
  try {
    testIndexJsDefaultApiPath();
    testGameControllerDefaults();
    testApiPathConstruction();
    testServerRouteAlignment();
    console.log('\n🎉 全部 API 路径迁移测试通过！');
    console.log('Summary:');
    console.log('  - index.js defaultSettings: /api/ai-gm');
    console.log('  - game-controller.js DEFAULT_API_BASE: /api/ai-gm');
    console.log('  - URL construction: ${apiBase}${endpoint}');
    console.log('  - server.js mount point: /api/ai-gm');
  } catch (err) {
    console.error('\n❌ API 路径迁移测试失败:', err.message);
    process.exit(1);
  }
})();
