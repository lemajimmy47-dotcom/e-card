const fs = require('fs');
let data = fs.readFileSync('user-backup.json', 'utf8');
console.log("Length:", data.length);
console.log("Last 100 chars:", data.substring(data.length - 100));
try {
  JSON.parse(data);
  console.log("user-backup.json is valid JSON.");
} catch(e) {
  console.log("user-backup.json is INVALID JSON.", e.message);
}
