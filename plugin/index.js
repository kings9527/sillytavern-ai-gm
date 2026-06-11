/**
 * AI-GM Extension — ST Extension 入口
 * 注册到 SillyTavern Extension 系统，挂载 AI-GM 面板
 *
 * @version 0.1.0
 */

import { eventSource, event_types } from '../../../../../../../script.js';
import { extension_settings, renderExtensionTemplate } from '../../../../../../../extensions.js';

const EXT_NAME = 'ai-gm';
const EXT_DISPLAY = 'AI-GM';

/** @type {boolean} */
let isEnabled = false;
/** @type {HTMLElement|null} */
let panelContainer = null;
/** @type {HTMLElement|null} */
let toggleBtn = null;

/* ---------- 生命周期钩子 ---------- */

/**
 * Extension 被启用时调用（ST 加载扩展时）
 */
export function init() {
  onEnable();
}

export function onEnable() {
  console.log(`[${EXT_DISPLAY}] Extension enabled`);
  isEnabled = true;
  initPanel();
  bindEvents();
}

/**
 * Extension 被禁用时调用
 */
export function onDisable() {
  console.log(`[${EXT_DISPLAY}] Extension disabled`);
  isEnabled = false;
  destroyPanel();
}

/* ---------- 面板挂载 ---------- */

/**
 * 初始化 AI-GM 面板：在 ST 右侧工具栏创建按钮 + 展开面板
 */
function initPanel() {
  if (document.getElementById('ai-gm-toggle-btn')) return;

  // 1. 创建工具栏按钮（插入到 extensions_menu 末尾）
  const menu = document.getElementById('extensions_menu');
  if (!menu) {
    console.warn(`[${EXT_DISPLAY}] #extensions_menu not found, retry in 1s`);
    setTimeout(initPanel, 1000);
    return;
  }

  toggleBtn = document.createElement('div');
  toggleBtn.id = 'ai-gm-toggle-btn';
  toggleBtn.className = 'list-group-item flex-container flexGap5';
  toggleBtn.innerHTML = `
    <div class="fa-solid fa-dice-d20 extensionsMenuExtensionButton" title="AI-GM"></div>
    <span class="extensionsMenuExtensionName">${EXT_DISPLAY}</span>
  `;
  toggleBtn.addEventListener('click', onToggleClick);
  menu.appendChild(toggleBtn);

  // 2. 创建面板容器（默认隐藏，定位到右侧扩展区）
  const extSettings = document.getElementById('extensions_settings');
  if (extSettings) {
    panelContainer = document.createElement('div');
    panelContainer.id = 'ai-gm-panel-container';
    panelContainer.className = 'ai-gm-panel-container hidden';
    extSettings.insertAdjacentElement('afterend', panelContainer);
  }

  // 3. 加载 UI 子模块（动态注入脚本，确保全局对象可用）
  loadUiModules().then(() => {
    if (window.AiGmPanel && panelContainer) {
      window.AiGmPanel.initPanel(panelContainer);
    }
    if (window.AiGmGameController) {
      window.AiGmGameController.initGameController('/api/plugins/ai-gm', 'default');
    }
  }).catch((err) => {
    console.error(`[${EXT_DISPLAY}] UI module load failed:`, err);
  });

  console.log(`[${EXT_DISPLAY}] Panel mounted`);
}

/**
 * 销毁面板和按钮
 */
function destroyPanel() {
  toggleBtn?.remove();
  toggleBtn = null;
  panelContainer?.remove();
  panelContainer = null;
  if (window.AiGmGameController) {
    window.AiGmGameController.destroy?.();
  }
}

/* ---------- 交互事件 ---------- */

/**
 * 点击工具栏按钮：展开/收起面板
 */
function onToggleClick() {
  if (!panelContainer) return;
  const isHidden = panelContainer.classList.toggle('hidden');
  toggleBtn?.classList.toggle('active', !isHidden);

  if (!isHidden && window.AiGmGameController) {
    window.AiGmGameController.refreshState?.();
  }
}

/**
 * 绑定 ST 原生事件
 */
function bindEvents() {
  // 角色切换 → 重置游戏状态
  eventSource.on(event_types.CHAT_CHANGED, () => {
    console.log(`[${EXT_DISPLAY}] CHAT_CHANGED — reset game state`);
    if (window.AiGmGameController) {
      window.AiGmGameController.destroy?.();
      window.AiGmGameController.initGameController?.('/api/plugins/ai-gm', 'default');
    }
  });

  // 新消息 → 触发 AI-GM 事件解析（如检定请求、战斗指令）
  eventSource.on(event_types.MESSAGE_RECEIVED, (data) => {
    const message = data?.message?.mes || data?.mes || '';
    if (!message) return;

    // 简单指令匹配：/gm 开头视为 AI-GM 指令
    if (message.startsWith('/gm')) {
      const cmd = message.slice(3).trim();
      handleGmCommand(cmd);
    }
  });

  // 玩家发送消息 → 可扩展为动作解析
  eventSource.on(event_types.MESSAGE_SENT, (data) => {
    const message = data?.message?.mes || data?.mes || '';
    if (!message) return;
    // 未来可接入动作解析：move / attack / check / talk 等
  });
}

/**
 * 处理 /gm 指令
 * @param {string} cmd
 */
function handleGmCommand(cmd) {
  console.log(`[${EXT_DISPLAY}] GM command:`, cmd);
  if (!window.AiGmGameController) return;

  if (cmd === 'reset') {
    window.AiGmGameController.destroy?.();
    window.AiGmGameController.initGameController?.('/api/plugins/ai-gm', 'default');
    return;
  }

  // 其他指令透传给后端
  window.AiGmGameController.handleAction?.('command', { text: cmd });
}

/* ---------- 模块加载 ---------- */

/**
 * 动态加载 UI 子模块（panel + game-controller）
 * 使用原生 import() 确保浏览器按序执行并挂载全局对象
 */
async function loadUiModules() {
  const modules = [
    './ui/panel.js',
    './ui/game-controller.js',
  ];

  for (const mod of modules) {
    try {
      await import(/* @vite-ignore */ mod);
    } catch (err) {
      console.warn(`[${EXT_DISPLAY}] Failed to load ${mod}:`, err);
    }
  }
}

/* ---------- 导出（供 ST 测试或外部调用） ---------- */

export { isEnabled, panelContainer, toggleBtn };
