import { fetchFullStateFromDB } from './src/db/cloudsql-core.ts';
async function run() {
  const state = await fetchFullStateFromDB();
  console.log("Settings:");
  console.log(state.smsGatewaySettings);
}
run().then(() => process.exit(0)).catch(console.error);
