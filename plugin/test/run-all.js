/**
 * Test Runner - Runs all test suites under c8 coverage
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const tests = [
  'index.js',
  'intent-parser.test.js',
  'intent-parser-edge.test.js',
  'prompt-builder.test.js',
  'extension-mount.js',
  'ui-integration.js',
  'campaign-storage.test.js',
  'npc-decision-advanced.test.js',
  'extension-lifecycle.test.js',
];

let totalPass = 0;
let totalFail = 0;
let failedSuites = [];

for (const testFile of tests) {
  const testPath = join(__dirname, testFile);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Running: ${testFile}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  try {
    execSync(`node "${testPath}"`, { stdio: 'inherit', cwd: join(__dirname, '..') });
    totalPass++;
  } catch (e) {
    totalFail++;
    failedSuites.push(testFile);
  }
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`           ALL TEST SUITES SUMMARY        `);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Passed: ${totalPass}`);
console.log(`Failed: ${totalFail}`);
if (failedSuites.length > 0) {
  console.log(`Failed suites: ${failedSuites.join(', ')}`);
  process.exit(1);
} else {
  console.log('All test suites passed!');
  process.exit(0);
}
