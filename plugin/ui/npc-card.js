/**
 * AI-GM NPC Card Component — Phase 3 Surface
 * 渲染 NPC 状态卡片：头像、HP、SAN、态度、状态效果、记忆摘要
 * 依赖：ST 原生 CSS 变量（SmartTheme*）
 */

const CSS_NS = 'ai-gm-npc';

/** 态度表情映射 */
const ATTITUDE_ICON = {
  friendly: '😊',
  neutral: '😐',
  hostile: '👿',
  fearful: '😰',
  mysterious: '🎭',
  dead: '💀',
  insane: '🌀',
  unknown: '❓',
};

/** 态度颜色映射 */
const ATTITUDE_COLOR = {
  friendly: '#6a6',
  neutral: '#aa6',
  hostile: '#a66',
  fearful: '#a6a',
  mysterious: '#66a',
  dead: '#666',
  insane: '#86a',
  unknown: '#888',
};

/** 初始化 NPC 卡片容器 */
function initNpcContainer(container) {
  container.innerHTML = '';
  container.classList.add(CSS_NS);

  const el = document.createElement('div');
  el.className = `${CSS_NS}-wrapper`;
  el.id = 'agm-npc-root';
  el.innerHTML = `
    <div class="${CSS_NS}-header">
      <h3 class="${CSS_NS}-title">NPC</h3>
      <span class="${CSS_NS}-count" id="agm-npc-count">0</span>
    </div>
    <div class="${CSS_NS}-grid" id="agm-npc-grid"></div>
  `;
  container.appendChild(el);
  injectNpcStyles(container);
}

/** 渲染 NPC 列表
 *  @param {Array} npcs - NPC 数据数组
 *    [{ id, name, avatar, attitude, currentHp, maxHp, currentSan, maxSan, statusEffects, location, memorySummary, isHostile }]
 */
function renderNpcs(npcs) {
  const grid = document.getElementById('agm-npc-grid');
  const count = document.getElementById('agm-npc-count');
  if (!grid) return;

  const list = Array.isArray(npcs) ? npcs : [];
  if (count) count.textContent = String(list.length);

  grid.innerHTML = list.length
    ? list.map((npc) => buildNpcCard(npc)).join('')
    : `<div class="${CSS_NS}-empty">此处无人生还...</div>`;

  // 绑定交互事件
  bindNpcEvents(grid);
}

/** 构建单个 NPC 卡片 HTML */
function buildNpcCard(npc) {
  const id = escapeHtml(npc.id || 'unknown');
  const name = escapeHtml(npc.name || '未知');
  const attitude = npc.attitude || 'unknown';
  const icon = ATTITUDE_ICON[attitude] || ATTITUDE_ICON.unknown;
  const color = ATTITUDE_COLOR[attitude] || ATTITUDE_COLOR.unknown;
  const hp = npc.currentHp ?? npc.hp ?? '?';
  const maxHp = npc.maxHp ?? '?';
  const san = npc.currentSan ?? npc.san ?? '?';
  const maxSan = npc.maxSan ?? '?';
  const hpPct = maxHp && maxHp !== '?' ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const sanPct = maxSan && maxSan !== '?' ? Math.max(0, Math.min(100, (san / maxSan) * 100)) : 0;
  const effects = (npc.statusEffects || [])
    .map((e) => `<span class="${CSS_NS}-effect">${escapeHtml(e)}</span>`)
    .join('');
  const location = npc.location
    ? `<span class="${CSS_NS}-loc">📍 ${escapeHtml(npc.location)}</span>`
    : '';
  const memory = npc.memorySummary
    ? `<div class="${CSS_NS}-memory">${escapeHtml(npc.memorySummary)}</div>`
    : '';
  const avatar = npc.avatar
    ? `<img class="${CSS_NS}-avatar" src="${escapeHtml(npc.avatar)}" alt="${name}">`
    : `<div class="${CSS_NS}-avatar-placeholder" style="background:${color}20;color:${color}">${name[0]}</div>`;

  const isLowHp = hpPct <= 25 && hpPct > 0;
  const isDead = hpPct <= 0 || attitude === 'dead';
  const isInsane = attitude === 'insane' || sanPct <= 20;
  const cardClass = `${CSS_NS}-card${isDead ? ' dead' : ''}${isLowHp ? ' critical' : ''}${isInsane ? ' insane' : ''}`;

  return `
    <div class="${cardClass}" data-npc-id="${id}" tabindex="0" role="button">
      <div class="${CSS_NS}-card-header">
        ${avatar}
        <div class="${CSS_NS}-info">
          <div class="${CSS_NS}-name">${name} <span class="${CSS_NS}-attitude" style="color:${color}">${icon}</span></div>
          <div class="${CSS_NS}-sub">${location}${effects}</div>
        </div>
      </div>
      <div class="${CSS_NS}-bars">
        <div class="${CSS_NS}-bar-row">
          <span class="${CSS_NS}-bar-label">HP</span>
          <div class="${CSS_NS}-bar-track">
            <div class="${CSS_NS}-bar-fill ${CSS_NS}-hp" style="width:${hpPct}%;${isLowHp ? 'background:#c44' : ''}"></div>
          </div>
          <span class="${CSS_NS}-bar-val">${hp}/${maxHp}</span>
        </div>
        <div class="${CSS_NS}-bar-row">
          <span class="${CSS_NS}-bar-label">SAN</span>
          <div class="${CSS_NS}-bar-track">
            <div class="${CSS_NS}-bar-fill ${CSS_NS}-san" style="width:${sanPct}%;${isInsane ? 'background:#a6a' : ''}"></div>
          </div>
          <span class="${CSS_NS}-bar-val">${san}/${maxSan}</span>
        </div>
      </div>
      ${memory}
      <div class="${CSS_NS}-actions">
        <button class="${CSS_NS}-act-btn" data-action="talk" data-npc="${id}">对话</button>
        <button class="${CSS_NS}-act-btn" data-action="inspect" data-npc="${id}">调查</button>
        ${npc.isHostile ? `<button class="${CSS_NS}-act-btn hostile" data-action="attack" data-npc="${id}">攻击</button>` : ''}
      </div>
    </div>
  `;
}

/** 绑定 NPC 卡片交互事件 */
function bindNpcEvents(grid) {
  grid.querySelectorAll(`.${CSS_NS}-card`).forEach((card) => {
    card.addEventListener('click', (e) => {
      const id = card.dataset.npcId;
      if (!id) return;
      // 点击卡片展开/折叠详情
      card.classList.toggle('expanded');
      document.dispatchEvent(
        new CustomEvent('ai-gm:npc-select', {
          detail: { npcId: id, source: 'card' },
        }),
      );
    });
  });

  grid.querySelectorAll(`.${CSS_NS}-act-btn`).forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const npcId = btn.dataset.npc;
      document.dispatchEvent(
        new CustomEvent('ai-gm:npc-action', {
          detail: { npcId, action, source: 'card' },
        }),
      );
    });
  });
}

/** 更新单个 NPC 状态（不重新渲染全部） */
function updateNpcState(npcId, updates) {
  const card = document.querySelector(`[data-npc-id="${CSS.escape(npcId)}"]`);
  if (!card) return false;

  if (updates.attitude) {
    const iconEl = card.querySelector(`.${CSS_NS}-attitude`);
    if (iconEl) {
      iconEl.textContent = ATTITUDE_ICON[updates.attitude] || ATTITUDE_ICON.unknown;
      iconEl.style.color = ATTITUDE_COLOR[updates.attitude] || ATTITUDE_COLOR.unknown;
    }
  }
  if (updates.currentHp !== undefined && updates.maxHp !== undefined) {
    const hpPct = Math.max(0, Math.min(100, (updates.currentHp / updates.maxHp) * 100));
    const hpFill = card.querySelector(`.${CSS_NS}-hp`);
    const hpVal = card.querySelectorAll(`.${CSS_NS}-bar-val`)[0];
    if (hpFill) {
      hpFill.style.width = `${hpPct}%`;
      hpFill.style.background = hpPct <= 25 ? '#c44' : '';
    }
    if (hpVal) hpVal.textContent = `${updates.currentHp}/${updates.maxHp}`;
    if (hpPct <= 0) card.classList.add('dead');
    else if (hpPct <= 25) card.classList.add('critical');
  }
  if (updates.currentSan !== undefined && updates.maxSan !== undefined) {
    const sanPct = Math.max(0, Math.min(100, (updates.currentSan / updates.maxSan) * 100));
    const sanFill = card.querySelector(`.${CSS_NS}-san`);
    const sanVal = card.querySelectorAll(`.${CSS_NS}-bar-val`)[1];
    if (sanFill) {
      sanFill.style.width = `${sanPct}%`;
      sanFill.style.background = sanPct <= 20 ? '#a6a' : '';
    }
    if (sanVal) sanVal.textContent = `${updates.currentSan}/${updates.maxSan}`;
  }
  if (updates.statusEffects) {
    const sub = card.querySelector(`.${CSS_NS}-sub`);
    if (sub) {
      const loc = sub.querySelector(`.${CSS_NS}-loc`);
      const effects = updates.statusEffects
        .map((e) => `<span class="${CSS_NS}-effect">${escapeHtml(e)}</span>`)
        .join('');
      sub.innerHTML = (loc ? loc.outerHTML : '') + effects;
    }
  }
  return true;
}

/** 注入 NPC 样式 */
function injectNpcStyles(root) {
  if (document.getElementById(`${CSS_NS}-style`)) return;
  const style = document.createElement('style');
  style.id = `${CSS_NS}-style`;
  style.textContent = `
    .${CSS_NS} { }
    .${CSS_NS}-wrapper { display: flex; flex-direction: column; gap: 0.5rem; }
    .${CSS_NS}-header { display: flex; align-items: center; justify-content: space-between; }
    .${CSS_NS}-title { margin: 0; font-size: 1rem; color: var(--SmartThemeBodyColor); }
    .${CSS_NS}-count { font-size: 0.8rem; color: var(--SmartThemeEmColor); background: rgba(128,128,128,0.2); padding: 0.15rem 0.5rem; border-radius: 4px; }
    .${CSS_NS}-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.6rem; }
    .${CSS_NS}-empty { color: var(--SmartThemeEmColor); font-style: italic; font-size: 0.9rem; padding: 0.5rem; opacity: 0.7; }
    .${CSS_NS}-card {
      background: rgba(128,128,128,0.08); border: 1px solid var(--SmartThemeBorderColor);
      border-radius: 6px; padding: 0.6rem; cursor: pointer; transition: all 0.2s ease;
    }
    .${CSS_NS}-card:hover { border-color: var(--SmartThemeQuoteColor); background: rgba(128,128,128,0.15); transform: translateY(-1px); }
    .${CSS_NS}-card.dead { opacity: 0.5; filter: grayscale(0.8); }
    .${CSS_NS}-card.critical { border-color: rgba(180,60,60,0.5); animation: agm-npc-pulse 2s ease-in-out infinite; }
    .${CSS_NS}-card.insane .${CSS_NS}-name { animation: agm-npc-shake 0.5s ease-in-out infinite; }
    .${CSS_NS}-card.expanded .${CSS_NS}-memory { display: block; }
    .${CSS_NS}-card-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }
    .${CSS_NS}-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid var(--SmartThemeBorderColor); }
    .${CSS_NS}-avatar-placeholder { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 1rem; border: 2px solid var(--SmartThemeBorderColor); }
    .${CSS_NS}-info { flex: 1; min-width: 0; }
    .${CSS_NS}-name { font-size: 0.95rem; font-weight: 600; color: var(--SmartThemeBodyColor); display: flex; align-items: center; gap: 0.3rem; }
    .${CSS_NS}-attitude { font-size: 0.9rem; }
    .${CSS_NS}-sub { font-size: 0.75rem; color: var(--SmartThemeEmColor); display: flex; gap: 0.3rem; flex-wrap: wrap; align-items: center; margin-top: 0.1rem; }
    .${CSS_NS}-loc { opacity: 0.8; }
    .${CSS_NS}-effect { display: inline-block; padding: 0.05rem 0.3rem; border-radius: 3px; font-size: 0.7rem; background: rgba(128,128,128,0.2); border: 1px solid var(--SmartThemeBorderColor); }
    .${CSS_NS}-bars { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.4rem; }
    .${CSS_NS}-bar-row { display: flex; align-items: center; gap: 0.4rem; }
    .${CSS_NS}-bar-label { font-size: 0.7rem; color: var(--SmartThemeEmColor); width: 1.8rem; text-align: right; }
    .${CSS_NS}-bar-track { flex: 1; height: 6px; background: rgba(128,128,128,0.2); border-radius: 3px; overflow: hidden; }
    .${CSS_NS}-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease, background 0.3s ease; }
    .${CSS_NS}-hp { background: #6a6; }
    .${CSS_NS}-san { background: #66a; }
    .${CSS_NS}-bar-val { font-size: 0.7rem; color: var(--SmartThemeEmColor); width: 2.5rem; text-align: right; }
    .${CSS_NS}-memory { display: none; font-size: 0.8rem; color: var(--SmartThemeEmColor); line-height: 1.4; margin: 0.3rem 0; padding: 0.3rem; background: rgba(128,128,128,0.1); border-radius: 4px; border-left: 2px solid var(--SmartThemeQuoteColor); }
    .${CSS_NS}-actions { display: flex; gap: 0.3rem; margin-top: 0.3rem; }
    .${CSS_NS}-act-btn {
      flex: 1; padding: 0.25rem 0.4rem; font-size: 0.75rem; border-radius: 3px;
      background: rgba(128,128,128,0.15); border: 1px solid var(--SmartThemeBorderColor);
      color: var(--SmartThemeBodyColor); cursor: pointer; transition: all 0.2s ease;
    }
    .${CSS_NS}-act-btn:hover { background: rgba(128,128,128,0.3); border-color: var(--SmartThemeQuoteColor); }
    .${CSS_NS}-act-btn.hostile { background: rgba(180,60,60,0.15); border-color: rgba(180,60,60,0.4); }
    .${CSS_NS}-act-btn.hostile:hover { background: rgba(180,60,60,0.3); }
    @keyframes agm-npc-pulse { 0%,100% { border-color: rgba(180,60,60,0.3); } 50% { border-color: rgba(180,60,60,0.8); } }
    @keyframes agm-npc-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-1px); } 75% { transform: translateX(1px); } }
  `;
  (root.getRootNode() || document.head).appendChild(style);
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

/* ---------- exports ---------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initNpcContainer, renderNpcs, updateNpcState, ATTITUDE_ICON, ATTITUDE_COLOR };
}
window.AiGmNpc = { initNpcContainer, renderNpcs, updateNpcState, ATTITUDE_ICON, ATTITUDE_COLOR };
