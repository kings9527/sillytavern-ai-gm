/**
 * AI-GM Extension Entry — SillyTavern Extension Integration
 * Day 2 Engine Part 1: ST Extension Panel Mount
 *
 * 注册到 ST Extension 系统，创建右侧工具栏图标和设置面板。
 * 依赖（通过 window 全局）：
 *   - window.AiGmPanel, window.AiGmNpc, window.AiGmScene, window.AiGmGameController
 */

// ST 核心模块导入（路径兼容不同 ST 版本安装深度）
// 实际路径可能因 ST 版本和扩展安装位置而异，这里使用常见路径
import { eventSource, event_types } from '../../../../script.js';
import { extension_settings, saveSettingsDebounced } from '../../../extensions.js';

// AI-GM 子模块加载（浏览器 ESM 通过绝对路径或构建工具解析）
import './ui/panel.js';
import './ui/npc-card.js';
import './ui/scene-renderer.js';
import './ui/game-controller.js';
import { STChatBridge } from './utils/st-chat-bridge.js';

/* ---------- 常量 ---------- */
const EXTENSION_NAME = 'ai-gm';
const CSS_NS = 'ai-gm';

const defaultSettings = {
  enabled: true,
  apiBaseUrl: '/api/ai-gm',
  campaignId: 'default',
  autoStart: false,
  pollInterval: 5000,
  autoParse: true,
  injectToChat: false,
};

/* ---------- 状态 ---------- */
let isInitialized = false;
let isEnabled = false;
let gameController = null;
let stChatBridge = null;
let settings = { ...defaultSettings };

/* ---------- 初始化入口（ST 调用） ---------- */

/**
 * ST Extension 激活钩子 — 由 manifest.json hooks.activate 指定
 */
export async function init() {
  if (isInitialized) return;

  loadSettings();
  createMenuButton();
  createSettingsPanel();
  bindEvents();

  isInitialized = true;
  console.log(`[${EXTENSION_NAME}] Extension initialized`);

  // 如果启用且设置了自动启动，则初始化游戏控制器
  if (settings.enabled && settings.autoStart) {
    await onEnable();
  }
}

/**
 * 启用 AI-GM 功能
 */
export async function onEnable() {
  if (isEnabled) return;
  isEnabled = true;

  const panel = document.getElementById(`${CSS_NS}-panel`);
  const npc = document.getElementById(`${CSS_NS}-npc`);
  const scene = document.getElementById(`${CSS_NS}-scene`);

  if (window.AiGmPanel && panel) {
    window.AiGmPanel.initPanel(panel);
  }
  if (window.AiGmNpc && npc) {
    window.AiGmNpc.initNpcContainer(npc);
  }
  if (window.AiGmScene && scene) {
    window.AiGmScene.initSceneRenderer(scene);
  }

  if (window.AiGmGameController) {
    gameController = window.AiGmGameController;
    gameController.initGameController(settings.apiBaseUrl, settings.campaignId);
  }

  // 启动聊天桥接器，将用户输入连接到游戏控制器
  if (gameController) {
    stChatBridge = new STChatBridge(gameController, {
      autoParse: settings.autoParse,
      injectToChat: settings.injectToChat,
      maxContextMessages: 20,
    });
    stChatBridge.start();
  }

  updateStatus('🟢 AI-GM 已启用');
  console.log(`[${EXTENSION_NAME}] Game enabled`);
}

/**
 * 禁用 AI-GM 功能，清理资源
 */
export function onDisable() {
  if (!isEnabled) return;
  isEnabled = false;

  if (stChatBridge) {
    stChatBridge.stop();
    stChatBridge = null;
  }

  if (gameController && gameController.destroy) {
    gameController.destroy();
    gameController = null;
  }

  updateStatus('⚪ AI-GM 已禁用');
  console.log(`[${EXTENSION_NAME}] Game disabled`);
}

/* ---------- UI 构建 ---------- */

/**
 * 在 ST 扩展菜单 (#extensionsMenu) 中创建 AI-GM 按钮
 */
function createMenuButton() {
  const menu = document.getElementById('extensionsMenu');
  if (!menu) {
    console.warn(`[${EXTENSION_NAME}] #extensionsMenu not found`);
    return;
  }

  const existing = document.getElementById(`${CSS_NS}-menu-btn`);
  if (existing) return;

  const btn = document.createElement('div');
  btn.id = `${CSS_NS}-menu-btn`;
  btn.className = 'list-group-item flex-container flexGap5 interactable';
  btn.innerHTML = '<span class="fa-solid fa-gamepad"></span> AI-GM';
  btn.title = 'AI-GM 克苏鲁跑团主持人';

  btn.addEventListener('click', () => toggleSettingsPanel());
  menu.appendChild(btn);
}

/**
 * 在 ST 扩展设置面板 (#extensions_settings) 中创建设置面板
 */
function createSettingsPanel() {
  const settingsPanel = document.getElementById('extensions_settings');
  if (!settingsPanel) {
    console.warn(`[${EXTENSION_NAME}] #extensions_settings not found`);
    return;
  }

  const existing = document.getElementById(`${CSS_NS}-settings-container`);
  if (existing) return;

  const container = document.createElement('div');
  container.id = `${CSS_NS}-settings-container`;

  // 内部使用 inline-drawer 结构
  const drawer = document.createElement('div');
  drawer.className = 'inline-drawer';

  drawer.innerHTML = `
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>AI-GM 克苏鲁跑团</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content" id="${CSS_NS}-drawer-content" style="display: none;">
      <div class="${CSS_NS}-controls">
        <label class="checkbox_label" for="${CSS_NS}-enabled">
          <input type="checkbox" id="${CSS_NS}-enabled" />
          <span>启用 AI-GM 功能</span>
        </label>
        <div class="flex-container flexGap5" style="margin-top: 0.3rem;">
          <span>API 地址</span>
          <input type="text" id="${CSS_NS}-api-url" class="text_pole" placeholder="/api/ai-gm" />
        </div>
        <div class="flex-container flexGap5" style="margin-top: 0.3rem;">
          <span>战役 ID</span>
          <input type="text" id="${CSS_NS}-campaign-id" class="text_pole" placeholder="default" />
        </div>
        <label class="checkbox_label" for="${CSS_NS}-auto-start" style="margin-top: 0.3rem;">
          <input type="checkbox" id="${CSS_NS}-auto-start" />
          <span>连接后自动启动</span>
        </label>
        <label class="checkbox_label" for="${CSS_NS}-auto-parse" style="margin-top: 0.3rem;">
          <input type="checkbox" id="${CSS_NS}-auto-parse" />
          <span>自动解析用户输入为游戏动作</span>
        </label>
        <label class="checkbox_label" for="${CSS_NS}-inject-chat" style="margin-top: 0.3rem;">
          <input type="checkbox" id="${CSS_NS}-inject-chat" />
          <span>将游戏结果注入聊天记录</span>
        </label>
        <button id="${CSS_NS}-save-btn" class="menu_button" style="margin-top: 0.5rem;">保存设置</button>
      </div>
      <hr />
      <div id="${CSS_NS}-panel" class="${CSS_NS}-panel-mount"></div>
      <div id="${CSS_NS}-npc" class="${CSS_NS}-npc-mount"></div>
      <div id="${CSS_NS}-scene" class="${CSS_NS}-scene-mount"></div>
      <div id="${CSS_NS}-status" class="${CSS_NS}-status-bar">⚪ 等待连接</div>
    </div>
  `;

  container.appendChild(drawer);

  settingsPanel.appendChild(container);

  // 绑定设置面板的展开/收起
  const toggle = container.querySelector('.inline-drawer-toggle');
  const content = container.querySelector('.inline-drawer-content');
  const icon = container.querySelector('.inline-drawer-icon');
  if (toggle && content && icon) {
    toggle.addEventListener('click', () => {
      const isOpen = content.style.display === 'block';
      content.style.display = isOpen ? 'none' : 'block';
      icon.classList.toggle('down', !isOpen);
    });
  }

  // 绑定保存按钮
  const saveBtn = document.getElementById(`${CSS_NS}-save-btn`);
  if (saveBtn) {
    saveBtn.addEventListener('click', saveSettingsFromUI);
  }

  // 绑定启用开关
  const enabledCheckbox = document.getElementById(`${CSS_NS}-enabled`);
  if (enabledCheckbox) {
    enabledCheckbox.checked = settings.enabled;
    enabledCheckbox.addEventListener('change', () => {
      settings.enabled = enabledCheckbox.checked;
      if (settings.enabled) onEnable();
      else onDisable();
      saveSettings();
    });
  }

  // 填充设置值
  const apiUrlInput = document.getElementById(`${CSS_NS}-api-url`);
  if (apiUrlInput) apiUrlInput.value = settings.apiBaseUrl || '';

  const campaignInput = document.getElementById(`${CSS_NS}-campaign-id`);
  if (campaignInput) campaignInput.value = settings.campaignId || '';

  const autoStartCheckbox = document.getElementById(`${CSS_NS}-auto-start`);
  if (autoStartCheckbox) autoStartCheckbox.checked = settings.autoStart || false;

  const autoParseCheckbox = document.getElementById(`${CSS_NS}-auto-parse`);
  if (autoParseCheckbox) autoParseCheckbox.checked = settings.autoParse !== false;

  const injectChatCheckbox = document.getElementById(`${CSS_NS}-inject-chat`);
  if (injectChatCheckbox) injectChatCheckbox.checked = settings.injectToChat || false;
}

/* ---------- 交互 ---------- */

function toggleSettingsPanel() {
  const container = document.getElementById(`${CSS_NS}-settings-container`);
  if (!container) return;
  const toggle = container.querySelector('.inline-drawer-toggle');
  if (toggle) toggle.click();
}

function updateStatus(text) {
  const el = document.getElementById(`${CSS_NS}-status`);
  if (el) el.textContent = text;
}

/* ---------- 设置持久化 ---------- */

function loadSettings() {
  const saved = extension_settings[EXTENSION_NAME];
  if (saved && typeof saved === 'object') {
    settings = { ...defaultSettings, ...saved };
  } else {
    settings = { ...defaultSettings };
  }
}

function saveSettings() {
  extension_settings[EXTENSION_NAME] = { ...settings };
  if (typeof saveSettingsDebounced === 'function') {
    saveSettingsDebounced();
  }
}

function saveSettingsFromUI() {
  const apiUrlInput = document.getElementById(`${CSS_NS}-api-url`);
  const campaignInput = document.getElementById(`${CSS_NS}-campaign-id`);
  const autoStartCheckbox = document.getElementById(`${CSS_NS}-auto-start`);
  const autoParseCheckbox = document.getElementById(`${CSS_NS}-auto-parse`);
  const injectChatCheckbox = document.getElementById(`${CSS_NS}-inject-chat`);

  if (apiUrlInput) settings.apiBaseUrl = apiUrlInput.value.trim() || defaultSettings.apiBaseUrl;
  if (campaignInput) settings.campaignId = campaignInput.value.trim() || defaultSettings.campaignId;
  if (autoStartCheckbox) settings.autoStart = autoStartCheckbox.checked;
  if (autoParseCheckbox) settings.autoParse = autoParseCheckbox.checked;
  if (injectChatCheckbox) settings.injectToChat = injectChatCheckbox.checked;

  saveSettings();

  // 如果已启用，重新初始化控制器以应用新设置
  if (isEnabled && gameController) {
    onDisable();
    onEnable();
  }

  console.log(`[${EXTENSION_NAME}] Settings saved`);
}

/* ---------- 事件绑定 ---------- */

function bindEvents() {
  // 角色切换 / 聊天切换时重置游戏状态
  eventSource.on(event_types.CHAT_CHANGED, () => {
    if (isEnabled && gameController) {
      console.log(`[${EXTENSION_NAME}] Chat changed — refreshing state`);
      gameController.refreshState?.();
    }
    if (stChatBridge) {
      stChatBridge.onChatChanged();
    }
  });

  // AI 消息渲染完成时缓存到桥接器上下文
  eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (messageId) => {
    if (isEnabled && stChatBridge) {
      stChatBridge.onCharacterMessage(messageId);
    }
  });

  // 用户消息渲染完成时发送到游戏控制器
  eventSource.on(event_types.USER_MESSAGE_RENDERED, (messageId) => {
    if (isEnabled && stChatBridge) {
      stChatBridge.onUserMessage(messageId);
    }
  });
}

/* ---------- 兼容模块导出（浏览器全局 + Node 测试） ---------- */
if (typeof window !== 'undefined') {
  window.AiGmExtension = { init, onEnable, onDisable };
}
