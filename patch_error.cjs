const fs = require("fs");
let content = fs.readFileSync("server.ts", "utf-8");
content = content.replace(
  "throw new Error(`Mtoa huduma alirejesha hitilafu (${response.status}) - ${sanitizedBody}`);",
  `if (response.status === 500 && settings.provider === "meseji") {
      throw new Error(\`Hitilafu toka Meseji.co.tz (500): Mfumo wa Meseji umeshindwa kutuma ujumbe. Hili mara nyingi husababishwa na salio lisilotosha (Low Balance) kwenye akaunti yako ya Meseji.co.tz, au mtandao wao kuwa na shida kwa sasa. Tafadhali hakikisha una salio la kutosha kwenye Meseji.co.tz au wasiliana na huduma kwa wateja wao. [Jibu lao: \${sanitizedBody}]\`);
    }
    
    throw new Error(\`Mtoa huduma alirejesha hitilafu (\${response.status}) - \${sanitizedBody}\`);`
);
fs.writeFileSync("server.ts", content);
