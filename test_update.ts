import { fetchFullStateFromDB, syncStateToRelationalDB } from './src/db/cloudsql-core.ts';

async function run() {
  const state = await fetchFullStateFromDB();
  const targetGuest = state.guests[0];
  console.log(`Before update: smsStatus=${targetGuest.smsStatus}`);
  
  targetGuest.smsStatus = 'Imetumia';
  await syncStateToRelationalDB(state);
  
  const state2 = await fetchFullStateFromDB();
  const targetGuest2 = state2.guests.find((g: any) => g.id === targetGuest.id);
  console.log(`After update: smsStatus=${targetGuest2.smsStatus}`);
}

run().then(() => process.exit(0)).catch(console.error);
