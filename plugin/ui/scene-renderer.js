/**
 * AI-GM Scene Renderer — Phase 3 Surface
 * 渲染克苏鲁风格游戏场景：标题、描述、氛围、背景图、动画效果
 * 依赖：ST 原生 CSS 变量（SmartTheme*）
 */

const CSS_NS = 'ai-gm-scene';

/** 场景氛围配置：映射到 CSS 类名 */
const ATMOSPHERE_MAP = {
  calm:      { class: 'calm',      icon: '🌙', label: '平静' },
  tense:     { class: 'tense',     icon: '⚡', label: '紧张' },
  horror:    { class: 'horror',    icon: '👁', label: '恐惧' },
  combat:    { class: 'combat',    icon: '⚔', label: '战斗' },
  madness:   { class: 'madness',   icon: '🌀', label: '疯狂' },
  mystery:   { class: 'mystery',   icon: '🔮', label: '神秘' },
  death:     { class: 'death',     icon: '💀', label: '死亡' },
};

/** 初始化场景渲染器，挂载到 container */
function initSceneRenderer(container) {
  container.innerHTML = '';
  container.classList.add(CSS_NS);

  const el = document.createElement('div');
  el.className = `${CSS_NS}-wrapper`;
  el.id = 'agm-scene-root';
  el.innerHTML = `
    <div class="${CSS_NS}-atmosphere" id="agm-atmosphere"></div>
    <div class="${CSS_NS}-backdrop" id="agm-backdrop"></div>
    <div class="${CSS_NS}-content">
      <div class="${CSS_NS}-header">
        <span class="${CSS_NS}-atmosphere-badge" id="agm-atm-badge"></span>
        <h2 class="${CSS_NS}-title" id="agm-scene-title">加载中...</h2>
      </div>
      <div class="${CSS_NS}-description" id="agm-scene-desc"></div>
      <div class="${CSS_NS}-meta" id="agm-scene-meta"></div>
      <div class="${CSS_NS}-interactables" id="agm-interactables"></div>
    </div>
    <div class="${CSS_NS}-vignette"></div>
  `;
  container.appendChild(el);
  injectSceneStyles(container);
}

/** 渲染场景内容
 *  @param {Object} scene - 场景数据对象
 *    { title, description, atmosphere, backdrop, world_info_keys, interactables, hints }
 */
function renderScene(scene) {
  if (!scene) return;

  const titleEl = document.getElementById('agm-scene-title');
  const descEl = document.getElementById('agm-scene-desc');
  const metaEl = document.getElementById('agm-scene-meta');
  const atmEl = document.getElementById('agm-atmosphere');
  const badgeEl = document.getElementById('agm-atm-badge');
  const backdropEl = document.getElementById('agm-backdrop');
  const interEl = document.getElementById('agm-interactables');

  if (titleEl) titleEl.textContent = scene.title || '未知场景';

  if (descEl) {
    descEl.innerHTML = formatDescription(scene.description || '');
    descEl.classList.remove('typewriter');
    void descEl.offsetWidth; // reflow
    descEl.classList.add('typewriter');
  }

  const atm = ATMOSPHERE_MAP[scene.atmosphere] || ATMOSPHERE_MAP.mystery;
  if (atmEl) {
    atmEl.className = `${CSS_NS}-atmosphere ${atm.class}`;
    atmEl.setAttribute('data-atm', atm.class);
  }
  if (badgeEl) {
    badgeEl.innerHTML = `${atm.icon} ${atm.label}`;
    badgeEl.className = `${CSS_NS}-atmosphere-badge ${atm.class}`;
  }

  if (backdropEl) {
    backdropEl.style.backgroundImage = scene.backdrop
      ? `url(${CSS.escape(scene.backdrop)})`
      : 'none';
  }

  if (metaEl) {
    const keys = (scene.world_info_keys || []).map(k => `<span class="${CSS_NS}-tag">${escapeHtml(k)}</span>`).join('');
    metaEl.innerHTML = keys
      ? `<div class="${CSS_NS}-tags">${keys}</div>`
      : '';
  }

  if (interEl) {
    const items = scene.interactables || [];
    interEl.innerHTML = items.length
      ? `<div class="${CSS_NS}-interact-title">可交互</div>
         <div class="${CSS_NS}-interact-list">
           ${items.map(it => `<button class="${CSS_NS}-interact-btn" data-item="${escapeHtml(it)}">${escapeHtml(it)}</button>`).join('')}
         </div>`
      : '';
  }

  // 触发氛围切换事件
  document.dispatchEvent(new CustomEvent('ai-gm:atmosphere-change', {
    detail: { atmosphere: scene.atmosphere, sceneId: scene.id },
  }));
}

/** 格式化描述文本：保留换行，添加段落 */
function formatDescription(text) {
  return escapeHtml(text)
    .split(/\n\n+/)
    .map(p => `<p class="${CSS_NS}-para">${p}</p>`)
    .join('');
}

/** 更新场景氛围（不重新渲染全部内容） */
function setAtmosphere(atmosphere) {
  const atm = ATMOSPHERE_MAP[atmosphere] || ATMOSPHERE_MAP.mystery;
  const atmEl = document.getElementById('agm-atmosphere');
  const badgeEl = document.getElementById('agm-atm-badge');
  if (atmEl) {
    atmEl.className = `${CSS_NS}-atmosphere ${atm.class}`;
    atmEl.setAttribute('data-atm', atm.class);
  }
  if (badgeEl) {
    badgeEl.innerHTML = `${atm.icon} ${atm.label}`;
    badgeEl.className = `${CSS_NS}-atmosphere-badge ${atm.class}`;
  }
}

/** 显示/隐藏打字机效果 */
function toggleTypewriter(enable) {
  const descEl = document.getElementById('agm-scene-desc');
  if (!descEl) return;
  if (enable) descEl.classList.add('typewriter');
  else descEl.classList.remove('typewriter');
}

/** 注入场景样式 */
function injectSceneStyles(root) {
  if (document.getElementById(`${CSS_NS}-style`)) return;
  const style = document.createElement('style');
  style.id = `${CSS_NS}-style`;
  style.textContent = `
    .${CSS_NS} { position: relative; overflow: hidden; border-radius: 8px; min-height: 200px; }
    .${CSS_NS}-wrapper { position: relative; z-index: 1; }
    .${CSS_NS}-backdrop {
      position: absolute; inset: 0; z-index: 0;
      background-size: cover; background-position: center;
      opacity: 0.15; filter: blur(2px) grayscale(0.6);
      transition: background-image 0.8s ease, opacity 0.5s ease;
    }
    .${CSS_NS}-vignette {
      position: absolute; inset: 0; z-index: 2; pointer-events: none;
      box-shadow: inset 0 0 120px rgba(0,0,0,0.6);
      transition: box-shadow 0.5s ease;
    }
    .${CSS_NS}-content { position: relative; z-index: 3; padding: 1rem; }
    .${CSS_NS}-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
    .${CSS_NS}-title { margin: 0; font-size: 1.25rem; color: var(--SmartThemeBodyColor); font-weight: 600; }
    .${CSS_NS}-atmosphere-badge {
      display: inline-flex; align-items: center; gap: 0.25rem;
      padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500;
      background: rgba(128,128,128,0.2); color: var(--SmartThemeBodyColor);
      border: 1px solid var(--SmartThemeBorderColor);
      transition: all 0.3s ease;
    }
    .${CSS_NS}-atmosphere-badge.horror { background: rgba(180,40,40,0.25); border-color: rgba(180,40,40,0.5); color: #e8a0a0; }
    .${CSS_NS}-atmosphere-badge.combat { background: rgba(200,120,0,0.25); border-color: rgba(200,120,0,0.5); color: #f0c070; }
    .${CSS_NS}-atmosphere-badge.madness { background: rgba(140,60,180,0.25); border-color: rgba(140,60,180,0.5); color: #d0a0e8; }
    .${CSS_NS}-atmosphere-badge.death { background: rgba(60,60,60,0.4); border-color: rgba(80,80,80,0.6); color: #a0a0a0; }
    .${CSS_NS}-atmosphere-badge.mystery { background: rgba(60,80,180,0.25); border-color: rgba(60,80,180,0.5); color: #a0b0e8; }
    .${CSS_NS}-atmosphere-badge.tense { background: rgba(180,160,40,0.25); border-color: rgba(180,160,40,0.5); color: #e8e0a0; }
    .${CSS_NS}-description { color: var(--SmartThemeEmColor); line-height: 1.7; font-size: 0.95rem; }
    .${CSS_NS}-para { margin: 0 0 0.6rem; }
    .${CSS_NS}-para:last-child { margin-bottom: 0; }
    .${CSS_NS}-meta { margin-top: 0.75rem; }
    .${CSS_NS}-tags { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .${CSS_NS}-tag {
      display: inline-block; padding: 0.15rem 0.5rem; border-radius: 3px;
      font-size: 0.75rem; background: rgba(128,128,128,0.15);
      color: var(--SmartThemeEmColor); border: 1px solid var(--SmartThemeBorderColor);
    }
    .${CSS_NS}-interactables { margin-top: 0.75rem; }
    .${CSS_NS}-interact-title { font-size: 0.85rem; color: var(--SmartThemeBodyColor); margin-bottom: 0.3rem; opacity: 0.8; }
    .${CSS_NS}-interact-list { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .${CSS_NS}-interact-btn {
      background: rgba(128,128,128,0.15); border: 1px solid var(--SmartThemeBorderColor);
      color: var(--SmartThemeBodyColor); padding: 0.3rem 0.7rem; border-radius: 4px;
      font-size: 0.8rem; cursor: pointer; transition: all 0.2s ease;
    }
    .${CSS_NS}-interact-btn:hover {
      background: rgba(128,128,128,0.3); border-color: var(--SmartThemeQuoteColor);
      transform: translateY(-1px);
    }
    .${CSS_NS}-atmosphere {
      position: absolute; inset: 0; z-index: 0; opacity: 0; pointer-events: none;
      transition: opacity 0.6s ease;
    }
    .${CSS_NS}-atmosphere.calm { opacity: 0.02; background: radial-gradient(circle at 50% 50%, rgba(100,120,160,0.3), transparent 70%); }
    .${CSS_NS}-atmosphere.tense { opacity: 0.04; background: radial-gradient(circle at 50% 50%, rgba(180,160,40,0.4), transparent 70%); animation: agm-pulse 3s ease-in-out infinite; }
    .${CSS_NS}-atmosphere.horror { opacity: 0.05; background: radial-gradient(circle at 50% 50%, rgba(180,40,40,0.5), transparent 70%); animation: agm-pulse 2s ease-in-out infinite; }
    .${CSS_NS}-atmosphere.combat { opacity: 0.04; background: radial-gradient(circle at 50% 50%, rgba(200,120,0,0.5), transparent 70%); animation: agm-pulse 1.5s ease-in-out infinite; }
    .${CSS_NS}-atmosphere.madness { opacity: 0.05; background: radial-gradient(circle at 50% 50%, rgba(140,60,180,0.5), transparent 70%); animation: agm-spin 10s linear infinite; }
    .${CSS_NS}-atmosphere.death { opacity: 0.06; background: radial-gradient(circle at 50% 50%, rgba(40,40,40,0.8), transparent 70%); }
    .${CSS_NS}-atmosphere.mystery { opacity: 0.03; background: radial-gradient(circle at 50% 50%, rgba(60,80,180,0.4), transparent 70%); animation: agm-pulse 4s ease-in-out infinite; }
    @keyframes agm-pulse { 0%,100% { opacity: 0.03; } 50% { opacity: 0.06; } }
    @keyframes agm-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .${CSS_NS}-description.typewriter .${CSS_NS}-para {
      overflow: hidden; border-right: 2px solid var(--SmartThemeQuoteColor);
      white-space: nowrap; animation: agm-typing 2s steps(40, end) forwards, agm-blink-caret 0.75s step-end infinite;
    }
    @keyframes agm-typing { from { width: 0; } to { width: 100%; } }
    @keyframes agm-blink-caret { from, to { border-color: transparent; } 50% { border-color: var(--SmartThemeQuoteColor); } }
  `;
  (root.getRootNode() || document.head).appendChild(style);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

/* ---------- exports ---------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initSceneRenderer, renderScene, setAtmosphere, toggleTypewriter, ATMOSPHERE_MAP };
}
window.AiGmScene = { initSceneRenderer, renderScene, setAtmosphere, toggleTypewriter, ATMOSPHERE_MAP };
