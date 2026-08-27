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
  category: 'msiba' | 'matibabu' | 'uendeshaji' | 'kikao' | 'huduma' | 'nyingine';
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
  provider: 'meseji' | 'beem' | 'nextsms' | 'ehub' | 'custom' | 'simulation';
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
  registrationFeeDefault: number;
  monthlyFeeDefault: number;
  emergencyFeeDefault: number;
  meetingFineDefault: number;
  meetingFineLateDefault?: number;
  paymentMethods: UwalemiPaymentMethod[];
  smsConfig: UwalemiSmsConfig;
  constitutionSummary?: string;
  createdDate: string;
}

export interface UwalemiMessageLog {
  id: string;
  timestamp: string;
  recipientPhone: string;
  recipientName: string;
  messageType: 'receipt' | 'reminder' | 'emergency' | 'meeting' | 'broadcast';
  channel: 'sms' | 'whatsapp';
  content: string;
  status: 'delivered' | 'failed' | 'sent' | 'simulated';
}

export interface UwalemiState {
  groupSettings: UwalemiGroupSettings;
  members: UwalemiMember[];
  monthlyPayments: UwalemiMonthlyPayment[];
  emergencyFunds: UwalemiEmergencyFund[];
  expenses: UwalemiExpense[];
  meetings: UwalemiMeeting[];
  finePayments?: UwalemiFinePayment[];
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
  | 'sms_center' 
  | 'reports'
  | 'settings';

