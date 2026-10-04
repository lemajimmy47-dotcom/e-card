export type UwalemiMemberRole = 'Mwenyekiti' | 'Makamu Mwenyekiti' | 'Katibu' | 'Katibu Msaidizi' | 'Mweka Hazina' | 'Mweka Hazina Msaidizi' | 'Mjumbe' | 'Mlezi';
export type UwalemiMemberStatus = 'active' | 'inactive' | 'suspended';

export interface UwalemiNextOfKin {
  name: string;
  relation: string; // Mke, Mume, Mtoto, Mzazi, Ndugu
  phone: string;
}

export interface UwalemiMember {
  id: string;
  memberNo: string; // e.g. UWL-001 to UWL-050
  fullName: string;
  phone: string;
  email?: string;
  residence?: string;
  locationGroup?: 'Dar es Salaam' | 'Mkoani';
  joinDate: string;
  role: UwalemiMemberRole;
  status: UwalemiMemberStatus;
  registrationFeePaid: boolean;
  registrationFeeAmount: number; // Kiasi cha kiingilio anachotakiwa kulipa mwanachama huyu
  registrationFeePaidAmount?: number; // Kiasi kilicholipwa cha kiingilio (kwa malipo ya sehemu au kamili)
  monthlyFeeAmount: number; // Ada ya kila mwezi ya mwanachama huyu
  nextOfKin: UwalemiNextOfKin;
  notes?: string;
  avatarUrl?: string;
  suppressLateFeePenalty?: boolean;
}

export interface UwalemiMonthlyPayment {
  id: string;
  memberId: string;
  memberNo: string;
  memberName: string;
  year: number;
  month: number; // 1 - 12 (Jan - Dec)
  expectedAmount: number;
  paidAmount: number;
  paymentDate?: string;
  paymentMethod?: string; // M-Pesa, Tigo Pesa, Airtel Money, Benki, Taslimu
  referenceNo?: string;
  status: 'paid' | 'partial' | 'unpaid';
  receiptNo?: string;
  note?: string;
}

export type UwalemiEmergencyType = 'msiba' | 'ugonjwa' | 'harusi' | 'pongezi' | 'dharura' | 'nyingine';

export interface UwalemiContributionPayment {
  id: string;
  emergencyId: string;
  memberId: string;
  memberNo: string;
  memberName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNo?: string;
  receiptNo?: string;
  note?: string;
}

export interface UwalemiEmergencyFund {
  id: string;
  title: string; // e.g. Msiba wa Baba yake Mjumbe UWL-012
  type: UwalemiEmergencyType;
  targetAmount: number;
  perMemberTarget: number; // e.g. 20000 kila mjumbe
  beneficiaryName: string; // Nani anayesaidiwa
  beneficiaryPhone?: string;
  beneficiaryRelation?: string;
  deceasedName?: string;
  deathDate?: string;
  deathPlace?: string;
  location?: string;
  meetingLocation?: string;
  meetingDate?: string;
  meetingTime?: string;
  burialSchedule?: string;
  startDate: string;
  deadline: string;
  status: 'active' | 'closed' | 'disbursed';
  description: string;
  disbursedAmount?: number;
  disbursedDate?: string;
  disbursementNote?: string;
  payments: UwalemiContributionPayment[];
}

export interface UwalemiExpense {
  id: string;
  title: string;
  category: 'msiba' | 'matibabu' | 'uendeshaji' | 'kikao' | 'mkutano_mkuu' | 'huduma' | 'nyingine';
  amount: number;
  date: string;
  paidTo: string;
  approvedBy: string;
  paymentMethod: string;
  receiptUrl?: string;
  description?: string;
}

export interface UwalemiMeetingAttendee {
  memberId: string;
  memberNo: string;
  memberName: string;
  status: 'present' | 'absent' | 'apology' | 'late';
  fineAmount?: number;
  finePaid?: boolean;
  fineReason?: string;
}

export interface UwalemiFinePayment {
  id: string;
  receiptNo: string;
  memberId: string;
  memberNo: string;
  memberName: string;
  memberPhone?: string;
  fineType: 'kikao' | 'ada_late_fee' | 'nyingine';
  fineTitle: string; // e.g. "Faini ya Kutohudhuria Kikao Na. 3" au "Faini ya Kuchelewa Ada (>Miezi 3)"
  meetingId?: string;
  meetingTitle?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string; // M-Koba / M-Pesa, CRDB Bank, Taslimu, nk.
  referenceNo?: string;
  receivedBy?: string;
  notes?: string;
  createdAt?: string;
}

export interface UwalemiAccruedFine {
  id: string;
  memberId: string;
  memberNo: string;
  memberName: string;
  fineType: 'ada_late_fee' | 'kikao' | 'nyingine';
  reason: string;
  year?: number;
  month?: number;
  amount: number;
  assessedDate: string;
  status: 'unpaid' | 'paid' | 'partial';
  paidAmount?: number;
}

export interface UwalemiMeeting {
  id: string;
  meetingNo: number;
  title: string; // e.g. Kikao cha Kawaida cha Mwezi Agosti
  date: string;
  time: string;
  location: string;
  agendas: string[];
  minutes?: string;
  resolutions?: string[];
  attendees: UwalemiMeetingAttendee[];
  status: 'upcoming' | 'completed' | 'cancelled';
}

export interface UwalemiSmsConfig {
  provider: 'swalasms' | 'meseji' | 'beem' | 'nextsms' | 'ehub' | 'custom' | 'simulation';
  apiKey: string;
  secretKey: string;
  senderId: string;
  baseUrl?: string;
  autoSendReceipts: boolean;
  autoSendMeetingAlerts: boolean;
  autoSendMonthlyReminder: boolean;
}

export interface UwalemiPaymentMethod {
  id: string;
  provider: string; // M-Pesa, Tigo Pesa, CRDB, NMB, Lipa Namba
  type: 'Mobile' | 'Bank' | 'Till' | 'Paybill';
  number: string;
  accountName: string;
}

export interface UwalemiGroupSettings {
  groupName: string;
  slogan: string;
  logoUrl?: string;
  registrationFeeDefault: number;
  monthlyFeeDefault: number;
  emergencyFeeDefault: number;
  meetingFineDefault: number;
  meetingFineLateDefault?: number;
  paymentMethods: UwalemiPaymentMethod[];
  smsConfig: UwalemiSmsConfig;
  constitutionSummary?: string;
  createdDate: string;
  foundedYear?: number;
  foundedMonth?: number;
  foundedDay?: number;
}

export interface UwalemiMessageLog {
  id: string;
  timestamp?: string;
  sentAt?: string;
  createdAt?: string;
  recipientPhone: string;
  recipientName: string;
  messageType?: 'receipt' | 'reminder' | 'emergency' | 'meeting' | 'broadcast' | string;
  type?: string;
  channel?: 'sms' | 'whatsapp' | string;
  content?: string;
  message?: string;
  text?: string;
  status: 'delivered' | 'failed' | 'sent' | 'simulated' | string;
}

export interface UwalemiCandidate {
  id: string;
  memberId: string;
  memberNo: string;
  fullName: string;
  phone: string;
  avatarUrl?: string;
  manifesto?: string;
  slogan?: string;
}

export interface UwalemiElectionPosition {
  id: string;
  title: string; // e.g. "Mwenyekiti", "Makamu Mwenyekiti", "Katibu", "Mweka Hazina", "Mjumbe wa Kamati"
  description?: string;
  maxWinners: number; // e.g. 1 for chairperson, 2 or 3 for committee members
  candidates: UwalemiCandidate[];
}

export interface UwalemiVoterRecord {
  voterToken: string; // Unique, secret token e.g. "VT-91827481-UWL002"
  memberId: string;
  memberNo: string;
  fullName: string;
  phone: string;
  isEligible: boolean;
  ineligibilityReason?: string;
  hasVoted: boolean;
  votedAt?: string;
  receiptCode?: string; // e.g. "UWL-VT-94817"
  smsSentAt?: string;
}

export interface UwalemiAnonymousBallot {
  id: string;
  electionId: string;
  timestamp: string;
  receiptCode: string;
  // Map of positionId -> array of candidateIds chosen
  votes: Record<string, string[]>;
}

export interface UwalemiElection {
  id: string;
  title: string; // e.g. "Uchaguzi Mkuu wa Viongozi wa UWALEMI 2026/2028"
  description?: string;
  termYears?: string; // e.g. "2026 - 2028"
  startDate: string; // YYYY-MM-DDTHH:mm
  endDate: string; // YYYY-MM-DDTHH:mm
  status: 'draft' | 'active' | 'paused' | 'completed';
  eligibilityCriteria: {
    activeMembersOnly: boolean;
    requireRegistrationFeePaid: boolean;
    maxAllowedFeeDebtMonths: number; // 0 = zero debt required, 3 = max 3 months, 99 = all allowed
  };
  positions: UwalemiElectionPosition[];
  voters: UwalemiVoterRecord[];
  ballots: UwalemiAnonymousBallot[]; // Anonymous votes storage
  createdAt: string;
  certifiedAt?: string;
  certifiedBy?: string;
  notes?: string;
}

export interface UwalemiState {
  groupSettings: UwalemiGroupSettings;
  members: UwalemiMember[];
  monthlyPayments: UwalemiMonthlyPayment[];
  emergencyFunds: UwalemiEmergencyFund[];
  expenses: UwalemiExpense[];
  meetings: UwalemiMeeting[];
  finePayments?: UwalemiFinePayment[];
  accruedFines?: UwalemiAccruedFine[];
  elections?: UwalemiElection[];
  messageLogs: UwalemiMessageLog[];
  lastMonthlyReminderYearMonth?: string;
  lastMonthlyReminderDate?: string;
  lastUpdated?: string;
}

export type UwalemiTab = 
  | 'overview' 
  | 'members' 
  | 'monthly_fees' 
  | 'emergency_funds' 
  | 'expenses' 
  | 'meetings' 
  | 'elections'
  | 'sms_center' 
  | 'reports'
  | 'settings';

