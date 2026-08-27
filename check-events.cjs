const fs = require('fs');
const dbPath = './database.json';
const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
console.log("Events count:", dbData.eventsList ? dbData.eventsList.length : 0);
if (dbData.eventsList) {
  dbData.eventsList.forEach(e => console.log(e.id, e.name));
}
