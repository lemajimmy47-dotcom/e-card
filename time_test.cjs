const { fetchFullStateFromDB } = require('./dist/server.cjs');
async function run() {
  console.time("fetchFullStateFromDB");
  await fetchFullStateFromDB();
  console.timeEnd("fetchFullStateFromDB");
}
run();
