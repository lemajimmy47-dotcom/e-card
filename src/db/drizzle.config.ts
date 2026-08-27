import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || process.env.SQL_DATABASE_URL;

const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;

const getDbCredentials = () => {
  if (databaseUrl) {
    const isLocal = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
    return {
      url: databaseUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false }
    };
  }

  if (sqlHost && sqlDbName && user && password) {
    const isUnixSocket = sqlHost.startsWith("/");
    return {
      host: sqlHost,
      user: user,
      password: password,
      database: sqlDbName,
      ssl: isUnixSocket ? false : { rejectUnauthorized: false },
    };
  }

  throw new Error("Either (SQL_HOST, SQL_DB_NAME, SQL_ADMIN_USER, SQL_ADMIN_PASSWORD) or DATABASE_URL must be set in environment variables.");
};

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: getDbCredentials(),
  verbose: true,
});
