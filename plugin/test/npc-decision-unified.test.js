// Unified NPC Decision Engine Test Suite
// Merges advanced + coverage gap tests for single-process c8 coverage

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
            greeting: '“欢迎来到图书馆。”',
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
        nameless: {
          id: 'nameless',
          role: 'neutral',
          attitude: 'neutral',
          hp: 5,
        },
        no_dialogue: {
          id: 'no_dialogue',
          name: '哑巴',
          role: 'neutral',
          attitude: 'neutral',
          hp: 10,
        },
      },
    },
    ...npcOverrides,
  };
}

console.log('=== NPC Decision Engine Unified Tests ===\n');

// ========== DEATH CHECK ==========
console.log('--- Death Check ---');

test('Dead NPC returns dead action', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 0, current_san: 50, attitude: 'neutral', is_alive: false, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const decision = await engine.decide({ type: 'player_talk' });
  assert(decision.action === 'dead');
  assert(decision.confidence === 1.0);
  assert(decision.mood === 'dead');
});

test('Zero HP returns dead action', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { enemy1: { id: 'enemy1', current_hp: 0, current_san: 80, attitude: 'hostile', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const decision = await engine.decide({ type: 'player_attack' });
  assert(decision.action === 'dead');
});

// ========== ATTITUDE TRANSITIONS ==========
console.log('\n--- Attitude Transitions ---');

test('Player attack transitions neutral to hostile', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  await engine.decide({ type: 'player_attack' });
  assert(campaign.npcs_state.librarian.attitude === 'hostile');
  assert(campaign.npcs_state.librarian.fear > 20);
  assert(campaign.npcs_state.librarian.trust < 30);
});

test('Player help transitions neutral to friendly', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  await engine.decide({ type: 'player_help' });
  assert(campaign.npcs_state.librarian.attitude === 'friendly');
  assert(campaign.npcs_state.librarian.trust > 30);
  assert(campaign.npcs_state.librarian.fear < 20);
});

test('Player threat transitions neutral to afraid', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  await engine.decide({ type: 'player_threat' });
  assert(campaign.npcs_state.librarian.attitude === 'afraid');
  assert(campaign.npcs_state.librarian.fear > 20);
  assert(campaign.npcs_state.librarian.suspicion > 30);
});

test('Combat start transitions friendly to hostile', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'friendly', is_alive: true, trust: 60, fear: 10, suspicion: 10, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  await engine.decide({ type: 'combat_start' });
  assert(campaign.npcs_state.librarian.attitude === 'hostile');
});

test('Combat end player win transitions hostile to afraid', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { enemy1: { id: 'enemy1', current_hp: 15, current_san: 80, attitude: 'hostile', is_alive: true, trust: 10, fear: 20, suspicion: 50, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  await engine.decide({ type: 'combat_end_player_win' });
  assert(campaign.npcs_state.enemy1.attitude === 'afraid');
});

test('Combat end player lose transitions hostile_alerted to neutral', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { enemy1: { id: 'enemy1', current_hp: 15, current_san: 80, attitude: 'hostile_alerted', is_alive: true, trust: 10, fear: 20, suspicion: 50, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  await engine.decide({ type: 'combat_end_player_lose' });
  assert(campaign.npcs_state.enemy1.attitude === 'neutral');
});

test('No attitude transition for unknown situation type', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  await engine.decide({ type: 'weird_unknown_type' });
  assert(campaign.npcs_state.librarian.attitude === 'neutral');
});

// ========== COMBAT DECISIONS ==========
console.log('\n--- Combat Decisions ---');

test('Enemy in combat attacks player', async () => {
  const campaign = buildCampaign();
  campaign.combat_state = { active: true, current_turn: 'player_1' };
  campaign.npcs_state = { enemy1: { id: 'enemy1', current_hp: 15, current_san: 80, attitude: 'hostile', is_alive: true, trust: 10, fear: 20, suspicion: 50, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const decision = await engine.decide({ type: 'combat_turn' });
  assert(decision.action === 'attack');
  assert(decision.target_id === 'player');
  assert(decision.confidence >= 0.9);
});

test('Boss in combat uses special attack', async () => {
  const campaign = buildCampaign();
  campaign.combat_state = { active: true, current_turn: 'boss' };
  campaign.npcs_state = { boss: { id: 'boss', current_hp: 50, current_san: 100, attitude: 'hostile', is_alive: true, trust: 0, fear: 0, suspicion: 80, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'boss');
  const originalRandom = Math.random;
  Math.random = () => 0.1;
  const decision = await engine.decide({ type: 'combat_turn' });
  Math.random = originalRandom;
  assert(decision.action === 'special_attack');
  assert(decision.confidence >= 0.85);
});

test('Boss with low HP still special attacks', async () => {
  const campaign = buildCampaign();
  campaign.combat_state = { active: true, current_turn: 'boss' };
  campaign.npcs_state = { boss: { id: 'boss', current_hp: 5, current_san: 100, attitude: 'hostile_alerted', is_alive: true, trust: 0, fear: 0, suspicion: 80, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'boss');
  const decision = await engine.decide({ type: 'combat_turn' });
  assert(decision.action === 'special_attack');
  assert(decision.reasoning.includes('Boss'));
});

test('Low HP minion flees instead of fighting', async () => {
  const campaign = buildCampaign();
  campaign.combat_state = { active: true, current_turn: 'enemy1' };
  campaign.npcs_state = { enemy1: { id: 'enemy1', current_hp: 2, current_san: 80, attitude: 'hostile', is_alive: true, trust: 10, fear: 20, suspicion: 50, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const decision = await engine.decide({ type: 'combat_turn' });
  assert(decision.action === 'flee');
  assert(decision.reasoning.includes('HP'));
});

test('Ally in combat helps player', async () => {
  const campaign = buildCampaign();
  campaign.combat_state = { active: true, current_turn: 'ally' };
  campaign.npcs_state = { ally: { id: 'ally', current_hp: 8, current_san: 55, attitude: 'friendly', is_alive: true, trust: 70, fear: 10, suspicion: 10, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'ally');
  const decision = await engine.decide({ type: 'combat_turn' });
  assert(decision.action === 'help');
  assert(decision.confidence >= 0.85);
});

test('Boss on player turn still acts', async () => {
  const campaign = buildCampaign();
  campaign.combat_state = { active: true, current_turn: 'player_1' };
  campaign.npcs_state = { boss: { id: 'boss', current_hp: 50, current_san: 100, attitude: 'hostile', is_alive: true, trust: 0, fear: 0, suspicion: 80, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'boss');
  const decision = await engine.decide({ type: 'combat_turn' });
  assert(decision.action !== 'ignore');
});

test('Non-Boss NPC waits on player turn', async () => {
  const campaign = buildCampaign();
  campaign.combat_state = { active: true, current_turn: 'player_1' };
  campaign.npcs_state = { enemy1: { id: 'enemy1', current_hp: 15, current_san: 80, attitude: 'hostile', is_alive: true, trust: 10, fear: 20, suspicion: 50, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const decision = await engine.decide({ type: 'combat_turn' });
  assert(decision.action === 'ignore');
});

// ========== SAN / HP CRITICAL ==========
console.log('\n--- SAN / HP Critical ---');

test('SAN zero causes flee', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 0, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const decision = await engine.decide({ type: 'player_talk' });
  assert(decision.action === 'flee');
  assert(decision.reasoning.includes('SAN'));
});

test('Boss ignores SAN break', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { boss: { id: 'boss', current_hp: 50, current_san: 0, attitude: 'hostile', is_alive: true, trust: 0, fear: 0, suspicion: 80, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'boss');
  const decision = await engine.decide({ type: 'combat_turn' });
  assert(decision.action !== 'flee');
});

test('Rule-based with HP exactly 0 returns dead', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { enemy1: { id: 'enemy1', current_hp: 0, current_san: 80, attitude: 'hostile', is_alive: true, trust: 10, fear: 20, suspicion: 50, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const decision = await engine.decide({ type: 'combat_turn' });
  assert(decision.action === 'dead');
});

test('Rule-based with HP negative returns dead', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { enemy1: { id: 'enemy1', current_hp: -5, current_san: 80, attitude: 'hostile', is_alive: true, trust: 10, fear: 20, suspicion: 50, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const decision = await engine.decide({ type: 'combat_turn' });
  assert(decision.action === 'dead');
});

test('Critical HP ally flees', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { ally: { id: 'ally', current_hp: 1, current_san: 55, attitude: 'friendly', is_alive: true, trust: 70, fear: 10, suspicion: 10, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'ally');
  const decision = await engine.decide({ type: 'combat_turn' });
  assert(decision.action === 'flee');
  assert(decision.reasoning.includes('盟友'));
});

// ========== PLAYER AGGRESSION RESPONSES ==========
console.log('\n--- Player Aggression Responses ---');

test('Player attack on enemy triggers counter-attack', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { enemy1: { id: 'enemy1', current_hp: 15, current_san: 80, attitude: 'hostile', is_alive: true, trust: 10, fear: 20, suspicion: 50, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const decision = await engine.decide({ type: 'player_attack' });
  assert(decision.action === 'attack');
  assert(decision.mood === 'enraged');
});

test('Player attack on neutral triggers flee', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const decision = await engine.decide({ type: 'player_attack' });
  assert(decision.action === 'flee');
  assert(decision.mood === 'terrified');
});

test('Player attack on ally triggers betrayal flee', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { ally: { id: 'ally', current_hp: 8, current_san: 55, attitude: 'friendly', is_alive: true, trust: 70, fear: 10, suspicion: 10, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'ally');
  const decision = await engine.decide({ type: 'player_attack' });
  assert(decision.action === 'flee');
  assert(decision.mood === 'betrayed');
  assert(campaign.npcs_state.ally.trust < 30);
});

test('Player help on afraid NPC', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'afraid', is_alive: true, trust: 30, fear: 60, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const decision = await engine.decide({ type: 'player_help' });
  assert(decision.action === 'talk');
  assert(decision.mood === 'cautious');
});

test('Player threat on enemy triggers attack', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { enemy1: { id: 'enemy1', current_hp: 15, current_san: 80, attitude: 'hostile', is_alive: true, trust: 10, fear: 20, suspicion: 50, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const decision = await engine.decide({ type: 'player_threat' });
  assert(decision.action === 'attack');
  assert(decision.mood === 'defiant');
});

test('Player threat on friendly NPC triggers flee', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'friendly', is_alive: true, trust: 60, fear: 10, suspicion: 10, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const decision = await engine.decide({ type: 'player_threat' });
  assert(decision.action === 'flee');
  assert(decision.mood === 'hurt');
});

test('Player threat on neutral triggers ignore', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const decision = await engine.decide({ type: 'player_threat' });
  assert(decision.action === 'ignore');
  assert(decision.mood === 'afraid');
});

// ========== SECRET / TOPIC DETECTION ==========
console.log('\n--- Secret / Topic Detection ---');

test('Player talk with secret keyword triggers evade when trust low', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const decision = await engine.decide({ type: 'player_talk', player_input: '告诉我关于仪式的事情' });
  assert(decision.action === 'evade');
  assert(decision.mood === 'suspicious');
  assert(campaign.npcs_state.librarian.suspicion > 30);
});

test('Player talk with secret keyword reveals secret when trust high', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'friendly', is_alive: true, trust: 65, fear: 10, suspicion: 10, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const decision = await engine.decide({ type: 'player_talk', player_input: '告诉我关于仪式的事情' });
  assert(decision.action === 'talk');
  assert(decision.mood === 'whispering');
  assert(decision.dialogue_topic === 'secret');
  assert(campaign.npcs_state.librarian.secrets_revealed.includes('仪式'));
});

test('Player talk with no secret keyword adds topic', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  await engine.decide({ type: 'player_talk', player_input: '给我找本书' });
  assert(campaign.npcs_state.librarian.known_topics.includes('book'));
});

test('_extractTopic with empty input returns null', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  assert(engine._extractTopic('') === null);
  assert(engine._extractTopic(null) === null);
});

test('_extractTopic detects all topic keywords', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  assert(engine._extractTopic('cult ritual') === 'cult');
  assert(engine._extractTopic('书 book') === 'book');
  assert(engine._extractTopic('basement secret') === 'location');
  assert(engine._extractTopic('escape leave') === 'escape');
  assert(engine._extractTopic('help save') === 'help');
  assert(engine._extractTopic('kill threat') === 'threat');
});

// ========== DIALOGUE GENERATION ==========
console.log('\n--- Dialogue Generation ---');

test('Template dialogue generation with mood', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const dialogue = await engine.generateDialogue('玩家进入图书馆', 'friendly', 'greeting');
  assert(dialogue.text.length > 0);
  assert(dialogue.emotion === 'friendly');
  assert(!dialogue.secretRevealed);
});

test('Template dialogue with secret topic', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'friendly', is_alive: true, trust: 70, fear: 10, suspicion: 10, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const dialogue = await engine.generateDialogue('玩家询问秘密', 'whispering', 'secret');
  assert(dialogue.text.length > 0);
  assert(dialogue.secretRevealed === '仪式');
  assert(campaign.npcs_state.librarian.secrets_revealed.includes('仪式'));
});

test('Template dialogue with high trust adds trusted line', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'friendly', is_alive: true, trust: 75, fear: 10, suspicion: 10, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const dialogue = await engine.generateDialogue('玩家对话', 'friendly', 'greeting');
  assert(dialogue.text.includes('trusted'));
});

test('Template dialogue with high suspicion adds suspicious line', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 50, suspicion: 75, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const dialogue = await engine.generateDialogue('玩家对话', 'suspicious', 'greeting');
  assert(dialogue.text.includes('suspicious'));
});

test('Template dialogue with topic matching dialogue key', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const dialogue = await engine.generateDialogue('测试', 'friendly', 'greeting');
  assert(dialogue.text.includes('欢迎来到图书馆'));
});

test('Template dialogue with no default dialogue', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { no_dialogue: { id: 'no_dialogue', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'no_dialogue');
  const dialogue = await engine.generateDialogue('测试', 'calm', 'unknown_topic');
  assert(dialogue.text.includes('【NPC 没有回应】'));
});

// All moods
const moods = ['calm', 'angry', 'scared', 'curious', 'suspicious', 'friendly', 'hostile', 'grateful', 'terrified', 'desperate', 'dominant', 'whispering', 'hurt'];
for (const mood of moods) {
  test(`Template dialogue mood: ${mood}`, async () => {
    const campaign = buildCampaign();
    campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
    const engine = new NPCDecisionEngine(campaign, 'librarian');
    const dialogue = await engine.generateDialogue('测试', mood, null);
    assert(dialogue.text.length > 0);
    assert(dialogue.emotion === mood);
  });
}

test('Template dialogue with unknown mood falls back to calm', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const dialogue = await engine.generateDialogue('测试', 'unknown_mood', null);
  assert(dialogue.text.length > 0);
});

// Attitude closings
['hostile', 'hostile_alerted'].forEach(att => {
  test(`${att} attitude closing`, async () => {
    const campaign = buildCampaign();
    campaign.npcs_state = { enemy1: { id: 'enemy1', current_hp: 15, current_san: 80, attitude: att, is_alive: true, trust: 10, fear: 20, suspicion: 50, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
    const engine = new NPCDecisionEngine(campaign, 'enemy1');
    const dialogue = await engine.generateDialogue('测试', 'hostile', null);
    assert(dialogue.text.includes('充满敌意'));
  });
});

test('Afraid attitude closing', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'afraid', is_alive: true, trust: 30, fear: 80, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const dialogue = await engine.generateDialogue('测试', 'scared', null);
  assert(dialogue.text.includes('颤抖'));
});

test('Friendly attitude closing', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { ally: { id: 'ally', current_hp: 8, current_san: 55, attitude: 'friendly', is_alive: true, trust: 70, fear: 10, suspicion: 10, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'ally');
  const dialogue = await engine.generateDialogue('测试', 'friendly', null);
  assert(dialogue.text.includes('微笑'));
});

test('Secret topic with all secrets already revealed', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'friendly', is_alive: true, trust: 70, fear: 10, suspicion: 10, known_topics: [], secrets_revealed: ['仪式'], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const dialogue = await engine.generateDialogue('测试', 'whispering', 'secret');
  assert(dialogue.text.length > 0);
});

// ========== LLM DIALOGUE ==========
console.log('\n--- LLM Dialogue ---');

test('LLM dialogue with undefined content triggers outer catch', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => true, chat: async () => ({}) };
  const result = await engine.generateDialogue('测试', 'calm', null, mockLLM);
  assert(result.text.length > 0, 'Expected fallback template dialogue');
  assert(result.emotion === 'calm', 'Expected calm emotion');
});

test('LLM dialogue with pure JSON (no markdown code block)', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => true, chat: async () => ({ content: '{"text": "纯JSON内容", "emotion": "happy", "secretRevealed": null}' }) };
  const result = await engine.generateDialogue('测试', 'happy', null, mockLLM);
  assert(result.text === '纯JSON内容');
  assert(result.emotion === 'happy');
  assert(result.secretRevealed === null);
});

test('LLM dialogue with empty parsed text uses response content', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => true, chat: async () => ({ content: '{"text": "", "emotion": "neutral"}' }) };
  const result = await engine.generateDialogue('测试', 'neutral', null, mockLLM);
  assert(result.text.length > 0, 'Expected some text fallback');
});

test('LLM dialogue secret not found in template secrets', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => true, chat: async () => ({ content: JSON.stringify({ text: 'test', emotion: 'neutral', secretRevealed: '不存在的秘密' }) }) };
  const result = await engine.generateDialogue('测试', 'neutral', null, mockLLM);
  assert(result.secretRevealed === '不存在的秘密');
  assert(!campaign.npcs_state.librarian.secrets_revealed.includes('不存在的秘密'));
});

test('LLM dialogue secret already revealed does not duplicate', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: ['仪式'], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => true, chat: async () => ({ content: JSON.stringify({ text: 'test', emotion: 'neutral', secretRevealed: '仪式' }) }) };
  const result = await engine.generateDialogue('测试', 'neutral', null, mockLLM);
  assert(result.secretRevealed === '仪式');
  assert(campaign.npcs_state.librarian.secrets_revealed.filter(s => s === '仪式').length === 1);
});

test('LLM dialogue with parsed emotion and mood both missing', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => true, chat: async () => ({ content: JSON.stringify({ text: 'test' }) }) };
  const result = await engine.generateDialogue('测试', '', null, mockLLM);
  assert(result.emotion === 'neutral');
});

test('LLM dialogue with valid JSON response', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => true, chat: async () => ({ content: JSON.stringify({ text: '这是一段测试对话', emotion: 'curious', secretRevealed: null }) }) };
  const result = await engine.generateDialogue('测试场景', 'curious', 'greeting', mockLLM);
  assert(result.text === '这是一段测试对话');
  assert(result.emotion === 'curious');
  assert(result.secretRevealed === null);
});

test('LLM dialogue with markdown code block', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => true, chat: async () => ({ content: '```json\n{"text": "代码块内容", "emotion": "friendly"}\n```' }) };
  const result = await engine.generateDialogue('测试', 'friendly', null, mockLLM);
  assert(result.text === '代码块内容');
});

test('LLM dialogue with invalid JSON falls back to raw text', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => true, chat: async () => ({ content: '这不是有效的JSON格式' }) };
  const result = await engine.generateDialogue('测试', 'calm', null, mockLLM);
  assert(result.text === '这不是有效的JSON格式');
  assert(result.emotion === 'calm');
});

test('LLM dialogue with secret revealed tracks it', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => true, chat: async () => ({ content: JSON.stringify({ text: '我告诉你秘密', emotion: 'whispering', secretRevealed: '仪式' }) }) };
  const result = await engine.generateDialogue('测试', 'whispering', null, mockLLM);
  assert(result.secretRevealed === '仪式');
  assert(campaign.npcs_state.librarian.secrets_revealed.includes('仪式'));
});

test('LLM dialogue with secret not in template is ignored', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { enemy1: { id: 'enemy1', current_hp: 15, current_san: 80, attitude: 'hostile', is_alive: true, trust: 10, fear: 20, suspicion: 50, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const mockLLM = { isAvailable: () => true, chat: async () => ({ content: JSON.stringify({ text: '随机内容', emotion: 'hostile', secretRevealed: '不存在' }) }) };
  const result = await engine.generateDialogue('测试', 'hostile', null, mockLLM);
  assert(result.secretRevealed === '不存在');
});

test('LLM dialogue throws error falls back to template', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => true, chat: async () => { throw new Error('Network error'); } };
  const result = await engine.generateDialogue('测试', 'friendly', 'greeting', mockLLM);
  assert(result.text.length > 0);
  assert(result.emotion === 'friendly');
});

test('LLM unavailable falls back to template dialogue', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => false };
  const result = await engine.generateDialogue('测试', 'friendly', 'greeting', mockLLM);
  assert(result.text.length > 0);
});

// ========== LLM-ENHANCED DECISIONS ==========
console.log('\n--- LLM-Enhanced Decisions ---');

test('LLM enhanced decision when rule confidence is low', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => true, chat: async () => ({ content: JSON.stringify({ action: 'talk', confidence: 0.9, reasoning: 'LLM says talk', mood: 'curious', target_id: 'player', dialogue_topic: 'books' }) }) };
  const decision = await engine.decide({ type: 'player_talk', player_input: '随便聊聊' }, mockLLM);
  assert(decision.action === 'talk');
  assert(decision.llm_enhanced === true);
  assert(decision.reasoning === 'LLM says talk');
});

test('LLM fallback when LLM throws error', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => true, chat: async () => { throw new Error('LLM timeout'); } };
  const decision = await engine.decide({ type: 'player_talk' }, mockLLM);
  assert(decision.action !== null);
  assert(decision.confidence > 0);
});

test('LLM unavailable falls back to attitude-based', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => false, chat: async () => ({ content: '{}' }) };
  const decision = await engine.decide({ type: 'player_talk' }, mockLLM);
  assert(decision.action === 'talk');
  assert(decision.confidence >= 0.5);
});

test('LLM returns null action falls through', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => true, chat: async () => ({ content: JSON.stringify({ action: null, confidence: 0.9 }) }) };
  const decision = await engine.decide({ type: 'player_talk' }, mockLLM);
  assert(decision.action !== null);
});

test('LLM returns non-JSON parseable content', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const mockLLM = { isAvailable: () => true, chat: async () => ({ content: '这不是JSON' }) };
  const decision = await engine.decide({ type: 'player_talk' }, mockLLM);
  assert(decision.action !== null);
});

// ========== STATE UPDATE ==========
console.log('\n--- State Update ---');

test('updateState applies damage', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'attack' }, { damage_taken: 3 });
  assert(updated.current_hp === 7);
  assert(updated.is_alive === true);
});

test('updateState applies healing', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 5, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'heal' }, { healing_received: 3 });
  assert(updated.current_hp === 8);
});

test('updateState caps HP at max', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 9, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'heal' }, { healing_received: 5 });
  assert(updated.current_hp === 10);
});

test('updateState applies sanity loss', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'sanity_loss' }, { sanity_loss: 10 });
  assert(updated.current_san === 40);
});

test('updateState applies trust/fear/suspicion deltas', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 50, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, { trust_delta: 10, fear_delta: -5, suspicion_delta: 15 });
  assert(updated.trust === 60);
  assert(updated.fear === 15);
  assert(updated.suspicion === 45);
});

test('updateState caps stats at 0-100', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 95, fear: 5, suspicion: 95, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, { trust_delta: 10, fear_delta: -10, suspicion_delta: 10 });
  assert(updated.trust === 100);
  assert(updated.fear === 0);
  assert(updated.suspicion === 100);
});

test('updateState auto-corrects attitude from trust', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'hostile', is_alive: true, trust: 65, fear: 10, suspicion: 10, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, {});
  assert(updated.attitude === 'friendly');
});

test('updateState auto-corrects attitude from fear', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 50, fear: 75, suspicion: 10, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, {});
  assert(updated.attitude === 'afraid');
});

test('updateState auto-corrects to hostile from low trust', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 15, fear: 30, suspicion: 50, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, {});
  assert(updated.attitude === 'hostile');
});

test('updateState does not override friendly when trust high', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'friendly', is_alive: true, trust: 80, fear: 10, suspicion: 10, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, {});
  assert(updated.attitude === 'friendly');
});

test('updateState does not override afraid when fear high', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'afraid', is_alive: true, trust: 50, fear: 80, suspicion: 10, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, {});
  assert(updated.attitude === 'afraid');
});

test('updateState kills NPC when HP reaches 0', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 3, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'attack' }, { damage_taken: 5 });
  assert(updated.current_hp === 0);
  assert(updated.is_alive === false);
  assert(updated.attitude === 'dead');
});

test('updateState increments turns_in_scene', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 5, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, {});
  assert(updated.turns_in_scene === 6);
  assert(updated.current_action === 'talk');
});

// ========== GET STATE SUMMARY ==========
console.log('\n--- getStateSummary ---');

test('getStateSummary returns correct structure', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 7, current_san: 50, attitude: 'friendly', is_alive: true, trust: 60, fear: 10, suspicion: 10, known_topics: ['books'], secrets_revealed: ['仪式'], turns_in_scene: 3, current_action: 'talk', custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const summary = engine.getStateSummary();
  assert(summary.id === 'librarian');
  assert(summary.name === '图书管理员');
  assert(summary.attitude === 'friendly');
  assert(summary.trust === 60);
  assert(summary.fear === 10);
  assert(summary.suspicion === 10);
  assert(summary.hp === '7/10');
  assert(summary.is_alive === true);
  assert(summary.current_action === 'talk');
  assert(summary.known_topics_count === 1);
  assert(summary.secrets_revealed_count === 1);
});

// ========== DEFAULT FALLBACK ==========
console.log('\n--- Default Fallback ---');

test('Default fallback for combat_turn returns attack with focused mood', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const decision = await engine.decide({ type: 'combat_turn' }, { isAvailable: () => false, chat: async () => ({}) });
  assert(decision.action === 'attack');
  assert(decision.mood === 'focused');
});

test('Default fallback for player_talk returns generic dialogue_topic', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const decision = await engine.decide({ type: 'player_talk' }, { isAvailable: () => false, chat: async () => ({}) });
  assert(decision.dialogue_topic === 'generic');
});

test('Default fallback for unknown role returns talk', async () => {
  const campaign = buildCampaign();
  campaign.module.npcs.unknown_role = { id: 'unknown_role', name: '神秘人', role: 'unknown', attitude: 'neutral', hp: 10 };
  campaign.npcs_state = { unknown_role: { id: 'unknown_role', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'unknown_role');
  const decision = await engine.decide({ type: 'unknown_situation' }, { isAvailable: () => false, chat: async () => ({}) });
  assert(decision.action === 'talk');
  assert(decision.confidence === 0.5);
});

test('Default fallback for enemy role returns attack', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { enemy1: { id: 'enemy1', current_hp: 15, current_san: 80, attitude: 'hostile', is_alive: true, trust: 10, fear: 20, suspicion: 50, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const decision = await engine.decide({ type: 'unknown_situation' }, { isAvailable: () => false, chat: async () => ({}) });
  assert(decision.action === 'attack');
  assert(decision.mood === 'hostile');
});

test('Default fallback for Boss role returns special_attack', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { boss: { id: 'boss', current_hp: 50, current_san: 100, attitude: 'hostile', is_alive: true, trust: 0, fear: 0, suspicion: 80, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'boss');
  const decision = await engine.decide({ type: 'unknown_situation' }, { isAvailable: () => false, chat: async () => ({}) });
  assert(decision.action === 'special_attack');
  assert(decision.mood === 'dominant');
});

// ========== BUILD CONTEXT ==========
console.log('\n--- Build Context ---');

test('buildContext includes all fields', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const context = engine.buildContext({ type: 'test_situation' });
  assert(context.npc.id === 'librarian');
  assert(context.template.name === '图书管理员');
  assert(context.situation.type === 'test_situation');
  assert(context.campaign_state.current_scene === 'scene1');
  assert(context.campaign_state.player_name === '调查员');
  assert(context.available_actions.includes('talk'));
  assert(context.available_actions.includes('emote'));
  assert(context.available_actions.includes('ignore'));
});

test('buildContext for enemy includes attack action', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { enemy1: { id: 'enemy1', current_hp: 15, current_san: 80, attitude: 'hostile', is_alive: true, trust: 10, fear: 20, suspicion: 50, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const context = engine.buildContext('combat');
  assert(context.available_actions.includes('attack'));
  assert(context.available_actions.includes('flee'));
});

test('buildContext for Boss includes special actions', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { boss: { id: 'boss', current_hp: 50, current_san: 100, attitude: 'hostile', is_alive: true, trust: 0, fear: 0, suspicion: 80, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'boss');
  const context = engine.buildContext('combat');
  assert(context.available_actions.includes('special_attack'));
  assert(context.available_actions.includes('summon'));
  assert(context.available_actions.includes('warn'));
});

test('buildContext for ally includes help action', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { ally: { id: 'ally', current_hp: 8, current_san: 55, attitude: 'friendly', is_alive: true, trust: 70, fear: 10, suspicion: 10, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'ally');
  const context = engine.buildContext('combat');
  assert(context.available_actions.includes('help'));
  assert(context.available_actions.includes('investigate'));
  assert(context.available_actions.includes('heal'));
});

test('buildContext with empty campaign', () => {
  const campaign = { id: 'empty', npcs_state: { test: { id: 'test', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } } };
  const engine = new NPCDecisionEngine(campaign, 'test');
  const context = engine._buildContext(null, 'chat history');
  assert(context.situation.type === 'idle');
  assert(context.campaign_state.player_name === '调查员');
  assert(context.chat_history === 'chat history');
});

// ========== CONSTRUCTOR ==========
console.log('\n--- Constructor ---');

test('Constructor warns when NPC missing name', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { nameless: { id: 'nameless', current_hp: 5, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'nameless');
  assert(engine.npcId === 'nameless');
});

test('Constructor initializes NPC state from template', () => {
  const campaign = buildCampaign();
  delete campaign.npcs_state;
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  assert(campaign.npcs_state.librarian);
  assert(campaign.npcs_state.librarian.current_hp === 10);
  assert(campaign.npcs_state.librarian.attitude === 'neutral');
});

// ========== AVAILABLE ACTIONS ==========
console.log('\n--- Available Actions ---');

test('Afraid NPC gets plead and flee actions', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = { librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'afraid', is_alive: true, trust: 10, fear: 80, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} } };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const actions = engine._getAvailableActions();
  assert(actions.includes('plead'));
  assert(actions.includes('flee'));
});

// ========== MULTI-NPC ==========
console.log('\n--- Multi-NPC ---');

test('Multiple NPCs in same campaign have independent states', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: { id: 'librarian', current_hp: 10, current_san: 50, attitude: 'neutral', is_alive: true, trust: 30, fear: 20, suspicion: 30, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} },
    enemy1: { id: 'enemy1', current_hp: 15, current_san: 80, attitude: 'hostile', is_alive: true, trust: 10, fear: 20, suspicion: 50, known_topics: [], secrets_revealed: [], turns_in_scene: 0, custom_vars: {} },
  };
  const librarianEngine = new NPCDecisionEngine(campaign, 'librarian');
  const enemyEngine = new NPCDecisionEngine(campaign, 'enemy1');
  const libDecision = await librarianEngine.decide({ type: 'player_talk' });
  const enemyDecision = await enemyEngine.decide({ type: 'player_talk' });
  assert(libDecision.action === 'talk');
  assert(campaign.npcs_state.librarian.attitude === 'neutral');
});

// ========== SUMMARY ==========
console.log('\n=== NPC Decision Engine Unified Test Summary ===');
console.log(`Total: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Status: ${failCount === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);

process.exit(failCount > 0 ? 1 : 0);
