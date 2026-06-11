/**
 * Intent Parser
 * Parses player natural language input into structured game intents
 *
 * Supports:
 * - Rule-based fast path (80% of common inputs)
 * - LLM-enhanced parsing for complex/ambiguous inputs
 *
 * Intent types: talk, investigate, move, attack, use_item, check, flee,
 *               search, read, take, give, help, threaten, rest, cast,
 *               examine, open, close, listen, sneak, hide, follow, unknown
 *
 * @version 0.4.0
 */

/**
 * Parsed intent result
 * @typedef {Object} ParsedIntent
 * @property {string} type - Intent type
 * @property {number} confidence - 0.0-1.0
 * @property {string} target - Target entity (NPC ID, item, scene, exit)
 * @property {Object} params - Additional parameters
 * @property {string} raw - Original input
 * @property {string} reasoning - Why this intent was chosen
 */

export class IntentParser {
  /**
   * @param {Object} options
   * @param {LLMClient} options.llmClient - Optional LLM client
   * @param {boolean} options.useLLM - Enable LLM fallback (default: true)
   * @param {number} options.llmThreshold - Confidence threshold for LLM fallback (default: 0.6)
   */
  constructor(options = {}) {
    this.llmClient = options.llmClient || null;
    this.useLLM = options.useLLM !== false;
    this.llmThreshold = options.llmThreshold || 0.6;
  }

  /**
   * Parse player input into structured intent
   * @param {string} input - Raw player input
   * @param {Object} context - Game context (scene, npcs, exits, items)
   * @returns {Promise<ParsedIntent>}
   */
  async parse(input, context = {}) {
    if (!input || typeof input !== 'string') {
      return this._makeIntent('unknown', 0, null, {}, input, 'Empty or invalid input');
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return this._makeIntent('unknown', 0, null, {}, input, 'Empty input');
    }

    // 1. Rule-based fast path
    const ruleResult = this._ruleBasedParse(trimmed, context);
    if (ruleResult.confidence >= 0.85) {
      return ruleResult;
    }

    // 2. Medium confidence — try LLM if available
    if (this.useLLM && this.llmClient && ruleResult.confidence < this.llmThreshold) {
      try {
        const llmResult = await this._llmParse(trimmed, context);
        if (llmResult.confidence > ruleResult.confidence) {
          return llmResult;
        }
      } catch (error) {
        console.warn('[IntentParser] LLM parse failed:', error.message);
      }
    }

    return ruleResult;
  }

  /**
   * Batch parse multiple inputs (efficient for preprocessing)
   * @param {string[]} inputs
   * @param {Object} context
   * @returns {Promise<ParsedIntent[]>}
   */
  async parseBatch(inputs, context = {}) {
    return Promise.all(inputs.map((input) => this.parse(input, context)));
  }

  // ==================== Rule-Based Parsing ====================

  /**
   * Fast rule-based intent parsing
   * @private
   */
  _ruleBasedParse(input, context) {
    const lower = input.toLowerCase();

    // === 0. Dice rolls (not an action, but detected) ===
    if (/^\d*d\d+/.test(input) || /^\/?r(oll)?\s+/i.test(input)) {
      return this._makeIntent('dice_roll', 0.95, null, { expression: input.replace(/^\/?r(oll)?\s+/i, '') }, input, 'Dice roll expression');
    }

    // === 1. Talk / Address NPC ===
    const talkMatch = this._matchTalk(input, lower, context);
    if (talkMatch) return talkMatch;

    // === 2. Movement / Scene transitions ===
    const moveMatch = this._matchMove(input, lower, context);
    if (moveMatch) return moveMatch;

    // === 3. Combat / Attack ===
    const attackMatch = this._matchAttack(input, lower, context);
    if (attackMatch) return attackMatch;

    // === 4. Look / Observe (before investigate to catch "look around") ===
    const lookMatch = this._matchLook(input, lower, context);
    if (lookMatch) return lookMatch;

    // === 5. Investigation / Search / Check ===
    const investigateMatch = this._matchInvestigate(input, lower, context);
    if (investigateMatch) return investigateMatch;

    // === 6. Item interaction ===
    const itemMatch = this._matchItemInteraction(input, lower, context);
    if (itemMatch) return itemMatch;

    // === 7. Knowledge / Reading ===
    const readMatch = this._matchRead(input, lower, context);
    if (readMatch) return readMatch;

    // === 8. Social / Emotional ===
    const socialMatch = this._matchSocial(input, lower, context);
    if (socialMatch) return socialMatch;

    // === 9. Stealth / Survival ===
    const stealthMatch = this._matchStealth(input, lower, context);
    if (stealthMatch) return stealthMatch;

    // === 10. Magic / Occult ===
    const magicMatch = this._matchMagic(input, lower, context);
    if (magicMatch) return magicMatch;

    // === 11. Rest / Recovery ===
    const restMatch = this._matchRest(input, lower, context);
    if (restMatch) return restMatch;

    // === 12. Flee / Escape ===
    const fleeMatch = this._matchFlee(input, lower, context);
    if (fleeMatch) return fleeMatch;

    // === 13. Follow (movement variant) ===
    const followMatch = this._matchFollowMove(input, lower, context);
    if (followMatch) return followMatch;

    // Default: unknown with moderate confidence (might be creative roleplay)
    return this._makeIntent('unknown', 0.3, null, {}, input, 'No matching pattern');
  }

  // --- Pattern Matchers ---

  _matchTalk(input, lower, context) {
    const talkPatterns = [
      { regex: /^(?:问|询问|和|跟|对|向|找)(.+?)(?:说话|聊聊|对话|打听|问|说|谈)/, action: 'talk' },
      { regex: /^(?:say|tell|ask|talk to|speak to|chat with)\s+(.+)/i, action: 'talk' },
      { regex: /^(?:tell|say)\s+(.+?)\s+(?:to|about)\s+(.+)/i, action: 'talk' },
      { regex: /^(?:问|询问|打听)\s*(.+)/, action: 'talk' },
      { regex: /^(?:".+?"|'.+?')/, action: 'talk' }, // Quoted dialogue
      { regex: /^\s*["'][^"']+["']\s*$/, action: 'talk' }, // Pure dialogue
    ];

    for (const pattern of talkPatterns) {
      const match = input.match(pattern.regex);
      if (match) {
        let target = null;
        let topic = null;

        if (pattern.action === 'talk') {
          if (match[1]) {
            const cleaned = this._cleanTargetName(match[1]);
            target = this._findEntity(cleaned, context.npcs, 'npc') ||
                     this._findEntityByPartial(cleaned, context.npcs, 'npc');
          }
          if (match[2]) {
            topic = match[2].trim();
          }
        }

        // Try to find target from quoted text if no explicit target
        if (!target && input.match(/^["']/)) {
          // This is direct speech — find nearest NPC in context
          target = this._findNearestNPC(context);
        }

        return this._makeIntent(
          'talk',
          0.88,
          target,
          { topic, direct_speech: input.match(/^["']/) !== null },
          input,
          `Pattern match: talk ${target ? 'to ' + target : 'nearby NPC'}`
        );
      }
    }
    return null;
  }

  _matchMove(input, lower, context) {
    const movePatterns = [
      { regex: /^(?:去|前往|到|进入|走|去)(.+)/, action: 'move' },
      { regex: /^(?:go|move|head|walk|enter|proceed to)\s+(.+)/i, action: 'move' },
      { regex: /^(?:leave|exit|escape from)\s+(.+)/i, action: 'move' },
      { regex: /^(?:return|go back|back to)\s+(.+)/i, action: 'move' },
    ];

    for (const pattern of movePatterns) {
      const match = input.match(pattern.regex);
      if (match) {
        const cleaned = this._cleanTargetName(match[1]);
        const target = this._findEntity(cleaned, context.exits, 'exit') ||
                        this._findEntity(cleaned, context.scenes, 'scene') ||
                        match[1].trim();
        return this._makeIntent(
          pattern.action,
          0.9,
          target,
          { destination: target },
          input,
          `Pattern match: ${pattern.action} to ${target}`
        );
      }
    }
    return null;
  }

  _matchAttack(input, lower, context) {
    const attackPatterns = [
      { regex: /^(?:攻击|打|杀|射击|开火|挥刀|砍|刺)(.+)/, action: 'attack' },
      { regex: /^(?:attack|fight|hit|strike|shoot|stab|kill|fire at)\s+(.+)/i, action: 'attack' },
      { regex: /^(?:punch|kick|slap|throw|cast at)\s+(.+)/i, action: 'attack' },
      { regex: /^(?:wield)\s+(.+?)\s+(?:against|at)\s+(.+)/i, action: 'attack' },
      { regex: /^(?:战斗|开战|战斗开始)/, action: 'attack' },
    ];

    for (const pattern of attackPatterns) {
      const match = input.match(pattern.regex);
      if (match) {
        let target = null;
        let weapon = null;

        if (match[2]) {
          weapon = this._findEntity(this._cleanTargetName(match[1]), context.items, 'item') || match[1].trim();
          target = this._findEntity(this._cleanTargetName(match[2]), context.npcs, 'npc') ||
                   this._findEntity(this._cleanTargetName(match[2]), context.enemies, 'enemy') ||
                   match[2].trim();
        } else if (match[1]) {
          target = this._findEntity(this._cleanTargetName(match[1]), context.npcs, 'npc') ||
                   this._findEntity(this._cleanTargetName(match[1]), context.enemies, 'enemy') ||
                   match[1].trim();
        }

        return this._makeIntent(
          'attack',
          0.92,
          target,
          { weapon },
          input,
          `Pattern match: attack ${target || 'target'}`
        );
      }
    }
    return null;
  }

  _matchInvestigate(input, lower, context) {
    const investigatePatterns = [
      { regex: /^(?:调查|检查|查看|搜索|侦查|侦察|搜寻|寻找)(.+)/, action: 'investigate' },
      { regex: /^(?:investigate|inspect|search|examine|check|look for|find|scout)\s+(.+)/i, action: 'investigate' },
      { regex: /^(?:search|investigate|look into)\s*$/i, action: 'investigate' },
      { regex: /^(?:使用|用)(.+)/, action: 'investigate' },
      { regex: /^(?:分析|研究|解读|调查)(.+)/, action: 'investigate' },
      { regex: /^(?:心理学|医学|神秘学|历史|语言|图书馆|侦查|聆听|追踪|开锁|潜行|攀爬|说服|恐吓)(.+)/, action: 'investigate' },
      { regex: /^(?:使用|用)(.+?)(?:在|于|对)(.+)/, action: 'use_item' },
      { regex: /^(?:use)\s+(.+?)\s+(?:to|on)\s+(.+)/i, action: 'use_item' },
      { regex: /^(?:感知|察觉|感觉|闻到|听到|看到)/, action: 'check' },
      { regex: /^(?:perception|spot|sense|notice|hear|smell|feel|detect)\s+(.+)/i, action: 'check' },
      { regex: /^(?:roll|检定|投骰)\s+(.+)/i, action: 'check' },
    ];

    for (const pattern of investigatePatterns) {
      const match = input.match(pattern.regex);
      if (match) {
        let target = null;
        let skill = null;

        if (pattern.action === 'use_item') {
          const cleanedTarget = this._cleanTargetName(match[2]);
          target = this._findEntity(cleanedTarget, context.items, 'item') ||
                   this._findEntity(cleanedTarget, context.objects, 'object') ||
                   this._findEntity(cleanedTarget, context.exits, 'exit') ||
                   match[2].trim();
          const cleanedItem = this._cleanTargetName(match[1]);
          const item = this._findEntity(cleanedItem, context.items, 'item') ||
                       this._findEntity(cleanedItem, context.objects, 'object') ||
                       match[1].trim();
          return this._makeIntent(
            'use_item',
            0.87,
            target,
            { item, tool: item },
            input,
            `Pattern match: use ${item} on ${target}`
          );
        }

        if (match[1]) {
          const cleaned = this._cleanTargetName(match[1]);
          target = this._findEntity(cleaned, context.objects, 'object') ||
                   this._findEntity(cleaned, context.items, 'item') ||
                   this._findEntity(cleaned, context.scenes, 'scene') ||
                   ((context.scene && (context.scene.id === cleaned || context.scene.title?.toLowerCase().includes(cleaned))) ? context.scene.id : null) ||
                   match[1].trim();
          // Try to extract skill name from the FULL input, not just match[1]
          skill = this._extractSkill(input);
        } else {
          skill = this._extractSkill(input);
        }

        return this._makeIntent(
          pattern.action,
          0.85,
          target,
          { skill, broad: !target },
          input,
          `Pattern match: ${pattern.action} ${target || 'area'}`
        );
      }
    }
    return null;
  }

  _matchItemInteraction(input, lower, context) {
    const itemPatterns = [
      { regex: /^(?:捡起|拿起|拿取|获取|拾取)(.+)/, action: 'take' },
      { regex: /^(?:pick up|take|grab|get|collect|loot)\s+(.+)/i, action: 'take' },
      { regex: /^(?:放下|丢弃|扔掉|丢掉)(.+)/, action: 'drop' },
      { regex: /^(?:drop|put down|discard|throw away)\s+(.+)/i, action: 'drop' },
      { regex: /^(?:给|交给|递给)(.+?)(?:给|交给|递给|送)(.+)/, action: 'give' },
      { regex: /^(?:give|hand|pass|offer)\s+(.+?)\s+(?:to|for)\s+(.+)/i, action: 'give' },
      { regex: /^(?:装备|穿戴|穿上)(.+)/, action: 'equip' },
      { regex: /^(?:equip|wear|put on|wield)\s+(.+)/i, action: 'equip' },
      { regex: /^(?:consume|drink|eat|activate)\s+(.+)/i, action: 'use_item' },
      { regex: /^(?:消耗|喝|吃|激活)(.+)/, action: 'use_item' },
      { regex: /^(?:open|close|unlock|lock)\s+(.+)/i, action: 'open' },
      { regex: /^(?:打开|关上|锁上|解锁)(.+)/, action: 'open' },
    ];

    for (const pattern of itemPatterns) {
      const match = input.match(pattern.regex);
      if (match) {
        let target = null;
        let item = null;

        if (match[2]) {
          item = this._findEntity(this._cleanTargetName(match[1]), context.items, 'item') || match[1].trim();
          target = this._findEntity(this._cleanTargetName(match[2]), context.npcs, 'npc') || match[2].trim();
        } else if (match[1]) {
          const cleaned = this._cleanTargetName(match[1]);
          item = this._findEntity(cleaned, context.items, 'item') ||
                 this._findEntity(cleaned, context.objects, 'object') ||
                 this._findEntity(cleaned, context.exits, 'exit') ||
                 match[1].trim();
        }

        return this._makeIntent(
          pattern.action,
          0.88,
          target || item,
          { item, target },
          input,
          `Pattern match: ${pattern.action} ${item || target || 'item'}`
        );
      }
    }
    return null;
  }

  _matchRead(input, lower, context) {
    const readPatterns = [
      { regex: /^(?:读|阅读|翻阅|看|阅读)(.+)/, action: 'read' },
      { regex: /^(?:read|peruse|decipher|decode|research|study)\s+(.+)/i, action: 'read' },
      { regex: /^(?:翻译|解读|破译|研究)(.+)/, action: 'read' },
      { regex: /^(?:translate|decipher|decode|research|study)\s+(.+)/i, action: 'read' },
    ];

    for (const pattern of readPatterns) {
      const match = input.match(pattern.regex);
      if (match) {
        const cleaned = this._cleanTargetName(match[1]);
        const target = this._findEntity(cleaned, context.items, 'item') ||
                       this._findEntity(cleaned, context.objects, 'object') ||
                       match[1].trim();
        return this._makeIntent(
          pattern.action,
          0.85,
          target,
          { subject: target },
          input,
          `Pattern match: read/study ${target}`
        );
      }
    }
    return null;
  }

  _matchSocial(input, lower, context) {
    const socialPatterns = [
      { regex: /^(?:帮助|协助|支援|援助)(.+)/, action: 'help' },
      { regex: /^(?:help|assist|aid|support)\s+(.+)/i, action: 'help' },
      { regex: /^(?:威胁|恐吓|威胁|逼迫|施压)(.+)/, action: 'threaten' },
      { regex: /^(?:threaten|intimidate|warn|menace)\s+(.+)/i, action: 'threaten' },
      { regex: /^(?:安慰|安抚|鼓励|说服|劝说)(.+)/, action: 'help' },
      { regex: /^(?:comfort|soothe|encourage|persuade|convince)\s+(.+)/i, action: 'help' },
      { regex: /^(?:欺骗|撒谎|伪装|假装|骗)(.+)/, action: 'deceive' },
      { regex: /^(?:deceive|lie|bluff|pretend|fake|trick)\s+(.+)/i, action: 'deceive' },
      { regex: /^(?:贿赂|收买|给)(.+?)(?:钱|金币|好处)(.+)/, action: 'bribe' },
      { regex: /^(?:bribe|pay off|buy)\s+(.+)/i, action: 'bribe' },
    ];

    for (const pattern of socialPatterns) {
      const match = input.match(pattern.regex);
      if (match) {
        const cleaned = this._cleanTargetName(match[1]);
        const target = this._findEntity(cleaned, context.npcs, 'npc') || match[1].trim();
        return this._makeIntent(
          pattern.action,
          0.82,
          target,
          {},
          input,
          `Pattern match: ${pattern.action} ${target}`
        );
      }
    }
    return null;
  }

  _matchStealth(input, lower, context) {
    const stealthPatterns = [
      { regex: /^(?:躲藏|藏起来|藏起来|藏起来|藏起来|藏起来|藏起来)/, action: 'hide' },
      { regex: /^(?:hide|conceal|stay hidden)\s*$/i, action: 'hide' },
      { regex: /^(?:潜行|偷偷|悄悄|隐蔽|躲起来|隐藏|藏起来|跟踪|尾随)(.+)/, action: 'sneak' },
      { regex: /^(?:sneak|stealth|tailing|shadow|stalk)\s+(.+)/i, action: 'sneak' },
      { regex: /^(?:follow|tail|shadow|track|pursue)\s+(.+)/i, action: 'follow' },
      { regex: /^(?:跟踪|尾随|追随|追踪|盯着|监视)(.+)/, action: 'follow' },
      { regex: /^(?:listen|eavesdrop|overhear|monitor)\s+(.+)/i, action: 'listen' },
      { regex: /^(?:听|偷听|监听|聆听|注意听)(.+)/, action: 'listen' },
    ];

    for (const pattern of stealthPatterns) {
      const match = input.match(pattern.regex);
      if (match) {
        const target = match[1] ?
          (this._findEntity(this._cleanTargetName(match[1]), context.npcs, 'npc') || match[1].trim()) : null;
        const skill = this._extractSkill(input);
        return this._makeIntent(
          pattern.action,
          0.85,
          target,
          { stealth: true, skill },
          input,
          `Pattern match: ${pattern.action} ${target || ''}`
        );
      }
    }
    return null;
  }

  _matchMagic(input, lower, context) {
    const magicPatterns = [
      { regex: /^(?:施法|施放|念咒|召唤|仪式|献祭|祈祷|诅咒)(.+)/, action: 'cast' },
      { regex: /^(?:cast|cast spell|invoke|summon|ritual|sacrifice|pray|curse|perform)\s+(.+)/i, action: 'cast' },
      { regex: /^(?:使用|施展|释放)(.+?)(?:魔法|法术|咒术|咒语|仪式)/, action: 'cast' },
      { regex: /^(?:use|channel|focus)\s+(.+?)\s+(?:magic|spell|power|energy)/i, action: 'cast' },
    ];

    for (const pattern of magicPatterns) {
      const match = input.match(pattern.regex);
      if (match) {
        const spell = match[1] ? match[1].trim() : 'unknown';
        return this._makeIntent(
          'cast',
          0.88,
          null,
          { spell },
          input,
          `Pattern match: cast spell ${spell}`
        );
      }
    }
    return null;
  }

  _matchRest(input, lower, context) {
    const restPatterns = [
      { regex: /^(?:休息|睡觉|恢复|治疗|包扎|坐下|躺下)/, action: 'rest' },
      { regex: /^(?:rest|sleep|recover|heal|treat wounds|bandage|sit down|lie down)\b/i, action: 'rest' },
      { regex: /^(?:wait|stay|camp|set up camp|make camp)\b/i, action: 'rest' },
      { regex: /^(?:等待|守候|扎营|露营|停留)/, action: 'rest' },
    ];

    for (const pattern of restPatterns) {
      if (pattern.regex.test(input)) {
        return this._makeIntent(
          'rest',
          0.8,
          null,
          { duration: 'short' },
          input,
          'Pattern match: rest/recovery'
        );
      }
    }
    return null;
  }

  _matchFlee(input, lower, context) {
    const fleePatterns = [
      { regex: /^(?:逃跑|逃离|逃走|撤退|跑|快跑|离开|撤离|逃命)(.+)?/, action: 'flee' },
      { regex: /^(?:run|flee|escape|retreat|withdraw|get away|break away|run away)\b/i, action: 'flee' },
    ];

    for (const pattern of fleePatterns) {
      const match = input.match(pattern.regex);
      if (match) {
        const destination = match[1] ?
          (this._findEntity(this._cleanTargetName(match[1]), context.exits, 'exit') || match[1].trim()) : null;
        return this._makeIntent(
          'flee',
          0.9,
          destination,
          { destination },
          input,
          `Pattern match: flee ${destination || 'away'}`
        );
      }
    }
    return null;
  }

  _matchLook(input, lower, context) {
    const lookPatterns = [
      { regex: /^(?:环顾|四周|环顾四周)/, action: 'look' },
      { regex: /^(?:observe|survey|glance|peek|scan)\b/i, action: 'look' },
    ];

    for (const pattern of lookPatterns) {
      if (pattern.regex.test(input)) {
        return this._makeIntent(
          'look',
          0.85,
          null,
          { scope: 'room' },
          input,
          'Pattern match: look around'
        );
      }
    }
    return null;
  }

  /**
   * Follow as movement (when target is an NPC, not stealth)
   * @private
   */
  _matchFollowMove(input, lower, context) {
    const followPatterns = [
      { regex: /^(?:跟随|跟着|追随|跟着)(.+)/, action: 'follow' },
      { regex: /^(?:follow|go after|chase)\s+(.+)/i, action: 'follow' },
    ];

    for (const pattern of followPatterns) {
      const match = input.match(pattern.regex);
      if (match) {
        const cleaned = this._cleanTargetName(match[1]);
        const target = this._findEntity(cleaned, context.npcs, 'npc') ||
                        this._findEntity(cleaned, context.enemies, 'enemy') ||
                        match[1].trim();
        return this._makeIntent(
          pattern.action,
          0.85,
          target,
          { target },
          input,
          `Pattern match: follow ${target}`
        );
      }
    }
    return null;
  }

  // ==================== LLM Parsing ====================

  /**
   * LLM-enhanced parsing for ambiguous/complex inputs
   * @private
   */
  async _llmParse(input, context) {
    if (!this.llmClient || !this.llmClient.isAvailable()) {
      return this._makeIntent('unknown', 0.3, null, {}, input, 'LLM not available');
    }

    const systemPrompt = `You are an RPG intent parser. Analyze the player's input and determine their intended action.

Available intent types:
- talk: speak to an NPC or make dialogue
- investigate: search, examine, inspect, check something
- move: go to a location, enter, exit, follow
- attack: fight, strike, shoot, kill, use weapon
- use_item: use, equip, consume, drink, read an item
- check: perform a skill check, roll dice, perception
- flee: run away, escape, retreat
- search: look for something specific
- read: read, study, translate, decipher text
- take: pick up, grab, collect, loot
- give: hand, pass, offer to someone
- help: assist, heal, comfort, persuade
- threaten: intimidate, warn, menace
- rest: sleep, recover, heal, wait
- cast: cast spell, perform ritual, summon
- sneak: hide, sneak, tail, eavesdrop
- listen: listen, eavesdrop, monitor
- open: open, close, unlock, lock door/container
- follow: follow, track, pursue someone
- unknown: unclear or creative roleplay

Respond with JSON:
{
  "intent": "type",
  "confidence": 0.0-1.0,
  "target": "target entity or null",
  "params": { "key": "value" },
  "reasoning": "brief explanation"
}`;

    const contextDesc = this._buildContextDescription(context);
    const prompt = `Player input: "${input}"
${contextDesc}

What is the player's intent?`;

    try {
      const result = await this.llmClient.chatJSON(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.2, maxTokens: 256 }
      );

      if (result.error) {
        throw new Error(result.error);
      }

      return this._makeIntent(
        result.intent || 'unknown',
        Math.max(0.3, Math.min(1.0, parseFloat(result.confidence) || 0.5)),
        result.target || null,
        result.params || {},
        input,
        result.reasoning || 'LLM parsed'
      );
    } catch (error) {
      console.warn('[IntentParser] LLM parse error:', error.message);
      return this._makeIntent('unknown', 0.3, null, {}, input, 'LLM parse failed');
    }
  }

  // ==================== Helpers ====================

  /**
   * Clean entity name by removing common stop words
   * @private
   */
  _cleanTargetName(name) {
    if (!name) return '';
    const stopWords = ['the', 'a', 'an', 'to', 'on', 'at', 'for', 'with', 'from', 'of', 'in', 'into'];
    let cleaned = name.toLowerCase().trim();
    for (const sw of stopWords) {
      cleaned = cleaned.replace(new RegExp(`^${sw}\\s+`, 'i'), '');
    }
    return cleaned.trim();
  }

  _makeIntent(type, confidence, target, params, raw, reasoning) {
    return {
      type,
      confidence,
      target,
      params,
      raw,
      reasoning,
    };
  }

  _findEntity(name, entityMap, entityType) {
    if (!entityMap || !name) return null;

    const lowerName = name.toLowerCase().trim();

    // Direct ID match
    if (entityMap[lowerName]) return lowerName;

    // Name match (if entities have names)
    for (const [id, entity] of Object.entries(entityMap)) {
      if (typeof entity === 'string') {
        if (entity.toLowerCase().includes(lowerName)) return id;
      } else if (entity && entity.name) {
        const entityName = entity.name.toLowerCase();
        if (entityName === lowerName || entityName.includes(lowerName)) return id;
      }
    }

    return null;
  }

  /**
   * Find entity by checking if any entity name is contained within the input
   * @private
   */
  _findEntityByPartial(input, entityMap, entityType) {
    if (!entityMap || !input) return null;
    const lowerInput = input.toLowerCase().trim();

    for (const [id, entity] of Object.entries(entityMap)) {
      if (typeof entity === 'string') {
        const lowerEntity = entity.toLowerCase();
        if (lowerInput.includes(lowerEntity)) return id;
      } else if (entity && entity.name) {
        const lowerEntity = entity.name.toLowerCase();
        if (lowerInput.includes(lowerEntity)) return id;
      }
    }
    return null;
  }

  _findNearestNPC(context) {
    if (!context.npcs) return null;
    const npcs = Object.entries(context.npcs);
    if (npcs.length === 0) return null;
    // Return first NPC ID (simplest heuristic)
    return npcs[0][0];
  }

  _extractSkill(text) {
    if (!text) return null;
    const lower = text.toLowerCase();

    const skillMap = {
      'library use': ['图书馆', '图书', 'library', 'research', '查找'],
      'spot hidden': ['侦查', 'spot', '观察', '发现', 'hidden', 'look for'],
      'listen': ['聆听', 'listen', '听', 'hear'],
      'psychology': ['心理学', 'psychology', '读心', '心理'],
      'persuade': ['说服', 'persuade', '劝说', 'negotiate'],
      'intimidate': ['恐吓', 'intimidate', '威胁', '吓唬'],
      'medicine': ['医学', 'medicine', '治疗', '急救', 'first aid'],
      'occult': ['神秘学', 'occult', '神秘', '魔法', '法术'],
      'history': ['历史', 'history', '考古', 'artifact'],
      'languages': ['语言', 'languages', '翻译', 'translate', 'read'],
      'climb': ['攀爬', 'climb', '爬', '攀登'],
      'locksmith': ['开锁', 'locksmith', '锁', 'pick lock'],
      'stealth': ['潜行', 'stealth', '躲藏', 'hide', 'sneak'],
      'track': ['追踪', 'track', '跟踪', 'follow', 'trail'],
    };

    for (const [skill, keywords] of Object.entries(skillMap)) {
      if (keywords.some((k) => lower.includes(k))) return skill;
    }

    return null;
  }

  _buildContextDescription(context) {
    const parts = [];

    if (context.scene) {
      parts.push(`Current scene: ${context.scene.title || context.scene}`);
    }
    if (context.npcs && Object.keys(context.npcs).length > 0) {
      const npcList = Object.entries(context.npcs)
        .map(([id, npc]) => {
          const name = typeof npc === 'string' ? npc : (npc.name || id);
          return name;
        })
        .join(', ');
      parts.push(`NPCs present: ${npcList}`);
    }
    if (context.exits && Object.keys(context.exits).length > 0) {
      const exitList = Object.entries(context.exits)
        .map(([id, exit]) => {
          const name = typeof exit === 'string' ? exit : (exit.name || id);
          return name;
        })
        .join(', ');
      parts.push(`Exits: ${exitList}`);
    }
    if (context.items && Object.keys(context.items).length > 0) {
      const itemList = Object.entries(context.items)
        .map(([id, item]) => {
          const name = typeof item === 'string' ? item : (item.name || id);
          return name;
        })
        .join(', ');
      parts.push(`Items nearby: ${itemList}`);
    }

    return parts.length > 0 ? `Context:\n${parts.join('\n')}` : 'No additional context.';
  }

  /**
   * Get parser statistics
   * @returns {Object}
   */
  getStats() {
    return {
      useLLM: this.useLLM,
      llmAvailable: this.llmClient ? this.llmClient.isAvailable() : false,
      threshold: this.llmThreshold,
    };
  }
}

export default IntentParser;
