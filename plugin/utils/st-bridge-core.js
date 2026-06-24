/**
 * ST Bridge Core — 纯逻辑部分，零依赖（不依赖 window/document/eventSource 等 ST 全局变量）
 *
 * 职责：
 * 1. 消息缓存管理（LRU / 环形缓冲区）
 * 2. 动作解析与关键词匹配
 * 3. 上下文格式化
 *
 * 所有函数均为纯函数或可测试的工厂函数，DOM/ST 侧由 st-chat-bridge.js 调用。
 */

/** @type {string[]} 游戏动作关键词（中英双语） */
export const GAME_KEYWORDS = [
  // 中文
  '去',
  '走',
  '前往',
  '进入',
  '到',
  '离开',
  '返回',
  '检查',
  '查看',
  '调查',
  '侦查',
  '搜索',
  '观察',
  '环顾',
  '攻击',
  '打',
  '杀',
  '战斗',
  '射击',
  '开枪',
  '格斗',
  '说',
  '问',
  '告诉',
  '对话',
  '交谈',
  '打听',
  '使用',
  '用',
  '消耗',
  '装备',
  '打开',
  '关闭',
  '拿起',
  '拿',
  '取',
  '拾取',
  '放下',
  '给',
  '检定',
  '骰',
  '投',
  'roll',
  '鉴定',
  '逃跑',
  '撤退',
  '撤离',
  '跑',
  '休息',
  '治疗',
  '恢复',
  '包扎',
  '睡觉',
  '读',
  '阅读',
  '翻阅',
  '研究',
  '翻译',
  '解读',
  '跟随',
  '跟踪',
  '尾随',
  '监视',
  '躲藏',
  '藏起来',
  '潜行',
  '偷偷',
  '聆听',
  '听',
  '偷听',
  '施法',
  '施展',
  '念咒',
  '召唤',
  '仪式',
  // 英文
  'go',
  'move',
  'walk',
  'enter',
  'leave',
  'exit',
  'head',
  'proceed',
  'check',
  'examine',
  'inspect',
  'look',
  'search',
  'investigate',
  'observe',
  'scout',
  'attack',
  'fight',
  'hit',
  'strike',
  'shoot',
  'stab',
  'kill',
  'combat',
  'talk',
  'speak',
  'ask',
  'tell',
  'say',
  'chat',
  'conversation',
  'dialogue',
  'use',
  'equip',
  'consume',
  'activate',
  'open',
  'close',
  'pick',
  'take',
  'grab',
  'give',
  'drop',
  'roll',
  'dice',
  'check',
  'test',
  'skill',
  'flee',
  'run',
  'escape',
  'retreat',
  'withdraw',
  'rest',
  'sleep',
  'heal',
  'recover',
  'treat',
  'read',
  'study',
  'research',
  'translate',
  'decipher',
  'follow',
  'tail',
  'shadow',
  'track',
  'pursue',
  'hide',
  'sneak',
  'stealth',
  'conceal',
  'listen',
  'eavesdrop',
  'overhear',
  'cast',
  'spell',
  'invoke',
  'summon',
  'ritual',
  'magic',
];

/**
 * 判断用户输入是否应作为游戏动作处理
 *
 * @param {string} input 用户原始输入
 * @param {boolean} autoParse 是否启用自动关键词匹配
 * @returns {boolean}
 */
export function shouldProcessAsGameAction(input, autoParse) {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();

  // 命令前缀模式：以 /gm 开头总是处理
  if (trimmed.startsWith('/gm')) return true;

  // 自动解析模式：关键词匹配
  if (autoParse) {
    const lower = trimmed.toLowerCase();
    return GAME_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
  }

  return false;
}

/**
 * 去掉 /gm 前缀，得到纯动作输入
 *
 * @param {string} text
 * @returns {string}
 */
export function stripGmPrefix(text) {
  return text.replace(/^\/gm\s*/, '').trim();
}

/**
 * 创建消息缓存对象（封装数组操作，自动 LRU 淘汰）
 *
 * @param {number} maxSize 最大保留条数
 * @returns {{ push: Function, getAll: Function, clear: Function, size: number }}
 */
export function createMessageCache(maxSize = 20) {
  const buffer = [];

  return {
    /** @param {{role:string,text:string,id?:any,timestamp?:number}} msg */
    push(msg) {
      buffer.push(msg);
      if (buffer.length > maxSize) buffer.shift();
    },

    /** @returns {Array} 全部消息（按时间顺序） */
    getAll() {
      return buffer.slice();
    },

    /** 清空缓存 */
    clear() {
      buffer.length = 0;
    },

    /** @returns {number} 当前条数 */
    get size() {
      return buffer.length;
    },
  };
}

/**
 * 将消息列表格式化为 LLM 可用的上下文文本
 *
 * @param {Array<{role:string,text:string}>} messages
 * @param {number} [limit=10] 取最近 N 条
 * @returns {string}
 */
export function formatContext(messages, limit = 10) {
  return messages
    .slice(-limit)
    .map((m) => {
      const prefix = m.role === 'user' ? '玩家' : 'AI';
      return `${prefix}: ${m.text}`;
    })
    .join('\n');
}

/**
 * 生成去重键（用于 pendingActions Set）
 *
 * @param {Object} action
 * @param {string} action.type
 * @param {string} action.input
 * @param {number} [timestamp=Date.now()]
 * @returns {string}
 */
export function makeActionKey(action, timestamp = Date.now()) {
  return `${action.type}_${action.input}_${timestamp}`;
}

/**
 * 创建待处理动作去重集合（封装 Set，自动过期）
 *
 * @param {number} expireMs 过期时间（毫秒）
 * @returns {{ add: Function, has: Function, clear: Function, size: number }}
 */
export function createPendingSet(expireMs = 500) {
  const set = new Set();

  return {
    /** @param {string} key */
    add(key) {
      set.add(key);
      setTimeout(() => set.delete(key), expireMs);
    },

    /** @param {string} key @returns {boolean} */
    has(key) {
      return set.has(key);
    },

    /** 清空 */
    clear() {
      set.clear();
    },

    /** @returns {number} */
    get size() {
      return set.size;
    },
  };
}

/**
 * 将游戏动作输入标准化为结构对象
 *
 * @param {string} rawText 原始用户输入
 * @param {string} [source='chat'] 来源标识
 * @returns {{type:string, input:string, raw:string, source:string}}
 */
export function parseActionInput(rawText, source = 'chat') {
  return {
    type: 'player_input',
    input: stripGmPrefix(rawText),
    raw: rawText,
    source,
  };
}
