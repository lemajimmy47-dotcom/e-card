import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Upload, Paperclip, MessageSquare, Check, AlertCircle, Users, CheckCircle2, Sparkles, Globe, Heart, Eye, X } from 'lucide-react';
import { SaveTheDate, Guest, EventDetails } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { safeLocalStorage } from '../utils/storage';
import { convertWebPToJpeg } from '../utils/imageUtils';

interface Props {
  eventDetails: EventDetails;
  eventsList: EventDetails[];
  onSelectEvent: (eventId: string) => void;
  guests: Guest[];
  onUpdateEvent: (updated: EventDetails) => void;
  onUpdateGuests?: (updatedGuests: Guest[], actionDesc?: string, skipServerSave?: boolean) => void;
}

export default function SaveTheDateManager({ eventDetails, eventsList, onSelectEvent, guests, onUpdateEvent, onUpdateGuests }: Props) {
  const [stds, setStds] = useState<SaveTheDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [stdTitle, setStdTitle] = useState('Save The Date - Maalum');
  
  // State variables for tracking modifications (database saving sync) and RSVP filtering
  const [isDirty, setIsDirty] = useState(false);
  const [rsvpFilter, setRsvpFilter] = useState<'all' | 'confirmed' | 'pending' | 'declined'>('all');
  
  // New state variables for collapsed links and guest visual std card previews
  const [expandedLinks, setExpandedLinks] = useState<Record<string, boolean>>({});
  const [viewGuestStd, setViewGuestStd] = useState<Guest | null>(null);

  const { language } = useLanguage();
  const isEn = language === 'en';

  // Custom template context
  const [stdTemplate, setStdTemplate] = useState('');

  // Set default template dynamically when component mounts or language changes
  useEffect(() => {
    if (!stdTemplate || stdTemplate.startsWith('Habari') || stdTemplate.startsWith('Hello')) {
      if (isEn) {
        setStdTemplate(`Hello {name}

Please save the date for the upcoming {event_name} event on {date}.

A formal invitation and admission card will reach you soon.

You are warmly welcome!`);
      } else {
        setStdTemplate(`Habari {name}

Tafadhali hifadhi tarehe ya sherehe ya {event_name} itakayofanyika tarehe {date}.

Mwaliko rasmi pamoja na kadi ya kiingilio utakufikia hivi karibuni.

Karibu sana!`);
      }
    }
  }, [isEn]);

  const [gatewaySettings, setGatewaySettings] = useState({
    provider: 'simulation',
    senderId: 'EVENT',
    senderIdStatus: 'approved' as 'pending' | 'approved' | 'rejected',
    whatsappUrl: ''
  });

  const isMetaWhatsApp = React.useMemo(() => {
    if (!gatewaySettings.whatsappUrl) return false;
    if (gatewaySettings.whatsappUrl.trim().startsWith('{') && gatewaySettings.whatsappUrl.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(gatewaySettings.whatsappUrl);
        return parsed.provider === 'meta';
      } catch {
        return false;
      }
    }
    return false;
  }, [gatewaySettings.whatsappUrl]);

  // Custom non-blocking modal (iframe-safe) states and helper functions
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev && prev.message === message ? null : prev);
    }, 4500);
  };

  const showConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmModal({
        show: true,
        title,
        message,
        onConfirm: () => {
          setConfirmModal(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmModal(null);
          resolve(false);
        }
      });
    });
  };

  // Sending progress
  const [sendingAll, setSendingAll] = useState(false);
  const [sendLogs, setSendLogs] = useState<string[]>([]);
  const [sentCount, setSentCount] = useState(0);

  // Local state to track which guests have already been sent Save the Date
  const [sentGuestsMap, setSentGuestsMap] = useState<Record<string, boolean>>(() => {
    try {
      const key = eventDetails?.id ? `kadi_std_sent_map_${eventDetails.id}` : 'kadi_std_sent_map';
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Sync state when eventDetails.id changes
  useEffect(() => {
    if (eventDetails?.id) {
      try {
        const saved = localStorage.getItem(`kadi_std_sent_map_${eventDetails.id}`);
        setSentGuestsMap(saved ? JSON.parse(saved) : {});
      } catch {
        setSentGuestsMap({});
      }
    }
  }, [eventDetails?.id]);

  const markGuestAsSent = (guestId: string, sentChannel: 'sms' | 'whatsapp' = 'sms') => {
    setSentGuestsMap(prev => {
      const next = { ...prev, [guestId]: true };
      const key = eventDetails?.id ? `kadi_std_sent_map_${eventDetails.id}` : 'kadi_std_sent_map';
      safeLocalStorage.setItem(key, JSON.stringify(next));
      return next;
    });

    // Fire off simulation/lightweight backend update call in background
    const targetGuest = guests.find(item => item.id === guestId);
    if (targetGuest) {
      fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: guestId,
          phone: targetGuest.phone,
          text: 'manual_whatsapp',
          channel: sentChannel,
          msgType: 'save_the_date',
          lang: language,
          isSimulationOnly: true
        })
      }).catch(err => console.error("Manual STD status backend sync error:", err));
    }

    if (onUpdateGuests) {
      const updated = guests.map(item => {
        if (item.id === guestId) {
          const customFields = item.customFields || {};
          
          if (sentChannel === 'sms') {
            customFields.std_sent_sms = 'true';
          } else if (sentChannel === 'whatsapp') {
            customFields.std_sent_whatsapp = 'true';
          }

          customFields.std_sent_channel = sentChannel;
          customFields.std_sent_lang = language || 'sw';
          
          return {
            ...item,
            customFields,
            stdSent: true,
            stdSentChannel: sentChannel,
            stdSentLang: language || 'sw'
          };
        }
        return item;
      });
      onUpdateGuests(updated, `Ametuma Save The Date kwa ${guestId}`);
    }
  };

  const renderDeliveryIndicator = (g: Guest) => {
    // Collect what has been successfully delivered specifically for Save the Date
    const deliveries: { channel: 'whatsapp' | 'sms'; lang: string }[] = [];

    const lang = g.customFields?.std_sent_lang || g.stdSentLang || language || 'sw';

    const hasSms = g.customFields?.std_sent_sms === 'true' || 
                   (g.customFields?.std_sent_channel === 'sms' && g.customFields?.std_sent_whatsapp !== 'true') ||
                   (g.stdSentChannel === 'sms' && g.customFields?.std_sent_whatsapp !== 'true') ||
                   (sentGuestsMap[g.id] && g.customFields?.std_sent_whatsapp !== 'true' && g.stdSentChannel !== 'whatsapp' && g.lastSentChannel !== 'whatsapp');
                   
    const hasWa = g.customFields?.std_sent_whatsapp === 'true' || 
                  (g.customFields?.std_sent_channel === 'whatsapp' && g.customFields?.std_sent_sms !== 'true') ||
                  (g.stdSentChannel === 'whatsapp' && g.customFields?.std_sent_sms !== 'true');

    if (hasSms) {
      deliveries.push({ channel: 'sms', lang });
    }
    if (hasWa) {
      deliveries.push({ channel: 'whatsapp', lang });
    }

    // Fallback if neither explicitly true but there's legacy state
    if (deliveries.length === 0) {
      if (g.customFields?.std_sent_channel) {
        deliveries.push({ channel: g.customFields.std_sent_channel as 'whatsapp' | 'sms', lang });
      } else if (g.stdSentChannel) {
        deliveries.push({ channel: g.stdSentChannel as 'whatsapp' | 'sms', lang });
      } else if (g.stdSent) {
        deliveries.push({ channel: (g.lastSentChannel || 'sms') as 'whatsapp' | 'sms', lang });
      } else if (sentGuestsMap[g.id]) {
        deliveries.push({ channel: 'sms', lang });
      }
    }

    if (deliveries.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 items-center">
        {deliveries.map((del, i) => {
          const isWa = del.channel === 'whatsapp';
          const langDisplay = String(del.lang).toUpperCase() === 'EN' ? 'EN' : 'SW';
          return (
            <span
              key={i}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-extrabold border ${
                isWa 
                  ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
              title={isWa ? `Iliyofanikiwa kupitia WhatsApp (${langDisplay})` : `Iliyofanikiwa kupitia SMS (${langDisplay})`}
            >
              {isWa ? (
                // WhatsApp Icon SVG (compact and matching lucide stroke size)
                <svg className="w-2 h-2 fill-current" viewBox="0 0 24 24">
                  <path d="M12.003 2c-5.522 0-9.997 4.477-9.997 9.997 0 1.764.459 3.483 1.332 5.017L2 22l5.127-1.345a9.96 9.96 0 0 0 4.877 1.28c5.522 0 9.997-4.477 9.997-9.997 0-5.52-4.475-9.938-9.998-9.938zm5.952 14.175c-.26.732-1.517 1.345-2.094 1.41-.577.065-1.127.276-3.615-.756-3.136-1.301-5.127-4.477-5.29-4.688-.163-.211-1.301-1.731-1.301-3.308 0-1.577.829-2.35 1.122-2.659.293-.309.65-.39.862-.39s.423.016.602.024c.187.008.439-.073.691.537.26.634.894 2.18.976 2.342.081.163.138.35.024.577-.114.228-.171.366-.341.569-.171.203-.358.455-.512.61-.171.171-.35.358-.154.699.195.341.87 1.431 1.862 2.31 1.277 1.127 2.35 1.477 2.684 1.639.333.163.529.138.724-.089.195-.228.837-.976 1.065-1.309.228-.333.455-.276.764-.163.309.114 1.959.927 2.293 1.097s.561.26.642.407c.082.146.082.846-.178 1.578z" />
                </svg>
              ) : (
                // SMS Mail/Message Icon SVG
                <svg className="w-2 h-2 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              )}
              <span className="capitalize">{del.channel}</span>
              <span className="text-slate-500 font-normal">|</span>
              <span className="text-[7.5px] font-bold tracking-wider">{langDisplay}</span>
            </span>
          );
        })}
      </div>
    );
  };

  // Load Save The Dates & SMS settings
  useEffect(() => {
    // 1. Fetch Save the dates
    setLoading(true);
    fetch(`/api/save-the-dates/${eventDetails.id}`)
      .then(res => res.json())
      .then(data => {
        setStds(data);
        if (data.length > 0) {
          const active = data[data.length - 1];
          setStdTitle(active.title || (isEn ? 'Save The Date - Custom' : 'Save The Date - Maalum'));
          setStdTemplate(active.message || '');
          setSelectedFile(active.image_url || null);
        } else {
          setStdTitle(isEn ? 'Save The Date - Custom' : 'Save The Date - Maalum');
          setStdTemplate(isEn ? `Hello {name}

Please save the date for the upcoming {event_name} event on {date}.

A formal invitation and admission card will reach you soon.

View Card: {link}

Contacts:
- {contact_1_name}: {contact_1_phone}
- {contact_2_name}: {contact_2_phone}

You are warmly welcome!` : `Habari {name}

Tafadhali hifadhi tarehe ya sherehe ya {event_name} itakayofanyika tarehe {date}.

Mwaliko rasmi pamoja na kadi ya kiingilio utakufikia hivi karibuni.

Tazama Kadi: {link}

Mawasiliano:
- {contact_1_name}: {contact_1_phone}
- {contact_2_name}: {contact_2_phone}

Karibu sana!`);
          setSelectedFile(null);
        }
        setIsDirty(false); // Clean when pristine from server
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch('/api/sms-settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.provider) {
          setGatewaySettings(prev => ({ ...prev, ...data }));
        }
      })
      .catch(err => console.error("Error loading sms-settings:", err));
  }, [eventDetails.id]);

  // Handle saving the Custom Save the Date configurations (Cloud Durable Sync)
  const handleSaveSaveTheDateConfig = async () => {
    try {
      const payload = {
        event_id: eventDetails.id,
        title: stdTitle,
        message: stdTemplate,
        image_url: selectedFile || ''
      };

      const res = await fetch('/api/save-the-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const saved = await res.json();
        setStds(prev => [...prev, saved]);
        setIsDirty(false); // Successfully synchronized
        // Save in local storage also for guest page offline access
        try {
          const localStds = localStorage.getItem('kadi_save_the_dates') || '[]';
          const parsed = JSON.parse(localStds);
          const filtered = parsed.filter((s: any) => s.event_id !== eventDetails.id);
          safeLocalStorage.setItem('kadi_save_the_dates', JSON.stringify([...filtered, payload]));
        } catch (le) {
          console.error(le);
        }
        showToast("✓ Muundo na Picha ya Save The Date vimehifadhiwa kikamilifu kwenye database!", "success");
      } else {
        showToast("Imeshindwa kuhifadhi.", "error");
      }
    } catch {
      showToast("Hitilafu imetokea.", "error");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        if (dataUrl) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxW = 2048; // Imeongezwa kuruhusu ubora wa hali ya juu (high-res)
            if (width > maxW) {
              height = (maxW / width) * height;
              width = maxW;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            // Badilisha kwenda JPEG na ubora wa 95% (karibia na asili) ili kuzuia kupoteza ubora ukizoom na kuhakikisha inasaidiwa na Meta WhatsApp
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.95);

            setSelectedFile(compressedDataUrl);
            setIsDirty(true);
          };
          img.src = dataUrl;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Standardize Tanzanian phone numbers
  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\s+/g, '').replace(/[+\-]/g, '');
    let formatted = cleaned;
    if (formatted.startsWith('0')) {
      formatted = '255' + formatted.substring(1);
    } else if (!formatted.startsWith('255') && formatted.length === 9) {
      formatted = '255' + formatted;
    }
    return formatted;
  };

  // Compile guest dynamic message using safe identifier links instead of spaces in names
  const getCompiledMessage = (guest: Guest | string, stripLink: boolean = false) => {
    try {
      const isString = typeof guest === 'string';
      const guestObj = isString ? null : guest;
      const guestName = isString ? guest : (guest.name || (isEn ? 'Guest' : 'Mgeni'));
      const guestCodeOrId = isString ? encodeURIComponent(guest) : (guest.code || guest.id || 'std');
      const guestCleanName = String(guestName).toUpperCase();
      const guestLink = `${window.location.origin}/?invite=${guestCodeOrId}&std=true&eventId=${eventDetails.id}&lang=${language}`;
      
      const template = stdTemplate || '';
      const contacts = [eventDetails.contact1, eventDetails.contact2, eventDetails.contact3].filter(Boolean).join('\n');
      
      const translatePeriod = (p: string | null | undefined) => {
        const pVal = p || "Mchana";
        if (isEn) {
          if (pVal === 'Asubuhi') return 'Morning';
          if (pVal === 'Mchana') return 'Afternoon';
          if (pVal === 'Jioni') return 'Evening';
          if (pVal === 'Usiku') return 'Night';
          return pVal;
        }
        return pVal;
      };
      const periodTranslated = translatePeriod(eventDetails.period);
      const timeVal = `${eventDetails.time || ""} ${periodTranslated}`.trim();

      let compiled = template
        .replace(/{name}/g, guestCleanName)
        .replace(/{host}/g, eventDetails.hostName || (isEn ? 'Our Family' : 'Familia yetu'))
        .replace(/{event_name}/g, eventDetails.name || (isEn ? 'Our Event' : 'Sherehe yetu'))
        .replace(/{date}/g, eventDetails.date || '')
        .replace(/{link}/g, stripLink ? "" : guestLink)
        .replace(/{ukumbi}/g, eventDetails.eventHallName || "")
        .replace(/{muda}/g, timeVal)
        .replace(/{card_no}/g, guestObj?.code || "[Code]")
        .replace(/{aina}/g, guestObj?.cardType || "DOUBLE")
        .replace(/{mwasiliano}/g, contacts)
        .replace(/{contact_1_name}/g, eventDetails.contact1Name || "")
        .replace(/{contact_1_phone}/g, eventDetails.contact1 || "")
        .replace(/{contact_2_name}/g, eventDetails.contact2Name || "")
        .replace(/{contact_2_phone}/g, eventDetails.contact2 || "")
        .replace(/{venue}/g, eventDetails.eventHallName || "")
        .replace(/{time}/g, timeVal)
        .replace(/{card_number}/g, guestObj?.code || "[Code]")
        .replace(/{card_type}/g, guestObj?.cardType || "DOUBLE")
        .replace(/- : /g, ""); // Clean up if any contact is missing but template had bullets

      // Additional cleanup for partial contact info:
      // 1. Remove trailing colons/dashes if phone is missing
      compiled = compiled.replace(/- ([^:\n]+)[:\-]\s*(\n|$)/g, '- $1$2');
      // 2. Remove leading colons/dashes if name is missing
      compiled = compiled.replace(/- \s*[:\-]\s*([^:\n]+)/g, '- $1');
      // 3. Fix weird double spacing or mixed punctuation
      compiled = compiled.replace(/- \s+/g, '- ');
      // 4. Remove empty lines in contact section if they became empty
      compiled = compiled.replace(/\n-\s*\n/g, '\n');

      if (!stripLink && !compiled.includes(guestLink)) {
        compiled += `\n\n${isEn ? 'View Card here' : 'Tazama Kadi hapa'}: ${guestLink}`;
      }

      if (stripLink) {
        // Scrub any other URLs completely
        let cleaned = compiled.replace(/https?:\/\/[^\s]+/gi, "");
        cleaned = cleaned.replace(/[a-zA-Z0-9.-]+\.co\.tz[^\s]*/gi, "");
        cleaned = cleaned.replace(/[a-zA-Z0-9.-]+\.app[^\s]*/gi, "");
        cleaned = cleaned.replace(/[a-zA-Z0-9.-]+\.com[^\s]*/gi, "");
        return cleaned.trim();
      }
      return compiled.trim();
    } catch (e) {
      console.error("Error compiling message:", e);
      return (stdTemplate || '').replace(/{link}/g, "");
    }
  };

  // Send individually
  const handleSendSingle = async (guest: Guest, sendChannel: 'sms' | 'whatsapp') => {
    try {
      if (isDirty) {
        const proceed = await showConfirm(
          "⚠️ Taarifa Haijahifadhiwa",
          isEn ? 'Note: You have unsaved changes to the image or template. Guests will see the old picture saved in the database. Do you want to continue sending?' : "Kumbuka: Una mabadiliko kwenye picha au template ambayo haujahifadhi. Wageni wataona picha ya zamani iliyopo kwenye database. Je, unataka kuendelea kutuma?"
        );
        if (!proceed) return;
      }

      const textMsg = getCompiledMessage(guest, sendChannel === 'sms');
      
      if (sendChannel === 'whatsapp') {
        if (isMetaWhatsApp) {
          const proceed = await showConfirm(
            isEn ? "Send via WhatsApp API" : "Tuma Kupitia WhatsApp API",
            isEn 
              ? `Do you want to send Save The Date to ${guest.name} via Meta WhatsApp Cloud API automatically?`
              : `Je, unataka kumtumia ${guest.name} Save The Date kupitia WhatsApp Business API (Meta) kiotomatiki bila kufungua WhatsApp?`
          );
          if (!proceed) return;

          const currentOrigin = typeof window !== 'undefined' && !window.location.hostname.includes('europe-west2.run.app') && !window.location.hostname.includes('localhost') 
            ? window.location.origin 
            : 'https://eventcard.co.tz';
          const guestLink = `${currentOrigin}/?invite=${guest.code || guest.id || 'std'}&std=true&eventId=${eventDetails.id}&lang=${language}`;
          
          const replacements: { [key: string]: string } = {
            '{name}': guest.name.toUpperCase(),
            '{host}': eventDetails.hostName || 'Familia yetu',
            '{event_name}': eventDetails.name || 'Sherehe yetu',
            '{date}': eventDetails.date || '',
            '{link}': guestLink,
            '{ukumbi}': eventDetails.eventHallName || "",
            '{muda}': `${eventDetails.time || ""} ${eventDetails.period || ""}`,
            '{card_no}': guest.code || guest.id || "[Code]"
          };

          const regex = /\{[a-zA-Z0-9_\-Hh]+\}/g;
          const matches = stdTemplate.match(regex) || [];
          const templateParams = matches.map(match => {
            const val = replacements[match];
            return val !== undefined ? val : match;
          });

          const compatibleImageUrl = await convertWebPToJpeg(selectedFile);
          const res = await fetch('/api/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              guestId: guest.id,
              eventId: eventDetails.id,
              phone: guest.phone,
              text: textMsg,
              channel: 'whatsapp',
              templateParams,
              templateName: 'hifadhi_tarehe',
              imageUrl: compatibleImageUrl,
              lang: language,
              msgType: 'save_the_date'
            })
          });

          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            showToast(isEn ? `✓ Sent to ${guest.name} via WhatsApp API!` : `✓ Save The Date imetumwa vizuri kwa ${guest.name} kupitia WhatsApp Business API!`, 'success');
            markGuestAsSent(guest.id, 'whatsapp');
            setSendLogs(prev => [`[✓ META WHATSAPP] Aliyepokea: ${guest.name} - ${data.log || 'Ujumbe umetumwa'}`, ...prev]);
          } else {
            showToast(`Imeshindwa kutuma: ${data.error || 'Hitilafu ya Meta API'}`, 'error');
            setSendLogs(prev => [`[✗ META WHATSAPP] Imefeli kwa ${guest.name}: ${data.error || 'Hitilafu'}`, ...prev]);
          }
          return;
        }

        const formatted = formatPhone(guest.phone);
        const encodedText = encodeURIComponent(textMsg);
        // Try to open safely
        const a = document.createElement('a');
        a.href = `https://api.whatsapp.com/send?phone=${formatted}&text=${encodedText}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        markGuestAsSent(guest.id, 'whatsapp');
        setSendLogs(prev => [`[✓ WHATSAPP] Aliyepokea: ${guest.name} - Dirisha limefunguliwa`, ...prev]);
        return;
      }

      const proceed = await showConfirm(
        "Kutuma Save The Date Moja Moja",
        `Je, unataka kumtumia ${guest.name} Save The Date kupitia SMS leo?`
      );
      if (!proceed) return;

      // SMS through Gateway api
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: guest.id,
          eventId: eventDetails.id,
          phone: guest.phone,
          text: textMsg,
          channel: 'sms',
          lang: language,
          msgType: 'save_the_date'
        })
      });

      if (res.ok) {
        showToast(`✓ Save The Date imetumwa vizuri kwa ${guest.name} kupitia SMS (${gatewaySettings.senderId || 'SIMULATION'})!`, 'success');
        markGuestAsSent(guest.id, 'sms');
        setSendLogs(prev => [`[✓ SMS Sender ID: ${gatewaySettings.senderId || 'SIMULATION'}] Ujumbe umetumwa kwa ${guest.name} (${guest.phone})`, ...prev]);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`Imeshindwa kutuma: ${err.error || 'Hitilafu ya Gateway'}`, 'error');
        setSendLogs(prev => [`[✗ SMS Gating] Imefeli kwa ${guest.name}: ${err.error || 'Salio limeisha au namba sio sahihi'}`, ...prev]);
      }
    } catch (err: any) {
      console.error("SMS Send Error:", err);
      showToast("Hitilafu ya mtandao au mfumo: " + err.message, 'error');
      setSendLogs(prev => [`[✗ Hitilafu] Mtandao umefeli kumfikia ${guest.name}: ${err.message}`, ...prev]);
    }
  };

  // Get active filtered guests list based on RSVP status
  const getFilteredGuests = () => {
    return guests.filter(g => {
      // First, ensure they are on this active event
      const isCorrectEvent = g.eventId === eventDetails.id || (!g.eventId && eventDetails.id === 'event-starter');
      if (!isCorrectEvent) return false;

      // Filter by RSVP
      if (rsvpFilter === 'confirmed') return g.rsvpStatus === 'Atahudhuria';
      if (rsvpFilter === 'pending') return !g.rsvpStatus || g.rsvpStatus === 'Bado';
      if (rsvpFilter === 'declined') return g.rsvpStatus === 'Hatahudhuria';
      return true; // 'all'
    });
  };

  const activeFilteredGuests = getFilteredGuests();

  // Bulk send ("Tuma kwa Wote") for the actively filtered list
  const handleSendToAllFiltered = async () => {
    try {
      if (activeFilteredGuests.length === 0) {
        showToast(isEn ? 'No guests in this list to send messages to!' : "Hakuna wageni kwenye orodha hii ya kutumiwa ujumbe!", "info");
        return;
      }

      if (isDirty) {
        showToast(
          isEn 
            ? "⚠️ You cannot dispatch messages while you have unsaved changes! Please click 'Save Save The Date Config' first to update the database."
            : "⚠️ Huwezi kutuma kwa wote wakati una mabadiliko ambayo hayajahifadhiwa! Tafadhali bofya kitufe cha 'Hifadhi Taarifa za Save The Date' kwanza ili picha na ujumbe uhifadhiwe kwenye database.", 
          "error"
        );
        return;
      }

      const filterText = rsvpFilter === 'all' ? 'WOTE' :
                         rsvpFilter === 'confirmed' ? (isEn ? 'Confirmed RSVP' : 'Waliodhibiti RSVP') :
                         rsvpFilter === 'pending' ? (isEn ? 'Pending' : 'Bado hawajathibitisha') : (isEn ? 'Declined' : 'Waliokataa');

      const proceed = await showConfirm(
        isEn ? "Dispatch to this Group" : "Kutuma kwa Kikundi Hiki",
        isEn 
          ? `Do you want to begin sending Save The Date invitations to the ${activeFilteredGuests.length} guests in the [${filterText}] group via ${channel.toUpperCase()}?`
          : `Je, unataka kuanza kutuma ujumbe wa Save The Date kwa wageni ${activeFilteredGuests.length} waliopo kwenye orodha ya [${filterText}] kupitia ${channel.toUpperCase()}?`
      );
      if (!proceed) return;

      setSendingAll(true);
      setSentCount(0);
      setSendLogs([`[0.00s] Kuanza kutuma Save The Date kwa wageni wa kundi la [${filterText}] (${activeFilteredGuests.length})...`]);

      for (let i = 0; i < activeFilteredGuests.length; i++) {
        const g = activeFilteredGuests[i];
        const textMsg = getCompiledMessage(g, channel === 'sms');
        
        try {
          if (channel === 'whatsapp') {
            if (isMetaWhatsApp) {
              const currentOrigin = typeof window !== 'undefined' && !window.location.hostname.includes('europe-west2.run.app') && !window.location.hostname.includes('localhost') 
                ? window.location.origin 
                : 'https://eventcard.co.tz';
              const guestLink = `${currentOrigin}/?invite=${g.code || g.id || 'std'}&std=true&eventId=${eventDetails.id}&lang=${language}`;
              
              const replacements: { [key: string]: string } = {
                '{name}': g.name.toUpperCase(),
                '{host}': eventDetails.hostName || 'Familia yetu',
                '{event_name}': eventDetails.name || 'Sherehe yetu',
                '{date}': eventDetails.date || '',
                '{link}': guestLink,
                '{ukumbi}': eventDetails.eventHallName || "",
                '{muda}': `${eventDetails.time || ""} ${eventDetails.period || ""}`,
                '{card_no}': g.code || g.id || "[Code]"
              };

              const regex = /\{[a-zA-Z0-9_\-Hh]+\}/g;
              const matches = stdTemplate.match(regex) || [];
              const templateParams = matches.map(match => {
                const val = replacements[match];
                return val !== undefined ? val : match;
              });

              const compatibleImageUrl = await convertWebPToJpeg(selectedFile);
              const res = await fetch('/api/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  guestId: g.id,
                  eventId: eventDetails.id,
                  phone: g.phone,
                  text: textMsg,
                  channel: 'whatsapp',
                  templateParams,
                  templateName: 'hifadhi_tarehe',
                  imageUrl: compatibleImageUrl,
                  lang: language,
                  msgType: 'save_the_date'
                })
              });

              const data = await res.json().catch(() => ({}));
              if (res.ok) {
                markGuestAsSent(g.id, 'whatsapp');
                setSendLogs(prev => [`[✓ META WHATSAPP] Ujumbe umetumwa kwa ${g.name} - ${data.log || 'Sawa'}`, ...prev]);
              } else {
                setSendLogs(prev => [`[✗ META WHATSAPP] Imefeli kwa ${g.name}: ${data.error || 'Hitilafu'}`, ...prev]);
              }
            } else {
              const formatted = formatPhone(g.phone);
              const encodedText = encodeURIComponent(textMsg);
              
              const a = document.createElement('a');
              a.href = `https://api.whatsapp.com/send?phone=${formatted}&text=${encodedText}`;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              
              markGuestAsSent(g.id, 'whatsapp');
              setSendLogs(prev => [`[✓ WHATSAPP] Aliyepokea: ${g.name} - Dirisha limefunguliwa`, ...prev]);
            }
          } else {
            // SMS Gateway real call
            const res = await fetch('/api/send-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                guestId: g.id,
                eventId: eventDetails.id,
                phone: g.phone,
                text: textMsg,
                channel: 'sms',
                lang: language,
                msgType: 'save_the_date'
              })
            });

            if (res.ok) {
              markGuestAsSent(g.id, 'sms');
              setSendLogs(prev => [`[✓ SMS Sender ID: ${gatewaySettings.senderId || 'SIMULATION'}] Ujumbe umetumwa kwa ${g.name} (${g.phone})`, ...prev]);
            } else {
              const err = await res.json().catch(() => ({}));
              setSendLogs(prev => [`[✗ SMS Gating] Imefeli kwa ${g.name}: ${err.error || 'Salio limeisha au namba sio sahihi'}`, ...prev]);
            }
          }
        } catch (err: any) {
          setSendLogs(prev => [`[✗ Hitilafu] Mtandao umefeli kumfikia ${g.name}`, ...prev]);
        }
        
        setSentCount(i + 1);
        // Wait 1.2 seconds between dispatches for gateway safety & debouncing
        await new Promise(resolve => setTimeout(resolve, 1200));
      }

      setSendingAll(false);
      showToast("✓ Zoezi la kutuma Save The Date limekamilishwa kwa kikundi kilichochaguliwa!", "success");
    } catch (e: any) {
      console.error("Bulk Send Error:", e);
      setSendingAll(false);
      showToast("Hitilafu imetokea wakati wa kutuma kwa wote.", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400 font-mono">Inapakia Moduli ya Save the Date...</p>
      </div>
    );
  }

  // Filter ONLY confirmed guests (rsvpStatus === 'Atahudhuria')
  const confirmedGuests = guests.filter(g => g.rsvpStatus === 'Atahudhuria');

  // Preview of guest compiled message
  const previewMessage = getCompiledMessage("Alex Tarimo");

  return (
    <div className="space-y-6">
      
      {/* 1. Event Registration & Type Filter Category Section */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-6 rounded-[1.75rem] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-[#f1f5f9] tracking-tight uppercase flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-rose-450" />
              <span>{isEn ? 'Configure Save The Date' : 'Sanidi Save The Date'}</span>
            </h2>
            <p className="text-slate-400 text-[11px] mt-0.5">{isEn ? 'Set up the event name, select the event type, and write your official message.' : 'Andaa jina la tukio, fanya uchaguzi wa aina ya tukio, na andika ujumbe wako rasmi.'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          {/* CHAGUA TUKIO */}
          <div className="space-y-1">
            <label className="font-bold text-slate-300 block">{isEn ? 'Select Event' : 'Chagua Tukio (Event)'}</label>
            <select 
              value={eventDetails.id}
              onChange={(e) => onSelectEvent(e.target.value)}
              className="w-full bg-[#0a101f]/60 border border-white/10 p-3 rounded-xl text-xs text-white outline-none focus:border-rose-500/40"
            >
              {eventsList.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.name} ({ev.date})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Upload Kadi/Picha & Custom Swahili Template Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left pane - Template Form Inputs and Uploads */}
        <div className="lg:col-span-7 backdrop-blur-xl bg-white/5 border border-white/10 p-6 rounded-[1.75rem] space-y-4">
          <h3 className="text-sm font-extrabold text-white tracking-wide uppercase flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-emerald-400" />
            <span>{isEn ? 'Upload Card & Write Message Template' : 'Pakia Kadi & Andika Template ya Ujumbe'}</span>
          </h3>

          <div className="space-y-3">
            {/* Title */}
            <div className="space-y-1">
              <label className="font-bold text-slate-400 block">{isEn ? 'Save The Date Title' : 'Kichwa cha Ujumbe (Save The Date Title)'}</label>
              <input 
                type="text" 
                value={stdTitle}
                onChange={(e) => {
                  setStdTitle(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full bg-slate-900 border border-white/10 p-3 rounded-xl text-xs outline-none text-slate-205"
                placeholder={isEn ? "Save The Date - Special Wedding" : "Save The Date - Harusi Maalum"}
              />
            </div>

            {/* UP LOAD YA PICHA / kadi yenye aspect ratio thabiti */}
            <div className="space-y-1">
              <label className="font-bold text-slate-400 block">{isEn ? 'Upload Save The Date Card Image (Aspect Ratio: 9:13)' : 'Pakia Picha ya Kadi ya Save The Date (Aspect Ratio: 9:13)'}</label>
              
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-rose-550/50 p-6 rounded-2xl cursor-pointer hover:bg-slate-900/60 transition group relative">
                <Upload className="w-8 h-8 text-slate-450 mb-2 group-hover:text-rose-400 transition" />
                <span className="text-xs text-slate-350 font-bold group-hover:text-white transition">
                  {selectedFile ? (isEn ? '✓ Image Uploaded' : '✓ Picha ya Save The Date Imepakiwa') : (isEn ? 'Choose / Drag Image (JPEG, PNG)' : 'Chagua / Drag Picha ya Save The Date (JPEG, PNG)')}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-1">{isEn ? 'Aspect ratio will be automatically matched' : 'Aspect ratio italinganishwa otomatiki na Kadi kuu'}</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            </div>

            {/* Template input with placeholder tags */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="font-bold text-slate-400 block">{isEn ? 'Message Text Template' : 'Template ya Maneno ya Ujumbe'}</label>
                <div className="flex gap-1">
                  <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-md font-mono">{"{name}"}</span>
                  <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-md font-mono">{"{link}"}</span>
                  <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-md font-mono">{"{aina}"}</span>
                  <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-md font-mono">{"{muda}"}</span>
                  <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-md font-mono">{"{ukumbi}"}</span>
                </div>
              </div>
              <textarea 
                rows={4}
                value={stdTemplate}
                onChange={(e) => {
                  setStdTemplate(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full bg-slate-900 border border-white/10 p-3.5 rounded-xl font-mono text-xs outline-none text-slate-200 leading-relaxed focus:border-rose-550/45 resize-none"
                placeholder="Andika ujumbe hapa..."
              />
            </div>

            {/* Database Sync Badge Alert */}
            <div className="pt-1">
              {isDirty ? (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl p-4 flex items-start gap-3 text-[11px] leading-relaxed font-sans">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-extrabold uppercase block text-amber-305">
                      {isEn ? "⚠️ Save The Date Card not yet saved!" : "⚠️ Kadi bado haijahifadhiwa kwenye database!"}
                    </span>
                    {isEn ? (
                      <>
                        You have edited the Save The Date image style or message. Please click the green button <strong>"Save Save The Date Config"</strong> to commit changes to the database before generating or dispatching links.
                      </>
                    ) : (
                      <>
                        Umekamilisha kurekebisha picha au maneno kwenye muundo wa Save The Date. Tafadhali bofya kitufe cha kijani cha <strong>"Hifadhi Taarifa za Save The Date"</strong> sasa ili kuhifadhi thabiti, kisha ndio utengeneze au utume viungo kwa wageni.
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-2xl p-4 flex items-start gap-3 text-[11px] leading-relaxed font-sans">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5 animate-pulse" />
                  <div>
                    <span className="font-extrabold uppercase block text-emerald-300">{isEn ? '✓ Everything is Saved' : '✓ Kila Kitu Kimehifadhiwa'}</span>
                    {isEn ? 'The Save The Date card and image have been successfully saved to the database and are ready for use.' : 'Kadi na Picha ya Save The Date imeandikwa kikamilifu kwenye database ya kudumu na ipo tayari kwa matumizi.'}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSaveSaveTheDateConfig}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:shadow-[0_0_15px_rgba(16,185,129,0.25)] text-white font-extrabold rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{isEn ? 'Save The Date Information' : 'Hifadhi Taarifa za Save The Date'}</span>
            </button>
          </div>
        </div>

        {/* Right pane - Beautiful Premium Phone Simulator Custom Preview Panel */}
        <div className="lg:col-span-5 flex flex-col items-center space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono self-start flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-rose-455" />
            <span>{isEn ? 'Our Save The Date Card' : 'Kadi Yetu ya Save The Date'}</span>
          </h3>

          {/* Matches exactly physical aspect ratio 450:650 inside a luxurious preview box */}
          <div className="w-full max-w-[290px] aspect-[450/650] rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl bg-slate-950 relative group">
            {selectedFile ? (
              <img 
                referrerPolicy="no-referrer"
                src={selectedFile} 
                alt="Uploaded Save the date" 
                className="w-full h-full object-cover transition-transform duration-700"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-slate-900 to-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-12 h-12 bg-rose-500/10 rounded-full border border-rose-500/20 flex items-center justify-center">
                  <Heart className="w-6 h-6 text-rose-400 fill-rose-500" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{isEn ? 'No Card Image' : 'Bila Picha ya Kadi'}</p>
                  <p className="text-slate-400 text-[10px] mt-1">{isEn ? 'Upload your invitation image on the left to see it here.' : 'Pakia picha ya kadi yako ya mwaliko / nukuu kushoto ili ionekane hapa na vipimo thabiti!'}</p>
                </div>
              </div>
            )}

            {/* Overlay banner mimicking the actual card on client link */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 text-center select-none font-sans">
              <p className="text-[9px] text-[#fb7185] tracking-widest font-bold uppercase">SAVE THE DATE</p>
              <p className="text-white font-extrabold text-xs tracking-tight truncate uppercase">{eventDetails.name || 'SHEREHE MAALUM'}</p>
              <p className="text-slate-350 text-[9px] font-mono mt-0.5">Siku: {eventDetails.date}</p>
            </div>
          </div>

          {/* SMS / WhatsApp compiled visual bubble help */}
          <div className="w-full bg-[#0c141a] border border-white/15 p-4 rounded-2xl space-y-1">
            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{isEn ? 'Message Preview' : 'Mfano wa Ujumbe wa Kutuma'}</span>
            </p>
            <p className="text-[10.5px] text-slate-300 font-mono leading-relaxed whitespace-pre-wrap select-all bg-black/30 p-2.5 rounded-lg border border-white/5">
              {previewMessage}
            </p>
          </div>
        </div>

      </div>

      {/* 3. Automatic Confirmed Filtered Guests Panel */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-6 rounded-[1.75rem] space-y-4">
        
        {/* Swahili Filter Header Layout with Dual Channel Options */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-widest uppercase flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-450" />
              <span>{isEn ? `Recipients List (${activeFilteredGuests.length} In List)` : `Orodha ya Wageni Watakaotumiwa (${activeFilteredGuests.length} Kwenye Orodha)`}</span>
            </h3>
            <p className="text-slate-400 text-[11px] mt-0.5">
              {isEn ? 'RSVP estimates are synced directly from the main RSVP module.' : 'Makisio ya RSVP yanatolewa moja kwa moja kutoka kwenye moduli kuu ya RSVP ili kupanga vyema utumaji wa Save The Date.'}
            </p>
          </div>

          <div className="flex gap-2 shrink-0 flex-wrap">
            {/* Channel Selection Options */}
            <div className="flex bg-[#050b18]/60 p-0.5 rounded-xl border border-white/10 shadow-inner">
              <button 
                onClick={() => setChannel('sms')} 
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-all flex items-center gap-1 cursor-pointer ${channel === 'sms' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <span>SMS</span>
                <span className="text-[8px] bg-black/20 px-1 py-0.1 rounded font-mono font-bold">{gatewaySettings.senderId}</span>
              </button>
              <button 
                onClick={() => setChannel('whatsapp')} 
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-all flex items-center gap-1 cursor-pointer ${channel === 'whatsapp' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <span>WhatsApp</span>
              </button>
            </div>

            <button
              onClick={handleSendToAllFiltered}
              disabled={sendingAll || activeFilteredGuests.length === 0}
              className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 text-white text-[11px] font-extrabold uppercase tracking-wider rounded-xl transition shadow hover:shadow-[0_0_12px_rgba(244,63,94,0.3)] flex items-center gap-1.5 disabled:opacity-50 disabled:hover:shadow-none disabled:cursor-not-allowed cursor-pointer disabled:bg-white/10"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingAll ? (isEn ? 'Sending...' : 'Inatuma...') : (isEn ? 'Send to this Group' : 'Tuma kwa Kikundi Hiki')}</span>
            </button>
          </div>
        </div>

        {/* RSVP Filter Categories Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-white/5 text-[10.5px]">
          <button
            onClick={() => setRsvpFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all font-bold uppercase cursor-pointer ${rsvpFilter === 'all' ? 'bg-slate-800 text-white border border-white/10' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {isEn ? 'All' : 'Wote'} ({guests.filter(g => g.eventId === eventDetails.id || (!g.eventId && eventDetails.id === 'event-starter')).length})
          </button>
          <button
            onClick={() => setRsvpFilter('confirmed')}
            className={`px-3 py-1.5 rounded-lg transition-all font-bold uppercase cursor-pointer flex items-center gap-1 ${rsvpFilter === 'confirmed' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {isEn ? 'Confirmed RSVP' : 'Waliodhibitisha RSVP'} ({guests.filter(g => (g.eventId === eventDetails.id || (!g.eventId && eventDetails.id === 'event-starter')) && g.rsvpStatus === 'Atahudhuria').length})
          </button>
          <button
            onClick={() => setRsvpFilter('pending')}
            className={`px-3 py-1.5 rounded-lg transition-all font-bold uppercase cursor-pointer flex items-center gap-1 ${rsvpFilter === 'pending' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            {isEn ? 'Pending RSVP' : 'Bado Hawajajibu'} ({guests.filter(g => (g.eventId === eventDetails.id || (!g.eventId && eventDetails.id === 'event-starter')) && (!g.rsvpStatus || g.rsvpStatus === 'Bado')).length})
          </button>
          <button
            onClick={() => setRsvpFilter('declined')}
            className={`px-3 py-1.5 rounded-lg transition-all font-bold uppercase cursor-pointer flex items-center gap-1 ${rsvpFilter === 'declined' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-450"></span>
            {isEn ? 'Declined' : 'Waliokataa'} ({guests.filter(g => (g.eventId === eventDetails.id || (!g.eventId && eventDetails.id === 'event-starter')) && g.rsvpStatus === 'Hatahudhuria').length})
          </button>
        </div>

        {/* Dispatch Progress Logs of "Tuma Kwa Wote" if executing */}
        {sendingAll && (
          <div className="bg-slate-950 p-4 rounded-2xl border border-rose-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-455 uppercase tracking-widest font-mono animate-pulse">Inatuma Save the Date kwa kikundi sasa...</span>
              <span className="text-xs font-mono font-bold text-white">{sentCount} / {activeFilteredGuests.length} wageni</span>
            </div>
            {/* Simple static bar wrapper */}
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-300"
                style={{ width: `${(sentCount / activeFilteredGuests.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
          <div className="lg:col-span-8 flex flex-col space-y-4">
            {activeFilteredGuests.length === 0 ? (
              <div className="backdrop-blur-md bg-rose-500/5 border border-dashed border-rose-500/20 p-8 rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 bg-rose-500/10 rounded-full border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="font-extrabold text-white text-xs">{isEn ? 'No Guests Found in this Group!' : 'Bado Hakuna Hageni Kwenye Kikundi Hiki!'}</p>
              <p className="text-slate-400 text-[10.5px] leading-relaxed max-w-sm mx-auto mt-1">
                {isEn ? 'No guests were found using the current filter. Try changing the filter to view other groups.' : 'Hakuna wageni walioainishwa hapa kwa kutumia chujio cha sasa. Unaweza kubadilisha chujio ili kuangalia makundi mengine.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[650px] pr-1">
            {activeFilteredGuests.map((g, idx) => {
              const stdLink = `${window.location.origin}/?invite=${g.code || g.id}&std=true&eventId=${eventDetails.id}&lang=${language}`;
              const inviteLink = `${window.location.origin}/?invite=${g.code || g.id}&eventId=${eventDetails.id}&lang=${language}`;

              return (
                <div 
                  id={`guest-card-${g.id}`} 
                  key={g.id} 
                  className={`backdrop-blur-md bg-[#0c1328]/40 border ${sentGuestsMap[g.id] ? 'border-rose-500/30' : 'border-white/5'} p-3 rounded-2xl flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between hover:border-white/10 transition-all duration-300 gap-3`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white text-[12px] font-extrabold uppercase truncate" title={g.name}>
                        {idx + 1}. {g.name}
                      </span>
                      {sentGuestsMap[g.id] && (
                        <span className="inline-flex bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider font-extrabold items-center gap-0.5">
                          <Check className="w-2.5 h-2.5 shrink-0"/> {isEn ? 'Sent' : 'Imetumwa'}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-bold font-mono border whitespace-nowrap ${
                        g.rsvpStatus === 'Atahudhuria' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                        g.rsvpStatus === 'Hatahudhuria' ? 'bg-rose-500/15 border-rose-500/30 text-rose-350' :
                        g.rsvpStatus === 'Labda' ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
                        'bg-slate-500/15 border-slate-500/30 text-slate-400'
                      }`}>
                        {g.rsvpStatus === 'Bado' || !g.rsvpStatus ? (isEn ? 'Pending' : 'Bado Jibu') : (isEn ? (g.rsvpStatus === 'Atahudhuria' ? 'Attending' : g.rsvpStatus === 'Hatahudhuria' ? 'Declined' : 'Maybe') : g.rsvpStatus)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 font-mono">
                      <span>{g.phone || (isEn ? 'No Phone' : 'Bila Namba')}</span>
                      <span className="w-1 h-1 rounded-full bg-white/20 hidden sm:block"></span>
                      <span className="hidden sm:inline">CODE: {g.code || (isEn ? 'None' : 'Bila')}</span>
                      {renderDeliveryIndicator(g) && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-white/20 hidden sm:block"></span>
                          {renderDeliveryIndicator(g)}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <button
                      onClick={() => setExpandedLinks(p => ({ ...p, [g.id]: !p[g.id] }))}
                      className="px-2 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-white/5 text-[9px] uppercase tracking-wider font-extrabold flex items-center justify-center cursor-pointer transition-all"
                      title="Viungo (Links)"
                    >
                      <Globe className="w-3.5 h-3.5" />
                    </button>
                    
                    <button
                      onClick={() => setViewGuestStd(g)}
                      className="px-2 py-1.5 bg-white/5 hover:bg-rose-500/10 hover:text-rose-455 text-slate-400 border border-white/5 rounded-lg text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-all leading-none"
                      title={isEn ? "View Save the Date for this guest" : "View Save the Date ya mgeni huyu"}
                    >
                      <Eye className="w-3.5 h-3.5 text-rose-400" />
                      <span className="hidden lg:inline">{isEn ? 'Card' : 'Kadi'}</span>
                    </button>

                    <button 
                      onClick={() => handleSendSingle(g, 'whatsapp')}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[9.5px] font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5 fill-white shrink-0" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.1 1.45 4.6 1.45 5.5.003 10-4.5 10-10C21.2 5.1 16.7.6 11.2.6 5.7.6 1.2 5.1 1.2 10.6c-.001 1.7.5 3.3 1.4 4.8l-1 3.6 3.7-.9z" />
                      </svg>
                      <span className="hidden lg:inline">WhatsApp</span>
                    </button>

                    <button 
                      onClick={() => handleSendSingle(g, 'sms')}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[9.5px] font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden lg:inline">SMS</span>
                    </button>
                  </div>

                  {expandedLinks[g.id] && (
                    <div className="w-full basis-full bg-black/40 p-2.5 rounded-xl border border-white/5 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-[9px]">
                        <span className="text-rose-400 font-bold uppercase tracking-wide flex items-center gap-1 leading-none">
                          <Heart className="w-3 h-3 fill-rose-500/20 animate-pulse shrink-0" /> Save the Date Link:
                        </span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(stdLink);
                            showToast(`✓ Kiungo cha SAVE THE DATE cha mgeni ${g.name} kimenakiliwa vizuri!`);
                          }}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-mono border border-white/10 text-[8px] cursor-pointer"
                        >
                          Nakili STD
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between text-[9px] pt-1.5 border-t border-white/5">
                        <span className="text-indigo-400 font-bold uppercase tracking-wide flex items-center gap-1 leading-none">
                          <Globe className="w-3 h-3 text-indigo-400 shrink-0" /> Mwaliko Rasmi Link:
                        </span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(inviteLink);
                            showToast(`✓ Kiungo cha MWALIKO RASMI cha mgeni ${g.name} kimenakiliwa vizuri!`);
                          }}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-mono border border-white/10 text-[8px] cursor-pointer"
                        >
                          Nakili Mwaliko
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>

        {/* Right simulated cloud logger (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          <h4 className="font-bold text-slate-300 text-[10px] uppercase font-mono tracking-wider">{isEn ? 'Transactions and Send Logs' : 'Miamala na Kumbukumbu ya Kutuma (Logs)'}</h4>
          <div className="flex-grow bg-slate-950/60 rounded-2xl p-4 font-mono text-[9px] h-[300px] overflow-y-auto border border-white/10 space-y-1.5 leading-relaxed antialiased">
            {sendLogs.length === 0 ? (
              <p className="text-slate-600 italic">Kubonyeza "Tuma kwa Kikundi Hiki" au kutuma kadi moja mmoja kutaorodhesha taarifa za kadi hapa...</p>
            ) : (
              sendLogs.map((log, i) => {
                const isError = log.includes('✗') || log.includes('Imeshindwa') || log.includes('Hitilafu');
                return (
                  <div key={i} className={`animate-fade-in ${isError ? 'text-rose-400 font-semibold' : 'text-emerald-400'}`}>
                    {log}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      </div>

      {/* 4. Modal Lightbox: Save The Date Card Preview for Specific Guest */}
      <AnimatePresence>
        {viewGuestStd && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="backdrop-blur-xl bg-[#090f1d] rounded-3xl p-6 max-w-sm w-full border border-white/10 shadow-2xl relative flex flex-col items-center space-y-4 text-white"
            >
              <button 
                onClick={() => setViewGuestStd(null)}
                className="absolute top-4 right-4 text-slate-300 hover:text-white bg-white/10 p-1.5 rounded-full hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-1">
                <span className="px-3 py-1 bg-rose-500/15 text-rose-400 border border-rose-500/20 rounded-full text-[9px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1">
                  <Heart className="w-2.5 h-2.5 fill-rose-500 animate-pulse" />
                  <span>PREVIEW KADI YA SAVE THE DATE</span>
                </span>
                <h4 className="text-xs text-slate-400 italic">{isEn ? 'Guest' : 'Mgeni'}: <span className="font-extrabold text-white not-italic uppercase">{viewGuestStd.name}</span></h4>
              </div>

              {/* Aspect Ratio 9:13 Card Display */}
              <div className="mx-auto w-full aspect-[450/650] max-w-[270px] rounded-2xl overflow-hidden border border-white/15 shadow-xl bg-slate-900 relative">
                {selectedFile ? (
                  <img 
                    referrerPolicy="no-referrer"
                    src={selectedFile} 
                    alt="Save The Date Card" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-slate-950 to-slate-900 flex flex-col items-center justify-center p-4 text-center space-y-2 overflow-hidden">
                    <Heart className="w-8 h-8 text-rose-500 fill-rose-550/20" />
                    <p className="text-xs font-bold">Bila Picha Kadi</p>
                    <p className="text-slate-500 text-[9px]">Pakia picha ya kadi yako ya Save the Date upande wa kushoto.</p>
                  </div>
                )}
                
                {/* Subtle visual overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent p-4 text-center">
                  <p className="text-[8px] text-rose-355 tracking-widest font-extrabold uppercase">SAVE THE DATE</p>
                  <p className="text-white font-extrabold text-[11px] truncate uppercase">{eventDetails.name || 'SHEREHE MAALUM'}</p>
                  <p className="text-slate-350 text-[8.5px] font-mono mt-0.5">Siku: {eventDetails.date}</p>
                </div>
              </div>

              {/* Info text sample */}
              <div className="bg-[#0c141a] border border-white/10 p-3.5 rounded-xl w-full text-left space-y-1">
                <span className="text-[9px] font-bold text-rose-455 uppercase tracking-widest font-mono flex items-center gap-1.5 leading-none">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Message for this Guest' : 'Ujumbe wa Mgeni Huyu'} ({viewGuestStd.phone})</span>
                </span>
                <p className="text-[10px] text-slate-300 font-mono leading-relaxed whitespace-pre-wrap max-h-24 overflow-y-auto select-all">
                  {getCompiledMessage(viewGuestStd)}
                </p>
              </div>

              <div className="w-full pt-1">
                <button
                  type="button"
                  onClick={() => setViewGuestStd(null)}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-xl font-extrabold transition text-xs cursor-pointer"
                >
                  Funga Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Non-blocking Iframe-Safe Toast notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 border max-w-sm backdrop-blur ${
              toast.type === 'error' 
                ? 'bg-rose-950/90 text-rose-200 border-rose-500/30' 
                : toast.type === 'info' 
                ? 'bg-slate-900/90 text-sky-200 border-sky-500/30' 
                : 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30'
            }`}
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-xs font-bold font-mono">{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Non-blocking Iframe-Safe Custom Confirm Dialog */}
      <AnimatePresence>
        {confirmModal?.show && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center"
            >
              <AlertCircle className="w-12 h-12 text-indigo-400 mx-auto animate-bounce" />
              <div className="space-y-1">
                <h3 className="text-white font-extrabold text-base tracking-tight">{confirmModal.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{confirmModal.message}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={confirmModal.onCancel}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all cursor-pointer border border-white/5"
                >
                  Ghairi (Hapana)
                </button>
                <button
                  type="button"
                  onClick={confirmModal.onConfirm}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  Kubali (Ndiyo)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
