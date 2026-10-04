import { 
  UwalemiState, 
  UwalemiMember, 
  UwalemiGroupSettings, 
  UwalemiMemberRole, 
  UwalemiFinePayment,
  UwalemiElection,
  UwalemiMonthlyPayment,
  UwalemiVoterRecord,
  UwalemiElectionPosition,
  UwalemiCandidate,
  UwalemiAnonymousBallot
} from '../types/uwalemi';

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

export function normalizePaymentMethod(method?: string): string {
  if (!method) return 'M Koba';
  const trimmed = method.trim();
  if (/m-?pesa/i.test(trimmed) || /taslimu/i.test(trimmed) || /cash/i.test(trimmed)) {
    return 'M Koba';
  }
  return trimmed;
}

export const INITIAL_UWALEMI_SETTINGS: UwalemiGroupSettings = {
  groupName: 'UWALEMI',
  slogan: 'Lema, Nguvu Moja.',
  logoUrl: '/uwalemi_logo.png',
  registrationFeeDefault: 0,
  monthlyFeeDefault: 0,
  emergencyFeeDefault: 0,
  meetingFineDefault: 10000,
  meetingFineLateDefault: 2000,
  paymentMethods: [
    {
      id: 'pm-1',
      provider: 'M Koba',
      type: 'Mobile',
      number: '0758 219 298',
      accountName: 'Eva O Lema (M Koba)'
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
  accruedFines: [],
  elections: [],
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
    if (!Array.isArray(s.elections)) {
      s.elections = [];
    }
    if (!s.finePayments) {
      s.finePayments = [];
    } else {
      // Remove any known duplicate or corrupted fine payment IDs
      s.finePayments = s.finePayments.filter(fp => fp.id !== 'fine-pay-1788768387595');
      // Deduplicate fine payments with identical receipt numbers or IDs
      const seen = new Set<string>();
      s.finePayments = s.finePayments.filter(fp => {
        const key = fp.id || fp.receiptNo || `${fp.memberId}-${fp.meetingId}-${fp.amount}-${fp.paymentDate}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    if (!s.accruedFines) {
      s.accruedFines = [];
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

    // Preserve accrued late fee fines so that paying Ada in matrix never wipes out incurred fines
    s = autoAccrueLateFeeFines(s);

    // Normalize any legacy M-Pesa occurrences to M Koba across all payment records
    if (s.groupSettings?.paymentMethods) {
      s.groupSettings.paymentMethods = s.groupSettings.paymentMethods.map(pm => ({
        ...pm,
        provider: normalizePaymentMethod(pm.provider),
        accountName: pm.accountName?.replace(/m-?koba/i, 'M Koba').replace(/vodacom m-?pesa/i, 'M Koba') || pm.accountName
      }));
    }
    if (Array.isArray(s.monthlyPayments)) {
      s.monthlyPayments = s.monthlyPayments.map(p => ({
        ...p,
        paymentMethod: normalizePaymentMethod(p.paymentMethod)
      }));
    }
    if (Array.isArray(s.finePayments)) {
      s.finePayments = s.finePayments.map(fp => ({
        ...fp,
        paymentMethod: normalizePaymentMethod(fp.paymentMethod)
      }));
    }
    if (Array.isArray(s.emergencyFunds)) {
      s.emergencyFunds = s.emergencyFunds.map(ef => ({
        ...ef,
        payments: (ef.payments || []).map(p => ({
          ...p,
          paymentMethod: normalizePaymentMethod(p.paymentMethod)
        }))
      }));
    }
    if (Array.isArray(s.expenses)) {
      s.expenses = s.expenses.map(e => ({
        ...e,
        paymentMethod: normalizePaymentMethod(e.paymentMethod)
      }));
    }

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

export function autoAccrueLateFeeFines(s: UwalemiState, activeUntickedMonth?: { year: number; month: number }): UwalemiState {
  if (!s || !Array.isArray(s.members) || s.members.length === 0) {
    return s;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const accruedFines = Array.isArray(s.accruedFines) ? [...s.accruedFines] : [];
  let changed = false;

  s.members.forEach(member => {
    const isJimson = member.suppressLateFeePenalty || 
      member.memberNo === 'UWL-001' || 
      (member.fullName && member.fullName.toLowerCase().includes('jimson')) ||
      member.id === 'uwl-mem-1787293910280-307';

    if (isJimson) {
      let existingIdx;
      while ((existingIdx = accruedFines.findIndex(
        af => (af.memberId === member.id || (member.memberNo && af.memberNo === member.memberNo)) && af.fineType === 'ada_late_fee'
      )) >= 0) {
        accruedFines.splice(existingIdx, 1);
        changed = true;
      }
      return;
    }

    const payments = s.monthlyPayments || [];
    let unpaidFromJuneCount = 0;

    // Faini ya ada inapaswa kutozwa kwa miezi iliyokwishapita au iliyofika pekee (hadi currentMonth).
    // Miezi ya mbeleni (kama Oktoba, Novemba, Desemba) haiwezi kutozwa faini kabla haijafika.
    for (let y = 2026; y <= currentYear; y++) {
      const startM = y === 2026 ? 6 : 1;
      const endM = y < currentYear ? 12 : currentMonth;

      for (let m = startM; m <= endM; m++) {
        const p = payments.find(pay => 
          (pay.memberId === member.id || (member.memberNo && pay.memberNo === member.memberNo)) &&
          Number(pay.year) === y &&
          Number(pay.month) === m
        );
        const paidAmount = p ? (Number(p.paidAmount) || 0) : 0;
        const expectedAmount = getDefaultFeeForMonth(y, m, member.monthlyFeeAmount);
        if (expectedAmount - paidAmount > 0) {
          unpaidFromJuneCount++;
        }
      }
    }

    const { penalty: calculatedPenalty } = calculateLateFeePenalty(unpaidFromJuneCount);

    const existingIdx = accruedFines.findIndex(
      af => (af.memberId === member.id || (member.memberNo && af.memberNo === member.memberNo)) && af.fineType === 'ada_late_fee'
    );

    if (calculatedPenalty > 0) {
      const fineReason = `Faini ya Kuchelewa Ada (>Miezi 3 kuanzia Juni 2026 - Miezi ${unpaidFromJuneCount})`;

      if (existingIdx >= 0) {
        const ex = accruedFines[existingIdx];
        // KANUNI KUU: Faini haipungui wala kuondoka hata mwanachama akilipa ada zote!
        // Faini inaweza tu kuongezeka ikiwa ataongeza miezi ya uchelewaji.
        const targetAmt = Math.max(Number(ex.amount) || 0, calculatedPenalty);
        if (ex.amount !== targetAmt || (targetAmt === calculatedPenalty && ex.reason !== fineReason)) {
          accruedFines[existingIdx] = {
            ...ex,
            amount: targetAmt,
            reason: targetAmt > calculatedPenalty ? ex.reason : fineReason,
            status: (ex.paidAmount || 0) >= targetAmt ? 'paid' : (ex.paidAmount || 0) > 0 ? 'partial' : 'unpaid'
          };
          changed = true;
        }
      } else {
        accruedFines.push({
          id: `accrued-fine-${member.id}-auto`,
          memberId: member.id,
          memberNo: member.memberNo,
          memberName: member.fullName,
          fineType: 'ada_late_fee',
          reason: fineReason,
          amount: calculatedPenalty,
          assessedDate: new Date().toISOString().split('T')[0],
          status: 'unpaid',
          paidAmount: 0
        });
        changed = true;
      }
    }
    // TANBIHI: Hatuondoi (splice) faini iliyopo hata kama calculatedPenalty iko 0 (kwa sababu mwanachama amelipa ada).
    // Faini itaendelea kubaki kama deni thabiti hadi pale malipo ya faini (finePayments) yatakaporekodiwa!
  });

  if (changed || !s.accruedFines) {
    return {
      ...s,
      accruedFines
    };
  }

  return s;
}

export async function saveUwalemiState(state: UwalemiState): Promise<boolean> {
  const reconciledState = autoAccrueLateFeeFines(state);
  const updatedState = { ...reconciledState, initialized: true, lastUpdated: new Date().toISOString() };
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
  lateFeePenalty: number; // 5,000 TZS per month exceeding 3 months of arrears starting from Month 6 (June 2026)
  penaltyMonthsCount: number; // Number of months exceeding 3 starting from Month 6 (June 2026)
  unpaidFromJuneCount: number; // Total unpaid months on or after Month 6 (June 2026)
  otherFinesDebt: number; // Meeting or other group fines
  otherFinesPaid: number;
  meetingLateDebt?: number;
  meetingLatePaid?: number;
  meetingAbsentDebt?: number;
  meetingAbsentPaid?: number;
  totalFinesDebt: number; // lateFeePenalty + otherFinesDebt
  totalDebt: number; // feeDebt + totalFinesDebt
  unpaidCount: number; // total unpaid monthly fees across all time
  startYear?: number;
  startMonth?: number;
  startMonthName: string;
  endYear?: number;
  endMonth?: number;
  endMonthName: string;
  unpaidMonthsList: string[];
  unpaidMonthsText: string;
  periodSummary: string;
  meetingFinesText?: string;
  meetingFinesDatesText?: string;
  meetingFinesTitlesText?: string;
  meetingFinesList?: { id?: string; meetingId?: string; meetingTitle: string; date: string; amount: number; paid: boolean; reason: string; status: 'absent' | 'late' | 'other' }[];
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
 * Kanuni ya Kikundi: Faini ya ada inaanza rasmi kuhesabiwa kuanzia Mwezi wa 6 (Juni 2026).
 * Mwanachama anayedaiwa zaidi ya miezi 3 kuanzia mwezi huo wa 6 (Juni 2026) na kuendelea
 * hutozwa faini ya TZS 5,000 kwa kila mwezi unaozidi miezi 3 ya kwanza.
 * (Ikiwa inadaiwa miezi <= 3 kuanzia mwezi wa 6, faini ni TZS 0).
 */
export function calculateLateFeePenalty(unpaidMonthsFromJuneCount: number): { penalty: number; penaltyMonths: number } {
  if (unpaidMonthsFromJuneCount <= 3) {
    return { penalty: 0, penaltyMonths: 0 };
  }
  const penaltyMonths = unpaidMonthsFromJuneCount - 3;
  return { penalty: penaltyMonths * 5000, penaltyMonths };
}

/**
 * Calculates other fines (e.g. meeting absence fines, late arrival fines, and constitutional fines) for a specific member.
 * Reconciles meeting attendee statuses with fine payment receipts and accrued fines.
 */
export function calculateMemberOtherFines(
  memberId: string,
  state: UwalemiState
): {
  finesPaid: number;
  finesDebt: number;
  meetingLateDebt: number;
  meetingLatePaid: number;
  meetingAbsentDebt: number;
  meetingAbsentPaid: number;
  otherDebt: number;
  otherPaid: number;
  finesList: { id?: string; meetingId?: string; meetingTitle: string; date: string; amount: number; paid: boolean; reason: string; status: 'absent' | 'late' | 'other' }[];
  unpaidFinesSummary: string;
  unpaidDatesSummary: string;
  unpaidTitlesSummary: string;
} {
  const member = (state.members || []).find(m => m.id === memberId || m.memberNo === memberId);
  const targetMemberId = member?.id || memberId;
  const targetMemberNo = member?.memberNo || memberId;

  const defaultAbsentFine = state.groupSettings?.meetingFineDefault || 10000;
  const defaultLateFine = state.groupSettings?.meetingFineLateDefault || 2000;

  // 1. Gather all fine payments for this member from finePayments receipts
  const memberFinePayments = (state.finePayments || []).filter(fp =>
    (fp.memberId === targetMemberId || (targetMemberNo && fp.memberNo === targetMemberNo))
  );

  let receiptsMeetingLatePaid = 0;
  let receiptsMeetingAbsentPaid = 0;
  let receiptsOtherPaid = 0;

  memberFinePayments.forEach(fp => {
    const decomp = decomposeFinePaymentAmounts(fp, state);
    receiptsMeetingLatePaid += decomp.meetingLate;
    receiptsMeetingAbsentPaid += decomp.meetingAbsent;
    receiptsOtherPaid += decomp.other;
  });

  const finesList: { id?: string; meetingId?: string; meetingTitle: string; date: string; amount: number; paid: boolean; reason: string; status: 'absent' | 'late' | 'other' }[] = [];

  let attendeeLateAssessed = 0;
  let attendeeLateExplicitPaid = 0;
  let attendeeAbsentAssessed = 0;
  let attendeeAbsentExplicitPaid = 0;

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
        const isLate = att.status === 'late';
        if (isLate) {
          attendeeLateAssessed += amt;
          if (att.finePaid) attendeeLateExplicitPaid += amt;
        } else {
          attendeeAbsentAssessed += amt;
          if (att.finePaid) attendeeAbsentExplicitPaid += amt;
        }

        // Check if explicitly paid via meetingId in finePayments or finePaid flag
        const hasMatchingReceipt = memberFinePayments.some(fp => fp.meetingId === mtg.id);
        const isPaid = !!att.finePaid || hasMatchingReceipt;

        const reason = att.fineReason || (isLate ? 'Kuchelewa kikao' : 'Kutohudhuria kikao');
        finesList.push({
          id: `mtg-fine-${mtg.id}-${targetMemberId}`,
          meetingId: mtg.id,
          meetingTitle: mtg.title || 'Kikao',
          date: mtg.date,
          amount: amt,
          paid: isPaid,
          reason,
          status: isLate ? 'late' : 'absent'
        });
      }
    }
  });

  // Reconcile total paid amounts: Max of explicit attendee toggles vs receipt totals
  const totalMeetingLatePaid = Math.max(attendeeLateExplicitPaid, receiptsMeetingLatePaid);
  const totalMeetingLateDebt = Math.max(0, attendeeLateAssessed - totalMeetingLatePaid);

  const totalMeetingAbsentPaid = Math.max(attendeeAbsentExplicitPaid, receiptsMeetingAbsentPaid);
  const totalMeetingAbsentDebt = Math.max(0, attendeeAbsentAssessed - totalMeetingAbsentPaid);

  // General accrued fines (non-ada, non-meeting)
  let otherAssessed = 0;
  let otherPaidExplicit = 0;
  (state.accruedFines || []).forEach(af => {
    if ((af.memberId === targetMemberId || (targetMemberNo && af.memberNo === targetMemberNo)) && af.fineType === 'nyingine') {
      const amt = Number(af.amount) || 0;
      otherAssessed += amt;
      otherPaidExplicit += (Number(af.paidAmount) || 0);
      finesList.push({
        id: af.id,
        meetingTitle: 'Adhabu ya Kikatiba',
        date: af.assessedDate || '',
        amount: amt,
        paid: af.status === 'paid' || (af.paidAmount || 0) >= amt,
        reason: af.reason || 'Faini ya Kikatiba',
        status: 'other'
      });
    }
  });

  const totalOtherPaid = Math.max(otherPaidExplicit, receiptsOtherPaid);
  const totalOtherDebt = Math.max(0, otherAssessed - totalOtherPaid);

  // Update `paid` boolean in finesList if aggregate payment covers items
  let latePaidPool = totalMeetingLatePaid;
  let absentPaidPool = totalMeetingAbsentPaid;
  finesList.forEach(item => {
    if (!item.paid) {
      if (item.status === 'late' && latePaidPool >= item.amount) {
        item.paid = true;
        latePaidPool -= item.amount;
      } else if (item.status === 'absent' && absentPaidPool >= item.amount) {
        item.paid = true;
        absentPaidPool -= item.amount;
      }
    }
  });

  const finesPaid = totalMeetingLatePaid + totalMeetingAbsentPaid + totalOtherPaid;
  const finesDebt = totalMeetingLateDebt + totalMeetingAbsentDebt + totalOtherDebt;

  const unpaidFines = finesList.filter(f => !f.paid);
  const unpaidFinesSummary = unpaidFines.map(f => {
    const reasonText = f.status === 'late' ? 'Kuchelewa' : f.status === 'absent' ? 'Kutohudhuria' : 'Faini';
    const dateText = f.date ? ` tarehe ${f.date}` : '';
    return `${reasonText} ${f.meetingTitle}${dateText} (TZS ${f.amount.toLocaleString()})`;
  }).join(', ');

  const unpaidDatesSummary = unpaidFines.map(f => f.date).filter(Boolean).join(', ');
  const unpaidTitlesSummary = unpaidFines.map(f => f.meetingTitle).filter(Boolean).join(', ');

  return {
    finesPaid,
    finesDebt,
    meetingLateDebt: totalMeetingLateDebt,
    meetingLatePaid: totalMeetingLatePaid,
    meetingAbsentDebt: totalMeetingAbsentDebt,
    meetingAbsentPaid: totalMeetingAbsentPaid,
    otherDebt: totalOtherDebt,
    otherPaid: totalOtherPaid,
    finesList,
    unpaidFinesSummary,
    unpaidDatesSummary,
    unpaidTitlesSummary
  };
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
      const p = payments.find(pay => 
        (pay.memberId === member.id || (member.memberNo && pay.memberNo === member.memberNo)) && 
        Number(pay.year) === y && 
        Number(pay.month) === m
      );
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

  // Faini ya kuchelewesha ada: Huhesabiwa kuanzia Mwezi wa 6 (Juni 2026) pekee
  // Kanuni ya Kikundi: Faini ya ada inaanza rasmi kuhesabiwa kuanzia Mwezi wa 6 (Juni 2026).
  // Mwanachama anayedaiwa zaidi ya miezi 3 kuanzia Mwezi wa 6 (Juni 2026)
  // hutozwa faini ya TZS 5,000 kwa kila mwezi unaozidi miezi 3 ya kwanza kuanzia mwezi huo wa 6.
  // MUHIMU: Faini haitozwi kwa miezi ya mbeleni ambayo bado haijafika (kama Oktoba, Novemba, Desemba).
  const currentY = now.getFullYear();
  const currentM = now.getMonth() + 1;
  const unpaidFromJuneItems = unpaidItems.filter(item => 
    ((item.year === 2026 && item.month >= 6) || item.year > 2026) &&
    (item.year < currentY || (item.year === currentY && item.month <= currentM))
  );
  const unpaidFromJuneCount = unpaidFromJuneItems.length;
  const { penalty: currentUnpaidPenalty } = calculateLateFeePenalty(unpaidFromJuneCount);

  const isJimson = member.suppressLateFeePenalty || 
    member.memberNo === 'UWL-001' || 
    (member.fullName && member.fullName.toLowerCase().includes('jimson')) ||
    member.id === 'uwl-mem-1787293910280-307';

  // Faini za ada zilizowahi kuingizwa au kujilimbikiza kwenye accruedFines za mwanachama huyu
  const accruedLateFines = isJimson ? 0 : (state.accruedFines || [])
    .filter(af => (af.memberId === member.id || (member.memberNo && af.memberNo === member.memberNo)) && af.fineType === 'ada_late_fee')
    .reduce((sum, af) => sum + (Number(af.amount) || 0), 0);

  // Kiasi cha jumla cha faini iliyopatikana:
  // Inakuwa kiasi cha juu zaidi kati ya kilichotokana na miezi ya sasa isiyolipwa NA kile kilichowahi kutozwa/kujilimbikiza kwenye accruedFines.
  // Mwanachama akilipa ada pekee bila kulipa faini, faini aliyokuwa nayo inabaki thabiti na ISIONDOKE ki-automatic hadi ilipwe kupitia malipo ya faini.
  const totalAssessedLatePenalty = isJimson ? 0 : Math.max(accruedLateFines, currentUnpaidPenalty);

  // Faini za ada zilizokwisha lipwa na mwanachama huyu (kupitia finePayments)
  const lateFinesPaid = isJimson ? 0 : (state.finePayments || [])
    .filter(p => (p.memberId === member.id || (member.memberNo && p.memberNo === member.memberNo)) && classifyFinePaymentType(p, state) === 'ada_late_fee')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Salio la Faini ya Kuchelewa Ada
  const lateFeePenalty = isJimson ? 0 : Math.max(0, totalAssessedLatePenalty - lateFinesPaid);
  const penaltyMonthsCount = lateFeePenalty > 0 ? Math.ceil(lateFeePenalty / 5000) : 0;

  const {
    finesPaid: otherFinesPaid,
    finesDebt: otherFinesDebt,
    meetingLateDebt,
    meetingLatePaid,
    meetingAbsentDebt,
    meetingAbsentPaid,
    finesList: meetingFinesList,
    unpaidFinesSummary: meetingFinesText,
    unpaidDatesSummary: meetingFinesDatesText,
    unpaidTitlesSummary: meetingFinesTitlesText
  } = calculateMemberOtherFines(member.id, state);
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
    unpaidFromJuneCount,
    otherFinesDebt,
    otherFinesPaid,
    meetingLateDebt,
    meetingLatePaid,
    meetingAbsentDebt,
    meetingAbsentPaid,
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
    meetingFinesText,
    meetingFinesDatesText,
    meetingFinesTitlesText,
    meetingFinesList,
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

export function formatSwahiliDate(dateStr?: string): string {
  if (!dateStr) return '';
  return getSwahiliDayAndDate(dateStr).formattedDate;
}

export function getAmountInSwahiliWords(amount: number): string {
  if (amount === 5000) return 'Shilingi Elfu Tano Tu';
  if (amount === 10000) return 'Shilingi Elfu Kumi Tu';
  if (amount === 15000) return 'Shilingi Elfu Kumi na Tano Tu';
  if (amount === 20000) return 'Shilingi Elfu Ishirini Tu';
  if (amount === 25000) return 'Shilingi Elfu Ishirini na Tano Tu';
  if (amount === 30000) return 'Shilingi Elfu Thelathini Tu';
  if (amount === 50000) return 'Shilingi Elfu Hamsini Tu';
  if (amount === 100000) return 'Shilingi Laki Moja Tu';

  if (amount > 0 && amount % 1000 === 0) {
    const thousands = Math.floor(amount / 1000);
    const thousandsMap: Record<number, string> = {
      1: 'Moja', 2: 'Mbili', 3: 'Tatu', 4: 'Nne', 5: 'Tano',
      6: 'Sita', 7: 'Saba', 8: 'Nane', 9: 'Tisa', 10: 'Kumi',
      15: 'Kumi na Tano', 20: 'Ishirini', 25: 'Ishirini na Tano',
      30: 'Thelathini', 40: 'Arobaini', 50: 'Hamsini', 60: 'Sitini',
      70: 'Sabini', 80: 'Themanini', 90: 'Tisini'
    };
    if (thousandsMap[thousands]) {
      return `Shilingi Elfu ${thousandsMap[thousands]} Tu`;
    }
    return `Shilingi Elfu ${thousands} Tu`;
  }
  return `Shilingi ${amount.toLocaleString()} Tu`;
}

export interface OfficialBereavementSmsParams {
  memberName: string;
  relationType: string;
  relationCustomLabel?: string;
  deceasedName?: string;
  deathDate?: string;
  deathPlace?: string;
  location?: string;
  meetingLocation?: string;
  meetingDate?: string;
  meetingTime?: string;
  contributionAmount: number;
  paymentMethod?: string;
  deadlineDate?: string;
  burialSchedule?: string;
  includeGreeting?: boolean;
}

export function buildOfficialBereavementSms(params: OfficialBereavementSmsParams): string {
  const memberName = params.memberName?.trim() || '[Jina la Mwanachama]';
  const deceasedName = params.deceasedName?.trim() || '[Jina la Marehemu]';

  // Format death details (tarehe na hospitali / mahali)
  const deathParts: string[] = [];
  if (params.deathDate) {
    const { dayName, formattedDate } = getSwahiliDayAndDate(params.deathDate);
    if (dayName) {
      deathParts.push(`siku ya ${dayName} tarehe ${formattedDate}`);
    } else if (formattedDate) {
      deathParts.push(`tarehe ${formattedDate}`);
    }
  }
  if (params.deathPlace && params.deathPlace.trim()) {
    const dpClean = params.deathPlace.trim()
      .replace(/^katika\s+/i, '')
      .replace(/^akiwa\s+/i, '')
      .replace(/\.+$/, '');
    const placePart = params.deathPlace.trim().toLowerCase().startsWith('akiwa')
      ? params.deathPlace.trim()
      : `katika ${dpClean}`;
    deathParts.push(placePart);
  }
  const deathDetailStr = deathParts.length > 0 ? `, amefariki ${deathParts.join(' ')}` : '';

  // Opening line according to relation
  let openingLine = '';
  const isMwanachamaMwenyewe = params.relationType === 'mwanachama' || 
    (params.relationCustomLabel && params.relationCustomLabel.toLowerCase().includes('mwanachama mwenyewe'));

  if (isMwanachamaMwenyewe) {
    openingLine = `Uongozi wa UWALEMI unasikitika kukutaarifu msiba wa mwanachama mwenzetu ${memberName}${deathDetailStr}.`;
  } else {
    let relText = 'mama mkwe wake';
    const rawRel = `${params.relationType || ''} ${params.relationCustomLabel || ''}`.toLowerCase();

    if (params.relationType === 'mkwe_mama' || rawRel.includes('mama mkwe') || rawRel.includes('mkwe_mama')) {
      relText = 'mama mkwe wake';
    } else if (params.relationType === 'mkwe_baba' || rawRel.includes('baba mkwe') || rawRel.includes('mkwe_baba')) {
      relText = 'baba mkwe wake';
    } else if (params.relationType === 'mzazi_mama' || (rawRel.includes('mama') && (rawRel.includes('mzazi') || rawRel.includes('yake')))) {
      relText = 'mama yake mzazi';
    } else if (params.relationType === 'mzazi_baba' || (rawRel.includes('baba') && (rawRel.includes('mzazi') || rawRel.includes('yake')))) {
      relText = 'baba yake mzazi';
    } else if (params.relationType === 'mke' || rawRel.includes('mke')) {
      relText = 'mke wake mpendwa';
    } else if (params.relationType === 'mume' || rawRel.includes('mume')) {
      relText = 'mume wake mpendwa';
    } else if (params.relationType === 'mtoto' || rawRel.includes('mtoto')) {
      relText = 'mtoto wake';
    } else {
      let cleanLabel = (params.relationCustomLabel || 'ndugu').trim();
      cleanLabel = cleanLabel.replace(/\s+wa\s+mwanachama/i, '').trim();
      relText = cleanLabel;
      if (!relText.toLowerCase().includes('wake') && !relText.toLowerCase().includes('yake')) {
        relText += ' wake';
      }
    }

    openingLine = `Uongozi wa UWALEMI unasikitika kukutaarifu kuwa mwanachama mwenzetu ${memberName} amefiwa na ${relText} ${deceasedName}${deathDetailStr}.`;
  }

  // Location line
  let rawLoc = params.location?.trim();
  if (!rawLoc) {
    rawLoc = '[Eneo la Msiba]';
  } else {
    rawLoc = rawLoc
      .replace(/^(mahali\s+msiba\s+ulipo|eneo\s+la\s+msiba|msiba\s+upo)\s*[:\-]?\s*/i, '')
      .trim();
    if (!rawLoc.endsWith('.')) {
      rawLoc += '.';
    }
  }
  let locationSection = `MAHALI MSIBA ULIPO : Msiba upo ${rawLoc}`;
  if ((params.meetingLocation && params.meetingLocation.trim()) || params.meetingDate || params.meetingTime) {
    const meetParts: string[] = [];
    if (params.meetingLocation?.trim()) {
      let rawMeeting = params.meetingLocation.trim();
      rawMeeting = rawMeeting.replace(/^(mahali\s+pa\s+vikao|ukumbi\s+wa\s+vikao|vikao\s+vya\s+msiba)\s*[:\-]?\s*/i, '').trim();
      meetParts.push(rawMeeting);
    }
    if (params.meetingDate?.trim()) {
      const { dayName, formattedDate } = getSwahiliDayAndDate(params.meetingDate);
      if (dayName) {
        meetParts.push(`siku ya ${dayName} tarehe ${formattedDate}`);
      } else if (formattedDate) {
        meetParts.push(`tarehe ${formattedDate}`);
      }
    }
    if (params.meetingTime?.trim()) {
      let rawTime = params.meetingTime.trim();
      if (!rawTime.toLowerCase().startsWith('kuanzia') && !rawTime.toLowerCase().startsWith('saa')) {
        rawTime = `kuanzia ${rawTime}`;
      }
      meetParts.push(rawTime);
    }

    if (meetParts.length > 0) {
      let meetStr = meetParts.join(', ');
      if (!meetStr.endsWith('.')) {
        meetStr += '.';
      }
      locationSection += `\nVIKAO VYA MSIBA : Vikao vitafanyika ${meetStr}`;
    }
  }

  // Contribution section
  const amountNum = Number(params.contributionAmount) || 5000;
  const amountFormatted = amountNum.toLocaleString();
  const amountWords = getAmountInSwahiliWords(amountNum);
  const contributionSection = `MCHANGO WA RAMBIRAMBI (KILA MWANACHAMA):
Kulingana na Mwongozo wa kikundi chetu cha UWALEMI, kiwango cha mchango kinachopaswa kutolewa na kila mwanachama ni TZS ${amountFormatted} (${amountWords}) kama rambirambi na mkono wa pole kwa familia.`;

  // Payment method section
  let rawPayment = (params.paymentMethod || 'M Koba au 0758219298 (Eva O. Lema)').trim();
  rawPayment = rawPayment.replace(/^NJIA\s+YA\s+KUWASILISHA\s+MCHANGO\s*:\s*/i, '').trim();
  if (!rawPayment.endsWith('.')) {
    rawPayment += '.';
  }
  const paymentSection = `NJIA YA KUWASILISHA MCHANGO: ${rawPayment}`;

  // Deadline line
  let deadlineStr = '[Tarehe ya Mwisho]';
  if (params.deadlineDate) {
    const { dayName, formattedDate } = getSwahiliDayAndDate(params.deadlineDate);
    deadlineStr = dayName ? `siku ya ${dayName} tarehe ${formattedDate}` : `tarehe ${formattedDate}`;
  }
  const deadlinePrefix = (deadlineStr.startsWith('siku') || deadlineStr.startsWith('tarehe') || deadlineStr.startsWith('[')) ? '' : 'tarehe ';
  const deadlineSection = `Mwisho wa kuwasilisha michango yote ni ${deadlinePrefix}${deadlineStr}, tunaombwa kukamilisha kwa wakati.`;

  // Burial schedule section
  let rawBurial = (params.burialSchedule || '').trim();
  if (!rawBurial) {
    rawBurial = '[Ratiba ya Mazishi Kuwekwa]';
  } else {
    rawBurial = rawBurial.replace(/^RATIBA\s+YA\s+MAZISHI\s*:\s*/i, '').trim();
  }
  const burialSection = `RATIBA YA MAZISHI: ${rawBurial}
Tunaombwa wanachama wote tushirikiane kwa sala, pole msibani na michango kumfariji mwenzetu.`;

  // Quote and signature
  const closingSection = `"Bwana alitoa, na Bwana ametwaa; jina la Bwana lihimidiwe." (Ayubu 1:21)

Uongozi wa UWALEMI 

Lema, Nguvu Moja!`;

  const greetingPrefix = params.includeGreeting !== false ? 'Habari {name},\n\n' : '';

  return `${greetingPrefix}${openingLine}

${locationSection}

${contributionSection}

${paymentSection}

${deadlineSection}

${burialSection}

${closingSection}`;
}

export const UWALEMI_THREE_MONTHS_ALERT_TEMPLATE = `Habari {name},

Uongozi wa UWALEMI unakutaarifu kuwa unadaiwa ada ya jumla ya TZS {feeDebt} ({unpaidMonthsCount} miezi: {unpaidMonths}) pamoja na faini ya TZS {faini}, hivyo jumla ya kiasi chote unachodaiwa (ada + faini) ni TZS {totalDebt}.

ANGALIZO MUHIMU: Kesho tarehe 1 faini itatozwa kwa wanachama wote wanaodaiwa ada zaidi ya miezi mitatu, na kwa wale wenye madeni ya faini ya nyuma ya kuchelewesha ada, faini zao zitaongezeka.

Tafadhali fanya malipo yako mapema leo kuepuka faini za ucheleweshaji na hatua za kikatiba za kuwa nje ya umoja (kusimamishwa uanachama) kwa mujibu wa Katiba ya UWALEMI.

Lipa kupitia: M Koba au 0758 219 298 Eva O Lema

Uongozi wa UWALEMI 

Lema, Nguvu Moja!`;

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

  const cleanMonthsList = debtInfo.breakdown && debtInfo.breakdown.length > 0
    ? debtInfo.breakdown.map(item => item.monthName).join(', ')
    : debtInfo.unpaidMonthsText;

  let finesSummaryText = '';
  if (debtInfo.totalFinesDebt > 0) {
    const parts: string[] = [];
    if (debtInfo.lateFeePenalty > 0) {
      parts.push(`Faini ya kuchelewa ada: TZS ${debtInfo.lateFeePenalty.toLocaleString()} (${penaltyMonths} ${penaltyMonths === 1 ? 'mwezi wa ziada' : 'miezi ya ziada'})`);
    }
    if (debtInfo.otherFinesDebt > 0) {
      if (debtInfo.meetingFinesText) {
        parts.push(`Faini za vikao: ${debtInfo.meetingFinesText}`);
      } else {
        parts.push(`Faini za vikao: TZS ${debtInfo.otherFinesDebt.toLocaleString()}`);
      }
    }
    finesSummaryText = parts.join(', ');
  } else {
    finesSummaryText = 'Hakuna faini';
  }

  const meetingFineDetailStr = debtInfo.meetingFinesText || formattedOtherFines;

  return template
    .replace(/{name}/g, debtInfo.memberName)
    .replace(/\s*\(\s*{memberNo}\s*\)/g, debtInfo.memberNo ? ` (${debtInfo.memberNo})` : '')
    .replace(/{memberNo}/g, debtInfo.memberNo || '')
    .replace(/{phone}/g, debtInfo.phone)
    .replace(/{role}/g, debtInfo.role)
    .replace(/TZS\s*{totalDebt}/gi, `TZS ${debtInfo.totalDebt.toLocaleString()}`)
    .replace(/TZS\s*{jumlaKuu}/gi, `TZS ${debtInfo.totalDebt.toLocaleString()}`)
    .replace(/TZS\s*{jumlaDeni}/gi, `TZS ${debtInfo.totalDebt.toLocaleString()}`)
    .replace(/TZS\s*{kiasiChote}/gi, `TZS ${debtInfo.totalDebt.toLocaleString()}`)
    .replace(/TZS\s*{kiasi_chote}/gi, `TZS ${debtInfo.totalDebt.toLocaleString()}`)
    .replace(/TZS\s*{feeDebt}/gi, `TZS ${(debtInfo.feeDebt ?? debtInfo.totalDebt).toLocaleString()}`)
    .replace(/TZS\s*{ada}/gi, `TZS ${(debtInfo.feeDebt ?? debtInfo.totalDebt).toLocaleString()}`)
    .replace(/TZS\s*{faini}/gi, `TZS ${(debtInfo.totalFinesDebt ?? 0).toLocaleString()}`)
    .replace(/TZS\s*{debtAmount}/gi, `TZS ${debtInfo.totalDebt.toLocaleString()}`)
    .replace(/{debtAmount}/g, formattedTotalDebt)
    .replace(/{totalDebt}/g, formattedTotalDebt)
    .replace(/{jumlaKuu}/g, formattedTotalDebt)
    .replace(/{jumlaDeni}/g, formattedTotalDebt)
    .replace(/{kiasiChote}/g, formattedTotalDebt)
    .replace(/{kiasi_chote}/g, formattedTotalDebt)
    .replace(/{feeDebt}/g, formattedFeeDebt)
    .replace(/{ada}/g, formattedFeeDebt)
    .replace(/{faini}/g, formattedTotalFines)
    .replace(/{fainiAda}/g, formattedLatePenalty)
    .replace(/{fainiVikao}/g, meetingFineDetailStr)
    .replace(/{fainiVikaoKiasi}/g, formattedOtherFines)
    .replace(/{fainiVikaoMchanganuo}/g, meetingFineDetailStr)
    .replace(/{fainiVikaoTarehe}/g, debtInfo.meetingFinesDatesText || 'Tarehe ya kikao')
    .replace(/{fainiVikaoJina}/g, debtInfo.meetingFinesTitlesText || 'Kikao cha UWALEMI')
    .replace(/{fainiSummary}/g, finesSummaryText)
    .replace(/{fainiMiezi}/g, `${penaltyMonths} ${penaltyMonths === 1 ? 'mwezi' : 'miezi'}`)
    .replace(/{deni}/g, formattedTotalDebt)
    .replace(/{startMonth}/g, debtInfo.startMonthName || 'Mwezi huu')
    .replace(/{kuanzia}/g, debtInfo.startMonthName || 'Mwezi huu')
    .replace(/{endMonth}/g, debtInfo.endMonthName || 'Mwezi huu')
    .replace(/{hadi}/g, debtInfo.endMonthName || 'Mwezi huu')
    .replace(/{unpaidMonths}/g, cleanMonthsList)
    .replace(/{miezi}/g, cleanMonthsList)
    .replace(/{mchanganuo}/g, breakdownText)
    .replace(/{breakdown}/g, breakdownText)
    .replace(/{unpaidMonthsCount}/g, String(debtInfo.unpaidCount))
    .replace(/{monthsCount}/g, String(debtInfo.unpaidCount))
    .replace(/{idadi_ya_miezi}/g, `${debtInfo.unpaidCount} miezi`)
    .replace(/{periodSummary}/g, debtInfo.periodSummary)
    .replace(/{monthlyFee}/g, `TZS ${debtInfo.monthlyFee.toLocaleString()}`)
    .replace(/{lipaNamba}/g, 'M Koba au 0758 219 298 Eva O Lema')
    .replace(/{lipaNumber}/g, 'M Koba au 0758 219 298 Eva O Lema')
    .replace(/TZS\s+TZS/gi, 'TZS');
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
}): Promise<{ success: boolean; deliveredCount: number; message: string; isBalanceError?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/uwalemi/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return {
      success: !!data.success,
      deliveredCount: data.deliveredCount || 0,
      message: data.message || data.error || (data.success ? 'Ujumbe umetumwa' : 'Imeshindwa kutuma SMS'),
      isBalanceError: !!data.isBalanceError,
      error: data.error
    };
  } catch (e: any) {
    return { success: false, deliveredCount: 0, message: e.message || 'Hitilafu ya mtandao', isBalanceError: false };
  }
}

/**
 * Huandaa mchanganuo kamili wa madeni ya mwanachama (Ada na Faini zote) kwa ajili ya Stakabadhi (Mfano B).
 * Huonesha wazi:
 * 1. Salio la Ada (na miezi husika)
 * 2. Salio la Faini (Faini za Vikao visivyohudhuriwa, tarehe zake, na Faini ya Kuchelewa Ada)
 * 3. Jumla Kuu ya Madeni Yote
 */
export function formatMemberReceiptDebtLines(
  member: { id?: string; memberNo?: string; fullName?: string },
  state: UwalemiState,
  options?: { totalDebtAfter?: number }
): {
  feeDebt: number;
  otherFinesDebt: number;
  lateFeePenalty: number;
  totalFinesDebt: number;
  grandTotalDebt: number;
  hasAnyDebt: boolean;
  debtLines: string[];
  fullSummaryText: string;
} {
  const fullMember = (state.members || []).find(
    m => (member.id && m.id === member.id) || (member.memberNo && m.memberNo === member.memberNo)
  ) || (member as UwalemiMember);

  if (!fullMember || !fullMember.id) {
    return {
      feeDebt: 0,
      otherFinesDebt: 0,
      lateFeePenalty: 0,
      totalFinesDebt: 0,
      grandTotalDebt: 0,
      hasAnyDebt: false,
      debtLines: [],
      fullSummaryText: ''
    };
  }

  const feeDebtInfo = calculateMemberFeeDebt(fullMember, state);
  const otherFinesInfo = calculateMemberOtherFines(fullMember.id, state);

  const unpaidFinesList = (otherFinesInfo.finesList || []).filter(f => !f.paid);
  const otherFinesDebt = otherFinesInfo.finesDebt;
  const lateFeePenalty = feeDebtInfo.lateFeePenalty;
  const totalFinesDebt = otherFinesDebt + lateFeePenalty;

  // Fee debt value (subtracting fines if totalDebtAfter includes them)
  let feeDebtVal = feeDebtInfo.feeDebt;
  if (typeof options?.totalDebtAfter === 'number') {
    feeDebtVal = Math.max(0, options.totalDebtAfter - totalFinesDebt);
  }

  const grandTotalDebt = feeDebtVal + totalFinesDebt;

  // 1. Mchanganuo wa Ada ya Mwezi
  let feeDebtDetail = '';
  if (feeDebtVal > 0 && feeDebtInfo.breakdown && feeDebtInfo.breakdown.length > 0) {
    if (feeDebtInfo.breakdown.length === 1) {
      const single = feeDebtInfo.breakdown[0];
      const mName = `${MONTH_NAMES_SW[single.month - 1]} ${single.year}`;
      if (single.paid > 0) {
        feeDebtDetail = ` (${mName}: Salio TZS ${single.debt.toLocaleString()})`;
      } else {
        feeDebtDetail = ` (Mwezi wa ${mName})`;
      }
    } else if (feeDebtInfo.breakdown.length <= 4) {
      const itemsStr = feeDebtInfo.breakdown.map(item => {
        const mName = `${MONTH_NAMES_SW[item.month - 1]} ${item.year}`;
        if (item.paid > 0) {
          return `${mName}: Salio TZS ${item.debt.toLocaleString()}`;
        }
        return `${mName}: TZS ${item.debt.toLocaleString()}`;
      }).join(', ');
      feeDebtDetail = ` (${itemsStr})`;
    } else {
      const first = feeDebtInfo.breakdown[0];
      const last = feeDebtInfo.breakdown[feeDebtInfo.breakdown.length - 1];
      const firstName = `${MONTH_NAMES_SW[first.month - 1]} ${first.year}`;
      const lastName = `${MONTH_NAMES_SW[last.month - 1]} ${last.year}`;
      feeDebtDetail = ` (${feeDebtInfo.breakdown.length} Miezi: ${firstName} hadi ${lastName})`;
    }
  }

  // 2. Mchanganuo wa Faini Zote (Vikao visivyohudhuriwa & Faini ya kuchelewa ada)
  const finesItemDescriptions: string[] = [];
  unpaidFinesList.forEach(fine => {
    const dStr = fine.date ? ` cha ${fine.date}` : '';
    const titleStr = fine.meetingTitle ? ` - ${fine.meetingTitle}` : '';
    finesItemDescriptions.push(`Kutohudhuria Kikao${dStr}${titleStr}: TZS ${fine.amount.toLocaleString()}`);
  });
  if (lateFeePenalty > 0) {
    const pMonths = feeDebtInfo.penaltyMonthsCount;
    finesItemDescriptions.push(`Faini ya Kuchelewa Ada: TZS ${lateFeePenalty.toLocaleString()} (${pMonths} ${pMonths === 1 ? 'mwezi wa ziada kuanzia Juni 2026' : 'miezi ya ziada kuanzia Juni 2026'})`);
  }

  const debtLines: string[] = [];

  if (grandTotalDebt === 0) {
    debtLines.push('Salio la Deni: TZS 0 (Hongera, huna deni lolote la Ada wala Faini!)');
  } else if (feeDebtVal > 0 && totalFinesDebt > 0) {
    // Both monthly fee debt AND fines exist -> Example B structure
    debtLines.push(`Salio la Ada: TZS ${feeDebtVal.toLocaleString()}${feeDebtDetail}`);
    debtLines.push(`Salio la Faini: TZS ${totalFinesDebt.toLocaleString()} (${finesItemDescriptions.join(', ')})`);
    debtLines.push(`Jumla ya Madeni Yote: TZS ${grandTotalDebt.toLocaleString()}`);
  } else if (feeDebtVal > 0 && totalFinesDebt === 0) {
    // Only monthly fee debt exists
    debtLines.push(`Salio la Deni Lililobaki: TZS ${feeDebtVal.toLocaleString()}${feeDebtDetail}`);
  } else if (feeDebtVal === 0 && totalFinesDebt > 0) {
    // Only fines exist (fee is up to date)
    debtLines.push(`Salio la Ada: TZS 0 (Umekamilisha Ada zote)`);
    debtLines.push(`Salio la Faini: TZS ${totalFinesDebt.toLocaleString()} (${finesItemDescriptions.join(', ')})`);
    debtLines.push(`Jumla ya Madeni Yote: TZS ${grandTotalDebt.toLocaleString()}`);
  }

  return {
    feeDebt: feeDebtVal,
    otherFinesDebt,
    lateFeePenalty,
    totalFinesDebt,
    grandTotalDebt,
    hasAnyDebt: grandTotalDebt > 0,
    debtLines,
    fullSummaryText: debtLines.join('\n')
  };
}

/**
 * Utumaji wa stakabadhi kiotomatiki mara tu ada au mchango unaporekodiwa.
 * Hukagua kama autoSendReceipts imewashwa kwenye Mipangilio ya SMS.
 * Inasaidia stakabadhi za miezi mingi na malipo ya sehemu (partial payment).
 */
export async function triggerAutoReceiptSms(params: {
  state: UwalemiState;
  member: { id?: string; memberNo?: string; fullName?: string; phone?: string };
  paymentType: 'ada' | 'emergency' | 'fine' | 'split' | 'combo';
  amount: number;
  feeAmount?: number;
  fineAmount?: number;
  fineType?: string;
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
  fineBreakdown?: {
    title: string;
    amount: number;
    status?: string;
  }[];
  remainingFeeDebt?: number;
  remainingFineDebt?: number;
  totalDebtAfter?: number;
  customMessage?: string;
  forceSend?: boolean;
  targetPhone?: string;
}): Promise<{ triggered: boolean; success: boolean; message: string }> {
  const autoSend = params.forceSend || params.state.groupSettings?.smsConfig?.autoSendReceipts;
  if (!autoSend) {
    return { triggered: false, success: false, message: 'Utumaji wa stakabadhi kiotomatiki umezimwa kwenye mipangilio.' };
  }

  const phone = (params.targetPhone || params.member.phone || '').trim();
  if (!phone) {
    return { triggered: false, success: false, message: `Mwanachama ${params.member.fullName || ''} hana namba ya simu ya kutumiwa stakabadhi.` };
  }

  const dateStr = params.paymentDate || new Date().toISOString().split('T')[0];
  
  let customMessage = params.customMessage;

  if (!customMessage) {
    const memberName = params.member.fullName || 'Mwanachama';
    const amountStr = `TZS ${params.amount.toLocaleString()}`;
    
    // Compute comprehensive remaining debts (Ada, Faini za Vikao, Faini za Kuchelewa Ada)
    const debtSummary = formatMemberReceiptDebtLines(
      params.member,
      params.state,
      { totalDebtAfter: params.totalDebtAfter }
    );
    const debtSummaryBlock = debtSummary.fullSummaryText;

    const isSplitOrCombo = params.paymentType === 'split' || 
      params.paymentType === 'combo' || 
      (typeof params.fineAmount === 'number' && params.fineAmount > 0 && typeof params.feeAmount === 'number' && params.feeAmount > 0) ||
      (typeof params.fineAmount === 'number' && params.fineAmount > 0 && params.multiMonthBreakdown && params.multiMonthBreakdown.length > 0);

    if (isSplitOrCombo) {
      const feeAmt = params.feeAmount ?? (params.amount - (params.fineAmount || 0));
      const fineAmt = params.fineAmount ?? 0;
      
      let monthsList = '';
      if (params.multiMonthBreakdown && params.multiMonthBreakdown.length > 0) {
        monthsList = params.multiMonthBreakdown.map(m => {
          if (m.isPartial) {
            return `- ${m.monthName} ${m.year}: TZS ${m.paid.toLocaleString()} (Nusu, salio TZS ${m.balance.toLocaleString()})`;
          }
          return `- ${m.monthName} ${m.year}: TZS ${m.paid.toLocaleString()} (Kamili)`;
        }).join('\n');
      } else {
        monthsList = `- Ada: TZS ${feeAmt.toLocaleString()}`;
      }

      let finesList = '';
      if (params.fineBreakdown && params.fineBreakdown.length > 0) {
        finesList = params.fineBreakdown.map(f => `- ${f.title}: TZS ${f.amount.toLocaleString()} (${f.status || 'Imelipwa'})`).join('\n');
      } else {
        finesList = `- Faini ya Kuchelewa Ada / Vikao: TZS ${fineAmt.toLocaleString()} (Imelipwa)`;
      }

      const countStr = params.multiMonthBreakdown?.length ? `Miezi ${params.multiMonthBreakdown.length}` : 'Ada';

      customMessage = `STAKABADHI YA MALIPO YA PAMOJA (ADA + FAINI) - UWALEMI
Habari ${memberName}, tumepokea malipo yako ya Jumla ${amountStr}:

1. ADA YA MIEZI (${countStr}) - TZS ${feeAmt.toLocaleString()}:
${monthsList}

2. FAINI ILIYOLIPWA - TZS ${fineAmt.toLocaleString()}:
${finesList}

Risiti: ${params.receiptNo}
Tarehe: ${dateStr}${debtSummaryBlock ? `\n${debtSummaryBlock}` : ''}

Asante kwa kutimiza wajibu wako.
Lema, Nguvu Moja!`;
    } else if (params.paymentType === 'ada') {
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
Tarehe: ${dateStr}${debtSummaryBlock ? `\n${debtSummaryBlock}` : ''}

Asante kwa kutimiza wajibu wako.
Lema, Nguvu Moja!`;
      } else if (params.isPartial) {
        // Single Partial Payment message (No bullets, No checkmarks, No Njia)
        const expStr = params.expectedAmount ? `TZS ${params.expectedAmount.toLocaleString()}` : '';
        const balStr = params.monthBalance ? `TZS ${params.monthBalance.toLocaleString()}` : '';
        customMessage = `STAKABADHI YA MALIPO YA NUSU - UWALEMI
Habari ${memberName}, tumepokea malipo yako ya ${amountStr} kwa ajili ya ${params.purpose}.
Kiasi Kilicholipwa: ${amountStr}
${expStr ? `Ada Inayotakiwa: ${expStr}\n` : ''}${balStr ? `Salio Linalobaki la Mwezi: ${balStr}\n` : ''}Risiti: ${params.receiptNo}
Tarehe: ${dateStr}${debtSummaryBlock ? `\n${debtSummaryBlock}` : ''}

Asante kwa kuendelea kulipia ada yako.
Lema, Nguvu Moja!`;
      } else {
        // Standard Full Payment message (No Njia)
        customMessage = `STAKABADHI YA MALIPO YA ADA - UWALEMI
Habari ${memberName}, tumepokea malipo yako ya ${amountStr} kwa ajili ya ${params.purpose}.
Risiti: ${params.receiptNo}
Tarehe: ${dateStr}${debtSummaryBlock ? `\n${debtSummaryBlock}` : ''}

Asante kwa kutimiza wajibu wako kwa UWALEMI.
Lema, Nguvu Moja!`;
      }
    } else if (params.paymentType === 'fine') {
      // Fine Payment Receipt
      const fineDesc = params.purpose || 'Faini ya UWALEMI';
      customMessage = `STAKABADHI YA MALIPO YA FAINI - UWALEMI
Habari ${memberName}, tumepokea malipo yako ya ${amountStr} ya ${fineDesc}.
Kiasi Kilicholipwa: ${amountStr} (Faini Imelipwa)
Risiti: ${params.receiptNo}
Tarehe: ${dateStr}${debtSummaryBlock ? `\n${debtSummaryBlock}` : ''}

Asante kwa kutimiza wajibu wako kwa UWALEMI.
Lema, Nguvu Moja!`;
    } else {
      // Emergency fund or contribution receipt
      customMessage = `STAKABADHI YA MCHANGO WA DHARURA - UWALEMI
Habari ${memberName}, tumepokea mchango wako wa ${amountStr} kwa ajili ya ${params.purpose}.
Risiti: ${params.receiptNo}
Tarehe: ${dateStr}${debtSummaryBlock ? `\n${debtSummaryBlock}` : ''}

Asante kwa moyo wako wa kujitolea na kusaidiana.
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

export interface DecomposedFineAmounts {
  adaLateFee: number;
  meetingLate: number;
  meetingAbsent: number;
  other: number;
}

/**
 * Hubainisha na kutenganisha viwango vya malipo ya faini (Ada, Kuchelewa, Utoro na Nyingine).
 * Hutenganisha malipo mseto (k.m. TZS 22,000 => TZS 20,000 Utoro + TZS 2,000 Kuchelewa).
 */
export function decomposeFinePaymentAmounts(
  fp: UwalemiFinePayment,
  state?: UwalemiState
): DecomposedFineAmounts {
  const amt = Number(fp.amount) || 0;
  if (amt <= 0) {
    return { adaLateFee: 0, meetingLate: 0, meetingAbsent: 0, other: 0 };
  }

  const titleLower = (fp.fineTitle || '').toLowerCase();
  const notesLower = (fp.notes || '').toLowerCase();

  // 1. Faini ya Ada (>Miezi 3 Mwezi wa 6+)
  if (
    fp.fineType === 'ada_late_fee' ||
    (titleLower.includes('ada') && (titleLower.includes('kuchelewa') || titleLower.includes('>miezi') || titleLower.includes('miezi 3')))
  ) {
    return { adaLateFee: amt, meetingLate: 0, meetingAbsent: 0, other: 0 };
  }

  // 2. Faini ya Kuchelewa kiasi halisi cha 2,000 (au 4,000 / 6,000 / 8,000)
  if (amt > 0 && amt % 2000 === 0 && amt < 10000) {
    return { adaLateFee: 0, meetingLate: amt, meetingAbsent: 0, other: 0 };
  }

  // 3. Faini ya Utoro kiasi cha 10,000 (au mafungu ya 10,000)
  if (amt >= 10000 && amt % 10000 === 0) {
    return { adaLateFee: 0, meetingLate: 0, meetingAbsent: amt, other: 0 };
  }

  // 4. Malipo Mseto (Combined Fine Payment, k.m. TZS 12,000 = 10,000 Utoro + 2,000 Kuchelewa)
  if (amt >= 12000 && amt % 2000 === 0 && amt % 10000 !== 0) {
    const lateRemainder = amt % 10000;
    const absentPart = amt - lateRemainder;
    return { adaLateFee: 0, meetingLate: lateRemainder, meetingAbsent: absentPart, other: 0 };
  }

  // 5. Kikao maalum kimetajwa moja kwa moja (kwa viwango vingine visivyo vya kawaida)
  if (fp.meetingId && state?.meetings) {
    const mtg = state.meetings.find(m => m.id === fp.meetingId);
    const att = (mtg?.attendees || []).find(a => a.memberId === fp.memberId || (fp.memberNo && a.memberNo === fp.memberNo));
    if (att?.status === 'late') {
      return { adaLateFee: 0, meetingLate: amt, meetingAbsent: 0, other: 0 };
    }
    if (att?.status === 'absent') {
      return { adaLateFee: 0, meetingLate: 0, meetingAbsent: amt, other: 0 };
    }
  }

  // 6. Kuchelewa kwa maelezo
  const isLateOnly = (titleLower.includes('kuchelewa') || notesLower.includes('kuchelewa')) &&
    !titleLower.includes('utoro') && !titleLower.includes('kutohudhuria') && !titleLower.includes('kutokuhudhuria') && !titleLower.includes('zote');

  if (isLateOnly) {
    return { adaLateFee: 0, meetingLate: amt, meetingAbsent: 0, other: 0 };
  }

  // 7. Utoro kwa maelezo
  const isAbsentOnly = (titleLower.includes('utoro') || titleLower.includes('kutohudhuria') || titleLower.includes('kutokuhudhuria')) &&
    !titleLower.includes('kuchelewa') && !titleLower.includes('zote');

  if (isAbsentOnly) {
    return { adaLateFee: 0, meetingLate: 0, meetingAbsent: amt, other: 0 };
  }

  if (fp.fineType === 'kikao') {
    return { adaLateFee: 0, meetingLate: 0, meetingAbsent: amt, other: 0 };
  }

  return { adaLateFee: 0, meetingLate: 0, meetingAbsent: 0, other: amt };
}

/**
 * Hubainisha aina kamili ya malipo ya faini (Faini ya Ada, Faini ya Kuchelewa Kikao, Faini ya Utoro/Kutohudhuria au Nyingine).
 */
export function classifyFinePaymentType(
  fp: UwalemiFinePayment,
  state?: UwalemiState
): 'ada_late_fee' | 'meeting_late' | 'meeting_absent' | 'other' {
  const decomposed = decomposeFinePaymentAmounts(fp, state);
  if (decomposed.adaLateFee > 0 && decomposed.meetingLate === 0 && decomposed.meetingAbsent === 0) return 'ada_late_fee';
  if (decomposed.meetingLate > 0 && decomposed.meetingAbsent === 0) return 'meeting_late';
  if (decomposed.meetingAbsent > 0 && decomposed.meetingLate === 0) return 'meeting_absent';
  if (decomposed.meetingAbsent > 0) return 'meeting_absent';
  if (decomposed.meetingLate > 0) return 'meeting_late';
  return 'other';
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

// ==========================================
// UWALEMI DIGITAL ELECTION (E-VOTING) UTILS
// ==========================================

export function generateVoterToken(memberNo: string, electionId: string): string {
  const cleanMNo = (memberNo || 'MEM').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timePart = Date.now().toString(36).slice(-4).toUpperCase();
  return `VT-${cleanMNo}-${rand}${timePart}`;
}

export function generateVoteReceiptCode(): string {
  const randNum = Math.floor(10000 + Math.random() * 90000);
  const letterCode = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `UWL-VT-${letterCode}${randNum}`;
}

export function recomputeElectionVoters(
  election: Partial<UwalemiElection>,
  members: UwalemiMember[],
  payments: UwalemiMonthlyPayment[]
): UwalemiVoterRecord[] {
  if (!Array.isArray(members)) return [];
  const criteria = election.eligibilityCriteria || {
    activeMembersOnly: true,
    requireRegistrationFeePaid: false,
    maxAllowedFeeDebtMonths: 99
  };

  const existingVoterMap = new Map<string, UwalemiVoterRecord>();
  if (Array.isArray(election.voters)) {
    election.voters.forEach(v => {
      existingVoterMap.set(v.memberId, v);
    });
  }

  return members.map(m => {
    const existing = existingVoterMap.get(m.id);
    let isEligible = true;
    let reason = '';

    if (criteria.activeMembersOnly && m.status !== 'active') {
      isEligible = false;
      reason = 'Mwanachama hayuko hai (Status: ' + (m.status === 'suspended' ? 'Amesimamishwa' : 'Hajahuishwa') + ')';
    }

    if (isEligible && criteria.requireRegistrationFeePaid && !m.registrationFeePaid) {
      isEligible = false;
      reason = 'Haijakamilika ada ya kiingilio cha uanachama';
    }

    if (isEligible && criteria.maxAllowedFeeDebtMonths < 99) {
      const dummyState: any = { monthlyPayments: payments || [], members };
      const debtInfo = calculateMemberFeeDebt(m, dummyState);
      const unpaidCount = debtInfo.penaltyMonthsCount || 0;
      if (unpaidCount > criteria.maxAllowedFeeDebtMonths) {
        isEligible = false;
        reason = `Madeni ya ada za mwezi yamezidi kiwango cha kikatiba (${unpaidCount} miezi bila ada)`;
      }
    }

    const token = existing?.voterToken || generateVoterToken(m.memberNo, election.id || 'ELEC');

    return {
      voterToken: token,
      memberId: m.id,
      memberNo: m.memberNo,
      fullName: m.fullName,
      phone: m.phone,
      isEligible,
      ineligibilityReason: reason || undefined,
      hasVoted: existing?.hasVoted || false,
      votedAt: existing?.votedAt,
      receiptCode: existing?.receiptCode,
      smsSentAt: existing?.smsSentAt
    };
  });
}

export interface ElectionPositionTally {
  positionId: string;
  positionTitle: string;
  maxWinners: number;
  totalVotesForPosition: number;
  results: {
    candidateId: string;
    candidateName: string;
    candidateNo: string;
    candidatePhone?: string;
    avatarUrl?: string;
    slogan?: string;
    votesCount: number;
    percentage: number;
    isWinner: boolean;
    isTie: boolean;
  }[];
}

export function calculateElectionTally(election: UwalemiElection): {
  totalEligibleVoters: number;
  totalBallotsCast: number;
  turnoutPercentage: number;
  positionsTally: ElectionPositionTally[];
} {
  const eligibleVoters = (election.voters || []).filter(v => v.isEligible);
  const totalEligibleVoters = eligibleVoters.length;
  const ballots = election.ballots || [];
  const totalBallotsCast = ballots.length;
  const turnoutPercentage = totalEligibleVoters > 0 
    ? Math.round((totalBallotsCast / totalEligibleVoters) * 100) 
    : 0;

  const positionsTally: ElectionPositionTally[] = (election.positions || []).map(pos => {
    // Count votes per candidate
    const voteCountMap = new Map<string, number>();
    let totalVotesForPosition = 0;

    pos.candidates.forEach(c => {
      voteCountMap.set(c.id, 0);
    });

    ballots.forEach(ballot => {
      const chosenCandidateIds = ballot.votes?.[pos.id];
      if (Array.isArray(chosenCandidateIds)) {
        chosenCandidateIds.forEach(cId => {
          if (voteCountMap.has(cId)) {
            voteCountMap.set(cId, (voteCountMap.get(cId) || 0) + 1);
            totalVotesForPosition += 1;
          }
        });
      }
    });

    const results = pos.candidates.map(c => {
      const votesCount = voteCountMap.get(c.id) || 0;
      const percentage = totalVotesForPosition > 0 
        ? Math.round((votesCount / totalVotesForPosition) * 1000) / 10 
        : 0;
      return {
        candidateId: c.id,
        candidateName: c.fullName,
        candidateNo: c.memberNo,
        candidatePhone: c.phone,
        avatarUrl: c.avatarUrl,
        slogan: c.slogan || c.manifesto,
        votesCount,
        percentage,
        isWinner: false,
        isTie: false
      };
    });

    // Sort descending by votes
    results.sort((a, b) => b.votesCount - a.votesCount);

    // Identify winners based on maxWinners
    if (totalVotesForPosition > 0 && results.length > 0) {
      const maxW = Math.max(1, pos.maxWinners || 1);
      const topVotes = results[0].votesCount;
      
      if (maxW === 1) {
        // Single winner position: Check if tie for 1st place
        if (results.length > 1 && results[1].votesCount === topVotes && topVotes > 0) {
          results[0].isTie = true;
          results[1].isTie = true;
        } else if (topVotes > 0) {
          results[0].isWinner = true;
        }
      } else {
        // Multi-winner position
        for (let i = 0; i < Math.min(maxW, results.length); i++) {
          if (results[i].votesCount > 0) {
            results[i].isWinner = true;
          }
        }
      }
    }

    return {
      positionId: pos.id,
      positionTitle: pos.title,
      maxWinners: pos.maxWinners,
      totalVotesForPosition,
      results
    };
  });

  return {
    totalEligibleVoters,
    totalBallotsCast,
    turnoutPercentage,
    positionsTally
  };
}

