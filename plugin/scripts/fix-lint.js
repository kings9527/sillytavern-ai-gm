#!/usr/bin/env node
// Auto-fix no-unused-vars by prefixing unused args with _ and removing unused declared vars
// Must be run from plugin root

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const eslintJson = JSON.parse(
  execSync('npx eslint . --ext .js,.jsx --format json 2>/dev/null', { encoding: 'utf8', cwd: process.cwd() })
);

let fixCount = 0;

for (const result of eslintJson) {
  const filePath = result.filePath;
  const messages = result.messages.filter(m => m.ruleId === 'no-unused-vars' || m.ruleId === 'prefer-const');
  if (!messages.length) continue;

  let lines = fs.readFileSync(filePath, 'utf8').split('\n');

  // Process from bottom to top to preserve line numbers
  messages.sort((a, b) => b.line - a.line || b.column - a.column);

  for (const msg of messages) {
    const lineIdx = msg.line - 1;
    const lineText = lines[lineIdx];

    if (msg.ruleId === 'prefer-const') {
      // Replace 'let' with 'const' for that variable
      const regex = /\blet\b/;
      if (regex.test(lineText)) {
        lines[lineIdx] = lineText.replace(regex, 'const');
        fixCount++;
      }
      continue;
    }

    // no-unused-vars
    const text = msg.message;

    if (text.includes("' is defined but never used. Allowed unused args must match /^_/u")) {
      // Extract variable name: e.g. "'campaign' is defined..."
      const match = text.match(/'([^']+)' is defined/);
      if (!match) continue;
      const varName = match[1];

      // This is a function parameter, prefix with _
      // Replace the exact word at the position
      const col = msg.column - 1;
      // Check if it starts at this column or earlier (param may be after ( or ,)
      // Simple approach: replace whole-word occurrences in the line (first if ambiguous)
      const regex = new RegExp(`\\b${varName}\\b`, 'g');
      const indices = [];
      let m;
      while ((m = regex.exec(lineText)) !== null) {
        indices.push(m.index);
      }
      // Pick the one closest to the column
      let targetIdx = indices[0] ?? -1;
      if (indices.length > 1) {
        const closest = indices.reduce((a, b) =>
          Math.abs(b - col) < Math.abs(a - col) ? b : a
        );
        targetIdx = closest;
      }
      if (targetIdx !== -1) {
        lines[lineIdx] = lineText.substring(0, targetIdx) + '_' + varName + lineText.substring(targetIdx + varName.length);
        fixCount++;
      }
    } else if (text.includes("' is assigned a value but never used. Allowed unused vars must match /^_/u")) {
      // Extract variable name
      const match = text.match(/'([^']+)' is assigned/);
      if (!match) continue;
      const varName = match[1];
      // Remove the declaration: e.g. "let result = ...;" or "const result = ...;" or "const result;"
      // Remove the whole statement if it's a simple assignment
      const declRegex = new RegExp(`(\\s*)(const|let|var)\\s+${varName}\\s*(?:=\\s*[^;]*)?;?\\s*$`, 'i');
      if (declRegex.test(lineText)) {
        lines[lineIdx] = lineText.replace(declRegex, '');
        fixCount++;
      } else {
        // It might be part of a destructuring or multiple declarations; just rename to _varName
        const regex = new RegExp(`\\b${varName}\\b`, 'g');
        const indices = [];
        let m;
        while ((m = regex.exec(lineText)) !== null) {
          indices.push(m.index);
        }
        let targetIdx = indices[0] ?? -1;
        if (indices.length > 1) {
          const closest = indices.reduce((a, b) =>
            Math.abs(b - (msg.column - 1)) < Math.abs(a - (msg.column - 1)) ? b : a
          );
          targetIdx = closest;
        }
        if (targetIdx !== -1) {
          lines[lineIdx] = lineText.substring(0, targetIdx) + '_' + varName + lineText.substring(targetIdx + varName.length);
          fixCount++;
        }
      }
    }
  }

  // Remove any trailing whitespace-only lines that became empty (avoid removing meaningful empty lines if we want)
  // Clean up: if a line became just empty string, keep it as is for now
  fs.writeFileSync(filePath, lines.join('\n'));
}

console.log(`Fixed ${fixCount} issues.`);
