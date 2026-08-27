const fs = require("fs");
let content = fs.readFileSync("server.ts", "utf-8");

content = content.replace(
  "console.warn(`[SMS-Fallback] Meseji.co.tz returned 500 (Low Balance or Gateway Error). Falling back to Simulation. Response: ${sanitizedBody}`);",
  "console.log(`[SMS-Fallback] Meseji.co.tz returned 500 (Low Balance or Gateway Error). Falling back to Simulation. Response: ${sanitizedBody}`);"
);

fs.writeFileSync("server.ts", content);
