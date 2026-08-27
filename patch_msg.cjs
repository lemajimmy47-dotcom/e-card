const fs = require("fs");
let content = fs.readFileSync("server.ts", "utf-8");

content = content.replace(
  "return \"SMS Simulation (Meseji.co.tz ilishindwa, salio halitoshi)\";",
  "return \"SMS Simulation (Mtandao wa Meseji.co.tz unasumbua / upo chini kwa sasa)\";"
);

fs.writeFileSync("server.ts", content);
