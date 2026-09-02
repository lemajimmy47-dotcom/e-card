import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Send, RefreshCw, CheckCircle, MessageCircle, AlertCircle, PlayCircle, ArrowRight, X, Clipboard, Check, ExternalLink, Smartphone, MessageSquare } from 'lucide-react';
import { EventDetails, Guest, TemplateSettings } from '../types';
import { drawCardToCanvas, generateGuestCardImage, preloadImage } from '../utils/canvasHelper';
import { safeLocalStorage } from '../utils/storage';
import { convertWebPToJpeg } from '../utils/imageUtils';
import { isStatusSent } from '../utils/statusHelper';

interface SendMessagesProps {
  event: EventDetails;
  settings: TemplateSettings;
  guests: Guest[];
  language: string;
  onUpdateEvent: (event: EventDetails) => void;
  onUpdateGuests: (guests: Guest[], actionDesc?: string, skipServerSave?: boolean) => void;
  onNext: () => void;
}

const PortalModal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return createPortal(children, document.body);
};

export default function SendMessages({ event, settings, guests, language, onUpdateEvent, onUpdateGuests, onNext }: SendMessagesProps) {
  const isEn = language === 'en';

  const addSystemNotification = (type: 'payment' | 'pledge' | 'completed' | 'error' | 'guest' | 'rsvp', title: string, message: string) => {
    try {
      const saved = localStorage.getItem(`kadi_committee_notifications_${event.id}`);
      const list = saved ? JSON.parse(saved) : [];
      const newNotif = {
        id: 'n-auto-' + Date.now() + Math.random().toString(36).substr(2, 5),
        type,
        title,
        message,
        createdAt: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
        read: false
      };
      const updated = [newNotif, ...list].slice(0, 50);
      localStorage.setItem(`kadi_committee_notifications_${event.id}`, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: () => {}
  });
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [isBatchSending, setIsBatchSending] = useState(false);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [currentSendingIndex, setCurrentSendingIndex] = useState(-1);
  const [sendLogs, setSendLogs] = useState<string[]>([]);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [messageType, setMessageType] = useState<'invitation' | 'reminder' | 'thank-you'>('invitation');
  const [thankYouAudience, setThankYouAudience] = useState<'all' | 'confirmed' | 'attended'>('attended');

  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');

  const [activeSendTarget, setActiveSendTarget] = useState<{ guest: Guest, channel: 'sms' | 'whatsapp' } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [modalCardUrl, setModalCardUrl] = useState<string>('');
  const [modalImageLoaded, setModalImageLoaded] = useState<boolean>(false);
  const [copyImageSuccess, setCopyImageSuccess] = useState(false);

  useEffect(() => {
    if (!activeSendTarget) {
      setModalCardUrl('');
      setModalImageLoaded(false);
      return;
    }
    const guest = activeSendTarget.guest;
    const canvas = document.createElement('canvas');
    
    const scaleFactor = 3;
    canvas.width = (settings.orientation === 'landscape' ? 600 : 450) * scaleFactor;
    canvas.height = (settings.orientation === 'landscape' ? 450 : 600) * scaleFactor;
    setModalImageLoaded(false);
    drawCardToCanvas(
      canvas, 
      event, 
      settings, 
      guest.name.toUpperCase(), 
      guest.cardType, 
      guest.code ? `EVENTCARD-${guest.code}` : `EVENTCARD-${guest.id}`,
      () => {
        setModalCardUrl(canvas.toDataURL('image/jpeg', 0.95));
        setModalImageLoaded(true);
      }
    );
  }, [activeSendTarget, messageType, event, settings]);

  const handleCopyImageToClipboard = async () => {
    if (!modalCardUrl) return;
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard || !navigator.clipboard.write) {
        alert('Mfumo wa kivinjari chako hauruhusu kunakili picha moja kwa moja. Tafadhali bonyeza kitufe cha "Pakua Picha ya Kadi" hapo chini ili kuipakua na kuituma kwa WhatsApp.');
        return;
      }
      const response = await fetch(modalCardUrl);
      const blob = await response.blob();
      
      let finalBlob = blob;
      if (blob.type !== 'image/png') {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            canvas.toBlob((pngBlob) => {
              if (pngBlob) {
                finalBlob = pngBlob;
                resolve();
              } else {
                reject(new Error('PNG conversion failed'));
              }
            }, 'image/png');
          };
          img.onerror = reject;
          img.src = modalCardUrl;
        });
      }

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': finalBlob })
      ]);
      setCopyImageSuccess(true);
      setTimeout(() => setCopyImageSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to copy image to clipboard:', err);
      alert('Imeshindwa kunakili picha kiotomatiki. Tafadhali bonyeza kitufe cha "Pakua Picha ya Kadi" chini kuipakua kwenye simu yako kisha uitume kwa WhatsApp.');
    }
  };

  // SMS & WhatsApp Gateway Config states
  const [gatewaySettings, setGatewaySettings] = useState({
    provider: 'simulation',
    url: '',
    apiKey: '',
    apiSecret: '',
    senderId: '',
    senderIdStatus: 'approved' as 'pending' | 'approved' | 'rejected',
    whatsappUrl: '',
    customHeaders: '{}',
    customBody: '{\n  "to": "{to}",\n  "message": "{message}"\n}'
  });

  const isMetaWhatsApp = React.useMemo(() => {
    if (!gatewaySettings.whatsappUrl) return false;
    if (gatewaySettings.whatsappUrl.trim().startsWith('{') && gatewaySettings.whatsappUrl.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(gatewaySettings.whatsappUrl);
        return parsed.provider === 'meta';
      } catch(e) { return false; }
    }
    return false;
  }, [gatewaySettings.whatsappUrl]);

  const metaTemplateName = React.useMemo(() => {
    if (!gatewaySettings.whatsappUrl) return null;
    try {
      const parsed = JSON.parse(gatewaySettings.whatsappUrl);
      return parsed.template_name || null;
    } catch(e) { return null; }
  }, [gatewaySettings.whatsappUrl]);

  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);
  const [isSavingGateway, setIsSavingGateway] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Editing individual guest states
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [editGuestName, setEditGuestName] = useState('');
  const [editGuestPhone, setEditGuestPhone] = useState('');
  const [editGuestType, setEditGuestType] = useState('DOUBLE');
  const [editCustomCategoryInput, setEditCustomCategoryInput] = useState('');

  // Toggle for sending physical link in SMS (Default: false inline with visitor's preference to conserve balance)
  const [sendSmsLink, setSendSmsLink] = useState<boolean>(() => {
    const saved = safeLocalStorage.getItem('send_sms_link');
    return saved === 'true'; // Default is false because 'saved' is null/undefined initially
  });

  useEffect(() => {
    safeLocalStorage.setItem('send_sms_link', String(sendSmsLink));
  }, [sendSmsLink]);

  // Template Editing states
  const oldDefaultEn = `Hello {name},
The family of {host_name} together with the Organizing Committee, are pleased to welcome you to join us for {event_name}.

EVENT DETAILS
Date: {date}
Venue: {venue}
Time: {time}
Card No: {card_number}
Card Type: {card_type}

Please click this link to view your special invitation card and confirm your attendance (RSVP):
{kiungo}

Contacts:
- {contact_1_name}: {contact_1_phone}
- {contact_2_name}: {contact_2_phone}

You are warmly welcome!`;

  const newDefaultEn = `Hello {name},
The family of {host_name} , are pleased to welcome you to join us for {event_name}.

EVENT DETAILS
Date: {date}
Venue: {venue}
Time: {time}
Card No: {card_number}
Card Type: {card_type}

{Link}

Contacts:
- {contact_1_name}: {contact_1_phone}
- {contact_2_name}: {contact_2_phone}

You are warmly welcome!`;

  const oldDefaultSw = `Habari {name},
Familia ya {host_name} kwa kushirikiana na Kamati ya Maandalizi, wanayo furaha kubwa kukukaribisha kushiriki katika {event_name}.

TAARIFA ZA SHEREHE
Tarehe: {date}
Ukumbi: {venue}
Muda: {time}
Kadi Na: {card_number}
Aina ya Kadi: {card_type}

Bofya kiungo hiki ili kuona kadi yako ya mwaliko, ramani ya ukumbi, na kuthibitisha mahudhurio yako (RSVP):
{kiungo}

Mawasiliano:
- {contact_1_name}: {contact_1_phone}
- {contact_2_name}: {contact_2_phone}

Karibu sana.`;

  const oldDefaultSw2 = `Habari {name},
Familia ya {host_name} kwa kushirikiana na Kamati ya Maandalizi, wanayo furaha kubwa kukukaribisha kushiriki katika {event_name}.

TAARIFA ZA SHEREHE

Tarehe: {date}
Ukumbi: {venue}
Muda: {time}
Kadi Na: {card_number}
Aina ya Kadi: {card_type}

Uwepo wako ni wa thamani kubwa kwetu na utachangia kuifanya siku hii kuwa ya furaha na kumbukumbu nzuri.

Ikiwa namba hii ipo WhatsApp, kadi yako ya mwaliko imetumwa huko pia.

Mawasiliano:
- {contact_1_name}: {contact_1_phone}
- {contact_2_name}: {contact_2_phone}

Karibu sana.`;

  const oldDefaultEn2 = `Hello {name},
The family of {host_name} in collaboration with the Organizing Committee, are pleased to welcome you to participate in {event_name}.

EVENT DETAILS

Date: {date}
Venue: {venue}
Time: {time}
Card No: {card_number}
Card Type: {card_type}

Your presence is highly valued and will contribute to making this day joyous and memorable.

If this number is on WhatsApp, your invitation card has been sent there as well.

Contact:
- {contact_1_name}: {contact_1_phone}
- {contact_2_name}: {contact_2_phone}

You are warmly welcome.`;

  const newDefaultSw = `Habari {name},
Familia ya {host_name} , inayo furaha kubwa kukukaribisha kushiriki katika {event_name}.

TAARIFA ZA SHEREHE
Tarehe: {date}
Ukumbi: {venue}
Muda: {time}
Kadi Na: {card_number}
Aina ya Kadi: {card_type}

{Link}

Mawasiliano:
- {contact_1_name}: {contact_1_phone}
- {contact_2_name}: {contact_2_phone}

Karibu sana!`;

  const upgradeTemplate = (text: string | null | undefined, newText: string, oldTexts: string[]): string => {
    if (!text) return newText;
    const cleanText = text.trim().replace(/\\r\\n/g, '\\n');
    for (const oldText of oldTexts) {
      if (cleanText === oldText.trim().replace(/\\r\\n/g, '\\n')) return newText;
    }
    return text;
  };

  const [invitationTemplateSw, setInvitationTemplateSw] = useState<string>(() => {
    const fromEvent = event?.smsTemplates?.invitationTemplateSw;
    if (fromEvent) {
      return upgradeTemplate(fromEvent, newDefaultSw, [oldDefaultSw, oldDefaultSw2]);
    }
    const key = event?.id ? `kadi_message_template_${event.id}_sw_v2` : 'kadi_message_template_sw_v2';
    const saved = safeLocalStorage.getItem(key);
    if (saved) {
      return upgradeTemplate(saved, newDefaultSw, [oldDefaultSw, oldDefaultSw2]);
    }
    return newDefaultSw;
  });

  const [invitationTemplateEn, setInvitationTemplateEn] = useState<string>(() => {
    const fromEvent = event?.smsTemplates?.invitationTemplateEn;
    if (fromEvent) {
      return upgradeTemplate(fromEvent, newDefaultEn, [oldDefaultEn, oldDefaultEn2]);
    }
    const key = event?.id ? `kadi_message_template_${event.id}_en_v2` : 'kadi_message_template_en_v2';
    const saved = safeLocalStorage.getItem(key);
    if (saved) {
      return upgradeTemplate(saved, newDefaultEn, [oldDefaultEn, oldDefaultEn2]);
    }
    return newDefaultEn;
  });

  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [isTemplateSaving, setIsTemplateSaving] = useState(false);
  const [templateSavedSuccess, setTemplateSavedSuccess] = useState(false);

  // Sync state when event.id changes or database config updates
  useEffect(() => {
    if (event?.id) {
      const savedSw = event.smsTemplates?.invitationTemplateSw || safeLocalStorage.getItem(`kadi_message_template_${event.id}_sw`);
      if (savedSw) {
        setInvitationTemplateSw(upgradeTemplate(savedSw, newDefaultSw, [oldDefaultSw, oldDefaultSw2]));
      } else {
        const fallbackSw = safeLocalStorage.getItem('kadi_message_template_sw') || safeLocalStorage.getItem('kadi_message_template');
        if (fallbackSw) {
          setInvitationTemplateSw(upgradeTemplate(fallbackSw, newDefaultSw, [oldDefaultSw, oldDefaultSw2]));
        } else {
          setInvitationTemplateSw(newDefaultSw);
        }
      }

      const savedEn = event.smsTemplates?.invitationTemplateEn || safeLocalStorage.getItem(`kadi_message_template_${event.id}_en`);
      if (savedEn) {
        setInvitationTemplateEn(upgradeTemplate(savedEn, newDefaultEn, [oldDefaultEn, oldDefaultEn2]));
      } else {
        const fallbackEn = safeLocalStorage.getItem('kadi_message_template_en');
        if (fallbackEn) {
          setInvitationTemplateEn(upgradeTemplate(fallbackEn, newDefaultEn, [oldDefaultEn, oldDefaultEn2]));
        } else {
          setInvitationTemplateEn(newDefaultEn);
        }
      }
    }
  }, [event?.id, event?.smsTemplates]);

  const handleSaveTemplate = () => {
    setIsTemplateSaving(true);
    setTemplateSavedSuccess(false);

    // Save to local storage
    if (event?.id) {
      safeLocalStorage.setItem(`kadi_message_template_${event.id}_sw`, invitationTemplateSw);
      safeLocalStorage.setItem(`kadi_message_template_${event.id}_en`, invitationTemplateEn);
      safeLocalStorage.setItem(`kadi_thanks_template_${event.id}_sw`, thankYouTemplateSw);
      safeLocalStorage.setItem(`kadi_thanks_template_${event.id}_en`, thankYouTemplateEn);
    }
    safeLocalStorage.setItem('kadi_message_template_sw', invitationTemplateSw);
    safeLocalStorage.setItem('kadi_message_template_en', invitationTemplateEn);
    safeLocalStorage.setItem('kadi_thanks_template_sw', thankYouTemplateSw);
    safeLocalStorage.setItem('kadi_thanks_template_en', thankYouTemplateEn);

    // Save to general database state
    if (onUpdateEvent && event) {
      onUpdateEvent({
        ...event,
        smsTemplates: {
          ...(event.smsTemplates || {}),
          invitationTemplateSw,
          invitationTemplateEn,
          generalThanksSw: thankYouTemplateSw,
          generalThanksEn: thankYouTemplateEn
        }
      });
    }

    setTimeout(() => {
      setIsTemplateSaving(false);
      setTemplateSavedSuccess(true);
      setTimeout(() => setTemplateSavedSuccess(false), 2000);
    }, 400);
  };

  useEffect(() => {
    if (event?.id) {
      safeLocalStorage.setItem(`kadi_message_template_${event.id}_sw`, invitationTemplateSw);
    }
    safeLocalStorage.setItem('kadi_message_template_sw', invitationTemplateSw);
  }, [invitationTemplateSw, event?.id]);

  useEffect(() => {
    if (event?.id) {
      safeLocalStorage.setItem(`kadi_message_template_${event.id}_en`, invitationTemplateEn);
    }
    safeLocalStorage.setItem('kadi_message_template_en', invitationTemplateEn);
  }, [invitationTemplateEn, event?.id]);

  const [thankYouTemplateSw, setThankYouTemplateSw] = useState<string>(() => {
    if (event?.smsTemplates?.generalThanksSw) {
      return event.smsTemplates.generalThanksSw;
    }
    const key = event?.id ? `kadi_thanks_template_${event.id}_sw` : 'kadi_thanks_template_sw';
    const saved = safeLocalStorage.getItem(key);
    if (saved) return saved;
    return `Habari {name},
Familia ya {host_name} inapenda kutoa shukrani za dhati kwa kuhudhuria {event_name}.
Ushiriki wako umefanya sherehe yetu kuwa ya kipekee na yenye baraka.

Mawasiliano:
- {contact_1_name}: {contact_1_phone}
- {contact_2_name}: {contact_2_phone}

Asante sana na Mungu akubariki!`;
  });

  const [thankYouTemplateEn, setThankYouTemplateEn] = useState<string>(() => {
    if (event?.smsTemplates?.generalThanksEn) {
      return event.smsTemplates.generalThanksEn;
    }
    const key = event?.id ? `kadi_thanks_template_${event.id}_en` : 'kadi_thanks_template_en';
    const saved = safeLocalStorage.getItem(key);
    if (saved) return saved;
    return `Hello {name},
The family of {host_name} would like to express our deepest gratitude for attending {event_name}.
Your presence made our event truly special and blessed.

Contacts:
- {contact_1_name}: {contact_1_phone}
- {contact_2_name}: {contact_2_phone}

Thank you very much and God bless you!`;
  });

  useEffect(() => {
    if (event?.id) {
      safeLocalStorage.setItem(`kadi_thanks_template_${event.id}_sw`, thankYouTemplateSw);

    }
    safeLocalStorage.setItem('kadi_thanks_template_sw', thankYouTemplateSw);
  }, [thankYouTemplateSw, event?.id]);

  useEffect(() => {
    if (event?.id) {
      safeLocalStorage.setItem(`kadi_thanks_template_${event.id}_en`, thankYouTemplateEn);
    }
    safeLocalStorage.setItem('kadi_thanks_template_en', thankYouTemplateEn);
  }, [thankYouTemplateEn, event?.id]);

  const activeTemplateValue = messageType === 'thank-you' 
    ? (language === 'en' ? thankYouTemplateEn : thankYouTemplateSw)
    : (language === 'en' ? invitationTemplateEn : invitationTemplateSw);
    
  const setActiveTemplateValue = (val: string) => {
    if (messageType === 'thank-you') {
      if (language === 'en') {
        setThankYouTemplateEn(val);
      } else {
        setThankYouTemplateSw(val);
      }
    } else {
      if (language === 'en') {
        setInvitationTemplateEn(val);
      } else {
        setInvitationTemplateSw(val);
      }
    }
  };

  // Load gateway configurations from API
  useEffect(() => {
    fetch('/api/sms-settings')
      .then(async (res) => {
        const contentType = res.headers.get("content-type");
        if (!res.ok) {
          if (contentType && contentType.includes("application/json")) {
            const errData = await res.json();
            throw new Error(errData.error || "Hairuhusu kusoma");
          }
          throw new Error(`Server returned error ${res.status}`);
        }
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          console.error("Non-JSON response from /api/sms-settings:", text.substring(0, 200));
          throw new Error("Server returned non-JSON response. This might happen if the server is restarting.");
        }
        return res.json();
      })
      .then(data => {
        if (data && data.provider) {
          setGatewaySettings(prev => ({ ...prev, ...data }));
        }
      })
      .catch(err => {
        console.error("Error fetching SMS/WA gateway settings:", err);
        // Silently ignore during initial mount if it's a common restart issue, 
        // or show a subtle notification if needed.
      });
  }, []);

  // BACKGROUND QUEUE JOBS STATE & ACTIONS
  const [queueJobs, setQueueJobs] = useState<any[]>([]);
  const [activeJob, setActiveJob] = useState<any>(null);

  const fetchQueueJobs = async () => {
    try {
      const res = await fetch('/api/queue/jobs');
      if (res.ok) {
        let jobs;
        try {
          jobs = await res.json();
        } catch (parseErr) {
          console.warn("Queue jobs endpoint returned non-JSON:", parseErr);
          return; // Ignore if not JSON (e.g. 502 Bad Gateway)
        }
        setQueueJobs(jobs);
        
        // Find if there is an active running/pending job
        const active = jobs.find((j: any) => j.status === 'running' || j.status === 'pending');
        if (active) {
          setActiveJob(active);
          // Sync log viewer with the background logs
          if (active.logs && active.logs.length > 0) {
            setSendLogs(active.logs.slice().reverse()); // Reverse to match the log viewer layout order
          }
        } else {
          const wasActive = activeJob;
          setActiveJob(null);
          // If a job just completed, fetch fresh guest list to show new statuses
          const lastActive = jobs[0];
          if (lastActive && lastActive.status === 'completed' && wasActive && wasActive.status !== 'completed') {
            if (onUpdateGuests) {
              fetch('/api/guests')
                .then(r => {
                  if (!r.ok) throw new Error(`HTTP ${r.status}`);
                  return r.json();
                })
                .then(data => {
                  if (Array.isArray(data)) {
                    onUpdateGuests(data, "Queue finished", false);
                  }
                })
                .catch(err => console.error("Error refreshing guests:", err));
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching queue jobs:", err);
    }
  };

  const handleControlQueue = async (jobId: string, action: 'pause' | 'resume' | 'cancel' | 'clear') => {
    try {
      const res = await fetch('/api/queue/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, action })
      });
      if (res.ok) {
        fetchQueueJobs();
      }
    } catch (err) {
      console.error("Error controlling queue job:", err);
    }
  };

  // Poll queue jobs if there is an active job running or periodically
  useEffect(() => {
    fetchQueueJobs();
    const interval = setInterval(() => {
      fetchQueueJobs();
    }, 2000);
    return () => clearInterval(interval);
  }, [activeJob?.id]);

  const insertPlaceholder = (tag: string) => {
    const textarea = document.getElementById('message-template-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const updated = before + tag + after;
      setActiveTemplateValue(updated);
      
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + tag.length;
      }, 50);
    } else {
      setActiveTemplateValue(activeTemplateValue + tag);
    }
  };

  const handleResetTemplate = () => {
    setShowResetConfirm(true);
  };

   const executeResetTemplate = () => {
      if (messageType === 'thank-you') {
      if (language === 'en') {
        setThankYouTemplateEn(`Hello {name},
The family of {host_name} would like to express our deepest gratitude for attending {event_name}.
Your presence made our event truly special and blessed.

Contacts:
- {contact_1_name}: {contact_1_phone}
- {contact_2_name}: {contact_2_phone}

Thank you very much and God bless you!`);
      } else {
        setThankYouTemplateSw(`Habari {name},
Familia ya {host_name} inapenda kutoa shukrani za dhati kwa kuhudhuria {event_name}.
Ushiriki wako umefanya sherehe yetu kuwa ya kipekee na yenye baraka.

Mawasiliano:
- {contact_1_name}: {contact_1_phone}
- {contact_2_name}: {contact_2_phone}

Asante sana na Mungu akubariki!`);
      }
    } else {
      if (language === 'en') {
        setInvitationTemplateEn(`Hello {name},
The family of {host_name} , are pleased to welcome you to join us for {event_name}.

EVENT DETAILS
Date: {date}
Venue: {venue}
Time: {time}
Card No: {card_number}
Card Type: {card_type}

{Link}

Contacts:
- {contact_1_name}: {contact_1_phone}
- {contact_2_name}: {contact_2_phone}

You are warmly welcome!`);
      } else {
        setInvitationTemplateSw(`Habari {name},
Familia ya {host_name} , inayo furaha kubwa kukukaribisha kushiriki katika {event_name}.

TAARIFA ZA SHEREHE
Tarehe: {date}
Ukumbi: {venue}
Muda: {time}
Kadi Na: {card_number}
Aina ya Kadi: {card_type}

{Link}

Mawasiliano:
- {contact_1_name}: {contact_1_phone}
- {contact_2_name}: {contact_2_phone}

Karibu sana!`);
      }
    }
  };

  // Get unique categories list dynamically for edit select category input dropdown
  const availableCategories = Array.from(new Set(guests.map(g => g.cardType).filter(Boolean)));

  const handleResetSingleGuest = (guestId: string, channel: 'sms' | 'whatsapp' | 'all' = 'all') => {
    const target = guests.find(g => g.id === guestId);
    const label = channel === 'sms' ? 'SMS' : channel === 'whatsapp' ? 'WhatsApp' : 'SMS na WhatsApp';
    const updated = guests.map(g => {
      if (g.id === guestId) {
        return {
          ...g,
          ...(channel === 'sms' || channel === 'all' ? { smsStatus: 'Sijatuma' as const, smsCount: 0 } : {}),
          ...(channel === 'whatsapp' || channel === 'all' ? { whatsappStatus: 'Sijatuma' as const, whatsappCount: 0 } : {})
        };
      }
      return g;
    });
    onUpdateGuests(updated, `Amefuta hali ya ${label} kwa mgeni: ${target?.name || guestId}`);
    
    if (target) {
      setSendLogs(prev => [
        `[${new Date().toLocaleTimeString()}] ↺ Hali ya ${label} imefutwa (Reset) kwa: ${target.name}`,
        ...prev
      ]);
    }
  };

  const handleStartEdit = (guest: Guest) => {
    setEditingGuest(guest);
    setEditGuestName(guest.name);
    setEditGuestPhone(guest.phone);
    setEditGuestType(['SINGLE', 'DOUBLE'].includes(guest.cardType) ? guest.cardType : 'UNCLASSIFIED');
  };

  const handleSaveEditGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuest) return;

    const finalType = ['SINGLE', 'DOUBLE'].includes(editGuestType) ? editGuestType : 'UNCLASSIFIED';
    const rsvpCount = finalType === 'DOUBLE' ? 2 : 1;

    const updatedGuest: Guest = {
      ...editingGuest,
      name: editGuestName.trim(),
      phone: editGuestPhone.trim(),
      cardType: finalType,
      rsvpGuestsCount: rsvpCount,
    };

    // Update guests list
    const updatedList = guests.map(g => g.id === editingGuest.id ? updatedGuest : g);
    onUpdateGuests(updatedList);

    setEditingGuest(null);
  };

  // Filtered guests based on message type - Memoized for performance, sorted alphabetically A-Z
  const filteredGuests = React.useMemo(() => {
    return guests
      .filter(g => {
        if (messageType === 'save_the_date') {
          return g.rsvpStatus === 'Atahudhuria';
        }
        if (messageType === 'thank-you') {
          if (thankYouAudience === 'attended') {
            return g.checkedIn === true;
          }
          if (thankYouAudience === 'confirmed') {
            return g.rsvpStatus === 'Atahudhuria';
          }
          // If 'all', return true
          return true;
        }
        return true;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'sw'));
  }, [guests, messageType, thankYouAudience]);

  // Status Metrics - Memoized
  const { countSmsSent, countWhatsappSent, countPending } = React.useMemo(() => {
    const sms = filteredGuests.filter(g => isStatusSent(g.smsStatus)).length;
    const wa = filteredGuests.filter(g => isStatusSent(g.whatsappStatus)).length;
    const pending = filteredGuests.filter(g => !isStatusSent(g.smsStatus) || !isStatusSent(g.whatsappStatus)).length;
    return { countSmsSent: sms, countWhatsappSent: wa, countPending: pending };
  }, [filteredGuests]);

  const getGuestMessageText = (g: Guest, isSms: boolean = false, forceAppendLink: boolean = false) => {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://eventcard.co.tz';
    const appUrl = `${currentOrigin}/?invite=${g.code || g.id}&eventId=${event.id}&lang=${language}`;

    let text = messageType === 'thank-you' 
      ? (language === 'en' ? thankYouTemplateEn : thankYouTemplateSw)
      : (language === 'en' ? invitationTemplateEn : invitationTemplateSw);
    const contacts = [event.contact1, event.contact2, event.contact3].filter(Boolean).join('\n');

    const translatePeriod = (p: string | null | undefined, lang: string) => {
      if (!p) return lang === 'en' ? "Afternoon" : "Mchana";
      if (lang === 'en') {
        if (p === 'Asubuhi') return 'Morning';
        if (p === 'Mchana') return 'Afternoon';
        if (p === 'Jioni') return 'Evening';
        if (p === 'Usiku') return 'Night';
      }
      return p;
    };
    const formattedPeriod = translatePeriod(event.period, language);
    const isEn = language === 'en';

    const replacements: { [key: string]: string } = {
      '{mgeni}': g.name,
      '{name}': g.name,
      '{{1}}': g.name,
      '{1}': g.name,
      '{{name}}': g.name,
      '{guestName}': g.name,
      '{jina_la_mgeni}': g.name,
      '(jina_la_mgeni)': g.name,
      '{mwenyeji}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
      '{hostName}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
      '{host_name}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
      '{{2}}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
      '{2}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
      '{{host_name}}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
      '{sherehe}': event.name || (isEn ? "Our Event" : "Sherehe"),
      '{event_name}': event.name || (isEn ? "Our Event" : "Sherehe yetu"),
      '{eventName}': event.name || (isEn ? "Our Event" : "Sherehe yetu"),
      '{{3}}': event.name || (isEn ? "Our Event" : "Sherehe yetu"),
      '{3}': event.name || (isEn ? "Our Event" : "Sherehe yetu"),
      '{{event_name}}': event.name || (isEn ? "Our Event" : "Sherehe yetu"),
      '{tarehe}': event.date || "26/11/2026",
      '{date}': event.date || "26/11/2026",
      '{eventDate}': event.date || "26/11/2026",
      '{{4}}': event.date || "26/11/2026",
      '{4}': event.date || "26/11/2026",
      '{{date}}': event.date || "26/11/2026",
      '{muda}': `${event.time || "12:00"} ${formattedPeriod}`,
      '{time}': `${event.time || "12:00"} ${formattedPeriod}`,
      '{eventTime}': `${event.time || "12:00"} ${formattedPeriod}`,
      '{{5}}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
      '{5}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
      '{{venue}}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
      '{ukumbi}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
      '{venue}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
      '{eventHall}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
      '{{6}}': `${event.time || "12:00"} ${formattedPeriod}`,
      '{6}': `${event.time || "12:00"} ${formattedPeriod}`,
      '{{time}}': `${event.time || "12:00"} ${formattedPeriod}`,
      '{vazi}': event.dressCode || (isEn ? "Smart Casual" : "Vazi la Sherehe"),
      '{dressCode}': event.dressCode || (isEn ? "Smart Casual" : "Vazi la Sherehe"),
      '{Link}': (messageType === 'thank-you' || (isSms && !forceAppendLink)) ? "" : appUrl,
      '{kiungo}': (messageType === 'thank-you' || (isSms && !forceAppendLink)) ? "" : appUrl,
      '{inviteUrl}': (messageType === 'thank-you' || (isSms && !forceAppendLink)) ? "" : appUrl,
      '{link_ramani}': (event.mapsLink && event.mapsLink.trim().length > 0) 
        ? (event.mapsLink.trim().startsWith('http') ? event.mapsLink.trim() : `https://${event.mapsLink.trim()}`) 
        : (event.coordinates && event.coordinates.trim().length > 0)
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.coordinates.trim())}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((event.eventHallName || event.name || 'Dar es Salaam') + ' Dar es Salaam')}`,
      '{{link_ramani}}': (event.mapsLink && event.mapsLink.trim().length > 0) 
        ? (event.mapsLink.trim().startsWith('http') ? event.mapsLink.trim() : `https://${event.mapsLink.trim()}`) 
        : (event.coordinates && event.coordinates.trim().length > 0)
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.coordinates.trim())}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((event.eventHallName || event.name || 'Dar es Salaam') + ' Dar es Salaam')}`,
      '{{location_link}}': (event.mapsLink && event.mapsLink.trim().length > 0) 
        ? (event.mapsLink.trim().startsWith('http') ? event.mapsLink.trim() : `https://${event.mapsLink.trim()}`) 
        : (event.coordinates && event.coordinates.trim().length > 0)
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.coordinates.trim())}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((event.eventHallName || event.name || 'Dar es Salaam') + ' Dar es Salaam')}`,
      '{LINK_RAMANI}': (event.mapsLink && event.mapsLink.trim().length > 0) 
        ? (event.mapsLink.trim().startsWith('http') ? event.mapsLink.trim() : `https://${event.mapsLink.trim()}`) 
        : (event.coordinates && event.coordinates.trim().length > 0)
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.coordinates.trim())}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((event.eventHallName || event.name || 'Dar es Salaam') + ' Dar es Salaam')}`,
      '{ramani}': (event.mapsLink && event.mapsLink.trim().length > 0) 
        ? (event.mapsLink.trim().startsWith('http') ? event.mapsLink.trim() : `https://${event.mapsLink.trim()}`) 
        : (event.coordinates && event.coordinates.trim().length > 0)
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.coordinates.trim())}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((event.eventHallName || event.name || 'Dar es Salaam') + ' Dar es Salaam')}`,
      '{{ramani}}': (event.mapsLink && event.mapsLink.trim().length > 0) 
        ? (event.mapsLink.trim().startsWith('http') ? event.mapsLink.trim() : `https://${event.mapsLink.trim()}`) 
        : (event.coordinates && event.coordinates.trim().length > 0)
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.coordinates.trim())}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((event.eventHallName || event.name || 'Dar es Salaam') + ' Dar es Salaam')}`,
      '{map_link}': (event.mapsLink && event.mapsLink.trim().length > 0) 
        ? (event.mapsLink.trim().startsWith('http') ? event.mapsLink.trim() : `https://${event.mapsLink.trim()}`) 
        : (event.coordinates && event.coordinates.trim().length > 0)
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.coordinates.trim())}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((event.eventHallName || event.name || 'Dar es Salaam') + ' Dar es Salaam')}`,
      '{namba_mwaliko}': g.code || "[Code]",
      '{card_number}': g.code || "[Code]",
      '{inviteCode}': g.code || "[Code]",
      '{{7}}': g.code || "[Code]",
      '{7}': g.code || "[Code]",
      '{{card_number}}': g.code || "[Code]",
      '{aina}': g.cardType || "DOUBLE",
      '{card_type}': g.cardType || "DOUBLE",
      '{{8}}': g.cardType || "DOUBLE",
      '{8}': g.cardType || "DOUBLE",
      '{{card_type}}': g.cardType || "DOUBLE",
      '{mwasiliano}': contacts,
      '{{contacts}}': contacts,
      '{{9}}': event.contact1Name || "",
      '{9}': event.contact1Name || "",
      '{{10}}': event.contact1 || "",
      '{10}': event.contact1 || "",
      '{{11}}': event.contact2Name || "",
      '{11}': event.contact2Name || "",
      '{{12}}': event.contact2 || "",
      '{12}': event.contact2 || "",
      '{contact_1_name}': event.contact1Name || "",
      '{contact_1_phone}': event.contact1 || "",
      '{contact_2_name}': event.contact2Name || "",
      '{contact_2_phone}': event.contact2 || ""
    };

    Object.keys(replacements).forEach(key => {
      text = text.split(key).join(replacements[key]);
    });

    // Replace three or more consecutive newlines with two newlines to avoid huge gaps
    text = text.replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
    
    // Clean up empty bulleted contact lines
    text = text.replace(/-\s*:\s*\n/g, '').replace(/-\s*:\s*$/g, '');
    
    // Additional cleanup for partial contact info:
    // 1. Remove trailing colons/dashes if phone is missing
    text = text.replace(/- ([^:\n]+)[:\-]\s*(\n|$)/g, '- $1$2');
    // 2. Remove leading colons/dashes if name is missing
    text = text.replace(/- \s*[:\-]\s*([^:\n]+)/g, '- $1');
    // 3. Fix weird double spacing or mixed punctuation
    text = text.replace(/- \s+/g, '- ');
    // 4. Remove empty lines in contact section if they became empty
    text = text.replace(/\n-\s*\n/g, '\n');

    return text.trim();
  };

  const cleanPhoneForWhatsapp = (phoneStr: string) => {
    if (!phoneStr) return "";
    let cleaned = phoneStr.replace(/\s+/g, '').replace(/[+\-]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '255' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('255') && cleaned.length === 9) {
      cleaned = '255' + cleaned;
    }
    return cleaned;
  };

  const [isDispatching, setIsDispatching] = useState(false);

  const handleSendSingle = (guestId: string, channel: 'sms' | 'whatsapp') => {
    console.log(`[Diagnostic] Single send triggered: guestId=${guestId}, channel=${channel}`);
    const target = guests.find(g => g.id === guestId);
    if (target) {
      setActiveSendTarget({ guest: target, channel });
      setCopySuccess(false);
    } else {
      console.warn(`[Diagnostic] Guest not found for ID: ${guestId}`);
    }
  };

  const handleMarkManualSent = (guestId: string, channel: 'sms' | 'whatsapp') => {
    const updated = guests.map(g => {
      if (g.id === guestId) {
        const currentSmsCount = typeof g.smsCount === 'number' ? g.smsCount : (isStatusSent(g.smsStatus) ? 1 : 0);
        const currentWhatsappCount = typeof g.whatsappCount === 'number' ? g.whatsappCount : (isStatusSent(g.whatsappStatus) ? 1 : 0);
        return {
          ...g,
          smsStatus: channel === 'sms' ? 'Imetumia' as const : g.smsStatus,
          whatsappStatus: channel === 'whatsapp' ? 'Imetumia' as const : g.whatsappStatus,
          smsCount: channel === 'sms' ? currentSmsCount + 1 : currentSmsCount,
          whatsappCount: channel === 'whatsapp' ? currentWhatsappCount + 1 : currentWhatsappCount
        };
      }
      return g;
    });
    onUpdateGuests(updated);
    setActiveSendTarget(null);
  };

  const handleConfirmSent = async (guestId: string, channel: 'sms' | 'whatsapp') => {
    if (isDispatching) {
      console.log("[Diagnostic] Already dispatching, ignoring click.");
      return;
    }
    
    const target = guests.find(g => g.id === guestId);
    if (!target) {
      console.warn(`[Diagnostic] Target guest for confirmation not found: ${guestId}`);
      return;
    }

    console.log(`[Diagnostic] Confirm Sent: id=${guestId}, channel=${channel}`);
    setIsDispatching(true);
    
    try {
      const mainText = getGuestMessageText(target, channel === 'sms');
      const formattedScheduleTime = isScheduling && scheduleTime ? scheduleTime.replace('T', ' ') + ':00' : undefined;

      // Extract template params dynamically for official Meta WhatsApp template matching
      let templateParams: string[] | undefined = undefined;
      if (channel === 'whatsapp') {
        const rawTemplate = messageType === 'thank-you' 
          ? (language === 'en' ? thankYouTemplateEn : thankYouTemplateSw)
          : (language === 'en' ? invitationTemplateEn : invitationTemplateSw);
        const currentOrigin = typeof window !== 'undefined' && !window.location.hostname.includes('europe-west2.run.app') && !window.location.hostname.includes('localhost') 
          ? window.location.origin 
          : 'https://eventcard.co.tz';
        const appUrl = `${currentOrigin}/?invite=${target.code || target.id}&eventId=${event.id}&lang=${language}`;
        const contacts = [event.contact1, event.contact2, event.contact3].filter(Boolean).join('\n');

        const translatePeriod = (p: string | null | undefined, lang: string) => {
          if (!p) return lang === 'en' ? "Afternoon" : "Mchana";
          if (lang === 'en') {
            if (p === 'Asubuhi') return 'Morning';
            if (p === 'Mchana') return 'Afternoon';
            if (p === 'Jioni') return 'Evening';
            if (p === 'Usiku') return 'Night';
          }
          return p;
        };
        const formattedPeriod = translatePeriod(event.period, language);
        const isEn = language === 'en';

        const replacements: { [key: string]: string } = {
          '{mgeni}': target.name,
          '{name}': target.name,
          '{{1}}': target.name,
          '{1}': target.name,
          '{{name}}': target.name,
          '{guestName}': target.name,
          '{jina_la_mgeni}': target.name,
          '(jina_la_mgeni)': target.name,
          '{mwenyeji}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
          '{hostName}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
          '{host_name}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
          '{{2}}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
          '{2}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
          '{{host_name}}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
          '{sherehe}': event.name || (isEn ? "Our Event" : "Sherehe"),
          '{event_name}': event.name || (isEn ? "Our Event" : "Sherehe yetu"),
          '{eventName}': event.name || (isEn ? "Our Event" : "Sherehe yetu"),
          '{{3}}': event.name || (isEn ? "Our Event" : "Sherehe yetu"),
          '{3}': event.name || (isEn ? "Our Event" : "Sherehe yetu"),
          '{{event_name}}': event.name || (isEn ? "Our Event" : "Sherehe yetu"),
          '{tarehe}': event.date || "26/11/2026",
          '{date}': event.date || "26/11/2026",
          '{eventDate}': event.date || "26/11/2026",
          '{{4}}': event.date || "26/11/2026",
          '{4}': event.date || "26/11/2026",
          '{{date}}': event.date || "26/11/2026",
          '{muda}': `${event.time || "12:00"} ${formattedPeriod}`,
          '{time}': `${event.time || "12:00"} ${formattedPeriod}`,
          '{eventTime}': `${event.time || "12:00"} ${formattedPeriod}`,
          '{{5}}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
          '{5}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
          '{{venue}}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
          '{ukumbi}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
          '{venue}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
          '{eventHall}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
          '{{6}}': `${event.time || "12:00"} ${formattedPeriod}`,
          '{6}': `${event.time || "12:00"} ${formattedPeriod}`,
          '{{time}}': `${event.time || "12:00"} ${formattedPeriod}`,
          '{vazi}': event.dressCode || (isEn ? "Smart Casual" : "Vazi la Sherehe"),
          '{dressCode}': event.dressCode || (isEn ? "Smart Casual" : "Vazi la Sherehe"),
          '{Link}': "",
          '{kiungo}': "",
          '{inviteUrl}': "",
          '{namba_mwaliko}': target.code || "[Code]",
          '{card_number}': target.code || "[Code]",
          '{inviteCode}': target.code || "[Code]",
          '{{7}}': target.code || "[Code]",
          '{7}': target.code || "[Code]",
          '{{card_number}}': target.code || "[Code]",
          '{aina}': target.cardType || "DOUBLE",
          '{card_type}': target.cardType || "DOUBLE",
          '{{8}}': target.cardType || "DOUBLE",
          '{8}': target.cardType || "DOUBLE",
          '{{card_type}}': target.cardType || "DOUBLE",
          '{mwasiliano}': contacts,
          '{{contacts}}': contacts,
          '{{9}}': event.contact1Name || "",
          '{9}': event.contact1Name || "",
          '{{10}}': event.contact1 || "",
          '{10}': event.contact1 || "",
          '{{11}}': event.contact2Name || "",
          '{11}': event.contact2Name || "",
          '{{12}}': event.contact2 || "",
          '{12}': event.contact2 || "",
          '{contact_1_name}': event.contact1Name || "",
          '{contact_1_phone}': event.contact1 || "",
          '{contact_2_name}': event.contact2Name || "",
          '{contact_2_phone}': event.contact2 || ""
        };

        const regex = /\{\{[0-9]+\}\}|\{\{[a-zA-Z0-9_\-Hh]+\}\}|\{[a-zA-Z0-9_\-Hh]+\}/g;
        const matches = (rawTemplate.match(regex) || []).filter(match => {
          const lower = match.toLowerCase();
          return !lower.includes('link') && !lower.includes('kiungo') && !lower.includes('url');
        });
        templateParams = matches.map(match => {
          const val = replacements[match];
          return val !== undefined ? val : match;
        });
      }
      
      // Use the simulation or Gateway API
      let compatibleImageUrl = "";
      try {
        const qrCodeText = target.code || target.id;
        compatibleImageUrl = await generateGuestCardImage(
          event,
          settings,
          target.name,
          target.cardType || "DOUBLE",
          qrCodeText
        );
      } catch (err) {
        console.error("Failed to generate dynamic guest card image:", err);
        compatibleImageUrl = await convertWebPToJpeg(settings.imageUrl);
      }
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId,
          eventId: event.id,
          phone: target.phone,
          text: mainText,
          channel,
          scheduleTime: formattedScheduleTime,
          templateParams,
          templateName: metaTemplateName || (messageType === 'thank-you' ? 'asante_kushiriki' : (messageType === 'reminder' ? 'ukumbusho' : 'mwaliko_wa_sherehe')),
          imageUrl: compatibleImageUrl,
          lang: language
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Utumaji kupitia gateway umeshindwa.");

      // Secondary link sending if explicitly requested
      if (channel === 'sms' && sendSmsLink) {
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://eventcard.co.tz';
        const appUrl = `${currentOrigin}/?invite=${target.code || target.id}&eventId=${event.id}&lang=${language}`;
        // Short delay between messages
        await new Promise(resolve => setTimeout(resolve, 800));
        await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: target.phone,
            text: language === 'sw' ? `Pata kadi yako hapa: ${appUrl}` : `Get your card here: ${appUrl}`,
            channel: 'sms',
            scheduleTime: formattedScheduleTime
          })
        });
      }
      
      console.log(`[Diagnostic] API Success:`, data);

      // Update state
      const updated = guests.map(g => {
        if (g.id === guestId) {
          const actualChannel = data.usedChannel || channel;
          const currentSmsCount = typeof g.smsCount === 'number' ? g.smsCount : (isStatusSent(g.smsStatus) ? 1 : 0);
          const currentWhatsappCount = typeof g.whatsappCount === 'number' ? g.whatsappCount : (isStatusSent(g.whatsappStatus) ? 1 : 0);
          return {
            ...g,
            smsStatus: actualChannel === 'sms' ? 'Imetumia' as const : g.smsStatus,
            whatsappStatus: actualChannel === 'whatsapp' ? 'Imetumia' as const : g.whatsappStatus,
            smsCount: actualChannel === 'sms' ? currentSmsCount + 1 : currentSmsCount,
            whatsappCount: actualChannel === 'whatsapp' ? currentWhatsappCount + 1 : currentWhatsappCount,
            lastSentChannel: actualChannel,
            lastSentLang: language
          };
        }
        return g;
      });
      onUpdateGuests(updated);
      const dispChannel = data.usedChannel || channel;
      const failoverText = data.failoverAttempted ? ` (Failover to ${dispChannel.toUpperCase()})` : '';
      setSendLogs(prev => [
        `[${new Date().toLocaleTimeString()}] ✓ [${dispChannel.toUpperCase()}]${failoverText} Imekamilika kwa ${target.name}${formattedScheduleTime ? ' (Scheduled)' : ''}. ${data.batchId ? `Batch ID: ${data.batchId}` : `Gateway Info: ${data.log || 'Sawa'}`}`,
        ...prev
      ]);
      
      setActiveSendTarget(null);
    } catch (err: any) {
      console.error("[Diagnostic] Send Failure:", err);
      alert("Hitilafu katika utumaji: " + err.message);
      setSendLogs(prev => [
        `[${new Date().toLocaleTimeString()}] ✗ Imeshindwa kwa mgeni: ${target.name}. Sababu: ${err.message}`,
        ...prev
      ]);
    } finally {
      setIsDispatching(false);
    }
  };

  const startBackgroundDispatch = async (channel: 'sms' | 'whatsapp', pendingGuests: Guest[]) => {
    setIsSendingAll(true);
    setSendingProgress(0);
    setSendLogs(prev => [`[INFO] Inatayarisha picha za kadi na mialiko ya kibinafsi kwa ajili ya wageni ${pendingGuests.length}...`, ...prev]);

    if (channel === 'whatsapp' && settings.imageUrl) {
      try {
        await preloadImage(settings.imageUrl);
      } catch (e) {
        console.warn("[SendMessages] Background image preload warning:", e);
      }
    }

    const tasks = [];
    let preparedCount = 0;

    for (const guest of pendingGuests) {
      const mainText = getGuestMessageText(guest, channel === 'sms');
      const currentOrigin = typeof window !== 'undefined' && !window.location.hostname.includes('europe-west2.run.app') && !window.location.hostname.includes('localhost') 
        ? window.location.origin 
        : 'https://eventcard.co.tz';
      const appUrl = `${currentOrigin}/?invite=${guest.code || guest.id}&eventId=${event.id}&lang=${language}`;

      let compatibleImageUrl = settings.imageUrl || "";
      if (channel === 'whatsapp') {
        try {
          const qrCodeText = guest.code || guest.id;
          compatibleImageUrl = await generateGuestCardImage(
            event,
            settings,
            guest.name,
            guest.cardType || "DOUBLE",
            qrCodeText
          );
        } catch (err) {
          console.warn(`[SendMessages] Error generating dynamic card for guest ${guest.name}:`, err);
          compatibleImageUrl = settings.imageUrl || "";
        }
      }

      let templateParams: string[] | undefined = undefined;
      const rawTemplate = messageType === 'thank-you' 
        ? (language === 'en' ? thankYouTemplateEn : thankYouTemplateSw)
        : (language === 'en' ? invitationTemplateEn : invitationTemplateSw);
      const contacts = [event.contact1, event.contact2, event.contact3].filter(Boolean).join('\n');

      const translatePeriod = (p: string | null | undefined, lang: string) => {
        if (!p) return lang === 'en' ? "Afternoon" : "Mchana";
        if (lang === 'en') {
          if (p === 'Asubuhi') return 'Morning';
          if (p === 'Mchana') return 'Afternoon';
          if (p === 'Jioni') return 'Evening';
          if (p === 'Usiku') return 'Night';
        }
        return p;
      };
      const formattedPeriod = translatePeriod(event.period, language);
      const isEn = language === 'en';

      const replacements: { [key: string]: string } = {
        '{mgeni}': guest.name,
        '{name}': guest.name,
        '{{1}}': guest.name,
        '{1}': guest.name,
        '{{name}}': guest.name,
        '{guestName}': guest.name,
        '{jina_la_mgeni}': guest.name,
        '(jina_la_mgeni)': guest.name,
        '{mwenyeji}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
        '{hostName}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
        '{host_name}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
        '{{2}}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
        '{2}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
        '{{host_name}}': event.hostName || (isEn ? "Our Family" : "Familia yetu"),
        '{sherehe}': event.name || (isEn ? "Our Event" : "Sherehe"),
        '{event_name}': event.name || (isEn ? "Our Event" : "Sherehe yetu"),
        '{eventName}': event.name || (isEn ? "Our Event" : "Sherehe yetu"),
        '{{3}}': event.name || (isEn ? "Our Event" : "Sherehe yetu"),
        '{3}': event.name || (isEn ? "Our Event" : "Sherehe yetu"),
        '{{event_name}}': event.name || (isEn ? "Our Event" : "Sherehe yetu"),
        '{tarehe}': event.date || "26/11/2026",
        '{date}': event.date || "26/11/2026",
        '{eventDate}': event.date || "26/11/2026",
        '{{4}}': event.date || "26/11/2026",
        '{4}': event.date || "26/11/2026",
        '{{date}}': event.date || "26/11/2026",
        '{muda}': `${event.time || "12:00"} ${formattedPeriod}`,
        '{time}': `${event.time || "12:00"} ${formattedPeriod}`,
        '{eventTime}': `${event.time || "12:00"} ${formattedPeriod}`,
        '{{5}}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
        '{5}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
        '{{venue}}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
        '{ukumbi}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
        '{venue}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
        '{eventHall}': event.eventHallName || (isEn ? "Event Hall" : "Ukumbi wa Sherehe"),
        '{{6}}': `${event.time || "12:00"} ${formattedPeriod}`,
        '{6}': `${event.time || "12:00"} ${formattedPeriod}`,
        '{{time}}': `${event.time || "12:00"} ${formattedPeriod}`,
        '{vazi}': event.dressCode || (isEn ? "Smart Casual" : "Vazi la Sherehe"),
        '{dressCode}': event.dressCode || (isEn ? "Smart Casual" : "Vazi la Sherehe"),
        '{Link}': "",
        '{kiungo}': "",
        '{inviteUrl}': "",
        '{namba_mwaliko}': guest.code || "[Code]",
        '{card_number}': guest.code || "[Code]",
        '{inviteCode}': guest.code || "[Code]",
        '{{7}}': guest.code || "[Code]",
        '{7}': guest.code || "[Code]",
        '{{card_number}}': guest.code || "[Code]",
        '{aina}': guest.cardType || "DOUBLE",
        '{card_type}': guest.cardType || "DOUBLE",
        '{{8}}': guest.cardType || "DOUBLE",
        '{8}': guest.cardType || "DOUBLE",
        '{{card_type}}': guest.cardType || "DOUBLE",
        '{mwasiliano}': contacts,
        '{{contacts}}': contacts,
        '{{9}}': event.contact1Name || "",
        '{9}': event.contact1Name || "",
        '{{10}}': event.contact1 || "",
        '{10}': event.contact1 || "",
        '{{11}}': event.contact2Name || "",
        '{11}': event.contact2Name || "",
        '{{12}}': event.contact2 || "",
        '{12}': event.contact2 || "",
        '{contact_1_name}': event.contact1Name || "",
        '{contact_1_phone}': event.contact1 || "",
        '{contact_2_name}': event.contact2Name || "",
        '{contact_2_phone}': event.contact2 || ""
      };

      const regex = /\{\{[0-9]+\}\}|\{\{[a-zA-Z0-9_\-Hh]+\}\}|\{[a-zA-Z0-9_\-Hh]+\}/g;
      const matches = (rawTemplate.match(regex) || []).filter(match => {
        const lower = match.toLowerCase();
        return !lower.includes('link') && !lower.includes('kiungo') && !lower.includes('url');
      });
      templateParams = matches.map(match => {
        const val = replacements[match];
        return val !== undefined ? val : match;
      });

      tasks.push({
        guestId: guest.id,
        phone: guest.phone,
        text: mainText,
        templateParams: templateParams,
        templateName: metaTemplateName || (messageType === 'thank-you' ? 'asante_kushiriki' : (messageType === 'reminder' ? 'ukumbusho' : 'mwaliko_wa_sherehe')),
        imageUrl: compatibleImageUrl,
        lang: language
      });

      preparedCount++;
      setSendingProgress(Math.round((preparedCount / pendingGuests.length) * 100));
    }

    setSendLogs(prev => [`[INFO] Inatuma mialiko ${tasks.length} kwenye Foleni ya Server...`, ...prev]);

    try {
      const queueRes = await fetch('/api/queue/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          channel: channel,
          tasks: tasks
        })
      });

      if (!queueRes.ok) {
        const errorData = await queueRes.json();
        throw new Error(errorData.error || "Queue setup failed.");
      }

      const queueData = await queueRes.json();
      setSendLogs(prev => [
        `[SUCCESS] ✓ Kazi imeanza kutekelezwa background! ID ya kazi: ${queueData.job?.id}`,
        `[INFO] Unaweza kuendelea kutumia mfumo au kufunga kivinjari na utumaji utaendelea background.`,
        ...prev
      ]);
      fetchQueueJobs();
      showToast(isEn ? `Dispatch started for ${tasks.length} guests!` : `Utumaji wa wageni ${tasks.length} umeanza kwenye foleni!`, 'success');
    } catch (err: any) {
      console.error("Queue Submission Failed:", err);
      showToast("Imeshindwa kutuma kazi ya foleni: " + err.message, "error");
      setSendLogs(prev => [`[ERROR] Hitilafu: ${err.message}`, ...prev]);
    } finally {
      setIsSendingAll(false);
      setSendingProgress(100);
    }
  };

  const handleSendAll = async (targetChannel?: 'sms' | 'whatsapp') => {
    if (isSendingAll || isBatchSending) return;
    const channel: 'sms' | 'whatsapp' = targetChannel || (gatewaySettings.provider === 'whatsapp' ? 'whatsapp' : 'sms');
    
    if (filteredGuests.length === 0) {
      showToast(isEn ? "No guests in current list to send messages to." : "Samahani, hakuna wageni katika orodha ya sasa wa kutumiwa ujumbe huu.", "info");
      return;
    }

    const pendingGuests = filteredGuests.filter(g => {
      if (channel === 'whatsapp') {
        return !isStatusSent(g.whatsappStatus);
      } else {
        return !isStatusSent(g.smsStatus);
      }
    });
    
    let targetGuests = pendingGuests;
    let isResendingAll = false;

    if (pendingGuests.length === 0) {
      targetGuests = filteredGuests;
      isResendingAll = true;
    }

    const formattedScheduleTime = isScheduling && scheduleTime ? scheduleTime.replace('T', ' ') + ':00' : undefined;

    const confirmMsg = isResendingAll
      ? (isEn
          ? `All ${targetGuests.length} guests in this list show messages already sent. Do you want to resend ${channel.toUpperCase()} messages to ALL ${targetGuests.length} guests again?`
          : `Wageni wote ${targetGuests.length} walio kwenye orodha hii wanaonyesha wameshatumiwa ujumbe tayari. Je, unataka kuwatumia tena ujumbe wa ${channel.toUpperCase()} wageni wote ${targetGuests.length}?`)
      : (isEn
          ? `Are you sure you want to dispatch invitations to ${targetGuests.length} guests via ${channel.toUpperCase()}${formattedScheduleTime ? ' scheduled for ' + formattedScheduleTime : ''}?`
          : `Je, una uhakika unataka kutuma mialiko ya kibinafsi kwa wageni ${targetGuests.length} kupitia ${channel.toUpperCase()}${formattedScheduleTime ? ' kwa muda ' + formattedScheduleTime : ''}?`);

    setConfirmModalConfig({
      isOpen: true,
      title: isEn ? `Dispatch ${channel.toUpperCase()} Messages` : `Tuma Mialiko ya ${channel.toUpperCase()}`,
      message: confirmMsg,
      confirmText: isEn ? "Yes, Send Now" : "Ndiyo, Tuma Sasa",
      onConfirm: () => {
        setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        startBackgroundDispatch(channel, targetGuests);
      }
    });
  };

  const handleResetSMS = () => {
    const listToReset = filteredGuests.length > 0 ? filteredGuests : guests;
    if (listToReset.length === 0) {
      showToast(isEn ? "No guests in current list to reset." : "Hakuna wageni katika orodha ya sasa wa kufanya reset.", "info");
      return;
    }
    
    const targetIds = new Set(listToReset.map(g => g.id));
    const reset = guests.map(g => {
      if (targetIds.has(g.id)) {
        return {
          ...g,
          smsStatus: 'Sijatuma' as const,
          smsCount: 0
        };
      }
      return g;
    });
    
    onUpdateGuests(reset, `Amefuta hali ya SMS pekee kwa wageni ${listToReset.length}`);
    setSendLogs(prev => [`[${new Date().toLocaleTimeString()}] ↺ Hali ya SMS pekee imefutwa (Reset SMS Status) kwa wageni ${listToReset.length}`, ...prev]);
    
    showToast(
      isEn 
        ? `✓ SMS status reset to 'Pending' for ${listToReset.length} guests successfully!`
        : `✓ Hali ya SMS pekee imefutwa na kurudishwa kuwa 'Sijatuma' kwa wageni ${listToReset.length} kwa mafanikio!`,
      'success'
    );
  };

  const handleResetWhatsApp = () => {
    const listToReset = filteredGuests.length > 0 ? filteredGuests : guests;
    if (listToReset.length === 0) {
      showToast(isEn ? "No guests in current list to reset." : "Hakuna wageni katika orodha ya sasa wa kufanya reset.", "info");
      return;
    }
    
    const targetIds = new Set(listToReset.map(g => g.id));
    const reset = guests.map(g => {
      if (targetIds.has(g.id)) {
        return {
          ...g,
          whatsappStatus: 'Sijatuma' as const,
          whatsappCount: 0
        };
      }
      return g;
    });
    
    onUpdateGuests(reset, `Amefuta hali ya WhatsApp pekee kwa wageni ${listToReset.length}`);
    setSendLogs(prev => [`[${new Date().toLocaleTimeString()}] ↺ Hali ya WhatsApp pekee imefutwa (Reset WA Status) kwa wageni ${listToReset.length}`, ...prev]);
    
    showToast(
      isEn 
        ? `✓ WhatsApp status reset to 'Pending' for ${listToReset.length} guests successfully!`
        : `✓ Hali ya WhatsApp pekee imefutwa na kurudishwa kuwa 'Sijatuma' kwa wageni ${listToReset.length} kwa mafanikio!`,
      'success'
    );
  };

  const handleReset = () => {
    const listToReset = filteredGuests.length > 0 ? filteredGuests : guests;
    if (listToReset.length === 0) {
      showToast(isEn ? "No guests in current list to reset." : "Hakuna wageni katika orodha ya sasa wa kufanya reset.", "info");
      return;
    }
    
    const targetIds = new Set(listToReset.map(g => g.id));
    const reset = guests.map(g => {
      if (targetIds.has(g.id)) {
        return {
          ...g,
          smsStatus: 'Sijatuma' as const,
          whatsappStatus: 'Sijatuma' as const,
          smsCount: 0,
          whatsappCount: 0
        };
      }
      return g;
    });
    
    onUpdateGuests(reset, `Amefuta hali zote za SMS na WhatsApp kwa wageni ${listToReset.length}`);
    setSendLogs([]);
    setSendingProgress(0);
    
    showToast(
      isEn 
        ? `✓ SMS & WhatsApp statuses reset for ${listToReset.length} guests successfully!`
        : `✓ Hali za SMS na WhatsApp zimefutwa na kurudishwa kuwa 'Sijatuma' kwa wageni ${listToReset.length} kwa mafanikio!`,
      'success'
    );
  };

  const renderDeliveryIndicator = (g: Guest) => {
    // Collect what has been successfully delivered
    const deliveries: { channel: 'whatsapp' | 'sms'; lang: string }[] = [];

    // Check both channels independently using central isStatusSent helper so we support all success statuses (sent, delivered, success, imetumia, etc.)
    if (isStatusSent(g.whatsappStatus)) {
      deliveries.push({
        channel: 'whatsapp',
        lang: g.lastSentLang || language || 'sw'
      });
    }
    if (isStatusSent(g.smsStatus)) {
      deliveries.push({
        channel: 'sms',
        lang: g.lastSentLang || language || 'sw'
      });
    }

    if (deliveries.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {deliveries.map((del, i) => {
          const isWa = del.channel === 'whatsapp';
          const langDisplay = String(del.lang).toUpperCase() === 'EN' ? 'EN' : 'SW';
          return (
            <span
              key={i}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold border ${
                isWa 
                  ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
              title={isWa ? `Iliyofanikiwa kupitia WhatsApp (${langDisplay})` : `Iliyofanikiwa kupitia SMS (${langDisplay})`}
            >
              {isWa ? (
                // WhatsApp Icon SVG (compact and matching lucide stroke size)
                <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12.003 2c-5.522 0-9.997 4.477-9.997 9.997 0 1.764.459 3.483 1.332 5.017L2 22l5.127-1.345a9.96 9.96 0 0 0 4.877 1.28c5.522 0 9.997-4.477 9.997-9.997 0-5.52-4.475-9.938-9.998-9.938zm5.952 14.175c-.26.732-1.517 1.345-2.094 1.41-.577.065-1.127.276-3.615-.756-3.136-1.301-5.127-4.477-5.29-4.688-.163-.211-1.301-1.731-1.301-3.308 0-1.577.829-2.35 1.122-2.659.293-.309.65-.39.862-.39s.423.016.602.024c.187.008.439-.073.691.537.26.634.894 2.18.976 2.342.081.163.138.35.024.577-.114.228-.171.366-.341.569-.171.203-.358.455-.512.61-.171.171-.35.358-.154.699.195.341.87 1.431 1.862 2.31 1.277 1.127 2.35 1.477 2.684 1.639.333.163.529.138.724-.089.195-.228.837-.976 1.065-1.309.228-.333.455-.276.764-.163.309.114 1.959.927 2.293 1.097s.561.26.642.407c.082.146.082.846-.178 1.578z" />
                </svg>
              ) : (
                // SMS Mail/Message Icon SVG
                <svg className="w-2.5 h-2.5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              )}
              <span className="capitalize">{del.channel}</span>
              <span className="text-slate-500 font-normal">|</span>
              <span className="text-[8px] font-bold tracking-wider">{langDisplay}</span>
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[1.75rem] p-6 sm:p-8 space-y-6 font-sans text-xs text-white" id="send-messages-container">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-400 animate-pulse" />
            <span>{isEn ? "Dispatch Cards & Reminders (Messages)" : "Sambaza Kadi na Vikumbusho (Messages)"}</span>
          </h2>
          <p className="text-slate-350 mt-0.5">
            {isEn ? "Dispatch invitations or reminders to guests via SMS or WhatsApp." : "Tuma mialiko au vikumbusho kwa wageni kwa SMS au WhatsApp."}
          </p>
        </div>

        <div className="flex gap-2 self-start sm:self-auto font-semibold flex-wrap items-center">
          {gatewaySettings.provider !== 'simulation' && gatewaySettings.senderId && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold ${
              gatewaySettings.senderIdStatus === 'approved' 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : gatewaySettings.senderIdStatus === 'pending'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span>{gatewaySettings.senderId}: {
                gatewaySettings.senderIdStatus === 'approved' ? (isEn ? 'APPROVED' : 'IMETHIBITISHWA') :
                gatewaySettings.senderIdStatus === 'pending' ? (isEn ? 'PENDING...' : 'INAHAKIKIWA...') : (isEn ? 'REJECTED' : 'IMEKATALIWA')
              }</span>
            </div>
          )}

          {filteredGuests.length > 0 && (
            <div className="flex items-center space-x-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                onClick={handleResetSMS}
                className="text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 font-bold text-xs cursor-pointer"
                title={isEn ? "Reset SMS status only for filtered guests" : "Futa hali ya SMS pekee na kurudisha Sijatuma"}
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                <span>{isEn ? "Reset SMS" : "Reset SMS Pekee"}</span>
              </button>

              <button
                onClick={handleResetWhatsApp}
                className="text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 font-bold text-xs cursor-pointer"
                title={isEn ? "Reset WhatsApp status only for filtered guests" : "Futa hali ya WhatsApp pekee na kurudisha Sijatuma"}
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isEn ? "Reset WA" : "Reset WA Pekee"}</span>
              </button>

              <button
                onClick={handleReset}
                className="text-slate-400 hover:text-slate-200 hover:bg-white/10 px-2 py-1.5 rounded-lg transition flex items-center gap-1 font-bold text-xs cursor-pointer"
                title={isEn ? "Reset both SMS and WhatsApp" : "Futa hali zote mbili (SMS na WA)"}
              >
                <span>{isEn ? "Reset All" : "Reset Zote"}</span>
              </button>
            </div>
          )}

          <div className="flex items-center space-x-2 border border-white/10 bg-white/5 rounded-xl px-2 py-1">
            <label className="text-[10px] text-slate-300 font-bold flex items-center gap-1 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isScheduling} 
                onChange={(e) => setIsScheduling(e.target.checked)} 
                className="w-3 h-3 rounded"
              />
              Schedule
            </label>
            {isScheduling && (
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="bg-[#070b13] border border-white/10 text-slate-200 text-[10px] rounded px-2 py-1 outline-none"
              />
            )}
          </div>

          {/* Bulk SMS Button */}
          <button
            onClick={() => handleSendAll('sms')}
            disabled={isSendingAll || filteredGuests.length === 0}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 font-bold shadow-md hover:shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-xs cursor-pointer"
            title={isEn ? "Send SMS invitations to all pending guests" : "Tuma SMS kwa wageni wote waliobakia"}
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-200" />
            <span>{isSendingAll ? (isEn ? 'Sending...' : 'Inatuma...') : (isEn ? 'Send All SMS' : 'Tuma SMS kwa Wote')}</span>
            {filteredGuests.filter(g => !isStatusSent(g.smsStatus)).length > 0 && (
              <span className="ml-1 bg-white/20 text-white text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold">
                {filteredGuests.filter(g => !isStatusSent(g.smsStatus)).length}
              </span>
            )}
          </button>

          {/* Bulk WhatsApp Button */}
          <button
            onClick={() => handleSendAll('whatsapp')}
            disabled={isSendingAll || filteredGuests.length === 0}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 font-bold shadow-md hover:shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-xs cursor-pointer"
            title={isEn ? "Send WhatsApp invitations to all pending guests" : "Tuma WhatsApp kwa wageni wote waliobakia"}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-200" />
            <span>{isSendingAll ? (isEn ? 'Sending...' : 'Inatuma...') : (isEn ? 'Send All WhatsApp' : 'Tuma WhatsApp kwa Wote')}</span>
            {filteredGuests.filter(g => !isStatusSent(g.whatsappStatus)).length > 0 && (
              <span className="ml-1 bg-white/20 text-white text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold">
                {filteredGuests.filter(g => !isStatusSent(g.whatsappStatus)).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Message Type Selector */}
      <div className="flex flex-col space-y-3 border-b border-white/10 pb-4">
        <div className="flex items-center space-x-2">
          {[
            { id: 'invitation', label: language === 'en' ? 'Invitations' : 'Mialiko' },
            { id: 'thank-you', label: language === 'en' ? 'Thank You' : 'Shukrani' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setMessageType(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
                messageType === tab.id 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:bg-white/5 border border-transparent'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {messageType === 'thank-you' && (
          <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-xl border border-white/10 w-full sm:w-auto overflow-x-auto">
            <span className="text-xs text-slate-400 font-medium px-2 whitespace-nowrap">
              {language === 'en' ? 'Filter by:' : 'Chuja kwa:'}
            </span>
            {[
              { id: 'attended', label: language === 'en' ? 'Attended Guests' : 'Walioshiriki Kwenye Kadi' },
              { id: 'confirmed', label: language === 'en' ? 'Confirmed RSVP' : 'Waliothibitisha (Atahudhuria)' },
              { id: 'all', label: language === 'en' ? 'All Invited' : 'Wote Walioalikwa' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setThankYouAudience(filter.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap cursor-pointer ${
                  thankYouAudience === filter.id
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:bg-white/5 border border-transparent'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Numerical Sending Metrics cards wrapper */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          <p className="text-[9px] uppercase font-mono tracking-wider text-slate-400 font-bold">Wageni Waliobakia</p>
          <p className="text-2xl font-extrabold text-white mt-1">{countPending}</p>
        </div>

        <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
          <p className="text-[9px] uppercase font-mono tracking-wider text-emerald-300 font-bold">Imetuma SMS</p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1">{countSmsSent}</p>
        </div>

        <div className="backdrop-blur-md bg-teal-500/10 border border-teal-500/20 rounded-2xl p-4 text-center">
          <p className="text-[9px] uppercase font-mono tracking-wider text-teal-300 font-bold">Imetuma WhatsApp</p>
          <p className="text-2xl font-extrabold text-teal-400 mt-1">{countWhatsappSent}</p>
        </div>

        <div className="backdrop-blur-md bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-center">
          <p className="text-[9px] uppercase font-mono tracking-wider text-blue-300 font-bold">Jumla Iliyotekelezwa</p>
          <p className="text-2xl font-extrabold text-blue-400 mt-1">
            {guests.length > 0 ? Math.round(((guests.length - countPending) / guests.length) * 100) : 0}%
          </p>
        </div>

      </div>

      {/* Background Queue Jobs Monitor */}
      {queueJobs.length > 0 && (
        <div className="backdrop-blur-md bg-slate-900/60 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-blue-400 ${activeJob ? 'animate-spin' : ''}`} />
              <h3 className="text-sm font-bold text-white">Mchakato wa Kutuma Background (Queue)</h3>
            </div>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded font-mono">
              Foleni: {queueJobs.filter(j => j.status === 'pending' || j.status === 'running').length} Active
            </span>
          </div>

          <div className="space-y-3">
            {queueJobs.slice(0, 3).map((job) => {
              const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;
              const isJobRunning = job.status === 'running';
              const isJobPending = job.status === 'pending';
              const isJobPaused = job.status === 'paused';
              const isJobFailed = job.status === 'failed';
              const isJobCompleted = job.status === 'completed';

              let statusColor = 'text-slate-400';
              let statusBg = 'bg-slate-500/10 border-slate-500/20';
              let statusText = job.status;

              if (isJobRunning) {
                statusColor = 'text-blue-400';
                statusBg = 'bg-blue-500/10 border-blue-500/20';
                statusText = 'Inatuma...';
              } else if (isJobPending) {
                statusColor = 'text-amber-400';
                statusBg = 'bg-amber-500/10 border-amber-500/20';
                statusText = 'Inasubiri...';
              } else if (isJobPaused) {
                statusColor = 'text-zinc-400 animate-pulse';
                statusBg = 'bg-zinc-500/15 border-zinc-500/20';
                statusText = 'Imesitishwa';
              } else if (isJobFailed) {
                statusColor = 'text-rose-400';
                statusBg = 'bg-rose-500/10 border-rose-500/20';
                statusText = 'Iliyoshindikana';
              } else if (isJobCompleted) {
                statusColor = 'text-emerald-400';
                statusBg = 'bg-emerald-500/10 border-emerald-500/20';
                statusText = 'Imekamilika';
              }

              return (
                <div key={job.id} className="p-3.5 rounded-xl border border-white/5 bg-slate-950/40 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-500 select-all font-bold">#{job.id.substring(0, 8)}</span>
                      <span className="text-slate-400 capitalize font-medium">{job.channel.toUpperCase()} Dispatch</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBg} ${statusColor} font-bold font-mono`}>
                        {statusText}
                      </span>
                      <span className="font-mono text-slate-300 font-bold">{job.processed}/{job.total} ({pct}%)</span>
                    </div>
                  </div>

                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden relative border border-white/5">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        isJobCompleted ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                        isJobFailed ? 'bg-rose-500' :
                        isJobPaused ? 'bg-zinc-400' : 'bg-gradient-to-r from-blue-500 to-purple-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Job Logs Preview if Running */}
                  {isJobRunning && job.logs && job.logs.length > 0 && (
                    <div className="bg-black/40 rounded-lg p-2.5 font-mono text-[9.5px] text-slate-300 h-16 overflow-y-auto space-y-0.5 border border-white/5 scrollbar-thin">
                      {job.logs.slice(-3).reverse().map((log: string, lIdx: number) => (
                        <div key={lIdx} className={log.includes('✓') ? 'text-emerald-400' : log.includes('✗') ? 'text-rose-400 animate-pulse' : 'text-slate-300'}>
                          {log}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2 text-[10.5px]">
                    <div className="text-slate-500 font-mono text-[9px]">
                      {new Date(job.created_at).toLocaleTimeString()}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(isJobRunning || isJobPending) && (
                        <button
                          onClick={() => handleControlQueue(job.id, 'pause')}
                          className="px-2.5 py-1 bg-zinc-500/10 hover:bg-zinc-500/20 text-zinc-300 border border-zinc-500/20 rounded-md transition font-medium cursor-pointer text-[10px]"
                        >
                          Sitisha
                        </button>
                      )}
                      {isJobPaused && (
                        <button
                          onClick={() => handleControlQueue(job.id, 'resume')}
                          className="px-2.5 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/20 rounded-md transition font-medium cursor-pointer text-[10px]"
                        >
                          Endeleza
                        </button>
                      )}
                      {(isJobRunning || isJobPending || isJobPaused) && (
                        <button
                          onClick={() => handleControlQueue(job.id, 'cancel')}
                          className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-md transition font-medium cursor-pointer text-[10px]"
                        >
                          Futa/Sitisha
                        </button>
                      )}
                      {(isJobCompleted || isJobFailed) && (
                        <button
                          onClick={() => handleControlQueue(job.id, 'clear')}
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-md transition font-medium cursor-pointer text-[10px]"
                        >
                          Safi
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress tracker inside sending state */}
      {(isSendingAll || isBatchSending) && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3.5 text-xs">
          <div className="flex justify-between items-center font-semibold text-white">
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-blue-400 ${isBatchSending ? 'animate-spin' : ''}`} />
              <span>{isBatchSending ? 'Inatuma Batch ya Meseji API...' : 'Inasambaza Kadi za Mialiko kwa Wingi...'}</span>
            </div>
            {!isBatchSending && (
              <span className="font-mono text-blue-400">{sendingProgress}% ({currentSendingIndex}/{guests.length})</span>
            )}
            {isBatchSending && (
              <span className="font-mono text-amber-400 animate-pulse italic">Processing Batch...</span>
            )}
          </div>
          
          <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden relative">
            {isBatchSending ? (
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500 to-transparent w-1/2 h-full opacity-70"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            ) : (
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                style={{ width: `${sendingProgress}%` }}
              />
            )}
          </div>
          
          {isBatchSending && (
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <AlertCircle className="w-3 h-3 text-amber-500" />
              <span>Tafadhali usifunge dirisha hili hadi mwitikio wa Batch ID upatikane kutoka kwa Meseji API.</span>
            </div>
          )}
          
          {!isBatchSending && (
            <p className="text-[10px] text-slate-400 italic">Mchakato unatumia simulation ya API kufikisha mialiko yenye picha binafsi ya kadi na nambari ya siri ya QR.</p>
          )}
        </div>
      )}

      {/* Success Feedback for Batch */}
      {lastBatchId && !isBatchSending && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-400">Batch Imewasilishwa kwa Mafanikio!</p>
              <p className="text-[10px] text-emerald-300/70 font-mono">BATCH ID: <span className="bg-emerald-500/20 px-1.5 py-0.5 rounded select-all font-bold">{lastBatchId}</span></p>
            </div>
          </div>
          <button 
            onClick={() => setLastBatchId(null)}
            className="p-1 hover:bg-white/5 rounded-lg text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Template Editor Section */}
      <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4" id="template-editor-box">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                {messageType === 'thank-you' 
                  ? 'Hariri Muundo wa Shukrani (Edit Thank You Template)' 
                  : 'Hariri Muundo wa Mwaliko (Edit Invitation Template)'}
              </h3>
              <p className="text-[10px] text-slate-400">
                {messageType === 'thank-you'
                  ? 'Badilisha maandishi ya shukrani yatakayotumwa kwa kila mgeni.'
                  : 'Badilisha maandishi ya mwaliko yatakayotumwa kwa kila mgeni kwa kutumia mifano ya mabano dynamic.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={isTemplateSaving}
              className={`text-[10px] border px-2.5 py-1.5 rounded-lg transition font-mono flex items-center gap-1 cursor-pointer font-bold ${
                templateSavedSuccess 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white border-transparent'
              }`}
            >
              <CheckCircle className={`w-3 h-3 ${isTemplateSaving ? 'animate-spin' : ''}`} />
              {isTemplateSaving ? 'Inahifadhi...' : templateSavedSuccess ? 'Imehifadhiwa!' : 'Hifadhi Muundo (Save)'}
            </button>
            <button
              type="button"
              onClick={handleResetTemplate}
              className="text-[10px] text-slate-400 hover:text-white border border-white/10 hover:bg-white/5 px-2.5 py-1.5 rounded-lg transition font-mono flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 text-slate-400" />
              Rudisha ya Msingi (Default)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Editor Area */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label htmlFor="message-template-textarea" className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400">
                Ujumbe wa Mwaliko (Andika hapa)
              </label>
              <span className="text-[9px] text-[#10b981] font-bold font-mono">● Auto-saves to storage</span>
            </div>
            
            <textarea
              id="message-template-textarea"
              value={activeTemplateValue}
              onChange={(e) => setActiveTemplateValue(e.target.value)}
              onBlur={handleSaveTemplate}
              rows={7}
              className="w-full bg-[#070b13] border border-white/10 rounded-xl p-3 text-white font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 leading-relaxed resize-y scrollbar-thin select-all"
              placeholder="Andika mwaliko wako wa mgeni..."
            />

            {/* Custom Option: Conserve SMS Credits Toggle */}
            <div className="p-3.5 rounded-xl border border-white/5 bg-slate-950/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    id="toggle-sms-link"
                    type="checkbox"
                    checked={sendSmsLink}
                    onChange={(e) => setSendSmsLink(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500/30 bg-slate-900 border-white/10 cursor-pointer"
                  />
                  <label htmlFor="toggle-sms-link" className="text-[10.5px] font-bold text-slate-200 cursor-pointer select-none">
                    {isEn ? "Include Card Link in a second SMS?" : "Tuma Kiungo cha Kadi (Link) katika SMS ya pili?"}
                  </label>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  sendSmsLink ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                }`}>
                  {sendSmsLink ? (isEn ? '2 SMS + LINK' : 'SMS 2 + LINK') : (isEn ? '1 SMS TEXT ONLY' : 'SMS 1 YA MANENO PEKEE')}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed pl-6">
                {sendSmsLink 
                  ? (isEn ? "SENT AS TWO SMS: First is invitation text, second is guest-specific card link. Consumes more credits." : "ITAFIKA KWA SMS MBILI: Moja ni ujumbe wa maneno ya mialiko, na ya pili ni kiungo cha mtandaoni cha kadi. Inatumia salio zaidi ya SMS.")
                  : (isEn ? "SENT AS SINGLE SMS: Text-only message without the visual image link. Saves credits." : "ITAFIKA KWA SMS MOJA TU: Inatuma ujumbe wako wa maandishi pekee bila kadi/kiungo ya picha. Inapunguza nusu ya gharama na inalinda salio lako la SMS 31!")
                }
              </p>
            </div>

            {/* Clickable Placeholders */}
            <div className="hidden space-y-1.5">
              <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500 block font-bold">
                {isEn ? "Click placeholders to insert dynamic template fields:" : "Bofya vibandiko hivi kuweka taarifa zinazobadilika (Dynamic Placeholders):"}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { tag: '{name}', label: 'Jina la Mgeni' },
                  { tag: '{host_name}', label: 'Mwenyeji' },
                  { tag: '{event_name}', label: 'Sherehe' },
                  { tag: '{kiungo}', label: 'Kiungo cha Kadi' },
                  { tag: '{date}', label: 'Tarehe' },
                  { tag: '{venue}', label: 'Ukumbi' },
                  { tag: '{time}', label: 'Muda' },
                  { tag: '{card_number}', label: 'Namba ya Kadi' },
                  { tag: '{card_type}', label: 'Aina ya Kadi' },
                  { tag: '{contact_1_name}', label: 'Mwasiliano 1' },
                  { tag: '{contact_2_name}', label: 'Mwasiliano 2' }
                ].map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => insertPlaceholder(item.tag)}
                    className="px-2 py-1 bg-white/5 hover:bg-blue-500/20 hover:text-blue-200 text-[10px] text-slate-300 border border-white/10 hover:border-blue-500/30 rounded-lg transition font-mono font-medium cursor-pointer"
                    title={`Click to insert ${item.tag}`}
                  >
                    <span className="text-blue-400 font-extrabold font-mono">{item.tag}</span> <span className="text-slate-500 italic">({item.label})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Preview Area */}
          <div className="flex flex-col h-full bg-[#070b13]/50 rounded-xl border border-white/5 p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-300 font-bold">{isEn ? "Live Dynamic Preview (Sample of first guest)" : "Live Dynamic Preview (Mfano kwa mgeni wa kwanza)"}</span>
              </div>
              {guests.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold font-mono font-sans">
                  {isEn ? "Guest:" : "Mgeni:"} {guests[0].name}
                </span>
              )}
            </div>

            <div className="flex-grow bg-[#04080e] p-3.5 rounded-lg border border-white/5 font-mono text-[10.5px] text-slate-205 leading-relaxed whitespace-pre-wrap max-h-[190px] overflow-y-auto select-all scrollbar-thin">
              {guests.length > 0 ? getGuestMessageText(guests[0], false) : (isEn ? "Please register guests under 'Guests' first to preview custom messages here." : "Tafadhali kwanza ingiza wageni katika sehemu ya 'Wageni' ili kuona preview hapa.")}
            </div>

            <div className="text-[9.5px] text-slate-400 flex items-start space-x-1.5 leading-normal">
              <span className="text-amber-500 text-[11px] font-bold">ℹ</span>
              <p>{isEn ? "Any custom edits made above will dynamically refresh all invitation text dispatches in the registry log below." : "Mabadiliko yoyote unayofanya hapa yatasasisha ujumbe wote utakaotembea kupitia WhatsApp na SMS kwenye jedwali hapo chini."}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Split visual: Left list of guests, Right terminal log summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Guest List and Actions (8 Cols) */}
        <div className="lg:col-span-8 border border-white/10 rounded-2xl overflow-hidden bg-white/5 text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-slate-400 font-mono uppercase text-[9px] border-b border-white/10">
                  <th className="px-5 py-3">{isEn ? 'Guest Name' : 'Jina la Mgeni'}</th>
                  <th className="px-5 py-3">{isEn ? 'Phone' : 'Phone'}</th>
                  <th className="px-5 py-3 text-center">RSVP</th>
                  <th className="px-5 py-3 text-center">{isEn ? 'SMS Status' : 'Hali SMS'}</th>
                  <th className="px-5 py-3 text-center">{isEn ? 'WhatsApp Status' : 'Hali WhatsApp'}</th>
                  <th className="px-5 py-3 text-right">{isEn ? 'Action' : 'Zoezi la Kutuma'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white">
                {filteredGuests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500 italic">
                      {messageType === 'save_the_date' 
                        ? (isEn ? 'No guests confirmed attendance yet. Save the Date is sent to attending guests only.' : 'Hakuna wageni waliothibitisha kuhudhuria bado. Save the Date inatumwa kwa wale walioweka "Atahudhuria" pekee.')
                        : (isEn ? 'No guests found.' : 'Hakuna wageni waliopatikana.')}
                    </td>
                  </tr>
                ) : (
                  filteredGuests.map((guest) => (
                    <tr key={guest.id} className="hover:bg-white/5 transition border-b border-white/5">
                      <td className="px-5 py-4 font-bold text-white">
                        <div>{guest.name}</div>
                        {renderDeliveryIndicator(guest)}
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-300">{guest.phone}</td>
                      
                      {/* RSVP STATUS */}
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          guest.rsvpStatus === 'Atahudhuria' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : guest.rsvpStatus === 'Hatahudhuria'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-white/5 text-slate-400 border-white/10'
                        }`}>
                          {guest.rsvpStatus}
                        </span>
                      </td>

                      {/* SMS STATUS BADGE */}
                      <td className="px-5 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            isStatusSent(guest.smsStatus) 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-white/5 text-slate-400 border-white/10'
                          }`}>
                            {guest.smsStatus}
                          </span>
                          {isStatusSent(guest.smsStatus) && (
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              {isEn ? "Sent:" : "Zilizotumwa:"} <strong className="text-emerald-400 font-bold">{guest.smsCount || 1}</strong>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* WHATSAPP STATUS BADGE */}
                      <td className="px-5 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            isStatusSent(guest.whatsappStatus) 
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                              : 'bg-white/5 text-slate-400 border-white/10'
                          }`}>
                            {guest.whatsappStatus}
                          </span>
                          {isStatusSent(guest.whatsappStatus) && (
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              {isEn ? "Sent:" : "Zilizotumwa:"} <strong className="text-blue-400 font-bold">{guest.whatsappCount || 1}</strong>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3 text-right space-x-1.5 flex justify-end items-center font-bold">
                        {/* Edit information button */}
                        <button
                          onClick={() => handleStartEdit(guest)}
                          className={`p-1 px-2 border transition rounded-lg text-[10px] cursor-pointer ${
                            editingGuest?.id === guest.id 
                              ? 'bg-blue-500 text-white border-blue-400' 
                              : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border-transparent'
                          }`}
                          title="Hariri Taarifa za Mgeni"
                        >
                          {isEn ? "Edit" : "Hariri (Edit)"}
                        </button>

                        {/* Reset SMS button */}
                        {isStatusSent(guest.smsStatus) && (
                          <button
                            onClick={() => handleResetSingleGuest(guest.id, 'sms')}
                            className="p-1 px-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 rounded-lg transition cursor-pointer text-[10px] font-bold"
                            title="Futa Hali ya SMS Pekee"
                          >
                            Reset SMS
                          </button>
                        )}

                        {/* Reset WA button */}
                        {isStatusSent(guest.whatsappStatus) && (
                          <button
                            onClick={() => handleResetSingleGuest(guest.id, 'whatsapp')}
                            className="p-1 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded-lg transition cursor-pointer text-[10px] font-bold"
                            title="Futa Hali ya WhatsApp Pekee"
                          >
                            Reset WA
                          </button>
                        )}

                        <button
                          onClick={() => handleSendSingle(guest.id, 'sms')}
                          disabled={isStatusSent(guest.smsStatus) || isSendingAll}
                          className={`px-2 py-1.5 border rounded-lg font-bold transition text-[11px] cursor-pointer ${
                            activeSendTarget?.guest.id === guest.id && activeSendTarget.channel === 'sms'
                              ? 'bg-emerald-500 text-white border-emerald-400'
                              : 'bg-white/5 hover:bg-white/10 text-emerald-400 hover:text-emerald-300 border-white/10 disabled:bg-white/5 disabled:text-slate-600 disabled:border-transparent'
                          }`}
                        >
                          SMS
                        </button>
                        <button
                          onClick={() => handleSendSingle(guest.id, 'whatsapp')}
                          disabled={isStatusSent(guest.whatsappStatus) || isSendingAll}
                          className={`px-2 py-1.5 border rounded-lg font-bold transition text-[11px] cursor-pointer ${
                            activeSendTarget?.guest.id === guest.id && activeSendTarget.channel === 'whatsapp'
                              ? 'bg-blue-500 text-white border-blue-400'
                              : 'bg-white/5 hover:bg-white/10 text-blue-450 hover:text-blue-305 border-white/10 disabled:bg-white/5 disabled:text-slate-600 disabled:border-transparent'
                          }`}
                        >
                          WA
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right simulated cloud logger (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          <h4 className="font-bold text-slate-300 text-[10px] uppercase font-mono tracking-wider">{isEn ? "Transaction & Dispatch Logs" : "Miamala na Kumbukumbu ya Kutuma (Logs)"}</h4>
          <div className="flex-grow bg-slate-950/60 rounded-2xl p-4 font-mono text-[9px] h-[300px] overflow-y-auto border border-white/10 space-y-1.5 leading-relaxed antialiased">
            {sendLogs.length === 0 ? (
              <p className="text-slate-600 italic">{isEn ? "Click 'Dispatch All' or send individually to stream real-time logs here..." : "Kubonyeza \"Vuta na Tuma zote\" au kutuma kadi moja mmoja kutaorodhesha taarifa za kadi hapa..."}</p>
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

      {/* Navigation section */}
      <div className="flex justify-end pt-4 border-t border-white/10">
        <button
          onClick={onNext}
          className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] text-white font-bold rounded-xl transition shadow flex items-center space-x-2 text-xs"
        >
          <span>Fuatilia Majibu ya Wageni (RSVP Responses)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <PortalModal key="reset-confirm-portal">
            <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md z-[9999]" id="reset-template-modal">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 font-sans text-xs text-white animate-fade-in"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/35 flex items-center justify-center text-amber-500 mx-auto">
                  <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H19" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-bold text-white">
                    Kurudisha Kiolezo Msingi?
                  </h3>
                  <p className="text-xs text-slate-400 leading-normal">
                    Je, una uhakika unataka kurudisha muundo wa ujumbe wa msingi (Default Template)? Kitendo hiki kitafuta mabadiliko yoyote uliyofanya kwenye ujumbe huu kwa sasa.
                  </p>
                </div>
                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-grow py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-bold text-slate-355 transition cursor-pointer"
                  >
                    Ghairi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      executeResetTemplate();
                      setShowResetConfirm(false);
                    }}
                    className="flex-grow py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 hover:shadow-[0_0_15px_rgba(245,158,11,0.30)] text-xs font-bold text-white transition cursor-pointer"
                  >
                    Ndiyo, Rudisha
                  </button>
                </div>
              </motion.div>
            </div>
          </PortalModal>
        )}
      </AnimatePresence>

      {/* 2. Modal: Edit Guest */}
      <AnimatePresence>
        {editingGuest && (
          <PortalModal key="edit-guest-portal">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="backdrop-blur-xl bg-[#090f1d] rounded-3xl p-6 sm:p-8 max-w-md w-full border border-white/15 shadow-2xl space-y-5 text-xs font-sans relative text-white text-left"
              >
                <button 
                  onClick={() => setEditingGuest(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white transition cursor-pointer"
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>

                <h3 className="text-base font-bold text-white pr-8">
                  {isEn ? 'Edit Guest Information' : 'Hariri Taarifa za Mgeni'}
                </h3>
                
                <form onSubmit={handleSaveEditGuest} className="space-y-4 text-xs font-sans">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-355 block" htmlFor="edit-send-mgeni-name">
                      {isEn ? 'GUEST NAME *' : 'JINA LA MGENI *'}
                    </label>
                    <input 
                      id="edit-send-mgeni-name"
                      type="text" 
                      required 
                      placeholder="Weka jina la mgeni..."
                      value={editGuestName}
                      onChange={(e) => setEditGuestName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-355 block" htmlFor="edit-send-mgeni-phone">
                      {isEn ? 'PHONE NUMBER *' : 'NAMBA YA SIMU *'}
                    </label>
                    <input 
                      id="edit-send-mgeni-phone"
                      type="tel" 
                      required 
                      placeholder="e.g. 0714786751"
                      value={editGuestPhone}
                      onChange={(e) => setEditGuestPhone(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-355 block" htmlFor="edit-send-mgeni-type">
                      {isEn ? 'CARD / TABLE TYPE *' : 'KUNDI / AINA YA KADI *'}
                    </label>
                    <select
                      id="edit-send-mgeni-type"
                      value={editGuestType}
                      onChange={(e) => setEditGuestType(e.target.value)}
                      className="w-full bg-[#050b18] border border-white/15 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-bold cursor-pointer"
                    >
                      <option value="SINGLE">SINGLE</option>
                      <option value="DOUBLE">DOUBLE</option>
                      <option value="UNCLASSIFIED">UNCLASSIFIED</option>
                    </select>
                  </div>

                  <div className="flex space-x-2 pt-2 border-t border-white/5">
                    <button 
                      type="button"
                      onClick={() => setEditingGuest(null)}
                      className="flex-grow py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition cursor-pointer text-center"
                    >
                      {isEn ? 'Cancel' : 'Ghairi'}
                    </button>
                    <button 
                      type="submit"
                      className="flex-grow py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] text-white font-bold rounded-xl transition shadow-md cursor-pointer text-center"
                    >
                      {isEn ? 'Save Changes ✓' : 'Hifadhi ✓'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </PortalModal>
        )}
      </AnimatePresence>

      {/* 3. Modal: Active Send Target / Card Dispatch Modals */}
      <AnimatePresence>
        {activeSendTarget && (
          <PortalModal key="active-send-portal">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" id="send-dispatch-overlay-modal">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-[#0f172a] border border-white/10 rounded-3xl p-5 sm:p-7 max-w-lg w-full shadow-2xl space-y-4 text-left font-sans text-white relative"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center space-x-2">
                  <div className={`p-2 rounded-xl ${activeSendTarget.channel === 'whatsapp' ? 'bg-teal-500/10 text-teal-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">
                      {isEn 
                        ? `Send via ${activeSendTarget.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}` 
                        : `Tuma kwa ${activeSendTarget.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}`}
                    </h3>
                    <p className="text-[10px] text-slate-455 font-medium font-sans">
                      {isEn ? 'Guest:' : 'Mgeni:'} <span className="text-white font-bold">{activeSendTarget.guest.name}</span> ({activeSendTarget.guest.phone})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSendTarget(null)}
                  className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition cursor-pointer absolute top-4 right-4"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Message Body Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider">
                    {isEn ? 'MESSAGE CONTENT' : 'MAUDHUI YA UJUMBE'}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(getGuestMessageText(activeSendTarget.guest, activeSendTarget.channel === 'sms', activeSendTarget.channel === 'whatsapp'));
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }}
                    className="flex items-center space-x-1 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition cursor-pointer"
                    type="button"
                  >
                    {copySuccess ? <Check className="w-3 h-3 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                    <span>{copySuccess ? (isEn ? 'Copied!' : 'Imenakiliwa!') : (isEn ? 'Copy Ujumbe' : 'Copy Ujumbe')}</span>
                  </button>
                </div>
                
                <div className="bg-slate-950 p-4 rounded-xl border border-white/5 font-mono text-[10.5px] text-slate-200 leading-relaxed whitespace-pre-wrap max-h-[140px] overflow-y-auto select-all scrollbar-thin">
                  {getGuestMessageText(activeSendTarget.guest, activeSendTarget.channel === 'sms', activeSendTarget.channel === 'whatsapp')}
                </div>
              </div>

              {/* Visual Card Preview and Secure Local Downloader */}
              <div className="flex flex-col items-center justify-center p-3.5 bg-slate-950/60 rounded-xl border border-white/5 space-y-2.5">
                <span className="text-[10px] font-bold text-slate-400 self-start font-mono uppercase tracking-wider">
                  {isEn ? 'INVITATION CARD PREVIEW' : 'MUONEKANO WA KADI YA MWALIKO (INVITATION CARD)'}
                </span>
                
                <div className="relative group overflow-hidden rounded-lg border border-white/10 shadow-lg min-h-[150px] w-full flex items-center justify-center bg-[#070b13]">
                  {!modalImageLoaded ? (
                    <div className="flex flex-col items-center justify-center p-6 space-y-2 text-slate-400">
                      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      <p className="text-[10px]">{isEn ? 'Generating card preview...' : 'Inatengeneza muonekano wa kadi...'}</p>
                    </div>
                  ) : (
                    <img 
                      src={modalCardUrl} 
                      alt="Muonekano wa Kadi" 
                      className="w-40 sm:w-44 h-auto rounded-lg transition duration-200 group-hover:scale-[1.01]" 
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>

                {modalImageLoaded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-1">
                    <button
                      type="button"
                      onClick={handleCopyImageToClipboard}
                      className="py-2.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/20 rounded-xl text-xs font-bold text-blue-300 transition flex items-center justify-center space-x-1.5 cursor-pointer hover:text-blue-200 text-center"
                      title={isEn ? 'Copy invitation card image directly to clipboard' : 'Nakili picha hii moja kwa moja ili uweze kubandika (Paste) kwenye soga'}
                    >
                      {copyImageSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{isEn ? 'Copied!' : 'Picha Imenakiliwa!'}</span>
                        </>
                      ) : (
                        <>
                          <Clipboard className="w-3.5 h-3.5 text-blue-400" />
                          <span>📋 {isEn ? 'COPY CARD IMAGE' : 'COPY PICHA YA KADI'}</span>
                        </>
                      )}
                    </button>

                    <a
                      href={modalCardUrl}
                      download={`Mwaliko_${activeSendTarget.guest.name.trim().replace(/\s+/g, '_')}.jpg`}
                      className="py-2.5 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-300 transition flex items-center justify-center space-x-1.5 cursor-pointer hover:text-emerald-200 text-center"
                    >
                      <span>📥 {isEn ? 'DOWNLOAD CARD' : 'PAKUA PICHA YA KADI'}</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Guide/Instruction section */}
              <div className="bg-white/[0.01]/10 border border-white/5 p-4 rounded-xl text-[10.5px] text-slate-300 leading-normal space-y-1">
                <p className="font-bold text-white flex items-center space-x-1 text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{isEn ? 'Quick Messaging Guide (Copy-Paste) :' : 'Mbinu wepesi ya Kutuma Ujumbe (Copy-Paste) :'}</span>
                </p>
                {activeSendTarget.channel === 'whatsapp' ? (
                  isMetaWhatsApp ? (
                    <div className="text-slate-400 text-left space-y-1.5">
                      <p className="border-l-2 border-emerald-500 pl-2">
                         <span className="text-emerald-400 font-bold block">🚀 META CLOUD API IMESETIWA:</span>
                         Bonyeza kitufe cha <b>"Tuma Ujumbe (Send)"</b> hapa chini na mfumo utatuma kadi yako moja kwa moja kupitia WhatsApp Business API bila kufungua App ya WhatsApp! ✓
                      </p>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-left space-y-1.5">
                      <p className="border-l-2 border-emerald-500 pl-2">
                         <span className="text-emerald-400 font-bold block">🚀 NJIA RAHISI (Bila Kupakua):</span>
                         1. Bonyeza kitufe cha bluu cha <b>"📋 COPY PICHA YA KADI"</b> hapo juu. <br />
                         2. Bonyeza kitufe cha <b>"Copy Ujumbe"</b> upande wa juu wa ujumbe. <br />
                         3. Bonyeza <b>"Fungua WhatsApp"</b> chini. Soga ikifunguka, <b>Bandika (Paste / Ctrl+V)</b> picha, kisha bandika yale maandishi kama maelezo ya picha (caption) na utume! ✓
                      </p>
                      <p className="border-l-2 border-blue-500 pl-2 mt-1">
                         <span className="text-blue-400 font-bold block">💾 NJIA MBADALA (Kwa Kupakua):</span>
                         Kama kitufe cha copy kisizae katika kivinjari chako: Pakua picha kwa kubonyeza <b>"📥 PAKUA PICHA YA KADI"</b>, kisha pakia kama faili la picha kwenye soga ya mgeni na uweke ujumbe uliounakili kama caption.
                      </p>
                    </div>
                  )
                ) : (
                  <p className="text-slate-400">
                    {isEn 
                      ? 'Copy the invitation message and download the card, then send to your guest via SMS/MMS.'
                      : 'Soma maelekezo ya kadi, kisha kabla ya kutuma mwaliko nakili ujumbe na uutumie pamoja na picha uliyopakua kwa njia ya SMS ili kuruhusu mratibu kuendelea naye.'}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col space-y-3 pt-2">
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setActiveSendTarget(null)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-slate-300 transition cursor-pointer"
                  >
                    {isEn ? 'Cancel' : 'Ghairi'}
                  </button>
                  
                  {activeSendTarget.channel === 'whatsapp' ? (
                    isMetaWhatsApp ? (
                      <button
                        type="button"
                        disabled={isDispatching}
                        onClick={() => handleConfirmSent(activeSendTarget.guest.id, 'whatsapp')}
                        className={`flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.30)] text-xs font-extrabold text-white transition flex items-center justify-center space-x-1.5 cursor-pointer text-center ${isDispatching ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        <span>{isDispatching ? (isEn ? 'Sending...' : 'Inatuma...') : (isEn ? 'Send via WhatsApp' : 'Tuma Ujumbe (Send)')}</span>
                      </button>
                    ) : (
                      <a
                        href={`https://wa.me/${cleanPhoneForWhatsapp(activeSendTarget.guest.phone)}?text=${encodeURIComponent(getGuestMessageText(activeSendTarget.guest, false, true))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleConfirmSent(activeSendTarget.guest.id, 'whatsapp')}
                        className={`flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.30)] text-xs font-extrabold text-white transition flex items-center justify-center space-x-1.5 cursor-pointer text-center ${isDispatching ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>{isDispatching ? (isEn ? 'Processing...' : 'Inachakata...') : (isEn ? 'Open WhatsApp' : 'Fungua WhatsApp')}</span>
                      </a>
                    )
                  ) : (
                    <button
                      type="button"
                      disabled={isDispatching}
                      onClick={() => handleConfirmSent(activeSendTarget.guest.id, 'sms')}
                      className={`flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] text-xs font-extrabold text-white transition cursor-pointer text-center ${isDispatching ? 'opacity-70 grayscale' : ''}`}
                    >
                      <span>{isDispatching ? (isEn ? 'Sending...' : 'Inatuma...') : (isEn ? 'Send via SMS' : 'Tuma kwa SMS')}</span>
                    </button>
                  )}
                </div>
                
                {/* Manual Marking fallback */}
                <button
                  type="button"
                  onClick={() => handleMarkManualSent(activeSendTarget.guest.id, activeSendTarget.channel)}
                  className="w-full py-2 bg-transparent hover:bg-white/5 border border-dashed border-white/20 rounded-xl text-[10px] font-bold text-slate-400 transition cursor-pointer"
                >
                  {isEn ? 'Wait, I sent it manually. Mark as Sent without using system API.' : 'Tayari nimeshatuma kwa mkono. Kamilisha bila kutumia Mfumo.'}
                </button>
              </div>
            </motion.div>
          </div>
          </PortalModal>
        )}
      </AnimatePresence>

      {/* Global Toast Notification */}
      <AnimatePresence>
        {toast && (
          <PortalModal>
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`fixed top-6 right-6 z-[9999] max-w-md px-5 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-xl font-medium text-xs sm:text-sm ${
                toast.type === 'error'
                  ? 'bg-slate-900/95 border-rose-500/50 text-rose-300 shadow-rose-950/40'
                  : toast.type === 'info'
                  ? 'bg-slate-900/95 border-blue-500/50 text-blue-300 shadow-blue-950/40'
                  : 'bg-slate-900/95 border-emerald-500/50 text-emerald-300 shadow-emerald-950/40'
              }`}
            >
              {toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              ) : toast.type === 'info' ? (
                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
              ) : (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              )}
              <span className="leading-snug">{toast.message}</span>
              <button onClick={() => setToast(null)} className="ml-auto p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </PortalModal>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModalConfig.isOpen && (
          <PortalModal>
            <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 0 }}
                className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-left"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                    <RefreshCw className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">{confirmModalConfig.title}</h3>
                </div>
                
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {confirmModalConfig.message}
                </p>

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 transition cursor-pointer"
                  >
                    {isEn ? 'Cancel' : 'Ghairi'}
                  </button>
                  <button
                    type="button"
                    onClick={confirmModalConfig.onConfirm}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 rounded-xl text-xs font-bold text-white transition cursor-pointer"
                  >
                    {confirmModalConfig.confirmText}
                  </button>
                </div>
              </motion.div>
            </div>
          </PortalModal>
        )}
      </AnimatePresence>

    </div>
  );
}
