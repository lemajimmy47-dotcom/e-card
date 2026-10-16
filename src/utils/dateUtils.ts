/**
 * Centralized utility for formatting sending date and time across EVENTCARD modules.
 * Standardizes Tanzanian local time (Africa/Dar_es_Salaam, UTC+3) and provides
 * clean date/time strings for SMS, WhatsApp, and database timestamps.
 */

export function getCurrentSendingDateTime(lang: 'sw' | 'en' = 'sw'): {
  date: string;
  time: string;
  full: string;
  iso: string;
} {
  const now = new Date();
  const iso = now.toISOString();

  let date = '';
  let time = '';

  try {
    date = now.toLocaleDateString('sw-TZ', {
      timeZone: 'Africa/Dar_es_Salaam',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    time = now.toLocaleTimeString('sw-TZ', {
      timeZone: 'Africa/Dar_es_Salaam',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    const pad = (n: number) => String(n).padStart(2, '0');
    date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  const full = lang === 'en' ? `${date} at ${time}` : `${date} saa ${time}`;
  return { date, time, full, iso };
}

export function formatSendingTimestamp(isoOrString?: string | null, lang: 'sw' | 'en' = 'sw'): string {
  if (!isoOrString) return '';
  try {
    const d = new Date(isoOrString);
    if (isNaN(d.getTime())) return String(isoOrString);

    const date = d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'sw-TZ', {
      timeZone: 'Africa/Dar_es_Salaam',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const time = d.toLocaleTimeString(lang === 'en' ? 'en-GB' : 'sw-TZ', {
      timeZone: 'Africa/Dar_es_Salaam',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `${date} ${time}`;
  } catch {
    return String(isoOrString);
  }
}

/**
 * Replaces date/time sending placeholders in any message template text.
 */
export function applySendingDateTimeReplacements(
  text: string, 
  lang: 'sw' | 'en' = 'sw',
  customDate?: string,
  customTime?: string
): string {
  if (!text) return '';
  const dt = getCurrentSendingDateTime(lang);
  const sendDate = customDate || dt.date;
  const sendTime = customTime || dt.time;
  const sendFull = lang === 'en' ? `${sendDate} at ${sendTime}` : `${sendDate} saa ${sendTime}`;

  return text
    .replace(/\{tarehe_kutuma\}/gi, sendDate)
    .replace(/\{tarehe_ya_kutuma\}/gi, sendDate)
    .replace(/\{tarehe_sasa\}/gi, sendDate)
    .replace(/\{tarehe_leo\}/gi, sendDate)
    .replace(/\{sent_date\}/gi, sendDate)
    .replace(/\{send_date\}/gi, sendDate)
    .replace(/\{muda_kutuma\}/gi, sendTime)
    .replace(/\{muda_wa_kutuma\}/gi, sendTime)
    .replace(/\{muda_sasa\}/gi, sendTime)
    .replace(/\{sent_time\}/gi, sendTime)
    .replace(/\{send_time\}/gi, sendTime)
    .replace(/\{tarehe_muda_kutuma\}/gi, sendFull)
    .replace(/\{tarehe_na_muda_wa_kutuma\}/gi, sendFull)
    .replace(/\{muda_na_tarehe\}/gi, sendFull)
    .replace(/\{sent_at\}/gi, sendFull)
    .replace(/\{send_datetime\}/gi, sendFull);
}
