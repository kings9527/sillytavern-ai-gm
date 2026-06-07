/**
 * AI-GM Plugin Contracts
 * Interface definitions for all engine modules
 *
 * @module contracts
 * @version 0.2.0
 */

// ==================== NPC Decision Engine Contract ====================

/**
 * NPC State — persisted per-campaign, per-NPC
 * @typedef {Object} NPCState
 * @property {string} id — NPC ID
 * @property {number} current_hp — Current HP (synced to template HP max)
 * @property {number} current_san — Current sanity (for NPCs that can go insane)
 * @property {string} attitude — 'neutral' | 'friendly' | 'hostile' | 'afraid' | 'hostile_alerted' | 'hostile_fleeing'
 * @property {number} trust — 0-100, relationship metric with player
 * @property {number} fear — 0-100, fear of player/threats
 * @property {number} suspicion — 0-100, suspicion of player motives
 * @property {string[]} known_topics — Topics this NPC has discussed with player
 * @property {string[]} secrets_revealed — Secrets already told to player
 * @property {string} current_action — Last action taken (for continuity)
 * @property {number} turns_in_scene — How many turns NPC has been in current scene
 * @property {boolean} is_alive — False if dead/removed from game
 * @property {Object} custom_vars — Module-specific state flags
 */

/**
 * NPC Decision — output of decision engine
 * @typedef {Object} NPCDecision
 * @property {string} action — One of: 'talk', 'emote', 'attack', 'flee', 'ignore', 'help', 'investigate', 'warn', 'summon', 'special_attack'
 * @property {number} confidence — 0.0-1.0, certainty of decision
 * @property {string} reasoning — Human-readable logic (for debugging/narration)
 * @property {string} [target_id] — Target of action (player or another NPC)
 * @property {string} [mood] — Emotional state: 'calm', 'angry', 'scared', 'curious', 'suspicious', 'friendly', 'hostile'
 * @property {string} [dialogue_topic] — If action is 'talk', suggested topic
 * @property {Object} [metadata] — Action-specific data (e.g., skill to use, item to give)
 */

/**
 * NPC Decision Engine Interface
 *
 * Must be implemented by: plugin/engine/npc-decision.js
 * Consumed by: plugin/engine/state-machine.js (handleTalk, handleCombatInitiation)
 *
 * Contract Rules:
 * 1. All decisions must be deterministic given identical {npcState, situation, campaignState}
 * 2. Confidence > 0.85 triggers immediate execution (no LLM fallback)
 * 3. Confidence < 0.3 always falls back to LLM (Phase 2)
 * 4. Attitude transitions must be logged and persisted to npcState
 * 5. Death check (current_hp <= 0) must return { action: 'dead', confidence: 1.0 } immediately
 *
 * @class NPCDecisionEngine
 */
export class NPCDecisionEngineContract {
  /**
   * Initialize engine with campaign context
   * @param {Object} campaign — Full campaign state
   * @param {string} npcId — NPC ID to control
   * @returns {NPCDecisionEngine}
   */
  constructor(campaign, npcId) {}

  /**
   * Primary decision entry point
   * @param {Object} situation — Current situation context
   * @param {string} situation.type — 'scene_entry' | 'player_talk' | 'player_attack' | 'player_flee' | 'player_inspect' | 'combat_turn' | 'event_triggered' | 'idle'
   * @param {string} [situation.player_input] — Raw player input text
   * @param {Object} [situation.combat_state] — Current combat state (if in combat)
   * @param {number} [situation.threat_level] — 0-100, calculated from player actions
   * @returns {Promise<NPCDecision>}
   */
  async decide(situation) {}

  /**
   * Generate dialogue for an NPC (MVP: template-based, Phase 2: LLM)
   * @param {string} contextSummary — Brief context description
   * @param {string} mood — From decision.mood
   * @param {string} [topic] — Suggested dialogue topic
   * @returns {Promise<Object>} { dialogue: string, actions: NPCDecision[] }
   */
  async generateDialogue(contextSummary, mood, topic) {}

  /**
   * Update NPC state after a decision (trust/fear/suspicion changes)
   * @param {NPCDecision} decision — The decision that was executed
   * @param {Object} outcome — Result of the decision (player response, damage dealt, etc.)
   * @returns {NPCState} Updated state
   */
  updateState(decision, outcome) {}
}

// ==================== Event Bus Contract ====================

/**
 * Event Bus — decoupled module communication
 * @typedef {Object} GameEvent
 * @property {string} type — Event type
 * @property {string} source — Emitting module
 * @property {Object} payload — Event data
 * @property {number} timestamp — Unix timestamp
 */

export class EventBusContract {
  constructor() {}
  emit(type, payload, source) {}
  on(type, handler) {}
  off(type, handler) {}
}

// ==================== Validator Contract ====================

/**
 * Input validation for all engine entry points
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 */

export class ValidatorContract {
  validateAction(action) {}
  validateNPCState(state) {}
  validateScene(scene) {}
  validateCombatState(state) {}
}

export default {
  NPCDecisionEngineContract,
  EventBusContract,
  ValidatorContract,
};
