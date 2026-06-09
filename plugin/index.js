/**
 * AI-GM Server Plugin - Backend Entry Point
 *
 * Registers API routes and initializes the game engine.
 *
 * @version 0.1.0
 * @license AGPL-3.0
 */

import { Router } from 'express';
import { ModuleParser } from './engine/module-parser.js';
import { GameStateMachine } from './engine/state-machine.js';
import { RuleEngine } from './engine/rule-engine.js';
import { DiceRoller } from './engine/dice.js';
import { CombatTracker } from './engine/combat-tracker.js';
import { CampaignStorage } from './storage/campaign.js';
import { NPCDecisionEngine } from './engine/npc-decision.js';
import { LLMClient, createLLMClientFromEnv } from './utils/llm-client.js';
import { PromptBuilder } from './utils/prompt-builder.js';

const router = Router();

// In-memory storage for MVP (will be replaced with SQLite in Phase 2)
const campaigns = new Map();
const loadedModules = new Map();

// Initialize dice roller
const dice = new DiceRoller();

// Initialize rule engine
const rules = new RuleEngine('coc'); // Default to Call of Cthulhu

/**
 * Error handling middleware
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Global error handler for AI-GM routes
 */
function errorHandler(err, req, res, next) {
  console.error(`[AI-GM] ${req.method} ${req.path} error:`, err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
}

// Initialize LLM client (lazy — creates on first use if env vars set)
let llmClient = null;
function getLLMClient() {
  if (!llmClient) {
    llmClient = createLLMClientFromEnv();
  }
  return llmClient;
}

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() });
});

/**
 * Parse and validate a module
 * POST /api/plugins/ai-gm/module/parse
 */
router.post(
  '/module/parse',
  asyncHandler(async (req, res) => {
    const { source, format = 'markdown' } = req.body;
    const parser = new ModuleParser(format);
    const module = await parser.parse(source);

    res.json({
      success: true,
      module,
      warnings: parser.warnings || [],
    });
  }),
);

/**
 * Load a built-in module
 * POST /api/plugins/ai-gm/module/load/:moduleId
 */
router.post(
  '/module/load/:moduleId',
  asyncHandler(async (req, res) => {
    const { moduleId } = req.params;

    // For MVP, return built-in test module
    const module = getBuiltinModule(moduleId);
    loadedModules.set(moduleId, module);

    res.json({ success: true, module });
  }),
);

/**
 * List available modules
 */
router.get('/module/list', (req, res) => {
  const modules = Array.from(loadedModules.values()).map((m) => ({
    id: m.id,
    name: m.name,
    system: m.system,
    version: m.version,
  }));
  res.json({ modules });
});

/**
 * Create a new campaign
 * POST /api/plugins/ai-gm/campaign/create
 */
router.post(
  '/campaign/create',
  asyncHandler(async (req, res) => {
    const { module_id, player_name = 'Investigator', player_stats = null } = req.body;
    const module = loadedModules.get(module_id);

    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    const campaignId = generateCampaignId();
    const playerStats = player_stats || (module.system === 'coc' ? createCoCCharacter() : {});

    const campaign = {
      id: campaignId,
      module_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      current_scene: module.start_scene,
      scene_history: [module.start_scene],
      player: {
        id: 'player_1',
        name: player_name,
        stats: playerStats,
        inventory: [],
        status_effects: [],
        sanity: module.system === 'coc' ? playerStats.SAN || playerStats.POW || 50 : null,
        max_sanity: module.system === 'coc' ? playerStats.SAN || playerStats.POW || 50 : null,
        hp: playerStats.HP || 10,
        max_hp: playerStats.HP || 10,
      },
      npcs_state: initializeNPCs(module.npcs),
      global_vars: { ...module.global_vars },
      combat_state: null,
      session_log: [],
    };

    campaigns.set(campaignId, campaign);

    res.json({
      success: true,
      campaign_id: campaignId,
      campaign: {
        id: campaign.id,
        current_scene: campaign.current_scene,
        player: campaign.player,
        npcs_state: campaign.npcs_state,
        global_vars: campaign.global_vars,
      },
    });
  }),
);

/**
 * Process player action
 * POST /api/plugins/ai-gm/state/action
 */
router.post(
  '/state/action',
  asyncHandler(async (req, res) => {
    const { campaign_id, action_type, action_data, player_input } = req.body;
    const campaign = campaigns.get(campaign_id);

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const module = loadedModules.get(campaign.module_id);
    const stateMachine = new GameStateMachine(module, campaign, getLLMClient());

    // Handle dice check action type
    if (action_type === 'dice_check') {
      const { skill, skill_value, modifier = 0 } = action_data || {};
      if (!skill || skill_value === undefined) {
        return res
          .status(400)
          .json({ success: false, error: 'Missing skill or skill_value for dice_check' });
      }

      const roll = dice.roll('1d100').total;
      const target = skill_value + modifier;
      const success = roll <= target;
      const critical = roll <= 5;
      const fumble = roll >= 96;
      let degree = null;
      if (roll <= Math.floor(target / 5)) degree = 'extreme';
      else if (roll <= Math.floor(target / 2)) degree = 'hard';

      const result = {
        type: 'dice_check',
        skill,
        roll,
        target,
        result: fumble ? 'fumble' : critical ? 'critical' : success ? 'success' : 'fail',
        degree,
        narration: buildCheckNarration(
          skill,
          roll,
          target,
          fumble ? 'fumble' : critical ? 'critical' : success ? 'success' : 'fail',
        ),
      };

      // Log the action
      campaign.session_log.push({
        timestamp: new Date().toISOString(),
        type: 'dice_check',
        actor: campaign.player.name,
        content: `${skill} check: ${roll} vs ${target}`,
        metadata: { skill, roll, target, result: result.result },
      });

      campaign.updated_at = new Date().toISOString();
      return res.json({ success: true, ...result });
    }

    // Handle scene transition action
    if (action_type === 'scene_transition') {
      const { scene_id } = action_data || {};
      if (!scene_id) {
        return res
          .status(400)
          .json({ success: false, error: 'Missing scene_id for scene_transition' });
      }
      const result = await stateMachine.transitionTo(scene_id);
      campaign.updated_at = new Date().toISOString();

      // Log the action
      campaign.session_log.push({
        timestamp: new Date().toISOString(),
        type: 'scene_transition',
        actor: campaign.player.name,
        content: `Moved to ${scene_id}`,
        metadata: { scene_id },
      });

      return res.json({ success: true, ...result });
    }

    const result = await stateMachine.processAction({
      action_type,
      action_data,
      player_input,
    });

    // Log the action
    campaign.session_log.push({
      timestamp: new Date().toISOString(),
      type: 'player',
      actor: campaign.player.name,
      content: player_input,
      metadata: { action_type, action_data },
    });

    campaign.updated_at = new Date().toISOString();
    res.json({ success: true, ...result });
  }),
);

/**
 * Transition to a specific scene (GM override)
 */
router.post(
  '/state/transition',
  asyncHandler(async (req, res) => {
    const { campaign_id, scene_id } = req.body;
    const campaign = campaigns.get(campaign_id);

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const module = loadedModules.get(campaign.module_id);
    const stateMachine = new GameStateMachine(module, campaign, getLLMClient());
    const result = await stateMachine.transitionTo(scene_id);

    campaign.current_scene = scene_id;
    campaign.scene_history.push(scene_id);
    campaign.updated_at = new Date().toISOString();

    res.json({ success: true, ...result });
  }),
);

/**
 * Combat: Initialize combat
 */
router.post(
  '/combat/init',
  asyncHandler(async (req, res) => {
    const { campaign_id, enemies } = req.body;
    const campaign = campaigns.get(campaign_id);

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const combat = new CombatTracker(campaign);
    const result = combat.initCombat(enemies);
    campaign.combat_state = combat.getState();

    // Log combat start
    campaign.session_log.push({
      timestamp: new Date().toISOString(),
      type: 'combat',
      actor: campaign.player.name,
      content: `Combat started with ${enemies.length} enemies`,
      metadata: { enemies, round: 1 },
    });

    campaign.updated_at = new Date().toISOString();

    res.json({ success: true, ...result, combat_summary: combat.getCombatSummary() });
  }),
);

/**
 * Combat: Process action
 */
router.post(
  '/combat/action',
  asyncHandler(async (req, res) => {
    const { campaign_id, actor, action, target, params } = req.body;
    const campaign = campaigns.get(campaign_id);

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const combat = new CombatTracker(campaign);
    combat.loadState(campaign.combat_state);
    const result = combat.processAction(actor, action, target || 'player_1', params);
    campaign.combat_state = combat.getState();

    // Log combat action
    campaign.session_log.push({
      timestamp: new Date().toISOString(),
      type: 'combat',
      actor: campaign.player.name,
      content: `${action} action: ${result.log}`,
      metadata: { action, damage: result.damage, hit: result.hit },
    });

    campaign.updated_at = new Date().toISOString();

    res.json({
      success: true,
      ...result,
      combat_summary: combat.getCombatSummary(),
      player: campaign.player, // Include updated player HP for frontend sync
    });
  }),
);

/**
 * Combat: End combat
 */
router.post(
  '/combat/end',
  asyncHandler(async (req, res) => {
    const { campaign_id } = req.body;
    const campaign = campaigns.get(campaign_id);

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    campaign.combat_state = null;
    res.json({ success: true, message: 'Combat ended' });
  }),
);

/**
 * Rules: Dice roll
 */
router.post('/rules/dice', (req, res) => {
  try {
    const { expression, label } = req.body;
    const result = dice.roll(expression);
    res.json({ success: true, result, label });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

/**
 * Rules: Skill check (CoC d100)
 */
router.post('/rules/check', (req, res) => {
  try {
    const { skill, skill_value, modifier = 0 } = req.body;
    const roll = dice.roll('1d100').total;
    const target = skill_value + modifier;
    const success = roll <= target;
    const critical = roll <= 5; // CoC hard success
    const fumble = roll >= 96; // CoC fumble

    res.json({
      success: true,
      roll,
      target,
      skill,
      result: fumble ? 'fumble' : critical ? 'critical' : success ? 'success' : 'fail',
      degree: roll <= target / 2 ? 'hard' : roll <= target / 5 ? 'extreme' : null,
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

/**
 * Save campaign
 */
router.post(
  '/save',
  asyncHandler(async (req, res) => {
    const { campaign_id, slot = 1, label = '手动存档' } = req.body;
    const campaign = campaigns.get(campaign_id);

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const storage = new CampaignStorage();
    const result = storage.saveSnapshot(campaign_id, slot, label, campaign);

    campaign.session_log.push({
      timestamp: new Date().toISOString(),
      type: 'save',
      actor: campaign.player.name,
      content: `Saved to slot ${slot}: ${label}`,
      metadata: { slot, label },
    });

    res.json({ success: true, ...result });
  }),
);

/**
 * Load campaign
 */
router.post(
  '/load',
  asyncHandler(async (req, res) => {
    const { campaign_id, slot = 1 } = req.body;
    const campaign = campaigns.get(campaign_id);

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const storage = new CampaignStorage();
    const saveData = storage.loadSnapshot(campaign_id, slot);

    if (!saveData) {
      return res.status(404).json({ success: false, error: 'Save not found' });
    }

    campaigns.set(campaign_id, saveData);

    res.json({ success: true, campaign: saveData });
  }),
);

/**
 * List saves for a campaign
 */
router.post(
  '/save/list',
  asyncHandler(async (req, res) => {
    const { campaign_id } = req.body;
    const campaign = campaigns.get(campaign_id);

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const storage = new CampaignStorage();
    const saves = storage.getSnapshots(campaign_id);

    res.json({ success: true, saves });
  }),
);

/**
 * LLM: Get configuration and stats
 */
router.get('/llm/config', (req, res) => {
  const client = getLLMClient();
  res.json({
    success: true,
    config: {
      provider: client.config.provider,
      model: client.config.model,
      baseUrl: client.config.baseUrl,
      maxTokens: client.config.maxTokens,
      temperature: client.config.temperature,
      timeout: client.config.timeout,
    },
    available: client.isAvailable(),
    stats: client.getStats(),
  });
});

/**
 * LLM: Update configuration
 */
router.post(
  '/llm/config',
  asyncHandler(async (req, res) => {
    const { provider, baseUrl, apiKey, model, maxTokens, temperature, timeout } = req.body;
    const client = getLLMClient();

    client.updateConfig({
      ...(provider && { provider }),
      ...(baseUrl && { baseUrl }),
      ...(apiKey !== undefined && { apiKey }),
      ...(model && { model }),
      ...(maxTokens && { maxTokens: parseInt(maxTokens, 10) }),
      ...(temperature !== undefined && { temperature: parseFloat(temperature) }),
      ...(timeout && { timeout: parseInt(timeout, 10) }),
    });

    res.json({
      success: true,
      config: {
        provider: client.config.provider,
        model: client.config.model,
        available: client.isAvailable(),
      },
    });
  }),
);

/**
 * LLM: Test connection
 */
router.post(
  '/llm/test',
  asyncHandler(async (req, res) => {
    const client = getLLMClient();
    if (!client.isAvailable()) {
      return res.status(400).json({
        success: false,
        error: 'LLM not configured. Please set API key and base URL.',
      });
    }

    try {
      const response = await client.complete(
        'Say "AI-GM connection test successful" in one sentence.',
        'You are a helpful assistant.',
        { maxTokens: 50 },
      );
      res.json({ success: true, response });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }),
);

/**
 * NPC decision endpoint
 */
router.post(
  '/npc/decide',
  asyncHandler(async (req, res) => {
    const { campaign_id, npc_id, situation } = req.body;
    const campaign = campaigns.get(campaign_id);

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const engine = new NPCDecisionEngine(campaign, npc_id);
    const decision = await engine.decide(situation);

    res.json({ success: true, ...decision });
  }),
);

/**
 * Generate NPC dialogue
 */
router.post(
  '/npc/generate-dialogue',
  asyncHandler(async (req, res) => {
    const { campaign_id, npc_id, context_summary, mood } = req.body;
    const campaign = campaigns.get(campaign_id);

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const promptBuilder = new PromptBuilder(campaign);
    const prompt = promptBuilder.buildNPCDialoguePrompt(npc_id, context_summary, mood);

    // TODO: Call LLM API through SillyTavern's generation system
    // For MVP, return a placeholder with prompt preview
    res.json({
      success: true,
      dialogue: `[NPC ${npc_id} responds in ${mood} mood]`,
      prompt_preview: prompt,
    });
  }),
);

// ==================== Helper Functions ====================

function generateCampaignId() {
  return 'campaign_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

function createCoCCharacter() {
  // COC 7th Edition base stats
  const stats = {};
  const attributes = ['STR', 'CON', 'SIZ', 'DEX', 'APP', 'INT', 'POW', 'EDU'];
  attributes.forEach((attr) => {
    stats[attr] =
      Math.floor(Math.random() * 6) +
      Math.floor(Math.random() * 6) +
      Math.floor(Math.random() * 6) +
      3;
  });

  // Derived stats
  stats.HP = Math.floor((stats.CON + stats.SIZ) / 10);
  stats.MP = Math.floor(stats.POW / 5);
  stats.SAN = stats.POW;
  stats.LUCK = Math.floor(Math.random() * 100) + 1;

  return stats;
}

function initializeNPCs(npcTemplates) {
  const state = {};
  Object.entries(npcTemplates).forEach(([id, npc]) => {
    state[id] = {
      id,
      current_hp: npc.stats?.HP || 10,
      max_hp: npc.stats?.HP || 10,
      location: npc.starting_scene || null,
      attitude: 'neutral',
      known_secrets: [],
      memory_summary: '',
      status_effects: [],
    };
  });
  return state;
}

/**
 * Built-in test modules
 */
function getBuiltinModule(moduleId) {
  if (moduleId === 'arkham_night') {
    return getArkhamNightModule();
  }
  throw new Error(`Unknown module: ${moduleId}`);
}

/**
 * Build narration text for dice check results
 * @param {string} skill - Skill name
 * @param {number} roll - Dice roll result
 * @param {number} target - Target value
 * @param {string} result - Check result
 * @returns {string} Narration text
 */
function buildCheckNarration(skill, roll, target, result) {
  const diff = target - roll;
  switch (result) {
    case 'critical':
      return `大成功！你的${skill}检定结果${roll}，远超预期！`;
    case 'extreme':
      return `极难成功！${skill}检定${roll}，近乎完美的表现。`;
    case 'hard':
      return `困难成功！${skill}检定${roll}，你的技巧令人印象深刻。`;
    case 'success':
      return `成功！${skill}检定${roll}，刚好在范围内。`;
    case 'fumble':
      return `大失败！${skill}检定${roll}...灾难性的失误。`;
    case 'fail':
      return `失败。${skill}检定${roll}，还差${diff}点。`;
    default:
      return `${skill}检定：${roll} / ${target}`;
  }
}

function getArkhamNightModule() {
  return {
    id: 'arkham_night',
    name: '阿卡姆之夜',
    version: '0.1.0',
    author: 'AI-GM Team',
    system: 'coc',
    description:
      '一个经典的克苏鲁风格单人调查模组。你在阿卡姆的密斯卡托尼克大学图书馆发现了一本神秘的古籍...',
    start_scene: 'library',
    global_vars: {
      sanity_loss: 0,
      clues_found: 0,
      cult_awareness: 0,
    },
    scenes: {
      library: {
        id: 'library',
        title: '密斯卡托尼克大学图书馆',
        description:
          '深夜的图书馆。你独自一人在禁书区。微弱的台灯照亮了积满灰尘的书架。空气中弥漫着旧纸张和霉味。你正在寻找关于阿卡姆近期失踪案的线索。',
        world_info_keys: ['library', 'miskatonic', 'forbidden books'],
        npcs_present: ['librarian'],
        exits: [
          { target_scene: 'basement', description: '检查地下室入口', condition: 'always' },
          { target_scene: 'streets', description: '离开图书馆', condition: 'always' },
        ],
        interactables: ['ancient_tome', 'newspaper_stack', 'librarian_desk'],
      },
      basement: {
        id: 'basement',
        title: '图书馆地下室',
        description:
          '狭窄的楼梯通向潮湿的地下室。这里存放着最危险的禁书。你的手电筒光束在黑暗中切割出一道微弱的通道。墙壁上似乎有...奇怪的符号？',
        world_info_keys: ['basement', 'occult symbols', 'forbidden knowledge'],
        npcs_present: ['cultist'],
        exits: [
          { target_scene: 'library', description: '返回图书馆', condition: 'always' },
          {
            target_scene: 'ritual_chamber',
            description: '发现隐藏门',
            condition: { 'clue:basement_secret': true },
          },
        ],
        combat: {
          enabled: true,
          enemies: ['cultist'],
        },
      },
      ritual_chamber: {
        id: 'ritual_chamber',
        title: '秘密仪式室',
        description:
          '一个巨大的地下洞穴。中央有一个石头祭坛，上面刻满了不可名状的符号。空气中弥漫着硫磺和恐惧的味道。你意识到你已经深入得太远了...',
        world_info_keys: ['ritual', 'elder sign', 'doom'],
        npcs_present: ['cult_leader'],
        exits: [{ target_scene: 'madness_ending', description: '面对真相', condition: 'always' }],
        combat: {
          enabled: true,
          enemies: ['cult_leader', 'cultist'],
        },
      },
      streets: {
        id: 'streets',
        title: '阿卡姆街道',
        description:
          '夜晚的街道。雾气弥漫。远处传来狗叫声。你感觉自己被监视了。但也许只是风吹动了树枝...',
        world_info_keys: ['arkham', 'night', 'fog'],
        npcs_present: [],
        exits: [
          { target_scene: 'library', description: '返回图书馆', condition: 'always' },
          { target_scene: 'asylum', description: '寻求精神病院帮助', condition: 'always' },
        ],
      },
      asylum: {
        id: 'asylum',
        title: '阿卡姆精神病院',
        description:
          '圣玛丽精神病院的白色走廊。你试图向医生解释你所看到的一切。但你的眼神...你确定你看到的是真的吗？',
        world_info_keys: ['asylum', 'madness', 'doubt'],
        npcs_present: ['doctor_armitage'],
        exits: [
          { target_scene: 'library', description: '返回调查', condition: 'always' },
          { target_scene: 'sane_ending', description: '放弃调查', condition: 'always' },
        ],
      },
      madness_ending: {
        id: 'madness_ending',
        title: '结局：疯狂',
        description:
          '你看到了太多。那些符号...那些存在...它们在你的脑海中留下了不可磨灭的印记。SAN CHECK: 1d10/1d100。',
        world_info_keys: ['insanity', 'cosmic horror', 'end'],
        npcs_present: [],
        exits: [],
        ending: {
          type: 'madness',
          sanity_loss: '1d100',
          description: '你疯了。但你也知道真相。那真相将永远折磨你。',
        },
      },
      sane_ending: {
        id: 'sane_ending',
        title: '结局：理智',
        description:
          '你选择不去深入。有些知识最好永远不要知道。你回到正常的生活，但那些夜晚...你总会听到呼唤。',
        world_info_keys: ['escape', 'ignorance', 'end'],
        npcs_present: [],
        exits: [],
        ending: {
          type: 'sane',
          sanity_loss: 0,
          description: '你保持理智，但失踪案仍未解决。阿卡姆的夜晚依旧不安全。',
        },
      },
    },
    npcs: {
      librarian: {
        id: 'librarian',
        name: '亨利·阿米蒂奇',
        role: '图书馆管理员',
        description:
          '一位年迈的学者，密斯卡托尼克大学的图书管理员。他戴着厚厚的眼镜，动作缓慢但眼神锐利。他似乎知道关于禁书区的某些秘密。',
        personality: '谨慎、博学、对神秘学有隐晦的了解',
        first_mes: '年轻人，你不应该在这个时间出现在这里。禁书区的门锁...应该是锁着的。',
        stats: {
          HP: 8,
          STR: 50,
          CON: 60,
          SIZ: 70,
          DEX: 40,
          APP: 45,
          INT: 85,
          POW: 60,
          EDU: 90,
        },
        secrets: [
          '他年轻时也曾调查过类似的神秘事件',
          '他知道地下室有一个秘密入口',
          '他故意没有锁禁书区的门',
        ],
        knowledge: ['occult_lore', 'miskatonic_history', 'forbidden_books'],
        attitude_triggers: {
          threaten: 'hostile',
          show_interest: 'friendly',
          mention_cult: 'nervous',
        },
      },
      cultist: {
        id: 'cultist',
        name: '邪教徒',
        role: '敌人',
        description:
          '一个身穿黑袍的人影。他的脸隐藏在兜帽之下。你注意到他的手上有着奇怪的疤痕...那是某种符号。',
        personality: '狂热、危险、沉默',
        first_mes: '你不该来这里。你已经看到了太多。',
        stats: {
          HP: 10,
          STR: 60,
          CON: 55,
          SIZ: 65,
          DEX: 50,
          APP: 30,
          INT: 50,
          POW: 70,
          EDU: 40,
        },
        secrets: ['他是失踪案的主犯之一', '他崇拜某个不可名状的存在'],
        combat_skills: ['dodge', 'grapple', 'occult_ritual'],
      },
      cult_leader: {
        id: 'cult_leader',
        name: '神秘领袖',
        role: 'Boss',
        description:
          '一个高大的身影，站在祭坛前。当他转身时，你看到了一张扭曲的脸...那张脸不属于人类。',
        personality: '疯狂、智慧、绝对自信',
        first_mes: '终于，一个调查者。我等了很久。知识是代价...你准备好支付了吗？',
        stats: {
          HP: 15,
          STR: 70,
          CON: 65,
          SIZ: 75,
          DEX: 60,
          APP: 20,
          INT: 90,
          POW: 85,
          EDU: 80,
        },
        secrets: ['他曾经是密斯卡托尼克大学的教授', '他成功召唤过某种存在'],
        combat_skills: ['dodge', 'occult_magic', 'summon_lesser_servitor'],
      },
      doctor_armitage: {
        id: 'doctor_armitage',
        name: '弗朗西斯·摩根医生',
        role: '精神病院医生',
        description:
          '圣玛丽精神病院的资深医生。一位温和但疲惫的中年人。他见过太多"看到不可名状之物"的病人。',
        personality: '同情、疲惫、专业但警惕',
        first_mes: '请坐。我听说你有一些...困扰。你可以告诉我，但请记住，有些事物只是我们的想象。',
        stats: {
          HP: 10,
          STR: 45,
          CON: 50,
          SIZ: 60,
          DEX: 50,
          APP: 55,
          INT: 80,
          POW: 55,
          EDU: 85,
        },
        secrets: ['他暗中记录了所有与神秘学相关的病例', '他见过一个痊愈后自杀的病人'],
        knowledge: ['psychology', 'medicine', 'arkham_history'],
      },
    },
    items: {
      ancient_tome: {
        id: 'ancient_tome',
        name: '《死灵之书》残页',
        description: '一张古老的羊皮纸。上面的文字似乎在...蠕动？',
        effects: ['cult_awareness + 1', 'sanity_loss 1d3'],
        readable: true,
        content: '纸上记载着某种召唤仪式...你读不懂大部分内容，但你的SAN值在下降...',
      },
      elder_sign: {
        id: 'elder_sign',
        name: ' Elder Sign',
        description: '一个奇怪的石头符号。当你触摸它时，你感到一阵平静。',
        effects: ['sanity_protection', 'cult_awareness - 1'],
        usable: true,
      },
    },
    events: {
      library_whispers: {
        trigger: { scene: 'library', time: 'night' },
        description: '你听到书架间传来低语。当你转头时，声音停止了。',
        sanity_check: { target: 50, failure: 'sanity_loss 1d3' },
      },
      basement_discovery: {
        trigger: { scene: 'basement', action: 'inspect' },
        description: '你在墙壁的符号中发现了一个隐藏的门。',
        effect: { 'clue:basement_secret': true },
      },
    },
  };
}

// Export router
export default router;

// Also export for plugin loader
export { router, errorHandler };
