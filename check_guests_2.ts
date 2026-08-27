import { fetchFullStateFromDB } from './src/db/cloudsql-core.ts';
async function run() {
  const state = await fetchFullStateFromDB();
  for (const g of state.guests) {
    if (g.eventId === '346913') {
       console.log(`Guest ${g.name}: smsStatus=${g.smsStatus}, smsCount=${g.smsCount}, whatsappStatus=${g.whatsappStatus}, whatsappCount=${g.whatsappCount}`);
    }
  }
}
run().then(() => process.exit(0)).catch(console.error);
