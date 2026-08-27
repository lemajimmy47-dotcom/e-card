const fs = require('fs');

const dbPath = './database.json';
const backupPath = './user-backup.json';

const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

if (backupData.activeEvent) {
  const isPresent = dbData.eventsList.some(e => e.id === backupData.activeEvent.id);
  if (!isPresent) {
    dbData.eventsList.push(backupData.activeEvent);
    console.log("Restored event:", backupData.activeEvent.name);
  } else {
    console.log("Event already present:", backupData.activeEvent.name);
  }
}

fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
