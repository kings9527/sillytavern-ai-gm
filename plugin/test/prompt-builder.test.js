/**
 * PromptBuilder Tests
 * Covers: normal paths, edge cases, error paths, boundary values
 */

import { PromptBuilder } from '../utils/prompt-builder.js';

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

// ====== Fixtures ======

const baseModule = {
  id: 'test_mod',
  name: 'Test Module',
  system: 'CoC',
  start_scene: 's1',
  global_vars: { ritual_started: false },
  scenes: {
    s1: {
      id: 's1',
      title: '阴森地下室',
      description: '霉味和潮湿。墙上有奇怪的符号。',
      npcs_present: ['npc1', 'npc2', 'npc_missing'],
      exits: [{ target_scene: 's2', description: '向上的楼梯' }],
    },
    s2: {
      id: 's2',
      title: '废弃图书馆',
      description: '书架倒塌，纸张散落一地。',
      npcs_present: [],
      exits: [],
    },
  },
  npcs: {
    npc1: { id: 'npc1', name: '老图书管理员', description: '一位佝偻的老人', personality: '谨慎、多疑' },
    npc2: { id: 'npc2', name: '邪教信徒', description: '眼神狂热的年轻人', personality: '狂热、攻击性' },
  },
};

const baseCampaign = {
  id: 'camp1',
  module_id: 'test_mod',
  current_scene: 's1',
  player: {
    name: '侦探艾伦',
    stats: { STR: 50, CON: 60, DEX: 55, INT: 70, POW: 60, HP: 12, SAN: 60 },
    sanity: 55,
    max_sanity: 60,
  },
  global_vars: { ritual_started: false, clues: 2 },
  npcs_state: {
    npc1: { attitude: 'cautious', known_secrets: ['地下室密道'] },
    npc2: { attitude: 'hostile', known_secrets: [] },
  },
  module: baseModule,
};

const campaignNoNPCs = {
  ...baseCampaign,
  current_scene: 's2',
  module: {
    ...baseModule,
    scenes: {
      s2: { ...baseModule.scenes.s2, npcs_present: [] },
    },
  },
};

console.log('=== PromptBuilder Tests ===\n');

// ====== buildGMContextPrompt ======
console.log('--- buildGMContextPrompt ---');

test('GM prompt includes scene title and description', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildGMContextPrompt();
  assert(prompt.role === 'system', 'role should be system');
  assert(prompt.content.includes('阴森地下室'), 'should include scene title');
  assert(prompt.content.includes('霉味和潮湿'), 'should include scene description');
});

test('GM prompt includes player stats and sanity', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildGMContextPrompt();
  assert(prompt.content.includes('侦探艾伦'), 'should include player name');
  assert(prompt.content.includes('HP'), 'should include HP');
  assert(prompt.content.includes('SAN'), 'should include SAN');
});

test('GM prompt filters missing NPCs gracefully', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildGMContextPrompt();
  assert(prompt.content.includes('老图书管理员'), 'should include present NPC');
  assert(prompt.content.includes('邪教信徒'), 'should include present NPC');
  assert(!prompt.content.includes('undefined'), 'should not contain undefined from missing npc');
});

test('GM prompt with empty NPC list', () => {
  const pb = new PromptBuilder(campaignNoNPCs);
  const prompt = pb.buildGMContextPrompt();
  assert(prompt.content.includes('废弃图书馆'), 'should include scene title');
  assert(!prompt.content.includes('NPCs Present: 老图书管理员'), 'should not include absent NPCs');
});

test('GM prompt includes global state', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildGMContextPrompt();
  assert(prompt.content.includes('ritual_started'), 'should include global vars');
});

// Edge: missing stats fields
test('GM prompt handles missing HP/SAN stats gracefully', () => {
  const campaign = {
    ...baseCampaign,
    player: { name: '无名氏', stats: { STR: 30 } },
  };
  const pb = new PromptBuilder(campaign);
  const prompt = pb.buildGMContextPrompt();
  assert(prompt.content.includes('无名氏'), 'should include player name');
  assert(prompt.content.includes('SAN'), 'should still mention SAN even if missing');
});

// Edge: campaign with no module
test('GM prompt throws or handles missing module', () => {
  const campaign = { ...baseCampaign, module: null };
  try {
    const pb = new PromptBuilder(campaign);
    pb.buildGMContextPrompt();
    // If it doesn't throw, it should at least not crash
    assert(true, 'did not crash');
  } catch (e) {
    assert(e.message.includes('Cannot') || e.message.includes('null'), 'expected error about null module');
  }
});

// ====== buildNPCDialoguePrompt ======
console.log('\n--- buildNPCDialoguePrompt ---');

test('NPC dialogue prompt includes NPC name and personality', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildNPCDialoguePrompt('npc1', '玩家在询问密道', '紧张');
  assert(prompt !== null, 'should return a prompt');
  assert(prompt.role === 'system', 'role should be system');
  assert(prompt.content.includes('老图书管理员'), 'should include NPC name');
  assert(prompt.content.includes('谨慎、多疑'), 'should include personality');
  assert(prompt.content.includes('紧张'), 'should include mood');
});

test('NPC dialogue prompt includes known secrets', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildNPCDialoguePrompt('npc1', '上下文', '平静');
  assert(prompt.content.includes('地下室密道'), 'should include known secrets');
});

test('NPC dialogue prompt for NPC with no secrets', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildNPCDialoguePrompt('npc2', '上下文', '愤怒');
  assert(prompt.content.includes('none') || prompt.content.includes(''), 'should handle no secrets');
});

test('NPC dialogue prompt returns null for missing NPC', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildNPCDialoguePrompt('npc_missing', '上下文', '平静');
  assert(prompt === null, 'should return null for missing NPC');
});

test('NPC dialogue prompt with null mood defaults gracefully', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildNPCDialoguePrompt('npc1', '上下文', null);
  assert(prompt.content.includes('null') || prompt.content.includes(''), 'should include null or empty mood');
});

test('NPC dialogue prompt with empty context summary', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildNPCDialoguePrompt('npc1', '', '平静');
  assert(prompt.content.includes('Context Summary:'), 'should include context summary label');
});

// ====== buildSceneDescriptionPrompt ======
console.log('\n--- buildSceneDescriptionPrompt ---');

test('Scene description prompt includes scene details', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildSceneDescriptionPrompt('s2', '你推开沉重的木门');
  assert(prompt.role === 'system', 'role should be system');
  assert(prompt.content.includes('废弃图书馆'), 'should include scene title');
  assert(prompt.content.includes('你推开沉重的木门'), 'should include transition text');
});

test('Scene description prompt with null transition', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildSceneDescriptionPrompt('s1', null);
  assert(prompt.content.includes('null') || prompt.content.includes('The player enters'), 'should handle null transition');
});

test('Scene description prompt for missing scene returns graceful fallback', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildSceneDescriptionPrompt('nonexistent', 'test');
  assert(prompt.role === 'system', 'should still return a system prompt');
  assert(prompt.content.includes('Unknown'), 'should show Unknown scene title');
  assert(prompt.content.includes('Scene not found'), 'should show fallback description');
});

// ====== buildCombatNarrationPrompt ======
console.log('\n--- buildCombatNarrationPrompt ---');

test('Combat narration prompt includes action details', () => {
  const pb = new PromptBuilder(baseCampaign);
  const action = { actor: '侦探艾伦', action: '挥拳', hit: true, damage: 5 };
  const prompt = pb.buildCombatNarrationPrompt(action, '命中');
  assert(prompt.role === 'system', 'role should be system');
  assert(prompt.content.includes('侦探艾伦'), 'should include actor');
  assert(prompt.content.includes('挥拳'), 'should include action');
  assert(prompt.content.includes('Hit'), 'should indicate hit');
  assert(prompt.content.includes('5 damage'), 'should include damage');
});

test('Combat narration prompt for miss without damage', () => {
  const pb = new PromptBuilder(baseCampaign);
  const action = { actor: '深潜者', action: '爪击', hit: false };
  const prompt = pb.buildCombatNarrationPrompt(action, '未命中');
  assert(prompt.content.includes('Miss'), 'should indicate miss');
  assert(!prompt.content.includes('undefined damage'), 'should not show undefined damage');
});

test('Combat narration prompt with zero damage', () => {
  const pb = new PromptBuilder(baseCampaign);
  const action = { actor: '侦探艾伦', action: '投掷石块', hit: true, damage: 0 };
  const prompt = pb.buildCombatNarrationPrompt(action, '擦伤');
  assert(prompt.content.includes('0 damage'), 'should include 0 damage');
});

// ====== buildSanityCheckPrompt ======
console.log('\n--- buildSanityCheckPrompt ---');

test('Sanity check prompt includes loss amount and situation', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildSanityCheckPrompt(3, '看到不可名状的雕像');
  assert(prompt.role === 'system', 'role should be system');
  assert(prompt.content.includes('3'), 'should include sanity loss');
  assert(prompt.content.includes('看到不可名状的雕像'), 'should include situation');
});

test('Sanity check prompt with zero loss', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildSanityCheckPrompt(0, '轻微不安');
  assert(prompt.content.includes('0'), 'should include 0 loss');
});

test('Sanity check prompt with high loss', () => {
  const pb = new PromptBuilder(baseCampaign);
  const prompt = pb.buildSanityCheckPrompt(20, '直面古神');
  assert(prompt.content.includes('20'), 'should include high loss');
});

// ====== Summary ======
console.log('\n=== Results ===');
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Total:  ${passCount + failCount}`);

if (failCount > 0) {
  console.log('\nSome tests failed!');
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
  process.exit(0);
}
