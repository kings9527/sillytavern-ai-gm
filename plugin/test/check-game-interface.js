#!/usr/bin/env node
/**
 * Quick syntax check for game-interface.html JS content
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '../ui/game-interface.html'), 'utf-8');

// Extract JS between script tags
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) {
  console.error('No script tag found');
  process.exit(1);
}

const js = match[1];

// Write to temp file and check
import { tmpdir } from 'os';
import { writeFileSync, unlinkSync } from 'fs';

const tmp = join(tmpdir(), 'game-interface-check.js');
writeFileSync(tmp, js);

import { execSync } from 'child_process';

try {
  execSync(`node -c ${tmp}`, { stdio: 'inherit' });
  console.log('game-interface.html JS syntax OK');
  unlinkSync(tmp);
} catch (e) {
  unlinkSync(tmp);
  process.exit(1);
}
