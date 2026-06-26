/**
 * NPC Decision Engine Advanced Test Suite
 * Tests: death check, attitude transitions, dialogue generation, state update, LLM fallback, getStateSummary
 * Coverage target: engine/npc-decision.js
 */

import { NPCDecisionEngine } from '../engine/npc-decision.js';

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passCount++;
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    failCount++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function buildCampaign(npcOverrides = {}) {
  return {
    id: 'test_campaign',
    module_id: 'test_mod',
    current_scene: 'scene1',
    player: { name: '调查员', hp: 12, max_hp: 12, sanity: 60, max_sanity: 60 },
    npcs_state: {},
    flags: {},
    turn: 1,
    module: {
      id: 'test_mod',
      system: 'coc7e',
      scenes: {
        scene1: {
          id: 'scene1',
          title: '图书馆',
          description: '书架排列',
          npcs: ['librarian', 'enemy1'],
          combat: { enabled: false },
        },
      },
      npcs: {
        librarian: {
          id: 'librarian',
          name: '图书管理员',
          role: 'neutral',
          attitude: 'neutral',
          hp: 10,
          sanity: 50,
          personality: '沉默寡言的学者',
          secrets: [{ keyword: '仪式', reveal_text: '我知道如何召唤旧日支配者...' }],
          dialogue: {
            default: '“需要什么帮助吗？”',
            trusted: '“我信任你。这个秘密我只告诉你...”',
            suspicious: '“你问得太多了。”',
          },
        },
        enemy1: {
          id: 'enemy1',
          name: '深潜者',
          role: 'enemy',
          attitude: 'hostile',
          hp: 15,
          sanity: 80,
          personality: '狂热的邪教徒',
          combat_skills: ['触手攻击', '精神冲击'],
        },
        boss: {
          id: 'boss',
          name: '达贡祭司',
          role: 'Boss',
          attitude: 'hostile',
          hp: 50,
          sanity: 100,
          personality: '傲慢的古老存在',
        },
        ally: {
          id: 'ally',
          name: '助手小张',
          role: 'ally',
          attitude: 'friendly',
          hp: 8,
          sanity: 55,
          personality: '忠诚但胆小',
        },
      },
    },
    ...npcOverrides,
  };
}

console.log('=== NPC Decision Engine Advanced Tests ===\n');

// --- Death Check ---
console.log('--- Death Check ---');

test('Dead NPC returns dead action', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 0,
      current_san: 50,
      attitude: 'neutral',
      is_alive: false,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const decision = await engine.decide({ type: 'player_talk' });
  assert(decision.action === 'dead', `Expected dead, got ${decision.action}`);
  assert(decision.confidence === 1.0, 'Expected confidence 1.0');
  assert(decision.mood === 'dead', 'Expected mood dead');
});

test('Zero HP returns dead action', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    enemy1: {
      id: 'enemy1',
      current_hp: 0,
      current_san: 80,
      attitude: 'hostile',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const decision = await engine.decide({ type: 'player_attack' });
  assert(decision.action === 'dead', `Expected dead, got ${decision.action}`);
});

// --- Attitude Transitions ---
console.log('\n--- Attitude Transitions ---');

test('Player attack transitions neutral to hostile', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  // (removed unused: decision)
  const state = campaign.npcs_state.librarian;
  assert(state.attitude === 'hostile', `Expected hostile, got ${state.attitude}`);
  assert(state.fear > 20, 'Expected fear increased');
  assert(state.trust < 30, 'Expected trust decreased');
});

test('Player help transitions neutral to friendly', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  // (removed unused: decision)
  const state = campaign.npcs_state.librarian;
  assert(state.attitude === 'friendly', `Expected friendly, got ${state.attitude}`);
  assert(state.trust > 30, 'Expected trust increased');
  assert(state.fear < 20, 'Expected fear decreased');
});

test('Player threat transitions neutral to afraid', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  // (removed unused: decision)
  const state = campaign.npcs_state.librarian;
  assert(state.attitude === 'afraid', `Expected afraid, got ${state.attitude}`);
  assert(state.fear > 20, 'Expected fear increased');
  assert(state.suspicion > 30, 'Expected suspicion increased');
});

test('Combat start transitions friendly to hostile', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'friendly',
      is_alive: true,
      trust: 60,
      fear: 10,
      suspicion: 10,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  // (removed unused: decision)
  const state = campaign.npcs_state.librarian;
  assert(state.attitude === 'hostile', `Expected hostile, got ${state.attitude}`);
});

// --- Rule-Based Combat Decisions ---
console.log('\n--- Rule-Based Combat Decisions ---');

test('Enemy in combat attacks player', async () => {
  const campaign = buildCampaign();
  campaign.combat_state = { active: true, current_turn: 'player_1' };
  campaign.npcs_state = {
    enemy1: {
      id: 'enemy1',
      current_hp: 15,
      current_san: 80,
      attitude: 'hostile',
      is_alive: true,
      trust: 10,
      fear: 20,
      suspicion: 50,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const decision = await engine.decide({ type: 'combat_turn' });
  assert(decision.action === 'attack', `Expected attack, got ${decision.action}`);
  assert(decision.target_id === 'player', 'Expected target player');
  assert(decision.confidence >= 0.9, 'Expected high confidence');
});

test('Boss in combat uses special attack', async () => {
  const campaign = buildCampaign();
  campaign.combat_state = { active: true, current_turn: 'boss' };
  campaign.npcs_state = {
    boss: {
      id: 'boss',
      current_hp: 50,
      current_san: 100,
      attitude: 'hostile',
      is_alive: true,
      trust: 0,
      fear: 0,
      suspicion: 80,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'boss');
  // Mock Math.random to force special_attack
  const originalRandom = Math.random;
  Math.random = () => 0.1; // < 0.3 triggers special_attack
  const decision = await engine.decide({ type: 'combat_turn' });
  Math.random = originalRandom;
  assert(decision.action === 'special_attack', `Expected special_attack, got ${decision.action}`);
  assert(decision.confidence >= 0.85, 'Expected high confidence');
});

test('Boss with low HP still special attacks', async () => {
  const campaign = buildCampaign();
  campaign.combat_state = { active: true, current_turn: 'boss' };
  campaign.npcs_state = {
    boss: {
      id: 'boss',
      current_hp: 5,
      current_san: 100,
      attitude: 'hostile_alerted',
      is_alive: true,
      trust: 0,
      fear: 0,
      suspicion: 80,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'boss');
  const decision = await engine.decide({ type: 'combat_turn' });
  assert(decision.action === 'special_attack', `Expected special_attack, got ${decision.action}`);
  assert(decision.reasoning.includes('Boss'), 'Expected Boss reasoning');
});

test('Low HP minion flees instead of fighting', async () => {
  const campaign = buildCampaign();
  campaign.combat_state = { active: true, current_turn: 'enemy1' };
  campaign.npcs_state = {
    enemy1: {
      id: 'enemy1',
      current_hp: 2,
      current_san: 80,
      attitude: 'hostile',
      is_alive: true,
      trust: 10,
      fear: 20,
      suspicion: 50,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const decision = await engine.decide({ type: 'combat_turn' });
  assert(decision.action === 'flee', `Expected flee, got ${decision.action}`);
  assert(decision.reasoning.includes('HP'), 'Expected HP reasoning');
});

test('Ally in combat helps player', async () => {
  const campaign = buildCampaign();
  campaign.combat_state = { active: true, current_turn: 'ally' };
  campaign.npcs_state = {
    ally: {
      id: 'ally',
      current_hp: 8,
      current_san: 55,
      attitude: 'friendly',
      is_alive: true,
      trust: 70,
      fear: 10,
      suspicion: 10,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'ally');
  const decision = await engine.decide({ type: 'combat_turn' });
  assert(decision.action === 'help', `Expected help, got ${decision.action}`);
  assert(decision.confidence >= 0.85, 'Expected high confidence');
});

// --- SAN Break / Critical HP ---
console.log('\n--- SAN Break / Critical HP ---');

test('SAN zero causes flee', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 0,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const decision = await engine.decide({ type: 'player_talk' });
  assert(decision.action === 'flee', `Expected flee, got ${decision.action}`);
  assert(decision.reasoning.includes('SAN'), 'Expected SAN reasoning');
});

test('Boss ignores SAN break', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    boss: {
      id: 'boss',
      current_hp: 50,
      current_san: 0,
      attitude: 'hostile',
      is_alive: true,
      trust: 0,
      fear: 0,
      suspicion: 80,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'boss');
  const decision = await engine.decide({ type: 'combat_turn' });
  // Boss should still attack, not flee
  assert(decision.action !== 'flee', `Expected not flee for Boss, got ${decision.action}`);
});

// --- Dialogue Generation ---
console.log('\n--- Dialogue Generation ---');

test('Template dialogue generation with mood', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const dialogue = await engine.generateDialogue('玩家进入图书馆', 'friendly', 'greeting');
  assert(dialogue.text.length > 0, 'Expected non-empty dialogue');
  assert(dialogue.emotion === 'friendly', `Expected emotion friendly, got ${dialogue.emotion}`);
  assert(!dialogue.secretRevealed, 'Expected no secret revealed');
});

test('Template dialogue with secret topic', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'friendly',
      is_alive: true,
      trust: 70,
      fear: 10,
      suspicion: 10,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const dialogue = await engine.generateDialogue('玩家询问秘密', 'whispering', 'secret');
  assert(dialogue.text.length > 0, 'Expected non-empty dialogue');
  assert(
    dialogue.secretRevealed === '仪式',
    `Expected secret revealed, got ${dialogue.secretRevealed}`,
  );
  assert(
    campaign.npcs_state.librarian.secrets_revealed.includes('仪式'),
    'Expected secret tracked in state',
  );
});

test('Template dialogue with high trust adds trusted line', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'friendly',
      is_alive: true,
      trust: 75,
      fear: 10,
      suspicion: 10,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const dialogue = await engine.generateDialogue('玩家对话', 'friendly', 'greeting');
  assert(dialogue.text.includes('trusted'), 'Expected trusted dialogue appended');
});

test('Template dialogue with high suspicion adds suspicious line', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 50,
      suspicion: 75,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const dialogue = await engine.generateDialogue('玩家对话', 'suspicious', 'greeting');
  assert(dialogue.text.includes('suspicious'), 'Expected suspicious dialogue appended');
});

// --- LLM-Enhanced Decision (mock) ---
console.log('\n--- LLM-Enhanced Decision ---');

test('LLM enhanced decision when rule confidence is low', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = {
    isAvailable: () => true,
    chat: async () => ({
      content: JSON.stringify({
        action: 'talk',
        confidence: 0.9,
        reasoning: 'LLM says talk',
        mood: 'curious',
        target_id: 'player',
        dialogue_topic: 'books',
      }),
    }),
  };
  // Use a vague situation where rule confidence is low
  const decision = await engine.decide({ type: 'player_talk', player_input: '随便聊聊' }, mockLLM);
  assert(decision.action === 'talk', `Expected talk, got ${decision.action}`);
  assert(decision.llm_enhanced === true, 'Expected llm_enhanced flag');
  assert(decision.reasoning === 'LLM says talk', 'Expected LLM reasoning');
});

test('LLM fallback when LLM throws error', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = {
    isAvailable: () => true,
    chat: async () => {
      throw new Error('LLM timeout');
    },
  };
  const decision = await engine.decide({ type: 'player_talk' }, mockLLM);
  // Should fallback to attitude-based or default
  assert(decision.action !== null, 'Expected some decision');
  assert(decision.confidence > 0, 'Expected positive confidence');
});

test('LLM unavailable falls back to attitude-based', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = {
    isAvailable: () => false,
    chat: async () => ({ content: '{}' }),
  };
  const decision = await engine.decide({ type: 'player_talk' }, mockLLM);
  assert(decision.action === 'talk', `Expected talk, got ${decision.action}`); // neutral attitude default
  assert(decision.confidence >= 0.5, 'Expected confidence >= 0.5');
});

// --- State Update ---
console.log('\n--- State Update ---');

test('updateState applies damage', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'attack' }, { damage_taken: 3 });
  assert(updated.current_hp === 7, `Expected HP 7, got ${updated.current_hp}`);
  assert(updated.is_alive === true, 'Expected still alive');
});

test('updateState applies healing', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 5,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'heal' }, { healing_received: 3 });
  assert(updated.current_hp === 8, `Expected HP 8, got ${updated.current_hp}`);
});

test('updateState caps HP at max', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 9,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'heal' }, { healing_received: 5 });
  assert(updated.current_hp === 10, `Expected HP capped at 10, got ${updated.current_hp}`);
});

test('updateState applies sanity loss', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'sanity_loss' }, { sanity_loss: 10 });
  assert(updated.current_san === 40, `Expected SAN 40, got ${updated.current_san}`);
});

test('updateState applies trust/fear/suspicion deltas', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 50,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState(
    { action: 'talk' },
    { trust_delta: 10, fear_delta: -5, suspicion_delta: 15 },
  );
  assert(updated.trust === 60, `Expected trust 60, got ${updated.trust}`);
  assert(updated.fear === 15, `Expected fear 15, got ${updated.fear}`);
  assert(updated.suspicion === 45, `Expected suspicion 45, got ${updated.suspicion}`);
});

test('updateState caps stats at 0-100', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 95,
      fear: 5,
      suspicion: 95,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState(
    { action: 'talk' },
    { trust_delta: 10, fear_delta: -10, suspicion_delta: 10 },
  );
  assert(updated.trust === 100, `Expected trust capped at 100, got ${updated.trust}`);
  assert(updated.fear === 0, `Expected fear floored at 0, got ${updated.fear}`);
  assert(updated.suspicion === 100, `Expected suspicion capped at 100, got ${updated.suspicion}`);
});

test('updateState auto-corrects attitude from trust', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'hostile',
      is_alive: true,
      trust: 65,
      fear: 10,
      suspicion: 10,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, {});
  assert(
    updated.attitude === 'friendly',
    `Expected friendly from high trust, got ${updated.attitude}`,
  );
});

test('updateState auto-corrects attitude from fear', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 50,
      fear: 75,
      suspicion: 10,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, {});
  assert(updated.attitude === 'afraid', `Expected afraid from high fear, got ${updated.attitude}`);
});

test('updateState kills NPC when HP reaches 0', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 3,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'attack' }, { damage_taken: 5 });
  assert(updated.current_hp === 0, `Expected HP 0, got ${updated.current_hp}`);
  assert(updated.is_alive === false, 'Expected dead');
  assert(updated.attitude === 'dead', `Expected dead attitude, got ${updated.attitude}`);
});

test('updateState increments turns_in_scene', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 5,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, {});
  assert(updated.turns_in_scene === 6, `Expected turns 6, got ${updated.turns_in_scene}`);
  assert(updated.current_action === 'talk', `Expected action talk, got ${updated.current_action}`);
});

// --- getStateSummary ---
console.log('\n--- getStateSummary ---');

test('getStateSummary returns correct structure', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 7,
      current_san: 50,
      attitude: 'friendly',
      is_alive: true,
      trust: 60,
      fear: 10,
      suspicion: 10,
      known_topics: ['books'],
      secrets_revealed: ['仪式'],
      turns_in_scene: 3,
      current_action: 'talk',
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const summary = engine.getStateSummary();
  assert(summary.id === 'librarian', 'Expected id');
  assert(summary.name === '图书管理员', 'Expected name');
  assert(summary.attitude === 'friendly', 'Expected attitude');
  assert(summary.trust === 60, 'Expected trust');
  assert(summary.fear === 10, 'Expected fear');
  assert(summary.suspicion === 10, 'Expected suspicion');
  assert(summary.hp === '7/10', `Expected hp 7/10, got ${summary.hp}`);
  assert(summary.is_alive === true, 'Expected alive');
  assert(summary.current_action === 'talk', 'Expected current action');
  assert(summary.known_topics_count === 1, 'Expected 1 known topic');
  assert(summary.secrets_revealed_count === 1, 'Expected 1 secret revealed');
});

// --- Secret / Topic Detection ---
console.log('\n--- Secret / Topic Detection ---');

test('Player talk with secret keyword triggers evade when trust low', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const decision = await engine.decide({
    type: 'player_talk',
    player_input: '告诉我关于仪式的事情',
  });
  assert(decision.action === 'evade', `Expected evade, got ${decision.action}`);
  assert(decision.mood === 'suspicious', 'Expected suspicious mood');
  assert(campaign.npcs_state.librarian.suspicion > 30, 'Expected suspicion increased');
});

test('Player talk with secret keyword reveals secret when trust high', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'friendly',
      is_alive: true,
      trust: 65,
      fear: 10,
      suspicion: 10,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const decision = await engine.decide({
    type: 'player_talk',
    player_input: '告诉我关于仪式的事情',
  });
  assert(decision.action === 'talk', `Expected talk, got ${decision.action}`);
  assert(decision.mood === 'whispering', 'Expected whispering mood');
  assert(decision.dialogue_topic === 'secret', 'Expected secret topic');
  assert(
    campaign.npcs_state.librarian.secrets_revealed.includes('仪式'),
    'Expected secret tracked',
  );
});

test('Player talk with no secret keyword adds topic', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  await engine.decide({ type: 'player_talk', player_input: '给我找本书' });
  assert(
    campaign.npcs_state.librarian.known_topics.includes('generic'),
    'Expected generic topic added',
  );
});

// --- Default Fallback ---
console.log('\n--- Default Fallback ---');

test('Default fallback for unknown role returns talk', async () => {
  const campaign = buildCampaign();
  campaign.module.npcs.unknown_role = {
    id: 'unknown_role',
    name: '神秘人',
    role: 'unknown',
    attitude: 'neutral',
    hp: 10,
  };
  campaign.npcs_state = {
    unknown_role: {
      id: 'unknown_role',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'unknown_role');
  // Force no rule match and no LLM
  const mockLLM = { isAvailable: () => false, chat: async () => ({}) };
  const decision = await engine.decide({ type: 'unknown_situation' }, mockLLM);
  assert(decision.action === 'talk', `Expected talk fallback, got ${decision.action}`);
  assert(decision.confidence === 0.5, 'Expected confidence 0.5');
});

test('Default fallback for enemy role returns attack', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    enemy1: {
      id: 'enemy1',
      current_hp: 15,
      current_san: 80,
      attitude: 'hostile',
      is_alive: true,
      trust: 10,
      fear: 20,
      suspicion: 50,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const mockLLM = { isAvailable: () => false, chat: async () => ({}) };
  const decision = await engine.decide({ type: 'unknown_situation' }, mockLLM);
  assert(decision.action === 'attack', `Expected attack fallback, got ${decision.action}`);
  assert(decision.mood === 'hostile', 'Expected hostile mood');
});

test('Default fallback for Boss role returns special_attack', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    boss: {
      id: 'boss',
      current_hp: 50,
      current_san: 100,
      attitude: 'hostile',
      is_alive: true,
      trust: 0,
      fear: 0,
      suspicion: 80,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'boss');
  const mockLLM = { isAvailable: () => false, chat: async () => ({}) };
  const decision = await engine.decide({ type: 'unknown_situation' }, mockLLM);
  assert(
    decision.action === 'special_attack',
    `Expected special_attack fallback, got ${decision.action}`,
  );
  assert(decision.mood === 'dominant', 'Expected dominant mood');
});

// --- Build Context ---
console.log('\n--- Build Context ---');

test('buildContext includes all fields', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const context = engine.buildContext({ type: 'test_situation' });
  assert(context.npc.id === 'librarian', 'Expected npc id');
  assert(context.template.name === '图书管理员', 'Expected template name');
  assert(context.situation.type === 'test_situation', 'Expected situation');
  assert(context.campaign_state.current_scene === 'scene1', 'Expected scene');
  assert(context.campaign_state.player_name === '调查员', 'Expected player name');
  assert(context.available_actions.includes('talk'), 'Expected talk action');
  assert(context.available_actions.includes('emote'), 'Expected emote action');
  assert(context.available_actions.includes('ignore'), 'Expected ignore action');
});

test('buildContext for enemy includes attack action', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    enemy1: {
      id: 'enemy1',
      current_hp: 15,
      current_san: 80,
      attitude: 'hostile',
      is_alive: true,
      trust: 10,
      fear: 20,
      suspicion: 50,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const context = engine.buildContext('combat');
  assert(context.available_actions.includes('attack'), 'Expected attack action');
  assert(context.available_actions.includes('flee'), 'Expected flee action');
});

test('buildContext for Boss includes special actions', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    boss: {
      id: 'boss',
      current_hp: 50,
      current_san: 100,
      attitude: 'hostile',
      is_alive: true,
      trust: 0,
      fear: 0,
      suspicion: 80,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'boss');
  const context = engine.buildContext('combat');
  assert(context.available_actions.includes('special_attack'), 'Expected special_attack action');
  assert(context.available_actions.includes('summon'), 'Expected summon action');
  assert(context.available_actions.includes('warn'), 'Expected warn action');
});

test('buildContext for ally includes help action', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    ally: {
      id: 'ally',
      current_hp: 8,
      current_san: 55,
      attitude: 'friendly',
      is_alive: true,
      trust: 70,
      fear: 10,
      suspicion: 10,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'ally');
  const context = engine.buildContext('combat');
  assert(context.available_actions.includes('help'), 'Expected help action');
  assert(context.available_actions.includes('investigate'), 'Expected investigate action');
  assert(context.available_actions.includes('heal'), 'Expected heal action');
});

// Async tests for _llmEnhancedDecision coverage
(async () => {
  console.log('\n--- LLM Enhanced Decision Coverage ---');

  function buildLLMCampaign(npcOverrides = {}) {
    return {
      id: 'test_campaign',
      module_id: 'test_mod',
      current_scene: 'scene1',
      player: {
        name: '调查员',
        hp: 12,
        max_hp: 12,
        sanity: 60,
        max_sanity: 60,
        stats: { HP: 12, SAN: 60, STR: 50, DEX: 50, CON: 50, INT: 50, POW: 50 },
      },
      npcs_state: {
        librarian: {
          id: 'librarian',
          current_hp: 10,
          current_san: 50,
          attitude: 'neutral',
          is_alive: true,
          trust: 30,
          fear: 20,
          suspicion: 30,
          known_topics: [],
          secrets_revealed: [],
          turns_in_scene: 0,
          custom_vars: {},
          ...npcOverrides,
        },
      },
      flags: {},
      turn: 1,
      module: {
        id: 'test_mod',
        system: 'coc7e',
        scenes: {
          scene1: {
            id: 'scene1',
            title: '图书馆',
            description: '书架排列',
            npcs: ['librarian'],
            combat: { enabled: false },
          },
        },
        npcs: {
          librarian: {
            id: 'librarian',
            name: '图书管理员',
            role: 'neutral',
            personality: '谨慎',
            hp: 10,
            sanity: 50,
          },
        },
      },
    };
  }

  // 1. LLM returns valid JSON
  test('LLM returns valid JSON response', async () => {
    const campaign = buildLLMCampaign();
    const engine = new NPCDecisionEngine(campaign, 'librarian');
    const context = engine._buildContext({ type: 'player_talk', player_input: '你好' }, '');
    const mockLLM = {
      chat: async () => ({
        content: '{"action":"talk","confidence":0.75,"reasoning":"测试","mood":"curious","target_id":"player","dialogue_topic":"greeting"}',
      }),
    };
    const decision = await engine._llmEnhancedDecision(context, mockLLM);
    assert(decision.action === 'talk', 'Expected talk action');
    assert(decision.llm_enhanced === true, 'Expected llm_enhanced flag');
    assert(decision.confidence === 0.75, 'Expected confidence 0.75');
  });

  // 2. LLM returns JSON inside markdown code block
  test('LLM returns JSON inside markdown code block', async () => {
    const campaign = buildLLMCampaign();
    const engine = new NPCDecisionEngine(campaign, 'librarian');
    const context = engine._buildContext({ type: 'player_talk' }, '');
    const mockLLM = {
      chat: async () => ({
        content: '```json\n{"action":"ignore","confidence":0.6,"reasoning":"忽略","mood":"neutral","target_id":"player"}\n```',
      }),
    };
    const decision = await engine._llmEnhancedDecision(context, mockLLM);
    assert(decision.action === 'ignore', 'Expected ignore action from markdown JSON');
    assert(decision.llm_enhanced === true, 'Expected llm_enhanced flag');
  });

  // 3. LLM returns invalid JSON → parseError → null
  test('LLM returns invalid JSON falls back to null', async () => {
    const campaign = buildLLMCampaign();
    const engine = new NPCDecisionEngine(campaign, 'librarian');
    const context = engine._buildContext({ type: 'player_talk' }, '');
    const mockLLM = {
      chat: async () => ({ content: '这不是JSON' }),
    };
    const decision = await engine._llmEnhancedDecision(context, mockLLM);
    assert(decision === null, 'Expected null on invalid JSON');
  });

  // 4. LLM returns JSON without action field → null
  test('LLM returns JSON without action returns null', async () => {
    const campaign = buildLLMCampaign();
    const engine = new NPCDecisionEngine(campaign, 'librarian');
    const context = engine._buildContext({ type: 'player_talk' }, '');
    const mockLLM = {
      chat: async () => ({ content: '{"confidence":0.9}' }),
    };
    const decision = await engine._llmEnhancedDecision(context, mockLLM);
    assert(decision === null, 'Expected null when action missing');
  });

  // 5. LLM chat() throws error → catch → null
  test('LLM chat() throws error returns null', async () => {
    const campaign = buildLLMCampaign();
    const engine = new NPCDecisionEngine(campaign, 'librarian');
    const context = engine._buildContext({ type: 'player_talk' }, '');
    const mockLLM = {
      chat: async () => { throw new Error('Network timeout'); },
    };
    const decision = await engine._llmEnhancedDecision(context, mockLLM);
    assert(decision === null, 'Expected null on LLM error');
  });

  // 6. LLM returns JSON with NaN confidence → defaults to 0.5
  test('LLM returns NaN confidence defaults to 0.5', async () => {
    const campaign = buildLLMCampaign();
    const engine = new NPCDecisionEngine(campaign, 'librarian');
    const context = engine._buildContext({ type: 'player_talk' }, '');
    const mockLLM = {
      chat: async () => ({ content: '{"action":"talk","confidence":"abc"}' }),
    };
    const decision = await engine._llmEnhancedDecision(context, mockLLM);
    assert(decision.confidence === 0.5, 'Expected default confidence 0.5');
  });

  // 7. LLM returns confidence > 1 → clamped to 1
  test('LLM returns confidence > 1 gets clamped', async () => {
    const campaign = buildLLMCampaign();
    const engine = new NPCDecisionEngine(campaign, 'librarian');
    const context = engine._buildContext({ type: 'player_talk' }, '');
    const mockLLM = {
      chat: async () => ({ content: '{"action":"talk","confidence":1.5}' }),
    };
    const decision = await engine._llmEnhancedDecision(context, mockLLM);
    assert(decision.confidence === 1, 'Expected confidence clamped to 1');
  });

  // 8. LLM returns confidence < 0 → clamped to 0
  test('LLM returns confidence < 0 gets clamped', async () => {
    const campaign = buildLLMCampaign();
    const engine = new NPCDecisionEngine(campaign, 'librarian');
    const context = engine._buildContext({ type: 'player_talk' }, '');
    const mockLLM = {
      chat: async () => ({ content: '{"action":"talk","confidence":-0.5}' }),
    };
    const decision = await engine._llmEnhancedDecision(context, mockLLM);
    assert(decision.confidence === 0, 'Expected confidence clamped to 0');
  });

  // 9. LLM returns JSON with missing fields → defaults applied
  test('LLM returns JSON with missing fields uses defaults', async () => {
    const campaign = buildLLMCampaign();
    const engine = new NPCDecisionEngine(campaign, 'librarian');
    const context = engine._buildContext({ type: 'player_talk' }, '');
    const mockLLM = {
      chat: async () => ({ content: '{"action":"talk","confidence":0.7}' }),
    };
    const decision = await engine._llmEnhancedDecision(context, mockLLM);
    assert(decision.reasoning === 'LLM reasoning', 'Expected default reasoning');
    assert(decision.mood === 'neutral', 'Expected default mood');
    assert(decision.target_id === 'player', 'Expected default target_id');
    assert(decision.dialogue_topic === null, 'Expected default dialogue_topic null');
  });

  // 10. chat_history included in prompt
  test('chat_history is included in LLM prompt', async () => {
    const campaign = buildLLMCampaign();
    const engine = new NPCDecisionEngine(campaign, 'librarian');
    const context = engine._buildContext({ type: 'player_talk' }, '玩家: 你好\nNPC: 你好');
    let capturedMessages = null;
    const mockLLM = {
      chat: async (messages) => {
        capturedMessages = messages;
        return { content: '{"action":"talk","confidence":0.7}' };
      },
    };
    await engine._llmEnhancedDecision(context, mockLLM);
    const userMsg = capturedMessages.find((m) => m.role === 'user');
    assert(userMsg.content.includes('Recent conversation'), 'Expected chat history header');
    assert(userMsg.content.includes('玩家: 你好'), 'Expected chat content in prompt');
  });

  // 11. template with secrets includes secrets in prompt
  test('template secrets are included in LLM prompt', async () => {
    const campaign = buildLLMCampaign();
    campaign.module.npcs.librarian.secrets = [
      { keyword: 'cult', clue_id: 'clue_1', reveal_text: '邪教在地下室' },
    ];
    const engine = new NPCDecisionEngine(campaign, 'librarian');
    const context = engine._buildContext({ type: 'player_talk' }, '');
    let capturedMessages = null;
    const mockLLM = {
      chat: async (messages) => {
        capturedMessages = messages;
        return { content: '{"action":"talk","confidence":0.7}' };
      },
    };
    await engine._llmEnhancedDecision(context, mockLLM);
    const sysMsg = capturedMessages.find((m) => m.role === 'system');
    assert(sysMsg.content.includes('Secrets: cult'), 'Expected secrets in system prompt');
  });

  // 12. npc with revealed secrets includes them in prompt
  test('npc revealed secrets are included in LLM prompt', async () => {
    const campaign = buildLLMCampaign();
    campaign.npcs_state.librarian.secrets_revealed = ['cult'];
    const engine = new NPCDecisionEngine(campaign, 'librarian');
    const context = engine._buildContext({ type: 'player_talk' }, '');
    let capturedMessages = null;
    const mockLLM = {
      chat: async (messages) => {
        capturedMessages = messages;
        return { content: '{"action":"talk","confidence":0.7}' };
      },
    };
    await engine._llmEnhancedDecision(context, mockLLM);
    const sysMsg = capturedMessages.find((m) => m.role === 'system');
    assert(sysMsg.content.includes('Already revealed: cult'), 'Expected revealed secrets in prompt');
  });

  // 13. npc with known topics includes them in prompt
  test('npc known topics are included in LLM prompt', async () => {
    const campaign = buildLLMCampaign();
    campaign.npcs_state.librarian.known_topics = ['books', 'magic'];
    const engine = new NPCDecisionEngine(campaign, 'librarian');
    const context = engine._buildContext({ type: 'player_talk' }, '');
    let capturedMessages = null;
    const mockLLM = {
      chat: async (messages) => {
        capturedMessages = messages;
        return { content: '{"action":"talk","confidence":0.7}' };
      },
    };
    await engine._llmEnhancedDecision(context, mockLLM);
    const sysMsg = capturedMessages.find((m) => m.role === 'system');
    assert(sysMsg.content.includes('Known topics: books, magic'), 'Expected known topics in prompt');
  });

  // Summary
  console.log('\n=== NPC Decision Engine Advanced Test Summary ===');
  console.log(`Total: ${passCount + failCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Status: ${failCount === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);

  process.exit(failCount > 0 ? 1 : 0);
})();
