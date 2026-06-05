/**
 * AI-GM Extension - Frontend Entry Point
 * SillyTavern Plugin for automated TTRPG hosting
 * 
 * Features:
 * - GM Console panel in sidebar
 * - Scene/NPC status display
 * - Combat tracker UI
 * - Save/Load panel
 * 
 * @version 0.1.0
 * @license AGPL-3.0
 */

import { eventSource, event_types } from '../../../../../../../script.js';
import { extension_settings } from '../../../../../../../extensions.js';

const extensionName = 'sillytavern-ai-gm';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// GM Console state
let gmState = {
    active: false,
    campaign: null,
    currentScene: null,
    combatActive: false,
    players: [],
    npcs: []
};

/**
 * Initialize the extension
 */
async function init() {
    console.log('[AI-GM] Extension initializing...');
    
    // Load settings
    loadSettings();
    
    // Create UI panel
    createGMConsole();
    
    // Register event listeners
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    
    // Check backend health
    await checkBackendHealth();
    
    console.log('[AI-GM] Extension initialized');
}

/**
 * Load extension settings from SillyTavern storage
 */
function loadSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {
            enabled: true,
            autoStartCampaign: false,
            defaultSystem: 'coc',
            showCombatPanel: true,
            debugMode: false
        };
    }
    return extension_settings[extensionName];
}

/**
 * Create GM Console panel in sidebar
 */
function createGMConsole() {
    const html = `
        <div id="ai-gm-panel" class="ai-gm-panel">
            <div class="ai-gm-header">
                <span class="ai-gm-title">🎲 AI-GM 控制台</span>
                <div class="ai-gm-controls">
                    <button id="ai-gm-settings-btn" class="menu_button" title="设置">⚙️</button>
                    <button id="ai-gm-help-btn" class="menu_button" title="帮助">❓</button>
                </div>
            </div>
            
            <div class="ai-gm-content">
                <!-- Campaign Status -->
                <div class="ai-gm-section" id="ai-gm-campaign-status">
                    <div class="ai-gm-section-title">📜 当前战役</div>
                    <div class="ai-gm-campaign-info">
                        <span id="ai-gm-campaign-name">未加载模组</span>
                        <span id="ai-gm-campaign-scene">-</span>
                    </div>
                    <button id="ai-gm-load-module-btn" class="menu_button">加载模组</button>
                    <button id="ai-gm-new-campaign-btn" class="menu_button">新建战役</button>
                </div>
                
                <!-- Scene Info -->
                <div class="ai-gm-section" id="ai-gm-scene-info">
                    <div class="ai-gm-section-title">🏞️ 当前场景</div>
                    <div id="ai-gm-scene-title" class="ai-gm-scene-title">-</div>
                    <div id="ai-gm-scene-desc" class="ai-gm-scene-desc">-</div>
                    <div id="ai-gm-npcs-present" class="ai-gm-npc-list"></div>
                </div>
                
                <!-- Combat Panel (hidden by default) -->
                <div class="ai-gm-section ai-gm-combat-panel" id="ai-gm-combat-panel" style="display:none;">
                    <div class="ai-gm-section-title">⚔️ 战斗</div>
                    <div id="ai-gm-combat-round">回合: -</div>
                    <div id="ai-gm-combat-turn">当前行动: -</div>
                    <div id="ai-gm-combat-initiative" class="ai-gm-initiative-list"></div>
                    <div class="ai-gm-combat-actions">
                        <button class="ai-gm-action-btn" data-action="attack">攻击</button>
                        <button class="ai-gm-action-btn" data-action="skill">技能</button>
                        <button class="ai-gm-action-btn" data-action="item">物品</button>
                        <button class="ai-gm-action-btn" data-action="flee">逃跑</button>
                    </div>
                </div>
                
                <!-- Player Status -->
                <div class="ai-gm-section" id="ai-gm-player-status">
                    <div class="ai-gm-section-title">👤 调查员</div>
                    <div id="ai-gm-player-stats" class="ai-gm-stats"></div>
                </div>
                
                <!-- Quick Actions -->
                <div class="ai-gm-section ai-gm-actions">
                    <button id="ai-gm-dice-btn" class="menu_button">🎲 掷骰</button>
                    <button id="ai-gm-save-btn" class="menu_button">💾 存档</button>
                    <button id="ai-gm-rules-btn" class="menu_button">📖 规则</button>
                </div>
                
                <!-- Debug Panel -->
                <div class="ai-gm-section ai-gm-debug" id="ai-gm-debug-panel" style="display:none;">
                    <div class="ai-gm-section-title">🐛 Debug</div>
                    <pre id="ai-gm-debug-output"></pre>
                </div>
            </div>
        </div>
    `;
    
    // Insert into sidebar (after the extensions panel)
    const extensionsPanel = document.getElementById('extensions_settings');
    if (extensionsPanel) {
        extensionsPanel.insertAdjacentHTML('afterend', html);
    }
    
    // Bind events
    bindPanelEvents();
}

/**
 * Bind UI events
 */
function bindPanelEvents() {
    // Load module
    document.getElementById('ai-gm-load-module-btn')?.addEventListener('click', async () => {
        await loadModuleDialog();
    });
    
    // New campaign
    document.getElementById('ai-gm-new-campaign-btn')?.addEventListener('click', async () => {
        await createCampaignDialog();
    });
    
    // Dice roller
    document.getElementById('ai-gm-dice-btn')?.addEventListener('click', () => {
        showDiceRoller();
    });
    
    // Save/Load
    document.getElementById('ai-gm-save-btn')?.addEventListener('click', () => {
        showSaveDialog();
    });
    
    // Combat actions
    document.querySelectorAll('.ai-gm-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            sendCombatAction(action);
        });
    });
}

/**
 * Check if backend plugin is running
 */
async function checkBackendHealth() {
    try {
        const response = await fetch('/api/plugins/ai-gm/health');
        if (response.ok) {
            const data = await response.json();
            console.log('[AI-GM] Backend status:', data.status);
            return true;
        }
    } catch (e) {
        console.warn('[AI-GM] Backend not available:', e.message);
    }
    return false;
}

/**
 * Call AI-GM backend API
 */
async function gmApi(endpoint, method = 'GET', body = null) {
    const url = `/api/plugins/ai-gm${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`AI-GM API error: ${response.status}`);
    }
    return response.json();
}

/**
 * Load module dialog
 */
async function loadModuleDialog() {
    // TODO: Implement file picker + module validation
    console.log('[AI-GM] Load module dialog');
    // For MVP, load the built-in CoC test module
    await loadBuiltinModule('arkham_night');
}

/**
 * Load built-in test module
 */
async function loadBuiltinModule(moduleId) {
    try {
        const result = await gmApi(`/module/load/${moduleId}`, 'POST');
        if (result.success) {
            gmState.active = true;
            updatePanelUI(result.module);
        }
    } catch (e) {
        console.error('[AI-GM] Failed to load module:', e);
    }
}

/**
 * Create new campaign
 */
async function createCampaignDialog() {
    // TODO: Player setup dialog
    console.log('[AI-GM] Create campaign dialog');
}

/**
 * Show dice roller
 */
function showDiceRoller() {
    // TODO: Dice roller UI
    console.log('[AI-GM] Dice roller');
}

/**
 * Show save/load dialog
 */
function showSaveDialog() {
    // TODO: Save/load UI
    console.log('[AI-GM] Save dialog');
}

/**
 * Send combat action to backend
 */
async function sendCombatAction(action) {
    if (!gmState.campaign) return;
    
    try {
        const result = await gmApi('/combat/action', 'POST', {
            campaign_id: gmState.campaign,
            action: action
        });
        updateCombatUI(result);
    } catch (e) {
        console.error('[AI-GM] Combat action failed:', e);
    }
}

/**
 * Update panel UI with module data
 */
function updatePanelUI(module) {
    document.getElementById('ai-gm-campaign-name').textContent = module.name;
    document.getElementById('ai-gm-scene-title').textContent = module.scenes[module.start_scene]?.title || '-';
    document.getElementById('ai-gm-scene-desc').textContent = module.scenes[module.start_scene]?.description || '-';
    
    // Update NPC list
    const npcList = module.scenes[module.start_scene]?.npcs_present || [];
    const npcContainer = document.getElementById('ai-gm-npcs-present');
    npcContainer.innerHTML = npcList.map(npcId => {
        const npc = module.npcs[npcId];
        return `<div class="ai-gm-npc-tag">${npc?.name || npcId}</div>`;
    }).join('');
}

/**
 * Update combat UI
 */
function updateCombatUI(result) {
    const combatPanel = document.getElementById('ai-gm-combat-panel');
    combatPanel.style.display = 'block';
    
    document.getElementById('ai-gm-combat-round').textContent = `回合: ${result.round}`;
    document.getElementById('ai-gm-combat-turn').textContent = `当前行动: ${result.current_turn}`;
    
    const initiativeList = document.getElementById('ai-gm-combat-initiative');
    initiativeList.innerHTML = result.initiative.map(entry => 
        `<div class="ai-gm-initiative-entry ${entry.entity_id === result.current_turn ? 'active' : ''}">
            ${entry.name}: ${entry.roll}
        </div>`
    ).join('');
}

/**
 * Handle chat change event
 */
function onChatChanged() {
    // Reset GM state when switching chats
    if (gmState.active) {
        console.log('[AI-GM] Chat changed, GM state maintained');
    }
}

/**
 * Handle message received
 */
function onMessageReceived() {
    // Check for GM system messages
    // TODO: Parse system messages for state changes
}

/**
 * Debug logging
 */
function debugLog(...args) {
    if (extension_settings[extensionName]?.debugMode) {
        console.log('[AI-GM]', ...args);
        const debugOutput = document.getElementById('ai-gm-debug-output');
        if (debugOutput) {
            debugOutput.textContent += args.join(' ') + '\n';
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for testing
export { gmState, gmApi, loadBuiltinModule };
