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
import { extension_settings, callPopup } from '../../../../../../../extensions.js';

const extensionName = 'sillytavern-ai-gm';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

/**
 * GM Console state
 */
let gmState = {
    active: false,
    campaign: null,
    campaignId: null,
    module: null,
    currentScene: null,
    combatActive: false,
    players: [],
    npcs: [],
    isLoading: false,
    backendAvailable: false
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
            gmState.backendAvailable = true;
            return true;
        }
    } catch (e) {
        console.warn('[AI-GM] Backend not available:', e.message);
    }
    gmState.backendAvailable = false;
    return false;
}

/**
 * Call AI-GM backend API with error handling and retries
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {object} body - Request body
 * @param {number} retries - Number of retries
 * @returns {Promise<object>} API response
 */
async function gmApi(endpoint, method = 'GET', body = null, retries = 2) {
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
    
    let lastError;
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            return await response.json();
        } catch (e) {
            lastError = e;
            if (i < retries) {
                await new Promise(r => setTimeout(r, 500 * (i + 1)));
            }
        }
    }
    throw lastError;
}

/**
 * Load module dialog
 */
async function loadModuleDialog() {
    // For MVP, load the built-in CoC test module directly
    await loadBuiltinModule('arkham_night');
}

/**
 * Load built-in test module and create campaign
 */
async function loadBuiltinModule(moduleId) {
    try {
        setLoading(true, '加载模组...');

        // 1. Load module
        const loadResult = await gmApi(`/module/load/${moduleId}`, 'POST');
        if (!loadResult.success) {
            throw new Error('Failed to load module');
        }
        gmState.module = loadResult.module;
        console.log('[AI-GM] Module loaded:', loadResult.module.name);

        // 2. Create campaign
        const createResult = await gmApi('/campaign/create', 'POST', {
            module_id: moduleId,
            player_name: '调查员'
        });
        if (!createResult.success) {
            throw new Error('Failed to create campaign');
        }
        gmState.campaignId = createResult.campaign_id;
        gmState.campaign = createResult.campaign;
        gmState.active = true;

        console.log('[AI-GM] Campaign created:', createResult.campaign_id);

        // 3. Update UI
        updateCampaignUI(createResult.campaign);
        updateSceneUI(gmState.module, createResult.campaign.current_scene);
        updatePlayerUI(createResult.campaign.player);

        setLoading(false);
    } catch (e) {
        console.error('[AI-GM] Failed to load module:', e);
        showError('模组加载失败: ' + e.message);
        setLoading(false);
    }
}

/**
 * Create new campaign dialog
 */
async function createCampaignDialog() {
    if (!gmState.module) {
        showError('请先加载模组');
        return;
    }

    // Simple prompt for player name (SillyTavern style)
    const playerName = await callPopup('输入调查员姓名:', 'input', '调查员');
    if (!playerName) return;

    try {
        setLoading(true, '创建战役...');
        const result = await gmApi('/campaign/create', 'POST', {
            module_id: gmState.module.id,
            player_name: playerName
        });

        if (result.success) {
            gmState.campaignId = result.campaign_id;
            gmState.campaign = result.campaign;
            gmState.active = true;
            updateCampaignUI(result.campaign);
            updateSceneUI(gmState.module, result.campaign.current_scene);
            updatePlayerUI(result.campaign.player);
        }
        setLoading(false);
    } catch (e) {
        console.error('[AI-GM] Failed to create campaign:', e);
        showError('创建战役失败: ' + e.message);
        setLoading(false);
    }
}

/**
 * Transition to a different scene
 */
async function transitionScene(sceneId) {
    if (!gmState.campaignId) return;

    try {
        setLoading(true, '切换场景...');
        const result = await gmApi('/state/transition', 'POST', {
            campaign_id: gmState.campaignId,
            scene_id: sceneId
        });

        if (result.success) {
            gmState.campaign.current_scene = sceneId;
            updateSceneUI(gmState.module, sceneId);
            updateNPCUI(gmState.module, gmState.campaign);
        }
        setLoading(false);
    } catch (e) {
        console.error('[AI-GM] Scene transition failed:', e);
        showError('场景切换失败: ' + e.message);
        setLoading(false);
    }
}

/**
 * Send player action to backend
 */
async function sendPlayerAction(actionType, actionData = {}, playerInput = '') {
    if (!gmState.campaignId) return;

    try {
        setLoading(true, '处理中...');
        const result = await gmApi('/state/action', 'POST', {
            campaign_id: gmState.campaignId,
            action_type: actionType,
            action_data: actionData,
            player_input: playerInput
        });

        if (result.success) {
            if (result.type === 'scene_change') {
                gmState.campaign.current_scene = result.to;
                updateSceneUI(gmState.module, result.to);
            }
            console.log('[AI-GM] Action result:', result);
        }
        setLoading(false);
    } catch (e) {
        console.error('[AI-GM] Action failed:', e);
        showError('操作失败: ' + e.message);
        setLoading(false);
    }
}

/**
 * Show dice roller dialog
 */
function showDiceRoller() {
    // Create a simple popup for dice rolling
    const html = `
        <div class="ai-gm-dice-dialog">
            <div class="ai-gm-dice-presets">
                <button class="menu_button ai-gm-dice-preset" data-expr="1d100">1d100</button>
                <button class="menu_button ai-gm-dice-preset" data-expr="1d20">1d20</button>
                <button class="menu_button ai-gm-dice-preset" data-expr="2d6">2d6</button>
                <button class="menu_button ai-gm-dice-preset" data-expr="1d6">1d6</button>
                <button class="menu_button ai-gm-dice-preset" data-expr="3d6">3d6</button>
            </div>
            <div class="ai-gm-dice-result" id="ai-gm-dice-result"></div>
        </div>
    `;

    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.innerHTML = html;
    document.body.appendChild(popup);

    // Bind preset buttons
    popup.querySelectorAll('.ai-gm-dice-preset').forEach(btn => {
        btn.addEventListener('click', async () => {
            const expr = btn.dataset.expr;
            try {
                const result = await gmApi('/rules/dice', 'POST', { expression: expr, label: '手动掷骰' });
                if (result.success) {
                    const resultDiv = popup.querySelector('#ai-gm-dice-result');
                    resultDiv.innerHTML = `
                        <div class="ai-gm-dice-roll">
                            <span class="ai-gm-dice-expr">${expr}</span>
                            <span class="ai-gm-dice-total">${result.result.total}</span>
                            <span class="ai-gm-dice-detail">${result.result.breakdown}</span>
                        </div>
                    `;
                }
            } catch (e) {
                showError('掷骰失败: ' + e.message);
            }
        });
    });

    // Auto-remove on outside click
    setTimeout(() => {
        const closeHandler = (e) => {
            if (!popup.contains(e.target)) {
                popup.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }, 100);
}

/**
 * Show save/load dialog with multiple slots
 */
function showSaveDialog() {
    if (!gmState.campaignId) {
        showError('没有活跃的战役');
        return;
    }

    const html = `
        <div class="ai-gm-save-dialog">
            <div class="ai-gm-save-slots" id="ai-gm-save-slots"></div>
            <div class="ai-gm-save-actions">
                <button class="menu_button" id="ai-gm-save-btn-action">💾 保存到选中槽位</button>
                <button class="menu_button" id="ai-gm-load-btn-action">📂 读取选中槽位</button>
            </div>
            <div id="ai-gm-save-status"></div>
        </div>
    `;

    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.innerHTML = html;
    document.body.appendChild(popup);

    // Load existing saves
    loadSaveSlots(popup);

    let selectedSlot = 1;

    popup.querySelector('#ai-gm-save-btn-action').addEventListener('click', async () => {
        try {
            const result = await gmApi('/save', 'POST', {
                campaign_id: gmState.campaignId,
                slot: selectedSlot,
                label: `存档 ${selectedSlot} - ${gmState.module?.scenes?.[gmState.campaign?.current_scene]?.title || '未知场景'}`
            });
            if (result.success) {
                popup.querySelector('#ai-gm-save-status').textContent = `✅ 存档成功 (槽位 ${selectedSlot})`;
                loadSaveSlots(popup);
            }
        } catch (e) {
            popup.querySelector('#ai-gm-save-status').textContent = '❌ 存档失败: ' + e.message;
        }
    });

    popup.querySelector('#ai-gm-load-btn-action').addEventListener('click', async () => {
        try {
            const result = await gmApi('/load', 'POST', {
                campaign_id: gmState.campaignId,
                slot: selectedSlot
            });
            if (result.success) {
                popup.querySelector('#ai-gm-save-status').textContent = `✅ 读取成功 (槽位 ${selectedSlot})`;
                gmState.campaign = result.campaign;
                updateCampaignUI(result.campaign);
                updateSceneUI(gmState.module, result.campaign.current_scene);
                updatePlayerUI(result.campaign.player);
            }
        } catch (e) {
            popup.querySelector('#ai-gm-save-status').textContent = '❌ 读取失败: ' + e.message;
        }
    });

    setTimeout(() => {
        const closeHandler = (e) => {
            if (!popup.contains(e.target)) {
                popup.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }, 100);
}

/**
 * Load and display save slots
 * @param {HTMLElement} popup - Save dialog popup element
 */
async function loadSaveSlots(popup) {
    try {
        const result = await gmApi('/save/list', 'POST', {
            campaign_id: gmState.campaignId
        });

        const slotsContainer = popup.querySelector('#ai-gm-save-slots');
        if (!slotsContainer) return;

        const saves = result.saves || [];
        const saveMap = new Map(saves.map(s => [s.slot, s]));

        slotsContainer.innerHTML = Array.from({ length: 5 }, (_, i) => {
            const slot = i + 1;
            const save = saveMap.get(slot);
            const isActive = save ? 'active' : 'empty';
            const content = save
                ? `
                    <div class="ai-gm-slot-info">
                        <div class="ai-gm-slot-label">${save.label}</div>
                        <div class="ai-gm-slot-meta">场景: ${save.scene_id} | 回合: ${save.turn_count}</div>
                        <div class="ai-gm-slot-time">${new Date(save.saved_at).toLocaleString('zh-CN')}</div>
                    </div>
                `
                : `<div class="ai-gm-slot-empty">空槽位</div>`;

            return `
                <div class="ai-gm-save-slot ${isActive}" data-slot="${slot}">
                    <div class="ai-gm-slot-number">${slot}</div>
                    ${content}
                </div>
            `;
        }).join('');

        // Bind slot selection
        slotsContainer.querySelectorAll('.ai-gm-save-slot').forEach(slotEl => {
            slotEl.addEventListener('click', () => {
                slotsContainer.querySelectorAll('.ai-gm-save-slot').forEach(el => el.classList.remove('selected'));
                slotEl.classList.add('selected');
                selectedSlot = parseInt(slotEl.dataset.slot);
            });
        });
    } catch (e) {
        console.error('[AI-GM] Failed to load save slots:', e);
    }
}

/**
 * Send combat action to backend
 */
async function sendCombatAction(action) {
    if (!gmState.campaignId) return;
    
    try {
        const result = await gmApi('/combat/action', 'POST', {
            campaign_id: gmState.campaignId,
            actor: 'player_1',
            action: action
        });
        updateCombatUI(result);
    } catch (e) {
        console.error('[AI-GM] Combat action failed:', e);
        showError('战斗行动失败: ' + e.message);
    }
}

/**
 * Update campaign UI section
 */
function updateCampaignUI(campaign) {
    const nameEl = document.getElementById('ai-gm-campaign-name');
    const sceneEl = document.getElementById('ai-gm-campaign-scene');
    if (nameEl) nameEl.textContent = gmState.module?.name || '未命名模组';
    if (sceneEl) sceneEl.textContent = 'ID: ' + (campaign.id || '-').slice(0, 16);
}

/**
 * Update scene UI section with exits
 */
function updateSceneUI(module, sceneId) {
    const scene = module?.scenes?.[sceneId];
    if (!scene) return;

    const titleEl = document.getElementById('ai-gm-scene-title');
    const descEl = document.getElementById('ai-gm-scene-desc');
    const npcsEl = document.getElementById('ai-gm-npcs-present');

    if (titleEl) titleEl.textContent = scene.title || sceneId;
    if (descEl) descEl.textContent = scene.description || '-';

    // Update NPC list
    if (npcsEl) {
        const npcList = scene.npcs_present || [];
        npcsEl.innerHTML = npcList.map(npcId => {
            const npc = module.npcs?.[npcId];
            const state = gmState.campaign?.npcs_state?.[npcId];
            return `
                <div class="ai-gm-npc-tag" data-npc-id="${npcId}" title="HP: ${state?.current_hp || '?'}/${state?.max_hp || '?'}">
                    ${npc?.name || npcId}
                </div>
            `;
        }).join('');
    }

    // Update available exits as buttons
    updateSceneExits(scene);
}

/**
 * Update scene exits as clickable buttons
 */
function updateSceneExits(scene) {
    // Remove old exits
    document.querySelectorAll('.ai-gm-exits-container').forEach(el => el.remove());

    const sceneSection = document.getElementById('ai-gm-scene-info');
    if (!sceneSection || !scene.exits?.length) return;

    const exitsContainer = document.createElement('div');
    exitsContainer.className = 'ai-gm-exits-container';
    exitsContainer.innerHTML = '<div class="ai-gm-section-title">🚪 出口</div>';

    scene.exits.forEach(exit => {
        const btn = document.createElement('button');
        btn.className = 'menu_button ai-gm-exit-btn';
        btn.textContent = exit.description;
        btn.addEventListener('click', () => transitionScene(exit.target_scene));
        exitsContainer.appendChild(btn);
    });

    sceneSection.appendChild(exitsContainer);
}

/**
 * Update NPC status UI
 */
function updateNPCUI(module, campaign) {
    const npcsEl = document.getElementById('ai-gm-npcs-present');
    if (!npcsEl) return;

    const scene = module?.scenes?.[campaign?.current_scene];
    if (!scene) return;

    const npcList = scene.npcs_present || [];
    npcsEl.innerHTML = npcList.map(npcId => {
        const npc = module.npcs?.[npcId];
        const state = campaign?.npcs_state?.[npcId];
        return `
            <div class="ai-gm-npc-tag ${state?.attitude || 'neutral'}" data-npc-id="${npcId}"
                 title="HP: ${state?.current_hp || '?'}/${state?.max_hp || '?'} | 态度: ${state?.attitude || 'neutral'}">
                ${npc?.name || npcId}
            </div>
        `;
    }).join('');
}

/**
 * Update player status UI
 */
function updatePlayerUI(player) {
    const statsEl = document.getElementById('ai-gm-player-stats');
    if (!statsEl || !player) return;

    const stats = player.stats || {};
    const hp = player.hp || stats.HP || 10;
    const maxHp = player.max_hp || stats.HP || 10;
    const sanity = player.sanity || stats.SAN || 50;
    const maxSanity = player.max_sanity || stats.SAN || 50;

    statsEl.innerHTML = `
        <div class="ai-gm-stat-row">
            <span class="ai-gm-stat-label">👤 ${player.name}</span>
        </div>
        <div class="ai-gm-stat-bar">
            <span class="ai-gm-stat-name">HP</span>
            <div class="ai-gm-stat-bar-track">
                <div class="ai-gm-stat-bar-fill hp" style="width: ${(hp / maxHp * 100)}%"></div>
            </div>
            <span class="ai-gm-stat-value">${hp}/${maxHp}</span>
        </div>
        <div class="ai-gm-stat-bar">
            <span class="ai-gm-stat-name">SAN</span>
            <div class="ai-gm-stat-bar-track">
                <div class="ai-gm-stat-bar-fill sanity" style="width: ${(sanity / maxSanity * 100)}%"></div>
            </div>
            <span class="ai-gm-stat-value">${sanity}/${maxSanity}</span>
        </div>
        <div class="ai-gm-stat-grid">
            ${['STR', 'CON', 'DEX', 'INT', 'POW', 'EDU'].map(attr => `
                <div class="ai-gm-stat-cell">
                    <span class="ai-gm-stat-attr">${attr}</span>
                    <span class="ai-gm-stat-num">${stats[attr] || '?'}</span>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Update combat UI with player HP sync
 * @param {object} result - Combat action result
 */
function updateCombatUI(result) {
    const combatPanel = document.getElementById('ai-gm-combat-panel');
    combatPanel.style.display = 'block';
    
    // Sync player HP from combat result
    if (result.player) {
        gmState.campaign.player = result.player;
        updatePlayerUI(result.player);
    }
    
    // Update combat summary
    const summary = result.combat_summary;
    if (summary) {
        document.getElementById('ai-gm-combat-round').textContent = `回合: ${summary.round}`;
        document.getElementById('ai-gm-combat-turn').textContent = `当前行动: ${summary.current_turn_name || summary.current_turn}`;
        
        const initiativeList = document.getElementById('ai-gm-combat-initiative');
        initiativeList.innerHTML = summary.enemies.map(e => 
            `<div class="ai-gm-initiative-entry ${e.id === summary.current_turn ? 'active' : ''}">
                ${e.name}: HP ${e.hp}/${e.max_hp}
            </div>`
        ).join('');
        
        // Add combat log
        if (summary.log) {
            const logDiv = document.createElement('div');
            logDiv.className = 'ai-gm-combat-log';
            logDiv.innerHTML = summary.log.map(l => `<div class="ai-gm-log-entry">${l}</div>`).join('');
            combatPanel.appendChild(logDiv);
        }
        
        return;
    }
    
    // Fallback for legacy format
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
 * Update panel UI with module data (legacy, kept for compatibility)
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
 * Set loading state
 */
function setLoading(loading, message = '') {
    gmState.isLoading = loading;
    const panel = document.getElementById('ai-gm-panel');
    if (!panel) return;

    if (loading) {
        panel.classList.add('ai-gm-loading');
        const loader = document.createElement('div');
        loader.id = 'ai-gm-loader';
        loader.className = 'ai-gm-loader';
        loader.innerHTML = `<span class="ai-gm-loader-text">${message}</span>`;
        panel.appendChild(loader);
    } else {
        panel.classList.remove('ai-gm-loading');
        document.getElementById('ai-gm-loader')?.remove();
    }
}

/**
 * Show error message in panel
 */
function showError(message) {
    console.error('[AI-GM]', message);
    const panel = document.getElementById('ai-gm-panel');
    if (!panel) return;

    const errorEl = document.createElement('div');
    errorEl.className = 'ai-gm-error';
    errorEl.textContent = message;
    panel.insertBefore(errorEl, panel.firstChild);

    setTimeout(() => errorEl.remove(), 5000);
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
export { gmState, gmApi, loadBuiltinModule, transitionScene, sendPlayerAction };
