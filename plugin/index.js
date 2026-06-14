// AI-GM Extension Entry — SillyTavern Extension System
// 作为 ST 内置扩展打包，通过 hooks.activate 调用 init()
// 路径：public/scripts/extensions/ai-gm/index.js

import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { getContext, renderExtensionTemplateAsync, extension_settings } from '../../../extensions.js';

// 静态导入 UI 模块（webpack 正确打包，确保全局对象设置）
import './ui/panel.js';
import './ui/npc-card.js';
import './ui/scene-renderer.js';
import './ui/game-controller.js';

const EXT_NAME = 'ai-gm';
const EXT_DISPLAY = 'AI-GM';

let settings = {};
const defaultSettings = {
  enabled: true,
  apiUrl: '/api/ai-gm',
  autoStart: false,
};

let panelVisible = false;
let panelContainer = null;
let gameController = null;

/** ST Extension activate hook — 由 ST 扩展加载器调用 */
export async function init() {
  console.log(`[${EXT_DISPLAY}] Initializing extension...`);
  loadSettings();
  createExtensionButton();
  createExtensionPanel();
  bindEvents();
  bindBridgeEvents();
  console.log(`[${EXT_DISPLAY}] Extension initialized successfully`);
}

export function onEnable() {
  console.log(`[${EXT_DISPLAY}] Enabled`);
}

export function onDisable() {
  console.log(`[${EXT_DISPLAY}] Disabled`);
  if (gameController) {
    window.AiGmGameController?.destroy?.();
    gameController = null;
  }
}

function loadSettings() {
  if (!extension_settings[EXT_NAME]) {
    extension_settings[EXT_NAME] = { ...defaultSettings };
  }
  settings = extension_settings[EXT_NAME];
}

function createExtensionButton() {
  const menu = document.getElementById('extensionsMenu');
  if (!menu) {
    console.warn(`[${EXT_DISPLAY}] #extensionsMenu not found, retry in 1s`);
    setTimeout(createExtensionButton, 1000);
    return;
  }

  const existing = document.getElementById('ai-gm-menu-btn');
  if (existing) {
    console.log(`[${EXT_DISPLAY}] Menu button already exists`);
    return;
  }

  const button = document.createElement('div');
  button.id = 'ai-gm-menu-btn';
  button.className = 'list-group-item flex-container flexGap5';
  button.innerHTML = `
    <div class="fa-solid fa-gamepad extensionsMenuExtensionButton"></div>
    <span data-i18n="ext_ai_gm_btn">AI-GM</span>
  `;
  button.title = 'AI-GM 游戏面板';
  button.addEventListener('click', () => togglePanel());
  menu.appendChild(button);
  console.log(`[${EXT_DISPLAY}] Menu button created in #extensionsMenu`);
}

async function createExtensionPanel() {
  const settingsPanel = document.getElementById('extensions_settings');
  if (!settingsPanel) {
    console.warn(`[${EXT_DISPLAY}] #extensions_settings not found, retry in 1s`);
    setTimeout(createExtensionPanel, 1000);
    return;
  }

  if (document.getElementById('ai-gm-settings-container')) {
    console.log(`[${EXT_DISPLAY}] Settings panel already exists`);
    return;
  }

  const container = document.createElement('div');
  container.id = 'ai-gm-settings-container';
  container.className = 'extension_container';

  const drawer = document.createElement('div');
  drawer.className = 'inline-drawer ai-gm-inline-drawer';
  drawer.innerHTML = `
    <div class="inline-drawer-toggle inline-drawer-header">
      <b data-i18n="ext_ai_gm_title">AI-GM</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
      <div id="ai-gm-panel" style="display:none;"></div>
      <div id="ai-gm-npc" style="display:none;"></div>
      <div id="ai-gm-scene" style="display:none;"></div>
      <div id="ai-gm-status" style="display:none;"></div>
      <div class="ai-gm-controls">
        <label class="checkbox_label">
          <input type="checkbox" id="ai-gm-enabled" ${settings.enabled ? 'checked' : ''}>
          <span data-i18n="ext_ai_gm_enabled">启用 AI-GM</span>
        </label>
        <label class="checkbox_label">
          <span data-i18n="ext_ai_gm_api_url">API 地址</span>
          <input type="text" id="ai-gm-api-url" value="${settings.apiUrl}" class="text_pole">
        </label>
        <div class="menu_button" id="ai-gm-start-btn">启动游戏</div>
        <div class="menu_button" id="ai-gm-refresh-btn" style="display:none;">刷新状态</div>
      </div>
    </div>
  `;

  container.appendChild(drawer);
  settingsPanel.appendChild(container);

  // 绑定控制元素
  const enableCheckbox = document.getElementById('ai-gm-enabled');
  if (enableCheckbox) {
    enableCheckbox.addEventListener('change', (e) => {
      settings.enabled = e.target.checked;
      extension_settings[EXT_NAME] = settings;
      saveSettingsDebounced();
      toggleRefreshButton();
    });
  }

  const apiUrlInput = document.getElementById('ai-gm-api-url');
  if (apiUrlInput) {
    apiUrlInput.addEventListener('change', (e) => {
      settings.apiUrl = e.target.value;
      extension_settings[EXT_NAME] = settings;
      saveSettingsDebounced();
    });
  }

  const startBtn = document.getElementById('ai-gm-start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => startGame());
  }

  const refreshBtn = document.getElementById('ai-gm-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (gameController && window.AiGmGameController?.refreshState) {
        window.AiGmGameController.refreshState();
      }
    });
  }

  panelContainer = document.getElementById('ai-gm-panel');
  console.log(`[${EXT_DISPLAY}] Settings panel created in #extensions_settings`);
}

function togglePanel() {
  const container = document.getElementById('ai-gm-settings-container');
  if (!container) {
    console.warn(`[${EXT_DISPLAY}] Panel container not found`);
    return;
  }

  const toggle = container.querySelector('.inline-drawer-toggle');
  const content = container.querySelector('.inline-drawer-content');
  if (!toggle || !content) {
    console.warn(`[${EXT_DISPLAY}] Toggle or content element missing`);
    return;
  }

  panelVisible = !panelVisible;
  content.style.display = panelVisible ? 'block' : 'none';

  const icon = toggle.querySelector('.inline-drawer-icon');
  if (icon) {
    icon.classList.toggle('down', panelVisible);
    icon.classList.toggle('fa-circle-chevron-down', panelVisible);
    icon.classList.toggle('fa-circle-chevron-up', !panelVisible);
  }

  if (panelVisible && !gameController && settings.enabled) {
    startGame();
  }
  toggleRefreshButton();
}

function toggleRefreshButton() {
  const refreshBtn = document.getElementById('ai-gm-refresh-btn');
  if (!refreshBtn) return;
  refreshBtn.style.display = (gameController && settings.enabled) ? 'inline-block' : 'none';
}

function startGame() {
  if (!settings.enabled) {
    console.warn(`[${EXT_DISPLAY}] 无法启动：AI-GM 未启用`);
    return;
  }

  if (!window.AiGmGameController) {
    console.warn(`[${EXT_DISPLAY}] 无法启动：游戏控制器未加载（检查 ui/game-controller.js 是否已打包）`);
    return;
  }

  const campaignId = getCurrentCampaignId();
  if (!campaignId) {
    console.warn(`[${EXT_DISPLAY}] 无法启动：无法获取战役 ID`);
    return;
  }

  try {
    // 确保所有容器可见
    const ids = ['ai-gm-panel', 'ai-gm-npc', 'ai-gm-scene', 'ai-gm-status'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'block';
    }

    window.AiGmGameController.initGameController(settings.apiUrl, campaignId);
    gameController = window.AiGmGameController;
    toggleRefreshButton();
    console.log(`[${EXT_DISPLAY}] 游戏已启动: ${campaignId}`);
  } catch (err) {
    console.error(`[${EXT_DISPLAY}] 启动游戏失败:`, err);
  }
}

function getCurrentCampaignId() {
  const context = getContext?.();
  if (context?.chatId) {
    return `st-${context.chatId}`;
  }
  if (context?.name) {
    return `st-${context.name}`;
  }
  return `st-${Date.now()}`;
}

function bindEvents() {
  // 角色切换时重置游戏
  eventSource.on(event_types.CHAT_CHANGED, () => {
    console.log(`[${EXT_DISPLAY}] Chat changed, resetting game`);
    if (gameController) {
      window.AiGmGameController?.destroy?.();
      gameController = null;
    }
    toggleRefreshButton();
    if (settings.enabled && settings.autoStart) {
      setTimeout(() => startGame(), 500);
    }
  });

  // AI 消息生成完成
  eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (messageId) => {
    if (!settings.enabled || !gameController) return;
    const context = getContext?.();
    const message = context?.chat?.find?.(m => m.id === messageId || m.index === messageId);
    if (message) {
      document.dispatchEvent(new CustomEvent('ai-gm:ai-message', {
        detail: { message, messageId, source: 'character' },
      }));
    }
  });

  // 用户消息生成完成
  eventSource.on(event_types.USER_MESSAGE_RENDERED, (messageId) => {
    if (!settings.enabled || !gameController) return;
    const context = getContext?.();
    const message = context?.chat?.find?.(m => m.id === messageId || m.index === messageId);
    if (message) {
      document.dispatchEvent(new CustomEvent('ai-gm:user-message', {
        detail: { message, messageId, source: 'user' },
      }));
    }
  });

  console.log(`[${EXT_DISPLAY}] Events bound: CHAT_CHANGED, CHARACTER_MESSAGE_RENDERED, USER_MESSAGE_RENDERED`);
}

/** 桥接 UI 组件事件到游戏控制器 */
function bindBridgeEvents() {
  // NPC 动作（对话 / 调查 / 攻击）-> 转发到控制器
  document.addEventListener('ai-gm:npc-action', (e) => {
    if (!gameController || !window.AiGmGameController?.handleAction) return;
    const { npcId, action } = e.detail || {};
    if (!npcId || !action) return;

    const actionMap = {
      talk: 'npc_talk',
      inspect: 'npc_inspect',
      attack: 'npc_attack',
    };
    const actionType = actionMap[action] || action;
    window.AiGmGameController.handleAction({ type: actionType, target: npcId });
  });

  // 场景交互（可交互物品）-> 转发到控制器
  document.addEventListener('ai-gm:scene-interact', (e) => {
    if (!gameController || !window.AiGmGameController?.handleAction) return;
    const { item } = e.detail || {};
    if (!item) return;
    window.AiGmGameController.handleAction({ type: 'interact', target: item });
  });

  // 用户消息 -> 可以作为动作解析（简单文本 -> 移动/观察等）
  document.addEventListener('ai-gm:user-message', (e) => {
    if (!gameController || !window.AiGmGameController?.handleAction) return;
    const { message } = e.detail || {};
    if (!message?.mes) return;
    const text = message.mes.trim();
    if (!text) return;

    // 简单解析：以 / 开头的命令视为 GM 动作
    if (text.startsWith('/gm ')) {
      const cmd = text.slice(4).trim();
      window.AiGmGameController.handleAction({ type: 'command', command: cmd });
    }
  });

  // AI 消息 -> 可以触发状态解析（如果 AI 返回结构化数据）
  document.addEventListener('ai-gm:ai-message', (e) => {
    if (!gameController) return;
    const { message } = e.detail || {};
    if (!message?.mes) return;
    // 尝试解析消息中的 JSON 结构化数据（如 ```json {...} ```）
    try {
      const jsonMatch = message.mes.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);
        if (data.aiGmState && window.AiGmGameController?.syncToUI) {
          window.AiGmGameController.syncToUI(data.aiGmState);
        }
      }
    } catch (err) {
      // 非结构化消息，忽略
    }
  });

  // 连接状态变化 -> 刷新按钮状态
  document.addEventListener('ai-gm:connection-change', (e) => {
    const { status } = e.detail || {};
    const startBtn = document.getElementById('ai-gm-start-btn');
    if (startBtn) {
      startBtn.textContent = status === 'online' ? '运行中' : '启动游戏';
      startBtn.style.opacity = status === 'online' ? '0.6' : '1';
    }
  });

  console.log(`[${EXT_DISPLAY}] Bridge events bound: npc-action, scene-interact, user-message, ai-message, connection-change`);
}

