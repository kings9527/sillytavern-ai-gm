/**
 * NPC Decision Engine
 * Rule-driven NPC behavior with attitude state machine
 *
 * Implements: NPCDecisionEngineContract (plugin/contracts/index.js)
 * Consumed by: GameStateMachine.handleTalk, GameStateMachine.handleCombatInitiation
 *
 * @version 0.3.0
 */

import { NPCDecisionEngineContract } from '../contracts/index.js';

/**
 * NPC attitude state machine
 */
const ATTITUDE_STATES = {
  neutral: { hostility: 0, trust_needed: 40, aggression: 20 },
  friendly: { hostility: 0, trust_needed: 60, aggression: 10 },
  hostile: { hostility: 80, trust_needed: 0, aggression: 70 },
  afraid: { hostility: 10, trust_needed: 0, aggression: 5 },
  hostile_alerted: { hostility: 90, trust_needed: 0, aggression: 85 },
  hostile_fleeing: { hostility: 30, trust_needed: 0, aggression: 15 },
};

/**
 * Default attitude transitions based on situation
 */
const ATTITUDE_TRANSITIONS = {
  player_attack: {
    neutral: 'hostile',
    friendly: 'hostile',
    afraid: 'hostile_fleeing',
    hostile: 'hostile_alerted',
    hostile_alerted: 'hostile_alerted',
    hostile_fleeing: 'hostile_fleeing',
  },
  player_help: {
    neutral: 'friendly',
    friendly: 'friendly',
    afraid: 'neutral',
    hostile: 'neutral',
    hostile_alerted: 'afraid',
    hostile_fleeing: 'neutral',
  },
  player_threat: {
    neutral: 'afraid',
    friendly: 'afraid',
    afraid: 'hostile_fleeing',
    hostile: 'hostile_alerted',
    hostile_alerted: 'hostile_alerted',
    hostile_fleeing: 'hostile_fleeing',
  },
  combat_start: {
    neutral: 'hostile',
    friendly: 'hostile',
    afraid: 'hostile_fleeing',
    hostile: 'hostile_alerted',
    hostile_alerted: 'hostile_alerted',
    hostile_fleeing: 'hostile_fleeing',
  },
  combat_end_player_win: {
    hostile: 'afraid',
    hostile_alerted: 'afraid',
    hostile_fleeing: 'afraid',
  },
  combat_end_player_lose: {
    hostile: 'neutral',
    hostile_alerted: 'neutral',
    hostile_fleeing: 'neutral',
  },
};

export class NPCDecisionEngine extends NPCDecisionEngineContract {
  constructor(campaign, npcId) {
    super();
    this.campaign = campaign;
    this.npcId = npcId;
    this.npcState = this._ensureNPCState(campaign, npcId);
    this.npcTemplate = campaign.module?.npcs?.[npcId] || {};
    this._validateTemplate();
  }

  /**
   * Ensure NPC state exists in campaign, initialize with defaults
   * @private
   */
  _ensureNPCState(campaign, npcId) {
    if (!campaign.npcs_state) campaign.npcs_state = {};
    if (!campaign.npcs_state[npcId]) {
      const template = campaign.module?.npcs?.[npcId] || {};
      campaign.npcs_state[npcId] = {
        id: npcId,
        current_hp: template.hp || template.stats?.HP || 10,
        current_san: template.sanity || 50,
        attitude: template.attitude || 'neutral',
        trust: 30, // 0-100: player's trustworthiness
        fear: 20, // 0-100: fear of player/threats
        suspicion: 30, // 0-100: suspicion of player motives
        known_topics: [],
        secrets_revealed: [],
        current_action: null,
        turns_in_scene: 0,
        is_alive: true,
        custom_vars: {},
      };
    }
    return campaign.npcs_state[npcId];
  }

  /**
   * Validate template has required fields
   * @private
   */
  _validateTemplate() {
    if (!this.npcTemplate.name) {
      console.warn(`[NPCDecisionEngine] NPC ${this.npcId} missing name in template`);
    }
  }

  /**
   * Primary decision entry point
   * @param {Object} situation
   * @returns {Promise<NPCDecision>}
   */
  async decide(situation) {
    // 0. Death check — immediate
    if (!this.npcState.is_alive || this.npcState.current_hp <= 0) {
      return {
        action: 'dead',
        confidence: 1.0,
        reasoning: `${this.npcTemplate.name} 已死亡/无法行动`,
        mood: 'dead',
        target_id: null,
      };
    }

    const context = this._buildContext(situation);

    // 1. High-confidence rule-based decisions (confidence >= 0.85)
    const ruleDecision = this._ruleBasedDecision(context);
    if (ruleDecision.confidence >= 0.85) {
      this._updateAttitudeFromDecision(ruleDecision, situation);
      return ruleDecision;
    }

    // 2. Medium confidence — attitude-based default behavior
    const attitudeDecision = this._attitudeBasedDecision(context);
    if (attitudeDecision.confidence > 0.5) {
      this._updateAttitudeFromDecision(attitudeDecision, situation);
      return attitudeDecision;
    }

    // 3. Low confidence — LLM fallback (Phase 2)
    return this._llmFallback(context);
  }

  /**
   * Build rich context from situation + campaign state
   * @private
   */
  _buildContext(situation) {
    const player = this.campaign.player || {};
    const scene = this.campaign.module?.scenes?.[this.campaign.current_scene] || {};
    const isCombat = this.campaign.combat_state?.active === true;
    const isPlayerTurn =
      isCombat && this.campaign.combat_state?.current_turn?.startsWith?.('player');

    return {
      npc: this.npcState,
      template: this.npcTemplate,
      situation: situation || { type: 'idle' },
      campaign_state: {
        current_scene: this.campaign.current_scene,
        player_name: player.name || '调查员',
        player_hp_ratio: (player.hp || 12) / (player.max_hp || 12),
        player_san_ratio: (player.sanity || 60) / (player.max_sanity || 60),
        is_combat: isCombat,
        is_player_turn: isPlayerTurn,
        turn_count: this.campaign.turn || 1,
        global_flags: this.campaign.flags || {},
        scene_npcs: scene.npcs || [],
        scene_enemies: scene.combat?.enemies || [],
      },
      available_actions: this._getAvailableActions(),
    };
  }

  /**
   * Get available actions based on NPC role and state
   * @private
   */
  _getAvailableActions() {
    const actions = ['talk', 'emote', 'ignore'];
    const role = this.npcTemplate.role || 'neutral';

    if (role === 'enemy' || role === 'Boss' || this.npcState.attitude.startsWith('hostile')) {
      actions.push('attack', 'flee');
    }
    if (role === 'Boss') {
      actions.push('special_attack', 'summon', 'warn');
    }
    if (role === 'ally' || this.npcState.attitude === 'friendly') {
      actions.push('help', 'investigate', 'heal');
    }
    if (this.npcState.attitude === 'afraid') {
      actions.push('plead', 'flee');
    }

    return actions;
  }

  /**
   * Rule-based decision engine — covers 80% of cases deterministically
   * @private
   */
  _ruleBasedDecision(context) {
    const { npc, template, situation, campaign_state } = context;
    const hpMax = template.hp || template.stats?.HP || 10;
    const hpRatio = npc.current_hp / hpMax;
    const sanRatio = npc.current_san / (template.sanity || 50);
    const role = template.role || 'neutral';
    const attitude = npc.attitude;

    // === 0. Death / unconscious ===
    if (hpRatio <= 0) {
      return { action: 'dead', confidence: 1.0, reasoning: 'HP 归零', mood: 'dead' };
    }
    if (sanRatio <= 0.1 && role !== 'Boss') {
      return {
        action: 'flee',
        confidence: 0.92,
        reasoning: 'SAN 崩溃，失去理智逃跑',
        mood: 'terrified',
        target_id: 'player',
      };
    }

    // === 1. Critical HP — flee or desperate attack ===
    if (hpRatio < 0.25) {
      if (role === 'enemy' || attitude === 'hostile_alerted') {
        // Desperate: if Boss, fight to death; if minion, flee
        if (role === 'Boss') {
          return {
            action: 'special_attack',
            confidence: 0.9,
            reasoning: 'Boss 濒死，发动特殊攻击',
            mood: 'desperate',
            target_id: 'player',
          };
        }
        return {
          action: 'flee',
          confidence: 0.9,
          reasoning: 'HP 危急，试图逃跑',
          mood: 'panicked',
          target_id: 'player',
        };
      }
      if (role === 'ally') {
        return {
          action: 'flee',
          confidence: 0.88,
          reasoning: '盟友受伤严重，寻求安全',
          mood: 'wounded',
          target_id: 'player',
        };
      }
    }

    // === 2. Combat situations ===
    if (campaign_state.is_combat) {
      // If it's player's turn and NPC is not active, wait
      if (campaign_state.is_player_turn && role !== 'Boss') {
        return {
          action: 'ignore',
          confidence: 0.7,
          reasoning: '玩家回合，NPC 等待',
          mood: 'alert',
        };
      }

      // If NPC is hostile, attack
      if (role === 'enemy' || attitude.startsWith('hostile')) {
        // Low HP + fear → flee instead
        if (hpRatio < 0.3 && npc.fear > 60) {
          return {
            action: 'flee',
            confidence: 0.85,
            reasoning: '恐惧压倒战斗意志',
            mood: 'terrified',
            target_id: 'player',
          };
        }
        // Boss with HP > 50% → special attack occasionally
        if (role === 'Boss' && hpRatio > 0.5 && Math.random() < 0.3) {
          return {
            action: 'special_attack',
            confidence: 0.85,
            reasoning: 'Boss 发动强力技能',
            mood: 'dominant',
            target_id: 'player',
          };
        }
        return {
          action: 'attack',
          confidence: 0.9,
          reasoning: '战斗中进行攻击',
          mood: 'aggressive',
          target_id: 'player',
        };
      }

      // Ally in combat → help or attack enemies
      if (role === 'ally') {
        return {
          action: 'help',
          confidence: 0.85,
          reasoning: '盟友协助玩家战斗',
          mood: 'supportive',
          target_id: 'player',
        };
      }
    }

    // === 3. Player aggression response ===
    if (situation.type === 'player_attack') {
      npc.fear = Math.min(100, npc.fear + 30);
      npc.trust = Math.max(0, npc.trust - 40);
      if (role === 'enemy') {
        return {
          action: 'attack',
          confidence: 0.92,
          reasoning: '被玩家攻击，反击',
          mood: 'enraged',
          target_id: 'player',
        };
      }
      if (role === 'neutral') {
        return {
          action: 'flee',
          confidence: 0.88,
          reasoning: '无辜被攻击，恐惧逃跑',
          mood: 'terrified',
          target_id: 'player',
        };
      }
      if (role === 'ally') {
        npc.trust = Math.max(0, npc.trust - 60); // Betrayal!
        return {
          action: 'flee',
          confidence: 0.85,
          reasoning: '盟友背叛，心碎逃离',
          mood: 'betrayed',
          target_id: 'player',
        };
      }
    }

    // === 4. Player help/gift response ===
    if (situation.type === 'player_help') {
      npc.trust = Math.min(100, npc.trust + 25);
      npc.fear = Math.max(0, npc.fear - 15);
      if (attitude === 'afraid') {
        return {
          action: 'talk',
          confidence: 0.88,
          reasoning: '玩家帮助缓解了恐惧，尝试对话',
          mood: 'cautious',
          target_id: 'player',
          dialogue_topic: 'thanks',
        };
      }
      return {
        action: 'talk',
        confidence: 0.82,
        reasoning: '玩家帮助，表达感谢',
        mood: 'grateful',
        target_id: 'player',
        dialogue_topic: 'thanks',
      };
    }

    // === 5. Player threat/intimidation ===
    if (situation.type === 'player_threat') {
      npc.fear = Math.min(100, npc.fear + 25);
      npc.suspicion = Math.min(100, npc.suspicion + 20);
      if (role === 'enemy') {
        return {
          action: 'attack',
          confidence: 0.85,
          reasoning: '威胁激发敌意',
          mood: 'defiant',
          target_id: 'player',
        };
      }
      if (attitude === 'friendly') {
        npc.trust = Math.max(0, npc.trust - 30);
        return {
          action: 'flee',
          confidence: 0.78,
          reasoning: '朋友被威胁，恐惧',
          mood: 'hurt',
          target_id: 'player',
        };
      }
      return {
        action: 'ignore',
        confidence: 0.65,
        reasoning: '被威胁，保持沉默',
        mood: 'afraid',
        target_id: 'player',
      };
    }

    // === 6. Scene-specific: cult/secrets ===
    if (situation.type === 'player_talk' && situation.player_input) {
      const input = situation.player_input.toLowerCase();
      if (template.secrets && template.secrets.length > 0) {
        const secretKeywords = template.secrets
          .map((s) => s.keyword?.toLowerCase())
          .filter(Boolean);
        if (secretKeywords.some((k) => input.includes(k))) {
          if (npc.trust < 40) {
            npc.suspicion = Math.min(100, npc.suspicion + 20);
            return {
              action: 'evade',
              confidence: 0.85,
              reasoning: '触及敏感话题，回避',
              mood: 'suspicious',
              target_id: 'player',
              dialogue_topic: 'evade',
            };
          }
          if (npc.trust > 60 && !npc.secrets_revealed.includes(secretKeywords[0])) {
            npc.secrets_revealed.push(secretKeywords[0]);
            return {
              action: 'talk',
              confidence: 0.88,
              reasoning: '信任足够，透露秘密',
              mood: 'whispering',
              target_id: 'player',
              dialogue_topic: 'secret',
            };
          }
        }
      }
    }

    // === 7. Knowledge / topic tracking ===
    if (situation.type === 'player_talk') {
      const topic = this._extractTopic(situation.player_input);
      if (topic && !npc.known_topics.includes(topic)) {
        npc.known_topics.push(topic);
      }
    }

    // Default: no high-confidence rule matched
    return { action: null, confidence: 0, reasoning: 'No rule matched' };
  }

  /**
   * Attitude-based default behavior when rules are ambiguous
   * @private
   */
  _attitudeBasedDecision(context) {
    const { npc, template, situation } = context;
    const attitude = npc.attitude;
    const role = template.role || 'neutral';

    switch (attitude) {
      case 'friendly':
        return {
          action: 'talk',
          confidence: 0.7,
          reasoning: '友好态度，乐于交流',
          mood: 'friendly',
          target_id: 'player',
          dialogue_topic: 'greeting',
        };
      case 'hostile':
      case 'hostile_alerted':
        if (role === 'enemy') {
          return {
            action: 'attack',
            confidence: 0.65,
            reasoning: '敌对态度，准备攻击',
            mood: 'hostile',
            target_id: 'player',
          };
        }
        return {
          action: 'ignore',
          confidence: 0.6,
          reasoning: '敌对但非战斗角色，回避',
          mood: 'cold',
          target_id: 'player',
        };
      case 'afraid':
        return {
          action: 'flee',
          confidence: 0.65,
          reasoning: '恐惧中，保持距离',
          mood: 'scared',
          target_id: 'player',
        };
      case 'neutral':
      default:
        return {
          action: 'talk',
          confidence: 0.6,
          reasoning: '中立态度，保持礼貌',
          mood: 'neutral',
          target_id: 'player',
          dialogue_topic: 'greeting',
        };
    }
  }

  /**
   * LLM fallback for complex situations (Phase 2)
   * @private
   */
  _llmFallback(context) {
    const { template, situation } = context;
    let decision = 'talk';
    let mood = 'neutral';

    if (template.role === 'enemy') {
      decision = 'attack';
      mood = 'hostile';
    }
    if (template.role === 'Boss') {
      decision = 'special_attack';
      mood = 'dominant';
    }
    if (situation.type === 'combat_turn') {
      decision = 'attack';
      mood = 'focused';
    }

    return {
      action: decision,
      confidence: 0.5,
      reasoning: 'Default role-based decision (MVP fallback)',
      mood,
      target_id: 'player',
      dialogue_topic: situation.type === 'player_talk' ? 'generic' : null,
    };
  }

  /**
   * Update attitude state based on decision and situation
   * @private
   */
  _updateAttitudeFromDecision(decision, situation) {
    const type = situation?.type || 'idle';
    const transitions = ATTITUDE_TRANSITIONS[type];
    if (transitions && transitions[this.npcState.attitude]) {
      const oldAttitude = this.npcState.attitude;
      this.npcState.attitude = transitions[this.npcState.attitude];
      if (oldAttitude !== this.npcState.attitude) {
        this.npcState.current_action = `attitude_change:${oldAttitude}->${this.npcState.attitude}`;
      }
    }
  }

  /**
   * Extract topic from player input (simple keyword matching)
   * @private
   */
  _extractTopic(input) {
    if (!input) return null;
    const lower = input.toLowerCase();
    const topics = {
      cult: ['邪教', 'cult', '仪式', 'ritual', '崇拜'],
      book: ['书', 'book', '典籍', 'grimoire', 'necronomicon'],
      location: ['地下', 'basement', '密室', 'secret', '隐藏'],
      escape: ['逃跑', 'escape', '离开', 'leave', '出口'],
      help: ['帮助', 'help', '救', 'save', '援助'],
      threat: ['威胁', 'threat', '杀', 'kill', '死'],
    };
    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some((k) => lower.includes(k))) return topic;
    }
    return 'generic';
  }

  /**
   * Generate dialogue for NPC (MVP: template-based, Phase 2: LLM)
   * @param {string} contextSummary — Brief situation description
   * @param {string} mood — From decision.mood
   * @param {string} [topic] — Suggested dialogue topic
   * @returns {Promise<Object>} { dialogue: string, actions: NPCDecision[] }
   */
  async generateDialogue(contextSummary, mood, topic) {
    const template = this.npcTemplate;
    const npc = this.npcState;

    // Build dialogue from template + mood + topic
    let dialogue = '';
    let actions = [];

    // 1. Mood-based opening
    const moodOpenings = {
      calm: ['“……”', '【NPC 沉默地注视着你】', '“请说。”'],
      angry: ['“你——！”', '【NPC 怒目而视】', '“别靠近我！”'],
      scared: ['“不……不要过来……”', '【NPC 后退一步】', '“求求你，别……”'],
      curious: ['“哦？你对这个感兴趣？”', '【NPC 凑近了一些】', '“说说看。”'],
      suspicious: ['“……你想知道什么？”', '【NPC 压低声音】', '“为什么问这个？”'],
      friendly: ['“又见面了。”', '【NPC 微笑】', '“有什么我可以帮你的吗？”'],
      hostile: ['“离我远点。”', '【NPC 握紧拳头】', '“你还没受够教训吗？”'],
      grateful: ['“谢谢你……真的。”', '【NPC 眼眶微红】', '“你救了我。”'],
      terrified: ['“啊啊——！！”', '【NPC 崩溃地尖叫】', '“怪物……怪物啊！！”'],
      desperate: ['“这是……最后的机会了……”', '【NPC 喘息着】', '“一起死吧！”'],
      dominant: ['“跪下。”', '【NPC 张开双臂】', '“臣服，或者毁灭。”'],
      whispering: ['“……你确定要知道吗？”', '【NPC 压低声音】', '“这个秘密……会毁了你。”'],
      hurt: ['“我以为……我们是朋友。”', '【NPC 转身】', '“你走吧。”'],
    };

    const openings = moodOpenings[mood] || moodOpenings['calm'];
    dialogue = openings[Math.floor(Math.random() * openings.length)] + '\n\n';

    // 2. Topic-based response
    if (topic && template.dialogue?.[topic]) {
      dialogue += template.dialogue[topic];
    } else if (topic === 'secret' && template.secrets) {
      const unrevealed = template.secrets.filter((s) => !npc.secrets_revealed.includes(s.keyword));
      if (unrevealed.length > 0) {
        const secret = unrevealed[0];
        dialogue += secret.reveal_text || '“我知道一些事情……但不能在这里说。”';
        actions.push({
          action: 'hint',
          confidence: 0.8,
          reasoning: 'Secret revealed',
          metadata: { clue_id: secret.clue_id },
        });
      }
    } else if (template.dialogue?.default) {
      dialogue += template.dialogue.default;
    } else {
      dialogue += '【NPC 没有回应】';
    }

    // 3. Trust-based additional content
    if (npc.trust > 70 && template.dialogue?.trusted) {
      dialogue += `\n\n${template.dialogue.trusted}`;
    }
    if (npc.suspicion > 70 && template.dialogue?.suspicious) {
      dialogue += `\n\n${template.dialogue.suspicious}`;
    }

    // 4. Attitude-based closing
    if (npc.attitude === 'hostile' || npc.attitude === 'hostile_alerted') {
      dialogue += '\n\n【NPC 的态度明显充满敌意】';
    } else if (npc.attitude === 'afraid') {
      dialogue += '\n\n【NPC 的身体在颤抖】';
    } else if (npc.attitude === 'friendly') {
      dialogue += '\n\n【NPC 对你露出微笑】';
    }

    return { dialogue, actions };
  }

  /**
   * Update NPC state after decision execution
   * @param {NPCDecision} decision — The decision that was executed
   * @param {Object} outcome — Result of the decision
   * @returns {NPCState} Updated state
   */
  updateState(decision, outcome = {}) {
    const npc = this.npcState;

    // Update HP from combat outcome
    if (outcome.damage_taken !== undefined) {
      npc.current_hp = Math.max(0, npc.current_hp - outcome.damage_taken);
    }
    if (outcome.healing_received !== undefined) {
      npc.current_hp = Math.min(
        npc.current_hp + outcome.healing_received,
        this.npcTemplate.hp || 10,
      );
    }

    // Update SAN
    if (outcome.sanity_loss !== undefined) {
      npc.current_san = Math.max(0, npc.current_san - outcome.sanity_loss);
    }

    // Update relationships
    if (outcome.trust_delta !== undefined) {
      npc.trust = Math.min(100, Math.max(0, npc.trust + outcome.trust_delta));
    }
    if (outcome.fear_delta !== undefined) {
      npc.fear = Math.min(100, Math.max(0, npc.fear + outcome.fear_delta));
    }
    if (outcome.suspicion_delta !== undefined) {
      npc.suspicion = Math.min(100, Math.max(0, npc.suspicion + outcome.suspicion_delta));
    }

    // Attitude auto-correction based on state
    if (npc.trust > 60 && npc.fear < 30 && npc.attitude !== 'friendly') {
      npc.attitude = 'friendly';
    }
    if (npc.fear > 70 && !npc.attitude.startsWith('hostile') && npc.attitude !== 'afraid') {
      npc.attitude = 'afraid';
    }
    if (npc.trust < 20 && !npc.attitude.startsWith('hostile') && npc.attitude !== 'afraid') {
      npc.attitude = 'hostile';
    }

    // Update action history
    npc.current_action = decision.action;
    npc.turns_in_scene++;

    // Death check
    if (npc.current_hp <= 0) {
      npc.is_alive = false;
      npc.attitude = 'dead';
    }

    return npc;
  }

  /**
   * Get NPC state summary for UI display
   * @returns {Object}
   */
  getStateSummary() {
    const npc = this.npcState;
    const template = this.npcTemplate;
    return {
      id: this.npcId,
      name: template.name || this.npcId,
      attitude: npc.attitude,
      trust: npc.trust,
      fear: npc.fear,
      suspicion: npc.suspicion,
      hp: `${npc.current_hp}/${template.hp || 10}`,
      is_alive: npc.is_alive,
      current_action: npc.current_action,
      known_topics_count: npc.known_topics.length,
      secrets_revealed_count: npc.secrets_revealed.length,
    };
  }
}

export default NPCDecisionEngine;
