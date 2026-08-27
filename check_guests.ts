import { fetchFullStateFromDB } from './src/db/cloudsql-core.ts';
async function run() {
  const state = await fetchFullStateFromDB();
  console.log("Total guests:", state.guests.length);
  for (const g of state.guests) {
    console.log(`Guest ${g.name}: smsStatus=${g.smsStatus}, smsCount=${g.smsCount}, whatsappStatus=${g.whatsappStatus}, whatsappCount=${g.whatsappCount}`);
  }
}
run().then(() => process.exit(0)).catch(console.error);
