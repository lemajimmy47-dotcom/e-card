import { UwalemiState, UwalemiMember, UwalemiGroupSettings, UwalemiMemberRole } from '../types/uwalemi';

export const UWALEMI_ROLE_PRIORITY: Record<string, number> = {
  'Mwenyekiti': 1,
  'Makamu Mwenyekiti': 2,
  'Katibu': 3,
  'Katibu Msaidizi': 4,
  'Mweka Hazina': 5,
  'Mweka Hazina Msaidizi': 6,
  'Mlezi': 7,
  'Mjumbe': 8
};

export function sortMembersByLeadership(members: UwalemiMember[]): UwalemiMember[] {
  if (!Array.isArray(members)) return [];
  return [...members].sort((a, b) => {
    const roleA = a.role || 'Mjumbe';
    const roleB = b.role || 'Mjumbe';
    const rankA = UWALEMI_ROLE_PRIORITY[roleA] ?? 99;
    const rankB = UWALEMI_ROLE_PRIORITY[roleB] ?? 99;
    
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    
    // If same role, sort by member number e.g. UWL-001, UWL-002
    const numA = a.memberNo || '';
    const numB = b.memberNo || '';
    return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function getMemberLocationGroup(member: { residence?: string; locationGroup?: 'Dar es Salaam' | 'Mkoani' }): 'Dar es Salaam' | 'Mkoani' {
  if (member.locationGroup === 'Mkoani' || member.locationGroup === 'Dar es Salaam') {
    return member.locationGroup;
  }
  const res = (member.residence || '').toLowerCase().trim();
  if (!res) return 'Dar es Salaam';

  const mkoaniKeywords = [
    'mkoan', 'arusha', 'moshi', 'mwanza', 'dodoma', 'tanga', 'morogoro', 'mbeya',
    'kilimanjaro', 'iringa', 'tabora', 'kigoma', 'singida', 'mara', 'musoma',
    'shinyanga', 'ruvuma', 'songea', 'kagera', 'bukoba', 'mtwara', 'lindi',
    'geita', 'katavi', 'mpanda', 'njombe', 'songwe', 'vwawa', 'pemba', 'unguja',
    'zanzibar', 'manyara', 'babati', 'simiyu', 'bariadi', 'rombo', 'hai', 'siha',
    'same', 'mwanga', 'korogwe', 'lushoto', 'muheza', 'handeni', 'pangani', 'bagamoyo',
    'chalinze', 'kibaha', 'pwani', 'rufiji', 'kisarawe', 'mafia', 'upcountry'
  ];

  if (mkoaniKeywords.some(kw => res.includes(kw))) {
    return 'Mkoani';
  }
  return 'Dar es Salaam';
}

export const INITIAL_UWALEMI_SETTINGS: UwalemiGroupSettings = {
  groupName: 'UWALEMI',
  slogan: 'Lema, Nguvu Moja.',
  registrationFeeDefault: 0,
  monthlyFeeDefault: 0,
  emergencyFeeDefault: 0,
  meetingFineDefault: 10000,
  meetingFineLateDefault: 2000,
  paymentMethods: [
    {
      id: 'pm-1',
      provider: 'M-Koba / Vodacom M-Pesa',
      type: 'Mobile',
      number: '0758 219 298',
      accountName: 'Eva Lema (M-Koba)'
    },
    {
      id: 'pm-2',
      provider: 'CRDB Bank',
      type: 'Bank',
      number: '0152435678900',
      accountName: 'UWALEMI SOCIAL WELFARE'
    }
  ],
  smsConfig: {
    provider: 'simulation',
    apiKey: '',
    secretKey: '',
    senderId: 'UWALEMI',
    autoSendReceipts: true,
    autoSendMeetingAlerts: true,
    autoSendMonthlyReminder: true
  },
  constitutionSummary: 'Kikundi cha kijamii cha UWALEMI kilichoanzishwa kwa ajili ya kuimarisha mshikamano, kusaidiana wakati wa misiba, maradhi, na kusherehekea pamoja wakati wa heri. Kila mwanachama anawajibika kutoa michango na kushiriki vikao vyote kwa uaminifu.',
  createdDate: '2023-01-01'
};

// Generate clean empty members list by default (no hardcoded members)
export function generateInitialMembers(): UwalemiMember[] {
  return [];
}

export const INITIAL_UWALEMI_STATE: UwalemiState & { initialized: boolean } = {
  initialized: true,
  groupSettings: INITIAL_UWALEMI_SETTINGS,
  members: [],
  monthlyPayments: [],
  emergencyFunds: [],
  expenses: [],
  meetings: [],
  finePayments: [],
  messageLogs: [],
  lastUpdated: new Date().toISOString()
};

const LOCAL_STORAGE_KEY = 'uwalemi_standalone_state_v1';

export async function fetchUwalemiState(): Promise<UwalemiState> {
  const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
  let localState: (UwalemiState & { initialized?: boolean }) | null = null;
  if (cached) {
    try {
      localState = JSON.parse(cached);
    } catch (e) {}
  }

  const sanitizeState = (s: UwalemiState): UwalemiState => {
    if (!s.finePayments) {
      s.finePayments = [];
    }
    if (s.groupSettings) {
      if (!s.groupSettings.slogan || s.groupSettings.slogan.includes('Shida na Raha')) {
        s.groupSettings.slogan = 'Lema, Nguvu Moja.';
      }
      if (!s.groupSettings.meetingFineDefault || s.groupSettings.meetingFineDefault === 5000 || s.groupSettings.meetingFineDefault === 0) {
        s.groupSettings.meetingFineDefault = 10000;
      }
      if (!s.groupSettings.meetingFineLateDefault || s.groupSettings.meetingFineLateDefault === 0) {
        s.groupSettings.meetingFineLateDefault = 2000;
      }
    } else {
      s.groupSettings = { ...INITIAL_UWALEMI_SETTINGS };
    }

    // Automatically upgrade any existing meeting records that were recorded with old default 5,000 TZS
    if (Array.isArray(s.meetings)) {
      s.meetings = s.meetings.map(m => ({
        ...m,
        attendees: (m.attendees || []).map(a => {
          if (a.status === 'absent' && (!a.fineAmount || a.fineAmount === 5000 || a.fineAmount === 0)) {
            return { ...a, fineAmount: 10000 };
          }
          if (a.status === 'late' && (!a.fineAmount || a.fineAmount === 5000 || a.fineAmount === 0)) {
            return { ...a, fineAmount: 2000 };
          }
          return a;
        })
      }));
    }

    // Do NOT override member fee amounts or registration fees automatically.
    // Preserve manual entries exactly as set by the user.
    return s;
  };

  try {
    const res = await fetch('/api/uwalemi/state');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && data.initialized !== false && Array.isArray(data.members)) {
        const cleanData = sanitizeState(data);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanData));
        return cleanData;
      } else if (localState && Array.isArray(localState.members)) {
        // If server had no initialized state yet but local has state, preserve and sync local to server
        const cleanLocal = sanitizeState(localState);
        saveUwalemiState(cleanLocal);
        return cleanLocal;
      }
    }
  } catch (err) {
    console.warn('[UwalemiService] Server state fetch fallback to local:', err);
  }

  if (localState) {
    return sanitizeState(localState);
  }

  return INITIAL_UWALEMI_STATE;
}

export async function saveUwalemiState(state: UwalemiState): Promise<boolean> {
  const updatedState = { ...state, initialized: true, lastUpdated: new Date().toISOString() };
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedState));

  try {
    const res = await fetch('/api/uwalemi/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedState)
    });
    return res.ok;
  } catch (err) {
    console.error('[UwalemiService] Error saving state to server:', err);
    return false;
  }
}

export const MONTH_NAMES_SW = [
  'Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni',
  'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'
];

export const MONTH_NAMES_SW_SHORT = [
  'Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'
];

export interface UwalemiMemberFeeDebtInfo {
  memberId: string;
  memberNo: string;
  memberName: string;
  phone: string;
  role: string;
  status: string;
  monthlyFee: number;
  feeDebt: number; // Pure monthly fee debt
  lateFeePenalty: number; // 5,000 TZS per month exceeding 3 months of arrears
  penaltyMonthsCount: number; // Number of months exceeding 3
  otherFinesDebt: number; // Meeting or other group fines
  otherFinesPaid: number;
  totalFinesDebt: number; // lateFeePenalty + otherFinesDebt
  totalDebt: number; // feeDebt + totalFinesDebt
  unpaidCount: number; // total unpaid monthly fees
  startYear?: number;
  startMonth?: number;
  startMonthName: string;
  endYear?: number;
  endMonth?: number;
  endMonthName: string;
  unpaidMonthsList: string[];
  unpaidMonthsText: string;
  periodSummary: string;
  breakdown: {
    year: number;
    month: number;
    monthName: string;
    expected: number;
    paid: number;
    debt: number;
  }[];
}

/**
 * Calculates default/expected monthly fee for a given year and month.
 * Rule: Nov 2023 up to May 2026 = TZS 15,000.
 * June 2026 onwards = TZS 20,000.
 */
export function getDefaultFeeForMonth(year: number, month: number, memberFeeAmount?: number): number {
  if (memberFeeAmount && memberFeeAmount !== 10000 && memberFeeAmount !== 15000 && memberFeeAmount !== 20000 && memberFeeAmount > 0) {
    return memberFeeAmount;
  }
  if (year > 2026 || (year === 2026 && month >= 6)) {
    return 20000;
  }
  return 15000;
}

/**
 * Calculates late fee penalty for monthly fee debt.
 * Rule: If unpaid months <= 3, penalty is 0 (grace period).
 * If unpaid months > 3, penalty is (unpaid months - 3) * 5,000 TZS.
 */
export function calculateLateFeePenalty(unpaidMonthsCount: number): { penalty: number; penaltyMonths: number } {
  if (unpaidMonthsCount <= 3) {
    return { penalty: 0, penaltyMonths: 0 };
  }
  const penaltyMonths = unpaidMonthsCount - 3;
  return { penalty: penaltyMonths * 5000, penaltyMonths };
}

/**
 * Calculates other fines (e.g. meeting absence fines) for a specific member.
 */
export function calculateMemberOtherFines(
  memberId: string,
  state: UwalemiState
): { finesPaid: number; finesDebt: number; finesList: { meetingTitle: string; date: string; amount: number; paid: boolean }[] } {
  let finesPaid = 0;
  let finesDebt = 0;
  const finesList: { meetingTitle: string; date: string; amount: number; paid: boolean }[] = [];

  const member = (state.members || []).find(m => m.id === memberId || m.memberNo === memberId);
  const targetMemberId = member?.id || memberId;
  const targetMemberNo = member?.memberNo || memberId;

  const defaultAbsentFine = state.groupSettings?.meetingFineDefault || 10000;
  const defaultLateFine = state.groupSettings?.meetingFineLateDefault || 2000;

  (state.meetings || []).forEach(mtg => {
    const att = (mtg.attendees || []).find(a =>
      (a.memberId && a.memberId === targetMemberId) ||
      (a.memberNo && a.memberNo === targetMemberNo) ||
      (a.memberId && a.memberId === targetMemberNo)
    );

    if (att) {
      let amt = Number(att.fineAmount) || 0;
      if (amt === 0) {
        if (att.status === 'absent') amt = defaultAbsentFine;
        else if (att.status === 'late') amt = defaultLateFine;
      }

      if (amt > 0) {
        if (att.finePaid) {
          finesPaid += amt;
        } else {
          finesDebt += amt;
        }
        finesList.push({
          meetingTitle: mtg.title || 'Kikao',
          date: mtg.date,
          amount: amt,
          paid: !!att.finePaid
        });
      }
    }
  });

  return { finesPaid, finesDebt, finesList };
}

/**
 * Calculates the exact fee debt and penalties for a specific member from the group's inception (Nov 2023) up to the current active month.
 */
export function calculateMemberFeeDebt(
  member: UwalemiMember,
  state: UwalemiState,
  targetYear?: number,
  targetMonth?: number
): UwalemiMemberFeeDebtInfo {
  const now = new Date();
  const endYear = targetYear || now.getFullYear();
  const endMonth = targetMonth || (now.getMonth() + 1);

  const groupStartYear = 2023;
  const groupStartMonth = 11; // November 2023

  const payments = state.monthlyPayments || [];
  const unpaidItems: {
    year: number;
    month: number;
    monthName: string;
    expected: number;
    paid: number;
    debt: number;
  }[] = [];

  let feeDebt = 0;

  for (let y = groupStartYear; y <= endYear; y++) {
    const startM = y === groupStartYear ? groupStartMonth : 1;
    const endM = y === endYear ? endMonth : 12;

    for (let m = startM; m <= endM; m++) {
      const p = payments.find(pay => pay.memberId === member.id && pay.year === y && pay.month === m);
      const paidAmount = p ? (Number(p.paidAmount) || 0) : 0;
      const expectedAmount = getDefaultFeeForMonth(y, m, member.monthlyFeeAmount);
      const debt = Math.max(0, expectedAmount - paidAmount);

      if (debt > 0) {
        feeDebt += debt;
        unpaidItems.push({
          year: y,
          month: m,
          monthName: `${MONTH_NAMES_SW_SHORT[m - 1]} ${y}`,
          expected: expectedAmount,
          paid: paidAmount,
          debt
        });
      }
    }
  }

  const unpaidCount = unpaidItems.length;
  const { penalty: lateFeePenalty, penaltyMonths: penaltyMonthsCount } = calculateLateFeePenalty(unpaidCount);
  const { finesPaid: otherFinesPaid, finesDebt: otherFinesDebt } = calculateMemberOtherFines(member.id, state);
  const totalFinesDebt = lateFeePenalty + otherFinesDebt;
  const totalDebt = feeDebt + totalFinesDebt;

  let startMonthName = '';
  let endMonthName = '';
  let periodSummary = 'Hakuna deni la ada';
  let unpaidMonthsText = 'Hakuna';

  if (unpaidCount === 1) {
    const single = unpaidItems[0];
    startMonthName = `${MONTH_NAMES_SW[single.month - 1]} ${single.year}`;
    endMonthName = startMonthName;
    unpaidMonthsText = `${single.monthName}: TZS ${single.debt.toLocaleString()}`;
    periodSummary = `mwezi wa ${startMonthName}`;
  } else if (unpaidCount > 1) {
    const first = unpaidItems[0];
    const last = unpaidItems[unpaidCount - 1];
    startMonthName = `${MONTH_NAMES_SW[first.month - 1]} ${first.year}`;
    endMonthName = `${MONTH_NAMES_SW[last.month - 1]} ${last.year}`;
    unpaidMonthsText = unpaidItems.map(item => `${item.monthName}: TZS ${item.debt.toLocaleString()}`).join(', ');
    periodSummary = `kuanzia ${startMonthName} hadi ${endMonthName} (miezi ${unpaidCount})`;
  }

  return {
    memberId: member.id,
    memberNo: member.memberNo || '',
    memberName: member.fullName || 'Mjumbe',
    phone: member.phone || '',
    role: member.role || 'Mjumbe',
    status: member.status || 'active',
    monthlyFee: getDefaultFeeForMonth(endYear, endMonth, member.monthlyFeeAmount),
    feeDebt,
    lateFeePenalty,
    penaltyMonthsCount,
    otherFinesDebt,
    otherFinesPaid,
    totalFinesDebt,
    totalDebt,
    unpaidCount,
    startYear: unpaidItems[0]?.year,
    startMonth: unpaidItems[0]?.month,
    startMonthName,
    endYear: unpaidItems[unpaidCount - 1]?.year,
    endMonth: unpaidItems[unpaidCount - 1]?.month,
    endMonthName,
    unpaidMonthsList: unpaidItems.map(item => item.monthName),
    unpaidMonthsText,
    periodSummary,
    breakdown: unpaidItems
  };
}

/**
 * Calculates fee debts for all active members.
 */
export function calculateAllMembersFeeDebts(
  state: UwalemiState,
  targetYear?: number,
  targetMonth?: number
): UwalemiMemberFeeDebtInfo[] {
  const members = sortMembersByLeadership(state.members || []);
  return members
    .filter(m => m.status === 'active')
    .map(m => calculateMemberFeeDebt(m, state, targetYear, targetMonth));
}

export function getSwahiliDayAndDate(dateStr?: string): { dayName: string; formattedDate: string } {
  if (!dateStr) return { dayName: 'Jumapili', formattedDate: '' };
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const swahiliDays = ['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'];
      const swahiliMonths = [
        'Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni',
        'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'
      ];
      const dayName = !isNaN(d.getDay()) ? swahiliDays[d.getDay()] : 'Jumapili';
      const formattedDate = `${day} ${swahiliMonths[month]} ${year}`;
      return { dayName, formattedDate };
    }
    return { dayName: 'Jumapili', formattedDate: dateStr };
  } catch {
    return { dayName: 'Jumapili', formattedDate: dateStr || '' };
  }
}

/**
 * Replaces dynamic variables in a template message for a specific member.
 */
export function formatPersonalizedUwalemiSms(
  template: string,
  debtInfo: UwalemiMemberFeeDebtInfo
): string {
  const formattedFeeDebt = `TZS ${(debtInfo.feeDebt ?? debtInfo.totalDebt).toLocaleString()}`;
  const formattedLatePenalty = `TZS ${(debtInfo.lateFeePenalty ?? 0).toLocaleString()}`;
  const formattedOtherFines = `TZS ${(debtInfo.otherFinesDebt ?? 0).toLocaleString()}`;
  const formattedTotalFines = `TZS ${(debtInfo.totalFinesDebt ?? 0).toLocaleString()}`;
  const formattedTotalDebt = `TZS ${debtInfo.totalDebt.toLocaleString()}`;
  const penaltyMonths = debtInfo.penaltyMonthsCount ?? 0;

  const breakdownText = debtInfo.breakdown && debtInfo.breakdown.length > 0
    ? debtInfo.breakdown.map(item => `${item.monthName}: TZS ${item.debt.toLocaleString()}`).join(', ')
    : debtInfo.unpaidMonthsText;

  let finesSummaryText = '';
  if (debtInfo.totalFinesDebt > 0) {
    const parts: string[] = [];
    if (debtInfo.lateFeePenalty > 0) {
      parts.push(`Faini ya kuchelewa ada: TZS ${debtInfo.lateFeePenalty.toLocaleString()} (${penaltyMonths} ${penaltyMonths === 1 ? 'mwezi wa ziada' : 'miezi ya ziada'})`);
    }
    if (debtInfo.otherFinesDebt > 0) {
      parts.push(`Faini za vikao: TZS ${debtInfo.otherFinesDebt.toLocaleString()}`);
    }
    finesSummaryText = parts.join(', ');
  } else {
    finesSummaryText = 'Hakuna faini';
  }

  return template
    .replace(/{name}/g, debtInfo.memberName)
    .replace(/{memberNo}/g, debtInfo.memberNo)
    .replace(/{phone}/g, debtInfo.phone)
    .replace(/{role}/g, debtInfo.role)
    .replace(/{debtAmount}/g, formattedTotalDebt)
    .replace(/{feeDebt}/g, formattedFeeDebt)
    .replace(/{ada}/g, formattedFeeDebt)
    .replace(/{faini}/g, formattedTotalFines)
    .replace(/{fainiAda}/g, formattedLatePenalty)
    .replace(/{fainiVikao}/g, formattedOtherFines)
    .replace(/{fainiSummary}/g, finesSummaryText)
    .replace(/{fainiMiezi}/g, `${penaltyMonths} ${penaltyMonths === 1 ? 'mwezi' : 'miezi'}`)
    .replace(/{deni}/g, formattedTotalDebt)
    .replace(/{jumlaKuu}/g, formattedTotalDebt)
    .replace(/{startMonth}/g, debtInfo.startMonthName || 'Mwezi huu')
    .replace(/{kuanzia}/g, debtInfo.startMonthName || 'Mwezi huu')
    .replace(/{endMonth}/g, debtInfo.endMonthName || 'Mwezi huu')
    .replace(/{hadi}/g, debtInfo.endMonthName || 'Mwezi huu')
    .replace(/{unpaidMonths}/g, debtInfo.unpaidMonthsText)
    .replace(/{miezi}/g, debtInfo.unpaidMonthsText)
    .replace(/{mchanganuo}/g, breakdownText)
    .replace(/{breakdown}/g, breakdownText)
    .replace(/{monthsCount}/g, String(debtInfo.unpaidCount))
    .replace(/{idadi_ya_miezi}/g, `${debtInfo.unpaidCount} miezi`)
    .replace(/{periodSummary}/g, debtInfo.periodSummary)
    .replace(/{monthlyFee}/g, `TZS ${debtInfo.monthlyFee.toLocaleString()}`)
    .replace(/{lipaNamba}/g, 'M-Koba au 0758 219 298 Eva Lema')
    .replace(/{lipaNumber}/g, 'M-Koba au 0758 219 298 Eva Lema');
}

export async function sendUwalemiSms(payload: {
  recipients: {
    name: string;
    phone: string;
    memberNo?: string;
    memberId?: string;
    debtAmount?: number;
    feeDebt?: number;
    lateFeePenalty?: number;
    otherFinesDebt?: number;
    totalFinesDebt?: number;
    startMonth?: string;
    endMonth?: string;
    unpaidMonths?: string;
    periodSummary?: string;
    monthsCount?: number;
    customMessage?: string;
  }[];
  message: string;
  messageType: 'receipt' | 'reminder' | 'emergency' | 'meeting' | 'broadcast';
}): Promise<{ success: boolean; deliveredCount: number; message: string }> {
  try {
    const res = await fetch('/api/uwalemi/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json();
    return { success: false, deliveredCount: 0, message: err.error || 'Imeshindwa kutuma SMS' };
  } catch (e: any) {
    return { success: false, deliveredCount: 0, message: e.message || 'Hitilafu ya mtandao' };
  }
}

/**
 * Utumaji wa stakabadhi kiotomatiki mara tu ada au mchango unaporekodiwa.
 * Hukagua kama autoSendReceipts imewashwa kwenye Mipangilio ya SMS.
 * Inasaidia stakabadhi za miezi mingi na malipo ya sehemu (partial payment).
 */
export async function triggerAutoReceiptSms(params: {
  state: UwalemiState;
  member: { id?: string; memberNo?: string; fullName?: string; phone?: string };
  paymentType: 'ada' | 'emergency' | 'fine';
  amount: number;
  purpose: string;
  receiptNo: string;
  paymentDate?: string;
  paymentMethod?: string;
  isPartial?: boolean;
  expectedAmount?: number;
  monthBalance?: number;
  monthsCovered?: string[];
  multiMonthBreakdown?: {
    monthName: string;
    year: number;
    paid: number;
    expected: number;
    isPartial: boolean;
    balance: number;
  }[];
  totalDebtAfter?: number;
  customMessage?: string;
}): Promise<{ triggered: boolean; success: boolean; message: string }> {
  const autoSend = params.state.groupSettings?.smsConfig?.autoSendReceipts;
  if (!autoSend) {
    return { triggered: false, success: false, message: 'Utumaji wa stakabadhi kiotomatiki umezimwa kwenye mipangilio.' };
  }

  const phone = (params.member.phone || '').trim();
  if (!phone) {
    return { triggered: false, success: false, message: `Mwanachama ${params.member.fullName || ''} hana namba ya simu ya kutumiwa stakabadhi.` };
  }

  const dateStr = params.paymentDate || new Date().toISOString().split('T')[0];
  
  let customMessage = params.customMessage;

  if (!customMessage) {
    const memberName = params.member.fullName || 'Mwanachama';
    const amountStr = `TZS ${params.amount.toLocaleString()}`;
    
    // Compute remaining fee debt details and specific unpaid months
    let debtMonthsDetail = '';
    let totalDebtVal = typeof params.totalDebtAfter === 'number' ? params.totalDebtAfter : undefined;

    if (params.state && params.member) {
      const fullMember = (params.state.members || []).find(
        m => m.id === params.member.id || (params.member.memberNo && m.memberNo === params.member.memberNo)
      ) || (params.member as UwalemiMember);

      if (fullMember && fullMember.id) {
        const debtInfo = calculateMemberFeeDebt(fullMember, params.state);
        if (totalDebtVal === undefined) {
          totalDebtVal = debtInfo.totalDebt;
        }

        if (totalDebtVal > 0 && debtInfo.breakdown && debtInfo.breakdown.length > 0) {
          if (debtInfo.breakdown.length === 1) {
            const single = debtInfo.breakdown[0];
            const mName = `${MONTH_NAMES_SW[single.month - 1]} ${single.year}`;
            if (single.paid > 0) {
              debtMonthsDetail = ` (${mName}: Salio TZS ${single.debt.toLocaleString()})`;
            } else {
              debtMonthsDetail = ` (Mwezi wa ${mName})`;
            }
          } else if (debtInfo.breakdown.length <= 4) {
            const itemsStr = debtInfo.breakdown.map(item => {
              const mName = `${MONTH_NAMES_SW[item.month - 1]} ${item.year}`;
              if (item.paid > 0) {
                return `${mName}: Salio TZS ${item.debt.toLocaleString()}`;
              }
              return `${mName}: TZS ${item.debt.toLocaleString()}`;
            }).join(', ');
            debtMonthsDetail = ` (${itemsStr})`;
          } else {
            const first = debtInfo.breakdown[0];
            const last = debtInfo.breakdown[debtInfo.breakdown.length - 1];
            const firstName = `${MONTH_NAMES_SW[first.month - 1]} ${first.year}`;
            const lastName = `${MONTH_NAMES_SW[last.month - 1]} ${last.year}`;
            debtMonthsDetail = ` (Miezi ${debtInfo.breakdown.length}: ${firstName} hadi ${lastName})`;
          }
        }
      }
    }

    let debtStr: string | undefined = undefined;
    if (typeof totalDebtVal === 'number') {
      if (totalDebtVal > 0) {
        debtStr = `TZS ${totalDebtVal.toLocaleString()}${debtMonthsDetail}`;
      } else {
        debtStr = 'TZS 0 (Umekamilisha Ada zote)';
      }
    }

    if (params.paymentType === 'ada') {
      if (params.multiMonthBreakdown && params.multiMonthBreakdown.length > 1) {
        // Multi-Month payment message (No non-ASCII bullets or checkmarks, No Njia)
        const monthsList = params.multiMonthBreakdown.map(m => {
          if (m.isPartial) {
            return `- ${m.monthName} ${m.year}: TZS ${m.paid.toLocaleString()} (Nusu, salio TZS ${m.balance.toLocaleString()})`;
          }
          return `- ${m.monthName} ${m.year}: TZS ${m.paid.toLocaleString()} (Kamili)`;
        }).join('\n');

        customMessage = `STAKABADHI YA MALIPO YA ADA - UWALEMI
Habari ${memberName}, tumepokea malipo yako ya ${amountStr} ya Ada ya Miezi (${params.multiMonthBreakdown.length}):
${monthsList}

Risiti: ${params.receiptNo}
Tarehe: ${dateStr}${debtStr ? `\nSalio la Deni Lililobaki: ${debtStr}` : ''}

Asante kwa kutimiza wajibu wako.
Lema, Nguvu Moja!`;
      } else if (params.isPartial) {
        // Single Partial Payment message (No bullets, No checkmarks, No Njia)
        const expStr = params.expectedAmount ? `TZS ${params.expectedAmount.toLocaleString()}` : '';
        const balStr = params.monthBalance ? `TZS ${params.monthBalance.toLocaleString()}` : '';
        customMessage = `STAKABADHI YA MALIPO YA NUSU - UWALEMI
Habari ${memberName}, tumepokea malipo yako ya ${amountStr} kwa ajili ya ${params.purpose}.
Kiasi Kilicholipwa: ${amountStr}
${expStr ? `Ada Inayotakiwa: ${expStr}\n` : ''}${balStr ? `Salio Linalobaki la Mwezi: ${balStr}\n` : ''}${debtStr ? `Salio la Deni Lililobaki: ${debtStr}\n` : ''}Risiti: ${params.receiptNo}
Tarehe: ${dateStr}

Asante kwa kuendelea kulipia ada yako.
Lema, Nguvu Moja!`;
      } else {
        // Standard Full Payment message (No Njia)
        customMessage = `STAKABADHI YA MALIPO YA ADA - UWALEMI
Habari ${memberName}, tumepokea malipo yako ya ${amountStr} kwa ajili ya ${params.purpose}.
Risiti: ${params.receiptNo}
Tarehe: ${dateStr}${debtStr ? `\nSalio la Deni Lililobaki: ${debtStr}` : ''}

Asante kwa kutimiza wajibu wako kwa UWALEMI.
Lema, Nguvu Moja!`;
      }
    } else {
      // Emergency fund or fines (No Njia)
      customMessage = `STAKABADHI YA MALIPO - UWALEMI
Habari ${memberName}, tumepokea malipo yako ya ${amountStr} ya ${params.purpose}.
Risiti: ${params.receiptNo}
Tarehe: ${dateStr}

Asante kwa kutimiza wajibu wako kwa UWALEMI.
Lema, Nguvu Moja!`;
    }
  }

  const result = await sendUwalemiSms({
    recipients: [{
      name: params.member.fullName || 'Mwanachama',
      phone,
      memberNo: params.member.memberNo,
      memberId: params.member.id,
      customMessage
    }],
    message: customMessage,
    messageType: 'receipt'
  });

  return {
    triggered: true,
    success: result.success,
    message: result.message
  };
}

/**
 * Kuita mfumo wa kutuma vikumbusho vya ada ya kila mwezi (kama tarehe 25 au kuanzisha mwenyewe kwa jaribio).
 */
export async function triggerMonthlyAutoRemindersApi(forceNow = false): Promise<{
  success: boolean;
  triggered: boolean;
  deliveredCount: number;
  recipientsCount: number;
  message: string;
  list?: string[];
  lastMonthlyReminderYearMonth?: string;
  lastMonthlyReminderDate?: string;
}> {
  try {
    const res = await fetch('/api/uwalemi/trigger-monthly-reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceNow })
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json();
    return {
      success: false,
      triggered: false,
      deliveredCount: 0,
      recipientsCount: 0,
      message: err.error || 'Imeshindwa kuanzisha vikumbusho vya ada'
    };
  } catch (e: any) {
    return {
      success: false,
      triggered: false,
      deliveredCount: 0,
      recipientsCount: 0,
      message: e.message || 'Hitilafu ya mtandao'
    };
  }
}

