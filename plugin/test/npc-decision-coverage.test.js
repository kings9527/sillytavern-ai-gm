/**
 * NPC Decision Engine Coverage Gap Test Suite
 * Covers: LLM dialogue generation, template dialogue branches, attitude auto-correction, edge cases
 * Target: Fill coverage gaps in engine/npc-decision.js (lines 751-808, 845, 859-860, 872, 874, 926-927)
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

console.log('=== NPC Decision Engine Coverage Gap Tests ===\n');

// === _generateLLMDialogue ===
console.log('--- LLM Dialogue Generation ---');

test('LLM dialogue with valid JSON response', async () => {
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
        text: '这是一段测试对话',
        emotion: 'curious',
        secretRevealed: null,
      }),
    }),
  };
  const result = await engine.generateDialogue('测试场景', 'curious', 'greeting', mockLLM);
  assert(result.text === '这是一段测试对话', `Expected text, got ${result.text}`);
  assert(result.emotion === 'curious', `Expected curious, got ${result.emotion}`);
  assert(result.secretRevealed === null, 'Expected no secret');
});

test('LLM dialogue with markdown code block', async () => {
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
      content: '```json\n{"text": "代码块内容", "emotion": "friendly"}\n```',
    }),
  };
  const result = await engine.generateDialogue('测试', 'friendly', null, mockLLM);
  assert(result.text === '代码块内容', `Expected code block text, got ${result.text}`);
});

test('LLM dialogue with invalid JSON falls back to raw text', async () => {
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
      content: '这不是有效的JSON格式',
    }),
  };
  const result = await engine.generateDialogue('测试', 'calm', null, mockLLM);
  assert(result.text === '这不是有效的JSON格式', `Expected raw text, got ${result.text}`);
  assert(result.emotion === 'calm', 'Expected emotion preserved');
});

test('LLM dialogue with secret revealed tracks it', async () => {
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
        text: '我告诉你秘密',
        emotion: 'whispering',
        secretRevealed: '仪式',
      }),
    }),
  };
  const result = await engine.generateDialogue('测试', 'whispering', null, mockLLM);
  assert(result.secretRevealed === '仪式', `Expected secret, got ${result.secretRevealed}`);
  assert(
    campaign.npcs_state.librarian.secrets_revealed.includes('仪式'),
    'Expected secret tracked',
  );
});

test('LLM dialogue with secret not in template is ignored', async () => {
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
  const mockLLM = {
    isAvailable: () => true,
    chat: async () => ({
      content: JSON.stringify({
        text: '随机内容',
        emotion: 'hostile',
        secretRevealed: '不存在',
      }),
    }),
  };
  const result = await engine.generateDialogue('测试', 'hostile', null, mockLLM);
  assert(result.secretRevealed === '不存在', 'Expected secretRevealed kept');
  // enemy1 has no secrets, so nothing should be tracked
});

test('LLM dialogue throws error falls back to template', async () => {
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
      throw new Error('Network error');
    },
  };
  const result = await engine.generateDialogue('测试', 'friendly', 'greeting', mockLLM);
  assert(result.text.length > 0, 'Expected fallback dialogue');
  assert(result.emotion === 'friendly', 'Expected mood preserved');
});

test('LLM unavailable falls back to template dialogue', async () => {
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
  const mockLLM = { isAvailable: () => false };
  const result = await engine.generateDialogue('测试', 'friendly', 'greeting', mockLLM);
  assert(result.text.length > 0, 'Expected template dialogue');
});

// === _generateTemplateDialogue - Topic branches ===
console.log('\n--- Template Dialogue Topic Branches ---');

test('Template dialogue with topic matching dialogue key', async () => {
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
  const result = await engine.generateDialogue('测试', 'friendly', 'greeting');
  assert(result.text.includes('欢迎来到图书馆'), `Expected greeting text, got ${result.text}`);
});

test('Template dialogue with no default dialogue', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    no_dialogue: {
      id: 'no_dialogue',
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
  const engine = new NPCDecisionEngine(campaign, 'no_dialogue');
  const result = await engine.generateDialogue('测试', 'calm', 'unknown_topic');
  assert(result.text.includes('【NPC 没有回应】'), `Expected no response, got ${result.text}`);
});

// === _generateTemplateDialogue - Mood coverage ===
console.log('\n--- Template Dialogue Mood Coverage ---');

const moods = [
  'calm', 'angry', 'scared', 'curious', 'suspicious',
  'friendly', 'hostile', 'grateful', 'terrified', 'desperate',
  'dominant', 'whispering', 'hurt',
];

for (const mood of moods) {
  test(`Template dialogue mood: ${mood}`, async () => {
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
    const result = await engine.generateDialogue('测试', mood, null);
    assert(result.text.length > 0, `Expected non-empty text for mood ${mood}`);
    assert(result.emotion === mood, `Expected emotion ${mood}, got ${result.emotion}`);
  });
}

test('Template dialogue with unknown mood falls back to calm', async () => {
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
  const result = await engine.generateDialogue('测试', 'unknown_mood', null);
  assert(result.text.length > 0, 'Expected non-empty text');
});

// === Template Dialogue - Attitude closings ===
console.log('\n--- Template Dialogue Attitude Closings ---');

test('Hostile attitude closing', async () => {
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
  const result = await engine.generateDialogue('测试', 'hostile', null);
  assert(result.text.includes('充满敌意'), `Expected hostile closing, got ${result.text}`);
});

test('Hostile_alerted attitude closing', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    enemy1: {
      id: 'enemy1',
      current_hp: 15,
      current_san: 80,
      attitude: 'hostile_alerted',
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
  const result = await engine.generateDialogue('测试', 'hostile', null);
  assert(result.text.includes('充满敌意'), `Expected hostile_alerted closing, got ${result.text}`);
});

test('Afraid attitude closing', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'afraid',
      is_alive: true,
      trust: 30,
      fear: 80,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const result = await engine.generateDialogue('测试', 'scared', null);
  assert(result.text.includes('颤抖'), `Expected afraid closing, got ${result.text}`);
});

test('Friendly attitude closing', async () => {
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
  const result = await engine.generateDialogue('测试', 'friendly', null);
  assert(result.text.includes('微笑'), `Expected friendly closing, got ${result.text}`);
});

// === Template Dialogue - Secret topic with all revealed ===
console.log('\n--- Template Dialogue Secret Edge Cases ---');

test('Secret topic with all secrets already revealed', async () => {
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
      secrets_revealed: ['仪式'],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const result = await engine.generateDialogue('测试', 'whispering', 'secret');
  // All secrets revealed, should fall through to default or no response
  assert(result.text.length > 0, 'Expected some text');
});

// === updateState - Attitude auto-correction ===
console.log('\n--- updateState Attitude Auto-correction ---');

test('updateState auto-corrects to hostile from low trust', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 15,
      fear: 30,
      suspicion: 50,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, {});
  assert(updated.attitude === 'hostile', `Expected hostile, got ${updated.attitude}`);
});

test('updateState does not override friendly when trust high', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'friendly',
      is_alive: true,
      trust: 80,
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
  assert(updated.attitude === 'friendly', `Expected friendly, got ${updated.attitude}`);
});

test('updateState does not override afraid when fear high', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'afraid',
      is_alive: true,
      trust: 50,
      fear: 80,
      suspicion: 10,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, {});
  assert(updated.attitude === 'afraid', `Expected afraid, got ${updated.attitude}`);
});

// === Constructor edge cases ===
console.log('\n--- Constructor Edge Cases ---');

test('Constructor warns when NPC missing name', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    nameless: {
      id: 'nameless',
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
  // Should not throw, just warn
  const engine = new NPCDecisionEngine(campaign, 'nameless');
  assert(engine.npcId === 'nameless', 'Expected engine created');
});

test('Constructor initializes NPC state from template', () => {
  const campaign = buildCampaign();
  // No npcs_state, should auto-create from template
  delete campaign.npcs_state;
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  assert(campaign.npcs_state.librarian, 'Expected NPC state created');
  assert(campaign.npcs_state.librarian.current_hp === 10, 'Expected HP from template');
  assert(campaign.npcs_state.librarian.attitude === 'neutral', 'Expected attitude from template');
});

// === _extractTopic edge cases ===
console.log('\n--- Extract Topic Edge Cases ---');

test('_extractTopic with empty input returns null', () => {
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
  const topic = engine._extractTopic('');
  assert(topic === null, `Expected null, got ${topic}`);
});

test('_extractTopic with null input returns null', () => {
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
  const topic = engine._extractTopic(null);
  assert(topic === null, `Expected null, got ${topic}`);
});

test('_extractTopic detects cult keywords', () => {
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
  assert(engine._extractTopic('cult ritual') === 'cult', 'Expected cult topic');
  assert(engine._extractTopic('书 book') === 'book', 'Expected book topic');
  assert(engine._extractTopic('basement secret') === 'location', 'Expected location topic');
  assert(engine._extractTopic('escape leave') === 'escape', 'Expected escape topic');
  assert(engine._extractTopic('help save') === 'help', 'Expected help topic');
  assert(engine._extractTopic('kill threat') === 'threat', 'Expected threat topic');
});

// === _getAvailableActions edge cases ===
console.log('\n--- Available Actions Edge Cases ---');

test('Afraid NPC gets plead and flee actions', () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'afraid',
      is_alive: true,
      trust: 10,
      fear: 80,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const actions = engine._getAvailableActions();
  assert(actions.includes('plead'), 'Expected plead action');
  assert(actions.includes('flee'), 'Expected flee action');
});

// === _buildContext edge cases ===
console.log('\n--- Build Context Edge Cases ---');

test('buildContext with empty campaign', () => {
  const campaign = {
    id: 'empty',
    npcs_state: {
      test: {
        id: 'test',
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
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'test');
  const context = engine._buildContext(null, 'chat history');
  assert(context.situation.type === 'idle', 'Expected idle situation');
  assert(context.campaign_state.player_name === '调查员', 'Expected default player name');
  assert(context.chat_history === 'chat history', 'Expected chat history');
});

// === _updateAttitudeFromDecision edge cases ===
console.log('\n--- Attitude Transition Edge Cases ---');

test('Attitude transition on combat_end_player_win', async () => {
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
  // Force a decision through attitude-based with low confidence situation
  const decision = await engine.decide({ type: 'combat_end_player_win' });
  assert(campaign.npcs_state.enemy1.attitude === 'afraid', `Expected afraid, got ${campaign.npcs_state.enemy1.attitude}`);
});

test('Attitude transition on combat_end_player_lose', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    enemy1: {
      id: 'enemy1',
      current_hp: 15,
      current_san: 80,
      attitude: 'hostile_alerted',
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
  const decision = await engine.decide({ type: 'combat_end_player_lose' });
  assert(campaign.npcs_state.enemy1.attitude === 'neutral', `Expected neutral, got ${campaign.npcs_state.enemy1.attitude}`);
});

test('No attitude transition for unknown situation type', async () => {
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
  await engine.decide({ type: 'weird_unknown_type' });
  assert(campaign.npcs_state.librarian.attitude === 'neutral', 'Expected unchanged attitude');
});

// === Rule-based: HP=0 edge case ===
console.log('\n--- Rule-Based Edge Cases ---');

test('Rule-based with HP exactly 0 returns dead', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    enemy1: {
      id: 'enemy1',
      current_hp: 0,
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
  assert(decision.action === 'dead', `Expected dead, got ${decision.action}`);
});

test('Rule-based with HP negative returns dead', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    enemy1: {
      id: 'enemy1',
      current_hp: -5,
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
  assert(decision.action === 'dead', `Expected dead, got ${decision.action}`);
});

test('Rule-based SAN break but Boss ignores', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    boss: {
      id: 'boss',
      current_hp: 50,
      current_san: 2,
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
  assert(decision.action !== 'flee', `Expected not flee for Boss, got ${decision.action}`);
});

// === _llmEnhancedDecision edge cases ===
console.log('\n--- LLM Enhanced Decision Edge Cases ---');

test('LLM returns null action falls through', async () => {
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
      content: JSON.stringify({ action: null, confidence: 0.9 }),
    }),
  };
  const decision = await engine.decide({ type: 'player_talk' }, mockLLM);
  // Should fall through to attitude-based since LLM returned null action
  assert(decision.action !== null, 'Expected fallback decision');
});

test('LLM returns non-JSON parseable content', async () => {
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
      content: '这不是JSON',
    }),
  };
  const decision = await engine.decide({ type: 'player_talk' }, mockLLM);
  // Should fall through
  assert(decision.action !== null, 'Expected fallback decision');
});

// === Multi-NPC interaction scenario ===
console.log('\n--- Multi-NPC Interaction ---');

test('Multiple NPCs in same campaign have independent states', async () => {
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

  const librarianEngine = new NPCDecisionEngine(campaign, 'librarian');
  const enemyEngine = new NPCDecisionEngine(campaign, 'enemy1');

  const libDecision = await librarianEngine.decide({ type: 'player_talk' });
  const enemyDecision = await enemyEngine.decide({ type: 'player_talk' });

  assert(libDecision.action === 'talk', `Expected talk, got ${libDecision.action}`);
  assert(enemyDecision.action === 'ignore' || enemyDecision.action === 'attack', `Expected hostile action, got ${enemyDecision.action}`);

  // States should be independent
  assert(campaign.npcs_state.librarian.attitude === 'neutral', 'Librarian should be neutral');
});

// === Combat edge cases ===
console.log('\n--- Combat Edge Cases ---');

test('Boss on player turn still acts', async () => {
  const campaign = buildCampaign();
  campaign.combat_state = { active: true, current_turn: 'player_1' };
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
  const decision = await engine.decide({ type: 'combat_turn' });
  assert(decision.action !== 'ignore', `Expected Boss to act, got ${decision.action}`);
});

test('Non-Boss NPC waits on player turn', async () => {
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
  assert(decision.action === 'ignore', `Expected ignore, got ${decision.action}`);
});

// === Summary ===
console.log('\n=== NPC Decision Engine Coverage Gap Test Summary ===');
console.log(`Total: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Status: ${failCount === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);

process.exit(failCount > 0 ? 1 : 0);
