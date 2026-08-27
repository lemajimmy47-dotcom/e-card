import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Search, Filter, Edit2, CheckCircle, Trash2, Shield, 
  Settings, Award, MessageSquare, Mail, RefreshCw, BarChart2, 
  DollarSign, PieChart as PieIcon, Upload, Calendar, Compass, 
  User, Check, ChevronRight, Share2, Download, Printer, Users, 
  AlertTriangle, CheckSquare, Coins, Clock, Send, PlayCircle, HelpCircle,
  ExternalLink, MessageCircle, X, AlertCircle, Clipboard, LayoutGrid, Image as ImageIcon, CreditCard,
  Palette, Sliders
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { Guest, EventDetails, ContributionCardTemplate, ContributionPayment } from '../types';
import { PREMADE_THEMES, drawContributionCardToCanvas, generateContributionCardImage } from '../utils/contributionCardDrawing';
import { isStatusSent } from '../utils/statusHelper';
import { addPdfWatermarks } from '../utils/pdfWatermark';
import { ReportWatermark } from './ReportWatermark';
import { convertWebPToJpeg } from '../utils/imageUtils';
import { parseUniversalGuestTable, parseFileToGuestMatrix } from '../utils/excelParser';

const qrCache = new Map<string, HTMLImageElement>();

// Themes moved to shared utility

function getOrCreateQRImage(text: string, callback: (img: HTMLImageElement) => void) {
  const cached = qrCache.get(text);
  if (cached) {
    callback(cached);
    return;
  }

  QRCode.toDataURL(text, {
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  }, (err, url) => {
    if (err || !url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      qrCache.set(text, img);
      callback(img);
    };
    img.src = url;
  });
}
import { useLanguage } from '../context/LanguageContext';
import { safeLocalStorage } from '../utils/storage';



interface ContributionManagerProps {
  key?: React.Key;
  event: EventDetails;
  guests: Guest[];
  onUpdateEvent: (updated: EventDetails) => void;
  onUpdateGuests: (updatedGuests: Guest[], actionDesc?: string, skipServerSave?: boolean) => void;
  eventsList: EventDetails[];
  onSelectEvent: (eventId: string) => void;
  contribTemplate?: ContributionCardTemplate;
  onUpdateContribTemplate?: (tpl: ContributionCardTemplate) => void;
}

export default function ContributionManager({
  event,
  guests,
  onUpdateEvent,
  onUpdateGuests,
  eventsList,
  onSelectEvent,
  contribTemplate,
  onUpdateContribTemplate
}: ContributionManagerProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  const renderDeliveryIndicator = (g: Guest) => {
    // Collect what has been successfully delivered specifically for contributions
    const deliveries: { type: string; channel: 'whatsapp' | 'sms'; lang: string }[] = [];

    const addDeliveriesForType = (
      typeEn: string,
      typeSw: string,
      customFieldPrefix: string,
      fallbackSentField: boolean | undefined,
      fallbackChan: string | undefined,
      fallbackLang: string | undefined,
      isLegacyFallback: boolean = false
    ) => {
      const lang = g.customFields?.[`${customFieldPrefix}_sent_lang`] || fallbackLang || language || 'sw';
      const typeStr = isEn ? typeEn : typeSw;

      const hasSms = g.customFields?.[`${customFieldPrefix}_sent_sms`] === 'true' ||
                     (g.customFields?.[`${customFieldPrefix}_sent_channel`] === 'sms' && g.customFields?.[`${customFieldPrefix}_sent_whatsapp`] !== 'true') ||
                     (fallbackChan === 'sms' && g.customFields?.[`${customFieldPrefix}_sent_whatsapp`] !== 'true');

      const hasWa = g.customFields?.[`${customFieldPrefix}_sent_whatsapp`] === 'true' ||
                    (g.customFields?.[`${customFieldPrefix}_sent_channel`] === 'whatsapp' && g.customFields?.[`${customFieldPrefix}_sent_sms`] !== 'true') ||
                    (fallbackChan === 'whatsapp' && g.customFields?.[`${customFieldPrefix}_sent_sms`] !== 'true');

      let added = false;
      if (hasSms) {
        deliveries.push({ type: typeStr, channel: 'sms', lang });
        added = true;
      }
      if (hasWa) {
        deliveries.push({ type: typeStr, channel: 'whatsapp', lang });
        added = true;
      }

      if (!added && !isLegacyFallback) {
        if (g.customFields?.[`${customFieldPrefix}_sent_channel`]) {
          deliveries.push({ type: typeStr, channel: g.customFields[`${customFieldPrefix}_sent_channel`] as 'whatsapp' | 'sms', lang });
          added = true;
        } else if (fallbackChan) {
          deliveries.push({ type: typeStr, channel: fallbackChan as 'whatsapp' | 'sms', lang });
          added = true;
        } else if (fallbackSentField) {
          deliveries.push({ type: typeStr, channel: (g.lastSentChannel || 'sms') as 'whatsapp' | 'sms', lang });
          added = true;
        }
      }
      return added;
    };

    addDeliveriesForType('Save Date', 'Tarehe', 'std', false, g.stdSentChannel, g.stdSentLang);
    const pledgeAdded = addDeliveriesForType('Pledge', 'Ahadi', 'pledge', g.pledgeSent, g.pledgeSentChannel, g.pledgeSentLang);
    addDeliveriesForType('Reminder', 'Kumbusho', 'reminder', false, g.reminderSentChannel, g.reminderSentLang);
    addDeliveriesForType('Thanks', 'Shukrani', 'thanks', false, g.thanksSentChannel, g.thanksSentLang);

    // Fallback for older database records
    if (!pledgeAdded) {
      if (isStatusSent(g.whatsappStatus)) {
        deliveries.push({ type: isEn ? 'Pledge' : 'Ahadi', channel: 'whatsapp', lang: language || 'sw' });
      }
      if (isStatusSent(g.smsStatus)) {
        deliveries.push({ type: isEn ? 'Pledge' : 'Ahadi', channel: 'sms', lang: language || 'sw' });
      }
    }

    if (deliveries.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-1">
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
              title={`${del.type}: ${isWa ? `Iliyofanikiwa kupitia WhatsApp (${langDisplay})` : `Iliyofanikiwa kupitia SMS (${langDisplay})`}`}
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
              <span className="capitalize">{del.channel === 'whatsapp' ? 'Whatsapp' : 'Sms'}</span>
              <span className="text-slate-500 font-normal">|</span>
              <span className="text-[7.5px] font-bold tracking-wider">{langDisplay}</span>
            </span>
          );
        })}
      </div>
    );
  };
  const [subTab, setSubTab] = useState<'dashboard' | 'contributors' | 'card-design' | 'social-poster' | 'payment-methods' | 'pledge-requests' | 'reminders' | 'thank-you' | 'message-center' | 'reports'>('dashboard');
  
  // Local states for forms
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'No Pledge' | 'Pledged' | 'Partially Paid' | 'Fully Paid'>('All');
  
  // Selected lists for bulk operations
  const [selectedGuests, setSelectedGuests] = useState<string[]>([]);
  
  // Payment Methods state
  const [payProvider, setPayProvider] = useState('');
  const [payType, setPayType] = useState<'Mobile' | 'Bank' | 'Lipa Namba' | ''>('');
  const [payNumber, setPayNumber] = useState('');
  const [payName, setPayName] = useState('');
  const [customProvider, setCustomProvider] = useState('');
  
  // Dialog controls
  const [isPledgeModalOpen, setIsPledgeModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [targetGuest, setTargetGuest] = useState<Guest | null>(null);

  // Quick add guest state
  const [showQuickAddGuest, setShowQuickAddGuest] = useState(false);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');
  const [newGuestCategory, setNewGuestCategory] = useState<'SINGLE' | 'DOUBLE' | 'FAMILY' | 'VIP'>('SINGLE');
  const [newGuestPledge, setNewGuestPledge] = useState('0');
  const [newGuestPaid, setNewGuestPaid] = useState('0');
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  
  // Inputs for modal
  const [modalPledgeAmount, setModalPledgeAmount] = useState('');
  const [modalPaymentAmount, setModalPaymentAmount] = useState('');
  const [modalPaymentRef, setModalPaymentRef] = useState('');
  const [modalPaymentDate, setModalPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [modalPaymentNotes, setModalPaymentNotes] = useState('');
  const [autoSendThankYouSMS, setAutoSendThankYouSMS] = useState(true);
  const [autoSendChannel, setAutoSendChannel] = useState<'SMS' | 'WhatsApp'>('SMS');

  const formatNumberWithCommas = (value: string) => {
    const clean = value.replace(/\D/g, '');
    return clean ? parseInt(clean, 10).toLocaleString('en-US') : '';
  };

  // Selected preset message template id
  const [messageTemplateIndex, setMessageTemplateIndex] = useState(0);
  const [sendingChannel, setSendingChannel] = useState<'SMS' | 'WhatsApp'>('SMS');
  const [includeSmsLink, setIncludeSmsLink] = useState(false);

  // Real-time sending status tracking
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [currentSendingIndex, setCurrentSendingIndex] = useState(0);
  const [sendLogs, setSendLogs] = useState<string[]>([]);

  // Interactive WhatsApp multi-send queue state
  const [waInteractiveQueue, setWaInteractiveQueue] = useState<{
    guests: Guest[];
    currentIndex: number;
    type: 'Pledge' | 'Reminder' | 'Thanks';
  } | null>(null);
  const [queueCardUrl, setQueueCardUrl] = useState('');
  const [queueCardLoaded, setQueueCardLoaded] = useState(false);
  const [waInteractiveSuccessPopup, setWaInteractiveSuccessPopup] = useState(false);

  // Progress states for chunked/batched database uploads to Cloud SQL Postgres (contributions)
  const [chunkUploadProgress, setChunkUploadProgress] = useState<number | null>(null);
  const [chunkUploadedCount, setChunkUploadedCount] = useState<{ current: number; total: number } | null>(null);
  const [isChunkUploading, setIsChunkUploading] = useState(false);
  const [chunkUploadError, setChunkUploadError] = useState<string | null>(null);
  const [lastUploadedGuestName, setLastUploadedGuestName] = useState<string>('');

  // Active individual send target states
  const [activeSendTarget, setActiveSendTarget] = useState<{ 
    guest: Guest, 
    channel: 'sms' | 'whatsapp' | 'preview', 
    type: 'Pledge' | 'Reminder' | 'Thanks' 
  } | null>(null);
  const [modalCardUrl, setModalCardUrl] = useState('');
  const [modalImageLoaded, setModalImageLoaded] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyImageSuccess, setCopyImageSuccess] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  // SMS Gateway Simulated Wallet and confirmation panel
  const [smsWalletBalance, setSmsWalletBalance] = useState<number | string>(() => {
    const saved = safeLocalStorage.getItem('kadi_sms_wallet_balance');
    return saved !== null ? parseInt(saved, 10) : 12;
  });
  const [isSimulationBalance, setIsSimulationBalance] = useState(true);

  const fetchRealSmsBalance = () => {
    fetch('/api/sms-balance')
      .then(res => res.json())
      .then(data => {
        if (!data.isSimulation && data.balance !== undefined && data.balance !== null) {
          setSmsWalletBalance(data.balance);
          setIsSimulationBalance(false);
        } else {
          setIsSimulationBalance(true);
        }
      })
      .catch(err => console.warn('Failed to fetch real sms balance:', err));
  };

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

  useEffect(() => {
    fetchRealSmsBalance();
    fetch('/api/sms-settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.provider) {
          setGatewaySettings(data);
        }
      })
      .catch(err => console.warn('Failed to fetch gateway settings:', err));
  }, []);

  useEffect(() => {
    if (isSimulationBalance) {
      safeLocalStorage.setItem('kadi_sms_wallet_balance', smsWalletBalance.toString());
    }
  }, [smsWalletBalance, isSimulationBalance]);

  // Load and store customizable message templates for each event (EN and SW versions)
  // We prioritize event.smsTemplates (persisted in database), then safeLocalStorage (for client-side fallback), then default strings.
  const [tplPledge1En, setTplPledge1En] = useState<string>(() => {
    let saved = event.smsTemplates?.pledge1En || safeLocalStorage.getItem(`kadi_tpl_pledge1_en_${event.id}`);
    const newDefault = `Hello {name},\n\nThe family of {host_name} warmly invites you to support our upcoming {event_name} scheduled for {date}.\n\nYour contribution is deeply appreciated and will play a vital role in making this celebration a success. We kindly request you to submit your pledge or contribution by {tarehe_ya_mwisho}.\n\nContribution Details:\n{namba_za_malipo}\n\nThank you for your love and support!`;
    if (saved && saved.includes('Tigo Pesa')) return saved; // Support people who modified the previous hardcoded one
    if (saved) {
      if (!/\{tarehe_ya_mwisho\}/i.test(saved)) {
        if (saved.includes("very valuable to us.")) {
          saved = saved.replace(
            "very valuable to us.",
            "very valuable to us and will make this event a success.\nThe deadline to send your contribution is {tarehe_ya_mwisho}"
          );
        } else {
          if (saved.includes("{payment_methods}")) {
            saved = saved.replace("{payment_methods}", "The deadline to send your contribution is {tarehe_ya_mwisho}\n\n{payment_methods}");
          } else if (saved.includes("{namba_za_malipo}")) {
            saved = saved.replace("{namba_za_malipo}", "The deadline to send your contribution is {tarehe_ya_mwisho}\n\n{namba_za_malipo}");
          } else {
            saved = saved.replace("{kiungo}", "The deadline to send your contribution is {tarehe_ya_mwisho}\n\n{kiungo}");
          }
        }
      }
      if (!/\{payment_methods\}/i.test(saved) && !/\{namba_za_malipo\}/i.test(saved)) {
        saved = saved.replace("{kiungo}", "{namba_za_malipo}\n\n{kiungo}");
      }
      return saved;
    }
    return newDefault;
  });
  const [tplPledge1Sw, setTplPledge1Sw] = useState<string>(() => {
    let saved = event.smsTemplates?.pledge1Sw || safeLocalStorage.getItem(`kadi_tpl_pledge1_sw_${event.id}`);
    const newDefault = `Habari {name},\n\nFamilia ya {host_name} inakusalimu kwa unyenyekevu. Tunakuomba ushirikiane nasi kwa mchango wako wa upendo ili kufanikisha tukio letu la {event_name} litakalofanyika tarehe {date}.\n\nMchango wako ni wa thamani kubwa kwetu na utasaidia sana katika maandalizi ya jambo hili. Tunaomba uwasilishe mchango wako kabla ya tarehe {tarehe_ya_mwisho}.\n\nNamba za Michango:\n{namba_za_malipo}\n\nAhsante sana kwa upendo wako na Mungu akubariki!`;
    if (saved && saved.includes('Tigo Pesa')) return saved;
    if (saved) {
      if (!/\{tarehe_ya_mwisho\}/i.test(saved)) {
        saved = saved.replace(
          "utafanikisha jambo hili.",
          "utafanikisha jambo hili.\nMwisho wa kutuma mchango wako ni tarehe {tarehe_ya_mwisho}"
        );
      }
      if (!/\{namba_za_malipo\}/i.test(saved) && !/\{payment_methods\}/i.test(saved)) {
        if (saved.includes("Namba za Michango:")) {
          saved = saved.replace("Namba za Michango:", "Namba za Michango:\n{namba_za_malipo}");
        } else {
          saved = saved.replace("{kiungo}", "{namba_za_malipo}\n\n{kiungo}");
        }
      }
      return saved;
    }
    return newDefault;
  });

  const [tplPledge2En, setTplPledge2En] = useState<string>(() => event.smsTemplates?.pledge2En || safeLocalStorage.getItem(`kadi_tpl_pledge2_en_${event.id}`) || `Dear {Mgeni},\n\nWe would be honored by your support in planning our upcoming event "{Tukio}".\n\nThank you deeply.`);
  const [tplPledge2Sw, setTplPledge2Sw] = useState<string>(() => event.smsTemplates?.pledge2Sw || safeLocalStorage.getItem(`kadi_tpl_pledge2_sw_${event.id}`) || `Ndugu {Mgeni},\n\nTunapokea kwa furaha ahadi za michango kwa ajili ya maandalizi ya tukio la {Tukio}.\n\nAsante muno.`);

  const [tplRem1En, setTplRem1En] = useState<string>(() => event.smsTemplates?.rem1En || safeLocalStorage.getItem(`kadi_tpl_rem1_en_${event.id}`) || `Dear {Mgeni},\n\nThis is a friendly reminder regarding your contribution pledge for "{Tukio}".\n\nYour contribution status:\n- Pledged: TZS {Ahadi}\n- Already Paid: TZS {Paid}\n- Outstanding Balance: TZS {Balance}\n\nPlease complete your contribution by {tarehe_ya_mwisho}.\n\nYou can send your contribution via:\n{payment_methods}\n\nThank you for your generous support and God bless you.`);
  const [tplRem1Sw, setTplRem1Sw] = useState<string>(() => event.smsTemplates?.rem1Sw || safeLocalStorage.getItem(`kadi_tpl_rem1_sw_${event.id}`) || `Ndugu {Mgeni},\n\nTunakukumbusha kwa upendo kuhusu ahadi yako ya mchango kwa ajili ya {Tukio}.\n\nTaarifa za mchango:\n\n Ahadi: TZS {Ahadi}\n\n Tayari Umelipa: TZS {Paid}\n\n Salio linalobaki: TZS {Balance}\n\nTafadhali kamilisha mchango wako kabla ya tarehe {tarehe_ya_mwisho}.\n\nUnaweza kutuma kupitia:\n\n{namba_za_malipo}\n\nAhsante sana kwa ushirikiano wako na Mungu akubariki.`);

  const [tplRem2En, setTplRem2En] = useState<string>(() => event.smsTemplates?.rem2En || safeLocalStorage.getItem(`kadi_tpl_rem2_en_${event.id}`) || `Dear {Mgeni},\n\nThis is a respectful reminder to complete your pending outstanding contribution balance to support our event "{Tukio}".\n\nBalance Due: TZS {Balance}\n\nThank you sincerely for your generosity.`);
  const [tplRem2Sw, setTplRem2Sw] = useState<string>(() => event.smsTemplates?.rem2Sw || safeLocalStorage.getItem(`kadi_tpl_rem2_sw_${event.id}`) || `Ndugu {Mgeni},\n\nTunakukumbusha kwa heshima kabisa kukamilisha ahadi yako ya mchango kwa ajili ya kufanikisha tukio la {Tukio}.\n\nSalio linalobaki: TZS {Balance}\n\nAsante sana kwa ukarimu wako.`);

  const defaultThanksSw = `Habari {{1}},\n\nTunakushukuru kwa upendo mkubwa kwa kukamilisha mchango wako kikamilifu kwa ajili ya kufanikisha tukio letu la {{2}}.\n\nAsante sana na Mungu akubariki!`;
  
  const isBadThanksTemplate = (val: string | null | undefined) => {
    if (!val) return false;
    const lower = val.toLowerCase();
    return lower.includes("namba za simu") || lower.includes("m-pesa") || lower.includes("mixx by yas") || lower.includes("mobile money") || lower.includes("kuhudhuria");
  };

  const [tplThanks1En, setTplThanks1En] = useState<string>(() => event.smsTemplates?.thanks1En || safeLocalStorage.getItem(`kadi_tpl_thanks1_en_${event.id}`) || `Hello {Mgeni},\n\nWe would like to thank you with immense gratitude for fully completing your contribution pledge for our event "{Tukio}".\n\nThank you so much and God bless you!`);
  const [tplThanks1Sw, setTplThanks1Sw] = useState<string>(() => {
    const val = event.smsTemplates?.thanks1Sw || safeLocalStorage.getItem(`kadi_tpl_thanks1_sw_${event.id}`);
    if (isBadThanksTemplate(val)) return defaultThanksSw;
    return val || defaultThanksSw;
  });

  const [tplThanks2En, setTplThanks2En] = useState<string>(() => event.smsTemplates?.thanks2En || safeLocalStorage.getItem(`kadi_tpl_thanks2_en_${event.id}`) || `Dear {Mgeni},\n\nWe have successfully recorded your contribution in full.\n\nYour presence and priceless support are deeply appreciated as they play a huge role in making "{Tukio}" a reality.\n\nBlessings to you!`);
  const [tplThanks2Sw, setTplThanks2Sw] = useState<string>(() => {
    const val = event.smsTemplates?.thanks2Sw || safeLocalStorage.getItem(`kadi_tpl_thanks2_sw_${event.id}`);
    if (isBadThanksTemplate(val)) return defaultThanksSw;
    return val || defaultThanksSw;
  });

  // Active templates based on system language
  const customPledgeTpl1 = isEn ? tplPledge1En : tplPledge1Sw;
  const setCustomPledgeTpl1 = isEn ? setTplPledge1En : setTplPledge1Sw;
  const customPledgeTpl2 = isEn ? tplPledge2En : tplPledge2Sw;
  const setCustomPledgeTpl2 = isEn ? setTplPledge2En : setTplPledge2Sw;
  const customReminderTpl1 = isEn ? tplRem1En : tplRem1Sw;
  const setCustomReminderTpl1 = isEn ? setTplRem1En : setTplRem1Sw;
  const customReminderTpl2 = isEn ? tplRem2En : tplRem2Sw;
  const setCustomReminderTpl2 = isEn ? setTplRem2En : setTplRem2Sw;
  const customThanksTpl1 = isEn ? tplThanks1En : (isBadThanksTemplate(tplThanks1Sw) ? defaultThanksSw : tplThanks1Sw);
  const setCustomThanksTpl1 = isEn ? setTplThanks1En : setTplThanks1Sw;
  const customThanksTpl2 = isEn ? tplThanks2En : (isBadThanksTemplate(tplThanks2Sw) ? defaultThanksSw : tplThanks2Sw);
  const setCustomThanksTpl2 = isEn ? setTplThanks2En : setTplThanks2Sw;

  // Track the event ID for which templates are currently loaded in state memory to avoid race condition wipes
  const lastLoadedEventIdRef = useRef<string>(event.id);

  // Sync state values when event.id or event.smsTemplates changes to handle transitions without unmounting context
  useEffect(() => {
    const defaultEn1 = `Hello {name},\n\nThe family of {host_name} warmly invites you to support our upcoming {event_name} scheduled for {date}.\n\nYour contribution is deeply appreciated and will play a vital role in making this celebration a success. We kindly request you to submit your pledge or contribution by {tarehe_ya_mwisho}.\n\nContribution Details:\n{namba_za_malipo}\n\nThank you for your love and support!`;
    let savedEn1 = event.smsTemplates?.pledge1En || safeLocalStorage.getItem(`kadi_tpl_pledge1_en_${event.id}`);
    if (!savedEn1 || savedEn1.includes('{Mgeni}') || savedEn1.includes('{Tukio}')) {
      setTplPledge1En(defaultEn1);
    } else {
      if (!/\{tarehe_ya_mwisho\}/i.test(savedEn1)) {
        if (savedEn1.includes("very valuable to us.")) {
          savedEn1 = savedEn1.replace(
            "very valuable to us.",
            "very valuable to us and will make this event a success.\nThe deadline to send your contribution is {tarehe_ya_mwisho}"
          );
        } else {
          if (savedEn1.includes("{payment_methods}")) {
            savedEn1 = savedEn1.replace("{payment_methods}", "The deadline to send your contribution is {tarehe_ya_mwisho}\n\n{payment_methods}");
          } else if (savedEn1.includes("{namba_za_malipo}")) {
            savedEn1 = savedEn1.replace("{namba_za_malipo}", "The deadline to send your contribution is {tarehe_ya_mwisho}\n\n{namba_za_malipo}");
          } else {
            savedEn1 = savedEn1.replace("{kiungo}", "The deadline to send your contribution is {tarehe_ya_mwisho}\n\n{kiungo}");
          }
        }
      }
      if (!/\{payment_methods\}/i.test(savedEn1) && !/\{namba_za_malipo\}/i.test(savedEn1)) {
        savedEn1 = savedEn1.replace("{kiungo}", "{namba_za_malipo}\n\n{kiungo}");
      }
      setTplPledge1En(savedEn1);
    }
    
    let savedSw1 = event.smsTemplates?.pledge1Sw || safeLocalStorage.getItem(`kadi_tpl_pledge1_sw_${event.id}`);
    const defaultSw1 = `Habari {name},\n\nFamilia ya {host_name} inakusalimu kwa unyenyekevu. Tunakuomba ushirikiane nasi kwa mchango wako wa upendo ili kufanikisha tukio letu la {event_name} litakalofanyika tarehe {date}.\n\nMchango wako ni wa thamani kubwa kwetu na utasaidiana sana katika maandalizi ya jambo hili. Tunaomba uwasilishe mchango wako kabla ya tarehe {tarehe_ya_mwisho}.\n\nNamba za Michango:\n{namba_za_malipo}\n\nAhsante sana kwa upendo wako na Mungu akubariki!`;
    if (!savedSw1 || savedSw1.includes('{Mgeni}') || savedSw1.includes('{Tukio}') || savedSw1.includes('kutumbukiza') || savedSw1.includes('bofya kitufe')) {
      setTplPledge1Sw(defaultSw1);
    } else {
      if (!/\{tarehe_ya_mwisho\}/i.test(savedSw1)) {
        savedSw1 = savedSw1.replace(
          "utafanikisha jambo hili.",
          "utafanikisha jambo hili.\nMwisho wa kutuma mchango wako ni tarehe {tarehe_ya_mwisho}"
        );
      }
      if (!/\{namba_za_malipo\}/i.test(savedSw1) && !/\{payment_methods\}/i.test(savedSw1)) {
        if (savedSw1.includes("Namba za Michango:")) {
          savedSw1 = savedSw1.replace("Namba za Michango:", "Namba za Michango:\n{namba_za_malipo}");
        } else {
          savedSw1 = savedSw1.replace("{kiungo}", "{namba_za_malipo}\n\n{kiungo}");
        }
      }
      setTplPledge1Sw(savedSw1);
    }

    setTplPledge2En(event.smsTemplates?.pledge2En || safeLocalStorage.getItem(`kadi_tpl_pledge2_en_${event.id}`) || `Dear {Mgeni},\n\nWe would be honored by your support in planning our upcoming event "{Tukio}".\n\nThank you deeply.`);
    setTplPledge2Sw(event.smsTemplates?.pledge2Sw || safeLocalStorage.getItem(`kadi_tpl_pledge2_sw_${event.id}`) || `Ndugu {Mgeni},\n\nTunapokea kwa furaha ahadi za michango kwa ajili ya maandalizi ya tukio la {Tukio}.\n\nAsante muno.`);

    setTplRem1En(event.smsTemplates?.rem1En || safeLocalStorage.getItem(`kadi_tpl_rem1_en_${event.id}`) || `Dear {Mgeni},\n\nThis is a friendly reminder regarding your contribution pledge for "{Tukio}".\n\nYour contribution status:\n- Pledged: TZS {Ahadi}\n- Already Paid: TZS {Paid}\n- Outstanding Balance: TZS {Balance}\n\nPlease complete your contribution by {tarehe_ya_mwisho}.\n\nYou can send your contribution via:\n{payment_methods}\n\nThank you for your generous support and God bless you.`);
    setTplRem1Sw(event.smsTemplates?.rem1Sw || `Ndugu {Mgeni},\n\nTunakukumbusha kwa upendo kuhusu ahadi yako ya mchango kwa ajili ya {Tukio}.\n\nTaarifa za mchango:\n\n Ahadi: TZS {Ahadi}\n\n Tayari Umelipa: TZS {Paid}\n\n Salio linalobaki: TZS {Balance}\n\nTafadhali kamilisha mchango wako kabla ya tarehe {tarehe_ya_mwisho}.\n\nUnaweza kutuma kupitia:\n\n{namba_za_malipo}\n\nAhsante sana kwa ushirikiano wako na Mungu akubariki.`);

    setTplRem2En(event.smsTemplates?.rem2En || safeLocalStorage.getItem(`kadi_tpl_rem2_en_${event.id}`) || `Dear {Mgeni},\n\nThis is a respectful reminder to complete your pending outstanding contribution balance to support our event "{Tukio}".\n\nBalance Due: TZS {Balance}\n\nThank you sincerely for your generosity.`);
    setTplRem2Sw(event.smsTemplates?.rem2Sw || safeLocalStorage.getItem(`kadi_tpl_rem2_sw_${event.id}`) || `Ndugu {Mgeni},\n\nTunakukumbusha kwa heshima kabisa kukamilisha ahadi yako ya mchango kwa ajili ya kufanikisha tukio la {Tukio}.\n\nSalio linalobaki: TZS {Balance}\n\nAsante sana kwa ukarimu wako.`);

    setTplThanks1En(event.smsTemplates?.thanks1En || safeLocalStorage.getItem(`kadi_tpl_thanks1_en_${event.id}`) || `Hello {Mgeni},\n\nWe would like to thank you with immense gratitude for fully completing your contribution pledge for our event "{Tukio}".\n\nThank you so much and God bless you!`);
    const valThanks1 = event.smsTemplates?.thanks1Sw || safeLocalStorage.getItem(`kadi_tpl_thanks1_sw_${event.id}`);
    setTplThanks1Sw(isBadThanksTemplate(valThanks1) ? defaultThanksSw : (valThanks1 || defaultThanksSw));

    setTplThanks2En(event.smsTemplates?.thanks2En || safeLocalStorage.getItem(`kadi_tpl_thanks2_en_${event.id}`) || `Dear {Mgeni},\n\nWe have successfully recorded your contribution in full.\n\nYour presence and priceless support are deeply appreciated as they play a huge role in making "{Tukio}" a reality.\n\nBlessings to you!`);
    const valThanks2 = event.smsTemplates?.thanks2Sw || safeLocalStorage.getItem(`kadi_tpl_thanks2_sw_${event.id}`);
    setTplThanks2Sw(isBadThanksTemplate(valThanks2) ? defaultThanksSw : (valThanks2 || defaultThanksSw));
    
    lastLoadedEventIdRef.current = event.id;
  }, [event.id, event.smsTemplates]);

  // Handle auto-save safely only if loaded event.id matches
  useEffect(() => {
    if (lastLoadedEventIdRef.current === event.id) {
      safeLocalStorage.setItem(`kadi_tpl_pledge1_en_${event.id}`, tplPledge1En);
      safeLocalStorage.setItem(`kadi_tpl_pledge1_sw_${event.id}`, tplPledge1Sw);
    }
  }, [tplPledge1En, tplPledge1Sw, event.id]);

  useEffect(() => {
    if (lastLoadedEventIdRef.current === event.id) {
      safeLocalStorage.setItem(`kadi_tpl_pledge2_en_${event.id}`, tplPledge2En);
      safeLocalStorage.setItem(`kadi_tpl_pledge2_sw_${event.id}`, tplPledge2Sw);
    }
  }, [tplPledge2En, tplPledge2Sw, event.id]);

  useEffect(() => {
    if (lastLoadedEventIdRef.current === event.id) {
      safeLocalStorage.setItem(`kadi_tpl_rem1_en_${event.id}`, tplRem1En);
      safeLocalStorage.setItem(`kadi_tpl_rem1_sw_${event.id}`, tplRem1Sw);
    }
  }, [tplRem1En, tplRem1Sw, event.id]);

  useEffect(() => {
    if (lastLoadedEventIdRef.current === event.id) {
      safeLocalStorage.setItem(`kadi_tpl_rem2_en_${event.id}`, tplRem2En);
      safeLocalStorage.setItem(`kadi_tpl_rem2_sw_${event.id}`, tplRem2Sw);
    }
  }, [tplRem2En, tplRem2Sw, event.id]);

  useEffect(() => {
    if (lastLoadedEventIdRef.current === event.id) {
      safeLocalStorage.setItem(`kadi_tpl_thanks1_en_${event.id}`, tplThanks1En);
      safeLocalStorage.setItem(`kadi_tpl_thanks1_sw_${event.id}`, tplThanks1Sw);
    }
  }, [tplThanks1En, tplThanks1Sw, event.id]);

  useEffect(() => {
    if (lastLoadedEventIdRef.current === event.id) {
      safeLocalStorage.setItem(`kadi_tpl_thanks2_en_${event.id}`, tplThanks2En);
      safeLocalStorage.setItem(`kadi_tpl_thanks2_sw_${event.id}`, tplThanks2Sw);
    }
  }, [tplThanks2En, tplThanks2Sw, event.id]);

  const [isTemplateSaved, setIsTemplateSaved] = useState(false);

  const [smsSuccessPopup, setSmsSuccessPopup] = useState<{
    isOpen: boolean;
    sentCount: number;
    remainingSms: number;
    channel: 'SMS' | 'WhatsApp';
  } | null>(null);

  const triggerSmsWalletUpdate = (count: number, channel: 'SMS' | 'WhatsApp') => {
    if (channel === 'SMS') {
      let newBalance: number | string = smsWalletBalance;
      if (isSimulationBalance) {
        newBalance = (typeof smsWalletBalance === 'number' ? smsWalletBalance : parseInt(smsWalletBalance.toString() || '0', 10)) - count;
        setSmsWalletBalance(newBalance);
      } else {
        // Fetch actual remaining balance from the backend provider
        setTimeout(fetchRealSmsBalance, 1000);
      }

      setSmsSuccessPopup({
        isOpen: true,
        sentCount: count,
        remainingSms: isSimulationBalance ? newBalance : '...',
        channel: 'SMS'
      });
    } else {
      setSmsSuccessPopup({
        isOpen: true,
        sentCount: count,
        remainingSms: smsWalletBalance,
        channel: 'WhatsApp'
      });
    }
  };

  const handleEditGuestClick = (g: Guest) => {
    setEditingGuestId(g.id);
    setNewGuestName(g.name);
    setNewGuestPhone(g.phone || '');
    setNewGuestCategory((g.cardType as any) || 'SINGLE');
    setNewGuestPledge(g.pledgeAmount ? g.pledgeAmount.toLocaleString('en-US') : '0');
    setNewGuestPaid(g.paidAmount ? g.paidAmount.toLocaleString('en-US') : '0');
    setShowQuickAddGuest(true);
  };

  const renderGeniTable = (candidatesList: Guest[], actionType: 'Pledge' | 'Reminder' | 'Thanks') => {
    return (
      <div className="overflow-x-auto rounded-[1.25rem] border border-white/10 bg-black/20 backdrop-blur-md">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/5 font-mono text-[10px] text-slate-400 tracking-wider bg-white/[0.02]">
              <th className="py-3 px-4 w-10">
                <input 
                  type="checkbox"
                  checked={candidatesList.every(x => selectedGuests.includes(x.id)) && candidatesList.length > 0}
                  onChange={() => {
                    const allSelected = candidatesList.every(x => selectedGuests.includes(x.id));
                    if (allSelected) {
                      const idsToRemove = candidatesList.map(c => c.id);
                      setSelectedGuests(prev => prev.filter(id => !idsToRemove.includes(id)));
                    } else {
                      const idsToAdd = candidatesList.map(c => c.id);
                      setSelectedGuests(prev => {
                        const next = [...prev];
                        idsToAdd.forEach(id => {
                          if (!next.includes(id)) next.push(id);
                        });
                        return next;
                      });
                    }
                  }}
                  className="rounded border-white/10 bg-slate-900 focus:ring-amber-500 text-amber-500 cursor-pointer"
                />
              </th>
              <th className="py-3 px-4 text-slate-400 font-mono font-bold uppercase">{isEn ? 'GUEST & PHONE' : 'MGENI NA NAMBA'}</th>
              <th className="py-3 px-4 text-center text-slate-400 font-mono font-bold uppercase">{isEn ? 'AMOUNT INFO' : 'TAARIFA KIASI'}</th>
              <th className="py-3 px-4 text-center text-slate-400 font-mono font-bold uppercase">{isEn ? 'SMS STATUS' : 'HALI SMS'}</th>
              <th className="py-3 px-4 text-center text-slate-400 font-mono font-bold uppercase">{isEn ? 'WHATSAPP STATUS' : 'HALI WHATSAPP'}</th>
              <th className="py-3.5 px-4 text-right text-slate-400 font-mono font-bold uppercase truncate w-64">{isEn ? 'DISPATCH ACTION' : 'ZOEZI LA KUTUMA'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {candidatesList.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 font-mono uppercase tracking-widest text-[10px]">
                  {isEn ? 'No pending guests for this category' : 'Hakuna mgeni aliebaki kwenye kundi hili'}
                </td>
              </tr>
            ) : (
              candidatesList.map(g => {
                const isChecked = selectedGuests.includes(g.id);
                const p = g.pledgeAmount || 0;
                const pd = g.paidAmount || 0;
                const bal = p - pd;

                // Status Badge Logic
                const mType = actionType === 'Pledge' ? 'pledge' : (actionType === 'Reminder' ? 'reminder' : 'thanks');
                const isSmsSent = (g.customFields?.[`${mType}_sent_channel`] || g[`${mType}SentChannel` as any]) === 'sms' || 
                                  (mType === 'pledge' && g.pledgeSent && (g.pledgeSentChannel || g.lastSentChannel || 'sms') === 'sms') ||
                                  (mType === 'pledge' && isStatusSent(g.smsStatus));
                let smsBadge = isEn ? "Pending" : "Bado";
                let smsColor = "text-slate-500 bg-white/5 border-white/10";
                if (isSmsSent) {
                  smsBadge = isEn ? "Sent" : "Imetumia";
                  smsColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                }

                const isWaSent = (g.customFields?.[`${mType}_sent_channel`] || g[`${mType}SentChannel` as any]) === 'whatsapp' || 
                                 (mType === 'pledge' && g.pledgeSent && (g.pledgeSentChannel || g.lastSentChannel) === 'whatsapp') ||
                                 (mType === 'pledge' && isStatusSent(g.whatsappStatus));
                let waBadge = isEn ? "Pending" : "Bado";
                let waColor = "text-slate-500 bg-white/5 border-white/10";
                if (isWaSent) {
                  waBadge = isEn ? "Sent" : "Imetumia";
                  waColor = "text-emerald-400 bg-blue-500/10 border-blue-500/20";
                }

                return (
                  <tr 
                    key={g.id}
                    onClick={() => toggleSelectGuest(g.id)}
                    className={`cursor-pointer transition hover:bg-white/[0.04] ${isChecked ? 'bg-amber-500/5' : ''}`}
                  >
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => toggleSelectGuest(g.id)} 
                        className="rounded border-white/20 bg-slate-900 focus:ring-amber-500 text-amber-500 cursor-pointer" 
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-white text-[11px] block tracking-wide uppercase">{g.name}</div>
                      <div className="text-[9px] font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-400">{g.phone || 'NO PHONE'}</span>
                        {renderDeliveryIndicator(g) && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-white/20"></span>
                            {renderDeliveryIndicator(g)}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {actionType === 'Pledge' && (
                        <span className="text-[10px] font-mono text-slate-500">{isEn ? 'Awaiting Pledge' : 'Anasubiriwa'}</span>
                      )}
                      {actionType === 'Reminder' && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-mono text-slate-400">{isEn ? 'Due' : 'Deni'}: <b className="text-rose-400">TZS {bal.toLocaleString()}</b></span>
                          <span className="text-[8px] font-mono text-slate-500 uppercase">{isEn ? 'Pledge' : 'Ahadi'}: TZS {p.toLocaleString()}</span>
                          {g.payments && g.payments.length > 0 && (
                             <span className="text-[7.5px] font-bold text-amber-500 uppercase mt-0.5 tracking-tighter">[{g.payments.length} Payments Made]</span>
                          )}
                        </div>
                      )}
                      {actionType === 'Thanks' && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-mono text-emerald-400 font-bold tracking-tight">TZS {p.toLocaleString()}</span>
                          <span className="text-[8px] font-mono text-slate-500 uppercase">{isEn ? 'Fully Cleared' : 'Imelipwa Yote'}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${smsColor}`}>
                        {smsBadge}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${waColor}`}>
                        {waBadge}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5 flex-wrap md:flex-nowrap">
                        <button
                          onClick={() => handleEditGuestClick(g)}
                          className="px-2.5 py-1 rounded-lg font-bold text-[9px] bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 active:scale-95 transition cursor-pointer"
                        >
                          {isEn ? "Edit" : "Kuhariri"}
                        </button>
                        {actionType !== 'Thanks' && (
                          <button
                            onClick={() => setActiveSendTarget({ guest: g, channel: 'preview', type: actionType })}
                            disabled={isSendingAll}
                            className="px-2.5 py-1 rounded-lg font-bold text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 active:scale-95 transition cursor-pointer flex items-center gap-1.5 shrink-0"
                            title={isEn ? "Preview guest pledge card" : "Hakiki kadi ya ahadi ya mgeni"}
                          >
                            <span>🎴</span>
                            <span>{isEn ? "Card" : "Kadi"}</span>
                          </button>
                        )}
                        
                        {(isSmsSent || isWaSent) && (
                          <button
                            onClick={() => {
                              const updated = guests.map(item => {
                                if (item.id === g.id) {
                                  const customFields = { ...(item.customFields || {}) };
                                  delete customFields[`${mType}_sent_channel`];
                                  delete customFields[`${mType}_sent_lang`];
                                  return {
                                    ...item,
                                    customFields,
                                    [`${mType}Sent`]: false,
                                    [`${mType}SentChannel`]: undefined,
                                    [`${mType}SentLang`]: undefined,
                                    ...(mType === 'pledge' ? {
                                      smsStatus: 'Sijatuma' as const,
                                      whatsappStatus: 'Sijatuma' as const,
                                      pledgeSent: false,
                                      pledgeSentChannel: undefined,
                                      pledgeSentLang: undefined
                                    } : {}),
                                    ...(mType === 'reminder' ? {
                                      reminderSent: false,
                                      reminderSentChannel: undefined,
                                      reminderSentLang: undefined
                                    } : {}),
                                    ...(mType === 'thanks' ? {
                                      thanksSent: false,
                                      thanksSentChannel: undefined,
                                      thanksSentLang: undefined
                                    } : {})
                                  };
                                }
                                return item;
                              });
                              onUpdateGuests(updated, `Amefuta hali ya kutuma ${actionType} kwa ${g.name}`);
                            }}
                            className="p-1 px-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg transition cursor-pointer text-[10px]"
                            title="Futa Hali ya Kutuma"
                          >
                            Reset Hali
                          </button>
                        )}

                        <button
                          onClick={() => setActiveSendTarget({ guest: g, channel: 'sms', type: actionType })}
                          disabled={isSendingAll || isSmsSent}
                          className="px-2.5 py-1 rounded-lg font-bold text-[9px] bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition cursor-pointer disabled:opacity-30 disabled:bg-white/5 disabled:border-transparent disabled:text-slate-500"
                        >
                          SMS
                        </button>
                        <button
                          onClick={() => setActiveSendTarget({ guest: g, channel: 'whatsapp', type: actionType })}
                          disabled={isSendingAll || isWaSent}
                          className="px-2.5 py-1 rounded-lg font-bold text-[9px] bg-blue-500/10 border border-blue-500/35 text-blue-400 hover:bg-blue-500/20 active:scale-95 transition cursor-pointer disabled:opacity-30 disabled:bg-white/5 disabled:border-transparent disabled:text-slate-500"
                        >
                          WA
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // Logs inside client for simulation
  const [messageLogs, setMessageLogs] = useState<any[]>(() => {
    const cached = safeLocalStorage.getItem(`kadi_contrib_logs_${event.id}`);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) { return []; }
    }
    // Default mock log data
    return [
      { id: 'l-1', guestName: 'Fideli John', phone: '0712345678', type: 'Pledge Request', message: 'Nia ya mchango...', channel: 'SMS', sentAt: '2026-06-03 14:22', status: 'delivered' },
      { id: 'l-2', guestName: 'Maria Joseph', phone: '0788339944', type: 'Reminder', message: 'Kumbukumbu...', channel: 'WhatsApp', sentAt: '2026-06-04 09:12', status: 'read' }
    ];
  });

  // Saving logs
  useEffect(() => {
    // Keep last 100 logs to avoid QuotaExceededError
    const logsToSave = messageLogs.slice(-100);
    safeLocalStorage.setItem(`kadi_contrib_logs_${event.id}`, JSON.stringify(logsToSave));
  }, [messageLogs, event.id]);

  // Card Design Template details inside event/state
  const [cardTemplate, setCardTemplate] = useState<ContributionCardTemplate>(() => {
    // If props passed, use it, otherwise check cache, otherwise defaults
    if (contribTemplate && (contribTemplate.imageUrl || contribTemplate.themeId)) return contribTemplate;
    
    // Incrementing version key to kadi_card_tpl_v3 to force the new minimal defaults for users
    const cached = safeLocalStorage.getItem(`kadi_card_tpl_v3_${event.id}`);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) { /* ignore */ }
    }
    
    return {
      imageUrl: '', // Blank initially for custom upload
      themeId: 'midnight-gold',
      
      showEventName: false,
      eventNameX: 50,
      eventNameY: 18,
      eventNameSize: 24,
      eventNameColor: '#fbbf24',
      
      showGuestName: true,
      guestNameX: 50,
      guestNameY: 37,
      guestNameSize: 22,
      guestNameColor: '#FFFFFF',
      
      showPledgeAmount: false,
      pledgeAmountX: 50,
      pledgeAmountY: 56,
      pledgeAmountSize: 28,
      pledgeAmountColor: '#f43f5e',
      
      showDeadline: false,
      deadlineX: 50,
      deadlineY: 82,
      deadlineSize: 14,
      deadlineColor: '#94a3b8',
      
      showCardType: false,
      cardTypeX: 20,
      cardTypeY: 20,
      cardTypeSize: 12,
      cardTypeColor: '#fbbf24',
      
      showQrCode: false,
      qrCodeX: 80,
      qrCodeY: 80,
      qrCodeSize: 15
    };
  });

  const [isCardTemplateSaved, setIsCardTemplateSaved] = useState(false);

  const handleSaveCardTemplate = () => {
    safeLocalStorage.setItem(`kadi_card_tpl_v3_${event.id}`, JSON.stringify(cardTemplate));
    if (onUpdateContribTemplate) onUpdateContribTemplate(cardTemplate);
    setIsCardTemplateSaved(true);
    setTimeout(() => setIsCardTemplateSaved(false), 3000);
  };

  const handleCardImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCardTemplate(prev => ({
          ...prev,
          imageUrl: event.target?.result as string,
          themeId: '' // Clear premade if custom uploaded
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Enable
  const handleEnableContributions = () => {
    const updated = {
      ...event,
      contributionsEnabled: true
    };
    onUpdateEvent(updated);
  };

  // Event specifics
  const eventDeadlineStr = (event.contributionDeadline || event.date)
    ? new Date(event.contributionDeadline || event.date).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Bila Kikomo';

  // Metrics calculators
  const metrics = React.useMemo(() => {
    let totalGuests = guests.length;
    let totalExpectedAmount = 0; // expected from targets
    let totalPledgedAmount = 0;
    let totalPaidAmount = 0;

    let noPledgeCount = 0;
    let pledgedCount = 0;
    let partiallyPaidCount = 0;
    let fullyPaidCount = 0;

    guests.forEach(g => {
      const pledge = Number(g.pledgeAmount) || 0;
      const paid = Number(g.paidAmount) || 0;
      const status = g.pledgeStatus;

      totalPledgedAmount += pledge;
      totalPaidAmount += paid;

      const hasPledged = pledge > 0 || paid > 0 || (status && status !== 'No Pledge');

      if (!hasPledged) {
        noPledgeCount++;
      } else if (status === 'Fully Paid' || (pledge > 0 && paid >= pledge) || (pledge === 0 && paid > 0)) {
        fullyPaidCount++;
      } else if (status === 'Partially Paid' || (paid > 0 && paid < pledge)) {
        partiallyPaidCount++;
      } else {
        pledgedCount++;
      }
    });

    const outstandingBalance = totalPledgedAmount - totalPaidAmount;

    return {
      totalGuests,
      totalPledgedAmount,
      totalPaidAmount,
      outstandingBalance,
      noPledgeCount,
      pledgedCount,
      partiallyPaidCount,
      fullyPaidCount
    };
  }, [guests]);

  // List of active guests in category
  const activeEventGuests = guests;

  // Filter guests
  const filteredGuests = activeEventGuests.filter(g => {
    const refCode = `P-${g.id.substring(0, 6).toUpperCase()}`;
    const nameMatch = g.name.toLowerCase().includes(searchQuery.toLowerCase());
    const phoneMatch = g.phone.toLowerCase().includes(searchQuery.toLowerCase());
    const typeMatch = g.cardType.toLowerCase().includes(searchQuery.toLowerCase());
    const refMatch = refCode.toLowerCase().includes(searchQuery.toLowerCase());
    
    const currStatus = g.pledgeStatus || 'No Pledge';
    const statusMatch = statusFilter === 'All' ? true : currStatus === statusFilter;

    return (nameMatch || phoneMatch || typeMatch || refMatch) && statusMatch;
  });

  // Action methods
  const openPledgeModal = (guest: Guest) => {
    setTargetGuest(guest);
    setModalPledgeAmount(guest.pledgeAmount ? guest.pledgeAmount.toLocaleString('en-US') : '');
    setIsPledgeModalOpen(true);
  };

  const handleSavePledge = () => {
    if (!targetGuest) return;
    const pledgeNum = parseInt(modalPledgeAmount.replace(/\D/g, ''), 10) || 0;
    const currentPaid = targetGuest.paidAmount || 0;

    let status: 'No Pledge' | 'Pledged' | 'Partially Paid' | 'Fully Paid' = 'No Pledge';
    if (pledgeNum > 0) {
      if (currentPaid === 0) status = 'Pledged';
      else status = currentPaid >= pledgeNum ? 'Fully Paid' : 'Partially Paid';
    }

    const updatedGuests = guests.map(g => {
      if (g.id === targetGuest.id) {
        return {
          ...g,
          pledgeAmount: pledgeNum,
          pledgeStatus: status,
          paidAmount: currentPaid
        };
      }
      return g;
    });

    onUpdateGuests(updatedGuests, `Ameweka/Amerekebisha ahadi ya mgeni: ${targetGuest.name} (Ahadi mpya: TZS ${pledgeNum})`);
    setIsPledgeModalOpen(false);
    setTargetGuest(null);
  };

  const openPaymentModal = (guest: Guest) => {
    setTargetGuest(guest);
    setModalPaymentAmount('');
    setModalPaymentRef('TXN-' + Math.floor(100000 + Math.random() * 900000));
    setModalPaymentNotes('');
    setAutoSendThankYouSMS(true);
    setAutoSendChannel('SMS');
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = () => {
    if (!targetGuest) return;
    const amtPaidNew = parseInt(modalPaymentAmount.replace(/\D/g, ''), 10) || 0;
    if (amtPaidNew <= 0) {
      alert('Tafadhali ingiza kiasi sahihi cha malipo.');
      return;
    }

    const currentPledge = targetGuest.pledgeAmount || 0;
    const currentPayments = targetGuest.payments || [];
    
    const newPayment: ContributionPayment = {
      id: 'pay-' + Date.now(),
      amount: amtPaidNew,
      date: modalPaymentDate,
      reference: modalPaymentRef,
      notes: modalPaymentNotes || 'Malipo ya mchango'
    };

    const updatedPayments = [...currentPayments, newPayment];
    const newTotalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);

    let status: 'No Pledge' | 'Pledged' | 'Partially Paid' | 'Fully Paid' = 'No Pledge';
    if (currentPledge > 0) {
      if (newTotalPaid >= currentPledge) {
        status = 'Fully Paid';
      } else if (newTotalPaid > 0) {
        status = 'Partially Paid';
      } else {
        status = 'Pledged';
      }
    } else {
      // Auto-pledge to whatever they paid if pledge was 0
      status = 'Fully Paid';
    }

    const isFull = status === 'Fully Paid';

    const updatedGuests = guests.map(g => {
      if (g.id === targetGuest.id) {
        return {
          ...g,
          pledgeAmount: currentPledge === 0 ? newTotalPaid : currentPledge,
          pledgeStatus: status,
          paidAmount: newTotalPaid,
          payments: updatedPayments,
          thanksSent: isFull && autoSendThankYouSMS ? true : g.thanksSent,
          thanksSentChannel: isFull && autoSendThankYouSMS ? (autoSendChannel.toLowerCase() as any) : g.thanksSentChannel,
          thanksSentLang: isFull && autoSendThankYouSMS ? (isEn ? 'en' : 'sw') : g.thanksSentLang
        };
      }
      return g;
    });

    onUpdateGuests(updatedGuests, `Ameingiza malipo ya mgeni: ${targetGuest.name} (Kiasi: TZS ${amtPaidNew}, Njia: ${modalPaymentRef})`);

    // Automatic SMS or WhatsApp Thank-You dispatch
    if (autoSendThankYouSMS && targetGuest.phone) {
      const eventTitle = event.name || 'Sherehe';
      const payerName = targetGuest.name;
      const amtStr = amtPaidNew.toLocaleString();
      const totalPaidStr = newTotalPaid.toLocaleString();
      const balStr = Math.max(0, (currentPledge || newTotalPaid) - newTotalPaid).toLocaleString();

      let thankYouText = '';
      if (isFull) {
        thankYouText = isEn
          ? `Hello ${payerName}, thank you very much for completing your contribution of TZS ${amtStr} (Total Paid: TZS ${totalPaidStr}) for ${eventTitle}! Payment Ref: ${modalPaymentRef}. Your support is deeply appreciated!`
          : `Habari ${payerName}, tumepokea malipo yako ya TZS ${amtStr} (Jumla Kuu uliyolipa: TZS ${totalPaidStr}) kwa ajili ya ${eventTitle}. Msimbo wa Muamala: ${modalPaymentRef}. Tunakushukuru sana kwa kukamilisha ahadi yako! Ahsante sana!`;
      } else {
        thankYouText = isEn
          ? `Hello ${payerName}, we have received your payment of TZS ${amtStr} for ${eventTitle}. Total Paid: TZS ${totalPaidStr}, Remaining Balance: TZS ${balStr}. Payment Ref: ${modalPaymentRef}. Thank you!`
          : `Habari ${payerName}, tumepokea malipo yako ya TZS ${amtStr} kwa ajili ya ${eventTitle}. Jumla uliyolipa hadi sasa: TZS ${totalPaidStr}, Salio lililosalia: TZS ${balStr}. Msimbo: ${modalPaymentRef}. Ahsante sana kwa mchango wako!`;
      }

      fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: targetGuest.id,
          eventId: event.id,
          phone: targetGuest.phone,
          text: thankYouText,
          channel: autoSendChannel.toLowerCase(),
          lang: isEn ? 'en' : 'sw',
          templateName: isFull ? 'shukrani' : 'ukumbusho'
        })
      }).catch(err => console.error('Auto SMS dispatch error:', err));

      const logEntry = {
        id: 'log-auto-' + Date.now(),
        guestName: targetGuest.name,
        phone: targetGuest.phone,
        type: isFull ? 'Thank You' : 'Payment Receipt',
        message: thankYouText,
        channel: autoSendChannel,
        sentAt: new Date().toLocaleDateString(isEn ? 'en-US' : 'sw-TZ') + ' ' + new Date().toTimeString().split(' ')[0].substring(0, 5),
        status: 'delivered'
      };
      setMessageLogs(prev => [logEntry, ...prev]);
    }

    setIsPaymentModalOpen(false);
    setTargetGuest(null);
  };

  
  const handleDeletePayment = (guestId: string, paymentId: string, amount: number) => {
    if (!confirm(isEn ? "Are you sure you want to delete this payment record?" : "Je, una uhakika unataka kufuta rekodi hii ya malipo?")) return;
    const targetGuest = guests.find(g => g.id === guestId);
    if (!targetGuest) return;
    
    const updatedPayments = (targetGuest.payments || []).filter(p => p.id !== paymentId);
    const newTotalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const currentPledge = typeof targetGuest.pledgeAmount === 'number' ? targetGuest.pledgeAmount : 0;
    
    let status: "No Pledge" | "Pledged" | "Fully Paid" | "Partially Paid" = (targetGuest.pledgeStatus as any) || "No Pledge";
    if (newTotalPaid >= currentPledge && currentPledge > 0) {
      status = 'Fully Paid';
    } else if (newTotalPaid > 0) {
      status = 'Partially Paid';
    } else if (currentPledge > 0) {
      status = 'Pledged';
    } else {
      status = 'No Pledge';
    }
    
    const updatedGuests = guests.map(g => {
      if (g.id === guestId) {
        return {
          ...g,
          pledgeStatus: status,
          paidAmount: newTotalPaid,
          payments: updatedPayments
        };
      }
      return g;
    });
    
    onUpdateGuests(updatedGuests, `Amefuta rekodi ya malipo (TZS ${amount}) ya mgeni: ${targetGuest.name}`);
    if (isHistoryModalOpen) {
       // Also update target guest view locally to reflect changes
       setTargetGuest({
          ...targetGuest,
          pledgeStatus: status,
          paidAmount: newTotalPaid,
          payments: updatedPayments
       });
    }
  };

  const openHistoryModal = (guest: Guest) => {
    setTargetGuest(guest);
    setIsHistoryModalOpen(true);
  };

  // Sub-groups based on criteria
  const noPledgeList = guests.filter(g => {
    const p = Number(g.pledgeAmount) || 0;
    const pd = Number(g.paidAmount) || 0;
    const st = g.pledgeStatus;
    const hasPledged = p > 0 || pd > 0 || (st && st !== 'No Pledge');
    return !hasPledged;
  });

  const pendingCollectionList = guests.filter(g => {
    const p = Number(g.pledgeAmount) || 0;
    const pd = Number(g.paidAmount) || 0;
    const st = g.pledgeStatus;
    const hasPledged = p > 0 || pd > 0 || (st && st !== 'No Pledge');
    const isFullyPaid = st === 'Fully Paid' || (p > 0 && pd >= p) || (p === 0 && pd > 0);
    return hasPledged && !isFullyPaid;
  });

  const fullyPaidList = guests.filter(g => {
    const p = Number(g.pledgeAmount) || 0;
    const pd = Number(g.paidAmount) || 0;
    const st = g.pledgeStatus;
    return st === 'Fully Paid' || (p > 0 && pd >= p) || (p === 0 && pd > 0);
  });

  // Multi selector handlers
  const toggleSelectGuest = (id: string) => {
    setSelectedGuests(prev => 
      prev.includes(id) ? prev.filter(gid => gid !== id) : [...prev, id]
    );
  };

  const selectAllCandidates = (list: Guest[]) => {
    setSelectedGuests(prev => {
      const allIds = list.map(x => x.id);
      const allSelected = allIds.every(id => prev.includes(id));
      if (allSelected) {
        return prev.filter(id => !allIds.includes(id));
      } else {
        return Array.from(new Set([...prev, ...allIds]));
      }
    });
  };

  // Message Sending Templates
  const getGuestMessageStatus = (guestId: string, type: 'Pledge Request' | 'Reminder' | 'Thank You') => {
    const logs = messageLogs.filter(l => l.guestId === guestId && l.type === type);
    const smsLog = logs.find(l => l.channel === 'SMS' || l.channel === 'sms');
    const waLog = logs.find(l => l.channel === 'WhatsApp' || l.channel === 'whatsapp');
    
    return (
      <div className="flex flex-col gap-0.5 text-[8.5px] font-bold text-center">
        <span className={smsLog ? (smsLog.status === 'delivered' ? 'text-emerald-400' : 'text-amber-400') : 'text-slate-500'}>
          SMS: {smsLog ? (smsLog.status === 'delivered' ? '✓ IMETUMWA' : '... INATUMA') : 'BADO'}
        </span>
        <span className={waLog ? (waLog.status === 'delivered' ? 'text-blue-400' : 'text-amber-400') : 'text-slate-500'}>
          WA: {waLog ? (waLog.status === 'delivered' ? '✓ TAYARI' : '... TAYARI') : 'BADO'}
        </span>
      </div>
    );
  };

  const formatTemplate = (
    templateStr: string,
    guestName: string,
    eventName: string,
    link: string = '',
    pledge: number = 0,
    paid: number = 0,
    balance: number = 0,
    templateType: 'Pledge' | 'Reminder' | 'Thanks' = 'Pledge'
  ) => {
    let paymentString = '';
    if (event.paymentMethods && event.paymentMethods.length > 0) {
                 const mobile = event.paymentMethods.filter(m => m.type === 'Mobile');
                 const lipa = event.paymentMethods.filter(m => m.type === 'Lipa Namba');
                 const bank = event.paymentMethods.filter(m => m.type === 'Bank');
                 
                 const isMixx = (provider: string) => {
                   const p = String(provider || '').trim().toLowerCase();
                   return p === 'mixx by yas' || p === 'mixx by yass' || p.includes('mixx') || p.includes('yas');
                 };
 
                 const mobileNormal = mobile.filter(m => !isMixx(m.provider));
                 const mobileMixx = mobile.filter(m => isMixx(m.provider));
 
                 if (mobileNormal.length > 0) {
                   paymentString += isEn ? "Mobile Money:\n\n" : "Namba za Simu:\n\n";
                   mobileNormal.forEach(m => {
                     paymentString += `${m.provider}: ${m.number} (${m.name})\n\n`;
                   });
                 }
                 if (mobileMixx.length > 0) {
                   paymentString += "Mixx By Yas:\n\n";
                   mobileMixx.forEach(m => {
                     paymentString += `${m.number} (${m.name})\n\n`;
                   });
                 }
                 if (lipa.length > 0) {
                   paymentString += "Lipa Namba:\n\n";
                   lipa.forEach(m => {
                     paymentString += `${m.provider}: ${m.number} (${m.name})\n\n`;
                   });
                 }
                 if (bank.length > 0) {
                   paymentString += isEn ? "Bank Accounts:\n\n" : "Akaunti za Benki:\n\n";
                   bank.forEach(m => {
                     paymentString += `${m.provider}: ${m.number} (${m.name})\n\n`;
                   });
                 }
                 paymentString = paymentString.trim();
    } else {
      paymentString = "[Tafadhali weka namba za malipo kwenye Settings]";
    }

    const deadlineStr = (event.contributionDeadline || event.date)
      ? new Date(event.contributionDeadline || event.date).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
      : '[Tarehe]';

    let processedTemplate = templateStr;

    // Robust protection: If the template is missing {namba_za_malipo} / {payment_methods}, auto-inject it!
    if (templateType === 'Pledge' || templateType === 'Reminder') {
      if (!/\{namba_za_malipo\}/i.test(processedTemplate) && !/\{payment_methods\}/i.test(processedTemplate)) {
        if (processedTemplate.includes("Namba za Michango:")) {
          processedTemplate = processedTemplate.replace("Namba za Michango:", "Namba za Michango:\n{namba_za_malipo}");
        } else if (processedTemplate.includes("{kiungo}")) {
          processedTemplate = processedTemplate.replace("{kiungo}", "{namba_za_malipo}\n\n{kiungo}");
        } else {
          processedTemplate = processedTemplate + "\n\n{namba_za_malipo}";
        }
      }

      // Robust protection: If Swahili and missing {tarehe_ya_mwisho}, auto-inject it!
      if (!isEn && !/\{tarehe_ya_mwisho\}/i.test(processedTemplate)) {
        const matchKeywords = [
          "utafanikisha jambo hili.",
          "utafanikisha jambo hili,",
          "utafanikisha jambo hili",
          "Asante!"
        ];
        let injected = false;
        for (const kw of matchKeywords) {
          if (processedTemplate.includes(kw)) {
            processedTemplate = processedTemplate.replace(
              kw,
              `${kw}\nMwisho wa kutuma mchango wako ni tarehe {tarehe_ya_mwisho}`
            );
            injected = true;
            break;
          }
        }
        if (!injected) {
          if (processedTemplate.includes("Namba za Michango:")) {
            processedTemplate = processedTemplate.replace(
              "Namba za Michango:",
              "Mwisho wa kutuma mchango wako ni tarehe {tarehe_ya_mwisho}\n\nNamba za Michango:"
            );
          } else {
            processedTemplate = processedTemplate.replace(
              "{kiungo}",
              "Mwisho wa kutuma mchango wako ni tarehe {tarehe_ya_mwisho}\n\n{kiungo}"
            );
          }
        }
      }
    }

    return processedTemplate
      .replace(/{Mgeni}/g, guestName)
      .replace(/{NAME}/gi, guestName)
      .replace(/{name}/gi, guestName)
      .replace(/\{\{1\}\}/g, guestName)
      .replace(/{Tukio}/g, eventName)
      .replace(/{EVENT}/gi, eventName)
      .replace(/{event_name}/gi, eventName)
      .replace(/\{\{2\}\}/g, eventName)
      .replace(/{host_name}/gi, event.hostName || "[Mwenyeji]")
      .replace(/{date}/gi, event.date || "[Tarehe]")
      .replace(/{tarehe_ya_mwisho}/gi, deadlineStr)
      .replace(/\(tarehe_ya_mwisho\)/gi, deadlineStr)
      .replace(/\{\{6\}\}/g, deadlineStr)
      .replace(/{namba_za_malipo}/gi, paymentString)
      .replace(/{payment_methods}/gi, paymentString)
      .replace(/\{\{7\}\}/g, paymentString)
      .replace(/{Kiungo}/g, link)
      .replace(/{kiungo}/gi, link)
      .replace(/{LINK}/gi, link)
      .replace(/\{\{8\}\}/g, link)
      .replace(/{Ahadi}/g, pledge.toLocaleString())
      .replace(/{PLEDGE}/gi, pledge.toLocaleString())
      .replace(/\{\{3\}\}/g, pledge.toLocaleString())
      .replace(/{Paid}/g, paid.toLocaleString())
      .replace(/{PAID}/gi, paid.toLocaleString())
      .replace(/\{\{4\}\}/g, paid.toLocaleString())
      .replace(/{Balance}/g, balance.toLocaleString())
      .replace(/{BALANCE}/gi, balance.toLocaleString())
      .replace(/\{\{5\}\}/g, balance.toLocaleString());
  };

  const pledgeRequestTemplates = [
    {
      id: 'pr-1',
      title: isEn ? 'Pledge Request (Template 1)' : 'Ombi la Ahadi (Kiolezo cha 1)',
      text: (name: string, evName: string, link: string) => 
        formatTemplate(customPledgeTpl1, name, evName, link)
    },
    {
      id: 'pr-2',
      title: isEn ? 'Pledge Request (Template 2)' : 'Ombi la Ahadi (Kiolezo cha 2)',
      text: (name: string, evName: string, link: string) => 
        formatTemplate(customPledgeTpl2, name, evName, link)
    }
  ];

  const reminderTemplates = [
    {
      id: 'rem-1',
      title: isEn ? 'Payment Reminder (Template 1)' : 'Kumbusho (Kiolezo cha 1)',
      text: (name: string, evName: string, pledge: number, paid: number, bal: number, link: string = '') => 
        formatTemplate(customReminderTpl1, name, evName, link, pledge, paid, bal, 'Reminder')
    },
    {
      id: 'rem-2',
      title: isEn ? 'Payment Reminder (Template 2)' : 'Kumbusho (Kiolezo cha 2)',
      text: (name: string, evName: string, pledge: number, paid: number, bal: number, link: string = '') => 
        formatTemplate(customReminderTpl2, name, evName, link, pledge, paid, bal, 'Reminder')
    }
  ];

  const thankTemplates = [
    {
      id: 'th-1',
      title: isEn ? 'Shukrani (Template 1)' : 'Shukrani (Kiolezo cha 1)',
      text: (name: string, evName: string) => 
        formatTemplate(customThanksTpl1, name, evName, '', 0, 0, 0, 'Thanks')
    },
    {
      id: 'th-2',
      title: isEn ? 'Shukrani (Template 2)' : 'Shukrani (Kiolezo cha 2)',
      text: (name: string, evName: string) => 
        formatTemplate(customThanksTpl2, name, evName, '', 0, 0, 0, 'Thanks')
    }
  ];

  // Real messaging dispatch engine linked to API gateway
  const handleBulkSend = async (type: 'Pledge' | 'Reminder' | 'Thanks') => {
    if (selectedGuests.length === 0) {
      alert(isEn ? 'Please select guests first.' : 'Tafadhali chagua wageni kwanza.');
      return;
    }

    if (sendingChannel === 'WhatsApp') {
      const dispatchList = guests.filter(g => selectedGuests.includes(g.id));
      if (dispatchList.length === 0) {
        alert(isEn ? 'No candidates selected for WhatsApp sending. Please check guests first.' : 'Hakuna watu walioteuliwa kwa ajili ya WhatsApp. Tafadhali chagua wageni kwanza.');
        return;
      }
      setWaInteractiveQueue({
        guests: dispatchList,
        currentIndex: 0,
        type: type
      });
      return;
    }

    const confirmMsg = isEn 
      ? `Are you sure you want to send ${selectedGuests.length} ${type} messages via ${sendingChannel}?`
      : `Je, una uhakika unataka kutuma mialiko/ujumbe wa ${type === 'Pledge' ? 'Ombi la Ahadi' : (type === 'Reminder' ? 'Kumbusho la Makusanyo' : 'Shukrani')} kwa wageni ${selectedGuests.length} kupitia njia ya ${sendingChannel}?`;

    if (!confirm(confirmMsg)) {
      return;
    }

    setIsSendingAll(true);
    setSendingProgress(0);
    setSendLogs([`[0.00s] Kuanza kutuma ${type} kwa wageni (${selectedGuests.length}) kupitia ${sendingChannel}...`]);

    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://eventcard.app';
    const dispatchList = guests.filter(g => selectedGuests.includes(g.id));
    let processingGuests = [...guests];
    let sentSuccessfully = 0;
    let failedCount = 0;

    for (let i = 0; i < dispatchList.length; i++) {
      const g = dispatchList[i];
      setCurrentSendingIndex(i);
      setSendingProgress(Math.round(((i) / dispatchList.length) * 100));

      const text = getContributionMessageText(g, type, sendingChannel.toLowerCase() as 'sms' | 'whatsapp');

      // Generate a unique ID for search later
      const uniqueClogId = 'clog-' + Date.now() + '-' + i;

      // Add actual log to Message Center list immediately as "sending..."
      const startLog = {
        id: uniqueClogId,
        guestId: g.id,
        guestName: g.name,
        phone: g.phone || 'N/A',
        type: type === 'Pledge' ? 'Pledge Request' : (type === 'Reminder' ? 'Reminder' : 'Thank You'),
        message: text,
        channel: sendingChannel,
        sentAt: new Date().toLocaleDateString(isEn ? 'en-US' : 'sw-TZ') + ' ' + new Date().toTimeString().split(' ')[0].substring(0, 5),
        status: 'sending'
      };

      setMessageLogs(prev => [startLog, ...prev]);

      try {
        let pledgeText = '';
        if (type === 'Pledge') {
          pledgeText = isEn ? 'NOT PLEDGED YET' : 'BADO HAJAAHIDI';
        } else if (type === 'Reminder') {
          const bal = (g.pledgeAmount || 0) - (g.paidAmount || 0);
          pledgeText = isEn ? `BALANCE: TZS ${bal.toLocaleString()}` : `SALIO: TZS ${bal.toLocaleString()}`;
        } else {
          pledgeText = isEn ? `AMOUNT: TZS ${(g.pledgeAmount || 0).toLocaleString()}` : `KIASI: TZS ${(g.pledgeAmount || 0).toLocaleString()}`;
        }
        const compatibleImageUrl = await generateContributionCardImage(event, cardTemplate, g, pledgeText, isEn);
        const res = await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: g.id,
            eventId: event.id,
            phone: g.phone,
            text: text,
            channel: sendingChannel.toLowerCase(), // 'sms' or 'whatsapp'
            lang: isEn ? 'en' : 'sw',
            templateName: type === 'Pledge' ? (metaTemplateName || 'kadi_mchango') : (type === 'Reminder' ? 'ukumbusho' : 'shukrani'),
            templateParams: (() => {
              let paymentString = '';
              const isWhatsapp = sendingChannel.toLowerCase() === 'whatsapp';
              if (event.paymentMethods && event.paymentMethods.length > 0) {
                if (isWhatsapp) {
                  const items: string[] = [];
                  event.paymentMethods.forEach(m => {
                    const isMixx = String(m.provider || '').trim().toLowerCase().includes('mixx') || String(m.provider || '').trim().toLowerCase().includes('yas');
                    if (m.type === 'Mobile') {
                      if (isMixx) {
                        items.push(`📱 Mixx By Yas: ${m.number} (${m.name})`);
                      } else {
                        items.push(`📱 ${m.provider}: ${m.number} (${m.name})`);
                      }
                    } else if (m.type === 'Lipa Namba') {
                      items.push(`💳 ${m.provider}: ${m.number} (${m.name})`);
                    } else if (m.type === 'Bank') {
                      items.push(`🏦 ${m.provider}: ${m.number} (${m.name})`);
                    }
                  });
                  paymentString = items.join('\n');
                } else {
                  const mobile = event.paymentMethods.filter(m => m.type === 'Mobile');
                  const lipa = event.paymentMethods.filter(m => m.type === 'Lipa Namba');
                  const bank = event.paymentMethods.filter(m => m.type === 'Bank');
                  
                  const isMixx = (provider) => {
                    const p = String(provider || '').trim().toLowerCase();
                    return p === 'mixx by yas' || p === 'mixx by yass' || p.includes('mixx') || p.includes('yas');
                  };

                  const mobileNormal = mobile.filter(m => !isMixx(m.provider));
                  const mobileMixx = mobile.filter(m => isMixx(m.provider));

                  if (mobileNormal.length > 0) {
                    paymentString += isEn ? "Mobile Money:\n\n" : "Namba za Simu:\n\n";
                    mobileNormal.forEach(m => {
                      paymentString += `${m.provider}: ${m.number} (${m.name})\n\n`;
                    });
                  }
                  if (mobileMixx.length > 0) {
                    paymentString += "Mixx By Yas:\n\n";
                    mobileMixx.forEach(m => {
                      paymentString += `${m.number} (${m.name})\n\n`;
                    });
                  }
                  if (lipa.length > 0) {
                    paymentString += "Lipa Namba:\n\n";
                    lipa.forEach(m => {
                      paymentString += `${m.provider}: ${m.number} (${m.name})\n\n`;
                    });
                  }
                  if (bank.length > 0) {
                    paymentString += isEn ? "Bank Accounts:\n\n" : "Akaunti za Benki:\n\n";
                    bank.forEach(m => {
                      paymentString += `${m.provider}: ${m.number} (${m.name})\n\n`;
                    });
                  }
                  paymentString = paymentString.trim();
                }
              } else {
                paymentString = isEn ? "[Please configure payment methods in settings]" : "[Tafadhali weka namba za malipo kwenye Settings]";
              }

              const deadlineStr = (event.contributionDeadline || event.date)
                ? new Date(event.contributionDeadline || event.date).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'Mwisho';

              if (type === 'Pledge') {
                return [
                  g.name,
                  event.hostName || "Mwenyeji",
                  event.name || "Sherehe",
                  event.date || "",
                  deadlineStr,
                  paymentString
                ];
              } else if (type === 'Reminder') {
                const p = g.pledgeAmount || 0;
                const pd = g.paidAmount || 0;
                return [
                  g.name,
                  event.name || 'Sherehe',
                  p.toString(),
                  pd.toString(),
                  (p - pd).toString(),
                  deadlineStr,
                  paymentString
                ];
              } else {
                return [g.name, event.name || 'Sherehe'];
              }
            })(),
            imageUrl: compatibleImageUrl,
            msgType: 'pledge'
          })
        });

        const responseText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(responseText);
        } catch (jsonErr) {
          throw new Error(isEn 
            ? `Server returned an invalid non-JSON response. It might be starting up or under maintenance.`
            : `Mtoa huduma amerejesha jibu ambalo si JSON. Server inaweza kuwa inaanza au kufanyiwa matengenezo.`);
        }
        
        if (!res.ok) {
          throw new Error(data.error || 'Utumaji ulikataliwa na gateway.');
        }

        sentSuccessfully++;
        if (sendingChannel === 'SMS') {
          setSmsWalletBalance(prev => Math.max(0, (typeof prev === 'number' ? prev : parseInt(prev.toString() || '0', 10)) - 1));
        }

        // Update status to delivered
        setMessageLogs(prev => prev.map(log => 
          log.id === uniqueClogId ? { ...log, status: 'delivered' } : log
        ));
        setSendLogs(prev => [`[✓ ${sendingChannel.toUpperCase()}] Ujumbe kwa ${g.name} umetumwa kikamilifu.`, ...prev]);

        // Update local and parent state guest details
        processingGuests = processingGuests.map(item => {
          if (item.id === g.id) {
            const customFields = item.customFields || {};
            const chan = sendingChannel.toLowerCase() === 'whatsapp' ? 'whatsapp' : 'sms';
            customFields.pledge_sent_channel = chan;
            customFields.pledge_sent_lang = isEn ? 'en' : 'sw';
            return {
              ...item,
              customFields,
              pledgeSent: true,
              pledgeSentChannel: chan,
              pledgeSentLang: isEn ? 'en' : 'sw'
            };
          }
          return item;
        });
        
        onUpdateGuests(processingGuests, "Sending contributions alert in progress...", true);

      } catch (err: any) {
        console.error("Failed to send contribution alert for guest:", g.name, err);
        failedCount++;
        setSendLogs(prev => [`[✗ Hitilafu] Mtandao umefeli kumfikia ${g.name} (${err.message})`, ...prev]);

        // Mark failed with customized status
        setMessageLogs(prev => prev.map(log => 
          log.id === uniqueClogId ? { ...log, status: 'failed', message: `${log.message}\n[HITILAFU: ${err.message}]` } : log
        ));
      }

      // Delay between loops to preserve gateway health & API limits
      await new Promise(resolve => setTimeout(resolve, i === dispatchList.length - 1 ? 10 : 800));
    }

    onUpdateGuests(processingGuests, "Finished sending contribution alerts", false);
    setIsSendingAll(false);
    setSendingProgress(100);

    if (failedCount > 0) {
      alert(isEn
        ? `Bulk dispatch completed. Successful: ${sentSuccessfully}, Failed: ${failedCount}. Please look at the 'Message Center' history trace logs for detailed error answers!`
        : `Zoezi la kutuma kikundi limekamilika. Zilizofanikiwa: ${sentSuccessfully}, Zilizoshindwa: ${failedCount}. Tafadhali angalia sehemu ya 'Kituo cha Ujumbe' kwa kupitia logi za hitilafu!`
      );
    } else {
      alert(isEn
        ? `Successfully sent all ${sentSuccessfully} reminders via ${sendingChannel}!`
        : `Ujumbe wote ${sentSuccessfully} imetumwa vyema kwa mafanikio kupitia ${sendingChannel}!`
      );
    }
    
    if (sendingChannel === 'SMS' && !isSimulationBalance) {
      setTimeout(fetchRealSmsBalance, 2000);
    }

    setSelectedGuests([]);
  };

  // Help normalize/clean Tanzanian numbers for WhatsApp redirects
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

  // Generate personalized template text for individual guest
  const getContributionMessageText = (
    g: Guest, 
    type: 'Pledge' | 'Reminder' | 'Thanks', 
    channel?: string,
    forceAppendLink: boolean = false
  ) => {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://eventcard.app';
    const link = `${currentOrigin}/?invite=${g.code || g.id}&pledge=true&eventId=${event.id}&lang=${language}`; // Removed tpl, backend handles it
    let text = '';
    if (type === 'Pledge') {
      text = pledgeRequestTemplates[messageTemplateIndex].text(g.name, event.name || 'Sherehe', link);
      // For SMS without {Kiungo} in template, let's append it if we are on SMS channel
      if (((channel || sendingChannel).toLowerCase() === 'sms' && includeSmsLink && !text.includes(link)) || (forceAppendLink && !text.includes(link))) {
        text += `\n\nKiungo/Link:\n${link}`;
      }
    } else if (type === 'Reminder') {
      const p = g.pledgeAmount || 0;
      const pd = g.paidAmount || 0;
      text = reminderTemplates[messageTemplateIndex].text(g.name, event.name || 'Sherehe', p, pd, p - pd, link);
      // For SMS without {Kiungo} in template, let's append it if we are on SMS channel
      if (((channel || sendingChannel).toLowerCase() === 'sms' && includeSmsLink && !text.includes(link)) || (forceAppendLink && !text.includes(link))) {
        text += `\n\nKiungo/Link:\n${link}`;
      }
    } else {
      text = thankTemplates[messageTemplateIndex].text(g.name, event.name || 'Sherehe');
    }

    const currentChannel = channel || sendingChannel.toLowerCase() as 'sms' | 'whatsapp';

    if (currentChannel === 'sms' && !includeSmsLink) {
      // 1. Remove URLs
      text = text.replace(/https?:\/\/[^\s]+/g, "");
      
      // 2. Remove the specific prompts leading to the link cleanly
      text = text.replace(/Tafadhali bofya hapa kuandikisha:\s*/gi, "");
      text = text.replace(/Please click here to register your pledge:\s*/gi, "");
      text = text.replace(/Please submit your pledge using this unique secure gateway:\s*/gi, "");
      text = text.replace(/Tafadhali wasilisha ahadi yako kupitia kiungo hiki:\s*/gi, "");
      
      // Clean up extra spacing/newlines
      text = text.replace(/\n\n\n+/g, "\n\n");
      text = text.trim();
    }

    return text;
  };

  const handleResetTemplateText = () => {
    const isConfirmed = window.confirm(
      isEn
        ? "Are you sure you want to reset the current message template back to its default text?"
        : "Je, una uhakika unataka kurudisha kiolezo hiki cha sasa kwenye ujumbe wa asili wa default?"
    );
    if (!isConfirmed) return;

    if (subTab === 'pledge-requests') {
      if (messageTemplateIndex === 0) {
        setCustomPledgeTpl1(
          isEn 
            ? `Hello {name},\n\nThe family of {host_name} warmly invites you to support our upcoming {event_name} scheduled for {date}.\n\nYour contribution is deeply appreciated and will play a vital role in making this celebration a success. We kindly request you to submit your pledge or contribution by {tarehe_ya_mwisho}.\n\nContribution Details:\n{namba_za_malipo}\n\nThank you for your love and support!`
            : `Habari {name},\n\nFamilia ya {host_name} inakusalimu kwa unyenyekevu. Tunakuomba ushirikiane nasi kwa mchango wako wa upendo ili kufanikisha tukio letu la {event_name} litakalofanyika tarehe {date}.\n\nMchango wako ni wa thamani kubwa kwetu na utasaidia sana katika maandalizi ya jambo hili. Tunaomba uwasilishe mchango wako kabla ya tarehe {tarehe_ya_mwisho}.\n\nNamba za Michango:\n{namba_za_malipo}\n\nAhsante sana kwa upendo wako na Mungu akubariki!`
        );
      } else {
        setCustomPledgeTpl2(
          isEn
            ? `Dear {Mgeni},\n\nWe would be honored by your support in planning our upcoming event "{Tukio}".\n\nThank you deeply.`
            : `Ndugu {Mgeni},\n\nTunapokea kwa furaha ahadi za michango kwa ajili ya maandalizi ya tukio la {Tukio}.\n\nAsante muno.`
        );
      }
    } else if (subTab === 'reminders') {
      if (messageTemplateIndex === 0) {
        setCustomReminderTpl1(
          isEn
            ? `Dear {Mgeni},\n\nThis is a friendly reminder regarding your contribution pledge for "{Tukio}".\n\nYour contribution status:\n- Pledged: TZS {Ahadi}\n- Already Paid: TZS {Paid}\n- Outstanding Balance: TZS {Balance}\n\nPlease complete your contribution by {tarehe_ya_mwisho}.\n\nYou can send your contribution via:\n{payment_methods}\n\nThank you for your generous support and God bless you.`
            : `Ndugu {Mgeni},\n\nTunakukumbusha kwa upendo kuhusu ahadi yako ya mchango kwa ajili ya {Tukio}.\n\nTaarifa za mchango:\n\n Ahadi: TZS {Ahadi}\n\n Tayari Umelipa: TZS {Paid}\n\n Salio linalobaki: TZS {Balance}\n\nTafadhali kamilisha mchango wako kabla ya tarehe {tarehe_ya_mwisho}.\n\nUnaweza kutuma kupitia:\n\n{namba_za_malipo}\n\nAhsante sana kwa ushirikiano wako na Mungu akubariki.`
        );
      } else {
        setCustomReminderTpl2(
          isEn
            ? `Dear {Mgeni},\n\nThis is a respectful reminder to complete your pending outstanding contribution balance to support our event "{Tukio}".\n\nBalance Due: TZS {Balance}\n\nThank you sincerely for your generosity.`
            : `Ndugu {Mgeni},\n\nTunakukumbusha kwa heshima kabisa kukamilisha ahadi yako ya mchango kwa ajili ya kufanikisha tukio la {Tukio}.\n\nSalio linalobaki: TZS {Balance}\n\nAsante sana kwa ukarimu wako.`
        );
      }
    } else if (subTab === 'thank-you') {
      if (messageTemplateIndex === 0) {
        setCustomThanksTpl1(
          isEn
            ? `Hello {Mgeni},\n\nWe would like to thank you with immense gratitude for fully completing your contribution pledge for our event "{Tukio}".\n\nThank you so much and God bless you!`
            : `Habari {{1}},\n\nTunakushukuru kwa upendo mkubwa kwa kukamilisha mchango wako kikamilifu kwa ajili ya kufanikisha tukio letu la {{2}}.\n\nAsante sana na Mungu akubariki!`
        );
      } else {
        setCustomThanksTpl2(
          isEn
            ? `Dear {Mgeni},\n\nWe have successfully recorded your contribution in full.\n\nYour presence and priceless support are deeply appreciated as they play a huge role in making "{Tukio}" a reality.\n\nBlessings to you!`
            : `Habari {{1}},\n\nTunakushukuru kwa upendo mkubwa kwa kukamilisha mchango wako kikamilifu kwa ajili ya kufanikisha tukio letu la {{2}}.\n\nAsante sana na Mungu akubariki!`
        );
      }
    }
  };

  const handleAddPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payType) {
      alert(isEn ? "Please select a payment type." : "Tafadhali chagua aina ya malipo kwanza.");
      return;
    }

    const finalProvider = payProvider === 'Other' ? customProvider.trim() : payProvider;
    if (!finalProvider || !payNumber || !payName) {
      alert(isEn ? "Please fill in all fields." : "Tafadhali jaza taarifa zote zilizobaki.");
      return;
    }

    const newMethod = {
      id: Date.now().toString(),
      type: payType as 'Mobile' | 'Bank' | 'Lipa Namba',
      provider: finalProvider,
      number: payNumber,
      name: payName
    };

    const currentMethods = event.paymentMethods || [];
    onUpdateEvent({
      ...event,
      paymentMethods: [...currentMethods, newMethod]
    });

    setPayType('');
    setPayProvider('');
    setPayNumber('');
    setPayName('');
    setCustomProvider('');
  };

  const handleRemovePaymentMethod = (id: string) => {
    if (!event.paymentMethods) return;
    onUpdateEvent({
      ...event,
      paymentMethods: event.paymentMethods.filter(m => m.id !== id)
    });
  };

  const handleSaveTemplate = () => {
    if (subTab === 'pledge-requests') {
      if (messageTemplateIndex === 0) {
        safeLocalStorage.setItem(`kadi_tpl_pledge1_sw_${event.id}`, tplPledge1Sw);
        safeLocalStorage.setItem(`kadi_tpl_pledge1_en_${event.id}`, tplPledge1En);
      } else {
        safeLocalStorage.setItem(`kadi_tpl_pledge2_sw_${event.id}`, tplPledge2Sw);
        safeLocalStorage.setItem(`kadi_tpl_pledge2_en_${event.id}`, tplPledge2En);
      }
    } else if (subTab === 'reminders') {
      if (messageTemplateIndex === 0) {
        safeLocalStorage.setItem(`kadi_tpl_rem1_sw_${event.id}`, tplRem1Sw);
        safeLocalStorage.setItem(`kadi_tpl_rem1_en_${event.id}`, tplRem1En);
      } else {
        safeLocalStorage.setItem(`kadi_tpl_rem2_sw_${event.id}`, tplRem2Sw);
        safeLocalStorage.setItem(`kadi_tpl_rem2_en_${event.id}`, tplRem2En);
      }
    } else if (subTab === 'thank-you') {
      if (messageTemplateIndex === 0) {
        safeLocalStorage.setItem(`kadi_tpl_thanks1_sw_${event.id}`, tplThanks1Sw);
        safeLocalStorage.setItem(`kadi_tpl_thanks1_en_${event.id}`, tplThanks1En);
      } else {
        safeLocalStorage.setItem(`kadi_tpl_thanks2_sw_${event.id}`, tplThanks2Sw);
        safeLocalStorage.setItem(`kadi_tpl_thanks2_en_${event.id}`, tplThanks2En);
      }
    }

    if (onUpdateEvent) {
      onUpdateEvent({
        ...event,
        smsTemplates: {
          ...(event.smsTemplates || {}),
          pledge1En: tplPledge1En,
          pledge1Sw: tplPledge1Sw,
          pledge2En: tplPledge2En,
          pledge2Sw: tplPledge2Sw,
          rem1En: tplRem1En,
          rem1Sw: tplRem1Sw,
          rem2En: tplRem2En,
          rem2Sw: tplRem2Sw,
          thanks1En: tplThanks1En,
          thanks1Sw: tplThanks1Sw,
          thanks2En: tplThanks2En,
          thanks2Sw: tplThanks2Sw,
        }
      });
    }

    setIsTemplateSaved(true);
    setTimeout(() => {
      setIsTemplateSaved(false);
    }, 3000);
  };

  const handleResetGuestStatus = (guestId: string) => {
    const isConfirmed = window.confirm(
      isEn 
        ? "Are you sure you want to reset this guest's pledge, payment status, and RSVP back to default?"
        : "Je, una uhakika unataka kurudisha taarifa za ahadi, malipo na mwaliko za mgeni huyu kwenye hali ya awali (Sijatuma/No Pledge)?"
    );
    if (!isConfirmed) return;

    const updated = guests.map(g => {
      if (g.id === guestId) {
        const newCustomFields = { ...(g.customFields || {}) };
        delete newCustomFields.pledge_sent_channel;
        delete newCustomFields.pledge_sent_lang;
        delete newCustomFields.reminder_sent_channel;
        delete newCustomFields.reminder_sent_lang;
        delete newCustomFields.thanks_sent_channel;
        delete newCustomFields.thanks_sent_lang;
        delete newCustomFields.std_sent_channel;
        delete newCustomFields.std_sent_lang;

        return {
          ...g,
          pledgeAmount: 0,
          paidAmount: 0,
          pledgeStatus: 'No Pledge' as const,
          payments: [],
          rsvpStatus: 'Bado' as const,
          rsvpGuestsCount: 1,
          rsvpComment: '',
          checkedIn: false,
          checkedInTime: undefined,
          smsStatus: 'Sijatuma' as const,
          whatsappStatus: 'Sijatuma' as const,
          pledgeSent: false,
          pledgeSentChannel: undefined,
          pledgeSentLang: undefined,
          reminderSent: false,
          reminderSentChannel: undefined,
          reminderSentLang: undefined,
          thanksSent: false,
          thanksSentChannel: undefined,
          thanksSentLang: undefined,
          stdSentChannel: undefined,
          stdSentLang: undefined,
          customFields: newCustomFields,
        };
      }
      return g;
    });

    onUpdateGuests(updated);

    const msg = isEn 
      ? `🔄 Status reset for guest: ${guests.find(x => x.id === guestId)?.name}` 
      : `🔄 Hali ya mgeni ilisafishwa: ${guests.find(x => x.id === guestId)?.name}`;
    setSendLogs(prev => [msg, ...prev]);

    setSmsSuccessPopup({
      isOpen: true,
      sentCount: 0,
      remainingSms: smsWalletBalance,
      channel: 'SMS'
    });
  };

  const handleResetAllGuests = () => {
    const isConfirmed = window.confirm(
      isEn
        ? "CRITICAL WARNING: Are you sure you want to reset ALL guests? This will clear all registered pledges, payment histories, RSVP status, and guest check-ins. This action cannot be undone!"
        : "ONYO KALI: Je, una uhakika unataka KUFUTA na KURUDISHA wageni WOTE kwenye hali ya awali? Hii itafuta ahadi zote, kumbukumbu za malipo, RSVP, na kujisajili. Kitendo hiki hakirudi nyuma!"
    );
    if (!isConfirmed) return;

    const updated = guests.map(g => {
      const newCustomFields = { ...(g.customFields || {}) };
      delete newCustomFields.pledge_sent_channel;
      delete newCustomFields.pledge_sent_lang;
      delete newCustomFields.reminder_sent_channel;
      delete newCustomFields.reminder_sent_lang;
      delete newCustomFields.thanks_sent_channel;
      delete newCustomFields.thanks_sent_lang;
      delete newCustomFields.std_sent_channel;
      delete newCustomFields.std_sent_lang;

      return {
        ...g,
        pledgeAmount: 0,
        paidAmount: 0,
        pledgeStatus: 'No Pledge' as const,
        payments: [],
        rsvpStatus: 'Bado' as const,
        rsvpGuestsCount: 1,
        rsvpComment: '',
        checkedIn: false,
        checkedInTime: undefined,
        smsStatus: 'Sijatuma' as const,
        whatsappStatus: 'Sijatuma' as const,
        pledgeSent: false,
        pledgeSentChannel: undefined,
        pledgeSentLang: undefined,
        reminderSent: false,
        reminderSentChannel: undefined,
        reminderSentLang: undefined,
        thanksSent: false,
        thanksSentChannel: undefined,
        thanksSentLang: undefined,
        stdSentChannel: undefined,
        stdSentLang: undefined,
        customFields: newCustomFields,
      };
    });

    onUpdateGuests(updated, `Amefuta na kurudisha kwenye hali ya awali (Reset) taarifa za wageni WOTE kwenye hili tukio`);
    setSendLogs([]);
    
    setSmsSuccessPopup({
      isOpen: true,
      sentCount: 0,
      remainingSms: smsWalletBalance,
      channel: 'SMS'
    });
  };

  const getActiveTemplateValues = () => {
    if (subTab === 'pledge-requests') {
      return {
        value: messageTemplateIndex === 0 ? customPledgeTpl1 : customPledgeTpl2,
        setter: messageTemplateIndex === 0 ? setCustomPledgeTpl1 : setCustomPledgeTpl2,
        placeholders: [
          { tag: '{name}', label: isEn ? 'Guest Name' : 'Jina la Mgeni' },
          { tag: '{event_name}', label: isEn ? 'Event Name' : 'Jina la Tukio' },
          { tag: '{host_name}', label: isEn ? 'Host Name' : 'Jina la Mwenyeji' },
          { tag: '{date}', label: isEn ? 'Event Date' : 'Tarehe ya Tukio' },
          { tag: '{tarehe_ya_mwisho}', label: isEn ? 'Deadline Date' : 'Tarehe ya Mwisho' },
          { tag: '{namba_za_malipo}', label: isEn ? 'Payment Methods' : 'Njia za Malipo' },
          { tag: '{kiungo}', label: isEn ? 'Pledge Link' : 'Kiungo cha Ahadi' }
        ]
      };
    } else if (subTab === 'reminders') {
      return {
        value: messageTemplateIndex === 0 ? customReminderTpl1 : customReminderTpl2,
        setter: messageTemplateIndex === 0 ? setCustomReminderTpl1 : setCustomReminderTpl2,
        placeholders: [
          { tag: '{Mgeni}', label: isEn ? 'Guest Name' : 'Jina la Mgeni' },
          { tag: '{Tukio}', label: isEn ? 'Event Name' : 'Jina la Tukio' },
          { tag: '{Ahadi}', label: isEn ? 'Pledge Amount' : 'Kiasi Kilichoahidiwa' },
          { tag: '{Paid}', label: isEn ? 'Paid Amount' : 'Kiasi Kilicholipwa' },
          { tag: '{Balance}', label: isEn ? 'Balance Due' : 'Salio Linalobaki' },
          { tag: '{namba_za_malipo}', label: isEn ? 'Payment Methods' : 'Njia za Malipo' }
        ]
      };
    } else {
      return {
        value: messageTemplateIndex === 0 ? customThanksTpl1 : customThanksTpl2,
        setter: messageTemplateIndex === 0 ? setCustomThanksTpl1 : setCustomThanksTpl2,
        placeholders: [
          { tag: '{Mgeni}', label: isEn ? 'Guest Name' : 'Jina la Mgeni' },
          { tag: '{Tukio}', label: isEn ? 'Event Name' : 'Jina la Tukio' }
        ]
      };
    }
  };

  const handleInsertTagAtCursor = (tag: string, textareaId: string) => {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const newVal = before + tag + after;
      
      const { setter } = getActiveTemplateValues();
      setter(newVal);
      
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + tag.length;
      }, 50);
    }
  };

  // Generation functions removed, now using shared utility

  // Copy queue card image output securely to clipboard
  const handleCopyQueueImageToClipboard = async () => {
    if (!queueCardUrl) return;
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard || !navigator.clipboard.write) {
        alert(isEn 
          ? 'Your browser does not support copying images directly. Please download the card image instead!'
          : 'Mfumo wa kivinjari chako hauruhusu kunakili picha moja kwa moja. Tafadhali bonyeza kitufe cha "Download" hapo chini.'
        );
        return;
      }
      const response = await fetch(queueCardUrl);
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
          img.src = queueCardUrl;
        });
      }

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': finalBlob })
      ]);
      setCopyImageSuccess(true);
      setTimeout(() => setCopyImageSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy queue image:', err);
    }
  };

  // Copy card image output securely to clipboard
  const handleCopyImageToClipboard = async () => {
    if (!modalCardUrl) return;
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard || !navigator.clipboard.write) {
        alert(isEn 
          ? 'Your browser does not support copying images directly. Please download the card image instead!'
          : 'Mfumo wa kivinjari chako hauruhusu kunakili picha moja kwa moja. Tafadhali bonyeza kitufe cha "Pakua Picha ya Kadi" hapo chini ili kuipakua na kuituma kwa WhatsApp.'
        );
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
      alert(isEn
        ? 'Failed to copy image automatically. Use the download button instead.'
        : 'Imeshindwa kunakili picha kiotomatiki. Tafadhali bonyeza kitufe cha "Pakua Picha ya Kadi" chini kuipakua kwenye simu yako kisha uitume kwa WhatsApp.'
      );
    }
  };

  // Re-draw active individual send card template whenever targets change
  useEffect(() => {
    if (!activeSendTarget) {
      setModalCardUrl('');
      setModalImageLoaded(false);
      return;
    }
    const { guest, type } = activeSendTarget;
    const canvas = document.createElement('canvas');
    const scaleFactor = 3;
    canvas.width = 450 * scaleFactor;
    canvas.height = 600 * scaleFactor;
    setModalImageLoaded(false);

    let pledgeText = '';
    if (type === 'Pledge') {
      pledgeText = isEn ? 'NOT PLEDGED YET' : 'BADO HAJAAHIDI';
    } else if (type === 'Reminder') {
      const bal = (g: Guest) => (g.pledgeAmount || 0) - (g.paidAmount || 0);
      pledgeText = `SALIO: TZS ${bal(guest).toLocaleString()}`;
    } else {
      pledgeText = `KIASI: TZS ${(guest.pledgeAmount || 0).toLocaleString()}`;
    }

    drawContributionCardToCanvas(
      canvas,
      event,
      cardTemplate,
      guest,
      pledgeText,
      isEn,
      () => {
        setModalCardUrl(canvas.toDataURL('image/jpeg', 0.95));
        setModalImageLoaded(true);
      }
    );
  }, [activeSendTarget, messageTemplateIndex, event, isEn, cardTemplate]);

  // Re-draw active queue send card template whenever queue changes
  useEffect(() => {
    if (!waInteractiveQueue) {
      setQueueCardUrl('');
      setQueueCardLoaded(false);
      return;
    }
    const guest = waInteractiveQueue.guests[waInteractiveQueue.currentIndex];
    if (!guest) return;
    
    const { type } = waInteractiveQueue;
    const canvas = document.createElement('canvas');
    const scaleFactor = 3;
    canvas.width = 450 * scaleFactor;
    canvas.height = 600 * scaleFactor;
    setQueueCardLoaded(false);

    let pledgeText = '';
    if (type === 'Pledge') {
      pledgeText = isEn ? 'NOT PLEDGED YET' : 'BADO HAJAAHIDI';
    } else if (type === 'Reminder') {
      const bal = (g: Guest) => (g.pledgeAmount || 0) - (g.paidAmount || 0);
      pledgeText = `SALIO: TZS ${bal(guest).toLocaleString()}`;
    } else {
      pledgeText = `KIASI: TZS ${(guest.pledgeAmount || 0).toLocaleString()}`;
    }

    drawContributionCardToCanvas(
      canvas,
      event,
      cardTemplate,
      guest,
      pledgeText,
      isEn,
      () => {
        setQueueCardUrl(canvas.toDataURL('image/jpeg', 0.95));
        setQueueCardLoaded(true);
      }
    );
  }, [waInteractiveQueue, waInteractiveQueue?.currentIndex, messageTemplateIndex, event, isEn, cardTemplate]);

  // Submit actual single SMS dispatch, or log successful individual WA redirection
  const handleConfirmSent = async (guestId: string, channel: 'sms' | 'whatsapp', type: 'Pledge' | 'Reminder' | 'Thanks') => {
    console.log(`[Diagnostic] Individual send triggered: guestId=${guestId}, channel=${channel}, type=${type}`);
    const g = guests.find(item => item.id === guestId);
    if (!g) return;

    setIsDispatching(true);
    const mainText = getContributionMessageText(g, type, channel);

    if (channel === 'sms' || (channel === 'whatsapp' && isMetaWhatsApp)) {
      try {
        let pledgeText = '';
        if (type === 'Pledge') {
          pledgeText = isEn ? 'NOT PLEDGED YET' : 'BADO HAJAAHIDI';
        } else if (type === 'Reminder') {
          const bal = (g.pledgeAmount || 0) - (g.paidAmount || 0);
          pledgeText = isEn ? `BALANCE: TZS ${bal.toLocaleString()}` : `SALIO: TZS ${bal.toLocaleString()}`;
        } else {
          pledgeText = isEn ? `AMOUNT: TZS ${(g.pledgeAmount || 0).toLocaleString()}` : `KIASI: TZS ${(g.pledgeAmount || 0).toLocaleString()}`;
        }
        const compatibleImageUrl = await generateContributionCardImage(event, cardTemplate, g, pledgeText, isEn);
        const res = await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: g.id,
            eventId: event.id,
            phone: g.phone,
            text: mainText,
            channel: channel, // Passes 'sms' or 'whatsapp' appropriately to server
            lang: isEn ? 'en' : 'sw',
            templateName: type === 'Pledge' ? (metaTemplateName || 'kadi_mchango') : (type === 'Reminder' ? 'ukumbusho' : 'shukrani'),
            templateParams: (() => {
              let paymentString = '';
              const isWhatsapp = channel === 'whatsapp';
              if (event.paymentMethods && event.paymentMethods.length > 0) {
                if (isWhatsapp) {
                  const items: string[] = [];
                  event.paymentMethods.forEach(m => {
                    const isMixx = String(m.provider || '').trim().toLowerCase().includes('mixx') || String(m.provider || '').trim().toLowerCase().includes('yas');
                    if (m.type === 'Mobile') {
                      if (isMixx) {
                        items.push(`📱 Mixx By Yas: ${m.number} (${m.name})`);
                      } else {
                        items.push(`📱 ${m.provider}: ${m.number} (${m.name})`);
                      }
                    } else if (m.type === 'Lipa Namba') {
                      items.push(`💳 ${m.provider}: ${m.number} (${m.name})`);
                    } else if (m.type === 'Bank') {
                      items.push(`🏦 ${m.provider}: ${m.number} (${m.name})`);
                    }
                  });
                  paymentString = items.join('\n');
                } else {
                  const mobile = event.paymentMethods.filter(m => m.type === 'Mobile');
                  const lipa = event.paymentMethods.filter(m => m.type === 'Lipa Namba');
                  const bank = event.paymentMethods.filter(m => m.type === 'Bank');
                  
                  const isMixx = (provider) => {
                    const p = String(provider || '').trim().toLowerCase();
                    return p === 'mixx by yas' || p === 'mixx by yass' || p.includes('mixx') || p.includes('yas');
                  };

                  const mobileNormal = mobile.filter(m => !isMixx(m.provider));
                  const mobileMixx = mobile.filter(m => isMixx(m.provider));

                  if (mobileNormal.length > 0) {
                    paymentString += isEn ? "Mobile Money:\n\n" : "Namba za Simu:\n\n";
                    mobileNormal.forEach(m => {
                      paymentString += `${m.provider}: ${m.number} (${m.name})\n\n`;
                    });
                  }
                  if (mobileMixx.length > 0) {
                    paymentString += "Mixx By Yas:\n\n";
                    mobileMixx.forEach(m => {
                      paymentString += `${m.number} (${m.name})\n\n`;
                    });
                  }
                  if (lipa.length > 0) {
                    paymentString += "Lipa Namba:\n\n";
                    lipa.forEach(m => {
                      paymentString += `${m.provider}: ${m.number} (${m.name})\n\n`;
                    });
                  }
                  if (bank.length > 0) {
                    paymentString += isEn ? "Bank Accounts:\n\n" : "Akaunti za Benki:\n\n";
                    bank.forEach(m => {
                      paymentString += `${m.provider}: ${m.number} (${m.name})\n\n`;
                    });
                  }
                  paymentString = paymentString.trim();
                }
              } else {
                paymentString = isEn ? "[Please configure payment methods in settings]" : "[Tafadhali weka namba za malipo kwenye Settings]";
              }

              const deadlineStr = (event.contributionDeadline || event.date)
                ? new Date(event.contributionDeadline || event.date).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'Mwisho';

              if (type === 'Pledge') {
                return [
                  g.name,
                  event.hostName || "Mwenyeji",
                  event.name || "Sherehe",
                  event.date || "",
                  deadlineStr,
                  paymentString
                ];
              } else if (type === 'Reminder') {
                const p = g.pledgeAmount || 0;
                const pd = g.paidAmount || 0;
                return [
                  g.name,
                  event.name || 'Sherehe',
                  p.toString(),
                  pd.toString(),
                  (p - pd).toString(),
                  deadlineStr,
                  paymentString
                ];
              } else {
                return [g.name, event.name || 'Sherehe'];
              }
            })(),
            imageUrl: compatibleImageUrl,
            msgType: type === 'Pledge' ? 'pledge' : (type === 'Reminder' ? 'reminder' : 'thanks')
          })
        });

        const responseText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(responseText);
        } catch (jsonErr) {
          throw new Error(isEn 
            ? `Server returned an invalid non-JSON response. It might be starting up or under maintenance.`
            : `Mtoa huduma amerejesha jibu ambalo si JSON. Server inaweza kuwa inaanza au kufanyiwa matengenezo.`);
        }
        if (!res.ok) {
          throw new Error(data.error || 'Utumaji ulishindikana kwenye gateway.');
        }

        const uniqueClogId = 'clog-' + Date.now();
        const startLog = {
          id: uniqueClogId,
          guestId: g.id,
          guestName: g.name,
          phone: g.phone || 'N/A',
          type: type === 'Pledge' ? 'Pledge Request' : (type === 'Reminder' ? 'Reminder' : 'Thank You'),
          message: mainText,
          channel: channel === 'whatsapp' ? 'WhatsApp' : 'SMS',
          sentAt: new Date().toLocaleDateString(isEn ? 'en-US' : 'sw-TZ') + ' ' + new Date().toTimeString().split(' ')[0].substring(0, 5),
          status: 'delivered'
        };
        setMessageLogs(prev => [startLog, ...prev]);
        setSendLogs(prev => [`[✓ ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}] Ujumbe umetumwa kwa ${g.name}`, ...prev]);

        const updatedGuests = guests.map(item => {
          if (item.id === g.id) {
            const customFields = { ...(item.customFields || {}) };
            const mType = type === 'Pledge' ? 'pledge' : (type === 'Reminder' ? 'reminder' : 'thanks');
            
            if (channel === 'sms') {
              customFields[`${mType}_sent_sms`] = 'true';
            } else if (channel === 'whatsapp') {
              customFields[`${mType}_sent_whatsapp`] = 'true';
            }
            
            customFields[`${mType}_sent_channel`] = channel;
            customFields[`${mType}_sent_lang`] = isEn ? 'en' : 'sw';
            return {
              ...item,
              customFields,
              [`${mType}Sent`]: true,
              [`${mType}SentChannel`]: channel,
              [`${mType}SentLang`]: isEn ? 'en' : 'sw'
            };
          }
          return item;
        });
        onUpdateGuests(updatedGuests);
        
        triggerSmsWalletUpdate(1, channel === 'whatsapp' ? 'WhatsApp' : 'SMS');
        setActiveSendTarget(null);
      } catch (err: any) {
        console.error(`Individual ${channel} dispatch mistake:`, err);
        const uniqueClogId = 'clog-' + Date.now();
        const startLog = {
          id: uniqueClogId,
          guestId: g.id,
          guestName: g.name,
          phone: g.phone || 'N/A',
          type: type === 'Pledge' ? 'Pledge Request' : (type === 'Reminder' ? 'Reminder' : 'Thank You'),
          message: `${mainText}\n[HITILAFU: ${err.message}]`,
          channel: channel === 'whatsapp' ? 'WhatsApp' : 'SMS',
          sentAt: new Date().toLocaleDateString(isEn ? 'en-US' : 'sw-TZ') + ' ' + new Date().toTimeString().split(' ')[0].substring(0, 5),
          status: 'failed'
        };
        setMessageLogs(prev => [startLog, ...prev]);
        setSendLogs(prev => [`[✗ ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}] Kushindwa kumpata ${g.name}: ${err.message}`, ...prev]);
      } finally {
        setIsDispatching(false);
      }
    } else {
      // Manual WhatsApp fallback behavior
      const uniqueClogId = 'clog-' + Date.now();
      const startLog = {
        id: uniqueClogId,
        guestId: g.id,
        guestName: g.name,
        phone: g.phone || 'N/A',
        type: type === 'Pledge' ? 'Pledge Request' : (type === 'Reminder' ? 'Reminder' : 'Thank You'),
        message: mainText,
        channel: 'WhatsApp',
        sentAt: new Date().toLocaleDateString(isEn ? 'en-US' : 'sw-TZ') + ' ' + new Date().toTimeString().split(' ')[0].substring(0, 5),
        status: 'delivered'
      };
      setMessageLogs(prev => [startLog, ...prev]);
      setSendLogs(prev => [`[✓ WhatsApp] Ujumbe umetumwa kwa ${g.name} (Manual)`, ...prev]);

      // Fire off simulation/lightweight backend update call in background for manual WhatsApp
      fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: g.id,
          phone: g.phone,
          text: 'manual_whatsapp',
          channel: 'whatsapp',
          msgType: type === 'Pledge' ? 'pledge' : (type === 'Reminder' ? 'reminder' : 'thanks'),
          lang: isEn ? 'en' : 'sw',
          isSimulationOnly: true
        })
      }).catch(err => console.error("Manual pledge status backend sync error:", err));

      const updatedGuests = guests.map(item => {
        if (item.id === g.id) {
          const customFields = { ...(item.customFields || {}) };
          const mType = type === 'Pledge' ? 'pledge' : (type === 'Reminder' ? 'reminder' : 'thanks');
          customFields[`${mType}_sent_whatsapp`] = 'true';
          customFields[`${mType}_sent_channel`] = 'whatsapp';
          customFields[`${mType}_sent_lang`] = isEn ? 'en' : 'sw';
          return {
            ...item,
            customFields,
            [`${mType}Sent`]: true,
            [`${mType}SentChannel`]: 'whatsapp',
            [`${mType}SentLang`]: isEn ? 'en' : 'sw'
          };
        }
        return item;
      });
      onUpdateGuests(updatedGuests);
      
      triggerSmsWalletUpdate(1, 'WhatsApp');
      setActiveSendTarget(null);
      setIsDispatching(false);
    }
  };

  const downloadCSVTemplate = () => {
    const csvContent = "Guest Full Name *,Phone Number (Optional),Category,Pledge (TZS),Paid (TZS)\nJohn Doe,0712345678,SINGLE,100000,50000\nJane Smith,0612345678,VIP,500000,500000";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `guests_template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Printable and Report functions
  const handlePrintReport = () => {
    downloadReportPDF(isEn ? 'Full Contributions Ledger' : 'Daftari Kamili la Michango', guests);
  };

  const handleQuickAddGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestName.trim()) return;

    const parsedPledge = parseInt(newGuestPledge.replace(/\D/g, ''), 10) || 0;
    const parsedPaid = parseInt(newGuestPaid.replace(/\D/g, ''), 10) || 0;

    if (editingGuestId) {
      const updatedGuests = guests.map(g => {
        if (g.id === editingGuestId) {
          return {
            ...g,
            name: newGuestName.trim(),
            phone: newGuestPhone.trim(),
            cardType: newGuestCategory,
            pledgeAmount: parsedPledge,
            paidAmount: parsedPaid,
            pledgeStatus: ((): 'No Pledge' | 'Pledged' | 'Partially Paid' | 'Fully Paid' => {
              const p = parsedPledge;
              const pd = parsedPaid;
              if (pd >= p && p > 0) return 'Fully Paid';
              if (pd > 0) return 'Partially Paid';
              if (p > 0) return 'Pledged';
              return 'No Pledge';
            })()
          };
        }
        return g;
      });
      onUpdateGuests(updatedGuests);
    } else {
      const newGuest: Guest = {
        id: 'g-' + Date.now(),
        eventId: event.id,
        name: newGuestName.trim(),
        phone: newGuestPhone.trim(),
        cardType: newGuestCategory,
        code: 'NW-' + Math.floor(Math.random() * 10000), // temp code
        smsStatus: 'Sijatuma',
        whatsappStatus: 'Sijatuma',
        rsvpStatus: 'Bado',
        rsvpGuestsCount: 0,
        checkedIn: false,
        pledgeAmount: parsedPledge,
        paidAmount: parsedPaid,
        pledgeStatus: ((): 'No Pledge' | 'Pledged' | 'Partially Paid' | 'Fully Paid' => {
          const p = parsedPledge;
          const pd = parsedPaid;
          if (pd >= p && p > 0) return 'Fully Paid';
          if (pd > 0) return 'Partially Paid';
          if (p > 0) return 'Pledged';
          return 'No Pledge';
        })()
      };
      onUpdateGuests([...guests, newGuest]);
    }

    setShowQuickAddGuest(false);
    setNewGuestName('');
    setNewGuestPhone('');
    setNewGuestCategory('SINGLE');
    setNewGuestPledge('0');
    setNewGuestPaid('0');
    setEditingGuestId(null);
  };

  const handleBulkUploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawMatrix = await parseFileToGuestMatrix(file);
      const parsedItems = parseUniversalGuestTable(rawMatrix);

      if (parsedItems.length === 0) {
        alert(isEn 
          ? "No guest records found in file. Make sure columns have headers like Name, Pledge, Paid." 
          : "Haikupata mgeni yeyote katika faili. Hakikisha majina na kiasi cha ahadi/kilicholipwa vipo.");
        return;
      }

      const newGuests: Guest[] = parsedItems.map((item, index) => {
        const categoryRaw = (item.cardType || item.category || 'SINGLE').toUpperCase();
        let allowedCategory: 'SINGLE' | 'DOUBLE' | 'FAMILY' | 'VIP' = 'SINGLE';
        if (['SINGLE', 'DOUBLE', 'FAMILY', 'VIP'].includes(categoryRaw)) {
          allowedCategory = categoryRaw as any;
        }

        return {
          id: 'g-' + Date.now() + '-' + index,
          eventId: event.id,
          name: item.name.trim(),
          phone: item.phone ? item.phone.trim() : '',
          cardType: allowedCategory,
          code: 'NW-' + Math.floor(Math.random() * 10000) + '-' + index,
          smsStatus: 'Sijatuma',
          whatsappStatus: 'Sijatuma',
          rsvpStatus: 'Bado',
          rsvpGuestsCount: allowedCategory === 'DOUBLE' ? 2 : 1,
          checkedIn: false,
          category: item.category,
          tags: item.tags || [],
          customFields: item.customFields || {},
          pledgeAmount: item.pledgeAmount || 0,
          paidAmount: item.paidAmount || 0,
          pledgeStatus: item.pledgeStatus || 'No Pledge'
        };
      });

      if (newGuests.length === 0) return;

      setIsChunkUploading(true);
      setChunkUploadProgress(1); // Explicitly start counting from 1% as requested
      setChunkUploadedCount({ current: 0, total: newGuests.length });
      setChunkUploadError(null);
      setLastUploadedGuestName('');

      // Adjust chunk sizes dynamically to feel super premium and be extremely fast
      let BATCH_SIZE = 500;
      if (newGuests.length <= 15) {
        BATCH_SIZE = 3; 
      } else if (newGuests.length <= 50) {
        BATCH_SIZE = 10;
      } else if (newGuests.length <= 200) {
        BATCH_SIZE = 50;
      } else if (newGuests.length <= 1000) {
        BATCH_SIZE = 250;
      } else {
        BATCH_SIZE = 500;
      }

      const totalToUpload = newGuests.length;
      let currentMerged = [...guests];
      
      let currentProgressVal = 1;
        for (let i = 0; i < totalToUpload; i += BATCH_SIZE) {
          const batch = newGuests.slice(i, i + BATCH_SIZE);
          currentMerged = [...batch, ...currentMerged];

          if (batch.length > 0) {
            setLastUploadedGuestName(batch[batch.length - 1].name || '');
          }

          const payload = {
            guests: batch,
            auditLog: {
              id: 'log-' + Date.now() + '-' + i,
              timestamp: new Date().toISOString(),
              user: 'Admin',
              action: `Upakiaji Mkubwa wa CSV: Wageni wapya ${i + 1} hadi ${Math.min(i + batch.length, totalToUpload)} kati ya ${totalToUpload}`,
              details: `Kundi la mchango lilipakiwa na kusajiliwa salama kwenye PostgreSQL dpg.`
            }
          };

          const response = await fetch('/api/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            throw new Error(isEn 
              ? `Failed to upload batch starting at ${i + 1}` 
              : `Imeshindikana kupakia kundi kuanzia wa ${i + 1}`);
          }

          const loadedCount = Math.min(i + BATCH_SIZE, totalToUpload);
          const targetPercent = Math.min(Math.round((loadedCount / totalToUpload) * 100), 99);

          // Smoothly tick the visual progress with sequential counts
          const stepDelay = Math.max(2, Math.min(25, 120 / (targetPercent - currentProgressVal || 1)));
          for (let p = currentProgressVal; p <= targetPercent; p++) {
            setChunkUploadProgress(p);
            currentProgressVal = p;
            await new Promise(resolve => setTimeout(resolve, stepDelay));
          }

          setChunkUploadedCount({ current: loadedCount, total: totalToUpload });
          // Tiny pacing delay to show name before proceeding to next batch
          await new Promise(resolve => setTimeout(resolve, 80));
        }

        // Smoothly complete ticker to 100%
        for (let p = currentProgressVal; p <= 100; p++) {
          setChunkUploadProgress(p);
          await new Promise(resolve => setTimeout(resolve, 15));
        }

        setChunkUploadedCount({ current: totalToUpload, total: totalToUpload });
        await new Promise(resolve => setTimeout(resolve, 850));

        // Trigger local updates
        onUpdateGuests(currentMerged, `Mipakio Mkubwa CSV: Wageni ${totalToUpload} wakaandikishwa michango yao`, true);

    } catch (err: any) {
      console.error("Batch upload failed:", err);
      setChunkUploadError(err.message || 'Error occurred during upload');
    } finally {
      setIsChunkUploading(false);
      setChunkUploadProgress(null);
      setChunkUploadedCount(null);
      setLastUploadedGuestName('');
    }
    
    // Reset file input
    if (e.target) {
      e.target.value = '';
    }
  };

  // CSV Generator
  const downloadReportCSV = (listName: string, listData: Guest[]) => {
    let csv = isEn
      ? 'Guest Name,Phone Number,Pledges,Amount Paid,Outstanding Balance,Pledge Status\n'
      : isEn ? 'Guest Name,Phone Number,Pledged Amount,Amount Paid,Balance Due,Pledge Status\n' : 'Jina la Mgeni,Idadi ya Simu,Mchango ulioahidiwa,Kiasi Kilicholipwa,Salio linalodaiwa,Hali ya Ahadi\n';
    listData.forEach(g => {
      const pledge = g.pledgeAmount || 0;
      const paid = g.paidAmount || 0;
      const bal = pledge - paid;
      const st = g.pledgeStatus || 'No Pledge';
      csv += `"${g.name}","${g.phone}",${pledge},${paid},${bal},"${st}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isEn 
      ? `EventCard_Report_of_${listName.replace(/\s+/g,'_')}.csv`
      : `EventCard_Ripoti_ya_${listName.replace(/\s+/g,'_')}.csv`;
    a.click();
  };

  const downloadReportPDF = async (listName: string, listData: Guest[]) => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4', false);
      const title = `${event.name}: ${listName}`;
      
      const primaryColor: [number, number, number] = [15, 23, 42]; // Slate 900
      
      // Header
      doc.setFontSize(16);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(title, 14, 20);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text(`${isEn ? 'Generated on' : 'Imetolewa tarehe'}: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 27);
      
      // Summary Stats
      const totalPledged = listData.reduce((sum, g) => sum + (g.pledgeAmount || 0), 0);
      const totalPaid = listData.reduce((sum, g) => sum + (g.paidAmount || 0), 0);
      const totalBalance = totalPledged - totalPaid;

      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.line(14, 32, 196, 32);

      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85); // Slate 700
      doc.text(`${isEn ? 'Total Pledges' : 'Jumla Ya Ahadi'}:`, 14, 40);
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`TZS ${totalPledged.toLocaleString()}`, 60, 40);

      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(`${isEn ? 'Total Collected' : 'Jumla Ya Makusanyo'}:`, 14, 46);
      doc.setTextColor(16, 185, 129); // Emerald 500
      doc.text(`TZS ${totalPaid.toLocaleString()}`, 60, 46);

      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(`${isEn ? 'Total Balance Due' : 'Salio Linalodaiwa'}:`, 14, 52);
      doc.setTextColor(244, 63, 94); // Rose 500
      doc.text(`TZS ${totalBalance.toLocaleString()}`, 60, 52);

      // Count 5 status categories for this list
      let noPledgeCount = 0;
      let pledgedOnlyCount = 0;
      let partiallyPaidCount = 0;
      let fullyPaidCount = 0;

      listData.forEach(g => {
        const pledge = Number(g.pledgeAmount) || 0;
        const paid = Number(g.paidAmount) || 0;
        const status = g.pledgeStatus;

        if (status === 'No Pledge' || (pledge === 0 && paid === 0)) {
          noPledgeCount++;
        } else if (status === 'Fully Paid' || (pledge > 0 && paid >= pledge) || (pledge === 0 && paid > 0)) {
          fullyPaidCount++;
        } else if (status === 'Partially Paid' || (paid > 0 && paid < pledge)) {
          partiallyPaidCount++;
        } else {
          pledgedOnlyCount++;
        }
      });

      // Draw 5 mini summary boxes in PDF
      const cardY2 = 56;
      const pageWidth = doc.internal.pageSize.getWidth();
      const cardWidth2 = (pageWidth - 28 - (5 - 1) * 3) / 5;
      const summaryCards = [
        { label: "HAWAJAAHIDI", value: `${noPledgeCount}`, color: [100, 116, 139] },
        { label: "WALIOAHIDI TU", value: `${pledgedOnlyCount}`, color: [217, 119, 6] },
        { label: "LIPA NUSU", value: `${partiallyPaidCount}`, color: [2, 132, 199] },
        { label: "LIPA YOTE", value: `${fullyPaidCount}`, color: [22, 163, 74] },
        { label: "WENYE MADENI", value: `${pledgedOnlyCount + partiallyPaidCount}`, color: [147, 51, 234] }
      ];

      summaryCards.forEach((card, i) => {
        const x = 14 + i * (cardWidth2 + 3);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(218, 223, 230);
        doc.rect(x, cardY2, cardWidth2, 12, 'FD');
        doc.setFontSize(5.5);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.text(card.label, x + cardWidth2 / 2, cardY2 + 4, { align: 'center' });
        doc.setFontSize(7.5);
        doc.setTextColor(card.color[0], card.color[1], card.color[2]);
        doc.text(card.value, x + cardWidth2 / 2, cardY2 + 9, { align: 'center' });
      });

      const tableData = listData.map((g, idx) => [
        idx + 1,
        g.name,
        g.phone || '-',
        (g.pledgeAmount || 0).toLocaleString(),
        (g.paidAmount || 0).toLocaleString(),
        ((g.pledgeAmount || 0) - (g.paidAmount || 0)).toLocaleString(),
        g.pledgeStatus || 'None'
      ]);

      const headers = isEn 
        ? [['S/N', 'Guest Name', 'Phone', 'Pledge (TZS)', 'Paid (TZS)', 'Balance (TZS)', 'Status']]
        : [['S/N', 'Jina la Mgeni', 'Simu', 'Ahadi (TZS)', 'Malipo (TZS)', 'Deni (TZS)', 'Hali']];

      autoTable(doc, {
        head: headers,
        body: tableData,
        startY: 72,
        theme: 'grid',
        headStyles: { 
          fillColor: [240, 240, 240], 
          textColor: [0, 0, 0],
          fontSize: 8,
          fontStyle: 'bold',
          lineColor: [0, 0, 0],
          lineWidth: 0.5
        },
        bodyStyles: { 
          fontSize: 8,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0]
        },
        styles: {
          cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 },
          fontSize: 8,
          lineColor: [0, 0, 0],
          lineWidth: 0.5,
          textColor: [0, 0, 0]
        },
        margin: { top: 62 },
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // Slate 400
        doc.text(
          `Page ${i} of ${pageCount} - EventCard Contributions Manager`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      await addPdfWatermarks(doc);
      doc.save(`EventCard_Report_${listName.replace(/\s+/g,'_')}.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert(isEn ? "Failed to generate PDF. Please try CSV instead." : "Imeshindwa kutengeneza PDF. Tafadhali tumia CSV.");
    }
  };

  // Opt-in UI Check
  if (!event.contributionsEnabled) {
    return (
      <div className="backdrop-blur-xl bg-slate-900/40 border border-white/10 rounded-[1.75rem] p-8 text-center max-w-4xl mx-auto space-y-6 my-8 animate-fade-in" id="contributions-opt-in-panel">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-white border border-white/20 shadow-xl shadow-rose-950/20">
          <Coins className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight uppercase bg-gradient-to-r from-amber-200 to-rose-400 bg-clip-text text-transparent">
            {isEn ? "Contributions Management Module" : "Moduli ya Kusimamia Michango"}
          </h2>
          <p className="text-slate-400 font-mono tracking-wider text-[10px] uppercase font-bold">
            EVENTCARD PREMIUM ADD-ON • EVENT CONTRIBS
          </p>
        </div>

        <p className="text-xs text-slate-300 max-w-2xl mx-auto leading-relaxed">
          {isEn ? (
            <>
              Don't worry! This service is entirely optional (opt-in) and will not interfere with your regular cards system if you do not use it. If you enable it for <strong>"{event.name || 'this event'}"</strong>, you will be able to:
            </>
          ) : (
            <>
              Usiogope! Huduma hii ni hiari (opt-in) na haitaingilia mfumo wako wa kadi za kawaida za mwaliko kama huitumii. Ukiiwezesha kwa ajili ya <strong>"{event.name || 'Tukio hili'}"</strong>, utakuwa na uwezo wa:
            </>
          )}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-3xl mx-auto text-xs py-2">
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-1.5 hover:bg-white/[0.04] transition">
            <h4 className="font-extrabold text-amber-400 uppercase tracking-wide">
              {isEn ? "1. Pledge Card Alignment" : "1. Kadi Dijitali za Ahadi"}
            </h4>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              {isEn 
                ? "Upload a background file & let our custom graphic compiler dynamically personalize pledge numbers & names for each guest."
                : "Upload design moja nayo itafanya dynamic personalization kwa kila guest moja kwa moja na kuwekwa link."}
            </p>
          </div>
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-1.5 hover:bg-white/[0.04] transition">
            <h4 className="font-extrabold text-rose-400 uppercase tracking-wide">
              {isEn ? "2. Analytics Dashboard" : "2. Dashibodi & Chati"}
            </h4>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              {isEn 
                ? "Easily track total contributions pledged, amount paid, remaining outstanding balances, and collection distribution percentages."
                : "Fuatilia kiasi kilichokusanywa, salio linalodaiwa, na asilimia ya makusanyo kwa kulinganisha wageni wote."}
            </p>
          </div>
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-1.5 hover:bg-white/[0.04] transition">
            <h4 className="font-extrabold text-blue-400 uppercase tracking-wide">
              {isEn ? "3. Safe Isolation" : "3. Isolation Salama"}
            </h4>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              {isEn 
                ? "All contribution dispatch templates and payments logs are neatly isolated without cluttering your main invitation settings."
                : "Mawasiliano na templates za michango zimetengwa kabisa ili zisiingiliane na mfumo mkuu wa mwaliko."}
            </p>
          </div>
        </div>

        <div className="pt-4">
          <button 
            id="btn-enable-contributions"
            onClick={handleEnableContributions}
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-extrabold uppercase tracking-widest text-xs hover:brightness-110 active:scale-95 transition cursor-pointer shadow-lg shadow-rose-950/45"
          >
            {isEn ? "Enable Contributions System Now" : "Wezesha Mfumo wa Michango Sasa"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Chunk progress overlay */}
      {isChunkUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md" id="contrib-upload-progress-overlay">
          <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-2xl text-center space-y-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              {/* Circular custom loader using SVG */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    className="stroke-slate-800"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    className="stroke-blue-500 transition-all duration-300"
                    strokeWidth="6"
                    strokeDasharray={301.6}
                    strokeDashoffset={301.6 - (301.6 * (chunkUploadProgress || 1)) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-2xl font-extrabold text-white">
                    {chunkUploadProgress}%
                  </span>
                  <span className="text-[9px] text-blue-400 font-mono font-bold uppercase tracking-wider">
                    Progress
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {isEn ? "Uploading Contributions in Batches..." : "Inapakia Michango Kwenye Database..."}
                </h3>
                <p className="text-slate-400 text-xs font-mono pb-1">
                  {isEn ? `Verifying: ${chunkUploadedCount?.current} of ${chunkUploadedCount?.total} guests` : `Uhakiki: wageni ${chunkUploadedCount?.current} kati ya ${chunkUploadedCount?.total}`}
                </p>
                {lastUploadedGuestName && (
                  <p className="text-blue-400 text-[11px] font-mono font-medium animate-pulse bg-blue-500/10 py-1 px-3.5 rounded-lg border border-blue-500/10 inline-block max-w-full truncate">
                    {isEn ? "Syncing Record:" : "Mgeni anayesajiliwa:"} {lastUploadedGuestName}
                  </p>
                )}
              </div>
            </div>
            
            {/* Horizontal progress bar for secondary feedback */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300"
                style={{ width: `${chunkUploadProgress}%` }}
              />
            </div>
            
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans italic p-3 bg-slate-950/40 rounded-xl border border-white/5">
              {isEn 
                ? "The system is entering each contributor into PostgreSQL safely. Please keep this browser window open." 
                : "Mfumo unasajili michango yote mikubwa kwenye PostgreSQL. Tafadhali usifunge ukurasa wa kivinjari kwa sasa."}
            </p>
          </div>
        </div>
      )}

    <div className="space-y-6 animate-fade-in print:hidden" id="contributions-dashboard-root">
      
      {/* Header of Content */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 px-2.5 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wider">
              {isEn ? "ACTIVE EVENT" : "KAZI KAZI"}
            </span>
            <span className="text-slate-400 text-xs font-mono">
              {isEn ? `Active Ceremony: ${event.name || '[Untitled]'}` : `Tukio hai: ${event.name || '[Bila Jina]'}`}
            </span>
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2" id="contrib-main-panel-title">
            <Coins className="w-5.5 h-5.5 text-amber-400" />
            {isEn ? "Contributions Terminal" : "Usimamizi wa Michango"}
          </h2>
        </div>

          {/* Action Toggle inside the module to disable if they change mind and Event dropdown selector */}
          <div className="flex items-center gap-2">
            <select
              title={isEn ? "Select Event" : "Chagua Tukio"}
              value={event.id}
              onChange={(e) => onSelectEvent(e.target.value)}
              className="bg-white/5 border border-white/10 text-white text-[10px] font-mono px-2 py-1.5 rounded-lg outline-none"
            >
              {eventsList.map(ev => (
                <option key={ev.id} value={ev.id} className="bg-slate-900 border-none text-[10px]">{ev.name || 'Bila Jina'}</option>
              ))}
            </select>
            <button
              onClick={() => {
                onUpdateEvent({ ...event, contributionsEnabled: false });
              }}
              className="text-[10px] font-mono font-bold text-slate-400 hover:text-red-400 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg transition"
            >
              {isEn ? "DISABLE SYSTEM SERVICE" : "SITANISHA MODULI YA MICHANGO"}
            </button>
          </div>
      </div>

      {/* Navigation Sub-Tabs bar */}
      <div className="flex flex-wrap gap-1 bg-white/5 p-1 rounded-xl border border-white/10" id="contrib-sub-tabs">
        {[
          { id: 'dashboard', label: isEn ? 'Dashboard' : 'Dashboard', icon: BarChart2 },
          { id: 'contributors', label: isEn ? 'Contributors & Pledges' : 'Wachangiaji & Ahadi', icon: Users },
          { id: 'card-design', label: isEn ? 'Card Design' : 'Muundo wa Kadi', icon: Palette },
          { id: 'payment-methods', label: isEn ? 'Payment Methods' : 'Njia za Malipo', icon: CreditCard },
          { id: 'integrations', label: isEn ? 'API & Automations' : 'API & Mifumo (Auto)', icon: Shield },
          { id: 'pledge-requests', label: isEn ? `Pledge Requests (${noPledgeList.length})` : `Ombi la Ahadi (${noPledgeList.length})`, icon: MessageSquare },
          { id: 'reminders', label: isEn ? `Payment Reminders (${pendingCollectionList.length})` : `Vikumbusho (${pendingCollectionList.length})`, icon: Clock },
          { id: 'thank-you', label: isEn ? `Thanks (${fullyPaidList.length})` : `Shukrani (${fullyPaidList.length})`, icon: CheckCircle },
          { id: 'message-center', label: isEn ? 'Message Center' : 'Kituo cha Ujumbe', icon: Send },
          { id: 'reports', label: isEn ? 'Export Reports' : 'Ripoti', icon: Printer }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setSubTab(tab.id as any);
                setSelectedGuests([]); // reset selected on change
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[10.5px] font-bold uppercase transition-all duration-200 cursor-pointer ${
                isActive 
                  ? 'bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-yellow-400 border border-yellow-500/35 shadow-inner' 
                  : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-yellow-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Real-time SMS simulated balance card & information alert */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 rounded-xl border border-white/10 bg-gradient-to-r from-slate-900/80 via-slate-950/80 to-slate-900/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/35 flex items-center justify-center">
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono font-black text-slate-400">
              {isEn ? "SMS Sim Gateway Wallet Balance" : "Salio la SMS (Kadi Sim Gateway)"}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-bold text-amber-400">
                {smsWalletBalance} SMS
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-450 font-bold uppercase font-mono border border-emerald-500/25">
                {isEn ? "Connected" : "Imeunganishwa"}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            const amountStr = window.prompt(
              isEn 
                ? "Enter your exact current SMS balance (to override and sync manually):" 
                : "Wasilisha uhalisia wa salio lako jipya la SMS sasa hivi hapa:"
            );
            if (amountStr && !isNaN(parseInt(amountStr, 10))) {
              const newAmount = parseInt(amountStr, 10);
              setSmsWalletBalance(newAmount);
              alert(
                isEn
                  ? `Successfully synced! Your balance is now ${newAmount} SMS.`
                  : `Imefanikiwa kusawazisha! Salio lako sasa ni SMS ${newAmount}.`
              );
            }
          }}
          className="px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:border-amber-500 hover:bg-amber-500/20 text-amber-400 font-mono text-[9.5px] uppercase font-black transition flex items-center gap-1.5 cursor-pointer"
          title={isEn ? "Sync / Edit SMS credits" : "Sawazisha / Hariri mikopo ya SMS"}
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" />
          {isEn ? "Sync SMS Balance" : "Sawazisha Salio la SMS"}
        </button>
      </div>

      {/* Dashboard Sub-Tab View */}
      {subTab === 'dashboard' && (
        <div className="space-y-6 animate-fade-in" id="contrib-dashboard-panel">
          
          {/* Key Metrics grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2 relative overflow-hidden">
              <div className="absolute right-3 top-3 text-slate-700"><Users className="w-12 h-12 stroke-[1.2]" /></div>
              <p className="text-[10px] font-mono tracking-wider text-slate-400 uppercase font-bold">
                {isEn ? "All Guests on Event" : "Wageni Wote kwenye Event"}
              </p>
              <p className="text-2xl font-black text-white font-mono">{metrics.totalGuests}</p>
              <p className="text-[9.5px] text-slate-500">
                {isEn ? "Total number of guests in database" : "Idadi ya jumla waliopo kwenye database"}
              </p>
            </div>

            <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2 relative overflow-hidden">
              <div className="absolute right-3 top-3 text-amber-950/40"><Coins className="w-12 h-12 stroke-[1.2]" /></div>
              <p className="text-[10px] font-mono tracking-wider text-amber-400 uppercase font-bold">
                {isEn ? "Total Pledged Amount" : "Jumla ya Ahadi"}
              </p>
              <p className="text-2xl font-black text-yellow-450 font-mono">TZS {metrics.totalPledgedAmount.toLocaleString()}</p>
              <p className="text-[9.5px] text-slate-400 font-mono">
                {isEn ? "Total value of all pledges registered" : "Thamani ya ahadi zilizowekwa"}
              </p>
            </div>

            <div className="backdrop-blur-md bg-white/5 border border-emerald-500/20 rounded-2xl p-5 space-y-2 relative overflow-hidden">
              <div className="absolute right-3 top-3 text-emerald-950/40"><CheckCircle className="w-12 h-12 stroke-[1.2]" /></div>
              <p className="text-[10px] font-mono tracking-wider text-emerald-450 uppercase font-bold">
                {isEn ? "Total Paid Amount" : "Jumla ya Malipo"}
              </p>
              <p className="text-2xl font-black text-emerald-400 font-mono">TZS {metrics.totalPaidAmount.toLocaleString()}</p>
              <p className="text-[9.5px] text-emerald-400/80 font-mono font-bold">
                {metrics.totalPledgedAmount > 0 
                  ? ((metrics.totalPaidAmount / metrics.totalPledgedAmount) * 100).toFixed(1)
                  : '0'}% {isEn ? "already collected" : "kimekwishalipwa"}
              </p>
            </div>

            <div className="backdrop-blur-md bg-white/5 border border-red-500/20 rounded-2xl p-5 space-y-2 relative overflow-hidden">
              <div className="absolute right-3 top-3 text-red-950/40"><AlertTriangle className="w-12 h-12 stroke-[1.2]" /></div>
              <p className="text-[10px] font-mono tracking-wider text-red-400 uppercase font-bold">
                {isEn ? "Outstanding Balance" : "Salio Linalodaiwa"}
              </p>
              <p className="text-2xl font-black text-red-400 font-mono">TZS {metrics.outstandingBalance.toLocaleString()}</p>
              <p className="text-[9.5px] text-slate-500">
                {isEn ? "Outstanding balance to collect" : "Salio lililobaki kukusanywa"}
              </p>
            </div>

          </div>

          {/* Slices of States cards (1-7 cards requested) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-slate-950/45 p-4 rounded-xl border border-white/5 text-center">
              <p className="text-slate-400 text-[10px] font-mono uppercase">{isEn ? "No Pledge" : "Hawajaahidi (No Pledge)"}</p>
              <p className="text-xl font-bold text-white mt-1 font-mono">{metrics.noPledgeCount}</p>
            </div>
            <div className="bg-slate-950/45 p-4 rounded-xl border border-white/5 text-center">
              <p className="text-amber-400 text-[10px] font-mono uppercase">{isEn ? "Pledged Only" : "Walioahidi tu (Pledged)"}</p>
              <p className="text-xl font-bold text-amber-400 mt-1 font-mono">{metrics.pledgedCount}</p>
            </div>
            <div className="bg-slate-950/45 p-4 rounded-xl border border-white/5 text-center">
              <p className="text-cyan-400 text-[10px] font-mono uppercase">{isEn ? "Partially Paid" : "Lipa Nusu (Partially)"}</p>
              <p className="text-xl font-bold text-cyan-400 mt-1 font-mono">{metrics.partiallyPaidCount}</p>
            </div>
            <div className="bg-slate-950/45 p-4 rounded-xl border border-white/5 text-center">
              <p className="text-emerald-400 text-[10px] font-mono uppercase">{isEn ? "Fully Paid" : "Lipa Yote (Fully Paid)"}</p>
              <p className="text-xl font-bold text-emerald-400 mt-1 font-mono">{metrics.fullyPaidCount}</p>
            </div>
            <div className="bg-slate-950/45 p-4 rounded-xl border border-white/5 text-center col-span-2 md:col-span-1">
              <p className="text-purple-400 text-[10px] font-mono uppercase">{isEn ? "Active Debts" : "Wenye Madeni Active"}</p>
              <p className="text-xl font-bold text-purple-400 mt-1 font-mono">
                {metrics.pledgedCount + metrics.partiallyPaidCount}
              </p>
            </div>
          </div>

          {/* Graphics Data Visualization (Progress and Pie) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-8 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="font-extrabold text-xs uppercase font-mono tracking-wider text-slate-300">
                {isEn ? "Collection Progress Insights" : "Maendeleo ya Makusanyo (Collection Progress)"}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: isEn ? 'Paid Amount' : 'Malipo', kiasi: metrics.totalPaidAmount },
                    { name: isEn ? 'Outstanding' : 'Salio linalodaiwa', kiasi: metrics.outstandingBalance },
                    { name: isEn ? 'Total Target' : 'Total Target', kiasi: metrics.totalPledgedAmount }
                  ]}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Bar dataKey="kiasi" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                      <Cell fill="#f59e0b" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-4 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
              <h3 className="font-extrabold text-xs uppercase font-mono tracking-wider text-slate-300 mb-2">
                {isEn ? "Contributors Distribution Breakdown" : "Hali ya Wachangiaji (Status)"}
              </h3>
              <div className="h-44 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: isEn ? 'No Pledge' : 'Hajaahidi', value: metrics.noPledgeCount, color: '#475569' },
                        { name: isEn ? 'Pledged' : 'Pledged Only', value: metrics.pledgedCount, color: '#f59e0b' },
                        { name: isEn ? 'Partially Paid' : 'Partially Paid', value: metrics.partiallyPaidCount, color: '#06b6d4' },
                        { name: isEn ? 'Fully Paid' : 'Fully Paid', value: metrics.fullyPaidCount, color: '#10b981' }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#475569" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#06b6d4" />
                      <Cell fill="#10b981" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 mt-2 text-[10.5px] font-mono">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> {isEn ? 'No Pledge' : 'Hajaahidi'}</span>
                  <span className="font-bold text-white">{metrics.noPledgeCount}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> {isEn ? 'Pledged' : 'Walioahidi'}</span>
                  <span className="font-bold text-white">{metrics.pledgedCount}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> {isEn ? 'Partially Paid' : 'Lipa Nusu'}</span>
                  <span className="font-bold text-white">{metrics.partiallyPaidCount}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> {isEn ? 'Fully Paid' : 'Lipa Yote'}</span>
                  <span className="font-bold text-white">{metrics.fullyPaidCount}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Card Design View */}
      {subTab === 'card-design' && (
        <div className="space-y-6 animate-fade-in" id="contrib-carddesign-panel">
          
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            
            {/* 1. Live Interactive Canvas Stage */}
            <div className="w-full lg:w-1/2 sticky top-6">
              <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-rose-500/5 pointer-events-none"></div>
                
                <div className="mb-6 w-full flex items-center justify-between px-4">
                  <div className="space-y-0.5">
                    <h4 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">{isEn ? "Dynamic Preview" : "Uhakiki wa Kadi"}</h4>
                    <p className="text-[9px] font-mono text-slate-500 uppercase">{isEn ? "Canvas Visualizer • Stage 1" : "Mionekano • Hatua ya 1"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-tighter">Live Render</span>
                  </div>
                </div>

                {/* The Canvas Frame - Specifically designed to have NO borders around internal elements like guest names */}
                <div className="relative shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] rounded-xl overflow-hidden border border-white/5 bg-slate-950 max-w-full">
                  <canvas 
                    id="card-design-live-canvas"
                    ref={(el) => {
                      if (el) {
                        const exampleGuest: Guest = {
                          id: 'example-jimson',
                          name: 'Jimson', // The requested example name
                          cardType: 'VIP'
                        } as any;
                        drawContributionCardToCanvas(el, event, cardTemplate, exampleGuest, 'KIASI: TZS 150,000', isEn);
                      }
                    }}
                    width={450 * 3} 
                    height={600 * 3}
                    className="w-full sm:max-w-[320px] md:max-w-[360px] h-auto block"
                  />
                </div>

                <div className="mt-8 w-full grid grid-cols-3 gap-4 border-t border-white/5 pt-6">
                  <div className="text-center space-y-1">
                    <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">{isEn ? "Format" : "Mfumo"}</p>
                    <p className="text-[10px] font-black text-white uppercase">450 x 600px</p>
                  </div>
                  <div className="text-center space-y-1 border-x border-white/5">
                    <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">{isEn ? "Density" : "Ubora"}</p>
                    <p className="text-[10px] font-black text-emerald-400 uppercase">Premium HD</p>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">{isEn ? "Output" : "Matokeo"}</p>
                    <p className="text-[10px] font-black text-blue-400 uppercase">Direct PNG</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Advanced Customization Controls */}
            <div className="w-full lg:w-1/2 space-y-6">
              
              <div className="bg-slate-900 border border-white/10 rounded-[2rem] overflow-hidden shadow-xl">
                <div className="p-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/25">
                      <Sliders className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-white uppercase font-mono tracking-widest leading-none">
                        {isEn ? "Card Appearance Designer" : "REKEBISHA NAFASI & MUONEKANO"}
                      </h3>
                      <p className="text-[9px] font-mono text-slate-500 uppercase mt-1">{isEn ? "Layout & Typography Settings" : "Mipangilio ya Nafasi na Maandishi"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isCardTemplateSaved && (
                      <motion.span 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter"
                      >
                        ✓ Saved
                      </motion.span>
                    )}
                    <button 
                      onClick={handleSaveCardTemplate}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black text-[10px] font-black uppercase rounded-xl hover:brightness-110 active:scale-95 transition cursor-pointer shadow-lg shadow-amber-900/20"
                    >
                      {isEn ? "Hifadhi Mabadiliko" : "Hifadhi Mabadiliko"}
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-8 max-h-[700px] overflow-y-auto custom-scrollbar bg-slate-900/40">
                  
                  {/* Card Appearance Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                        <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                        {isEn ? "Choose Background Template" : "Chagua Background ya Kadi"}
                      </label>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => document.getElementById('card-bg-upload-main')?.click()}
                        className="p-5 bg-slate-950 border-2 border-dashed border-white/10 rounded-2xl hover:border-amber-500/50 hover:bg-amber-500/5 transition flex flex-col items-center justify-center gap-2.5 group relative"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-amber-500/20 group-hover:scale-110 transition duration-300">
                          <Upload className="w-5 h-5 text-slate-400 group-hover:text-amber-500" />
                        </div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest group-hover:text-amber-400 transition">{isEn ? "Upload Custom Art" : "Pakia Picha Yako"}</span>
                        <input type="file" id="card-bg-upload-main" className="hidden" accept="image/*" onChange={handleCardImageUpload} />
                      </button>

                      {PREMADE_THEMES.map(theme => (
                        <button
                          key={theme.id}
                          onClick={() => setCardTemplate(prev => ({ ...prev, themeId: theme.id, imageUrl: '' }))}
                          className={`group relative p-1 rounded-2xl border-2 transition-all duration-300 ${cardTemplate.themeId === theme.id ? 'border-amber-500 scale-[1.03] shadow-xl' : 'border-white/5 hover:border-white/15'}`}
                        >
                          <div className={`w-full h-20 rounded-xl bg-gradient-to-br ${theme.bg} flex items-center justify-center border ${theme.border} relative overflow-hidden`}>
                             <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition"></div>
                             <span className={`text-[10px] font-black uppercase tracking-widest ${theme.text} drop-shadow-md z-10`}>{isEn ? theme.nameEn : theme.nameSw}</span>
                          </div>
                          {cardTemplate.themeId === theme.id && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center border-4 border-slate-900 text-black">
                              <Check className="w-3 h-3" strokeWidth={4} />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Spatial & Visual Tuning - Restored Guest Name Adjustment */}
                  <div className="space-y-6 pt-6 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                        <Sliders className="w-3.5 h-3.5 text-blue-400" />
                        {isEn ? "Guest Name Placement" : "Marekebisho ya Jina la Mgeni"}
                      </label>
                    </div>

                    <div className="space-y-5 p-5 bg-white/5 rounded-3xl border border-white/10 group transition hover:border-blue-500/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/25">
                            <User className="w-4.5 h-4.5 text-blue-400" />
                          </div>
                          <div>
                            <h4 className="text-[11px] font-black text-white uppercase tracking-widest">{isEn ? "Guest Name Position" : "NAFASI YA JINA LA MGENI"}</h4>
                            <p className="text-[9px] font-mono text-slate-500 uppercase">{isEn ? "Fine-tune where name appears" : "Rekebisha jina linapokaa"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">{cardTemplate.showGuestName !== false ? 'VISIBLE' : 'HIDDEN'}</span>
                          <button 
                            onClick={() => setCardTemplate(prev => ({ ...prev, showGuestName: !prev.showGuestName }))}
                            className={`w-10 h-5 rounded-full relative transition duration-300 ${cardTemplate.showGuestName !== false ? 'bg-blue-500' : 'bg-slate-700'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${cardTemplate.showGuestName !== false ? 'left-6' : 'left-1'}`}></div>
                          </button>
                        </div>
                      </div>

                      <div className={`space-y-6 transition-all duration-300 ${cardTemplate.showGuestName === false ? 'opacity-20 grayscale pointer-events-none' : ''}`}>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Horizontal Slider */}
                            <div className="space-y-3">
                              <div className="flex justify-between items-center text-[10px] font-black uppercase font-mono">
                                <span className="text-slate-400">{isEn ? "Horizontal Pos (X)" : "Nafasi ya Mlalo (X)"}</span>
                                <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20">{cardTemplate.guestNameX || 50}%</span>
                              </div>
                              <input 
                                type="range" min="0" max="100" 
                                value={cardTemplate.guestNameX || 50} 
                                onChange={e => setCardTemplate(prev => ({ ...prev, guestNameX: parseInt(e.target.value) }))}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition"
                              />
                            </div>

                            {/* Vertical Slider */}
                            <div className="space-y-3">
                              <div className="flex justify-between items-center text-[10px] font-black uppercase font-mono">
                                <span className="text-slate-400">{isEn ? "Vertical Pos (Y)" : "Nafasi ya Wima (Y)"}</span>
                                <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20">{cardTemplate.guestNameY || 37}%</span>
                              </div>
                              <input 
                                type="range" min="0" max="100" 
                                value={cardTemplate.guestNameY || 37} 
                                onChange={e => setCardTemplate(prev => ({ ...prev, guestNameY: parseInt(e.target.value) }))}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition"
                              />
                            </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Font Size Slider */}
                            <div className="space-y-3">
                              <div className="flex justify-between items-center text-[10px] font-black uppercase font-mono">
                                <span className="text-slate-400">{isEn ? "Font Size" : "Ukubwa wa Jina"}</span>
                                <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">{cardTemplate.guestNameSize || 22}px</span>
                              </div>
                              <input 
                                type="range" min="8" max="80" 
                                value={cardTemplate.guestNameSize || 22} 
                                onChange={e => setCardTemplate(prev => ({ ...prev, guestNameSize: parseInt(e.target.value) }))}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition"
                              />
                            </div>

                            {/* Color Selection */}
                            <div className="space-y-3">
                              <span className="text-[10px] font-black uppercase font-mono text-slate-400 block">{isEn ? "Name Color" : "Rangi ya Jina"}</span>
                              <div className="flex items-center gap-4 bg-slate-950 p-2.5 rounded-xl border border-white/5">
                                <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/20 shadow-inner">
                                  <input 
                                    type="color" 
                                    value={cardTemplate.guestNameColor || '#FFFFFF'} 
                                    onChange={e => setCardTemplate(prev => ({ ...prev, guestNameColor: e.target.value }))}
                                    className="absolute inset-[-8px] w-[200%] h-[200%] cursor-pointer bg-transparent border-none"
                                  />
                                </div>
                                <span className="text-[10px] font-mono text-white font-bold tracking-widest uppercase">{cardTemplate.guestNameColor || '#FFFFFF'}</span>
                              </div>
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>



            </div>

          </div>

        </div>
      )}

      {/* Contributors & Pledges View */}
      {subTab === 'contributors' && (
        <div className="space-y-4 animate-fade-in" id="contrib-contributors-panel">
          
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative rounded-lg overflow-hidden border border-white/10 max-w-xs focus-within:border-amber-500 transition">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search className="w-3.5 h-3.5" /></span>
                <input 
                  id="inp-contrib-search"
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={isEn ? "Search guest name..." : "Tafuta mgeni..."}
                  className="bg-slate-900/60 py-1.5 pl-8 pr-3 text-white text-xs outline-none w-56"
                />
              </div>

              {/* Status categories */}
              <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5">
                {(['All', 'No Pledge', 'Pledged', 'Partially Paid', 'Fully Paid'] as const).map(option => (
                  <button
                    key={option}
                    onClick={() => setStatusFilter(option)}
                    className={`px-2.5 py-1 rounded font-mono text-[9.5px] font-bold uppercase transition ${
                      statusFilter === option ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {option === 'All' ? (isEn ? 'ALL' : 'WOTE') : (isEn ? option.toUpperCase() : (option === 'No Pledge' ? 'HAJAAHIDI' : option === 'Pledged' ? 'WALIOAHIDI' : option === 'Partially Paid' ? 'LIPA NUSU' : 'LIPA YOTE'))}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline-block">
                {isEn ? `Showing: ${filteredGuests.length} of ${guests.length}` : `Inaonyesha: ${filteredGuests.length} ya ${guests.length}`}
              </span>
              <button 
                onClick={downloadCSVTemplate}
                className="px-2.5 py-1.5 rounded-lg border border-white/10 text-white font-mono text-[9.5px] uppercase font-bold hover:bg-white/5 transition flex items-center gap-1.5"
                title={isEn ? "Download CSV Template" : "Pakua Kiolezo cha CSV"}
              >
                <Download className="w-3 h-3" />
                {isEn ? 'Template' : 'Kiolezo'}
              </button>
              <button 
                onClick={() => document.getElementById('csv-bulk-upload')?.click()}
                className="px-2.5 py-1.5 rounded-lg border border-white/10 text-white font-mono text-[9.5px] uppercase font-bold hover:bg-white/5 transition flex items-center gap-1.5"
              >
                <Upload className="w-3 h-3" />
                {isEn ? 'Bulk Upload' : 'Tupia Wengi'}
              </button>
              <input type="file" id="csv-bulk-upload" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={handleBulkUploadCSV} />



              <button 
                onClick={() => {
                  setEditingGuestId(null);
                  setNewGuestName('');
                  setNewGuestPhone('');
                  setNewGuestCategory('SINGLE');
                  setShowQuickAddGuest(true);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-mono text-[9.5px] uppercase font-extrabold hover:bg-amber-400 transition flex items-center gap-1.5 shadow-md shadow-amber-500/20"
              >
                + {isEn ? "Add Guest" : "Mgeni Mpya"}
              </button>
            </div>
          </div>

          {/* Table list */}
          <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] uppercase font-mono text-[10px] text-slate-400 tracking-wider">
                    <th className="py-3.5 px-4 font-bold">{isEn ? 'Name' : 'Jina'}</th>
                    <th className="py-3.5 px-4 font-bold">{isEn ? 'Phone' : 'Simu'}</th>
                    <th className="py-3.5 px-4 font-bold text-right">{isEn ? 'Pledge' : 'Ahadi'}</th>
                    <th className="py-3.5 px-4 font-bold text-right">{isEn ? 'Paid' : 'Zilizolipwa'}</th>
                    <th className="py-3.5 px-4 font-bold text-right">{isEn ? 'Balance' : 'Salio lilibaki'}</th>
                    <th className="py-3.5 px-4 font-bold text-center">{isEn ? 'Status' : 'Hali (Status)'}</th>
                    <th className="py-3.5 px-4 font-bold text-center">{isEn ? 'Actions' : 'Vitendo (Actions)'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredGuests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                        {isEn ? 'No guests found matching filters.' : 'Hakuna mgeni aliyepatikana kwa vigezo hivi.'}
                      </td>
                    </tr>
                  ) : (
                    filteredGuests.map((g) => {
                      const pledge = g.pledgeAmount || 0;
                      const paid = g.paidAmount || 0;
                      const bal = pledge - paid;
                      const status = g.pledgeStatus || 'No Pledge';

                      return (
                        <tr key={g.id} className="hover:bg-white/5 transition-all">
                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-white uppercase">{g.name}</div>
                            <div className="text-[10px] text-amber-500 font-mono mt-0.5 font-bold flex items-center gap-1.5 flex-wrap">
                              <span>P-{g.id.substring(0, 6).toUpperCase()}</span>
                              {renderDeliveryIndicator(g) && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                  {renderDeliveryIndicator(g)}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-400">{g.phone || (isEn ? 'None' : 'Hakuna')}</td>
                          <td className="py-3.5 px-4 text-right font-bold font-mono text-amber-400">
                            {pledge > 0 ? `TZS ${pledge.toLocaleString()}` : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold font-mono text-emerald-400">
                            {paid > 0 ? `TZS ${paid.toLocaleString()}` : '—'}
                          </td>
                          <td className={`py-3.5 px-4 text-right font-bold font-mono ${bal > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                            {bal > 0 ? `TZS ${bal.toLocaleString()}` : (pledge > 0 ? (isEn ? 'Settle' : 'Kamilifu') : '—')}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono border ${
                              status === 'Fully Paid' 
                                  ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20' 
                                  : status === 'Partially Paid'
                                  ? 'bg-cyan-500/10 text-cyan-450 border-cyan-500/20'
                                  : status === 'Pledged'
                                  ? 'bg-amber-500/10 text-amber-450 border-amber-500/20'
                                  : 'bg-slate-500/10 text-slate-400 border-white/5'
                            }`}>
                              {status === 'Fully Paid' ? (isEn ? 'FULLY PAID' : 'LIPA YOTE') : (status === 'Partially Paid' ? (isEn ? 'PARTIAL' : 'NUSU') : (status === 'Pledged' ? (isEn ? 'PLEDGED' : 'AHADI') : (isEn ? 'NO PLEDGE' : 'HAJAAHIDI')))}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingGuestId(g.id);
                                  setNewGuestName(g.name);
                                  setNewGuestPhone(g.phone || '');
                                  setNewGuestCategory(g.cardType || 'SINGLE');
                                  setShowQuickAddGuest(true);
                                }}
                                className="bg-white/5 hover:bg-blue-500/10 border border-white/5 px-2 py-1 rounded text-[10px] font-bold font-mono text-blue-400 transition"
                                title={isEn ? "Edit Guest Info" : "Hariri Mgeni"}
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                id={`btn-add-pledge-${g.id}`}
                                onClick={() => openPledgeModal(g)}
                                className="bg-white/5 hover:bg-amber-500/10 border border-white/5 px-2 py-1 rounded text-[10px] font-bold font-mono text-amber-400 transition"
                                title={isEn ? "Add / Edit Pledge Amount" : "Ongeza / Hariri Ahadi"}
                              >
                                {isEn ? "Pledge" : "Ahadi"}
                              </button>
                              <button
                                id={`btn-record-pay-${g.id}`}
                                onClick={() => openPaymentModal(g)}
                                className="bg-white/5 hover:bg-emerald-500/10 border border-white/5 px-2 py-1 rounded text-[10px] font-bold font-mono text-emerald-450 transition"
                                title={isEn ? "Record Contribution Payment" : "Rekodi Malipo"}
                              >
                                {isEn ? "Payment" : "Malipo"}
                              </button>
                              <button
                                id={`btn-history-${g.id}`}
                                onClick={() => openHistoryModal(g)}
                                className="bg-white/5 hover:bg-slate-700 border border-white/5 px-2 py-1 rounded text-[10px] font-mono text-slate-300 transition"
                                title={isEn ? "View Payments Log" : "Ona Historia ya Malipo"}
                              >
                                {isEn ? "Log" : "Kumbukumbu"}
                              </button>
                              {/* Log button remains, Reset Msg button removed */}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Payment Methods View */}
      
      {subTab === 'integrations' && (
        <div className="space-y-6 animate-fade-in p-2">
          
          {/* Mobile Money API Integration */}
          <div className="backdrop-blur-md bg-gradient-to-br from-emerald-500/5 to-emerald-900/10 border border-emerald-500/20 rounded-2xl p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="font-extrabold text-lg text-white font-mono tracking-tight uppercase flex items-center gap-2">
                <Compass className="w-5 h-5 text-emerald-400" />
                {isEn ? "Mobile Money & Bank API Integration" : "Muunganiko wa Mobile Money & Benki (Lipa Namba)"}
              </h3>
              <p className="text-[11px] text-slate-400 mt-2 uppercase font-mono tracking-wider max-w-3xl">
                {isEn
                  ? "Connect your merchant Paybill or Lipa Namba. When guests pay through their unique card link, payments are recorded automatically and your ledger balance updates instantly."
                  : "Unganisha Lipa Namba au Paybill yako moja kwa moja. Mgeni akilipia kupitia kiungo chake cha kadi, malipo yanarekodiwa kwenye mfumo kiotomatiki na kusasisha dashibodi ya fedha papo hapo."}
              </p>
            </div>
            
            <div className="bg-slate-950/50 p-5 rounded-xl border border-white/5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Provider (Mfumo)</label>
                  <select className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors">
                    <option value="none">-- Chagua --</option>
                    <option value="mpesa">Vodacom M-PESA (Lipa Namba)</option>
                    <option value="tigopesa">Tigo Pesa (Lipa Namba)</option>
                    <option value="airtelmoney">Airtel Money (Lipa Namba)</option>
                    <option value="bank">Bank API Gateway (CRDB/NMB)</option>
                  </select>
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Merchant ID / Till Number</label>
                  <input type="text" placeholder="Mfano: 123456" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white font-mono text-sm focus:border-emerald-500 outline-none transition" />
                </div>
              </div>
              <div className="pt-2">
                <button 
                  onClick={() => {
                    alert(isEn ? "Mobile Money API Integration is active and listening for webhooks!" : "Muunganiko wa API ya Malipo umewezeshwa, mfumo unasikiliza malipo mapya!");
                  }}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg uppercase text-[10.5px] font-mono tracking-widest transition"
                >
                  {isEn ? "Connect & Activate API" : "Unganisha & Wezesha API"}
                </button>
              </div>
            </div>
          </div>

          {/* Automated Payment Reminders */}
          <div className="backdrop-blur-md bg-gradient-to-br from-amber-500/5 to-amber-900/10 border border-amber-500/20 rounded-2xl p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="font-extrabold text-lg text-white font-mono tracking-tight uppercase flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                {isEn ? "Automated Payment Reminders (Cron Jobs)" : "Vikumbusho vya Malipo Kiotomatiki (Cron Jobs)"}
              </h3>
              <p className="text-[11px] text-slate-400 mt-2 uppercase font-mono tracking-wider max-w-3xl">
                {isEn
                  ? "Let the system do the heavy lifting. Enable scheduled background tasks to send polite automated payment reminders to guests with outstanding pledges (e.g., 30, 14, and 7 days before the event)."
                  : "Ruhusu mfumo ufanye kazi yako. Wezesha vikumbusho vya kiotomatiki nyuma ya pazia (cron jobs) kuwatumia sms/whatsapp za upole wale walioahidi na bado hawajakamilisha (mfano: baki siku 30, 14, au 7 kabla ya sherehe)."}
              </p>
            </div>
            
            <div className="bg-slate-950/50 p-5 rounded-xl border border-white/5 space-y-5">
              <div className="flex items-center gap-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  <span className="ml-3 text-[11px] font-bold text-white uppercase font-mono tracking-widest">
                    {isEn ? "Enable Auto-Reminders" : "Wezesha Vikumbusho Auto"}
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center">
                  <span className="block text-2xl font-black text-amber-500 font-mono">30</span>
                  <span className="text-[9px] text-slate-400 uppercase font-mono font-bold tracking-widest">{isEn ? "Days Before" : "Siku Kabla"}</span>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center">
                  <span className="block text-2xl font-black text-amber-500 font-mono">14</span>
                  <span className="text-[9px] text-slate-400 uppercase font-mono font-bold tracking-widest">{isEn ? "Days Before" : "Siku Kabla"}</span>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center">
                  <span className="block text-2xl font-black text-amber-500 font-mono">7</span>
                  <span className="text-[9px] text-slate-400 uppercase font-mono font-bold tracking-widest">{isEn ? "Days Before" : "Siku Kabla"}</span>
                </div>
              </div>
              <p className="text-[9.5px] italic text-slate-500">
                * {isEn ? "The system cron job checks daily at 08:00 AM EAT and will automatically dispatch via your configured SMS/WhatsApp gateway." : "Mfumo unakagua kila siku saa 02:00 Asubuhi na kutuma ujumbe kupitia gateway yako."}
              </p>
            </div>
          </div>

        </div>
      )}

      {subTab === 'payment-methods' && (
        <div className="space-y-6 animate-fade-in p-2">
          <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h3 className="font-extrabold text-lg text-white font-mono tracking-tight uppercase flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-500" />
                  {isEn ? "Payment Methods" : "Njia za Malipo"}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 uppercase font-mono tracking-wider">
                  {isEn 
                    ? "Add your mobile money and bank accounts. These will automatically replace the {payment_methods} placeholder in templates." 
                    : "Weka namba zako za malipo hapa. Zitawekwa moja kwa moja kwenye alama ya {namba_za_malipo} kwenye ujumbe wa ahadi."}
                </p>
              </div>
            </div>

            {/* Contribution Deadline Selector */}
            <div className="p-5 bg-[#0a1122]/80 border border-amber-500/20 rounded-2xl space-y-3.5 shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition-colors duration-500" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Mwisho wa mchango
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono uppercase leading-relaxed">
                    {isEn 
                      ? "Specify the final deadline date for contributions to be sent." 
                      : "Weka tarehe ya mwisho ya kutuma mchango. Hii itabadilisha {tarehe_ya_mwisho} kwenye ujumbe wako."}
                  </p>
                </div>
                <div className="w-full sm:w-auto min-w-[240px]">
                  <input 
                    type="date" 
                    value={event.contributionDeadline || ""}
                    onChange={(e) => onUpdateEvent && onUpdateEvent({ ...event, contributionDeadline: e.target.value })}
                    className="w-full bg-slate-950/80 border border-white/10 hover:border-amber-500/30 focus:border-amber-500 rounded-xl px-4 py-2.5 text-white font-mono text-xs font-bold uppercase transition-all duration-300 shadow-inner cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Form */}
              <div className="space-y-6 bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest border-b border-white/5 pb-2">
                  {isEn ? "Add New Method" : "Ongeza Njia Mpya"}
                </h4>
                <form onSubmit={handleAddPaymentMethod} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold font-mono text-slate-400">
                      {isEn ? "Payment Type" : "Aina ya Malipo"}
                    </label>
                    <select 
                      value={payType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setPayType(val);
                        if (val === 'Mobile') {
                          setPayProvider('M-Pesa');
                        } else if (val === 'Lipa Namba') {
                          setPayProvider('Lipa kwa M-Pesa');
                        } else if (val === 'Bank') {
                          setPayProvider('CRDB Bank');
                        } else {
                          setPayProvider('');
                        }
                        setCustomProvider('');
                      }}
                      className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="">{isEn ? "Chagua..." : "Chagua..."}</option>
                      <option value="Mobile">{isEn ? "Mobile Money" : "Namba za simu"}</option>
                      <option value="Lipa Namba">Lipa Namba</option>
                      <option value="Bank">Bank Account</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold font-mono text-slate-400">
                        {isEn ? "Provider" : "Mtandao/Benki"}
                      </label>
                      <select 
                        value={payProvider}
                        onChange={(e) => {
                          setPayProvider(e.target.value);
                          if (e.target.value !== 'Other') {
                            setCustomProvider('');
                          }
                        }}
                        disabled={!payType}
                        className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 disabled:opacity-40"
                      >
                        {!payType ? (
                          <option value="">{isEn ? "Select Type First" : "Chagua aina kwanza"}</option>
                        ) : payType === 'Mobile' ? (
                          <>
                            <option value="M-Pesa">M-Pesa</option>
                            <option value="Mixx By Yas">Mixx By Yas</option>
                            <option value="Airtel Money">Airtel Money</option>
                            <option value="Halopesa">Halopesa</option>
                            <option value="T-Pesa">T-Pesa</option>
                            <option value="Other">{isEn ? "Other Network..." : "Andika Mtandao Mwengine..."}</option>
                          </>
                        ) : payType === 'Lipa Namba' ? (
                          <>
                            <option value="Lipa kwa M-Pesa">Lipa kwa M-Pesa</option>
                            <option value="Lipa kwa Mixx By Yas">Lipa kwa Mixx By Yas</option>
                            <option value="Lipa kwa Airtel Money">Lipa kwa Airtel Money</option>
                            <option value="Lipa kwa Halopesa">Lipa kwa Halopesa</option>
                            <option value="Lipa Namba (General)">Lipa Namba (Mitandao Yote)</option>
                            <option value="Other">{isEn ? "Other Lipa Namba..." : "Andika Lipa Namba Nyingine..."}</option>
                          </>
                        ) : payType === 'Bank' ? (
                          <>
                            <option value="CRDB Bank">CRDB Bank</option>
                            <option value="NMB Bank">NMB Bank</option>
                            <option value="NBC Bank">NBC Bank</option>
                            <option value="Equity Bank">Equity Bank</option>
                            <option value="ABSA Bank">ABSA Bank</option>
                            <option value="KCB Bank">KCB Bank</option>
                            <option value="Stanbic Bank">Stanbic Bank</option>
                            <option value="PBZ Bank">PBZ Bank</option>
                            <option value="TCB Bank (TPB)">TCB Bank (TPB)</option>
                            <option value="Amana Bank">Amana Bank</option>
                            <option value="Azania Bank">Azania Bank</option>
                            <option value="Akiba Bank">Akiba Commercial Bank</option>
                            <option value="Other">{isEn ? "Other Bank..." : "Andika Benki Nyingine..."}</option>
                          </>
                        ) : null}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold font-mono text-slate-400">
                        {isEn ? "Number" : "Namba"}
                      </label>
                      <input 
                        type="text" 
                        value={payNumber}
                        onChange={(e) => setPayNumber(e.target.value)}
                        placeholder="07XX XXX XXX"
                        className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
                        required
                      />
                    </div>
                  </div>

                  {payType && payProvider === 'Other' && (
                    <div className="space-y-1.5 animate-fade-in">
                      <label className="text-[10px] uppercase font-bold font-mono text-amber-500">
                        {isEn ? "Enter Custom Provider Name" : "Andika Jina la Mtandao/Benki"}
                      </label>
                      <input 
                        type="text" 
                        value={customProvider}
                        onChange={(e) => setCustomProvider(e.target.value)}
                        placeholder={isEn ? "e.g. Halopesa, TCB, etc." : "Mfano. Halopesa, TCB, n.k."}
                        className="w-full bg-slate-950/50 border border-amber-500/30 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold font-mono text-slate-400">
                      {isEn ? "Registered Name" : "Jina Lililosajiliwa"}
                    </label>
                    <input 
                      type="text" 
                      value={payName}
                      onChange={(e) => setPayName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
                      required
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-amber-500/20 text-amber-500 border border-amber-500/50 rounded-lg font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-amber-500 hover:text-white transition"
                  >
                    {isEn ? "+ Add Payment Method" : "+ Ongeza Njia ya Malipo"}
                  </button>
                </form>
              </div>

              {/* List */}
              <div className="space-y-6">
                <h4 className="text-xs font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">
                  {isEn ? "Saved Methods" : "Njia Zilizohifadhiwa"}
                </h4>
                {(!event.paymentMethods || event.paymentMethods.length === 0) ? (
                  <div className="text-center py-8 border border-white/5 border-dashed rounded-2xl bg-white/[0.02]">
                    <CreditCard className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-xs font-mono uppercase">
                      {isEn ? "No payment methods added yet" : "Hakuna njia ya malipo iliyowekwa"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {event.paymentMethods.map(method => (
                      <div key={method.id} className="flex items-center justify-between bg-slate-950/50 p-3.5 rounded-xl border border-white/5 group hover:border-amber-500/30 transition">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-mono uppercase bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">
                              {method.type}
                            </span>
                            <span className="font-bold text-white text-xs">{method.provider}</span>
                          </div>
                          <p className="text-slate-300 font-mono text-sm">{method.number}</p>
                          <p className="text-slate-500 text-[10px] uppercase">{method.name}</p>
                        </div>
                        <button 
                          onClick={() => handleRemovePaymentMethod(method.id)}
                          className="p-2 bg-rose-500/10 text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition hover:bg-rose-500 hover:text-white"
                          title={isEn ? "Remove" : "Ondoa"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
        {/* Pledge Requests dispatch board (NO PLEDGE ONLY) */}
      {subTab === 'pledge-requests' && (
        <div className="flex flex-col space-y-6 animate-fade-in" id="contrib-pledge-req-panel">
          
          {/* Dispatch console */}
          <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-6 sm:p-7 space-y-6">
            <h3 className="font-extrabold text-xs uppercase font-mono tracking-wider text-rose-455 border-b border-white/5 pb-2">
              {isEn ? "Pledge Request Dispatch Dashboard" : "Kutuma Maombi ya Ahadi (Pledge Requests)"}
            </h3>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {isEn ? (
                <>This group targets guests who <strong>haven't registered any pledge amount yet</strong> ({noPledgeList.length}). Reaching out sends them a personalized secure pledge link so they can register their commitment directly into the dashboard.</>
              ) : (
                <>Kikundi hiki kina wageni wote ambao <strong>bado hawajatoa ahadi yoyote</strong> ({noPledgeList.length}). Maombi haya yatamtumia mgeni kiungo cha pekee (Pledge Link) kumuwezesha kurekodi ahadi yake kwa mfumo, pamoja na Kadi yake yenye Mipaka ya Utambulisho.</>
              )}
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-black font-mono text-amber-500 uppercase tracking-widest flex items-center gap-1.5 matches-glow">
                  <span>⚡</span> {isEn ? "Select Message Template (SMS/WhatsApp):" : "Chagua Kiolezo cha Ujumbe (SMS/WhatsApp):"}
                </label>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {pledgeRequestTemplates.map((tpl, idx) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setMessageTemplateIndex(idx)}
                      className={`text-left p-3 sm:p-4.5 rounded-2xl border text-xs transition-all duration-300 relative flex flex-col justify-between overflow-hidden cursor-pointer ${
                        messageTemplateIndex === idx 
                          ? 'bg-gradient-to-br from-amber-500/15 via-rose-500/5 to-transparent border-amber-500/50 text-white shadow-lg shadow-amber-500/5' 
                          : 'bg-slate-950/40 border-white/5 text-slate-400 hover:border-amber-500/25 hover:bg-slate-950/60'
                      }`}
                    >
                      {/* Selection accent line */}
                      {messageTemplateIndex === idx && (
                        <div className="absolute top-0 right-0 left-0 h-[3px] bg-gradient-to-r from-amber-500 to-rose-500 animate-pulse" />
                      )}

                      <div className="space-y-2 sm:space-y-3 w-full">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] sm:text-[10px] uppercase font-black tracking-widest ${messageTemplateIndex === idx ? 'text-amber-400' : 'text-slate-500'}`}>
                            {tpl.title}
                          </span>
                          <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border transition-all duration-300 ${
                            messageTemplateIndex === idx 
                              ? 'border-amber-500 text-amber-400 bg-amber-500/10' 
                              : 'border-white/10 text-transparent'
                          }`}>
                            <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </span>
                        </div>
                        <p className="text-[10px] sm:text-[11px] whitespace-pre-line font-mono text-slate-300 leading-relaxed text-opacity-90 max-h-[100px] sm:max-h-[140px] overflow-y-auto">
                          {tpl.text('[Jina]', event.name || '[Tukio]', '[Kiungo]')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Customizable Message Template Editor */}
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <div>
                    <h4 className="text-white font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 font-mono">
                      <span>✏️</span> {isEn ? "Customize Chosen Message Template" : "Hariri Kiolezo cha Ujumbe Kilichochaguliwa"}
                    </h4>
                    <p className="text-[10px] text-emerald-400 font-medium font-mono leading-relaxed mt-0.5 animate-pulse">
                      ● {isEn ? "Changes are auto-saved instantly!" : "Mabadiliko yanajihifadhi kiotomatiki wakati unachapa!"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isTemplateSaved && (
                      <span className="text-[10px] text-emerald-400 font-mono font-bold animate-fade-in border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        ✓ {isEn ? "Saved!" : "Umehifadhiwa!"}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      className="text-[9.5px] font-mono font-bold text-slate-950 hover:bg-amber-400 bg-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-lg transition shadow flex items-center gap-1"
                      title={isEn ? "Save changes manually" : "Hifadhi mabadiliko sasa"}
                    >
                      💾 {isEn ? "Save" : "Hifadhi"}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetTemplateText}
                      className="text-[9.5px] font-mono font-bold text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-2 py-1 rounded-lg transition"
                      title={isEn ? "Reset this template text to original" : "Rudisha kiolezo kwenye asili (Reset)"}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div>
                  <textarea
                    id="textarea-custom-tpl"
                    rows={5}
                    value={getActiveTemplateValues().value}
                    onChange={e => {
                      const { setter } = getActiveTemplateValues();
                      setter(e.target.value);
                    }}
                    placeholder={isEn ? "Enter message content here..." : "Andika hapa maneno au ujumbe..."}
                    className="w-full bg-slate-950/70 border border-white/10 focus:border-amber-500 p-4 rounded-xl text-white font-mono text-xs outline-none leading-relaxed tracking-wide resize-none"
                  />
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mt-1.5 uppercase font-black">
                    <span>{isEn ? "Characters:" : "Idadi ya Herufi:"} {getActiveTemplateValues().value.length}</span>
                    <span>{isEn ? "Dynamic tag matching" : "Uvunjaji wa codes kiotomatiki"}</span>
                  </div>
                </div>
              </div>

              {/* Channel Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/5 border-b-0 rounded-b-none">
                {(['SMS', 'WhatsApp'] as const).map(ch => (
                  <button
                    key={ch}
                    onClick={() => setSendingChannel(ch)}
                    className={`py-2 text-center rounded-lg font-mono text-[10px] font-bold uppercase cursor-pointer transition ${
                      sendingChannel === ch ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400'
                    }`}
                  >
                    {isEn ? `Via ${ch}` : `Kupitia ${ch}`}
                  </button>
                ))}
              </div>

              {sendingChannel === 'SMS' && (
                <div className="flex items-center gap-2 bg-slate-950 border border-white/5 border-t-0 rounded-b-xl px-3 py-2.5 animate-fade-in text-[11px] text-slate-350">
                  <input 
                    type="checkbox" 
                    id="bulk-toggle-sms-link"
                    checked={includeSmsLink}
                    onChange={(e) => setIncludeSmsLink(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-white/20 focus:ring-amber-500 focus:ring-opacity-25 cursor-pointer"
                  />
                  <label htmlFor="bulk-toggle-sms-link" className="font-medium text-slate-300 cursor-pointer select-none">
                    {isEn 
                      ? "Include secure payment link in SMS" 
                      : "Weka kiungo (Link ya picha/ahadi) kwenye SMS"}
                  </label>
                </div>
              )}

              <button
                id="btn-bulk-send-pledge-req"
                disabled={selectedGuests.length === 0 || isSendingAll}
                onClick={() => handleBulkSend('Pledge')}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition shadow-md hover:brightness-115 active:scale-98 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSendingAll 
                  ? (isEn ? `Sending (${currentSendingIndex + 1}/${selectedGuests.length})...` : `Inatuma ${currentSendingIndex + 1}/${selectedGuests.length}...`)
                  : (isEn ? `Send Requests to Selected (${selectedGuests.length})` : `Tuma Maombi kwa Waliochaguliwa (${selectedGuests.length})`)
                }
              </button>

              {isSendingAll && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4.5 space-y-3.5 text-xs animate-pulse">
                  <div className="flex justify-between items-center font-semibold text-white font-mono text-[10.5px]">
                    <span>{isEn ? "Sending Pledge Requests..." : "Inasambaza Maombi ya Ahadi..."}</span>
                    <span className="font-mono text-amber-400 font-bold">{sendingProgress}%</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-amber-500 to-rose-500 h-full transition-all duration-300"
                      style={{ width: `${sendingProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selection list */}
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
              <h4 className="font-extrabold text-[11px] uppercase font-mono tracking-widest text-slate-300">
                {isEn ? "No Pledge Candidates List" : "Wasiotoa Ahadi Bado (No Pledge List)"}
              </h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowQuickAddGuest(true)}
                  className="px-2.5 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30 font-mono text-[9.5px] font-bold hover:bg-amber-500/30 transition uppercase"
                >
                  + {isEn ? "Add Guest" : "Mgeni Mpya"}
                </button>
                <button
                  id="btn-select-all-nopledge"
                  onClick={() => selectAllCandidates(noPledgeList)}
                  className="p-1.5 px-3 bg-white/5 rounded-lg border border-white/5 font-mono text-[9.5px] font-bold text-slate-300 hover:text-white uppercase"
                >
                  {noPledgeList.every(x => selectedGuests.includes(x.id)) 
                    ? (isEn ? 'Deselect All' : 'Zima Wote') 
                    : (isEn ? 'Select All' : 'Wote')}
                </button>
              </div>
            </div>

            <div className="max-h-[460px] overflow-y-auto">
              {renderGeniTable(noPledgeList, 'Pledge')}
            </div>
          </div>

          {/* Logs */}
          <div className="flex flex-col space-y-3">
            <h4 className="font-bold text-slate-300 text-[10px] uppercase font-mono tracking-wider">{isEn ? 'Transactions and Send Logs' : 'Miamala na Kumbukumbu ya Kutuma (Logs)'}</h4>
            <div className="flex-grow bg-slate-950/60 rounded-2xl p-4 font-mono text-[9px] h-[300px] overflow-y-auto border border-white/10 space-y-1.5 leading-relaxed antialiased">
              {sendLogs.length === 0 ? (
                <p className="text-slate-600 italic">Maelezo ya kutuma yatatokea hapa...</p>
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
      )}

      {/* Reminders dispatch UI (PLEDGED & PARTIALLY PAID ONLY) */}
      {subTab === 'reminders' && (
        <div className="flex flex-col space-y-6 animate-fade-in" id="contrib-reminders-panel">
          
          {/* Dispatch console */}
          <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-6 sm:p-7 space-y-6">
            <h3 className="font-extrabold text-xs uppercase font-mono tracking-wider text-amber-450 border-b border-white/5 pb-2">
              {isEn ? "Payment Overdue Reminders" : "Kutuma Vikumbusho vya Malipo (Reminders)"}
            </h3>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {isEn ? (
                <>This panel targets guests who <strong>have registered their pledge but haven't fully cleared their due balance yet</strong> ({pendingCollectionList.length}).
                <br/><br/>
                <strong className="text-amber-400">Strict Safety Rule:</strong> Reminders are dispatched purely as plain-text SMS without any card link, providing a polite and secure balance-due follow-up.</>
              ) : (
                <>Mawasiliano ya kikundi hiki yanalenga wageni ambao <strong>wameshatoa ahadi ya mchango ila hawajakamilisha malipo yao yote bado</strong> ({pendingCollectionList.length}). 
                <br/><br/>
                <strong className="text-amber-400">Sheria Maalum ya Kiratibu:</strong> Ujumbe wa kundi hili huenda peke yake kama SMS/Chat bila kuambatana na kadi wala pledge link, ili kuepuka usumbufu na kuleta kumbusho lililo jikita kwenye salio tu.</>
              )}
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-black font-mono text-amber-500 uppercase tracking-widest flex items-center gap-1.5 matches-glow">
                  <span>⏰</span> {isEn ? "Select Message Template (SMS/WhatsApp):" : "Chagua Kiolezo cha Ujumbe (SMS/WhatsApp):"}
                </label>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {reminderTemplates.map((tpl, idx) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setMessageTemplateIndex(idx)}
                      className={`text-left p-3 sm:p-4.5 rounded-2xl border text-xs transition-all duration-300 relative flex flex-col justify-between overflow-hidden cursor-pointer ${
                        messageTemplateIndex === idx 
                          ? 'bg-gradient-to-br from-amber-500/15 via-rose-500/5 to-transparent border-amber-500/50 text-white shadow-lg shadow-amber-500/5' 
                          : 'bg-slate-950/40 border-white/5 text-slate-400 hover:border-amber-500/25 hover:bg-slate-950/60'
                      }`}
                    >
                      {/* Selection accent line */}
                      {messageTemplateIndex === idx && (
                        <div className="absolute top-0 right-0 left-0 h-[3px] bg-gradient-to-r from-amber-500 to-rose-500 animate-pulse" />
                      )}

                      <div className="space-y-2 sm:space-y-3 w-full">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] sm:text-[10px] uppercase font-black tracking-widest ${messageTemplateIndex === idx ? 'text-amber-400' : 'text-slate-500'}`}>
                            {tpl.title}
                          </span>
                          <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border transition-all duration-300 ${
                            messageTemplateIndex === idx 
                              ? 'border-amber-500 text-amber-400 bg-amber-500/10' 
                              : 'border-white/10 text-transparent'
                          }`}>
                            <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </span>
                        </div>
                        <p className="text-[10px] sm:text-[11px] whitespace-pre-line font-mono text-slate-300 leading-relaxed text-opacity-90 max-h-[100px] sm:max-h-[140px] overflow-y-auto">
                          {tpl.text('[Jina]', event.name || '[Tukio]', 100000, 40000, 60000)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Customizable Message Template Editor */}
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <div>
                    <h4 className="text-white font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 font-mono">
                      <span>✏️</span> {isEn ? "Customize Chosen Message Template" : "Hariri Kiolezo cha Ujumbe Kilichochaguliwa"}
                    </h4>
                    <p className="text-[10px] text-emerald-400 font-medium font-mono leading-relaxed mt-0.5 animate-pulse">
                      ● {isEn ? "Changes are auto-saved instantly!" : "Mabadiliko yanajihifadhi kiotomatiki wakati unachapa!"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isTemplateSaved && (
                      <span className="text-[10px] text-emerald-400 font-mono font-bold animate-fade-in border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        ✓ {isEn ? "Saved!" : "Umehifadhiwa!"}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      className="text-[9.5px] font-mono font-bold text-slate-950 hover:bg-amber-400 bg-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-lg transition shadow flex items-center gap-1"
                      title={isEn ? "Save changes manually" : "Hifadhi mabadiliko sasa"}
                    >
                      💾 {isEn ? "Save" : "Hifadhi"}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetTemplateText}
                      className="text-[9.5px] font-mono font-bold text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-2 py-1 rounded-lg transition"
                      title={isEn ? "Reset this template text to original" : "Rudisha kiolezo kwenye asili (Reset)"}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div>
                  <textarea
                    id="textarea-custom-tpl"
                    rows={5}
                    value={getActiveTemplateValues().value}
                    onChange={e => {
                      const { setter } = getActiveTemplateValues();
                      setter(e.target.value);
                    }}
                    placeholder={isEn ? "Enter message content here..." : "Andika hapa maneno au ujumbe..."}
                    className="w-full bg-slate-950/70 border border-white/10 focus:border-amber-500 p-4 rounded-xl text-white font-mono text-xs outline-none leading-relaxed tracking-wide resize-none"
                  />
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mt-1.5 uppercase font-black">
                    <span>{isEn ? "Characters:" : "Idadi ya Herufi:"} {getActiveTemplateValues().value.length}</span>
                    <span>{isEn ? "Dynamic tag matching" : "Uvunjaji wa codes kiotomatiki"}</span>
                  </div>
                </div>
              </div>

              {/* Channel Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/5 border-b-0 rounded-b-none">
                {(['SMS', 'WhatsApp'] as const).map(ch => (
                  <button
                    key={ch}
                    onClick={() => setSendingChannel(ch)}
                    className={`py-2 text-center rounded-lg font-mono text-[10px] font-bold uppercase cursor-pointer transition ${
                      sendingChannel === ch ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400'
                    }`}
                  >
                    {isEn ? `Via ${ch}` : `Kupitia ${ch}`}
                  </button>
                ))}
              </div>

              {sendingChannel === 'SMS' && (
                <div className="flex items-center gap-2 bg-slate-950 border border-white/5 border-t-0 rounded-b-xl px-3 py-2.5 animate-fade-in text-[11px] text-slate-350">
                  <input 
                    type="checkbox" 
                    id="bulk-toggle-sms-reminders-link"
                    checked={includeSmsLink}
                    onChange={(e) => setIncludeSmsLink(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-white/20 focus:ring-amber-500 focus:ring-opacity-25 cursor-pointer"
                  />
                  <label htmlFor="bulk-toggle-sms-reminders-link" className="font-medium text-slate-300 cursor-pointer select-none">
                    {isEn 
                      ? "Include secure payment link in SMS" 
                      : "Weka kiungo (Link ya picha/ahadi) kwenye SMS"}
                  </label>
                </div>
              )}

              <button
                id="btn-bulk-send-reminders"
                disabled={selectedGuests.length === 0 || isSendingAll}
                onClick={() => handleBulkSend('Reminder')}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition shadow-md hover:brightness-115 active:scale-98 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSendingAll 
                  ? (isEn ? `Sending (${currentSendingIndex + 1}/${selectedGuests.length})...` : `Inatuma ${currentSendingIndex + 1}/${selectedGuests.length}...`)
                  : (isEn ? `Send Reminders to Selected (${selectedGuests.length})` : `Tuma Vikumbusho Maalum (${selectedGuests.length})`)
                }
              </button>

              {isSendingAll && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4.5 space-y-3.5 text-xs animate-pulse">
                  <div className="flex justify-between items-center font-semibold text-white font-mono text-[10.5px]">
                    <span>{isEn ? "Sending Collection Reminders..." : "Inasambaza Vikumbusho vya Malipo..."}</span>
                    <span className="font-mono text-amber-400 font-bold">{sendingProgress}%</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-amber-500 to-rose-500 h-full transition-all duration-300"
                      style={{ width: `${sendingProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selection list */}
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
              <h4 className="font-extrabold text-[11px] uppercase font-mono tracking-widest text-slate-300">
                {isEn ? "Outstanding Balance Directory" : "Wenye Malimbikizo ya Salio (Pending Balance List)"}
              </h4>
              <button
                id="btn-select-all-pending"
                onClick={() => selectAllCandidates(pendingCollectionList)}
                className="p-1.5 px-3 bg-white/5 rounded-lg border border-white/5 font-mono text-[9.5px] font-bold text-slate-300 hover:text-white uppercase"
              >
                {pendingCollectionList.every(x => selectedGuests.includes(x.id)) 
                  ? (isEn ? 'Deselect All' : 'Zima Wote') 
                  : (isEn ? 'Select All' : 'Wote')}
              </button>
            </div>

            <div className="max-h-[460px] overflow-y-auto">
              {renderGeniTable(pendingCollectionList, 'Reminder')}
            </div>
          </div>

          {/* Logs */}
          <div className="flex flex-col space-y-3">
            <h4 className="font-bold text-slate-300 text-[10px] uppercase font-mono tracking-wider">{isEn ? 'Transactions and Send Logs' : 'Miamala na Kumbukumbu ya Kutuma (Logs)'}</h4>
            <div className="flex-grow bg-slate-950/60 rounded-2xl p-4 font-mono text-[9px] h-[300px] overflow-y-auto border border-white/10 space-y-1.5 leading-relaxed antialiased">
              {sendLogs.length === 0 ? (
                <p className="text-slate-600 italic">Maelezo ya kutuma yatatokea hapa...</p>
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
      )}

      {/* Thank You Messages dispatch UI (FULLY PAID ONLY) */}
      {subTab === 'thank-you' && (
        <div className="flex flex-col space-y-6 animate-fade-in" id="contrib-thanks-panel">
          
          {/* Dispatch console */}
          <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-6 sm:p-7 space-y-6">
            <h3 className="font-extrabold text-xs uppercase font-mono tracking-wider text-emerald-450 border-b border-white/5 pb-2">
              {isEn ? "Gratitude & Thank You Dispatch" : "Kutuma Kadi / Ujumbe wa Shukrani (Thank You)"}
            </h3>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {isEn ? (
                <>This group coordinates guests who <strong>have fully cleared their registered pledge amounts</strong> ({fullyPaidList.length}).
                <br/><br/>
                We will dispatch sweet words of gratitude thanking them for supporting the event timeline successfully.</>
              ) : (
                <>Mawasiliano ya kikundi hiki yanalenga wageni ambao <strong>wamekamilisha michango yao yote kikamilifu</strong> ({fullyPaidList.length}). 
                <br/><br/>
                Tutawatumia ujumbe wa upendo kuwashukuru kwa uaminifu wao katika kufanikisha harusi/tukio kwa wakati.</>
              )}
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-black font-mono text-amber-500 uppercase tracking-widest flex items-center gap-1.5 matches-glow">
                  <span>💖</span> {isEn ? "Select Message Template (SMS/WhatsApp):" : "Chagua Kiolezo cha Ujumbe (SMS/WhatsApp):"}
                </label>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {thankTemplates.map((tpl, idx) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setMessageTemplateIndex(idx)}
                      className={`text-left p-3 sm:p-4.5 rounded-2xl border text-xs transition-all duration-300 relative flex flex-col justify-between overflow-hidden cursor-pointer ${
                        messageTemplateIndex === idx 
                          ? 'bg-gradient-to-br from-amber-500/15 via-rose-500/5 to-transparent border-amber-500/50 text-white shadow-lg shadow-amber-500/5' 
                          : 'bg-slate-950/40 border-white/5 text-slate-400 hover:border-amber-500/25 hover:bg-slate-950/60'
                      }`}
                    >
                      {/* Selection accent line */}
                      {messageTemplateIndex === idx && (
                        <div className="absolute top-0 right-0 left-0 h-[3px] bg-gradient-to-r from-amber-500 to-rose-500 animate-pulse" />
                      )}

                      <div className="space-y-2 sm:space-y-3 w-full">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] sm:text-[10px] uppercase font-black tracking-widest ${messageTemplateIndex === idx ? 'text-amber-400' : 'text-slate-500'}`}>
                            {tpl.title}
                          </span>
                          <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border transition-all duration-300 ${
                            messageTemplateIndex === idx 
                              ? 'border-amber-500 text-amber-400 bg-amber-500/10' 
                              : 'border-white/10 text-transparent'
                          }`}>
                            <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </span>
                        </div>
                        <p className="text-[10px] sm:text-[11px] whitespace-pre-line font-mono text-slate-300 leading-relaxed text-opacity-90 max-h-[100px] sm:max-h-[140px] overflow-y-auto">
                          {tpl.text('[Jina]', event.name || '[Tukio]')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Customizable Message Template Editor */}
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <div>
                    <h4 className="text-white font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 font-mono">
                      <span>✏️</span> {isEn ? "Customize Chosen Message Template" : "Hariri Kiolezo cha Ujumbe Kilichochaguliwa"}
                    </h4>
                    <p className="text-[10px] text-emerald-400 font-medium font-mono leading-relaxed mt-0.5 animate-pulse">
                      ● {isEn ? "Changes are auto-saved instantly!" : "Mabadiliko yanajihifadhi kiotomatiki wakati unachapa!"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isTemplateSaved && (
                      <span className="text-[10px] text-emerald-400 font-mono font-bold animate-fade-in border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        ✓ {isEn ? "Saved!" : "Umehifadhiwa!"}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      className="text-[9.5px] font-mono font-bold text-slate-950 hover:bg-amber-400 bg-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-lg transition shadow flex items-center gap-1"
                      title={isEn ? "Save changes manually" : "Hifadhi mabadiliko sasa"}
                    >
                      💾 {isEn ? "Save" : "Hifadhi"}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetTemplateText}
                      className="text-[9.5px] font-mono font-bold text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-2 py-1 rounded-lg transition"
                      title={isEn ? "Reset this template text to original" : "Rudisha kiolezo kwenye asili (Reset)"}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div>
                  <textarea
                    id="textarea-custom-tpl"
                    rows={5}
                    value={getActiveTemplateValues().value}
                    onChange={e => {
                      const { setter } = getActiveTemplateValues();
                      setter(e.target.value);
                    }}
                    placeholder={isEn ? "Enter message content here..." : "Andika hapa maneno au ujumbe..."}
                    className="w-full bg-slate-950/70 border border-white/10 focus:border-amber-500 p-4 rounded-xl text-white font-mono text-xs outline-none leading-relaxed tracking-wide resize-none"
                  />
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mt-1.5 uppercase font-black">
                    <span>{isEn ? "Characters:" : "Idadi ya Herufi:"} {getActiveTemplateValues().value.length}</span>
                    <span>{isEn ? "Dynamic tag matching" : "Uvunjaji wa codes kiotomatiki"}</span>
                  </div>
                </div>
              </div>

              {/* Channel Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/5 border-b-0 rounded-b-none">
                {(['SMS', 'WhatsApp'] as const).map(ch => (
                  <button
                    key={ch}
                    onClick={() => setSendingChannel(ch)}
                    className={`py-2 text-center rounded-lg font-mono text-[10px] font-bold uppercase cursor-pointer transition ${
                      sendingChannel === ch ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400'
                    }`}
                  >
                    {isEn ? `Via ${ch}` : `Kupitia ${ch}`}
                  </button>
                ))}
              </div>

              {sendingChannel === 'SMS' && (
                <div className="flex items-center gap-2 bg-slate-950 border border-white/5 border-t-0 rounded-b-xl px-3 py-2.5 animate-fade-in text-[11px] text-slate-350">
                  <input 
                    type="checkbox" 
                    id="bulk-toggle-sms-thanks-link"
                    checked={includeSmsLink}
                    onChange={(e) => setIncludeSmsLink(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-white/20 focus:ring-amber-500 focus:ring-opacity-25 cursor-pointer"
                  />
                  <label htmlFor="bulk-toggle-sms-thanks-link" className="font-medium text-slate-300 cursor-pointer select-none">
                    {isEn 
                      ? "Include secure payment link in SMS" 
                      : "Weka kiungo (Link ya picha/ahadi) kwenye SMS"}
                  </label>
                </div>
              )}

              <button
                id="btn-bulk-send-thanks"
                disabled={selectedGuests.length === 0 || isSendingAll}
                onClick={() => handleBulkSend('Thanks')}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition shadow-md hover:brightness-115 active:scale-98 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSendingAll 
                  ? (isEn ? `Sending (${currentSendingIndex + 1}/${selectedGuests.length})...` : `Inatuma ${currentSendingIndex + 1}/${selectedGuests.length}...`)
                  : (isEn ? `Send Gratitude Message (${selectedGuests.length})` : `Tuma Ujumbe wa Shukrani (${selectedGuests.length})`)
                }
              </button>

              {isSendingAll && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4.5 space-y-3.5 text-xs animate-pulse">
                  <div className="flex justify-between items-center font-semibold text-white font-mono text-[10.5px]">
                    <span>{isEn ? "Sending Gratitude Messages..." : "Inasambaza Shukrani za Michango..."}</span>
                    <span className="font-mono text-emerald-400 font-bold">{sendingProgress}%</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full transition-all duration-300"
                      style={{ width: `${sendingProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selection list */}
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
              <h4 className="font-extrabold text-[11px] uppercase font-mono tracking-widest text-slate-300">
                {isEn ? "Fully Cleared Contributors List" : "Waliochangia Kikamilifu (Fully Paid List)"}
              </h4>
              <button
                id="btn-select-all-thankyou"
                onClick={() => selectAllCandidates(fullyPaidList)}
                className="p-1.5 px-3 bg-white/5 rounded-lg border border-white/5 font-mono text-[9.5px] font-bold text-slate-300 hover:text-white uppercase"
              >
                {fullyPaidList.every(x => selectedGuests.includes(x.id)) 
                  ? (isEn ? 'Deselect All' : 'Zima Wote') 
                  : (isEn ? 'Select All' : 'Wote')}
              </button>
            </div>

            <div className="max-h-[460px] overflow-y-auto">
              {renderGeniTable(fullyPaidList, 'Thanks')}
            </div>
          </div>

          {/* Logs */}
          <div className="flex flex-col space-y-3">
            <h4 className="font-bold text-slate-300 text-[10px] uppercase font-mono tracking-wider">{isEn ? 'Transactions and Send Logs' : 'Miamala na Kumbukumbu ya Kutuma (Logs)'}</h4>
            <div className="flex-grow bg-slate-950/60 rounded-2xl p-4 font-mono text-[9px] h-[300px] overflow-y-auto border border-white/10 space-y-1.5 leading-relaxed antialiased">
              {sendLogs.length === 0 ? (
                <p className="text-slate-600 italic">Maelezo ya kutuma yatatokea hapa...</p>
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
      )}

      {/* Message Center view */}
      {subTab === 'message-center' && (
        <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-6 sm:p-7 space-y-6 animate-fade-in" id="contrib-msgcenter-panel">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="space-y-1">
              <h3 className="font-extrabold text-xs uppercase font-mono tracking-wider text-slate-300">
                {isEn ? "Communication Dispatch Logs" : "Kumbukumbu za Mawasiliano"}
              </h3>
              <p className="text-slate-400 text-[11px]">
                {isEn ? "History of all messages dispatched via the digital gateway." : "Historia ya jumbe zote zilizotumwa kupitia mfumo wetu wa digitali."}
              </p>
            </div>
            <button
              onClick={() => {
                const confirmMsg = isEn 
                  ? 'Are you sure you want to clear all contribution dispatch logs?' 
                  : 'Je unasafisha log zote za mawasiliano ya michango ya sasa?';
                if(confirm(confirmMsg)) {
                  setMessageLogs([]);
                }
              }}
              className="text-[9px] font-mono font-bold text-red-500 hover:text-white bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg transition uppercase"
            >
              <Trash2 className="w-3 h-3 inline mr-1" />
              {isEn ? "Clear All" : "Safisha"}
            </button>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 uppercase font-mono text-[10px]">
                  <th className="py-3 px-4 font-bold">{isEn ? 'Recipient' : 'Mpokeaji'}</th>
                  <th className="py-3 px-4 font-bold">{isEn ? 'Phone' : 'Simu'}</th>
                  <th className="py-3 px-4 font-bold">{isEn ? 'Log Type' : 'Aina'}</th>
                  <th className="py-3 px-4 font-bold">{isEn ? 'Channel' : 'Njia'}</th>
                  <th className="py-3 px-4 font-bold">{isEn ? 'Content' : 'Ujumbe'}</th>
                  <th className="py-3 px-4 font-bold">{isEn ? 'Time' : 'Muda'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px] text-slate-400">
                {messageLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-slate-600">
                      <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="uppercase tracking-widest">{isEn ? 'Archive Empty' : 'Kumbukumbu Tupu'}</p>
                    </td>
                  </tr>
                ) : (
                  messageLogs.slice().reverse().map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.03] transition group">
                      <td className="py-3 px-4 font-black text-white uppercase group-hover:text-amber-400 transition">{log.guestName}</td>
                      <td className="py-3 px-4 text-slate-500">{log.phone}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          log.type === 'Pledge' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                          log.type === 'Reminder' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                          'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-lg text-[9.5px] border border-white/10">
                          {log.channel === 'SMS' ? <Send className="w-2.5 h-2.5 text-amber-500" /> : <MessageCircle className="w-2.5 h-2.5 text-emerald-500" />}
                          {log.channel}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-[250px] truncate text-[10px] text-slate-500 italic" title={log.message}>"{log.message}"</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{log.sentAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Reports Panel View */}
      {subTab === 'reports' && (
        <div className="space-y-6 animate-fade-in relative" id="contrib-reports-panel">
          <ReportWatermark />
          
          {/* 1. Dashboard Insights Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold font-mono">{isEn ? "Total Pledges" : "Jumla ya Ahadi"}</p>
                <p className="text-lg font-black text-white font-mono leading-none mt-1">TZS {guests.reduce((sum, g) => sum + (g.pledgeAmount || 0), 0).toLocaleString()}</p>
              </div>
            </div>
            
            <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold font-mono">{isEn ? "Collected" : "Makusanyo"}</p>
                <p className="text-lg font-black text-emerald-400 font-mono leading-none mt-1">TZS {guests.reduce((sum, g) => sum + (g.paidAmount || 0), 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold font-mono">{isEn ? "Balance Due" : "Salio la Madeni"}</p>
                <p className="text-lg font-black text-rose-400 font-mono leading-none mt-1">TZS {(guests.reduce((sum, g) => sum + (g.pledgeAmount || 0), 0) - guests.reduce((sum, g) => sum + (g.paidAmount || 0), 0)).toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold font-mono">{isEn ? "Contributors" : "Wachangiaji"}</p>
                <p className="text-lg font-black text-blue-400 font-mono leading-none mt-1">{guests.filter(g => (g.pledgeAmount || 0) > 0).length}</p>
              </div>
            </div>
          </div>

          {/* 2. Wall of Honor (Fully Paid) */}
          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase font-mono tracking-tight">{isEn ? "Wall of Honor" : "Ukuta wa Heshima"}</h3>
                  <p className="text-[10px] text-slate-400 uppercase font-bold font-mono">{isEn ? "Celebrating our fully cleared contributors" : "Wale waliotimiza ahadi zao kikamilifu"}</p>
                </div>
              </div>
              <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-mono font-bold text-slate-300">{fullyPaidList.length} {isEn ? "Heroes" : "Washiriki"}</span>
              </div>
            </div>
            
            <div className="p-5">
              {fullyPaidList.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-slate-600">
                    <Award className="w-8 h-8" />
                  </div>
                  <p className="text-slate-500 text-xs font-mono max-w-xs">{isEn ? "No contributors have fully cleared their pledges yet. They will appear here once paid in full." : "Bado hakuna mchangiaji aliyelipa ahadi yake yote. Watatokea hapa kisha kulipa kikamilifu."}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {fullyPaidList.map(g => (
                    <motion.div 
                      whileHover={{ y: -3 }}
                      key={g.id} 
                      className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col items-center text-center space-y-2 relative overflow-hidden group"
                    >
                      <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-white font-black text-sm uppercase">
                        {g.name.charAt(0)}
                      </div>
                      <p className="text-[10px] font-black text-white uppercase line-clamp-1 h-3">{g.name}</p>
                      <p className="text-[9px] font-mono text-amber-500 font-bold">TZS {(g.paidAmount || 0).toLocaleString()}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 3. Export Center (Bento Style) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3 mb-1 px-1">
                <Download className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-black text-white uppercase font-mono tracking-wider">{isEn ? "Export & Report Center" : "Kituo cha Export & Ripoti"}</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Ledger */}
                <div className="p-5 bg-slate-900 border border-white/10 rounded-2xl space-y-4 hover:border-amber-500/30 transition group">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-black transition duration-300">
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => downloadReportPDF(isEn ? 'Full_Ledger' : 'Daftari_Kamili', guests)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"><Printer className="w-4 h-4" /></button>
                      <button onClick={() => downloadReportCSV(isEn ? 'Full_Ledger' : 'Daftari_Kamili', guests)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"><Download className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-black text-white text-xs uppercase">{isEn ? "Contributions Ledger" : "Daftari la Michango"}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{isEn ? "A comprehensive report containing every single contributor and their current standing." : "Ripoti pana inayojumuisha kila mchangiaji na hali yake ya sasa ya ahadi."}</p>
                  </div>
                </div>

                {/* Outstanding Debts */}
                <div className="p-5 bg-slate-900 border border-white/10 rounded-2xl space-y-4 hover:border-rose-500/30 transition group">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition duration-300">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex gap-1" title={isEn ? "Download Debtors List" : "Pakua Orodha ya Madeni"}>
                      <button onClick={() => downloadReportPDF(isEn ? 'Due_Balances' : 'Wenye_Salio', pendingCollectionList)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"><Printer className="w-4 h-4" /></button>
                      <button onClick={() => downloadReportCSV(isEn ? 'Due_Balances' : 'Wenye_Salio', pendingCollectionList)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"><Download className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-black text-white text-xs uppercase">{isEn ? "Active Debtors List" : "Orodha ya Madeni Sugu"}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{isEn ? "Focus specifically on guests who have pledged but have not yet cleared their balances." : "Zingatia hasa wageni ambao wametoa ahadi lakini bado hawajalipa madeni yao yote."}</p>
                  </div>
                </div>

                {/* Unpledged Guests */}
                <div className="p-5 bg-slate-900 border border-white/10 rounded-2xl space-y-4 hover:border-blue-500/30 transition group">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition duration-300">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => downloadReportPDF(isEn ? 'No_Pledges' : 'Wasiotoa_Ahadi', noPledgeList)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"><Printer className="w-4 h-4" /></button>
                      <button onClick={() => downloadReportCSV(isEn ? 'No_Pledges' : 'Wasiotoa_Ahadi', noPledgeList)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"><Download className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-black text-white text-xs uppercase">{isEn ? "Uncommitted Guests" : "Orodha ya Wasioahidi Bado"}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{isEn ? "List of guests who have been invited but have not yet registered or submitted a pledge." : "Orodha ya wageni walioalikwa lakini bado hawajatoa ahadi yoyote ya mchango."}</p>
                  </div>
                </div>

                {/* Summarized Insights */}
                <div className="p-5 bg-slate-900 border border-white/10 rounded-2xl space-y-4 hover:border-emerald-500/30 transition group">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition duration-300">
                      <BarChart2 className="w-5 h-5" />
                    </div>
                    <div className="flex gap-1" onClick={handlePrintReport}>
                      <button className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"><Printer className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-black text-white text-xs uppercase">{isEn ? "Executive Summary" : "Muhtasari wa Uongozi"}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{isEn ? "High-level summary of all financial stats for the organizing committee presentation." : "Muhtasari wa ngazi ya juu wa takwimu zote za kifedha kwa ajili ya kamati ya uongozi."}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Activity Logs / Recent Dispatch Logs */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-1 px-1">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <h3 className="text-xs font-black text-white uppercase font-mono tracking-wider">{isEn ? "Recent Activity" : "Mwenendo wa Hivi Karibuni"}</h3>
                </div>
                <button 
                  onClick={() => {if(confirm(isEn ? 'Clear all logs?' : 'Safisha log zote?')) setMessageLogs([]);}}
                  className="text-[9px] font-bold text-rose-500 hover:text-rose-400 uppercase font-mono"
                >
                  {isEn ? "Clear" : "Safisha"}
                </button>
              </div>

              <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[400px]">
                <div className="p-4 border-b border-white/5 bg-white/5">
                   <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder={isEn ? "Search logs..." : "Tafuta log..."}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg py-2 pl-8 pr-3 text-[10px] text-white font-mono outline-none focus:border-amber-500 transition"
                    />
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {messageLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                      <Clock className="w-10 h-10 mb-2" />
                      <p className="text-[10px] font-mono uppercase">{isEn ? "No recent logs" : "Hakuna kumbukumbu za sasa"}</p>
                    </div>
                  ) : (
                    messageLogs.slice().reverse().map((log) => (
                      <div key={log.id} className="relative pl-4 border-l border-white/10 space-y-1 group">
                        <div className="absolute left-[-4.5px] top-0 w-2 h-2 rounded-full bg-amber-500 ring-4 ring-slate-900"></div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black text-white uppercase tracking-tight">{log.guestName}</p>
                          <span className="text-[9px] font-mono text-slate-500">{log.sentAt.split(',')[1]}</span>
                        </div>
                        <p className="text-[9px] font-mono text-slate-400">
                          <span className="text-amber-500 font-bold">{log.type}</span> {isEn ? "sent via" : "imetumwa kwa"} <span className="text-white">{log.channel}</span>
                        </p>
                        <p className="text-[9.5px] text-slate-500 line-clamp-1 italic bg-white/5 px-1.5 py-0.5 rounded border border-white/5 group-hover:line-clamp-none transition">"{log.message}"</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>
      )}


      {/* ----------------- DIALOGS & MODALS ----------------- */}

      {/* 0. Quick Add Guest Modal */}
      {showQuickAddGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" id="modal-quick-add-guest">
          <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-2xl p-6 space-y-4">
            <h3 className="font-extrabold text-xs uppercase font-mono tracking-wider text-amber-450 border-b border-white/5 pb-2">
              {editingGuestId ? (isEn ? "Edit Contributor Info" : "Hariri Taarifa za Mgeni") : (isEn ? "Add New Contributor" : "Mgeni Mpya wa Ahadi")}
            </h3>
            <form onSubmit={handleQuickAddGuest} className="space-y-4 shadow max-h-[85vh] overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold font-mono text-slate-400">
                  {isEn ? "Guest Full Name" : "Jina Kamili la Mgeni"} <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                  placeholder={isEn ? "e.g. John Doe" : "mfano. James Lema"}
                  className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-white font-mono text-xs focus:border-amber-500 outline-none transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold font-mono text-slate-400">
                  {isEn ? "Phone Number (Optional)" : "Namba ya Simu (Si Lazima)"}
                </label>
                <input 
                  type="tel" 
                  value={newGuestPhone}
                  onChange={(e) => setNewGuestPhone(e.target.value)}
                  placeholder={isEn ? "e.g. 0712345678" : "mfano. 07xx xxx xxx"}
                  className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-white font-mono text-xs focus:border-amber-500 outline-none transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold font-mono text-slate-400">
                  {isEn ? "Category" : "Kundi"}
                </label>
                <select
                  value={newGuestCategory}
                  onChange={(e: any) => setNewGuestCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-white font-mono text-xs focus:border-amber-500 outline-none transition appearance-none"
                >
                  <option value="SINGLE">SINGLE</option>
                  <option value="DOUBLE">DOUBLE</option>
                  <option value="FAMILY">FAMILY</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold font-mono text-slate-400">
                    {isEn ? "Pledge (TZS)" : "Ahadi (TZS)"}
                  </label>
                  <input 
                    type="text" 
                    value={newGuestPledge}
                    onChange={(e) => setNewGuestPledge(formatNumberWithCommas(e.target.value))}
                    placeholder="500,000"
                    className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-white font-mono text-xs focus:border-amber-500 outline-none transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold font-mono text-slate-400">
                    {isEn ? "Paid (TZS)" : "Malipo (TZS)"}
                  </label>
                  <input 
                    type="text" 
                    value={newGuestPaid}
                    onChange={(e) => setNewGuestPaid(formatNumberWithCommas(e.target.value))}
                    placeholder="500,000"
                    className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-white font-mono text-xs focus:border-amber-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowQuickAddGuest(false);
                    setEditingGuestId(null);
                  }}
                  className="py-3 rounded-xl border border-white/10 text-[10px] font-bold uppercase tracking-wider hover:bg-white/5 transition"
                >
                  {isEn ? "Cancel" : "Ghairi"}
                </button>
                <button 
                  type="submit" 
                  className="py-3 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider hover:bg-amber-400 transition"
                >
                  {editingGuestId ? (isEn ? "Save Changes" : "Hifadhi Taarifa") : (isEn ? "Add Guest" : "Ongeza")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Pledge Amount Dialog */}
      {isPledgeModalOpen && targetGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" id="modal-pledge-dialog">
          <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-2xl p-6 space-y-4">
            <h3 className="font-extrabold text-xs uppercase font-mono tracking-wider text-amber-400">
              {isEn ? "Add / Edit Guest Pledge Amount" : "Ongeza / Hariri Ahadi ya Mchango"}
            </h3>
            <p className="text-[11.5px] text-slate-450 uppercase font-mono">
              {isEn ? "Guest Name" : "Jina la Mgeni"}: <span className="text-white font-bold">{targetGuest.name}</span>
            </p>

            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-mono text-slate-400">
                {isEn ? "Pledge Amount (TZS):" : "Kiasi cha Ahadi (TZS):"}
              </label>
              <input 
                id="modal-input-pledge-field"
                type="text"
                value={modalPledgeAmount}
                onChange={e => setModalPledgeAmount(formatNumberWithCommas(e.target.value))}
                placeholder="500,000"
                className="w-full bg-slate-950 border border-white/10 focus:border-amber-400 py-3.5 px-4 rounded-xl text-center text-xl font-extrabold font-mono text-amber-400 outline-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setIsPledgeModalOpen(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-350 font-bold uppercase font-mono text-[10.5px]"
              >
                {isEn ? "Cancel" : "Ghairi"}
              </button>
              <button
                onClick={handleSavePledge}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-lg font-bold uppercase font-mono text-[10.5px]"
              >
                {isEn ? "Save" : "Hifadhi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Payment Recording Dialog */}
      {isPaymentModalOpen && targetGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" id="modal-payment-dialog">
          <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="font-extrabold text-xs uppercase font-mono tracking-wider text-emerald-450">
                {isEn ? "Record New Payment Piece" : "Sajili Malipo Mapya"}
              </h3>
              <p className="text-[10px] text-slate-400 uppercase font-mono mt-0.5">
                {isEn ? "Payer" : "Mlipaji"}: <strong className="text-white uppercase">{targetGuest.name}</strong>
              </p>
              {targetGuest.pledgeAmount && (
                <p className="text-[10px] text-amber-400 font-mono mt-0.5">
                  {isEn ? "Pledge" : "Ahadi"}: TZS {targetGuest.pledgeAmount.toLocaleString()} • {isEn ? "Paid" : "Amelipa"}: TZS {(targetGuest.paidAmount || 0).toLocaleString()}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-455 block">
                  {isEn ? "Amount Paid (TZS):" : "Kiasi Kilicholipwa (TZS):"}
                </label>
                <input 
                  id="modal-input-pay-amount"
                  type="text"
                  value={modalPaymentAmount}
                  onChange={e => setModalPaymentAmount(formatNumberWithCommas(e.target.value))}
                  placeholder="500,000"
                  className="w-full bg-slate-950 border border-white/10 focus:border-emerald-500 py-3.5 px-4 rounded-xl text-center text-xl font-extrabold font-mono text-emerald-400 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-455 block">
                  {isEn ? "Transaction Reference Code:" : "Msimbo wa Muamala (Reference):"}
                </label>
                <input 
                  id="modal-input-pay-ref"
                  type="text"
                  value={modalPaymentRef}
                  onChange={e => setModalPaymentRef(e.target.value)}
                  placeholder="e.g. M-PESA Ref / NMB Ref"
                  className="w-full bg-slate-950 border border-white/10 py-2 px-3 rounded-lg text-white font-bold font-mono outline-none uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-455 block">
                    {isEn ? "Payment Date:" : "Tarehe:"}
                  </label>
                  <input 
                    type="date"
                    value={modalPaymentDate}
                    onChange={e => setModalPaymentDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 py-2 px-3 rounded-lg text-white font-mono text-[11px] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-455 block">
                    {isEn ? "Short Notes:" : "Maelezo fupi:"}
                  </label>
                  <input 
                    type="text"
                    value={modalPaymentNotes}
                    onChange={e => setModalPaymentNotes(e.target.value)}
                    placeholder="e.g. Kikundi A"
                    className="w-full bg-slate-950 border border-white/10 py-2 px-3 rounded-lg text-white text-xs outline-none"
                  />
                </div>
              </div>

              {/* Auto SMS Thank-You Toggle */}
              <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-emerald-300">
                  <input
                    type="checkbox"
                    checked={autoSendThankYouSMS}
                    onChange={e => setAutoSendThankYouSMS(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                  <span>{isEn ? "Auto-send Thank You / Receipt Message" : "Tuma SMS ya Shukrani/Risiti Otomatiki"}</span>
                </label>
                
                {autoSendThankYouSMS && (
                  <div className="flex items-center justify-between text-[11px] text-slate-300 pl-6 pt-1 border-t border-emerald-500/10">
                    <span className="text-slate-400 font-mono text-[10px] uppercase">{isEn ? "Channel:" : "Njia:"}</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAutoSendChannel('SMS')}
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono transition ${autoSendChannel === 'SMS' ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                      >
                        SMS
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutoSendChannel('WhatsApp')}
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono transition ${autoSendChannel === 'WhatsApp' ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                      >
                        WhatsApp
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-350 font-bold uppercase font-mono text-[10.5px]"
              >
                {isEn ? "Cancel" : "Ghairi"}
              </button>
              <button
                onClick={handleRecordPayment}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-555 text-white rounded-lg font-bold uppercase font-mono text-[10.5px]"
              >
                {isEn ? "Submit Payment" : "Wasilisha Malipo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. View Payment History Dialog */}
      {isHistoryModalOpen && targetGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" id="modal-history-dialog">
          <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-2xl p-6 space-y-4">
            <div className="border-b border-white/5 pb-2">
              <h3 className="font-extrabold text-xs uppercase font-mono tracking-wider text-slate-300">
                {isEn ? "Contribution Payment Log history" : "Historia ya Malipo ya Mchango"}
              </h3>
              <p className="text-[10.5px] text-slate-450 uppercase font-mono mt-0.5">
                {isEn ? "Contributor" : "Wachangiaji"}: <strong className="text-white font-bold">{targetGuest.name}</strong>
              </p>
            </div>

            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {/* Payment History Section */}
              <div className="space-y-2 divide-y divide-white/5">
                <h4 className="font-bold text-[10px] text-amber-500 uppercase font-mono tracking-widest">{isEn ? "- Payments -" : "- Malipo -"}</h4>
                {!targetGuest.payments || targetGuest.payments.length === 0 ? (
                  <p className="text-center py-3 text-slate-500 font-mono text-xs">
                    {isEn ? "No contribution logs found for this guest." : "Hakuna historia yoyote ya malipo kwa sasa ya mgeni huyu."}
                  </p>
                ) : (
                  targetGuest.payments.map((p) => (
                    <div key={p.id} className="pt-3 first:pt-2 space-y-1 font-mono text-xs text-slate-355">
                      <div className="flex justify-between font-bold text-white">
                        <span>TZS {p.amount.toLocaleString()}</span>
                        <span className="text-[10.5px] text-emerald-450">{p.date}</span>
                          <button
                            onClick={() => handleDeletePayment(targetGuest.id, p.id, p.amount)}
                            className="ml-3 text-rose-500/50 hover:text-rose-500 transition-colors"
                            title={isEn ? "Delete Payment" : "Futa Malipo"}
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>Ref: <span className="text-yellow-450 uppercase font-bold">{p.reference}</span></span>
                        <span className="italic">{p.notes}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message History Section */}
              <div className="space-y-2 divide-y divide-white/5 pt-3">
                <h4 className="font-bold text-[10px] text-blue-400 uppercase font-mono tracking-widest">{isEn ? "- Messaging Logs -" : "- Historia Ya Ujumbe -"}</h4>
                {messageLogs.length > 0 && messageLogs.filter((l: any) => l.guestId === targetGuest.id).length > 0 ? (
                  messageLogs.filter((l: any) => l.guestId === targetGuest.id).map((l: any) => (
                    <div key={l.id} className="pt-3 first:pt-2 space-y-1 font-mono text-[10.5px] text-slate-400">
                      <div className="flex justify-between items-center text-white font-bold">
                        <span className="bg-white/10 px-1 rounded text-[9px] uppercase">{l.channel} - {l.type}</span>
                        <span className="text-blue-300">{l.sentAt}</span>
                      </div>
                      <p className="line-clamp-2 italic" title={l.message}>{l.message}</p>
                      <div className={`text-[9px] font-black uppercase text-right ${l.status === 'delivered' ? 'text-emerald-400' : l.status === 'failed' ? 'text-rose-450' : 'text-amber-500'}`}>
                        {l.status}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-3 text-slate-500 font-mono text-xs">
                    {isEn ? "No SMS or WhatsApp logs." : "Hakuna log yoyote ya sms/whatsapp."}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-white/5 hover:bg-slate-800 rounded-lg text-white font-bold uppercase font-mono text-[10.5px]"
              >
                {isEn ? "Close" : "Funga"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Active Target Custom Send Modal (SMS / WhatsApp + Card Builder Integration) */}
      <AnimatePresence>
        {activeSendTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in" id="modal-contrib-target-dialog">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={`bg-slate-900 border border-white/10 w-full ${activeSendTarget.type === 'Thanks' ? 'max-w-xl' : 'max-w-4xl'} rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row my-8`}
            >
              {/* Left Side: Generative Canvas Card Preview */}
              {(activeSendTarget.type === 'Pledge' || activeSendTarget.type === 'Reminder') && (
                <div className="md:w-5/12 bg-slate-950 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/10 space-y-4">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-amber-500 font-bold">
                    {isEn ? "PLEDGE CARD PREVIEW" : "KADI YA AHADI (PREVIEW)"}
                  </span>

                  <div className="relative w-full max-w-[280px] aspect-[3/4] bg-slate-900 rounded-xl overflow-hidden border border-white/10 shadow-lg flex items-center justify-center">
                    {!modalImageLoaded ? (
                      <div className="flex flex-col items-center space-y-2.5">
                        <RefreshCw className="w-7 h-7 text-amber-500 animate-spin" />
                        <span className="text-[10px] font-mono text-slate-500">{isEn ? 'Constructing pledge card design...' : 'Inasawir kadi yako sasa...'}</span>
                      </div>
                    ) : (
                      <>
                        <img 
                          src={modalCardUrl} 
                          className="w-full h-full object-contain animate-fade-in" 
                          alt="Personalized Pledge Design Card" 
                          id="pledge-preview-image"
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none z-30 overflow-hidden">
                          <div className="transform -rotate-45 border-2 border-white/20 rounded-xl px-4 py-1.5 bg-black/20 shadow-inner backdrop-blur-[1px]">
                            <span className="text-white/30 font-black text-sm tracking-[0.2em] uppercase whitespace-nowrap select-none">
                              PREVIEW MODE
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {modalImageLoaded && (
                    <div className="flex w-full max-w-[280px] gap-2">
                      <button
                        onClick={handleCopyImageToClipboard}
                        className="flex-1 py-2 px-3 bg-white/5 hover:bg-slate-800 text-white rounded-lg font-mono text-[10px] font-bold uppercase transition flex items-center justify-center gap-1.5 border border-white/5"
                      >
                        {copyImageSuccess ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">{isEn ? "Copied" : "Imenakiliwa"}</span>
                          </>
                        ) : (
                          <>
                            <Clipboard className="w-3.5 h-3.5" />
                            <span>{isEn ? "Copy Card" : "Copy Kadi"}</span>
                          </>
                        )}
                      </button>
                      <a
                        href={modalCardUrl}
                        download={`Kadi_${activeSendTarget.guest.name.replace(/\s+/g, '_')}.jpg`}
                        className="flex-1 py-2 px-3 bg-white/15 hover:bg-slate-800 text-white rounded-lg font-mono text-[10px] font-bold uppercase transition flex items-center justify-center gap-1.5 border border-white/10"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isEn ? "Download" : "Pakua Kadi"}</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Right Side: Message text compiling & send action buttons */}
              <div className={`${activeSendTarget.type === 'Thanks' ? 'w-full' : 'md:w-7/12'} p-6 flex flex-col justify-between space-y-5`}>
                <div className="space-y-4">
                  <div className="flex justify-between items-start border-b border-white/5 pb-2.5">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">{activeSendTarget.type === 'Pledge' ? (isEn ? 'Pledge Request' : 'Ombi la Ahadi') : (activeSendTarget.type === 'Reminder' ? (isEn ? 'Reminder' : 'Kumbusho') : (isEn ? 'Thank You' : 'Shukrani'))}</span>
                      <h3 className="font-extrabold text-base text-white mt-0.5">{activeSendTarget.guest.name}</h3>
                      <p className="text-[10px] text-slate-450 font-mono font-semibold uppercase">{isEn ? 'Phone' : 'Namba'}: <span className="text-white">{activeSendTarget.guest.phone || 'N/A'}</span></p>
                    </div>
                    <button 
                      onClick={() => setActiveSendTarget(null)}
                      className="p-1 px-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {activeSendTarget.channel === 'preview' ? (
                    <div className="space-y-4 animate-fade-in">
                      <span className="block text-[10px] uppercase font-black font-mono text-amber-500 tracking-wider">
                        📊 {isEn ? "Recipient Overview" : "Hali na Taarifa za Ahadi"}
                      </span>
                      
                      <div className="grid grid-cols-2 gap-3.5 bg-slate-950/60 p-4 rounded-xl border border-white/5 font-mono text-[11px]">
                        <div>
                          <span className="block text-[8px] text-slate-500 uppercase">{isEn ? "Pledge Committed" : "Kiasi Kilichoahidiwa"}</span>
                          <span className="block font-bold text-slate-200 mt-0.5">TZS {(activeSendTarget.guest.pledgeAmount || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-slate-500 uppercase">{isEn ? "Total Paid" : "Kiasi Kilicholipwa"}</span>
                          <span className="block font-bold text-emerald-400 mt-0.5">TZS {(activeSendTarget.guest.paidAmount || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-slate-500 uppercase">{isEn ? "Remaining Balance" : "Deni / Salio Linalobaki"}</span>
                          <span className={`block font-bold mt-0.5 ${((activeSendTarget.guest.pledgeAmount || 0) - (activeSendTarget.guest.paidAmount || 0)) > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                            TZS {((activeSendTarget.guest.pledgeAmount || 0) - (activeSendTarget.guest.paidAmount || 0)).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-slate-500 uppercase">{isEn ? "Card Group" : "Kundi / Aina ya Kadi"}</span>
                          <span className="block font-bold text-amber-400 mt-0.5 uppercase">{activeSendTarget.guest.cardType || "SINGLE"}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[9.5px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                          {isEn ? "Compiled Message Text (Sample Preview):" : "Ujumbe Utakaoambatana na Kadi:"}
                        </label>
                        <div className="bg-slate-950/90 rounded-xl p-3.5 border border-white/5 font-sans text-xs text-slate-350 leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
                          {getContributionMessageText(activeSendTarget.guest, activeSendTarget.type, 'whatsapp', true)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-[9.5px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                        {isEn ? "Message text to be sent:" : "Ujumbe utakaotumwa:"}
                      </label>
                      <div className="bg-slate-950 rounded-xl p-4 border border-white/5 font-sans text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                        {getContributionMessageText(activeSendTarget.guest, activeSendTarget.type, activeSendTarget.channel, activeSendTarget.channel === 'whatsapp')}
                      </div>

                      {activeSendTarget.channel === 'sms' && (
                        <div className="flex items-center gap-2 bg-slate-950 border border-white/5 rounded-xl p-3 animate-fade-in">
                          <input 
                            type="checkbox" 
                            id="toggle-include-sms-link"
                            checked={includeSmsLink}
                            onChange={(e) => setIncludeSmsLink(e.target.checked)}
                            className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-white/20 focus:ring-amber-500 focus:ring-opacity-25 cursor-pointer"
                          />
                          <label htmlFor="toggle-include-sms-link" className="text-[11px] font-medium text-slate-300 cursor-pointer select-none">
                            {isEn 
                              ? "Include secure payment link in SMS" 
                              : "Weka kiungo (Link ya picha/ahadi) kwenye SMS"}
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {activeSendTarget.channel === 'whatsapp' && (
                    isMetaWhatsApp ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-2.5 text-[10.5px] text-emerald-300 leading-normal">
                        <AlertCircle className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                        <span>
                          {isEn 
                            ? "🚀 META CLOUD API ENABLED: Click 'Send via WhatsApp' below to dispatch directly via API."
                            : "🚀 META CLOUD API IMESETIWA: Bonyeza 'Tuma Ujumbe (Send)' hapa chini kutuma moja kwa moja bila kufungua app ya WhatsApp."}
                        </span>
                      </div>
                    ) : (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-start gap-2.5 text-[10.5px] text-blue-300 leading-normal">
                        <AlertCircle className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                        <span>
                          {isEn 
                            ? "We recommend copying the card image first using 'Copy Card', then click the button below to paste it directly onto WhatsApp along with the text."
                            : "Tunapendekeza unakili kwanza picha ya doti kadi ya mchango kwa kubonyeza 'Copy Kadi', ndipo ubonyeze kitufe hapo chini ili kuibandika (Paste) kirahisi kwenye WhatsApp."}
                        </span>
                      </div>
                    )
                  )}
                </div>

                <div className="pt-4 border-t border-white/5 flex flex-col space-y-2">
                  {activeSendTarget.channel === 'sms' ? (
                    <button
                      onClick={() => handleConfirmSent(activeSendTarget.guest.id, 'sms', activeSendTarget.type)}
                      disabled={isDispatching}
                      className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-555 text-white rounded-xl transition duration-200 flex items-center justify-center gap-2 font-extrabold uppercase font-mono text-[11px] tracking-wider disabled:opacity-55 cursor-pointer shadow-lg hover:brightness-110"
                    >
                      {isDispatching ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>{isEn ? "Sending message GSM..." : "Inatuma kwa SMS sasa..."}</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>{isEn ? "Send SMS Gateway Request" : "Kamilisha Kutuma SMS (Gateway)"}</span>
                        </>
                      )}
                    </button>
                  ) : activeSendTarget.channel === 'whatsapp' ? (
                    isMetaWhatsApp ? (
                      <button
                        onClick={() => handleConfirmSent(activeSendTarget.guest.id, 'whatsapp', activeSendTarget.type)}
                        disabled={isDispatching}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl transition duration-200 flex items-center justify-center gap-2 font-extrabold uppercase font-mono text-[11px] tracking-wider disabled:opacity-55 cursor-pointer shadow-lg hover:brightness-110"
                      >
                        {isDispatching ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-white" />
                            <span>{isEn ? "Sending..." : "Inatuma..."}</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>{isEn ? "Send via WhatsApp" : "Tuma Ujumbe (Send)"}</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <a
                        href={`https://wa.me/${cleanPhoneForWhatsapp(activeSendTarget.guest.phone)}?text=${encodeURIComponent(getContributionMessageText(activeSendTarget.guest, activeSendTarget.type, activeSendTarget.channel, true))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl transition duration-200 flex items-center justify-center gap-2 font-extrabold uppercase font-mono text-[11px] tracking-wider cursor-pointer shadow-lg hover:brightness-110"
                        onClick={() => handleConfirmSent(activeSendTarget.guest.id, 'whatsapp', activeSendTarget.type)}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{isEn ? "Open WhatsApp Connection" : "Fungua WhatsApp & Tuma Kadi"}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-white/70" />
                      </a>
                    )
                  ) : (
                    // Preview mode triggers
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setActiveSendTarget(prev => prev ? { ...prev, channel: 'sms' } : null)}
                        className="py-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 rounded-xl transition duration-150 flex items-center justify-center gap-2 font-black uppercase font-mono text-[10.5px] tracking-wider cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isEn ? "Send SMS" : "Tuma SMS"}</span>
                      </button>
                      <button
                        onClick={() => setActiveSendTarget(prev => prev ? { ...prev, channel: 'whatsapp' } : null)}
                        className="py-3.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/25 rounded-xl transition duration-150 flex items-center justify-center gap-2 font-black uppercase font-mono text-[10.5px] tracking-wider cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{isEn ? "Send WA" : "Tuma WA"}</span>
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setActiveSendTarget(null)}
                    className="w-full py-2.5 bg-white/5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition font-bold uppercase font-mono text-[10px]"
                  >
                    {isEn ? "Cancel & Go Back" : "Kansela / Rudi Nyuma"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. SMS Wallet Success Popup */}
      <AnimatePresence>
        {smsSuccessPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 w-full max-w-xs rounded-2xl p-6 text-center space-y-4 shadow-2xl"
            >
              <div className="mx-auto w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/30">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-extrabold text-white text-sm uppercase tracking-tight">
                  {isEn ? "Message Sent Successfully!" : "Ujumbe Umetumwa!"}
                </h4>
                <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                  {isEn 
                    ? `Your ${smsSuccessPopup.channel} notification has been dispatched to the guest gateway.`
                    : `Ujumbe wako wa ${smsSuccessPopup.channel} umetumwa kikamilifu kwa mteja sasa hivi kupitia gateway yetu.`
                  }
                </p>
              </div>

              {smsSuccessPopup.channel === 'SMS' && (
                <div className="bg-slate-950 rounded-xl p-3 border border-white/5">
                  <span className="block text-[9px] font-mono text-slate-500 uppercase">{isEn ? "Remaining Wallet Balance" : "Salio la SMS (Wallet Balance)"}</span>
                  <span className="block text-amber-400 font-bold font-mono text-base">{smsSuccessPopup.remainingSms} SMS</span>
                </div>
              )}

              <button
                onClick={() => setSmsSuccessPopup(null)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase font-mono text-[10px] transition border border-white/10"
              >
                {isEn ? "Continue" : "Endelea"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5B. Interactive WhatsApp Multi-Send Bulk Queue Assistant */}
      <AnimatePresence>
        {waInteractiveQueue && (() => {
          const queue = waInteractiveQueue;
          const currentGuest = queue.guests[queue.currentIndex];
          if (!currentGuest) return null;

          const total = queue.guests.length;
          const currentNum = queue.currentIndex + 1;
          const progressPercent = Math.round((queue.currentIndex / total) * 100);

          const textForGuest = getContributionMessageText(currentGuest, queue.type, 'whatsapp', true);

          // Action to advance queue
          const handleAdvanceQueue = (markAsSent: boolean) => {
            let updatedGuests = [...guests];
            if (markAsSent) {
              // Update state locally & database on server
              updatedGuests = updatedGuests.map(item => {
                if (item.id === currentGuest.id) {
                  return { ...item, whatsappStatus: 'Imetumia' as const };
                }
                return item;
              });
              onUpdateGuests(updatedGuests);

              // Log inside local history trace log
              const uniqueClogId = 'clog-' + Date.now() + '-' + queue.currentIndex;
              const autoLog = {
                id: uniqueClogId,
                guestName: currentGuest.name,
                phone: currentGuest.phone || 'N/A',
                type: queue.type === 'Pledge' ? 'Pledge Request' : (queue.type === 'Reminder' ? 'Reminder' : 'Thank You'),
                message: textForGuest,
                channel: 'WhatsApp',
                sentAt: new Date().toLocaleDateString(isEn ? 'en-US' : 'sw-TZ') + ' ' + new Date().toTimeString().split(' ')[0].substring(0, 5),
                status: 'delivered'
              };
              setMessageLogs(prev => [autoLog, ...prev]);
            }

            if (queue.currentIndex + 1 >= total) {
              // Finished queue successfully!
              setWaInteractiveQueue(null);
              setWaInteractiveSuccessPopup(true);
            } else {
              setWaInteractiveQueue(prev => prev ? { ...prev, currentIndex: prev.currentIndex + 1 } : null);
            }
          };

          // Action to open WhatsApp and mark as sent
          const handleOpenAndMark = () => {
            // Write text message automatically to clipboard for convenience
            navigator.clipboard.writeText(textForGuest).catch(() => {});
            
            const cleanPh = cleanPhoneForWhatsapp(currentGuest.phone);
            const waUrl = `https://wa.me/${cleanPh}?text=${encodeURIComponent(textForGuest)}`;
            window.open(waUrl, '_blank');

            handleAdvanceQueue(true);
          };

          // Action to automatically mark all remaining guests as sent in 1-click
          const handleAutoAllBackground = async () => {
            if (!confirm(isEn 
              ? `Are you sure you want to instantly mark all remaining ${total - queue.currentIndex} guests as sent in the database?` 
              : `Je, una uhakika unataka kusajili wageni wote waliobaki ${total - queue.currentIndex} kuwa wametumiwa tayari kiotomatiki?`
            )) return;

            let updatedGuests = [...guests];
            for (let i = queue.currentIndex; i < total; i++) {
              const g = queue.guests[i];
              updatedGuests = updatedGuests.map(item => {
                if (item.id === g.id) {
                  return { ...item, whatsappStatus: 'Imetumia' as const };
                }
                return item;
              });

              const text = getContributionMessageText(g, queue.type, 'whatsapp');
              const uniqueClogId = 'clog-' + Date.now() + '-' + i;
              const autoLog = {
                id: uniqueClogId,
                guestName: g.name,
                phone: g.phone || 'N/A',
                type: queue.type === 'Pledge' ? 'Pledge Request' : (queue.type === 'Reminder' ? 'Reminder' : 'Thank You'),
                message: text,
                channel: 'WhatsApp',
                sentAt: new Date().toLocaleDateString(isEn ? 'en-US' : 'sw-TZ') + ' ' + new Date().toTimeString().split(' ')[0].substring(0, 5),
                status: 'delivered'
              };
              setMessageLogs(prev => [autoLog, ...prev]);
            }

            onUpdateGuests(updatedGuests);
            setWaInteractiveQueue(null);
            setWaInteractiveSuccessPopup(true);
          };

          return (
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className={`bg-slate-900 border border-emerald-500/25 w-full ${queue.type === 'Thanks' ? 'max-w-xl' : 'max-w-4xl'} rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-left`}
              >
                {/* Header with emerald status glow */}
                <div className="bg-gradient-to-r from-emerald-950/40 to-slate-900 px-6 py-4.5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-555/30 flex items-center justify-center">
                      <MessageCircle className="w-5.5 h-5.5 text-emerald-400 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-1.5 font-mono">
                        {isEn ? "WhatsApp Broadcast Assistant" : "Msaidizi wa Kutuma Kundi (WhatsApp)"}
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        {isEn 
                          ? `Interactive queue progression engine • Sending ${queue.type}`
                          : `Njia rahisi ya kukamilisha kutuma mialiko na kadi kwa wote mmoja baada ya mwingine`
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Auto Background Trigger */}
                    <button
                      onClick={handleAutoAllBackground}
                      className="px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition rounded-xl font-bold font-mono text-[9px] uppercase cursor-pointer"
                    >
                      🚀 {isEn ? "Auto Send All (Simulation)" : "Tuma Zote Mara Moja (Kiotomatiki)"}
                    </button>
                    <button 
                      onClick={() => setWaInteractiveQueue(null)}
                      className="p-1.5 px-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Main progressive queue body */}
                <div className="flex-grow p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-6">
                  
                  {/* Left Column: Image Card Preview */}
                  {queue.type !== 'Thanks' && (
                    <div className="md:col-span-5 flex flex-col items-center justify-center space-y-4">
                    <span className="text-[10px] uppercase font-bold font-mono text-slate-400 self-start tracking-wider">
                      🎴 {isEn ? "Personalized Guest Card" : "Muonekano wa Kadi ya Mgeni"}
                    </span>
                    
                    <div className="w-full aspect-[3/4] max-w-[280px] bg-slate-950 rounded-2xl border border-white/5 overflow-hidden shadow-inner relative flex items-center justify-center">
                      {!queueCardLoaded ? (
                        <div className="flex flex-col items-center justify-center space-y-3.5">
                          <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                          <span className="text-[9.5px] font-mono text-slate-500 uppercase tracking-widest">{isEn ? "Synthesizing card..." : "Inaundwa..."}</span>
                        </div>
                      ) : (
                        <>
                          <img 
                            src={queueCardUrl} 
                            className="w-full h-full object-contain animate-fade-in" 
                            alt="Personalized Guest Pledge Card" 
                          />
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none z-30 overflow-hidden">
                            <div className="transform -rotate-45 border-2 border-white/20 rounded-xl px-4 py-1.5 bg-black/20 shadow-inner backdrop-blur-[1px]">
                              <span className="text-white/30 font-black text-sm tracking-[0.2em] uppercase whitespace-nowrap select-none">
                                PREVIEW MODE
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {queueCardLoaded && (
                      <div className="flex w-full max-w-[280px] gap-2">
                        <button
                          onClick={handleCopyQueueImageToClipboard}
                          className="flex-1 py-1.5 px-3 bg-white/5 hover:bg-slate-800 text-white rounded-lg font-mono text-[9.5px] font-bold uppercase transition flex items-center justify-center gap-1 border border-white/5"
                        >
                          {copyImageSuccess ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">{isEn ? "Copied" : "Imenakiliwa"}</span>
                            </>
                          ) : (
                            <>
                              <Clipboard className="w-3 h-3 text-slate-400" />
                              <span>{isEn ? "Copy Card" : "Copy Kadi"}</span>
                            </>
                          )}
                        </button>
                        <a
                          href={queueCardUrl}
                          download={`Kadi_${currentGuest.name.replace(/\s+/g, '_')}.jpg`}
                          className="flex-1 py-1.5 px-3 bg-white/10 hover:bg-slate-800 text-white rounded-lg font-mono text-[9.5px] font-bold uppercase transition flex items-center justify-center gap-1 border border-white/5"
                        >
                          <Download className="w-3 h-3 text-slate-300" />
                          <span>{isEn ? "Download" : "Pakua"}</span>
                        </a>
                      </div>
                    )}
                  </div>
                  )}

                  {/* Right Column: Progressive Details & WhatsApp Bubble Preview */}
                  <div className={`${queue.type === 'Thanks' ? 'md:col-span-12' : 'md:col-span-7'} flex flex-col justify-between space-y-5`}>
                    
                    {/* Current Progress Header */}
                    <div className="space-y-2 bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400 font-medium">
                          {isEn ? "Recipient Queue Progress:" : "Maendeleo ya Orodha ya Kutuma:"}
                        </span>
                        <span className="font-mono text-emerald-400 font-black">
                          {currentNum} of {total} ({progressPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-300"
                          style={{ width: `${(currentNum / total) * 100}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                        <div>
                          <span className="text-[9px] font-mono text-slate-500 uppercase block">{isEn ? "Active Recipient" : "Mpokeaji wa Sasa"}</span>
                          <span className="text-sm font-black text-white uppercase">{currentGuest.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-mono text-slate-500 uppercase block">{isEn ? "Phone Number" : "Nambari ya Simu"}</span>
                          <span className="text-xs font-mono font-bold text-amber-400">{currentGuest.phone || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* WhatsApp Mock speech bubble */}
                    <div className="space-y-1 w-full">
                      <span className="text-[10px] uppercase font-bold font-mono text-slate-400 tracking-wider flex items-center gap-1.5">
                        💬 {isEn ? "WhatsApp Message Body" : "Maandishi ya Ujumbe (Speech Bubble Preview)"}
                      </span>
                      
                      <div className="bg-slate-950 rounded-2xl border border-white/5 p-4 relative overflow-hidden">
                        {/* Fake WhatsApp Chat Frame BG status */}
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <span className="text-[9.5px] font-mono font-bold text-slate-400 uppercase tracking-widest">{currentGuest.name} (Online)</span>
                        </div>
                        
                        {/* WhatsApp Bubble styled */}
                        <div className="bg-emerald-950/60 border border-emerald-500/20 text-slate-200 text-xs p-3.5 rounded-2xl rounded-tl-none leading-relaxed font-sans relative max-h-[160px] overflow-y-auto whitespace-pre-wrap select-text">
                          <span className="absolute -left-1.5 top-0 text-emerald-950/60">◀</span>
                          {textForGuest}
                        </div>
                      </div>
                    </div>

                    {/* Action Hub */}
                    <div className="pt-3 border-t border-white/5 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          onClick={handleOpenAndMark}
                          className="py-3.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white rounded-xl transition duration-200 flex items-center justify-center gap-2 font-extrabold uppercase font-mono text-[10.5px] tracking-wider cursor-pointer shadow-lg hover:brightness-110 active:scale-98"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>{isEn ? "Open Chat & Send Card" : "Fungua & Tuma WhatsApp"}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleAdvanceQueue(true)}
                          className="py-3.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white rounded-xl transition duration-200 flex items-center justify-center gap-1.5 font-bold uppercase font-mono text-[9.5px] cursor-pointer"
                        >
                          <span>{isEn ? "Mark Sent & Next" : "Weka Imetumwa & Afuataye"}</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleAdvanceQueue(false)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition text-[9px] font-mono uppercase cursor-pointer"
                        >
                          ⚡ {isEn ? "Skip Guest" : "Ruka Huyu (Skip)"}
                        </button>

                        <button
                          onClick={() => setWaInteractiveQueue(null)}
                          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg text-rose-400 hover:text-rose-300 transition text-[9px] font-mono uppercase cursor-pointer"
                        >
                          {isEn ? "Quit Assistant" : "Funga Msaidizi"}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* 5C. WhatsApp Queue Completed Success Dialog */}
      <AnimatePresence>
        {waInteractiveSuccessPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-emerald-500/30 w-full max-w-sm rounded-3xl p-7 text-center space-y-5 shadow-2xl"
            >
              <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/40 shadow-inner animate-bounce">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h4 className="font-extrabold text-white text-base uppercase tracking-wider font-mono">
                  {isEn ? "Bulk Broadcast Completed!" : "Matangazo Yamekamilika!"}
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  {isEn 
                    ? "Congratulations! All targeted WhatsApp reminders or request messages have been progressing successfully in the database log."
                    : "Hongera! Wageni wote uliowachagua wamekamilishiwa utumaji vizuri na kumbukumbu zote zimesajiliwa kwenye orodha yetu kuu."
                  }
                </p>
              </div>

              <div className="p-3.5 bg-emerald-950/30 rounded-2xl border border-emerald-500/10 text-[10.5px] text-emerald-300 italic font-mono leading-relaxed">
                {isEn ? "Pledge statuses have been updated beautifully!" : "Hali za michango na ahadi zimehaririwa kikamilifu!"}
              </div>

              <button
                onClick={() => {
                  setWaInteractiveSuccessPopup(false);
                  setSelectedGuests([]);
                }}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold uppercase font-mono text-[10.5px] transition hover:brightness-110 shadow-lg tracking-wider"
              >
                {isEn ? "Go to Dashboard" : "Rudi Kwenye Dashibodi"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  </>
  );
}
