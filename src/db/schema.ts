import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  senderId: text("sender_id"),
  name: text("name").notNull(),
  date: text("date"),
  time: text("time"),
  period: text("period"),
  eventHallName: text("event_hall_name"),
  coordinates: text("coordinates"),
  hostName: text("host_name"),
  dressCode: text("dress_code"),
  contact1: text("contact_1"),
  contact1Name: text("contact_1_name"),
  contact2: text("contact_2"),
  contact2Name: text("contact_2_name"),
  contact3: text("contact_3"),
  contact3Name: text("contact_3_name"),
  mapsLink: text("maps_link"),
  eventImgUrl: text("event_img_url"),
  messageLogs: jsonb("message_logs"),
  smsTemplates: jsonb("sms_templates"),
  paymentMethods: jsonb("payment_methods"),
  contributionsEnabled: boolean("contributions_enabled").default(false),
  fundraisingGoal: integer("fundraising_goal").default(0),
  autoRsvpRemindersEnabled: boolean("auto_rsvp_reminders_enabled").default(false),
  contributionDeadline: text("contribution_deadline"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const guests = pgTable("guests", {
  id: text("id").primaryKey(),
  eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  cardType: text("card_type").notNull(),
  smsStatus: text("sms_status").default("Sijatuma"),
  whatsappStatus: text("whatsapp_status").default("Sijatuma"),
  rsvpStatus: text("rsvp_status").default("Bado"),
  maxGuests: integer("max_guests").default(1),
  rsvpGuestsCount: integer("rsvp_guests_count").default(0),
  rsvpComment: text("rsvp_comment"),
  checkedIn: boolean("checked_in").default(false),
  checkedInTime: text("checked_in_time"),
  photoUrl: text("photo_url"),
  cardImageUrl: text("card_image_url"),
  smsCount: integer("sms_count").default(0),
  whatsappCount: integer("whatsapp_count").default(0),
  category: text("category"),
  pledgeAmount: integer("pledge_amount").default(0),
  paidAmount: integer("paid_amount").default(0),
  pledgeStatus: text("pledge_status").default("No Pledge"),
  payments: jsonb("payments"),
  rsvpUpdatedAt: text("rsvp_updated_at"),
  rsvpSeen: boolean("rsvp_seen").default(true),
  customFields: jsonb("custom_fields"),
  tags: jsonb("tags"),
});

export const saveTheDates = pgTable("save_the_dates", {
  id: text("id").primaryKey(),
  eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  imageUrl: text("image_url"),
  createdAt: text("created_at"),
});

export const saveTheDateRecipients = pgTable("save_the_date_recipients", {
  id: text("id").primaryKey(),
  saveTheDateId: text("save_the_date_id").references(() => saveTheDates.id, { onDelete: "cascade" }),
  guestId: text("guest_id").references(() => guests.id, { onDelete: "cascade" }),
  sentAt: text("sent_at"),
  status: text("status").default("Pending"),
});

export const templateSettings = pgTable("template_settings", {
  id: text("id").primaryKey(), // Usually "default" or "event-<id>"
  imageUrl: text("image_url").notNull(),
  textColor: text("text_color").default("#333333"),
  fontFamily: text("font_family").default("Inter"),
  guestNameX: integer("guest_name_x").default(50),
  guestNameY: integer("guest_name_y").default(50),
  guestNameSize: integer("guest_name_size").default(24),
  guestNameColor: text("guest_name_color"),
  qrCodeX: integer("qr_code_x").default(50),
  qrCodeY: integer("qr_code_y").default(70),
  qrCodeSize: integer("qr_code_size").default(120),
  qrCodeColor: text("qr_code_color"),
  cardTypeX: integer("card_type_x").default(50),
  cardTypeY: integer("card_type_y").default(25),
  cardTypeSize: integer("card_type_size").default(16),
  cardTypeColor: text("card_type_color"),
  orientation: text("orientation").default("portrait"),
});

export const smsGatewaySettings = pgTable("sms_gateway_settings", {
  id: text("id").primaryKey(), // "settings"
  provider: text("provider").default("simulation"),
  url: text("url"),
  apiKey: text("api_key"),
  apiSecret: text("api_secret"),
  senderId: text("sender_id"),
  senderIdStatus: text("sender_id_status").default("approved"),
  whatsappUrl: text("whatsapp_url"),
  customHeaders: text("custom_headers").default("{}"),
  customBody: text("custom_body").default("{\n  \"to\": \"{to}\",\n  \"message\": \"{message}\"\n}"),
});

export const committeeMembers = pgTable("committee_members", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  position: text("position").default("Committee Member"),
  permissionLevel: text("permission_level").default("Summary Access"),
  token: text("token"),
});

export const committeeRoles = pgTable("committee_roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  permissionLevel: text("permission_level").notNull(),
  description: text("description"),
});

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  user: text("user").notNull(),
  action: text("action").notNull(),
  details: text("details").notNull(),
  ipAddress: text("ip_address"),
});

export const userAccount = pgTable("user_account", {
  id: text("id").primaryKey(), // "account"
  username: text("username"),
  phone: text("phone"),
  email: text("email"),
  walletBalance: integer("wallet_balance").default(0),
  transactions: jsonb("transactions"),
  activeEventId: text("active_event_id"),
});

export const uwalemiStateTable = pgTable("uwalemi_state", {
  id: text("id").primaryKey(), // "state"
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
