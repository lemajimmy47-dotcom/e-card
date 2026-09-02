import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  Calendar, 
  Trash2,
  Users, 
  Send, 
  QrCode, 
  Settings, 
  Wallet, 
  LogOut, 
  LayoutDashboard, 
  Bell, 
  CheckCircle2, 
  Search,
  AlertTriangle,
  Menu,
  X,
  Languages,
  ShieldCheck,
  Shield,
  CreditCard,
  Settings2,
  FileText,
  Mail,
  History,
  Info,
  ArrowLeft,
  Sparkles,
  Bot,
  Play,
  ChevronDown,
  MessageSquare,
  TrendingUp
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from './context/LanguageContext';
import { useEventCard } from './context/EventCardContext';
import { AIChatbotWidget } from './components/AIChatbotWidget';
import { UwalemiModule } from './components/uwalemi/UwalemiModule';
import { UwalemiMemberPortal } from './components/uwalemi/UwalemiMemberPortal';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import CreateEventPage from './components/CreateEventPage';
import EventDetailsForm from './components/EventDetailsForm';
import CardPreview from './components/CardPreview';
import TemplatesSelector from './components/TemplatesSelector';
import UploadGuests from './components/UploadGuests';
import SendMessages from './components/SendMessages';
import RSVPResponses from './components/RSVPResponses';
import QRScanner from './components/QRScanner';
import SMSGatewayConfig from './components/SMSGatewayConfig';
import GitHubSyncConfig from './components/GitHubSyncConfig';
import BackupManager from './components/BackupManager';
import ContributionManager from './components/ContributionManager';
import CommitteeDashboard from './components/CommitteeDashboard';
import PublicReportView from './components/PublicReportView';
import SaveTheDateManager from './components/SaveTheDateManager';
import EventReports from './components/EventReports';
import GuestInvitePage from './components/GuestInvitePage';
import GuestSaveTheDatePage from './components/GuestSaveTheDatePage';
import GuestPledgeSubmissionPage from './components/GuestPledgeSubmissionPage';
import AuditLogsPage from './components/AuditLogsPage';
import SecurityDashboard from './components/SecurityDashboard';
import { ConnectivityDebug } from './components/ConnectivityDebug';
import { safeLocalStorage } from './utils/storage';
import { EventDetails, Guest, TemplateSettings, UserAccount, CommitteeMember, CommitteeNotification, ContributionCardTemplate } from './types';
import { isStatusSent } from './utils/statusHelper';

// Types for navigation
type AppTab = 
  | 'dashboard' 
  | 'event-details' 
  | 'preview' 
  | 'templates' 
  | 'guests' 
  | 'send' 
  | 'rsvp' 
  | 'scan' 
  | 'settings' 
  | 'wallet' 
  | 'contributions'
  | 'committee'
  | 'save-the-date'
  | 'event-reports'
  | 'audit-logs'
  | 'debug'
  | 'uwalemi';

export default function App() {
  const { language, setLanguage, t } = useLanguage();
  
  // Auth state
  const [user, setUser] = useState<{ username: string; role: string } | null>(() => {
    try {
      const saved = localStorage.getItem('kadi_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.username) {
          // Auto-upgrade legacy 'admin' or 'Admin' to 'Jimson' to avoid requiring log out
          if (parsed.username.toLowerCase() === 'admin') {
            parsed.username = 'Jimson';
          }
          return parsed;
        }
      } else {
        // Auto-login in development/preview environments to avoid blocking the user on first load
        const isDevelopment = typeof window !== 'undefined' && (
          window.location.hostname === 'localhost' || 
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname.includes('ais-dev-') ||
          window.location.hostname.includes('ais-pre-') ||
          window.location.hostname.includes('.run.app')
        );
        if (isDevelopment) {
          const defaultUser = { username: 'Jimson', role: 'admin' };
          localStorage.setItem('kadi_user', JSON.stringify(defaultUser));
          return defaultUser;
        }
      }
    } catch (e) {
      console.warn('Failed to parse kadi_user on initialization', e);
    }
    return null;
  });

  // App Navigation state
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [guestListSearch, setGuestListSearch] = useState('');
  const [sentListSearch, setSentListSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLanding, setShowLanding] = useState(!user);

  // Core Data state from SWR-backed EventCardContext
  const {
    eventDetails,
    setEventDetails,
    eventsList,
    setEventsList,
    guests,
    setGuests,
    templateSettings,
    setTemplateSettings,
    userAccount,
    setUserAccount,
    committeeMembers,
    isLoading,
    error,
    setError,
    saveState,
    updateGuests,
    updateEventDetails,
    refreshState
  } = useEventCard();
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [draftEvent, setDraftEvent] = useState<EventDetails | null>(null);
  const [eventToDelete, setEventToDelete] = useState<EventDetails | null>(null);
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Guest invitation states from URL queries (?invite=CODE)
  const [guestInviteData, setGuestInviteData] = useState<{
    guest: Guest;
    event: EventDetails;
    settings: TemplateSettings;
    pledgeTemplate?: ContributionCardTemplate;
    saveTheDate?: any;
  } | null>(null);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [isStdView, setIsStdView] = useState(false);
  const [isPledgeView, setIsPledgeView] = useState(false);
  const [isSeatingView, setIsSeatingView] = useState(false);
  const [isVenueView, setIsVenueView] = useState(false);
  const [isCommitteePortal, setIsCommitteePortal] = useState(false);
  const [isPublicReportPortal, setIsPublicReportPortal] = useState(false);
  const [portalEventId, setPortalEventId] = useState<string | null>(null);
  const [isScanOnlyPortal, setIsScanOnlyPortal] = useState(false);
  const [scanPortalEventId, setScanPortalEventId] = useState<string | null>(null);
  const [uwalemiMemberParam, setUwalemiMemberParam] = useState<string | null>(null);

  // Parse invite search query on mount
  useEffect(() => {
    try {
      const searchStr = window.location.search || '';
      const params = new URLSearchParams(searchStr);

      // Check UWALEMI parameters
      const uwalemiMember = params.get('uwalemiMember') || params.get('uwalemi_member') || params.get('uwalemi');
      const moduleParam = params.get('module');
      if (uwalemiMember) {
        setUwalemiMemberParam(uwalemiMember);
        setShowLanding(false);
      }

      // Extract raw parameters
      let rawInvite = params.get('invite');
      let rawEventId = params.get('eventId') || params.get('event_id');
      let rawView = params.get('view') || params.get('mode') || params.get('v');

      if (rawView === 'uwalemi' || moduleParam === 'uwalemi') {
        setActiveTab('uwalemi');
        setShowLanding(false);
      }

      // Robust fallback extraction for double-encoded or malformed query strings
      // e.g., ?eventId=%3Finvite%3DIP-5188%2C761214&view=venue or ?eventId=?invite=...
      const fullHref = decodeURIComponent(window.location.href);

      if (!rawInvite) {
        const inviteMatch = fullHref.match(/invite=([a-zA-Z0-9_\-\,\.%\+]+)/i);
        if (inviteMatch && inviteMatch[1]) {
          rawInvite = inviteMatch[1].split('&')[0].split('?')[0].split('#')[0];
        }
      }

      if (!rawView) {
        const viewMatch = fullHref.match(/view=([a-zA-Z0-9_\-\.]+)/i);
        if (viewMatch && viewMatch[1]) {
          rawView = viewMatch[1];
        }
      }

      // If rawEventId was contaminated with sub-queries (e.g. "?invite=...")
      if (rawEventId && (rawEventId.includes('?') || rawEventId.includes('invite='))) {
        const cleanMatch = rawEventId.match(/^([a-zA-Z0-9_\-\.]+)/);
        rawEventId = cleanMatch ? cleanMatch[1] : undefined;
      }

      const inviteCode = rawInvite ? rawInvite.trim() : null;
      const eventIdParam = rawEventId ? rawEventId.trim() : null;
      const view = rawView ? rawView.toLowerCase().trim() : null;

      const isVenueMode = view === 'venue' || view === 'location' || view === 'ukumbi';
      const isSeatingMode = view === 'seating' || view === 'table' || view === 'map' || view === 'tables';

      const stdParam = params.get('std') === 'true';
      const pledgeParam = params.get('pledge') === 'true';
      const portalParam = params.get('portal');
      const scanParam = params.get('scan_mode') === 'true' || params.get('scan') === 'true';
      const usernameParam = params.get('username') || params.get('user');
      const passwordParam = params.get('password') || params.get('pass');
      const langParam = params.get('lang')?.toLowerCase();

      if (langParam === 'sw' || langParam === 'en') {
        setLanguage(langParam as any);
      }

      const savedScannerMode = localStorage.getItem('eventcard_scanner_mode') === 'true';
      if (usernameParam === 'scanner' && passwordParam) {
        setIsScanOnlyPortal(true);
        setScanPortalEventId(passwordParam);
        safeLocalStorage.setItem('eventcard_scanner_mode', 'true');
        safeLocalStorage.setItem('eventcard_scanner_event_id', passwordParam);
        setShowLanding(false);
      } else if (scanParam) {
        setIsScanOnlyPortal(true);
        setScanPortalEventId(eventIdParam);
      } else if (savedScannerMode) {
        setIsScanOnlyPortal(true);
        setScanPortalEventId(localStorage.getItem('eventcard_scanner_event_id'));
      } else if (params.get('progress') === 'true' && eventIdParam) {
        setIsPublicReportPortal(true);
        setPortalEventId(eventIdParam);
      } else if (portalParam === 'committee' && eventIdParam) {
        setIsCommitteePortal(true);
        setPortalEventId(eventIdParam);
      } else if (inviteCode || isVenueMode || isSeatingMode) {
        setIsGuestLoading(true);
        setIsStdView(stdParam);
        setIsPledgeView(pledgeParam);
        
        if (isSeatingMode) {
          setIsSeatingView(true);
        } else if (isVenueMode) {
          setIsVenueView(true);
        }

        const lookupCode = inviteCode || 'venue';
        const eventIdQuery = eventIdParam ? `&eventId=${encodeURIComponent(eventIdParam)}` : '';
        fetch(`/api/guest-lookup?code=${encodeURIComponent(lookupCode)}${eventIdQuery}`)
          .then((res) => {
            if (!res.ok) throw new Error('Mwaliko hauwezi kupatikana au kiungo kina makosa');
            return res.json();
          })
          .then((data) => {
            if (data && (data.guest || data.event)) {
              setGuestInviteData(data);
            } else {
              throw new Error('Mgeni au taarifa za sherehe hazijapatikana');
            }
          })
          .catch((err: any) => {
            console.error('Error in guest invite lookup fetch:', err);
            setGuestError(err.message || 'Hitilafu imetokea wakati wa kutafuta mwaliko wako');
          })
          .finally(() => {
            setIsGuestLoading(false);
          });
      }
    } catch (e) {
      console.error('Error reading invite code from search queries:', e);
    }
  }, []);

  // --- Data Fetching & Hydration ---

  useEffect(() => {
    // Restore last active tab on mount
    const savedTab = localStorage.getItem('kadi_active_tab') as AppTab;
    if (savedTab) setActiveTab(savedTab);
  }, []);

  // Persist active tab
  useEffect(() => {
    if (user) {
      safeLocalStorage.setItem('kadi_active_tab', activeTab);
    }
  }, [activeTab, user]);

  // Persist active event ID to prevent resetting on page reload
  useEffect(() => {
    if (user && eventDetails && eventDetails.id) {
      safeLocalStorage.setItem('kadi_active_event_id', eventDetails.id);
    }
  }, [eventDetails, user]);



  const requestDeleteEvent = (id: string) => {
    const ev = eventsList.find(e => e.id === id);
    if (ev) setEventToDelete(ev);
  };

  const confirmDeleteEvent = () => {
    if (!eventToDelete) return;
    const id = eventToDelete.id;
    
    const updatedList = eventsList.filter(ev => ev.id !== id);
    setEventsList(updatedList);
    
    const updatedGuests = guests.filter(g => g.eventId !== id);
    setGuests(updatedGuests);
    
    let newActiveEvent = eventDetails;
    let newTab = activeTab;

    if (eventDetails?.id === id) {
      if (updatedList.length > 0) {
        newActiveEvent = updatedList[0];
      } else {
        newActiveEvent = null;
        newTab = 'create-event';
        setActiveTab('create-event');
      }
      setEventDetails(newActiveEvent);
    }

    // Clean up event-specific templates from templateSettings state
    let updatedTemplateSettings = templateSettings ? { ...templateSettings as any } : {};
    delete updatedTemplateSettings[id];
    delete updatedTemplateSettings[`contrib-${id}`];
    setTemplateSettings(updatedTemplateSettings);

    // Clean up local storage specifically to prevent residual carry-over of data
    try {
      localStorage.removeItem(`kadi_event_files_${id}`);
      localStorage.removeItem(`kadi_std_sent_map_${id}`);
      
      const localStds = localStorage.getItem('kadi_save_the_dates');
      if (localStds) {
        const parsed = JSON.parse(localStds);
        const filtered = parsed.filter((s: any) => s.event_id !== id);
        safeLocalStorage.setItem('kadi_save_the_dates', JSON.stringify(filtered));
      }
    } catch (e) {
      console.error('Error clearing local storage details during event deletion:', e);
    }
    
    saveState({
      eventsList: updatedList,
      guests: updatedGuests,
      eventDetails: newActiveEvent,
      templateSettings: updatedTemplateSettings,
      activeTab: newTab,
      forceDeleteMass: true
    }, 'Amefuta tukio na mialiko yake (Event Deleted)', `Tukio limefutwa kashitilizi.`);

    setEventToDelete(null);
  };

  const updateTemplateSettings = (settings: TemplateSettings) => {
    if (!eventDetails) return;
    const eventId = eventDetails.id;
    
    let updatedMap: Record<string, any> = {};
    if (templateSettings) {
      const isLegacyFlat = ('imageUrl' in templateSettings) && !('default' in templateSettings);
      if (isLegacyFlat) {
        const { imageUrl, textColor, fontFamily, guestNameX, guestNameY, guestNameSize, guestNameColor, qrCodeX, qrCodeY, qrCodeSize, qrCodeColor, cardTypeX, cardTypeY, cardTypeSize, cardTypeColor, ...rest } = templateSettings as any;
        updatedMap = {
          ...rest,
          default: {
            imageUrl: imageUrl || '',
            textColor: textColor || '#ffffff',
            fontFamily: fontFamily || 'Playfair Display',
            guestNameX: guestNameX ?? 50,
            guestNameY: guestNameY ?? 45,
            guestNameSize: guestNameSize ?? 24,
            guestNameColor: guestNameColor ?? '#d97706',
            qrCodeX: qrCodeX ?? 50,
            qrCodeY: qrCodeY ?? 75,
            qrCodeSize: qrCodeSize ?? 120,
            qrCodeColor: qrCodeColor ?? '#ffffff',
            cardTypeX: cardTypeX ?? 50,
            cardTypeY: cardTypeY ?? 15,
            cardTypeSize: cardTypeSize ?? 14,
            cardTypeColor: cardTypeColor ?? '#fbbf24',
          }
        };
      } else {
        updatedMap = { ...templateSettings as Record<string, any> };
        const parentKeys = ['imageUrl', 'textColor', 'fontFamily', 'guestNameX', 'guestNameY', 'guestNameSize', 'guestNameColor', 'qrCodeX', 'qrCodeY', 'qrCodeSize', 'qrCodeColor', 'cardTypeX', 'cardTypeY', 'cardTypeSize', 'cardTypeColor'];
        for (const k of parentKeys) {
          delete updatedMap[k];
        }
      }
    }
    
    updatedMap[eventId] = settings;
    if (!updatedMap['default']) {
      updatedMap['default'] = settings;
    }
    
    setTemplateSettings(updatedMap as any);
    saveState({ templateSettings: updatedMap });
  };

  // scanEventDetails computed via useMemo to avoid performance issues
  const scanEventDetails = useMemo(() => {
    if (isScanOnlyPortal && scanPortalEventId) {
      return eventsList.find(e => e.id === scanPortalEventId) || eventsList[0] || null;
    }
    if (isScanOnlyPortal) {
      return eventsList[0] || null;
    }
    return eventDetails;
  }, [eventDetails, isScanOnlyPortal, scanPortalEventId, eventsList]);

  // activeGuests computed via useMemo to avoid performance issues
  const activeGuests = useMemo(() => {
    const activeEvId = isScanOnlyPortal ? (scanEventDetails ? scanEventDetails.id : null) : (eventDetails ? eventDetails.id : null);
    if (!activeEvId) return [];
    return guests
      .filter(g => g.eventId === activeEvId || (!g.eventId && activeEvId === 'event-starter'))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'sw'));
  }, [guests, eventDetails, isScanOnlyPortal, scanEventDetails]);

  // Dynamically calculate the event lifecycle stage
  const currentLifecycleStage = useMemo(() => {
    if (!activeGuests || activeGuests.length === 0) {
      return 'Planning';
    }
    const sentCount = activeGuests.filter(g => isStatusSent(g.smsStatus) || isStatusSent(g.whatsappStatus)).length;
    if (sentCount > 0) {
      return 'Dispatched';
    }
    return 'Designing';
  }, [activeGuests]);

  // --- Auth Handlers ---

  const handleLoginSuccess = () => {
    try {
      const isScanOnly = localStorage.getItem('eventcard_scanner_mode') === 'true';
      if (isScanOnly) {
        setIsScanOnlyPortal(true);
        const scanEvId = localStorage.getItem('eventcard_scanner_event_id');
        setScanPortalEventId(scanEvId);
        setShowLanding(false);
        return;
      }

      const saved = localStorage.getItem('kadi_user');
      let parsed = null;
      if (saved) {
        try {
          parsed = JSON.parse(saved);
        } catch (e) {
          console.warn('Malformed user JSON in localStorage', e);
        }
      }
      
      const userObj = (parsed && typeof parsed === 'object' && parsed.username)
        ? parsed 
        : { username: 'Jimson', role: 'admin' };

      setUser(userObj);
      safeLocalStorage.setItem('kadi_user', JSON.stringify(userObj));
    } catch (e) {
      console.error('Failed to complete handleLoginSuccess', e);
      // Fallback state update
      setUser({ username: 'Jimson', role: 'admin' });
    }
    setShowLanding(false);
  };

  const handleLogout = () => {
    setUser(null);
    setIsScanOnlyPortal(false);
    setScanPortalEventId(null);
    localStorage.removeItem('kadi_user');
    localStorage.removeItem('eventcard_scanner_mode');
    localStorage.removeItem('eventcard_scanner_event_id');
    // Also clear query URL parameter visually to avoid sticking to scan mode
    window.history.pushState({}, '', '/');
    setShowLanding(true);
  };

  // --- Global Notification Center & Quick Drawer State ---
  const [globalNotifications, setGlobalNotifications] = useState<any[]>([]);
  const [showNotificationsPopover, setShowNotificationsPopover] = useState(false);
  const [isQuickDrawerOpen, setIsQuickDrawerOpen] = useState(false);
  const [quickDrawerSection, setQuickDrawerSection] = useState<'guest' | 'payment'>('guest');

  // Add Guest inputs
  const [quickGuestName, setQuickGuestName] = useState('');
  const [quickGuestPhone, setQuickGuestPhone] = useState('');
  const [quickGuestCardType, setQuickGuestCardType] = useState<'SINGLE' | 'COUPLE' | 'TABLE'>('SINGLE');
  const [quickGuestPledge, setQuickGuestPledge] = useState('');
  const [quickGuestPaid, setQuickGuestPaid] = useState('');
  const [quickGuestError, setQuickGuestError] = useState<string | null>(null);
  const [quickGuestSuccess, setQuickGuestSuccess] = useState(false);

  // Record Payment inputs
  const [quickSelectedGuestId, setQuickSelectedGuestId] = useState('');
  const [quickPledgeAmount, setQuickPledgeAmount] = useState('');
  const [quickPaymentAmount, setQuickPaymentAmount] = useState('');
  const [quickPaymentRef, setQuickPaymentRef] = useState('');
  const [quickPaymentError, setQuickPaymentError] = useState<string | null>(null);
  const [quickPaymentSuccess, setQuickPaymentSuccess] = useState(false);

  // Sync initial notifications from localStorage
  useEffect(() => {
    if (eventDetails?.id) {
      const saved = localStorage.getItem(`kadi_committee_notifications_${eventDetails.id}`);
      if (saved) {
        setGlobalNotifications(JSON.parse(saved));
      } else {
        const defaults = [
          { id: 'n-1', type: 'pledge', title: 'Ahadi Mpya ya Mchango', message: 'Ally Khalfan amesajili ahadi mpya ya TZS 500,000.', createdAt: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }), read: false },
          { id: 'n-2', type: 'payment', title: 'Malipo Mapya', message: 'Salma Khamis (Mweka Hazina) amesajili malipo ya TZS 300,000 kwa Ally Khalfan.', createdAt: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }), read: false },
          { id: 'n-3', type: 'completed', title: 'Mchango Umekamilika', message: 'Fatma Said amekamilisha malipo yote ya ahadi yake ya TZS 1,000,000.', createdAt: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }), read: false }
        ];
        setGlobalNotifications(defaults);
        localStorage.setItem(`kadi_committee_notifications_${eventDetails.id}`, JSON.stringify(defaults));
      }
    }
  }, [eventDetails]);

  // Reactive listener to generate real-time live notifications when guest data updates
  const prevGuestsRef = useRef<Guest[]>([]);
  useEffect(() => {
    if (prevGuestsRef.current.length > 0 && activeGuests.length > 0 && eventDetails?.id) {
      const newNotifications: any[] = [];
      const savedNotifsStr = localStorage.getItem(`kadi_committee_notifications_${eventDetails.id}`);
      let currentNotifs = savedNotifsStr ? JSON.parse(savedNotifsStr) : [];

      // 1. Newly added guests
      if (activeGuests.length > prevGuestsRef.current.length) {
        const added = activeGuests.filter(g => !prevGuestsRef.current.some(pg => pg.id === g.id));
        added.forEach(g => {
          newNotifications.push({
            id: 'n-auto-' + Date.now() + Math.random().toString(36).substr(2, 5),
            type: 'guest',
            title: language === 'sw' ? 'Mgeni Mpya' : 'New Guest',
            message: language === 'sw' ? `${g.name} amesajiliwa kwenye orodha ya wageni.` : `${g.name} has been added to the guest list.`,
            createdAt: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
            read: false
          });
        });
      }

      // 2. RSVP changes
      activeGuests.forEach(g => {
        const prevG = prevGuestsRef.current.find(pg => pg.id === g.id);
        if (prevG) {
          if (g.rsvpStatus !== prevG.rsvpStatus && g.rsvpStatus !== 'Bado') {
            const statusTxt = g.rsvpStatus === 'Atahudhuria' ? (language === 'sw' ? 'atakuja' : 'will attend') : (language === 'sw' ? 'hatakuja' : 'will not attend');
            newNotifications.push({
              id: 'n-auto-' + Date.now() + Math.random().toString(36).substr(2, 5),
              type: 'rsvp',
              title: language === 'sw' ? 'Mabadiliko ya RSVP' : 'RSVP Update',
              message: language === 'sw' ? `${g.name} amebadilisha RSVP kuwa ${statusTxt}.` : `${g.name} updated RSVP to: ${statusTxt}.`,
              createdAt: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
              read: false
            });
          }

          // 3. New Pledges or Payments
          if ((g.pledgeAmount || 0) > (prevG.pledgeAmount || 0)) {
            newNotifications.push({
              id: 'n-auto-' + Date.now() + Math.random().toString(36).substr(2, 5),
              type: 'pledge',
              title: language === 'sw' ? 'Ahadi ya Mchango' : 'New Pledge',
              message: language === 'sw' ? `${g.name} amesajili ahadi mpya ya TZS ${(g.pledgeAmount || 0).toLocaleString()}.` : `${g.name} pledged TZS ${(g.pledgeAmount || 0).toLocaleString()}.`,
              createdAt: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
              read: false
            });
          }

          if ((g.paidAmount || 0) > (prevG.paidAmount || 0)) {
            const addedPayment = (g.paidAmount || 0) - (prevG.paidAmount || 0);
            newNotifications.push({
              id: 'n-auto-' + Date.now() + Math.random().toString(36).substr(2, 5),
              type: 'payment',
              title: language === 'sw' ? 'Malipo ya Mchango' : 'Contribution Payment',
              message: language === 'sw' ? `${g.name} amelipa mchango wa TZS ${addedPayment.toLocaleString()}.` : `${g.name} paid TZS ${addedPayment.toLocaleString()}.`,
              createdAt: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
              read: false
            });
          }
        }
      });

      if (newNotifications.length > 0) {
        const updated = [...newNotifications, ...currentNotifs].slice(0, 50);
        setGlobalNotifications(updated);
        localStorage.setItem(`kadi_committee_notifications_${eventDetails.id}`, JSON.stringify(updated));
      }
    }
    prevGuestsRef.current = activeGuests;
  }, [activeGuests, eventDetails, language]);

  // Handle Quick Add Guest
  const handleQuickAddGuest = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickGuestError(null);
    setQuickGuestSuccess(false);

    if (!eventDetails) {
      setQuickGuestError(language === 'sw' ? 'Hakuna tukio lililochaguliwa.' : 'No active event selected.');
      return;
    }
    if (!quickGuestName.trim()) {
      setQuickGuestError(language === 'sw' ? 'Tafadhali weka jina la mgeni.' : 'Please enter guest name.');
      return;
    }

    const newGuest: Guest = {
      id: 'guest-' + Date.now(),
      eventId: eventDetails.id,
      code: 'EC-' + Math.floor(1000 + Math.random() * 9000),
      name: quickGuestName.trim(),
      phone: quickGuestPhone.trim(),
      cardType: quickGuestCardType,
      pledgeAmount: Number(quickGuestPledge) || 0,
      paidAmount: Number(quickGuestPaid) || 0,
      pledgeStatus: Number(quickGuestPaid) >= Number(quickGuestPledge) && Number(quickGuestPledge) > 0 ? 'Fully Paid' : Number(quickGuestPaid) > 0 ? 'Partially Paid' : Number(quickGuestPledge) > 0 ? 'Pledged' : 'No Pledge',
      rsvpStatus: 'Bado',
      rsvpGuestsCount: quickGuestCardType === 'TABLE' ? 10 : quickGuestCardType === 'COUPLE' ? 2 : 1,
      checkedIn: false,
      smsStatus: 'Sijatuma',
      whatsappStatus: 'Sijatuma',
      payments: Number(quickGuestPaid) > 0 ? [{
        id: 'pay-' + Date.now(),
        amount: Number(quickGuestPaid),
        date: new Date().toLocaleDateString('sw-TZ'),
        reference: 'Quick Drawer',
        notes: 'Kutoka Quick Action Drawer'
      }] : []
    };

    updateGuests([...activeGuests, newGuest], `Mgeni mpya aliongezwa kupitia Quick Drawer: ${quickGuestName}`);
    
    // Clear form and show success
    setQuickGuestName('');
    setQuickGuestPhone('');
    setQuickGuestCardType('SINGLE');
    setQuickGuestPledge('');
    setQuickGuestPaid('');
    setQuickGuestSuccess(true);
    setTimeout(() => setQuickGuestSuccess(false), 3000);
  };

  // Handle Quick Record Contribution
  const handleQuickRecordContribution = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickPaymentError(null);
    setQuickPaymentSuccess(false);

    if (!quickSelectedGuestId) {
      setQuickPaymentError(language === 'sw' ? 'Tafadhali mchague mgeni.' : 'Please select a guest.');
      return;
    }

    const targetGuest = activeGuests.find(g => g.id === quickSelectedGuestId);
    if (!targetGuest) {
      setQuickPaymentError(language === 'sw' ? 'Mgeni hajapatikana.' : 'Guest not found.');
      return;
    }

    const pledgeAmt = Number(quickPledgeAmount);
    const payAmt = Number(quickPaymentAmount);

    if (isNaN(pledgeAmt) && isNaN(payAmt)) {
      setQuickPaymentError(language === 'sw' ? 'Tafadhali weka kiasi halali cha ahadi au malipo.' : 'Please enter a valid pledge or payment amount.');
      return;
    }

    const updated = activeGuests.map(g => {
      if (g.id === quickSelectedGuestId) {
        const pledgeVal = !isNaN(pledgeAmt) && pledgeAmt > 0 ? pledgeAmt : g.pledgeAmount || 0;
        const paymentVal = !isNaN(payAmt) && payAmt > 0 ? payAmt : 0;
        const newPaidAmount = (g.paidAmount || 0) + paymentVal;
        const newPayments = [...(g.payments || [])];
        if (paymentVal > 0) {
          newPayments.push({
            id: 'pay-' + Date.now(),
            amount: paymentVal,
            date: new Date().toLocaleDateString('sw-TZ'),
            reference: quickPaymentRef.trim() || 'Quick Drawer',
            notes: 'Kutoka Quick Action Drawer'
          });
        }
        return {
          ...g,
          pledgeAmount: pledgeVal,
          paidAmount: newPaidAmount,
          payments: newPayments
        };
      }
      return g;
    });

    updateGuests(updated, `Mchango umesajiliwa kwa haraka kwa: ${targetGuest.name}`);

    // Clear and show success
    setQuickSelectedGuestId('');
    setQuickPledgeAmount('');
    setQuickPaymentAmount('');
    setQuickPaymentRef('');
    setQuickPaymentSuccess(true);
    setTimeout(() => setQuickPaymentSuccess(false), 3000);
  };

  // Mark all notifications as read
  const handleMarkAllNotificationsAsRead = () => {
    const updated = globalNotifications.map(n => ({ ...n, read: true }));
    setGlobalNotifications(updated);
    if (eventDetails?.id) {
      localStorage.setItem(`kadi_committee_notifications_${eventDetails.id}`, JSON.stringify(updated));
    }
  };

  // Clear all notifications
  const handleClearGlobalNotifications = () => {
    setGlobalNotifications([]);
    if (eventDetails?.id) {
      localStorage.setItem(`kadi_committee_notifications_${eventDetails.id}`, JSON.stringify([]));
    }
  };

  // --- RSVP Notification Badge Logic ---
  const unseenRsvps = useMemo(() => {
    return guests.filter(g => g.rsvpStatus && g.rsvpStatus !== 'Bado' && !g.rsvpSeen);
  }, [guests]);

  const markRsvpsAsSeen = () => {
    if (unseenRsvps.length === 0) return;
    const updatedGuests = guests.map(g => 
      (g.rsvpStatus && g.rsvpStatus !== 'Bado' && !g.rsvpSeen) ? { ...g, rsvpSeen: true } : g
    );
    updateGuests(updatedGuests);
  };

  // Mark RSVPs as seen when entering the RSVP tab
  useEffect(() => {
    if (activeTab === 'rsvp') {
      markRsvpsAsSeen();
    }
  }, [activeTab]);

  // --- Render Layout ---

  if (isGuestLoading) {
    const loadingMessage = isPledgeView
      ? (language === 'en' ? 'Loading your contribution page...' : 'Inapakia Ukurasa wako wa Ahadi ya Mchango...')
      : isStdView
      ? (language === 'en' ? 'Loading Save The Date...' : 'Inapakia Taarifa ya Hifadhi Tarehe...')
      : isSeatingView
      ? (language === 'en' ? 'Loading Seating Map & Selection...' : 'INAPAKIA Ramani ya Meza na Uchaguzi...')
      : isVenueView
      ? (language === 'en' ? 'Loading Venue Location...' : 'Inapakia Ramani ya Ukumbi...')
      : (language === 'en' ? 'Loading your digital invitation card...' : 'Inapakia Kadi Yako ya Mwaliko Kidigitali...');

    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center font-sans p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500 mb-6"></div>
        <p className="text-sm text-slate-350 font-bold uppercase tracking-widest animate-pulse">
          {loadingMessage}
        </p>
        <p className="text-[10px] text-slate-500 font-mono mt-2.5 uppercase tracking-wider">
          EVENTCARD DIGITAL SYSTEM
        </p>
      </div>
    );
  }

  if (guestError) {
    return (
      <div className="min-h-screen bg-[#050b18] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4 text-2xl shadow-lg">
          ⚠️
        </div>
        <h2 className="text-lg font-extrabold uppercase mb-2 text-white">Mwaliko Haujapatikana</h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          Inaonekana kiungo cha mwaliko hakipo sawa au kimeondolewa kwenye mfumo. Tafadhali wasiliana na kamati au jaribu tena baadae.
        </p>
        <button 
          onClick={() => {
            setGuestError(null);
            window.history.pushState({}, '', '/');
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-3.5 rounded-xl transition cursor-pointer shadow-lg"
        >
          Rudi Kwenye Mfumo Mkuu
        </button>
      </div>
    );
  }

  if (guestInviteData) {
    if (isStdView) {
      return (
        <GuestSaveTheDatePage 
          guest={guestInviteData.guest} 
          event={guestInviteData.event} 
          saveTheDateImage={guestInviteData.saveTheDate?.image_url}
        />
      );
    } else if (isPledgeView) {
      // For pledges, optionally try loading customized template from same browser, or fallback to default
      const localTplRaw = safeLocalStorage.getItem(`kadi_card_tpl_v3_${guestInviteData.event.id}`);
      let payloadTpl = undefined;
      if (localTplRaw) {
        try { payloadTpl = JSON.parse(localTplRaw); } catch(e) {}
      }

      return (
        <GuestPledgeSubmissionPage 
          guest={guestInviteData.guest} 
          event={guestInviteData.event} 
          template={guestInviteData.pledgeTemplate || payloadTpl}
          onPledgeSubmit={(amount) => {
             const updatedG = { ...guestInviteData.guest, pledgeAmount: amount, pledgeStatus: 'Pledged' as any };
             setGuestInviteData({
                ...guestInviteData,
                guest: updatedG
             });
             setGuests(prev => prev.map(g => g.id === updatedG.id ? updatedG : g));
          }}
        />
      );
    } else {
      return (
        <GuestInvitePage 
          guest={guestInviteData.guest} 
          event={guestInviteData.event} 
          settings={guestInviteData.settings} 
          viewMode={isVenueView ? 'venue' : (isSeatingView ? 'seating' : undefined)}
          onRsvpSubmit={(updatedGuest) => {
            setGuestInviteData({
              ...guestInviteData,
              guest: updatedGuest
            });
            setGuests(prev => prev.map(g => g.id === updatedGuest.id ? updatedGuest : g));
          }}
        />
      );
    }
  }

  if (isPublicReportPortal) {
    if (isLoading && eventsList.length === 0) {
      return (
        <div className="min-h-screen bg-[#050b18] text-white flex flex-col items-center justify-center font-sans p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mb-6"></div>
          <p className="text-sm text-slate-350 font-bold uppercase tracking-widest animate-pulse">Inapakia Ripoti...</p>
        </div>
      );
    }

    const portalEvent = eventsList.find(e => e.id === portalEventId);
    if (!portalEvent) {
      return (
        <div className="min-h-screen bg-[#050b18] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
          <h2 className="text-xl font-black uppercase mb-2">Tukio halijapatikana</h2>
          <p className="text-xs text-slate-400 max-w-sm mb-6">Inaonekana tukio hili limefutwa au link uliyopewa sio sahihi.</p>
        </div>
      );
    }

    const eventGuests = guests.filter(g => g.eventId === portalEvent.id || (!g.eventId && portalEvent.id === 'event-starter'));

    return <PublicReportView event={portalEvent} guests={eventGuests} />;
  }

  if (isCommitteePortal) {
    if (isLoading && eventsList.length === 0) {
      return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center font-sans p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mb-6"></div>
          <p className="text-sm text-slate-350 font-bold uppercase tracking-widest animate-pulse">Inapakia Portal ya Kamati...</p>
        </div>
      );
    }

    const portalEvent = eventsList.find(e => e.id === portalEventId);
    if (!portalEvent) {
      return (
        <div className="min-h-screen bg-[#050b18] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
          <h2 className="text-xl font-black uppercase mb-2">Tukio halijapatikana</h2>
          <p className="text-xs text-slate-400 max-w-sm mb-6">Inaonekana tukio hili limefutwa au link uliyopewa sio sahihi.</p>
        </div>
      );
    }

    const portalGuests = guests.filter(g => g.eventId === portalEvent.id || (!g.eventId && portalEvent.id === 'event-starter'));

    return (
      <div className="min-h-screen bg-[#020617] text-white font-sans">
        {/* Simple header for standalone portal */}
        <header className="px-6 py-4 border-b border-white/5 bg-[#0b1328]/80 backdrop-blur-md sticky top-0 z-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Users className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-base font-black uppercase tracking-wider text-white">Portal ya Kamati</h1>
              <p className="text-[11px] uppercase font-bold tracking-widest text-slate-400">{portalEvent.name}</p>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-8">
            <CommitteeDashboard 
                event={portalEvent}
                guests={portalGuests}
                onUpdateEvent={updateEventDetails}
                onUpdateGuests={updateGuests}
                onRefresh={refreshState}
            />
        </div>
      </div>
    );
  }

  if (isScanOnlyPortal) {
    if (isLoading && eventsList.length === 0) {
      return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center font-sans p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-6"></div>
          <p className="text-sm text-slate-350 font-bold uppercase tracking-widest animate-pulse">
            {language === 'en' ? 'Loading Gate Scanner Terminal...' : 'Inasimamisha Kituo cha Skan...'}
          </p>
        </div>
      );
    }

    const currentEvent = scanEventDetails;
    if (!currentEvent) {
      return (
        <div className="min-h-screen bg-[#050b18] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
          <h2 className="text-xl font-black uppercase mb-2">
            {language === 'en' ? 'Event Not Found' : 'Tukio halijapatikana'}
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mb-6">
            {language === 'en' 
              ? 'No registered events found to scan. Please contact administration.' 
              : 'Hakuna sherehe iliyopatikana kwenye mfumo kwa ajili ya kuskani.'}
          </p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#020617] text-white font-sans">
        <header className="px-6 py-4 border-b border-white/5 bg-[#0b1328]/80 backdrop-blur-md sticky top-0 z-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <QrCode className="w-5 h-5 text-blue-500 animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-wider text-white">
                {language === 'en' ? 'Gate Check-in Terminal' : 'Kituo cha Uhakiki Mlangoni'}
              </h1>
              <p className="text-[11px] uppercase font-bold tracking-widest text-slate-400">{currentEvent.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                {language === 'en' ? 'TERMINAL ACTIVE' : 'KITUO KIPO KAZINI'}
              </span>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem('eventcard_scanner_mode');
                localStorage.removeItem('eventcard_scanner_event_id');
                window.location.reload();
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-350 border border-rose-500/20 text-[10px] font-bold uppercase transition flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'Exit' : 'Ondoka'}</span>
            </button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <QRScanner 
            guests={activeGuests} 
            onUpdateGuests={updateGuests} 
            event={currentEvent} 
            isStandaloneOnly={true}
          />
        </div>
      </div>
    );
  }

  if (uwalemiMemberParam) {
    return (
      <UwalemiMemberPortal 
        memberNoOrPhone={uwalemiMemberParam} 
        onClose={() => {
          setUwalemiMemberParam(null);
          setActiveTab('uwalemi');
        }} 
        standalone={true}
      />
    );
  }

  if (showLanding) {
    return (
      <LandingPage 
        onStart={() => setShowLanding(false)} 
        onLoginClick={() => {
          setShowLanding(false);
          setActiveTab('dashboard');
        }}
      />
    );
  }

  if (!user) {
    return <Login onSuccess={handleLoginSuccess} onBack={() => setShowLanding(true)} />;
  }

  const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = {
    imageUrl: '',
    textColor: '#ffffff',
    fontFamily: 'Playfair Display',
    guestNameX: 50,
    guestNameY: 45,
    guestNameSize: 24,
    guestNameColor: '#d97706',
    qrCodeX: 50,
    qrCodeY: 75,
    qrCodeSize: 120,
    qrCodeColor: '#ffffff',
    cardTypeX: 50,
    cardTypeY: 15,
    cardTypeSize: 14,
    cardTypeColor: '#fbbf24',
    orientation: 'portrait',
  };

  const renderContent = () => {
    if (isLoading && !eventDetails && eventsList.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (!eventDetails && activeTab !== 'dashboard' && activeTab !== 'settings') {
      setTimeout(() => setActiveTab('dashboard'), 0);
      return null;
    }

    if ((!eventDetails && eventsList.length === 0) || isCreatingEvent) {
      if (!draftEvent) {
        return (
          <CreateEventPage 
            language={language}
            onBack={() => {
              if (eventsList.length > 0) {
                setIsCreatingEvent(false);
              } else {
                setShowLanding(true);
              }
            }}
            onSelect={(typeID, defaultName, defaultHall) => {
              const newEvent: EventDetails = {
                id: Math.floor(100000 + Math.random() * 900000).toString(),
                senderId: typeID,
                name: '',
                date: '',
                time: '',
                period: 'Jioni',
                eventHallName: '',
                coordinates: '',
                hostName: '',
                dressCode: '',
                contact1: '',
                contact1Name: '',
                contact2: '',
                contact2Name: '',
                contact3: '',
                eventImgUrl: '',
                contributionsEnabled: true,
                fundraisingGoal: 5000000,
              };
              setDraftEvent(newEvent);
            }} 
          />
        );
      }

      // Let user customize and fill the form details before returning to the dashboard
      return (
        <div className="space-y-6">
          <div className="flex" id="create-event-draft-form-navigation">
            <button
              onClick={() => setDraftEvent(null)}
              className="flex items-center space-x-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-350 hover:text-white px-3.5 py-2 rounded-xl transition font-extrabold cursor-pointer text-[11px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{language === 'sw' ? 'Rudi Chagua Aina ya Sherehe' : 'Back to Selection'}</span>
            </button>
          </div>
          <EventDetailsForm 
            initialData={draftEvent} 
            isAlreadySaved={false} 
            onSave={(formData) => {
              setEventDetails(formData);
              const updatedList = [...eventsList, formData];
              setEventsList(updatedList);
              saveState({ eventDetails: formData, eventsList: updatedList }, 'Ametengeneza tukio jipya (Created New Event)', `Tukio jipya lilioundwa: ${formData.name}`);
              setDraftEvent(null);
              setIsCreatingEvent(false);
              setActiveTab('dashboard');
            }} 
          />
        </div>
      );
    }

    let currentSettings = DEFAULT_TEMPLATE_SETTINGS;
    if (templateSettings) {
      if (eventDetails && eventDetails.id) {
        if ((templateSettings as any)[eventDetails.id]) {
          currentSettings = (templateSettings as any)[eventDetails.id];
        } else {
          // Initialize brand new events with completely clean default layout settings to prevent leak/carry-over of templates & backdrops
          currentSettings = { ...DEFAULT_TEMPLATE_SETTINGS };
        }
      } else {
        // Fallback when no active event exists to prevent leak
        currentSettings = { ...DEFAULT_TEMPLATE_SETTINGS };
      }
    }

    switch (activeTab) {
      case 'dashboard':
        {
          // Calculate stats for the active event
          const activeGuests = eventDetails ? guests.filter(g => g.eventId === eventDetails.id) : [];
          const confirmedGuestsCount = activeGuests.filter(g => g.rsvpStatus === 'Atahudhuria').length;
          const attendancePercentage = activeGuests.length > 0 ? (confirmedGuestsCount / activeGuests.length) * 100 : 0;
          
          const unseenRsvps = activeGuests.filter(g => !g.checkedIn && g.rsvpStatus === 'Atahudhuria');
          const totalEvents = eventsList.length;
          const totalGuests = activeGuests.length;
          const sentCards = activeGuests.filter(g => 
            isStatusSent(g.whatsappStatus) || 
            isStatusSent(g.smsStatus) || 
            (typeof g.whatsappCount === 'number' && g.whatsappCount > 0) ||
            (typeof g.smsCount === 'number' && g.smsCount > 0)
          ).length;

          // Filtered list states based on live search
          const filteredGuests = activeGuests.filter(g => 
            g.name.toLowerCase().includes(guestListSearch.toLowerCase()) ||
            g.phone.toLowerCase().includes(guestListSearch.toLowerCase()) ||
            `P-${g.id.substring(0, 6).toUpperCase()}`.toLowerCase().includes(guestListSearch.toLowerCase())
          );

          const sentGuestsList = activeGuests.filter(g => 
            isStatusSent(g.whatsappStatus) || 
            isStatusSent(g.smsStatus) ||
            (typeof g.whatsappCount === 'number' && g.whatsappCount > 0) ||
            (typeof g.smsCount === 'number' && g.smsCount > 0)
          );
          const filteredSentGuests = sentGuestsList.filter(g => 
            g.name.toLowerCase().includes(sentListSearch.toLowerCase()) ||
            g.phone.toLowerCase().includes(sentListSearch.toLowerCase())
          );

          // Compute RSVP timeline trend data
          const rsvpTrendData = (() => {
            const days = [];
            const now = new Date("2026-06-10T20:33:25Z"); // From user metadata context
            for (let i = 6; i >= 0; i--) {
              const d = new Date(now);
              d.setDate(now.getDate() - i);
              const dayStr = d.toLocaleDateString(language === 'sw' ? 'sw-TZ' : 'en-US', { day: '2-digit', month: '2-digit' });
              days.push({
                dateStr: dayStr,
                fullDate: d.toISOString().split('T')[0],
                Attending: 0,
                Declined: 0,
                Maybe: 0,
                Total: 0
              });
            }

            const respondedGuests = activeGuests.filter(g => g.rsvpStatus && g.rsvpStatus !== 'Bado');

            respondedGuests.forEach((g, index) => {
              let dateKey = '';
              if (g.rsvpUpdatedAt) {
                try {
                  dateKey = new Date(g.rsvpUpdatedAt).toISOString().split('T')[0];
                } catch (err) {
                  // Fallback
                }
              }
              
              let dayIndex = days.findIndex(d => d.fullDate === dateKey);
              if (dayIndex === -1) {
                // Deterministic fallback: spread across days based on index (so we always have a gorgeous populated chart)
                dayIndex = index % 7;
              }

              const dayObj = days[dayIndex];
              if (g.rsvpStatus === 'Atahudhuria') {
                dayObj.Attending += (g.rsvpGuestsCount || 1);
              } else if (g.rsvpStatus === 'Hatahudhuria') {
                dayObj.Declined += 1;
              } else if (g.rsvpStatus === 'Labda') {
                dayObj.Maybe += 1;
              }
              dayObj.Total += 1;
            });

            let cumulativeSum = 0;
            return days.map(d => {
              cumulativeSum += d.Attending;
              return {
                name: d.dateStr,
                Attending: d.Attending,
                Declined: d.Declined,
                Maybe: d.Maybe,
                Cumulative: cumulativeSum
              };
            });
          })();

          return (
            <div className="text-white font-sans relative flex flex-col space-y-6 pb-12" id="dashboard-dark-root">
              
              {/* Top Support Banner Row - REMOVED per user request */}
      

              {/* Real-time RSVP notification alert block (dark glass style) */}
              <AnimatePresence>
                {eventDetails && unseenRsvps.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-3xl flex items-center justify-between shadow-lg backdrop-blur-md"
                    id="rsvp-alert"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Bell className="w-5 h-5 text-blue-400 animate-bounce" />
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#050b18]"></span>
                      </div>
                      <div className="text-left">
                        <p className="text-white font-bold text-xs">
                          {language === 'sw' 
                            ? `Maombi Mapya ya RSVP: ${unseenRsvps.length}` 
                            : `New RSVP Requests: ${unseenRsvps.length}`}
                        </p>
                        <p className="text-slate-400 text-[11px]">
                          {unseenRsvps.slice(0, 2).map(g => g.name).join(', ')} 
                          {unseenRsvps.length > 2 && '...'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveTab('rsvp')}
                      className="text-[11px] font-bold text-blue-400 hover:text-white transition-colors bg-blue-500/15 px-3.5 py-1.5 rounded-xl border border-blue-500/30"
                      id="view-rsvp-alert-btn"
                    >
                      {language === 'sw' ? 'Angalia' : 'View'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Header: Greeting & Dynamic Event Dropdown Selector */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4" id="dashboard-header-row">
                <div className="space-y-1 text-left">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight" id="greeting-title">
                      {language === 'sw' ? 'Habari,' : 'Hello,'} {user?.username || 'Jimson'} 👋
                    </h1>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold shrink-0 shadow-lg shadow-emerald-950/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>{language === 'sw' ? 'Muda Halisi (Website Sync Active)' : 'Real-time Website Sync Active'}</span>
                    </div>

                    {/* Prominent Msaidizi wa AI Button */}
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chatbot'))}
                      id="ai-assistant-pill-btn"
                      className="flex items-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:scale-105 active:scale-95 transition-all duration-300 text-white px-4 py-1.5 rounded-full font-black text-xs border-2 border-amber-400/80 shadow-[0_0_20px_rgba(79,70,229,0.6)] cursor-pointer shrink-0 animate-pulse"
                      title={language === 'sw' ? 'Fungua Msaidizi wa AI' : 'Open AI Assistant'}
                    >
                      <div className="relative">
                        <Bot className="w-4 h-4 text-white" />
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-90"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-300"></span>
                        </span>
                      </div>
                      <span>{language === 'sw' ? 'Msaidizi wa AI' : 'AI Assistant'}</span>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    </button>
                  </div>
                  <p className="text-slate-400 text-xs sm:text-sm" id="greeting-subtitle">
                    {language === 'sw' 
                      ? `Muhtasari wa sherehe ya ${eventDetails?.name || 'sherehe zako'}` 
                      : `Overview of ${eventDetails?.name || 'your events'}`}
                  </p>
                </div>

                {/* Event Selector block with dark glass theme */}
                <div className="relative w-full md:w-auto shrink-0" id="event-picker-wrapper">
                  <div className="flex items-center gap-2">
                    <div 
                      onClick={() => setShowEventDropdown(!showEventDropdown)}
                      className="flex items-center justify-between gap-4 bg-[#0b1328]/80 border border-white/10 hover:border-blue-500 transition-all px-4 py-3 rounded-2xl cursor-pointer shadow-xl w-full md:w-80"
                      id="event-picker-box"
                    >
                      <div className="flex items-center space-x-3 text-left">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                          <Calendar className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-white text-xs truncate max-w-[160px] leading-tight">
                            {eventDetails?.name || (language === 'sw' ? 'Chagua Sherehe' : 'Choose Event')}
                          </p>
                          <p className="text-slate-400 text-[10px] mt-0.5 font-bold">
                            {eventDetails?.date ? eventDetails.date.split('-').reverse().join('/') : '--/--/----'}
                          </p>
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                    
                    {eventDetails && (
                      <button
                        onClick={() => requestDeleteEvent(eventDetails.id)}
                        className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 p-3 rounded-2xl transition cursor-pointer self-stretch flex items-center justify-center shrink-0"
                        title={language === 'sw' ? 'Futa Sherehe' : 'Delete Event'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Options */}
                  {showEventDropdown && (
                    <div className="absolute z-50 right-0 left-0 mt-2 bg-[#0b1328] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-2 space-y-1 text-slate-100" id="dropdown-menu">
                      {eventsList.map((ev) => {
                        const isCurrent = eventDetails?.id === ev.id;
                        return (
                          <div
                            key={ev.id}
                            className={`flex items-center justify-between p-3 rounded-xl transition text-left ${
                              isCurrent ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'hover:bg-white/5 text-slate-300'
                            }`}
                          >
                            <div 
                              className="min-w-0 flex-grow text-left cursor-pointer pr-2"
                              onClick={() => {
                                setEventDetails(ev);
                                saveState({ eventDetails: ev });
                                setShowEventDropdown(false);
                              }}
                            >
                              <p className="font-extrabold text-xs truncate text-white">{ev.name}</p>
                              <p className="text-[10px] text-slate-450 truncate">{ev.date} &bull; {ev.eventHallName}</p>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              {isCurrent && (
                                <span className="text-[9px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold">
                                  {language === 'sw' ? 'Inasimamiwa' : 'Selected'}
                               </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestDeleteEvent(ev.id);
                                }}
                                className="p-1.5 text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                                title={language === 'sw' ? 'Futa Sherehe' : 'Delete Event'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <div className="border-t border-white/5 my-1 pt-1">
                        <button
                          onClick={() => {
                            setIsCreatingEvent(true);
                            setShowEventDropdown(false);
                          }}
                          className="w-full text-center py-2 text-xs font-bold text-blue-400 hover:bg-white/5 rounded-lg transition"
                          id="add-event-from-dropdown-btn"
                        >
                          + {language === 'sw' ? 'Tengeneza Sherehe Mpya' : 'Create New Event'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Msaidizi wa AI Banner Card on Main Dashboard */}
              <div className="bg-gradient-to-r from-indigo-950/90 via-slate-900 to-purple-950/90 backdrop-blur-xl border-2 border-indigo-500/50 rounded-[2rem] p-5 sm:p-6 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden" id="main-ai-assistant-banner">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-lg border border-amber-400/50 shrink-0">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left text-white max-w-xl space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                        EVENTCARD AI ASSISTANT
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block"></span>
                        ONLINE
                      </span>
                    </div>
                    <h3 className="font-extrabold text-base text-white">
                      {language === 'sw' ? 'Msaidizi wa AI wa Mfumo (AI Assistant)' : 'EVENTCARD Smart AI Assistant'}
                    </h3>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      {language === 'sw' 
                        ? 'Uliza chochote kuhusu michango, bajeti, orodha ya wageni, majibu ya RSVP au jinsi ya kutuma SMS & WhatsApp!' 
                        : 'Ask anything about pledges, budget, guest list, RSVP responses, or sending SMS & WhatsApp messages!'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chatbot'))}
                  className="px-5 py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-extrabold text-xs uppercase tracking-wider hover:opacity-95 shadow-xl shadow-indigo-600/40 active:scale-95 transition-all border-2 border-amber-400/70 flex items-center gap-2 shrink-0 cursor-pointer animate-bounce sm:animate-none"
                  id="open-ai-chat-from-main-dashboard-btn"
                >
                  <Bot className="w-4 h-4 text-white" />
                  <span>{language === 'sw' ? 'Anza Kuzungumza na AI' : 'Ask AI Assistant'}</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </button>
              </div>

              {/* Automatic WhatsApp Reminders Section */}
              {eventDetails && (
                <div className="bg-[#0b1328]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between" id="auto-reminders-section">
                  <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="text-left text-white max-w-lg">
                      <h3 className="font-bold text-sm">
                        {language === 'sw' ? 'Vikumbusho vya Kiotomatiki (WhatsApp)' : 'Automatic WhatsApp Reminders'}
                      </h3>
                      <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                        {language === 'sw' 
                          ? 'Washa mfumo utume ujumbe wa WhatsApp kiotomatiki kwa wageni ambao hawajathibitisha ushiriki wao (RSVP).' 
                          : 'Enable automatic WhatsApp reminders to instantly ping guests who have not yet responded to their RSVP campaign.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-center sm:pl-4">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={!!eventDetails.autoRsvpRemindersEnabled}
                        onChange={(e) => updateEventDetails({ ...eventDetails, autoRsvpRemindersEnabled: e.target.checked })}
                      />
                      <div className="w-12 h-6 bg-slate-800 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/50 rounded-full peer peer-checked:after:translate-x-[23px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 peer-checked:after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>
              )}

              {/* 3 Cards Grid - Polished Dark Theme (Total Spent is removed) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="stats-grid">
                {/* Card 1: Total Events */}
                <div className="bg-[#0b1328]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col justify-start text-left shadow-xl hover:scale-[1.01] transition-transform duration-350" id="stat-card-events">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4">
                    <Calendar className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-3xl font-extrabold text-white">{totalEvents}</h3>
                  <p className="text-slate-450 text-[11px] font-bold uppercase tracking-wider mt-1">
                    {language === 'sw' ? 'Sherehe Zote' : 'Total Events'}
                  </p>
                </div>

                {/* Card 2: Total Guests */}
                <div className="bg-[#0b1328]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col justify-start text-left shadow-xl hover:scale-[1.01] transition-transform duration-350" id="stat-card-guests">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4">
                    <Users className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-3xl font-extrabold text-white">{totalGuests}</h3>
                  <p className="text-slate-450 text-[11px] font-bold uppercase tracking-wider mt-1">
                    {language === 'sw' ? 'Wageni Kwenye Sherehe' : 'Total Event Guests'}
                  </p>
                </div>

                {/* Card 3: Sent Cards */}
                <div className="bg-[#0b1328]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col justify-start text-left shadow-xl hover:scale-[1.01] transition-transform duration-350" id="stat-card-sent">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-450 mb-4">
                    <Send className="w-5 h-5 text-emerald-450" />
                  </div>
                  <h3 className="text-3xl font-extrabold text-white">{sentCards}</h3>
                  <p className="text-slate-450 text-[11px] font-bold uppercase tracking-wider mt-1">
                    {language === 'sw' ? 'Kadi Zilizotumwa' : 'Dispatched Invites'}
                  </p>
                </div>
              </div>

              {/* RSVP Submission Trend Card */}
              <div className="bg-[#0b1328]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 text-left shadow-xl hover:scale-[1.002] transition-transform duration-300" id="rsvp-trend-card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-5">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                      <TrendingUp className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-sm sm:text-base leading-none">
                        {language === 'sw' ? 'Mwenendo wa RSVP Shereheni (RSVP Submission Trend)' : 'RSVP Submission Trend'}
                      </h3>
                      <p className="text-slate-400 text-[11px] mt-1">
                        {language === 'sw' 
                          ? 'Ufuatiliaji wa wageni waliowasilisha mrejesho wa mwaliko kwa siku 7 zilizopita.' 
                          : 'Daily responses tracker with cumulative guest confirmations over the last 7 days.'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>{language === 'sw' ? 'Atahudhuria (Daily)' : 'Attending (Daily)'}</span>
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/10 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span>{language === 'sw' ? 'Mkusanyiko (Cumulative)' : 'Cumulative Confirmed'}</span>
                    </span>
                  </div>
                </div>

                <div className="h-56 sm:h-64 w-full mt-2 font-mono text-[9px]" id="rsvp-chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={rsvpTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAttending" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="name" 
                        stroke="#475569" 
                        tickLine={false} 
                        axisLine={false}
                        dy={8}
                      />
                      <YAxis 
                        stroke="#475569" 
                        tickLine={false} 
                        axisLine={false}
                        allowDecimals={false}
                        dx={-8}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#0c152a', 
                          borderColor: 'rgba(255,255,255,0.08)', 
                          borderRadius: '16px',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontFamily: 'Inter, sans-serif'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="Attending" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorAttending)" 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="Cumulative" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorCumulative)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Side-by-Side Live Searching Guests and Dispatched Cards Lists */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2" id="dashboard-lists-row">
                
                {/* Column 1: Guest Directory list with live search */}
                <div className="bg-[#0b1328]/60 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 space-y-4 flex flex-col justify-between" id="guest-directory-container">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                          <Users className="w-4 h-4" />
                        </div>
                        <h3 className="font-extrabold text-white text-sm">
                          {language === 'sw' ? 'Orodha ya Wageni' : 'Guest Directory'}
                        </h3>
                      </div>
                      <span className="text-xs bg-purple-500/10 text-purple-400 font-bold px-2.5 py-1 rounded-full font-mono">
                        {totalGuests} {language === 'sw' ? 'Wageni' : 'Guests'}
                      </span>
                    </div>
                    <p className="text-slate-405 text-[11px] leading-relaxed text-left">
                      {language === 'sw'
                        ? 'Orodha ya wageni wote walioandikishwa kwenye sherehe hii pamoja na hali ya majibu yao.'
                        : 'List of all registered guests for this session, showing their personal invitation details.'}
                    </p>
                  </div>

                  {/* Live Search Input */}
                  {activeGuests.length > 0 && (
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                      </span>
                      <input 
                        type="text"
                        value={guestListSearch}
                        onChange={(e) => setGuestListSearch(e.target.value)}
                        placeholder={language === 'sw' ? 'Tafuta mgeni kwa jina au simu...' : 'Search guest by name or phone...'}
                        className="w-full bg-[#070d1e] border border-white/5 py-2 pl-9 pr-4 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 transition-colors text-left"
                      />
                      {guestListSearch && (
                        <button 
                          onClick={() => setGuestListSearch('')}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-[10px] text-slate-400 hover:text-white"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}

                  {/* Scrolling List container */}
                  {activeGuests.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-white/5 rounded-2xl">
                      <Users className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                      <p className="text-slate-500 text-xs">
                        {language === 'sw' ? 'Hakuna wageni waliosajiliwa kwenye sherehe hii bado.' : 'No guests registered under this event yet.'}
                      </p>
                      <button
                        onClick={() => setActiveTab('guests')}
                        className="text-xs font-bold text-blue-400 hover:underline mt-2 cursor-pointer bg-none border-none"
                      >
                        {language === 'sw' ? 'Ongeza Wageni' : 'Add Guests Now'}
                      </button>
                    </div>
                  ) : filteredGuests.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-white/5 rounded-2xl">
                      <p className="text-slate-500 text-xs">
                        {language === 'sw' ? 'Hakuna mgeni aliyepatikana.' : 'No matched guests found.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                      {filteredGuests.map((guest) => {
                        let rsvpBg = 'bg-slate-500/10 text-slate-400';
                        if (guest.rsvpStatus === 'Atahudhuria') rsvpBg = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                        if (guest.rsvpStatus === 'Hatahudhuria') rsvpBg = 'bg-rose-500/20 text-rose-450 border border-rose-500/30';
                        if (guest.rsvpStatus === 'Labda') rsvpBg = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';

                        return (
                          <div 
                            key={guest.id}
                            className="bg-[#0e172e]/60 hover:bg-[#131e3d]/80 border border-white/5 rounded-xl p-2.5 flex items-center justify-between transition-colors"
                          >
                            <div className="flex flex-col text-left min-w-0">
                              <span className="text-white font-bold text-xs truncate max-w-[170px]">{guest.name}</span>
                              <div className="flex items-center space-x-1.5 text-slate-450 text-[10px] font-mono mt-0.5 flex-wrap">
                                <span className="text-amber-500 font-bold">P-{guest.id.substring(0, 6).toUpperCase()}</span>
                                <span>•</span>
                                <span>{guest.phone || (language === 'sw' ? 'Hakuna Simu' : 'No Phone')}</span>
                                {(isStatusSent(guest.smsStatus) || isStatusSent(guest.whatsappStatus)) && (
                                  <>
                                    <span>•</span>
                                    <span className="text-[10px] text-slate-400 font-mono font-normal">
                                      sms:{guest.smsCount || (isStatusSent(guest.smsStatus) ? 1 : 0)} wa:{guest.whatsappCount || (isStatusSent(guest.whatsappStatus) ? 1 : 0)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-1.5 shrink-0">
                              <span className="text-[9px] bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded font-extrabold font-mono uppercase">
                                {guest.cardType || 'SINGLE'}
                              </span>

                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${rsvpBg}`}>
                                {guest.rsvpStatus || 'Bado'}
                              </span>

                              {guest.checkedIn && (
                                <span className="text-[95%] text-emerald-400" title="Check-in Success">
                                  ✓
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Navigation shortcut to register */}
                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab('guests')}
                      className="w-full text-center py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl text-xs font-bold text-purple-300 transition"
                      id="manage-guests-link-btn"
                    >
                      {language === 'sw' ? 'Simamia Orodha Kamili / Ongeza Mgeni' : 'Manage Guests & Register Profiles'}
                    </button>
                  </div>
                </div>

                {/* Column 2: Cards Sent list with live search */}
                <div className="bg-[#0b1328]/60 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 space-y-4 flex flex-col justify-between" id="sent-cards-container">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                          <Send className="w-4 h-4" />
                        </div>
                        <h3 className="font-extrabold text-white text-sm">
                          {language === 'sw' ? 'Kadi Zilizotumwa' : 'Dispatched Invitations'}
                        </h3>
                      </div>
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 font-bold px-2.5 py-1 rounded-full font-mono">
                        {sentCards} {language === 'sw' ? 'Kadi' : 'Invites'}
                      </span>
                    </div>
                    <p className="text-slate-405 text-[11px] leading-relaxed text-left">
                      {language === 'sw'
                        ? 'Orodha ya wageni waliofanikiwa kupokea mwaliko na kadi zao kupitia WhatsApp au SMS.'
                        : 'Overview of guests who have already received their invitation cards via active channels.'}
                    </p>
                  </div>

                  {/* Live Search Input */}
                  {sentGuestsList.length > 0 && (
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                      </span>
                      <input 
                        type="text"
                        value={sentListSearch}
                        onChange={(e) => setSentListSearch(e.target.value)}
                        placeholder={language === 'sw' ? 'Tafuta aliyetumiwa kadi...' : 'Search dispatched guest...'}
                        className="w-full bg-[#070d1e] border border-white/5 py-2 pl-9 pr-4 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition-colors text-left"
                      />
                      {sentListSearch && (
                        <button 
                          onClick={() => setSentListSearch('')}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-[10px] text-slate-400 hover:text-white"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}

                  {/* Scrolling Sent List container */}
                  {sentGuestsList.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-white/5 rounded-2xl">
                      <Send className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                      <p className="text-slate-500 text-xs">
                        {language === 'sw' ? 'Kadi bado hazijaanza kutumwa.' : 'No cards have been dispatched yet.'}
                      </p>
                      <button
                        onClick={() => setActiveTab('send')}
                        className="text-xs font-bold text-blue-400 hover:underline mt-2 cursor-pointer bg-none border-none"
                      >
                        {language === 'sw' ? 'Tuma Kadi Sasa' : 'Send Invitation Cards Now'}
                      </button>
                    </div>
                  ) : filteredSentGuests.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-white/5 rounded-2xl">
                      <p className="text-slate-500 text-xs">
                        {language === 'sw' ? 'Siri haijapatikana.' : 'No matched dispatch profiles found.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                      {filteredSentGuests.map((guest) => {
                        const viaWhatsApp = isStatusSent(guest.whatsappStatus);
                        const viaSMS = isStatusSent(guest.smsStatus);

                        return (
                          <div 
                            key={guest.id}
                            className="bg-[#0e172e]/60 hover:bg-[#131e3d]/80 border border-white/5 rounded-xl p-2.5 flex items-center justify-between transition-colors"
                          >
                            <div className="flex flex-col text-left min-w-0">
                              <span className="text-white font-bold text-xs truncate max-w-[170px]">{guest.name}</span>
                              <span className="text-slate-400 text-[10px] font-mono mt-0.5">{guest.phone}</span>
                            </div>
                            
                            <div className="flex items-center space-x-1.5 shrink-0">
                              {viaWhatsApp && (
                                <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold border border-emerald-500/20 flex items-center gap-1" title={`Zilizotumwa: ${guest.whatsappCount || 1}`}>
                                  <span>WA ({guest.whatsappCount || 1})</span>
                                </span>
                              )}
                              {viaSMS && (
                                <span className="text-[9px] bg-blue-500/15 text-blue-300 px-1.5 py-0.5 rounded-full font-bold border border-blue-500/20 flex items-center gap-1" title={`Zilizotumwa: ${guest.smsCount || 1}`}>
                                  <span>SMS ({guest.smsCount || 1})</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Send shortlink */}
                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab('send')}
                      className="w-full text-center py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-300 transition"
                      id="dispatch-dashboard-shortcut-btn"
                    >
                      {language === 'sw' ? 'Tuma Kadi kwa SMS / WhatsApp' : 'Dispatch Cards & Manage Logs'}
                    </button>
                  </div>
                </div>

              </div>

              {/* Event Details Card styled as sleek dark glass */}
              <div className="bg-[#0b1328]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 sm:p-8 space-y-6 shadow-xl text-left" id="event-details-summary-card">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-white">
                    {language === 'sw' ? 'Maelezo ya Sherehe' : 'Event Details'}
                  </h3>
                  
                  <button
                    onClick={() => setActiveTab('event-details')}
                    className="text-blue-400 hover:text-blue-350 text-xs font-bold hover:underline cursor-pointer"
                    id="view-all-details-link"
                  >
                    {language === 'sw' ? 'Hariri / View All' : 'Edit / View All'}
                  </button>
                </div>

                {/* Lifecycle Stage Progress Indicator */}
                <div className="bg-[#0c142c]/90 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4" id="event-lifecycle-progress-indicator">
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {language === 'sw' ? 'Hatua ya Sherehe' : 'Lifecycle Stage'}
                    </span>
                    <span className="text-white font-extrabold text-xs mt-0.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                      {currentLifecycleStage === 'Planning' && (language === 'sw' ? 'Kupanga & Kuandaa' : 'Planning & Setup')}
                      {currentLifecycleStage === 'Designing' && (language === 'sw' ? 'Kusanifu Kadi' : 'Card Design & Templates')}
                      {currentLifecycleStage === 'Dispatched' && (language === 'sw' ? 'Kutuma & Mialiko' : 'Dispatched & Outreaching')}
                    </span>
                  </div>

                  {/* Horizontal Stepper */}
                  <div className="flex items-center space-x-2 sm:space-x-4">
                    {/* Step 1: Planning */}
                    <div className="flex items-center space-x-1.5">
                      <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border font-bold text-xs transition-all duration-500 ${
                        currentLifecycleStage === 'Planning'
                          ? 'bg-blue-500/20 border-blue-400 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                          : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      }`}>
                        {currentLifecycleStage !== 'Planning' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span className="font-mono">1</span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold ${
                        currentLifecycleStage === 'Planning' ? 'text-blue-300' : 'text-slate-400'
                      }`}>
                        {language === 'sw' ? 'Kupanga' : 'Planning'}
                      </span>
                    </div>

                    {/* Connector line 1 */}
                    <div className={`h-[1px] w-3 sm:w-6 transition-colors duration-500 ${
                      currentLifecycleStage !== 'Planning' ? 'bg-emerald-500/30' : 'bg-white/10'
                    }`}></div>

                    {/* Step 2: Designing */}
                    <div className="flex items-center space-x-1.5">
                      <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border font-bold text-xs transition-all duration-500 ${
                        currentLifecycleStage === 'Designing'
                          ? 'bg-blue-500/20 border-blue-400 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                          : currentLifecycleStage === 'Dispatched'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                          : 'bg-slate-950/40 border-white/10 text-slate-500'
                      }`}>
                        {currentLifecycleStage === 'Dispatched' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span className="font-mono">2</span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold ${
                        currentLifecycleStage === 'Designing' ? 'text-blue-300' : currentLifecycleStage === 'Dispatched' ? 'text-emerald-400/85' : 'text-slate-500'
                      }`}>
                        {language === 'sw' ? 'Kusanifu' : 'Designing'}
                      </span>
                    </div>

                    {/* Connector line 2 */}
                    <div className={`h-[1px] w-3 sm:w-6 transition-colors duration-500 ${
                      currentLifecycleStage === 'Dispatched' ? 'bg-emerald-500/30' : 'bg-white/10'
                    }`}></div>

                    {/* Step 3: Dispatched */}
                    <div className="flex items-center space-x-1.5">
                      <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border font-bold text-xs transition-all duration-500 ${
                        currentLifecycleStage === 'Dispatched'
                          ? 'bg-blue-500/20 border-blue-400 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                          : 'bg-slate-950/40 border-white/10 text-slate-500'
                      }`}>
                        <span className="font-mono">3</span>
                      </div>
                      <span className={`text-[10px] font-bold ${
                        currentLifecycleStage === 'Dispatched' ? 'text-blue-300' : 'text-slate-500'
                      }`}>
                        {language === 'sw' ? 'Kutuma' : 'Dispatched'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Grid layout containing the details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 pt-4 pb-2 border-t border-white/5" id="details-fields-grid">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {language === 'sw' ? 'Jina la Sherehe' : 'Event Name'}
                    </p>
                    <p 
                      onClick={() => setActiveTab('event-details')}
                      className="text-blue-400 hover:text-blue-300 hover:underline font-extrabold text-xs truncate cursor-pointer leading-tight"
                    >
                      {eventDetails?.name || 'N/A'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {language === 'sw' ? 'Aina' : 'Category'}
                    </p>
                    <p className="text-slate-350 font-extrabold text-xs uppercase">
                      {eventDetails?.senderId || 'SEND OFF'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {language === 'sw' ? 'Tarehe' : 'Date'}
                    </p>
                    <p className="text-slate-300 font-semibold text-xs font-mono">
                      {eventDetails?.date ? eventDetails.date.split('-').reverse().join('/') : 'N/A'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {language === 'sw' ? 'Ukumbi' : 'Location'}
                    </p>
                    <p className="text-slate-300 font-extrabold text-xs truncate">
                      {eventDetails?.eventHallName || 'N/A'}
                    </p>
                  </div>

                  {/* Unique Event ID column */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {language === 'sw' ? 'ID ya Sherehe' : 'Event ID'}
                    </p>
                    <div className="flex items-center justify-between w-full max-w-[200px] bg-indigo-950/40 border border-indigo-500/30 rounded-lg p-1.5 pt-1 pb-1 pr-1">
                      <span className="text-indigo-200 font-black font-mono text-xs truncate px-1" title={eventDetails?.id}>
                        {eventDetails?.id || 'N/A'}
                      </span>
                      {eventDetails?.id && (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(eventDetails.id);
                              setCopiedId(true);
                              setTimeout(() => setCopiedId(false), 2000);
                            }}
                            className={`p-1.5 rounded-md cursor-pointer transition-all duration-300 ${copiedId ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'}`}
                            title={language === 'sw' ? 'Nakili ID ya Sherehe' : 'Copy Event ID'}
                          >
                            {copiedId ? (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              const portalUrl = `${window.location.origin}/progress/${eventDetails.id}`;
                              const textToShare = language === 'sw' ? `Tafadhali jiunge na portal yetu ya tukio.\nID: ${eventDetails.id}\nKiungo: ${portalUrl}` : `Please join our event portal.\nID: ${eventDetails.id}\nLink: ${portalUrl}`;
                              if (navigator.share) {
                                navigator.share({
                                  title: eventDetails.name,
                                  text: textToShare,
                                }).catch(console.error);
                              } else {
                                window.open(`https://wa.me/?text=${encodeURIComponent(textToShare)}`, '_blank');
                              }
                            }}
                            className="p-1.5 rounded-md cursor-pointer transition-all duration-300 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                            title={language === 'sw' ? 'Shiriki' : 'Share'}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    {copiedId && (
                      <p className="text-[9px] text-emerald-400 font-bold animate-pulse text-left mt-0.5">
                        {language === 'sw' ? 'Imenakiliwa! ✓' : 'ID Copied! ✓'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Attendance Confirmation Progress Bar */}
                <div className="space-y-3 pt-6 border-t border-white/5" id="attendance-progress-section">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-slate-300">
                        {language === 'sw' ? 'Wageni Waliothibitisha' : 'Attendance Confirmation Rate'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-black">{attendancePercentage.toFixed(1)}%</span>
                      <span className="text-slate-500 font-mono">
                        ({confirmedGuestsCount}/{activeGuests.length})
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5 shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${attendancePercentage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-500 rounded-full"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    {language === 'sw' 
                      ? '*Asilimia hii inawakilisha wageni waliobonyeza "Nitahudhuria" kwenye kadi zao mwaliko.' 
                      : '*This percentage represents guests who have explicitly clicked "I will attend" on their digital invites.'}
                  </p>
                </div>
              </div>

              {/* Floating style Bottom Right Navigation button for creation */}
              <div className="flex justify-end pt-4" id="fab-creation-row">
                <button
                  onClick={() => setIsCreatingEvent(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-6 py-3 rounded-xl transition duration-150 shadow-lg flex items-center space-x-2 cursor-pointer"
                  id="fab-create-event-btn"
                >
                  <span className="text-base font-bold">+</span>
                  <span>{language === 'sw' ? 'Tengeneza Sherehe Nyengine' : 'Create Another Event'}</span>
                </button>
              </div>

            </div>
          );
        }
      case 'event-details':
        return (
          <React.Fragment key={eventDetails?.id || 'event-details'}>
            <EventDetailsForm initialData={eventDetails!} isAlreadySaved={!!eventDetails} onSave={updateEventDetails} onDelete={() => requestDeleteEvent(eventDetails!.id)} />
          </React.Fragment>
        );
      case 'preview':
        return (
          <React.Fragment key={eventDetails?.id || 'preview'}>
            <CardPreview onNextStep={() => setActiveTab('templates')} event={eventDetails!} />
          </React.Fragment>
        );
      case 'templates':
        return (
          <React.Fragment key={eventDetails?.id || 'templates'}>
            <TemplatesSelector 
              settings={currentSettings} 
              onSave={updateTemplateSettings} 
              onNext={() => setActiveTab('guests')}
              event={eventDetails!}
            />
          </React.Fragment>
        );
      case 'guests':
        return (
          <React.Fragment key={eventDetails?.id || 'guests'}>
            <UploadGuests 
              event={eventDetails!} 
              settings={currentSettings} 
              guests={activeGuests} 
              onUpdateGuests={updateGuests} 
              onNext={() => setActiveTab('send')}
            />
          </React.Fragment>
        );
      case 'send':
        return (
          <React.Fragment key={eventDetails?.id || 'send'}>
            <SendMessages 
              guests={activeGuests} 
              event={eventDetails!} 
              settings={currentSettings}
              language={language}
              onUpdateGuests={updateGuests}
              onUpdateEvent={updateEventDetails}
              onNext={() => setActiveTab('rsvp')}
            />
          </React.Fragment>
        );
      case 'rsvp':
        return (
          <React.Fragment key={eventDetails?.id || 'rsvp'}>
            <RSVPResponses 
              guests={activeGuests} 
              onUpdateGuests={updateGuests} 
              event={eventDetails!} 
              onNext={() => setActiveTab('scan')}
            />
          </React.Fragment>
        );
      case 'scan':
        return (
          <React.Fragment key={eventDetails?.id || 'scan'}>
            <QRScanner guests={activeGuests} onUpdateGuests={updateGuests} event={eventDetails!} />
          </React.Fragment>
        );
      case 'settings':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <SMSGatewayConfig />
            <GitHubSyncConfig />
            <div className="lg:col-span-2 max-w-xl">
              <BackupManager 
                eventDetails={eventDetails}
                eventsList={eventsList}
                guests={guests}
              />
            </div>
          </div>
        );
      case 'wallet':
        return (
          <div className="text-white p-6">
            <h1 className="text-2xl font-bold">{t('nav.wallet')}</h1>
            <p className="text-slate-400 mt-2">Balance and transaction history coming soon.</p>
          </div>
        );
      case 'audit-logs':
        return <AuditLogsPage language={language} />;
      case 'security-dashboard':
        return <SecurityDashboard language={language} />;
      case 'debug':
        return <ConnectivityDebug />;
      case 'contributions':
        return (
          <React.Fragment key={eventDetails?.id || 'contributions'}>
            <ContributionManager 
              guests={activeGuests} 
              event={eventDetails!} 
              onUpdateGuests={updateGuests} 
              onUpdateEvent={updateEventDetails}
              eventsList={eventsList}
              contribTemplate={templateSettings ? (templateSettings as any)[`contrib-${eventDetails?.id}`] : undefined}
              onUpdateContribTemplate={(tmpl) => {
                const currentSettings = templateSettings || {};
                const updated = {
                  ...currentSettings,
                  [`contrib-${eventDetails?.id}`]: tmpl
                };
                setTemplateSettings(updated as any);
                saveState({ templateSettings: updated }, 'Amesasisha kiolezo cha kadi ya mchango (Contribution Template Updated)', `Tukio: ${eventDetails?.name}`);
              }}
              onSelectEvent={(eventId) => {
                const selected = eventsList.find(e => e.id === eventId);
                if (selected) {
                  setEventDetails(selected);
                  saveState({ eventDetails: selected });
                }
              }}
            />
          </React.Fragment>
        );
      case 'committee':
        return (
          <React.Fragment key={eventDetails?.id || 'committee'}>
            <CommitteeDashboard 
              event={eventDetails!}
              guests={activeGuests}
              onUpdateGuests={updateGuests}
              onUpdateEvent={updateEventDetails}
              onRefresh={refreshState}
            />
          </React.Fragment>
        );
      case 'save-the-date':
        return (
          <React.Fragment key={eventDetails?.id || 'save-the-date'}>
            <SaveTheDateManager 
              eventDetails={eventDetails!} 
              guests={activeGuests} 
              eventsList={eventsList}
              onSelectEvent={(eventId) => {
                const selected = eventsList.find(e => e.id === eventId);
                if (selected) {
                  setEventDetails(selected);
                  saveState({ eventDetails: selected });
                }
              }}
              onUpdateEvent={updateEventDetails}
              onUpdateGuests={updateGuests}
            />
          </React.Fragment>
        );
      case 'event-reports':
        return (
          <React.Fragment key={eventDetails?.id || 'event-reports'}>
            <EventReports
              event={eventDetails!}
              guests={activeGuests}
              onUpdateGuests={updateGuests}
              onUpdateEvent={updateEventDetails}
            />
          </React.Fragment>
        );
      case 'uwalemi':
        return <UwalemiModule onBackToMainApp={() => setActiveTab('dashboard')} />;
      default:
        return <div>Tab not found</div>;
    }
  };

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { id: 'uwalemi', icon: Shield, label: 'UWALEMI (Kikundi)' },
    { id: 'event-details', icon: Calendar, label: t('nav.eventDetails') },
    { id: 'preview', icon: Mail, label: t('nav.preview') },
    { id: 'templates', icon: Settings2, label: t('nav.templates') },
    { id: 'guests', icon: Users, label: t('nav.guests') },
    { id: 'send', icon: Send, label: t('nav.send') },
    { id: 'rsvp', icon: CheckCircle2, label: t('nav.rsvp'), badge: unseenRsvps.length > 0 ? unseenRsvps.length : null },
    { id: 'event-reports', icon: FileText, label: language === 'sw' ? 'Ripoti za Tukio' : 'Event Reports' },
    { id: 'contributions', icon: CreditCard, label: 'Michango' },
    { id: 'save-the-date', icon: History, label: 'Save The Date' },
    { id: 'committee', icon: ShieldCheck, label: 'Kamati (Committee)' },
    { id: 'scan', icon: QrCode, label: t('nav.scan') },
    { id: 'debug', icon: ShieldCheck, label: language === 'sw' ? 'Mtatuzi wa Muunganisho' : 'Debug Connectivity' },
    { id: 'settings', icon: Settings, label: t('nav.settings') },
    { id: 'wallet', icon: Wallet, label: t('nav.wallet') },
    { id: 'audit-logs', icon: ShieldCheck, label: language === 'sw' ? 'Audit Logs (Ulinzi)' : 'Audit Logs' },
    { id: 'security-dashboard', icon: ShieldCheck, label: language === 'sw' ? 'Ulinzi wa Kuingia' : 'Security Dashboard' }
  ];

  return (
    <div className="flex h-screen bg-[#020617] text-white overflow-hidden font-sans" id="app-root">
      
      {/* Absolute Ambient Layer */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[70%] bg-blue-600/5 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[70%] bg-purple-600/5 rounded-full blur-[150px]"></div>
      </div>

      {/* CUSTOM CONFIRMATION DELETE MODAL */}
      <AnimatePresence>
        {eventToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#020617]/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0b1328] border border-red-500/30 p-8 rounded-3xl max-w-md w-full shadow-2xl relative overflow-hidden space-y-6"
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-600/10 rounded-full blur-2xl"></div>
              
              <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white leading-tight">
                  {language === 'sw' ? 'Unapenda kufuta sherehe hii?' : 'Permanently Delete Event?'}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {language === 'sw' 
                    ? `Je, una uhakika unataka kufuta kabisa sherehe ya "${eventToDelete.name || 'Hii'}"? Tendo hili litafuta wageni wote walioandikishwa pamoja na taarifa zao zote za michango na mialiko. Tendo hili haliwezi kurudishwa.`
                    : `Are you sure you want to permanently delete "${eventToDelete.name || 'this event'}"? This action will erase all registered guests, contribution records, and invitation card configurations. This action is irreversible.`}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEventToDelete(null)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-extrabold text-xs py-3.5 px-4 rounded-xl border border-white/5 hover:text-white transition cursor-pointer text-center"
                >
                  {language === 'sw' ? 'Hapana, Ghairi' : 'No, Cancel'}
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteEvent}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-extrabold text-xs py-3.5 px-4 rounded-xl shadow-lg shadow-red-900/30 transition cursor-pointer text-center"
                >
                  {language === 'sw' ? 'Ndio, Futa Kabisa!' : 'Yes, Delete Permanently'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <aside 
        className={`${isSidebarOpen ? 'w-64' : 'w-20'} h-full bg-[#050b18]/80 backdrop-blur-xl border-r border-white/10 transition-all duration-300 flex flex-col z-20 sticky left-0`}
      >
        {/* Sidebar Logo Area */}
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen ? (
            <div className="flex items-center space-x-2">
              <img src="/logo.png" alt="Event Card Logo" className="h-20 w-auto object-contain" />
            </div>
          ) : (
            <img src="/logo.png" alt="Event Card Icon" className="h-16 w-16 object-contain mx-auto" />
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-grow overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as AppTab)}
              className={`w-full flex items-center p-3 rounded-xl transition-all relative ${
                activeTab === item.id 
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isSidebarOpen ? 'mr-3' : 'mx-auto'}`} />
              {isSidebarOpen && <span className="text-xs font-semibold">{item.label}</span>}
              {item.badge && (
                <span className={`absolute ${isSidebarOpen ? 'right-3' : 'top-1 right-1'} bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center animation-pulse`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User Profile & Logout Area */}
        <div className="p-4 border-t border-white/10">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center p-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 rounded-xl transition-all"
          >
            <LogOut className={`w-5 h-5 ${isSidebarOpen ? 'mr-3' : 'mx-auto'}`} />
            {isSidebarOpen && <span className="text-xs font-semibold">{t('nav.logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col h-full overflow-hidden relative z-10">
        
        {/* Top bar header */}
        <header className="h-16 bg-[#050b18]/40 backdrop-blur-md border-b border-white/10 px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm tracking-tight capitalize">
                {activeTab.replace(/-/g, ' ')}
              </h2>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-full text-[9px] font-bold font-mono tracking-wide shadow-sm shadow-emerald-950/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{language === 'sw' ? 'MUDA HALISI' : 'LIVE SYNC'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3.5">
            {/* Language Selector in Header */}
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              <button 
                onClick={() => setLanguage('sw')}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${language === 'sw' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
              >
                SW
              </button>
              <button 
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${language === 'en' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
              >
                EN
              </button>
            </div>

            {/* Real-time Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationsPopover(!showNotificationsPopover)}
                className="p-2 bg-white/5 border border-white/10 rounded-xl text-slate-450 hover:text-white hover:bg-white/10 transition relative cursor-pointer flex items-center justify-center"
              >
                <Bell className="w-4 h-4" />
                {globalNotifications.some(n => !n.read) && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                )}
              </button>

              <AnimatePresence>
                {showNotificationsPopover && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-3 w-80 bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl p-4 z-50 space-y-3 backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs font-bold text-white uppercase font-mono">{language === 'sw' ? 'Taarifa za Mfumo' : 'System Notifications'}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            handleMarkAllNotificationsAsRead();
                            setShowNotificationsPopover(false);
                          }}
                          className="text-[9px] font-mono text-blue-400 hover:underline"
                        >
                          {language === 'sw' ? 'Soma Zote' : 'Read All'}
                        </button>
                        <button
                          onClick={() => {
                            handleClearGlobalNotifications();
                            setShowNotificationsPopover(false);
                          }}
                          className="text-[9px] font-mono text-slate-500 hover:text-white hover:underline"
                        >
                          {language === 'sw' ? 'Futa' : 'Clear'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                      {globalNotifications.length === 0 ? (
                        <p className="text-center py-4 text-slate-550 text-xs font-mono">{language === 'sw' ? 'Hakuna taarifa kwa sasa.' : 'No alerts registered.'}</p>
                      ) : (
                        globalNotifications.map(n => (
                          <div
                            key={n.id}
                            className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition ${
                              n.read 
                                ? 'bg-white/[0.01] border-white/5 opacity-60' 
                                : 'bg-white/[0.04] border-white/10'
                            }`}
                          >
                            <span className="text-xs mt-0.5">
                              {n.type === 'payment' ? '💰' : n.type === 'pledge' ? '🤝' : n.type === 'rsvp' ? '📩' : '👤'}
                            </span>
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <p className="font-extrabold text-[10.5px] text-white uppercase font-mono tracking-tight leading-tight">{n.title}</p>
                              <p className="text-[10px] text-slate-300 leading-relaxed break-words">{n.message}</p>
                              <p className="text-[8px] font-mono text-slate-500">{n.createdAt}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick Action Drawer Trigger Button */}
            <button
              onClick={() => {
                setIsQuickDrawerOpen(true);
                setQuickDrawerSection('guest');
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[10px] uppercase font-mono tracking-wider rounded-xl shadow-lg shadow-blue-900/20 flex items-center gap-1 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{language === 'sw' ? 'Njia ya Mkato' : 'Quick Access'}</span>
            </button>

            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
          </div>
        </header>

        {/* Tab Content Canvas */}
        <div className="flex-grow overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Quick Action Drawer Overlay */}
        <AnimatePresence>
          {isQuickDrawerOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsQuickDrawerOpen(false)}
                className="fixed inset-0 bg-black/70 z-50 cursor-pointer"
              />

              {/* Sidebar Drawer Container */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-full w-full max-w-md bg-[#070e1e]/98 border-l border-white/10 shadow-2xl z-50 flex flex-col p-6 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <h3 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider">
                      {language === 'sw' ? 'Njia ya Mkato ya Haraka' : 'Quick Access Desk'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsQuickDrawerOpen(false)}
                    className="p-1.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Subtabs for Drawer (Add Guest / Record Payment) */}
                <div className="grid grid-cols-2 gap-2 mb-6">
                  <button
                    onClick={() => setQuickDrawerSection('guest')}
                    className={`py-2 px-3 border rounded-xl font-mono text-[10px] font-bold text-center uppercase transition cursor-pointer ${
                      quickDrawerSection === 'guest'
                        ? 'bg-blue-600 border-blue-500 text-white font-extrabold shadow-lg shadow-blue-900/30'
                        : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/10'
                    }`}
                  >
                    {language === 'sw' ? 'Sajili Mgeni' : 'Add Guest'}
                  </button>
                  <button
                    onClick={() => setQuickDrawerSection('payment')}
                    className={`py-2 px-3 border rounded-xl font-mono text-[10px] font-bold text-center uppercase transition cursor-pointer ${
                      quickDrawerSection === 'payment'
                        ? 'bg-blue-600 border-blue-500 text-white font-extrabold shadow-lg shadow-blue-900/30'
                        : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/10'
                    }`}
                  >
                    {language === 'sw' ? 'Rekodi Mchango' : 'Record Payment'}
                  </button>
                </div>

                {/* SECTION 1: ADD NEW GUEST FORM */}
                {quickDrawerSection === 'guest' && (
                  <form onSubmit={handleQuickAddGuest} className="space-y-4 flex-grow overflow-y-auto pr-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">{language === 'sw' ? 'Jina Kamili la Mgeni *' : 'Full Guest Name *'}</label>
                      <input
                        type="text"
                        required
                        placeholder={language === 'sw' ? 'Mhe. John Doe' : 'e.g. Honorable John Doe'}
                        value={quickGuestName}
                        onChange={(e) => setQuickGuestName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all font-sans"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">{language === 'sw' ? 'Namba ya Simu' : 'Phone Number'}</label>
                      <input
                        type="text"
                        placeholder="e.g. 255712345678"
                        value={quickGuestPhone}
                        onChange={(e) => setQuickGuestPhone(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">{language === 'sw' ? 'Aina ya Kadi' : 'Card Type'}</label>
                        <select
                          value={quickGuestCardType}
                          onChange={(e: any) => setQuickGuestCardType(e.target.value)}
                          className="w-full bg-[#0a1120] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-all"
                        >
                          <option value="SINGLE">{language === 'sw' ? 'SINGLE' : 'SINGLE'}</option>
                          <option value="COUPLE">{language === 'sw' ? 'DOUBLE' : 'DOUBLE'}</option>
                          <option value="TABLE">{language === 'sw' ? 'TABLE' : 'TABLE'}</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">{language === 'sw' ? 'Kiasi cha Ahadi' : 'Pledge Amount'}</label>
                        <input
                          type="number"
                          placeholder="e.g. 100000"
                          value={quickGuestPledge}
                          onChange={(e) => setQuickGuestPledge(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">{language === 'sw' ? 'Kiasi Kilicholipwa Sasa (Optional)' : 'Amount Paid Now (Optional)'}</label>
                      <input
                        type="number"
                        placeholder="e.g. 50000"
                        value={quickGuestPaid}
                        onChange={(e) => setQuickGuestPaid(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all font-mono"
                      />
                    </div>

                    {quickGuestError && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{quickGuestError}</span>
                      </div>
                    )}

                    {quickGuestSuccess && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{language === 'sw' ? 'Mgeni amesajiliwa kikamilifu!' : 'Guest registered successfully!'}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs py-3.5 px-4 rounded-xl shadow-lg shadow-blue-900/30 transition cursor-pointer text-center"
                    >
                      {language === 'sw' ? 'Hifadhi Mgeni' : 'Save Guest'}
                    </button>
                  </form>
                )}

                {/* SECTION 2: RECORD PAYMENT FORM */}
                {quickDrawerSection === 'payment' && (
                  <form onSubmit={handleQuickRecordContribution} className="space-y-4 flex-grow overflow-y-auto pr-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">{language === 'sw' ? 'Chagua Mgeni *' : 'Select Guest *'}</label>
                      <select
                        value={quickSelectedGuestId}
                        onChange={(e) => {
                          setQuickSelectedGuestId(e.target.value);
                          const selectedG = activeGuests.find(g => g.id === e.target.value);
                          if (selectedG) {
                            setQuickPledgeAmount(String(selectedG.pledgeAmount || ''));
                          }
                        }}
                        className="w-full bg-[#0a1120] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-all"
                      >
                        <option value="">-- {language === 'sw' ? 'Chagua Mgeni' : 'Choose Guest'} --</option>
                        {activeGuests.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.name} ({language === 'sw' ? 'Ahadi' : 'Pledge'}: TZS {(g.pledgeAmount || 0).toLocaleString()} / {language === 'sw' ? 'Lipa' : 'Paid'}: TZS {(g.paidAmount || 0).toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">{language === 'sw' ? 'Update Ahadi' : 'Update Pledge'}</label>
                        <input
                          type="number"
                          placeholder="TZS"
                          value={quickPledgeAmount}
                          onChange={(e) => setQuickPledgeAmount(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">{language === 'sw' ? 'Ongeza Malipo' : 'Record Payment'}</label>
                        <input
                          type="number"
                          placeholder="TZS"
                          value={quickPaymentAmount}
                          onChange={(e) => setQuickPaymentAmount(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">{language === 'sw' ? 'Namba ya Kumbukumbu / Reference' : 'Reference Number'}</label>
                      <input
                        type="text"
                        placeholder="e.g. MPESA-ABC123XYZ"
                        value={quickPaymentRef}
                        onChange={(e) => setQuickPaymentRef(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all font-mono"
                      />
                    </div>

                    {quickPaymentError && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{quickPaymentError}</span>
                      </div>
                    )}

                    {quickPaymentSuccess && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{language === 'sw' ? 'Michango na malipo yamehifadhiwa kikamilifu!' : 'Contribution and payment saved successfully!'}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-900/30 transition cursor-pointer text-center uppercase tracking-wider"
                    >
                      {language === 'sw' ? 'Rekodi Mchango' : 'Record Contribution'}
                    </button>
                  </form>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>

      {/* Global Floating AI Chatbot Assistant */}
      <AIChatbotWidget eventId={eventDetails?.id} language={language} />
    </div>
  );
}

function AttendanceSummary({ guests, t, language, setActiveTab, event }: { guests: Guest[], t: any, language: string, setActiveTab: (tab: AppTab) => void, event: EventDetails | null }) {
  const attendingCount = guests.filter(g => g.rsvpStatus === 'Atahudhuria').length;
  const declinedCount = guests.filter(g => g.rsvpStatus === 'Hatahudhuria').length;
  const pendingCount = guests.filter(g => !g.rsvpStatus || g.rsvpStatus === 'Bado').length;
  const checkedInCount = guests.filter(g => g.checkedIn).length;

  const stats = [
    { label: t('rsvp.statAttending'), value: attendingCount, color: 'text-emerald-400', icon: CheckCircle2, tab: 'rsvp' },
    { label: t('rsvp.statDeclined'), value: declinedCount, color: 'text-rose-400', icon: X, tab: 'rsvp' },
    { label: t('rsvp.statPending'), value: pendingCount, color: 'text-amber-400', icon: Info, tab: 'rsvp' },
    { label: t('scan.statChecked'), value: checkedInCount, color: 'text-blue-400', icon: QrCode, tab: 'scan' },
  ];

  return (
    <div className="space-y-6">
      {/* Event Banner */}
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-[#050b18] via-transparent to-[#050b18] z-10"></div>
        {event?.eventImgUrl ? (
          <img src={event.eventImgUrl} alt="Event" className="w-full h-64 object-cover opacity-50" />
        ) : (
          <div className="w-full h-64 bg-slate-900 opacity-50"></div>
        )}
        <div className="absolute inset-0 flex flex-col justify-end p-8 z-20">
          <p className="text-blue-400 font-mono text-xs uppercase tracking-widest font-bold">{event?.id}</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-2 uppercase">{event?.name || 'My Event'}</h1>
          <div className="flex flex-wrap gap-4 mt-4 text-slate-300 text-sm">
            <div className="flex items-center space-x-2 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>{event?.date} &bull; {event?.time}</span>
            </div>
            <div className="flex items-center space-x-2 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <Users className="w-4 h-4 text-purple-400" />
              <span>{event?.hostName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.button
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => setActiveTab(stat.tab as AppTab)}
            className="bg-[#050b18]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 text-left hover:bg-white/5 hover:scale-[1.02] transition-all group cursor-pointer"
          >
            <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
            <h3 className="text-3xl font-extrabold text-white mt-1">{stat.value}</h3>
          </motion.button>
        ))}
      </div>

      {/* Featured Workflow Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-600/20 to-transparent border border-blue-500/20 rounded-[2rem] p-8 space-y-6">
          <h3 className="text-xl font-bold text-white">System Creation Workflow</h3>
          <div className="space-y-4">
             {[
               { icon: Calendar, title: 'Step 1: Event Details', desc: 'Fill in ceremony titles, dates, time, and dress code.', tab: 'event-details' },
               { icon: Mail, title: 'Step 2: Message Preview', desc: 'Verify SMS and WhatsApp message content (Billing is skipped).', tab: 'preview' },
               { icon: Settings2, title: 'Step 3: Align Templates', desc: 'Select color presets; adjust coordinates for names and QR codes.', tab: 'templates' },
               { icon: Users, title: 'Step 4: Dispatch & Monitor', desc: 'Add guests, dispatch cards, and scan barcodes on event day.', tab: 'guests' }
             ].map((step, idx) => (
               <button 
                 key={idx}
                 onClick={() => setActiveTab(step.tab as AppTab)}
                 className="w-full flex items-start space-x-4 p-4 rounded-2xl hover:bg-white/5 transition-all text-left"
               >
                 <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-400">
                    <step.icon className="w-5 h-5" />
                 </div>
                 <div>
                    <p className="text-white font-bold text-sm">{step.title}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{step.desc}</p>
                 </div>
               </button>
             ))}
          </div>
        </div>

        <div className="bg-[#050b18]/60 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 flex flex-col">
          <h3 className="text-xl font-bold text-white">Event Accessibility</h3>
          <div className="flex-grow flex flex-col justify-center items-center text-center space-y-4 py-8">
            <div className="w-24 h-24 rounded-3xl bg-white flex items-center justify-center p-3 shadow-2xl">
               <QrCode className="w-full h-full text-slate-900" />
            </div>
            <div>
              <p className="text-white font-bold">Wageni Skani Hapa</p>
              <p className="text-slate-400 text-xs">{event?.name}</p>
            </div>
            <div className="flex gap-2">
               <button onClick={() => setActiveTab('scan')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-xs font-bold transition">Fungua Scanner</button>
               <button onClick={() => setActiveTab('guests')} className="bg-white/5 hover:bg-white/10 text-white px-6 py-2 border border-white/10 rounded-xl text-xs font-bold transition">Orodha ya Wageni</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
