import { config } from "dotenv";
config({ override: true });
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

export const createPool = () => {
  const databaseUrl = process.env.DATABASE_URL || process.env.SQL_DATABASE_URL;

  if (databaseUrl) {
    console.log("[Database] Connecting using connection string (DATABASE_URL)...");
    const isLocal = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
    return new Pool({
      connectionString: databaseUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      max: 15,
      keepAlive: true,
    });
  }

  const host = process.env.SQL_HOST;
  const user = process.env.SQL_USER;
  const password = process.env.SQL_PASSWORD;
  const database = process.env.SQL_DB_NAME;

  if (host) {
    console.log(`[Database] Connecting to Cloud SQL at ${host} as ${user} (DB: ${database || "postgres"})`);
    const isUnixSocket = host.startsWith("/");
    return new Pool({
      host,
      port: 5432,
      user,
      password,
      database: database || "postgres",
      ssl: isUnixSocket ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      max: 15,
      keepAlive: true,
    });
  }

  console.warn("[Database] Both SQL_HOST and DATABASE_URL are missing. Fallback to local storage expected.");
  return new Pool({
    connectionTimeoutMillis: 5000,
  });
};

const pool = createPool();

pool.on("error", (err) => {
  console.error("Unexpected error on idle SQL pool client:", err);
});

export const db = drizzle(pool, { schema });
export { schema };
