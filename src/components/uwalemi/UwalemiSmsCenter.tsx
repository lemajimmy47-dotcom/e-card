import React, { useState, useMemo, useEffect } from 'react';
import { UwalemiState, UwalemiSmsConfig, UwalemiMessageLog, UwalemiMember } from '../../types/uwalemi';
import { 
  sendUwalemiSms, 
  sortMembersByLeadership, 
  calculateAllMembersFeeDebts, 
  calculateMemberFeeDebt,
  formatPersonalizedUwalemiSms,
  getSwahiliDayAndDate,
  triggerMonthlyAutoRemindersApi,
  UwalemiMemberFeeDebtInfo 
} from '../../services/uwalemiService';
import { 
  Send, 
  MessageSquare, 
  Settings, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Users, 
  Key, 
  ShieldAlert, 
  Smartphone, 
  Share2, 
  RefreshCw,
  Sliders,
  History,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Check,
  Search,
  Calendar,
  DollarSign,
  Tag,
  Scale,
  CreditCard,
  Layers,
  ShieldCheck
} from 'lucide-react';

interface Props {
  state: UwalemiState;
  onSaveState: (state: UwalemiState) => Promise<boolean>;
  initialRecipients?: { name: string; phone: string; memberNo: string; memberId?: string }[];
  initialTemplate?: string;
}

export const UwalemiSmsCenter: React.FC<Props> = ({
  state,
  onSaveState,
  initialRecipients,
  initialTemplate
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'compose' | 'gateway' | 'logs'>('compose');
  
  // Default templates
  const defaultSmartTemplate = `Habari {name}, kikundi cha UWALEMI kinakukumbusha kulipa ada zako: unadaiwa ada {feeDebt} {periodSummary} ({unpaidMonths}). Faini: {fainiSummary}. Jumla unayopaswa kulipa: {jumlaKuu}. Kamilisha kupitia {lipaNamba}. Lema, Nguvu Moja!`;
  const defaultFinesOnlyTemplate = `Habari {name} ({memberNo}), Taarifa ya UWALEMI: Unakumbushwa kulipa faini zako: {fainiSummary}. Jumla ya faini unayodaiwa ni {faini}. Tafadhali lipa kupitia {lipaNamba}. Ahsante, Lema, Nguvu Moja!`;

  // Compose State
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'all_debtors' | 'fines_only' | 'meeting_fines_only' | 'late_fee_fines_only' | 'unpaid_month' | 'custom'>(
    initialTemplate && initialTemplate.toLowerCase().includes('faini')
      ? (initialRecipients && initialRecipients.length > 0 ? 'custom' : 'fines_only')
      : (initialRecipients && initialRecipients.length > 0 ? 'custom' : 'all_debtors')
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    initialRecipients && initialRecipients.length > 0
      ? initialRecipients.map(r => r.memberId || '').filter(Boolean)
      : []
  );
  const [memberSearchTerm, setMemberSearchTerm] = useState<string>('');
  
  const [messageText, setMessageText] = useState<string>(
    initialTemplate || defaultSmartTemplate
  );
  const [messageType, setMessageType] = useState<'broadcast' | 'reminder' | 'emergency' | 'meeting' | 'receipt'>('reminder');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [previewMemberIndex, setPreviewMemberIndex] = useState<number>(0);

  // Sync props when user triggers SMS from external tabs (like Fines report or Meetings)
  useEffect(() => {
    if (initialTemplate) {
      setMessageText(initialTemplate);
      if (initialTemplate.toLowerCase().includes('faini')) {
        if (initialRecipients && initialRecipients.length > 0) {
          setRecipientFilter('custom');
          setSelectedMemberIds(initialRecipients.map(r => r.memberId || '').filter(Boolean));
        } else {
          setRecipientFilter('fines_only');
        }
      } else if (initialRecipients && initialRecipients.length > 0) {
        setRecipientFilter('custom');
        setSelectedMemberIds(initialRecipients.map(r => r.memberId || '').filter(Boolean));
      }
    } else if (initialRecipients && initialRecipients.length > 0) {
      setRecipientFilter('custom');
      setSelectedMemberIds(initialRecipients.map(r => r.memberId || '').filter(Boolean));
    }
  }, [initialTemplate, initialRecipients]);

  // Gateway Config State
  const [gatewayConfig, setGatewayConfig] = useState<UwalemiSmsConfig>(
    state.groupSettings?.smsConfig || {
      provider: 'simulation',
      apiKey: '',
      secretKey: '',
      senderId: 'UWALEMI',
      autoSendReceipts: true,
      autoSendMeetingAlerts: true,
      autoSendMonthlyReminder: true
    }
  );

  const [isTestingReminders, setIsTestingReminders] = useState(false);
  const [reminderTestResult, setReminderTestResult] = useState<{
    message: string;
    success: boolean;
    deliveredCount: number;
    recipientsCount: number;
    list?: string[];
  } | null>(null);

  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [balanceInfo, setBalanceInfo] = useState<{
    balance?: number | null;
    provider?: string;
    isSimulation?: boolean;
    error?: string;
    raw?: any;
    status?: number;
    globalHasEhub?: boolean;
  } | null>(null);

  const handleCheckBalance = async () => {
    setIsCheckingBalance(true);
    setBalanceInfo(null);
    try {
      const q = new URLSearchParams({
        source: 'uwalemi',
        provider: gatewayConfig.provider || 'meseji',
        apiKey: gatewayConfig.apiKey || '',
        secretKey: gatewayConfig.secretKey || '',
        senderId: gatewayConfig.senderId || ''
      });
      const res = await fetch(`/api/sms-balance?${q.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setBalanceInfo(data);
      } else {
        setBalanceInfo({ 
          error: data.error || 'Imeshindwa kupata salio', 
          status: res.status, 
          provider: data.provider, 
          globalHasEhub: data.globalHasEhub 
        });
      }
    } catch (e: any) {
      setBalanceInfo({ error: e.message || 'Hitilafu ya mtandao' });
    } finally {
      setIsCheckingBalance(false);
    }
  };

  const handleSyncGlobalEhub = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const fullState = await res.json();
        const globalSms = fullState.smsGatewaySettings;
        if (globalSms && globalSms.provider === 'ehub' && globalSms.apiKey) {
          const updatedConfig: UwalemiSmsConfig = {
            ...gatewayConfig,
            provider: 'ehub',
            apiKey: globalSms.apiKey,
            secretKey: globalSms.apiSecret || '',
            senderId: globalSms.senderId || '339330f1-4e6a-4bf7-a9f8-eaae2a9dd397',
            baseUrl: globalSms.url || 'https://sms.ehub.co.tz/api/v1/sms/send'
          };
          setGatewayConfig(updatedConfig);
          const updatedSettings = {
            ...state.groupSettings,
            smsConfig: updatedConfig
          };
          const updatedState = { ...state, groupSettings: updatedSettings };
          await onSaveState(updatedState);
          setSendResult(null);
          alert('Mipangilio ya eHub SMS (yenye salio lililothibitishwa) imesawazishwa na kuhifadhiwa kikamilifu! Sasa unaweza kutuma SMS kwa wajumbe.');
          setTimeout(() => handleCheckBalance(), 300);
          return;
        }
      }
      alert('Hakuna mipangilio ya eHub iliyopatikana kwenye mfumo mkuu.');
    } catch (e: any) {
      alert('Hitilafu: ' + (e.message || e));
    }
  };

  const handleQuickFixSenderId = async (newSenderId = 'MESEJI') => {
    const updatedConfig: UwalemiSmsConfig = {
      ...gatewayConfig,
      senderId: newSenderId
    };
    setGatewayConfig(updatedConfig);
    const updatedSettings = {
      ...state.groupSettings,
      smsConfig: updatedConfig
    };
    const updatedState = { ...state, groupSettings: updatedSettings };
    await onSaveState(updatedState);
    setSendResult(null);
    alert(`Sender ID imebadilishwa kuwa "${newSenderId}" na kuhifadhiwa! Sasa unaweza kujaribu kutuma tena ujumbe.`);
  };

  const handleSwitchToSimulation = async () => {
    const updatedConfig: UwalemiSmsConfig = {
      ...gatewayConfig,
      provider: 'simulation'
    };
    setGatewayConfig(updatedConfig);
    const updatedSettings = {
      ...state.groupSettings,
      smsConfig: updatedConfig
    };
    const updatedState = { ...state, groupSettings: updatedSettings };
    await onSaveState(updatedState);
    setSendResult(null);
    alert('Mfumo umebadilishwa kuwa Hali ya Majaribio (Simulation Mode). Ujumbe utarekodiwa kwenye mfumo bila makato ya salio la SMS.');
  };

  const members = useMemo(() => sortMembersByLeadership(state.members || []), [state.members]);
  const messageLogs = state.messageLogs || [];

  // Calculate debts for all members
  const memberDebts = useMemo(() => {
    return calculateAllMembersFeeDebts(state);
  }, [state]);

  const memberDebtsMap = useMemo(() => {
    const map = new Map<string, UwalemiMemberFeeDebtInfo>();
    memberDebts.forEach(d => map.set(d.memberId, d));
    return map;
  }, [memberDebts]);

  // Current month unpaid member IDs
  const currentMonthUnpaidIds = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const paidIds = new Set(
      (state.monthlyPayments || [])
        .filter(p => p.year === currentYear && p.month === currentMonth && p.status === 'paid')
        .map(p => p.memberId)
    );
    return new Set(members.filter(m => m.status === 'active' && !paidIds.has(m.id)).map(m => m.id));
  }, [state.monthlyPayments, members]);

  // Determine recipients
  const targetRecipients = useMemo(() => {
    if (initialRecipients && initialRecipients.length > 0 && recipientFilter === 'custom' && selectedMemberIds.length === 0) {
      return initialRecipients.map(r => {
        const debt = r.memberId ? memberDebtsMap.get(r.memberId) : memberDebts.find(d => d.memberNo === r.memberNo);
        return {
          name: r.name,
          phone: r.phone,
          memberNo: r.memberNo,
          memberId: r.memberId || debt?.memberId,
          debtAmount: debt?.totalDebt,
          startMonth: debt?.startMonthName,
          endMonth: debt?.endMonthName,
          unpaidMonths: debt?.unpaidMonthsText,
          periodSummary: debt?.periodSummary,
          monthsCount: debt?.unpaidCount
        };
      });
    }

    if (recipientFilter === 'all') {
      return members.filter(m => m.status === 'active').map(m => {
        const debt = memberDebtsMap.get(m.id);
        return {
          name: m.fullName,
          phone: m.phone,
          memberNo: m.memberNo,
          memberId: m.id,
          debtAmount: debt?.totalDebt,
          startMonth: debt?.startMonthName,
          endMonth: debt?.endMonthName,
          unpaidMonths: debt?.unpaidMonthsText,
          periodSummary: debt?.periodSummary,
          monthsCount: debt?.unpaidCount
        };
      });
    }

    if (recipientFilter === 'fee_debt_only') {
      return memberDebts
        .filter(d => (d.feeDebt || 0) > 0 && d.status === 'active')
        .map(d => ({
          name: d.memberName,
          phone: d.phone,
          memberNo: d.memberNo,
          memberId: d.memberId,
          debtAmount: d.feeDebt,
          feeDebt: d.feeDebt,
          lateFeePenalty: 0,
          otherFinesDebt: 0,
          totalFinesDebt: 0,
          startMonth: d.startMonthName,
          endMonth: d.endMonthName,
          unpaidMonths: d.unpaidMonthsText,
          periodSummary: d.periodSummary,
          monthsCount: d.unpaidCount
        }));
    }

    if (recipientFilter === 'all_debtors') {
      return memberDebts
        .filter(d => d.totalDebt > 0 && d.status === 'active')
        .map(d => ({
          name: d.memberName,
          phone: d.phone,
          memberNo: d.memberNo,
          memberId: d.memberId,
          debtAmount: d.totalDebt,
          feeDebt: d.feeDebt,
          lateFeePenalty: d.lateFeePenalty,
          otherFinesDebt: d.otherFinesDebt,
          totalFinesDebt: d.totalFinesDebt,
          startMonth: d.startMonthName,
          endMonth: d.endMonthName,
          unpaidMonths: d.unpaidMonthsText,
          periodSummary: d.periodSummary,
          monthsCount: d.unpaidCount
        }));
    }

    if (recipientFilter === 'fines_only') {
      return memberDebts
        .filter(d => (d.totalFinesDebt || 0) > 0 && d.status === 'active')
        .map(d => ({
          name: d.memberName,
          phone: d.phone,
          memberNo: d.memberNo,
          memberId: d.memberId,
          debtAmount: d.totalDebt,
          feeDebt: d.feeDebt,
          lateFeePenalty: d.lateFeePenalty,
          otherFinesDebt: d.otherFinesDebt,
          totalFinesDebt: d.totalFinesDebt,
          startMonth: d.startMonthName,
          endMonth: d.endMonthName,
          unpaidMonths: d.unpaidMonthsText,
          periodSummary: d.periodSummary,
          monthsCount: d.unpaidCount
        }));
    }

    if (recipientFilter === 'meeting_fines_only') {
      return memberDebts
        .filter(d => (d.otherFinesDebt || 0) > 0 && d.status === 'active')
        .map(d => ({
          name: d.memberName,
          phone: d.phone,
          memberNo: d.memberNo,
          memberId: d.memberId,
          debtAmount: d.totalDebt,
          feeDebt: d.feeDebt,
          lateFeePenalty: d.lateFeePenalty,
          otherFinesDebt: d.otherFinesDebt,
          totalFinesDebt: d.totalFinesDebt,
          startMonth: d.startMonthName,
          endMonth: d.endMonthName,
          unpaidMonths: d.unpaidMonthsText,
          periodSummary: d.periodSummary,
          monthsCount: d.unpaidCount
        }));
    }

    if (recipientFilter === 'late_fee_fines_only') {
      return memberDebts
        .filter(d => (d.lateFeePenalty || 0) > 0 && d.status === 'active')
        .map(d => ({
          name: d.memberName,
          phone: d.phone,
          memberNo: d.memberNo,
          memberId: d.memberId,
          debtAmount: d.totalDebt,
          feeDebt: d.feeDebt,
          lateFeePenalty: d.lateFeePenalty,
          otherFinesDebt: d.otherFinesDebt,
          totalFinesDebt: d.totalFinesDebt,
          startMonth: d.startMonthName,
          endMonth: d.endMonthName,
          unpaidMonths: d.unpaidMonthsText,
          periodSummary: d.periodSummary,
          monthsCount: d.unpaidCount
        }));
    }

    if (recipientFilter === 'unpaid_month') {
      return members
        .filter(m => currentMonthUnpaidIds.has(m.id))
        .map(m => {
          const debt = memberDebtsMap.get(m.id);
          return {
            name: m.fullName,
            phone: m.phone,
            memberNo: m.memberNo,
            memberId: m.id,
            debtAmount: debt?.totalDebt,
            feeDebt: debt?.feeDebt,
            lateFeePenalty: debt?.lateFeePenalty,
            otherFinesDebt: debt?.otherFinesDebt,
            totalFinesDebt: debt?.totalFinesDebt,
            startMonth: debt?.startMonthName,
            endMonth: debt?.endMonthName,
            unpaidMonths: debt?.unpaidMonthsText,
            periodSummary: debt?.periodSummary,
            monthsCount: debt?.unpaidCount
          };
        });
    }

    // Custom
    return members
      .filter(m => selectedMemberIds.includes(m.id))
      .map(m => {
        const debt = memberDebtsMap.get(m.id);
        return {
          name: m.fullName,
          phone: m.phone,
          memberNo: m.memberNo,
          memberId: m.id,
          debtAmount: debt?.totalDebt,
          feeDebt: debt?.feeDebt,
          lateFeePenalty: debt?.lateFeePenalty,
          otherFinesDebt: debt?.otherFinesDebt,
          totalFinesDebt: debt?.totalFinesDebt,
          startMonth: debt?.startMonthName,
          endMonth: debt?.endMonthName,
          unpaidMonths: debt?.unpaidMonthsText,
          periodSummary: debt?.periodSummary,
          monthsCount: debt?.unpaidCount
        };
      });
  }, [recipientFilter, selectedMemberIds, initialRecipients, members, memberDebts, memberDebtsMap, currentMonthUnpaidIds]);

  const handleApplyTemplate = (type: string) => {
    if (type === 'fee_debt_only_reminder') {
      setMessageText(`Habari {name}, kikundi cha UWALEMI kinakukumbusha kulipa ada yako ya miezi iliyopita: unadaiwa ada TZS {feeDebt} {periodSummary} ({unpaidMonths}). Lipa kupitia {lipaNamba}. Tafadhali kamilisha malipo yako kuepuka faini ya kuchelewa kulipa ada na kuwa nje ya umoja kwa mujibu wa katiba. Lema, Nguvu Moja!`);
      setMessageType('reminder');
    } else if (type === 'smart_debt_reminder') {
      setMessageText(`Habari {name}, kikundi cha UWALEMI kinakukumbusha kulipa ada zako: unadaiwa ada {feeDebt} {periodSummary} ({unpaidMonths}). Faini: {fainiSummary}. Jumla unayopaswa kulipa: {jumlaKuu}. Kamilisha kupitia {lipaNamba}. Lema, Nguvu Moja!`);
      setMessageType('reminder');
    } else if (type === 'fines_only_reminder') {
      setMessageText(`Habari {name} ({memberNo}), Taarifa ya UWALEMI: Unakumbushwa kulipa faini zako: {fainiSummary}. Jumla ya faini unayodaiwa ni {faini}. Tafadhali lipa kupitia {lipaNamba}. Lema, Nguvu Moja!`);
      setMessageType('reminder');
    } else if (type === 'late_fee_fine_reminder') {
      setMessageText(`Habari {name} ({memberNo}), Taarifa ya UWALEMI: Unakumbushwa kuwa una faini ya ucheleweshaji wa ada ya miezi {fainiMiezi} (zaidi ya miezi 3 ya neema) kiasi cha {fainiAda}. Tafadhali kamilisha malipo kupitia {lipaNamba}. Lema, Nguvu Moja!`);
      setMessageType('reminder');
    } else if (type === 'meeting_fine_reminder') {
      setMessageText(`Habari {name} ({memberNo}), Taarifa ya UWALEMI: Unakumbushwa kulipa faini ya kutohudhuria/kuchelewa kikao kiasi cha {fainiVikao}. Tafadhali kamilisha malipo kupitia {lipaNamba}. Lema, Nguvu Moja!`);
      setMessageType('reminder');
    } else if (type === 'single_month_reminder') {
      setMessageText(`Habari {name}, hii ni taarifa ya kukumbusha ada yako ya kikundi cha UWALEMI ya mwezi huu ({monthlyFee}). Tafadhali kamilisha malipo kupitia {lipaNamba}. Lema, Nguvu Moja!`);
      setMessageType('reminder');
    } else if (type === 'emergency_alert') {
      setMessageText(`TAARIFA YA MSIBA / DHARURA - UWALEMI\nHabari {name}, kikundi kinatangaza mchango wa dharura wa TZS 20,000 kusaidiana na mwanachama mwenzetu. Mwisho wa kuchanga ni siku 14 kuanzia leo. Lipa kupitia {lipaNamba}. Lema, Nguvu Moja!`);
      setMessageType('emergency');
    } else if (type === 'meeting_quick_reminder') {
      const upcomingMeeting = state.meetings?.find(m => m.status === 'upcoming') || state.meetings?.[0];
      const { dayName, formattedDate } = getSwahiliDayAndDate(upcomingMeeting?.date);
      const timeStr = upcomingMeeting?.time || '15:00 - 18:00';
      const locationStr = upcomingMeeting?.location || 'White House - Korogwe';
      const titleStr = upcomingMeeting?.title || 'Kikao cha Kawaida cha Mwezi';

      setMessageText(`KUMBUKIZI MUHIMU YA KIKAO - UWALEMI
Habari {name}, unakumbushwa kuhusu ${titleStr} siku ya ${dayName} tarehe ${formattedDate}, kuanzia saa ${timeStr}, eneo: ${locationStr}.

Tafadhali fika mapema bila kuchelewa ili kuepuka faini ya kuchelewa/utoro.

Lema, Nguvu Moja!`);
      setMessageType('meeting');
    } else if (type === 'meeting_notice') {
      const upcomingMeeting = state.meetings?.find(m => m.status === 'upcoming') || state.meetings?.[0];
      const { dayName, formattedDate } = getSwahiliDayAndDate(upcomingMeeting?.date);
      const timeStr = upcomingMeeting?.time || '14:00 - 17:00';
      const locationStr = upcomingMeeting?.location || 'Sinza, Dar es Salaam';

      setMessageText(`Ndugu {name}, unakumbushwa kuwa kutakuwa na kikao cha wanachama siku ya ${dayName} ${formattedDate}, saa ${timeStr}, mahali ${locationStr}.

Kikao hiki ni muhimu, kwani kuna mambo muhimu sana ya kujadili yanayohusu umoja na ustawi wa wanachama. Hivyo, tunasisitiza kila mwanachama kuhudhuria.

Pia, unasisitizwa kulipa ada yako kwa wakati ili kuepuka faini na kuwa nje ya umoja kwa mujibu wa Katiba.

Lipa ada yako kupitia M-Koba au kwa namba 0758219298 – Eva O. Lema.

Aidha, unasisitizwa kufika kwenye kikao kwa wakati bila kuchelewa, ili kuepuka faini.

Tunakuhitaji kwenye kikao. Ushiriki wako ni muhimu sana kwa maendeleo ya umoja wetu.

Karibu na asante kwa ushirikiano wako.

Lema, Nguvu Moja!`);
      setMessageType('meeting');
    } else if (type === 'general_broadcast') {
      setMessageText(`Habari {name}, hii ni taarifa kutoka uongozi wa kikundi cha UWALEMI. Tunaomba ushirikiano wako katika shughuli za kikundi. Lema, Nguvu Moja!`);
      setMessageType('broadcast');
    }
  };

  const insertTag = (tag: string) => {
    setMessageText(prev => prev + ` ${tag} `);
  };

  // Preview formatting
  const previewDebtInfo: UwalemiMemberFeeDebtInfo = useMemo(() => {
    if (targetRecipients.length > 0) {
      const idx = Math.min(previewMemberIndex, targetRecipients.length - 1);
      const rec = targetRecipients[idx];
      if (rec.memberId && memberDebtsMap.has(rec.memberId)) {
        return memberDebtsMap.get(rec.memberId)!;
      }
      const matched = memberDebts.find(d => d.memberNo === rec.memberNo || d.memberName === rec.name);
      if (matched) return matched;
      return {
        memberId: rec.memberId || 'temp',
        memberNo: rec.memberNo || 'UWL-001',
        memberName: rec.name || 'Mjumbe',
        phone: rec.phone || '',
        role: 'Mjumbe',
        status: 'active',
        monthlyFee: 15000,
        feeDebt: rec.feeDebt || rec.debtAmount || 40000,
        lateFeePenalty: rec.lateFeePenalty || 0,
        penaltyMonthsCount: 0,
        unpaidFromJuneCount: 0,
        otherFinesDebt: rec.otherFinesDebt || 0,
        otherFinesPaid: 0,
        totalFinesDebt: rec.totalFinesDebt || 0,
        totalDebt: rec.debtAmount || 40000,
        unpaidCount: rec.monthsCount || 4,
        startMonthName: rec.startMonth || 'Novemba 2023',
        endMonthName: rec.endMonth || 'Februari 2024',
        unpaidMonthsList: ['Nov 2023', 'Des 2023', 'Jan 2024', 'Feb 2024'],
        unpaidMonthsText: rec.unpaidMonths || 'Nov 2023, Des 2023, Jan 2024, Feb 2024',
        periodSummary: rec.periodSummary || 'kuanzia Novemba 2023 hadi Februari 2024 (miezi 4)',
        breakdown: []
      };
    }
    // Default sample preview
    const sample = memberDebts.find(d => d.totalDebt > 0) || memberDebts[0];
    if (sample) return sample;
    return {
      memberId: 'sample',
      memberNo: 'UWL-001',
      memberName: 'James Lema',
      phone: '0712345678',
      role: 'Mjumbe',
      status: 'active',
      monthlyFee: 15000,
      feeDebt: 40000,
      lateFeePenalty: 0,
      penaltyMonthsCount: 0,
      unpaidFromJuneCount: 0,
      otherFinesDebt: 0,
      otherFinesPaid: 0,
      totalFinesDebt: 0,
      totalDebt: 40000,
      unpaidCount: 4,
      startMonthName: 'Novemba 2023',
      endMonthName: 'Februari 2024',
      unpaidMonthsList: ['Nov 2023', 'Des 2023', 'Jan 2024', 'Feb 2024'],
      unpaidMonthsText: 'Nov 2023, Des 2023, Jan 2024, Feb 2024',
      periodSummary: 'kuanzia Novemba 2023 hadi Februari 2024 (miezi 4)',
      breakdown: []
    };
  }, [targetRecipients, previewMemberIndex, memberDebtsMap, memberDebts]);

  const renderedPreviewText = useMemo(() => {
    return formatPersonalizedUwalemiSms(messageText, previewDebtInfo);
  }, [messageText, previewDebtInfo]);

  const handleSendSms = async () => {
    if (targetRecipients.length === 0) {
      alert('Tafadhali chagua angalau mpokeaji mmoja mwenye namba ya simu.');
      return;
    }
    if (!messageText.trim()) {
      alert('Tafadhali andika ujumbe wako kwanza.');
      return;
    }

    setIsSending(true);
    setSendResult(null);

    const personalizedRecipients = targetRecipients.map(rec => {
      let debtInfo: UwalemiMemberFeeDebtInfo | undefined;
      if (rec.memberId && memberDebtsMap.has(rec.memberId)) {
        debtInfo = memberDebtsMap.get(rec.memberId);
      } else {
        debtInfo = memberDebts.find(d => (rec.memberNo && d.memberNo === rec.memberNo) || (rec.name && d.memberName === rec.name) || (rec.phone && d.phone === rec.phone));
      }

      const effectiveDebtInfo: UwalemiMemberFeeDebtInfo = debtInfo || {
        memberId: rec.memberId || 'temp',
        memberNo: rec.memberNo || '',
        memberName: rec.name || 'Mjumbe',
        phone: rec.phone || '',
        role: 'Mjumbe',
        status: 'active',
        monthlyFee: 15000,
        feeDebt: rec.feeDebt ?? rec.debtAmount ?? 0,
        lateFeePenalty: rec.lateFeePenalty ?? 0,
        penaltyMonthsCount: Math.max(0, (rec.monthsCount ?? 0) - 3),
        unpaidFromJuneCount: 0,
        otherFinesDebt: rec.otherFinesDebt ?? 0,
        otherFinesPaid: 0,
        totalFinesDebt: rec.totalFinesDebt ?? ((rec.lateFeePenalty ?? 0) + (rec.otherFinesDebt ?? 0)),
        totalDebt: rec.debtAmount ?? 0,
        unpaidCount: rec.monthsCount ?? 0,
        startMonthName: rec.startMonth || '',
        endMonthName: rec.endMonth || '',
        unpaidMonthsList: rec.unpaidMonths ? rec.unpaidMonths.split(', ') : [],
        unpaidMonthsText: rec.unpaidMonths || '',
        periodSummary: rec.periodSummary || '',
        breakdown: []
      };

      const customMessage = formatPersonalizedUwalemiSms(messageText, effectiveDebtInfo);

      return {
        ...rec,
        customMessage
      };
    });

    const result = await sendUwalemiSms({
      recipients: personalizedRecipients,
      message: messageText,
      messageType
    });

    setIsSending(false);
    setSendResult({
      success: result.success,
      message: result.message
    });
  };

  const handleSaveGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSettings = {
      ...state.groupSettings,
      smsConfig: gatewayConfig
    };
    const updatedState = { ...state, groupSettings: updatedSettings };
    await onSaveState(updatedState);
    alert('Mipangilio ya SMS Gateway ya UWALEMI imehifadhiwa kwa mafanikio!');
  };

  const handleTriggerTestReminders = async () => {
    if (!confirm('Je, unataka kutuma/kujaribu vikumbusho vya ada ya mwezi huu sasa kwa wanachama wote ambao hawajalipa mwezi huu?')) {
      return;
    }
    setIsTestingReminders(true);
    setReminderTestResult(null);
    try {
      const res = await triggerMonthlyAutoRemindersApi(true); // forceNow = true
      setReminderTestResult(res);
    } catch (e: any) {
      setReminderTestResult({
        success: false,
        deliveredCount: 0,
        recipientsCount: 0,
        message: e.message || 'Hitilafu imetokea wakati wa kuanzisha vikumbusho'
      });
    } finally {
      setIsTestingReminders(false);
    }
  };

  const debtorsCount = memberDebts.filter(d => d.totalDebt > 0 && d.status === 'active').length;
  const totalDebtsAmount = memberDebts.reduce((sum, d) => sum + (d.status === 'active' ? d.totalDebt : 0), 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-12" id="uwalemi-sms-center">
      {/* Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <h2 className="text-xl font-bold text-white">Kituo cha SMS & Vikumbusho vya Madeni ya Ada</h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Smart Debt Tracking
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Hutambua mwanachama anayedaiwa ada kuanzia mwezi gani, idadi ya miezi, na kiasi halisi anachodaiwa kwa usahihi.
            </p>
          </div>

          {/* Sub-tabs switchers */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start md:self-auto">
            <button
              onClick={() => setActiveSubTab('compose')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeSubTab === 'compose' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tuma Ujumbe (Compose)
            </button>
            <button
              onClick={() => setActiveSubTab('gateway')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeSubTab === 'gateway' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mipangilio ya Gateway
            </button>
            <button
              onClick={() => setActiveSubTab('logs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeSubTab === 'logs' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Kumbukumbu ({messageLogs.length})
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: COMPOSE & SEND */}
      {activeSubTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Composer */}
          <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" />
                Andika Ujumbe kwa Wajumbe ({targetRecipients.length} Wateule)
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                Sender ID: <strong className="text-emerald-400">{gatewayConfig.senderId || 'UWALEMI'}</strong>
              </span>
            </div>

            {/* Quick Templates Pills */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1.5 font-semibold">Violezo vya Haraka (Templates):</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRecipientFilter('fee_debt_only');
                    handleApplyTemplate('fee_debt_only_reminder');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold border border-emerald-500/40 cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  💳 Madeni ya Ada Pekee (Bila Faini)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('fines_only_reminder')}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-bold border border-rose-500/40 cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  🚨 Faini Zote Pekee (Vikao + Ucheleweshaji)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('meeting_fine_reminder')}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[11px] font-semibold border border-rose-500/30 cursor-pointer flex items-center gap-1"
                >
                  <Scale className="w-3 h-3 text-rose-400" />
                  🏛️ Faini ya Kikao Pekee
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('late_fee_fine_reminder')}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[11px] font-semibold border border-amber-500/30 cursor-pointer"
                >
                  ⚠️ Faini ya Ada (&gt;Miezi 3)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('smart_debt_reminder')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[11px] font-bold border border-emerald-500/30 cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  ⚡ Ada + Faini (Smart Reminder)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('meeting_quick_reminder')}
                  className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[11px] font-bold border border-blue-500/40 cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  ⏰ Kumbukizi ya Kikao
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('meeting_notice')}
                  className="px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 text-[11px] font-semibold border border-blue-500/30 cursor-pointer flex items-center gap-1"
                >
                  📜 Wito Rasmi wa Kikao
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('single_month_reminder')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 cursor-pointer"
                >
                  💳 Ada ya Mwezi Huu Pekee
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('emergency_alert')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 cursor-pointer"
                >
                  🆘 Taarifa ya Msiba
                </button>
              </div>
            </div>

            {/* Tag Badges Toolbar */}
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5 flex items-center gap-1">
                <Tag className="w-3 h-3 text-emerald-400" />
                Bofya Kigezo Kuingiza Kwenye Ujumbe (Dynamic Tags):
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => insertTag('{name}')}
                  title="Jina la Mwanachama"
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[10.5px] font-mono border border-slate-700 cursor-pointer"
                >
                  {"{name}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{memberNo}')}
                  title="Namba ya UWALEMI (mf. UWL-001)"
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[10.5px] font-mono border border-slate-700 cursor-pointer"
                >
                  {"{memberNo}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{feeDebt}')}
                  title="Deni la Ada Pekee (mf. TZS 45,000)"
                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10.5px] font-mono border border-amber-500/40 cursor-pointer font-bold"
                >
                  {"{feeDebt}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{faini}')}
                  title="Jumla ya Faini Yote (Ucheleweshaji + Vikao)"
                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10.5px] font-mono border border-rose-500/40 cursor-pointer font-bold"
                >
                  {"{faini}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{fainiAda}')}
                  title="Faini ya Ucheleweshaji Ada (Kuanzia Mwezi 6, TZS 5,000/mwezi baada ya miezi 3)"
                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10.5px] font-mono border border-rose-500/40 cursor-pointer font-bold"
                >
                  {"{fainiAda}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{fainiVikao}')}
                  title="Faini za Kutohudhuria Vikao"
                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10.5px] font-mono border border-rose-500/40 cursor-pointer"
                >
                  {"{fainiVikao}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{fainiSummary}')}
                  title="Muhtasari wa Faini (Ada na Vikao)"
                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10.5px] font-mono border border-rose-500/40 cursor-pointer"
                >
                  {"{fainiSummary}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{fainiMiezi}')}
                  title="Idadi ya Miezi ya Faini ya Ada"
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-mono border border-slate-700 cursor-pointer"
                >
                  {"{fainiMiezi}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{jumlaKuu}')}
                  title="Jumla Kuu (Ada + Faini Zote)"
                  className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10.5px] font-mono border border-emerald-500/40 cursor-pointer font-bold"
                >
                  {"{jumlaKuu}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{startMonth}')}
                  title="Mwezi Anaoanzia Kudaiwa (mf. Novemba 2023)"
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-mono border border-slate-700 cursor-pointer"
                >
                  {"{startMonth}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{endMonth}')}
                  title="Mwezi wa Mwisho Anaodaiwa (mf. Februari 2024)"
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-mono border border-slate-700 cursor-pointer"
                >
                  {"{endMonth}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{periodSummary}')}
                  title="Maelezo ya Kipindi (mf. kuanzia Novemba 2023 hadi Februari 2024 (miezi 4))"
                  className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10.5px] font-mono border border-purple-500/40 cursor-pointer font-bold"
                >
                  {"{periodSummary}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{unpaidMonths}')}
                  title="Orodha ya Miezi Anayodaiwa (mf. Nov 2023, Des 2023, Jan 2024)"
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-mono border border-slate-700 cursor-pointer"
                >
                  {"{unpaidMonths}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{monthsCount}')}
                  title="Idadi ya Miezi (mf. 4)"
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-mono border border-slate-700 cursor-pointer"
                >
                  {"{monthsCount}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{lipaNamba}')}
                  title="Njia ya Malipo (M Koba / 0758 219 298 Eva O Lema)"
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-mono border border-slate-700 cursor-pointer"
                >
                  {"{lipaNamba}"}
                </button>
              </div>
            </div>

            {/* Message Area */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-slate-300 font-semibold">Ujumbe Wako (Template):</label>
                <span className="text-[10px] text-slate-400 font-mono">
                  Urefu: {messageText.length} herufi • ~{Math.ceil(messageText.length / 160) || 1} SMS
                </span>
              </div>
              <textarea
                rows={4}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Andika ujumbe wako hapa..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
              />
            </div>

            {/* Preview Box with Recipient Selector */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Muonekano wa Ujumbe kwa Mjumbe:</span>
                </div>
                {targetRecipients.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Sampuli ya Mjumbe:</span>
                    <select
                      value={previewMemberIndex}
                      onChange={(e) => setPreviewMemberIndex(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-emerald-500"
                    >
                      {targetRecipients.map((rec, idx) => (
                        <option key={idx} value={idx}>
                          {rec.memberNo ? `${rec.memberNo} - ` : ''}{rec.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Recipient Debt Breakdown Badge */}
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                  {previewDebtInfo.memberNo} {previewDebtInfo.memberName}
                </span>
                {previewDebtInfo.totalDebt > 0 ? (
                  <>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30">
                      Ada: TZS {(previewDebtInfo.feeDebt ?? previewDebtInfo.totalDebt).toLocaleString()}
                    </span>
                    {(previewDebtInfo.lateFeePenalty || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 font-bold border border-rose-500/30">
                        Faini Ada: TZS {previewDebtInfo.lateFeePenalty.toLocaleString()}
                      </span>
                    )}
                    {(previewDebtInfo.otherFinesDebt || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-bold border border-indigo-500/30">
                        Faini Vikao: TZS {previewDebtInfo.otherFinesDebt.toLocaleString()}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
                      Jumla Kuu: TZS {previewDebtInfo.totalDebt.toLocaleString()}
                    </span>
                  </>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
                    ✓ Hana deni
                  </span>
                )}
              </div>

              <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                  {renderedPreviewText}
                </p>
              </div>
            </div>

            {/* Send Result Notification */}
            {sendResult && (
              <div className={`p-4 rounded-xl text-xs flex flex-col gap-3 border ${
                sendResult.success 
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              }`}>
                <div className="flex items-start gap-3">
                  {sendResult.success ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" /> : <XCircle className="w-5 h-5 shrink-0 text-rose-400" />}
                  <div>
                    <div className="font-bold text-sm">{sendResult.success ? 'Ujumbe Umetumwa Kikamilifu!' : 'Hitilafu ya Kutuma SMS'}</div>
                    <div className="mt-1 leading-relaxed text-slate-200">{sendResult.message}</div>
                  </div>
                </div>

                {!sendResult.success && (
                  <div className="mt-2 pt-3 border-t border-rose-900/40 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-400 font-semibold">Ufumbuzi wa Haraka:</span>
                    {gatewayConfig.senderId !== 'MESEJI' && (
                      <button
                        type="button"
                        onClick={() => handleQuickFixSenderId('MESEJI')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Weka Sender ID kuwa "MESEJI"
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSwitchToSimulation}
                      className="px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Badilisha kuwa Hali ya Majaribio (Simulation)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('gateway')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                    >
                      <Settings className="w-3.5 h-3.5 text-emerald-400" />
                      Fungua Mipangilio ya Gateway
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const cleanPhone = (previewDebtInfo.phone || '').replace(/[^0-9]/g, '');
                  const waUrl = cleanPhone 
                    ? `https://wa.me/${cleanPhone.startsWith('0') ? '255' + cleanPhone.substring(1) : cleanPhone}?text=${encodeURIComponent(renderedPreviewText)}`
                    : `https://wa.me/?text=${encodeURIComponent(renderedPreviewText)}`;
                  window.open(waUrl, '_blank');
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-semibold transition-all cursor-pointer shadow-md"
              >
                <Share2 className="w-4 h-4" />
                Tuma kwa WhatsApp ({previewDebtInfo.memberName})
              </button>

              <button
                type="button"
                disabled={isSending || targetRecipients.length === 0}
                onClick={handleSendSms}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-900/40 transition-all cursor-pointer"
              >
                {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isSending ? 'Inatuma...' : `Tuma SMS kwa Wajumbe ${targetRecipients.length}`}
              </button>
            </div>
          </div>

          {/* Right 1 Col: Recipient Filter Picker & Debtor Stats */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Chagua Wapokeaji
              </h3>
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {targetRecipients.length} Wateule
              </span>
            </div>

            {/* Quick Stats of Debts */}
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Wenye Madeni ya Ada:</span>
                <span className="font-bold text-amber-400">{debtorsCount} wajumbe</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Wenye Faini (Ada/Vikao):</span>
                <span className="font-bold text-rose-400">
                  {memberDebts.filter(d => (d.totalFinesDebt || 0) > 0 && d.status === 'active').length} wajumbe
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Jumla ya Madeni & Faini:</span>
                <span className="font-bold text-emerald-400">TZS {totalDebtsAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                recipientFilter === 'fee_debt_only' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="recFilter"
                  checked={recipientFilter === 'fee_debt_only'}
                  onChange={() => {
                    setRecipientFilter('fee_debt_only');
                    handleApplyTemplate('fee_debt_only_reminder');
                  }}
                  className="text-emerald-500 mt-0.5"
                />
                <div>
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                    💳 Wenye Madeni ya Ada Pekee (Bila Faini)
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                      {memberDebts.filter(d => (d.feeDebt || 0) > 0 && d.status === 'active').length}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Huchuja wajumbe wanaodaiwa ada za miezi bila kujumuisha faini za aina yoyote.
                  </span>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                recipientFilter === 'all_debtors' ? 'bg-amber-500/10 border-amber-500/40' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="recFilter"
                  checked={recipientFilter === 'all_debtors'}
                  onChange={() => {
                    setRecipientFilter('all_debtors');
                    handleApplyTemplate('smart_debt_reminder');
                  }}
                  className="text-emerald-500 mt-0.5"
                />
                <div>
                  <span className="font-bold text-white flex items-center gap-1.5">
                    ⚡ Wenye Madeni Yote ya Ada & Faini
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                      {debtorsCount}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Huchuja wote wanaodaiwa ada kuanzia mwezi walioanza kudaiwa pamoja na faini zao.
                  </span>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                recipientFilter === 'fines_only' ? 'bg-rose-500/10 border-rose-500/40' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="recFilter"
                  checked={recipientFilter === 'fines_only'}
                  onChange={() => {
                    setRecipientFilter('fines_only');
                    handleApplyTemplate('fines_only_reminder');
                  }}
                  className="text-rose-500 mt-0.5"
                />
                <div>
                  <span className="font-bold text-rose-300 flex items-center gap-1.5">
                    🚨 Wenye Faini Zote (Vikao + Ucheleweshaji Ada)
                    <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono">
                      {memberDebts.filter(d => (d.totalFinesDebt || 0) > 0 && d.status === 'active').length}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Huchuja wote wenye faini za aina yoyote (faini za vikao au ucheleweshaji wa ada).
                  </span>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                recipientFilter === 'meeting_fines_only' ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="recFilter"
                  checked={recipientFilter === 'meeting_fines_only'}
                  onChange={() => {
                    setRecipientFilter('meeting_fines_only');
                    handleApplyTemplate('meeting_fine_reminder');
                  }}
                  className="text-indigo-500 mt-0.5"
                />
                <div>
                  <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                    🏛️ Faini za Vikao Pekee (Utoro / Kuchelewa)
                    <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
                      {memberDebts.filter(d => (d.otherFinesDebt || 0) > 0 && d.status === 'active').length}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Huchuja wajumbe wanaodaiwa faini za kutokuhudhuria au kuchelewa vikao pekee.
                  </span>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                recipientFilter === 'late_fee_fines_only' ? 'bg-amber-500/10 border-amber-500/40' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="recFilter"
                  checked={recipientFilter === 'late_fee_fines_only'}
                  onChange={() => {
                    setRecipientFilter('late_fee_fines_only');
                    handleApplyTemplate('late_fee_fine_reminder');
                  }}
                  className="text-amber-500 mt-0.5"
                />
                <div>
                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                    ⚠️ Faini za Ucheleweshaji Ada Pekee (&gt;Miezi 3)
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                      {memberDebts.filter(d => (d.lateFeePenalty || 0) > 0 && d.status === 'active').length}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Huchuja wajumbe wanaodaiwa faini ya kuchelewesha ada (wanaolundika zaidi ya miezi 3).
                  </span>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                recipientFilter === 'unpaid_month' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="recFilter"
                  checked={recipientFilter === 'unpaid_month'}
                  onChange={() => {
                    setRecipientFilter('unpaid_month');
                    handleApplyTemplate('single_month_reminder');
                  }}
                  className="text-emerald-500 mt-0.5"
                />
                <div>
                  <span className="font-bold text-white block">Wasolipa Ada ya Mwezi Huu</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Wajumbe {currentMonthUnpaidIds.size} ambao hawajakamilisha mwezi wa sasa.
                  </span>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                recipientFilter === 'all' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="recFilter"
                  checked={recipientFilter === 'all'}
                  onChange={() => setRecipientFilter('all')}
                  className="text-emerald-500 mt-0.5"
                />
                <div>
                  <span className="font-bold text-white block">Wajumbe Wote Hai ({members.filter(m => m.status === 'active').length})</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Tuma tangazo au taarifa ya jumla kwa wajumbe wote.
                  </span>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                recipientFilter === 'custom' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="recFilter"
                  checked={recipientFilter === 'custom'}
                  onChange={() => setRecipientFilter('custom')}
                  className="text-emerald-500 mt-0.5"
                />
                <div>
                  <span className="font-bold text-white block">Chagua Mjumbe Mmoja Mmoja</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Chagua wajumbe maalum kutoka kwenye orodha.
                  </span>
                </div>
              </label>
            </div>

            {recipientFilter === 'custom' && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tafuta jina au UWL..."
                    value={memberSearchTerm}
                    onChange={(e) => setMemberSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] px-1 text-slate-400">
                  <button
                    type="button"
                    onClick={() => setSelectedMemberIds(members.map(m => m.id))}
                    className="text-emerald-400 hover:underline cursor-pointer"
                  >
                    Chagua Wote
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMemberIds([])}
                    className="text-slate-400 hover:underline cursor-pointer"
                  >
                    Futa Wote
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1 p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                  {members
                    .filter(m => !memberSearchTerm || m.fullName.toLowerCase().includes(memberSearchTerm.toLowerCase()) || m.memberNo.toLowerCase().includes(memberSearchTerm.toLowerCase()))
                    .map(m => {
                      const debt = memberDebtsMap.get(m.id);
                      return (
                        <label key={m.id} className="flex items-center justify-between p-1.5 hover:bg-slate-900 rounded-lg cursor-pointer text-slate-300">
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={selectedMemberIds.includes(m.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedMemberIds([...selectedMemberIds, m.id]);
                                else setSelectedMemberIds(selectedMemberIds.filter(id => id !== m.id));
                              }}
                            />
                            <span className="font-mono text-emerald-400 text-[11px] font-bold">{m.memberNo}</span>
                            <span className="truncate">{m.fullName}</span>
                          </div>
                          {debt && debt.totalDebt > 0 ? (
                            <span className="text-[10px] font-bold text-amber-400 shrink-0 ml-1">
                              TZS {debt.totalDebt.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-500 shrink-0 ml-1">✓ Safi</span>
                          )}
                        </label>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: GATEWAY CONFIG */}
      {activeSubTab === 'gateway' && (
        <div className="max-w-2xl bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-400" />
              Mipangilio ya Mtoa Huduma wa SMS (SMS Gateway)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Weka taarifa za API za Meseji.co.tz, Beem Africa, au NextSMS ili ujumbe wa kikundi cha UWALEMI uende moja kwa moja kwa simu za wajumbe kupitia mtandao wa simu.
            </p>
          </div>

          {/* Status Banner */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            gatewayConfig.provider !== 'simulation' && gatewayConfig.apiKey
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
          }`}>
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold flex items-center gap-2">
                Hali ya Sasa: {gatewayConfig.provider !== 'simulation' && gatewayConfig.apiKey
                  ? `Imeunganishwa na ${gatewayConfig.provider.toUpperCase()} (SMS Halisi Zitatumwa)`
                  : 'Hali ya Majaribio (Simulation Mode)'}
              </div>
              <p className="text-slate-300 leading-relaxed">
                {gatewayConfig.provider !== 'simulation' && gatewayConfig.apiKey
                  ? `Ujumbe na stakabadhi za kiotomatiki zitatumwa moja kwa moja kwenye simu za wajumbe kwa kutumia jina la "${gatewayConfig.senderId || 'UWALEMI'}".`
                  : 'Kwa sasa mfumo unarekodi stakabadhi na jumbe zote kwenye tab ya "Kumbukumbu za Ujumbe (Logs)" bila kukata salio. Ili ujumbe ufike halisi kwenye simu ya mwanachama, chagua Mtoa Huduma (Meseji, Beem, au NextSMS) na uweke API Key & Secret.'}
              </p>
            </div>
          </div>

          {/* Quick sync suggestion banner if using Meseji with error or wanting eHub */}
          <div className="p-3.5 bg-indigo-950/40 border border-indigo-800/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5 text-indigo-200">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Je, unataka kutumia eHub SMS (Yenye salio la SMS 52 tayari)?</span>
                <p className="text-[11px] text-indigo-300/90 mt-0.5">
                  Akaunti yako ya eHub SMS tayari imethibitishwa na inafanya kazi kikamilifu. Bofya kitufe hiki kusawazisha papo hapo.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSyncGlobalEhub}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow shrink-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Sawazisha eHub SMS Sasa
            </button>
          </div>

          <form onSubmit={handleSaveGateway} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Mtoa Huduma (Provider):</label>
              <select
                value={gatewayConfig.provider}
                onChange={(e) => setGatewayConfig({ ...gatewayConfig, provider: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="ehub">eHub SMS Tanzania (sms.ehub.co.tz) - Inapendekezwa (Ina Salio)</option>
                <option value="meseji">Meseji API (Meseji.co.tz - Tanzania)</option>
                <option value="beem">Beem Africa (apisms.beem.africa)</option>
                <option value="nextsms">NextSMS Tanzania (messaging-service.co.tz)</option>
                <option value="simulation">Mwigizo wa Kujaribu (Simulation Mode)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-300 font-semibold">Jina la Mtumaji (Sender ID):</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGatewayConfig({ ...gatewayConfig, senderId: 'UWALEMI' })}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded cursor-pointer transition-colors font-bold"
                  >
                    Weka "UWALEMI" (Rasmi)
                  </button>
                  {gatewayConfig.provider === 'meseji' && (
                    <button
                      type="button"
                      onClick={() => setGatewayConfig({ ...gatewayConfig, senderId: 'MESEJI' })}
                      className="text-[10px] text-slate-400 hover:text-white bg-slate-800/80 px-2 py-0.5 rounded cursor-pointer transition-colors"
                      title="Chagua MESEJI"
                    >
                      Weka "MESEJI"
                    </button>
                  )}
                </div>
              </div>
              <input
                type="text"
                value={gatewayConfig.senderId || ''}
                onChange={(e) => setGatewayConfig({ ...gatewayConfig, senderId: e.target.value })}
                placeholder={gatewayConfig.provider === 'ehub' ? 'Sender ID au ID ya eHub' : 'mf. MESEJI au UWALEMI'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
              {gatewayConfig.provider === 'meseji' && (
                <p className="text-[11px] text-slate-400 mt-1">
                  💡 <strong>Kidokezo cha Meseji.co.tz:</strong> Tumia Sender ID ya <span className="font-mono text-emerald-400 font-bold">MESEJI</span> isipokuwa uwe umeshasajili na kuidhinishiwa jina lingine (kama UWALEMI) kwenye dashboard ya Meseji. Kutumia jina ambalo halijaidhinishwa husababisha hitilafu (500).
                </p>
              )}
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {gatewayConfig.provider === 'meseji' ? 'Meseji API Token / Key:' : 'API Key:'}
              </label>
              <input
                type="password"
                value={gatewayConfig.apiKey || ''}
                onChange={(e) => setGatewayConfig({ ...gatewayConfig, apiKey: e.target.value })}
                placeholder={gatewayConfig.provider === 'meseji' ? 'Weka Token ya Meseji.co.tz (mf. zs_...)' : 'Weka API Key yako hapa'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
              {gatewayConfig.provider === 'meseji' && (
                <p className="text-[11px] text-amber-300/90 mt-1">
                  ⚠️ <strong>Muhimu:</strong> Ikiwa unapata hitilafu ya "Invalid or expired token", ingia kwenye <a href="https://meseji.co.tz" target="_blank" rel="noopener noreferrer" className="underline text-emerald-400 font-semibold">Meseji.co.tz</a> &gt; API Settings, tengeneza Token mpya na uinakili hapa.
                </p>
              )}
            </div>

            {gatewayConfig.provider !== 'meseji' && gatewayConfig.provider !== 'simulation' && (
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {gatewayConfig.provider === 'ehub' ? 'eHub API Secret (Secret Key):' : 'API Secret Key:'}
                </label>
                <input
                  type="password"
                  value={gatewayConfig.secretKey || ''}
                  onChange={(e) => setGatewayConfig({ ...gatewayConfig, secretKey: e.target.value })}
                  placeholder="Weka Secret Key"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Test Connection & Balance Checker */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                  Uhakiki wa Salio & Muunganisho (Live Gateway Status)
                </span>
                <button
                  type="button"
                  onClick={handleCheckBalance}
                  disabled={isCheckingBalance}
                  className="px-3 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white font-medium text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingBalance ? 'animate-spin' : ''}`} />
                  {isCheckingBalance ? 'Inahakiki...' : 'Kagua Salio Sasa'}
                </button>
              </div>

              {balanceInfo && (
                <div className={`p-3.5 rounded-lg border text-xs ${
                  balanceInfo.error 
                    ? 'bg-rose-950/50 border-rose-800/80 text-rose-300' 
                    : 'bg-emerald-950/50 border-emerald-800/80 text-emerald-300'
                }`}>
                  {balanceInfo.error ? (
                    <div className="space-y-2">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>Hitilafu ya Muunganisho / Salio ({balanceInfo.provider?.toUpperCase()}):</span>
                      </div>
                      <div className="text-[11px] text-slate-200 leading-relaxed bg-black/30 p-2.5 rounded-lg border border-rose-900/50">
                        {balanceInfo.error}
                      </div>

                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSyncGlobalEhub}
                          className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Tumia eHub SMS (Salio: 52 SMS)
                        </button>
                        <button
                          type="button"
                          onClick={handleSwitchToSimulation}
                          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                          Badili kuwa Hali ya Majaribio (Simulation)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Muunganisho na {balanceInfo.provider?.toUpperCase()} Uko Sawa!
                      </div>
                      <div className="text-xs text-slate-200">
                        Salio la SMS (SMS Credits): <strong className="text-emerald-400 font-mono text-base">{balanceInfo.balance !== null && balanceInfo.balance !== undefined ? Number(balanceInfo.balance).toLocaleString() : 'Iko hewani'}</strong> SMS
                      </div>
                      {balanceInfo.balance === 0 && (
                        <div className="text-[11px] text-amber-300 mt-1">
                          ⚠️ Salio lako la SMS ni 0. Ili SMS zitumwe kwa wanachama, tafadhali ongeza salio kwenye akaunti yako ya SMS.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-800">
              <label className="flex items-start gap-3 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={gatewayConfig.autoSendReceipts}
                  onChange={(e) => setGatewayConfig({ ...gatewayConfig, autoSendReceipts: e.target.checked })}
                  className="rounded text-emerald-500 mt-0.5"
                />
                <div>
                  <div className="font-medium text-slate-200">Tuma SMS ya stakabadhi kiotomatiki mara tu ada au mchango unaporekodiwa</div>
                  <p className="text-[11px] text-slate-400">Mjumbe atapokea SMS ya stakabadhi yenye namba ya risiti mara tu unapobofya Hifadhi Malipo.</p>
                </div>
              </label>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={gatewayConfig.autoSendMonthlyReminder}
                    onChange={(e) => setGatewayConfig({ ...gatewayConfig, autoSendMonthlyReminder: e.target.checked })}
                    className="rounded text-emerald-500 mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-slate-200">Tuma vikumbusho vya ada ya kila mwezi kiotomatiki tarehe 25 ya kila mwezi</div>
                    <p className="text-[11px] text-slate-400">
                      Mfumo utawakagua wanachama wote hai ambao hawajalipa ada ya mwezi husika kila tarehe 25 saa 3:00 asubuhi na kuwatumia ujumbe wa kikumbusho cha kirafiki.
                    </p>
                  </div>
                </label>

                {/* Status and manual test trigger */}
                <div className="pt-2 border-t border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px]">
                  <div className="text-slate-400 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      {state.lastMonthlyReminderYearMonth
                        ? `Mwezi wa mwisho kutumwa: ${state.lastMonthlyReminderYearMonth} (${state.lastMonthlyReminderDate ? new Date(state.lastMonthlyReminderDate).toLocaleDateString('sw-TZ') : 'Tarehe 25'})`
                        : 'Bado hakuna vikumbusho vya kiotomatiki vilivyotoka mwezi huu.'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleTriggerTestReminders}
                    disabled={isTestingReminders}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isTestingReminders ? 'animate-spin' : ''}`} />
                    {isTestingReminders ? 'Inatuma vikumbusho...' : 'Jaribu Kutuma Sasa (Test Run)'}
                  </button>
                </div>

                {reminderTestResult && (
                  <div className={`p-3 rounded-lg border text-xs ${
                    reminderTestResult.success 
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' 
                      : 'bg-rose-950/60 border-rose-800 text-rose-300'
                  }`}>
                    <div className="font-semibold">{reminderTestResult.message}</div>
                    {reminderTestResult.list && reminderTestResult.list.length > 0 && (
                      <div className="mt-1 text-[11px] text-slate-300">
                        Waliopelekewa: {reminderTestResult.list.slice(0, 5).join(', ')}
                        {reminderTestResult.list.length > 5 ? ` na wengine ${reminderTestResult.list.length - 5}` : ''}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
              >
                Hifadhi Mipangilio ya SMS
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW 3: MESSAGE LOGS */}
      {activeSubTab === 'logs' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              Kumbukumbu za Ujumbe Uliotumwa (Message Logs)
            </h3>
            <span className="text-xs text-slate-400">Jumla: {messageLogs.length} ujumbe</span>
          </div>

          {messageLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Bado hakuna kumbukumbu za ujumbe uliotumwa.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Tarehe & Muda</th>
                    <th className="py-2.5 px-3">Aina</th>
                    <th className="py-2.5 px-3">Mpokeaji</th>
                    <th className="py-2.5 px-3">Simu</th>
                    <th className="py-2.5 px-3">Hali</th>
                    <th className="py-2.5 px-3">Ujumbe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {messageLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {new Date(log.sentAt).toLocaleString('sw-TZ')}
                      </td>
                      <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-emerald-400">
                        {log.type}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">
                        {log.recipientName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {log.recipientPhone}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'delivered' ? 'bg-emerald-500/15 text-emerald-400' :
                          log.status === 'sent' ? 'bg-blue-500/15 text-blue-400' :
                          log.status === 'simulated' ? 'bg-amber-500/15 text-amber-400' :
                          'bg-rose-500/15 text-rose-400'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate" title={log.message}>
                        {log.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
