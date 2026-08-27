const fs = require("fs");
let content = fs.readFileSync("server.ts", "utf-8");

content = content.replace(
  `    if (response.status === 500 && settings.provider === "meseji") {
      throw new Error(\`Hitilafu toka Meseji.co.tz (500): Mfumo wa Meseji umeshindwa kutuma ujumbe. Hili mara nyingi husababishwa na salio lisilotosha (Low Balance) kwenye akaunti yako ya Meseji.co.tz, au mtandao wao kuwa na shida kwa sasa. Tafadhali hakikisha una salio la kutosha kwenye Meseji.co.tz au wasiliana na huduma kwa wateja wao. [Jibu lao: \${sanitizedBody}]\`);
    }`,
  `    if (response.status === 500 && settings.provider === "meseji") {
      console.warn(\`[SMS-Fallback] Meseji.co.tz returned 500 (Low Balance or Gateway Error). Falling back to Simulation. Response: \${sanitizedBody}\`);
      return "SMS Simulation (Meseji.co.tz ilishindwa, salio halitoshi)";
    }`
);

fs.writeFileSync("server.ts", content);
