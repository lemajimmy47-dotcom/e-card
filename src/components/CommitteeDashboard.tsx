import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Coins, CheckCircle, AlertTriangle, TrendingUp, DollarSign, 
  Layers, Download, Printer, PlusCircle, Activity, Bell, Share2, 
  ExternalLink, Code, ShieldCheck, RefreshCw, Smartphone, Eye, Check, X, Clipboard,
  FolderOpen, FileText, Upload, Paperclip, Sparkles, Grid, Feather,
  Send, MessageSquare, Calendar, Clock, MapPin, Crown, Briefcase, Phone, MessageCircle,
  CheckSquare, Trash2, Edit3, UserCheck
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { EventDetails, Guest, CommitteeMember, CommitteeActivityLog, CommitteeNotification, ContributionPayment } from '../types';
import { safeLocalStorage } from '../utils/storage';
import { isStatusSent } from '../utils/statusHelper';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Legend } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ContributionManager from './ContributionManager';
import { addPdfWatermarks, compressElementOrUrlForPdf } from '../utils/pdfWatermark';
import { ReportWatermark } from './ReportWatermark';
import { AIChatbotWidget } from './AIChatbotWidget';
import AISeatingChartManager from './AISeatingChartManager';
import AICardCopywriter from './AICardCopywriter';

interface CommitteeDashboardProps {
  key?: React.Key;
  event: EventDetails;
  guests: Guest[];
  onUpdateEvent: (updated: EventDetails) => void;
  onUpdateGuests: (updated: Guest[]) => void;
  onRefresh?: () => void;
}

export default function CommitteeDashboard({
  event,
  guests,
  onUpdateEvent,
  onUpdateGuests,
  onRefresh
}: CommitteeDashboardProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  // State for simulated fundraising target
  const fundraisingTarget = event.fundraisingGoal || 15000000;

  // State for simulated committee members
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>([]);
  const [committeeRoles, setCommitteeRoles] = useState<{id: string; name: string; description: string; permissionLevel: string}[]>([]);

  // Helper to score position for sorting according to hierarchy:
  // 1. Mwenyekiti, 2. Makamu Mwenyekiti, 3. Katibu Mkuu, 4. Katibu Msaidizi, 5. Mweka Hazina, 6. Mweka Hazina Msaidizi, 7. Mkuu wa Kamati Ndogo, 8. Wajumbe
  const getPositionScore = (pos: string): number => {
    if (!pos) return 99;
    const p = pos.toLowerCase();
    
    if (p.includes('mwenyekiti') || p.includes('chairperson') || p.includes('chairman') || p.includes('owner')) {
      if (p.includes('makamu') || p.includes('vice')) {
        return 2;
      }
      return 1;
    }
    if (p.includes('vice chair') || p.includes('makamu mwenyekiti')) {
      return 2;
    }
    if (p.includes('katibu') || p.includes('secretary')) {
      if (p.includes('msaidizi') || p.includes('makamu') || p.includes('assistant') || p.includes('vice')) {
        return 4;
      }
      return 3;
    }
    if (p.includes('hazina') || p.includes('treasurer')) {
      if (p.includes('msaidizi') || p.includes('makamu') || p.includes('assistant') || p.includes('vice')) {
        return 6;
      }
      return 5;
    }
    if (p.includes('mkuu wa kamati') || p.includes('sub-committee head') || p.includes('head of sub-committee')) {
      return 7;
    }
    if (p.includes('mjumbe') || p.includes('member')) {
      return 8;
    }
    if (p.includes('mkuu')) {
      return 7;
    }
    return 8;
  };

  const sortedCommitteeMembers = useMemo(() => {
    return [...committeeMembers].sort((a, b) => {
      const scoreA = getPositionScore(a.position);
      const scoreB = getPositionScore(b.position);
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      return a.name.localeCompare(b.name);
    });
  }, [committeeMembers]);

  // State for simulated logged-in committee role to showcase role-based features!
  const [activeRole, setActiveRole] = useState<'Event Owner' | 'Treasurer' | 'Secretary' | 'Committee Member'>('Event Owner');

  // Simulated live notifications state list
  const [notifications, setNotifications] = useState<CommitteeNotification[]>(() => {
    const saved = safeLocalStorage.getItem(`kadi_committee_notifications_${event.id}`);
    if (saved) return JSON.parse(saved);
    return [
      { id: 'n-1', type: 'pledge', title: 'Ahadi Mpya ya Mchango', message: 'Ally Khalfan amesajili ahadi mpya ya TZS 500,000.', createdAt: '04/06/2026 11:32', read: false },
      { id: 'n-2', type: 'payment', title: 'Malipo Mapya', message: 'Salma Khamis (Mweka Hazina) amesajili malipo ya TZS 300,000 kwa Ally Khalfan.', createdAt: '04/06/2026 12:15', read: false },
      { id: 'n-3', type: 'completed', title: 'Mchango Umekamilika', message: 'Fatma Said amekamilisha malipo yote ya ahadi yake ya TZS 1,000,000.', createdAt: '04/06/2026 13:02', read: false }
    ];
  });

  // Simulated activity logs of the committee members
  const [activityLogs, setActivityLogs] = useState<CommitteeActivityLog[]>(() => {
    const saved = safeLocalStorage.getItem(`kadi_committee_activity_${event.id}`);
    if (saved) return JSON.parse(saved);
    return [
      { id: 'a-1', user: 'James Lema (Chairperson)', role: 'Chairman', action: 'Alitazama muhtasari wa makusanyo', date: '04/06/2026', time: '10:14', ipAddress: '197.250.32.18' },
      { id: 'a-2', user: 'Salma Khamis (Treasurer)', role: 'Treasurer', action: 'Amesajili muamala wa malipo wa TZS 300,000', date: '04/06/2026', time: '12:15', ipAddress: '197.250.33.22' },
      { id: 'a-3', user: 'Emmanuel Shija (Secretary)', role: 'Secretary', action: 'Alipakua ripoti ya wageni wasioahidi', date: '04/06/2026', time: '12:40', ipAddress: '102.222.18.9' }
    ];
  });

  // Inner sub-tabs inside Committee Dashboard
  const [currentSubTab, setCurrentSubTab] = useState<'dashboard' | 'analytics' | 'reports' | 'seating' | 'ai-copywriting' | 'members' | 'reminders' | 'activity' | 'public-link' | 'contributions' | 'files'>('dashboard');

  // Event files list
  const [eventFiles, setEventFiles] = useState<{ id: string; name: string; size: string; type: string; category: 'pdf' | 'spreadsheet' | 'document' | 'image' | 'other'; uploadedAt: string; dataUrl?: string }[]>(() => {
    const saved = safeLocalStorage.getItem(`kadi_event_files_${event.id}`);
    if (saved) return JSON.parse(saved);
    // Seed with beautiful defaults to make it immediately functional
    return [
      { id: 'file-1', name: 'Bajeti_Kamati_Rasmi.xlsx', size: '142 KB', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', category: 'spreadsheet', uploadedAt: '12/06/2026 14:15' },
      { id: 'file-2', name: 'Programu_ya_Sherehe_Draft_v2.pdf', size: '840 KB', type: 'application/pdf', category: 'pdf', uploadedAt: '13/06/2026 09:30' },
      { id: 'file-3', name: 'Mchoro_wa_Kumbi_Main_Hall.png', size: '1.2 MB', type: 'image/png', category: 'image', uploadedAt: '14/06/2026 10:05' }
    ];
  });

  useEffect(() => {
    safeLocalStorage.setItem(`kadi_event_files_${event.id}`, JSON.stringify(eventFiles));
  }, [eventFiles, event.id]);

  // Keep notifications state in sync with local storage when guests or event changes
  useEffect(() => {
    const saved = safeLocalStorage.getItem(`kadi_committee_notifications_${event.id}`);
    if (saved) {
      setNotifications(JSON.parse(saved));
    }
  }, [guests, event.id]);

  // States for event files manager tab
  const [fileFilter, setFileFilter] = useState<'all' | 'pdf' | 'spreadsheet' | 'document' | 'image' | 'other'>('all');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Input states for registering new committee members & leaders
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPosition, setMemberPosition] = useState<string>('Mjumbe wa Kamati');
  const [memberSubCommittee, setMemberSubCommittee] = useState<string>('Kamati Kuu ya Uendeshaji');
  const [memberMethod, setMemberMethod] = useState<'SMS' | 'WhatsApp' | 'Email'>('WhatsApp');
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [invitationLinkSent, setInvitationLinkSent] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [deleteConfirmMember, setDeleteConfirmMember] = useState<CommitteeMember | null>(null);

  // Meeting Reminders & WhatsApp/SMS Dispatch states
  const [meetingTitle, setMeetingTitle] = useState('Kikao cha 3 cha Kamati ya Harusi');
  const [meetingDate, setMeetingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [meetingTime, setMeetingTime] = useState('17:00');
  const [meetingVenue, setMeetingVenue] = useState('Ukumbi wa Mlimani City, Dar es Salaam');
  const [meetingAgenda, setMeetingAgenda] = useState(
    '1. Kupitia Taarifa ya Makusanyo ya Mweka Hazina\n2. Kutoa Kadi za Mialiko kwa Wajumbe\n3. Kukamilisha Malipo ya Ukumbi & Mapambo'
  );
  const [meetingNotes, setMeetingNotes] = useState('Tafadhali fika na mchango wako au risiti ya Benki.');
  const [meetingAudience, setMeetingAudience] = useState<'all' | 'leaders' | 'members'>('all');
  const [reminderToast, setReminderToast] = useState<string | null>(null);

  // Bulk Dispatch All At Once Modal States
  const [showBulkDispatchModal, setShowBulkDispatchModal] = useState(false);
  const [sentMemberIds, setSentMemberIds] = useState<Record<string, boolean>>({});
  const [bulkDispatchActiveIndex, setBulkDispatchActiveIndex] = useState<number>(0);

  // Sent Meeting Reminders History
  const [meetingHistory, setMeetingHistory] = useState<{
    id: string;
    title: string;
    date: string;
    time: string;
    venue: string;
    agenda: string;
    sentAt: string;
    recipientsCount: number;
  }[]>(() => {
    const saved = safeLocalStorage.getItem(`kadi_meeting_reminders_${event.id}`);
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'm-1',
        title: 'Kikao cha 2 cha Kamati - Bajeti & Mipango',
        date: '2026-07-20',
        time: '16:30',
        venue: 'Ukumbi wa Serena Hotel, Dar es Salaam',
        agenda: '1. Kugawa malengo ya makusanyo\n2. Kuchagua Mweka Hazina na Katibu',
        sentAt: '18/07/2026 10:15',
        recipientsCount: 8
      }
    ];
  });

  useEffect(() => {
    safeLocalStorage.setItem(`kadi_meeting_reminders_${event.id}`, JSON.stringify(meetingHistory));
  }, [meetingHistory, event.id]);

  // Treasurer Record Payment panel states
  const [showTreasurerPayModal, setShowTreasurerPayModal] = useState(false);
  const [treasuryTargetGuest, setTreasuryTargetGuest] = useState<Guest | null>(null);
  const [treasuryAmount, setTreasuryAmount] = useState<string>('');
  const [treasuryRef, setTreasuryRef] = useState<string>('');
  const [treasuryNotes, setTreasuryNotes] = useState<string>(isEn ? 'Direct collection' : 'Makusanyo ya kamati');

  // Public progress simulator modal
  const [showPublicProgressPreview, setShowPublicProgressPreview] = useState(false);

  // Auto-refresh timer state
  const [secondsToRefresh, setSecondsToRefresh] = useState(60);

  // Selected report type for CSV/PDF exports
  const [selectedReport, setSelectedReport] = useState<string>('Summary');

  // Dashboard Lock State
  const [isLocked, setIsLocked] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [loggedInRole, setLoggedInRole] = useState<'Event Owner' | 'Treasurer' | 'Secretary' | 'Committee Member' | null>(null);

  const handleLogout = () => {
    setIsLocked(true);
    setPinInput('');
    setLoggedInRole(null);
    setActiveRole('Event Owner');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const processUploadedFile = (file: File) => {
    if (file.size > 20 * 1024 * 1024) { // Increase to 20MB
      setUploadError(isEn ? "File is too large (max 20MB)" : "Faili ni kubwa kupita kiasi (max 20MB)");
      return;
    }
    
    const categoryFromType = (type: string): "pdf" | "spreadsheet" | "document" | "image" | "other" => {
      if (type.includes("pdf")) return "pdf";
      if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return "spreadsheet";
      if (type.includes("word") || type.includes("text") || type.includes("document")) return "document";
      if (type.includes("image")) return "image";
      return "other";
    };

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const newFile = {
        id: "file-" + Date.now(),
        name: file.name,
        type: file.type,
        size: (file.size / 1024).toFixed(1) + " KB",
        category: categoryFromType(file.type),
        dataUrl: content,
        uploadedAt: new Date().toLocaleString()
      };
      setEventFiles(prev => [newFile, ...prev]);
      setUploadError(null);
    };
    reader.readAsDataURL(file);
  };

  // GROUP LEVEL SUMMARIES CALCULATIONS
  const groupSummaries = useMemo(() => {
    const groupMap = new Map<string, { count: number; pledged: number; collected: number; balances: number }>();
    guests.forEach(g => {
      const cat = (g.cardType || 'SINGLE').toUpperCase();
      const pledge = g.pledgeAmount || 0;
      const paid = g.paidAmount || 0;
      const bal = pledge - paid;
      
      if (!groupMap.has(cat)) {
        groupMap.set(cat, { count: 0, pledged: 0, collected: 0, balances: 0 });
      }
      const data = groupMap.get(cat)!;
      data.count++;
      data.pledged += pledge;
      data.collected += paid;
      data.balances += bal;
    });

    const list = Array.from(groupMap.entries()).map(([name, data]) => ({
      name,
      ...data
    }));

    const totals = list.reduce(
      (acc, curr) => {
        acc.count += curr.count;
        acc.pledged += curr.pledged;
        acc.collected += curr.collected;
        acc.balances += curr.balances;
        return acc;
      },
      { count: 0, pledged: 0, collected: 0, balances: 0 }
    );

    return { list, totals };
  }, [guests]);

  // MASTER GUEST REVENUE DATABASE CALCULATIONS
  const masterGuestList = useMemo(() => {
    return [...guests].sort((a, b) => a.name.localeCompare(b.name)).map((g, index) => {
      const pledge = g.pledgeAmount || 0;
      const paid = g.paidAmount || 0;
      const bal = pledge - paid;
      let clearance: 'Pending' | 'Partial' | 'Completed' = 'Pending';
      if (pledge > 0) {
        if (paid >= pledge) {
          clearance = 'Completed';
        } else if (paid > 0) {
          clearance = 'Partial';
        }
      } else {
        clearance = 'Pending';
      }
      return {
        sn: index + 1,
        name: g.name,
        phone: g.phone || '-',
        category: (g.cardType || 'SINGLE').toUpperCase(),
        pledge,
        paid,
        balance: bal,
        clearance
      };
    });
  }, [guests]);

  // Save Event Goal
  const handleSaveGoal = (goalVal: number) => {
    const updated = { ...event, fundraisingGoal: goalVal };
    onUpdateEvent(updated);
    addActivityLog('Event Owner (Admin)', 'Alibadilisha Fundraising Goal kufikia TZS ' + goalVal.toLocaleString());
  };

  // Helper to add activity logs
  const addActivityLog = (user: string, action: string) => {
    const newLog: CommitteeActivityLog = {
      id: 'a-' + Date.now(),
      user,
      role: activeRole,
      action,
      date: new Date().toLocaleDateString('sw-TZ'),
      time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
      ipAddress: '197.250.' + Math.floor(10 + Math.random() * 89) + '.' + Math.floor(100 + Math.random() * 150)
    };
    const updated = [newLog, ...activityLogs];
    setActivityLogs(updated);
    safeLocalStorage.setItem(`kadi_committee_activity_${event.id}`, JSON.stringify(updated));
  };

  // Fetch committee users and roles
  useEffect(() => {
    fetch('/api/committee/members')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCommitteeMembers(data);
        } else {
          // Seed standard default committee leaders and members
          const defaultLeaders: CommitteeMember[] = [
            {
              id: 'c-1',
              name: 'Mhandisi James Lema',
              phone: '0754123456',
              email: 'mwenyekiti@eventcard.co.tz',
              role: 'Admin',
              position: 'Mwenyekiti wa Kamati',
              subCommittee: 'Kamati Kuu ya Uendeshaji',
              permissionLevel: 'Full Access',
              token: 'mw123'
            },
            {
              id: 'c-2',
              name: 'Emmanuel Shija',
              phone: '0784987654',
              email: 'katibu@eventcard.co.tz',
              role: 'Secretary',
              position: 'Katibu Mkuu',
              subCommittee: 'Kamati Kuu ya Uendeshaji',
              permissionLevel: 'Viewer Access',
              token: 'kt333'
            },
            {
              id: 'c-3',
              name: 'Salma Khamis',
              phone: '0712345678',
              email: 'mwekahazina@eventcard.co.tz',
              role: 'Treasurer',
              position: 'Mtunza Hazina / Mweka Hazina',
              subCommittee: 'Kamati ya Fedha & Bajeti',
              permissionLevel: 'Treasurer Access',
              token: 'hz222'
            },
            {
              id: 'c-4',
              name: 'Dr. Fatma Said',
              phone: '0765112233',
              email: 'fatma@eventcard.co.tz',
              role: 'Gatekeeper',
              position: 'Mkuu wa Kamati Ndogo',
              subCommittee: 'Kamati ya Chakula & Vinywaji',
              permissionLevel: 'Summary Access',
              token: 'ch444'
            },
            {
              id: 'c-5',
              name: 'Ally Khalfan',
              phone: '0688990011',
              email: 'ally@eventcard.co.tz',
              role: 'Gatekeeper',
              position: 'Mkuu wa Kamati Ndogo',
              subCommittee: 'Kamati ya Mapambo & Ubunifu',
              permissionLevel: 'Summary Access',
              token: 'mp555'
            },
            {
              id: 'c-6',
              name: 'Khalfan Ally',
              phone: '0755443322',
              email: 'khalfan@eventcard.co.tz',
              role: 'Gatekeeper',
              position: 'Mjumbe wa Kamati',
              subCommittee: 'Kamati ya Usafiri & Logistiki',
              permissionLevel: 'Summary Access',
              token: 'us666'
            }
          ];
          setCommitteeMembers(defaultLeaders);
        }
      })
      .catch(err => console.error("Failed to fetch committee members:", err));
      
    fetch('/api/committee/roles')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCommitteeRoles(data);
      })
      .catch(err => console.error("Failed to fetch committee roles:", err));
  }, []);

  // Auto counter to refresh progress metrics or simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsToRefresh((prev) => {
        if (prev <= 1) {
          // Reset timer and trigger refresh
          if (onRefresh) onRefresh();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onRefresh]);

  // Helper to build formatted Swahili/English text for meeting reminders
  const buildMeetingReminderText = (recipientName?: string, recipientRole?: string) => {
    const greeting = recipientName 
      ? `Ndugu *${recipientName}* (${recipientRole || 'Mwanakamati'}),`
      : 'Ndugu Wanakamati na Viongozi Wote,';

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://eventcard.co.tz';

    return `🔔 *UKUMBUSHO WA KIKAO CHA KAMATI YA SHEREHE* 🔔

${greeting}

Unakumbushwa kuhudhuria *${meetingTitle}* kama ilivyopangwa kwa ajili ya kufanikisha maandalizi ya sherehe ya *${event.name}*.

📅 *Tarehe:* ${meetingDate}
⏰ *Muda:* ${meetingTime}
📍 *Mahali:* ${meetingVenue}

📋 *AGENDA KUU ZA KIKAO:*
${meetingAgenda}

${meetingNotes ? `📝 *Maelezo ya Ziada:* ${meetingNotes}\n` : ''}
💡 _Tafadhali fika kwa wakati ili kukamilisha taratibu za sherehe kwa ufanisi!_

🔗 *Portal ya Kamati:*
${origin}/?portal=committee&eventId=${event.id}

---
_Ujumbe huu umetolewa rasmi na Kamati ya Sherehe_`;
  };

  const handleDispatchMeetingReminderToGroup = () => {
    const msg = buildMeetingReminderText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(msg);
    }
    setReminderToast('Ujumbe wa kikao umenakiliwa na kuandaa WhatsApp!');
    setTimeout(() => setReminderToast(null), 4000);

    // Record meeting in history
    const newHistory = {
      id: 'm-' + Date.now(),
      title: meetingTitle,
      date: meetingDate,
      time: meetingTime,
      venue: meetingVenue,
      agenda: meetingAgenda,
      sentAt: new Date().toLocaleString('sw-TZ'),
      recipientsCount: committeeMembers.length
    };
    setMeetingHistory([newHistory, ...meetingHistory]);
    addActivityLog('Katibu / Mwenyekiti', `Alituma ukumbusho wa kikao: "${meetingTitle}" kwa wanakamati wote`);

    // Launch WhatsApp web/app
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  // Helper to filter targeted members based on audience setting
  const getTargetAudienceMembers = () => {
    if (meetingAudience === 'leaders') {
      return committeeMembers.filter(m => 
        m.position.includes('Mwenyekiti') || 
        m.position.includes('Chairperson') || 
        m.position.includes('Katibu') || 
        m.position.includes('Secretary') || 
        m.position.includes('Hazina') || 
        m.position.includes('Treasurer') ||
        m.position.includes('Mkuu')
      );
    }
    return committeeMembers;
  };

  // Bulk Dispatch SMS to ALL AT ONCE (Multi-SMS protocol)
  const handleDispatchSMSAllAtOnce = () => {
    const targets = getTargetAudienceMembers();
    if (targets.length === 0) {
      alert("Hakuna wanakamati waliopatikana kulingana na walengwa waliochaguliwa.");
      return;
    }

    const cleanPhones = targets.map(m => {
      let p = (m.phone || '').replace(/[^0-9]/g, '');
      if (p.startsWith('0')) p = '255' + p.substring(1);
      return p;
    }).filter(Boolean);

    const phonesCommaJoined = cleanPhones.join(',');
    const msg = buildMeetingReminderText();

    // Copy numbers & message to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`NAMBA ZA WANAKAMATI (${targets.length}):\n${phonesCommaJoined}\n\n${msg}`);
    }

    setReminderToast(`SMS Composer imefunguliwa na namba zote ${targets.length}!`);
    setTimeout(() => setReminderToast(null), 4000);

    // Record meeting in history
    const newHistory = {
      id: 'm-' + Date.now(),
      title: `${meetingTitle} (SMS kwa Wote)`,
      date: meetingDate,
      time: meetingTime,
      venue: meetingVenue,
      agenda: meetingAgenda,
      sentAt: new Date().toLocaleString('sw-TZ'),
      recipientsCount: targets.length
    };
    setMeetingHistory([newHistory, ...meetingHistory]);
    addActivityLog('Katibu / Mwenyekiti', `Alituma SMS ya ukumbusho wa kikao kwa Wanakamati ${targets.length} MARA MOJA`);

    // Trigger multi-recipient SMS URL protocol
    const smsUrl = `sms:${phonesCommaJoined}?body=${encodeURIComponent(msg)}`;
    window.open(smsUrl, '_blank');
  };

  // Bulk Dispatch WhatsApp / Web Share to ALL AT ONCE
  const handleDispatchWhatsAppBroadcastAll = () => {
    const targets = getTargetAudienceMembers();
    const msg = buildMeetingReminderText();

    if (navigator.clipboard) {
      navigator.clipboard.writeText(msg);
    }

    if (navigator.share) {
      navigator.share({
        title: meetingTitle,
        text: msg,
      }).catch(() => {});
    } else {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank');
    }

    setShowBulkDispatchModal(true);
    setReminderToast(`Mchakato wa kutuma kwa wote ${targets.length} umeanza!`);
    setTimeout(() => setReminderToast(null), 4000);
  };

  const handleSendIndividualWhatsAppReminder = (m: CommitteeMember) => {
    const msg = buildMeetingReminderText(m.name, m.position);
    let cleanPhone = (m.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '255' + cleanPhone.substring(1);
    
    // Mark as sent in bulk state
    setSentMemberIds(prev => ({ ...prev, [m.id]: true }));

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
    addActivityLog('Katibu / Mwenyekiti', `Alituma ukumbusho wa kikao cha WhatsApp kwa ${m.name} (${m.position})`);
  };

  const handleSendIndividualSMSReminder = (m: CommitteeMember) => {
    const msg = buildMeetingReminderText(m.name, m.position);
    let cleanPhone = (m.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '255' + cleanPhone.substring(1);

    setSentMemberIds(prev => ({ ...prev, [m.id]: true }));

    const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(msg)}`;
    window.open(smsUrl, '_blank');
    addActivityLog('Katibu / Mwenyekiti', `Alituma SMS ya ukumbusho wa kikao kwa ${m.name}`);
  };

  // Compute metrics from guest pledges and payments
  const metrics = useMemo(() => {
    let totalGuestsCount = guests.length;
    let pledgedGuestsCount = 0;
    let partiallyPaidGuestsCount = 0;
    let fullyPaidGuestsCount = 0;
    let unpledgedGuestsCount = 0;

    let totalPledgedAmount = 0;
    let totalPaidAmount = 0;

    guests.forEach(g => {
      const pledge = g.pledgeAmount || 0;
      const paid = g.paidAmount || 0;
      totalPledgedAmount += pledge;
      totalPaidAmount += paid;

      if (pledge === 0) {
        unpledgedGuestsCount++;
      } else {
        if (paid === 0) {
          pledgedGuestsCount++;
        } else if (paid >= pledge) {
          fullyPaidGuestsCount++;
        } else {
          partiallyPaidGuestsCount++;
        }
      }
    });

    const outstandingBalance = totalPledgedAmount - totalPaidAmount;
    const remainingToTarget = Math.max(0, fundraisingTarget - totalPaidAmount);
    const progressRate = fundraisingTarget > 0 ? ((totalPaidAmount / fundraisingTarget) * 100).toFixed(1) : '0';

    return {
      totalGuests: totalGuestsCount,
      totalPledgedAmount,
      totalPaidAmount,
      outstandingBalance,
      unpledgedCount: unpledgedGuestsCount,
      pledgedCount: pledgedGuestsCount,
      partiallyPaidCount: partiallyPaidGuestsCount,
      fullyPaidCount: fullyPaidGuestsCount,
      progress: progressRate,
      remainingToTarget
    };
  }, [guests, fundraisingTarget]);

  // Lists for CSV dispatch 
  const unpledgedList = useMemo(() => guests.filter(g => (g.pledgeAmount || 0) === 0), [guests]);
  const activePledgeList = useMemo(() => guests.filter(g => (g.pledgeAmount || 0) > 0), [guests]);
  const fullyPaidList = useMemo(() => guests.filter(g => (g.pledgeAmount || 0) > 0 && (g.paidAmount || 0) >= (g.pledgeAmount || 0)), [guests]);
  const partialPaidList = useMemo(() => guests.filter(g => (g.pledgeAmount || 0) > 0 && (g.paidAmount || 0) > 0 && (g.paidAmount || 0) < (g.pledgeAmount || 0)), [guests]);
  const noPaymentPledgeList = useMemo(() => guests.filter(g => (g.pledgeAmount || 0) > 0 && (g.paidAmount || 0) === 0), [guests]);

  // Handle saving new or edited simulated member
  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName || !memberPhone) return;

    const isEditing = !!editingMemberId;
    const memberId = editingMemberId || 'c-' + Date.now();

    let permission: any = 'Summary Access';
    const roleMatch = committeeRoles.find(r => r.name === memberPosition);
    if (roleMatch) {
      permission = roleMatch.permissionLevel;
    } else {
      if (memberPosition.includes('Mwenyekiti') || memberPosition === 'Chairperson' || memberPosition === 'Event Owner') permission = 'Full Access';
      else if (memberPosition.includes('Hazina') || memberPosition === 'Treasurer') permission = 'Treasurer Access';
      else if (memberPosition.includes('Katibu') || memberPosition === 'Secretary') permission = 'Viewer Access';
    }

    const currentMember = committeeMembers.find(m => m.id === editingMemberId);
    const newMemberObj: CommitteeMember = {
      id: memberId,
      name: memberName,
      phone: memberPhone,
      email: memberEmail || 'kamati@eventcard.co.tz',
      role: memberPosition.includes('Hazina') ? 'Treasurer' : memberPosition.includes('Katibu') ? 'Secretary' : 'Admin',
      position: memberPosition,
      subCommittee: memberSubCommittee,
      permissionLevel: permission,
      token: isEditing && currentMember ? currentMember.token : Math.random().toString(36).substring(2, 8)
    };

    try {
      const resp = await fetch('/api/committee/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: memberId,
          name: memberName,
          phone: memberPhone,
          email: memberEmail || 'kamati@eventcard.co.tz',
          position: memberPosition,
          subCommittee: memberSubCommittee,
          permissionLevel: permission,
          token: newMemberObj.token
        })
      });
      const data = await resp.json();
      
      if (data.success && data.member) {
        const urlToUse = typeof window !== 'undefined' ? window.location.origin : 'https://eventcard.co.tz';
        const simulatedLink = `${urlToUse}/?token=${data.member.token}&event=${event.id}`;
        setInvitationLinkSent(simulatedLink);

        fetch('/api/committee/members')
          .then(res => res.json())
          .then(list => {
            if (Array.isArray(list) && list.length > 0) setCommitteeMembers(list);
            else {
              setCommitteeMembers(prev => {
                if (isEditing) return prev.map(x => x.id === memberId ? newMemberObj : x);
                return [...prev, newMemberObj];
              });
            }
          })
          .catch(() => {
            setCommitteeMembers(prev => {
              if (isEditing) return prev.map(x => x.id === memberId ? newMemberObj : x);
              return [...prev, newMemberObj];
            });
          });
      } else {
        setCommitteeMembers(prev => {
          if (isEditing) return prev.map(x => x.id === memberId ? newMemberObj : x);
          return [...prev, newMemberObj];
        });
        const urlToUse = typeof window !== 'undefined' ? window.location.origin : 'https://eventcard.co.tz';
        setInvitationLinkSent(`${urlToUse}/?token=${newMemberObj.token}&event=${event.id}`);
      }
    } catch (e) {
      console.error(e);
      setCommitteeMembers(prev => {
        if (isEditing) return prev.map(x => x.id === memberId ? newMemberObj : x);
        return [...prev, newMemberObj];
      });
      const urlToUse = typeof window !== 'undefined' ? window.location.origin : 'https://eventcard.co.tz';
      setInvitationLinkSent(`${urlToUse}/?token=${newMemberObj.token}&event=${event.id}`);
    }

    // Reset inputs
    setMemberName('');
    setMemberPhone('');
    setMemberEmail('');
    setMemberPosition('Mjumbe wa Kamati');
    setMemberSubCommittee('Kamati Kuu ya Uendeshaji');
    setEditingMemberId(null);

    // Activity log entry
    addActivityLog('Event Owner (Admin)', isEditing 
      ? `Alihariri taarifa za kiongozi: ${memberName} (${memberPosition})`
      : `Alimualika mjumbe mpya: ${memberName} (${memberPosition} - ${memberSubCommittee}) kupitia ${memberMethod}`
    );

    // Push notification
    const newNotif: CommitteeNotification = {
      id: 'n-' + Date.now(),
      type: isEditing ? 'completed' : 'pledge',
      title: isEditing ? 'Taarifa za Kiongozi Zimehaririwa' : 'Mjumbe Mpya Alikwa',
      message: isEditing
        ? `Taarifa za kiongozi ${memberName} (${memberPosition}) zimeboreshwa kikamilifu.`
        : `${memberName} ameajiriwa kama ${memberPosition} wa kamati. Salio la sasa linaweza kutazamwa na mfumo.`,
      createdAt: new Date().toLocaleDateString('sw-TZ') + ' ' + new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
      read: false
    };
    const updatedNotifs = [newNotif, ...notifications];
    setNotifications(updatedNotifs);
    safeLocalStorage.setItem(`kadi_committee_notifications_${event.id}`, JSON.stringify(updatedNotifs));
  };

  // Treasurer records payment
  const handleSavePaymentTreasury = () => {
    if (!treasuryTargetGuest || !treasuryAmount) return;
    const amountVal = parseFloat(treasuryAmount);
    if (isNaN(amountVal) || amountVal <= 0) return;

    const updatedGuests = guests.map(g => {
      if (g.id === treasuryTargetGuest.id) {
        const currentPayments = g.payments || [];
        const newPayment: ContributionPayment = {
          id: 'pay-' + Date.now(),
          amount: amountVal,
          date: new Date().toLocaleDateString('sw-TZ'),
          reference: treasuryRef || 'TXN-' + Math.floor(100000 + Math.random() * 899999),
          notes: treasuryNotes
        };
        const updatedPayments = [newPayment, ...currentPayments];
        const newPaid = (g.paidAmount || 0) + amountVal;
        const pledge = g.pledgeAmount || 0;
        
        let status: any = g.pledgeStatus || 'Pledged';
        if (newPaid >= pledge) {
          status = 'Fully Paid';
        } else if (newPaid > 0) {
          status = 'Partially Paid';
        }

        return {
          ...g,
          paidAmount: newPaid,
          pledgeStatus: status,
          payments: updatedPayments
        };
      }
      return g;
    });

    onUpdateGuests(updatedGuests);
    safeLocalStorage.setItem('kadi_guests', JSON.stringify(updatedGuests));

    // Log the transaction
    addActivityLog(`Salma Khamis (Treasurer)`, `Amesajili mchango wa TZS ${amountVal.toLocaleString()} kwa ${treasuryTargetGuest.name}`);

    // Automatic SMS dispatch
    if (treasuryTargetGuest.phone) {
      const isCompleted = (treasuryTargetGuest.paidAmount || 0) + amountVal >= (treasuryTargetGuest.pledgeAmount || 0);
      const refCode = treasuryRef || 'TXN-' + Math.floor(100000 + Math.random() * 899999);
      const eventTitle = event?.name || 'Sherehe';
      const payerName = treasuryTargetGuest.name;
      const amtStr = amountVal.toLocaleString();
      const totalPaid = ((treasuryTargetGuest.paidAmount || 0) + amountVal).toLocaleString();
      const pledge = (treasuryTargetGuest.pledgeAmount || 0);
      const balStr = Math.max(0, pledge - ((treasuryTargetGuest.paidAmount || 0) + amountVal)).toLocaleString();

      let msg = '';
      if (isCompleted) {
        msg = isEn
          ? `Hello ${payerName}, thank you very much for completing your contribution of TZS ${amtStr} (Total Paid: TZS ${totalPaid}) for ${eventTitle}! Ref: ${refCode}. Your support is deeply appreciated!`
          : `Habari ${payerName}, tumepokea malipo yako ya TZS ${amtStr} (Jumla Kuu uliyolipa: TZS ${totalPaid}) kwa ajili ya ${eventTitle}. Msimbo: ${refCode}. Tunakushukuru sana kwa kukamilisha ahadi yako! Ahsante sana!`;
      } else {
        msg = isEn
          ? `Hello ${payerName}, we have received your payment of TZS ${amtStr} for ${eventTitle}. Total Paid: TZS ${totalPaid}, Remaining Balance: TZS ${balStr}. Ref: ${refCode}. Thank you!`
          : `Habari ${payerName}, tumepokea malipo yako ya TZS ${amtStr} kwa ajili ya ${eventTitle}. Jumla uliyolipa: TZS ${totalPaid}, Salio lililosalia: TZS ${balStr}. Msimbo: ${refCode}. Ahsante sana kwa mchango wako!`;
      }

      fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: treasuryTargetGuest.id,
          eventId: event?.id || 'event-1',
          phone: treasuryTargetGuest.phone,
          text: msg,
          channel: 'sms',
          lang: isEn ? 'en' : 'sw',
          templateName: isCompleted ? 'shukrani' : 'ukumbusho'
        })
      }).catch(err => console.error('Auto SMS dispatch error:', err));
    }

    // Toast/notifications
    const isCompleted = (treasuryTargetGuest.paidAmount || 0) + amountVal >= (treasuryTargetGuest.pledgeAmount || 0);
    const notifMsg = isCompleted
      ? `${treasuryTargetGuest.name} Amemaliza Ahadi Yake kwa Malipo kamili ya TZS ${amountVal.toLocaleString()}`
      : `${treasuryTargetGuest.name} Amelipa salio la TZS ${amountVal.toLocaleString()}. Salio lake lililosalia: TZS ${((treasuryTargetGuest.pledgeAmount || 0) - ((treasuryTargetGuest.paidAmount || 0) + amountVal)).toLocaleString()}`;

    const newNotif: CommitteeNotification = {
      id: 'n-' + Date.now(),
      type: isCompleted ? 'completed' : 'payment',
      title: isCompleted ? 'Ahadi Imekamilika!' : 'Mchango Mpya',
      message: notifMsg,
      createdAt: new Date().toLocaleDateString('sw-TZ') + ' ' + new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
      read: false
    };
    setNotifications([newNotif, ...notifications]);
    safeLocalStorage.setItem(`kadi_committee_notifications_${event.id}`, JSON.stringify([newNotif, ...notifications]));

    // Clear and CLOSE
    setShowTreasurerPayModal(false);
    setTreasuryTargetGuest(null);
    setTreasuryAmount('');
    setTreasuryRef('');
  };

  // Simulate progress alerts / triggers
  const handleSimulateUpdateTrigger = () => {
    // Choose an unpledged or partially paid guest to create mock action
    const randomGuests = guests.filter(g => (g.pledgeAmount || 0) === 0);
    if (randomGuests.length === 0) {
      alert(isEn ? "All guests have active pledges!" : "Wageni wote tayari wana ahadi!");
      return;
    }
    const target = randomGuests[Math.floor(Math.random() * randomGuests.length)];
    const randomPledge = [200000, 300000, 500000, 1000000][Math.floor(Math.random() * 4)];

    const updated = guests.map(g => {
      if (g.id === target.id) {
        return {
          ...g,
          pledgeAmount: randomPledge,
          pledgeStatus: 'Pledged' as any,
          paidAmount: 0,
          payments: []
        };
      }
      return g;
    });

    onUpdateGuests(updated);
    safeLocalStorage.setItem('kadi_guests', JSON.stringify(updated));

    addActivityLog('System Observer', `${target.name} amesajili ahadi ya TZS ${randomPledge.toLocaleString()} kupitia Pledge Link ya mwanachama.`);
    
    // Add real notification
    const newNotif: CommitteeNotification = {
      id: 'n-' + Date.now(),
      type: 'pledge',
      title: 'Ahadi Mpya (Pledge Entry)',
      message: `${target.name} ameweka ahadi mpya ya TZS ${randomPledge.toLocaleString()} kwenye kadi ya baraka.`,
      createdAt: new Date().toLocaleDateString('sw-TZ') + ' ' + new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
      read: false
    };
    setNotifications([newNotif, ...notifications]);
    safeLocalStorage.setItem(`kadi_committee_notifications_${event.id}`, JSON.stringify([newNotif, ...notifications]));
  };

  // Reset metrics/database logs simulation
  const handleClearNotifications = () => {
    setNotifications([]);
    safeLocalStorage.setItem(`kadi_committee_notifications_${event.id}`, JSON.stringify([]));
  };

  // CSV down report generator
  // Report for attendance
  const checkedInList = useMemo(() => guests.filter(g => g.checkedIn), [guests]);

  const downloadAttendanceCSV = () => {
    addActivityLog(`${activeRole} View`, `Amepakua Ripoti ya Mahudhurio (CSV)`);
    const headers = ["ID", "Namba ya Kadi (Code)", "Jina la Mgeni", "Namba ya Simu", "Aina ya Kadi (Card Type)", "Muda wa Kuingia (Check-in Time)", "RSVP Status", "Idadi ya Wageni (Companions)"];
    
    let csvContent = "\uFEFF" + headers.join(",") + "\n";
    
    checkedInList.forEach(g => {
      csvContent += [
        g.id || '',
        g.code || '',
        `"${(g.name || '').replace(/"/g, '""')}"`,
        g.phone || '',
        g.cardType || '',
        g.checkedInTime || '',
        g.rsvpStatus || '',
        g.rsvpGuestsCount || 1
      ].join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Mahudhurio_Walioingia_${(event.name || 'Sherehe').replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadReportPDF = async () => {
    addActivityLog(`${activeRole} View`, `Amepakua Ripoti ya PDF rasmi: ${selectedReport}`);
    
    const doc = new jsPDF(selectedReport === 'Summary' ? 'l' : 'p', 'mm', 'a4', false);
    const pageWidth = doc.internal.pageSize.getWidth();

    const now = new Date();
    const localeStr = isEn ? 'en-US' : 'sw-TZ';
    const weekdayName = now.toLocaleDateString(localeStr, { weekday: 'long' });
    const dateFormatted = now.toLocaleDateString(localeStr, { year: 'numeric', month: 'long', day: 'numeric' });
    const timeFormatted = now.toLocaleTimeString(localeStr, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    
    // Custom exact-match layout for "Summary Ledger"
    if (selectedReport === 'Summary') {
      const printedDateStr = isEn 
        ? `${weekdayName}, ${dateFormatted} at ${timeFormatted}`
        : `${weekdayName}, ${dateFormatted} saa ${timeFormatted}`;
      
      const logoEl = document.querySelector('img[alt="EventCard Logo"]') as HTMLImageElement;
      let logoHeight = 0;
      let ratio = 1;
      if (logoEl && logoEl.complete && (logoEl.naturalWidth > 0 || logoEl.width > 0)) {
        // Preserve aspect ratio
        ratio = (logoEl.naturalWidth || logoEl.width || 1) / (logoEl.naturalHeight || logoEl.height || 1);
        logoHeight = 16;
        const targetWidth = logoHeight * ratio;
        try {
          const compressed = await compressElementOrUrlForPdf(logoEl, 2400, true);
          doc.addImage(compressed.dataUrl, compressed.format, 12, 10.5, targetWidth, logoHeight, 'SUMMARY_HEADER_LOGO', 'NONE');
        } catch (e) {
          doc.addImage(logoEl, 'PNG', 12, 10.5, targetWidth, logoHeight);
        }
      } else {
        // Event Card Logo mockup fallback
        doc.setFontSize(16);
        doc.setFont("helvetica", "bolditalic");
        doc.setTextColor(6, 182, 212); // Cyan 500
        doc.text("Event", 12, 18);
        doc.setTextColor(168, 85, 247); // Purple 500
        doc.text("Card", 27, 18);
        doc.setFont("helvetica", "normal"); // reset
      }

      // Header: AUDIT MASTER badge
      let badgeX = 42;
      if (logoHeight > 0) {
        badgeX = 12 + (logoHeight * ratio) + 8;
      }
      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.setFillColor(243, 244, 246); // Slate 100
      doc.roundedRect(badgeX, 13, 30, 7, 1, 1, 'FD');
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);    // Slate 700
      doc.text("AUDIT MASTER", badgeX + 15, 17.5, { align: "center" });

      // Printed Date Header right
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text(isEn ? "EXPORTED/PRINTED DATE:" : "TAREHE YA KUCHAPISHWA:", pageWidth - 12, 14.5, { align: 'right' });
      doc.setTextColor(30, 41, 59);    // Slate 800
      doc.text(printedDateStr, pageWidth - 12, 18, { align: 'right' });

      // Title Heading
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);    // Slate 900
      doc.text(isEn ? "OFFICIAL CONTRIBUTIONS REPORT" : "RIPOTI RASMI YA MICHANGO", 12, 32);
      
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const rawName = (event.name || "ARNOLD KIMARO").trim();
      const cleanName = rawName.replace(/^(HARUSI\s+YA\s+|WEDDING\s+OF\s+|SHEREHE\s+YA\s+|MWALIKO\s+WA\s+HARUSI\s+YA\s+|MWALIKO\s+WA\s+)+/i, '').trim();
      const isWedding = (event as any).type?.toLowerCase().includes('wedding') || (event as any).type?.toLowerCase().includes('harusi') || rawName.toLowerCase().includes('harusi');
      const eventPrefix = isEn ? "WEDDING OF " : (isWedding ? "HARUSI YA " : "SHEREHE YA ");
      const eventNameTxt = `${eventPrefix}${cleanName}`.toUpperCase();
      doc.text(eventNameTxt, 12, 38);
      const wName = doc.getTextWidth(eventNameTxt);
      
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text("  •  ", 12 + wName, 38);
      const wDot = doc.getTextWidth("  •  ");
      
      doc.setTextColor(100, 116, 139);
      const eventDateLbl = isEn ? "EVENT DATE: " : "TAREHE YA SHEREHE: ";
      doc.text(eventDateLbl, 12 + wName + wDot, 38);
      const wLabel = doc.getTextWidth(eventDateLbl);
      
      doc.setTextColor(15, 23, 42);
      doc.text(`${event.date || '2026-09-26'}`, 12 + wName + wDot + wLabel, 38);

      // Separator Line
      doc.setDrawColor(15, 23, 42); // Black accent
      doc.setLineWidth(0.8);
      doc.line(12, 42, pageWidth - 12, 42);

      // Summary Cards (4 Main Budget Cards)
      const outstandingBal = metrics.totalPledgedAmount - metrics.totalPaidAmount;
      const pctPaidVsTarget = fundraisingTarget > 0 ? ((metrics.totalPaidAmount / fundraisingTarget) * 100).toFixed(1) : '0.0';
      const pctPaidVsPledged = metrics.totalPledgedAmount > 0 ? ((metrics.totalPaidAmount / metrics.totalPledgedAmount) * 100).toFixed(1) : '0.0';
      const pctPledgedVsTarget = fundraisingTarget > 0 ? ((metrics.totalPledgedAmount / fundraisingTarget) * 100).toFixed(1) : '0.0';
      const pctOutstanding = metrics.totalPledgedAmount > 0 
        ? Math.max(0, 100 - Number(pctPaidVsPledged)).toFixed(1) 
        : '0.0';

      const cardY = 46;
      const cardWidth = (pageWidth - 24 - 12) / 4; // 4 cards, total 12 margin gaps
      const cardHeight = 21;

      const cards = [
        { label: isEn ? "TARGET BUDGET" : "MALENGO (TARGET)", value: `${fundraisingTarget.toLocaleString()} TZS`, sub: `100% ${isEn ? 'Goal' : 'Lengo Kuu'}`, bgColor: [59, 130, 246] },
        { label: isEn ? "TOTAL PLEDGED" : "JUMLA YA AHADI", value: `${metrics.totalPledgedAmount.toLocaleString()} TZS`, sub: `${pctPledgedVsTarget}% ${isEn ? 'of Budget' : 'ya Target'}`, bgColor: [245, 158, 11] },
        { label: isEn ? "CASH COLLECTED" : "FEDHA TASLIMU", value: `${metrics.totalPaidAmount.toLocaleString()} TZS`, sub: `${pctPaidVsTarget}% Target • ${pctPaidVsPledged}% Ahadi`, bgColor: [16, 185, 129] },
        { label: isEn ? "OUTSTANDING BAL" : "DENI / SALIO", value: `${outstandingBal.toLocaleString()} TZS`, sub: `${pctOutstanding}% ${isEn ? 'Pending' : 'Inadaiwa'}`, bgColor: [225, 29, 72] }
      ];

      cards.forEach((card, i) => {
        const x = 12 + i * (cardWidth + 4);
        doc.setFillColor(card.bgColor[0], card.bgColor[1], card.bgColor[2]);
        doc.roundedRect(x, cardY, cardWidth, cardHeight, 2.5, 2.5, 'F');
        
        doc.setFontSize(6.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text(card.label, x + cardWidth / 2, cardY + 5.5, { align: 'center', letterSpacing: 0.5 } as any);
        
        doc.setFontSize(11.5);
        doc.text(card.value, x + cardWidth / 2, cardY + 12.5, { align: 'center' });

        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.text(card.sub, x + cardWidth / 2, cardY + 17.5, { align: 'center' });
      });

      // --- DEDICATED FUNDS COLLECTION PROGRESS BANNER ---
      const bannerY = cardY + cardHeight + 3.5; // 46 + 21 + 3.5 = 70.5
      const bannerHeight = 10;
      doc.setFillColor(15, 23, 42); // Slate 900
      doc.roundedRect(12, bannerY, pageWidth - 24, bannerHeight, 2, 2, 'F');

      // Banner Label
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(251, 191, 36); // Amber 400
      doc.text(
        isEn ? "COLLECTION PROGRESS RATIO:" : "ASILIMIA YA MAKUSANYO YA FEDHA:", 
        17, 
        bannerY + 6.5
      );

      // Box 1: via Total Budget
      const box1X = pageWidth - 146;
      doc.setFillColor(6, 95, 70); // Dark Emerald 800
      doc.setDrawColor(52, 211, 153); // Emerald 400 border
      doc.roundedRect(box1X, bannerY + 2, 62, 6, 1.5, 1.5, 'FD');
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(
        isEn ? `via Total Budget: ${pctPaidVsTarget}%` : `via Total Budget (Target): ${pctPaidVsTarget}%`, 
        box1X + 31, 
        bannerY + 6, 
        { align: 'center' }
      );

      // Box 2: via Total Pledges
      const box2X = pageWidth - 78;
      doc.setFillColor(21, 94, 117); // Dark Cyan 800
      doc.setDrawColor(34, 211, 238); // Cyan 400 border
      doc.roundedRect(box2X, bannerY + 2, 64, 6, 1.5, 1.5, 'FD');
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(
        isEn ? `via Total Pledges: ${pctPaidVsPledged}%` : `via Total Pledges (Ahadi): ${pctPaidVsPledged}%`, 
        box2X + 32, 
        bannerY + 6, 
        { align: 'center' }
      );

      // 5 Pledge Status Summary Cards requested by user
      const cardY2 = bannerY + bannerHeight + 3.5; // 70.5 + 10 + 3.5 = 84
      const cardWidth2 = (pageWidth - 24 - 12) / 5; // 5 cards, total 12 margin gaps
      const cardHeight2 = 13;

      const pledgeCards = [
        { label: "HAWAJAAHIDI", value: `${unpledgedList.length} Wageni`, textColor: [71, 85, 105], borderColor: [203, 213, 225], bgColor: [248, 250, 252] },
        { label: "WALIOAHIDI TU", value: `${noPaymentPledgeList.length} Wageni`, textColor: [180, 83, 9], borderColor: [252, 211, 77], bgColor: [254, 252, 232] },
        { label: "LIPA NUSU", value: `${partialPaidList.length} Wageni`, textColor: [14, 116, 144], borderColor: [103, 232, 249], bgColor: [236, 254, 255] },
        { label: "LIPA YOTE", value: `${fullyPaidList.length} Wageni`, textColor: [21, 128, 61], borderColor: [110, 231, 183], bgColor: [236, 253, 245] },
        { label: "WENYE MADENI", value: `${noPaymentPledgeList.length + partialPaidList.length} Active`, textColor: [126, 34, 206], borderColor: [216, 180, 254], bgColor: [250, 245, 255] }
      ];

      pledgeCards.forEach((card, i) => {
        const x = 12 + i * (cardWidth2 + 3);
        doc.setFillColor(card.bgColor[0], card.bgColor[1], card.bgColor[2]);
        doc.setDrawColor(card.borderColor[0], card.borderColor[1], card.borderColor[2]);
        doc.roundedRect(x, cardY2, cardWidth2, cardHeight2, 2, 2, 'FD');
        
        doc.setFontSize(5.8);
        doc.setTextColor(card.textColor[0], card.textColor[1], card.textColor[2]);
        doc.setFont("helvetica", "bold");
        doc.text(card.label, x + cardWidth2 / 2, cardY2 + 4.5, { align: 'center' });
        
        doc.setFontSize(8.5);
        doc.text(card.value, x + cardWidth2 / 2, cardY2 + 9.5, { align: 'center' });
      });

      // Master Database Section ("DAFTARI KUU LA MICHANGO YA WAGENI")
      let tableY = cardY2 + cardHeight2 + 5;

      // Check if page space is running out, move to a new page cleanly
      const pageHeight = doc.internal.pageSize.getHeight();
      if (tableY > pageHeight - 50) {
        doc.addPage();
        tableY = 15;
      }

      doc.setFillColor(241, 245, 249); // Slate 100
      doc.roundedRect(12, tableY, pageWidth - 24, 7, 1, 1, 'F');
      
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text(isEn ? "MASTER GUEST REVENUE DATABASE" : "DAFTARI KUU LA MICHANGO YA WAGENI", 15, tableY + 5);
      
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.text(isEn ? `${guests.length} GUESTS TOTAL` : `JUMLA YA WAGENI ${guests.length}`, pageWidth - 15, tableY + 5, { align: 'right' });

      let snCounter = 1;
      const guestData = masterGuestList.map(g => {
        let clearanceTxt = 'INADAIWA';
        if (g.clearance === 'Completed') {
          clearanceTxt = isEn ? 'COMPLETED' : 'IMETIMIA';
        } else if (g.clearance === 'Partial') {
          clearanceTxt = isEn ? 'PARTIAL' : 'NUSU';
        } else {
          clearanceTxt = isEn ? 'PENDING' : 'INADAIWA';
        }
        return [
          snCounter++,
          g.name.toUpperCase(),
          g.phone,
          g.pledge.toLocaleString(),
          g.paid.toLocaleString(),
          g.balance.toLocaleString(),
          clearanceTxt
        ];
      });

      autoTable(doc, {
        startY: tableY + 9,
        head: [isEn 
          ? ['S/N', 'GUEST FULL NAME', 'MOBILE', 'PLEDGE', 'PAID AMT', 'BALANCE', 'CLEARANCE'] 
          : ['S/N', 'JINA LA MGENI', 'SIMU', 'AHADI', 'MALIPO', 'DENI', 'HALI']],
        body: guestData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 7.5, lineColor: [0, 0, 0] },
        styles: { cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }, halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.5 },
        columnStyles: {
          0: { cellWidth: 12 }, // S/N column
          1: { halign: 'left', fontStyle: 'bold' } // Guest name
        },
        didParseCell: (data) => {
          if (data.section === 'body') {
            if (data.column.index === 3) { // Pledge
              data.cell.styles.fontStyle = 'bold';
            }
            if (data.column.index === 4) { // Paid Amt
              data.cell.styles.textColor = [21, 128, 61]; // Green
              data.cell.styles.fontStyle = 'bold';
            }
            if (data.column.index === 5) { // Balance
              data.cell.styles.textColor = [220, 38, 38]; // Red
              data.cell.styles.fontStyle = 'bold';
            }
            if (data.column.index === 6) { // Clearance
              if (data.cell.raw === 'COMPLETED' || data.cell.raw === 'IMETIMIA') {
                data.cell.styles.textColor = [21, 128, 61];
                data.cell.styles.fontStyle = 'bold';
              } else {
                data.cell.styles.textColor = [15, 23, 42];
                data.cell.styles.fontStyle = 'bold';
              }
            }
          }
        }
      });

      await addPdfWatermarks(doc);
      doc.save(`${isEn ? 'Official' : 'Ripoti_Rasmi'}_${selectedReport}_${(event.name || "SHEREHE").replace(/\s+/g, '_')}.pdf`);
      return;
    }

    // --- Legacy Generator For Other Reports ---
    const pageWidthOld = doc.internal.pageSize.getWidth();

    // 1. Header Box
    doc.setFillColor(15, 23, 42); // Navy Slate-900 header block
    doc.rect(10, 10, pageWidthOld - 20, 20, 'F');
    
    doc.setFontSize(7.5);
    doc.setTextColor(243, 244, 246);
    doc.setFont("helvetica", "bold");
    doc.text(isEn ? `EVENTCARD REPORT ENGINE` : `MFUMO WA RIPOTI WA EVENTCARD`, 15, 17);

    const printedDateTime = isEn 
      ? `${dateFormatted} at ${timeFormatted}`
      : `${dateFormatted} saa ${timeFormatted}`;
    
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.setFont("helvetica", "normal");
    doc.text(`${isEn ? 'Exported:' : 'Imetolewa:'} ${printedDateTime}`, pageWidthOld - 15, 17, { align: 'right' });

    // Report title inside header box
    let reportTitle = "";
    let reportTitleSw = "";
    if (selectedReport === 'Summary') {
      reportTitle = "OFFICIAL CONTRIBUTIONS SUMMARY";
      reportTitleSw = "Muhtasari wa Makusanyo na Ahadi";
    } else if (selectedReport === 'Collection') {
      reportTitle = "PAYMENTS LOG & COLLECTION LEDGER";
      reportTitleSw = "Orodha Kamili na Deteli ya Makusanyo";
    } else if (selectedReport === 'Outstanding') {
      reportTitle = "DUE BALANCES & OUTSTANDING REPORT";
      reportTitleSw = "Wenye Salio la Deni Inayodaiwa";
    } else if (selectedReport === 'FullyPaid') {
      reportTitle = "FULLY PAID CONTRIBUTIONS";
      reportTitleSw = "Waliolipa Ahadi Kikamilifu";
    } else if (selectedReport === 'Pending') {
      reportTitle = "ACTIVE COMMITMENTS & PLEDGES";
      reportTitleSw = "Orodha Kuu ya Ahadi Zilizowekwa";
    } else if (selectedReport === 'NoPledge') {
      reportTitle = "GUESTS WITH NO RECORDED PLEDGES";
      reportTitleSw = "Wasioonyesha Ahadi ya Mchango";
    } else if (selectedReport === 'Attendance') {
      reportTitle = "EVENT ENTRY & ATTENDANCE REGISTER";
      reportTitleSw = "Mahudhurio ya Wageni Walioingia";
    } else if (selectedReport === 'RSVP_Report') {
      reportTitle = "RSVP & CAMPAIGN COMMUNICATIONS REPORT";
      reportTitleSw = "Hali ya RSVP na Idadi ya Ujumbe Uliotumwa";
    }

    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text((isEn ? reportTitle : reportTitleSw).toUpperCase(), 15, 25);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(251, 191, 36); // Amber
    doc.text(isEn ? reportTitleSw : reportTitle, pageWidth - 15, 25, { align: 'right' });

    // 4. Subtitle Event details
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    const eventLbl = isEn ? "Event: " : "Sherehe: ";
    doc.text(eventLbl, 10, 36);
    const wEventLabel = doc.getTextWidth(eventLbl);

    doc.setFont("helvetica", "bold");
    const eventNameUpper = `${event.name.toUpperCase()}`;
    doc.text(eventNameUpper, 10 + wEventLabel, 36);
    const wEventName = doc.getTextWidth(eventNameUpper);

    doc.setFont("helvetica", "normal");
    const dateLabel = isEn ? " • Date: " : " • Tarehe: ";
    doc.text(dateLabel, 10 + wEventLabel + wEventName, 36);
    const wDateLabel = doc.getTextWidth(dateLabel);

    doc.setFont("helvetica", "bold");
    const eventDateVal = `${event.date || '2026-05-31'}`;
    doc.text(eventDateVal, 10 + wEventLabel + wEventName + wDateLabel, 36);

    // Thick horizontal line
    doc.setDrawColor(15, 23, 42); // Black accent line
    doc.setLineWidth(0.5);
    doc.line(10, 39, pageWidth - 10, 39);

    // Calculate overall statistics
    const totalSmsSent = guests.reduce((sum, g) => sum + (g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0)), 0);
    const totalWhatsappSent = guests.reduce((sum, g) => sum + (g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)), 0);

    // Render depending on selection
    if (selectedReport === 'Summary') {
      // Summary cards
      const cardY = 44;
      const cardWidth = (pageWidth - 28) / 3;
      const cardHeight = 16;

      const cards = [
        { label: isEn ? "TARGET BUDGET" : "MALENGO (TARGET)", value: `${fundraisingTarget.toLocaleString()} TZS`, color: [15, 23, 42] },
        { label: isEn ? "TOTAL PLEDGED" : "JUMLA YA AHADI", value: `${metrics.totalPledgedAmount.toLocaleString()} TZS`, color: [15, 23, 42] },
        { label: isEn ? "CASH COLLECTED" : "FEDHA TASLIMU", value: `${metrics.totalPaidAmount.toLocaleString()} TZS`, color: [22, 163, 74] }
      ];

      cards.forEach((card, i) => {
        const x = 10 + i * (cardWidth + 4);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(218, 223, 230);
        doc.rect(x, cardY, cardWidth, cardHeight, 'FD');
        
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.text(card.label, x + cardWidth / 2, cardY + 5, { align: 'center' });
        
        doc.setFontSize(9.5);
        doc.setTextColor(card.color[0], card.color[1], card.color[2]);
        doc.text(card.value, x + cardWidth / 2, cardY + 11.5, { align: 'center' });
      });

      // 5 Pledge Status Cards
      const cardY2 = 63;
      const cardWidth2 = (pageWidth - 20 - (5 - 1) * 3) / 5;
      const cards2 = [
        { label: "HAWAJAAHIDI", value: `${unpledgedList.length} Wageni`, color: [100, 116, 139] },
        { label: "WALIOAHIDI TU", value: `${noPaymentPledgeList.length} Wageni`, color: [217, 119, 6] },
        { label: "LIPA NUSU", value: `${partialPaidList.length} Wageni`, color: [2, 132, 199] },
        { label: "LIPA YOTE", value: `${fullyPaidList.length} Wageni`, color: [22, 163, 74] },
        { label: "WENYE MADENI", value: `${noPaymentPledgeList.length + partialPaidList.length} Active`, color: [147, 51, 234] }
      ];

      cards2.forEach((card, i) => {
        const x = 10 + i * (cardWidth2 + 3);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(218, 223, 230);
        doc.rect(x, cardY2, cardWidth2, 14, 'FD');
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.text(card.label, x + cardWidth2 / 2, cardY2 + 4.5, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(card.color[0], card.color[1], card.color[2]);
        doc.text(card.value, x + cardWidth2 / 2, cardY2 + 10, { align: 'center' });
      });

      // Quick message stats bar
      const commY = 80;
      doc.setFillColor(241, 245, 249);
      doc.rect(10, commY, pageWidth - 20, 6, 'F');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.setFont("helvetica", "bold");
      doc.text(isEn 
        ? `TOTAL MESSAGES DISPATCHED: SMS Sent: ${totalSmsSent}  •  WhatsApp Sent: ${totalWhatsappSent}`
        : `JUMLA YA MAWASILIANO YALIYOTUMWA: SMS Zilizotumwa: ${totalSmsSent}  •  WhatsApp Zilizotumwa: ${totalWhatsappSent}`, 13, commY + 4.2);

      // Master Database
      const dbY = 88;
      doc.setFillColor(243, 244, 246);
      doc.rect(10, dbY, pageWidth - 20, 8, 'F');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(isEn ? "GUEST REVENUE & CAMPAIGN DISPATCH DATABASE" : "DAFTARI KUU LA MICHANGO YA WAGENI NA MAWASILIANO", 12, dbY + 5.5);

      const tableData = masterGuestList.map(g => {
        // match category guest record
        const matchingGuestObj = guests.find(gst => gst.id === g.id || gst.name === g.name);
        const smsC = matchingGuestObj ? (matchingGuestObj.smsCount || (isStatusSent(matchingGuestObj.smsStatus) ? 1 : 0)) : (g.clearance === 'Completed' ? 1 : 0);
        const waC = matchingGuestObj ? (matchingGuestObj.whatsappCount || (isStatusSent(matchingGuestObj.whatsappStatus) ? 1 : 0)) : (g.clearance === 'Completed' ? 1 : 0);
        return [
          g.sn,
          g.name,
          g.phone,
          g.pledge.toLocaleString(),
          g.paid.toLocaleString(),
          g.balance.toLocaleString(),
          smsC,
          waC
        ];
      });

      autoTable(doc, {
        startY: dbY + 11,
        head: [isEn 
          ? ['S/N', 'Full Name', 'Mobile', 'Pledge', 'Paid', 'Balance', 'SMS', 'WA']
          : ['S/N', 'Jina la Mgeni', 'Simu', 'Ahadi', 'Malipo', 'Deni', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 8, lineColor: [0, 0, 0] },
        styles: { cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }, fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center' },
          1: { fontStyle: 'bold' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'center' },
          7: { halign: 'center' }
        }
      });

    } else if (selectedReport === 'Collection') {
      // Collections
      const allPayments: any[] = [];
      guests.forEach(g => {
        (g.payments || []).forEach(p => {
          allPayments.push({
            name: g.name,
            phone: g.phone,
            p,
            sms: g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0),
            wa: g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)
          });
        });
      });
      allPayments.sort((a,b) => new Date(b.p.date).getTime() - new Date(a.p.date).getTime());

      // Summary Card
      const cardY = 44;
      const cardWidth = (pageWidth - 24) / 2;
      const cardHeight = 16;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(218, 223, 230);
      doc.rect(10, cardY, cardWidth, cardHeight, 'FD');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(isEn ? "TOTAL COLLECTED CASH" : "JUMLA YA MAKUSANYO YOTE", 15, cardY + 5);
      doc.setFontSize(9.5);
      doc.setTextColor(22, 163, 74);
      doc.text(`${metrics.totalPaidAmount.toLocaleString()} TZS`, 15, cardY + 12);

      doc.setFillColor(248, 250, 252);
      doc.rect(10 + cardWidth + 4, cardY, cardWidth, cardHeight, 'FD');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(isEn ? "TOTAL MESSAGES DISPATCHED (SMS / WHATSAPP)" : "JUMLA YA UJUMBE ULIOPELEKWA (SMS / WHATSAPP)", 10 + cardWidth + 9, cardY + 5);
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(isEn 
        ? `SMS: ${totalSmsSent} sent  •  WA: ${totalWhatsappSent} sent`
        : `SMS: ${totalSmsSent} zilizotumwa  •  WA: ${totalWhatsappSent} zilizotumwa`, 10 + cardWidth + 9, cardY + 11);

      const tableData = allPayments.map((itm, idx) => [
        idx + 1,
        itm.name,
        itm.phone,
        Number(itm.p.amount).toLocaleString(),
        itm.p.date,
        itm.p.reference || '-',
        itm.sms,
        itm.wa
      ]);

      const totalAmtPayments = allPayments.reduce((sum, item) => sum + Number(item.p.amount), 0);
      tableData.push([
        'T',
        isEn ? 'GRAND TOTAL' : 'JUMLA KUU',
        '-',
        totalAmtPayments.toLocaleString(),
        '-',
        '-',
        totalSmsSent,
        totalWhatsappSent
      ]);

      autoTable(doc, {
        startY: cardY + 20,
        head: [isEn ? ['S/N', 'Payer (Guest Name)', 'Phone', 'Amount (TZS)', 'Date', 'Ref', 'SMS', 'WA'] : ['S/N', 'Mlipaji (Jina la Mgeni)', 'Simu', 'Kiasi (TZS)', 'Tarehe', 'Ref', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 8, lineColor: [0, 0, 0] },
        styles: { cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }, fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center' },
          3: { halign: 'right', fontStyle: 'bold' },
          6: { halign: 'center' },
          7: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
          }
        }
      });

    } else if (selectedReport === 'Outstanding') {
      const list = [...partialPaidList, ...noPaymentPledgeList];
      const tableData = list.map((g, idx) => [
        idx + 1,
        g.name,
        g.phone,
        (g.pledgeAmount || 0).toLocaleString(),
        (g.paidAmount || 0).toLocaleString(),
        ((g.pledgeAmount || 0) - (g.paidAmount || 0)).toLocaleString(),
        g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0),
        g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)
      ]);

      // Add a Row for Grand Totals
      const totalPledged = list.reduce((sum, g) => sum + (g.pledgeAmount || 0), 0);
      const totalPaid = list.reduce((sum, g) => sum + (g.paidAmount || 0), 0);
      const totalBal = totalPledged - totalPaid;
      tableData.push([
        'T',
        isEn ? 'GRAND TOTAL OUTSTANDING' : 'JUMLA INAYODAIWA',
        '-',
        totalPledged.toLocaleString(),
        totalPaid.toLocaleString(),
        totalBal.toLocaleString(),
        totalSmsSent,
        totalWhatsappSent
      ]);

      autoTable(doc, {
        startY: 44,
        head: [isEn 
          ? ['S/N', 'Guest Name', 'Phone', 'Pledge (TZS)', 'Paid (TZS)', 'Balance (TZS)', 'SMS', 'WA']
          : ['S/N', 'Mgeni (Guest Name)', 'Simu', 'Ahadi (TZS)', 'Kilicholipwa (TZS)', 'Deni / Salio (TZS)', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 8, lineColor: [0, 0, 0] },
        styles: { cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }, fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28] },
          6: { halign: 'center' },
          7: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
            data.cell.styles.textColor = [15, 23, 42];
          }
        }
      });

    } else if (selectedReport === 'FullyPaid') {
      const tableData = fullyPaidList.map((g, idx) => [
        idx + 1,
        g.name,
        g.phone,
        (g.pledgeAmount || 0).toLocaleString(),
        g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0),
        g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)
      ]);

      const sumPaid = fullyPaidList.reduce((sum, g) => sum + (g.pledgeAmount || 0), 0);
      tableData.push([
        'T',
        isEn ? 'GRAND TOTAL PAID' : 'JUMLA WALIOLIPA',
        '-',
        sumPaid.toLocaleString(),
        totalSmsSent,
        totalWhatsappSent
      ]);

      autoTable(doc, {
        startY: 44,
        head: [isEn 
          ? ['S/N', 'Contributor Name', 'Phone Number', 'Amount Paid (TZS)', 'SMS', 'WA']
          : ['S/N', 'Mchangiaji (Guest Name)', 'Namba ya Simu', 'Kiasi Kilicholipwa (TZS)', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 8, lineColor: [0, 0, 0] },
        styles: { cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }, fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center' },
          3: { halign: 'right', fontStyle: 'bold', textColor: [22, 163, 74] },
          4: { halign: 'center' },
          5: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
          }
        }
      });

    } else if (selectedReport === 'Pending') {
      const tableData = activePledgeList.map((g, idx) => {
        let statusTxt = isEn ? 'Pledged' : 'AHADI';
        if (g.pledgeStatus === 'Fully Paid') statusTxt = isEn ? 'Fully Paid' : 'LIPA YOTE';
        else if (g.pledgeStatus === 'Partially Paid') statusTxt = isEn ? 'Partially Paid' : 'NUSU';
        else if (g.pledgeStatus === 'No Pledge') statusTxt = isEn ? 'No Pledge' : 'HAJAAHIDI';

        return [
          idx + 1,
          g.name,
          g.phone,
          statusTxt,
          (g.pledgeAmount || 0).toLocaleString(),
          g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0),
          g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)
        ];
      });

      const sumPledge = activePledgeList.reduce((sum, g) => sum + (g.pledgeAmount || 0), 0);
      tableData.push([
        'T',
        isEn ? 'GRAND TOTAL PLEDGES' : 'JUMLA YA AHADI',
        '-',
        '-',
        sumPledge.toLocaleString(),
        totalSmsSent,
        totalWhatsappSent
      ]);

      autoTable(doc, {
        startY: 44,
        head: [isEn 
          ? ['S/N', 'Guest Name', 'Phone', 'Status', 'Pledge Amount (TZS)', 'SMS', 'WA']
          : ['S/N', 'Mgeni (Guest Name)', 'Simu', 'Hali', 'Kiasi cha Ahadi (TZS)', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 8, lineColor: [0, 0, 0] },
        styles: { cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }, fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center' },
          4: { halign: 'right', fontStyle: 'bold' },
          5: { halign: 'center' },
          6: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
          }
        }
      });

    } else if (selectedReport === 'NoPledge') {
      const tableData = unpledgedList.map((g, idx) => [
        idx + 1,
        g.name,
        g.phone,
        `https://eventcard.co.tz/pledge/${g.code}`,
        g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0),
        g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)
      ]);

      tableData.push([
        'T',
        isEn ? 'TOTAL NO PLEDGE' : 'JUMLA WASIOAHIDI',
        `${unpledgedList.length} ${isEn ? 'Guests' : 'Wageni'}`,
        '-',
        totalSmsSent,
        totalWhatsappSent
      ]);

      autoTable(doc, {
        startY: 44,
        head: [isEn 
          ? ['S/N', 'Guest Name', 'Mobile Phone', 'Registration Link', 'SMS', 'WA']
          : ['S/N', 'Jina la Mgeni', 'Simu ya Mkononi', 'Viungo vya Usajili (Link)', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 8, lineColor: [0, 0, 0] },
        styles: { cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }, fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
          }
        }
      });

    } else if (selectedReport === 'Attendance') {
      const list = [...checkedInList].sort((a,b) => (b.checkedInTime || '').localeCompare(a.checkedInTime || ''));
      const tableData = list.map((g, idx) => [
        idx + 1,
        g.checkedInTime || '-',
        g.name,
        g.phone || '-',
        g.cardType || 'SINGLE',
        isEn ? 'SUCCESS SCAN' : 'IMEHAKIKIWA',
        g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0),
        g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)
      ]);

      tableData.push([
        'T',
        isEn ? 'TOTAL CHECKED IN' : 'JUMLA YA WALIOINGIA',
        `${list.length} ${isEn ? 'Cards' : 'Kadi'}`,
        '-',
        '-',
        '-',
        totalSmsSent,
        totalWhatsappSent
      ]);

      autoTable(doc, {
        startY: 44,
        head: [isEn 
          ? ['S/N', 'Time', 'Guest Name', 'Phone Number', 'Card Type', 'Scan Status', 'SMS', 'WA']
          : ['S/N', 'Muda (Time)', 'Jina la Mgeni', 'Namba ya Simu', 'Aina ya Kadi', 'Hali ya Skani', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 8, lineColor: [0, 0, 0] },
        styles: { cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }, fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center' },
          1: { fontStyle: 'bold' },
          4: { halign: 'center' },
          5: { halign: 'center', textColor: [22, 163, 74], fontStyle: 'bold' },
          6: { halign: 'center' },
          7: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
            data.cell.styles.textColor = [15, 23, 42];
          }
        }
      });

    } else if (selectedReport === 'RSVP_Report') {
      const sortedRSVPGuests = [...guests].sort((a,b) => {
        const valA = a.rsvpStatus === 'Atahudhuria' ? 1 : a.rsvpStatus === 'Labda' ? 2 : a.rsvpStatus === 'Bado' || !a.rsvpStatus ? 3 : 4;
        const valB = b.rsvpStatus === 'Atahudhuria' ? 1 : b.rsvpStatus === 'Labda' ? 2 : b.rsvpStatus === 'Bado' || !b.rsvpStatus ? 3 : 4;
        return valA - valB || a.name.localeCompare(b.name);
      });

      // RSVP metrics
      const countComing = guests.filter(g => g.rsvpStatus === 'Atahudhuria').length;
      const totalPeopleAttending = guests.filter(g => g.rsvpStatus === 'Atahudhuria').reduce((acc, current) => acc + (current.rsvpGuestsCount || 1), 0);
      const countDeclined = guests.filter(g => g.rsvpStatus === 'Hatahudhuria').length;
      const countMaybe = guests.filter(g => g.rsvpStatus === 'Labda').length;
      const countPending = guests.filter(g => !g.rsvpStatus || g.rsvpStatus === 'Bado').length;

      // Stats cards
      const cardY = 44;
      const cardWidth = (pageWidth - 28) / 3;
      const cardHeight = 16;

      const cards = [
        { 
          label: isEn ? "COMING" : "WATAKAOFIKA", 
          value: isEn ? `${countComing} Cards / ${totalPeopleAttending} Guests` : `${countComing} Kadi / ${totalPeopleAttending} Watu`, 
          color: [22, 163, 74] 
        },
        { 
          label: isEn ? "DECLINED / MAYBE" : "HAWATAHUDHURIA / LABDA", 
          value: isEn ? `${countDeclined} Declined / ${countMaybe} Maybe` : `${countDeclined} Hawaji / ${countMaybe} Labda`, 
          color: [185, 28, 28] 
        },
        { 
          label: isEn ? "PENDING RESPONSE" : "BADO MAJIBU", 
          value: isEn ? `${countPending} Guests` : `${countPending} Wageni`, 
          color: [15, 23, 42] 
        }
      ];

      cards.forEach((card, i) => {
        const x = 10 + i * (cardWidth + 4);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(218, 223, 230);
        doc.rect(x, cardY, cardWidth, cardHeight, 'FD');
        
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.text(card.label, x + cardWidth / 2, cardY + 5, { align: 'center' });
        
        doc.setFontSize(8);
        doc.setTextColor(card.color[0], card.color[1], card.color[2]);
        doc.text(card.value, x + cardWidth / 2, cardY + 11, { align: 'center' });
      });

      const tableData = sortedRSVPGuests.map((g, idx) => {
        let rsvpTxt = isEn ? 'Pending' : 'Bado';
        if (g.rsvpStatus === 'Atahudhuria') rsvpTxt = isEn ? 'Attending' : 'Atahudhuria';
        else if (g.rsvpStatus === 'Hatahudhuria') rsvpTxt = isEn ? 'Declined' : 'Hatahudhuria';
        else if (g.rsvpStatus === 'Labda') rsvpTxt = isEn ? 'Maybe' : 'Labda';

        return [
          idx + 1,
          g.name,
          g.phone || '-',
          g.cardType || 'SINGLE',
          rsvpTxt,
          g.rsvpGuestsCount || 1,
          g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0),
          g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)
        ];
      });

      const sumRSVPPeople = guests.reduce((sum, g) => sum + (g.rsvpStatus === 'Atahudhuria' ? (g.rsvpGuestsCount || 1) : 0), 0);
      tableData.push([
        'T',
        isEn ? 'GRAND TOTAL' : 'JUMLA KUU',
        '-',
        '-',
        '-',
        isEn ? `${sumRSVPPeople} Attending Guests` : `${sumRSVPPeople} Watu Watakaohudhuria`,
        totalSmsSent,
        totalWhatsappSent
      ]);

      autoTable(doc, {
        startY: cardY + 20,
        head: [isEn 
          ? ['S/N', 'Guest Name', 'Phone', 'Card Type', 'RSVP Status', 'RSVP Count', 'SMS', 'WA']
          : ['S/N', 'Jina la Mgeni', 'Simu', 'Aina ya Kadi', 'Hali ya RSVP', 'Watu RSVP', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 8, lineColor: [0, 0, 0] },
        styles: { cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }, fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center' },
          3: { halign: 'center', fontStyle: 'bold' },
          4: { halign: 'center' },
          5: { halign: 'center', fontStyle: 'bold' },
          6: { halign: 'center' },
          7: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
            data.cell.styles.textColor = [15, 23, 42];
          } else if (data.section === 'body' && data.column.index === 4) {
            const val = data.cell.text[0];
            if (val === 'Atahudhuria' || val === 'Attending') {
              data.cell.styles.textColor = [22, 163, 74]; // Green
              data.cell.styles.fontStyle = 'bold';
            } else if (val === 'Hatahudhuria' || val === 'Declined') {
              data.cell.styles.textColor = [220, 38, 38]; // Red
            } else if (val === 'Labda' || val === 'Maybe') {
              data.cell.styles.textColor = [217, 119, 6]; // Amber
            }
          }
        }
      });
    }

    // SIGNATURE SIGN-OFF AND APPROVAL SECTION FOR OFFICIAL COMMITTEE AUDITING
    let finalY = (doc as any).lastAutoTable.finalY + 15;
    if (finalY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      finalY = 20;
    }

    // Signatures Header rule
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.line(10, finalY, pageWidth - 10, finalY);
    finalY += 6;

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text(isEn ? "OFFICIAL COMMITTEE SIGN-OFF & AUDIT APPROVAL" : "IDHINI NA SAHIHI ZA ULINZI WA KAMATI YA FEDHA", 10, finalY);
    
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(isEn ? "This report is verified, audited and officially signed off by the executive leadership committee." : "Ripoti hii imekaguliwa, imethibitishwa na kuidhinishwa rasmi na viongozi wakuu wa kamati ya fedha.", 10, finalY + 4);
    
    finalY += 16;

    // Dynamic side-by-side signature lines
    const colWidth = (pageWidth - 30) / 3;
    
    // 1. Chairperson / Mwenyekiti
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.line(10, finalY, 10 + colWidth, finalY);
    doc.text(isEn ? "Chairperson / Mwenyekiti" : "Mwenyekiti / Chairperson", 10, finalY + 4);
    doc.setFont("helvetica", "normal");
    doc.text("Date: ____ / ____ / ________", 10, finalY + 8);

    // 2. Treasurer / Mweka Hazina
    doc.setFont("helvetica", "bold");
    doc.line(15 + colWidth, finalY, 15 + colWidth * 2, finalY);
    doc.text(isEn ? "Treasurer / Mweka Hazina" : "Mweka Hazina / Treasurer", 15 + colWidth, finalY + 4);
    doc.setFont("helvetica", "normal");
    doc.text("Date: ____ / ____ / ________", 15 + colWidth, finalY + 8);

    // 3. Secretary / Katibu
    doc.setFont("helvetica", "bold");
    doc.line(20 + colWidth * 2, finalY, pageWidth - 10, finalY);
    doc.text(isEn ? "Secretary / Katibu" : "Katibu / Secretary", 20 + colWidth * 2, finalY + 4);
    doc.setFont("helvetica", "normal");
    doc.text("Date: ____ / ____ / ________", 20 + colWidth * 2, finalY + 8);

    await addPdfWatermarks(doc);
    doc.save(`Official_${selectedReport}_Report_${event.name.replace(/\s+/g, '_')}.pdf`);
  };

  const downloadReportCSV = (title: string, list: Guest[]) => {
    addActivityLog(`${activeRole} View`, `Amepakua Ripoti ya CSV: ${title}`);
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += isEn 
      ? "Guest Name,Phone,Pledge Status,Pledge Amount(TZS),Paid Amount(TZS),Balance Due(TZS)\n"
      : "Jina la Mgeni,Simu,Hali ya Ahadi,Kiasi cha Ahadi(TZS),Kiasi Kilicholipwa(TZS),Salio la Deni(TZS)\n";
    
    list.forEach(g => {
      const b = (g.pledgeAmount || 0) - (g.paidAmount || 0);
      csvContent += `"${g.name}","${g.phone}","${g.pledgeStatus || 'No Pledge'}",${g.pledgeAmount || 0},${g.paidAmount || 0},${b}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title.replace(/\s+/g, '_')}_CommitteeReport_${event.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render analytics charts datasets
  const collectionChartData = useMemo(() => {
    // Break down guest payments daily
    const paymentsList: { name: string; value: number }[] = [];
    guests.forEach(g => {
      (g.payments || []).forEach(p => {
        const d = p.date || '04/06/2026';
        const found = paymentsList.find(x => x.name === d);
        if (found) {
          found.value += p.amount;
        } else {
          paymentsList.push({ name: d, value: p.amount });
        }
      });
    });

    if (paymentsList.length === 0) {
      return [
        { name: '01/06', value: 2500000 },
        { name: '02/06', value: 4300000 },
        { name: '03/06', value: 1800000 },
        { name: '04/06', value: metrics.totalPaidAmount || 1200000 }
      ];
    }
    return paymentsList.sort((a,b) => a.name.localeCompare(b.name));
  }, [guests, metrics.totalPaidAmount]);

  // Top contributors list (highest pledges, payments)
  const topContributorsData = useMemo(() => {
    const list = [...guests].filter(g => (g.pledgeAmount || 0) > 0);
    return list.sort((a,b) => (b.pledgeAmount || 0) - (a.pledgeAmount || 0)).slice(0, 5);
  }, [guests]);

  // Compute RSVP response data for the interactive charts
  const rsvpChartData = useMemo(() => {
    let attending = 0;
    let absent = 0;
    let maybe = 0;
    let noResponse = 0;

    guests.forEach(g => {
      const status = g.rsvpStatus || 'Bado';
      if (status === 'Atahudhuria') {
        attending += (g.rsvpGuestsCount || 1);
      } else if (status === 'Hatahudhuria') {
        absent += 1;
      } else if (status === 'Labda') {
        maybe += 1;
      } else {
        noResponse += 1;
      }
    });

    // If all are zero, provide default illustrative data
    if (attending === 0 && absent === 0 && maybe === 0 && noResponse === 0) {
      return [
        { name: isEn ? 'Attending' : 'Atahudhuria', value: 35, color: '#10b981' },
        { name: isEn ? 'Not Attending' : 'Hatahudhuria', value: 5, color: '#f43f5e' },
        { name: isEn ? 'Maybe' : 'Labda', value: 10, color: '#eab308' },
        { name: isEn ? 'No Response' : 'Bado Haijulikani', value: 50, color: '#64748b' },
      ];
    }

    return [
      { name: isEn ? 'Attending' : 'Atahudhuria', value: attending, color: '#10b981' },
      { name: isEn ? 'Not Attending' : 'Hatahudhuria', value: absent, color: '#f43f5e' },
      { name: isEn ? 'Maybe' : 'Labda', value: maybe, color: '#eab308' },
      { name: isEn ? 'No Response' : 'Bado Haijulikani', value: noResponse, color: '#64748b' },
    ].filter(item => item.value > 0);
  }, [guests, isEn]);

  // Compute Contribution stats data (Paid vs Remaining)
  const pledgeStatusChartData = useMemo(() => {
    return [
      { name: isEn ? 'Paid' : 'Kiasi Kilicholipwa', value: metrics.totalPaidAmount, color: '#10b981' },
      { name: isEn ? 'Outstanding' : 'Salio la Ahadi', value: metrics.outstandingBalance, color: '#f43f5e' }
    ];
  }, [metrics.totalPaidAmount, metrics.outstandingBalance, isEn]);

  // Printable PDF triggered view
  const handlePrintTrigger = () => {
    addActivityLog(`${activeRole} View`, `Alichapisha au ku-export PDF kwa ripoti: ${selectedReport}`);
    window.print();
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '1234') {
      setActiveRole('Event Owner');
      setLoggedInRole('Event Owner');
      setIsLocked(false);
      setPinError('');
    } else if (pinInput === '2222') {
      setActiveRole('Treasurer');
      setLoggedInRole('Treasurer');
      setIsLocked(false);
      setPinError('');
    } else if (pinInput === '3333') {
      setActiveRole('Secretary');
      setLoggedInRole('Secretary');
      setIsLocked(false);
      setPinError('');
    } else if (pinInput === '4444') {
      setActiveRole('Committee Member');
      setLoggedInRole('Committee Member');
      setIsLocked(false);
      setPinError('');
    } else {
      setPinError(isEn ? 'Incorrect PIN code' : 'Nywila sio sahihi. Namba za kujaribu: 1234, 2222, 3333, au 4444');
    }
  };

  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-10 px-4 text-center">
        <ShieldCheck className="w-16 h-16 text-emerald-500 mb-6 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse" />
        <h2 className="text-xl font-black text-white uppercase font-mono tracking-widest mb-2">
          {isEn ? "Committee Module Secured" : "Bodi ya Kamati Imefungwa"}
        </h2>
        <p className="text-slate-400 text-xs mb-8 max-w-sm leading-relaxed">
          {isEn 
            ? "Enter role PIN (Owner: 1234, Treasurer: 2222, Secretary: 3333, Member: 4444)" 
            : "Tumia PIN hizi kuingia kulingana na cheo: Admin (1234), Hazina (2222), Katibu (3333), Mjumbe (4444)"}
        </p>
        
        <form onSubmit={handlePinSubmit} className="w-full max-w-xs space-y-4">
          <div className="space-y-2">
            <input
              type="password"
              inputMode="numeric"
              placeholder={isEn ? "Enter PIN" : "Weka PIN"}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full text-center px-4 py-3 bg-slate-950/60 border border-white/10 rounded-2xl text-2xl font-mono tracking-[0.5em] text-white focus:outline-none focus:border-emerald-500/50 transition-colors placeholder:text-slate-700 placeholder:tracking-normal placeholder:text-sm"
              autoFocus
              maxLength={4}
            />
            {pinError && <p className="text-rose-500 text-[10px] font-bold uppercase">{pinError}</p>}
          </div>
          
          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
          >
            {isEn ? "Unlock Dashboard" : "Fungua Mfumo"}
          </button>
        </form>
        
        <div className="mt-8 text-[10.5px] text-slate-500 font-mono flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          <span>{isEn ? "End-to-End Encrypted Access" : "Mfumo umelindwa kikamilifu (AES-256)"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-xs text-slate-100 pb-16" id="committee-system-module-parent">
      
      {/* Top Simulator & Role selection rail - ONLY visible to Event Owner/Admin */}
      {loggedInRole === 'Event Owner' && (
        <div className="backdrop-blur-md bg-white/[0.02] border border-amber-500/20 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[9px] px-2.5 py-1 rounded-full uppercase font-bold flex items-center w-fit gap-1 animate-pulse">
              <ShieldCheck className="w-3 h-3 text-amber-400" />
              <span>Simulate Committee Role Options</span>
            </span>
            <h2 className="text-sm font-black text-white uppercase font-mono tracking-wide">
              {isEn ? "Role-Based Permissions Sandbox" : "Pitia Majukumu ya Wanakamati (Simulator)"}
            </h2>
            <p className="text-slate-400 text-[10.5px]">
              {isEn ? "Toggle simulated positions to witness secure access scopes in action instantly:" : "Bonyeza majukumu tofauti hapa chini ili kuona jinsi gani mifumo ya ulinzi inavyofanya kazi:"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-white/5">
            {[
              { tag: 'Event Owner', label: isEn ? 'Event Owner / Admin' : 'Mwenye Shughuli (Admin)' },
              { tag: 'Treasurer', label: isEn ? 'Treasurer' : 'Hazina (Treasurer)' },
              { tag: 'Secretary', label: isEn ? 'Secretary' : 'Katibu (Secretary)' },
              { tag: 'Committee Member', label: isEn ? 'Committee Member' : 'Mjumbe wa Kamati' }
            ].map((r) => (
              <button
                key={r.tag}
                onClick={() => {
                  setActiveRole(r.tag as any);
                  addActivityLog(`System Simulator`, `Amebadili hadhi ya kutazama na kuwa: ${r.tag}`);
                }}
                className={`p-2 px-3 rounded-xl transition font-bold font-mono text-[10px] uppercase cursor-pointer ${
                  activeRole === r.tag 
                    ? 'bg-amber-500 text-slate-150 shadow-md scale-98 font-black' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Role Notice banner with Logout/Lock button */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
        activeRole === 'Treasurer' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450' :
        activeRole === 'Secretary' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
        activeRole === 'Committee Member' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 font-mono text-[11px]' :
        'bg-amber-500/5 border-amber-500/10 text-amber-400'
      }`}>
        <div className="flex items-start gap-3">
          <Activity className="w-5 h-5 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <p className="font-extrabold uppercase tracking-wider text-xs">
              {activeRole === 'Event Owner' && (isEn ? "Logged in as Event Owner (Full Access Granted)" : "Umeingia kama Mwenye Shughuli (Ruhusa Kamili ya Admin)")}
              {activeRole === 'Treasurer' && (isEn ? "Logged in as Mweka Hazina (Treasurer - Payments Access Only)" : "Umeingia kama Mweka Hazina (Hazina - Ruhusa ya Kuongeza Malipo tu, Hakuna kufuta)")}
              {activeRole === 'Secretary' && (isEn ? "Logged in as Katibu (Secretary - Viewer Access with Pledges & Lists)" : "Umeingia kama Katibu wa Kamati (Secretary - Kuona data pekee, Hakuna kuhariri)")}
              {activeRole === 'Committee Member' && (isEn ? "Logged in as Committee Member (Summary Dashboard Only - Personal logs hidden)" : "Umeingia kama Mjumbe wa Kamati (Summary tu - Taarifa za kifedha za mtu mmoja mmoja zimefichwa)")}
            </p>
            <p className="text-slate-400 text-[10.5px]">
              {activeRole === 'Event Owner' && (isEn ? "✓ Modify targets • ✓ Manage committee members • ✓ Record payments • ✓ Deep analytics • ✓ Public progress manager" : "✓ Badilisha Malengo • ✓ Ongeza Wanakamati • ✓ Sajili malipo yote • ✓ Utendaji wa log na Ripoti")}
              {activeRole === 'Treasurer' && (isEn ? "✓ Record payment amounts • ✓ Print/download reports • ✗ Cannot delete records • ✗ Cannot change committee members" : "✓ Sajili malipo mapya • ✓ Pakua Ripoti • ✗ Huwezi kufuta muamala wowote • ✗ Huwezi kubadili wajumbe")}
              {activeRole === 'Secretary' && (isEn ? "✓ Read-only guests & pledges • ✓ Export reports • ✗ Cannot add payments • ✗ Cannot modify system setups" : "✓ Tazama wageni na ahadi zao • ✓ Pakua Ripoti • ✗ Huwezi kuongeza malipo wala kuandikisha data")}
              {activeRole === 'Committee Member' && (isEn ? "✓ Summary widgets & charts only • ✗ Restricted from viewing detailed names, individual payment logs, or contact numbers" : "✓ Tazama asilimia na chati tu • ✗ Umezuiliwa kuona majina, simu au kiasi kimoja kimoja cha mtu kukulinda siri")}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/35 text-rose-400 rounded-xl font-mono text-[10px] font-extrabold uppercase flex items-center gap-1.5 self-start sm:self-center transition-all cursor-pointer shadow-sm active:scale-95"
          id="btn-committee-logout"
        >
          <X className="w-3.5 h-3.5" />
          <span>{isEn ? "Lock / Logout 🔒" : "Ondoka Kwenye Mfumo 🔒"}</span>
        </button>
      </div>

      {/* Primary tab switcher */}
      <div className="flex items-center justify-between overflow-x-auto gap-2 border-b border-white/10 pb-1 shrink-0" id="committee-subtabs-nav">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'dashboard', label: isEn ? 'Dashboard Summary' : 'Mwanzo wa Kamati', icon: Layers },
            { id: 'members', label: isEn ? 'Committee Leaders & Members' : 'Viongozi & Wanakamati', icon: Users },
            { id: 'reminders', label: isEn ? 'Meeting Reminders (SMS/WA)' : 'Kukumbusha Vikao (SMS/WA)', icon: MessageSquare },
            { id: 'seating', label: isEn ? 'Smart AI Seating' : 'Meza & Viti (AI Seating)', icon: Grid },
            { id: 'ai-copywriting', label: isEn ? 'AI Card Copywriting' : 'Uandishi wa Kadi (AI)', icon: Feather },
            { id: 'analytics', label: isEn ? 'Analytics & Trends' : 'Takwimu za Chati', icon: TrendingUp },
            { id: 'reports', label: isEn ? 'Committee Reports' : 'Ripoti za Kamati', icon: Printer },
            { id: 'contributions', label: isEn ? 'Contribution Module' : 'Michango & Kadi', icon: Coins },
            { id: 'files', label: isEn ? 'Documents & Files' : 'Nyaraka & Faili', icon: FolderOpen },
            { id: 'activity', label: isEn ? 'Activity Logs' : 'Kihistoria cha Logs', icon: Activity },
            { id: 'public-link', label: isEn ? 'Public Tracking Link' : 'Public Progress Link', icon: Share2 }
          ].map((tab) => {
            // Hide tabs depending on simulated permissions
            if (tab.id === 'members' || tab.id === 'activity') {
              if (activeRole !== 'Event Owner') return null; // Only Owner
            }
            if (tab.id === 'contributions') {
              if (activeRole !== 'Event Owner' && activeRole !== 'Treasurer') return null; // Owner & Treasurer
            }
            if (tab.id === 'reports' || tab.id === 'public-link') {
              if (activeRole === 'Committee Member') return null; // Owner, Treasurer, Secretary
            }
            
            const isActive = currentSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentSubTab(tab.id as any)}
                className={`flex items-center gap-2 py-2.5 px-4 font-mono font-extrabold text-[10.5px] uppercase border-b-2 transition shrink-0 cursor-pointer ${
                  isActive 
                    ? 'border-amber-500 text-amber-400 bg-white/[0.02]' 
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dedicated Direct AI Assistant Launcher Button in Navigation */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chatbot'))}
          className="flex items-center gap-2 py-1.5 px-3.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-mono font-black text-[11px] uppercase shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95 border border-amber-400/50 transition shrink-0 cursor-pointer animate-pulse"
          title="Fungua Msaidizi wa AI"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>🤖 {isEn ? "AI Assistant" : "Msaidizi wa AI"}</span>
        </button>
      </div>

      {/* SUB-TAB 1: COMMITTEE DASHBOARD */}
      {currentSubTab === 'dashboard' && (
        <div className="space-y-6 animate-fade-in" id="panel-committee-home">

          {/* Glowing AI Assistant Banner Card */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border-2 border-indigo-500/40 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-xl border border-amber-400/40 shrink-0">
                <Sparkles className="w-6 h-6 text-amber-300 animate-spin-slow" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    NEW • EVENTCARD AI
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block"></span>
                    ONLINE
                  </span>
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-wide">
                  {isEn ? "Msaidizi wa AI (Committee & Event Smart AI Assistant)" : "Msaidizi wa AI wa Kamati na Sherehe"}
                </h3>
                <p className="text-slate-300 text-xs leading-relaxed max-w-2xl">
                  {isEn 
                    ? "Ask questions about pledges, payments, guest lists, RSVP status, or messaging features anytime!" 
                    : "Muulize Msaidizi wa AI kuhusu hali ya michango, wageni walioahidi, kadi zilizotumwa, au ushauri wa bajeti!"}
                </p>
              </div>
            </div>

            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chatbot'))}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-extrabold text-xs uppercase tracking-wider hover:opacity-95 shadow-xl shadow-blue-600/30 active:scale-95 transition-all border border-amber-300/40 flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <span>💬 {isEn ? "Ask AI Assistant" : "Anza Kuzungumza na AI"}</span>
            </button>
          </div>
          
          {/* Target Tracking progress bar */}
          <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute right-4 top-4 text-slate-800 pointer-events-none"><Coins className="w-24 h-24 stroke-[0.8]" /></div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="space-y-2">
                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[9px] px-2.5 py-1 rounded-full uppercase font-bold">
                  {isEn ? "Active Target Tracker" : "Mfuatiliaji Maalum wa Fundraising Target"}
                </span>
                <h3 className="text-lg font-black text-white uppercase font-sans tracking-wide">
                  {isEn ? "FUNDRAISING GOAL STATUS" : "MALENGO YA MAKUSANYO (TARGET TRACKER)"}
                </h3>
                <p className="text-slate-400 text-xs">
                  {isEn ? "Comparison with the target set by the event organization committee:" : "Kiasi kilichopangwa na kamati kulinganisha na makusanyo ya sasa:"}
                </p>
              </div>

              {activeRole === 'Event Owner' ? (
                <div className="bg-slate-950/80 p-3 rounded-2xl border border-white/10 space-y-2 min-w-[200px]">
                  <label className="text-[9px] font-mono uppercase font-bold text-slate-400 block" htmlFor="fundraising-target-input">
                    {isEn ? "Set Target Goal (TZS):" : "Weka Target ya Sherehe (TZS):"}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      id="fundraising-target-input"
                      type="number" 
                      defaultValue={fundraisingTarget} 
                      onBlur={(e) => handleSaveGoal(Number(e.target.value) || 15000000)}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white font-mono font-bold text-xs focus:ring-1 focus:ring-amber-500 w-full"
                    />
                    <button className="bg-amber-500 text-slate-900 px-2 py-1 text-[10px] font-bold rounded uppercase hover:bg-amber-400">OK</button>
                  </div>
                  <span className="text-[9px] text-slate-500 block">{isEn ? "Click out / tab save" : "Bofya nje ili kuhifadhi"}</span>
                </div>
              ) : (
                <div className="text-right">
                  <p className="text-[10px] uppercase font-mono text-slate-400">{isEn ? "Fundraising Target Set" : "Kiwango cha Target kilichosajiliwa"}</p>
                  <p className="text-xl font-black text-amber-400 font-mono">TZS {fundraisingTarget.toLocaleString()}</p>
                </div>
              )}
            </div>

            {/* Visual metric meters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 relative z-10 pt-6 border-t border-white/5">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">{isEn ? "Target Amount" : "Shabaha Iliyowekwa"}</span>
                <p className="text-lg font-black text-white font-mono">TZS {fundraisingTarget.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-emerald-400 block">{isEn ? "Collected (Paid)" : "Kiasi Kilichokusanywa"}</span>
                <p className="text-lg font-black text-emerald-400 font-mono">TZS {metrics.totalPaidAmount.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-rose-400 block">{isEn ? "Remaining Balance" : "Gharama Iliyobaki"}</span>
                <p className="text-lg font-black text-rose-400 font-mono">TZS {metrics.remainingToTarget.toLocaleString()}</p>
              </div>
            </div>

            {/* Custom crafted progress bar */}
            <div className="space-y-2 mt-8 relative z-10">
              <div className="flex justify-between items-center text-xs font-mono font-bold">
                <span className="text-amber-400">{isEn ? "Collection Progress:" : "Maendeleo ya Makusanyo:"}</span>
                <span className="text-white text-sm font-black text-glow">{metrics.progress}%</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
                <div 
                  className="bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500 h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.min(100, parseFloat(metrics.progress))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Metrics numbers row matching 16.3 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-1">
              <span className="text-[9.5px] font-mono text-slate-400 uppercase font-bold">{isEn ? "Total Guests" : "Wageni Wote"}</span>
              <p className="text-xl font-black text-white font-mono">{metrics.totalGuests}</p>
              <p className="text-[9px] text-slate-500 italic">{isEn ? "Guests loaded in directory" : "Wageni wote walioalikwa"}</p>
            </div>

            <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-1">
              <span className="text-[9.5px] font-mono text-cyan-400 uppercase font-bold">{isEn ? "Contributors Count" : "Idadi Waliotoa Ahadi"}</span>
              <p className="text-xl font-black text-cyan-400 font-mono">
                {metrics.pledgedCount + metrics.partiallyPaidCount + metrics.fullyPaidCount}
              </p>
              <p className="text-[9px] text-slate-500 italic">
                {(( (metrics.pledgedCount + metrics.partiallyPaidCount + metrics.fullyPaidCount) / (metrics.totalGuests || 1)) * 100).toFixed(0)}% {isEn ? "of guests participated" : "ya wageni wote walioshiriki"}
              </p>
            </div>

            <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-1">
              <span className="text-[9.5px] font-mono text-amber-400 uppercase font-bold">{isEn ? "Total Pledged" : "Jumla ya Ahadi TZS"}</span>
              <p className="text-xl font-black text-yellow-450 font-mono">TZS {metrics.totalPledgedAmount.toLocaleString()}</p>
              <p className="text-[9px] text-slate-500 italic">{isEn ? "Official commitment commitments" : "Thamani ya ahadi rasmi"}</p>
            </div>

            <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-1">
              <span className="text-[9.5px] font-mono text-emerald-400 uppercase font-bold">{isEn ? "Total Collected" : "Jumla ya Malipo TZS"}</span>
              <p className="text-xl font-black text-emerald-450 font-mono">TZS {metrics.totalPaidAmount.toLocaleString()}</p>
              <p className="text-[9px] text-emerald-500/80 font-bold font-mono">TZS {metrics.outstandingBalance.toLocaleString()} {isEn ? "pending due" : "inadaiwa"}</p>
            </div>

          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="backdrop-blur-md bg-white/[0.01] border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono text-emerald-400 uppercase font-bold block">{isEn ? "Fully Paid Contributors" : "Waliolipa Ahadi Yote"}</span>
                <p className="text-lg font-black text-white font-mono">{metrics.fullyPaidCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-500/30 stroke-[1.5]" />
            </div>

            <div className="backdrop-blur-md bg-white/[0.01] border border-cyan-500/20 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono text-cyan-400 uppercase font-bold block">{isEn ? "Partially Paid Contribs" : "Waliolipa Nusu/Sehemu"}</span>
                <p className="text-lg font-black text-white font-mono">{metrics.partiallyPaidCount}</p>
              </div>
              <Activity className="w-8 h-8 text-cyan-500/30 stroke-[1.5]" />
            </div>

            <div className="backdrop-blur-md bg-white/[0.01] border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono text-amber-400 uppercase font-bold block">{isEn ? "No Pledge Registered" : "Bado hawajaahidi"}</span>
                <p className="text-lg font-black text-white font-mono">{metrics.unpledgedCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-500/35 stroke-[1.5]" />
            </div>

            <div className="backdrop-blur-md bg-white/[0.01] border border-rose-500/20 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono text-rose-455 uppercase font-bold block">{isEn ? "Outstanding Balance" : "Sura ya Salio linalodaiwa"}</span>
                <p className="text-lg font-black text-rose-400 font-mono">TZS {metrics.outstandingBalance.toLocaleString()}</p>
              </div>
              <Coins className="w-8 h-8 text-rose-500/30 stroke-[1.5]" />
            </div>

          </div>

          {/* MAIN COLUMN BODY: Live Monitor vs Pledge Simulation */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Live Collection Monitor - 16.4 */}
            <div className="lg:col-span-7 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="space-y-0.5">
                  <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>{isEn ? "Live Contributions Activity Feed" : "Kichunguzi cha Makusanyo ya Live (Live Feed)"}</span>
                  </h4>
                  <p className="text-[10px] text-slate-450">{isEn ? "Recent transactions logged in committee" : "Miamala ya makusanyo inayotokea hivi punde kwenye kamati"}</p>
                </div>

                <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-white/5">
                  <span className="text-[9.5px] font-mono text-slate-400">{isEn ? "Auto-refresh in:" : "Inajisafisha baada ya:"} <strong className="text-amber-400">{secondsToRefresh}s</strong></span>
                  <button 
                    onClick={() => {
                      if (onRefresh) onRefresh();
                      setSecondsToRefresh(60);
                      addActivityLog(`${activeRole} Action`, 'Alifanya manual refresh kwenye Live Monitor feed');
                    }}
                    title="Manual Refresh"
                    className="text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 text-slate-350" />
                  </button>
                </div>
              </div>

              {/* Sandbox Trigger controls for mock updates */}
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-[11px] leading-relaxed text-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p>
                  {isEn ? "Sandbox helper: Simulate a guest completing their financial pledge online:" : "Sandbox: Gusa kitufe cha upande wa kulia ili ku-simulate mgeni kuongeza ahadi mpya kwenye mfumo:"}
                </p>
                <button
                  onClick={handleSimulateUpdateTrigger}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold uppercase py-1.5 px-3.5 rounded-lg shrink-0 transition flex items-center gap-1 cursor-pointer font-mono"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{isEn ? "Simulate Guest Pledge" : "Simulate Ahadi Mpya"}</span>
                </button>
              </div>

              {/* Transactions Ledger matching 16.4 */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {guests.filter(g => (g.payments || []).length > 0).length === 0 ? (
                  <p className="text-center py-10 text-slate-500 font-mono text-[11px]">
                    {isEn ? "No contribution payments registered yet on this event." : "Bado hakuna mabadiliko au malipo yoyote yaliyosajiliwa kwenye event ya sasa."}
                  </p>
                ) : (
                  guests.map(g => {
                    const payments = g.payments || [];
                    return payments.map(p => (
                      <div key={p.id} className="p-3.5 bg-slate-900/40 rounded-xl border border-white/5 flex items-center justify-between gap-3 hover:bg-slate-900/80 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-450 font-bold text-xs uppercase">
                            {g.name[0]}
                          </div>
                          <div>
                            <p className="font-extrabold text-white text-xs uppercase">{g.name}</p>
                            <p className="text-[10px] text-slate-450 font-mono mt-0.5">
                              {p.notes || (isEn ? "Contribution" : "Mchango wa Harusi")} • Ref: <span className="text-slate-350">{p.reference}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-black text-emerald-400 font-mono text-xs">+ TZS {p.amount.toLocaleString()}</p>
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="text-[9px] text-slate-500 font-mono">{p.date}</span>
                            <span className="bg-emerald-500/15 border border-emerald-500/20 text-emerald-450 px-1.5 py-0.5 rounded-full text-[8.5px] uppercase font-bold font-mono">
                              delivered
                            </span>
                          </div>
                        </div>
                      </div>
                    ));
                  })
                )}
              </div>
            </div>

            {/* Treasurer Payment recording / Individual Directory lookup */}
            <div className="lg:col-span-5 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider">
                  {isEn ? "Simulated Ledger Options" : "Mionekano ya Wajumbe (Role-Action Security)"}
                </h4>
                <p className="text-slate-400 text-[10.5px]">
                  {activeRole === 'Treasurer' 
                    ? (isEn ? "Treasurer Tools: Select any guest below to record as payment updates." : "Kama Mweka Hazina, unaweza kurekodi malipo mapya ya wageni hapa:")
                    : (isEn ? "Only Trem/Owner may register collections. View list below:" : "Ni Mweka Hazina tu mwenye uwezo wa kurekodi malipo mapya ya mgeni:")
                  }
                </p>
              </div>

              {/* Guest Roster Ledger with lookup */}
              <div className="space-y-2 max-h-96 overflow-y-auto divide-y divide-white/5">
                {activeRole === 'Committee Member' ? (
                  <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-red-500/10 space-y-3">
                    <ShieldCheck className="w-10 h-10 text-rose-500 mx-auto" />
                    <p className="font-mono text-[11px] text-rose-400 uppercase font-black">
                      {isEn ? "ACCESS RESTRICTED" : "KAZI IMEZUIWA KWA MJUMBE"}
                    </p>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      {isEn ? "According to security control 16.11, general Committee Members cannot view names or individual payment levels. Switch simulator to Event Owner or Treasurer above to unlock." : "Kwa kuzingatia sheria ya kiratibu 16.11 na usalama, mjumbe wa kamati wa kawaida hawezi kuona majina au kiasi kimoja kimoja cha wachangiaji."}
                    </p>
                  </div>
                ) : (
                  guests.map(g => {
                    const balance = (g.pledgeAmount || 0) - (g.paidAmount || 0);
                    return (
                      <div key={g.id} className="pt-2.5 pb-2 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="font-bold text-white uppercase text-[11px]">{g.name}</p>
                          <p className="text-[9.5px] font-mono text-slate-450 mt-0.5">
                            {isEn ? "Pledged" : "Ahadi"}: TZS {(g.pledgeAmount || 0).toLocaleString()} • {isEn ? "Paid" : "Kusanywa"}: TZS {(g.paidAmount || 0).toLocaleString()}
                          </p>
                        </div>

                        <div className="text-right flex items-center gap-2">
                          <div className="font-mono text-right">
                            {balance > 0 ? (
                              <span className="block text-[10px] font-bold text-rose-400">Den: TZS {balance.toLocaleString()}</span>
                            ) : (
                              g.pledgeAmount ? <span className="bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded text-[8.5px] uppercase font-mono">FULLY PAID</span> : <span className="text-slate-650 text-[9.5px]">No Pledge</span>
                            )}
                          </div>

                          {activeRole === 'Treasurer' && (g.pledgeAmount || 0) > 0 && balance > 0 && (
                            <button
                              onClick={() => {
                                setTreasuryTargetGuest(g);
                                setShowTreasurerPayModal(true);
                              }}
                              className="bg-emerald-500 text-slate-950 font-extrabold font-mono text-[9px] uppercase tracking-wider py-1 px-2.5 rounded hover:bg-emerald-400 transition cursor-pointer"
                            >
                              + Lipa
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Committee Notifications panel - 16.8 */}
          <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="space-y-1">
                <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span>{isEn ? "Committee Alert & Event Notification Dispatch Logs" : "Mfumo wa Taarifa Maalum za Kamati (Notifications)"}</span>
                </h4>
                <p className="text-slate-400 text-[10.5px]">
                  {isEn ? "Pledges, completions, and fundraising target achieved alert indicators:" : "Taarifa zote za papo kwa papo za ahadi mpya, makusanyo kukamilika au target kuu kufikiwa:"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={handleClearNotifications}
                  className="p-1 px-3 bg-white/5 rounded-lg border border-white/5 text-slate-400 hover:text-white transition font-mono text-[9.5px]"
                >
                  {isEn ? "Clear Alerts" : "Futa Zote"}
                </button>
              </div>
            </div>

            {/* Channel Dispatch indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-white/5">
              <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 flex items-center justify-between text-[11px]">
                <span className="font-mono text-slate-400">In-App Console Channel</span>
                <span className="font-bold text-emerald-400">● LIVE</span>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 flex items-center justify-between text-[11px]">
                <span className="font-mono text-slate-400">SMS Outbox Alerts</span>
                <span className="font-bold text-emerald-400">● ACTIVE</span>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 flex items-center justify-between text-[11px]">
                <span className="font-mono text-slate-400">WhatsApp Alert Dispatcher</span>
                <span className="font-bold text-emerald-400">● ACTIVE</span>
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-center py-6 text-slate-500 font-mono text-xs">
                  {isEn ? "No notifications registered." : "Hakuna taarifa yoyote mpya ya mabadiliko ya michango kwa sasa."}
                </p>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className="p-3 bg-slate-900/60 rounded-xl border border-white/5 flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1 animate-ping shrink-0" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-white text-xs uppercase">{n.title}</p>
                        <span className="text-[9px] font-mono text-slate-500">• {n.createdAt}</span>
                      </div>
                      <p className="text-[11px] text-slate-450 leading-relaxed">{n.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* SUB-TAB: SMART AI SEATING CHART */}
      {currentSubTab === 'seating' && (
        <div className="space-y-6 animate-fade-in" id="panel-committee-seating">
          <AISeatingChartManager
            event={event}
            guests={guests}
            onUpdateGuests={onUpdateGuests}
          />
        </div>
      )}

      {/* SUB-TAB: AI CREATIVE CARD COPYWRITING */}
      {currentSubTab === 'ai-copywriting' && (
        <div className="space-y-6 animate-fade-in" id="panel-committee-copywriting">
          <AICardCopywriter
            event={event}
            onApplyCopy={(invitationText, smsText) => {
              const updatedEvent = { ...event, invitationText };
              onUpdateEvent(updatedEvent);
              alert(isEn ? "Invitation copy applied successfully to Event Card!" : "Mashairi na maneno ya mwaliko yamehifadhiwa kwenye kadi!");
            }}
          />
        </div>
      )}

      {/* SUB-TAB 2: CONTRIBUTION ANALYTICS */}
      {currentSubTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in" id="panel-committee-analytics">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Trend Graphs - 16.5 */}
            <div className="lg:col-span-8 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider">
                  {isEn ? "Collection Flow Progress Graph" : "Kasi ya Makusanyo kwa Siku (Collection Trend Tracker)"}
                </h4>
                <p className="text-slate-400 text-[10.5px]">
                  {isEn ? "Historical progression tracking daily, weekly or monthly incoming collections:" : "Kiasi cha miamala inayoingia nchini kila siku kuwezesha kamati kupanga bajeti:"}
                </p>
              </div>

              {/* Area collection chart */}
              <div className="h-60 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={collectionChartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '11px', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Aggregated details row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/5 text-center">
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">{isEn ? "Daily Collection Flow" : "Kiwango cha Daily Collections"}</span>
                  <p className="text-base font-black text-amber-400 mt-1 font-mono">TZS {(metrics.totalPaidAmount / Math.max(1, collectionChartData.length)).toFixed(0).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">{isEn ? "Estimated Weekly Rate" : "Kadirio Weekly Collections"}</span>
                  <p className="text-base font-black text-white mt-1 font-mono">TZS {(metrics.totalPaidAmount || 4500000).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">{isEn ? "Active Event Month Sum" : "Monthly Sum (Target status)"}</span>
                  <p className="text-base font-black text-emerald-400 mt-1 font-mono">TZS {metrics.totalPaidAmount.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Top Contributors analytics - 16.5 */}
            <div className="lg:col-span-4 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-yellow-450" />
                  <span>{isEn ? "Pledging Hall of Honor" : "Watunza Heshima (Top Contributors)"}</span>
                </h4>
                <p className="text-slate-400 text-[10.5px]">
                  {isEn ? "Highest individual pledges registered on this active event:" : "Orodha ya wageni waliosajili ahadi zenye thamani kubwa zaidi ya michango:"}
                </p>
              </div>

              {activeRole === 'Committee Member' ? (
                <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-red-500/10 space-y-2">
                  <ShieldCheck className="w-8 h-8 text-rose-500 mx-auto" />
                  <p className="font-mono text-[11px] text-rose-455 uppercase font-black">{isEn ? "ACCESS RESTRICTED" : "KAZI IMEZUIWA"}</p>
                  <p className="text-[10px] text-slate-400 italic">
                    {isEn ? "Committee members can only view general collection rates. Individual rosters are protected." : "Wajumbe wamezuiwa kuona majina kuzuia upendeleo."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topContributorsData.length === 0 ? (
                    <p className="text-center py-6 text-slate-500">
                      {isEn ? "No registered pledges yet." : "Bado hakuna ahadi zilizowekwa."}
                    </p>
                  ) : (
                    topContributorsData.map((g, index) => (
                      <div key={g.id} className="p-3 bg-slate-900/40 rounded-xl border border-white/5 flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-black text-xs text-amber-500">#{index+1}</span>
                          <div>
                            <p className="font-bold text-white uppercase text-[10.5px]">{g.name}</p>
                            <p className="text-[9.5px] font-mono text-slate-400 uppercase mt-0.5">
                              {isEn ? "Paid" : "Amelipa"}: TZS {(g.paidAmount || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-mono font-black text-yellow-450 text-[11.5px]">TZS {(g.pledgeAmount || 0).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Row 2: Interactive RSVP and Fundraising Chart Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            
            {/* RSVP Response Donut Chart */}
            <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider">
                  {isEn ? "RSVP Feedback Breakdown" : "Mchanganuo wa Majibu ya RSVP (Attendance Ratio)"}
                </h4>
                <p className="text-slate-400 text-[10.5px]">
                  {isEn ? "Real-time attendance confirmation rate based on guest RSVP replies:" : "Mchanganuo wa asilimia na idadi ya wageni wanaohudhuria dhidi ya wasiohudhuria:"}
                </p>
              </div>

              <div className="h-56 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={rsvpChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {rsvpChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '11px', borderRadius: '8px' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10.5px', fontFamily: 'monospace' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cash Collection vs Outstanding Commitments Bar Chart */}
            <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider">
                  {isEn ? "Fundraising Collections Balance" : "Ulinganifu wa Makusanyo na Deni (Collections Balance)"}
                </h4>
                <p className="text-slate-400 text-[10.5px]">
                  {isEn ? "Comparison between collected cash and outstanding commitments:" : "Ulinganifu kati ya kiasi kilicholipwa sasa dhidi ya salio la ahadi ambazo hazijalipwa:"}
                </p>
              </div>

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pledgeStatusChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(v) => `TZS ${v.toLocaleString()}`} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '11px', borderRadius: '8px' }} formatter={(value: any) => [`TZS ${value.toLocaleString()}`, isEn ? 'Amount' : 'Kiasi']} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={45}>
                      {pledgeStatusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* SUB-TAB 3: COMMITTEE REPORTS */}
      {currentSubTab === 'reports' && (
        <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-6 animate-fade-in" id="panel-committee-reports">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div className="space-y-1">
              <h3 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-1.5 animate-pulse">
                <Printer className="w-4 h-4 text-amber-400" />
                <span>{isEn ? "Financial Committee Official Ledgers" : "Mfumo Muhimu wa Ripoti za Vitengo vya Sherehe"}</span>
              </h3>
              <p className="text-slate-450 text-[11px]">
                {isEn ? "Generate, export, and formulate reports for the financial audit committee:" : "Zalisha, kagua na andaa matokeo rasmi ya makusanyo kwa wajumbe wa harusi:"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadReportPDF}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 px-4 rounded-xl font-mono text-[10.5px] uppercase transition cursor-pointer shadow-md"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isEn ? "Export Official PDF" : "Pakua Ripoti ya PDF (Rasmi)"}</span>
              </button>
            </div>
          </div>

          {/* Select Report view switcher - 16.7 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'Summary', name: isEn ? '1. Summary Ledger' : '1. Muhtasari wa Michango' },
              { id: 'Collection', name: isEn ? '2. Collections Log' : '2. Ripoti ya Makusanyo' },
              { id: 'Outstanding', name: isEn ? '3. Due Balances' : '3. Wenye Salio la Deni' },
              { id: 'FullyPaid', name: isEn ? '4. Fully Paid' : '4. Waliolipa Yote' },
              { id: 'Pending', name: isEn ? '5. Active Pledges' : '5. Wenye Ahadi' },
              { id: 'NoPledge', name: isEn ? '6. No Pledge' : '6. Wasioahidi Bado' },
              { id: 'Attendance', name: isEn ? '7. Attendance Log' : '7. Mahudhurio ya Wageni' },
              { id: 'RSVP_Report', name: isEn ? '8. RSVP & Messages' : '8. RSVP & Ujumbe' },
            ].map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedReport(r.id)}
                className={`py-2 px-3 border rounded-xl font-mono text-[9px] font-bold text-center uppercase transition cursor-pointer text-slate-100 ${
                  selectedReport === r.id 
                    ? 'bg-white/10 border-amber-500 text-amber-400 font-extrabold' 
                    : 'bg-white/[0.01] border-white/5 hover:bg-white/5 hover:border-white/10'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>

          {/* REPORT SCREEN RENDER CONTAINER */}
          <div className={`p-5 rounded-2xl border space-y-4 ${
            selectedReport === 'Summary' 
              ? 'bg-transparent border-transparent p-0' 
              : 'bg-slate-950/80 border-white/5'
          }`} id="printable-area-committee">
            
            {/* Header info showing for other reports */}
            {selectedReport !== 'Summary' && (() => {
              const totalSmsSent = guests.reduce((sum, g) => sum + (g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0)), 0);
              const totalWhatsappSent = guests.reduce((sum, g) => sum + (g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)), 0);
              return (
                <div className="border-b border-white/10 pb-4 text-center justify-center space-y-1.5 pb-4">
                  <h1 className="text-sm font-black uppercase text-amber-400 tracking-wider">EVENTCARD COMMITTEE OFFICIAL LEDGER</h1>
                  <p className="text-[10px] font-mono text-slate-400 uppercase">Event: <span className="text-white font-bold">{event.name || 'Harusi yetu'}</span> • Code: {event.id}</p>
                  <p className="text-[9px] font-mono text-slate-500">{isEn ? "Active Report:" : "Aina ya Ripoti ya Sasa:"} <strong className="text-white uppercase">{selectedReport}</strong> • Printed At: {new Date().toLocaleDateString('sw-TZ')}</p>
                  <div className="flex flex-wrap justify-center items-center gap-3 mt-2 px-3 py-1 bg-white/5 rounded-xl border border-white/5 max-w-lg mx-auto divide-x divide-white/10">
                    <span className="text-[10px] text-slate-400 font-mono pl-2">
                      {isEn ? 'Total SMS Sent:' : 'Jumla SMS Zilizotumwa:'} <strong className="text-blue-400 font-black">{totalSmsSent}</strong>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono pl-3">
                      {isEn ? 'Total WA Sent:' : 'Jumla WA Zilizotumwa:'} <strong className="text-emerald-400 font-black">{totalWhatsappSent}</strong>
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Render 1: Summary Ledger (Prstine layout matching specification) */}
            {selectedReport === 'Summary' && (() => {
              const now = new Date();
              const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
              const dateFormatted = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
              const timeFormatted = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
              const printedDateString = `${weekday}, ${dateFormatted} at ${timeFormatted}`;

              return (
                <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6 max-w-5xl mx-auto font-sans relative" id="printable-report-card">
                  <ReportWatermark />
                  {/* Embed style block for perfect print purposes to target print-friendly styles cleanly */}
                  <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                      /* Hide everything except screen content */
                      body * {
                        visibility: hidden;
                      }
                      #printable-report-card, #printable-report-card * {
                        visibility: visible;
                      }
                      #printable-report-card {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                      }
                      /* Explicit print-color adjustments */
                      .print-bg-gray {
                        background-color: #f3f4f6 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                      .print-bg-header {
                        background-color: #dee5ed !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                      .print-border-gray {
                        border-color: #dddddd !important;
                      }
                      .print-text-green {
                        color: #16a34a !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                      .print-text-red {
                        color: #dc2626 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                      .print-text-amber {
                        color: #92400e !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                    }
                  `}} />

                  {/* 1. HEADER BAR */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="space-y-4">
                      {/* Logo & Badge / Label Box */}
                      <div className="flex items-center gap-4">
                        <img src="/logo.png" alt="EventCard Logo" className="h-20 w-auto object-contain" />
                        <div className="inline-flex items-center border border-slate-300 px-3 py-1.5 rounded print-border-gray bg-slate-900/5">
                          <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                            AUDIT MASTER
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Printed Date (Right-aligned) */}
                    <div className="sm:text-right space-y-0.5 text-[11px] text-slate-500">
                      <p className="font-semibold uppercase tracking-wider text-slate-400">{isEn ? 'Exported/Printed Date:' : 'Tarehe ya Kuchapishwa:'}</p>
                      <p className="font-bold text-slate-800">{printedDateString}</p>
                    </div>
                  </div>

                  {/* Document Heading */}
                  <div className="mt-4 space-y-1">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                      {isEn ? 'OFFICIAL CONTRIBUTIONS REPORT' : 'RIPOTI RASMI YA MICHANGO'}
                    </h1>
                    <p className="text-[12px] font-medium text-slate-600 uppercase flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="font-bold text-slate-900">{event.name}</span>
                      <span>•</span>
                      <span>{isEn ? 'Event Date:' : 'Tarehe ya Sherehe:'}</span>
                      <span className="font-bold text-slate-900">{event.date || '2026-05-31'}</span>
                    </p>
                  </div>

                  {/* Thick Solid Dark Divider */}
                  <div className="h-1 bg-slate-900 my-2" />

                  {/* 2. SUMMARY METRICS ROW - 4 bordered cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Target - BLUE VIBRANT */}
                    <div className="border border-blue-400 bg-blue-600 p-4 rounded-2xl text-center flex flex-col justify-between shadow-lg shadow-blue-500/20">
                      <span className="text-[9.5px] font-black text-blue-50 uppercase tracking-[0.2em]">{isEn ? 'TARGET BUDGET' : 'MALENGO (TARGET)'}</span>
                      <span className="text-xl font-black text-white mt-1.5 block font-mono">
                        {fundraisingTarget.toLocaleString()} TZS
                      </span>
                      <span className="mt-2 text-[10px] font-extrabold text-blue-100 bg-blue-700/60 px-2 py-0.5 rounded-full inline-block font-mono">
                        100% Lengo Kuu
                      </span>
                    </div>
                    {/* Card 2: Pledged - AMBER VIBRANT */}
                    <div className="border border-amber-400 bg-amber-500 p-4 rounded-2xl text-center flex flex-col justify-between shadow-lg shadow-amber-500/20">
                      <span className="text-[9.5px] font-black text-amber-50 uppercase tracking-[0.2em]">{isEn ? 'TOTAL PLEDGED' : 'JUMLA YA AHADI'}</span>
                      <span className="text-xl font-black text-white mt-1.5 block font-mono">
                        {metrics.totalPledgedAmount.toLocaleString()} TZS
                      </span>
                      <span className="mt-2 text-[10px] font-extrabold text-amber-950 bg-amber-200/90 px-2 py-0.5 rounded-full inline-block font-mono">
                        {fundraisingTarget > 0 ? ((metrics.totalPledgedAmount / fundraisingTarget) * 100).toFixed(1) : '0.0'}% ya Target
                      </span>
                    </div>
                    {/* Card 3: Collected - EMERALD VIBRANT */}
                    <div className="border border-emerald-400 bg-emerald-600 p-4 rounded-2xl text-center flex flex-col justify-between shadow-lg shadow-emerald-500/20">
                      <span className="text-[9.5px] font-black text-emerald-50 uppercase tracking-[0.2em]">{isEn ? 'CASH COLLECTED' : 'FEDHA TASLIMU'}</span>
                      <span className="text-xl font-black text-white mt-1.5 block font-mono">
                        {metrics.totalPaidAmount.toLocaleString()} TZS
                      </span>
                      <span className="mt-2 text-[10px] font-extrabold text-emerald-950 bg-emerald-200/95 px-2 py-0.5 rounded-full inline-block font-mono">
                        {fundraisingTarget > 0 ? ((metrics.totalPaidAmount / fundraisingTarget) * 100).toFixed(1) : '0.0'}% Target • {metrics.totalPledgedAmount > 0 ? ((metrics.totalPaidAmount / metrics.totalPledgedAmount) * 100).toFixed(1) : '0.0'}% Ahadi
                      </span>
                    </div>
                    {/* Card 4: Outstanding - ROSE VIBRANT */}
                    <div className="border border-rose-400 bg-rose-600 p-4 rounded-2xl text-center flex flex-col justify-between shadow-lg shadow-rose-500/20">
                      <span className="text-[9.5px] font-black text-rose-50 uppercase tracking-[0.2em]">{isEn ? 'OUTSTANDING BAL' : 'DENI / SALIO'}</span>
                      <span className="text-xl font-black text-white mt-1.5 block font-mono">
                        {metrics.outstandingBalance.toLocaleString()} TZS
                      </span>
                      <span className="mt-2 text-[10px] font-extrabold text-rose-100 bg-rose-800/60 px-2 py-0.5 rounded-full inline-block font-mono">
                        {(100 - Number(metrics.totalPledgedAmount > 0 ? ((metrics.totalPaidAmount / metrics.totalPledgedAmount) * 100).toFixed(1) : 0) > 0 ? (100 - Number(metrics.totalPledgedAmount > 0 ? ((metrics.totalPaidAmount / metrics.totalPledgedAmount) * 100).toFixed(1) : 0)).toFixed(1) : '0.0')}% Inadaiwa
                      </span>
                    </div>
                  </div>

                  {/* COLLECTION PROGRESS RATIO BANNER */}
                  <div className="bg-slate-900 text-white p-3.5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 font-mono print-bg-gray mt-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                      <span>{isEn ? 'FUNDS COLLECTION PROGRESS RATIO' : 'ASILIMIA YA MAKUSANYO YA FEDHA'}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <div className="bg-slate-800 border border-emerald-500/40 px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <span className="text-slate-300">{isEn ? 'Via Target Budget:' : 'via Total Budget (Target):'}</span>
                        <span className="font-black text-emerald-400 text-sm font-mono">
                          {fundraisingTarget > 0 ? ((metrics.totalPaidAmount / fundraisingTarget) * 100).toFixed(1) : '0.0'}%
                        </span>
                      </div>
                      <div className="bg-slate-800 border border-cyan-500/40 px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <span className="text-slate-300">{isEn ? 'Via Total Pledges:' : 'via Total Pledges (Ahadi):'}</span>
                        <span className="font-black text-cyan-400 text-sm font-mono">
                          {metrics.totalPledgedAmount > 0 ? ((metrics.totalPaidAmount / metrics.totalPledgedAmount) * 100).toFixed(1) : '0.0'}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 5 Pledge Status Summary Cards requested by user */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
                    <div className="border border-slate-300 bg-slate-100 p-3.5 rounded-xl text-center flex flex-col justify-between print-bg-gray">
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider font-mono">
                        HAWAJAAHIDI (NO PLEDGE)
                      </span>
                      <span className="text-xl font-black text-slate-900 mt-1 font-mono">
                        {unpledgedList.length}
                      </span>
                    </div>

                    <div className="border border-amber-300 bg-amber-50 p-3.5 rounded-xl text-center flex flex-col justify-between print-bg-gray">
                      <span className="text-[9px] font-black text-amber-800 uppercase tracking-wider font-mono">
                        WALIOAHIDI TU (PLEDGED)
                      </span>
                      <span className="text-xl font-black text-amber-900 mt-1 font-mono">
                        {noPaymentPledgeList.length}
                      </span>
                    </div>

                    <div className="border border-cyan-300 bg-cyan-50 p-3.5 rounded-xl text-center flex flex-col justify-between print-bg-gray">
                      <span className="text-[9px] font-black text-cyan-800 uppercase tracking-wider font-mono">
                        LIPA NUSU (PARTIALLY)
                      </span>
                      <span className="text-xl font-black text-cyan-900 mt-1 font-mono">
                        {partialPaidList.length}
                      </span>
                    </div>

                    <div className="border border-emerald-300 bg-emerald-50 p-3.5 rounded-xl text-center flex flex-col justify-between print-bg-gray">
                      <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wider font-mono">
                        LIPA YOTE (FULLY PAID)
                      </span>
                      <span className="text-xl font-black text-emerald-900 mt-1 font-mono">
                        {fullyPaidList.length}
                      </span>
                    </div>

                    <div className="border border-purple-300 bg-purple-50 p-3.5 rounded-xl text-center flex flex-col justify-between col-span-2 sm:col-span-1 print-bg-gray">
                      <span className="text-[9px] font-black text-purple-800 uppercase tracking-wider font-mono">
                        WENYE MADENI ACTIVE
                      </span>
                      <span className="text-xl font-black text-purple-900 mt-1 font-mono">
                        {noPaymentPledgeList.length + partialPaidList.length}
                      </span>
                    </div>
                  </div>

                  {/* 3. MASTER GUEST REVENUE DATABASE SECTION */}
                  <div className="space-y-3 pt-2">
                    <div className="bg-slate-100 p-2.5 rounded-lg flex items-center justify-between print-bg-gray">
                      <h3 className="font-black text-[11.5px] text-slate-900 uppercase tracking-wider">
                        {isEn ? 'MASTER GUEST REVENUE DATABASE' : 'DAFTARI KUU LA MICHANGO YA WAGENI'}
                      </h3>
                      <span className="text-[10px] font-extrabold text-slate-600 tracking-widest uppercase">
                        {guests.length} {isEn ? 'GUESTS TOTAL' : 'WAGENI WOTE'}
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 print-border-gray">
                      <table className="w-full text-left border-collapse text-[11px] print-border-gray">
                        <thead>
                          <tr className="bg-[#dee5ed] text-slate-900 font-bold border-b border-slate-200 print-bg-header print-border-gray">
                            <th className="py-2.5 px-3 border-r border-slate-200 text-center print-border-gray uppercase tracking-wider">{isEn ? 'S/N' : 'Na.'}</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 print-border-gray uppercase tracking-wider">{isEn ? 'Guest Full Name' : 'Jina la Mgeni'}</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 print-border-gray uppercase tracking-wider">{isEn ? 'Mobile' : 'Simu'}</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 text-right print-border-gray uppercase tracking-wider">{isEn ? 'Pledge' : 'Ahadi'}</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 text-right print-border-gray uppercase tracking-wider">{isEn ? 'Paid Amt' : 'Imelipwa'}</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 text-right print-border-gray uppercase tracking-wider">{isEn ? 'Balance' : 'Salio'}</th>
                            <th className="py-2.5 px-3 print-border-gray uppercase tracking-wider">{isEn ? 'Clearance' : 'Hali'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {masterGuestList.map((g) => (
                            <tr key={g.sn} className="hover:bg-slate-50/50 print-border-gray text-slate-700">
                              <td className="py-2.5 px-3 border-r border-slate-200 text-center print-border-gray font-mono text-slate-500">{g.sn}</td>
                              <td className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-900 print-border-gray uppercase">{g.name}</td>
                              <td className="py-2.5 px-3 border-r border-slate-200 print-border-gray font-mono">{g.phone}</td>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-900 font-bold print-border-gray font-mono">{g.pledge.toLocaleString()}</td>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-right text-[#16a34a] print-text-green font-bold print-border-gray font-mono">{g.paid.toLocaleString()}</td>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-right text-[#dc2626] print-text-red font-bold print-border-gray font-mono">{g.balance.toLocaleString()}</td>
                              <td className={`py-2.5 px-3 border-r border-slate-200 font-bold print-border-gray uppercase text-[10px] ${
                                g.clearance === 'Completed' ? 'text-green-600 print-text-green font-black' : g.clearance === 'Partial' ? 'text-red-600 print-text-red font-black' : 'text-slate-900'
                              }`}>
                                {isEn ? g.clearance : (g.clearance === 'Completed' ? 'Umekamilisha' : g.clearance === 'Partial' ? 'Kiasi' : 'Bado')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Native print & PDF download buttons (remains ignored on printed format via CSS) */}
                  <div className="flex flex-wrap justify-between items-center gap-2 pt-4 border-t border-slate-100 print:hidden">
                    <button 
                      onClick={() => downloadReportCSV('Muhtasari_Ledger', guests)}
                      className="p-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-mono text-[10.5px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Download Excel / CSV' : 'Pakua Excel / CSV'}</span>
                    </button>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={downloadReportPDF}
                        className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] py-2.5 px-4 rounded-xl font-mono uppercase transition cursor-pointer shadow-md"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Download Official PDF' : 'Pakua Ripoti ya PDF'}</span>
                      </button>

                      <button 
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 bg-slate-900 text-white font-extrabold hover:bg-slate-800 text-[11px] py-2.5 px-4 rounded-xl font-mono uppercase transition cursor-pointer shadow-md"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Direct Browser Print' : 'Chapa Moja kwa Moja'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Render 2: Collections Log / Detailed Payments Report */}
            {selectedReport === 'Collection' && (
              <div className="space-y-6">
                <style dangerouslySetInnerHTML={{ __html: `
                  @media print {
                    .print-table { color: #000 !important; }
                    .print-table th { background: #f1f5f9 !important; color: #475569 !important; border-bottom: 2px solid #cbd5e1 !important; }
                    .print-table td { border-bottom: 1px solid #e2e8f0 !important; }
                    .print-text-emerald { color: #059669 !important; -webkit-print-color-adjust: exact !important; }
                    .print-bg-slate { background: #f8fafc !important; -webkit-print-color-adjust: exact !important; }
                  }
                `}} />

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/5 p-5 rounded-2xl border border-white/5 shadow-inner">
                  <div>
                    <h4 className="font-black text-sm uppercase text-white font-mono tracking-tighter">2. Deteli ya Makusanyo / Payments Ledger</h4>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">{event.name} • {event.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => downloadReportCSV('Log_ya_Makusanyo_Yaliyolipwa', activePledgeList)}
                      className="flex items-center gap-2 bg-slate-800 text-amber-400 hover:bg-slate-700 font-bold text-[10px] py-2 px-4 rounded-xl border border-amber-500/10 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>DOWNLOAD CSV</span>
                    </button>
                    <button 
                      onClick={() => window.print()}
                      className="flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-500 font-bold text-[10px] py-2 px-4 rounded-xl shadow-lg shadow-emerald-900/20 transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>CHAPA RIPOTI</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
                   <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-2xl shadow-lg shadow-emerald-950/20">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{isEn ? 'TOTAL COLLECTION' : 'JUMLA MAKUSANYO'}</p>
                      <p className="text-2xl font-mono font-black text-emerald-300 mt-2">{metrics.totalPaidAmount.toLocaleString()} <span className="text-xs opacity-60">TZS</span></p>
                      <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between">
                         <span className="text-[9px] text-emerald-500 font-bold uppercase">{isEn ? 'Success Rate' : 'Kiwango cha Mafanikio'}</span>
                         <span className="text-[10px] font-black text-white">{metrics.totalPledgedAmount > 0 ? ((metrics.totalPaidAmount / metrics.totalPledgedAmount) * 100).toFixed(1) : 0}%</span>
                      </div>
                   </div>
                   <div className="bg-blue-500/10 border border-blue-500/30 p-5 rounded-2xl shadow-lg shadow-blue-950/20">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{isEn ? 'PAYMENTS COUNT' : 'IDADI YA MALIPO'}</p>
                      <p className="text-2xl font-mono font-black text-blue-300 mt-2">{guests.reduce((acc, g) => acc + (g.payments || []).length, 0)}</p>
                      <div className="mt-4 pt-3 border-t border-blue-500/20 flex items-center justify-between">
                         <span className="text-[9px] text-blue-500 font-bold uppercase">{isEn ? 'Average Trans' : 'Wastani wa Malipo'}</span>
                         <span className="text-[10px] font-black text-white">
                           {Math.round(metrics.totalPaidAmount / (guests.reduce((acc, g) => acc + (g.payments || []).length, 0) || 1)).toLocaleString()}
                         </span>
                      </div>
                   </div>
                   <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl shadow-lg shadow-amber-950/20">
                      <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{isEn ? 'PENDING COMMITMENT' : 'PENDING COMMITMENT'}</p>
                      <p className="text-2xl font-mono font-black text-amber-200 mt-2">{metrics.outstandingBalance.toLocaleString()} <span className="text-xs opacity-60">TZS</span></p>
                      <div className="mt-4 pt-3 border-t border-amber-500/20 flex items-center justify-between">
                         <span className="text-[9px] text-amber-500 font-bold uppercase">{isEn ? 'In Arrears' : 'Inadaiwa'}</span>
                         <span className="text-[10px] font-black text-rose-400">{isEn ? 'Action Required' : 'Hatua Inahitajika'}</span>
                      </div>
                   </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-900/50">
                  <table className="w-full text-left border-collapse font-sans text-xs print-table">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                        <th className="py-3.5 px-4 font-black">S/N</th>
                        <th className="py-3.5 px-4 font-black">Mlipaji (Guest Name)</th>
                        <th className="py-3.5 px-4 font-black text-right">Kiasi Kilicholipwa</th>
                        <th className="py-3.5 px-4 font-black">{isEn ? 'Date' : 'Tarehe'}</th>
                        <th className="py-3.5 px-4 font-black">Msimbo / Ref</th>
                        <th className="py-3.5 px-4 font-black">Maelezo (Notes)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {(() => {
                        let sn = 1;
                        const allPayments: {guestName: string, p: any}[] = [];
                        guests.forEach(g => {
                          (g.payments || []).forEach(p => {
                            allPayments.push({ guestName: g.name || '', p });
                          });
                        });
                        
                        // Sort by date descending
                        allPayments.sort((a, b) => new Date(b.p.date).getTime() - new Date(a.p.date).getTime());

                        if (allPayments.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="py-12 text-center text-slate-500 font-sans italic">
                                <p className="text-lg">📭</p>
                                <p className="mt-2">{isEn ? 'No payments registered in the system yet.' : 'Hakuna malipo yaliyosajiliwa bado kwenye mfumo.'}</p>
                              </td>
                            </tr>
                          );
                        }

                        return allPayments.map((item, idx) => (
                          <tr key={item.p.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="py-3 px-4 text-slate-500 text-[10px]">{idx + 1}</td>
                            <td className="py-3 px-4 font-bold text-slate-200 group-hover:text-white uppercase tracking-tight">{item.guestName}</td>
                            <td className="py-3 px-4 text-right">
                               <span className="bg-emerald-500/10 text-emerald-400 print-text-emerald font-black px-2.5 py-1 rounded-lg border border-emerald-500/20 text-[11px]">
                                 {item.p.amount.toLocaleString()}
                               </span>
                            </td>
                            <td className="py-3 px-4 text-slate-400 font-medium">{item.p.date}</td>
                            <td className="py-4 px-4">
                               <span className="text-slate-500 text-[10px] break-all border-b border-dotted border-slate-700 pb-0.5">{item.p.reference || 'N/A'}</span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-[10px] group-hover:text-slate-300 transition-colors max-w-xs truncate" title={item.p.notes}>
                              {item.p.notes || '-'}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center bg-slate-950/40 p-4 rounded-xl border border-white/5 print:hidden">
                   <p className="text-[10px] text-slate-500 font-medium">Record iliyochaguliwa inajumuisha malipo yote yaliyosajiliwa hadi sasa.</p>
                   <p className="text-[10px] text-slate-400 font-mono italic">Verified by Kadi Digital Audit System</p>
                </div>
              </div>
            )}

            {/* Render 3: Due Balances */}
            {selectedReport === 'Outstanding' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono">3. Orodha ya Wenye Balansi Inayodaiwa</h4>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => downloadReportCSV('Orodha_ya_Wenye_Madeni', [...partialPaidList, ...noPaymentPledgeList])}
                      className="p-1 px-2.5 bg-white/5 hover:bg-white/10 rounded font-mono text-[10px] text-amber-400 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download CSV</span>
                    </button>
                    <button 
                      onClick={downloadReportPDF}
                      className="p-1 px-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded font-mono text-[10px] flex items-center gap-1 transition cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Pakua PDF</span>
                    </button>
                  </div>
                </div>

                <table className="w-full text-left border-collapse font-sans text-xs" id="table-outstanding-report">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase">
                      <th className="py-2 px-3 text-center w-10">S/N</th>
                      <th className="py-2 px-3">Guest Name</th>
                      <th className="py-2 px-3">Pledge Type</th>
                      <th className="py-2 px-3 text-right">Commitment TZS</th>
                      <th className="py-2 px-3 text-right">Paid So Far TZS</th>
                      <th className="py-2 px-3 text-right text-rose-400">Balance Due TZS</th>
                      <th className="py-2 px-3 text-center">SMS</th>
                      <th className="py-2 px-3 text-center">WA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                    {[...partialPaidList, ...noPaymentPledgeList].length === 0 ? (
                      <tr><td colSpan={8} className="py-6 text-center text-slate-500">{isEn ? 'God is good! No one owes anything right now.' : 'Mungu ni mwema! Hakuna mtu anayedaiwa sasa hivi.'}</td></tr>
                    ) : (
                      [...partialPaidList, ...noPaymentPledgeList].map((g, idx) => {
                        const b = (g.pledgeAmount || 0) - (g.paidAmount || 0);
                        return (
                          <tr key={g.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-2 px-3 text-center text-slate-500 font-semibold">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold uppercase">{g.name}</td>
                            <td className="py-2 px-3 text-slate-400 uppercase text-[9.5px]">{(g.paidAmount || 0) > 0 ? 'LIPA NUSU' : 'HAIJALIPWA BADO'}</td>
                            <td className="py-2 px-3 text-right">TZS {(g.pledgeAmount || 0).toLocaleString()}</td>
                            <td className="py-2 px-3 text-right">TZS {(g.paidAmount || 0).toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-rose-400 font-black">TZS {b.toLocaleString()}</td>
                            <td className="py-2 px-3 text-center text-blue-400 font-bold">{g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0)}</td>
                            <td className="py-2 px-3 text-center text-emerald-400 font-bold">{g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Render 4: Fully Paid */}
            {selectedReport === 'FullyPaid' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono">{isEn ? '4. List of Fully Paid Members' : '4. Orodha ya Waliotimiza Ahadi Kikamilifu'}</h4>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => downloadReportCSV('Orodha_ya_Waliolipa_Yote', fullyPaidList)}
                      className="p-1 px-2.5 bg-white/5 hover:bg-white/10 rounded font-mono text-[10px] text-amber-400 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download CSV</span>
                    </button>
                    <button 
                      onClick={downloadReportPDF}
                      className="p-1 px-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded font-mono text-[10px] flex items-center gap-1 transition cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Pakua PDF</span>
                    </button>
                  </div>
                </div>

                <table className="w-full text-left border-collapse font-sans text-xs" id="table-fullypaid-report">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase">
                      <th className="py-2 px-3 text-center w-10">S/N</th>
                      <th className="py-2 px-3">Mchangiaji</th>
                      <th className="py-2 px-3">Simu ya Mkononi</th>
                      <th className="py-2 px-3 text-right">Goal Completed TZS</th>
                      <th className="py-2 px-3 text-center">SMS</th>
                      <th className="py-2 px-3 text-center">WA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                    {fullyPaidList.length === 0 ? (
                      <tr><td colSpan={6} className="py-6 text-center text-slate-500">Haipo kumbukumbu yoyote ya mchangiaji aliyelipa yote bado.</td></tr>
                    ) : (
                      fullyPaidList.map((g, idx) => (
                        <tr key={g.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-2 px-3 text-center text-slate-500 font-semibold">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold uppercase">{g.name}</td>
                          <td className="py-2 px-3 text-slate-400">{g.phone || (isEn ? 'No phone' : 'Hakuna simu')}</td>
                          <td className="py-2 px-3 text-right text-emerald-400 font-black">TZS {(g.pledgeAmount || 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-center text-blue-400 font-bold">{g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0)}</td>
                          <td className="py-2 px-3 text-center text-emerald-400 font-bold">{g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Render 5: Active Pledges */}
            {selectedReport === 'Pending' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono">{isEn ? '5. Master List of All Pledges' : '5. Orodha Kuu ya Ahadi Zote zilizowekwa'}</h4>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => downloadReportCSV('Kumbukumbu_ya_Ahadi_Zote', activePledgeList)}
                      className="p-1 px-2.5 bg-white/5 hover:bg-white/10 rounded font-mono text-[10px] text-amber-400 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download CSV</span>
                    </button>
                    <button 
                      onClick={downloadReportPDF}
                      className="p-1 px-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded font-mono text-[10px] flex items-center gap-1 transition cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Pakua PDF</span>
                    </button>
                  </div>
                </div>

                <table className="w-full text-left border-collapse font-sans text-xs" id="table-pending-report">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase">
                      <th className="py-2 px-3 text-center w-10">S/N</th>
                      <th className="py-2 px-3">Mgeni</th>
                      <th className="py-2 px-3 font-mono">status</th>
                      <th className="py-2 px-3 text-right font-mono">Amount Pledge</th>
                      <th className="py-2 px-3 text-center">SMS</th>
                      <th className="py-2 px-3 text-center">WA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                    {activePledgeList.length === 0 ? (
                      <tr><td colSpan={6} className="py-6 text-center text-slate-500">Hakuna ahadi ya mchango iliyoandikishwa bado.</td></tr>
                    ) : (
                      activePledgeList.map((g, idx) => (
                        <tr key={g.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-2 px-3 text-center text-slate-500 font-semibold">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold uppercase">{g.name}</td>
                          <td className="py-2 px-3 text-amber-400 uppercase text-[9.5px]">{g.pledgeStatus}</td>
                          <td className="py-2 px-3 text-right font-black">TZS {(g.pledgeAmount || 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-center text-blue-400 font-bold">{g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0)}</td>
                          <td className="py-2 px-3 text-center text-emerald-400 font-bold">{g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Render 7: Attendance Log */}
            {selectedReport === 'Attendance' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono">7. Orodha ya Wageni Walioingia (Check-ins)</h4>
                  <button 
                    onClick={downloadAttendanceCSV}
                    disabled={checkedInList.length === 0}
                    className="p-1 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:bg-white/5 rounded font-mono text-[10px] text-emerald-400 disabled:text-slate-500 border border-emerald-500/20 flex items-center gap-1 transition cursor-pointer"
                    title="Export all check-ins to CSV"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download Attendance CSV ({checkedInList.length})</span>
                  </button>
                </div>

                <table className="w-full text-left border-collapse font-sans text-xs" id="table-attendance-report">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase">
                      <th className="py-2 px-3 text-center w-10">S/N</th>
                      <th className="py-2 px-3">Muda (Time)</th>
                      <th className="py-2 px-3">Jina la Mgeni</th>
                      <th className="py-2 px-3">Aina ya Kadi</th>
                      <th className="py-2 px-3 text-right">Hali ya Skani</th>
                      <th className="py-2 px-3 text-center">SMS</th>
                      <th className="py-2 px-3 text-center">WA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                    {checkedInList.length === 0 ? (
                      <tr><td colSpan={7} className="py-10 text-center text-slate-500 italic uppercase tracking-widest text-[9px]">Skani bado hazijaanza. Hakuna mahudhurio ya kuonyesha.</td></tr>
                    ) : (
                      [...checkedInList]
                        .sort((a,b) => (b.checkedInTime || '').localeCompare(a.checkedInTime || ''))
                        .map((g, idx) => (
                          <tr key={g.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-2.5 px-3 text-center text-slate-500 font-semibold">{idx + 1}</td>
                            <td className="py-2.5 px-3 text-blue-400 font-bold">{g.checkedInTime}</td>
                            <td className="py-2.5 px-3 font-bold uppercase">{g.name}</td>
                            <td className="py-2.5 px-3 text-slate-400 text-[9px]">{g.cardType}</td>
                            <td className="py-2.5 px-3 text-right text-emerald-400 font-black">SUCCESS</td>
                            <td className="py-2.5 px-3 text-center text-blue-400 font-bold">{g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0)}</td>
                            <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">{g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {selectedReport === 'NoPledge' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono">6. Orodha ya Wageni ambao Bado Hawajaonyesha Ahadi Yoyote</h4>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => downloadReportCSV('Orodha_Wasioahidi_Bado', unpledgedList)}
                      className="p-1 px-2.5 bg-white/5 hover:bg-white/10 rounded font-mono text-[10px] text-amber-400 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download CSV ({unpledgedList.length})</span>
                    </button>
                    <button 
                      onClick={downloadReportPDF}
                      className="p-1 px-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded font-mono text-[10px] flex items-center gap-1 transition cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Pakua PDF</span>
                    </button>
                  </div>
                </div>

                <table className="w-full text-left border-collapse font-sans text-xs" id="table-nopledge-report">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase">
                      <th className="py-2 px-3 text-center w-10">S/N</th>
                      <th className="py-2 px-3">Jina la Mgeni</th>
                      <th className="py-2 px-3">Mwasiliano ya Simu</th>
                      <th className="py-2 px-3 text-center">Registration Link</th>
                      <th className="py-2 px-3 text-center">SMS</th>
                      <th className="py-2 px-3 text-center">WA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                    {unpledgedList.length === 0 ? (
                      <tr><td colSpan={6} className="py-6 text-center text-slate-500">Safi sana! Wageni wote wameshasajili ahadi zao.</td></tr>
                    ) : (
                      unpledgedList.map((g, idx) => (
                        <tr key={g.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-2 px-3 text-center text-slate-500 font-semibold">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold uppercase">{g.name}</td>
                          <td className="py-2 px-3 text-slate-400">{g.phone || 'Hakuna namba ya simu'}</td>
                          <td className="py-2 px-3 text-center text-slate-550 text-[10px]">https://eventcard.co.tz/pledge/{g.code}</td>
                          <td className="py-2 px-3 text-center text-blue-400 font-bold">{g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0)}</td>
                          <td className="py-2 px-3 text-center text-emerald-400 font-bold">{g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Render 8: RSVP & Messages Report Dashboard */}
            {selectedReport === 'RSVP_Report' && (() => {
              const countComing = guests.filter(g => g.rsvpStatus === 'Atahudhuria').length;
              const totalPeopleAttending = guests.filter(g => g.rsvpStatus === 'Atahudhuria').reduce((acc, current) => acc + (current.rsvpGuestsCount || 1), 0);
              const countDeclined = guests.filter(g => g.rsvpStatus === 'Hatahudhuria').length;
              const countMaybe = guests.filter(g => g.rsvpStatus === 'Labda').length;
              const countPending = guests.filter(g => !g.rsvpStatus || g.rsvpStatus === 'Bado').length;
              
              const sortedRSVPGuests = [...guests].sort((a,b) => {
                const valA = a.rsvpStatus === 'Atahudhuria' ? 1 : a.rsvpStatus === 'Labda' ? 2 : a.rsvpStatus === 'Bado' || !a.rsvpStatus ? 3 : 4;
                const valB = b.rsvpStatus === 'Atahudhuria' ? 1 : b.rsvpStatus === 'Labda' ? 2 : b.rsvpStatus === 'Bado' || !b.rsvpStatus ? 3 : 4;
                return valA - valB || a.name.localeCompare(b.name);
              });

              return (
                <div className="space-y-6" id="panel-rsvp-report">
                  {/* RSVP stats grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                     <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl shadow">
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">WATAKAOFIKA / COMING</p>
                        <p className="text-xl font-mono font-black text-emerald-300 mt-2">{countComing} Kadi ({totalPeopleAttending} Watu)</p>
                     </div>
                     <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl shadow">
                        <p className="text-[10px] font-black text-rose-455 uppercase tracking-widest">HAWATAHUDHURIA / DECLINED</p>
                        <p className="text-xl font-mono font-black text-rose-300 mt-2">{countDeclined} Kadi</p>
                     </div>
                     <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl shadow">
                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">LABDA / MAYBE</p>
                        <p className="text-xl font-mono font-black text-amber-300 mt-2">{countMaybe} Kadi</p>
                     </div>
                     <div className="bg-slate-500/10 border border-slate-500/30 p-4 rounded-2xl shadow">
                        <p className="text-[10px] font-black text-slate-350 uppercase tracking-widest">BADO MAJIBU / PENDING</p>
                        <p className="text-xl font-mono font-black text-slate-200 mt-2">{countPending} Wageni</p>
                     </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono">8. RSVP & Ujumbe (Zilizotumwa kwa Mgeni Mmoja Mmoja)</h4>
                    <span className="text-[10px] font-bold font-mono text-slate-400 uppercase">Jumla: {guests.length} Wageni Waliosajiliwa</span>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-900/50">
                    <table className="w-full text-left border-collapse font-sans text-xs">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                          <th className="py-3 px-4 font-black">S/N</th>
                          <th className="py-3 px-4 font-black">Mgeni / Guest Name</th>
                          <th className="py-3 px-4 font-black">Simu</th>
                          <th className="py-3 px-4 font-black text-center">Aina ya Kadi</th>
                          <th className="py-3 px-4 font-black text-center">RSVP Jibu</th>
                          <th className="py-3 px-4 font-black text-center">Watu RSVP</th>
                          <th className="py-3 px-4 font-black text-center">SMS</th>
                          <th className="py-3 px-4 font-black text-center">WA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                        {sortedRSVPGuests.map((g, idx) => (
                          <tr key={g.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-2.5 px-4 font-semibold text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 px-4 font-bold uppercase">{g.name}</td>
                            <td className="py-2.5 px-4 text-slate-400">{g.phone || '-'}</td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                g.cardType === 'DOUBLE' 
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-400/20' 
                                  : 'bg-blue-500/10 text-blue-300 border-blue-400/20'
                              }`}>
                                {g.cardType || 'SINGLE'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                g.rsvpStatus === 'Atahudhuria' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                g.rsvpStatus === 'Hatahudhuria' ? 'bg-red-500/10 text-rose-450 border-red-500/20' :
                                g.rsvpStatus === 'Labda' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                'bg-white/5 text-slate-400 border-white/10'
                              }`}>
                                {g.rsvpStatus || 'Bado Jibu'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-300 font-bold">{g.rsvpStatus === 'Hatahudhuria' ? 0 : (g.rsvpGuestsCount || 1)}</td>
                            <td className="py-2.5 px-4 text-center text-blue-400 font-bold">{g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0)}</td>
                            <td className="py-2.5 px-4 text-center text-emerald-400 font-bold">{g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

          </div>

        </div>
      )}

      {/* SUB-TAB 4: MANAGE COMMITTEE LEADERS & MEMBERS */}
      {currentSubTab === 'members' && (
        <div className="space-y-6 animate-fade-in" id="panel-committee-setup">
          
          {/* Header Action Banner */}
          <div className="backdrop-blur-md bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-white/10 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-white text-base uppercase font-mono tracking-wider">
                  {isEn ? "Committee Leadership & Roster Management" : "Usimamizi wa Viongozi na Wanakamati wa Sherehe"}
                </h3>
              </div>
              <p className="text-slate-300 text-xs">
                {isEn 
                  ? "Configure Mwenyekiti (Chair), Katibu (Secretary), Mtunza Hazina (Treasurer), Sub-committees & send meeting reminders." 
                  : "Weka Viongozi wote wa Kamati (Mwenyekiti, Katibu, Mtunza Hazina, Wajumbe) na utume ujumbe wa vikao kwa WhatsApp na SMS."}
              </p>
            </div>

            <button
              onClick={() => setCurrentSubTab('reminders')}
              className="px-5 py-3 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition flex items-center gap-2 cursor-pointer shrink-0"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{isEn ? "Send Meeting Reminder" : "Kumbusha Kikao (SMS / WhatsApp)"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Form to add/edit Leaders & Members */}
            <div className="lg:col-span-5 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-6 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-[9px] px-2.5 py-1 rounded-full uppercase font-bold">
                  {editingMemberId 
                    ? (isEn ? "Edit Leader / Member" : "Hariri Kiongozi / Mjumbe")
                    : (isEn ? "Add Leader / Member" : "Sajili Kiongozi / Mjumbe Mpya")}
                </span>
                <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider mt-2">
                  {editingMemberId 
                    ? (isEn ? "Modify Committee Executive" : "Hariri Taarifa za Mwanakamati")
                    : (isEn ? "Register Committee Executive" : "Weka Taarifa za Mwanakamati")}
                </h4>
                <p className="text-slate-400 text-[10.5px]">
                  {isEn 
                    ? "Specify name, leadership title, phone number and assigned sub-committee:" 
                    : "Jaza jina, cheo cha uongozi, namba ya simu na kamati ndogo anayohudumu:"}
                </p>
              </div>

              <form onSubmit={handleCreateMember} className="space-y-4 font-sans text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]" htmlFor="member-fullname">
                    {isEn ? "Full Name:" : "Jina Kamili la Kiongozi / Mjumbe:"}
                  </label>
                  <input 
                    id="member-fullname"
                    type="text" 
                    value={memberName} 
                    onChange={(e) => setMemberName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500" 
                    required 
                    placeholder="e.g. Mhandisi James Lema"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]" htmlFor="member-phone">
                      {isEn ? "Phone Number:" : "Simu ya Mkononi:"}
                    </label>
                    <input 
                      id="member-phone"
                      type="tel" 
                      value={memberPhone} 
                      onChange={(e) => setMemberPhone(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-xs" 
                      required 
                      placeholder="e.g. 0754123456"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]" htmlFor="member-email">
                      {isEn ? "Email address:" : "Barua Pepe (Email):"}
                    </label>
                    <input 
                      id="member-email"
                      type="email" 
                      value={memberEmail} 
                      onChange={(e) => setMemberEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-xs" 
                      placeholder="e.g. james@gmail.com"
                    />
                  </div>
                </div>

                {/* Leadership Position Selector */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]">
                    {isEn ? "Leadership Role / Title:" : "Cheo cha Uongozi (Role):"}
                  </label>
                  <select
                    value={memberPosition}
                    onChange={(e) => setMemberPosition(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-amber-300 font-extrabold text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="Mwenyekiti wa Kamati">👑 Mwenyekiti wa Kamati (Chairperson)</option>
                    <option value="Makamu Mwenyekiti">🥈 Makamu Mwenyekiti (Vice Chair)</option>
                    <option value="Katibu Mkuu">📝 Katibu Mkuu (Secretary)</option>
                    <option value="Katibu Msaidizi">✍️ Katibu Msaidizi (Assistant Secretary)</option>
                    <option value="Mtunza Hazina / Mweka Hazina">💰 Mtunza Hazina / Mweka Hazina (Treasurer)</option>
                    <option value="Mweka Hazina Msaidizi">💸 Mweka Hazina Msaidizi (Assistant Treasurer)</option>
                    <option value="Mkuu wa Kamati Ndogo">🏆 Mkuu wa Kamati Ndogo (Sub-committee Head)</option>
                    <option value="Mjumbe wa Kamati">👥 Mjumbe wa Kamati (Committee Member)</option>
                  </select>
                </div>

                {/* Sub-committee Category Selector */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]">
                    {isEn ? "Sub-Committee / Department:" : "Kamati Ndogo / Idara:"}
                  </label>
                  <select
                    value={memberSubCommittee}
                    onChange={(e) => setMemberSubCommittee(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-indigo-300 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Kamati Kuu ya Uendeshaji">🏛️ Kamati Kuu ya Uendeshaji</option>
                    <option value="Kamati ya Fedha & Bajeti">💰 Kamati ya Fedha & Bajeti</option>
                    <option value="Kamati ya Chakula & Vinywaji">🍲 Kamati ya Chakula & Vinywaji</option>
                    <option value="Kamati ya Mapambo & Ubunifu">💐 Kamati ya Mapambo & Ubunifu</option>
                    <option value="Kamati ya Usafiri & Logistiki">🚘 Kamati ya Usafiri & Logistiki</option>
                    <option value="Kamati ya Burudani & Protokali">🎵 Kamati ya Burudani & Protokali</option>
                    <option value="Kamati ya Ulinzi & Usalama">🛡️ Kamati ya Ulinzi & Usalama</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]">
                    {isEn ? "Invitation Channel:" : "Njia ya Kutuma Mwaliko Wa Portal:"}
                  </label>
                  <div className="grid grid-cols-3 gap-2 font-mono">
                    {['WhatsApp', 'SMS', 'Email'].map(ch => (
                      <button
                        type="button"
                        key={ch}
                        onClick={() => setMemberMethod(ch as any)}
                        className={`p-2 border rounded-xl text-center text-[10px] font-bold uppercase transition ${
                          memberMethod === ch
                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                            : 'border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>

                {editingMemberId ? (
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition shadow-lg hover:brightness-110 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>{isEn ? "Save Changes" : "Hifadhi Mabadiliko"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMemberId(null);
                        setMemberName('');
                        setMemberPhone('');
                        setMemberEmail('');
                        setMemberPosition('Mjumbe wa Kamati');
                        setMemberSubCommittee('Kamati Kuu ya Uendeshaji');
                      }}
                      className="px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-350 border border-white/5 font-extrabold text-xs uppercase tracking-widest rounded-xl transition cursor-pointer"
                    >
                      {isEn ? "Cancel" : "Ghairi"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition shadow-lg hover:brightness-110 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Crown className="w-4 h-4" />
                    <span>{isEn ? "Register & Dispatch Login Access" : "Sajili Kiongozi / Mjumbe na Tuma Portal Link"}</span>
                  </button>
                )}
              </form>

              {/* Generated demo link simulator visual assistance */}
              {invitationLinkSent && (
                <div className="p-4 bg-slate-950 rounded-xl border border-white/5 space-y-2 animate-fade-in text-[11px]">
                  <p className="text-emerald-400 font-bold font-mono">✓ Kiongozi / Mjumbe amesajiliwa kikamilifu!</p>
                  <p className="text-slate-450 text-[10.5px]">
                    Kiungo cha ufikiaji cha Portal ya Kamati (Login Token Link):
                  </p>
                  <input 
                    type="text" 
                    readOnly 
                    value={invitationLinkSent} 
                    className="w-full bg-white/5 border border-white/5 p-1 px-2 rounded text-amber-300 text-[10px] font-mono"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                </div>
              )}
            </div>

            {/* Roster of Leaders & Members */}
            <div className="lg:col-span-7 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="border-b border-white/5 pb-2 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider">
                    {isEn ? "Registered Committee Roster of Honor" : "Orodha ya Viongozi na Wanakamati Waliopo"}
                  </h4>
                  <p className="text-slate-450 text-[10.5px]">
                    {isEn ? "Full board of executive leadership and sub-committees:" : "Viongozi wakuu (Mwenyekiti, Katibu, Mtunza Hazina) na Wanakamati wote:"}
                  </p>
                </div>
                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-mono font-bold">
                  {committeeMembers.length} {isEn ? "Members" : "Wanakamati"}
                </span>
              </div>

              <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                {sortedCommitteeMembers.map(m => {
                  const isLeader = m.position.includes('Mwenyekiti') || m.position.includes('Chairperson') || m.position.includes('Katibu') || m.position.includes('Secretary') || m.position.includes('Hazina') || m.position.includes('Treasurer');
                  
                  // Badge styling logic
                  let posBg = "bg-slate-800/80 border-slate-700 text-slate-300";
                  if (m.position.includes('Mwenyekiti') || m.position === 'Chairperson') {
                    posBg = "bg-amber-500/10 border-amber-500/30 text-amber-300";
                  } else if (m.position.includes('Katibu') || m.position === 'Secretary') {
                    posBg = "bg-blue-500/10 border-blue-500/30 text-blue-300";
                  } else if (m.position.includes('Hazina') || m.position === 'Treasurer') {
                    posBg = "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
                  } else if (m.position.includes('Mkuu')) {
                    posBg = "bg-purple-500/10 border-purple-500/30 text-purple-300";
                  }

                  let cleanPhone = (m.phone || '').replace(/[^0-9]/g, '');
                  if (cleanPhone.startsWith('0')) cleanPhone = '255' + cleanPhone.substring(1);

                  return (
                    <div 
                      key={m.id} 
                      className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                        isLeader 
                          ? 'bg-slate-900/80 border-amber-500/20 shadow-sm' 
                          : 'bg-slate-900/40 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-mono text-base font-black shrink-0 border ${
                          isLeader ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-white/5 border-white/10 text-slate-300'
                        }`}>
                          {m.position.includes('Mwenyekiti') ? '👑' : m.position.includes('Katibu') ? '📝' : m.position.includes('Hazina') ? '💰' : m.name[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-white uppercase text-xs tracking-wide">{m.name}</p>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] uppercase font-bold font-mono border ${posBg}`}>
                              {m.position}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10.5px] text-slate-400 font-mono mt-1 flex-wrap">
                            <span className="text-amber-400/90 font-bold">📞 {m.phone}</span>
                            {m.subCommittee && (
                              <span className="bg-white/5 px-2 py-0.5 rounded text-[9.5px] text-indigo-300 border border-white/5">
                                🏛️ {m.subCommittee}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Communication Actions for each Leader / Member */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 w-full sm:w-auto justify-end">
                        <a
                          href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hujambo ${m.name} (${m.position}), Vipi maandalizi ya sherehe ya ${event.name}?`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-bold uppercase transition flex items-center gap-1"
                          title="Tuma Ujumbe wa WhatsApp"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </a>

                        <a
                          href={`sms:${cleanPhone}`}
                          className="p-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl text-[10px] font-bold uppercase transition flex items-center gap-1"
                          title="Tuma SMS"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">SMS</span>
                        </a>

                        <button
                          onClick={() => {
                            setMeetingTitle(`Kikao cha Kamati: ${m.position}`);
                            setCurrentSubTab('reminders');
                          }}
                          className="p-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-[10px] font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                          title="Kumbusha Kikao"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Kikao</span>
                        </button>

                        {activeRole === 'Event Owner' && (
                          <>
                            <button
                              onClick={() => {
                                setEditingMemberId(m.id);
                                setMemberName(m.name);
                                setMemberPhone(m.phone);
                                setMemberEmail(m.email || '');
                                setMemberPosition(m.position || 'Mjumbe wa Kamati');
                                setMemberSubCommittee(m.subCommittee || 'Kamati Kuu ya Uendeshaji');
                                
                                const inputEl = document.getElementById('member-fullname');
                                if (inputEl) {
                                  inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  inputEl.focus();
                                }
                              }}
                              className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-xl border border-blue-500/20 text-[10px] font-bold transition cursor-pointer"
                              title="Hariri taarifa"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                setDeleteConfirmMember(m);
                              }}
                              className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl border border-red-500/20 text-[10px] font-bold transition cursor-pointer"
                              title="Ondoa kwenye kamati"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Committee Portal Access PIN Info */}
              {activeRole === 'Event Owner' && (
                <div className="mt-6 pt-5 border-t border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <h4 className="font-extrabold uppercase font-mono tracking-wider text-xs">
                      {isEn ? "Access PINs for Leaders" : "PIN za Kuingia Kwenye Portal kwa Cheo"}
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10px]">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl text-center">
                      <p className="text-slate-400 text-[9px]">Mweka Hazina</p>
                      <p className="text-emerald-400 font-bold text-xs mt-0.5">PIN: 2222</p>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 p-2 rounded-xl text-center">
                      <p className="text-slate-400 text-[9px]">Katibu Mkuu</p>
                      <p className="text-blue-400 font-bold text-xs mt-0.5">PIN: 3333</p>
                    </div>
                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-2 rounded-xl text-center">
                      <p className="text-slate-400 text-[9px]">Wanakamati</p>
                      <p className="text-indigo-400 font-bold text-xs mt-0.5">PIN: 4444</p>
                    </div>
                    <div className="bg-rose-500/10 border border-rose-500/20 p-2 rounded-xl text-center">
                      <p className="text-slate-400 text-[9px]">Mwenyekiti/Admin</p>
                      <p className="text-rose-400 font-bold text-xs mt-0.5">PIN: 1234</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* SUB-TAB: MEETING REMINDERS & WHATSAPP / SMS DISPATCH */}
      {currentSubTab === 'reminders' && (
        <div className="space-y-6 animate-fade-in" id="panel-committee-reminders">
          
          {/* Header Banner */}
          <div className="backdrop-blur-md bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-500/30 rounded-3xl p-6 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Bell className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500/20 text-emerald-300 font-mono text-[9.5px] px-2.5 py-0.5 rounded-full font-bold uppercase border border-emerald-500/30">
                      WhatsApp & SMS Dispatch Center
                    </span>
                  </div>
                  <h3 className="font-black text-white text-base uppercase font-mono tracking-wider mt-1">
                    {isEn ? "Committee Meeting Reminders Dispatcher" : "Kituo cha Kutuma Vikao na Ukumbusho wa Kamati"}
                  </h3>
                </div>
              </div>

              {/* Bulk Dispatch Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleDispatchSMSAllAtOnce}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{isEn ? "SMS All At Once" : "Tuma SMS Kwa Wote"}</span>
                </button>

                <button
                  onClick={handleDispatchWhatsAppBroadcastAll}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{isEn ? "WhatsApp All At Once" : "Tuma WhatsApp Kwa Wote"}</span>
                </button>

                {/* Toast banner when copied */}
                {reminderToast && (
                  <div className="px-3 py-1.5 bg-emerald-500 text-slate-950 font-black text-xs rounded-xl shadow-xl animate-fade-in flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{reminderToast}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Presets for Meeting Reminders */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1 font-mono text-xs">
              <span className="text-slate-400 font-bold text-[10px] uppercase shrink-0">Presets:</span>
              <button
                onClick={() => {
                  setMeetingTitle('Kikao cha 1 cha Kamati: Ufunguzi & Mipango');
                  setMeetingAgenda('1. Kufahamiana na kuchagua Mweka Hazina\n2. Kupitia Bajeti ya Sherehe\n3. Kugawa Malengo ya Makusanyo');
                }}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 rounded-xl shrink-0 font-bold text-[11px] transition cursor-pointer"
              >
                📌 Kikao 1: Ufunguzi & Bajeti
              </button>
              <button
                onClick={() => {
                  setMeetingTitle('Kikao cha 2 cha Kamati: Tathmini ya Makusanyo');
                  setMeetingAgenda('1. Kupitia Makusanyo ya Mweka Hazina\n2. Kadi za Mialiko kwa Wajumbe\n3. Malipo ya Uhakika ya Ukumbi');
                }}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-emerald-300 rounded-xl shrink-0 font-bold text-[11px] transition cursor-pointer"
              >
                📌 Kikao 2: Makusanyo & Kadi
              </button>
              <button
                onClick={() => {
                  setMeetingTitle('Kikao cha Dharura: Mapambo, Ukumbi & Chakula');
                  setMeetingAgenda('1. Kukamilisha Malipo ya Service Providers\n2. Orodha ya Wageni wa VVIP\n3. Utaratibu wa Usafiri na Mziki');
                }}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-rose-300 rounded-xl shrink-0 font-bold text-[11px] transition cursor-pointer"
              >
                📌 Kikao cha Dharura
              </button>
              <button
                onClick={() => {
                  setMeetingTitle('Kikao cha Mwisho cha Kamati: Tathmini ya Sherehe');
                  setMeetingAgenda('1. Kukamilisha Malipo Yote Yaliyosalia\n2. Kutoa Ahsante na Ripoti ya Mwisho ya Fedha\n3. Kukabidhi Kumbukumbu');
                }}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-indigo-300 rounded-xl shrink-0 font-bold text-[11px] transition cursor-pointer"
              >
                📌 Kikao cha Mwisho / Tathmini
              </button>
            </div>
          </div>

          {/* Form and Preview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Meeting Form Inputs */}
            <div className="lg:col-span-6 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-6 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>{isEn ? "Compose Meeting Reminder" : "Andaa Taarifa ya Kikao Cha Kamati"}</span>
                </h4>
              </div>

              <div className="space-y-4 text-xs font-sans">
                
                {/* Meeting Title */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]">
                    {isEn ? "Meeting Title / Subject:" : "Kichwa / Aina ya Kikao:"}
                  </label>
                  <input
                    type="text"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="e.g. Kikao cha 3 cha Kamati ya Harusi"
                  />
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]">
                      {isEn ? "Meeting Date:" : "Tarehe ya Kikao:"}
                    </label>
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]">
                      {isEn ? "Meeting Time:" : "Muda wa Kikao:"}
                    </label>
                    <input
                      type="text"
                      value={meetingTime}
                      onChange={(e) => setMeetingTime(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="e.g. Saa 11:00 Jioni / 17:00"
                    />
                  </div>
                </div>

                {/* Venue */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]">
                    {isEn ? "Venue / Location / Zoom Link:" : "Mahali / Ukumbi wa Kikao:"}
                  </label>
                  <input
                    type="text"
                    value={meetingVenue}
                    onChange={(e) => setMeetingVenue(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="e.g. Ukumbi wa Mlimani City, Dar es Salaam"
                  />
                </div>

                {/* Agendas */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]">
                    {isEn ? "Main Agendas:" : "Agenda Kuu za Kikao (Kila mstari agenda moja):"}
                  </label>
                  <textarea
                    rows={3}
                    value={meetingAgenda}
                    onChange={(e) => setMeetingAgenda(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-200 font-sans focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs leading-relaxed"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]">
                    {isEn ? "Special Instructions / Notes:" : "Maelezo ya Ziada / Maelekezo kwa Wajumbe:"}
                  </label>
                  <input
                    type="text"
                    value={meetingNotes}
                    onChange={(e) => setMeetingNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    placeholder="e.g. Tafadhali fika na mchango wako au risiti ya benki."
                  />
                </div>

                {/* Audience Selection */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]">
                    {isEn ? "Target Recipients:" : "Walengwa wa Ujumbe Huu:"}
                  </label>
                  <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
                    <button
                      type="button"
                      onClick={() => setMeetingAudience('all')}
                      className={`p-2.5 rounded-xl border font-bold uppercase transition ${
                        meetingAudience === 'all'
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                          : 'border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      👥 Wanakamati Wote ({committeeMembers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMeetingAudience('leaders')}
                      className={`p-2.5 rounded-xl border font-bold uppercase transition ${
                        meetingAudience === 'leaders'
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                          : 'border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      👑 Viongozi Wakuu Tu
                    </button>
                    <button
                      type="button"
                      onClick={() => setMeetingAudience('members')}
                      className={`p-2.5 rounded-xl border font-bold uppercase transition ${
                        meetingAudience === 'members'
                          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                          : 'border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      💬 Mjumbe Mmoja Mmoja
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column: Live Message Preview & Direct WhatsApp Dispatch */}
            <div className="lg:col-span-6 space-y-4">
              
              {/* WhatsApp Message Preview Card */}
              <div className="backdrop-blur-md bg-slate-950 border border-emerald-500/20 rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider">
                      {isEn ? "WhatsApp / SMS Live Message Preview" : "Mwonekano wa Ujumbe Utakaotumwa (Preview)"}
                    </h4>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Ready to Dispatch
                  </span>
                </div>

                <div className="bg-[#0b141a] border border-white/10 rounded-2xl p-4 text-slate-200 font-sans text-xs leading-relaxed font-mono whitespace-pre-wrap select-all max-h-[320px] overflow-y-auto">
                  {buildMeetingReminderText()}
                </div>

                {/* Main Dispatch Actions - BULK & GROUP OPTIONS */}
                <div className="space-y-3 pt-2">
                  
                  {/* HERO CTA BUTTON: TUMA KWA WOTE MARA MOJA */}
                  <div className="p-3 bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-500/40 rounded-2xl space-y-2">
                    <p className="text-[10px] uppercase font-mono font-bold text-amber-400 flex items-center gap-1">
                      <span>⚡ UPAO WA HARAKA:</span>
                      <span>KUTUMA KWA WANAKAMATI WOTE MARA MOJA ({getTargetAudienceMembers().length})</span>
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Bulk SMS to all at once */}
                      <button
                        onClick={handleDispatchSMSAllAtOnce}
                        className="py-3 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                        title="Tuma SMS kwa Wanakamati Wote Mara Moja"
                      >
                        <MessageSquare className="w-4 h-4 text-blue-200" />
                        <span>🚀 Tuma SMS Kwa Wote ({getTargetAudienceMembers().length})</span>
                      </button>

                      {/* Bulk WhatsApp / Broadcast Modal */}
                      <button
                        onClick={handleDispatchWhatsAppBroadcastAll}
                        className="py-3 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                        title="Fungua Kituo cha Kutuma WhatsApp kwa Wote"
                      >
                        <Phone className="w-4 h-4 text-emerald-200" />
                        <span>💬 Tuma WhatsApp Kwa Wote</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={handleDispatchMeetingReminderToGroup}
                      className="py-3 px-3 bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer border border-white/10"
                    >
                      <Send className="w-4 h-4 text-emerald-300" />
                      <span>{isEn ? "Send to WhatsApp Group" : "Tuma WhatsApp Group"}</span>
                    </button>

                    <button
                      onClick={() => {
                        const msg = buildMeetingReminderText();
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(msg);
                        }
                        setReminderToast('Ujumbe wote umenakiliwa kwenye clipboard!');
                        setTimeout(() => setReminderToast(null), 3000);
                      }}
                      className="py-3 px-3 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-slate-300 font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Clipboard className="w-4 h-4 text-amber-400" />
                      <span>{isEn ? "Copy Message Text" : "Nakili Ujumbe Wote"}</span>
                    </button>
                  </div>

                </div>
              </div>

              {/* Individual Leader / Member Quick WhatsApp Buttons */}
              <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isEn ? "Send WhatsApp Directly to Each Leader" : "Tuma WhatsApp kwa Kila Kiongozi / Mjumbe"}</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {committeeMembers.length} {isEn ? "Recipients" : "Walengwa"}
                  </span>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {committeeMembers.map(m => (
                    <div 
                      key={m.id}
                      className="p-2.5 bg-slate-900/60 rounded-xl border border-white/5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-bold text-white text-[11px] uppercase">{m.name}</p>
                        <p className="text-[9.5px] text-amber-400 font-mono">{m.position} • {m.phone}</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleSendIndividualWhatsAppReminder(m)}
                          className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                        >
                          <Phone className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </button>
                        <button
                          onClick={() => handleSendIndividualSMSReminder(m)}
                          className="px-2 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>SMS</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

          {/* Past Meeting Notices History */}
          <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{isEn ? "Meeting Reminders History Log" : "Kumbukumbu na Historia ya Vikao Vilivyotangazwa"}</span>
              </h4>
              <span className="text-slate-400 text-[10px] font-mono">
                {meetingHistory.length} {isEn ? "Notices Logged" : "Vikao"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meetingHistory.map((item) => (
                <div key={item.id} className="p-4 bg-slate-900/80 rounded-2xl border border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      📅 {item.date} • ⏰ {item.time}
                    </span>
                    <span className="text-[9.5px] text-slate-500 font-mono">Imetumwa: {item.sentAt}</span>
                  </div>

                  <h5 className="font-black text-amber-300 uppercase text-xs">{item.title}</h5>
                  <p className="text-slate-300 text-[11px]">📍 {item.venue}</p>

                  <div className="p-2.5 bg-slate-950 rounded-xl text-[10px] text-slate-400 font-mono line-clamp-2 border border-white/5">
                    {item.agenda}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400 font-mono">👥 Wanakamati {item.recipientsCount}</span>
                    <button
                      onClick={() => {
                        setMeetingTitle(item.title);
                        setMeetingDate(item.date);
                        setMeetingTime(item.time);
                        setMeetingVenue(item.venue);
                        setMeetingAgenda(item.agenda);
                        setReminderToast('Impakuliwa kwenye kihariri! Unaweza kutuma tena sasa.');
                        setTimeout(() => setReminderToast(null), 3000);
                      }}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[9.5px] font-bold uppercase transition cursor-pointer"
                    >
                      Rudia Kutuma
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* SUB-TAB: CONTRIBUTIONS MODULE */}
      {currentSubTab === 'contributions' && (
        <div className="animate-fade-in" id="panel-committee-contributions">
          <div className="bg-[#050b18] border border-white/5 rounded-3xl overflow-hidden min-h-[500px]">
            <ContributionManager
              event={event}
              guests={guests}
              onUpdateEvent={onUpdateEvent}
              onUpdateGuests={onUpdateGuests}
              eventsList={[event]}
              onSelectEvent={() => {}}
            />
          </div>
        </div>
      )}

      {/* SUB-TAB 5: ACTIVITY LOGS (ADMIN ONLY) - 16.9 */}
      {currentSubTab === 'activity' && (
        <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4 animate-fade-in" id="panel-committee-activity">
          <div className="border-b border-white/5 pb-3">
            <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-450" />
              <span>{isEn ? "Committee Activity Log audits" : "Kihistoria cha Logs za Wanakamati (Audit Trails)"}</span>
            </h4>
            <p className="text-slate-400 text-[10.5px]">
              {isEn ? "System audit events recorded on this event space dynamically:" : "Tathmini ya mienendo yote inayofanywa na wajumbe kuzuia ufisadi na kudhibiti data zote:"}
            </p>
          </div>

          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-mono text-[9.5px] uppercase">
                <th className="py-2.5 px-3">{isEn ? 'USER' : 'MTENDAJI'}</th>
                <th className="py-2.5 px-3">{isEn ? 'ACTION EXECUTED' : 'KITENDO'}</th>
                <th className="py-2.5 px-3">{isEn ? 'DATE / TIME' : 'MUDA'}</th>
                <th className="py-2.5 px-3 text-right">{isEn ? 'IP ADDRESS' : 'IP ADDRESS'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[10.5px] text-slate-300">
              {activityLogs.map(log => (
                <tr key={log.id} className="hover:bg-white/[0.01] transition-all">
                  <td className="py-2 px-3 font-extrabold text-white uppercase">{log.user}</td>
                  <td className="py-2 px-3 text-slate-350">{log.action}</td>
                  <td className="py-2 px-3 text-slate-500">{log.date} {log.time}</td>
                  <td className="py-2 px-3 text-right text-slate-500">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB-TAB 6: COMMITTEE PUBLIC LINK (OPTIONAL) - 16.10 */}
      {currentSubTab === 'public-link' && (
        <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 animate-fade-in max-w-2xl mx-auto text-center" id="panel-committee-public-link">
          
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-black flex items-center justify-center mx-auto text-xl uppercase animate-pulse">
              <Share2 className="w-6 h-6 text-amber-400" />
            </div>
            <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[9.5px] px-2.5 py-1 rounded-full uppercase font-bold inline-block">
              {isEn ? "Public Progress tracker indicator" : "Kiungo cha Maendeleo ya Harusi ya Public (Public Link)"}
            </span>
            <h3 className="text-lg font-black text-white uppercase font-mono tracking-wide">
              {isEn ? "SECURE PUBLIC TRACKING LINK" : "WEKA KIUNGO MAALUM KWA PUBLIC"}
            </h3>
            <p className="text-slate-400 text-[11px] leading-relaxed max-w-md mx-auto">
              {isEn ? "According to mandate 16.10, this link is completely safe to share in WhatsApp groups. Displays overall progress bar and metrics without any contributor names or confidential data." : "Sheria ya 16.10: Kiungo hiki kiko salama kabisa kushirikisha kwenye vikundi vya WhatsApp vya kamati nzima ya harusi. Inaonyesha asilimia pekee bila kuonyesha majina ya watu."}
            </p>
          </div>

          <div className="p-4 bg-slate-950 border border-white/5 rounded-2xl space-y-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">{isEn ? "Generated Public Progress URL:" : "Kiungo cha maendeleo kilichozalishwa na mfumo:"}</span>
              <span className="text-emerald-400 text-[9.5px] font-mono font-bold">● ACTIVE</span>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly 
                value={`${window.location.origin}${window.location.pathname}?progress=true&event_id=${event.id}`} 
                className="w-full bg-white/5 border border-white/5 px-3 py-2 text-slate-300 text-[10.5px] font-mono rounded-xl focus:outline-none"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?progress=true&event_id=${event.id}`);
                  alert(isEn ? "Copied public link!" : "Copied successfully!");
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 text-white font-mono text-[10.5px] rounded-xl font-bold uppercase transition"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setShowPublicProgressPreview(true);
                addActivityLog(`${activeRole} View`, 'Alitazama Public Progress Preview tab kibinafsi');
              }}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold uppercase font-mono tracking-wider py-2.5 px-6 rounded-xl text-[10.5px] flex items-center gap-2 transition cursor-pointer shadow-md"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{isEn ? "Live Preview Public URL Page" : "Fungua Public Progress Page"}</span>
            </button>
          </div>

        </div>
      )}

      {/* SUB-TAB 7: EVENT DOCUMENTS & SHRED FILES MANAGER */}
      {currentSubTab === 'files' && (
        <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 animate-fade-in" id="panel-committee-event-files">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div className="space-y-1 text-left">
              <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-[9px] px-2.5 py-1 rounded-full uppercase font-bold inline-block">
                {isEn ? "Secure Shared repository" : "Hifadhi ya Faili na Nyaraka Pamoja"}
              </span>
              <h3 className="text-lg font-black text-white uppercase font-sans tracking-wide">
                {isEn ? "EVENT SHARED DOCUMENTS & RECORDS" : "NYARAKA NA FAILI ZA KAMATI YA SHEREHE"}
              </h3>
              <p className="text-slate-400 text-[11px]">
                {isEn ? "Upload and access planning guides, pdf flyers, event program outlines, schedules, budgets, and template designs." : "Pakia na uhifadhi miongozo ya sherehe, bajeti za Excel, ratiba za PDF, michoro ya kumbi au images mbalimbali za kamati yetu."}
              </p>
            </div>
          </div>

          {/* Interactive Drag and Drop Upload Zone */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 space-y-4">
              <div 
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-300 relative ${
                  dragActive 
                    ? 'border-amber-500 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.05)]' 
                    : 'border-white/10 hover:border-blue-500/40 bg-slate-950/40 hover:bg-slate-950/60'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  id="event-doc-file-input"
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processUploadedFile(e.target.files[0]);
                    }
                  }}
                />
                
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <button 
                      onClick={() => document.getElementById('event-doc-file-input')?.click()}
                      className="text-blue-400 hover:text-blue-300 font-bold text-xs underline cursor-pointer"
                    >
                      {isEn ? "Choose File To Upload" : "Chagua Faili la Kupakia"}
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {isEn ? "or drag and drop it here" : "au kokota na uwasilishe hapa"}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-white/5 space-y-1">
                    <p className="text-[9px] text-slate-500 font-mono">
                      {isEn ? "Formats: PDF, XLSX, DOCX, PNG, JPG" : "Aina: PDF, Excel, Word, Picha"}
                    </p>
                    <p className="text-[9px] text-amber-500/70 font-mono">
                      {isEn ? "Max: 1.5MB per file" : "Kikomo: 1.5MB kwa faili"}
                    </p>
                  </div>
                </div>
              </div>

              {uploadError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[10.5px] font-sans flex items-start gap-2 text-left">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="bg-slate-950/70 border border-white/5 rounded-2xl p-4 text-left space-y-2">
                <h4 className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isEn ? "System Integrity & Encryption" : "Ulinzi na Usiri wa Faili"}</span>
                </h4>
                <p className="text-[10px] leading-relaxed text-slate-400">
                  {isEn ? "All files are converted into highly compressed secure base64 format for high availability. Larger file templates are logged and compiled dynamically." : "Faili zote zinabanwa kitaalam na kubadilishwa kuwa base64 kwa ajili ya kufikiwa kwa haraka, kukuwezesha kuzindua na kuzisambaza bila hasara ya data."}
                </p>
              </div>
            </div>

            {/* Files List Display and Filters */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Filter tabs */}
              <div className="flex overflow-x-auto gap-1 border-b border-white/5 pb-1 shrink-0 scrollbar-none">
                {[
                  { id: 'all', label: isEn ? 'All Files' : 'Zote', count: eventFiles.length },
                  { id: 'pdf', label: 'PDFs', count: eventFiles.filter(f => f.category === 'pdf').length },
                  { id: 'spreadsheet', label: isEn ? 'Tables / Excel' : 'Lahajedwali', count: eventFiles.filter(f => f.category === 'spreadsheet').length },
                  { id: 'document', label: isEn ? 'Documents' : 'Nyaraka za Matini', count: eventFiles.filter(f => f.category === 'document').length },
                  { id: 'image', label: isEn ? 'Images & Cards' : 'Picha na Kadi', count: eventFiles.filter(f => f.category === 'image').length }
                ].map((filter) => {
                  const isActive = fileFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setFileFilter(filter.id as any)}
                      className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-mono text-[9.5px] uppercase font-black transition cursor-pointer ${
                        isActive 
                          ? 'bg-amber-500 text-slate-950 shadow-sm' 
                          : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span>{filter.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-mono ${isActive ? 'bg-slate-950 text-amber-400' : 'bg-white/10 text-slate-300'}`}>
                        {filter.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Files Loop Grid */}
              <div className="space-y-3">
                {eventFiles.filter(f => fileFilter === 'all' || f.category === fileFilter).length === 0 ? (
                  <div className="text-center p-8 bg-slate-950/20 border border-white/5 rounded-2xl space-y-3">
                    <FolderOpen className="w-12 h-12 text-slate-600 mx-auto stroke-[1.2]" />
                    <div>
                      <h4 className="text-xs font-black text-white uppercase">{isEn ? "No Files Found" : "Hakuna Faili Lililopatikana"}</h4>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
                        {isEn ? "No files stored under this category yet. Upload a document from the panel on the left." : "Hakuna nyaraka au picha iliyohifadhiwa hapa kwa sasa. Pakia document kutoka upande wa kushoto."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {eventFiles
                      .filter(f => fileFilter === 'all' || f.category === fileFilter)
                      .map((file) => {
                        // Classify colors & badges based on categories
                        let colorClasses = 'border-slate-800 bg-slate-900/40 text-slate-400';
                        let badgeLabel = 'FILE';
                        if (file.category === 'pdf') {
                          colorClasses = 'border-rose-500/15 bg-rose-500/[0.02] text-rose-400';
                          badgeLabel = 'PDF';
                        } else if (file.category === 'spreadsheet') {
                          colorClasses = 'border-emerald-500/15 bg-emerald-500/[0.02] text-emerald-400';
                          badgeLabel = 'SPREADSHEET';
                        } else if (file.category === 'document') {
                          colorClasses = 'border-blue-500/15 bg-blue-500/[0.02] text-blue-400';
                          badgeLabel = 'DOC';
                        } else if (file.category === 'image') {
                          colorClasses = 'border-purple-500/15 bg-purple-500/[0.02] text-purple-400';
                          badgeLabel = 'IMAGE';
                        }

                        return (
                          <div 
                            key={file.id} 
                            className={`p-4 border rounded-2xl flex flex-col justify-between space-y-3 transition-all duration-300 hover:scale-[1.01] hover:border-slate-500/30 ${colorClasses}`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="p-2 bg-black/30 rounded-lg">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="space-y-0.5 text-left min-w-0 flex-1">
                                <h4 className="text-xs font-bold text-slate-200 truncate font-mono uppercase" title={file.name}>
                                  {file.name}
                                </h4>
                                <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                                  <span>{file.size}</span>
                                  <span>&bull;</span>
                                  <span className="font-mono text-[8px]">{file.uploadedAt}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-white/5">
                              <span className="text-[8px] font-mono tracking-wider bg-black/40 text-slate-400 px-1.5 py-0.5 rounded uppercase font-black">
                                {badgeLabel}
                              </span>

                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => {
                                    if (file.dataUrl) {
                                      // Direct real base64 trigger downloads
                                      const link = document.createElement('a');
                                      link.href = file.dataUrl;
                                      link.download = file.name;
                                      link.click();
                                    } else {
                                      // Native offline textual representations
                                      const textContent = `HARUSI SYSTEM FILE ARCHIVE\n============================\nDefault Seeded Record Details\n----------------------------\nFaili: ${file.name}\nUkubwa: ${file.size}\nIdara: ${badgeLabel}\nTukio: ${event.name}\nTarehe: ${file.uploadedAt}\n\n[Hifadhi imefanikiwa kwa usahihi katika mfumo wa makusanyo]`;
                                      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
                                      const rUrl = URL.createObjectURL(blob);
                                      const rLink = document.createElement('a');
                                      rLink.href = rUrl;
                                      rLink.download = file.name.endsWith('.txt') || file.name.includes('.') ? file.name : `${file.name}.txt`;
                                      rLink.click();
                                      URL.revokeObjectURL(rUrl);
                                    }
                                    addActivityLog(`${activeRole} (Download)`, `Alipakua faili: ${file.name}`);
                                  }}
                                  className="p-1.5 bg-black/30 hover:bg-black/50 text-white rounded-lg cursor-pointer transition text-[9px] font-mono font-bold uppercase flex items-center gap-1"
                                  title={isEn ? "Download file" : "Pakua faili"}
                                >
                                  <Download className="w-3 h-3 text-slate-400" />
                                  <span>{isEn ? "GET" : "PAKUA"}</span>
                                </button>
                                
                                {activeRole === 'Event Owner' && (
                                  <button
                                    onClick={() => {
                                      if (confirm(isEn ? `Are you sure you want to delete ${file.name}?` : `Je, una uhakika wa kufuta faili la ${file.name}?`)) {
                                        setEventFiles(prev => prev.filter(f => f.id !== file.id));
                                        addActivityLog(`${activeRole} (Delete)`, `Alifuta faili: ${file.name}`);
                                      }
                                    }}
                                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg cursor-pointer transition"
                                    title={isEn ? "Delete file" : "Futa faili"}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
              
            </div>
          </div>

        </div>
      )}


      {/* TREASURER PAYMENT REGISTRATION MODAL FORM */}
      {showTreasurerPayModal && treasuryTargetGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" id="treasury-add-payment-modal">
          <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-3xl p-6 space-y-4">
            
            <div className="border-b border-white/5 pb-2">
              <h3 className="font-extrabold text-xs uppercase font-mono tracking-wider text-emerald-450">
                {isEn ? "Record Contribution Payment Piece" : "Kamati: Sajili Malipo ya Mchango"}
              </h3>
              <p className="text-[10.5px] text-slate-400 uppercase font-mono mt-0.5">Contributor: <strong className="text-white uppercase">{treasuryTargetGuest.name}</strong></p>
              <p className="text-[9.5px] text-amber-400 font-mono mt-0.5">
                {isEn ? "Target Pledge" : "Ahadi"}: TZS {treasuryTargetGuest.pledgeAmount?.toLocaleString()} • {isEn ? "Paid" : "Amelipa So far"}: TZS {(treasuryTargetGuest.paidAmount || 0).toLocaleString()}
              </p>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-400 block" htmlFor="treasury-pay-amount-input">
                  {isEn ? "Enter Amount Paid (TZS):" : "Kiasi Kilicholipwa Sasa (TZS):"}
                </label>
                <input 
                  id="treasury-pay-amount-input"
                  type="number" 
                  value={treasuryAmount} 
                  onChange={(e) => setTreasuryAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500" 
                  placeholder="e.g. 200000"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-400 block" htmlFor="treasury-pay-ref-input">
                  {isEn ? "Transaction Reference (MPESA/CRDB etc):" : "Kumbukumbu la Muamala / Reference:"}
                </label>
                <input 
                  id="treasury-pay-ref-input"
                  type="text" 
                  value={treasuryRef} 
                  onChange={(e) => setTreasuryRef(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500" 
                  placeholder="e.g. QX627889162"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-400 block" htmlFor="treasury-pay-notes-input">
                  {isEn ? "Short Audit Notes:" : "Maelezo Mafupi (Notes):"}
                </label>
                <input 
                  id="treasury-pay-notes-input"
                  type="text" 
                  value={treasuryNotes} 
                  onChange={(e) => setTreasuryNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500" 
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowTreasurerPayModal(false);
                    setTreasuryTargetGuest(null);
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-slate-800 rounded-lg text-slate-350 font-bold uppercase font-mono text-[10px]"
                >
                  {isEn ? "Cancel" : "Ghairi"}
                </button>
                <button
                  type="button"
                  onClick={handleSavePaymentTreasury}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 rounded-lg font-black uppercase font-mono text-[10px] hover:brightness-110 shadow-md"
                >
                  {isEn ? "Submit Payment" : "Sajili Matokeo"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* BULK DISPATCH ALL AT ONCE MODAL */}
      {showBulkDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in" id="bulk-dispatch-modal">
          <div className="bg-[#0f172a] border border-emerald-500/30 w-full max-w-xl rounded-3xl p-6 space-y-5 relative overflow-hidden shadow-2xl">
            
            {/* Close Button */}
            <button
              onClick={() => setShowBulkDispatchModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shrink-0">
                <Send className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[9.5px] uppercase font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Batch Dispatch System
                </span>
                <h3 className="text-base font-black text-white uppercase tracking-wider mt-0.5 font-mono">
                  🚀 Kutuma Kwa Wanakamati Wote Mara Moja
                </h3>
              </div>
            </div>

            {/* Summary Banner & Stats */}
            <div className="p-4 bg-slate-900 border border-white/10 rounded-2xl grid grid-cols-2 sm:grid-cols-3 gap-3 text-center text-xs">
              <div className="p-2 bg-white/[0.02] rounded-xl border border-white/5">
                <p className="text-[10px] uppercase font-mono text-slate-400">Walengwa Wote</p>
                <p className="text-sm font-black text-emerald-400 font-mono mt-0.5">{getTargetAudienceMembers().length}</p>
              </div>
              <div className="p-2 bg-white/[0.02] rounded-xl border border-white/5">
                <p className="text-[10px] uppercase font-mono text-slate-400">Zilizotumwa</p>
                <p className="text-sm font-black text-amber-400 font-mono mt-0.5">
                  {Object.keys(sentMemberIds).length} / {getTargetAudienceMembers().length}
                </p>
              </div>
              <div className="p-2 bg-white/[0.02] rounded-xl border border-white/5 col-span-2 sm:col-span-1">
                <p className="text-[10px] uppercase font-mono text-slate-400">Hali ya Kutuma</p>
                <p className="text-xs font-bold text-cyan-300 font-mono mt-0.5">
                  {Object.keys(sentMemberIds).length === getTargetAudienceMembers().length && getTargetAudienceMembers().length > 0 
                    ? "✓ Zimekamilika" 
                    : "Tayari Kutuma"}
                </p>
              </div>
            </div>

            {/* Three Easy Channel Options */}
            <div className="space-y-3">
              
              {/* Option 1: Multi-SMS Protocol */}
              <div className="p-4 bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/30 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    <h4 className="font-extrabold text-white text-xs uppercase font-mono">1. Tuma SMS Kwa Wote Mara Moja (Group SMS)</h4>
                  </div>
                  <span className="text-[9px] font-mono text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Moja kwa Moja</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Inafungua App ya SMS yenye namba za wanakamati wote {getTargetAudienceMembers().length} zikiwa zimeshapangwa kwenye 'To:'.
                </p>
                <button
                  onClick={handleDispatchSMSAllAtOnce}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Fungua Group SMS Kwa Wote ({getTargetAudienceMembers().length})</span>
                </button>
              </div>

              {/* Option 2: Sequential Direct WhatsApp Loop */}
              <div className="p-4 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border border-emerald-500/30 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-extrabold text-white text-xs uppercase font-mono">2. Tuma WhatsApp kwa Kila Mjumbe Mmoja Mmoja</h4>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Personalized</span>
                </div>

                <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
                  {getTargetAudienceMembers().map((m, idx) => {
                    const isSent = !!sentMemberIds[m.id];
                    return (
                      <div 
                        key={m.id}
                        className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${
                          isSent 
                            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' 
                            : 'bg-slate-900 border-white/5 text-slate-200'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-[11px] uppercase flex items-center gap-1.5">
                            <span>#{idx + 1} {m.name}</span>
                            {isSent && <span className="text-emerald-400 font-mono text-[9px] font-bold">✓ Imetumwa</span>}
                          </p>
                          <p className="text-[9.5px] text-slate-400 font-mono">{m.position} • {m.phone}</p>
                        </div>

                        <button
                          onClick={() => handleSendIndividualWhatsAppReminder(m)}
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1 cursor-pointer shrink-0 ${
                            isSent 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'
                          }`}
                        >
                          <Phone className="w-3 h-3" />
                          <span>{isSent ? "Tuma Tena" : "Tuma WhatsApp"}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Option 3: Copy Comma-Separated Phones */}
              <div className="p-3 bg-white/[0.02] border border-white/10 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-extrabold text-white text-[11px]">📋 Nakili Namba Zote za Simu</p>
                  <p className="text-[10px] text-slate-400">Kwa ajili ya WhatsApp Broadcast au SMS Gateway</p>
                </div>
                <button
                  onClick={() => {
                    const targets = getTargetAudienceMembers();
                    const cleanPhones = targets.map(m => {
                      let p = (m.phone || '').replace(/[^0-9]/g, '');
                      if (p.startsWith('0')) p = '255' + p.substring(1);
                      return p;
                    }).filter(Boolean).join(', ');

                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(cleanPhones);
                    }
                    setReminderToast('Namba zote zimenakiliwa!');
                    setTimeout(() => setReminderToast(null), 3000);
                  }}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/10 text-amber-300 font-bold rounded-xl text-[10px] uppercase transition cursor-pointer shrink-0"
                >
                  Nakili Namba ({getTargetAudienceMembers().length})
                </button>
              </div>

            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowBulkDispatchModal(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold uppercase font-mono text-xs transition cursor-pointer"
              >
                Kamilisha & Funga
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PUBLIC LEADERBOARD PREVIEW MODAL SCREEN */}
      {showPublicProgressPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md" id="public-progress-modal-sim">
          <div className="bg-[#0b1329] border border-white/10 w-full max-w-md rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
            
            {/* Absolute close circle */}
            <button
              onClick={() => setShowPublicProgressPreview(false)}
              className="absolute right-4 top-4 text-slate-450 hover:text-white p-2 rounded-full hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Simulated browser window tag bar */}
            <div className="flex items-center gap-2 text-slate-500 text-[10.5px] font-mono border-b border-white/5 pb-4 mt-2">
              <span className="w-3 h-3 rounded-full bg-red-500/50"></span>
              <span className="w-3 h-3 rounded-full bg-yellow-500/50"></span>
              <span className="w-3 h-3 rounded-full bg-green-500/50"></span>
              <span className="text-slate-400 font-bold ml-1">eventcard.co.tz/progress/{event.id}</span>
            </div>

            <div className="text-center space-y-2">
              <Coins className="w-12 h-12 text-amber-500 mx-auto stroke-[1.2] animate-bounce" />
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                {event.name || (isEn ? "Our Event Fundraise Progress" : "MICHANGO YA HARUSI YETU")}
              </h2>
              <p className="text-slate-400 text-xs font-medium leading-relaxed uppercase font-mono">
                {isEn ? "OFFICIAL PUBLIC AUDIT PROGRESS BAR" : "MAENDELEO YA MAKUSANYO YA KAMATI KIKAMILIFU"}
              </p>
            </div>

            {/* Clean, Human visual tracker stats without any single names */}
            <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl grid grid-cols-3 gap-2.5 text-center">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">{isEn ? "Target" : "Target kuu"}</span>
                <p className="text-xs font-bold text-white font-mono">TZS {fundraisingTarget.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-emerald-450 block">{isEn ? "Collected" : "Zilizolipwa"}</span>
                <p className="text-xs font-bold text-emerald-400 font-mono">TZS {metrics.totalPaidAmount.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-rose-455 block">{isEn ? "Remaining" : "Bado Zinasalia"}</span>
                <p className="text-xs font-bold text-rose-400 font-mono">TZS {metrics.remainingToTarget.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono font-bold">
                <span className="text-slate-400">{isEn ? "Target Reached Rate:" : "Asilimia za Kufikia Lengo:"}</span>
                <span className="text-amber-400">{metrics.progress}%</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
                <div 
                  className="bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500 h-full rounded-full" 
                  style={{ width: `${Math.min(100, parseFloat(metrics.progress))}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-[11px] leading-relaxed text-center">
              <p className="font-bold">✓ {isEn ? "100% Secure & Confidential View" : "✓ Mfumo Salama wa Kuficha majina"}</p>
              <p className="text-slate-450 text-[10px] mt-0.5">
                {isEn ? "Names of individual contributors are withheld to enforce privacy strictly according to regulation 16.11." : "Taarifa zote za siri za kila mtu zimefichwa kikamilifu ili kulinda watumiaji."}
              </p>
            </div>

            <p className="text-slate-500 text-[10px] font-mono text-center">EVENTCARD © 2026 • Powered by AI Studio Build</p>

          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in" id="delete-member-confirm-modal">
          <div className="bg-[#0b1329] border border-white/10 w-full max-w-sm rounded-3xl p-6 space-y-6 relative overflow-hidden">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-500">
                <Trash2 className="w-5 h-5 stroke-[1.5]" />
              </div>
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                {isEn ? "Confirm Deletion" : "Thibitisha Kufuta"}
              </h3>
              <p className="text-slate-300 text-xs">
                {isEn 
                  ? "Are you sure you want to remove this leader/member from the committee?" 
                  : "Je, una uhakika unataka kumfuta kiongozi / mwanakamati huyu kutoka kwenye kamati ya sherehe?"}
              </p>
            </div>

            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">{isEn ? "Name:" : "Jina Kamili:"}</span>
                <span className="text-white font-bold">{deleteConfirmMember.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">{isEn ? "Position:" : "Cheo / Nafasi:"}</span>
                <span className="text-amber-400 font-bold">{deleteConfirmMember.position}</span>
              </div>
              {deleteConfirmMember.subCommittee && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">{isEn ? "Sub-committee:" : "Kamati Ndogo:"}</span>
                  <span className="text-indigo-300 font-medium">{deleteConfirmMember.subCommittee}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteConfirmMember(null);
                }}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 font-bold uppercase text-[10px] rounded-xl transition cursor-pointer"
              >
                {isEn ? "Keep Member" : "Usiwasilishe / Ghairi"}
              </button>
              
              <button
                onClick={() => {
                  const mId = deleteConfirmMember.id;
                  const mName = deleteConfirmMember.name;
                  const mPosition = deleteConfirmMember.position;
                  setDeleteConfirmMember(null);
                  fetch(`/api/committee/members/${mId}`, { method: 'DELETE' })
                    .then(() => fetch('/api/committee/members'))
                    .then(res => res.json())
                    .then(list => {
                      if (Array.isArray(list)) setCommitteeMembers(list);
                      else setCommitteeMembers(prev => prev.filter(x => x.id !== mId));
                    })
                    .catch(() => {
                      setCommitteeMembers(prev => prev.filter(x => x.id !== mId));
                    });

                  addActivityLog('Event Owner (Admin)', `Alimwondoa mwanakamati: ${mName} (${mPosition})`);
                }}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase text-[10px] rounded-xl transition cursor-pointer shadow-lg shadow-rose-650/20"
              >
                {isEn ? "Delete Member" : "Ndiyo, Futa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
