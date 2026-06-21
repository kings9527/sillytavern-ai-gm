/**
 * ST Chat Bridge — 将 SillyTavern 聊天与 AI-GM 游戏引擎连接
 *
 * 功能：
 * 1. 缓存最近 N 条聊天消息作为游戏上下文（用于 LLM 增强时提供历史）
 * 2. 将用户新输入的消息解析为游戏动作，通过 gameController.handleAction 发送
 * 3. 将游戏结果（场景描述、骰子结果、NPC 对话）通过 toast / DOM 注入 ST 界面
 * 4. 支持 `/gm` 命令前缀和自动解析两种模式
 *
 * 限制：
 * - 不直接修改 ST 聊天记录（避免破坏角色扮演流），仅通过面板和 toast 显示
 * - 依赖 ST DOM 结构获取消息内容（fallback 到 eventSource 参数）
 */

export class STChatBridge {
  /**
   * @param {Object} gameController — window.AiGmGameController 实例
   * @param {Object} options
   * @param {number} options.maxContextMessages — 保留的最近消息数（默认 20）
   * @param {boolean} options.autoParse — 是否自动解析所有用户输入（默认 false）
   * @param {boolean} options.injectToChat — 是否将游戏结果插入 ST 聊天（默认 false，仅 toast）
   */
  constructor(gameController, options = {}) {
    this.gameController = gameController;
    this.maxContextMessages = options.maxContextMessages || 20;
    this.autoParse = options.autoParse !== false; // 默认启用，因为这是 AI-GM 核心卖点
    this.injectToChat = options.injectToChat || false;
    this.messageCache = [];
    this.isEnabled = false;
    this.pendingActions = new Set(); // 防止重复提交
  }

  start() {
    this.isEnabled = true;
    console.log('[STChatBridge] 聊天桥接已启动 | autoParse:', this.autoParse);
  }

  stop() {
    this.isEnabled = false;
    this.messageCache = [];
    this.pendingActions.clear();
  }

  /* ---------- 消息监听 ---------- */

  /**
   * 处理用户消息渲染完成事件
   * @param {number|string} messageId — ST 消息索引或 ID
   * @param {string} [fallbackText] — 如果 DOM 取不到时的备选文本
   */
  onUserMessage(messageId, fallbackText = '') {
    if (!this.isEnabled || !this.gameController) return;

    const text = this._getMessageText(messageId) || fallbackText;
    if (!text) return;

    this._cacheMessage({ role: 'user', text, id: messageId, timestamp: Date.now() });

    // 判断是否应作为游戏动作处理
    if (!this._shouldProcessAsGameAction(text)) return;

    const actionInput = text.replace(/^\/gm\s*/, '').trim();
    this._sendAction({ type: 'player_input', input: actionInput, raw: text });
  }

  /**
   * 处理角色（AI）消息渲染完成事件
   * @param {number|string} messageId
   * @param {string} [fallbackText]
   */
  onCharacterMessage(messageId, fallbackText = '') {
    if (!this.isEnabled) return;

    const text = this._getMessageText(messageId) || fallbackText;
    if (!text) return;

    this._cacheMessage({ role: 'character', text, id: messageId, timestamp: Date.now() });
  }

  /**
   * 当聊天切换时（CHAT_CHANGED），清空缓存
   */
  onChatChanged() {
    this.messageCache = [];
    this.pendingActions.clear();
    console.log('[STChatBridge] 聊天切换 — 缓存已清空');
  }

  /* ---------- 动作发送 ---------- */

  async _sendAction(action) {
    const actionKey = `${action.type}_${action.input}_${Date.now()}`;
    if (this.pendingActions.has(actionKey)) return;
    this.pendingActions.add(actionKey);

    try {
      // 将最近聊天记录作为上下文附加到动作中，供 NPC 决策使用
      const enrichedAction = {
        ...action,
        chat_history: this.getRecentContext(10),
      };
      // 注意：gameController.handleAction 是 async 的，但它在成功后会自动 syncToUI
      await this.gameController.handleAction(enrichedAction);
    } catch (err) {
      console.error('[STChatBridge] 发送动作失败:', err.message);
      this._notify('❌ 动作处理失败: ' + err.message, 'error');
    } finally {
      setTimeout(() => this.pendingActions.delete(actionKey), 500);
    }
  }

  /* ---------- 消息缓存与上下文 ---------- */

  _cacheMessage(msg) {
    this.messageCache.push(msg);
    if (this.messageCache.length > this.maxContextMessages) {
      this.messageCache.shift();
    }
  }

  /**
   * 获取最近 N 条消息拼接的上下文文本（供 LLM 增强使用）
   * @param {number} [limit=10]
   * @returns {string}
   */
  getRecentContext(limit = 10) {
    return this.messageCache
      .slice(-limit)
      .map(m => {
        const prefix = m.role === 'user' ? '玩家' : 'AI';
        return `${prefix}: ${m.text}`;
      })
      .join('\n');
  }

  /* ---------- 动作过滤 ---------- */

  /**
   * 判断用户输入是否应作为游戏动作处理
   * 策略：
   * 1. 如果输入以 `/gm` 开头，总是处理（并去掉前缀）
   * 2. 如果启用了 autoParse，检查是否包含游戏动作关键词
   * 3. 如果未启用 autoParse，只处理 `/gm` 前缀
   */
  _shouldProcessAsGameAction(input) {
    if (!input || typeof input !== 'string') return false;
    const trimmed = input.trim();

    // 命令前缀模式
    if (trimmed.startsWith('/gm')) return true;

    // 自动解析模式：关键词匹配
    if (this.autoParse) {
      const keywords = [
        // 中文
        '去', '走', '前往', '进入', '到', '离开', '返回',
        '检查', '查看', '调查', '侦查', '搜索', '观察', '环顾',
        '攻击', '打', '杀', '战斗', '射击', '开枪', '格斗',
        '说', '问', '告诉', '对话', '交谈', '打听',
        '使用', '用', '消耗', '装备', '打开', '关闭', '拿起', '拿', '取', '拾取', '放下', '给',
        '检定', '骰', '投', 'roll', '鉴定',
        '逃跑', '撤退', '撤离', '跑',
        '休息', '治疗', '恢复', '包扎', '睡觉',
        '读', '阅读', '翻阅', '研究', '翻译', '解读',
        '跟随', '跟踪', '尾随', '监视',
        '躲藏', '藏起来', '藏起来', '潜行', '偷偷',
        '聆听', '听', '偷听',
        '施法', '施展', '念咒', '召唤', '仪式',
        // 英文
        'go', 'move', 'walk', 'enter', 'leave', 'exit', 'head', 'proceed',
        'check', 'examine', 'inspect', 'look', 'search', 'investigate', 'observe', 'scout',
        'attack', 'fight', 'hit', 'strike', 'shoot', 'stab', 'kill', 'combat',
        'talk', 'speak', 'ask', 'tell', 'say', 'chat', 'conversation', 'dialogue',
        'use', 'equip', 'consume', 'activate', 'open', 'close', 'pick', 'take', 'grab', 'give', 'drop',
        'roll', 'dice', 'check', 'test', 'skill',
        'flee', 'run', 'escape', 'retreat', 'withdraw',
        'rest', 'sleep', 'heal', 'recover', 'treat',
        'read', 'study', 'research', 'translate', 'decipher',
        'follow', 'tail', 'shadow', 'track', 'pursue',
        'hide', 'sneak', 'stealth', 'conceal',
        'listen', 'eavesdrop', 'overhear',
        'cast', 'spell', 'invoke', 'summon', 'ritual', 'magic',
      ];
      return keywords.some(kw => trimmed.toLowerCase().includes(kw.toLowerCase()));
    }

    return false;
  }

  /* ---------- ST 消息读取 ---------- */

  /**
   * 从 ST DOM 中读取指定消息的内容
   * ST 聊天结构: #chat > .mes[mesid="N"] > .mes_content / .mes_text
   * @param {number|string} messageId
   * @returns {string|null}
   * @private
   */
  _getMessageText(messageId) {
    if (typeof document === 'undefined') return null;

    // 尝试通过 mesid 属性查找
    let el = document.querySelector(`#chat .mes[mesid="${messageId}"] .mes_text`);
    if (!el) {
      // 备选：通过索引查找
      const messages = document.querySelectorAll('#chat .mes');
      const idx = parseInt(messageId, 10);
      if (!isNaN(idx) && messages[idx]) {
        el = messages[idx].querySelector('.mes_text');
      }
    }
    if (!el) return null;

    // 获取纯文本，去除 HTML 标签
    return el.textContent || el.innerText || '';
  }

  /* ---------- 通知 / 注入 ---------- */

  /**
   * 显示一条通知（使用 ST 的 toastr 或自定义 toast）
   * @param {string} text
   * @param {'info'|'success'|'warning'|'error'} [level='info']
   * @param {number} [duration=4000]
   */
  _notify(text, level = 'info', duration = 4000) {
    if (typeof window === 'undefined') return;

    // 优先使用 ST 内置的 toastr
    if (window.toastr && window.toastr[level]) {
      window.toastr[level](text, 'AI-GM', { timeOut: duration, closeButton: true });
      return;
    }

    // 备选：console
    console.log(`[AI-GM] ${level}: ${text}`);
  }

  /**
   * 将游戏叙事注入到 ST 聊天末尾（作为系统/旁白消息）
   * 注意：这会创建一个新的 DOM 元素，不会进入 ST 的保存/导出流程
   * 仅用于增强即时沉浸感。默认关闭（injectToChat: false）
   * @param {string} content
   * @param {string} [type='narration'] — 'narration' | 'dice' | 'combat' | 'scene'
   */
  injectChatMessage(content, type = 'narration') {
    if (!this.injectToChat || typeof document === 'undefined') return;

    const chatContainer = document.getElementById('chat');
    if (!chatContainer) return;

    const icons = {
      narration: '📜',
      dice: '🎲',
      combat: '⚔️',
      scene: '🏰',
      item: '📦',
      npc: '👤',
    };

    const wrapper = document.createElement('div');
    wrapper.className = 'mes ai-gm-system-inject';
    wrapper.style.cssText = 'opacity:0.85; font-style:italic; border-left:3px solid #8b5cf6; padding-left:8px; margin:4px 0;';
    wrapper.innerHTML = `
      <div class="mes_text" style="color:#a78bfa;">
        <small>${icons[type] || '🔹'} AI-GM</small><br/>
        ${this._escapeHtml(content)}
      </div>
    `;

    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 3 秒后自动淡化（可选）
    setTimeout(() => {
      wrapper.style.transition = 'opacity 2s ease';
      wrapper.style.opacity = '0.5';
    }, 5000);
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export default STChatBridge;
