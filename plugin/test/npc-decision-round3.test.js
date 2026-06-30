/**
 * NPC Decision Engine — Round 3 Coverage Tests
 * Target: fill remaining gaps to push Lines 72.53% → 80%+
 * Uncovered lines: 622-740 (generateDialogue + _llmEnhancedDecision catch paths),
 *                  751-808 (_generateLLMDialogue),
 *                  845 (template.dialogue[topic]), 872 (hostile closing), 874 (afraid closing),
 *                  926-927 (updateState trust<20 auto-correction)
 */

import { NPCDecisionEngine } from '../engine/npc-decision.js';

let passCount = 0;
let failCount = 0;

async function test(name, fn) {
  try {
    await fn();
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
    player: {
      name: '调查员',
      hp: 12,
      max_hp: 12,
      sanity: 60,
      max_sanity: 60,
      stats: { HP: 12, SAN: 60, STR: 50, DEX: 50, CON: 50, INT: 50, POW: 50 },
    },
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
            books: '“这些书都很古老。”',
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

console.log('=== NPC Decision Engine Round 3 Coverage Tests ===\n');

// =============================================================================
// _llmEnhancedDecision (lines 551-650) — deep coverage of all branches
// =============================================================================
console.log('--- _llmEnhancedDecision Deep Coverage ---');

await test('LLM returns valid JSON with all fields', async () => {
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
  const context = engine._buildContext({ type: 'player_talk', player_input: '你好' }, '');
  const mockLLM = {
    chat: async () => ({
      content: JSON.stringify({
        action: 'talk',
        confidence: 0.75,
        reasoning: '测试',
        mood: 'curious',
        target_id: 'player',
        dialogue_topic: 'greeting',
      }),
    }),
  };
  const decision = await engine._llmEnhancedDecision(context, mockLLM);
  assert(decision.action === 'talk', 'Expected talk');
  assert(decision.llm_enhanced === true, 'Expected llm_enhanced flag');
  assert(decision.confidence === 0.75, 'Expected confidence 0.75');
  assert(decision.reasoning === '测试', 'Expected reasoning');
  assert(decision.mood === 'curious', 'Expected mood');
  assert(decision.target_id === 'player', 'Expected target_id');
  assert(decision.dialogue_topic === 'greeting', 'Expected dialogue_topic');
});

await test('LLM returns JSON inside markdown code block', async () => {
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
  const context = engine._buildContext({ type: 'player_talk' }, '');
  const mockLLM = {
    chat: async () => ({
      content:
        '```json\n{"action":"ignore","confidence":0.6,"reasoning":"忽略","mood":"neutral","target_id":"player"}\n```',
    }),
  };
  const decision = await engine._llmEnhancedDecision(context, mockLLM);
  assert(decision.action === 'ignore', 'Expected ignore action from markdown JSON');
  assert(decision.llm_enhanced === true, 'Expected llm_enhanced flag');
});

await test('LLM returns invalid JSON → parseError catch → null (line 622-625)', async () => {
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
  const context = engine._buildContext({ type: 'player_talk' }, '');
  const mockLLM = {
    chat: async () => ({ content: '这不是JSON' }),
  };
  const decision = await engine._llmEnhancedDecision(context, mockLLM);
  assert(decision === null, 'Expected null on invalid JSON (covers lines 622-625)');
});

await test('LLM returns JSON without action → null (line 628-629)', async () => {
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
  const context = engine._buildContext({ type: 'player_talk' }, '');
  const mockLLM = {
    chat: async () => ({ content: '{"confidence":0.9}' }),
  };
  const decision = await engine._llmEnhancedDecision(context, mockLLM);
  assert(decision === null, 'Expected null when action missing (covers line 628-629)');
});

await test('LLM chat() throws → outer catch → null (line 643-648)', async () => {
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
  const context = engine._buildContext({ type: 'player_talk' }, '');
  const mockLLM = {
    chat: async () => {
      throw new Error('Network timeout');
    },
  };
  const decision = await engine._llmEnhancedDecision(context, mockLLM);
  assert(decision === null, 'Expected null on LLM error (covers lines 643-648)');
});

await test('LLM returns NaN confidence defaults to 0.5', async () => {
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
  const context = engine._buildContext({ type: 'player_talk' }, '');
  const mockLLM = {
    chat: async () => ({ content: '{"action":"talk","confidence":"abc"}' }),
  };
  const decision = await engine._llmEnhancedDecision(context, mockLLM);
  assert(decision.confidence === 0.5, 'Expected default confidence 0.5');
});

await test('LLM returns confidence > 1 gets clamped to 1', async () => {
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
  const context = engine._buildContext({ type: 'player_talk' }, '');
  const mockLLM = {
    chat: async () => ({ content: '{"action":"talk","confidence":1.5}' }),
  };
  const decision = await engine._llmEnhancedDecision(context, mockLLM);
  assert(decision.confidence === 1, 'Expected confidence clamped to 1');
});

await test('LLM returns confidence < 0 gets clamped to 0', async () => {
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
  const context = engine._buildContext({ type: 'player_talk' }, '');
  const mockLLM = {
    chat: async () => ({ content: '{"action":"talk","confidence":-0.5}' }),
  };
  const decision = await engine._llmEnhancedDecision(context, mockLLM);
  assert(decision.confidence === 0, 'Expected confidence clamped to 0');
});

await test('LLM returns JSON with missing fields uses defaults', async () => {
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

await test('chat_history included in LLM prompt', async () => {
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

await test('template secrets included in LLM prompt', async () => {
  const campaign = buildCampaign();
  campaign.module.npcs.librarian.secrets = [
    { keyword: 'cult', clue_id: 'clue_1', reveal_text: '邪教在地下室' },
  ];
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

await test('npc revealed secrets included in LLM prompt', async () => {
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
      secrets_revealed: ['cult'],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
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
  assert(
    sysMsg.content.includes('Already revealed: cult'),
    'Expected revealed secrets in prompt',
  );
});

await test('npc known topics included in LLM prompt', async () => {
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
      known_topics: ['books', 'magic'],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
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
  assert(
    sysMsg.content.includes('Known topics: books, magic'),
    'Expected known topics in prompt',
  );
});

// =============================================================================
// generateDialogue (lines 729-740) — LLM path + catch path
// =============================================================================
console.log('\n--- generateDialogue Coverage ---');

await test('generateDialogue uses LLM when available (line 731-733)', async () => {
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
      content: JSON.stringify({ text: 'LLM生成的对话', emotion: 'curious', secretRevealed: null }),
    }),
  };
  const result = await engine.generateDialogue('测试场景', 'curious', 'greeting', mockLLM);
  assert(result.text === 'LLM生成的对话', 'Expected LLM dialogue text');
  assert(result.emotion === 'curious', 'Expected emotion from LLM');
});

await test('generateDialogue LLM throws → catch → template fallback (line 734-739)', async () => {
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
      throw new Error('LLM dialogue failed');
    },
  };
  const result = await engine.generateDialogue('测试场景', 'friendly', 'greeting', mockLLM);
  assert(result.text.length > 0, 'Expected fallback template dialogue (covers line 734-739)');
  assert(result.emotion === 'friendly', 'Expected mood preserved');
});

await test('generateDialogue LLM unavailable → template fallback (line 742-743)', async () => {
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
  const result = await engine.generateDialogue('测试场景', 'friendly', 'greeting', mockLLM);
  assert(result.text.length > 0, 'Expected template fallback (covers line 742-743)');
});

// =============================================================================
// _generateLLMDialogue (lines 751-808) — full method coverage
// =============================================================================
console.log('\n--- _generateLLMDialogue Coverage ---');

await test('_generateLLMDialogue normal path (lines 751-808)', async () => {
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
    chat: async () => ({
      content: JSON.stringify({ text: '测试对话', emotion: 'friendly', secretRevealed: null }),
    }),
  };
  const result = await engine._generateLLMDialogue('测试场景', 'friendly', null, mockLLM);
  assert(result.text === '测试对话', 'Expected LLM text');
  assert(result.emotion === 'friendly', 'Expected emotion');
  assert(result.secretRevealed === null, 'Expected no secret');
});

await test('_generateLLMDialogue JSON parse error → raw text fallback (lines 787-793)', async () => {
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
    chat: async () => ({ content: '原始文本回复' }),
  };
  const result = await engine._generateLLMDialogue('测试场景', 'calm', null, mockLLM);
  assert(result.text === '原始文本回复', 'Expected raw text fallback (covers lines 787-793)');
  assert(result.emotion === 'calm', 'Expected mood preserved');
});

await test('_generateLLMDialogue parsed.text empty → response.content fallback (line 795)', async () => {
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
    chat: async () => ({
      content: JSON.stringify({ text: '', emotion: 'neutral' }),
    }),
  };
  const result = await engine._generateLLMDialogue('测试场景', 'neutral', null, mockLLM);
  // parsed.text is empty string (falsy), response.content.trim() is the JSON string
  assert(result.text.length > 0, 'Expected fallback to response.content');
});

await test('_generateLLMDialogue secret revealed is tracked (lines 800-804)', async () => {
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
    chat: async () => ({
      content: JSON.stringify({ text: '秘密', emotion: 'whispering', secretRevealed: '仪式' }),
    }),
  };
  const result = await engine._generateLLMDialogue('测试场景', 'whispering', null, mockLLM);
  assert(result.secretRevealed === '仪式', 'Expected secret revealed');
  assert(
    campaign.npcs_state.librarian.secrets_revealed.includes('仪式'),
    'Expected secret tracked (covers lines 800-804)',
  );
});

await test('_generateLLMDialogue secret not in template is ignored', async () => {
  const campaign = buildCampaign();
  campaign.module.npcs.librarian.secrets = [];
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
    chat: async () => ({
      content: JSON.stringify({ text: '秘密', emotion: 'neutral', secretRevealed: '不存在' }),
    }),
  };
  const result = await engine._generateLLMDialogue('测试场景', 'neutral', null, mockLLM);
  assert(result.secretRevealed === '不存在', 'Expected secretRevealed kept');
  assert(campaign.npcs_state.librarian.secrets_revealed.length === 0, 'Expected nothing tracked');
});

// =============================================================================
// _generateTemplateDialogue — remaining uncovered branches
// =============================================================================
console.log('\n--- _generateTemplateDialogue Remaining Branches ---');

await test('Template dialogue topic matches dialogue key (line 845)', async () => {
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
  const result = await engine.generateDialogue('测试', 'calm', 'books');
  assert(result.text.includes('这些书都很古老'), `Expected books text, got ${result.text}`);
});

await test('Template dialogue hostile closing (line 872)', async () => {
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
  assert(result.text.includes('充满敌意'), `Expected hostile closing (covers line 872), got ${result.text}`);
});

await test('Template dialogue hostile_alerted closing (line 872)', async () => {
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
  assert(result.text.includes('充满敌意'), `Expected hostile_alerted closing (covers line 872), got ${result.text}`);
});

await test('Template dialogue afraid closing (line 874)', async () => {
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
  assert(result.text.includes('颤抖'), `Expected afraid closing (covers line 874), got ${result.text}`);
});

// =============================================================================
// updateState — trust < 20 auto-correction (lines 926-927)
// =============================================================================
console.log('\n--- updateState Trust < 20 Auto-correction ---');

await test('updateState auto-corrects to hostile when trust < 20 (lines 926-927)', async () => {
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
  assert(updated.attitude === 'hostile', `Expected hostile from low trust (covers lines 926-927), got ${updated.attitude}`);
});

await test('updateState does not override hostile when trust < 20', async () => {
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
  const updated = engine.updateState({ action: 'talk' }, {});
  assert(updated.attitude === 'hostile', `Expected hostile preserved, got ${updated.attitude}`);
});

await test('updateState does not override afraid when trust < 20', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'afraid',
      is_alive: true,
      trust: 15,
      fear: 80,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, {});
  assert(updated.attitude === 'afraid', `Expected afraid preserved, got ${updated.attitude}`);
});

// =============================================================================
// _defaultFallback — remaining branches
// =============================================================================
console.log('\n--- _defaultFallback Remaining Branches ---');

await test('_defaultFallback enemy role sets attack (lines 662-664)', async () => {
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
  const context = engine._buildContext({ type: 'idle' });
  const decision = engine._defaultFallback(context);
  assert(decision.action === 'attack', `Expected attack for enemy role, got ${decision.action}`);
  assert(decision.mood === 'hostile', `Expected hostile mood, got ${decision.mood}`);
});

await test('_defaultFallback Boss role sets special_attack (lines 666-668)', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    boss: {
      id: 'boss',
      current_hp: 50,
      current_san: 100,
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
  const engine = new NPCDecisionEngine(campaign, 'boss');
  const context = engine._buildContext({ type: 'idle' });
  const decision = engine._defaultFallback(context);
  assert(decision.action === 'special_attack', `Expected special_attack for Boss role, got ${decision.action}`);
  assert(decision.mood === 'dominant', `Expected dominant mood, got ${decision.mood}`);
});

await test('_defaultFallback combat_turn sets focused mood', async () => {
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
  const context = engine._buildContext({ type: 'combat_turn' });
  const decision = engine._defaultFallback(context);
  assert(decision.action === 'attack', `Expected attack, got ${decision.action}`);
  assert(decision.mood === 'focused', `Expected focused, got ${decision.mood}`);
});

await test('_defaultFallback player_talk sets generic dialogue_topic', async () => {
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
  const context = engine._buildContext({ type: 'player_talk' });
  const decision = engine._defaultFallback(context);
  assert(decision.dialogue_topic === 'generic', `Expected generic topic, got ${decision.dialogue_topic}`);
});

await test('_defaultFallback non-player-talk sets null dialogue_topic', async () => {
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
  const context = engine._buildContext({ type: 'idle' });
  const decision = engine._defaultFallback(context);
  assert(decision.dialogue_topic === null, `Expected null topic, got ${decision.dialogue_topic}`);
});

// =============================================================================
// decide() — confidence threshold branches
// =============================================================================
console.log('\n--- decide() Confidence Threshold Branches ---');

await test('decide: rule confidence >= 0.85 skips LLM and attitude', async () => {
  const campaign = buildCampaign();
  campaign.combat_state = { active: true, current_turn: 'enemy1' };
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
  let llmCalled = false;
  const mockLLM = {
    isAvailable: () => true,
    chat: async () => {
      llmCalled = true;
      return { content: '{"action":"talk","confidence":0.9}' };
    },
  };
  const decision = await engine.decide({ type: 'combat_turn' }, mockLLM);
  assert(decision.action === 'attack', `Expected attack from rules, got ${decision.action}`);
  assert(decision.confidence >= 0.85, 'Expected high confidence rule');
  assert(!llmCalled, 'LLM should NOT be called when rule confidence >= 0.85');
});

await test('decide: rule confidence < 0.85 but attitude > 0.5 skips LLM', async () => {
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
  let llmCalled = false;
  const mockLLM = {
    isAvailable: () => true,
    chat: async () => {
      llmCalled = true;
      return { content: '{"action":"emote","confidence":0.9}' };
    },
  };
  // idle situation has no rule match → rule confidence = 0
  // attitude = friendly → attitudeDecision.confidence = 0.7 > 0.5
  const decision = await engine.decide({ type: 'idle' }, mockLLM);
  assert(decision.action === 'talk', `Expected talk from attitude, got ${decision.action}`);
  assert(decision.confidence === 0.7, `Expected 0.7 confidence, got ${decision.confidence}`);
  assert(!llmCalled, 'LLM should NOT be called when attitude confidence > 0.5');
});

await test('ruleBasedDecision player_help with friendly NPC (lines 397-409)', async () => {
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
  const context = engine._buildContext({ type: 'player_help' });
  const decision = engine._ruleBasedDecision(context);
  assert(decision.action === 'talk', `Expected talk, got ${decision.action}`);
  assert(decision.confidence === 0.82, `Expected 0.82 confidence, got ${decision.confidence}`);
  assert(decision.dialogue_topic === 'thanks', `Expected thanks topic, got ${decision.dialogue_topic}`);
});

await test('ruleBasedDecision player_threat with enemy (lines 413-423)', async () => {
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
  const context = engine._buildContext({ type: 'player_threat' });
  const decision = engine._ruleBasedDecision(context);
  assert(decision.action === 'attack', `Expected attack, got ${decision.action}`);
  assert(decision.confidence === 0.85, `Expected 0.85 confidence, got ${decision.confidence}`);
});

await test('ruleBasedDecision player_threat with friendly NPC (lines 424-433)', async () => {
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
  const context = engine._buildContext({ type: 'player_threat' });
  const decision = engine._ruleBasedDecision(context);
  assert(decision.action === 'flee', `Expected flee, got ${decision.action}`);
  assert(decision.mood === 'hurt', `Expected hurt mood, got ${decision.mood}`);
});

await test('ruleBasedDecision player_threat with neutral NPC (lines 434-441)', async () => {
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
  const context = engine._buildContext({ type: 'player_threat' });
  const decision = engine._ruleBasedDecision(context);
  assert(decision.action === 'ignore', `Expected ignore, got ${decision.action}`);
  assert(decision.mood === 'afraid', `Expected afraid mood, got ${decision.mood}`);
});

await test('attitudeBasedDecision afraid attitude idle (lines 527-533)', async () => {
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
  const context = engine._buildContext({ type: 'idle' });
  const decision = engine._attitudeBasedDecision(context);
  assert(decision.action === 'flee', `Expected flee, got ${decision.action}`);
  assert(decision.mood === 'scared', `Expected scared mood, got ${decision.mood}`);
});

// Note: decide() LLM fallback path is unreachable with current implementation
// because attitudeBasedDecision always returns confidence >= 0.6 > 0.5.
// The LLM fallback code in decide() (line ~163) is dead code.

// =============================================================================
// getStateSummary (lines 947-962)
// =============================================================================
console.log('\n--- getStateSummary Coverage ---');

await test('getStateSummary returns correct NPC state', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 8,
      current_san: 45,
      attitude: 'friendly',
      is_alive: true,
      trust: 75,
      fear: 10,
      suspicion: 20,
      known_topics: ['books', 'magic'],
      secrets_revealed: ['cult'],
      turns_in_scene: 5,
      custom_vars: { key: 'value' },
      current_action: 'talk',
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const summary = engine.getStateSummary();
  assert(summary.id === 'librarian', 'Expected id');
  assert(summary.name === '图书管理员', 'Expected name');
  assert(summary.attitude === 'friendly', 'Expected attitude');
  assert(summary.trust === 75, 'Expected trust');
  assert(summary.fear === 10, 'Expected fear');
  assert(summary.suspicion === 20, 'Expected suspicion');
  assert(summary.hp === '8/10', `Expected hp, got ${summary.hp}`);
  assert(summary.is_alive === true, 'Expected alive');
  assert(summary.current_action === 'talk', 'Expected current_action');
  assert(summary.known_topics_count === 2, 'Expected known_topics_count');
  assert(summary.secrets_revealed_count === 1, 'Expected secrets_revealed_count');
});

await test('getStateSummary handles NPC without template name', async () => {
  const campaign = buildCampaign();
  campaign.module.npcs.librarian.name = undefined;
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
  const summary = engine.getStateSummary();
  assert(summary.name === 'librarian', `Expected npcId as fallback name, got ${summary.name}`);
});

// =============================================================================
// updateState remaining branches
// =============================================================================
console.log('\n--- updateState Remaining Branches ---');

await test('updateState corrects to friendly when trust > 60 && fear < 30 (lines 920-921)', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 65,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, { trust_delta: 5 });
  assert(updated.attitude === 'friendly', `Expected friendly correction (covers lines 920-921), got ${updated.attitude}`);
});

await test('updateState does not correct friendly if already friendly', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'friendly',
      is_alive: true,
      trust: 65,
      fear: 20,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'talk' }, { trust_delta: 5 });
  assert(updated.attitude === 'friendly', `Expected friendly preserved, got ${updated.attitude}`);
});

await test('updateState corrects to afraid when fear > 70 (lines 923-924)', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'neutral',
      is_alive: true,
      trust: 30,
      fear: 75,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'intimidate' }, { fear_delta: 5 });
  assert(updated.attitude === 'afraid', `Expected afraid correction (covers lines 923-924), got ${updated.attitude}`);
});

await test('updateState does not correct to afraid if already afraid', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    librarian: {
      id: 'librarian',
      current_hp: 10,
      current_san: 50,
      attitude: 'afraid',
      is_alive: true,
      trust: 30,
      fear: 75,
      suspicion: 30,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'librarian');
  const updated = engine.updateState({ action: 'intimidate' }, { fear_delta: 5 });
  assert(updated.attitude === 'afraid', `Expected afraid preserved, got ${updated.attitude}`);
});

await test('updateState does not correct to afraid if hostile', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    enemy1: {
      id: 'enemy1',
      current_hp: 15,
      current_san: 80,
      attitude: 'hostile',
      is_alive: true,
      trust: 10,
      fear: 75,
      suspicion: 50,
      known_topics: [],
      secrets_revealed: [],
      turns_in_scene: 0,
      custom_vars: {},
    },
  };
  const engine = new NPCDecisionEngine(campaign, 'enemy1');
  const updated = engine.updateState({ action: 'intimidate' }, { fear_delta: 5 });
  assert(updated.attitude === 'hostile', `Expected hostile preserved despite high fear, got ${updated.attitude}`);
});

await test('updateState marks NPC dead when hp <= 0 (lines 935-937)', async () => {
  const campaign = buildCampaign();
  campaign.npcs_state = {
    enemy1: {
      id: 'enemy1',
      current_hp: 1,
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
  const updated = engine.updateState({ action: 'attack' }, { damage_taken: 2 });
  assert(updated.is_alive === false, 'Expected NPC dead (covers lines 935-937)');
  assert(updated.attitude === 'dead', `Expected dead attitude, got ${updated.attitude}`);
});

// =============================================================================
// Summary
// =============================================================================
console.log('\n=== NPC Decision Engine Round 3 Test Summary ===');
console.log(`Total: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Status: ${failCount === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);

process.exit(failCount > 0 ? 1 : 0);
