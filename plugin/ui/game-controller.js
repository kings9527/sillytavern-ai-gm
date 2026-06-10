/**
 * AI-GM Game Controller — 连接 UI 组件到后端 API
 * Phase 3 Surface: Browser-compatible ESM integration
 *
 * 依赖（通过 window 全局对象）：
 * - window.AiGmPanel   { initPanel, updatePanel }
 * - window.AiGmNpc     { initNpcContainer, renderNpcs, updateNpcState }
 * - window.AiGmScene   { initSceneRenderer, renderScene, setAtmosphere, ATMOSPHERE_MAP }
 */

/* ---------- dependencies ---------- */
const Panel = window.AiGmPanel || {};
const Npc = window.AiGmNpc || {};
const Scene = window.AiGmScene || {};

/* ---------- state ---------- */
/** @type {string} */
let apiBase = '';
/** @type {string} */
let campaign = '';
/** @type {number|null} */
let pollTimer = null;
/** @type {Object} */
let containers = {};
/** @type {boolean} */
let isRunning = false;
/** @type {number} */
let pollIntervalMs = 5000;
/** @type {number} */
let consecutiveFailures = 0;
/** @type {('online'|'offline'|'error')} */
let connectionStatus = 'offline';
/** @type {number|null} */
let reconnectTimer = null;
/** @const {number} */
const MAX_POLL_INTERVAL = 60000;
/** @const {number} */
const BACKOFF_MULTIPLIER = 2;

/* ---------- public ---------- */

/**
 * 初始化游戏控制器，连接 UI 组件到后端 API
 * @param {string} apiBaseUrl - 后端 API 根地址
 * @param {string} campaignId - 当前战役 ID
 * @throws {Error} 当缺少必要 DOM 容器时抛出
 */
function initGameController(apiBaseUrl, campaignId) {
  if (!apiBaseUrl || !campaignId) {
    throw new Error('GameController: apiBaseUrl 和 campaignId 都是必填参数');
  }

  apiBase = apiBaseUrl.replace(/\/+$/, '');
  campaign = campaignId;
  consecutiveFailures = 0;
  pollIntervalMs = 5000;
  connectionStatus = 'offline';

  containers.panel = document.getElementById('ai-gm-panel');
  containers.npc = document.getElementById('ai-gm-npc');
  containers.scene = document.getElementById('ai-gm-scene');
  containers.status = document.getElementById('ai-gm-status');

  if (!containers.panel || !containers.npc || !containers.scene) {
    throw new Error('GameController: 缺少必要的 DOM 容器 (panel/npc/scene)');
  }

  if (Panel.initPanel) Panel.initPanel(containers.panel);
  if (Npc.initNpcContainer) Npc.initNpcContainer(containers.npc);
  if (Scene.initSceneRenderer) Scene.initSceneRenderer(containers.scene);

  isRunning = true;
  updateConnectionStatus('online', '初始化完成');

  // 立即拉取一次，然后启动轮询
  fetchGameState().catch((err) => {
    console.warn('[GameController] 初始状态获取失败:', err.message);
  });
  startPolling(pollIntervalMs);

  bindExitClick(containers.panel);
  bindInteractableClick(containers.scene);

  console.log('[GameController] 已初始化 | 战役:', campaignId);
}

/**
 * 销毁控制器，清理所有资源
 */
function destroy() {
  isRunning = false;

  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  apiBase = '';
  campaign = '';
  containers = {};
  consecutiveFailures = 0;
  pollIntervalMs = 5000;
  connectionStatus = 'offline';

  console.log('[GameController] 已销毁');
}

/**
 * 获取当前连接状态
 * @returns {{status: string, campaign: string, isRunning: boolean}}
 */
function getStatus() {
  return {
    status: connectionStatus,
    campaign,
    isRunning,
    pollIntervalMs,
    consecutiveFailures,
  };
}

/* ---------- network ---------- */

/**
 * 从后端拉取完整游戏状态并同步到 UI
 */
async function fetchGameState() {
  if (!isRunning || !apiBase || !campaign) return;

  try {
    const health = await get('/health');
    if (!health || !health.ok) {
      console.warn('[GameController] 后端未就绪:', health);
      handleFailure('后端健康检查失败');
      return;
    }

    const state = await get(`/campaign/${campaign}/state`);
    if (!state) {
      console.warn('[GameController] 状态为空');
      handleFailure('状态数据为空');
      return;
    }

    // 成功 — 重置失败计数
    if (consecutiveFailures > 0) {
      consecutiveFailures = 0;
      pollIntervalMs = 5000;
      restartPolling();
      updateConnectionStatus('online', '连接恢复');
    }

    syncToUI(state);
  } catch (err) {
    console.error('[GameController] fetchGameState 失败:', err.message);
    handleFailure(err.message);
  }
}

/**
 * 发送玩家动作到后端
 * @param {Object} action - 动作对象 { type, ...params }
 */
async function handleAction(action) {
  if (!isRunning || !apiBase || !campaign) return;

  try {
    const result = await post('/state/action', {
      campaign_id: campaign,
      action_type: action.type,
      action_data: action,
    });

    if (result && result.state) {
      syncToUI(result.state);
    } else if (result && result.success) {
      await fetchGameState();
    }

    // 成功发送后主动刷新，确保状态同步
    if (consecutiveFailures > 0) {
      consecutiveFailures = 0;
      pollIntervalMs = 5000;
      restartPolling();
    }
  } catch (err) {
    console.error('[GameController] handleAction 失败:', err.message);
    updateConnectionStatus('error', `动作失败: ${err.message}`);
  }
}

/**
 * 手动刷新状态（供外部调用）
 */
async function refreshState() {
  return fetchGameState();
}

/* ---------- sync ---------- */

/**
 * 将游戏状态同步到所有 UI 组件
 * @param {Object} state - 后端返回的游戏状态
 */
function syncToUI(state) {
  if (!state) return;

  try {
    // 面板: 标题、描述、NPC 列表、出口、玩家状态
    if (Panel.updatePanel) {
      Panel.updatePanel(state);
    }

    // NPC 卡片: 渲染完整 NPC 列表
    if (state.npcs && Npc.renderNpcs) {
      Npc.renderNpcs(state.npcs);
    }

    // 单 NPC 增量更新（如战斗中）
    if (state.npcDelta && Npc.updateNpcState) {
      Npc.updateNpcState(state.npcDelta.id, state.npcDelta);
    }

    // 场景渲染器: 场景氛围、标题、描述、背景
    if (state.scene && Scene.renderScene) {
      Scene.renderScene(state.scene);
      if (state.scene.atmosphere && Scene.setAtmosphere) {
        Scene.setAtmosphere(state.scene.atmosphere);
      }
    }

    // 触发全局状态更新事件
    document.dispatchEvent(new CustomEvent('ai-gm:state-sync', {
      detail: { state, campaign, timestamp: Date.now() },
    }));
  } catch (err) {
    console.error('[GameController] syncToUI 错误:', err.message);
  }
}

/* ---------- polling & events ---------- */

/**
 * 启动状态轮询
 * @param {number} intervalMs - 轮询间隔（毫秒）
 */
function startPolling(intervalMs) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(fetchGameState, intervalMs);
  console.log('[GameController] 轮询启动 | 间隔:', intervalMs, 'ms');
}

/**
 * 以新的间隔重启轮询
 */
function restartPolling() {
  if (!isRunning) return;
  startPolling(pollIntervalMs);
}

/**
 * 处理连接失败，应用指数退避
 * @param {string} reason - 失败原因
 */
function handleFailure(reason) {
  consecutiveFailures++;

  // 指数退避: 最大 60 秒
  pollIntervalMs = Math.min(
    MAX_POLL_INTERVAL,
    5000 * Math.pow(BACKOFF_MULTIPLIER, consecutiveFailures - 1)
  );

  const status = consecutiveFailures >= 3 ? 'offline' : 'error';
  updateConnectionStatus(status, `连接失败(${consecutiveFailures}): ${reason}`);

  restartPolling();

  // 尝试单次重连
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    if (isRunning) fetchGameState();
  }, Math.min(pollIntervalMs, 10000));
}

/**
 * 更新连接状态指示器
 * @param {string} status - online | offline | error
 * @param {string} message - 状态描述
 */
function updateConnectionStatus(status, message) {
  connectionStatus = status;

  const statusEl = containers.status || document.getElementById('ai-gm-status');
  if (!statusEl) return;

  const icons = { online: '🟢', offline: '🔴', error: '🟡' };
  statusEl.textContent = `${icons[status] || '⚪'} ${message}`;
  statusEl.className = `ai-gm-status ai-gm-status-${status}`;

  document.dispatchEvent(new CustomEvent('ai-gm:connection-change', {
    detail: { status, message, campaign },
  }));
}

/**
 * 绑定出口按钮点击事件
 * @param {HTMLElement} panelContainer - 面板容器
 */
function bindExitClick(panelContainer) {
  panelContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.ai-gm-panel-exit-btn, .ai-gm-game-exit-btn');
    if (!btn) return;
    const target = btn.dataset.target;
    if (target) {
      handleAction({ type: 'move', target });
    }
  });
}

/**
 * 绑定可交互物点击事件
 * @param {HTMLElement} sceneContainer - 场景容器
 */
function bindInteractableClick(sceneContainer) {
  sceneContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.ai-gm-scene-interact-btn, .ai-gm-game-interact-item');
    if (!btn) return;
    const item = btn.dataset.item;
    if (item) {
      handleAction({ type: 'interact', item });
    }
  });
}

/* ---------- HTTP helpers ---------- */

/**
 * GET 请求
 * @param {string} endpoint - API 路径
 * @returns {Promise<Object>}
 */
async function get(endpoint) {
  const res = await fetch(`${apiBase}${endpoint}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET ${endpoint} => ${res.status}`);
  return res.json();
}

/**
 * POST 请求
 * @param {string} endpoint - API 路径
 * @param {Object} body - 请求体
 * @returns {Promise<Object>}
 */
async function post(endpoint, body) {
  const res = await fetch(`${apiBase}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${endpoint} => ${res.status}`);
  return res.json();
}

/* ---------- exports ---------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initGameController,
    destroy,
    fetchGameState,
    syncToUI,
    handleAction,
    refreshState,
    getStatus,
  };
}
window.AiGmGameController = {
  initGameController,
  destroy,
  fetchGameState,
  syncToUI,
  handleAction,
  refreshState,
  getStatus,
};
