import { fetchFullStateFromDB } from './src/db/cloudsql-core.ts';
async function run() {
  const state = await fetchFullStateFromDB();
  console.log("Total events:", state.eventsList?.length);
  for (const e of state.eventsList || []) {
    console.log(`Event ${e.name}: id=${e.id}`);
  }
}
run().then(() => process.exit(0)).catch(console.error);
