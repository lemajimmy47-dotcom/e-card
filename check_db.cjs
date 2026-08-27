const fs = require('fs');
let data = fs.readFileSync('database.json', 'utf8');
console.log("Length:", data.length);
console.log("Last 100 chars:", data.substring(data.length - 100));
