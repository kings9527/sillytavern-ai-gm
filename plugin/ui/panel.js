/**
 * AI-GM 主面板 — Phase 3 Surface (Enhanced)
 * 渲染游戏场景面板：标题、描述、NPC 列表、出口、玩家状态、日志
 * 依赖：ST 原生 CSS 变量（SmartTheme*）
 */

const CSS_NS = 'ai-gm-panel';

/** @type {Array<Object>} */
let logBuffer = [];
/** @type {number} */
const MAX_LOG_ENTRIES = 50;

/**
 * 构建面板 DOM，挂载到 container
 * @param {HTMLElement} container - 挂载容器
 */
function initPanel(container) {
    container.innerHTML = '';
    container.classList.add(CSS_NS);

    const el = document.createElement('div');
    el.className = `${CSS_NS}-wrapper`;
    el.innerHTML = `
        <div class="${CSS_NS}-header">
            <h2 class="${CSS_NS}-title" id="agm-title">场景标题</h2>
            <span class="${CSS_NS}-status" id="agm-status">⚪ 等待连接</span>
        </div>
        <div class="${CSS_NS}-scene" id="agm-scene-section">
            <div class="${CSS_NS}-desc" id="agm-desc">场景描述将显示在这里...</div>
        </div>
        <div class="${CSS_NS}-npcs" id="agm-npcs-section">
            <h3 class="${CSS_NS}-section-toggle" data-section="npcs">NPC <span class="${CSS_NS}-toggle-icon">▼</span></h3>
            <div class="${CSS_NS}-section-body" id="agm-npcs-body">
                <ul class="${CSS_NS}-npc-list" id="agm-npc-list"></ul>
            </div>
        </div>
        <div class="${CSS_NS}-exits" id="agm-exits-section">
            <h3 class="${CSS_NS}-section-toggle" data-section="exits">出口 <span class="${CSS_NS}-toggle-icon">▼</span></h3>
            <div class="${CSS_NS}-section-body" id="agm-exits-body">
                <div class="${CSS_NS}-exit-buttons" id="agm-exit-buttons"></div>
            </div>
        </div>
        <div class="${CSS_NS}-player" id="agm-player-section">
            <h3 class="${CSS_NS}-section-toggle" data-section="player">玩家状态 <span class="${CSS_NS}-toggle-icon">▼</span></h3>
            <div class="${CSS_NS}-section-body" id="agm-player-body">
                <div class="${CSS_NS}-stats" id="agm-stats"></div>
            </div>
        </div>
        <div class="${CSS_NS}-log" id="agm-log-section">
            <h3 class="${CSS_NS}-section-toggle" data-section="log">📜 日志 <span class="${CSS_NS}-toggle-icon">▼</span></h3>
            <div class="${CSS_NS}-section-body" id="agm-log-body">
                <div class="${CSS_NS}-log-scroll" id="agm-log-scroll">
                    <div class="${CSS_NS}-log-empty" id="agm-log-empty">暂无记录</div>
                    <div class="${CSS_NS}-log-entries" id="agm-log-entries"></div>
                </div>
            </div>
        </div>
    `;
    container.appendChild(el);
    injectStyles(container);
    bindToggleEvents(el);
}

/**
 * 根据游戏状态更新面板内容
 * @param {Object} state - 游戏状态对象
 *   { title, description, npcs: [], exits: [], player: {}, log: [], scene: {} }
 */
function updatePanel(state) {
    if (!state) return;
    setText('agm-title', state.title || '未知场景');
    setText('agm-desc', state.description || '');
    renderNpcList(state.npcs || []);
    renderExits(state.exits || []);
    renderPlayerStats(state.player || {});
    if (state.log) appendLogEntries(state.log);
}

/**
 * 追加单条日志
 * @param {Object} entry - 日志条目 { type, content, timestamp }
 */
function appendLog(entry) {
    if (!entry) return;
    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOG_ENTRIES) logBuffer.shift();
    renderLogBuffer();
}

/**
 * 追加多条日志
 * @param {Array<Object>} entries - 日志条目数组
 */
function appendLogEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return;
    logBuffer.push(...entries);
    if (logBuffer.length > MAX_LOG_ENTRIES) {
        logBuffer = logBuffer.slice(-MAX_LOG_ENTRIES);
    }
    renderLogBuffer();
}

/**
 * 清空日志
 */
function clearLog() {
    logBuffer = [];
    renderLogBuffer();
}

/* ---------- helpers ---------- */

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function renderNpcList(npcs) {
    const list = document.getElementById('agm-npc-list');
    if (!list) return;
    list.innerHTML = npcs.length
        ? npcs.map(n => `<li class="${CSS_NS}-npc">${escapeHtml(n.name)} — ${escapeHtml(n.mood || '平静')}</li>`).join('')
        : '<li class="${CSS_NS}-empty">此处无人</li>';
}

function renderExits(exits) {
    const box = document.getElementById('agm-exit-buttons');
    if (!box) return;
    box.innerHTML = exits.length
        ? exits.map(e =>
            `<button class="menu_button ${CSS_NS}-exit-btn" data-target="${escapeHtml(e.target)}">${escapeHtml(e.label)}</button>`
        ).join('')
        : '<span class="${CSS_NS}-empty">没有可见的出口</span>';
}

function renderPlayerStats(player) {
    const box = document.getElementById('agm-stats');
    if (!box) return;
    const stats = player.stats || {};
    const hp = stats.hp ?? '?';
    const maxHp = stats.maxHp ?? '?';
    const mp = stats.mp ?? '?';
    const maxMp = stats.maxMp ?? '?';
    const san = stats.san ?? '?';
    const maxSan = stats.maxSan ?? '?';
    const items = (player.inventory || []).join(', ') || '空';

    const hpPct = (maxHp !== '?' && maxHp > 0) ? Math.round((hp / maxHp) * 100) : 0;
    const sanPct = (maxSan !== '?' && maxSan > 0) ? Math.round((san / maxSan) * 100) : 0;
    const mpPct = (maxMp !== '?' && maxMp > 0) ? Math.round((mp / maxMp) * 100) : 0;

    box.innerHTML = `
        <div class="${CSS_NS}-bar-row">
            <span class="${CSS_NS}-bar-label">HP</span>
            <div class="${CSS_NS}-bar-track"><div class="${CSS_NS}-bar-fill hp" style="width:${hpPct}%"></div></div>
            <span class="${CSS_NS}-bar-val">${hp}/${maxHp}</span>
        </div>
        <div class="${CSS_NS}-bar-row">
            <span class="${CSS_NS}-bar-label">SAN</span>
            <div class="${CSS_NS}-bar-track"><div class="${CSS_NS}-bar-fill san" style="width:${sanPct}%"></div></div>
            <span class="${CSS_NS}-bar-val">${san}/${maxSan}</span>
        </div>
        <div class="${CSS_NS}-bar-row">
            <span class="${CSS_NS}-bar-label">MP</span>
            <div class="${CSS_NS}-bar-track"><div class="${CSS_NS}-bar-fill mp" style="width:${mpPct}%"></div></div>
            <span class="${CSS_NS}-bar-val">${mp}/${maxMp}</span>
        </div>
        <div class="${CSS_NS}-stat"><span>位置</span><span>${escapeHtml(player.location || '未知')}</span></div>
        <div class="${CSS_NS}-stat"><span>物品</span><span>${escapeHtml(items)}</span></div>
    `;
}

function renderLogBuffer() {
    const empty = document.getElementById('agm-log-empty');
    const entries = document.getElementById('agm-log-entries');
    if (!entries) return;

    if (logBuffer.length === 0) {
        if (empty) empty.style.display = 'block';
        entries.innerHTML = '';
        return;
    }

    if (empty) empty.style.display = 'none';

    const typeIcons = {
        scene: '🏞️', combat: '⚔️', dice: '🎲', player: '🎭',
        npc: '👤', system: '⚙️', save: '💾', error: '❌',
    };
    const typeLabels = {
        scene: '场景', combat: '战斗', dice: '骰子', player: '玩家',
        npc: 'NPC', system: '系统', save: '存档', error: '错误',
    };

    entries.innerHTML = logBuffer.map(entry => {
        const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
        const type = entry.type || 'player';
        const icon = typeIcons[type] || '📝';
        const label = typeLabels[type] || type;
        return `
            <div class="${CSS_NS}-log-entry ${type}">
                <span class="${CSS_NS}-log-time">${time}</span>
                <span class="${CSS_NS}-log-type" title="${label}">${icon}</span>
                <span class="${CSS_NS}-log-content">${escapeHtml(entry.content || '')}</span>
            </div>
        `;
    }).join('');

    entries.scrollTop = entries.scrollHeight;
}

function bindToggleEvents(root) {
    root.querySelectorAll(`.${CSS_NS}-section-toggle`).forEach(toggle => {
        toggle.addEventListener('click', () => {
            const section = toggle.dataset.section;
            const body = document.getElementById(`agm-${section}-body`);
            const icon = toggle.querySelector(`.${CSS_NS}-toggle-icon`);
            if (!body) return;

            const isCollapsed = body.classList.toggle('collapsed');
            if (icon) icon.textContent = isCollapsed ? '▶' : '▼';
            body.style.display = isCollapsed ? 'none' : 'block';
        });
    });
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

/** 注入 SillyTavern 原生变量兼容的样式 */
function injectStyles(root) {
    if (document.getElementById(`${CSS_NS}-style`)) return;
    const style = document.createElement('style');
    style.id = `${CSS_NS}-style`;
    style.textContent = `
        .${CSS_NS}-wrapper { display:flex; flex-direction:column; gap:0.6rem; padding:0.5rem; }
        .${CSS_NS}-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem; }
        .${CSS_NS}-title { margin:0; font-size:1.05rem; color:var(--SmartThemeBodyColor); font-weight:600; }
        .${CSS_NS}-status { font-size:0.75rem; padding:0.15rem 0.5rem; border-radius:4px; background:rgba(128,128,128,0.15); border:1px solid var(--SmartThemeBorderColor); color:var(--SmartThemeEmColor); }
        .${CSS_NS}-status-online { border-color:rgba(60,180,60,0.4); color:#6a6; }
        .${CSS_NS}-status-offline { border-color:rgba(180,60,60,0.4); color:#c44; }
        .${CSS_NS}-status-error { border-color:rgba(180,160,40,0.4); color:#a96; }
        .${CSS_NS}-scene { }
        .${CSS_NS}-desc { color:var(--SmartThemeEmColor); line-height:1.5; font-size:0.95rem; }
        .${CSS_NS}-section-toggle { display:flex; justify-content:space-between; align-items:center; margin:0; padding:0.3rem 0; font-size:1rem; color:var(--SmartThemeBodyColor); cursor:pointer; user-select:none; border-bottom:1px solid var(--SmartThemeBorderColor); transition:color 0.2s; }
        .${CSS_NS}-section-toggle:hover { color:var(--SmartThemeQuoteColor); }
        .${CSS_NS}-toggle-icon { font-size:0.7rem; opacity:0.6; }
        .${CSS_NS}-section-body { }
        .${CSS_NS}-npc-list { list-style:none; padding:0; margin:0.3rem 0 0; }
        .${CSS_NS}-npc { padding:0.25rem 0; border-bottom:1px solid rgba(128,128,128,0.1); color:var(--SmartThemeBodyColor); font-size:0.9rem; }
        .${CSS_NS}-npc:last-child { border-bottom:none; }
        .${CSS_NS}-exit-buttons { display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:0.3rem; }
        .${CSS_NS}-exit-btn { font-size:0.85rem; padding:0.3rem 0.7rem; }
        .${CSS_NS}-stats { display:flex; flex-direction:column; gap:0.4rem; margin-top:0.3rem; }
        .${CSS_NS}-bar-row { display:flex; align-items:center; gap:0.4rem; }
        .${CSS_NS}-bar-label { font-size:0.7rem; width:2rem; text-align:right; color:var(--SmartThemeEmColor); }
        .${CSS_NS}-bar-track { flex:1; height:6px; background:rgba(128,128,128,0.2); border-radius:3px; overflow:hidden; }
        .${CSS_NS}-bar-fill { height:100%; border-radius:3px; transition:width 0.4s ease; }
        .${CSS_NS}-bar-fill.hp { background:linear-gradient(90deg, #6a6, #5a5); }
        .${CSS_NS}-bar-fill.san { background:linear-gradient(90deg, #66a, #55a); }
        .${CSS_NS}-bar-fill.mp { background:linear-gradient(90deg, #6a6a, #5a5a); }
        .${CSS_NS}-bar-val { font-size:0.7rem; width:2.5rem; text-align:right; color:var(--SmartThemeEmColor); }
        .${CSS_NS}-stat { display:flex; justify-content:space-between; color:var(--SmartThemeBodyColor); font-size:0.9rem; padding:0.15rem 0; }
        .${CSS_NS}-empty { color:var(--SmartThemeEmColor); opacity:0.7; font-style:italic; font-size:0.85rem; }
        .${CSS_NS}-log { }
        .${CSS_NS}-log-scroll { max-height:160px; overflow-y:auto; margin-top:0.3rem; }
        .${CSS_NS}-log-empty { color:var(--SmartThemeEmColor); opacity:0.6; font-style:italic; font-size:0.85rem; padding:0.3rem 0; }
        .${CSS_NS}-log-entry { display:flex; gap:0.4rem; align-items:flex-start; padding:0.25rem 0; font-size:0.8rem; border-bottom:1px solid rgba(128,128,128,0.08); }
        .${CSS_NS}-log-entry:last-child { border-bottom:none; }
        .${CSS_NS}-log-time { font-size:0.7rem; color:var(--SmartThemeEmColor); opacity:0.5; white-space:nowrap; min-width:2.5rem; }
        .${CSS_NS}-log-type { font-size:0.9rem; line-height:1; }
        .${CSS_NS}-log-content { flex:1; line-height:1.4; color:var(--SmartThemeBodyColor); }
        .${CSS_NS}-log-entry.combat .${CSS_NS}-log-content { color:#c88; }
        .${CSS_NS}-log-entry.error .${CSS_NS}-log-content { color:#c44; }
        .${CSS_NS}-log-entry.save .${CSS_NS}-log-content { color:#6a6; }
        @media (max-width: 768px) {
            .${CSS_NS}-wrapper { padding:0.3rem; }
            .${CSS_NS}-log-scroll { max-height:120px; }
        }
    `;
    (root.getRootNode() || document.head).appendChild(style);
}

/* ---------- exports ---------- */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initPanel, updatePanel, appendLog, appendLogEntries, clearLog };
}
window.AiGmPanel = { 
    initPanel, 
    updatePanel, 
    renderText: updatePanel, 
    renderStats: renderPlayerStats, 
    renderLog: appendLogEntries, 
    appendLog, 
    appendLogEntries, 
    clearLog 
};
