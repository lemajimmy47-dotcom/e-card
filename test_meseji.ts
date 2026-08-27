
import fetch from 'node-fetch';

const apiKey = 'zs_0e48ae894d0a6a379717f7f68095928c2c84243cc181b9fe';
const url = 'https://meseji.co.tz/api/v1/sms/send';

const tests = [
  { sender_id: 'MESEJI', contacts: '255622443249', message: 'Test 1' },
  { sender_id: 'MESEJI', contacts: '+255622443249', message: 'Test 2' },
  { sender_id: 'MESEJI', contacts: '0622443249', message: 'Test 3' },
  { sender_id: 'EVENT CARD', contacts: '255622443249', message: 'Test 4' },
  { sender_id: 'MESEJI', contacts: '255622443249,', message: 'Test 5' },
];

async function run() {
  for (const test of tests) {
    console.log(`Testing: ${JSON.stringify(test)}`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'Accept': 'application/json'
        },
        body: JSON.stringify(test)
      });
      const data = await res.json();
      console.log(`Status: ${res.status}, Result: ${JSON.stringify(data)}`);
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
    console.log('---');
  }
}

run();
