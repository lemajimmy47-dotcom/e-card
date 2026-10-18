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
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 20000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
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
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 20000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
        });
      } else {
        console.warn("[Database] Both SQL_HOST and DATABASE_URL are missing — using mock pool.");
        const mockPool: any = {
          query: async () => ({ rows: [] }),
          connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
          on: () => {},
          end: async () => {},
        };
        global._postgresPool = mockPool as unknown as Pool;
      }
    }

    if (global._postgresPool && typeof global._postgresPool.on === "function") {
      global._postgresPool.on("error", (err) => {
        console.warn("[Database] Recoverable notification on idle SQL pool client:", err?.message || err);
      });
    }
  }

  return global._postgresPool;
};

const pool = createPool();

let db: any;
try {
  db = drizzle(pool, { schema });
} catch (e) {
  console.warn("[AI Studio] Database not connected — using mock");
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({}),
  };
  db = new Proxy({}, {
    get: (_, prop) => prop === 'query'
      ? new Proxy({}, { get: () => noOp }) : async () => [],
  });
}

export { db, schema };

