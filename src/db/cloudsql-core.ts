import { db } from "./index.ts";
import * as schema from "./schema.ts";
import { eq, sql, notInArray } from "drizzle-orm";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "database.json");

// Robust Error Handling Wrappers
const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

function hasConnectionError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  const causeMsg = error.cause ? String(error.cause.message || "").toLowerCase() : "";
  const stackMsg = String(error.stack || "").toLowerCase();
  const code = String(error.code || error.cause?.code || "").toLowerCase();
  
  const searchStr = `${msg} ${causeMsg} ${stackMsg} ${code}`;
  
  return (
    searchStr.includes("connection terminated") ||
    searchStr.includes("econnreset") ||
    searchStr.includes("timeout") ||
    searchStr.includes("etimedout") ||
    searchStr.includes("connection closed") ||
    searchStr.includes("unexpected termination") ||
    searchStr.includes("ssl syscall error") ||
    searchStr.includes("broken pipe") ||
    searchStr.includes("failed query") ||
    searchStr.includes("socket has been ended") ||
    searchStr.includes("ehostunreach") ||
    searchStr.includes("57p01") ||
    searchStr.includes("admin_shutdown") ||
    searchStr.includes("enotfound") ||
    searchStr.includes("econnrefused")
  );
}

async function executeQuery<T>(label: string, queryFn: () => Promise<T>, retries = 4): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await queryFn();
    } catch (error: any) {
      const isConnectionDrop = hasConnectionError(error);

      if (attempt < retries) {
        const errorDetail = error.cause?.message || error.message || String(error);
        const preview = typeof errorDetail === "string" ? errorDetail.split("\n")[0].substring(0, 80) : "";
        console.warn(`[CloudSQL] ${label} attempt ${attempt} reconnecting (${preview}). Retrying in ${attempt * 1000}ms...`);
        await wait(attempt * 1000);
        continue;
      }
      
      const errMsg = error.cause?.message || error.message || String(error);
      const preview = typeof errMsg === "string" ? errMsg.split("\n")[0].substring(0, 100) : "";
      console.warn(`[CloudSQL] ${label} unavailable: ${preview}`);
      throw new Error(`Database operation '${label}' failed. Please try again later.`, { cause: error });
    }
  }
  throw new Error(`Database operation '${label}' failed after ${retries} attempts.`);
}

export async function ensureTablesExist(): Promise<void> {
  await executeQuery("ensureTablesExist", async () => {
    console.log("[CloudSQL] Verifying and provisioning database tables if not present...");
    
    // Execute core DDL in a single consolidated transaction for atomicity and speed
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "events" (
        "id" text PRIMARY KEY,
        "sender_id" text,
        "name" text NOT NULL,
        "date" text,
        "time" text,
        "period" text,
        "event_hall_name" text,
        "coordinates" text,
        "host_name" text,
        "dress_code" text,
        "contact_1" text,
        "contact_1_name" text,
        "contact_2" text,
        "contact_2_name" text,
        "contact_3" text,
        "contact_3_name" text,
        "maps_link" text,
        "event_img_url" text,
        "message_logs" jsonb,
        "sms_templates" jsonb,
        "payment_methods" jsonb,
        "contributions_enabled" boolean DEFAULT false,
        "fundraising_goal" integer DEFAULT 0,
        "auto_rsvp_reminders_enabled" boolean DEFAULT false,
        "contribution_deadline" text,
        "created_at" timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "guests" (
        "id" text PRIMARY KEY,
        "event_id" text REFERENCES "events"("id") ON DELETE CASCADE,
        "code" text NOT NULL,
        "name" text NOT NULL,
        "phone" text NOT NULL,
        "card_type" text NOT NULL,
        "sms_status" text DEFAULT 'Sijatuma',
        "whatsapp_status" text DEFAULT 'Sijatuma',
        "rsvp_status" text DEFAULT 'Bado',
        "max_guests" integer DEFAULT 1,
        "rsvp_guests_count" integer DEFAULT 0,
        "rsvp_comment" text,
        "checked_in" boolean DEFAULT false,
        "checked_in_time" text,
        "photo_url" text,
        "card_image_url" text,
        "sms_count" integer DEFAULT 0,
        "whatsapp_count" integer DEFAULT 0,
        "category" text,
        "pledge_amount" integer DEFAULT 0,
        "paid_amount" integer DEFAULT 0,
        "pledge_status" text DEFAULT 'No Pledge',
        "payments" jsonb,
        "rsvp_updated_at" text,
        "rsvp_seen" boolean DEFAULT true,
        "custom_fields" jsonb,
        "tags" jsonb
      );

      CREATE TABLE IF NOT EXISTS "save_the_dates" (
        "id" text PRIMARY KEY,
        "event_id" text REFERENCES "events"("id") ON DELETE CASCADE,
        "title" text NOT NULL,
        "message" text NOT NULL,
        "image_url" text,
        "created_at" text
      );

      CREATE TABLE IF NOT EXISTS "save_the_date_recipients" (
        "id" text PRIMARY KEY,
        "save_the_date_id" text REFERENCES "save_the_dates"("id") ON DELETE CASCADE,
        "guest_id" text REFERENCES "guests"("id") ON DELETE CASCADE,
        "sent_at" text,
        "status" text DEFAULT 'Pending'
      );

      CREATE TABLE IF NOT EXISTS "template_settings" (
        "id" text PRIMARY KEY,
        "image_url" text NOT NULL,
        "text_color" text DEFAULT '#333333',
        "font_family" text DEFAULT 'Inter',
        "guest_name_x" integer DEFAULT 50,
        "guest_name_y" integer DEFAULT 50,
        "guest_name_size" integer DEFAULT 24,
        "guest_name_color" text,
        "qr_code_x" integer DEFAULT 50,
        "qr_code_y" integer DEFAULT 70,
        "qr_code_size" integer DEFAULT 120,
        "qr_code_color" text,
        "card_type_x" integer DEFAULT 50,
        "card_type_y" integer DEFAULT 25,
        "card_type_size" integer DEFAULT 16,
        "card_type_color" text,
        "orientation" text DEFAULT 'portrait'
      );

      CREATE TABLE IF NOT EXISTS "sms_gateway_settings" (
        "id" text PRIMARY KEY,
        "provider" text DEFAULT 'simulation',
        "url" text,
        "api_key" text,
        "api_secret" text,
        "sender_id" text,
        "sender_id_status" text DEFAULT 'approved',
        "whatsapp_url" text,
        "custom_headers" text DEFAULT '{}',
        "custom_body" text DEFAULT '{\n  "to": "{to}",\n  "message": "{message}"\n}'
      );

      CREATE TABLE IF NOT EXISTS "committee_members" (
        "id" text PRIMARY KEY,
        "name" text NOT NULL,
        "phone" text NOT NULL,
        "email" text,
        "position" text DEFAULT 'Committee Member',
        "permission_level" text DEFAULT 'Summary Access',
        "token" text
      );

      CREATE TABLE IF NOT EXISTS "committee_roles" (
        "id" text PRIMARY KEY,
        "name" text NOT NULL,
        "permission_level" text NOT NULL,
        "description" text
      );

      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" text PRIMARY KEY,
        "timestamp" text NOT NULL,
        "user" text NOT NULL,
        "action" text NOT NULL,
        "details" text NOT NULL,
        "ip_address" text
      );

      CREATE TABLE IF NOT EXISTS "user_account" (
        "id" text PRIMARY KEY,
        "username" text,
        "phone" text,
        "email" text,
        "wallet_balance" integer DEFAULT 0,
        "transactions" jsonb,
        "active_event_id" text
      );

      CREATE TABLE IF NOT EXISTS "uwalemi_state" (
        "id" text PRIMARY KEY,
        "data" jsonb NOT NULL,
        "updated_at" timestamp DEFAULT now()
      );
    `);

    // Ensure extra columns exist if upgrading from older schemas
    try {
      await db.execute(sql`
        ALTER TABLE "user_account" ADD COLUMN IF NOT EXISTS "active_event_id" text;
        ALTER TABLE "template_settings" ADD COLUMN IF NOT EXISTS "orientation" text DEFAULT 'portrait';
        ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "custom_fields" jsonb;
        ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "tags" jsonb;
      `);
    } catch (colErr) {
      console.warn("[CloudSQL] Column migration notice:", colErr);
    }

    console.log("[CloudSQL] All relational tables and columns verified/created successfully.");
  });
}

// 1. One-time Boot Seeder / Backup File Importer
export async function seedFromBackupFile(): Promise<boolean> {
  return await executeQuery("seedFromBackupFile", async () => {
    // Check if events or guests are already populated
    const eventCount = await db.select({ count: sql<number>`count(*)` }).from(schema.events);
    const guestCount = await db.select({ count: sql<number>`count(*)` }).from(schema.guests);
    
    const countEvents = Number(eventCount[0]?.count || 0);
    const countGuests = Number(guestCount[0]?.count || 0);
    
    if (countEvents > 0 || countGuests > 0) {
      console.log(`[SQL Seeder] Tables are already populated (events: ${countEvents}, guests: ${countGuests}). Skipping migration.`);
      return false;
    }

    if (!fs.existsSync(DB_PATH)) {
      console.log("[SQL Seeder] No database.json backup found to migrate.");
      return false;
    }

    console.log("[SQL Seeder] Scanning database.json data for importing into Cloud SQL Postgres...");
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const backup = JSON.parse(rawData);

    // Seed Events
    if (backup.eventsList && Array.isArray(backup.eventsList)) {
      console.log(`[SQL Seeder] Importing ${backup.eventsList.length} events...`);
      for (const ev of backup.eventsList) {
        if (!ev.id) continue;
        await db.insert(schema.events).values({
          id: String(ev.id),
          senderId: ev.senderId ? String(ev.senderId) : null,
          name: String(ev.name || "Sherehe"),
          date: ev.date ? String(ev.date) : null,
          time: ev.time ? String(ev.time) : null,
          period: ev.period ? String(ev.period) : null,
          eventHallName: ev.eventHallName ? String(ev.eventHallName) : null,
          coordinates: ev.coordinates ? String(ev.coordinates) : null,
          hostName: ev.hostName ? String(ev.hostName) : null,
          dressCode: ev.dressCode ? String(ev.dressCode) : null,
          contact1: ev.contact1 ? String(ev.contact1) : null,
          contact1Name: ev.contact1Name ? String(ev.contact1Name) : null,
          contact2: ev.contact2 ? String(ev.contact2) : null,
          contact2Name: ev.contact2Name ? String(ev.contact2Name) : null,
          contact3: ev.contact3 ? String(ev.contact3) : null,
          contact3Name: ev.contact3Name ? String(ev.contact3Name) : null,
          mapsLink: ev.mapsLink ? String(ev.mapsLink) : null,
          eventImgUrl: ev.eventImgUrl ? String(ev.eventImgUrl) : null,
          messageLogs: ev.messageLogs || null,
          smsTemplates: ev.smsTemplates || null,
          paymentMethods: ev.paymentMethods || null,
          contributionsEnabled: ev.contributionsEnabled === true,
          fundraisingGoal: typeof ev.fundraisingGoal === "number" ? ev.fundraisingGoal : 0,
          autoRsvpRemindersEnabled: ev.autoRsvpRemindersEnabled === true,
          contributionDeadline: ev.contributionDeadline ? String(ev.contributionDeadline) : null,
        }).onConflictDoNothing();
      }
    }

    // Fallback: Check active event details if eventsList is empty
    if (backup.eventDetails && backup.eventDetails.id) {
      const ed = backup.eventDetails;
      console.log(`[SQL Seeder] Importing active event Details: ${ed.name}...`);
      await db.insert(schema.events).values({
        id: String(ed.id),
        senderId: ed.senderId ? String(ed.senderId) : null,
        name: String(ed.name || "Sherehe"),
        date: ed.date ? String(ed.date) : null,
        time: ed.time ? String(ed.time) : null,
        period: ed.period ? String(ed.period) : null,
        eventHallName: ed.eventHallName ? String(ed.eventHallName) : null,
        coordinates: ed.coordinates ? String(ed.coordinates) : null,
        hostName: ed.hostName ? String(ed.hostName) : null,
        dressCode: ed.dressCode ? String(ed.dressCode) : null,
        contact1: ed.contact1 ? String(ed.contact1) : null,
        contact1Name: ed.contact1Name ? String(ed.contact1Name) : null,
        contact2: ed.contact2 ? String(ed.contact2) : null,
        contact2Name: ed.contact2Name ? String(ed.contact2Name) : null,
        contact3: ed.contact3 ? String(ed.contact3) : null,
        contact3Name: ed.contact3Name ? String(ed.contact3Name) : null,
        mapsLink: ed.mapsLink ? String(ed.mapsLink) : null,
        eventImgUrl: ed.eventImgUrl ? String(ed.eventImgUrl) : null,
        messageLogs: ed.messageLogs || null,
        smsTemplates: ed.smsTemplates || null,
        paymentMethods: ed.paymentMethods || null,
        contributionsEnabled: ed.contributionsEnabled === true,
        fundraisingGoal: typeof ed.fundraisingGoal === "number" ? ed.fundraisingGoal : 0,
        autoRsvpRemindersEnabled: ed.autoRsvpRemindersEnabled === true,
        contributionDeadline: ed.contributionDeadline ? String(ed.contributionDeadline) : null,
      }).onConflictDoNothing();
    }

    // Seed Guests
    if (backup.guests && Array.isArray(backup.guests)) {
      console.log(`[SQL Seeder] Importing ${backup.guests.length} guests...`);
      for (const g of backup.guests) {
        if (!g.id) continue;
        await db.insert(schema.guests).values({
          id: String(g.id),
          eventId: g.eventId ? String(g.eventId) : null,
          code: String(g.code || "REG"),
          name: String(g.name || ""),
          phone: String(g.phone || ""),
          cardType: String(g.cardType || "UNCLASSIFIED"),
          smsStatus: String(g.smsStatus || "Sijatuma"),
          whatsappStatus: String(g.whatsappStatus || "Sijatuma"),
          rsvpStatus: String(g.rsvpStatus || "Bado"),
          maxGuests: typeof g.maxGuests === "number" ? g.maxGuests : 1,
          rsvpGuestsCount: typeof g.rsvpGuestsCount === "number" ? g.rsvpGuestsCount : 0,
          rsvpComment: g.rsvpComment ? String(g.rsvpComment) : null,
          checkedIn: g.checkedIn === true,
          checkedInTime: g.checkedInTime ? String(g.checkedInTime) : null,
          photoUrl: g.photoUrl ? String(g.photoUrl) : null,
          cardImageUrl: g.cardImageUrl ? String(g.cardImageUrl) : null,
          smsCount: typeof g.smsCount === "number" ? g.smsCount : 0,
          whatsappCount: typeof g.whatsappCount === "number" ? g.whatsappCount : 0,
          category: g.category ? String(g.category) : null,
          pledgeAmount: typeof g.pledgeAmount === "number" ? g.pledgeAmount : 0,
          paidAmount: typeof g.paidAmount === "number" ? g.paidAmount : 0,
          pledgeStatus: String(g.pledgeStatus || "No Pledge"),
          payments: g.payments || null,
          rsvpUpdatedAt: g.rsvpUpdatedAt ? String(g.rsvpUpdatedAt) : null,
          rsvpSeen: g.rsvpSeen !== false,
        }).onConflictDoNothing();
      }
    }

    // Seed SaveTheDates
    if (backup.saveTheDates && Array.isArray(backup.saveTheDates)) {
      console.log(`[SQL Seeder] Importing ${backup.saveTheDates.length} save the date templates...`);
      for (const s of backup.saveTheDates) {
        if (!s.id) continue;
        await db.insert(schema.saveTheDates).values({
          id: String(s.id),
          eventId: s.event_id ? String(s.event_id) : null,
          title: String(s.title || ""),
          message: String(s.message || ""),
          imageUrl: s.image_url ? String(s.image_url) : null,
          createdAt: s.created_at ? String(s.created_at) : null,
        }).onConflictDoNothing();
      }
    }

    // Seed Recipients
    if (backup.saveTheDateRecipients && Array.isArray(backup.saveTheDateRecipients)) {
      console.log(`[SQL Seeder] Importing ${backup.saveTheDateRecipients.length} recipients...`);
      for (const r of backup.saveTheDateRecipients) {
        if (!r.id) continue;
        await db.insert(schema.saveTheDateRecipients).values({
          id: String(r.id),
          saveTheDateId: r.save_the_date_id ? String(r.save_the_date_id) : null,
          guestId: r.guest_id ? String(r.guest_id) : null,
          sentAt: r.sent_at ? String(r.sent_at) : null,
          status: String(r.status || "Pending"),
        }).onConflictDoNothing();
      }
    }

    // Seed Template Settings
    if (backup.templateSettings && typeof backup.templateSettings === "object") {
      console.log(`[SQL Seeder] Importing template settings...`);
      for (const [key, t] of Object.entries(backup.templateSettings)) {
        if (!t || typeof t !== "object") continue;
        const tsObj = t as any;
        await db.insert(schema.templateSettings).values({
          id: String(key),
          imageUrl: String(tsObj.imageUrl || ""),
          textColor: tsObj.textColor ? String(tsObj.textColor) : "#333333",
          fontFamily: tsObj.fontFamily ? String(tsObj.fontFamily) : "Inter",
          guestNameX: typeof tsObj.guestNameX === "number" ? tsObj.guestNameX : 50,
          guestNameY: typeof tsObj.guestNameY === "number" ? tsObj.guestNameY : 50,
          guestNameSize: typeof tsObj.guestNameSize === "number" ? tsObj.guestNameSize : 24,
          guestNameColor: tsObj.guestNameColor ? String(tsObj.guestNameColor) : null,
          qrCodeX: typeof tsObj.qrCodeX === "number" ? tsObj.qrCodeX : 50,
          qrCodeY: typeof tsObj.qrCodeY === "number" ? tsObj.qrCodeY : 70,
          qrCodeSize: typeof tsObj.qrCodeSize === "number" ? tsObj.qrCodeSize : 120,
          qrCodeColor: tsObj.qrCodeColor ? String(tsObj.qrCodeColor) : null,
          cardTypeX: typeof tsObj.cardTypeX === "number" ? tsObj.cardTypeX : 50,
          cardTypeY: typeof tsObj.cardTypeY === "number" ? tsObj.cardTypeY : 25,
          cardTypeSize: typeof tsObj.cardTypeSize === "number" ? tsObj.cardTypeSize : 16,
          cardTypeColor: tsObj.cardTypeColor ? String(tsObj.cardTypeColor) : null,
          orientation: tsObj.orientation ? String(tsObj.orientation) : "portrait",
        }).onConflictDoNothing();
      }
    }

    // Seed SMS Gateway Settings
    if (backup.smsGatewaySettings && typeof backup.smsGatewaySettings === "object") {
      console.log(`[SQL Seeder] Importing SMS Gateway Settings...`);
      const s = backup.smsGatewaySettings;
      await db.insert(schema.smsGatewaySettings).values({
        id: "settings",
        provider: s.provider ? String(s.provider) : "simulation",
        url: s.url ? String(s.url) : null,
        apiKey: s.apiKey ? String(s.apiKey) : null,
        apiSecret: s.apiSecret ? String(s.apiSecret) : null,
        senderId: s.senderId ? String(s.senderId) : null,
        senderIdStatus: s.senderIdStatus ? String(s.senderIdStatus) : "approved",
        whatsappUrl: s.whatsappUrl ? String(s.whatsappUrl) : null,
        customHeaders: s.customHeaders ? String(s.customHeaders) : "{}",
        customBody: s.customBody ? String(s.customBody) : "{}",
      }).onConflictDoNothing();
    }

    // Seed Committee Members
    if (backup.committee_members && Array.isArray(backup.committee_members)) {
      console.log(`[SQL Seeder] Importing ${backup.committee_members.length} committee members...`);
      for (const m of backup.committee_members) {
        if (!m.id) continue;
        await db.insert(schema.committeeMembers).values({
          id: String(m.id),
          name: String(m.name || ""),
          phone: String(m.phone || ""),
          email: m.email ? String(m.email) : null,
          position: m.position ? String(m.position) : "Committee Member",
          permissionLevel: m.permissionLevel ? String(m.permissionLevel) : "Summary Access",
          token: m.token ? String(m.token) : null,
        }).onConflictDoNothing();
      }
    }

    // Seed Committee Roles
    if (backup.committee_roles && Array.isArray(backup.committee_roles)) {
      console.log(`[SQL Seeder] Importing ${backup.committee_roles.length} roles...`);
      for (const r of backup.committee_roles) {
        if (!r.id) continue;
        await db.insert(schema.committeeRoles).values({
          id: String(r.id),
          name: String(r.name || ""),
          permissionLevel: String(r.permissionLevel || ""),
          description: r.description ? String(r.description) : null,
        }).onConflictDoNothing();
      }
    }

    // Seed Audit Logs
    if (backup.auditLogs && Array.isArray(backup.auditLogs)) {
      console.log(`[SQL Seeder] Importing ${backup.auditLogs.length} audit logs...`);
      for (const l of backup.auditLogs) {
        if (!l.id) continue;
        await db.insert(schema.auditLogs).values({
          id: String(l.id),
          timestamp: String(l.timestamp || new Date().toISOString()),
          user: String(l.user || "System"),
          action: String(l.action || ""),
          details: String(l.details || ""),
          ipAddress: l.ipAddress ? String(l.ipAddress) : null,
        }).onConflictDoNothing();
      }
    }

    // Seed User Account
    if (backup.userAccount && typeof backup.userAccount === "object") {
      console.log(`[SQL Seeder] Importing User Account...`);
      const u = backup.userAccount;
      await db.insert(schema.userAccount).values({
        id: "account",
        username: u.username ? String(u.username) : null,
        phone: u.phone ? String(u.phone) : null,
        email: u.email ? String(u.email) : null,
        walletBalance: typeof u.walletBalance === "number" ? u.walletBalance : 0,
        transactions: u.transactions || null,
        activeEventId: u.activeEventId ? String(u.activeEventId) : null,
      }).onConflictDoNothing();
    }

    // Seed UWALEMI State
    if (backup.uwalemiState && typeof backup.uwalemiState === "object") {
      console.log(`[SQL Seeder] Importing UWALEMI State...`);
      await db.insert(schema.uwalemiStateTable).values({
        id: "state",
        data: backup.uwalemiState,
      }).onConflictDoNothing();
    }

    console.log("[SQL Seeder] SQLite / JSON Database backup has been fully imported into Cloud SQL PostgreSQL.");
    return true;
  });
}

// 2. State Reconstruction function
export async function fetchFullStateFromDB(): Promise<any> {
  try {
    return await executeQuery("fetchFullStateFromDB", async () => {
    let sqlEvents: any[] = [];
    let sqlGuests: any[] = [];
    let sqlSaveTheDates: any[] = [];
    let sqlRecipients: any[] = [];
    let sqlTemplates: any[] = [];
    let sqlSmsSettings: any[] = [];
    let sqlCommitteeMembers: any[] = [];
    let sqlCommitteeRoles: any[] = [];
    let sqlAuditLogs: any[] = [];
    let sqlUserAcc: any[] = [];
    let sqlUwalemi: any[] = [];

    const loadTables = async () => {
      sqlEvents = await db.select().from(schema.events);
      sqlGuests = await db.select().from(schema.guests);
      sqlSaveTheDates = await db.select().from(schema.saveTheDates);
      sqlRecipients = await db.select().from(schema.saveTheDateRecipients);
      sqlTemplates = await db.select().from(schema.templateSettings);
      sqlSmsSettings = await db.select().from(schema.smsGatewaySettings);
      sqlCommitteeMembers = await db.select().from(schema.committeeMembers);
      sqlCommitteeRoles = await db.select().from(schema.committeeRoles);
      sqlAuditLogs = await db.select().from(schema.auditLogs);
      sqlUserAcc = await db.select().from(schema.userAccount);
      sqlUwalemi = await db.select().from(schema.uwalemiStateTable);
    };

    try {
      await loadTables();
    } catch (err: any) {
      const msg = String(err?.message || "").toLowerCase();
      if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("undefined_table")) {
        console.log("[CloudSQL] Table missing detected. Running ensureTablesExist()...");
        await ensureTablesExist();
        await loadTables();
      } else {
        throw err;
      }
    }

    // Reconstruct lists and nested formats
    const eventsList = sqlEvents.map(e => ({
      id: e.id,
      senderId: e.senderId || "",
      name: e.name,
      date: e.date || "",
      time: e.time || "",
      period: e.period || "Jioni",
      eventHallName: e.eventHallName || "",
      coordinates: e.coordinates || "",
      hostName: e.hostName || "",
      dressCode: e.dressCode || "",
      contact1: e.contact1 || "",
      contact1Name: e.contact1Name || "",
      contact2: e.contact2 || "",
      contact2Name: e.contact2Name || "",
      contact3: e.contact3 || "",
      contact3Name: e.contact3Name || "",
      mapsLink: e.mapsLink || "",
      eventImgUrl: e.eventImgUrl || "",
      messageLogs: e.messageLogs || [],
      smsTemplates: e.smsTemplates || null,
      paymentMethods: (e as any).paymentMethods || [],
      contributionsEnabled: e.contributionsEnabled || false,
      fundraisingGoal: e.fundraisingGoal || 0,
      autoRsvpRemindersEnabled: e.autoRsvpRemindersEnabled || false,
      contributionDeadline: e.contributionDeadline || "",
    }));

    // Find active event details (based on userAccount's activeEventId, falling back to first non-starter event)
    const activeEventId = sqlUserAcc[0]?.activeEventId;
    const eventDetailsObj = (activeEventId ? eventsList.find(e => e.id === activeEventId) : null) ||
                            eventsList.find(e => e.id !== "event-starter") ||
                            eventsList[0] || {};

    const guests = sqlGuests.map(g => ({
      id: g.id,
      eventId: g.eventId || "",
      code: g.code,
      name: g.name,
      phone: g.phone,
      cardType: g.cardType,
      smsStatus: g.smsStatus || "Sijatuma",
      whatsappStatus: g.whatsappStatus || "Sijatuma",
      rsvpStatus: g.rsvpStatus || "Bado",
      maxGuests: g.maxGuests || 1,
      rsvpGuestsCount: g.rsvpGuestsCount || 0,
      rsvpComment: g.rsvpComment || "",
      checkedIn: g.checkedIn || false,
      checkedInTime: g.checkedInTime || "",
      photoUrl: g.photoUrl || "",
      cardImageUrl: g.cardImageUrl || "",
      smsCount: g.smsCount || 0,
      whatsappCount: g.whatsappCount || 0,
      category: g.category || "",
      pledgeAmount: g.pledgeAmount || 0,
      paidAmount: g.paidAmount || 0,
      pledgeStatus: g.pledgeStatus || "No Pledge",
      payments: g.payments || [],
      rsvpUpdatedAt: g.rsvpUpdatedAt || "",
      rsvpSeen: g.rsvpSeen !== false,
      customFields: (g as any).customFields || {},
      tags: (g as any).tags || [],
    }));

    const saveTheDates = sqlSaveTheDates.map(s => ({
      id: s.id,
      event_id: s.eventId || "",
      title: s.title,
      message: s.message,
      image_url: s.imageUrl || "",
      created_at: s.createdAt || "",
    }));

    const saveTheDateRecipients = sqlRecipients.map(r => ({
      id: r.id,
      save_the_date_id: r.saveTheDateId || "",
      guest_id: r.guestId || "",
      sent_at: r.sentAt || "",
      status: r.status || "Pending",
    }));

    // ReconstructtemplateSettings map
    const templateSettingsMap: any = {};
    for (const t of sqlTemplates) {
      templateSettingsMap[t.id] = {
        imageUrl: t.imageUrl,
        textColor: t.textColor || "#333333",
        fontFamily: t.fontFamily || "Inter",
        guestNameX: t.guestNameX || 50,
        guestNameY: t.guestNameY || 50,
        guestNameSize: t.guestNameSize || 24,
        guestNameColor: t.guestNameColor || undefined,
        qrCodeX: t.qrCodeX || 50,
        qrCodeY: t.qrCodeY || 70,
        qrCodeSize: t.qrCodeSize || 120,
        qrCodeColor: t.qrCodeColor || undefined,
        cardTypeX: t.cardTypeX || 50,
        cardTypeY: t.cardTypeY || 25,
        cardTypeSize: t.cardTypeSize || 16,
        cardTypeColor: t.cardTypeColor || undefined,
      };
    }

    const firstSms = sqlSmsSettings.find(s => s.id === "settings") || sqlSmsSettings[0];
    const smsGatewaySettings = firstSms ? {
      provider: firstSms.provider || "simulation",
      url: firstSms.url || "",
      apiKey: firstSms.apiKey || "",
      apiSecret: firstSms.apiSecret || "",
      senderId: firstSms.senderId || "",
      senderIdStatus: firstSms.senderIdStatus || "approved",
      whatsappUrl: firstSms.whatsappUrl || "",
      customHeaders: firstSms.customHeaders || "{}",
      customBody: firstSms.customBody || "{\n  \"to\": \"{to}\",\n  \"message\": \"{message}\"\n}",
    } : {
      provider: "simulation",
      url: "",
      apiKey: "",
      apiSecret: "",
      senderId: "",
      senderIdStatus: "approved",
      whatsappUrl: "",
      customHeaders: "{}",
      customBody: "{\n  \"to\": \"{to}\",\n  \"message\": \"{message}\"\n}",
    };

    const committee_members = sqlCommitteeMembers.map(m => ({
      id: m.id,
      name: m.name,
      phone: m.phone,
      email: m.email || "",
      position: m.position || "Committee Member",
      permissionLevel: m.permissionLevel || "Summary Access",
      token: m.token || "",
    }));

    const committee_roles = sqlCommitteeRoles.map(r => ({
      id: r.id,
      name: r.name,
      permissionLevel: r.permissionLevel,
      description: r.description || "",
    }));

    const auditLogs = sqlAuditLogs.map(l => ({
      id: l.id,
      timestamp: l.timestamp,
      user: l.user,
      action: l.action,
      details: l.details,
      ipAddress: l.ipAddress || "",
    })).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const rawAcc = sqlUserAcc[0];
    const userAccount = rawAcc ? {
      username: rawAcc.username || "",
      phone: rawAcc.phone || "",
      email: rawAcc.email || "",
      walletBalance: rawAcc.walletBalance || 0,
      transactions: rawAcc.transactions || [],
      activeEventId: rawAcc.activeEventId || "",
    } : {
      username: "",
      phone: "",
      email: "",
      walletBalance: 0,
      transactions: [],
      activeEventId: "",
    };

    const uwalemiState = (sqlUwalemi && sqlUwalemi.length > 0 && sqlUwalemi[0].data) 
      ? sqlUwalemi[0].data 
      : null;

    return {
      eventsList,
      eventDetails: eventDetailsObj,
      guests,
      templateSettings: templateSettingsMap,
      smsGatewaySettings,
      committee_members,
      committee_roles,
      saveTheDates,
      saveTheDateRecipients,
      auditLogs,
      userAccount,
      uwalemiState,
    };
  });
  } catch (dbErr: any) {
    console.warn("[CloudSQL Core] fetchFullStateFromDB notice: SQL query unavailable, using local database.json store:", dbErr?.message || dbErr);
    if (fs.existsSync(DB_PATH)) {
      try {
        const raw = fs.readFileSync(DB_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      } catch (e) {}
    }
    throw dbErr;
  }
}

// 3. Robust Relational Upsert function
export async function syncStateToRelationalDB(data: any): Promise<void> {
  await executeQuery("syncStateToRelationalDB", async () => {
    // 3.1. Save events (from eventsList or single eventDetails) (BATCHED)
    const eventsToSync: any[] = [];
    if (data.eventsList && Array.isArray(data.eventsList)) {
      eventsToSync.push(...data.eventsList);
    }
    if (data.eventDetails && data.eventDetails.id) {
      // Add individual eventDetails if not redundant
      if (!eventsToSync.some(ev => ev.id === data.eventDetails.id)) {
        eventsToSync.push(data.eventDetails);
      }
    }

    if (eventsToSync.length > 0) {
      for (const ev of eventsToSync) {
        if (!ev || !ev.id) continue;
        await db.insert(schema.events).values({
          id: String(ev.id),
          senderId: ev.senderId ? String(ev.senderId) : null,
          name: String(ev.name || "Sherehe"),
          date: ev.date ? String(ev.date) : null,
          time: ev.time ? String(ev.time) : null,
          period: ev.period ? String(ev.period) : null,
          eventHallName: ev.eventHallName ? String(ev.eventHallName) : null,
          coordinates: ev.coordinates ? String(ev.coordinates) : null,
          hostName: ev.hostName ? String(ev.hostName) : null,
          dressCode: ev.dressCode ? String(ev.dressCode) : null,
          contact1: ev.contact1 ? String(ev.contact1) : null,
          contact1Name: ev.contact1Name ? String(ev.contact1Name) : null,
          contact2: ev.contact2 ? String(ev.contact2) : null,
          contact2Name: ev.contact2Name ? String(ev.contact2Name) : null,
          contact3: ev.contact3 ? String(ev.contact3) : null,
          contact3Name: ev.contact3Name ? String(ev.contact3Name) : null,
          mapsLink: ev.mapsLink ? String(ev.mapsLink) : null,
          eventImgUrl: ev.eventImgUrl ? String(ev.eventImgUrl) : null,
          messageLogs: ev.messageLogs || null,
          smsTemplates: ev.smsTemplates || null,
          paymentMethods: ev.paymentMethods || null,
          contributionsEnabled: ev.contributionsEnabled === true,
          fundraisingGoal: typeof ev.fundraisingGoal === "number" ? ev.fundraisingGoal : 0,
          autoRsvpRemindersEnabled: ev.autoRsvpRemindersEnabled === true,
          contributionDeadline: ev.contributionDeadline ? String(ev.contributionDeadline) : null,
        }).onConflictDoUpdate({
          target: schema.events.id,
          set: {
            senderId: sql`EXCLUDED.sender_id`,
            name: sql`EXCLUDED.name`,
            date: sql`EXCLUDED.date`,
            time: sql`EXCLUDED.time`,
            period: sql`EXCLUDED.period`,
            eventHallName: sql`EXCLUDED.event_hall_name`,
            coordinates: sql`EXCLUDED.coordinates`,
            hostName: sql`EXCLUDED.host_name`,
            dressCode: sql`EXCLUDED.dress_code`,
            contact1: sql`EXCLUDED.contact_1`,
            contact1Name: sql`EXCLUDED.contact_1_name`,
            contact2: sql`EXCLUDED.contact_2`,
            contact2Name: sql`EXCLUDED.contact_2_name`,
            contact3: sql`EXCLUDED.contact_3`,
            contact3Name: sql`EXCLUDED.contact_3_name`,
            mapsLink: sql`EXCLUDED.maps_link`,
            eventImgUrl: sql`EXCLUDED.event_img_url`,
            messageLogs: sql`EXCLUDED.message_logs`,
            smsTemplates: sql`EXCLUDED.sms_templates`,
            paymentMethods: sql`EXCLUDED.payment_methods`,
            contributionsEnabled: sql`EXCLUDED.contributions_enabled`,
            fundraisingGoal: sql`EXCLUDED.fundraising_goal`,
            autoRsvpRemindersEnabled: sql`EXCLUDED.auto_rsvp_reminders_enabled`,
            contributionDeadline: sql`EXCLUDED.contribution_deadline`,
          },
        });
      }
    }

    // 3.2. Save Guests (BATCHED)
    if (data.guests && Array.isArray(data.guests) && data.guests.length > 0) {
      const guestChunks = [];
      const CHUNK_SIZE = 50;
      for (let i = 0; i < data.guests.length; i += CHUNK_SIZE) {
        guestChunks.push(data.guests.slice(i, i + CHUNK_SIZE));
      }

      for (const chunk of guestChunks) {
        const values = chunk
          .filter((g: any) => g && g.id)
          .map((g: any) => ({
            id: String(g.id),
            eventId: g.eventId ? String(g.eventId) : null,
            code: String(g.code || "REG"),
            name: String(g.name || ""),
            phone: String(g.phone || ""),
            cardType: String(g.cardType || "UNCLASSIFIED"),
            smsStatus: String(g.smsStatus || "Sijatuma"),
            whatsappStatus: String(g.whatsappStatus || "Sijatuma"),
            rsvpStatus: String(g.rsvpStatus || "Bado"),
            maxGuests: typeof g.maxGuests === "number" ? g.maxGuests : 1,
            rsvpGuestsCount: typeof g.rsvpGuestsCount === "number" ? g.rsvpGuestsCount : 0,
            rsvpComment: g.rsvpComment ? String(g.rsvpComment) : null,
            checkedIn: g.checkedIn === true,
            checkedInTime: g.checkedInTime ? String(g.checkedInTime) : null,
            photoUrl: g.photoUrl ? String(g.photoUrl) : null,
            cardImageUrl: g.cardImageUrl ? String(g.cardImageUrl) : null,
            smsCount: typeof g.smsCount === "number" ? g.smsCount : 0,
            whatsappCount: typeof g.whatsappCount === "number" ? g.whatsappCount : 0,
            category: g.category ? String(g.category) : null,
            pledgeAmount: typeof g.pledgeAmount === "number" ? g.pledgeAmount : 0,
            paidAmount: typeof g.paidAmount === "number" ? g.paidAmount : 0,
            pledgeStatus: String(g.pledgeStatus || "No Pledge"),
            payments: g.payments || null,
            rsvpUpdatedAt: g.rsvpUpdatedAt ? String(g.rsvpUpdatedAt) : null,
            rsvpSeen: g.rsvpSeen !== false,
            customFields: g.customFields || null,
            tags: g.tags || null,
          }));

        if (values.length > 0) {
          await db.insert(schema.guests).values(values).onConflictDoUpdate({
            target: schema.guests.id,
            set: {
              eventId: sql`EXCLUDED.event_id`,
              code: sql`EXCLUDED.code`,
              name: sql`EXCLUDED.name`,
              phone: sql`EXCLUDED.phone`,
              cardType: sql`EXCLUDED.card_type`,
              smsStatus: sql`EXCLUDED.sms_status`,
              whatsappStatus: sql`EXCLUDED.whatsapp_status`,
              rsvpStatus: sql`EXCLUDED.rsvp_status`,
              maxGuests: sql`EXCLUDED.max_guests`,
              rsvpGuestsCount: sql`EXCLUDED.rsvp_guests_count`,
              rsvpComment: sql`EXCLUDED.rsvp_comment`,
              checkedIn: sql`EXCLUDED.checked_in`,
              checkedInTime: sql`EXCLUDED.checked_in_time`,
              photoUrl: sql`EXCLUDED.photo_url`,
              cardImageUrl: sql`EXCLUDED.card_image_url`,
              smsCount: sql`EXCLUDED.sms_count`,
              whatsappCount: sql`EXCLUDED.whatsapp_count`,
              category: sql`EXCLUDED.category`,
              pledgeAmount: sql`EXCLUDED.pledge_amount`,
              paidAmount: sql`EXCLUDED.paid_amount`,
              pledgeStatus: sql`EXCLUDED.pledge_status`,
              payments: sql`EXCLUDED.payments`,
              rsvpUpdatedAt: sql`EXCLUDED.rsvp_updated_at`,
              rsvpSeen: sql`EXCLUDED.rsvp_seen`,
              customFields: sql`EXCLUDED.custom_fields`,
              tags: sql`EXCLUDED.tags`,
            },
          });
        }
      }
    }

    // 3.3. Delete explicitly requested guests if client sends deletedGuestIds
    if (data.deletedGuestIds && Array.isArray(data.deletedGuestIds)) {
      for (const dgId of data.deletedGuestIds) {
        await db.delete(schema.guests).where(eq(schema.guests.id, dgId));
      }
    }
    if (data.deletedEventIds && Array.isArray(data.deletedEventIds)) {
      for (const deId of data.deletedEventIds) {
        await db.delete(schema.events).where(eq(schema.events.id, deId));
      }
    }

    // 3.4. Save SaveTheDates (BATCHED)
    if (data.saveTheDates && Array.isArray(data.saveTheDates) && data.saveTheDates.length > 0) {
      const values = data.saveTheDates
        .filter((s: any) => s.id)
        .map((s: any) => ({
          id: String(s.id),
          eventId: s.event_id ? String(s.event_id) : null,
          title: String(s.title || ""),
          message: String(s.message || ""),
          imageUrl: s.image_url ? String(s.image_url) : null,
          createdAt: s.created_at ? String(s.created_at) : null,
        }));

      if (values.length > 0) {
        await db.insert(schema.saveTheDates).values(values).onConflictDoUpdate({
          target: schema.saveTheDates.id,
          set: {
            eventId: sql`EXCLUDED.event_id`,
            title: sql`EXCLUDED.title`,
            message: sql`EXCLUDED.message`,
            imageUrl: sql`EXCLUDED.image_url`,
            createdAt: sql`EXCLUDED.created_at`,
          },
        });
      }
    }

    // 3.5. Save Recipients (BATCHED)
    if (data.saveTheDateRecipients && Array.isArray(data.saveTheDateRecipients) && data.saveTheDateRecipients.length > 0) {
      const recipientChunks = [];
      const CHUNK_SIZE = 50;
      for (let i = 0; i < data.saveTheDateRecipients.length; i += CHUNK_SIZE) {
        recipientChunks.push(data.saveTheDateRecipients.slice(i, i + CHUNK_SIZE));
      }

      for (const chunk of recipientChunks) {
        const values = chunk
          .filter((r: any) => r.id)
          .map((r: any) => ({
            id: String(r.id),
            saveTheDateId: r.save_the_date_id ? String(r.save_the_date_id) : null,
            guestId: r.guest_id ? String(r.guest_id) : null,
            sentAt: r.sent_at ? String(r.sent_at) : null,
            status: String(r.status || "Pending"),
          }));

        if (values.length > 0) {
          await db.insert(schema.saveTheDateRecipients).values(values).onConflictDoUpdate({
            target: schema.saveTheDateRecipients.id,
            set: {
              saveTheDateId: sql`EXCLUDED.save_the_date_id`,
              guestId: sql`EXCLUDED.guest_id`,
              sentAt: sql`EXCLUDED.sent_at`,
              status: sql`EXCLUDED.status`,
            },
          });
        }
      }
    }

    // 3.6. Save Template Settings
    if (data.templateSettings && typeof data.templateSettings === "object") {
      // Normalize to map if it's currently a flat object
      let normalizedMap: Record<string, any> = {};
      const isLegacyFlat = ('imageUrl' in data.templateSettings) && !('default' in data.templateSettings);
      
      if (isLegacyFlat) {
        normalizedMap['default'] = { ...data.templateSettings };
      } else {
        normalizedMap = { ...data.templateSettings };
      }

      const safeInt = (val: any, fallback: number) => {
        if (val === null || val === undefined) return fallback;
        const num = Number(val);
        return isNaN(num) ? fallback : Math.round(num);
      };

      for (const [key, t] of Object.entries(normalizedMap)) {
        if (!t || typeof t !== "object") continue;
        const tsObj = t as any;

        try {
          await db.insert(schema.templateSettings).values({
            id: String(key),
            imageUrl: String(tsObj.imageUrl || tsObj.image_url || ""),
            textColor: tsObj.textColor ? String(tsObj.textColor) : "#333333",
            fontFamily: tsObj.fontFamily ? String(tsObj.fontFamily) : "Inter",
            guestNameX: safeInt(tsObj.guestNameX, 50),
            guestNameY: safeInt(tsObj.guestNameY, 50),
            guestNameSize: safeInt(tsObj.guestNameSize, 24),
            guestNameColor: tsObj.guestNameColor ? String(tsObj.guestNameColor) : null,
            qrCodeX: safeInt(tsObj.qrCodeX, 50),
            qrCodeY: safeInt(tsObj.qrCodeY, 70),
            qrCodeSize: safeInt(tsObj.qrCodeSize, 120),
            qrCodeColor: tsObj.qrCodeColor ? String(tsObj.qrCodeColor) : null,
            cardTypeX: safeInt(tsObj.cardTypeX, 50),
            cardTypeY: safeInt(tsObj.cardTypeY, 25),
            cardTypeSize: safeInt(tsObj.cardTypeSize, 16),
            cardTypeColor: tsObj.cardTypeColor ? String(tsObj.cardTypeColor) : null,
            orientation: tsObj.orientation ? String(tsObj.orientation) : "portrait",
          }).onConflictDoUpdate({
            target: schema.templateSettings.id,
            set: {
              imageUrl: sql`EXCLUDED.image_url`,
              textColor: sql`EXCLUDED.text_color`,
              fontFamily: sql`EXCLUDED.font_family`,
              guestNameX: sql`EXCLUDED.guest_name_x`,
              guestNameY: sql`EXCLUDED.guest_name_y`,
              guestNameSize: sql`EXCLUDED.guest_name_size`,
              guestNameColor: sql`EXCLUDED.guest_name_color`,
              qrCodeX: sql`EXCLUDED.qr_code_x`,
              qrCodeY: sql`EXCLUDED.qr_code_y`,
              qrCodeSize: sql`EXCLUDED.qr_code_size`,
              qrCodeColor: sql`EXCLUDED.qr_code_color`,
              cardTypeX: sql`EXCLUDED.card_type_x`,
              cardTypeY: sql`EXCLUDED.card_type_y`,
              cardTypeSize: sql`EXCLUDED.card_type_size`,
              cardTypeColor: sql`EXCLUDED.card_type_color`,
              orientation: sql`EXCLUDED.orientation`,
            }
          });
        } catch (err) {
          console.error(`[CloudSQL] syncStateToRelationalDB (template_settings) failed for key ${key}:`, err);
        }
      }
    }

    // 3.7. Save SMS Settings
    if (data.smsGatewaySettings && typeof data.smsGatewaySettings === "object") {
      const s = data.smsGatewaySettings;
      await db.insert(schema.smsGatewaySettings).values({
        id: "settings",
        provider: s.provider ? String(s.provider) : "simulation",
        url: s.url ? String(s.url) : null,
        apiKey: s.apiKey ? String(s.apiKey) : null,
        apiSecret: s.apiSecret ? String(s.apiSecret) : null,
        senderId: s.senderId ? String(s.senderId) : null,
        senderIdStatus: s.senderIdStatus ? String(s.senderIdStatus) : "approved",
        whatsappUrl: s.whatsappUrl ? String(s.whatsappUrl) : null,
        customHeaders: s.customHeaders ? String(s.customHeaders) : "{}",
        customBody: s.customBody ? String(s.customBody) : "{}",
      }).onConflictDoUpdate({
        target: schema.smsGatewaySettings.id,
        set: {
          provider: s.provider ? String(s.provider) : "simulation",
          url: s.url ? String(s.url) : null,
          apiKey: s.apiKey ? String(s.apiKey) : null,
          apiSecret: s.apiSecret ? String(s.apiSecret) : null,
          senderId: s.senderId ? String(s.senderId) : null,
          senderIdStatus: s.senderIdStatus ? String(s.senderIdStatus) : "approved",
          whatsappUrl: s.whatsappUrl ? String(s.whatsappUrl) : null,
          customHeaders: s.customHeaders ? String(s.customHeaders) : "{}",
          customBody: s.customBody ? String(s.customBody) : "{}",
        }
      });
    }

    // 3.8. Save Committee Members (BATCHED with Delete Reconciliation)
    if (data.committee_members && Array.isArray(data.committee_members)) {
      const activeIds = data.committee_members.map((m: any) => String(m.id)).filter(Boolean);
      try {
        if (activeIds.length > 0) {
          // Delete committee members from SQL table that are NOT in the active in-memory list
          await db.delete(schema.committeeMembers).where(notInArray(schema.committeeMembers.id, activeIds));
        } else {
          // If the list is completely empty, delete all members
          await db.delete(schema.committeeMembers);
        }
      } catch (delErr) {
        console.error("[CloudSQL Sync] Failed to reconcile deleted committee members:", delErr);
      }

      const values = data.committee_members
        .filter((m: any) => m.id)
        .map((m: any) => ({
          id: String(m.id),
          name: String(m.name || ""),
          phone: String(m.phone || ""),
          email: m.email ? String(m.email) : null,
          position: m.position ? String(m.position) : "Committee Member",
          permissionLevel: m.permissionLevel ? String(m.permissionLevel) : "Summary Access",
          token: m.token ? String(m.token) : null,
        }));

      if (values.length > 0) {
        await db.insert(schema.committeeMembers).values(values).onConflictDoUpdate({
          target: schema.committeeMembers.id,
          set: {
            name: sql`EXCLUDED.name`,
            phone: sql`EXCLUDED.phone`,
            email: sql`EXCLUDED.email`,
            position: sql`EXCLUDED.position`,
            permissionLevel: sql`EXCLUDED.permission_level`,
            token: sql`EXCLUDED.token`,
          },
        });
      }
    }

    // 3.9. Save Committee Roles
    if (data.committee_roles && Array.isArray(data.committee_roles)) {
      for (const r of data.committee_roles) {
        if (!r.id) continue;
        await db.insert(schema.committeeRoles).values({
          id: String(r.id),
          name: String(r.name || ""),
          permissionLevel: String(r.permissionLevel || ""),
          description: r.description ? String(r.description) : null,
        }).onConflictDoUpdate({
          target: schema.committeeRoles.id,
          set: {
            name: String(r.name || ""),
            permissionLevel: String(r.permissionLevel || ""),
            description: r.description ? String(r.description) : null,
          }
        });
      }
    }

    // 3.10. Save Audit Logs (BATCHED)
    if (data.auditLogs && Array.isArray(data.auditLogs) && data.auditLogs.length > 0) {
      const logChunks = [];
      const CHUNK_SIZE = 50;
      for (let i = 0; i < data.auditLogs.length; i += CHUNK_SIZE) {
        logChunks.push(data.auditLogs.slice(i, i + CHUNK_SIZE));
      }

      for (const chunk of logChunks) {
        const values = chunk
          .filter((l: any) => l && (l.id || l.timestamp))
          .map((l: any) => ({
            id: String(l.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
            timestamp: String(l.timestamp || new Date().toISOString()),
            user: typeof l.user === "object" ? JSON.stringify(l.user) : String(l.user || "System"),
            action: String(l.action || "LOG"),
            details: typeof l.details === "object" ? JSON.stringify(l.details) : String(l.details || ""),
            ipAddress: l.ipAddress ? (Array.isArray(l.ipAddress) ? l.ipAddress.join(", ") : String(l.ipAddress)) : null,
          }));

        if (values.length > 0) {
          await db.insert(schema.auditLogs).values(values).onConflictDoUpdate({
            target: schema.auditLogs.id,
            set: {
              timestamp: sql`EXCLUDED.timestamp`,
              user: sql`EXCLUDED."user"`,
              action: sql`EXCLUDED.action`,
              details: sql`EXCLUDED.details`,
              ipAddress: sql`EXCLUDED.ip_address`,
            },
          });
        }
      }
    }

    // 3.11. Save User Account
    if (data.userAccount && typeof data.userAccount === "object") {
      const u = data.userAccount;
      await db.insert(schema.userAccount).values({
        id: "account",
        username: u.username ? String(u.username) : null,
        phone: u.phone ? String(u.phone) : null,
        email: u.email ? String(u.email) : null,
        walletBalance: typeof u.walletBalance === "number" ? u.walletBalance : 0,
        transactions: u.transactions || null,
        activeEventId: u.activeEventId ? String(u.activeEventId) : null,
      }).onConflictDoUpdate({
        target: schema.userAccount.id,
        set: {
          username: u.username ? String(u.username) : null,
          phone: u.phone ? String(u.phone) : null,
          email: u.email ? String(u.email) : null,
          walletBalance: typeof u.walletBalance === "number" ? u.walletBalance : 0,
          transactions: u.transactions || null,
          activeEventId: u.activeEventId ? String(u.activeEventId) : null,
        }
      });
    }

    // 3.12. Save UWALEMI Community State to PostgreSQL
    if (data.uwalemiState && typeof data.uwalemiState === "object") {
      await db.insert(schema.uwalemiStateTable).values({
        id: "state",
        data: data.uwalemiState,
      }).onConflictDoUpdate({
        target: schema.uwalemiStateTable.id,
        set: {
          data: sql`EXCLUDED.data`,
          updatedAt: sql`now()`,
        }
      });
    }

    console.log("[CloudSQL Core] State was successfully synchronized and written to PostgreSQL.");
  });
}
