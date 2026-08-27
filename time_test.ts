import fetch from 'node-fetch';

async function testMeseji() {
  const apiKey = "zs_0e48ae894d0a6a379717f7f68095928c2c84243cc181b9fe";
  console.log("Checking Meseji Balance...");
  try {
    const res = await fetch("https://meseji.co.tz/api/v1/sms/balance", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "Accept": "application/json"
      }
    });
    console.log("Balance status:", res.status);
    console.log("Balance response text:", await res.text());
  } catch (err: any) {
    console.error("Balance fetch error:", err.message);
  }
}

testMeseji();
