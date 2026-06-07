/**
 * Development utilities for AI-GM plugin
 * Hot reload, mock data, and dev helpers
 *
 * @version 0.1.0
 */

import { readFileSync, watch } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Mock campaign data for development without SillyTavern backend
 * @type {Object}
 */
export const MOCK_CAMPAIGN = {
  id: 'mock-campaign-001',
  name: 'Development Test',
  module_id: 'arkham-night',
  player: {
    name: 'Test Investigator',
    hp: 12,
    max_hp: 12,
    sanity: 60,
    max_sanity: 60,
    stats: { str: 50, con: 50, dex: 70, int: 60, pow: 50, edu: 70, siz: 60, app: 60 },
    skills: { 图书馆使用: 25, 侦查: 40, 聆听: 30, 格斗: 50, 射击: 45, 闪避: 40 },
    inventory: ['手电筒', '笔记本', '手枪', '急救包'],
  },
  current_scene: 'library',
  turn: 1,
  flags: {},
};

/**
 * Mock module data (Arkham Night simplified)
 * @type {Object}
 */
export const MOCK_MODULE = {
  id: 'arkham-night',
  name: '阿卡姆之夜',
  version: '1.0.0',
  scenes: {
    library: {
      id: 'library',
      title: '密斯卡托尼克大学图书馆',
      description: '古老的书架排列在两侧，空气中弥漫着纸张和霉味。管理员坐在柜台后打盹。',
      exits: [{ target: 'basement', label: '地下室', condition: null }],
      npcs: ['librarian'],
      events: [],
      combat: { enabled: false },
    },
    basement: {
      id: 'basement',
      title: '潮湿的地下室',
      description: '台阶向下延伸，黑暗中传来滴水的声音。',
      exits: [{ target: 'library', label: '返回图书馆', condition: null }],
      npcs: ['cultist'],
      events: [
        {
          id: 'hidden_door',
          trigger: { type: 'action', action: 'inspect', chance: 100 },
          effects: [
            { type: 'narration', value: '你在书架后发现了一扇隐藏的门！' },
            { type: 'flag', key: 'found_hidden_door', value: true },
          ],
          repeatable: false,
        },
      ],
      combat: { enabled: true, enemies: ['cultist'] },
    },
  },
  npcs: {
    librarian: {
      id: 'librarian',
      name: '老管理员',
      attitude: 'neutral',
      hp: 8,
      stats: { str: 35, con: 40, dex: 30, int: 50, pow: 40, edu: 60 },
      dialogue: {
        default: '这些书可都是珍品，别弄坏了。',
        inspect: '那边角落有些关于本地传说的旧报纸。',
      },
    },
    cultist: {
      id: 'cultist',
      name: '邪教徒',
      attitude: 'hostile',
      hp: 10,
      stats: { str: 55, con: 50, dex: 50, int: 40, pow: 60, edu: 30 },
      dialogue: { default: '...你不该来这里。' },
    },
  },
  endings: {
    madness: {
      id: 'madness',
      title: '理智的尽头',
      description: '真相太过沉重，你的意识在恐惧中消散...',
    },
    sanity: {
      id: 'sanity',
      title: '保持理智',
      description: '你逃离了阿卡姆，但那些画面将永远萦绕在梦中。',
    },
  },
};

/**
 * Check if running in mock development mode
 * @returns {boolean}
 */
export function isMockMode() {
  return process.env.MOCK_MODE === 'true' || process.env.NODE_ENV === 'development';
}

/**
 * Create mock campaign for development
 * @returns {Object} Mock campaign object
 */
export function createMockCampaign() {
  return JSON.parse(JSON.stringify(MOCK_CAMPAIGN));
}

/**
 * Create mock module for development
 * @returns {Object} Mock module object
 */
export function createMockModule() {
  return JSON.parse(JSON.stringify(MOCK_MODULE));
}

/**
 * Watch module files for hot reload in development
 * @param {string} modulePath - Path to module JSON file
 * @param {Function} onReload - Callback when file changes
 * @returns {Function} Cleanup function to stop watching
 */
export function watchModule(modulePath, onReload) {
  if (!isMockMode()) {
    return () => {};
  }

  const watcher = watch(modulePath, { persistent: false }, (eventType) => {
    if (eventType === 'change') {
      try {
        const content = readFileSync(modulePath, 'utf-8');
        const module = JSON.parse(content);
        console.log(`[Dev] Module reloaded: ${module.id || modulePath}`);
        onReload(module);
      } catch (err) {
        console.error(`[Dev] Hot reload failed: ${err.message}`);
      }
    }
  });

  return () => watcher.close();
}

/**
 * Development logging helper
 * Logs only in development/mock mode
 * @param {...any} args - Arguments to log
 */
export function devLog(...args) {
  if (isMockMode()) {
    console.log('[AI-GM Dev]', ...args);
  }
}

/**
 * Performance timer for development profiling
 * @param {string} label - Timer label
 * @returns {{end: Function}} Timer object with end method
 */
export function devTimer(label) {
  if (!isMockMode()) {
    return { end: () => {} };
  }
  const start = performance.now();
  return {
    end: () => {
      const elapsed = performance.now() - start;
      console.log(`[AI-GM Dev] ${label}: ${elapsed.toFixed(2)}ms`);
    },
  };
}

/**
 * Reset campaign data (for testing)
 * @param {Map} campaigns - Campaign storage map
 * @param {Map} loadedModules - Module storage map
 */
export function resetDevData(campaigns, loadedModules) {
  if (!isMockMode()) {
    return;
  }
  campaigns.clear();
  loadedModules.clear();
  console.log('[Dev] All campaign and module data reset');
}
