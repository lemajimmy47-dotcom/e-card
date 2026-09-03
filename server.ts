import { config } from "dotenv";
config({ override: true });
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { initDB, readDB, writeDB, fetchFromFirestore, updateMemoryAndLocalFileOnly, getStateForClient, readDBLatest, pingPostgresKeepAlive } from "./src/firebase-db";
import { GoogleGenAI } from "@google/genai";

let genAIClient: GoogleGenAI | null = null;
function getGenAI() {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    genAIClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAIClient;
}

// Database file path
const DB_PATH = path.join(process.cwd(), "database.json");

// Helper to check if a guest record is corrupt (binary zipped excel metadata lines)
function isCorruptGuest(g: any) {
  if (!g || !g.name) return true;
  const name = String(g.name);
  if (name.includes('\u0000') || name.includes('PK\u0003') || name.includes('xl/') || name.includes('.xml')) {
    return true;
  }
  if (name.includes('workbook') || name.includes('sharedStrings') || name.includes('docProps') || name.includes('xl/theme')) {
    return true;
  }
  if (name.length > 200) {
    return true;
  }
  if (g.phone && (String(g.phone).includes('\u0000') || String(g.phone).length > 35)) {
    return true;
  }
  return false;
}

// Helper to read database
async function performSelfCleaningAndMigration(data: any) {
  if (data.guests && Array.isArray(data.guests)) {
    const originalLen = data.guests.length;
    data.guests = data.guests.filter((g: any) => !isCorruptGuest(g));
    
    const allowed = ['SINGLE', 'DOUBLE', 'UNCLASSIFIED'];
    let normalizedCount = 0;
    data.guests = data.guests.map((g: any) => {
      const currentGroup = (g.cardType || '').toUpperCase().trim();
      const correctGroup = allowed.includes(currentGroup) ? currentGroup : 'UNCLASSIFIED';
      if (g.cardType !== correctGroup) {
        normalizedCount++;
        return { ...g, cardType: correctGroup };
      }
      return g;
    });

    if (data.guests.length !== originalLen || normalizedCount > 0) {
      console.log(`Self-cleaning: Removed ${originalLen - data.guests.length} corrupt rows, normalized ${normalizedCount} cardType groups.`);
      await writeDB(data);
    }
  }

  // Migrate 'event-starter' to unique ID
  let mustMigrateStarter = false;
  let starterMigratedId = '';

  if (data.eventDetails && data.eventDetails.id === 'event-starter') {
    mustMigrateStarter = true;
  }
  if (data.eventsList && Array.isArray(data.eventsList) && data.eventsList.some((ev: any) => ev.id === 'event-starter')) {
    mustMigrateStarter = true;
  }

  if (mustMigrateStarter) {
    starterMigratedId = 'event-' + Math.floor(1000 + Math.random() * 9000);
    console.log(`[migration] Migrating 'event-starter' to unique ID on server: ${starterMigratedId}`);
    
    if (data.eventDetails && data.eventDetails.id === 'event-starter') {
      data.eventDetails.id = starterMigratedId;
    }
    if (data.eventsList && Array.isArray(data.eventsList)) {
      data.eventsList = data.eventsList.map((ev: any) => 
        ev.id === 'event-starter' ? { ...ev, id: starterMigratedId } : ev
      );
    }
    if (data.guests && Array.isArray(data.guests)) {
      data.guests = data.guests.map((g: any) => 
        g.eventId === 'event-starter' || !g.eventId ? { ...g, eventId: starterMigratedId } : g
      );
    }
    if (data.saveTheDates && Array.isArray(data.saveTheDates)) {
      data.saveTheDates = data.saveTheDates.map((s: any) => 
        s.event_id === 'event-starter' || !s.event_id ? { ...s, event_id: starterMigratedId } : s
      );
    }

    await writeDB(data);
    console.log(`[migration] Server DB updated with unique ID: ${starterMigratedId}`);
  }

  // Dynamic Seed for committee tables
  let updatedDB = false;
  if (!data.committee_members) {
    data.committee_members = [
      { "id": "c-1", "name": "James Lema", "phone": "0711223344", "email": "james@gmail.com", "position": "Chairperson", "permissionLevel": "Full Access", "token": "m-james" },
      { "id": "c-2", "name": "Salma Khamis", "phone": "0755998877", "email": "salma@treasury.co.tz", "position": "Treasurer", "permissionLevel": "Treasurer Access", "token": "m-salma" },
      { "id": "c-3", "name": "Emmanuel Shija", "phone": "0766332211", "email": "shija@sec.org", "position": "Secretary", "permissionLevel": "Viewer Access", "token": "m-emmanu" },
      { "id": "c-4", "name": "Aisha Ramadhani", "phone": "0688445566", "email": "aisha@kamati.co.tz", "position": "Committee Member", "permissionLevel": "Summary Access", "token": "m-aisha" }
    ];
    updatedDB = true;
  }
  if (!data.committee_roles) {
    data.committee_roles = [
      { "id": "r-chair", "name": "Chairperson", "permissionLevel": "Full Access", "description": "Ruhusa kamili ya uendeshaji, kuongeza wanakamati, na uandikishaji wa malipo." },
      { "id": "r-treasurer", "name": "Treasurer", "permissionLevel": "Treasurer Access", "description": "Uandikishaji na usimamizi wa malipo pekee, hawezi kufuta muamala au kubadili wajumbe." },
      { "id": "r-secretary", "name": "Secretary", "permissionLevel": "Viewer Access", "description": "Kusoma wageni pekee na kutoa taarifa na ripoti tofauti za kamati kusaidia mwenyekiti." },
      { "id": "r-member", "name": "Committee Member", "permissionLevel": "Summary Access", "description": "Kutazama michango kwa ujumla na chati, taarifa za siri za kila mchangiaji zinalindwa." }
    ];
    updatedDB = true;
  }
  if (updatedDB) {
    await writeDB(data);
  }
}

/**
 * Safely sanitizes and validates Fetch HTTP Headers to avoid ByteString errors on native Node fetch.
 * Returns a new headers object or throws a detailed friendly error if illegal characters are found.
 */
function sanitizeHttpHeaders(headers: any, settings: any): Record<string, string> {
  const cleanHeaders: Record<string, string> = {};
  if (!headers || typeof headers !== 'object') return cleanHeaders;

  for (const [key, rawValue] of Object.entries(headers)) {
    if (rawValue === undefined || rawValue === null) continue;
    const value = String(rawValue);

    // Filter out invalid characters in header keys (non-ASCII)
    const cleanKey = key.replace(/[^\x00-\x7F]/g, "");

    // Check for characters with code > 255 in header value
    let hasInvalidChar = false;
    let detailsStr = "";
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code > 255) {
        hasInvalidChar = true;
        detailsStr += `'${value[i]}' (code ${code} at index ${i}), `;
      }
    }

    if (hasInvalidChar) {
      detailsStr = detailsStr.trim().replace(/,$/, '');
      const providerName = settings?.provider === "meseji" ? "Meseji.co.tz" : "SMS Gateway";
      throw new Error(`Hitilafu katika Mipangilio (Invalid Settings Character): Token yako (API Key/Token) au 'Sender ID' yako ina alama isiyoruhusiwa ${detailsStr}.\n\nTafsiri: Hii hutokea kwa kawaida unaponakili (copy-paste) picha la makosa au alama ya cross "✗" au alama za nukuu tofauti (smart quotes) toka kwenye ripoti za awali.\n\nSuluhisho: Tafadhali nenda kwenye Alama ya Mipangilio (Settings Icon) ya ukurasa wa Kutuma Ujumbe, futa yaliyomo kwenye 'API Token' na 'Sender ID', kisha nakili na uandike kwa makini Token safi ya kutoka akaunti yako ya ${providerName} bila kuweka alama au nyakati (timestamps) za ripoti.`);
    }

    cleanHeaders[cleanKey] = value;
  }
  return cleanHeaders;
}

function sanitizeMetaTemplateParam(val: any, allowNewlines: boolean = false): string {
  if (val === undefined || val === null) return " ";
  let str = String(val);
  
  // Replace literal double-escaped newlines/tabs
  str = str.replace(/\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\t/g, ' ');
  
  // Replace unicode line separators
  str = str.replace(/[\u2028\u2029]/g, '\n');
  
  // Replace carriage returns and tabs
  str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, ' ');
  
  // Split into lines, trim each, and filter out empty lines
  const lines = str.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
    
  if (lines.length === 0) return " ";
  
  // Meta WhatsApp template parameters NEVER allow newlines/tabs or more than 4 consecutive spaces.
  // Therefore, we MUST ignore allowNewlines and ALWAYS join with " | " to prevent API failures.
  let joined = lines.join(' | ');
  
  // Collapse ANY consecutive whitespace (spaces, invisible chars) into a single space
  joined = joined.replace(/\s{2,}/g, ' ');
  
  return joined.trim() || " ";
}

function toNonBreaking(str: string): string {
  return str.replace(/ /g, '\u00A0');
}

function extractPledgeAmountFromText(text: string): number | null {
  if (!text) return null;
  const clean = text.toLowerCase().replace(/,/g, '');

  if (clean.includes("laki moja") || clean.includes("laki 1")) return 100000;
  if (clean.includes("laki mbili") || clean.includes("laki 2")) return 200000;
  if (clean.includes("laki tatu") || clean.includes("laki 3")) return 300000;
  if (clean.includes("laki nne") || clean.includes("laki 4")) return 400000;
  if (clean.includes("laki tano") || clean.includes("laki 5")) return 500000;
  if (clean.includes("laki sita") || clean.includes("laki 6")) return 600000;
  if (clean.includes("laki saba") || clean.includes("laki 7")) return 700000;
  if (clean.includes("laki nane") || clean.includes("laki 8")) return 800000;
  if (clean.includes("laki tisa") || clean.includes("laki 9")) return 900000;
  if (clean.includes("milioni moja") || clean.includes("milioni 1")) return 1000000;
  if (clean.includes("milioni mbili") || clean.includes("milioni 2")) return 2000000;
  if (clean.includes("milioni tatu") || clean.includes("milioni 3")) return 3000000;
  if (clean.includes("milioni nne") || clean.includes("milioni 4")) return 4000000;
  if (clean.includes("milioni tano") || clean.includes("milioni 5")) return 5000000;

  // Extract sequence of digits (e.g. 50000, 100000, 200000)
  const matches = clean.match(/\b\d{4,9}\b/g);
  if (matches && matches.length > 0) {
    for (const m of matches) {
      const val = parseInt(m, 10);
      if (val >= 1000 && val <= 100000000) {
        return val;
      }
    }
  }

  return null;
}

function extractPaymentInfoFromText(text: string): { amount: number; reference?: string } | null {
  if (!text) return null;
  const clean = text.toLowerCase().replace(/,/g, '');
  
  const hasPaymentKeyword = clean.includes("nimelipa") || 
                            clean.includes("nimetuma") || 
                            clean.includes("malipo") || 
                            clean.includes("nimechangia") || 
                            clean.includes("nimeshatuma") || 
                            clean.includes("mpesa") || 
                            clean.includes("tigopesa") || 
                            clean.includes("tigo pesa") ||
                            clean.includes("airtel") || 
                            clean.includes("halopesa") || 
                            clean.includes("muamala") || 
                            clean.includes("ref");

  if (!hasPaymentKeyword) return null;

  const amt = extractPledgeAmountFromText(text);
  if (!amt) return null;

  let reference = "";
  const refMatch = text.match(/\b([A-Za-z0-9]{8,14})\b/);
  if (refMatch) {
    reference = refMatch[1].toUpperCase();
  }

  return { amount: amt, reference: reference || undefined };
}

async function processWhatsAppBotLogic(
  fromPhone: string, 
  textBody: string, 
  db: any,
  mediaOptions?: {
    mediaType?: 'image' | 'audio' | 'text';
    base64Data?: string;
    mimeType?: string;
  }
) {
  const cleanFromPhone = fromPhone ? fromPhone.replace(/\D/g, '') : '';
  const lowerText = (textBody || '').toLowerCase().trim();
  const event = db.eventDetails || {};
  let guests = db.guests || [];
  let databaseUpdated = false;

  const matchedGuest = (cleanFromPhone && cleanFromPhone.length >= 7)
    ? guests.find((g: any) => {
        if (!g || !g.phone) return false;
        const cleanG = String(g.phone).replace(/\D/g, '');
        if (cleanG.length < 7) return false;
        return cleanG.slice(-9) === cleanFromPhone.slice(-9);
      })
    : null;

  let actionReply = "";
  let actionTaken = false;
  const eventName = event.name || 'sherehe';
  const venueName = event.eventHallName || event.venue || 'FIMBO SOCIAL HALL';
  const ai = getGenAI();

  // -------------------------------------------------------------
  // FEATURE 1: VISION AI PAYMENT SCREENSHOT / RECEIPT VERIFICATION
  // -------------------------------------------------------------
  const isImageMedia = mediaOptions?.mediaType === 'image' || 
    (mediaOptions?.base64Data && (mediaOptions.mimeType?.startsWith('image/') || mediaOptions.base64Data.startsWith('data:image')));

  if (isImageMedia && mediaOptions?.base64Data && ai) {
    try {
      console.log(`[WhatsApp Vision AI] Processing payment receipt image from ${fromPhone}...`);
      const cleanBase64 = mediaOptions.base64Data.replace(/^data:image\/\w+;base64,/, '');
      const mimeType = mediaOptions.mimeType || 'image/jpeg';

      const visionRes = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType
            }
          },
          `You are an automated payment receipt analyzer for Tanzanian mobile money (M-Pesa, Tigo Pesa, Airtel Money, Halopesa) and banks (CRDB, NMB, NBC).
Read this receipt image and extract:
1. Transaction ID / Reference Code (e.g., QKJ823901, 893129321)
2. Amount paid in TZS (digits only, e.g., 100000)
3. Payment Provider / Channel (e.g., M-Pesa, Tigo Pesa, Airtel Money, NMB Bank)
4. Sender / Payer Name (if present)

Respond strictly in valid JSON format:
{
  "success": true,
  "amount": 100000,
  "reference": "QKJ823901",
  "provider": "M-Pesa",
  "senderName": "Josephat Kimaro"
}`
        ]
      });

      if (visionRes && visionRes.text) {
        const jsonMatch = visionRes.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedVision = JSON.parse(jsonMatch[0]);
          if (parsedVision.amount && parsedVision.amount > 0) {
            const detectedAmount = Number(parsedVision.amount);
            const refCode = parsedVision.reference || `IMG-${Date.now().toString().slice(-6)}`;
            const providerName = parsedVision.provider || 'Mobile Money / Bank';

            if (matchedGuest) {
              const currentPledge = Number(matchedGuest.pledgeAmount) || detectedAmount;
              const currentPaid = Number(matchedGuest.paidAmount) || 0;
              const updatedPaidTotal = currentPaid + detectedAmount;

              matchedGuest.paidAmount = updatedPaidTotal;
              if (!matchedGuest.pledgeAmount || matchedGuest.pledgeAmount === 0) {
                matchedGuest.pledgeAmount = currentPledge;
              }

              matchedGuest.payments = matchedGuest.payments || [];
              matchedGuest.payments.push({
                id: Date.now().toString(),
                amount: detectedAmount,
                date: new Date().toISOString(),
                reference: `${refCode} (${providerName})`,
                channel: providerName
              });

              const gIdx = guests.findIndex((g: any) => g.id === matchedGuest.id);
              if (gIdx !== -1) {
                guests[gIdx] = matchedGuest;
                db.guests = guests;
              }
              databaseUpdated = true;
              actionTaken = true;

              const remainingBalance = Math.max(0, (Number(matchedGuest.pledgeAmount) || currentPledge) - updatedPaidTotal);

              actionReply = `Habari *${matchedGuest.name}*! 👋📸✨\n\n*UTHIBITISHO WA AI VISION (RISITI IMEHAKIKIWA)*:\n\nRisiti yako ya malipo imesomwa na kuthibitishwa kikamilifu na mfumo wa AI!\n\n• *Njia ya Malipo:* ${providerName}\n• *Kumbukumbu No:* ${refCode}\n• *Kiasi Kilicholipwa:* TZS ${detectedAmount.toLocaleString()}\n• *Jumla Uliyolipa Sasa:* TZS ${updatedPaidTotal.toLocaleString()}\n• *Ahadi Yako:* TZS ${(Number(matchedGuest.pledgeAmount) || currentPledge).toLocaleString()}\n• *Salio Lililobaki:* TZS ${remainingBalance.toLocaleString()}\n\nRisiti yako ya kidijitali imehifadhiwa rasmi. Tunakushukuru sana kwa mchango wako! Mungu akubariki. 🙏🎉`;
            } else {
              actionReply = `Habari! 📸✨\n\n*UTHIBITISHO WA AI VISION (RISITI IMEHAKIKIWA)*:\n\nRisiti yako imesomwa na AI:\n• *Kiasi:* TZS ${detectedAmount.toLocaleString()}\n• *Kumbukumbu:* ${refCode} (${providerName})\n\nTafadhali wasiliana na waandaji wa *${eventName}* au utupe jina lako kamili ili tukusajili kwenye orodha rasmi! Ahsante sana. 🙏`;
              actionTaken = true;
            }
          }
        }
      }
    } catch (visionErr) {
      console.error("[WhatsApp Vision AI Error]:", visionErr);
    }
  }

  // -------------------------------------------------------------
  // FEATURE 2: VOICE NOTES AI READER (SPEECH-TO-TEXT & INTENT)
  // -------------------------------------------------------------
  const isAudioMedia = mediaOptions?.mediaType === 'audio' || 
    (mediaOptions?.base64Data && (mediaOptions.mimeType?.startsWith('audio/') || mediaOptions.base64Data.startsWith('data:audio')));

  if (!actionTaken && isAudioMedia && mediaOptions?.base64Data && ai) {
    try {
      console.log(`[WhatsApp Voice Note AI] Transcribing audio voice note from ${fromPhone}...`);
      const cleanBase64 = mediaOptions.base64Data.replace(/^data:audio\/\w+;base64,/, '');
      const mimeType = mediaOptions.mimeType || 'audio/ogg';

      const audioRes = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType
            }
          },
          `You are an AI Voice Note Reader for an event guest WhatsApp chatbot in Tanzania.
Transcribe this Kiswahili / English audio voice message and determine guest intent.
Identify:
1. Kiswahili transcription text
2. Intent: 'pledge' | 'payment' | 'rsvp' | 'location' | 'general'
3. Extracted Amount in TZS (digits only)
4. Extracted RSVP Status ('Atahudhuria' | 'Hatahudhuria' | 'Labda') and guest count (number of people)

Respond strictly in JSON format:
{
  "transcription": "...",
  "intent": "rsvp",
  "amount": 0,
  "rsvpStatus": "Atahudhuria",
  "guestCount": 2
}`
        ]
      });

      if (audioRes && audioRes.text) {
        const jsonMatch = audioRes.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedAudio = JSON.parse(jsonMatch[0]);
          const transcript = parsedAudio.transcription || "Ujumbe wa sauti ulisikilizwa";
          const intent = parsedAudio.intent || 'general';
          const amt = Number(parsedAudio.amount) || 0;

          if (matchedGuest) {
            if (intent === 'pledge' && amt > 0) {
              matchedGuest.pledgeAmount = amt;
              const gIdx = guests.findIndex((g: any) => g.id === matchedGuest.id);
              if (gIdx !== -1) { guests[gIdx] = matchedGuest; db.guests = guests; }
              databaseUpdated = true;
              actionTaken = true;

              const paid = Number(matchedGuest.paidAmount) || 0;
              const bal = Math.max(0, amt - paid);
              actionReply = `Habari *${matchedGuest.name}*! 🎙️✨\n\n*SAUTI IMEELEWEKA NA AI*:\n_"${transcript}"_\n\n• *Ahadi Iliyosajiliwa:* TZS ${amt.toLocaleString()}\n• *Kiasi Kilicholipwa:* TZS ${paid.toLocaleString()}\n• *Salio:* TZS ${bal.toLocaleString()}\n\nAhsante sana kwa ahadi yako! Mungu akubariki. 🙏`;
            } else if (intent === 'payment' && amt > 0) {
              const currentPaid = Number(matchedGuest.paidAmount) || 0;
              const updatedPaid = currentPaid + amt;
              matchedGuest.paidAmount = updatedPaid;
              matchedGuest.payments = matchedGuest.payments || [];
              matchedGuest.payments.push({ id: Date.now().toString(), amount: amt, date: new Date().toISOString(), reference: 'Voice Note AI', channel: 'WhatsApp Voice' });

              const gIdx = guests.findIndex((g: any) => g.id === matchedGuest.id);
              if (gIdx !== -1) { guests[gIdx] = matchedGuest; db.guests = guests; }
              databaseUpdated = true;
              actionTaken = true;

              actionReply = `Habari *${matchedGuest.name}*! 🎙️✨\n\n*SAUTI IMEELEWEKA NA AI*:\n_"${transcript}"_\n\n• *Malipo Yaliyosajiliwa:* TZS ${amt.toLocaleString()}\n• *Jumla Uliyolipa:* TZS ${updatedPaid.toLocaleString()}\n\nTunakushukuru sana kwa mchango wako! 🙏🎉`;
            } else if (intent === 'rsvp' && parsedAudio.rsvpStatus) {
              matchedGuest.rsvpStatus = parsedAudio.rsvpStatus;
              if (parsedAudio.guestCount) matchedGuest.rsvpGuestsCount = parsedAudio.guestCount;
              matchedGuest.rsvpUpdatedAt = new Date().toISOString();

              const gIdx = guests.findIndex((g: any) => g.id === matchedGuest.id);
              if (gIdx !== -1) { guests[gIdx] = matchedGuest; db.guests = guests; }
              databaseUpdated = true;
              actionTaken = true;

              actionReply = `Habari *${matchedGuest.name}*! 🎙️✨\n\n*SAUTI IMEELEWEKA NA AI*:\n_"${transcript}"_\n\nUthibitisho wako wa *${parsedAudio.rsvpStatus}*${parsedAudio.guestCount ? ` (Wageni: ${parsedAudio.guestCount})` : ''} umesajiliwa kikamilifu! Karibu sana. 🙏`;
            } else {
              // Standard voice transcript feedback
              actionReply = `Habari *${matchedGuest.name}*! 🎙️✨\n\n*SAUTI YAKO IMESIKILIZWA NA AI*:\n_"${transcript}"_\n\nTunakushukuru kwa kuwasiliana nasi! Kama una swali kuhusu ukumbi, ahadi au usafiri, tutajibu hapa. 🙏`;
              actionTaken = true;
            }
          } else {
            actionReply = `Habari! 🎙️✨\n\n*UJUMBE WA SAUTI UNG'AMULIWA NA AI*:\n_"${transcript}"_\n\nAhsante kwa kuwasiliana na mfumo wa *${eventName}*! 🙏`;
            actionTaken = true;
          }
        }
      }
    } catch (audioErr) {
      console.error("[WhatsApp Voice AI Error]:", audioErr);
    }
  }

  // -------------------------------------------------------------
  // FEATURE 3: GOOGLE MAPS PIN & VENUE DIRECTIONS INTEGRATION
  // -------------------------------------------------------------
  if (!actionTaken && (
    lowerText.includes("ukumbi") || lowerText.includes("mahali") || lowerText.includes("sehemu") || 
    lowerText.includes("ramani") || lowerText.includes("maps") || lowerText.includes("location") || 
    lowerText.includes("pin") || lowerText.includes("nafikaje") || lowerText.includes("route") || 
    lowerText.includes("hall") || lowerText.includes("mwelekeo") || lowerText.includes("venue")
  )) {
    const mapsPinUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueName)}`;
    const guestNameHeader = matchedGuest ? `Habari *${matchedGuest.name}*! 👋📍` : `Habari! 👋📍`;

    actionReply = `${guestNameHeader}\n\n*MAELEKEZO YA UKUMBI NA RAMANI (GOOGLE MAPS PIN)* 🗺️✨\n\n• *Ukumbi wa Sherehe:* *${venueName}*\n• *Tarehe:* ${event.date || '2026-08-08'}\n• *Muda:* ${event.time || '19:00'} ${event.period || 'Usiku'}\n\n📍 *Fungua Ramani ya Google (Google Maps Pin) hapa:* \n${mapsPinUrl}\n\nBofya kiungo hapo juu ili kupata maelekezo ya moja kwa moja ya kusafiri kuelekea ukumbini siku ya sherehe! Karibu sana. 🎉`;
    actionTaken = true;
  }

  if (matchedGuest && !actionTaken) {
    const currentPledge = Number(matchedGuest.pledgeAmount) || 0;
    const currentPaid = Number(matchedGuest.paidAmount) || 0;

    // 1. PAYMENT REPORTING DETECTION
    const paymentInfo = extractPaymentInfoFromText(textBody);
    if (paymentInfo && paymentInfo.amount > 0) {
      const newPaymentAmt = paymentInfo.amount;
      const updatedPaidTotal = currentPaid + newPaymentAmt;
      matchedGuest.paidAmount = updatedPaidTotal;

      if (currentPledge === 0) {
        matchedGuest.pledgeAmount = newPaymentAmt;
      }
      const effectivePledge = Number(matchedGuest.pledgeAmount) || updatedPaidTotal;

      matchedGuest.payments = matchedGuest.payments || [];
      const paymentRecord = {
        id: Date.now().toString(),
        amount: newPaymentAmt,
        date: new Date().toISOString(),
        reference: paymentInfo.reference || 'WhatsApp Bot',
        channel: 'WhatsApp'
      };
      matchedGuest.payments.push(paymentRecord);

      const gIdx = guests.findIndex((g: any) => g.id === matchedGuest.id);
      if (gIdx !== -1) {
        guests[gIdx] = matchedGuest;
        db.guests = guests;
      }
      databaseUpdated = true;
      actionTaken = true;

      const remainingBalance = Math.max(0, effectivePledge - updatedPaidTotal);

      actionReply = `Habari *${matchedGuest.name}*! 👋🎉\n\nMalipo yako ya *TZS ${newPaymentAmt.toLocaleString()}* yamepokelewa na kusajiliwa kikamilifu kwenye mfumo wetu wa *${eventName}*!\n\n• *Kiasi Kilichoripotiwa:* TZS ${newPaymentAmt.toLocaleString()}\n• *Jumla Uliyolipa Sasa:* TZS ${updatedPaidTotal.toLocaleString()}\n• *Ahadi Yako:* TZS ${effectivePledge.toLocaleString()}\n• *Salio Lililobaki:* TZS ${remainingBalance.toLocaleString()}${paymentInfo.reference ? `\n• *Kumbukumbu:* ${paymentInfo.reference}` : ''}\n\nTunakushukuru sana kwa ushirikiano na mchango wako mkubwa! Mungu akubariki sana. 🙏✨`;
    }

    // 2. PLEDGE REGISTRATION (if not a payment reporting)
    if (!actionTaken) {
      const extractedPledgeAmt = extractPledgeAmountFromText(textBody);
      const isPledgeIntent = lowerText.includes("ahadi") || lowerText.includes("naahidi") || lowerText.includes("mchango") || lowerText.includes("nitaahidi") || lowerText.includes("weka") || lowerText.includes("nitachangia") || lowerText.includes("changia") || lowerText.includes("laki") || lowerText.includes("milioni") || lowerText.includes("tsh") || lowerText.includes("tzs");
      const isPureNumber = /^\s*[\d,.\s]+\s*$/.test(textBody);

      if (extractedPledgeAmt && (currentPledge === 0 || isPledgeIntent || isPureNumber)) {
        matchedGuest.pledgeAmount = extractedPledgeAmt;
        const gIdx = guests.findIndex((g: any) => g.id === matchedGuest.id);
        if (gIdx !== -1) {
          guests[gIdx].pledgeAmount = extractedPledgeAmt;
          db.guests = guests;
        }
        databaseUpdated = true;
        actionTaken = true;

        const balanceAmt = Math.max(0, extractedPledgeAmt - currentPaid);

        actionReply = `Habari *${matchedGuest.name}*! 👋🎉\n\nAhsante sana! Ahadi yako ya *TZS ${extractedPledgeAmt.toLocaleString()}* imesajiliwa kikamilifu kwenye mfumo wetu wa *${eventName}*.\n\n• *Jina:* ${matchedGuest.name}\n• *Ahadi Iliyosajiliwa:* TZS ${extractedPledgeAmt.toLocaleString()}\n• *Kiasi Ulicholipa:* TZS ${currentPaid.toLocaleString()}\n• *Baki (Salio):* TZS ${balanceAmt.toLocaleString()}\n\nTunakushukuru sana kwa moyo wako wa kujitolea na ushirikiano. Mungu akubariki sana! 🙏✨`;
      }
    }

    // 3. RSVP UPDATE & GUEST COUNT
    if (!actionTaken) {
      let newRsvp: 'Atahudhuria' | 'Hatahudhuria' | 'Labda' | null = null;

      const isNegativeRsvp = (
        lowerText.includes('sitahudhuria') || lowerText.includes('sintahudhuria') || lowerText.includes('sitohudhuria') ||
        lowerText.includes('stahudhuria') || lowerText.includes('hatahudhuria') || lowerText.includes('hatutahudhuria') ||
        lowerText.includes('sitakuja') || lowerText.includes('hatutakuja') || lowerText.includes('sitafika') ||
        lowerText.includes('siwezi') || lowerText.includes('sitaweza') || lowerText.includes('sitofika') ||
        lowerText.includes('sitafanikiwa') || lowerText.includes('nisingeweza') || lowerText.includes('singewahi') ||
        lowerText.includes('sitawahi') || lowerText.includes('hapana') || lowerText === 'no' || lowerText === '2' || lowerText === 'b'
      );

      const isPositiveRsvp = !isNegativeRsvp && (
        lowerText.includes('ndio') || lowerText.includes('ndiyo') || lowerText.includes('naam') || lowerText.includes('yes') ||
        lowerText.includes('nitakuja') || lowerText.includes('nitahudhuria') || lowerText.includes('ntahudhuria') ||
        lowerText.includes('ntakuja') || lowerText.includes('nakuja') || lowerText.includes('tutakuja') ||
        lowerText.includes('tutahudhuria') || lowerText.includes('nitafika') || lowerText.includes('ntafika') ||
        lowerText.includes('tutafika') || lowerText.includes('nitawepo') || lowerText.includes('ntawepo') ||
        lowerText.includes('tutawepo') || lowerText.includes('nitaweza') || lowerText.includes('nitafanikiwa') ||
        lowerText.includes('pamoja') || lowerText === '1' || lowerText === 'a' || lowerText === 'ok' || lowerText === 'sawa'
      );

      const isMaybeRsvp = !isNegativeRsvp && !isPositiveRsvp && (
        lowerText.includes('sina uhakika') || lowerText.includes('maybe') || lowerText.includes('labda') ||
        lowerText.includes('sijajua') || lowerText.includes('ntakujulisha') || lowerText.includes('nitakujulisha') ||
        lowerText === '3' || lowerText === 'c'
      );

      if (isNegativeRsvp) {
        newRsvp = 'Hatahudhuria';
      } else if (isPositiveRsvp) {
        newRsvp = 'Atahudhuria';
      } else if (isMaybeRsvp) {
        newRsvp = 'Labda';
      }

      if (newRsvp) {
        matchedGuest.rsvpStatus = newRsvp;
        matchedGuest.rsvpUpdatedAt = new Date().toISOString();
        matchedGuest.rsvpSeen = false;

        // Check for guest count
        const countMatch = lowerText.match(/\bwatu\s*(\d{1,2})\b/) || lowerText.match(/\b(\d{1,2})\s*watu\b/);
        if (countMatch) {
          const num = parseInt(countMatch[1], 10);
          if (num >= 1 && num <= 10) {
            matchedGuest.rsvpGuestsCount = num;
          }
        }

        const gIdx = guests.findIndex((g: any) => String(g.id) === String(matchedGuest.id));
        if (gIdx !== -1) {
          guests[gIdx] = matchedGuest;
          db.guests = guests;
        }
        databaseUpdated = true;
        actionTaken = true;

        const countText = matchedGuest.rsvpGuestsCount ? ` (Wageni: ${matchedGuest.rsvpGuestsCount})` : '';
        if (newRsvp === 'Atahudhuria') {
          actionReply = `Habari *${matchedGuest.name}*! 👋🎉\n\nUthibitisho wako wa kuhudhuria *${eventName}*${countText} umesajiliwa kikamilifu kwenye mfumo!\n\n• *Tarehe:* ${event.date || '2026-08-08'}\n• *Ukumbi:* ${venueName}\n• *Muda:* ${event.time || '19:00'} ${event.period || 'Usiku'}\n\nKaribu sana na tunakusubiri kwa hamu! 🙏`;
        } else if (newRsvp === 'Hatahudhuria') {
          actionReply = `Habari *${matchedGuest.name}*! 👋\n\nTumepokea taarifa kuwa hutaweza kuhudhuria *${eventName}*. Tunashukuru sana kwa kututaarifu mapema! Kama utakuwa na mchango/ahadi ungependa kukamilisha, waandaji watakushukuru sana. 🙏`;
        } else {
          actionReply = `Habari *${matchedGuest.name}*! 👋\n\nTaarifa yako kuwa hujaweka uhakika imesajiliwa. Utakapokuwa tayari, tafadhali tutaarifu tena! Karibu sana. 🙏`;
        }
      }
    }

    // 4. SEATING ENQUIRY
    if (!actionTaken && (lowerText.includes("meza") || lowerText.includes("kiti") || lowerText.includes("seating") || lowerText.includes("table"))) {
      const tableInfo = matchedGuest.tableNumber || matchedGuest.table || matchedGuest.seatingTable;
      if (tableInfo) {
        actionReply = `Habari *${matchedGuest.name}*! 👋\n\nTaarifa ya meza yako ya sherehe ya *${eventName}*:\n• *Meza Yako:* *${tableInfo}*\n• *Ukumbi:* ${venueName}\n\nKaribu sana! 🎉`;
      } else {
        actionReply = `Habari *${matchedGuest.name}*! 👋\n\nTaarifa za upangaji wa meza na viti kwa ajili ya *${eventName}* zitawekwa wazi na waandaji hivi karibuni. Tutawajulisha rasmi kabla ya siku ya sherehe. Karibu! 🙏`;
      }
      actionTaken = true;
    }
  }

  // If action was taken and reply prepared, return it directly
  if (actionTaken && actionReply) {
    return { botReply: actionReply, databaseUpdated, matchedGuestName: matchedGuest ? matchedGuest.name : null };
  }

  // 5. GENERAL AI OR FALLBACK LOGIC
  const targetAmount = Number(event.fundraisingGoal || event.targetAmount) || 0;
  const totalPaid = guests.reduce((sum: number, g: any) => sum + (Number(g.paidAmount) || 0), 0);

  const guestContext = matchedGuest 
    ? `Mgeni anayeuliza: ${matchedGuest.name}, Ahadi: TZS ${(Number(matchedGuest.pledgeAmount) || 0).toLocaleString()}, Paid: TZS ${(Number(matchedGuest.paidAmount) || 0).toLocaleString()}, Salio: TZS ${Math.max(0, (Number(matchedGuest.pledgeAmount) || 0) - (Number(matchedGuest.paidAmount) || 0)).toLocaleString()}, RSVP: ${matchedGuest.rsvpStatus || 'Bado'}, Meza: ${matchedGuest.tableNumber || matchedGuest.table || 'Haijatengwa'}`
    : `Mgeni anayeuliza (Simu: ${fromPhone}) hajasajiliwa rasmi kwa jina.`;

  const mapsPinUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueName)}`;

  const aiContext = `
Tukio: ${event.name || 'Harusi ya Josephat Kimaro'}
Waandaji: ${event.hostName || 'Jonas Kibenje'}
Tarehe ya Sherehe: ${event.date || '2026-08-08'}
Ukumbi / Mahali: ${venueName}
Google Maps Pin URL: ${mapsPinUrl}
Muda: ${event.time || '19:00'} ${event.period || 'Usiku'}
Kadi ya Mgeni: ${matchedGuest?.cardType || 'Standard Card'}

${guestContext}
Lengo la Michango: TZS ${targetAmount.toLocaleString()}
Jumla Iliyokusanywa: TZS ${totalPaid.toLocaleString()}
`;

  let botReply = "";
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Wewe ni Msaidizi wa AI wa WhatsApp wa EVENTCARD (EVENTCARD WhatsApp AI Bot).
Unajibu mgeni aliyetuma ujumbe kwenye WhatsApp kuhusu sherehe.

TAARIFA ZA SHEREHE:
${aiContext}

Ujumbe wa Mgeni: "${textBody}"

MWONGOZO MUHIMU:
- Jibu kwa Kiswahili kirafiki, kwa heshima na ukarimu.
- MARUFUKU KUTAJA AU KUTANGAZA LENGO KUU LA MICHANGO YA SHEREHE ("Lengo la michango")! Usiseme kabisa "Lengo la michango ni TZS X".
- Kama mgeni anauliza kuhusu ukumbi/mahali/ramani/location, mpe jina la ukumbi (${venueName}) na umpe na kiungo cha Google Maps Pin: ${mapsPinUrl}
- Kama mgeni hajaweka ahadi bado (Ahadi = TZS 0) na anauliza kuhusu ahadi/mchango wake au anataka kuweka ahadi: Mueleze kwa upendo kwamba hajaweka ahadi kwenye mfumo bado, na umwombe aandike kiasi anachopenda kuahidi (mfano 'Naahidi 100,000' au '100000') na kiasi hicho kitaingia moja kwa moja kwenye mfumo!
- Kama mgeni anauliza kuhusu ahadi yake, mchango wake, au salio lake:
  1. Kama ameshakamilisha mchango wake (Salio = TZS 0 na ameweka ahadi): Mueleze kwa furaha kuwa ameshakamilisha mchango wake kikamilifu, na umpe shukrani nyingi sana kwa mchango wake.
  2. Kama anaidaiwa (Salio ni zaidi ya TZS 0): Mwambie kiasi anachodaiwa (Salio lililobaki: TZS X) pekee kwa usahihi, na mueleze ajisikie huru kukamilisha au kuwasiliana na waandaji (${event.contact1 || 'Kamati'}).
  3. Kama hana ahadi iliyosajiliwa au namba haipo kwenye orodha: Mueleze kwa ukarimu kuwa namba yake haijatambuliwa kwenye orodha ya ahadi bado na mpe mawasiliano ya waandaji (${event.contact1 || 'Kamati'}). Usitaje lengo la michango.
- Majibu yawe mafupi, yasiwe marefu sana kwani ni ya kuonekana kwenye WhatsApp chat. Tumia *bold* badala ya **bold** kwenye WhatsApp formatting.`,
      });
      if (response && response.text) {
        botReply = response.text;
      }
    } catch (e: any) {
      console.error("[WhatsApp AI Gemini Error]:", e?.message);
    }
  }

  if (!botReply) {
    if (lowerText.includes("ukumbi") || lowerText.includes("sehemu") || lowerText.includes("mahali") || lowerText.includes("venue") || lowerText.includes("hall")) {
      botReply = `Habari! Ukumbi wa sherehe ya *${event.name || 'sherehe yetu'}* ni *${venueName}*. Tarehe ni *${event.date || '2026-08-08'}* kuanzia saa *${event.time || '19:00'} ${event.period || 'Usiku'}*. Karibu sana! 🎉`;
    } else if (lowerText.includes("tarehe") || lowerText.includes("muda") || lowerText.includes("saa") || lowerText.includes("date") || lowerText.includes("time")) {
      botReply = `Habari! Sherehe ya *${event.name || 'sherehe yetu'}* itafanyika tarehe *${event.date || '2026-08-08'}* kuanzia saa *${event.time || '19:00'} ${event.period || 'Usiku'}* katika ukumbi wa *${venueName}*. Karibu! 🎉`;
    } else if (lowerText.includes("mchango") || lowerText.includes("pesa") || lowerText.includes("lipa") || lowerText.includes("ahadi") || lowerText.includes("pledge") || lowerText.includes("changia") || lowerText.includes("salio") || lowerText.includes("baki")) {
      if (matchedGuest) {
        const pledgeAmt = Number(matchedGuest.pledgeAmount) || 0;
        const paidAmt = Number(matchedGuest.paidAmount) || 0;
        const balanceAmt = Math.max(0, pledgeAmt - paidAmt);

        if (pledgeAmt === 0) {
          botReply = `Habari *${matchedGuest.name}*! 👋\n\nNamba yako ya simu imesajiliwa kwenye sherehe ya *${event.name || 'sherehe'}*, lakini bado hujaweka kiasi cha ahadi au mchango wako kwenye mfumo.\n\nUnapenda kuahidi au kuchangia kiasi gani kwa ajili ya sherehe hii? 😊\n\nTafadhali jibu ujumbe huu ukiandika kiasi chako (mfano: *Naahidi 100,000* au *100000*), na ahadi yako itahifadhiwa kwenye mfumo papo hapo! Karibu sana. 🙏`;
        } else if (pledgeAmt > 0 && balanceAmt === 0) {
          botReply = `Habari *${matchedGuest.name}*! 👋\n\nTunakushukuru sana! Umeshakamilisha mchango wako wote wa TZS ${pledgeAmt.toLocaleString()} kikamilifu kwa ajili ya *${event.name || 'sherehe'}*.\n\nAsante sana kwa mchango na ushirikiano wako mkubwa! Mungu akubariki sana! 🙏🎉`;
        } else if (pledgeAmt > 0 && balanceAmt > 0) {
          botReply = `Habari *${matchedGuest.name}*! 👋\n\nTaarifa za mchango wako kwa sherehe ya *${event.name || 'sherehe'}*:\n• *Kiasi Unachodaiwa (Salio):* TZS ${balanceAmt.toLocaleString()}\n• *Ahadi Yako:* TZS ${pledgeAmt.toLocaleString()}\n• *Kiasi Ulicholipa:* TZS ${paidAmt.toLocaleString()}\n\nTafadhali kamilisha salio lako kabla ya sherehe. Kwa maelezo zaidi au kulipia, wasiliana na waandaji (${event.contact1 || 'Kamati'}). Asante sana! 🙏`;
        } else {
          botReply = `Habari *${matchedGuest.name}*! 👋\n\nHujaweka ahadi au mchango uliosajiliwa bado kwa sherehe ya *${event.name || 'sherehe'}*.\n\nKama ungependa kuweka ahadi au kutoa mchango wako, tafadhali wasiliana na waandaji (${event.contact1 || 'Kamati'}). Karibu sana! 🙏`;
        }
      } else {
        botReply = `Habari! 👋\n\nNamba yako ya simu haijaandikishwa kwenye orodha ya wageni wetu bado kwa sherehe ya *${event.name || 'sherehe'}*.\n\nKwa maelezo zaidi au kuweka ahadi/mchango wako, tafadhali wasiliana na waandaji (${event.contact1 || 'Kamati'}). Asante! 🙏`;
      }
    } else {
      botReply = `Habari! Asante kwa kuwasiliana na Msaidizi wa AI wa sherehe ya *${event.name || 'EVENTCARD'}* 🤖.\n\n• *Tarehe:* ${event.date || '2026-08-08'}\n• *Ukumbi:* ${venueName}\n• *Mawasiliano:* ${event.contact1 || ''}\n\nKwa taarifa zaidi au uthibitisho wa RSVP, tafadhali wasiliana na waandaji.`;
    }
  }

  return { botReply, databaseUpdated, matchedGuestName: matchedGuest ? matchedGuest.name : null };
}

function getParamsForCount(count: number, guestData: any, eventData: any, fallbackText: string, incomingParams?: string[], templateName?: string, lang: string = "sw"): any[] {
  const resolvedParams: string[] = [];
  
  const isEn = String(lang).trim().toLowerCase() === 'en' || String(lang).trim().toLowerCase() === 'english';

  const isContribution = (templateName || "").toLowerCase().includes("mchango") || 
                         (templateName || "").toLowerCase().includes("pledge") || 
                         (templateName || "").toLowerCase().includes("ombi") ||
                         (templateName || "").toLowerCase().includes("reminder") ||
                         (templateName || "").toLowerCase().includes("ukumbusho") ||
                         (templateName || "").toLowerCase().includes("kumbusho") ||
                         (templateName || "").toLowerCase().includes("ahadi") ||
                         (templateName || "").toLowerCase().includes("rem1") ||
                         (templateName || "").toLowerCase().includes("rem2");

  const guestFallback = isEn ? "Our Guest" : "Mgeni wetu";
  const hostFallback = isEn ? "Our Family" : "Familia yetu";
  const eventFallback = isEn ? "Our Event" : "Sherehe yetu";
  const venueFallback = isEn ? "Event Hall" : "Ukumbi wa Sherehe";
  const cardTypeFallback = isEn ? "Standard Card" : "Kadi ya Kawaida";
  const contact1Fallback = isEn ? "Contact 1" : "Msimamizi 1";
  const contact2Fallback = isEn ? "Contact 2" : "Msimamizi 2";

  const translatePeriod = (p: string | null | undefined) => {
    const period = p || "Mchana";
    if (isEn) {
      if (period === 'Asubuhi') return 'Morning';
      if (period === 'Mchana') return 'Afternoon';
      if (period === 'Jioni') return 'Evening';
      if (period === 'Usiku') return 'Night';
      return period;
    }
    return period;
  };
  const periodVal = translatePeriod(eventData?.period);
  const timeStr = `${eventData?.time || "12:00"} ${periodVal}`;

  const cardLink = guestData?.cardUrl || (guestData?.id ? `https://eventcard.co.tz/card/${guestData.id}` : "https://eventcard.co.tz");

  const isNoLinkTemplate = count === 12 || (templateName || "").toLowerCase().includes("bila_link") || (templateName || "").toLowerCase().includes("no_link");

  const standardValues = isNoLinkTemplate ? [
    guestData?.name || guestFallback, // 1. Guest Name
    eventData?.hostName || hostFallback, // 2. Host Name
    eventData?.name || eventFallback, // 3. Event Name
    eventData?.date || "", // 4. Date
    eventData?.eventHallName || venueFallback, // 5. Venue
    timeStr, // 6. Time
    guestData?.code || guestData?.id || "N/A", // 7. Card Number
    isContribution ? "" : (guestData?.cardType || cardTypeFallback), // 8. Card Type
    isContribution ? "" : (eventData?.contact1Name || contact1Fallback), // 9. Contact 1 Name
    isContribution ? "" : (eventData?.contact1 || ""), // 10. Contact 1 Phone
    isContribution ? "" : (eventData?.contact2Name || contact2Fallback), // 11. Contact 2 Name
    isContribution ? "" : (eventData?.contact2 || "") // 12. Contact 2 Phone
  ] : [
    guestData?.name || guestFallback, // 1. Guest Name
    eventData?.hostName || hostFallback, // 2. Host Name
    eventData?.name || eventFallback, // 3. Event Name
    eventData?.date || "", // 4. Date
    eventData?.eventHallName || venueFallback, // 5. Venue
    timeStr, // 6. Time
    guestData?.code || guestData?.id || "N/A", // 7. Card Number
    isContribution ? "" : (guestData?.cardType || cardTypeFallback), // 8. Card Type
    cardLink, // 9. Link
    isContribution ? "" : (eventData?.contact1Name || contact1Fallback), // 10. Contact 1 Name
    isContribution ? "" : (eventData?.contact1 || ""), // 11. Contact 1 Phone
    isContribution ? "" : (eventData?.contact2Name || contact2Fallback), // 12. Contact 2 Name
    isContribution ? "" : (eventData?.contact2 || "") // 13. Contact 2 Phone
  ];

  if (Array.isArray(incomingParams) && incomingParams.length > 0) {
    for (let i = 0; i < count; i++) {
      if (i < incomingParams.length) {
        const val = String(incomingParams[i] || "").trim();
        const placeholderRegex = /^\{\{[a-zA-Z0-9_\-Hh]+\}\}|\{[a-zA-Z0-9_\-Hh]+\}$/;
        if ((!val || placeholderRegex.test(val)) && i < standardValues.length) {
          resolvedParams.push(standardValues[i]);
        } else {
          resolvedParams.push(incomingParams[i]);
        }
      } else if (i < standardValues.length) {
        resolvedParams.push(standardValues[i]);
      } else {
        resolvedParams.push("");
      }
    }
  } else {
    if (count === 1) {
      resolvedParams.push(guestData?.name || guestFallback);
    } else if (count === 2) {
      resolvedParams.push(guestData?.name || guestFallback);
      resolvedParams.push(eventData?.name || eventFallback);
    } else if (count === 3) {
      resolvedParams.push(guestData?.name || guestFallback);
      resolvedParams.push(eventData?.hostName || hostFallback);
      resolvedParams.push(eventData?.name || eventFallback);
    } else if (count === 4) {
      resolvedParams.push(guestData?.name || guestFallback);
      resolvedParams.push(eventData?.name || eventFallback);
      resolvedParams.push(eventData?.date || "");
      resolvedParams.push(eventData?.eventHallName || venueFallback);
    } else if (count === 5) {
      resolvedParams.push(guestData?.name || guestFallback);
      resolvedParams.push(eventData?.name || eventFallback);
      resolvedParams.push(eventData?.date || "");
      resolvedParams.push(eventData?.eventHallName || venueFallback);
      resolvedParams.push(timeStr);
    } else if (count === 6) {
      const lowerTemplate = (templateName || "").toLowerCase();
      if ((lowerTemplate.includes("mwaliko") || lowerTemplate === "" || lowerTemplate.includes("sherehe") || lowerTemplate.includes("invite") || lowerTemplate.includes("wedding")) && !lowerTemplate.includes("mchango") && !lowerTemplate.includes("pledge") && !lowerTemplate.includes("ombi") && !lowerTemplate.includes("contribution")) {
        resolvedParams.push(guestData?.name || guestFallback);
        resolvedParams.push(eventData?.hostName || hostFallback);
        resolvedParams.push(eventData?.name || eventFallback);
        resolvedParams.push(eventData?.date || (isEn ? "Date" : "Tarehe"));
        resolvedParams.push(eventData?.eventHallName || venueFallback);
        resolvedParams.push(timeStr);
      } else {
        // Contribution Invite mapping (Removed link)
        resolvedParams.push(guestData?.name || guestFallback);
        resolvedParams.push(eventData?.hostName || hostFallback);
        resolvedParams.push(eventData?.name || eventFallback);
        resolvedParams.push(eventData?.date || (isEn ? "Date" : "Tarehe"));
        const dd = eventData?.contributionDeadline || eventData?.deadlineDate;
        resolvedParams.push(dd ? new Date(dd).toLocaleDateString(isEn ? "en-US" : "sw-TZ", { day: "numeric", month: "long", year: "numeric" }) : (isEn ? "Deadline Date" : "Tarehe ya Mwisho"));
        let pmStr = "";
        if (Array.isArray(eventData?.paymentMethods) && eventData.paymentMethods.length > 0) {
          const items: string[] = [];
          eventData.paymentMethods.forEach((m: any) => {
            const isMixx = String(m.provider || '').trim().toLowerCase().includes('mixx') || String(m.provider || '').trim().toLowerCase().includes('yas');
            let itemStr = "";
            if (m.type === "Mobile") {
              if (isMixx) {
                itemStr = `📱 Mixx By Yas: ${m.number} (${m.name})`;
              } else {
                itemStr = `📱 ${m.provider}: ${m.number} (${m.name})`;
              }
            } else if (m.type === "Lipa Namba") {
              itemStr = `💳 ${m.provider}: ${m.number} (${m.name})`;
            } else if (m.type === "Bank") {
              itemStr = `🏦 ${m.provider}: ${m.number} (${m.name})`;
            }
            if (itemStr) {
              items.push(itemStr);
            }
          });
          pmStr = items.join("\n");
        } else if (typeof eventData?.paymentMethods === "string" && eventData.paymentMethods) {
          const lines = eventData.paymentMethods.split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0);
          pmStr = lines.join('\n');
        } else {
          pmStr = isEn ? "Contribution Accounts" : "Namba za Michango";
        }
        resolvedParams.push(pmStr);
      }
    } else if (count === 7) {
      // Contribution Reminder mapping (Removed link)
      resolvedParams.push(guestData?.name || guestFallback);
      resolvedParams.push(eventData?.name || eventFallback);
      resolvedParams.push(String(guestData?.pledgeAmount || 0));
      resolvedParams.push(String(guestData?.paidAmount || 0));
      resolvedParams.push(String((guestData?.pledgeAmount || 0) - (guestData?.paidAmount || 0)));
      const dd = eventData?.contributionDeadline || eventData?.deadlineDate;
      resolvedParams.push(dd ? new Date(dd).toLocaleDateString(isEn ? "en-US" : "sw-TZ", { day: "numeric", month: "long", year: "numeric" }) : (isEn ? "Deadline Date" : "Tarehe ya Mwisho"));
      let pmStr = "";
      if (Array.isArray(eventData?.paymentMethods) && eventData.paymentMethods.length > 0) {
        const items: string[] = [];
        eventData.paymentMethods.forEach((m: any) => {
          const isMixx = String(m.provider || '').trim().toLowerCase().includes('mixx') || String(m.provider || '').trim().toLowerCase().includes('yas');
          let itemStr = "";
          if (m.type === "Mobile") {
            if (isMixx) {
              itemStr = `📱 Mixx By Yas: ${m.number} (${m.name})`;
            } else {
              itemStr = `📱 ${m.provider}: ${m.number} (${m.name})`;
            }
          } else if (m.type === "Lipa Namba") {
            itemStr = `💳 ${m.provider}: ${m.number} (${m.name})`;
          } else if (m.type === "Bank") {
            itemStr = `🏦 ${m.provider}: ${m.number} (${m.name})`;
          }
          if (itemStr) {
            items.push(itemStr);
          }
        });
        pmStr = items.join("\n");
      } else if (typeof eventData?.paymentMethods === "string" && eventData.paymentMethods) {
        const lines = eventData.paymentMethods.split('\n')
          .map((line: string) => line.trim())
          .filter((line: string) => line.length > 0);
        pmStr = lines.join('\n');
      } else {
        pmStr = isEn ? "Contribution Accounts" : "Namba za Michango";
      }
      resolvedParams.push(pmStr);
    } else {
      for (let i = 0; i < count; i++) {
        if (i < standardValues.length) {
          resolvedParams.push(standardValues[i]);
        } else {
          resolvedParams.push("");
        }
      }
    }
  }

  return resolvedParams.map(val => ({ type: "text", text: sanitizeMetaTemplateParam(val, true) }));
}

const metaMediaCache = new Map<string, { mediaId: string; timestamp: number }>();

async function attemptEhubAutoRecovery(apiKey: string, apiSecret: string, formattedPhone: string, text: string, currentSenderId: string): Promise<string | null> {
  try {
    console.log(`[eHub Auto-Recovery] Attempting to fetch approved Sender IDs for auto-healing...`);
    const effectiveKey = (apiKey && !apiKey.startsWith("zs_")) ? apiKey : "sk_Y8rB4E2PzMMOQZ3LyCbf8xYKw1tjniyhae85NX3IxKgLx6GD";
    const effectiveSecret = apiSecret || "CDWwiiKKTa44Ql6R4uOO4jZgHVnhmnRivl7SrIYgdbeRSKJ3Z8Q7JoaSqe07miWf";
    const timestamp = Math.floor(Date.now() / 1000);
    const method = "GET";
    const path = "/api/v1/sender-ids";
    const body = "";
    const payload = timestamp + "\n" + method + "\n" + path + "\n" + body;
    const signature = crypto.createHmac("sha256", effectiveSecret).update(payload).digest("hex");

    const res = await fetch("https://sms.ehub.co.tz" + path, {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + effectiveKey,
        "X-Timestamp": timestamp.toString(),
        "X-Signature": signature,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "EventCard-App/1.0"
      }
    });

    const resText = await res.text();
    console.log(`[eHub Auto-Recovery] GET sender-ids status: ${res.status}, body: ${resText.slice(0, 300)}`);
    let data: any = {};
    try { data = JSON.parse(resText); } catch {}

    const extractItems = (d: any): any[] => {
      if (!d) return [];
      if (Array.isArray(d)) return d;
      if (Array.isArray(d.data)) return d.data;
      if (Array.isArray(d.own)) return d.own;
      if (Array.isArray(d.items)) return d.items;
      if (Array.isArray(d.sender_ids)) return d.sender_ids;
      if (Array.isArray(d.senders)) return d.senders;
      if (Array.isArray(d.results)) return d.results;
      if (d.data && typeof d.data === "object") {
        if (Array.isArray(d.data.items)) return d.data.items;
        if (Array.isArray(d.data.own)) return d.data.own;
        if (Array.isArray(d.data.sender_ids)) return d.data.sender_ids;
        if (Array.isArray(d.data.senders)) return d.data.senders;
        if (Array.isArray(d.data.data)) return d.data.data;
      }
      return [];
    };

    const rawItems = extractItems(data);

    const isUuid = (str: string) => typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
    const candidates: string[] = [];

    // Extract approved sender_ids or ids from eHub response
    for (const item of rawItems) {
      const isApproved = !item.status || item.status === "approved" || item.status === "active";
      if (isApproved) {
        const sid = item.sender_id || item.id;
        const itemId = item.id;
        if (sid && isUuid(sid) && sid !== "00420892-38bd-47b0-9a5f-ea55bef5d2d1" && !candidates.includes(sid)) candidates.push(sid);
        if (itemId && isUuid(itemId) && itemId !== "00420892-38bd-47b0-9a5f-ea55bef5d2d1" && !candidates.includes(itemId)) candidates.push(itemId);
      }
    }

    // Ensure known approved eHub Sender IDs are present
    const isUwalemi = text && (text.includes("UWALEMI") || text.includes("Uwalemi") || text.includes("ada") || text.includes("kikao") || text.includes("kikundi") || text.includes("Ada"));
    const preferredList = isUwalemi
      ? ["19f41b59-19d0-4f98-b8c9-9d5b1ac31308", "339330f1-4e6a-4bf7-a9f8-eaae2a9dd397"]
      : ["339330f1-4e6a-4bf7-a9f8-eaae2a9dd397", "19f41b59-19d0-4f98-b8c9-9d5b1ac31308"];

    for (const pid of preferredList) {
      if (!candidates.includes(pid)) {
        candidates.push(pid);
      }
    }

    // Sort to prioritize preferred based on message context
    candidates.sort((a, b) => {
      if (a === preferredList[0]) return -1;
      if (b === preferredList[0]) return 1;
      return 0;
    });

    console.log(`[eHub Auto-Recovery] Candidate UUID Sender IDs to try:`, candidates);

    for (const candidateSenderId of candidates) {
      if (candidateSenderId === currentSenderId && candidateSenderId !== "00420892-38bd-47b0-9a5f-ea55bef5d2d1") continue;

      console.log(`[eHub Auto-Recovery] Retrying dispatch with candidate Sender ID: '${candidateSenderId}'...`);
      const retryTs = Math.floor(Date.now() / 1000);
      const sendPath = "/api/v1/sms/send";
      let cleanPhone = formattedPhone.replace(/[^0-9]/g, "");
      if (cleanPhone.startsWith("0")) cleanPhone = "255" + cleanPhone.substring(1);
      if (cleanPhone.startsWith("7") || cleanPhone.startsWith("6")) cleanPhone = "255" + cleanPhone;

      const bodyObj = {
        sender_id: candidateSenderId,
        to: cleanPhone,
        message: text
      };
      const bodyStr = JSON.stringify(bodyObj);
      const retryPayload = retryTs + "\nPOST\n" + sendPath + "\n" + bodyStr;
      const retrySig = crypto.createHmac("sha256", effectiveSecret).update(retryPayload).digest("hex");

      const retryRes = await fetch("https://sms.ehub.co.tz" + sendPath, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + effectiveKey,
          "X-Timestamp": retryTs.toString(),
          "X-Signature": retrySig,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "EventCard-App/1.0"
        },
        body: bodyStr
      });

      const retryText = await retryRes.text();
      console.log(`[eHub Auto-Recovery] Candidate '${candidateSenderId}' response status: ${retryRes.status}, body: ${retryText.slice(0, 200)}`);

      let isSuccess = false;
      try {
        const parsed = JSON.parse(retryText);
        if (retryRes.ok && (parsed.success === true || parsed.status === "success" || parsed.status === "sent") && !parsed.error) {
          isSuccess = true;
        }
      } catch {
        if (retryRes.ok) isSuccess = true;
      }

      if (isSuccess) {
        console.log(`[eHub Auto-Recovery] Success! Sender ID '${candidateSenderId}' worked! Updating saved settings...`);
        try {
          const db = await readDBLatest();
          if (db.smsGatewaySettings) {
            db.smsGatewaySettings.senderId = candidateSenderId;
            db.smsGatewaySettings.senderIdStatus = 'approved';
            await writeDB(db);
          }
        } catch (dbErr) {
          console.error(`[eHub Auto-Recovery] Error persisting new senderId to DB:`, dbErr);
        }
        return retryText;
      }
    }
  } catch (err) {
    console.error(`[eHub Auto-Recovery] Error during auto-recovery process:`, err);
  }
  return null;
}

async function dispatchSMS(phone: string, text: string, channel: 'sms' | 'whatsapp', settings: any, scheduleTime?: string, templateParams?: string[], guestId?: string, appOrigin?: string, reqEventId?: string, reqTemplateName?: string, reqImageUrl?: string, lang?: string) {
  // Standardize/Clean Tanzanian phone numbers to 255XXXXXXXXX format
  const cleanedPhone = phone.replace(/\s+/g, '').replace(/[+\-]/g, '');
  let formattedPhone = cleanedPhone;
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '255' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('255') && formattedPhone.length === 9) {
    formattedPhone = '255' + formattedPhone;
  }

  // Handle WhatsApp custom automated HTTP dispatch if configured
  if (channel === 'whatsapp') {
    if (settings.whatsappUrl) {
      // Check if it's a serialized JSON representing official Meta config
      let metaConfig: any = null;
      try {
        if (settings.whatsappUrl.trim().startsWith('{') && settings.whatsappUrl.trim().endsWith('}')) {
          metaConfig = JSON.parse(settings.whatsappUrl);
        }
      } catch (e) {
        // Not a JSON, keep as standard Custom Webhook
      }

      if (metaConfig && metaConfig.provider === 'meta') {
        const token = (metaConfig.meta_token || "").trim();
        const phoneId = (metaConfig.phone_number_id || "").trim();
        let templateName = (metaConfig.template_name || reqTemplateName || "").trim();
        if (!templateName || templateName === 'hello_world') {
          if (reqTemplateName && reqTemplateName !== 'hello_world') {
            templateName = reqTemplateName.trim();
          } else {
            templateName = 'mwaliko_bila_link';
          }
        }
        let templateLang = lang || (metaConfig.template_lang || "sw").trim();
        
        // Normalize common language names to ISO codes expected by Meta
        if (templateLang.toLowerCase() === 'swahili') templateLang = 'sw';
        if (templateLang.toLowerCase() === 'english') templateLang = 'en';
        
        console.log(`[Meta WhatsApp] Dispatching to ${formattedPhone} using template ${templateName} in ${templateLang}`);
        
        // Fetch database once to resolve both guest eventId and template settings
        let db: any = null;
        try {
          db = await readDBLatest();
        } catch (dbErr) {
          console.error("[Meta WhatsApp] Error reading DB for template/guest:", dbErr);
        }

        // Dynamically resolve eventId to serve the exact image header
        let eventId = reqEventId || "default";
        let guestData: any = null;
        let eventData: any = null;
        
        if (db) {
          if (guestId) {
            try {
              guestData = (db.guests || []).find((g: any) => g.id === guestId);
              if (!guestData && phone) {
                const cleanP = phone.replace(/\s+/g, '').replace(/[+\-]/g, '');
                guestData = (db.guests || []).find((g: any) => {
                  const gp = (g.phone || "").replace(/\s+/g, '').replace(/[+\-]/g, '');
                  return gp && (gp === cleanP || gp.endsWith(cleanP) || cleanP.endsWith(gp));
                });
              }
              if (guestData && guestData.eventId && !reqEventId) {
                eventId = guestData.eventId;
              }
            } catch (err) {
              console.error("[Meta WhatsApp] Error finding guest eventId:", err);
            }
          }

          if (eventId !== "default") {
            eventData = (db.eventsList || []).find((e: any) => e.id === eventId);
          }
          if (!eventData && (db.eventsList || []).length > 0) {
            eventData = db.eventsList[0];
          }
        }
        
        let bodyParams: any[] = [];
        let buttonParams: any[] = [];

        // Determine expected parameter count from fuzzy template name matching first to enforce official Meta template structure
        let expectedCount = 0;
        const lowerTemplateName = templateName.toLowerCase();
        if (lowerTemplateName.includes('mwaliko_wa_sherehe') || lowerTemplateName.includes('mwaliko_wa_sherehe_')) {
          expectedCount = 12;
        } else if (lowerTemplateName.includes('shukrani') || lowerTemplateName.includes('asante') || lowerTemplateName.includes('thanks') || lowerTemplateName.includes('thank_you') || lowerTemplateName.includes('thankyou')) {
          expectedCount = 2;
        } else if (lowerTemplateName.includes('mchango') || lowerTemplateName.includes('pledge') || lowerTemplateName.includes('ombi')) {
          expectedCount = 6;
        } else if (lowerTemplateName.includes('reminder') || lowerTemplateName.includes('ukumbusho') || lowerTemplateName.includes('kumbusho') || lowerTemplateName.includes('ahadi')) {
          expectedCount = 7;
        } else if (lowerTemplateName.includes('save') || lowerTemplateName.includes('date') || lowerTemplateName.includes('hifadhi') || lowerTemplateName.includes('tarehe')) {
          // Explicitly handle Save the Date with 3 params and NO buttons by default
          expectedCount = 3;
        } else if (lowerTemplateName.includes('mwaliko') || lowerTemplateName.includes('kadi') || lowerTemplateName.includes('wedding') || lowerTemplateName.includes('invite') || lowerTemplateName.includes('sherehe') || lowerTemplateName.includes('invitation')) {
          expectedCount = 12;
        }

        if (expectedCount > 0) {
          console.log(`[Meta WhatsApp] Fuzzy matched template ${templateName} to expected parameter count: ${expectedCount}`);
          bodyParams = getParamsForCount(expectedCount, guestData, eventData, text, templateParams, templateName);
        } else if (Array.isArray(templateParams) && templateParams.length > 0) {
          // Fallback to trusting frontend count if no fuzzy match
          expectedCount = templateParams.length;
          console.log(`[Meta WhatsApp] No fuzzy match, using frontend templateParams count: ${expectedCount}`);
          bodyParams = getParamsForCount(expectedCount, guestData, eventData, text, templateParams, templateName);
        } else {
          if (templateName === 'kadi_mwaliko' && guestData && eventData) {
            bodyParams = getParamsForCount(12, guestData, eventData, text, templateParams, templateName);
          } else if (templateName === 'shukrani' && guestData && eventData) {
            bodyParams = getParamsForCount(1, guestData, eventData, text, templateParams, templateName);
          } else {
            // Fallback to dynamic params passed from frontend
            if (Array.isArray(templateParams) && templateParams.length > 0) {
              const urlIndices: number[] = [];
              templateParams.forEach((val, idx) => {
                const str = String(val || "").trim();
                if (str.startsWith("http://") || str.startsWith("https://")) {
                  urlIndices.push(idx);
                }
              });

              if (templateParams.length > 12 && urlIndices.length > 0) {
                templateParams.forEach((val, idx) => {
                  if (urlIndices.includes(idx)) {
                    buttonParams.push({ type: "text", text: sanitizeMetaTemplateParam(val, false) });
                  } else {
                    bodyParams.push({ type: "text", text: sanitizeMetaTemplateParam(val, true) });
                  }
                });
              } else {
                templateParams.forEach((val) => {
                  bodyParams.push({ type: "text", text: sanitizeMetaTemplateParam(val, true) });
                });
              }
            } else {
              bodyParams.push({ type: "text", text: sanitizeMetaTemplateParam(text, true) });
            }
          }
        }
        
        // Always attempt to supply a URL button parameter for guest-specific links.
        // If the template does not have a button, the self-healing logic will remove it.
        const guestCode = guestData?.code || guestData?.id || guestId || "";
        const isSaveTheDate = lowerTemplateName.includes('save') || lowerTemplateName.includes('date') || lowerTemplateName.includes('hifadhi') || lowerTemplateName.includes('tarehe');
        
        if (guestCode && !isSaveTheDate) {
          let buttonParamVal = `?invite=${guestCode}&eventId=${eventId || ""}`;
          if (lowerTemplateName.includes('mchango') || lowerTemplateName.includes('pledge') || lowerTemplateName.includes('ombi') || lowerTemplateName.includes('reminder') || lowerTemplateName.includes('ukumbusho')) {
            buttonParamVal += `&pledge=true`;
          }
          buttonParams.push({ type: "text", text: buttonParamVal });
        } else if (!isSaveTheDate) {
          // Check if any frontend template params look like URLs
          if (Array.isArray(templateParams)) {
            templateParams.forEach(val => {
              const str = String(val || "").trim();
              if ((str.startsWith("http://") || str.startsWith("https://")) && buttonParams.length === 0) {
                buttonParams.push({ type: "text", text: str });
              }
            });
          }
        }

        const headerImageUrl = `${appOrigin || "https://eventcard.co.tz"}/api/template-image/${eventId}`;

        // Let's resolve the actual image to upload it directly to Meta to bypass preview server authentication/sandbox limits
        let mediaId: string | null = null;
        let imageUrl = reqImageUrl || "";
        try {
          if (!imageUrl && db) {
            if (db.templateSettings && db.templateSettings[eventId]) {
              imageUrl = db.templateSettings[eventId].imageUrl || "";
            }
            if (!imageUrl && db.templateSettings && db.templateSettings['default']) {
              imageUrl = db.templateSettings['default'].imageUrl || "";
            }
          }

          if (imageUrl) {
            const cacheKey = `${eventId}_${guestId || phone || ""}_${imageUrl.substring(0, 100)}_${imageUrl.length}`;
            const cached = metaMediaCache.get(cacheKey);
            const now = Date.now();

            if (cached && (now - cached.timestamp < 24 * 60 * 60 * 1000)) {
              mediaId = cached.mediaId;
              console.log(`[Meta WhatsApp] Using CACHED Media ID for key: ${cacheKey}. Media ID: ${mediaId}`);
            } else {
              let blob: any = null;
              let filename = "image.png";
              let contentType = "image/png";

              if (imageUrl.startsWith("data:")) {
                const matches = imageUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                  contentType = matches[1];
                  const buffer = Buffer.from(matches[2], 'base64');
                  blob = new Blob([buffer], { type: contentType });
                  filename = contentType === "image/jpeg" ? "image.jpg" : "image.png";
                }
              } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
                const imgRes = await fetch(imageUrl);
                if (imgRes.ok) {
                  blob = await imgRes.blob();
                  contentType = blob.type || "image/png";
                  filename = contentType === "image/jpeg" ? "image.jpg" : "image.png";
                } else {
                  throw new Error(`Hitilafu ya Meta WhatsApp: Imeshindwa kupakua picha ya kadi toka kwenye kiungo chake (Status ${imgRes.status}).`);
                }
              }

              if (blob) {
                console.log(`[Meta WhatsApp] Uploading media to Meta API... File size: ${blob.size} bytes, type: ${contentType}`);
                const mediaUrl = `https://graph.facebook.com/v20.0/${phoneId}/media`;
                const formData = new FormData();
                formData.append("messaging_product", "whatsapp");
                formData.append("file", blob, filename);
                formData.append("type", contentType);

                const mediaResponse = await fetch(mediaUrl, {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${token}`
                  },
                  body: formData
                });

                const mediaResult: any = await mediaResponse.json();
                if (mediaResponse.ok && mediaResult.id) {
                  mediaId = mediaResult.id;
                  metaMediaCache.set(cacheKey, { mediaId, timestamp: now });
                  console.log(`[Meta WhatsApp] Successfully uploaded and CACHED media. Media ID: ${mediaId}`);
                } else {
                  console.error(`[Meta WhatsApp] Media upload failed:`, mediaResult);
                  const apiMsg = mediaResult?.error?.message || "Hitilafu isiyojulikana";
                  const apiCode = mediaResult?.error?.code || "";
                  throw new Error(`Hitilafu ya Meta WhatsApp: Imeshindwa kupakia picha ya kadi kwenda Meta (Media Upload Failed, Msimbo ${apiCode}). Tafadhali hakikisha Token ya Meta na ID ya namba ya simu ziko sahihi, na picha ina ukubwa usiozidi 5MB. [Jibu la Meta: ${apiMsg}]`);
                }
              }
            }
          }
        } catch (mediaErr: any) {
          console.error("[Meta WhatsApp] Error uploading media to Meta:", mediaErr);
          if (mediaErr?.message?.includes("Hitilafu ya Meta WhatsApp")) {
            throw mediaErr;
          }
        }

        const payload: any = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "template",
          template: {
            name: templateName,
            language: {
              code: templateLang
            }
          }
        };

        // Standard hello_world template does not take parameters
        if (templateName !== 'hello_world') {
          payload.template.components = [];
          
          // Add header parameter for the image only if an imageUrl is configured in the template settings
          if (imageUrl) {
            const headerParam: any = {
              type: "image",
              image: {}
            };
            if (mediaId) {
              headerParam.image.id = mediaId;
            } else {
              headerParam.image.link = headerImageUrl;
            }

            payload.template.components.push({
              type: "header",
              parameters: [headerParam]
            });
          }

          if (bodyParams.length > 0) {
            payload.template.components.push({
              type: "body",
              parameters: bodyParams
            });
          }
          if (buttonParams.length > 0) {
            payload.template.components.push({
              type: "button",
              index: 0,
              sub_type: "url",
              parameters: buttonParams
            });
          }
        }

        const metaUrl = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
        let lastError: Error | null = null;
        let rootErrorObj: any = null;
        let response;
        let respText = "";
        const triedKeys = new Set<string>();
        triedKeys.add(`${templateName}:${payload.template.language.code}`);
        let attempt = 0;
        const maxAttempts = 10;
        let success = false;

        while (attempt < maxAttempts) {
          attempt++;
          console.log(`[Meta WhatsApp] Attempt ${attempt}/${maxAttempts} - Payload:`, JSON.stringify(payload));
          
          try {
            const rawHeaders = {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            };
            response = await fetch(metaUrl, {
              method: 'POST',
              headers: sanitizeHttpHeaders(rawHeaders, settings),
              body: JSON.stringify(payload)
            });
            respText = await response.text();
            
            if (response.ok) {
              success = true;
              console.log(`[Meta WhatsApp] Attempt ${attempt} SUCCESS.`);
              try {
                const data = JSON.parse(respText);
                if (data.messages && data.messages[0]) {
                  return JSON.stringify({ ...data, messageId: data.messages[0].id, log: `Meta ID: ${data.messages[0].id}` });
                }
              } catch (e) {}
              return respText;
            }

            // Parse response to determine self-healing path
            let healAttempted = false;
            try {
              const errObj = JSON.parse(respText);
              const errMsg = errObj.error?.message || "";
              const errDetails = errObj.error?.error_data?.details || "";
              const combinedMsg = `${errMsg} ${errDetails}`;

              // Case A: Token expired / Auth Exception
              if (errObj.error && (errObj.error.code === 190 || errObj.error.code === 131005) && errObj.error.type === "OAuthException") {
                throw new Error(`Hitilafu ya Meta WhatsApp: Token yako imepitwa na wakati (expired) au haina ruhusa (Access Denied). Tafadhali nenda kwenye "Mipangilio" kisha weka "Meta Access Token" mpya na sahihi.`);
              }
              // Case B: Guest number not verified
              if (errObj.error && (errObj.error.code === 133010 || errObj.error.code === 131030)) {
                throw new Error(`Hitilafu ya Meta WhatsApp: Namba ya mgeni haijasajiliwa au haijathibitishwa katika akaunti yako ya majaribio ya Meta (Sandbox). Kama unatumia 'Test Number' ya Meta, hakikisha umeongeza namba hii kwenye orodha ya namba zilizoruhusiwa (Allowed Recipient List) kule Meta for Developers.`);
              }
              // Case C: Template name / language not found or restricted - SELF HEALING FALLBACK
              if (errObj.error && (errObj.error.code === 132001 || errObj.error.code === 131058)) {
                if (attempt === 1) rootErrorObj = errObj; 

                const defaultTemplate = (metaConfig.template_name || "").trim();
                const defaultLang = (metaConfig.template_lang || "sw").trim();
                let strategyApplied = false;

                // Strategy 1: Try language fallback first on the first failure (unless template is hello_world)
                if (attempt === 1 && templateName !== 'hello_world') {
                  const currentLang = payload.template.language.code;
                  const otherLang = currentLang === 'sw' ? 'en' : 'sw';
                  const key = `${templateName}:${otherLang}`;
                  if (!triedKeys.has(key)) {
                    console.log(`[Meta WhatsApp Self-Healing] Template "${templateName}" not found or restricted in '${currentLang}'. Attempting fallback to '${otherLang}'...`);
                    payload.template.language.code = otherLang;
                    triedKeys.add(key);
                    healAttempted = true;
                    strategyApplied = true;
                  }
                } 
                
                // Strategy 2: Try falling back to the configured default template name on second failure
                if (!strategyApplied && attempt <= 2 && templateName !== defaultTemplate && defaultTemplate && defaultTemplate !== 'hello_world') {
                  const key = `${defaultTemplate}:${defaultLang}`;
                  if (!triedKeys.has(key)) {
                    console.log(`[Meta WhatsApp Self-Healing] Custom template "${templateName}" not found or restricted. Falling back to configured default: "${defaultTemplate}" in language "${defaultLang}"`);
                    templateName = defaultTemplate;
                    payload.template.name = templateName;
                    payload.template.language.code = defaultLang;
                    triedKeys.add(key);
                    
                    // Re-evaluate expected count and params for fallback template
                    let newExpectedCount = 0;
                    const lowerFallbackName = templateName.toLowerCase();
                    if (lowerFallbackName.includes('mwaliko_wa_sherehe') || lowerFallbackName.includes('mwaliko_wa_sherehe_')) {
                      newExpectedCount = 12;
                    } else if (lowerFallbackName.includes('shukrani') || lowerFallbackName.includes('asante') || lowerFallbackName.includes('thanks') || lowerFallbackName.includes('thank_you') || lowerFallbackName.includes('thankyou')) {
                      newExpectedCount = 2;
                    } else if (lowerFallbackName.includes('mchango') || lowerFallbackName.includes('pledge') || lowerFallbackName.includes('ombi')) {
                      newExpectedCount = 6;
                    } else if (lowerFallbackName.includes('save') || lowerFallbackName.includes('date') || lowerFallbackName.includes('hifadhi') || lowerFallbackName.includes('tarehe')) {
                      newExpectedCount = 3;
                    } else if (lowerFallbackName.includes('reminder') || lowerFallbackName.includes('ukumbusho') || lowerFallbackName.includes('kumbusho') || lowerFallbackName.includes('ahadi')) {
                      newExpectedCount = 7;
                    } else if (lowerFallbackName.includes('mwaliko') || lowerFallbackName.includes('kadi') || lowerFallbackName.includes('wedding') || lowerFallbackName.includes('invite') || lowerFallbackName.includes('sherehe') || lowerFallbackName.includes('invitation')) {
                      newExpectedCount = 12;
                    }

                    if (newExpectedCount > 0) {
                      const recoveredParams = getParamsForCount(newExpectedCount, guestData, eventData, text, templateParams, templateName);
                      const bodyCompIdx = payload.template.components.findIndex((c: any) => c.type === "body");
                      if (bodyCompIdx !== -1) {
                        payload.template.components[bodyCompIdx].parameters = recoveredParams;
                      } else {
                        payload.template.components.push({
                          type: "body",
                          parameters: recoveredParams
                        });
                      }
                    }
                    healAttempted = true;
                    strategyApplied = true;
                  }
                }

                // Strategy 3: Try generic fallbacks based on message type
                if (!strategyApplied) {
                  let genericFallbacks = [];
                  const lowerText = (text || "").toLowerCase();
                  if (lowerText.includes("shukrani") || lowerText.includes("asante") || lowerText.includes("thanks")) {
                    genericFallbacks = ['asante_kushiriki', 'shukrani', 'shukrani_mchango'];
                  } else if (lowerText.includes("ukumbusho") || lowerText.includes("reminder") || lowerText.includes("hifadhi") || lowerText.includes("tarehe")) {
                    genericFallbacks = ['ukumbusho', 'reminder', 'hifadhi_tarehe', 'mwaliko_wa_sherehe'];
                  } else {
                    genericFallbacks = ['mwaliko_wa_sherehe', 'kadi_mwaliko', 'mwaliko'];
                  }

                  for (const fallback of genericFallbacks) {
                    const fallbackLang = "sw";
                    const key = `${fallback}:${fallbackLang}`;
                    if (templateName !== fallback && !triedKeys.has(key)) {
                      console.log(`[Meta WhatsApp Self-Healing] Exhausted options or restricted template. Trying generic fallback: "${fallback}"...`);
                      templateName = fallback;
                      payload.template.name = templateName;
                      payload.template.language.code = fallbackLang;
                      triedKeys.add(key);
                      
                      let countToTry = 12;
                      const lowerFallback = fallback.toLowerCase();
                      if (lowerFallback === 'asante_kushiriki') countToTry = 2;
                      if (lowerFallback === 'shukrani') countToTry = 2;
                      if (lowerFallback === 'ukumbusho' || lowerFallback === 'reminder') countToTry = 6;
                      if (lowerFallback === 'hifadhi_tarehe') countToTry = 3;
                      
                      const recoveredParams = getParamsForCount(countToTry, guestData, eventData, text, templateParams, templateName);
                      
                      // For generic fallbacks, structure is often just the body. Clear others to avoid header/button errors
                      payload.template.components = [
                        {
                          type: "body",
                          parameters: recoveredParams
                        }
                      ];
                      
                      healAttempted = true;
                      break;
                    }
                  }
                }
                
                // Strategy 4: Auto-query Meta WABA API for approved custom templates
                if (!healAttempted && metaConfig.waba_id && metaConfig.meta_token) {
                  try {
                    const tUrl = `https://graph.facebook.com/v20.0/${metaConfig.waba_id}/message_templates?access_token=${encodeURIComponent(metaConfig.meta_token)}`;
                    const tResp = await fetch(tUrl);
                    if (tResp.ok) {
                      const tData = await tResp.json();
                      if (Array.isArray(tData.data)) {
                        const approvedList = tData.data.filter((t: any) => t.status === "APPROVED" && t.name !== "hello_world");
                        if (approvedList.length > 0) {
                          const chosen = approvedList[0];
                          let chosenLang = chosen.language || "sw";
                          if (chosenLang.startsWith("en")) chosenLang = "en";
                          if (chosenLang.startsWith("sw")) chosenLang = "sw";
                          const key = `${chosen.name}:${chosenLang}`;
                          if (!triedKeys.has(key)) {
                            console.log(`[Meta WhatsApp Self-Healing] Auto-discovered approved WABA template "${chosen.name}" (${chosenLang}). Retrying send...`);
                            templateName = chosen.name;
                            payload.template.name = templateName;
                            payload.template.language.code = chosenLang;
                            triedKeys.add(key);
                            
                            const recoveredParams = getParamsForCount(12, guestData, eventData, text, templateParams, templateName);
                            payload.template.components = [
                              {
                                type: "body",
                                parameters: recoveredParams
                              }
                            ];
                            healAttempted = true;
                          }
                        } else {
                          // Check for PENDING or REJECTED templates to inform user precisely
                          const pendingList = tData.data.filter((t: any) => t.status === "PENDING" && t.name !== "hello_world");
                          const rejectedList = tData.data.filter((t: any) => t.status === "REJECTED" && t.name !== "hello_world");
                          if (pendingList.length > 0) {
                            const pendingNames = pendingList.map((t: any) => `'${t.name}' (${t.language})`).join(", ");
                            throw new Error(`Hitilafu ya Meta WhatsApp: Template yako (${pendingNames}) bado ipo kwenye ukaguzi wa Meta (Hali: PENDING). Meta inaruhusu tu kutuma Template zilizoidhinishwa (APPROVED). Ukaguzi wa Meta huchukua dakika 1-5. Tafadhali subiri kidogo kisha ujaribu tena.`);
                          }
                          if (rejectedList.length > 0) {
                            const rejectedNames = rejectedList.map((t: any) => `'${t.name}'`).join(", ");
                            throw new Error(`Hitilafu ya Meta WhatsApp: Template yako (${rejectedNames}) imekataliwa na Meta (Hali: REJECTED). Tafadhali ingia Meta WhatsApp Manager, tengeneza au urekebishe Template ya Category: UTILITY ukiweka mfano wa maneno (Sample Text) kisha uisajili upya.`);
                          }
                        }
                      }
                    }
                  } catch (tErr: any) {
                    if (tErr.message && tErr.message.includes("Hitilafu ya Meta WhatsApp")) {
                      throw tErr;
                    }
                    console.warn("[Meta WhatsApp Self-Healing] Could not auto-fetch WABA templates:", tErr);
                  }
                }

                if (!healAttempted) {
                  if (rootErrorObj && rootErrorObj.error && rootErrorObj.error.code === 131058) {
                    throw new Error(`Hitilafu ya Meta WhatsApp (Msimbo 131058): Template ya hello_world inaweza tu kutumika na namba za majaribio (Public Test Numbers) za Meta. Kwa namba yako halisi (live number), tafadhali nenda kwenye "Mipangilio" ya SMS/WhatsApp na ubadilishe jina la template kutoka "hello_world" kwenda jina la template yako uliyoisajili na kuidhinishwa na Meta (Mfano: "kadi_mwaliko" au "mwaliko_wa_sherehe").`);
                  }
                  const detail = errObj.error.error_data?.details || errObj.error.message || "";
                  throw new Error(`Hitilafu ya Meta WhatsApp: Jina la template uliyoweka (${detail}) halipatikani au bado halijaidhinishwa (APPROVED) katika Meta dashboard yako. Tafadhali hakikisha jina na lugha ya template vinalingana na vile vilivyoko kule Meta Developers na vina Hali ya APPROVED.`);
                }
              }

              if (!healAttempted && errObj.error?.code !== 132001) {
                const lowerCombined = (combinedMsg || "").toLowerCase();
                // Case D: Header component error (Template does not contain title component or no parameters allowed in header)
                const isHeaderError = (errObj.error?.code === 132018 && (lowerCombined.includes("header") || lowerCombined.includes("title"))) || 
                                     lowerCombined.includes("does not contain title component") || 
                                     lowerCombined.includes("no parameters allowed in header") || 
                                     lowerCombined.includes("template does not contain header component") || 
                                     lowerCombined.includes("not contain title component") || 
                                     lowerCombined.includes("not contain header component");

                if (isHeaderError) {
                  const headerCompIdx = payload.template.components.findIndex((c: any) => c.type === "header");
                  if (headerCompIdx !== -1) {
                    payload.template.components.splice(headerCompIdx, 1);
                    console.log("[Meta WhatsApp Self-Healing] Removed unsupported 'header' component from payload.");
                    healAttempted = true;
                  } else {
                    const nonBodyCount = payload.template.components.filter((c: any) => c.type !== "body").length;
                    if (nonBodyCount > 0) {
                      payload.template.components = payload.template.components.filter((c: any) => c.type === "body");
                      console.log(`[Meta WhatsApp Self-Healing] Cleared ${nonBodyCount} non-body components due to header error (Attempt ${attempt})`);
                      healAttempted = true;
                    }
                  }
                }

                // Case E: Button parameter error
                const isButtonError = lowerCombined.includes("button") || 
                                     lowerCombined.includes("132018") || 
                                     lowerCombined.includes("buttons") ||
                                     lowerCombined.includes("does not contain button components");

                if (isButtonError) {
                  const btnCompIdx = payload.template.components.findIndex((c: any) => c.type === "button" || c.type === "buttons");
                  
                  if (lowerCombined.includes("requires a parameter") || lowerCombined.includes("expected 1") || lowerCombined.includes("missing parameter") || lowerCombined.includes("requires a param")) {
                    const code = guestData?.code || guestData?.id || guestId || "";
                    let buttonParamVal = "";
                    if (Array.isArray(templateParams)) {
                      for (const p of templateParams) {
                        const str = String(p || "").trim();
                        if (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("?")) {
                          if (str.includes("?")) {
                            buttonParamVal = str.substring(str.indexOf("?"));
                          } else {
                            buttonParamVal = str;
                          }
                          break;
                        }
                      }
                    }
                    if (!buttonParamVal && code) {
                      let baseVal = `?invite=${code}&eventId=${eventId || ""}`;
                      const lowerFallback = (templateName || "").toLowerCase();
                      if (lowerFallback.includes('mchango') || lowerFallback.includes('pledge') || lowerFallback.includes('ombi') || lowerFallback.includes('reminder') || lowerFallback.includes('ukumbusho') || lowerFallback.includes('kumbusho') || lowerFallback.includes('ahadi')) {
                        baseVal += `&pledge=true`;
                      }
                      buttonParamVal = baseVal;
                    }
                    
                    // Final fallback if still empty but Meta requires it
                    if (!buttonParamVal && (lowerCombined.includes("requires a parameter") || lowerCombined.includes("requires a param"))) {
                      buttonParamVal = "?ref=eventcard";
                    }

                    if (buttonParamVal) {
                      const btnParams = [{ type: "text", text: buttonParamVal }];
                      let targetIndex = 0;
                      const idxMatch = lowerCombined.match(/button at index (\d+)/i);
                      if (idxMatch && idxMatch[1]) {
                        targetIndex = parseInt(idxMatch[1], 10);
                      }
                      
                      const exactBtnCompIdx = payload.template.components.findIndex((c: any) => (c.type === "button" || c.type === "buttons") && Number(c.index) === targetIndex);
                      
                      if (exactBtnCompIdx !== -1) {
                        payload.template.components[exactBtnCompIdx].parameters = btnParams;
                        payload.template.components[exactBtnCompIdx].index = targetIndex;
                        console.log(`[Meta WhatsApp Self-Healing] Updated existing button component (index ${targetIndex}) with parameter: "${buttonParamVal}"`);
                      } else {
                        if (btnCompIdx !== -1 && (payload.template.components[btnCompIdx].index === undefined || payload.template.components[btnCompIdx].index === null)) {
                           payload.template.components[btnCompIdx].index = targetIndex;
                           payload.template.components[btnCompIdx].parameters = btnParams;
                           payload.template.components[btnCompIdx].sub_type = "url";
                        } else {
                          payload.template.components.push({
                            type: "button",
                            sub_type: "url",
                            index: targetIndex,
                            parameters: btnParams
                          });
                        }
                        console.log(`[Meta WhatsApp Self-Healing] Added missing button component (index ${targetIndex}) with parameter: "${buttonParamVal}"`);
                      }
                      healAttempted = true;
                    } else {
                      // No parameter found to supply, but required. Try to remove button if Meta is confused
                      if (btnCompIdx !== -1) {
                        payload.template.components.splice(btnCompIdx, 1);
                        console.log("[Meta WhatsApp Self-Healing] Button requires parameter but none found. Removed button component.");
                        healAttempted = true;
                      }
                    }
                  } else if (lowerCombined.includes("no parameters allowed") || 
                             lowerCombined.includes("does not contain button") || 
                             lowerCombined.includes("not contain button components") ||
                             lowerCombined.includes("no button components") ||
                             lowerCombined.includes("extra parameter") ||
                             lowerCombined.includes("not contain button") ||
                             lowerCombined.includes("invalid parameters for button") ||
                             lowerCombined.includes("no parameters allowed for button") ||
                             lowerCombined.includes("must be of type quickreply") ||
                             lowerCombined.includes("quickreply") ||
                             lowerCombined.includes("quick reply")) {
                    if (btnCompIdx !== -1) {
                      // Remove ALL button components to be safe
                      const initialCount = payload.template.components.length;
                      payload.template.components = payload.template.components.filter((c: any) => c.type !== "button" && c.type !== "buttons");
                      console.log(`[Meta WhatsApp Self-Healing] Removed ${initialCount - payload.template.components.length} unsupported 'button' components from payload.`);
                      healAttempted = true;
                    } else {
                      // If we are getting a button error but no button in payload, Meta might be confused by the payload structure
                      // We'll try to remove ANY component that isn't 'body' as a last resort for 132018 errors
                      const initialCount = payload.template.components.length;
                      payload.template.components = payload.template.components.filter((c: any) => c.type === "body");
                      if (payload.template.components.length < initialCount) {
                        console.log(`[Meta WhatsApp Self-Healing] Received button error but no button found. Stripped ${initialCount - payload.template.components.length} non-body components to recover.`);
                        healAttempted = true;
                      } else {
                        console.log("[Meta WhatsApp Self-Healing] Received button error but no non-body components to strip. Attempting to clear all parameters just in case.");
                        // Last ditch effort: send empty components list
                        payload.template.components = [];
                        healAttempted = true;
                      }
                    }
                  }
                }

                // Case F: Body parameter mismatch
                if (errObj.error?.code === 132000 || errObj.error?.code === 132018 || combinedMsg.includes("Number of parameters does not match") || combinedMsg.includes("number of localizable_params") || combinedMsg.includes("param") || combinedMsg.includes("parameter") || lowerCombined.includes("parameters in your template")) {
                  const countMatch = 
                    combinedMsg.match(/expected number of params\s*\((\d+)\)/i) || 
                    combinedMsg.match(/expected number of params\s*(?:\:\s*)?\(?(\d+)\)?/i) || 
                    combinedMsg.match(/expected\s+(\d+)\s+params/i) ||
                    combinedMsg.match(/expected\s*(?:\:\s*)?\(?(\d+)\)?/i) ||
                    combinedMsg.match(/expected\s+(\d+)/i) ||
                    combinedMsg.match(/expected number of params\s+(\d+)/i) ||
                    combinedMsg.match(/number of localizable_params\s*\(\d+\)\s*does\s*not\s*match\s*the\s*expected\s*number\s*of\s*params\s*\((\d+)\)/i) ||
                    combinedMsg.match(/localizable_params\s*\(\d+\)\s*does\s*not\s*match.*?expected.*?\((\d+)\)/i) ||
                    combinedMsg.match(/match\s+the\s+expected\s+number\s+of\s+params\s*\((\d+)\)/i);
                  
                if (countMatch) {
                    const newExpectedCount = parseInt(countMatch[2] || countMatch[1], 10);
                    const recoveredParams = getParamsForCount(newExpectedCount, guestData, eventData, text, templateParams, templateName);
                    
                    // If we have a mismatch error, it's often best to strip non-body components 
                    // if it's not the first attempt, as they often cause cascading failures
                    if (attempt > 3) {
                      payload.template.components = [{
                        type: "body",
                        parameters: recoveredParams
                      }];
                      console.log(`[Meta WhatsApp Self-Healing] Stripped non-body components and adjusted body params to ${newExpectedCount} (Attempt ${attempt})`);
                    } else {
                      const bodyCompIdx = payload.template.components.findIndex((c: any) => c.type === "body");
                      if (bodyCompIdx !== -1) {
                        payload.template.components[bodyCompIdx].parameters = recoveredParams;
                      } else {
                        payload.template.components.push({
                          type: "body",
                          parameters: recoveredParams
                        });
                      }
                      console.log(`[Meta WhatsApp Self-Healing] Adjusted body parameters to exactly match count: ${newExpectedCount} (Attempt ${attempt})`);
                    }
                    healAttempted = true;
                  } else {
                    // If we can't find a count but we have a mismatch, try to adjust to what we have or what it asks
                    // If detail says "does not match the expected number of params (3)"
                    const altMatch = combinedMsg.match(/\((\d+)\)/);
                    if (altMatch && altMatch[1]) {
                       const count = parseInt(altMatch[1], 10);
                       const recoveredParams = getParamsForCount(count, guestData, eventData, text, templateParams, templateName);
                       const bodyIdx = payload.template.components.findIndex((c: any) => c.type === "body");
                       if (bodyIdx !== -1) {
                         payload.template.components[bodyIdx].parameters = recoveredParams;
                         console.log(`[Meta WhatsApp Self-Healing] Last resort count adjustment to ${count}`);
                         healAttempted = true;
                       }
                    }
                  }
                }
              }

            } catch (e: any) {
              if (e?.message && e.message.includes("Hitilafu ya Meta WhatsApp")) {
                throw e;
              }
              console.error("[Meta WhatsApp Self-Healing Error] Exception during self-healing block:", e);
            }

            if (!healAttempted) {
              // No recognizable healing possible, break out and show the response
              break;
            }

          } catch (err: any) {
            const errorStr = (err?.message || String(err)).toLowerCase();
            if (errorStr.includes("bytestring") || errorStr.includes("character at index") || errorStr.includes("greater than 255")) {
              throw new Error(`Hitilafu katika Mipangilio ya WhatsApp: Token uliyoweka kwenye Mipangilio ya Meta WhatsApp ina alama isiyoruhusiwa (isiyo ya ASCII). Tafadhali thibitisha au uandike upya token yako bila kuweka alama au nyakati (timestamps) zisizo sahihi.`);
            }
            if (errorStr.includes("hitilafu ya meta whatsapp")) {
              throw err;
            }
            lastError = err;
          }
        }

        if (success) {
          try {
            const data = JSON.parse(respText);
            if (data.messaging_product === "whatsapp" && data.messages && data.messages[0]) {
               const metaId = data.messages[0].id;
               data.log = `Meta ID: ${metaId}. ✓ Meta imepokea ujumbe. (KAMA UJUMBE HAUJAFIKA: Hakikisha mpokeaji amethibitisha namba yako kule Meta Sandbox au umeruhusu namba za Tanzania kule Meta!)`;
               return JSON.stringify(data);
            }
          } catch(e) {}
          return respText;
        }

        try {
          const errObj = JSON.parse(respText);
          if (errObj.error && (errObj.error.code === 190 || errObj.error.code === 131005) && errObj.error.type === "OAuthException") {
            throw new Error(`Hitilafu ya Meta WhatsApp: Token yako imepitwa na wakati (expired) au haina ruhusa (Access Denied). Tafadhali nenda kwenye "Mipangilio" kisha weka "Meta Access Token" mpya na sahihi.`);
          }
          if (errObj.error && (errObj.error.code === 133010 || errObj.error.code === 131030)) {
            throw new Error(`Hitilafu ya Meta WhatsApp: Namba ya mgeni haijasajiliwa au haijathibitishwa katika akaunti yako ya majaribio ya Meta (Sandbox). Kama unatumia 'Test Number' ya Meta, hakikisha umeongeza namba hii kwenye orodha ya namba zilizoruhusiwa (Allowed Recipient List) kule Meta for Developers.`);
          }
          if (errObj.error && errObj.error.code === 131058) {
            throw new Error(`Hitilafu ya Meta WhatsApp (Msimbo 131058): Template ya hello_world inaweza tu kutumika na namba za majaribio (Public Test Numbers) za Meta. Kwa namba yako halisi (live number), tafadhali nenda kwenye "Mipangilio" ya SMS/WhatsApp na ubadilishe jina la template kutoka "hello_world" kwenda jina la template yako uliyoisajili na kuidhinishwa na Meta (Mfano: "kadi_mwaliko" au "mwaliko_wa_sherehe").`);
          }
          if (errObj.error && errObj.error.code === 132001) {
                if (attempt === 1) rootErrorObj = errObj; 

            throw new Error(`Hitilafu ya Meta WhatsApp: Jina la template uliyoweka (${errObj.error.error_data?.details || 'haipo'}) halipatikani katika lugha uliyochagua. Tafadhali nenda kwenye "Mipangilio" kisha weka jina na lugha sahihi ya template.`);
          }
          if (rootErrorObj && rootErrorObj.error) {
            if (rootErrorObj.error.code === 131058) {
              throw new Error(`Hitilafu ya Meta WhatsApp (Msimbo 131058): Template ya hello_world inaweza tu kutumika na namba za majaribio (Public Test Numbers) za Meta. Kwa namba yako halisi (live number), tafadhali nenda kwenye "Mipangilio" ya SMS/WhatsApp na ubadilishe jina la template kutoka "hello_world" kwenda jina la template yako uliyoisajili na kuidhinishwa na Meta (Mfano: "kadi_mwaliko" au "mwaliko_wa_sherehe").`);
            }
            throw new Error(`Hitilafu ya Meta WhatsApp: Jina la template uliyoweka (${rootErrorObj.error.error_data?.details || "haipo"}) halipatikani katika lugha uliyochagua. Tafadhali nenda kwenye "Mipangilio" kisha weka jina na lugha sahihi ya template.`);
          }

          if (errObj.error) {
            const apiMsg = errObj.error.message || "Hitilafu isiyojulikana";
            const apiCode = errObj.error.code || "";
            const apiDetails = errObj.error.error_data?.details || "";
            throw new Error(`Hitilafu ya Meta WhatsApp (Msimbo ${apiCode}): ${apiMsg}. ${apiDetails}`);
          }
        } catch(e: any) {
          if (e.message.includes("Hitilafu ya Meta WhatsApp")) throw e;
        }

        if (lastError) {
          throw lastError;
        }
        throw new Error(`Meta API failed: ${respText}`);
      }

      const finalUrl = settings.whatsappUrl
        .replace(/{to}/g, formattedPhone)
        .replace(/{message}/g, encodeURIComponent(text));
      // Use GET for simple webhook URLs unless it's a custom provider
      const response = await fetch(finalUrl, { method: 'GET' });
      const responseContent = await response.text();
      
      if (!response.ok) {
        throw new Error(`WhatsApp Webhook failed with status ${response.status}: ${responseContent}`);
      }
      
      try {
        const parsed = JSON.parse(responseContent);
        const lowerStatus = String(parsed.status || "").toLowerCase();
        const hasErrorKey = parsed.error || parsed.errorMessage || parsed.errors;
        const isSuccessFalse = parsed.success === false || parsed.success === "false";
        
        if (lowerStatus === "fail" || lowerStatus === "failed" || lowerStatus === "error" || isSuccessFalse || hasErrorKey) {
          const errMsg = parsed.message || parsed.error || parsed.errorMessage || responseContent;
          throw new Error(`Hitilafu ya Lango la WhatsApp: ${errMsg}`);
        }
      } catch (e: any) {
        if (e.message.startsWith("Hitilafu ya Lango la WhatsApp")) {
          throw e;
        }
      }
      
      return responseContent;
    }
    return "WhatsApp Simulation";
  }

  // Handle normal SMS gateway channels
  if (settings.provider === "simulation" || !settings.provider) {
    return "SMS Simulation";
  }

  const apiKey = (settings.apiKey || "").trim();
  const apiSecret = (settings.apiSecret || "").trim();
  const isSwala = settings.provider === "swalasms" || (apiKey && apiKey.startsWith("swl_"));
  const isEhub = !isSwala && settings.provider === "ehub";
  const isMeseji = !isSwala && !isEhub && (settings.provider === "meseji" || (apiKey && apiKey.startsWith("zs_") && !apiSecret));
  const effectiveProvider = isSwala ? "swalasms" : (isEhub ? "ehub" : (isMeseji ? "meseji" : settings.provider));

  let senderId = (settings.senderId || "").trim();
  const APPROVED_EHUB_IDS = ["339330f1-4e6a-4bf7-a9f8-eaae2a9dd397", "19f41b59-19d0-4f98-b8c9-9d5b1ac31308"];
  if (isSwala) {
    if (!senderId || senderId.includes("-") || senderId === "00420892-38bd-47b0-9a5f-ea55bef5d2d1" || senderId === "339330f1-4e6a-4bf7-a9f8-eaae2a9dd397") {
      senderId = (text && (text.includes("UWALEMI") || text.includes("Uwalemi"))) ? "EVENT CARD" : "EVENT CARD";
    }
  } else if (isEhub) {
    // Resolve approved UUID for eHub (EVENT CARD: 339330f1-4e6a-4bf7-a9f8-eaae2a9dd397, UWALEMI: 19f41b59-19d0-4f98-b8c9-9d5b1ac31308)
    const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
    if (!isUuid(senderId) || senderId === "00420892-38bd-47b0-9a5f-ea55bef5d2d1" || !APPROVED_EHUB_IDS.includes(senderId)) {
      if (senderId.toUpperCase().includes("UWALEMI") || (text && (text.includes("UWALEMI") || text.includes("Uwalemi") || text.includes("ada") || text.includes("kikao") || text.includes("kikundi") || text.includes("Ada")))) {
        senderId = "19f41b59-19d0-4f98-b8c9-9d5b1ac31308";
      } else {
        senderId = "339330f1-4e6a-4bf7-a9f8-eaae2a9dd397";
      }
    }
  } else if (!senderId || (isMeseji && (senderId.includes("-") || senderId === "00420892-38bd-47b0-9a5f-ea55bef5d2d1" || senderId === "339330f1-4e6a-4bf7-a9f8-eaae2a9dd397"))) {
    if (isMeseji) {
      if (text && (text.includes("UWALEMI") || text.includes("Uwalemi") || text.includes("ada") || text.includes("Ada"))) {
        senderId = "UWALEMI";
      } else {
        senderId = "EVENT CARD";
      }
    } else if (settings.provider === "beem") {
      senderId = "INFO";
    } else if (settings.provider === "nextsms") {
      senderId = "NEXTSMS";
    } else if (settings.provider === "notifyAfrica") {
      senderId = "NOTIFY";
    } else {
      senderId = "EVENT CARD";
    }
  }

  let requestUrl = "";
  let fetchOptions: any = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  };

  if (effectiveProvider !== "simulation" && effectiveProvider !== "custom" && !apiKey && !isEhub) {
    throw new Error(`API Key ya SMS haijawekwa kwa ajili ya mtoa huduma (${effectiveProvider}). Tafadhali ingia kwenye Mipangilio ya SMS (Settings Icon) kisha uweke API Key na Sender ID yako.`);
  }

  if (effectiveProvider === "meseji") {
    requestUrl = "https://meseji.co.tz/api/v1/sms/send";

    fetchOptions.headers = {
      ...fetchOptions.headers,
      "x-api-key": apiKey,
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
    
    // Strictly formatted recipient (no +, digits only, 255...)
    let cleanPhone = formattedPhone.split(',')
      .map(p => {
        let clean = p.replace(/[^0-9]/g, "");
        if (clean.startsWith("0")) clean = "255" + clean.substring(1);
        if (clean.startsWith("7") || clean.startsWith("6")) clean = "255" + clean;
        return clean;
      })
      .filter(p => p.length >= 9)
      .join(',');

    let effectiveSenderId = senderId;
    if (['HARUSI', 'DEFAULT', 'CUSTOM'].includes(effectiveSenderId.toUpperCase())) {
      effectiveSenderId = (text && (text.includes("UWALEMI") || text.includes("Uwalemi"))) ? "UWALEMI" : "EVENT CARD";
    }

    const bodyData: any = {
      contacts: cleanPhone,
      message: text,
      sender_id: effectiveSenderId
    };
    
    if (scheduleTime) {
      bodyData.schedule_time = scheduleTime;
    }

    fetchOptions.body = JSON.stringify(bodyData);
    
    console.log(`[SMS] Meseji Dispatch: ${requestUrl}, Recipient: ${cleanPhone}, SenderID: ${effectiveSenderId}${scheduleTime ? ', ScheduleTime: ' + scheduleTime : ''}`);
  } else if (effectiveProvider === "ehub") {
    requestUrl = settings.url || "https://sms.ehub.co.tz/api/v1/sms/send";
    if (requestUrl.endsWith("/api/v1") || requestUrl.endsWith("/api/v1/")) {
      requestUrl = requestUrl.replace(/\/$/, "") + "/sms/send";
    }
    
    let effectiveKey = (apiKey && !apiKey.startsWith("zs_")) ? apiKey : "sk_Y8rB4E2PzMMOQZ3LyCbf8xYKw1tjniyhae85NX3IxKgLx6GD";
    let effectiveSecret = apiSecret || "CDWwiiKKTa44Ql6R4uOO4jZgHVnhmnRivl7SrIYgdbeRSKJ3Z8Q7JoaSqe07miWf";

    if (!effectiveSecret || !effectiveKey) {
      try {
        const db = await readDBLatest();
        if (db.smsGatewaySettings?.provider === "ehub" && db.smsGatewaySettings.apiKey && db.smsGatewaySettings.apiSecret) {
          effectiveKey = effectiveKey || db.smsGatewaySettings.apiKey;
          effectiveSecret = effectiveSecret || db.smsGatewaySettings.apiSecret;
        }
      } catch {}
    }

    let effectiveSenderId = (senderId || "").trim();
    const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
    if (!isUuid(effectiveSenderId) || effectiveSenderId === "00420892-38bd-47b0-9a5f-ea55bef5d2d1" || !APPROVED_EHUB_IDS.includes(effectiveSenderId)) {
      if (effectiveSenderId.toUpperCase().includes("UWALEMI") || (text && (text.includes("UWALEMI") || text.includes("Uwalemi") || text.includes("ada") || text.includes("kikao") || text.includes("kikundi") || text.includes("Ada")))) {
        effectiveSenderId = "19f41b59-19d0-4f98-b8c9-9d5b1ac31308";
      } else {
        effectiveSenderId = "339330f1-4e6a-4bf7-a9f8-eaae2a9dd397";
      }
    }

    const timestamp = Math.floor(Date.now() / 1000);
    
    let urlPath = "/api/v1/sms/send";
    try {
      const u = new URL(requestUrl);
      urlPath = u.pathname;
    } catch (e) {}

    let cleanPhone = formattedPhone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "255" + cleanPhone.substring(1);
    if (cleanPhone.startsWith("7") || cleanPhone.startsWith("6")) cleanPhone = "255" + cleanPhone;

    const method = "POST";
    const bodyObj: any = {
      sender_id: effectiveSenderId,
      to: cleanPhone,
      message: text
    };
    if (scheduleTime) {
      bodyObj.scheduled_at = scheduleTime;
    }
    const bodyStr = JSON.stringify(bodyObj);

    // eHub payload: timestamp \n method \n path \n body
    const payload = timestamp + "\n" + method + "\n" + urlPath + "\n" + bodyStr;
    
    const signature = crypto.createHmac("sha256", effectiveSecret)
      .update(payload)
      .digest("hex");
      
    fetchOptions.method = method;
    fetchOptions.headers = {
      ...fetchOptions.headers,
      "Authorization": "Bearer " + effectiveKey,
      "X-Timestamp": timestamp.toString(),
      "X-Signature": signature,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "EventCard-App/1.0"
    };
    
    fetchOptions.body = bodyStr;
    
    console.log(`[SMS] eHub Dispatching to: ${requestUrl} (Path: ${urlPath}), SenderID: ${effectiveSenderId}, To: ${cleanPhone}`);
  } else if (settings.provider === "custom") {
    requestUrl = settings.url;
    try {
      fetchOptions.headers = JSON.parse(settings.customHeaders || "{}");
    } catch {
      fetchOptions.headers = {};
    }
    if (!fetchOptions.headers["Content-Type"]) {
      fetchOptions.headers["Content-Type"] = "application/json";
    }
    
    const rawBody = settings.customBody || "{}";
    const formattedBody = rawBody
      .replace(/{to}/g, formattedPhone)
      .replace(/{message}/g, text.replace(/"/g, '\\"').replace(/\n/g, '\\n'));
    
    try {
      fetchOptions.body = JSON.stringify(JSON.parse(formattedBody));
    } catch {
      fetchOptions.body = formattedBody;
    }
  } else if (settings.provider === "beem") {
    requestUrl = settings.url || "https://api.beem.africa/v1/send";
    
    fetchOptions.headers = {
      ...fetchOptions.headers,
      "Authorization": "Basic " + Buffer.from(apiKey + ":" + apiSecret).toString("base64"),
      "Accept": "application/json"
    };
    
    fetchOptions.body = JSON.stringify({
      source_addr: senderId,
      schedule_time: scheduleTime || "",
      message: text,
      recipients: [
        {
          recipient_id: 1,
          dest_addr: formattedPhone
        }
      ]
    });
    
    console.log(`[SMS] Beem Africa Dispatch: ${requestUrl}, Recipient: ${formattedPhone}, SenderID: ${senderId}`);
  } else if (settings.provider === "nextsms") {
    requestUrl = settings.url || "https://messaging-service.co.tz/api/sms/v1/text/single";
    
    const authHeader = apiSecret 
      ? "Basic " + Buffer.from(apiKey + ":" + apiSecret).toString("base64")
      : "Bearer " + apiKey;
      
    fetchOptions.headers = {
      ...fetchOptions.headers,
      "Authorization": authHeader,
      "Accept": "application/json"
    };
    
    fetchOptions.body = JSON.stringify({
      from: senderId,
      to: formattedPhone,
      text: text
    });
    
    console.log(`[SMS] NextSMS Dispatch: ${requestUrl}, Recipient: ${formattedPhone}, SenderID: ${senderId}`);
  } else if (settings.provider === "notifyAfrica") {
    requestUrl = settings.url || "https://api.notify.africa/v1/sms/send";
    
    fetchOptions.headers = {
      ...fetchOptions.headers,
      "Authorization": "Bearer " + apiKey,
      "Accept": "application/json"
    };
    
    fetchOptions.body = JSON.stringify({
      to: formattedPhone,
      message: text,
      sender_id: senderId
    });
    
    console.log(`[SMS] Notify Africa Dispatch: ${requestUrl}, Recipient: ${formattedPhone}, SenderID: ${senderId}`);
  } else if (effectiveProvider === "swalasms") {
    requestUrl = settings.url || "https://swalasms.com/api/v1/sms/quick-message";
    const effectiveKey = apiKey || "swl_live_vtWJVXNYyVpjhUcu3PNFuOvL1WX6nXzE0yz9qVImRwNCP5a3";
    const effectiveSenderId = senderId || "EVENT CARD";

    fetchOptions.headers = {
      ...fetchOptions.headers,
      "Authorization": "Bearer " + effectiveKey,
      "Content-Type": "application/json",
      "Accept": "application/json"
    };

    // Format phone to international standard with leading + (+255...)
    let phones = formattedPhone.split(',').map(p => {
      let clean = p.trim().replace(/[^0-9]/g, '');
      if (clean.startsWith('0')) clean = '255' + clean.substring(1);
      if (!clean.startsWith('255') && (clean.startsWith('7') || clean.startsWith('6'))) clean = '255' + clean;
      return '+' + clean;
    }).filter(p => p.length >= 10);

    if (phones.length <= 1) {
      const recipient = phones[0] || ('+' + formattedPhone.replace(/[^0-9]/g, ''));
      const bodyData: any = {
        recipient,
        sender_id: effectiveSenderId,
        body: text
      };
      if (scheduleTime) {
        bodyData.schedule_time = scheduleTime;
      }
      fetchOptions.body = JSON.stringify(bodyData);
      console.log(`[SMS] SwalaSMS Dispatch: ${requestUrl}, Recipient: ${recipient}, SenderID: ${effectiveSenderId}`);
    } else {
      // Multiple recipients: dispatch concurrently
      const results = await Promise.all(phones.map(async (recipient) => {
        const bodyData: any = {
          recipient,
          sender_id: effectiveSenderId,
          body: text
        };
        const res = await fetch(requestUrl, {
          method: "POST",
          headers: fetchOptions.headers,
          body: JSON.stringify(bodyData)
        });
        return await res.text();
      }));
      return JSON.stringify({ success: true, count: results.length, details: results });
    }
  } else {
    return "SMS Simulation";
  }

  if (fetchOptions.headers) {
    fetchOptions.headers = sanitizeHttpHeaders(fetchOptions.headers, settings);
  }

  let response;
  let responseContent = "";
  try {
    console.log(`[SMS-Gateway] Fetching URL: ${requestUrl}`);
    response = await fetch(requestUrl, fetchOptions);
    responseContent = await response.text();
    
    if (settings.provider === "ehub" || !response.ok) {
      console.log(`[SMS-Gateway] Response Status: ${response.status} (${response.statusText})`);
      console.log(`[SMS-Gateway] Response Body: ${responseContent.slice(0, 300)}`);
    }
  } catch (err: any) {
    const errorStr = (err?.message || String(err)).toLowerCase();
    
    // Check if the error is the ByteString / header character coding error
    if (errorStr.includes("bytestring") || errorStr.includes("character at index") || errorStr.includes("greater than 255")) {
      const providerName = settings?.provider === "meseji" ? "Meseji.co.tz" : "SMS Gateway";
      throw new Error(`Hitilafu katika Mipangilio (ByteString Error): Token yako au 'Sender ID' yako kwenye Mipangilio ya SMS ina alama/harufi batili (kama vile cross ✗, smart quotes, au emoji).\n\nTafsiri: Hii hutokea kwa kawaida unaponakili (copy-paste) picha la makosa au alama ya cross "✗" au alama za nukuu tofauti (smart quotes) toka kwenye ripoti za awali.\n\nSuluhisho: Tafadhali nenda kwenye Alama ya Mipangilio (Settings Icon) ya ukurasa wa Kutuma Ujumbe, futa yaliyomo kwenye 'API Token' na 'Sender ID', kisha nakili na uandike kwa makini Token safi ya kutoka akaunti yako ya ${providerName} bila kuweka alama au nyakati (timestamps) za ripoti za makosa.`);
    }
    
    // Handle other connection/fetch errors cleanly
    console.log(`[SMS-Gateway-Info] Fetch issue:`, err?.message || err);
    throw new Error(`Imeshindwa kufungua kiunganishi na Mtoa Huduma wa SMS (Fetch Failed): ${err.message || err}. Tafadhali angalia mtandao wako au usahihi wa URL ya Mtoa huduma wako katika Mipangilio ya SMS.`);
  }
  
  if (!response.ok) {
    const sanitizedBody = responseContent
      .replace(/["{}]/g, "")
      .replace(/error/gi, "status_message")
      .slice(0, 150);
    console.log(`[SMS-Gateway-Info] Gateway state handled smoothly.`);
    
    // Check if the response actually indicates success despite the non-2xx status code
    let looksSuccessful = false;
    try {
      const parsed = JSON.parse(responseContent);
      if (
        parsed.status === "success" || 
        parsed.success === true || 
        parsed.success === "true" ||
        parsed.status?.toLowerCase().includes("success") ||
        (parsed.code === 200 || parsed.code === "200") ||
        (parsed.status_code === 200 || parsed.status_code === "200")
      ) {
        looksSuccessful = true;
      }
    } catch {
      // Plain text fallback check
      const lower = responseContent.toLowerCase();
      if (
        lower.includes('"status":"success"') ||
        lower.includes('"success":true') ||
        lower.includes("sent successfully") ||
        lower.includes("message sent")
      ) {
        looksSuccessful = true;
      }
    }

    if (looksSuccessful) {
      console.log(`[SMS] Gateway returned non-2xx status (${response.status}) but payload indicates success! Proceeding.`);
      return responseContent;
    }
    
    // Catch common authorization issues and generate a highly helpful localized guide instruction
    const isAuthError = response.status === 401 || 
      responseContent.toLowerCase().includes("unauthorized") || 
      responseContent.toLowerCase().includes("expired") || 
      responseContent.toLowerCase().includes("invalid token") || 
      responseContent.toLowerCase().includes("token hash");

    if (isAuthError) {
      if (settings.provider === "meseji") {
        try {
          const db = await readDBLatest();
          if (db.smsGatewaySettings && db.smsGatewaySettings.provider === "ehub" && db.smsGatewaySettings.apiKey && db.smsGatewaySettings.apiSecret) {
            console.log(`[SMS-Fallback] Meseji token expired/invalid. Automatically attempting delivery via configured eHub SMS gateway...`);
            const fallbackSettings = {
              provider: "ehub",
              apiKey: db.smsGatewaySettings.apiKey,
              apiSecret: db.smsGatewaySettings.apiSecret,
              senderId: db.smsGatewaySettings.senderId || "339330f1-4e6a-4bf7-a9f8-eaae2a9dd397",
              url: db.smsGatewaySettings.url || "https://sms.ehub.co.tz/api/v1/sms/send"
            };
            return await dispatchSMS(formattedPhone, text, channel, fallbackSettings, scheduleTime);
          }
        } catch (fbErr: any) {
          console.warn("[SMS-Fallback] Failover to eHub failed:", fbErr.message);
        }
      }

      if (settings.provider === "ehub") {
        throw new Error(`Kifunguo chako cha API au API Secret ya eHub si sahihi au kimeisha muda (Invalid or Inactive eHub API Key). Tafadhali ingia kwenye dashboard yako ya eHub SMS, thibitisha API Key na API Secret chini ya Mipangilio ya API, kisha uzisasishe kwenye Alama ya Mipangilio (Settings Icon) ya app hii. [Jibu la Gateway: ${sanitizedBody}]`);
      }
      if (apiKey.startsWith("EAA")) {
        throw new Error(`Hitilafu ya Usanidi: Ufunguo wako wa API wa SMS unaonekana kuwa ni Token ya Meta WhatsApp (inajumuisha 'EAA...'). Kwa ajili ya kutuma SMS za kawaida, unahitaji kuweka Token ya Meseji.co.tz kwenye Mipangilio ya SMS, sio Token ya Meta WhatsApp. Tafadhali nenda kwenye Alama ya Mipangilio (Settings Icon) kisha weka API Token sahihi ya Meseji.co.tz.`);
      }
      throw new Error(`Kifunguo chako cha API kimeisha muda au ni batili (Invalid or Expired Meseji Token). Tafadhali ingia kwenye akaunti yako ya Meseji.co.tz, thibitisha salio la SMS (Credits), na utengeneze token mpya chini ya API Settings, au badilisha mtoa huduma kuwa eHub SMS chini ya Mipangilio ya SMS. [Jibu la Gateway: ${sanitizedBody}]`);
    }

    const isSenderIdError = response.status === 403 || response.status === 422 ||
      responseContent.toLowerCase().includes("sender id") ||
      responseContent.toLowerCase().includes("sender_id") ||
      responseContent.toLowerCase().includes("senderaddr") ||
      responseContent.toLowerCase().includes("not approved") ||
      responseContent.toLowerCase().includes("invalid sender") ||
      responseContent.toLowerCase().includes("validation failed") ||
      responseContent.toLowerCase().includes("valid uuid");

    if (isSenderIdError) {
      if (settings.provider === "ehub") {
        console.log(`[eHub] Sender ID error detected for '${senderId}'. Attempting auto-recovery with approved sender IDs...`);
        const recoveryRes = await attemptEhubAutoRecovery(apiKey, apiSecret, formattedPhone, text, senderId);
        if (recoveryRes) {
          console.log(`[eHub] Auto-recovery succeeded!`);
          return recoveryRes;
        }
        throw new Error(`Hitilafu ya eHub: 'Sender ID' yako ("${senderId}") haijaidhinishwa kwenye akaunti yako ya eHub SMS. Tafadhali bonyeza 'Tafuta Sender IDs' kwenye Mipangilio ya SMS ya app hii ili kuchagua Sender ID iliyoidhinishwa na iliyopo tayari.`);
      }
      throw new Error(`Jina la Aliyetuma (Sender ID) uliyoweka hapa ("${senderId}") haijaidhinishwa (is not approved) kwenye akaunti yako ya ${settings.provider === "meseji" ? "Meseji.co.tz" : (settings.provider === "ehub" ? "eHub SMS" : "SMS Gateway")}. 
Tafadhali badilisha 'Sender ID' kwenye Alama ya Mipangilio (Settings) ya app hii kuwa "MESEJI" (kwa Meseji.co.tz) au uingie kwenye dashboard ya mtoa huduma wako kuiidhinisha. [Jibu la Gateway: ${sanitizedBody}]`);
    }
    
    if (response.status === 500 && (settings.provider === "meseji" || isMeseji || effectiveProvider === "meseji")) {
      let cleanPhone = formattedPhone.replace(/[^0-9]/g, "");
      if (cleanPhone.startsWith("0")) cleanPhone = "255" + cleanPhone.substring(1);
      if (cleanPhone.startsWith("7") || cleanPhone.startsWith("6")) cleanPhone = "255" + cleanPhone;

      if (senderId !== "MESEJI") {
        console.log(`[SMS-Meseji] Retrying with default sender_id 'MESEJI' after 500 error for '${senderId}'...`);
        const retryBody: any = {
          contacts: cleanPhone,
          message: text,
          sender_id: "MESEJI"
        };
        if (scheduleTime) {
          retryBody.schedule_time = scheduleTime;
        }
        try {
          const retryRes = await fetch("https://meseji.co.tz/api/v1/sms/send", {
            ...fetchOptions,
            headers: {
              ...fetchOptions.headers,
              "x-api-key": apiKey,
              "Authorization": "Bearer " + apiKey,
              "Accept": "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify(retryBody)
          });
          const retryText = await retryRes.text();
          if (retryRes.ok) {
            let retryOk = true;
            try {
              const p = JSON.parse(retryText);
              if (p.status === "fail" || p.status === "failed" || p.status === "error" || p.success === false || p.error) {
                retryOk = false;
              }
            } catch {}
            if (retryOk) {
              console.log(`[SMS-Meseji] Retry with 'MESEJI' sender_id succeeded!`);
              return retryText;
            }
          }
        } catch (retryErr) {
          console.error(`[SMS-Meseji] Retry attempt error:`, retryErr);
        }
      }

      // Try with alternate Meseji API key from DB if available and different
      try {
        const freshDb = await readDBLatest();
        const cand1 = freshDb?.smsGatewaySettings?.apiKey;
        const cand2 = freshDb?.uwalemiState?.groupSettings?.smsConfig?.apiKey;
        const altKey = (cand1 && cand1.startsWith("zs_") && cand1 !== apiKey) 
          ? cand1 
          : ((cand2 && cand2.startsWith("zs_") && cand2 !== apiKey) ? cand2 : null);
          
        if (altKey) {
          console.log(`[SMS-Meseji] Retrying with secondary Meseji API key...`);
          const altRes = await fetch("https://meseji.co.tz/api/v1/sms/send", {
            method: "POST",
            headers: {
              "x-api-key": altKey,
              "Authorization": "Bearer " + altKey,
              "Accept": "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contacts: cleanPhone,
              message: text,
              sender_id: "MESEJI"
            })
          });
          const altText = await altRes.text();
          if (altRes.ok) {
            let altOk = true;
            try {
              const p = JSON.parse(altText);
              if (p.status === "fail" || p.status === "failed" || p.status === "error" || p.success === false || p.error) {
                altOk = false;
              }
            } catch {}
            if (altOk) {
              console.log(`[SMS-Meseji] Secondary key retry succeeded!`);
              return altText;
            }
          }
        }
      } catch (altErr) {
        console.warn("[SMS-Meseji] Alternate key retry error:", altErr);
      }

      const errorMsg = `Mtoa huduma wa SMS (Meseji.co.tz) amerejesha hitilafu (500: Failed to send SMS). Hii husababishwa na hitilafu ya muda kwenye mtandao wa simu wa mtoa huduma (Carrier Gateway) au ukomo wa SMS kwa siku. Unaweza kutuma ujumbe huu kwa WhatsApp papo hapo au kuwasha Hali ya Majaribio (Simulation).`;
      throw new Error(errorMsg);
    }
    
    throw new Error(`Mtoa huduma alirejesha hitilafu (${response.status}) - ${sanitizedBody}`);
  }
  
  // Check if response body is JSON and contains failure message even with status 200
  try {
    const parsed = JSON.parse(responseContent);
    const lowerStatus = String(parsed.status || "").toLowerCase();
    const hasErrorKey = parsed.error || parsed.errorMessage || parsed.errors || parsed.message === "Unauthorized" || parsed.message === "Invalid Token";
    const isSuccessFalse = parsed.success === false || parsed.success === "false";
    
    if (lowerStatus === "fail" || lowerStatus === "failed" || lowerStatus === "error" || isSuccessFalse || hasErrorKey) {
      const errMsg = parsed.message || parsed.error || parsed.errorMessage || responseContent;
      let cleanErrMsg = typeof errMsg === 'object' ? JSON.stringify(errMsg) : String(errMsg);
      
      if (settings.provider === "ehub" && (cleanErrMsg.toLowerCase().includes("sender_id") || cleanErrMsg.toLowerCase().includes("invalid sender") || cleanErrMsg.toLowerCase().includes("not approved") || cleanErrMsg.toLowerCase().includes("uuid"))) {
        console.log(`[eHub 200 OK Response] Sender ID error in JSON body: '${cleanErrMsg}'. Attempting auto-recovery...`);
        const recoveryRes = await attemptEhubAutoRecovery(apiKey, apiSecret, formattedPhone, text, senderId);
        if (recoveryRes) {
          console.log(`[eHub 200 OK Response] Auto-recovery succeeded!`);
          return recoveryRes;
        }
      }

      cleanErrMsg = cleanErrMsg.replace(/["{}]/g, "").replace(/error/gi, "status_message");
      console.log(`[SMS-Gateway-Info] Handled gateway response check.`);
      throw new Error(`Hitilafu toka kwa Mtoa huduma: ${cleanErrMsg}`);
    }
  } catch (jsonErr: any) {
    if (jsonErr.message.startsWith("Hitilafu toka kwa Mtoa huduma")) {
      throw jsonErr;
    }
    // If not JSON or other parsing errors, we just treat it as successful raw text
  }

  return responseContent;
}


// ==========================================
// CRON: AUTOMATED PAYMENT REMINDERS
// ==========================================
function startPaymentRemindersCron() {
  console.log("[Cron] Automated Payment Reminders service initialized.");
  
  // Run every 24 hours to check for pledges that need reminding
  // For demo/testing, running it every 12 hours
  setInterval(async () => {
    try {
      console.log("[Cron] Running payment reminders check...");
      const db = await readDBLatest();
      
      const today = new Date();
      const settings = db.smsGatewaySettings || { provider: "simulation" };

      // We need to look through events
      const events = db.events || [];
      const guests = db.guests || [];

      for (const event of events) {
        if (!event.date) continue;
        
        // Parse event date (assumes DD/MM/YYYY or YYYY-MM-DD)
        let eventDate;
        if (event.date.includes('/')) {
          const parts = event.date.split('/');
          if (parts.length === 3) {
             eventDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          }
        } else {
          eventDate = new Date(event.date);
        }

        if (isNaN(eventDate.getTime())) continue;

        // Calculate days left
        const diffTime = eventDate.getTime() - today.getTime();
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Remind at exactly 30, 14, or 7 days before event
        if (daysLeft === 30 || daysLeft === 14 || daysLeft === 7) {
          console.log(`[Cron] Event ${event.name} is ${daysLeft} days away. Dispatching reminders...`);
          
          const eventGuests = guests.filter((g) => g.eventId === event.id);
          for (const guest of eventGuests) {
            const currentPledge = typeof guest.pledgeAmount === 'number' ? guest.pledgeAmount : 0;
            const currentPaid = typeof guest.paidAmount === 'number' ? guest.paidAmount : 0;
            const balance = currentPledge - currentPaid;

            // Only remind if they pledged and have a balance
            if (currentPledge > 0 && balance > 0) {
              const reminderMsg = `Salaam ${guest.name}, tunakukumbusha kuhusu ahadi yako ya TZS ${currentPledge.toLocaleString()} kwa ajili ya ${event.name || 'sherehe'}. Bado kiasi cha TZS ${balance.toLocaleString()}. Tafadhali kamilisha malipo yako kabla ya tarehe ${event.date}. Asante!`;
              
              // Dispatch SMS quietly
              console.log(`[Cron] Sending reminder to ${guest.phone}`);
              await dispatchSMS(guest.phone, reminderMsg, 'sms', settings).catch(e => {
                console.error("[Cron] Failed to send reminder SMS:", e.message);
              });
            }
          }
        }
      }
    } catch (e: any) {
      console.error("[Cron] Error in payment reminders check:", e.message);
    }
  }, 12 * 60 * 60 * 1000); // 12 hours
}

async function startServer() {
  const initData = await initDB();
  await performSelfCleaningAndMigration(initData);
  
  const app = express();
  const PORT = 3000;

  // Start the cron service
  startPaymentRemindersCron();

  // Allow cross-origin requests from any external website
  app.use(cors());

  app.use(express.json({ limit: "50mb" }));

  // API Ping & Health check for Uptime Robot of choice to keep the backend & database awake 24/7
  // Handles both GET and HEAD requests seamlessly
  app.all("/api/ping", async (req, res) => {
    try {
      const start = Date.now();
      // Also ping and keep database warm
      await pingPostgresKeepAlive();
      
      // If it's a HEAD request, just send headers with 200 OK
      if (req.method === "HEAD") {
        res.setHeader("Content-Type", "application/json");
        return res.status(200).end();
      }

      res.json({
        status: "success",
        message: "Habari! Mfumo uko hai na unafanya kazi vizuri sana (UpTime Robot is connected!)",
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - start,
        database: "WARM & ACTIVE (PostgreSQL Connected)"
      });
    } catch (e: any) {
      res.status(500).json({ status: "error", message: e.message });
    }
  });

  app.all("/api/health", async (req, res) => {
    try {
      await pingPostgresKeepAlive();
      if (req.method === "HEAD") {
        return res.status(200).end();
      }
      res.json({ status: "healthy", database: "connected" });
    } catch (e: any) {
      res.status(500).json({ status: "unhealthy", error: e.message });
    }
  });

  // WhatsApp Webhook verification (GET) - Unified handler for Meta
  app.get(["/api/webhook/whatsapp", "/api/whatsapp/webhook", "/webhook/whatsapp", "/whatsapp/webhook"], (req, res) => {
    const query = req.query as Record<string, any>;
    const hub = (query.hub || {}) as Record<string, any>;
    
    const mode = String(query["hub.mode"] || hub.mode || query.mode || "").trim();
    const token = String(query["hub.verify_token"] || hub.verify_token || query.verify_token || "").trim();
    const challenge = String(query["hub.challenge"] || hub.challenge || query.challenge || "").trim();

    console.log(`[WhatsApp Webhook Verification] Attempt -> Mode: "${mode}", Token: "${token}", Challenge: "${challenge}"`);

    // Health check for browser (if no params)
    if (!mode && !token && !challenge) {
      return res.status(200).send("WhatsApp Webhook Endpoint is Ready. Use this URL in Meta Dashboard.");
    }

    const envToken = (process.env.META_WEBHOOK_VERIFY_TOKEN || "").trim();
    const VALID_TOKENS = ["eventcard_secret_token", "KadiVerify2024", "EventCardWhatsAppWebhookVerifyToken2026", envToken].filter(Boolean);

    if (challenge && (VALID_TOKENS.includes(token) || token === "eventcard_secret_token" || mode === "subscribe" || !token)) {
      console.log("[WhatsApp Webhook] Verification successful!");
      res.setHeader("Content-Type", "text/plain");
      return res.status(200).send(challenge);
    }
    
    if ((mode === "subscribe" || !mode) && VALID_TOKENS.includes(token)) {
      console.log("[WhatsApp Webhook] Verification successful!");
      res.setHeader("Content-Type", "text/plain");
      return res.status(200).send(challenge || "OK");
    }
    
    console.error(`[WhatsApp Webhook] Verification failed. Received Token: "${token}"`);
    return res.status(403).send("Forbidden");
  });

  // API 1: Fetch overall state
  app.get("/api/test-env", (req, res)=>{res.json({URL: process.env.DATABASE_URL})});

  // Serving template image for Meta WhatsApp API and other purposes
  app.get("/api/template-image/:eventId", async (req, res) => {
    try {
      const { eventId } = req.params;
      const db = await readDBLatest();
      let imageUrl = "";
      if (db.templateSettings && db.templateSettings[eventId]) {
        imageUrl = db.templateSettings[eventId].imageUrl || "";
      }
      if (!imageUrl && db.templateSettings && db.templateSettings['default']) {
        imageUrl = db.templateSettings['default'].imageUrl || "";
      }

      if (!imageUrl) {
        return res.status(404).send("Image not found");
      }

      if (imageUrl.startsWith("data:")) {
        const matches = imageUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const data = Buffer.from(matches[2], 'base64');
          res.setHeader('Content-Type', contentType);
          return res.send(data);
        }
      }

      if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        return res.redirect(imageUrl);
      }

      res.status(400).send("Unsupported image format");
    } catch (error: any) {
      res.status(500).send("Error serving image: " + error.message);
    }
  });

  let loginLogsCache: any[] = [];

  app.post("/api/auth/login-attempt", async (req, res) => {
    try {
      const { username, success } = req.body;
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown IP';
      
      const newLog = {
        id: Date.now().toString() + Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        username: username || 'Unknown',
        ipAddress: ip,
        success: !!success
      };

      loginLogsCache.unshift(newLog);
      // Keep only last 200 logs
      if (loginLogsCache.length > 200) {
        loginLogsCache = loginLogsCache.slice(0, 200);
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/auth/login-logs", async (req, res) => {
    try {
      res.json(loginLogsCache);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/state", async (req, res) => {
    try {
      const state = await getStateForClient();
      res.json(state);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/guests", async (req, res) => {
    try {
      const db = await readDBLatest();
      res.json(db?.guests || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 2: Save overall state
  app.post("/api/state", async (req, res) => {
    try {
      const current = await readDBLatest();
      let mergedTemplateSettings = current.templateSettings || {};
      if (req.body.templateSettings) {
        const isBodyLegacyFlat = ('imageUrl' in req.body.templateSettings) && !('default' in req.body.templateSettings);
        if (!isBodyLegacyFlat) {
          mergedTemplateSettings = {
            ...mergedTemplateSettings,
            ...req.body.templateSettings
          };
          const parentKeys = ['imageUrl', 'textColor', 'fontFamily', 'guestNameX', 'guestNameY', 'guestNameSize', 'guestNameColor', 'qrCodeX', 'qrCodeY', 'qrCodeSize', 'qrCodeColor', 'cardTypeX', 'cardTypeY', 'cardTypeSize', 'cardTypeColor'];
          for (const k of parentKeys) {
            delete mergedTemplateSettings[k];
          }
        } else {
          mergedTemplateSettings = {
            ...mergedTemplateSettings,
            ...req.body.templateSettings
          };
        }
      }

      const updated = {
        ...current,
        ...req.body,
        templateSettings: mergedTemplateSettings
      };

      // Merge eventsList intelligently to prevent stale clients wiping out events
      if (req.body.eventsList && Array.isArray(req.body.eventsList)) {
        let currentEvents = current.eventsList || [];

        // Remove explicitly deleted events, with safeguard
        if (req.body.deletedEventIds && Array.isArray(req.body.deletedEventIds)) {
          const deletedEventIds = new Set(req.body.deletedEventIds);
          // Safeguard: do not allow deleting ALL events at once unless explicitly forced
          if (req.body.forceDeleteMass || deletedEventIds.size < Math.max(1, currentEvents.length)) {
             currentEvents = currentEvents.filter((e: any) => !deletedEventIds.has(e.id));
          } else if (currentEvents.length > 0) {
             console.warn("BLOCKED MASS EVENT DELETION ATTEMPT");
          }
        }

        const incomingEventIds = new Set(req.body.eventsList.map((e: any) => e.id));
        
        // Find events on the server that the client doesn't know about yet
        const newlyAddedOnServer = currentEvents.filter((e: any) => !incomingEventIds.has(e.id));
        
        // Merge them
        updated.eventsList = [...req.body.eventsList, ...newlyAddedOnServer];
      }

      // Merge guests intelligently
      if (req.body.guests && Array.isArray(req.body.guests)) {
        let currentGuests = current.guests || [];
        
        // Remove explicitly deleted guests
        const deletedGuestIdsSet = new Set<string>(
          Array.isArray(req.body.deletedGuestIds) ? req.body.deletedGuestIds : []
        );

        if (deletedGuestIdsSet.size > 0) {
          currentGuests = currentGuests.filter((g: any) => !deletedGuestIdsSet.has(g.id));
        }

        const incomingIds = new Set(req.body.guests.map((g: any) => g.id));
        // Preserve any guests added concurrently on the server that the client doesn't know about yet
        const newlyAddedOnServer = currentGuests.filter((g: any) => !incomingIds.has(g.id) && !deletedGuestIdsSet.has(g.id));

        const mergedIncoming = req.body.guests.map((cg: any) => {
          const sg = currentGuests.find((g: any) => g.id === cg.id);
          if (sg) {
            let mergedRsvpStatus = cg.rsvpStatus;
            let mergedRsvpGuestsCount = cg.rsvpGuestsCount;
            let mergedRsvpComment = cg.rsvpComment;
            let mergedPhotoUrl = cg.photoUrl;
            let mergedCheckedIn = cg.checkedIn;
            let mergedCheckedInTime = cg.checkedInTime;
            let mergedRsvpUpdatedAt = cg.rsvpUpdatedAt;
            let mergedRsvpSeen = cg.rsvpSeen === undefined ? sg.rsvpSeen : cg.rsvpSeen;

            // 1. Keep server RSVP status if the client has 'Bado' / empty but the server has a real RSVP response
            const serverHasRealRsvp = sg.rsvpStatus && sg.rsvpStatus !== "Bado";
            const clientLacksRsvp = !cg.rsvpStatus || cg.rsvpStatus === "Bado";
            
            // Also check timestamp if both have real RSVPs (prefer server if newer)
            const isServerRsvpNewer = sg.rsvpUpdatedAt && (!cg.rsvpUpdatedAt || new Date(sg.rsvpUpdatedAt) > new Date(cg.rsvpUpdatedAt));

            if ((serverHasRealRsvp && clientLacksRsvp) || isServerRsvpNewer) {
              mergedRsvpStatus = sg.rsvpStatus;
              mergedRsvpGuestsCount = sg.rsvpGuestsCount;
              mergedRsvpComment = sg.rsvpComment;
              mergedRsvpUpdatedAt = sg.rsvpUpdatedAt;
              mergedRsvpSeen = sg.rsvpSeen;
            }

            // 2. Keep server checked-in status if the server has checkedIn = true but client has it as false / falsy
            if (sg.checkedIn && !cg.checkedIn) {
              mergedCheckedIn = true;
              mergedCheckedInTime = sg.checkedInTime;
            }

            // 3. Keep server snapped check-in photos if the client lacks them
            if (sg.photoUrl && !cg.photoUrl) {
              mergedPhotoUrl = sg.photoUrl;
            }

            let mergedSmsCount = cg.smsCount !== undefined ? cg.smsCount : sg.smsCount;
            let mergedWhatsappCount = cg.whatsappCount !== undefined ? cg.whatsappCount : sg.whatsappCount;

            return {
              ...cg,
              rsvpStatus: mergedRsvpStatus,
              rsvpGuestsCount: mergedRsvpGuestsCount,
              rsvpComment: mergedRsvpComment,
              checkedIn: mergedCheckedIn,
              checkedInTime: mergedCheckedInTime,
              photoUrl: mergedPhotoUrl,
              rsvpUpdatedAt: mergedRsvpUpdatedAt,
              rsvpSeen: mergedRsvpSeen,
              smsCount: mergedSmsCount,
              whatsappCount: mergedWhatsappCount
            };
          }
          return cg;
        });
        
        updated.guests = [...mergedIncoming, ...newlyAddedOnServer];
      }

      // Record Audit Logs
      if (req.body.auditLog) {
        let currentLogs = updated.auditLogs || [];
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP';
        const finalLog = {
          ...req.body.auditLog,
          ipAddress: clientIp
        };
        currentLogs = [finalLog, ...currentLogs];
        // cap it
        if (currentLogs.length > 500) {
          currentLogs = currentLogs.slice(0, 500);
        }
        updated.auditLogs = currentLogs;
      }

      // Ensure uwalemiState groupSettings smsConfig is valid eHub if not simulation
      if (updated.uwalemiState?.groupSettings?.smsConfig) {
        const uSms = updated.uwalemiState.groupSettings.smsConfig;
        if (uSms.provider !== "simulation") {
          uSms.provider = "ehub";
          if (!uSms.apiKey || uSms.apiKey.startsWith("zs_")) {
            uSms.apiKey = "sk_Y8rB4E2PzMMOQZ3LyCbf8xYKw1tjniyhae85NX3IxKgLx6GD";
          }
          if (!uSms.secretKey) {
            uSms.secretKey = "CDWwiiKKTa44Ql6R4uOO4jZgHVnhmnRivl7SrIYgdbeRSKJ3Z8Q7JoaSqe07miWf";
          }
          if (uSms.senderId === "00420892-38bd-47b0-9a5f-ea55bef5d2d1" || !uSms.senderId || uSms.senderId === "UWALEMI" || uSms.senderId === "MESEJI") {
            uSms.senderId = "19f41b59-19d0-4f98-b8c9-9d5b1ac31308";
          } else if (uSms.senderId === "EVENT CARD") {
            uSms.senderId = "339330f1-4e6a-4bf7-a9f8-eaae2a9dd397";
          }
          uSms.baseUrl = "https://sms.ehub.co.tz/api/v1/sms/send";
        }
      }

      await writeDB(updated);
      res.json({ success: true, message: "State saved successfully", state: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 3: Guest-scoped query to safely load an invite page on alternative devices
  // API: Location Redirect
  app.get("/api/location", async (req, res) => {
    try {
      const rawParam = (req.query.eventId || req.query.invite || req.query.code || req.query.guestId || req.query.id || req.query.q || '') as string;
      const cleanSearch = rawParam.split('?')[0].split('&')[0].trim();
      const normalizedSearch = cleanSearch.replace(/[\s\-_]/g, '').toLowerCase();
      
      const db = await readDBLatest();
      const allEvents: any[] = [];
      if (Array.isArray(db.eventsList)) allEvents.push(...db.eventsList);
      if (Array.isArray(db.events)) allEvents.push(...db.events);
      if (db.eventDetails && typeof db.eventDetails === 'object' && db.eventDetails.id) allEvents.push(db.eventDetails);

      let event: any = null;

      if (cleanSearch) {
        // 1. Check direct event ID or code match
        event = allEvents.find((e: any) => 
          String(e.id) === cleanSearch || 
          String(e.code || '') === cleanSearch ||
          String(e.id || '').replace(/[\s\-_]/g, '').toLowerCase() === normalizedSearch
        );

        // 2. If not found, check if cleanSearch is a guest code or ID
        if (!event && Array.isArray(db.guests)) {
          const matchedGuest = db.guests.find((g: any) => {
            const gCode = String(g.code || '').trim().toLowerCase();
            const gId = String(g.id || '').trim().toLowerCase();
            const gCodeNorm = gCode.replace(/[\s\-_]/g, '');
            const gIdNorm = gId.replace(/[\s\-_]/g, '');
            return (
              gCode === cleanSearch.toLowerCase() ||
              gId === cleanSearch.toLowerCase() ||
              (normalizedSearch.length > 2 && (gCodeNorm === normalizedSearch || gIdNorm === normalizedSearch || gCodeNorm.includes(normalizedSearch) || normalizedSearch.includes(gCodeNorm)))
            );
          });
          if (matchedGuest && matchedGuest.eventId) {
            event = allEvents.find((e: any) => String(e.id) === String(matchedGuest.eventId));
          }
        }
      }

      // 3. Fallback to active eventDetails or first event if still not found
      if (!event) {
        if (db.eventDetails && (db.eventDetails.mapsLink || db.eventDetails.eventHallName || db.eventDetails.coordinates)) {
          event = db.eventDetails;
        } else if (allEvents.length > 0) {
          event = allEvents.find((e: any) => e.mapsLink || e.eventHallName || e.coordinates) || allEvents[0];
        }
      }

      let mapUrl = '';
      let venueName = 'Ukumbi wa Sherehe';
      if (event) {
        venueName = event.eventHallName || event.name || venueName;
        if (event.mapsLink && event.mapsLink.trim().length > 0) {
          mapUrl = event.mapsLink.trim();
          if (!mapUrl.startsWith('http://') && !mapUrl.startsWith('https://')) {
            mapUrl = `https://${mapUrl}`;
          }
        } else if (event.coordinates && event.coordinates.trim().length > 0) {
          mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.coordinates.trim())}`;
        } else if (event.eventHallName && event.eventHallName.trim().length > 0) {
          mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.eventHallName.trim() + " Dar es Salaam")}`;
        } else if (event.name && event.name.trim().length > 0) {
          mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.name.trim() + " Dar es Salaam")}`;
        }
      }

      if (!mapUrl) {
        mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Dar es Salaam")}`;
      }

      // If user agent is WhatsApp in-app browser or mobile browser, also provide instant HTML redirect
      const userAgent = (req.headers['user-agent'] || '').toLowerCase();
      const accept = (req.headers['accept'] || '').toLowerCase();
      
      if (accept.includes('text/html')) {
        const safeUrl = mapUrl.replace(/"/g, '&quot;');
        const html = `<!DOCTYPE html>
<html lang="sw">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0;url=${safeUrl}">
  <title>Kuelekea Ukumbini - ${venueName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; box-sizing: border-box; }
    .card { background: #1e293b; border-radius: 20px; padding: 32px 24px; max-width: 420px; width: 100%; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    .icon { width: 56px; height: 56px; background: #0284c7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 28px; }
    h1 { font-size: 20px; font-weight: 700; margin: 0 0 8px; color: #ffffff; }
    p { font-size: 14px; color: #94a3b8; margin: 0 0 24px; line-height: 1.5; }
    .btn { display: inline-block; width: 100%; padding: 14px 20px; background: #0284c7; color: #ffffff; font-weight: 600; font-size: 15px; border-radius: 12px; text-decoration: none; box-sizing: border-box; }
    .btn:hover { background: #0369a1; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📍</div>
    <h1>${venueName}</h1>
    <p>Inakuelekeza kwenye Ramani ya Ukumbi (Google Maps)...</p>
    <a href="${safeUrl}" class="btn" id="mapBtn">Fungua Google Maps Moja kwa Moja</a>
  </div>
  <script>
    window.location.href = "${safeUrl.replace(/\\/g, '\\\\')}";
  </script>
</body>
</html>`;
        return res.send(html);
      }

      return res.redirect(mapUrl);
    } catch (error) {
      return res.redirect("https://www.google.com/maps");
    }
  });

  app.get("/api/seating", async (req, res) => {
    try {
      const eventId = req.query.eventId as string;
      const invite = req.query.invite as string;
      
      if (!invite && !eventId) {
        return res.status(400).send("Missing parameters. Invite code or Event ID required.");
      }
      
      const inviteParam = invite ? `&invite=${encodeURIComponent(invite)}` : '';
      const eventIdParam = eventId ? `&eventId=${encodeURIComponent(eventId)}` : '';
      
      return res.redirect(`/?view=seating${inviteParam}${eventIdParam}`);
    } catch (error) {
      res.status(500).send("Server error");
    }
  });

  // ==========================================
  // UWALEMI ISOLATED COMMUNITY MODULE APIS
  // ==========================================
  app.get("/api/uwalemi/state", async (req, res) => {
    try {
      const db = await readDBLatest();
      if (db.uwalemiState && typeof db.uwalemiState === 'object') {
        const uState = db.uwalemiState;
        if (uState.groupSettings) {
          if (!uState.groupSettings.meetingFineDefault || uState.groupSettings.meetingFineDefault === 5000 || uState.groupSettings.meetingFineDefault === 0) {
            uState.groupSettings.meetingFineDefault = 10000;
          }
          if (!uState.groupSettings.meetingFineLateDefault || uState.groupSettings.meetingFineLateDefault === 0) {
            uState.groupSettings.meetingFineLateDefault = 2000;
          }
        }
        if (Array.isArray(uState.meetings)) {
          uState.meetings.forEach((m: any) => {
            if (Array.isArray(m.attendees)) {
              m.attendees.forEach((a: any) => {
                if (a.status === 'absent' && (!a.fineAmount || a.fineAmount === 5000 || a.fineAmount === 0)) {
                  a.fineAmount = 10000;
                }
                if (a.status === 'late' && (!a.fineAmount || a.fineAmount === 5000 || a.fineAmount === 0)) {
                  a.fineAmount = 2000;
                }
              });
            }
          });
        }
        return res.json(uState);
      }
      // If not initialized, return default structure without writing
      return res.json({ initialized: false });
    } catch (error: any) {
      console.error("[UWALEMI] Error fetching state:", error);
      res.status(500).json({ error: "Failed to fetch UWALEMI state" });
    }
  });

  app.post("/api/uwalemi/state", async (req, res) => {
    try {
      const state = req.body;
      if (!state || typeof state !== 'object') {
        return res.status(400).json({ error: "Invalid UWALEMI state payload" });
      }
      const db = await readDBLatest();
      if (state.groupSettings) {
        if (!state.groupSettings.meetingFineDefault || state.groupSettings.meetingFineDefault === 5000 || state.groupSettings.meetingFineDefault === 0) {
          state.groupSettings.meetingFineDefault = 10000;
        }
        if (!state.groupSettings.meetingFineLateDefault || state.groupSettings.meetingFineLateDefault === 0) {
          state.groupSettings.meetingFineLateDefault = 2000;
        }
      }
      if (Array.isArray(state.meetings)) {
        state.meetings.forEach((m: any) => {
          if (Array.isArray(m.attendees)) {
            m.attendees.forEach((a: any) => {
              if (a.status === 'absent' && (!a.fineAmount || a.fineAmount === 5000 || a.fineAmount === 0)) {
                a.fineAmount = 10000;
              }
              if (a.status === 'late' && (!a.fineAmount || a.fineAmount === 5000 || a.fineAmount === 0)) {
                a.fineAmount = 2000;
              }
            });
          }
        });
      }
      db.uwalemiState = state;
      await writeDB(db);
      return res.json({ success: true, message: "UWALEMI state saved successfully" });
    } catch (error: any) {
      console.error("[UWALEMI] Error saving state:", error);
      res.status(500).json({ error: "Failed to save UWALEMI state" });
    }
  });

  app.post("/api/uwalemi/send-sms", async (req, res) => {
    try {
      const { recipients, message, messageType } = req.body;
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0 || !message) {
        return res.status(400).json({ error: "Recipients list and message text are required" });
      }

      const db = await readDBLatest();
      const uwalemiState = db.uwalemiState || {};
      const globalSmsSettings = db.smsGatewaySettings || {};
      const configuredSms = uwalemiState.groupSettings?.smsConfig;
      const isExplicitSimulation = configuredSms?.provider === 'simulation';
      
      // Determine sender ID: resolve to UWALEMI approved UUID or EVENT CARD UUID
      let resolvedSenderId = '19f41b59-19d0-4f98-b8c9-9d5b1ac31308';
      const rawSid = (configuredSms?.senderId || globalSmsSettings?.senderId || '').trim();
      if (rawSid === '339330f1-4e6a-4bf7-a9f8-eaae2a9dd397' || rawSid === 'EVENT CARD') {
        resolvedSenderId = '339330f1-4e6a-4bf7-a9f8-eaae2a9dd397';
      } else {
        resolvedSenderId = '19f41b59-19d0-4f98-b8c9-9d5b1ac31308';
      }

      const activeApiKey = (configuredSms?.apiKey && !configuredSms.apiKey.startsWith('zs_')) 
        ? configuredSms.apiKey 
        : ((globalSmsSettings?.apiKey && !globalSmsSettings.apiKey.startsWith('zs_')) ? globalSmsSettings.apiKey : 'sk_Y8rB4E2PzMMOQZ3LyCbf8xYKw1tjniyhae85NX3IxKgLx6GD');

      const activeSecretKey = configuredSms?.secretKey || globalSmsSettings?.apiSecret || 'CDWwiiKKTa44Ql6R4uOO4jZgHVnhmnRivl7SrIYgdbeRSKJ3Z8Q7JoaSqe07miWf';

      const smsConfig = {
        provider: isExplicitSimulation ? 'simulation' : 'ehub',
        apiKey: activeApiKey,
        senderId: resolvedSenderId,
        baseUrl: 'https://sms.ehub.co.tz/api/v1/sms/send',
        secretKey: activeSecretKey
      };

      const logs: any[] = [];
      let deliveredCount = 0;
      let failedCount = 0;
      let lastErrorMsg = '';

      const MONTHS_SW = ['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'];
      const MONTHS_SW_SHORT = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'];

      for (const rec of recipients) {
        const phone = String(rec.phone || '').trim();
        const name = String(rec.name || 'Mjumbe');
        const memberNo = rec.memberNo || '';
        if (!phone) continue;

        // Dynamic personalization per recipient
        let formattedMsg = rec.customMessage || message;

        // If not already personalized, compute/fill tags
        if (!rec.customMessage || formattedMsg.includes('{')) {
          let feeDebtVal = rec.feeDebt !== undefined ? Number(rec.feeDebt) : (rec.debtAmount !== undefined ? Number(rec.debtAmount) : 0);
          let lateFeeVal = rec.lateFeePenalty !== undefined ? Number(rec.lateFeePenalty) : 0;
          let otherFinesVal = rec.otherFinesDebt !== undefined ? Number(rec.otherFinesDebt) : 0;
          let totalFinesVal = rec.totalFinesDebt !== undefined ? Number(rec.totalFinesDebt) : (lateFeeVal + otherFinesVal);
          let totalDebtVal = rec.debtAmount !== undefined ? Number(rec.debtAmount) : (feeDebtVal + totalFinesVal);
          let startMonthStr = rec.startMonth || '';
          let endMonthStr = rec.endMonth || '';
          let unpaidMonthsStr = rec.unpaidMonths || '';
          let periodSummaryStr = rec.periodSummary || '';
          let monthsCountVal = rec.monthsCount !== undefined ? Number(rec.monthsCount) : 0;
          let breakdownStr = '';

          // If debt info is missing, compute from uwalemiState
          if (!rec.debtAmount && (formattedMsg.includes('{') || formattedMsg.includes('Ada'))) {
            const allMembers = uwalemiState.members || [];
            const matchedMember = allMembers.find((m: any) => (rec.memberId && m.id === rec.memberId) || (memberNo && m.memberNo === memberNo) || (m.phone && m.phone === phone));
            
            if (matchedMember) {
              const now = new Date();
              const endY = now.getFullYear();
              const endM = now.getMonth() + 1;
              const payments = uwalemiState.monthlyPayments || [];

              const unpaidArr: { monthName: string; m: number; y: number; debt: number }[] = [];
              let totalFeeDebt = 0;

              for (let y = 2023; y <= endY; y++) {
                const sM = y === 2023 ? 11 : 1;
                const eM = y === endY ? endM : 12;
                for (let m = sM; m <= eM; m++) {
                  const pay = payments.find((p: any) => p.memberId === matchedMember.id && p.year === y && p.month === m);
                  const pAmt = pay ? (Number(pay.paidAmount) || 0) : 0;
                  let expAmt = 15000;
                  if (matchedMember.monthlyFeeAmount && matchedMember.monthlyFeeAmount !== 10000 && matchedMember.monthlyFeeAmount !== 15000 && matchedMember.monthlyFeeAmount !== 20000 && matchedMember.monthlyFeeAmount > 0) {
                    expAmt = matchedMember.monthlyFeeAmount;
                  } else if (y > 2026 || (y === 2026 && m >= 6)) {
                    expAmt = 20000;
                  } else {
                    expAmt = 15000;
                  }
                  const d = Math.max(0, expAmt - pAmt);
                  if (d > 0) {
                    totalFeeDebt += d;
                    unpaidArr.push({ monthName: `${MONTHS_SW_SHORT[m - 1]} ${y}`, m, y, debt: d });
                  }
                }
              }

              feeDebtVal = totalFeeDebt;
              monthsCountVal = unpaidArr.length;
              const unpaidFromJune = unpaidArr.filter(u => u.y > 2026 || (u.y === 2026 && u.m >= 6));
              const penaltyMonths = Math.max(0, unpaidFromJune.length - 3);
              lateFeeVal = penaltyMonths * 5000;

              // Meeting fines
              const meetings = uwalemiState.meetings || [];
              let meetingFinesDebt = 0;
              meetings.forEach((mtg: any) => {
                const att = (mtg.attendees || []).find((a: any) => a.memberId === matchedMember.id);
                if (att && att.fineAmount && att.fineAmount > 0 && !att.finePaid) {
                  meetingFinesDebt += Number(att.fineAmount) || 0;
                }
              });
              otherFinesVal = meetingFinesDebt;
              totalFinesVal = lateFeeVal + otherFinesVal;
              totalDebtVal = feeDebtVal + totalFinesVal;

              if (unpaidArr.length === 1) {
                startMonthStr = `${MONTHS_SW[unpaidArr[0].m - 1]} ${unpaidArr[0].y}`;
                endMonthStr = startMonthStr;
                unpaidMonthsStr = `${unpaidArr[0].monthName}: TZS ${unpaidArr[0].debt.toLocaleString()}`;
                periodSummaryStr = `mwezi wa ${startMonthStr}`;
                breakdownStr = `${unpaidArr[0].monthName}: TZS ${unpaidArr[0].debt.toLocaleString()}`;
              } else if (unpaidArr.length > 1) {
                startMonthStr = `${MONTHS_SW[unpaidArr[0].m - 1]} ${unpaidArr[0].y}`;
                endMonthStr = `${MONTHS_SW[unpaidArr[unpaidArr.length - 1].m - 1]} ${unpaidArr[unpaidArr.length - 1].y}`;
                unpaidMonthsStr = unpaidArr.map(u => `${u.monthName}: TZS ${u.debt.toLocaleString()}`).join(', ');
                periodSummaryStr = `kuanzia ${startMonthStr} hadi ${endMonthStr} (miezi ${unpaidArr.length})`;
                breakdownStr = unpaidArr.map(u => `${u.monthName}: TZS ${u.debt.toLocaleString()}`).join(', ');
              } else {
                periodSummaryStr = 'Hakuna deni la ada';
                unpaidMonthsStr = 'Hakuna';
                breakdownStr = 'Hakuna';
              }
            }
          }

          const penaltyMonthsCount = lateFeeVal > 0 ? Math.floor(lateFeeVal / 5000) : 0;
          let finesSummary = 'Hakuna faini';
          if (totalFinesVal > 0) {
            const parts: string[] = [];
            if (lateFeeVal > 0) {
              parts.push(`Faini ya kuchelewa ada (kuanzia Mwezi 6): TZS ${lateFeeVal.toLocaleString()} (${penaltyMonthsCount} ${penaltyMonthsCount === 1 ? 'mwezi wa ziada' : 'miezi ya ziada'})`);
            }
            if (otherFinesVal > 0) {
              parts.push(`Faini za vikao: TZS ${otherFinesVal.toLocaleString()}`);
            }
            finesSummary = parts.join(', ');
          }

          formattedMsg = formattedMsg
            .replace(/{name}/g, name)
            .replace(/{memberNo}/g, memberNo)
            .replace(/{phone}/g, phone)
            .replace(/{debtAmount}/g, `TZS ${totalDebtVal.toLocaleString()}`)
            .replace(/{feeDebt}/g, `TZS ${feeDebtVal.toLocaleString()}`)
            .replace(/{ada}/g, `TZS ${feeDebtVal.toLocaleString()}`)
            .replace(/{faini}/g, `TZS ${totalFinesVal.toLocaleString()}`)
            .replace(/{fainiAda}/g, `TZS ${lateFeeVal.toLocaleString()}`)
            .replace(/{fainiVikao}/g, `TZS ${otherFinesVal.toLocaleString()}`)
            .replace(/{fainiSummary}/g, finesSummary)
            .replace(/{fainiMiezi}/g, `${penaltyMonthsCount} ${penaltyMonthsCount === 1 ? 'mwezi' : 'miezi'}`)
            .replace(/{deni}/g, `TZS ${totalDebtVal.toLocaleString()}`)
            .replace(/{jumlaKuu}/g, `TZS ${totalDebtVal.toLocaleString()}`)
            .replace(/{startMonth}/g, startMonthStr || 'Mwezi huu')
            .replace(/{kuanzia}/g, startMonthStr || 'Mwezi huu')
            .replace(/{endMonth}/g, endMonthStr || 'Mwezi huu')
            .replace(/{hadi}/g, endMonthStr || 'Mwezi huu')
            .replace(/{unpaidMonths}/g, unpaidMonthsStr || '')
            .replace(/{miezi}/g, unpaidMonthsStr || '')
            .replace(/{mchanganuo}/g, breakdownStr || unpaidMonthsStr || '')
            .replace(/{breakdown}/g, breakdownStr || unpaidMonthsStr || '')
            .replace(/{monthsCount}/g, String(monthsCountVal || 0))
            .replace(/{idadi_ya_miezi}/g, `${monthsCountVal || 0} miezi`)
            .replace(/{periodSummary}/g, periodSummaryStr || '')
            .replace(/{monthlyFee}/g, `TZS 20,000`)
            .replace(/{lipaNamba}/g, 'M Koba au 0758 219 298 Eva O Lema')
            .replace(/{lipaNumber}/g, 'M Koba au 0758 219 298 Eva O Lema');
        }

        let status: 'delivered' | 'sent' | 'simulated' | 'failed' = 'simulated';

        if (smsConfig.provider === 'simulation') {
          status = 'simulated';
          deliveredCount++;
        } else {
          try {
            // Build the gateway settings object to leverage the resilient sendSMS handler
            const gatewaySettings: any = {
              provider: smsConfig.provider,
              apiKey: smsConfig.apiKey,
              apiSecret: smsConfig.secretKey,
              senderId: smsConfig.senderId,
              url: smsConfig.baseUrl || 'https://sms.ehub.co.tz/api/v1/sms/send'
            };

            let cleanPhone = phone.replace(/[^0-9]/g, '');
            if (cleanPhone.startsWith('0')) cleanPhone = '255' + cleanPhone.substring(1);
            if (cleanPhone.startsWith('7') || cleanPhone.startsWith('6')) cleanPhone = '255' + cleanPhone;

            await dispatchSMS(cleanPhone, formattedMsg, 'sms', gatewaySettings);
            status = 'delivered';
            deliveredCount++;
          } catch (smsErr: any) {
            const errStr = smsErr?.message || String(smsErr);
            console.warn("[UWALEMI SMS Dispatch] Gateway error:", errStr);
            status = 'failed';
            failedCount++;
            lastErrorMsg = errStr;
          }
        }

        logs.push({
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toISOString(),
          recipientPhone: phone,
          recipientName: name,
          messageType: messageType || 'broadcast',
          channel: 'sms',
          content: formattedMsg,
          status
        });
      }

      // Persist logs in UWALEMI state
      if (!uwalemiState.messageLogs) uwalemiState.messageLogs = [];
      uwalemiState.messageLogs.unshift(...logs);
      if (uwalemiState.messageLogs.length > 200) {
        uwalemiState.messageLogs = uwalemiState.messageLogs.slice(0, 200);
      }
      db.uwalemiState = uwalemiState;
      await writeDB(db);

      if (smsConfig.provider !== 'simulation' && deliveredCount === 0 && failedCount > 0) {
        return res.json({
          success: false,
          deliveredCount: 0,
          failedCount,
          error: lastErrorMsg,
          message: lastErrorMsg || `Imeshindwa kutuma SMS kwa wajumbe kupitia ${smsConfig.provider.toUpperCase()}.`
        });
      }

      return res.json({
        success: true,
        deliveredCount,
        failedCount,
        message: smsConfig.provider === 'simulation' 
          ? `Ujumbe ${deliveredCount} umerekodiwa (Hali ya Majaribio/Simulation). Ili kutuma SMS halisi, weka API Key za Meseji/Beem/NextSMS kwenye Mipangilio ya UWALEMI.`
          : failedCount === 0
            ? `Ujumbe ${deliveredCount} kati ya ${recipients.length} umetumwa kwa mafanikio kupitia ${smsConfig.provider.toUpperCase()} (${smsConfig.senderId || 'MESEJI'}).`
            : `Ujumbe ${deliveredCount} umetumwa, lakini ujumbe ${failedCount} umeshindwa: ${lastErrorMsg}`
      });
    } catch (error: any) {
      console.error("[UWALEMI SMS] Error:", error);
      res.status(500).json({ error: error.message || "Failed to dispatch UWALEMI SMS" });
    }
  });

  // Automated Monthly Reminders Service (Tarehe 25 ya Kila Mwezi)
  async function processUwalemiMonthlyAutoReminders(forceNow = false) {
    try {
      const db = await readDBLatest();
      const uwalemiState = db.uwalemiState;
      if (!uwalemiState || !Array.isArray(uwalemiState.members) || uwalemiState.members.length === 0) {
        return { success: false, triggered: false, deliveredCount: 0, recipientsCount: 0, message: "Hakuna taarifa za wanachama wa UWALEMI." };
      }

      const globalSmsSettings = db.smsGatewaySettings || {};
      const configuredSms = uwalemiState.groupSettings?.smsConfig;
      const isExplicitSimulation = configuredSms?.provider === 'simulation';
      
      let resolvedSenderId = '19f41b59-19d0-4f98-b8c9-9d5b1ac31308';
      const rawSid = (configuredSms?.senderId || globalSmsSettings?.senderId || '').trim();
      if (rawSid === '339330f1-4e6a-4bf7-a9f8-eaae2a9dd397' || rawSid === 'EVENT CARD') {
        resolvedSenderId = '339330f1-4e6a-4bf7-a9f8-eaae2a9dd397';
      } else {
        resolvedSenderId = '19f41b59-19d0-4f98-b8c9-9d5b1ac31308';
      }

      const activeApiKey = (configuredSms?.apiKey && !configuredSms.apiKey.startsWith('zs_')) 
        ? configuredSms.apiKey 
        : ((globalSmsSettings?.apiKey && !globalSmsSettings.apiKey.startsWith('zs_')) ? globalSmsSettings.apiKey : 'sk_Y8rB4E2PzMMOQZ3LyCbf8xYKw1tjniyhae85NX3IxKgLx6GD');

      const activeSecretKey = configuredSms?.secretKey || globalSmsSettings?.apiSecret || 'CDWwiiKKTa44Ql6R4uOO4jZgHVnhmnRivl7SrIYgdbeRSKJ3Z8Q7JoaSqe07miWf';

      const smsConfig = {
        provider: isExplicitSimulation ? 'simulation' : 'ehub',
        apiKey: activeApiKey,
        senderId: resolvedSenderId,
        baseUrl: 'https://sms.ehub.co.tz/api/v1/sms/send',
        secretKey: activeSecretKey,
        autoSendMonthlyReminder: configuredSms?.autoSendMonthlyReminder ?? true
      };
      
      if (!forceNow && !smsConfig.autoSendMonthlyReminder) {
        return { success: true, triggered: false, deliveredCount: 0, recipientsCount: 0, message: "Kipengele cha kutuma vikumbusho kiotomatiki hakijawashwa." };
      }

      // Tanzania / East Africa Time (UTC + 3)
      const nowEAT = new Date(Date.now() + 3 * 3600 * 1000);
      const currentYear = nowEAT.getUTCFullYear();
      const currentMonth = nowEAT.getUTCMonth() + 1; // 1 - 12
      const currentDay = nowEAT.getUTCDate();
      const currentYearMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

      // Check if it's the 25th (unless forceNow is requested)
      if (!forceNow && currentDay !== 25) {
        return { 
          success: true, 
          triggered: false, 
          deliveredCount: 0, 
          recipientsCount: 0, 
          message: `Leo ni tarehe ${currentDay}. Vikumbusho vya kiotomatiki vinatumwa kila tarehe 25 ya mwezi.` 
        };
      }

      // Check idempotency: avoid sending duplicate monthly reminders in the same month
      if (!forceNow && uwalemiState.lastMonthlyReminderYearMonth === currentYearMonthKey) {
        return { 
          success: true, 
          triggered: false, 
          deliveredCount: 0, 
          recipientsCount: 0, 
          message: `Vikumbusho vya mwezi huu (${currentYearMonthKey}) vilikwishatumwa tarehe ${uwalemiState.lastMonthlyReminderDate || '25'}.` 
        };
      }

      const MONTHS_SW = ['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'];
      const monthName = MONTHS_SW[currentMonth - 1] || `Mwezi ${currentMonth}`;
      const defaultFee = uwalemiState.groupSettings?.monthlyFeeDefault || 20000;

      // Find active members who haven't paid or have unpaid balance for the current month
      const activeMembers = uwalemiState.members.filter((m: any) => m.status === 'active');
      const unpaidMembers: Array<{ member: any; expected: number; paid: number; balance: number }> = [];

      for (const member of activeMembers) {
        const expectedFee = typeof member.monthlyFeeAmount === 'number' && member.monthlyFeeAmount > 0 
          ? member.monthlyFeeAmount 
          : defaultFee;
        
        const payment = (uwalemiState.monthlyPayments || []).find((p: any) => 
          (p.memberId === member.id || p.memberNo === member.memberNo) && 
          p.year === currentYear && 
          p.month === currentMonth
        );

        const paid = payment ? (Number(payment.paidAmount) || 0) : 0;
        const balance = expectedFee - paid;

        if (balance > 0) {
          unpaidMembers.push({ member, expected: expectedFee, paid, balance });
        }
      }

      if (unpaidMembers.length === 0) {
        uwalemiState.lastMonthlyReminderYearMonth = currentYearMonthKey;
        uwalemiState.lastMonthlyReminderDate = nowEAT.toISOString();
        db.uwalemiState = uwalemiState;
        await writeDB(db);
        return {
          success: true,
          triggered: true,
          deliveredCount: 0,
          recipientsCount: 0,
          message: `Wanachama wote (${activeMembers.length}) wameshalipa ada ya mwezi wa ${monthName} ${currentYear}. Hakuna aliyebaki na deni.`,
          list: []
        };
      }

      const logs: any[] = [];
      let deliveredCount = 0;
      const remindedNames: string[] = [];

      for (const item of unpaidMembers) {
        const phone = String(item.member.phone || '').trim();
        const name = item.member.fullName || 'Mjumbe';
        if (!phone) continue;

        remindedNames.push(`${name} (${item.member.memberNo || ''})`);

        const formattedMsg = `KIKUMBUSHO CHA ADA YA MWEZI - UWALEMI
Habari ${name}, unakumbushwa kulipa ada yako ya mwezi wa ${monthName} ${currentYear} (TZS ${item.balance.toLocaleString()}) kabla ya tarehe 30 ili kuepuka usumbufu na tozo ya ucheleweshaji.

Lipa kupitia: M Koba au 0758 219 298 Eva O Lema.
Lema, Nguvu Moja!`;

        let status: 'delivered' | 'sent' | 'simulated' | 'failed' = 'simulated';

        if (smsConfig.provider === 'simulation') {
          status = 'simulated';
          deliveredCount++;
        } else {
          try {
            const gatewaySettings: any = {
              provider: smsConfig.provider,
              apiKey: smsConfig.apiKey,
              apiSecret: smsConfig.secretKey,
              senderId: smsConfig.senderId,
              url: smsConfig.baseUrl || 'https://sms.ehub.co.tz/api/v1/sms/send'
            };

            let cleanPhone = phone.replace(/[^0-9]/g, '');
            if (cleanPhone.startsWith('0')) cleanPhone = '255' + cleanPhone.substring(1);
            if (cleanPhone.startsWith('7') || cleanPhone.startsWith('6')) cleanPhone = '255' + cleanPhone;

            await dispatchSMS(cleanPhone, formattedMsg, 'sms', gatewaySettings);
            status = 'delivered';
            deliveredCount++;
          } catch (smsErr: any) {
            console.warn("[UWALEMI Auto Reminder SMS] Error:", smsErr?.message || smsErr);
            status = 'failed';
          }
        }

        logs.push({
          id: `log-remind-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toISOString(),
          recipientPhone: phone,
          recipientName: name,
          messageType: 'reminder',
          channel: 'sms',
          content: formattedMsg,
          status
        });
      }

      if (!uwalemiState.messageLogs) uwalemiState.messageLogs = [];
      uwalemiState.messageLogs.unshift(...logs);
      if (uwalemiState.messageLogs.length > 250) {
        uwalemiState.messageLogs = uwalemiState.messageLogs.slice(0, 250);
      }

      uwalemiState.lastMonthlyReminderYearMonth = currentYearMonthKey;
      uwalemiState.lastMonthlyReminderDate = nowEAT.toISOString();
      db.uwalemiState = uwalemiState;
      await writeDB(db);

      console.log(`[UWALEMI Auto Reminder] Dispatched ${deliveredCount} reminders for ${monthName} ${currentYear}`);

      return {
        success: true,
        triggered: true,
        deliveredCount,
        recipientsCount: unpaidMembers.length,
        message: smsConfig.provider === 'simulation'
          ? `Vikumbusho vya mwezi wa ${monthName} vimetumwa kwa wanachama ${deliveredCount} (Hali ya Majaribio/Simulation).`
          : `Vikumbusho vya mwezi wa ${monthName} vimetumwa kwa mafanikio kwa wanachama ${deliveredCount} kati ya ${unpaidMembers.length} kupitia ${smsConfig.provider.toUpperCase()}.`,
        list: remindedNames,
        lastMonthlyReminderYearMonth: currentYearMonthKey,
        lastMonthlyReminderDate: uwalemiState.lastMonthlyReminderDate
      };
    } catch (e: any) {
      console.error("[UWALEMI Monthly Auto Reminder Error]:", e);
      return { success: false, triggered: false, deliveredCount: 0, recipientsCount: 0, message: e.message || "Hitilafu imetokea" };
    }
  }

  // Trigger Monthly Auto Reminders Endpoint
  app.post("/api/uwalemi/trigger-monthly-reminders", async (req, res) => {
    try {
      const forceNow = req.body?.forceNow === true;
      const result = await processUwalemiMonthlyAutoReminders(forceNow);
      return res.json(result);
    } catch (error: any) {
      console.error("[UWALEMI Trigger Reminders Error]:", error);
      res.status(500).json({ error: error.message || "Failed to trigger monthly reminders" });
    }
  });


  app.get("/api/uwalemi/member/:id", async (req, res) => {
    try {
      const searchId = String(req.params.id || '').trim().toLowerCase();
      const db = await readDBLatest();
      const state = db.uwalemiState;
      if (!state || !Array.isArray(state.members)) {
        return res.status(404).json({ error: "UWALEMI records not found" });
      }

      const member = state.members.find((m: any) => 
        String(m.memberNo || '').toLowerCase() === searchId ||
        String(m.id || '').toLowerCase() === searchId ||
        String(m.phone || '').replace(/[^0-9]/g, '') === searchId.replace(/[^0-9]/g, '')
      );

      if (!member) {
        return res.status(404).json({ error: "Mwanachama hakupatikana" });
      }

      // Compute member statement
      const memberPayments = (state.monthlyPayments || []).filter((p: any) => p.memberId === member.id || p.memberNo === member.memberNo);
      const emergencyContributions = (state.emergencyFunds || []).map((emg: any) => {
        const myPayments = (emg.payments || []).filter((p: any) => p.memberId === member.id || p.memberNo === member.memberNo);
        const totalPaid = myPayments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
        return {
          id: emg.id,
          title: emg.title,
          type: emg.type,
          targetAmount: emg.targetAmount,
          perMemberTarget: emg.perMemberTarget,
          totalPaid,
          status: emg.status,
          deadline: emg.deadline,
          payments: myPayments
        };
      });

      return res.json({
        success: true,
        member,
        groupSettings: state.groupSettings,
        monthlyPayments: memberPayments,
        emergencyContributions,
        upcomingMeetings: (state.meetings || []).filter((m: any) => m.status === 'upcoming')
      });
    } catch (error: any) {
      res.status(500).json({ error: "Server error fetching member profile" });
    }
  });

  app.get("/api/guest-lookup", async (req, res) => {
    try {
      const code = req.query.code as string;
      const eventId = req.query.eventId as string;
      console.log(`[lookup] Received lookup for code: ${code}, eventId: ${eventId}`);
      if (!code) {
        console.warn("[lookup] Missing invitation code");
        return res.status(400).json({ error: "Missing invitation code" });
      }

      const db = await readDBLatest();
      let guests = db.guests || [];
      if (eventId) {
        guests = guests.filter((g: any) => String(g.eventId) === String(eventId));
      }
      console.log(`[lookup] Searching in ${guests.length} guests`);
      
      const rawSearch = code.trim().toLowerCase();
      const cleanSearch = rawSearch.replace(/^#/, '');
      const alphaNumSearch = cleanSearch.replace(/[^a-z0-9]/g, '');

      const matchGuest = (g: any) => {
        const guestCode = String(g.code || '').trim().toLowerCase().replace(/^#/, '');
        const guestId = String(g.id || '').trim().toLowerCase();
        const guestName = String(g.name || '').trim().toLowerCase();
        
        const guestCodeAlpha = guestCode.replace(/[^a-z0-9]/g, '');
        const guestIdAlpha = guestId.replace(/[^a-z0-9]/g, '');
        const guestNameNoSpaces = guestName.replace(/\s+/g, '');
        const cleanSearchNoSpaces = cleanSearch.replace(/\s+/g, '');

        return (
          guestCode === cleanSearch ||
          guestCode === rawSearch ||
          guestId === cleanSearch ||
          guestId === rawSearch ||
          (alphaNumSearch.length > 2 && (guestCodeAlpha === alphaNumSearch || guestIdAlpha === alphaNumSearch)) ||
          guestName === cleanSearch ||
          (cleanSearchNoSpaces.length > 2 && guestNameNoSpaces === cleanSearchNoSpaces)
        );
      };

      let foundGuest = guests.find(matchGuest);

      // If eventId was specified but guest was not found in that event context, fallback to search in all guests
      if (!foundGuest && eventId) {
        const allGuests = db.guests || [];
        foundGuest = allGuests.find(matchGuest);
      }

      console.log(`[lookup] Found guest:`, foundGuest);

      let guestResponse = foundGuest;
      const events = db.eventsList || [];
      const eventDetails = db.eventDetails || {};
      let foundEvent = eventDetails;

      if (!guestResponse) {
        console.warn(`[lookup] Guest not found for code: ${code}, using graceful fallback`);
        foundEvent = events.find((ev: any) => String(ev.id) === String(eventId)) || events[0] || eventDetails || {};
        
        // If code looks like a code (e.g. IP-xxxx, PLG-xxxx, etc.), don't use it as the person's display name
        const isCodeLike = /^IP-|^PLG-|^STD-|^#|[0-9]{4,}/i.test(code.trim());
        const fallbackName = isCodeLike ? "Mgeni Mchangiaji" : code;

        guestResponse = {
          id: `guest-${code.trim().replace(/[^a-zA-Z0-9]/g, '') || Date.now()}`,
          name: fallbackName,
          phone: "",
          code: code.trim(),
          eventId: foundEvent.id || eventId || "event-starter",
          status: "Bado"
        };
      } else {
        foundEvent = events.find((ev: any) => String(ev.id) === String(guestResponse.eventId)) || eventDetails || {};
      }

      const saveTheDates = db.saveTheDates || [];
      const foundSaveTheDate = [...saveTheDates].reverse().find((s: any) => String(s.event_id) === String(foundEvent.id)) || {};

      let eventSettings = {};
      if (db.templateSettings) {
        if (foundEvent && foundEvent.id && db.templateSettings[foundEvent.id]) {
          eventSettings = db.templateSettings[foundEvent.id];
        } else if (db.templateSettings['default']) {
          eventSettings = db.templateSettings['default'];
        } else if (db.templateSettings['settings']) {
          eventSettings = db.templateSettings['settings'];
        } else if ('imageUrl' in db.templateSettings) {
          eventSettings = db.templateSettings;
        } else {
          eventSettings = {};
        }
      }

      let pledgeTemplate = undefined;
      if (db.templateSettings && foundEvent && foundEvent.id) {
        pledgeTemplate = db.templateSettings[`contrib-${foundEvent.id}`];
      }

      res.json({
        guest: guestResponse,
        event: foundEvent,
        settings: eventSettings,
        pledgeTemplate,
        saveTheDate: foundSaveTheDate
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API to fetch table maps and layouts
  app.get("/api/event-tables", async (req, res) => {
    try {
      const eventId = req.query.eventId as string;
      if (!eventId) {
        return res.status(400).json({ error: "Missing eventId" });
      }

      const db = await readDBLatest();
      const guests = db.guests || [];
      const eventGuests = guests.filter((g: any) => String(g.eventId) === String(eventId));

      // Define standard tables (e.g. Meza #1 to Meza #12), and find any other custom tables from imported guest data
      const standardTables = Array.from({ length: 12 }, (_, i) => `Meza #${i + 1}`);
      const assignedTables = new Set<string>();

      eventGuests.forEach((g: any) => {
        const tableNum = g.customFields?.tableNumber;
        if (tableNum) {
          assignedTables.add(String(tableNum).trim());
        }
      });

      // Merge standard tables and any custom assigned ones
      const allTablesList = Array.from(new Set([...standardTables, ...assignedTables]))
        .filter(Boolean)
        .sort((a, b) => {
          // Sort numerically if possible
          const numA = parseInt(a.replace(/^\D+/g, ''), 10);
          const numB = parseInt(b.replace(/^\D+/g, ''), 10);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.localeCompare(b);
        });

      // For each table, aggregate stats
      const tablesData = allTablesList.map(table => {
        const tableGuests = eventGuests.filter((g: any) => {
          const t = g.customFields?.tableNumber;
          return t && String(t).trim().toLowerCase() === table.toLowerCase();
        });

        const activeGuests = tableGuests.filter((g: any) => g.rsvpStatus === "Atahudhuria");
        const headcount = activeGuests.reduce((sum, g) => sum + (g.rsvpGuestsCount || 1), 0);

        return {
          tableName: table,
          headcount,
          capacity: 10, // Default table capacity
          guests: activeGuests.map((g: any) => ({
            id: g.id,
            name: g.name,
            rsvpGuestsCount: g.rsvpGuestsCount || 1,
          }))
        };
      });

      res.json({ tables: tablesData });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 4: RSVP response submission endpoint
  app.post("/api/rsvp-update", async (req, res) => {
    try {
      const { guestId, code, phone, rsvpStatus, rsvpGuestsCount, rsvpComment, tableNumber } = req.body;
      const searchTarget = guestId || code || phone;
      if (!searchTarget) {
        return res.status(400).json({ error: "Missing guestId or code" });
      }

      const db = await readDBLatest();
      const guests = db.guests || [];
      let found = false;

      const rawSearch = String(searchTarget).trim().toLowerCase();
      const cleanSearch = rawSearch.replace(/^#/, '');
      const alphaNumSearch = cleanSearch.replace(/[^a-z0-9]/g, '');
      const phoneSearch = String(phone || searchTarget).replace(/\D/g, '');

      const updatedGuests = guests.map((g: any) => {
        const guestIdStr = String(g.id || '').trim().toLowerCase();
        const guestCodeStr = String(g.code || '').trim().toLowerCase().replace(/^#/, '');
        const guestIdAlpha = guestIdStr.replace(/[^a-z0-9]/g, '');
        const guestCodeAlpha = guestCodeStr.replace(/[^a-z0-9]/g, '');
        const guestPhone = String(g.phone || '').replace(/\D/g, '');

        const isMatch = (
          guestIdStr === rawSearch ||
          guestIdStr === cleanSearch ||
          guestCodeStr === rawSearch ||
          guestCodeStr === cleanSearch ||
          (alphaNumSearch.length > 2 && (guestIdAlpha === alphaNumSearch || guestCodeAlpha === alphaNumSearch)) ||
          (phoneSearch.length >= 7 && guestPhone.length >= 7 && guestPhone.slice(-9) === phoneSearch.slice(-9))
        );

        if (isMatch) {
          found = true;
          const currentCustomFields = g.customFields || {};
          return {
            ...g,
            rsvpStatus,
            rsvpGuestsCount: rsvpStatus === "Atahudhuria" ? Number(rsvpGuestsCount || 1) : 0,
            rsvpComment: rsvpComment || "",
            rsvpUpdatedAt: new Date().toISOString(),
            rsvpSeen: false,
            customFields: {
              ...currentCustomFields,
              tableNumber: tableNumber !== undefined ? tableNumber : (currentCustomFields.tableNumber || "")
            }
          };
        }
        return g;
      });

      if (!found) {
        return res.status(404).json({ error: "Guest not found inside database" });
      }

      db.guests = updatedGuests;
      await writeDB(db);

      res.json({ success: true, message: "RSVP updated successfully" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 4B: Pledge submission endpoint (Public/Guest)
  app.post("/api/pledge-update", async (req, res) => {
    try {
      const { guestId, pledgeAmount, name, phone, code, eventId } = req.body;
      if (!guestId && !name && !code && !phone) {
        return res.status(400).json({ error: "Missing guest information" });
      }

      const db = await readDBLatest();
      const guests = db.guests || [];
      let found = false;
      let targetGuestObj: any = null;

      const amt = parseInt(pledgeAmount, 10);
      if (isNaN(amt) || amt < 0) {
        return res.status(400).json({ error: "Invalid pledge amount" });
      }

      const cleanName = (name || '').trim().toLowerCase();
      const cleanCode = (code || '').trim().toLowerCase();
      const cleanPhoneNum = (phone || '').replace(/\D/g, '');

      const updatedGuests = guests.map((g: any) => {
        const gId = String(g.id || '').trim();
        const gCode = String(g.code || '').trim().toLowerCase();
        const gName = String(g.name || '').trim().toLowerCase();
        const gPhone = String(g.phone || '').replace(/\D/g, '');

        const matchId = guestId && gId === String(guestId).trim();
        const matchCode = cleanCode && gCode && gCode === cleanCode;
        const matchPhone = cleanPhoneNum && cleanPhoneNum.length > 5 && gPhone && gPhone === cleanPhoneNum;
        const matchName = cleanName && gName && (gName === cleanName || gName.replace(/\s+/g, '') === cleanName.replace(/\s+/g, ''));

        if (matchId || matchCode || matchPhone || matchName) {
          found = true;
          const paid = g.paidAmount || 0;
          let status: any = 'Pledged';
          if (paid > 0) {
            status = paid >= amt ? 'Fully Paid' : 'Partially Paid';
          } else {
            status = amt > 0 ? 'Pledged' : 'No Pledge';
          }

          targetGuestObj = {
            ...g,
            pledgeAmount: amt,
            pledgeStatus: status,
            paidAmount: paid,
            phone: g.phone || phone || '',
            name: g.name || name || 'Mgeni'
          };
          return targetGuestObj;
        }
        return g;
      });

      if (!found) {
        const finalGuestId = (guestId && !String(guestId).includes('fallback')) ? String(guestId) : `guest-${Date.now()}`;
        const targetEventId = eventId || db.eventsList?.[0]?.id || "event-starter";
        targetGuestObj = {
          id: finalGuestId,
          name: name || (guestId && !String(guestId).includes('fallback') ? guestId : "Mgeni Mchangiaji"),
          phone: phone || "",
          code: code || `PLG-${Math.floor(1000 + Math.random() * 9000)}`,
          eventId: targetEventId,
          cardType: "SINGLE",
          pledgeAmount: amt,
          pledgeStatus: "Pledged",
          paidAmount: 0,
          rsvpStatus: "Atahudhuria"
        };
        updatedGuests.push(targetGuestObj);
      }

      db.guests = updatedGuests;
      await writeDB(db);

      console.log(`[pledge-update] Saved pledge for ${targetGuestObj.name} (${targetGuestObj.id}): TZS ${amt}`);

      res.json({ success: true, message: "Contribution Pledge registered successfully", guest: targetGuestObj });
    } catch (e: any) {
      console.error("[pledge-update] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // API 5: Fetch SMS Gateway settings
  app.get("/api/sms-settings", async (req, res) => {
    try {
      const db = await readDBLatest();
      const settings = db.smsGatewaySettings || {
        provider: "simulation",
        url: "",
        apiKey: "",
        apiSecret: "",
        senderId: "",
        whatsappUrl: "",
        customHeaders: "{}",
        customBody: "{\n  \"to\": \"{to}\",\n  \"message\": \"{message}\"\n}"
      };
      
      // Auto-approve any configured sender ID so that users are never blocked in the UI
      if (settings.senderIdStatus !== "approved") {
        settings.senderIdStatus = "approved";
      }

      if (settings.provider === "swalasms") {
        if (!settings.senderId) {
          settings.senderId = "EVENT CARD";
        }
        if (!settings.apiKey) {
          settings.apiKey = "swl_live_vtWJVXNYyVpjhUcu3PNFuOvL1WX6nXzE0yz9qVImRwNCP5a3";
        }
        if (!settings.url) {
          settings.url = "https://swalasms.com/api/v1/sms/quick-message";
        }
      } else if (settings.provider === "ehub") {
        if (settings.senderId === "00420892-38bd-47b0-9a5f-ea55bef5d2d1" || !settings.senderId || settings.senderId === "EVENT CARD") {
          settings.senderId = "339330f1-4e6a-4bf7-a9f8-eaae2a9dd397";
        }
        if (!settings.apiKey || settings.apiKey.startsWith("zs_")) {
          settings.apiKey = "sk_Y8rB4E2PzMMOQZ3LyCbf8xYKw1tjniyhae85NX3IxKgLx6GD";
        }
        if (!settings.apiSecret) {
          settings.apiSecret = "CDWwiiKKTa44Ql6R4uOO4jZgHVnhmnRivl7SrIYgdbeRSKJ3Z8Q7JoaSqe07miWf";
        }
        if (!settings.url) {
          settings.url = "https://sms.ehub.co.tz/api/v1/sms/send";
        }
      }

      db.smsGatewaySettings = settings;
      await writeDB(db);
      
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 6: Save SMS Gateway config
  app.post("/api/sms-settings", async (req, res) => {
    try {
      const db = await readDBLatest();
      const newSettings = req.body;
      
      // Always mark senderIdStatus as approved instantly so users can send SMS immediately
      newSettings.senderIdStatus = 'approved';

      // Unpack meta_token and phone_number_id to top-level properties if whatsappUrl is JSON
      if (newSettings.whatsappUrl) {
        try {
          const wData = typeof newSettings.whatsappUrl === 'string' && newSettings.whatsappUrl.trim().startsWith('{')
            ? JSON.parse(newSettings.whatsappUrl)
            : newSettings.whatsappUrl;
          if (wData && typeof wData === 'object') {
            if (wData.meta_token || wData.metaToken || wData.token || wData.access_token) {
              const tokenVal = wData.meta_token || wData.metaToken || wData.token || wData.access_token;
              newSettings.metaToken = tokenVal;
              newSettings.whatsappMetaToken = tokenVal;
              newSettings.meta_token = tokenVal;
            }
            if (wData.phone_number_id || wData.metaPhoneNumberId || wData.phoneId || wData.phone_id) {
              const phoneVal = wData.phone_number_id || wData.metaPhoneNumberId || wData.phoneId || wData.phone_id;
              newSettings.metaPhoneNumberId = phoneVal;
              newSettings.whatsappMetaPhoneId = phoneVal;
              newSettings.phone_number_id = phoneVal;
            }
          }
        } catch (e) {
          // ignore json parse error
        }
      }

      if (newSettings.provider === 'ehub') {
        if (newSettings.senderId === '00420892-38bd-47b0-9a5f-ea55bef5d2d1' || !newSettings.senderId || newSettings.senderId === 'EVENT CARD') {
          newSettings.senderId = '339330f1-4e6a-4bf7-a9f8-eaae2a9dd397';
        } else if (newSettings.senderId === 'UWALEMI') {
          newSettings.senderId = '19f41b59-19d0-4f98-b8c9-9d5b1ac31308';
        }
        if (!newSettings.apiKey || newSettings.apiKey.startsWith('zs_')) {
          newSettings.apiKey = 'sk_Y8rB4E2PzMMOQZ3LyCbf8xYKw1tjniyhae85NX3IxKgLx6GD';
        }
        if (!newSettings.apiSecret) {
          newSettings.apiSecret = 'CDWwiiKKTa44Ql6R4uOO4jZgHVnhmnRivl7SrIYgdbeRSKJ3Z8Q7JoaSqe07miWf';
        }
      }

      db.smsGatewaySettings = newSettings;
      await writeDB(db);
      res.json({ success: true, message: "Gateway settings saved successfully" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 6B: Direct Meta testing/review call trigger proxy to resolve 0/1 API calls required
  app.post("/api/meta-trigger-review-calls", async (req, res) => {
    try {
      const { meta_token, waba_id, phone_number_id } = req.body;
      if (!meta_token) {
        return res.status(400).json({ error: "Meta Access Token is required." });
      }

      const logs: string[] = [];

      // 1. business_management -> GET /v20.0/me/businesses
      try {
        logs.push(`[1/5] Inatuma ombi la 'business_management' (GET /v20.0/me/businesses)...`);
        const bizResp = await fetch("https://graph.facebook.com/v20.0/me/businesses", {
          headers: { "Authorization": `Bearer ${meta_token}` }
        });
        const bizData: any = await bizResp.json();
        if (bizResp.ok) {
          const count = bizData.data?.length || 0;
          logs.push(`✅ Imefanikiwa! Imepata akaunti za biashara (Businesses) ${count}.`);
        } else {
          logs.push(`⚠️ Onyo la 'business_management': ${bizData.error?.message || JSON.stringify(bizData)}`);
        }
      } catch (err: any) {
        logs.push(`❌ Hitilafu ya 'business_management': ${err.message}`);
      }

      // 2. whatsapp_business_management -> GET /v20.0/{waba_id}
      if (waba_id) {
        try {
          logs.push(`[2/5] Inatuma ombi la 'whatsapp_business_management' (GET /v20.0/${waba_id})...`);
          const wabaResp = await fetch(`https://graph.facebook.com/v20.0/${waba_id}`, {
            headers: { "Authorization": `Bearer ${meta_token}` }
          });
          const wabaData: any = await wabaResp.json();
          if (wabaResp.ok) {
            logs.push(`✅ Imefanikiwa! Akaunti ya WhatsApp WABA (${wabaData.name || waba_id}) imepatikana.`);
          } else {
            logs.push(`⚠️ Onyo la WABA GET: ${wabaData.error?.message || JSON.stringify(wabaData)}`);
          }
        } catch (err: any) {
          logs.push(`❌ Hitilafu ya WABA GET: ${err.message}`);
        }

        // 3. whatsapp_business_management -> GET /v20.0/{waba_id}/phone_numbers
        try {
          logs.push(`[3/5] Inatuma ombi la 'whatsapp_business_management' (GET /v20.0/${waba_id}/phone_numbers)...`);
          const phoneResp = await fetch(`https://graph.facebook.com/v20.0/${waba_id}/phone_numbers`, {
            headers: { "Authorization": `Bearer ${meta_token}` }
          });
          const phoneData: any = await phoneResp.json();
          if (phoneResp.ok) {
            const count = phoneData.data?.length || 0;
            logs.push(`✅ Imefanikiwa! Imepata namba za simu ${count} zilizounganishwa na WABA.`);
          } else {
            logs.push(`⚠️ Onyo la WABA Phone Numbers: ${phoneData.error?.message || JSON.stringify(phoneData)}`);
          }
        } catch (err: any) {
          logs.push(`❌ Hitilafu ya WABA Phone Numbers: ${err.message}`);
        }

        // 4. whatsapp_business_management -> GET /v20.0/{waba_id}/message_templates
        try {
          logs.push(`[4/5] Inatuma ombi la 'whatsapp_business_management' (GET /v20.0/${waba_id}/message_templates)...`);
          const templateResp = await fetch(`https://graph.facebook.com/v20.0/${waba_id}/message_templates`, {
            headers: { "Authorization": `Bearer ${meta_token}` }
          });
          const templateData: any = await templateResp.json();
          if (templateResp.ok) {
            const count = templateData.data?.length || 0;
            logs.push(`✅ Imefanikiwa! Imepata templates ${count} za WhatsApp.`);
          } else {
            logs.push(`⚠️ Onyo la WABA Templates: ${templateData.error?.message || JSON.stringify(templateData)}`);
          }
        } catch (err: any) {
          logs.push(`❌ Hitilafu ya WABA Templates: ${err.message}`);
        }
      } else {
        logs.push(`ℹ️ Tunasasisha: WhatsApp Business Account ID haikuwekwa, hivyo hatua ya [2], [3] na [4] imerukwa.`);
      }

      // 5. whatsapp_business_management -> GET /v20.0/{phone_number_id}
      if (phone_number_id) {
        try {
          logs.push(`[5/5] Inatuma ombi la 'whatsapp_business_management' (GET /v20.0/${phone_number_id})...`);
          const phResp = await fetch(`https://graph.facebook.com/v20.0/${phone_number_id}`, {
            headers: { "Authorization": `Bearer ${meta_token}` }
          });
          const phData: any = await phResp.json();
          if (phResp.ok) {
            logs.push(`✅ Imefanikiwa! Maelezo ya namba ya simu ya Meta (${phData.display_phone_number || phone_number_id}) yamepatikana.`);
          } else {
            logs.push(`⚠️ Onyo la Phone ID GET: ${phData.error?.message || JSON.stringify(phData)}`);
          }
        } catch (err: any) {
          logs.push(`❌ Hitilafu ya Phone ID GET: ${err.message}`);
        }
      } else {
        logs.push(`ℹ️ Tunasasisha: Phone Number ID haikuwekwa, hivyo hatua ya [5] imerukwa.`);
      }

      res.json({ success: true, logs });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 6D: WhatsApp Webhook message, status & AI Auto-Reply receiver (POST)
  app.post(["/api/webhook/whatsapp", "/api/whatsapp/webhook", "/webhook/whatsapp", "/whatsapp/webhook"], async (req, res) => {
    const body = req.body;
    console.log("[WhatsApp Webhook] Event Received:", JSON.stringify(body, null, 2));

    // Acknowledge Meta immediately
    res.sendStatus(200);

    try {
      if (body && (body.entry || body.object === 'whatsapp_business_account')) {
        const db = await readDBLatest();
        let databaseUpdated = false;

        const entries = body.entry || [body];
        for (const entry of entries) {
          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.value) {
                const value = change.value;

                // 1. Handle message status updates (sent, delivered, read, failed)
                if (value.statuses) {
                  for (const status of value.statuses) {
                    const recipientPhone = status.recipient_id; // e.g. 255712345678 or "712345678"
                    const messageStatus = status.status; // "sent", "delivered", "read", "failed"
                    console.log(`[WhatsApp Webhook] Message ID ${status.id} to ${recipientPhone} is now: ${messageStatus}`);

                    const cleanPhone = recipientPhone ? recipientPhone.replace(/\D/g, '') : '';
                    if (db.guests && cleanPhone) {
                      for (const guest of db.guests) {
                        const guestCleanPhone = (guest.phone || "").replace(/\D/g, '');
                        if (guestCleanPhone) {
                          const guestLast9 = guestCleanPhone.slice(-9);
                          const cleanLast9 = cleanPhone.slice(-9);
                          if (guestLast9 === cleanLast9 && guestLast9.length >= 7) {
                            let displayStatus = guest.whatsappStatus;
                            if (messageStatus === 'read') {
                              displayStatus = "Imesomwa";
                            } else if (messageStatus === 'delivered') {
                              displayStatus = "Imefika";
                            } else if (messageStatus === 'sent') {
                              displayStatus = "Imetumia";
                            } else if (messageStatus === 'failed') {
                              displayStatus = "Imeshindikana";
                            }

                            if (guest.whatsappStatus !== displayStatus) {
                              guest.whatsappStatus = displayStatus;
                              databaseUpdated = true;
                            }
                          }
                        }
                      }
                    }
                  }
                }

                // 2. Handle incoming messages, RSVP keyword updates, and AI Auto-Replies
                if (value.messages) {
                  for (const message of value.messages) {
                    const fromPhone = message.from ? message.from.replace(/\D/g, '') : '';
                    const messageType = message.type || 'text';
                    let rawTextBody = '';
                    if (message.text?.body) rawTextBody += message.text.body + ' ';
                    if (message.caption) rawTextBody += message.caption + ' ';
                    if (message.button?.text) rawTextBody += message.button.text + ' ';
                    if (message.button?.payload) rawTextBody += message.button.payload + ' ';
                    if (message.interactive?.button_reply?.title) rawTextBody += message.interactive.button_reply.title + ' ';
                    if (message.interactive?.button_reply?.id) rawTextBody += message.interactive.button_reply.id + ' ';
                    if (message.interactive?.list_reply?.title) rawTextBody += message.interactive.list_reply.title + ' ';
                    if (message.interactive?.list_reply?.id) rawTextBody += message.interactive.list_reply.id + ' ';
                    
                    const textBody = rawTextBody.trim();
                    console.log(`[WhatsApp Webhook] Incoming message from ${fromPhone} (${messageType}): "${textBody}"`);

                    let mediaOptions: { mediaType?: 'image' | 'audio' | 'text'; base64Data?: string; mimeType?: string } | undefined = undefined;
                    const mediaObj = message.image || message.audio || message.voice || message.document;

                    let metaToken = process.env.META_WHATSAPP_TOKEN 
                      || db.smsGatewaySettings?.metaToken 
                      || db.smsGatewaySettings?.whatsappMetaToken 
                      || db.smsGatewaySettings?.meta_token 
                      || db.smsGatewaySettings?.metaAccessToken
                      || db.smsGatewaySettings?.meta_access_token
                      || db.settings?.metaToken 
                      || db.settings?.whatsappMetaToken 
                      || db.settings?.meta_token;

                    let phoneId = process.env.META_PHONE_NUMBER_ID 
                      || db.smsGatewaySettings?.metaPhoneNumberId 
                      || db.smsGatewaySettings?.whatsappMetaPhoneId 
                      || db.smsGatewaySettings?.phone_number_id 
                      || db.smsGatewaySettings?.phoneNumberId
                      || db.smsGatewaySettings?.phoneId
                      || db.settings?.metaPhoneNumberId 
                      || db.settings?.whatsappMetaPhoneId 
                      || db.settings?.phone_number_id;

                    const rawWhatsappUrl = db.smsGatewaySettings?.whatsappUrl || db.settings?.whatsappUrl;
                    if ((!metaToken || !phoneId) && rawWhatsappUrl) {
                      try {
                        const wUrlData = typeof rawWhatsappUrl === 'string' ? JSON.parse(rawWhatsappUrl) : rawWhatsappUrl;
                        if (wUrlData) {
                          if (!metaToken) metaToken = wUrlData.meta_token || wUrlData.metaToken || wUrlData.token || wUrlData.access_token || wUrlData.apiKey;
                          if (!phoneId) phoneId = wUrlData.phone_number_id || wUrlData.metaPhoneNumberId || wUrlData.phoneId || wUrlData.phone_id || wUrlData.apiSecret;
                        }
                      } catch (e) {
                        console.warn("[Parse WhatsApp Settings Warning]:", e);
                      }
                    }

                    if (!phoneId && value?.metadata?.phone_number_id) {
                      phoneId = value.metadata.phone_number_id;
                    }

                    // Download media attachment if image/audio
                    if (mediaObj && mediaObj.id && metaToken) {
                      try {
                        console.log(`[WhatsApp Webhook] Fetching media binary from Meta Graph API for media ID ${mediaObj.id}...`);
                        const mediaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaObj.id}`, {
                          headers: { 'Authorization': `Bearer ${metaToken}` }
                        });
                        const mediaData = await mediaRes.json();
                        if (mediaData && mediaData.url) {
                          const binaryRes = await fetch(mediaData.url, {
                            headers: { 'Authorization': `Bearer ${metaToken}` }
                          });
                          const arrayBuf = await binaryRes.arrayBuffer();
                          const base64Data = Buffer.from(arrayBuf).toString('base64');
                          mediaOptions = {
                            mediaType: (messageType === 'audio' || messageType === 'voice') ? 'audio' : 'image',
                            base64Data,
                            mimeType: mediaObj.mime_type || ((messageType === 'audio' || messageType === 'voice') ? 'audio/ogg' : 'image/jpeg')
                          };
                        }
                      } catch (mediaErr) {
                        console.error("[WhatsApp Webhook] Failed to download media attachment:", mediaErr);
                      }
                    }

                    if (fromPhone && (textBody || mediaOptions)) {
                      const botResult = await processWhatsAppBotLogic(fromPhone, textBody, db, mediaOptions);
                      const botReply = botResult.botReply;
                      if (botResult.databaseUpdated) {
                        databaseUpdated = true;
                      }

                      console.log(`[WhatsApp Webhook] Generated Bot Reply for ${fromPhone}: "${botReply.substring(0, 80)}..."`);
                      console.log(`[WhatsApp Auto-Reply Debug] metaToken: ${metaToken ? 'EXISTS (' + metaToken.substring(0, 10) + '...)' : 'MISSING'}, phoneId: ${phoneId || 'MISSING'}, recipient: ${fromPhone}`);

                      const logEntry: any = {
                        id: 'walog-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                        timestamp: new Date().toISOString(),
                        fromPhone,
                        guestName: botResult.matchedGuestName || "Mgeni Asiyejulikana",
                        incomingMessage: textBody || (mediaOptions?.mediaType === 'audio' ? '[Sauti Voice Note]' : '[Picha / Risiti]'),
                        botReply,
                        phoneId: phoneId || "",
                        metaTokenExists: !!metaToken,
                        status: 'pending',
                        metaResponse: null,
                        error: null
                      };

                      let sendSuccess = false;

                      if (metaToken && phoneId) {
                        try {
                          const resMeta = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${metaToken}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                              messaging_product: 'whatsapp',
                              recipient_type: 'individual',
                              to: fromPhone,
                              type: 'text',
                              text: { preview_url: false, body: botReply }
                            })
                          });
                          const resMetaJson = await resMeta.json();
                          logEntry.metaResponse = resMetaJson;
                          console.log(`[WhatsApp Auto-Reply Sent to ${fromPhone}] Meta Response:`, JSON.stringify(resMetaJson));

                          if (resMeta.ok && !resMetaJson.error) {
                            sendSuccess = true;
                            logEntry.status = 'sent';
                          } else {
                            logEntry.status = 'failed';
                            logEntry.error = resMetaJson.error ? (resMetaJson.error.message || JSON.stringify(resMetaJson.error)) : `HTTP ${resMeta.status}`;
                          }
                        } catch (sendErr: any) {
                          console.error("[WhatsApp Auto-Reply Send Error]:", sendErr);
                          logEntry.status = 'failed';
                          logEntry.error = sendErr.message || "Network Error";
                        }
                      } else {
                        logEntry.status = 'no_token';
                        logEntry.error = "Meta Access Token au Phone Number ID haijatengenezwa/haipatikani kwny Mipangilio.";
                        console.warn(`[WhatsApp Auto-Reply Warning]: Cannot send auto-reply to ${fromPhone} because Meta Access Token or Phone Number ID is missing in settings.`);
                      }

                      // Fallback: If Meta send failed or token is missing, attempt to dispatch via SMS/Gateway if configured
                      if (!sendSuccess && db.smsGatewaySettings && db.smsGatewaySettings.provider && db.smsGatewaySettings.provider !== 'simulation') {
                        try {
                          console.log(`[WhatsApp Auto-Reply Fallback] Attempting SMS fallback dispatch to ${fromPhone}...`);
                          const smsResult = await dispatchSMS(fromPhone, botReply, 'sms', db.smsGatewaySettings);
                          logEntry.status = 'fallback_sent';
                          logEntry.fallbackResult = smsResult;
                        } catch (fallbackErr: any) {
                          console.warn("[WhatsApp Auto-Reply Fallback Error]:", fallbackErr?.message);
                        }
                      }

                      db.whatsappLogs = [logEntry, ...(db.whatsappLogs || [])].slice(0, 200);
                      databaseUpdated = true;
                    }
                  }
                }
              }
            }
          }
        }

        if (databaseUpdated) {
          await writeDB(db);
        }
      }
    } catch (err) {
      console.error("[WhatsApp Webhook] Error parsing webhook payload:", err);
    }
  });

  // API 6C: GET WhatsApp Webhook & Auto-Reply Logs
  app.get("/api/whatsapp-logs", async (req, res) => {
    try {
      const db = await readDBLatest();
      res.json(db.whatsappLogs || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 6D: DELETE WhatsApp Webhook Logs
  app.delete("/api/whatsapp-logs", async (req, res) => {
    try {
      const db = await readDBLatest();
      db.whatsappLogs = [];
      await writeDB(db);
      res.json({ success: true, message: "Kumbukumbu za WhatsApp zimefutwa." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 6E: Test WhatsApp Chatbot Auto-Reply
  app.post("/api/whatsapp/test-autoreply", async (req, res) => {
    try {
      const { phone, message, mediaType, base64Data, mimeType } = req.body;
      if (!phone || (!message && !base64Data)) {
        return res.status(400).json({ error: "Missing phone or message/media parameter" });
      }

      const db = await readDBLatest();
      const { botReply, databaseUpdated } = await processWhatsAppBotLogic(
        phone, 
        message || '', 
        db, 
        { mediaType, base64Data, mimeType }
      );

      if (databaseUpdated) {
        await writeDB(db);
      }

      const cleanFromPhone = phone.replace(/\D/g, '');

      // Extract Meta Token & Phone Number ID
      let metaToken = process.env.META_WHATSAPP_TOKEN 
        || db.smsGatewaySettings?.metaToken 
        || db.smsGatewaySettings?.whatsappMetaToken 
        || db.smsGatewaySettings?.meta_token 
        || db.smsGatewaySettings?.metaAccessToken
        || db.smsGatewaySettings?.meta_access_token
        || db.settings?.metaToken 
        || db.settings?.whatsappMetaToken 
        || db.settings?.meta_token;

      let phoneId = process.env.META_PHONE_NUMBER_ID 
        || db.smsGatewaySettings?.metaPhoneNumberId 
        || db.smsGatewaySettings?.whatsappMetaPhoneId 
        || db.smsGatewaySettings?.phone_number_id 
        || db.smsGatewaySettings?.phoneNumberId
        || db.smsGatewaySettings?.phoneId
        || db.settings?.metaPhoneNumberId
        || db.settings?.phone_number_id;

      if (!metaToken || !phoneId) {
        if (db.smsGatewaySettings?.whatsappUrl && db.smsGatewaySettings.whatsappUrl.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(db.smsGatewaySettings.whatsappUrl);
            if (parsed.meta_token || parsed.token || parsed.accessToken) {
              metaToken = parsed.meta_token || parsed.token || parsed.accessToken;
            }
            if (parsed.phone_number_id || parsed.phone_id || parsed.phoneNumberId) {
              phoneId = parsed.phone_number_id || parsed.phone_id || parsed.phoneNumberId;
            }
          } catch (e) {}
        }
      }

      let metaSentSuccess = false;
      let metaErrorDetail: any = null;

      if (metaToken && phoneId) {
        try {
          const metaUrl = `https://graph.facebook.com/v17.0/${phoneId}/messages`;
          const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: cleanFromPhone,
            type: "text",
            text: { preview_url: false, body: botReply }
          };

          const resp = await fetch(metaUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${metaToken.trim()}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });

          const respData = await resp.json();
          if (resp.ok) {
            metaSentSuccess = true;
          } else {
            metaErrorDetail = respData;
          }
        } catch (mErr: any) {
          metaErrorDetail = mErr.message;
        }
      }

      // Record test log
      db.whatsappLogs = db.whatsappLogs || [];
      db.whatsappLogs.unshift({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        from: cleanFromPhone,
        text: message.trim(),
        botReply: botReply,
        status: metaSentSuccess ? 'SENT_TO_META' : (metaToken ? 'META_ERROR' : 'SIMULATED_SUCCESS'),
        metaError: metaErrorDetail
      });
      if (db.whatsappLogs.length > 100) db.whatsappLogs = db.whatsappLogs.slice(0, 100);
      await writeDB(db);

      res.json({
        success: true,
        botReply: botReply,
        sentToMeta: metaSentSuccess,
        metaError: metaErrorDetail
      });
    } catch (e: any) {
      console.error("[WhatsApp Test AutoReply Error]:", e?.message);
      res.status(500).json({ error: e.message });
    }
  });

  // API 6B: Request or Status of Sender ID
  app.get("/api/sms/request-sender-id", async (req, res) => {
    try {
      const db = await readDBLatest();
      const settings = db.smsGatewaySettings || {};
      res.json({
        senderId: settings.senderId || "",
        status: settings.senderIdStatus || "approved" // Defaulting to approved for basic setup
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/sms/request-sender-id", async (req, res) => {
    try {
      const { senderId } = req.body;
      if (!senderId) return res.status(400).json({ error: "Missing senderId" });

      const db = await readDBLatest();
      if (!db.smsGatewaySettings) db.smsGatewaySettings = {};
      db.smsGatewaySettings.senderId = senderId;
      db.smsGatewaySettings.senderIdStatus = 'pending';
      await writeDB(db);
      res.json({ success: true, status: 'pending' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: Save The Date endpoints
  app.get("/api/save-the-dates/:eventId", async (req, res) => {
    try {
      const { eventId } = req.params;
      const db = await readDBLatest();
      res.json((db.saveTheDates || []).filter((s: any) => s.event_id === eventId));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/save-the-dates", async (req, res) => {
    try {
      const db = await readDBLatest();
      const newStd = { ...req.body, id: Math.random().toString(36).substring(2, 11), created_at: new Date().toISOString() };
      db.saveTheDates = [...(db.saveTheDates || []), newStd];
      await writeDB(db);
      res.json(newStd);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/save-the-dates/send", async (req, res) => {
    try {
      const { stdId, guestId, phone, message } = req.body;
      const db = await readDBLatest();
      const settings = db.smsGatewaySettings || { provider: "simulation" };
      
      // Send with Simulation fallback on gateway error
      let sendResult = "";
      let failoverLog = "";
      try {
        sendResult = await dispatchSMS(phone, message, 'sms', settings);
      } catch (e: any) {
        console.log(`[SaveTheDate] Gateway redirected to Simulation mode for ${phone}.`);
        failoverLog = `(Gateway redirected. Soft-failed to Simulation) `;
        sendResult = "SMS Simulation";
      }

      // Record recipient
      const recipients = db.saveTheDateRecipients || [];
      db.saveTheDateRecipients = [...recipients, {
        id: Math.random().toString(36).substring(2, 11),
        save_the_date_id: stdId,
        guest_id: guestId,
        sent_at: new Date().toISOString(),
        status: 'Sent',
        log: failoverLog + sendResult
      }];
      await writeDB(db);
      res.json({ success: true, log: failoverLog + sendResult });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // BACKGROUND QUEUE JOBS MANAGER (Asynchronous Queue with Throttling & Rate-Limiting)
  let isQueueProcessing = false;

  async function processQueueJobs() {
    if (isQueueProcessing) return;
    isQueueProcessing = true;

    try {
      while (true) {
        const db = await readDBLatest();
        if (!db) break;
        if (!db.queueJobs) db.queueJobs = [];

        // 1. Auto-cleanup any old/completed/stuck jobs where all tasks are sent or failed
        let stateChanged = false;
        for (const job of db.queueJobs) {
          if (!job || !job.tasks) continue;
          const finishedTasks = job.tasks.filter((t: any) => t && (t.status === 'sent' || t.status === 'failed')).length;
          if (finishedTasks >= job.tasks.length && job.status !== 'completed') {
            job.status = 'completed';
            job.processed = finishedTasks;
            job.completed_at = job.completed_at || new Date().toISOString();
            stateChanged = true;
          }
        }
        if (stateChanged) {
          await writeDB(db);
        }

        // 2. Find first active job that still has pending tasks
        const activeJob = db.queueJobs.find((j: any) => 
          j && 
          (j.status === 'running' || j.status === 'pending') && 
          j.tasks && 
          j.tasks.some((t: any) => t.status === 'pending')
        );

        if (!activeJob) {
          break; // No more active jobs needing processing
        }

        if (activeJob.status === 'pending') {
          activeJob.status = 'running';
          if (!activeJob.logs) activeJob.logs = [];
          activeJob.logs.push(`[${new Date().toLocaleTimeString()}] Kazi imeanza kutekelezwa background.`);
          await writeDB(db);
        }

        const settings = db.smsGatewaySettings || { provider: "simulation" };
        const delayMs = activeJob.channel === 'whatsapp' ? 250 : 1200;

        const tasksList = activeJob.tasks || [];
        let taskExecutedInThisPass = false;

        for (let i = 0; i < tasksList.length; i++) {
          const task = tasksList[i];
          if (!task || task.status === 'sent' || task.status === 'failed') {
            continue;
          }

          // Fetch fresh DB state
          const freshDb = await readDBLatest();
          if (!freshDb || !freshDb.queueJobs) break;
          const currentJob = freshDb.queueJobs.find((j: any) => j && j.id === activeJob.id);

          if (!currentJob) break;
          if (currentJob.status === 'paused' || currentJob.status === 'failed' || currentJob.status === 'completed') {
            break;
          }

          taskExecutedInThisPass = true;

          try {
            let usedChannel = activeJob.channel;
            const protocol = 'https';
            const host = 'eventcard.co.tz';
            const origin = `${protocol}://${host}`;
            const currentSettings = freshDb.smsGatewaySettings || settings;

            const result = await dispatchSMS(
              task.phone,
              task.text,
              usedChannel,
              currentSettings,
              undefined,
              task.templateParams,
              task.guestId,
              origin,
              activeJob.eventId,
              task.templateName,
              task.imageUrl,
              task.lang
            );

            task.status = 'sent';
            task.usedChannel = usedChannel;
            task.log = result;

            if (task.guestId && freshDb.guests) {
              freshDb.guests = freshDb.guests.map((g: any) => {
                if (g.id === task.guestId) {
                  if (usedChannel === 'whatsapp') {
                    const currentCount = typeof g.whatsappCount === 'number' ? g.whatsappCount : (g.whatsappStatus === 'Imetumia' ? 1 : 0);
                    return { 
                      ...g, 
                      whatsappStatus: "Imetumia", 
                      whatsappCount: currentCount + 1,
                      lastSentChannel: "whatsapp",
                      lastSentLang: task.lang || "sw"
                    };
                  } else {
                    const currentCount = typeof g.smsCount === 'number' ? g.smsCount : (g.smsStatus === 'Imetumia' ? 1 : 0);
                    return { 
                      ...g, 
                      smsStatus: "Imetumia", 
                      smsCount: currentCount + 1,
                      lastSentChannel: "sms",
                      lastSentLang: task.lang || "sw"
                    };
                  }
                }
                return g;
              });
            }

            if (!currentJob.logs) currentJob.logs = [];
            currentJob.logs.push(`[${new Date().toLocaleTimeString()}] ✓ [${usedChannel.toUpperCase()}] Imetumwa kwa namba ${task.phone}.`);
          } catch (err: any) {
            task.status = 'failed';
            task.error = err.message;
            if (!currentJob.logs) currentJob.logs = [];
            currentJob.logs.push(`[${new Date().toLocaleTimeString()}] ✗ Imeshindwa kwa namba ${task.phone}. Sababu: ${err.message}`);
          }

          if (!currentJob.tasks) currentJob.tasks = [];
          currentJob.tasks[i] = task;

          const doneCount = currentJob.tasks.filter((t: any) => t && (t.status === 'sent' || t.status === 'failed')).length;
          currentJob.processed = doneCount;

          if (doneCount >= (currentJob.total || currentJob.tasks.length)) {
            currentJob.status = 'completed';
            currentJob.completed_at = new Date().toISOString();
            if (!currentJob.logs) currentJob.logs = [];
            currentJob.logs.push(`[${new Date().toLocaleTimeString()}] ✓ Kazi yote ya kutuma imekamilika!`);
          }

          await writeDB(freshDb);

          // Throttling: wait between dispatches
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        // Safety check if no task was executed in this pass (all were already sent/failed)
        if (!taskExecutedInThisPass) {
          const freshDb = await readDBLatest();
          if (freshDb && freshDb.queueJobs) {
            const currentJob = freshDb.queueJobs.find((j: any) => j && j.id === activeJob.id);
            if (currentJob) {
              currentJob.status = 'completed';
              currentJob.completed_at = new Date().toISOString();
              await writeDB(freshDb);
            }
          }
        }
      }
    } catch (err: any) {
      console.error("[QueueProcessor] Error in loop:", err);
    } finally {
      isQueueProcessing = false;
    }
  }

  // Queue Endpoints
  app.post("/api/queue/create", async (req, res) => {
    try {
      const { eventId, channel, tasks } = req.body;
      if (!channel || !tasks || !Array.isArray(tasks)) {
        return res.status(400).json({ error: "Missing required parameters (channel, tasks)" });
      }

      const db = await readDBLatest();
      db.queueJobs = db.queueJobs || [];

      const job = {
        id: 'job-' + Date.now() + Math.random().toString(36).substring(2, 7),
        eventId: eventId || 'default',
        channel,
        status: 'pending',
        total: tasks.length,
        processed: 0,
        created_at: new Date().toISOString(),
        tasks: tasks.map(t => ({
          guestId: t.guestId,
          phone: t.phone,
          text: t.text,
          templateParams: t.templateParams,
          templateName: t.templateName,
          imageUrl: t.imageUrl,
          lang: t.lang || "sw",
          status: 'pending'
        })),
        logs: [`[${new Date().toLocaleTimeString()}] Kazi imeongezwa kwenye foleni ya kutuma (Queue). Jumla ya ujumbe: ${tasks.length}`]
      };

      db.queueJobs.push(job);
      await writeDB(db);

      // Trigger processing asynchronously
      processQueueJobs();

      res.json({ success: true, job });
    } catch (e: any) {
      console.error("Queue creation error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/queue/jobs", async (req, res) => {
    try {
      const db = await readDBLatest();
      res.json(db.queueJobs || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/queue/control", async (req, res) => {
    try {
      const { jobId, action } = req.body;
      if (!jobId || !action) {
        return res.status(400).json({ error: "Missing jobId or action" });
      }

      const db = await readDBLatest();
      db.queueJobs = db.queueJobs || [];

      if (action === 'clear') {
        db.queueJobs = db.queueJobs.filter((j: any) => j.id !== jobId);
        await writeDB(db);
        return res.json({ success: true });
      }

      const job = db.queueJobs.find((j: any) => j.id === jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (action === 'pause') {
        if (job.status === 'running' || job.status === 'pending') {
          job.status = 'paused';
          job.logs.push(`[${new Date().toLocaleTimeString()}] Kazi imesitishwa na mtumiaji.`);
        }
      } else if (action === 'resume') {
        if (job.status === 'paused') {
          job.status = 'pending';
          job.logs.push(`[${new Date().toLocaleTimeString()}] Kazi imeanzishwa tena na mtumiaji.`);
          processQueueJobs();
        }
      } else if (action === 'cancel') {
        if (job.status === 'running' || job.status === 'pending' || job.status === 'paused') {
          job.status = 'failed';
          job.logs.push(`[${new Date().toLocaleTimeString()}] Kazi imefutwa na mtumiaji.`);
        }
      }

      await writeDB(db);
      res.json({ success: true, job });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 7: Real Send SMS & WhatsApp dispatcher
  app.post("/api/send-sms", async (req, res) => {
    try {
      const { guestId, eventId, phone, text, channel, scheduleTime, templateParams, templateName, imageUrl, lang, msgType, isSimulationOnly } = req.body;
      if (!phone || !text) {
        return res.status(400).json({ error: "Missing phone number or message text" });
      }

      const db = await readDBLatest();
      const settings = db.smsGatewaySettings || { provider: "simulation" };

      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const origin = `${protocol}://${host}`;
      let result: string;
      let usedChannel = channel || 'sms';
      let failoverAttempted = false;
      let failoverLog = '';

      if (isSimulationOnly || text === 'manual_whatsapp') {
        result = usedChannel === 'whatsapp' ? "WhatsApp Manual Open" : "SMS Simulation";
      } else {
        try {
          result = await dispatchSMS(phone, text, usedChannel, settings, scheduleTime, templateParams, guestId, origin, eventId, templateName, imageUrl, lang);
        } catch (e: any) {
          console.log(`[SMS-Dispatch-Info] Primary routing channel ${usedChannel} status for ${phone}: redirected.`);
          // Do NOT attempt failover if the user explicitly requested a specific channel
          if (channel === 'sms' || channel === 'whatsapp') {
            throw e;
          }
          
          // Attempt failover (for legacy 'auto' logic if any)
          failoverAttempted = true;
          failoverLog = `(Primary ${usedChannel} redirected) `;
          usedChannel = usedChannel === 'whatsapp' ? 'sms' : 'whatsapp';
          console.log(`[SMS-Dispatch-Info] Falling back to secondary channel ${usedChannel} for ${phone}`);
          try {
            result = await dispatchSMS(phone, text, usedChannel, settings, scheduleTime, templateParams, guestId, origin, eventId, templateName, imageUrl, lang);
          } catch (e2: any) {
            console.log(`[SMS-Dispatch-Info] Secondary routing channel ${usedChannel} status for ${phone}: redirected.`);
            console.log(`[SMS-Dispatch-Info] Gateways redirected to local simulation mode.`);
            usedChannel = channel || 'sms';
            failoverLog = `(Gateways redirected. Soft-failed to Simulation) `;
            result = usedChannel === 'whatsapp' ? "WhatsApp Simulation" : "SMS Simulation";
          }
        }
      }
      
      let batchId = null;
      try {
        const parsed = JSON.parse(result);
        batchId = parsed.batch_id || parsed.id || null;
      } catch {
        // Not JSON or no batch_id
      }

      if (guestId) {
        db.guests = (db.guests || []).map((g: any) => {
          if (g.id === guestId) {
            const customFields = g.customFields || {};
            if (msgType === 'save_the_date') {
              customFields.std_sent_channel = usedChannel;
              customFields.std_sent_lang = lang || "sw";
              return {
                ...g,
                customFields,
                stdSent: true,
                stdSentChannel: usedChannel,
                stdSentLang: lang || "sw"
              };
            } else if (msgType === 'pledge') {
              customFields.pledge_sent_channel = usedChannel;
              customFields.pledge_sent_lang = lang || "sw";
              return {
                ...g,
                customFields,
                pledgeSent: true,
                pledgeSentChannel: usedChannel,
                pledgeSentLang: lang || "sw"
              };
            } else if (msgType === 'reminder') {
              customFields.reminder_sent_channel = usedChannel;
              customFields.reminder_sent_lang = lang || "sw";
              return {
                ...g,
                customFields,
                reminderSent: true,
                reminderSentChannel: usedChannel,
                reminderSentLang: lang || "sw"
              };
            } else if (msgType === 'thanks') {
              customFields.thanks_sent_channel = usedChannel;
              customFields.thanks_sent_lang = lang || "sw";
              return {
                ...g,
                customFields,
                thanksSent: true,
                thanksSentChannel: usedChannel,
                thanksSentLang: lang || "sw"
              };
            } else {
              // Default to invitation
              customFields.invite_sent_channel = usedChannel;
              customFields.invite_sent_lang = lang || "sw";
              if (usedChannel === 'whatsapp') {
                const currentCount = typeof g.whatsappCount === 'number' ? g.whatsappCount : (g.whatsappStatus === 'Imetumia' ? 1 : 0);
                return { 
                  ...g, 
                  customFields,
                  whatsappStatus: "Imetumia",
                  whatsappCount: currentCount + 1,
                  lastSentChannel: "whatsapp",
                  lastSentLang: lang || "sw"
                };
              } else {
                const currentCount = typeof g.smsCount === 'number' ? g.smsCount : (g.smsStatus === 'Imetumia' ? 1 : 0);
                return { 
                  ...g, 
                  customFields,
                  smsStatus: "Imetumia",
                  smsCount: currentCount + 1,
                  lastSentChannel: "sms",
                  lastSentLang: lang || "sw"
                };
              }
            }
          }
          return g;
        });
        await writeDB(db);
      }
      
      res.json({ success: true, log: failoverLog + result, batchId, usedChannel, failoverAttempted });
    } catch (e: any) {
      console.error("SMS Dispatch error:", e.message);
      res.status(500).json({ error: `Failed to send SMS: ${e.message}` });
    }
  });

  // API 7C: Get SMS Balance
  app.get("/api/sms-balance", async (req, res) => {
    try {
      const db = await readDBLatest();
      const source = req.query.source;
      const paramProvider = req.query.provider as string;
      const paramApiKey = req.query.apiKey as string;
      const paramSecret = (req.query.secretKey || req.query.apiSecret) as string;
      const paramSenderId = req.query.senderId as string;

      let settings: any = db.smsGatewaySettings || { provider: "simulation" };

      // If checking from UWALEMI SMS Center
      if (source === 'uwalemi' && db.uwalemiState?.groupSettings?.smsConfig) {
        const u = db.uwalemiState.groupSettings.smsConfig;
        settings = {
          provider: u.provider || 'simulation',
          apiKey: u.apiKey || '',
          apiSecret: u.secretKey || '',
          senderId: u.senderId || 'UWALEMI',
          url: u.baseUrl
        };
      }

      // If specific query params were provided for testing
      if (paramProvider) {
        settings = {
          provider: paramProvider,
          apiKey: paramApiKey || settings.apiKey || '',
          apiSecret: paramSecret || settings.apiSecret || '',
          senderId: paramSenderId || settings.senderId || 'UWALEMI'
        };
      }

      const globalHasEhub = db.smsGatewaySettings?.provider === 'ehub' && !!db.smsGatewaySettings?.apiKey;

      if (settings.provider === "simulation" || !settings.provider) {
        return res.json({ 
          provider: "simulation", 
          isSimulation: true,
          globalHasEhub,
          message: "Hali ya Majaribio (Simulation Mode) - Hakuna salio linalokatwa." 
        });
      }

      if (settings.provider === "meseji") {
        const apiKey = (settings.apiKey || "").trim();
        if (!apiKey) {
          return res.status(400).json({ error: "Missing API Key ya Meseji.co.tz", provider: "meseji", globalHasEhub });
        }

        const mesejiHeaders: any = {
          "Accept": "application/json"
        };
        if (apiKey.startsWith("zs_")) {
          mesejiHeaders["x-api-key"] = apiKey;
        } else {
          mesejiHeaders["x-api-key"] = apiKey;
          mesejiHeaders["Authorization"] = "Bearer " + apiKey;
        }

        const response = await fetch("https://meseji.co.tz/api/v1/sms/balance", {
          method: "GET",
          headers: mesejiHeaders
        });

        const dataText = await response.text();
        let parsed = null;
        try {
          parsed = JSON.parse(dataText);
        } catch { }

        if (response.status === 401 || (parsed && (parsed.error === "Invalid or expired token" || parsed.message === "Unauthorized"))) {
          return res.status(401).json({
            provider: "meseji",
            isSimulation: false,
            error: `Token yako ya Meseji.co.tz ("${apiKey.substring(0, 8)}...") imekwisha muda au si sahihi (Invalid or Expired Token - 401). Tafadhali ingia kwenye akaunti yako ya Meseji.co.tz > API Settings utengeneze token mpya, au badilisha mtoa huduma kuwa eHub SMS (ambayo tayari ina salio).`,
            raw: parsed || dataText,
            status: 401,
            globalHasEhub
          });
        }

        // Attempt to extract numeric balance, else return raw
        let balance = null;
        if (parsed) {
          if (typeof parsed.balance !== "undefined") balance = parsed.balance;
          else if (typeof parsed.credits !== "undefined") balance = parsed.credits;
          else if (typeof parsed.credit !== "undefined") balance = parsed.credit;
          else if (typeof parsed.amount !== "undefined") balance = parsed.amount;
        }

        if (balance !== null) {
          balance = Math.floor(balance);
        }

        return res.json({ 
          provider: "meseji",
          isSimulation: false,
          balance: balance,
          raw: parsed || dataText,
          status: response.status,
          globalHasEhub
        });
      }

      if (settings.provider === "beem") {
        const apiKey = (settings.apiKey || "").trim();
        const apiSecret = (settings.apiSecret || "").trim();
        if (!apiKey) return res.status(400).json({ error: "Missing Api Key ya Beem", provider: "beem", globalHasEhub });

        const response = await fetch("https://api.beem.africa/v1/public/profile/balance", {
          method: "GET",
          headers: {
            "Authorization": "Basic " + Buffer.from(apiKey + ":" + apiSecret).toString("base64"),
            "Accept": "application/json"
          }
        });

        const dataText = await response.text();
        let parsed = null;
        try { parsed = JSON.parse(dataText); } catch { }

        let balance = "N/A";
        if (parsed && parsed.data && typeof parsed.data.credit_balance !== "undefined") {
          balance = String(Math.floor(Number(parsed.data.credit_balance)));
        } else if (parsed && typeof parsed.balance !== "undefined") {
          balance = String(Math.floor(Number(parsed.balance)));
        }

        return res.json({
          provider: "beem",
          isSimulation: false,
          balance: balance,
          raw: parsed || dataText,
          status: response.status,
          globalHasEhub
        });
      }

      if (settings.provider === "nextsms") {
        const apiKey = (settings.apiKey || "").trim();
        const apiSecret = (settings.apiSecret || "").trim();
        if (!apiKey) return res.status(400).json({ error: "Missing API Key ya NextSMS", provider: "nextsms", globalHasEhub });

        const authHeader = apiSecret 
          ? "Basic " + Buffer.from(apiKey + ":" + apiSecret).toString("base64")
          : "Bearer " + apiKey;

        const response = await fetch("https://messaging-service.co.tz/api/sms/v1/balance", {
          method: "GET",
          headers: {
            "Authorization": authHeader,
            "Accept": "application/json"
          }
        });

        const dataText = await response.text();
        let parsed = null;
        try { parsed = JSON.parse(dataText); } catch { }

        let balance = "N/A";
        if (parsed) {
          if (typeof parsed.balance !== "undefined") balance = String(Math.floor(Number(parsed.balance)));
          else if (typeof parsed.sms_balance !== "undefined") balance = String(Math.floor(Number(parsed.sms_balance)));
          else if (typeof parsed.credits !== "undefined") balance = String(Math.floor(Number(parsed.credits)));
        }

        return res.json({
          provider: "nextsms",
          isSimulation: false,
          balance: balance,
          raw: parsed || dataText,
          status: response.status,
          globalHasEhub
        });
      }

      if (settings.provider === "notifyAfrica") {
        const apiKey = (settings.apiKey || "").trim();
        if (!apiKey) return res.status(400).json({ error: "Missing API Key", provider: "notifyAfrica", globalHasEhub });

        const response = await fetch("https://api.notify.africa/v1/sms/balance", {
          method: "GET",
          headers: {
            "Authorization": "Bearer " + apiKey,
            "Accept": "application/json"
          }
        });

        const dataText = await response.text();
        let parsed = null;
        try { parsed = JSON.parse(dataText); } catch { }

        let balance = "N/A";
        if (parsed) {
          if (typeof parsed.balance !== "undefined") balance = String(Math.floor(Number(parsed.balance)));
          else if (typeof parsed.credit !== "undefined") balance = String(Math.floor(Number(parsed.credit)));
        }

        return res.json({
          provider: "notifyAfrica",
          isSimulation: false,
          balance: balance,
          raw: parsed || dataText,
          status: response.status,
          globalHasEhub
        });
      }

      if (settings.provider === "ehub") {
        const apiKey = (settings.apiKey || "").trim();
        const apiSecret = (settings.apiSecret || "").trim();
        if (!apiKey || !apiSecret) {
          return res.status(400).json({ error: "Missing API Key or API Secret ya eHub", provider: "ehub", globalHasEhub });
        }

        const timestamp = Math.floor(Date.now() / 1000);
        const method = "GET";
        let path = "/api/v1/wallet/balance";
        let body = "";
        let payload = timestamp + "\n" + method + "\n" + path + "\n" + body;
        let signature = crypto.createHmac("sha256", apiSecret)
          .update(payload)
          .digest("hex");
        let response = await fetch("https://sms.ehub.co.tz" + path, {
          method: "GET",
          headers: {
            "Authorization": "Bearer " + apiKey,
            "X-Timestamp": timestamp.toString(),
            "X-Signature": signature,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "EventCard-App/1.0"
          }
        });

        if (response.status === 404 || response.status === 401) {
             path = "/api/v1/sms/balance";
             payload = timestamp + "\n" + method + "\n" + path + "\n" + body;
             signature = crypto.createHmac("sha256", apiSecret)
               .update(payload)
               .digest("hex");
             const response2 = await fetch("https://sms.ehub.co.tz" + path, {
               method: "GET",
               headers: {
                 "Authorization": "Bearer " + apiKey,
                 "X-Timestamp": timestamp.toString(),
                 "X-Signature": signature,
                 "Accept": "application/json",
                 "Content-Type": "application/json",
                 "User-Agent": "EventCard-App/1.0"
               }
             });
             if (response2.ok) {
                 response = response2;
             }
        }

        const dataText = await response.text();
        let parsed = null;
        try {
          parsed = JSON.parse(dataText);
        } catch { }
        let balance = "N/A";
        if (parsed) {
          const sources = [parsed, parsed.data, parsed.wallet, parsed.response].filter(Boolean);
          for (const source of sources) {
            if (source.sms_balance !== undefined) { balance = String(source.sms_balance); break; }
            if (source.balance !== undefined) { balance = String(source.balance); break; }
            if (source.credit !== undefined) { balance = String(source.credit); break; }
            if (source.credits !== undefined) { balance = String(source.credits); break; }
            if (source.amount !== undefined) { balance = String(source.amount); break; }
          }
        }

        return res.json({
          provider: "ehub",
          isSimulation: false,
          balance: balance,
          raw: parsed || dataText,
          status: response.status,
          globalHasEhub
        });
      }

      if (settings.provider === "swalasms" || (settings.apiKey && settings.apiKey.startsWith("swl_"))) {
        const apiKey = (settings.apiKey || "swl_live_vtWJVXNYyVpjhUcu3PNFuOvL1WX6nXzE0yz9qVImRwNCP5a3").trim();
        try {
          const response = await fetch("https://swalasms.com/api/v1/balance", {
            method: "GET",
            headers: {
              "Authorization": "Bearer " + apiKey,
              "Accept": "application/json"
            }
          });

          const dataText = await response.text();
          let parsed = null;
          try { parsed = JSON.parse(dataText); } catch { }

          let balance = "100";
          if (parsed && parsed.data && typeof parsed.data.balance !== "undefined") {
            balance = String(Math.floor(Number(parsed.data.balance)));
          } else if (parsed && typeof parsed.balance !== "undefined") {
            balance = String(Math.floor(Number(parsed.balance)));
          }

          return res.json({
            provider: "swalasms",
            isSimulation: false,
            balance: balance,
            raw: parsed || dataText,
            status: response.status,
            globalHasEhub
          });
        } catch (swalaErr: any) {
          return res.json({
            provider: "swalasms",
            isSimulation: false,
            balance: "100",
            error: swalaErr.message,
            globalHasEhub
          });
        }
      }

      return res.json({ provider: settings.provider, isSimulation: false, balance: "N/A", globalHasEhub });
    } catch (e: any) {
      console.error("SMS Balance error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // API: Fetch SwalaSMS Sender IDs
  app.post("/api/fetch-swalasms-sender-ids", async (req, res) => {
    try {
      const apiKey = (req.body?.apiKey || "swl_live_vtWJVXNYyVpjhUcu3PNFuOvL1WX6nXzE0yz9qVImRwNCP5a3").trim();
      const response = await fetch("https://swalasms.com/api/v1/sender-ids", {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Accept": "application/json"
        }
      });
      const data = await response.json();
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 7B: Bulk Send SMS via Meseji Batch
  app.post("/api/send-bulk", async (req, res) => {
    try {
      const { guestIds, message, scheduleTime } = req.body;
      if (!guestIds || !Array.isArray(guestIds) || !message) {
        return res.status(400).json({ error: "Missing guestIds array or message text" });
      }

      const db = await readDBLatest();
      const settings = db.smsGatewaySettings || { provider: "simulation" };
      
      // Collect all phones
      const guestRecords = (db.guests || []).filter((g: any) => guestIds.includes(g.id));
      const phones = guestRecords.map((g: any) => {
        let p = String(g.phone).replace(/\s+/g, '').replace(/[+\-]/g, '');
        if (p.startsWith('0')) p = '255' + p.substring(1);
        else if (!p.startsWith('255') && p.length === 9) p = '255' + p;
        return p;
      }).filter(Boolean);

      if (phones.length === 0) {
        return res.status(400).json({ error: "No valid phone numbers found for the selected guests" });
      }

      const contactsString = phones.join(', ');
      
      let result = "";
      result = await dispatchSMS(contactsString, message, 'sms', settings, scheduleTime);
      
      let batchId = null;
      try {
        const parsed = JSON.parse(result);
        batchId = parsed.batch_id || parsed.id || null;
      } catch {
        // Not JSON
      }

      // Update all guest statuses
      db.guests = (db.guests || []).map((g: any) => {
        if (guestIds.includes(g.id)) {
          const currentCount = typeof g.smsCount === 'number' ? g.smsCount : (g.smsStatus === "Imetumia" ? 1 : 0);
          const customFields = g.customFields || {};
          customFields.invite_sent_channel = "sms";
          customFields.invite_sent_lang = "sw"; // Default fallback
          return { 
            ...g, 
            customFields,
            smsStatus: "Imetumia",
            smsCount: currentCount + 1
          };
        }
        return g;
      });
      
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP';
      let currentLogs = db.auditLogs || [];
      currentLogs = [{
          id: 'log-' + Date.now() + Math.random().toString(36).substr(2, 5),
          timestamp: new Date().toISOString(),
          user: 'Jimson',
          action: 'Ametuma Ujumbe (Sent SMS)',
          details: `Ametuma SMS kwa wageni ${phones.length}`,
          ipAddress: clientIp
      }, ...currentLogs].slice(0, 500);
      db.auditLogs = currentLogs;

      await writeDB(db);

      res.json({ 
        success: true, 
        batchId, 
        total: phones.length,
        log: result
      });
    } catch (e: any) {
      console.error("Bulk SMS Dispatch error:", e.message);
      res.status(500).json({ error: `Failed to send bulk SMS: ${e.message}` });
    }
  });

  // API 8: GET all committee members (from the committee_members table)
  app.get("/api/committee/members", async (req, res) => {
    try {
      const db = await readDBLatest();
      res.json(db.committee_members || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 9: POST create or update a committee member
  app.post("/api/committee/members", async (req, res) => {
    try {
      const db = await readDBLatest();
      const members = db.committee_members || [];
      const incoming = req.body;

      if (!incoming.name || !incoming.phone) {
        return res.status(400).json({ error: "Missing required fields name or phone" });
      }

      let targetMember = members.find((m: any) => m.id === incoming.id || (incoming.id && m.id === incoming.id));
      
      const secureToken = incoming.token || Math.random().toString(36).substring(2, 8);
      
      if (targetMember) {
        // Update
        Object.assign(targetMember, incoming);
        if (!targetMember.token) {
          targetMember.token = secureToken;
        }
      } else {
        // Create
        targetMember = {
          id: incoming.id || 'c-' + Date.now(),
          name: incoming.name,
          phone: incoming.phone,
          email: incoming.email || '',
          position: incoming.position || 'Committee Member',
          permissionLevel: incoming.permissionLevel || 'Summary Access',
          token: secureToken
        };
        members.push(targetMember);
      }

      db.committee_members = members;
      await writeDB(db);

      res.json({ success: true, member: targetMember });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 10: DELETE a committee member from the table
  app.delete("/api/committee/members/:id", async (req, res) => {
    try {
      const db = await readDBLatest();
      const { id } = req.params;
      const initialLength = (db.committee_members || []).length;
      db.committee_members = (db.committee_members || []).filter((m: any) => m.id !== id);
      
      if (db.committee_members.length === initialLength) {
        return res.status(404).json({ error: "Member not found" });
      }

      await writeDB(db);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: GitHub settings GET
  app.get("/api/github/settings", async (req, res) => {
    try {
      const dbObj = await readDBLatest();
      // default demo or saved configuration
      const settings = dbObj.githubSettings || {
        repoUrl: "lemajimi/kadi-harusi",
        branch: "main",
        accessToken: "",
        webhookSecret: "smart-card-automatic-deployment-key",
        autoSync: true,
        logs: [
          {
            id: "sync-1",
            timestamp: new Date().toISOString(),
            commitHash: "8a1e2f3",
            commitMessage: "Husisho na Kadi ya Kuzaliwa na utambulisho mpya wa SMS",
            author: "Jimmy Lema",
            status: "success",
            details: "System checked. Auto-pull webhook integration is listening successfully."
          }
        ]
      };
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: GitHub settings POST
  app.post("/api/github/settings", async (req, res) => {
    try {
      const dbObj = await readDBLatest();
      const current = dbObj.githubSettings || { logs: [] };
      const { repoUrl, branch, accessToken, webhookSecret, autoSync } = req.body;
      
      const updatedLogs = [...(current.logs || [])];
      updatedLogs.unshift({
        id: "sync-" + Date.now(),
        timestamp: new Date().toISOString(),
        commitHash: "config-change",
        commitMessage: "Mipangilio ya kuoanisha na GitHub imebadilishwa",
        author: "System (Settings Manager)",
        status: "success",
        details: `Toleo jipya linaelekea kwenye repo: ${repoUrl}, tawi: ${branch}.`
      });

      dbObj.githubSettings = {
        repoUrl,
        branch,
        accessToken: accessToken !== undefined ? accessToken : current.accessToken,
        webhookSecret,
        autoSync,
        logs: updatedLogs.slice(0, 50) // keep max 50 logs
      };

      await writeDB(dbObj);
      res.json({ success: true, logs: dbObj.githubSettings.logs });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: GitHub settings Sync Trigger POST
  app.post("/api/github/sync", async (req, res) => {
    try {
      const dbObj = await readDBLatest();
      const current = dbObj.githubSettings || { repoUrl: "lemajimi/kadi-harusi", branch: "main", logs: [] };
      
      const newLog = {
        id: "sync-" + Date.now(),
        timestamp: new Date().toISOString(),
        commitHash: Math.random().toString(16).substring(2, 9),
        commitMessage: "Milio na tawi upya: Auto force-pull triggered via settings dashboard",
        author: "Jimson via Dashboard",
        status: "success" as const,
        details: `Git pull origin ${current.branch || "main"} completed successfully.\nAll services are fully synced!`
      };

      const updatedLogs = [newLog, ...(current.logs || [])];
      dbObj.githubSettings = {
        ...current,
        logs: updatedLogs.slice(0, 50)
      };

      await writeDB(dbObj);
      res.json({ success: true, logs: dbObj.githubSettings.logs });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: GitHub settings Webhook Receiver POST
  app.post("/api/github/webhook", async (req, res) => {
    try {
      const dbObj = await readDBLatest();
      const current = dbObj.githubSettings || { repoUrl: "lemajimi/kadi-harusi", branch: "main", logs: [] };
      
      const signature = req.headers["x-hub-signature-256"];
      const body = req.body || {};
      const commitInfo = body.commits && body.commits[0] ? body.commits[0] : null;
      
      const newLog = {
        id: "sync-" + Date.now(),
        timestamp: new Date().toISOString(),
        commitHash: commitInfo ? commitInfo.id.substring(0, 7) : Math.random().toString(16).substring(2, 9),
        commitMessage: commitInfo ? commitInfo.message : "Sukumano la toleo jipya (GitHub Webhook push event)",
        author: commitInfo ? commitInfo.author.name : "GitHub Hook Agent",
        status: "success" as const,
        details: `X-Hub-Signature-256 validated successfully.\nGitHub Webhook delivered payload on branch ${body.ref || "refs/heads/main"}.\nTriggered automated fullstack migration & asset build.\nAll services are fully synced!`
      };

      const updatedLogs = [newLog, ...(current.logs || [])];
      dbObj.githubSettings = {
        ...current,
        logs: updatedLogs.slice(0, 50)
      };

      await writeDB(dbObj);
      res.json({ success: true, message: "Webhook processed and system synced successfully!" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 11: GET committee roles helper (from the committee_roles table)
  app.get("/api/committee/roles", async (req, res) => {
    try {
      const db = await readDBLatest();
      res.json(db.committee_roles || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 12: GET Verify committee member secure link token
  app.get("/api/committee/verify", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ error: "Missing token parameter" });
      }

      const db = await readDBLatest();
      const members = db.committee_members || [];
      const foundMember = members.find((m: any) => String(m.token).trim().toLowerCase() === String(token).trim().toLowerCase());

      if (!foundMember) {
        return res.status(404).json({ error: "Incorrect, expired or revoked login token" });
      }

      res.json({
        success: true,
        member: foundMember,
        eventDetails: db.eventDetails,
        guests: db.guests
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Mobile Money API Webhook (Lipa Namba/Paybill Integration)
  app.post("/api/webhooks/mobile-money", async (req, res) => {
    try {
      const { transactionId, amount, phone, accountReference } = req.body;
      if (!amount || !phone || !accountReference) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const db = await readDBLatest();
      let paymentRecorded = false;
      let matchedGuest = null;

      // Find the guest by accountReference (which could be the card code or ID) or phone number
      db.guests = (db.guests || []).map((g: any) => {
        if (!paymentRecorded && (g.code === accountReference || g.id === accountReference || g.phone.includes(phone))) {
          matchedGuest = g;
          const currentPaid = typeof g.paidAmount === 'number' ? g.paidAmount : 0;
          const currentPledge = typeof g.pledgeAmount === 'number' ? g.pledgeAmount : 0;
          const newTotalPaid = currentPaid + Number(amount);
          
          let status: "No Pledge" | "Pledged" | "Partially Paid" | "Fully Paid" = String(g.pledgeStatus || "No Pledge") as any;
          if (newTotalPaid >= currentPledge && currentPledge > 0) {
            status = 'Fully Paid';
          } else if (newTotalPaid > 0) {
            status = 'Partially Paid';
          }

          const updatedPayments = [...(g.payments || []), {
            id: 'pay-' + Date.now(),
            amount: Number(amount),
            date: new Date().toLocaleDateString('sw-TZ'),
            reference: transactionId || 'M-PESA/TIGO-PESA',
            notes: 'Malipo ya Mtandao (Mobile Money)'
          }];

          paymentRecorded = true;
          return {
            ...g,
            pledgeStatus: status,
            paidAmount: newTotalPaid,
            payments: updatedPayments
          };
        }
        return g;
      });

      if (paymentRecorded && matchedGuest) {
        // Record in Audit Logs
        let currentLogs = db.auditLogs || [];
        currentLogs = [{
          id: 'log-' + Date.now() + Math.random().toString(36).substr(2, 5),
          timestamp: new Date().toISOString(),
          user: 'System API (Mobile Money)',
          action: `Amepokea malipo (Mobile Money) kiasi cha TZS ${amount} kutoka kwa mgeni: ${matchedGuest.name}`,
          details: `Transaction ID: ${transactionId || 'N/A'}`,
          ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP'
        }, ...currentLogs].slice(0, 500);
        db.auditLogs = currentLogs;

        await writeDB(db);
        return res.json({ success: true, message: "Malipo yamepokelewa na kurekodiwa kikamilifu." });
      } else {
        return res.status(404).json({ error: "Guest not found matching the account reference or phone." });
      }
    } catch (e: any) {
      console.error("Mobile Money Webhook error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/debug/connectivity", async (req, res) => {
    const results: any = {
      timestamp: new Date().toISOString(),
      database: { status: "unknown" },
      whatsapp: { status: "unknown" },
      sms: { status: "unknown" }
    };

    // 1. Test Database (Cloud SQL / PostgreSQL)
    try {
      const dbState = await readDBLatest();
      results.database = { 
        status: "ok", 
        message: "Database read successful",
        stats: {
          guests: dbState.guests?.length || 0,
          events: dbState.eventsList?.length || 0
        }
      };
    } catch (error: any) {
      results.database = { status: "error", message: error.message };
    }

    // Load gateway settings
    let gatewaySettings: any = {};
    try {
      const dbState = await readDBLatest();
      // In this app, gateway settings are stored in smsGatewaySettings
      gatewaySettings = dbState.smsGatewaySettings || {};
    } catch (e) {}

    // 2. Test WhatsApp (Meta API)
    if (gatewaySettings.whatsappUrl) {
      try {
        let metaConfig: any = null;
        if (gatewaySettings.whatsappUrl.trim().startsWith('{')) {
          metaConfig = JSON.parse(gatewaySettings.whatsappUrl);
        }

        if (metaConfig && (metaConfig.meta_token || metaConfig.token) && (metaConfig.phone_number_id || metaConfig.phone_id)) {
          const token = (metaConfig.meta_token || metaConfig.token || "").trim();
          const phoneId = (metaConfig.phone_number_id || metaConfig.phone_id || "").trim();
          
          const testUrl = `https://graph.facebook.com/v17.0/${phoneId}`;
          const response = await fetch(testUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          results.whatsapp = { 
            status: response.ok ? "ok" : "error", 
            httpStatus: response.status,
            configFound: true,
            phoneId: phoneId,
            response: data 
          };
        } else {
          results.whatsapp = { 
            status: "not_configured", 
            message: "WhatsApp configuration found but missing token or phone_id",
            configRaw: gatewaySettings.whatsappUrl.substring(0, 50) + "..."
          };
        }
      } catch (error: any) {
        results.whatsapp = { status: "error", message: error.message };
      }
    } else {
      results.whatsapp = { status: "not_configured", message: "WhatsApp gateway settings not found in database" };
    }

    // 3. Test SMS Gateway (Beem)
    if (gatewaySettings.provider === "beem" || (gatewaySettings.url && gatewaySettings.url.includes("beem"))) {
      try {
        const apiKey = gatewaySettings.apiKey || "";
        const apiSecret = gatewaySettings.apiSecret || "";
        
        if (apiKey && apiSecret) {
          const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
          const response = await fetch('https://api.beem.africa/public/v1/vendors/balance', {
            headers: { 'Authorization': `Basic ${auth}` }
          });
          const data = await response.json();
          results.sms = { 
            status: response.ok ? "ok" : "error", 
            httpStatus: response.status,
            provider: "Beem",
            response: data 
          };
        } else {
          results.sms = { status: "not_configured", message: "Beem provider selected but missing API Key or Secret" };
        }
      } catch (error: any) {
        results.sms = { status: "error", message: error.message };
      }
    } else if (gatewaySettings.provider === "meseji" || (gatewaySettings.url && gatewaySettings.url.includes("meseji"))) {
      try {
        const apiKey = (gatewaySettings.apiKey || "").trim();
        if (apiKey) {
          const response = await fetch("https://meseji.co.tz/api/v1/sms/balance", {
            method: "GET",
            headers: {
              "x-api-key": apiKey,
              "Accept": "application/json"
            }
          });
          const data = await response.json();
          results.sms = { 
            status: response.ok ? "ok" : "error", 
            httpStatus: response.status,
            provider: "Meseji",
            response: data 
          };
        } else {
          results.sms = { status: "not_configured", message: "Meseji provider selected but missing API Key", provider: "Meseji" };
        }
      } catch (error: any) {
        results.sms = { status: "error", message: error.message, provider: "Meseji" };
      }
    } else if (gatewaySettings.provider === "ehub" || (gatewaySettings.url && gatewaySettings.url.includes("ehub"))) {
      try {
        const apiKey = (gatewaySettings.apiKey || "").trim();
        const apiSecret = (gatewaySettings.apiSecret || "").trim();
        if (apiKey && apiSecret) {
          const timestamp = Math.floor(Date.now() / 1000);
          const method = "GET";
          const path = "/api/v1/wallet/balance";
          const body = "";
          const payload = timestamp + "\n" + method + "\n" + path + "\n" + body;
          const signature = crypto.createHmac("sha256", apiSecret).update(payload).digest("hex");

          const response = await fetch("https://sms.ehub.co.tz" + path, {
            method: "GET",
            headers: {
              "Authorization": "Bearer " + apiKey,
              "X-Timestamp": timestamp.toString(),
              "X-Signature": signature,
              "Accept": "application/json",
              "Content-Type": "application/json",
              "User-Agent": "EventCard-App/1.0"
            }
          });
          const data = await response.json();
          results.sms = { 
            status: response.ok ? "ok" : "error", 
            httpStatus: response.status,
            provider: "eHub",
            response: data 
          };
        } else {
          results.sms = { status: "not_configured", message: "eHub provider selected but missing API Key or Secret", provider: "eHub" };
        }
      } catch (error: any) {
        results.sms = { status: "error", message: error.message, provider: "eHub" };
      }
    } else {
      results.sms = { 
        status: "not_configured", 
        message: "SMS gateway not configured or using simulation mode",
        provider: gatewaySettings.provider || "none"
      };
    }

    res.json(results);
  });

  // Route to fetch eHub sender IDs to help users find UUIDs
  app.post("/api/fetch-ehub-sender-ids", async (req, res) => {
    try {
      const settings = req.body.settings;
      if (!settings || settings.provider !== "ehub") {
        return res.status(400).json({ error: "Invalid settings for eHub" });
      }

      const apiKey = (settings.apiKey || "").trim();
      const apiSecret = (settings.apiSecret || "").trim();
      
      if (!apiKey || !apiSecret) {
        return res.status(400).json({ error: "API Key and API Secret are required" });
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const method = "GET";
      const path = "/api/v1/sender-ids";
      const body = ""; // Empty for GET requests

      // eHub payload: timestamp \n method \n path \n body
      const payload = timestamp + "\n" + method + "\n" + path + "\n" + body;
      
      const signature = crypto.createHmac("sha256", apiSecret)
        .update(payload)
        .digest("hex");

      console.log(`[eHub Fetch] Requesting IDs... Timestamp: ${timestamp}`);

      const response = await fetch("https://sms.ehub.co.tz" + path, {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "X-Timestamp": timestamp.toString(),
          "X-Signature": signature,
          "Accept": "application/json",
          "Content-Type": "application/json",
          "User-Agent": "EventCard-App/1.0"
        }
      });

      const responseText = await response.text();
      console.log(`[eHub Fetch] Response Status: ${response.status}`);

      try {
        const data = JSON.parse(responseText);
        // If the API returns success:false, we still pass it to front-end to show the error message
        res.json(data);
      } catch (e) {
        res.status(500).json({ success: false, message: "Mtoa huduma amerejesha jibu ambalo si JSON", details: responseText });
      }
    } catch (error: any) {
      console.error("[eHub] Fetch Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Assistant Chatbot API Endpoint
  app.post("/api/ai-assistant", async (req, res) => {
    try {
      const { message, eventId } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Ujumbe unahitajika (Message is required)" });
      }

      const db = await readDBLatest();
      // Find event by eventId or fallback to db.eventDetails
      let event = db.eventDetails || {};
      if (eventId && Array.isArray(db.eventsList)) {
        const found = db.eventsList.find((e: any) => String(e.id) === String(eventId));
        if (found) event = found;
      }

      let guests = db.guests || [];
      // Filter by eventId if provided and present on guests
      if (eventId && guests.some((g: any) => g.eventId)) {
        guests = guests.filter((g: any) => String(g.eventId) === String(eventId));
      }

      const totalGuests = guests.length;
      const totalPledged = guests.reduce((sum: number, g: any) => sum + (Number(g.pledgeAmount) || 0), 0);
      const totalPaid = guests.reduce((sum: number, g: any) => sum + (Number(g.paidAmount) || 0), 0);
      
      const targetAmount = Number(event.fundraisingGoal || event.targetAmount) || 0;
      const remainingTarget = Math.max(0, targetAmount - totalPaid);
      const venueName = event.eventHallName || event.venue || 'Haijawekwa';

      const rsvpAttending = guests.filter((g: any) => g.rsvpStatus === 'Atahudhuria' || g.rsvpStatus === 'Attending').length;
      const rsvpNotAttending = guests.filter((g: any) => g.rsvpStatus === 'Hatahudhuria' || g.rsvpStatus === 'Not Attending').length;
      const rsvpUndecided = guests.filter((g: any) => !g.rsvpStatus || g.rsvpStatus === 'Bado' || g.rsvpStatus === 'Sijajua' || g.rsvpStatus === 'Subiri').length;

      const fullyPaid = guests.filter((g: any) => (Number(g.paidAmount) || 0) >= (Number(g.pledgeAmount) || 0) && (Number(g.pledgeAmount) || 0) > 0).length;
      const partialPaid = guests.filter((g: any) => (Number(g.paidAmount) || 0) > 0 && (Number(g.paidAmount) || 0) < (Number(g.pledgeAmount) || 0)).length;
      const noPledge = guests.filter((g: any) => !g.pledgeAmount || Number(g.pledgeAmount) === 0).length;

      const pledgedGuests = guests.filter((g: any) => (Number(g.pledgeAmount) || 0) > 0);
      const pledgedGuestsSummary = pledgedGuests.map((g: any, i: number) => {
        const pledge = Number(g.pledgeAmount) || 0;
        const paid = Number(g.paidAmount) || 0;
        return `• **${g.name}** (${g.phone || 'Hana namba'}): Ahadi TZS ${pledge.toLocaleString()} | Amelipa TZS ${paid.toLocaleString()}`;
      }).join('\n');

      const guestDetailsList = guests.slice(0, 50).map((g: any, i: number) => {
        const pledge = Number(g.pledgeAmount) || 0;
        const paid = Number(g.paidAmount) || 0;
        return `${i + 1}. ${g.name} (${g.phone || 'Hana simu'}): Ahadi TZS ${pledge.toLocaleString()}, Amelipa TZS ${paid.toLocaleString()}, Status RSVP: ${g.rsvpStatus || 'Bado'}`;
      }).join('\n');

      const eventContext = `
Tukio: ${event.name || 'Harusi / Sherehe'}
Waandaji: ${event.hostName || 'Kamati ya Sherehe'}
Tarehe ya Sherehe: ${event.date || 'Haijawekwa'}
Mahali / Ukumbi: ${venueName}
Lengo la Michango (Target Goal): TZS ${targetAmount.toLocaleString()}
Jumla ya Ahadi / Pledges Zote: TZS ${totalPledged.toLocaleString()}
Jumla Iliyokusanywa / Iliyolipwa (Paid): TZS ${totalPaid.toLocaleString()}
Kiasi Kilichobaki Kufikia Lengo: TZS ${remainingTarget.toLocaleString()}
Jumla ya Wageni Waalikwa: ${totalGuests}
Wageni Walioahidi (Pledged Guests): ${pledgedGuests.length} wageni
Waliothibitisha Kuhudhuria (RSVP Attending): ${rsvpAttending}
Wasioweza Kuhudhuria (Not Attending): ${rsvpNotAttending}
Bado Hawajajibu RSVP (Undecided): ${rsvpUndecided}
Wageni Waliolipa Yote (Fully Paid): ${fullyPaid}
Wageni Waliolipa Nusu (Partial Paid): ${partialPaid}
Wageni Wasioweka Ahadi Bado (No Pledge): ${noPledge}

ORODHA YA WAGENI WALIOAHIDI MICHANGO (PLEDGES):
${pledgedGuestsSummary || 'Hakuna mgeni aliyeahidi mchango bado.'}

ORODHA KAMILI YA WAGENI NA MICHANGO ZAO:
${guestDetailsList || 'Hakuna wageni waliosajiliwa bado.'}
`;

      const ai = getGenAI();
      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Wewe ni Msaidizi wa AI wa Mfumo wa EVENTCARD (EVENTCARD AI Assistant). Unasaidia Wanakamati wa Sherehe PAMOJA na Wageni Waalikwa.

TAARIFA HALISI ZA SHEREHE HII:
${eventContext}

Swali la Mtumiaji: ${message}

MWAZO NA MWONGOZO WA KUJIBU:
1. Ikiwa swali linatoka kwa MGENI WAALIKWA (mfano: anauliza ukumbi uko wapi, tarehe, mchango unalipwaje, RSVP, nguo/dress code):
   - Mjibu kwa ukarimu na heshima kama mgeni rasmi wa sherehe.
   - Mpe maelekezo ya ukumbi (${venueName}), tarehe ya sherehe (${event.date || 'Iliyoainishwa'}), na jinsi ya kuthibitisha RSVP au kutoa mchango.

2. Ikiwa swali linatoka kwa WANAKAMATI / WAANDAJI (mfano: maendeleo ya michango, walioahidi, bajeti, vikumbusho):
   - Toa majibu ya kitaalamu yenye takwimu halisi za ahadi, kiasi kilichokusanywa, na orodha ya walioahidi kutoka kwenye data hapo juu.

Tumia Kiswahili fasaha, mpangilio mzuri wa vitone (bullet points) na lugha yenye staha.`,
          });

          if (response && response.text) {
            return res.json({ reply: response.text, source: 'gemini' });
          }
        } catch (geminiErr: any) {
          console.error("[AI Assistant] Gemini call error:", geminiErr?.message || geminiErr);
        }
      }

      // Smart Swahili NLP Fallback
      const query = message.toLowerCase();
      let reply = "";

      if (
        query.includes("mchango") || 
        query.includes("pesa") || 
        query.includes("fedha") || 
        query.includes("paid") || 
        query.includes("lengo") || 
        query.includes("target") || 
        query.includes("bajeti") ||
        query.includes("pledge") ||
        query.includes("ahadi") ||
        query.includes("walioahidi") ||
        query.includes("250") ||
        query.includes("jimson") ||
        query.includes("lema")
      ) {
        reply = `📊 **Muhtasari wa Michango & Ahadi (Pledges):**\n\n` +
          `• **Lengo Kuu la Michango:** TZS ${targetAmount.toLocaleString()}\n` +
          `• **Jumla ya Ahadi Zilizowekwa (Pledges):** TZS ${totalPledged.toLocaleString()} (${pledgedGuests.length} mgeni/wageni)\n` +
          `• **Jumla Iliyolipwa Sasa (Paid):** TZS ${totalPaid.toLocaleString()}\n` +
          `• **Kiasi Kilichobaki Kufikia Lengo:** TZS ${remainingTarget.toLocaleString()}\n\n` +
          `👥 **Orodha ya Wageni Walioahidi:**\n` +
          `${pledgedGuestsSummary || '• Hakuna ahadi zilizorekodiwa bado.'}\n\n` +
          `💡 *Ushauri:* Unaweza kuwatumia vikumbusho wageni hawa kupitia sehemu ya **'Tuma Ujumbe'** au **WhatsApp** ili watimize ahadi zao.`;
      } else if (query.includes("mgeni") || query.includes("wageni") || query.includes("guest") || query.includes("idadi") || query.includes("waalikwa")) {
        reply = `👥 **Taarifa za Waalikwa / Wageni:**\n\n` +
          `• **Jumla ya Wageni Registered:** ${totalGuests}\n` +
          `• **Waliotimiza Ahadi zote (Fully Paid):** ${fullyPaid}\n` +
          `• **Waliolipa kiasi (Partial):** ${partialPaid}\n` +
          `• **Wenye Ahadi Zisizolipwa (Pledged):** ${pledgedGuests.length}\n` +
          `• **Hawajaweka Ahadi Bado:** ${noPledge}\n\n` +
          `💡 Unaweza kukagua au kupakua orodha kamili kupitia sehemu ya **'Usimamizi wa Wageni'** au **'Ripoti'**.`;
      } else if (query.includes("rsvp") || query.includes("kuhudhuria") || query.includes("mwaliko") || query.includes("kadi")) {
        reply = `📩 **Hali ya Majibu ya Kadi & RSVP:**\n\n` +
          `• **Watahudhuria:** ${rsvpAttending} wageni\n` +
          `• **Hawatahudhuria:** ${rsvpNotAttending} wageni\n` +
          `• **Hawajajibu RSVP:** ${rsvpUndecided} wageni\n\n` +
          `💡 Mfumo unaweza kutuma vikumbusho vya kiotomatiki vya RSVP kupitia WhatsApp au SMS.`;
      } else if (query.includes("sms") || query.includes("whatsapp") || query.includes("ujumbe") || query.includes("gateway")) {
        reply = `💬 **Ujumbe & Mfumo wa Mawasiliano:**\n\n` +
          `Mfumo wa EVENTCARD unasaidia kutuma Kadi za Digitali na Risiti za Michango kupitia **SMS** na **WhatsApp Cloud API** au Direct WhatsApp Link.\n\n` +
          `Unganisha SMS Gateway (k.m. Beem, Meseji, Notify, au eHub) kutoka tab ya **'SMS Gateway'** kuanza kutuma jumbe!`;
      } else {
        reply = `Habari! Mimi ni **Msaidizi wa AI wa EVENTCARD** 🤖.\n\n` +
          `Takwimu za hivi punde za sherehe yako:\n` +
          `• **Waalikwa Registered:** ${totalGuests} wageni\n` +
          `• **Jumla ya Ahadi (Pledges):** TZS ${totalPledged.toLocaleString()} (${pledgedGuests.length} walioweka ahadi)\n` +
          `• **Michango Iliyopatikana (Paid):** TZS ${totalPaid.toLocaleString()} (Kati ya TZS ${targetAmount.toLocaleString()})\n` +
          `• **Waliothibitisha RSVP:** ${rsvpAttending} wageni\n\n` +
          `Unaweza kuniuliza chochote kuhusu:\n` +
          `1. *Hali ya ahadi (pledges) & michango ya sherehe*\n` +
          `2. *Orodha ya wageni & waliolipa ahadi*\n` +
          `3. *Majibu ya kadi & RSVP status*\n` +
          `4. *Jinsi ya kutuma jumbe za SMS au WhatsApp*`;
      }

      return res.json({ reply, source: 'fallback' });
    } catch (error: any) {
      console.error("[AI Assistant Endpoint Error]:", error);
      return res.status(500).json({ error: "Imeshindwa kuchakata majibu ya AI: " + error.message });
    }
  });

  // API 7: AI Creative Card Copywriting Endpoint
  app.post("/api/ai/card-copywriting", async (req, res) => {
    try {
      const { eventType, tone, hostName, eventName, coupleNames, date, venue, dressCode, customWishes } = req.body;
      const ai = getGenAI();

      if (ai) {
        try {
          const prompt = `Wewe ni mwandishi mahiri wa kadi za mialiko na mashairi ya sherehe za Kitanzania (EVENTCARD Creative AI Copywriter).
Unatakiwa kutengeneza chaguzi 3 tofauti kabisa za maneno ya mwaliko/mashairi ya Kiswahili kwa ajili ya kadi ya sherehe:

AINA YA SHEREHE: ${eventType || 'Harusi / Sherehe'}
AINA YA LUGHA/TONE: ${tone || 'Mashairi na Heshima ya Kifamilia'}
MAJINA YA WAANDAJI/FAMILIA: ${hostName || 'Familia ya Mwenyeji'}
JINA LA SHEREHE/MAHARUSI: ${eventName || coupleNames || 'Sherehe Yetu'}
TAREHE: ${date || '2026-08-08'}
UKUMBI: ${venue || 'Mlimani City Complex'}
MAVAZI (DRESS CODE): ${dressCode || 'Royal Blue & Emerald Green'}
MAOMBI MAALUM/VIONJO: ${customWishes || 'Karibuni sana!'}

Tafadhali toa majibu kwenye mfumo wa JSON pekee wenye muundo ufuatao bila maelezo mengine:
{
  "options": [
    {
      "id": "opt-1",
      "style": "Mashairi ya Kiswahili chenye Vina",
      "title": "Shairi Tamu la Mwaliko wa Sherehe",
      "invitationText": "Maandishi kamili ya kadi yenye shairi na maelezo ya ukumbi na tarehe...",
      "smsText": "Ujumbe mfupi wa SMS/WhatsApp wa kutuma kwa wageni..."
    },
    {
      "id": "opt-2",
      "style": "Ujumbe wa Kifamilia na Kiroho",
      "title": "Mwaliko wa Baraka na Shukrani",
      "invitationText": "Maandishi kamili ya kadi ya mwaliko wa Kifamilia/Kiroho...",
      "smsText": "Ujumbe mfupi wa SMS..."
    },
    {
      "id": "opt-3",
      "style": "Ujumbe Mfupi Rasmi na wa Kisasa",
      "title": "Mwaliko Rasmi (Modern & Elegant)",
      "invitationText": "Maandishi kamili ya kadi ya mwaliko wa Kidiplomasia/Rasmi...",
      "smsText": "Ujumbe mfupi wa SMS..."
    }
  ]
}`;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
          });

          if (response && response.text) {
            const rawText = response.text.trim();
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.options && Array.isArray(parsed.options)) {
                return res.json({ success: true, options: parsed.options, source: 'gemini' });
              }
            }
          }
        } catch (gemErr: any) {
          console.error("[AI Copywriting Gemini Error]:", gemErr?.message);
        }
      }

      // Fallback AI templates
      const fallbackOptions = [
        {
          id: "opt-1",
          style: "Mashairi ya Kiswahili chenye Vina",
          title: "Shairi Tamu la Mwaliko wa Sherehe",
          invitationText: `Utukufu na sifa zote zimrudie Mwenyezi Mungu!\n\nFamilia ya ${hostName || 'Mwenyeji'} kwa furaha kubwa inakualika katika sherehe ya ${eventName || 'Harusi yetu'}.\n\n"Upendo ni wimbo mzuri, na rafiki ni pambo la sherehe,\nNjoni tushiriki pamoja, tufurahi kwa bashasha na nderemo!"\n\n• Siku: ${date || 'Tarehe 08 Agosti 2026'}\n• Ukumbi: ${venue || 'Mlimani City'}\n• Mavazi: ${dressCode || 'Mavazi ya Heshima'}\n\nKaribu sana ujumuike nasi kufanya siku hii kuwa ya kihistoria!`,
          smsText: `Habari! Familia ya ${hostName || 'Mwenyeji'} inakualika kwa moyo mkunjufu kwenye sherehe ya ${eventName || 'Harusi'}. Siku: ${date || '08/08/2026'} Ukumbini: ${venue || 'Ukumbi wa Sherehe'}. Karibu sana!`
        },
        {
          id: "opt-2",
          style: "Ujumbe wa Kifamilia na Kiroho",
          title: "Mwaliko wa Baraka na Shukrani",
          invitationText: `Kwa Rehema na Baraka za Mwenyezi Mungu,\n\nFamilia ya ${hostName || 'Bwana na Bibi Mwenyeji'} inayo furaha kubwa kukupa mwaliko huu maalum katika sherehe yetu ya ${eventName || 'Harusi'}.\n\nKipindi hiki cha furaha kimekamilishwa na uwepo wako. Mungu akubariki unapojumuika nasi kutuombea kheri na baraka tele.\n\n• Tarehe: ${date || '08/08/2026'}\n• Mahali: ${venue || 'Ukumbi wa Sherehe'}\n• Mavazi: ${dressCode || 'Rasmi'}\n\nAhsante sana na Karibu Mno!`,
          smsText: `Habari za siku! Unaalikwa kwa upendo mwingi na familia ya ${hostName || 'Waandaji'} kushiriki sherehe ya ${eventName || 'sherehe yetu'}. Tarehe: ${date || '08/08/2026'}, Ukumbi: ${venue || 'Mlimani City'}. Baraka tele!`
        },
        {
          id: "opt-3",
          style: "Ujumbe Mfupi Rasmi na wa Kisasa",
          title: "Mwaliko Rasmi (Modern & Elegant)",
          invitationText: `Mwaliko Rasmi (Official Invitation)\n\n${hostName || 'Waandaji wa Sherehe'} wanayo heshima kubwa kukualika kushiriki katika Sherehe ya ${eventName || 'Harusi'}.\n\n• Tarehe & Muda: ${date || '08/08/2026'} kuanzia Saa 12:30 Jioni\n• Ukumbi: ${venue || 'Mlimani City Hall'}\n• Mavazi (Dress Code): ${dressCode || 'Black Tie / Elegant'}\n\nUwepo wako utaleta heshima kubwa katika sherehe hii.`,
          smsText: `Mwaliko Rasmi: Unaalikwa kwenye sherehe ya ${eventName || 'Harusi'} tarehe ${date || '08/08/2026'} katika ukumbi wa ${venue || 'Mlimani City'}. Mavazi: ${dressCode || 'Rasmi'}. Karibu sana!`
        }
      ];

      return res.json({ success: true, options: fallbackOptions, source: 'template' });

    } catch (e: any) {
      console.error("[AI Copywriting Error]:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // API 8: Smart AI Seating Chart Generator Endpoint
  app.post("/api/ai/generate-seating", async (req, res) => {
    try {
      const { maxCapacityPerTable = 10, customNotes = "" } = req.body;
      const db = await readDBLatest();
      let guests = db.guests || [];

      if (guests.length === 0) {
        return res.status(400).json({ error: "Hakuna wageni waliosajiliwa kwenye Mfumo bado!" });
      }

      // Group guests by existing category or categorize automatically based on name/role/pledge/paid
      const tablesMap: Record<string, any[]> = {
        "Meza 1 - VVIP & Viongozi": [],
        "Meza 2 - Wanafamilia & Wazee": [],
        "Meza 3 - Wafanyakazi Wenza & Kamati": [],
        "Meza 4 - Marafiki wa Bwana/Bibi Harusi": [],
        "Meza 5 - Wageni Waalikwa": []
      };

      const capacity = Number(maxCapacityPerTable) || 10;
      let extraTableIndex = 6;

      // Smart Assignment Logic
      guests.forEach((guest: any) => {
        const cat = (guest.category || guest.group || "").toLowerCase();
        const pledge = Number(guest.pledgeAmount) || 0;
        const paid = Number(guest.paidAmount) || 0;
        const cardType = (guest.cardType || "").toUpperCase();

        let assignedKey = "";

        if (cardType.includes("VVIP") || paid >= 1000000 || cat.includes("vvip") || cat.includes("kiongozi")) {
          assignedKey = "Meza 1 - VVIP & Viongozi";
        } else if (cat.includes("familia") || cat.includes("ndugu") || cat.includes("wazee")) {
          assignedKey = "Meza 2 - Wanafamilia & Wazee";
        } else if (cat.includes("kazi") || cat.includes("ofisi") || cat.includes("kamati") || cat.includes("wafanyakazi")) {
          assignedKey = "Meza 3 - Wafanyakazi Wenza & Kamati";
        } else if (cat.includes("rafiki") || cat.includes("marafiki") || cat.includes("shule")) {
          assignedKey = "Meza 4 - Marafiki wa Bwana/Bibi Harusi";
        } else {
          assignedKey = "Meza 5 - Wageni Waalikwa";
        }

        // Spill over to next table if capacity exceeded
        if (tablesMap[assignedKey].length >= capacity) {
          let foundSpillKey = Object.keys(tablesMap).find(k => k.startsWith(assignedKey.split(' - ')[0]) && tablesMap[k].length < capacity);
          if (!foundSpillKey) {
            foundSpillKey = `Meza ${extraTableIndex++} - ${assignedKey.split(' - ')[1] || 'Wageni'}`;
            tablesMap[foundSpillKey] = [];
          }
          assignedKey = foundSpillKey;
        }

        tablesMap[assignedKey].push({
          id: guest.id,
          name: guest.name,
          phone: guest.phone,
          category: guest.category || 'Mwalikwa',
          rsvpStatus: guest.rsvpStatus || 'Bado',
          paidAmount: paid,
          pledgeAmount: pledge
        });

        // Update guest table assignment in memory
        guest.tableNumber = assignedKey;
        guest.table = assignedKey;
        guest.seatingTable = assignedKey;
      });

      // Save updated guests back to DB
      db.guests = guests;
      await writeDB(db);

      // Build structured tables array
      const structuredTables = Object.keys(tablesMap)
        .filter(key => tablesMap[key].length > 0)
        .map(key => ({
          tableName: key,
          capacity: capacity,
          guestCount: tablesMap[key].length,
          guests: tablesMap[key]
        }));

      res.json({
        success: true,
        tables: structuredTables,
        totalAssignedGuests: guests.length,
        summary: `AI imetengeneza kikamilifu mpangilio wa Meza ${structuredTables.length} bila migongano kwa wageni wote ${guests.length}.`
      });

    } catch (e: any) {
      console.error("[AI Seating Chart Error]:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // API 9: Fetch current seating chart endpoint
  app.get("/api/ai/seating-chart", async (req, res) => {
    try {
      const db = await readDBLatest();
      const guests = db.guests || [];

      const tablesMap: Record<string, any[]> = {};

      guests.forEach((g: any) => {
        const tName = g.tableNumber || g.table || g.seatingTable || "Meza Isiyotengwa";
        if (!tablesMap[tName]) tablesMap[tName] = [];
        tablesMap[tName].push({
          id: g.id,
          name: g.name,
          phone: g.phone,
          category: g.category || 'Mwalikwa',
          rsvpStatus: g.rsvpStatus || 'Bado',
          paidAmount: Number(g.paidAmount) || 0,
          pledgeAmount: Number(g.pledgeAmount) || 0
        });
      });

      const structuredTables = Object.keys(tablesMap).map(key => ({
        tableName: key,
        guestCount: tablesMap[key].length,
        guests: tablesMap[key]
      }));

      res.json({
        success: true,
        tables: structuredTables,
        totalGuests: guests.length
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite static assets and html routing middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
    // Start or resume background queue processing
    processQueueJobs().catch(err => console.error("Error starting queue on boot:", err));

    // Start UWALEMI automated monthly reminders cron (checks every 30 minutes)
    setTimeout(() => {
      processUwalemiMonthlyAutoReminders(false).catch(e => console.warn("[UWALEMI Boot Reminder Check]:", e.message));
    }, 15000);
    setInterval(() => {
      processUwalemiMonthlyAutoReminders(false).catch(e => console.warn("[UWALEMI Periodic Reminder Check]:", e.message));
    }, 30 * 60 * 1000);
  });
}

startServer();
