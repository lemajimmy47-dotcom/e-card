const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf-8');
const lines = content.split('\n');
let braces = 0;
for (let i = 1990; i <= 2110; i++) {
  const line = lines[i];
  if (!line) continue;
  const open = (line.match(/\{/g) || []).length;
  const close = (line.match(/\}/g) || []).length;
  braces += open - close;
  if (open > 0 || close > 0) {
    console.log(`${i+1}: ${line.trim()} | open: ${open}, close: ${close}, total: ${braces}`);
  }
}
