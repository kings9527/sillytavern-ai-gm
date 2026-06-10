/**
 * Game Interface HTML Test — Phase 3 Surface
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '../ui/game-interface.html'), 'utf-8');

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

console.log('=== AI-GM Game Interface Tests ===\n');

test('HTML file contains all major sections', () => {
  assert(html.includes('id="ai-gm-game"'), 'Should have game container');
  assert(html.includes('id="agm-game-scene-container"'), 'Should have scene container');
  assert(html.includes('id="agm-game-npc-container"'), 'Should have NPC container');
  assert(html.includes('id="agm-player-name"'), 'Should have player name');
  assert(html.includes('id="agm-exit-buttons"'), 'Should have exit buttons');
  assert(html.includes('id="agm-interact-list"'), 'Should have interact list');
  assert(html.includes('id="agm-log-entries"'), 'Should have log entries');
  assert(html.includes('id="agm-custom-input"'), 'Should have custom input');
});

test('HTML contains embedded script with GameInterfaceController', () => {
  assert(html.includes('class GameInterfaceController'), 'Should define GameInterfaceController class');
  assert(html.includes('initSubRenderers'), 'Should have initSubRenderers method');
  assert(html.includes('updateState'), 'Should have updateState method');
  assert(html.includes('loadCampaign'), 'Should have loadCampaign method');
});

test('HTML contains embedded CSS with responsive rules', () => {
  assert(html.includes('@media (max-width: 768px)'), 'Should have responsive media query');
  assert(html.includes('.ai-gm-game-action-grid'), 'Should have action grid styles');
});

// Parse with JSDOM to test DOM structure
const dom = new JSDOM(html, { runScripts: 'dangerously' });
const doc = dom.window.document;

test('DOM structure contains all panels', () => {
  const game = doc.getElementById('ai-gm-game');
  assert(game, 'Should have game root');
  
  assert(doc.getElementById('agm-game-scene-container'), 'Should find scene container in DOM');
  assert(doc.getElementById('agm-game-npc-container'), 'Should find NPC container in DOM');
  assert(doc.getElementById('agm-player-hp-bar'), 'Should find HP bar in DOM');
  assert(doc.getElementById('agm-player-san-bar'), 'Should find SAN bar in DOM');
  assert(doc.getElementById('agm-player-mp-bar'), 'Should find MP bar in DOM');
  assert(doc.getElementById('agm-exit-buttons'), 'Should find exit buttons in DOM');
  assert(doc.getElementById('agm-interact-list'), 'Should find interact list in DOM');
  assert(doc.getElementById('agm-log-entries'), 'Should find log entries in DOM');
  assert(doc.getElementById('agm-custom-input'), 'Should find custom input in DOM');
  
  const actionBtns = doc.querySelectorAll('.ai-gm-game-action-btn');
  assert(actionBtns.length === 8, `Should have 8 action buttons, got ${actionBtns.length}`);
});

test('GameInterfaceController class is defined in script content', () => {
  const scripts = doc.querySelectorAll('script');
  assert(scripts.length > 0, 'Should have at least one script tag');
  const scriptText = scripts[0].textContent;
  assert(scriptText.includes('class GameInterfaceController'), 'Script should contain GameInterfaceController class');
  assert(scriptText.includes('window.AiGmGameInterface'), 'Script should expose to window');
});

// Summary
console.log('\n=== Test Summary ===');
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Total:  ${passCount + failCount}`);

if (failCount > 0) {
  process.exit(1);
}
console.log('\nGame interface tests passed! ✅');
