import { fetchFullStateFromDB, syncStateToRelationalDB } from './src/db/cloudsql-core.ts';
async function run() {
  console.log("fetching...");
  const state = await fetchFullStateFromDB();
  console.log("syncing...");
  console.time("syncStateToRelationalDB");
  await syncStateToRelationalDB(state);
  console.timeEnd("syncStateToRelationalDB");
}
run().then(() => process.exit(0)).catch(console.error);
