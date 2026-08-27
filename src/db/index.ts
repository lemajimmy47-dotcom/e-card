import { config } from "dotenv";
config({ override: true });
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const host = process.env.SQL_HOST;
    const user = process.env.SQL_USER;
    const password = process.env.SQL_PASSWORD;
    const database = process.env.SQL_DB_NAME;

    if (host && user && password) {
      console.log(`[Database] Connecting to Cloud SQL at ${host} as ${user} (DB: ${database || "postgres"})`);
      global._postgresPool = new Pool({
        host,
        user,
        password,
        database: database || "postgres",
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    } else {
      const databaseUrl = process.env.DATABASE_URL || process.env.SQL_DATABASE_URL;
      if (databaseUrl) {
        console.log("[Database] Connecting using connection string (DATABASE_URL)...");
        const isLocal = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
        global._postgresPool = new Pool({
          connectionString: databaseUrl,
          ssl: isLocal ? false : { rejectUnauthorized: false },
          max: 10,
          connectionTimeoutMillis: 15000,
        });
      } else {
        console.warn("[Database] Both SQL_HOST and DATABASE_URL are missing.");
        global._postgresPool = new Pool({
          connectionTimeoutMillis: 5000,
        });
      }
    }

    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }

  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
export { schema };

