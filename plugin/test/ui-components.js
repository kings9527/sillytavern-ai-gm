/**
 * UI Component Tests — Phase 3 Surface
 * Test: cd plugin && node test/ui-components.js
 */

import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Setup JSDOM
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
  runScripts: 'dangerously',
  url: 'http://localhost',
});
global.dom = dom;
global.window = dom.window;
global.document = dom.window.document;
global.CustomEvent = dom.window.CustomEvent;
global.CSS = dom.window.CSS;

import { createContext, runInContext } from 'vm';

// Load modules into fresh VM contexts (avoids const redeclaration)
const sceneCode = readFileSync(join(__dirname, '../ui/scene-renderer.js'), 'utf-8');
const npcCode = readFileSync(join(__dirname, '../ui/npc-card.js'), 'utf-8');

// Polyfill CSS.escape for JSDOM
if (!dom.window.CSS) dom.window.CSS = {};
if (!dom.window.CSS.escape) {
  dom.window.CSS.escape = (s) => s.replace(/[^a-zA-Z0-9-_]/g, '\\$&');
}
dom.window.Node.prototype._origGetRootNode = dom.window.Node.prototype.getRootNode;
dom.window.Node.prototype.getRootNode = function() {
  return dom.window.document.head;
};

function evalScript(code) {
  const ctx = createContext({
    window: dom.window,
    document: dom.window.document,
    CSS: dom.window.CSS,
    CustomEvent: dom.window.CustomEvent,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
  });
  runInContext(code, ctx, { timeout: 5000 });
  return ctx.window;
}

const sceneWindow = evalScript(sceneCode);
const sceneModule = sceneWindow.AiGmScene;

const npcWindow = evalScript(npcCode);
const npcModule = npcWindow.AiGmNpc;

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

console.log('=== AI-GM UI Component Tests ===\n');

// Scene Renderer Tests
console.log('--- Scene Renderer ---');
const { initSceneRenderer, renderScene, setAtmosphere, toggleTypewriter, ATMOSPHERE_MAP } = sceneModule;

test('Scene renderer exports all functions', () => {
  assert(typeof initSceneRenderer === 'function', 'initSceneRenderer should be a function');
  assert(typeof renderScene === 'function', 'renderScene should be a function');
  assert(typeof setAtmosphere === 'function', 'setAtmosphere should be a function');
  assert(typeof toggleTypewriter === 'function', 'toggleTypewriter should be a function');
});

test('ATMOSPHERE_MAP has all expected moods', () => {
  const expected = ['calm', 'tense', 'horror', 'combat', 'madness', 'mystery', 'death'];
  expected.forEach(key => {
    assert(ATMOSPHERE_MAP[key], `Expected atmosphere ${key} to exist`);
    assert(ATMOSPHERE_MAP[key].icon, `Expected ${key} to have an icon`);
    assert(ATMOSPHERE_MAP[key].label, `Expected ${key} to have a label`);
  });
});

test('initSceneRenderer creates DOM structure', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  initSceneRenderer(container);
  
  const wrapper = container.querySelector('.ai-gm-scene-wrapper');
  assert(wrapper, 'Should create wrapper');
  
  const title = document.getElementById('agm-scene-title');
  assert(title, 'Should create title element');
  
  const desc = document.getElementById('agm-scene-desc');
  assert(desc, 'Should create description element');
  
  const meta = document.getElementById('agm-scene-meta');
  assert(meta, 'Should create meta element');
  document.body.removeChild(container);
});

test('renderScene populates scene data', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  initSceneRenderer(container);
  
  const scene = {
    id: 'test_scene',
    title: 'Test Scene',
    description: 'A test scene description',
    atmosphere: 'horror',
    world_info_keys: ['test', 'horror'],
    interactables: ['door', 'book'],
  };
  
  renderScene(scene);
  
  const titleEl = document.getElementById('agm-scene-title');
  assert(titleEl.textContent === 'Test Scene', 'Title should match');
  
  const descEl = document.getElementById('agm-scene-desc');
  assert(descEl.innerHTML.includes('A test scene description'), 'Description should contain text');
  
  const badge = document.getElementById('agm-atm-badge');
  assert(badge.innerHTML.includes('恐惧'), 'Badge should show horror label');
  document.body.removeChild(container);
});

test('renderScene handles paragraphs', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  initSceneRenderer(container);
  
  const scene = {
    id: 'p_test',
    title: 'Paragraph Test',
    description: 'First paragraph.\n\nSecond paragraph.',
    atmosphere: 'calm',
  };
  
  renderScene(scene);
  const descEl = document.getElementById('agm-scene-desc');
  const paras = descEl.querySelectorAll('.ai-gm-scene-para');
  assert(paras.length === 2, `Expected 2 paragraphs, got ${paras.length}`);
  document.body.removeChild(container);
});

test('setAtmosphere updates atmosphere classes', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  initSceneRenderer(container);
  
  setAtmosphere('combat');
  const atmEl = document.getElementById('agm-atmosphere');
  assert(atmEl.classList.contains('combat'), 'Atmosphere should be combat');
  
  const badge = document.getElementById('agm-atm-badge');
  assert(badge.innerHTML.includes('战斗'), 'Badge should show combat label');
  document.body.removeChild(container);
});

test('toggleTypewriter adds/removes class', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  initSceneRenderer(container);
  
  toggleTypewriter(true);
  const descEl = document.getElementById('agm-scene-desc');
  assert(descEl.classList.contains('typewriter'), 'Should add typewriter class');
  
  toggleTypewriter(false);
  assert(!descEl.classList.contains('typewriter'), 'Should remove typewriter class');
  document.body.removeChild(container);
});

test('renderScene dispatches atmosphere-change event', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  initSceneRenderer(container);
  
  let eventFired = false;
  let eventDetail = null;
  
  document.addEventListener('ai-gm:atmosphere-change', (e) => {
    eventFired = true;
    eventDetail = e.detail;
  }, { once: true });
  
  renderScene({ id: 'evt', title: 'Event', description: 'Test', atmosphere: 'madness' });
  
  assert(eventFired, 'Should dispatch atmosphere-change event');
  assert(eventDetail.atmosphere === 'madness', 'Event should include atmosphere');
  assert(eventDetail.sceneId === 'evt', 'Event should include sceneId');
  document.body.removeChild(container);
});

// NPC Card Tests
console.log('\n--- NPC Cards ---');
const { initNpcContainer, renderNpcs, updateNpcState, ATTITUDE_ICON, ATTITUDE_COLOR } = npcModule;

test('NPC module exports all functions', () => {
  assert(typeof initNpcContainer === 'function', 'initNpcContainer should be a function');
  assert(typeof renderNpcs === 'function', 'renderNpcs should be a function');
  assert(typeof updateNpcState === 'function', 'updateNpcState should be a function');
});

test('ATTITUDE_ICON has all expected attitudes', () => {
  const expected = ['friendly', 'neutral', 'hostile', 'fearful', 'mysterious', 'dead', 'insane', 'unknown'];
  expected.forEach(key => {
    assert(ATTITUDE_ICON[key], `Expected attitude icon ${key} to exist`);
  });
});

test('ATTITUDE_COLOR has all expected attitudes', () => {
  const expected = ['friendly', 'neutral', 'hostile', 'fearful', 'mysterious', 'dead', 'insane', 'unknown'];
  expected.forEach(key => {
    assert(ATTITUDE_COLOR[key], `Expected attitude color ${key} to exist`);
  });
});

test('initNpcContainer creates DOM structure', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  initNpcContainer(container);
  
  const grid = document.getElementById('agm-npc-grid');
  assert(grid, 'Should create NPC grid');
  
  const count = document.getElementById('agm-npc-count');
  assert(count, 'Should create count element');
  document.body.removeChild(container);
});

test('renderNpcs renders NPC cards with correct data', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  initNpcContainer(container);
  
  const npcs = [
    {
      id: 'npc_1',
      name: 'Armitage',
      attitude: 'friendly',
      currentHp: 8,
      maxHp: 10,
      currentSan: 50,
      maxSan: 60,
      statusEffects: ['blessed'],
      location: 'Library',
      memorySummary: 'Met in the library.',
      isHostile: false,
    },
    {
      id: 'npc_2',
      name: 'Cultist',
      attitude: 'hostile',
      currentHp: 3,
      maxHp: 10,
      currentSan: 10,
      maxSan: 30,
      isHostile: true,
    },
  ];
  
  renderNpcs(npcs);
  
  const grid = document.getElementById('agm-npc-grid');
  const cards = grid.querySelectorAll('.ai-gm-npc-card');
  assert(cards.length === 2, `Expected 2 cards, got ${cards.length}`);
  
  const count = document.getElementById('agm-npc-count');
  assert(count.textContent === '2', 'Count should be 2');
  
  // Check first card
  const firstCard = cards[0];
  assert(firstCard.dataset.npcId === 'npc_1', 'Card should have npc_1 id');
  assert(firstCard.innerHTML.includes('Armitage'), 'Card should contain name');
  assert(firstCard.innerHTML.includes('blessed'), 'Card should contain status effect');
  assert(firstCard.innerHTML.includes('Library'), 'Card should contain location');
  
  // Check hostile card has attack button
  const secondCard = cards[1];
  assert(secondCard.querySelector('.hostile'), 'Hostile card should have attack button');
  
  // Check HP bar
  const hpBar = firstCard.querySelector('.ai-gm-npc-hp');
  assert(hpBar.style.width === '80%', 'HP bar should be 80%');
  document.body.removeChild(container);
});

test('renderNpcs shows empty state for empty array', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  initNpcContainer(container);
  
  renderNpcs([]);
  const grid = document.getElementById('agm-npc-grid');
  assert(grid.innerHTML.includes('无人生还'), 'Should show empty message');
  
  const count = document.getElementById('agm-npc-count');
  assert(count.textContent === '0', 'Count should be 0');
  document.body.removeChild(container);
});

test('renderNpcs handles dead NPC', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  initNpcContainer(container);
  
  renderNpcs([{
    id: 'dead_npc',
    name: 'Dead Guy',
    attitude: 'dead',
    currentHp: 0,
    maxHp: 10,
    currentSan: 0,
    maxSan: 30,
  }]);
  
  const grid = document.getElementById('agm-npc-grid');
  const card = grid.querySelector('.ai-gm-npc-card');
  assert(card.classList.contains('dead'), 'Dead NPC should have dead class');
  assert(card.innerHTML.includes('💀'), 'Dead NPC should have skull icon');
  document.body.removeChild(container);
});

test('updateNpcState updates individual NPC without full re-render', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  initNpcContainer(container);
  
  renderNpcs([{
    id: 'npc_test',
    name: 'Test',
    attitude: 'neutral',
    currentHp: 10,
    maxHp: 10,
    currentSan: 50,
    maxSan: 50,
  }]);
  
  const result = updateNpcState('npc_test', {
    attitude: 'hostile',
    currentHp: 2,
    maxHp: 10,
    currentSan: 10,
    maxSan: 50,
    statusEffects: ['poisoned'],
  });
  
  assert(result === true, 'updateNpcState should return true for existing NPC');
  
  const grid = document.getElementById('agm-npc-grid');
  const card = grid.querySelector('[data-npc-id="npc_test"]');
  
  // Check attitude updated
  const attitudeEl = card.querySelector('.ai-gm-npc-attitude');
  assert(attitudeEl.textContent === '👿', 'Attitude should be hostile icon');
  
  // Check HP bar updated
  const hpBar = card.querySelector('.ai-gm-npc-hp');
  assert(hpBar.style.width === '20%', 'HP bar should be 20%');
  
  // Check critical class added (20% <= 25%)
  assert(card.classList.contains('critical'), 'Card should have critical class for low HP');
  
  // Check SAN bar updated
  const sanBar = card.querySelector('.ai-gm-npc-san');
  assert(sanBar.style.width === '20%', 'SAN bar should be 20%');
  
  // Check status effect
  assert(card.innerHTML.includes('poisoned'), 'Should show poisoned effect');
  document.body.removeChild(container);
});

test('updateNpcState returns false for non-existent NPC', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  initNpcContainer(container);
  renderNpcs([{ id: 'dummy', name: 'D', attitude: 'neutral', currentHp: 1, maxHp: 1, currentSan: 1, maxSan: 1 }]);
  const result = updateNpcState('nonexistent', { attitude: 'hostile' });
  assert(result === false, 'Should return false for non-existent NPC');
  document.body.removeChild(container);
});

test('NPC card dispatches select and action events', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  initNpcContainer(container);
  
  renderNpcs([{
    id: 'evt_npc',
    name: 'Event Test',
    attitude: 'hostile',
    currentHp: 10,
    maxHp: 10,
    currentSan: 50,
    maxSan: 50,
    isHostile: true,
  }]);
  
  let selectEvent = null;
  let actionEvent = null;
  
  document.addEventListener('ai-gm:npc-select', (e) => {
    selectEvent = e.detail;
  }, { once: true });
  
  document.addEventListener('ai-gm:npc-action', (e) => {
    actionEvent = e.detail;
  }, { once: true });
  
  const card = container.querySelector('[data-npc-id="evt_npc"]');
  card.click();
  
  assert(selectEvent !== null, 'Should dispatch npc-select event');
  assert(selectEvent.npcId === 'evt_npc', 'Event should include npcId');
  
  const attackBtn = document.querySelector('[data-action="attack"]');
  assert(attackBtn !== null, 'Attack button should exist');
  attackBtn.click();
  
  assert(actionEvent !== null, 'Should dispatch npc-action event');
  assert(actionEvent.npcId === 'evt_npc', 'Action event should include npcId');
  assert(actionEvent.action === 'attack', 'Action event should include action type');
  document.body.removeChild(container);
});

// Summary
console.log('\n=== Test Summary ===');
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Total:  ${passCount + failCount}`);

if (failCount > 0) {
  process.exit(1);
}
console.log('\nAll UI component tests passed! ✅');
