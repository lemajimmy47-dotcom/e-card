import fs from "fs";

if (fs.existsSync("user-backup.json")) {
  const data = JSON.parse(fs.readFileSync("user-backup.json", "utf-8"));
  console.log("Keys in user-backup.json:", Object.keys(data));
  console.log("activeEvent in user-backup.json:", JSON.stringify(data.activeEvent, null, 2));
} else {
  console.log("user-backup.json does not exist");
}
