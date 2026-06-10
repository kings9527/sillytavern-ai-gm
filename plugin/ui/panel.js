/**
 * AI-GM 主面板 — Phase 3 Surface
 * 渲染游戏场景面板：标题、描述、NPC 列表、出口、玩家状态
 */

const CSS_NS = 'ai-gm-panel';

/** 构建面板 DOM，挂载到 container */
function initPanel(container) {
    container.innerHTML = '';
    container.classList.add(CSS_NS);

    const el = document.createElement('div');
    el.className = `${CSS_NS}-wrapper`;
    el.innerHTML = `
        <div class="${CSS_NS}-scene">
            <h2 class="${CSS_NS}-title" id="agm-title">场景标题</h2>
            <div class="${CSS_NS}-desc" id="agm-desc">场景描述将显示在这里...</div>
        </div>
        <div class="${CSS_NS}-npcs" id="agm-npcs">
            <h3>NPC</h3>
            <ul class="${CSS_NS}-npc-list" id="agm-npc-list"></ul>
        </div>
        <div class="${CSS_NS}-exits" id="agm-exits">
            <h3>出口</h3>
            <div class="${CSS_NS}-exit-buttons" id="agm-exit-buttons"></div>
        </div>
        <div class="${CSS_NS}-player" id="agm-player">
            <h3>玩家状态</h3>
            <div class="${CSS_NS}-stats" id="agm-stats"></div>
        </div>
    `;
    container.appendChild(el);
    injectStyles(container);
}

/** 根据游戏状态更新面板内容 */
function updatePanel(state) {
    if (!state) return;
    setText('agm-title', state.title || '未知场景');
    setText('agm-desc', state.description || '');
    renderNpcList(state.npcs || []);
    renderExits(state.exits || []);
    renderPlayerStats(state.player || {});
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
    const items = (player.inventory || []).join(', ') || '空';
    box.innerHTML = `
        <div class="${CSS_NS}-stat"><span>HP</span><span>${hp}/${maxHp}</span></div>
        <div class="${CSS_NS}-stat"><span>位置</span><span>${escapeHtml(player.location || '未知')}</span></div>
        <div class="${CSS_NS}-stat"><span>物品</span><span>${escapeHtml(items)}</span></div>
    `;
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
        .${CSS_NS}-wrapper { display:flex; flex-direction:column; gap:0.75rem; padding:0.5rem; }
        .${CSS_NS}-scene h2, .${CSS_NS}-npcs h3, .${CSS_NS}-exits h3, .${CSS_NS}-player h3 {
            margin:0 0 0.4rem; font-size:1.05rem; color:var(--SmartThemeBodyColor);
        }
        .${CSS_NS}-desc { color:var(--SmartThemeEmColor); line-height:1.5; font-size:0.95rem; }
        .${CSS_NS}-npc-list { list-style:none; padding:0; margin:0; }
        .${CSS_NS}-npc { padding:0.25rem 0; border-bottom:1px solid var(--SmartThemeBorderColor); color:var(--SmartThemeBodyColor); }
        .${CSS_NS}-exit-buttons { display:flex; flex-wrap:wrap; gap:0.5rem; }
        .${CSS_NS}-exit-btn { font-size:0.85rem; padding:0.3rem 0.7rem; }
        .${CSS_NS}-stats { display:grid; gap:0.4rem; }
        .${CSS_NS}-stat { display:flex; justify-content:space-between; color:var(--SmartThemeBodyColor); font-size:0.9rem; }
        .${CSS_NS}-empty { color:var(--SmartThemeEmColor); opacity:0.7; font-style:italic; }
    `;
    (root.getRootNode() || document.head).appendChild(style);
}

/* ---------- exports ---------- */

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initPanel, updatePanel };
}
window.AiGmPanel = { initPanel, updatePanel };
