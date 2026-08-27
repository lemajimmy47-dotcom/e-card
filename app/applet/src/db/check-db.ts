import { db } from "./index";
import { sql } from "drizzle-orm";

async function check() {
  try {
    const res = await db.execute(sql`SELECT * FROM template_settings LIMIT 1;`);
    console.log('Query result:', res);
  } catch(e) {
    console.error('Error:', e);
  }
}
check();
