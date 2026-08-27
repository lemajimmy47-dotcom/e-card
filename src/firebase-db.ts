import { ensureTablesExist, seedFromBackupFile, fetchFullStateFromDB, syncStateToRelationalDB } from "./db/cloudsql-core.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "database.json");
let inMemoryDB: any = null;

let sqlConnectionFailed = false;
let lastSqlFailTime = 0;

function hasSQLConfig() {
  const envUrl = process.env.SQL_HOST || process.env.DATABASE_URL || process.env.SQL_DATABASE_URL;
  if (!envUrl) return false;
  if (sqlConnectionFailed) {
    return false;
  }
  return true;
}

function getLocalDBFallback() {
  if (inMemoryDB && typeof inMemoryDB === "object" && Object.keys(inMemoryDB).length > 0 && inMemoryDB.uwalemiState) {
    return inMemoryDB;
  }

  // 1. Try reading primary database.json
  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (err: any) {
      console.warn("[Fallback Local DB] Primary read issue, checking backup file:", err?.message || err);
    }
  }

  // 2. Try reading database.json.bak
  const backupPath = DB_PATH + ".bak";
  if (fs.existsSync(backupPath)) {
    try {
      const rawBak = fs.readFileSync(backupPath, "utf-8");
      const parsedBak = JSON.parse(rawBak);
      if (parsedBak && typeof parsedBak === "object") {
        console.log("[Fallback Local DB] Successfully recovered from database.json.bak");
        return parsedBak;
      }
    } catch (bakErr: any) {
      console.warn("[Fallback Local DB] Backup read issue:", bakErr?.message || bakErr);
    }
  }

  // 3. Try reading state.json
  const statePath = path.join(process.cwd(), "state.json");
  if (fs.existsSync(statePath)) {
    try {
      const rawState = fs.readFileSync(statePath, "utf-8");
      const parsedState = JSON.parse(rawState);
      if (parsedState && typeof parsedState === "object") {
        console.log("[Fallback Local DB] Successfully loaded state from state.json");
        return parsedState;
      }
    } catch (stateErr: any) {
      console.warn("[Fallback Local DB] state.json read issue:", stateErr?.message || stateErr);
    }
  }

  return {
    eventsList: [],
    eventDetails: {},
    guests: [],
    templateSettings: {},
    userAccount: {},
    committee_members: [],
    committee_roles: []
  };
}

export async function fetchFromFirestore() {
  if (!hasSQLConfig()) {
    return getLocalDBFallback();
  }
  return await fetchFullStateFromDB();
}

export async function initDB() {
  // If database connection parameters are not set, bypass completely to avoid slow connection timeouts during server startup
  const isCloudSQL = hasSQLConfig();
  
  if (!isCloudSQL) {
    console.log("[SQL Bypass] Database connection parameters are not set. Operating directly on local JSON database store.");
    inMemoryDB = getLocalDBFallback();
    return inMemoryDB;
  }

  console.log("[CloudSQL Initializer] Preparing Cloud SQL connection parameters...");
  try {
    // 1. Ensure all PostgreSQL tables and columns exist
    await ensureTablesExist();

    // 2. If SQL database is empty, seed it from existing database.json
    // We wrap this in a timeout-like behavior or ensure it doesn't block forever
    console.log("[CloudSQL Initializer] Seeding from backup if needed...");
    await seedFromBackupFile();

    // 3. Read full state from PostgreSQL
    console.log("[CloudSQL Initializer] Fetching full state from PostgreSQL...");
    const state = await fetchFullStateFromDB();
    
    // If PostgreSQL doesn't have uwalemiState yet, seed from local database.json and sync to PostgreSQL
    if (!state.uwalemiState && fs.existsSync(DB_PATH)) {
      try {
        const raw = fs.readFileSync(DB_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.uwalemiState) {
          state.uwalemiState = parsed.uwalemiState;
          console.log("[CloudSQL Initializer] Syncing initial local uwalemiState to PostgreSQL...");
          await syncStateToRelationalDB(state);
        }
      } catch (err) {}
    }
    
    inMemoryDB = state;
    console.log("[CloudSQL Initializer] Cloud SQL PostgreSQL state fetched and loaded.");
    
    // Start background keep-alive loop to prevent Render PostgreSQL scale-to-zero/sleep
    startKeepAliveInterval();
    
    return inMemoryDB;
  } catch (error: any) {
    sqlConnectionFailed = true;
    console.warn("[CloudSQL Initializer] Setup notice:", error?.message || error);
    // Fallback safely to local JSON file
    console.log("[CloudSQL Initializer] Operating smoothly on local database.json store.");
    inMemoryDB = getLocalDBFallback();
    return inMemoryDB;
  }
}

export function readDB() {
  if (!inMemoryDB) {
    inMemoryDB = getLocalDBFallback();
  }
  return inMemoryDB;
}

let isSyncingToDB = false;
let activeFetchPromise: Promise<any> | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 1500; // 1.5 seconds client page load bundle threshold

export async function readDBLatest() {
  if (!hasSQLConfig()) {
    if (!inMemoryDB) {
      inMemoryDB = getLocalDBFallback();
    }
    return inMemoryDB;
  }

  // If we are actively writing to DB, reading from DB will yield stale records. Return in memory state.
  if (isSyncingToDB && inMemoryDB) {
    return inMemoryDB;
  }

  const now = Date.now();
  if (inMemoryDB && (now - lastFetchTime < CACHE_TTL)) {
    return inMemoryDB;
  }

  if (activeFetchPromise) {
    return activeFetchPromise;
  }

  activeFetchPromise = (async () => {
    let attempts = 2;
    while (attempts > 0) {
      try {
        const state = await fetchFullStateFromDB();
        if (!state.uwalemiState) {
          const local = getLocalDBFallback();
          if (local && typeof local === 'object' && local.uwalemiState) {
            state.uwalemiState = local.uwalemiState;
          }
        }
        sqlConnectionFailed = false; // Reset error flag on successful query
        inMemoryDB = state;
        lastFetchTime = Date.now();
        return state;
      } catch (error: any) {
        attempts--;
        if (attempts === 0) {
          sqlConnectionFailed = true;
          console.warn("[CloudSQL readDBLatest] Notice: SQL database unavailable, switching to local store fallback.");
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  })();

  try {
    return await activeFetchPromise;
  } catch (error) {
    if (!inMemoryDB) {
      inMemoryDB = getLocalDBFallback();
    }
    return inMemoryDB;
  } finally {
    activeFetchPromise = null;
  }
}

export async function getStateForClient() {
  return await readDBLatest();
}

export function updateMemoryAndLocalFileOnly(data: any) {
  inMemoryDB = data;
  lastFetchTime = Date.now();
  try {
    const tmpPath = DB_PATH + ".tmp";
    const backupPath = DB_PATH + ".bak";
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    if (fs.existsSync(DB_PATH)) {
      try {
        fs.copyFileSync(DB_PATH, backupPath);
      } catch (cpErr) {
        // Non-fatal backup copy
      }
    }
    fs.renameSync(tmpPath, DB_PATH);
  } catch (e) {
    console.warn("Failed to write to local database file safely:", e);
  }
}

export async function writeDB(data: any) {
  if (data && data.guests && Array.isArray(data.guests)) {
    const seenIds = new Set<string>();
    data.guests = data.guests
      .map((g: any) => {
        if (g && typeof g === "object") {
          const { cardImageUrl, ...rest } = g;
          return rest;
        }
        return g;
      })
      .filter((g: any) => {
        if (!g || !g.id) return false;
        if (seenIds.has(g.id)) return false;
        seenIds.add(g.id);
        return true;
      });
  }

  // Sync memory and disk snapshot
  updateMemoryAndLocalFileOnly(data);

  if (!hasSQLConfig()) {
    return;
  }

  // Sync / write directly to PostgreSQL synchronously with 3 retries! (Await write complete)
  let attempts = 3;
  while (attempts > 0) {
    try {
      isSyncingToDB = true;
      await syncStateToRelationalDB(data);
      isSyncingToDB = false;
      return;
    } catch (error) {
      attempts--;
      console.error(`[CloudSQL writeDB] Relational sync error (synchronous). Attempts remaining: ${attempts}. Error:`, error);
      if (attempts === 0) {
        isSyncingToDB = false;
        sqlConnectionFailed = true;
        lastSqlFailTime = Date.now();
        console.warn("[CloudSQL writeDB] PostgreSQL sync failed. Data saved to local JSON store as fallback.");
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    } finally {
      isSyncingToDB = false;
    }
  }
}

export function triggerBackgroundSync() {
  // Relational writes are fully synchronous, background polling is not needed
}

let isKeepAliveRunning = false;

export async function pingPostgresKeepAlive() {
  if (!hasSQLConfig()) return;
  try {
    console.log("[Postgres Keep-Alive] Pinging database to keep connection warm...");
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    console.log(`[Postgres Keep-Alive] Keep-Alive Successful! Response time: ${Date.now() - start}ms`);
  } catch (err: any) {
    console.error(`[Postgres Keep-Alive Fail] Alert! Database wake-up ping failed:`, err.message || err);
  }
}

export function startKeepAliveInterval() {
  if (isKeepAliveRunning) return;
  if (!hasSQLConfig()) {
    console.log("[Postgres Keep-Alive] SQL configuration is not set. Bypassing keep-alive loop.");
    return;
  }
  
  isKeepAliveRunning = true;
  console.log("[Postgres Keep-Alive] Keep-alive service initialized. Will ping every 10 minutes continuously.");
  
  // Run an immediate ping at startup (delayed slightly to allow server setup to breathe)
  setTimeout(() => {
    pingPostgresKeepAlive();
  }, 8000);

  // Interval trigger every 10 minutes (10 * 60 * 1000 = 600,000 milliseconds)
  setInterval(() => {
    pingPostgresKeepAlive();
  }, 10 * 60 * 1000);
}
