export interface EventDetails {
  id: string;
  senderId: string;
  name: string;
  date: string;
  time: string;
  period: 'Asubuhi' | 'Mchana' | 'Jioni' | 'Usiku';
  eventHallName: string;
  coordinates: string;
  hostName: string;
  dressCode: string;
  contact1: string;
  contact1Name?: string;
  contact2: string;
  contact2Name?: string;
  contact3: string;
  contact3Name?: string;
  mapsLink?: string;
  
  eventImgUrl?: string;

  // Logs for persistence
  messageLogs?: MessageLog[];
  smsTemplates?: {
    pledge1En?: string;
    pledge1Sw?: string;
    pledge2En?: string;
    pledge2Sw?: string;
    rem1En?: string;
    rem1Sw?: string;
    rem2En?: string;
    rem2Sw?: string;
    thanks1En?: string;
    thanks1Sw?: string;
    thanks2En?: string;
    thanks2Sw?: string;
    invitationTemplateSw?: string;
    invitationTemplateEn?: string;
    contributionSw?: string;
    contributionEn?: string;
    generalThanksSw?: string;
    generalThanksEn?: string;
  } | null;

  paymentMethods?: {
    id: string;
    provider: string; // 'M-Pesa', 'Tigo Pesa', 'CRDB', etc.
    type: 'Mobile' | 'Bank' | 'Lipa Namba';
    number: string;
    name: string;
  }[];

  // Optional Contribution configuration
  contributionsEnabled?: boolean;
  fundraisingGoal?: number;
  autoRsvpRemindersEnabled?: boolean;
  contributionDeadline?: string;
}

export interface ContributionPayment {
  id: string;
  amount: number;
  date: string;
  reference: string;
  notes: string;
}

export interface ContributionMessageLog {
  id: string;
  eventId: string;
  guestName: string;
  phone: string;
  channel: 'SMS' | 'whatsApp' | 'WhatsApp' | 'sms';
  type: 'Pledge Request' | 'Reminder' | 'Thank You';
  message: string;
  sentAt: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
}

export interface MessageLog {
  id: string;
  guestName: string;
  phone: string;
  type: 'SMS' | 'WhatsApp';
  templateUsed: string;
  sentAt: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
}

export interface TemplateSettings {
  imageUrl: string; // Base64 or preset URL
  textColor: string; // Default base color
  fontFamily: string;
  
  // Custom positions (in percentage of the card layout)
  guestNameX: number;
  guestNameY: number;
  guestNameSize: number;
  guestNameColor?: string; // Custom color for guest name
  
  qrCodeX: number;
  qrCodeY: number;
  qrCodeSize: number;
  qrCodeColor?: string; // Custom color for QR code
  
  cardTypeX: number;
  cardTypeY: number;
  cardTypeSize: number;
  cardTypeColor?: string; // Custom color for card type badge
  orientation?: 'portrait' | 'landscape';
}

export interface ContributionCardTemplate {
  imageUrl?: string;
  themeId?: string;
  
  showEventName?: boolean;
  eventNameX?: number;
  eventNameY?: number;
  eventNameSize?: number;
  eventNameColor?: string;
  
  showGuestName?: boolean;
  guestNameX?: number;
  guestNameY?: number;
  guestNameSize?: number;
  guestNameColor?: string;
  
  showPledgeAmount?: boolean;
  pledgeAmountX?: number;
  pledgeAmountY?: number;
  pledgeAmountSize?: number;
  pledgeAmountColor?: string;
  
  showDeadline?: boolean;
  deadlineX?: number;
  deadlineY?: number;
  deadlineSize?: number;
  deadlineColor?: string;
  
  showCardType?: boolean;
  cardTypeX?: number;
  cardTypeY?: number;
  cardTypeSize?: number;
  cardTypeColor?: string;
  
  showQrCode?: boolean;
  qrCodeX?: number;
  qrCodeY?: number;
  qrCodeSize?: number;
}

export interface Guest {
  id: string;
  eventId?: string;
  code: string; // Alphanumeric check-in code e.g. KY-3801
  name: string;
  phone: string;
  cardType: string; // 'SINGLE' | 'DOUBLE' | 'UNCLASSIFIED'
  smsStatus: 'Sijatuma' | 'Inatuma' | 'Imetumia';
  whatsappStatus: 'Sijatuma' | 'Inatuma' | 'Imetumia';
  rsvpStatus: 'Bado' | 'Atahudhuria' | 'Hatahudhuria' | 'Labda';
  maxGuests?: number; // Maximum guests allowed for this invitation
  rsvpGuestsCount: number;
  rsvpComment?: string;
  checkedIn: boolean;
  checkedInTime?: string;
  photoUrl?: string; // Opt photo taken during check-in
  cardImageUrl?: string; // Generated preview image
  smsCount?: number;
  whatsappCount?: number;
  category?: string;
  tags?: string[];
  customFields?: Record<string, string>;
  lastSentChannel?: string;
  lastSentLang?: string;

  // Contribution Module Fields
  pledgeAmount?: number;
  paidAmount?: number;
  pledgeStatus?: 'No Pledge' | 'Pledged' | 'Partially Paid' | 'Fully Paid';
  payments?: ContributionPayment[];
  rsvpUpdatedAt?: string;
  rsvpSeen?: boolean;

  // Track module-specific delivery statuses to avoid badge cross-contamination
  stdSent?: boolean;
  stdSentChannel?: string;
  stdSentLang?: string;
  pledgeSent?: boolean;
  pledgeSentChannel?: string;
  pledgeSentLang?: string;
  reminderSent?: boolean;
  reminderSentChannel?: string;
  reminderSentLang?: string;
  thanksSent?: boolean;
  thanksSentChannel?: string;
  thanksSentLang?: string;
}

export interface SaveTheDate {
  id: string;
  event_id: string;
  title: string;
  message: string;
  image_url?: string;
  created_at: string;
}

export interface SaveTheDateRecipient {
  id: string;
  save_the_date_id: string;
  guest_id: string;
  sent_at?: string;
  status: 'Pending' | 'Sent';
}

export interface WalletTransaction {
  id: string;
  type: 'In' | 'Out';
  amount: number;
  description: string;
  date: string;
}

export interface UserAccount {
  username: string;
  phone: string;
  email: string;
  walletBalance: number;
  transactions: WalletTransaction[];
}

export type UserRole = 'Admin' | 'Treasurer' | 'Secretary' | 'Gatekeeper';

export interface CommitteeMember {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  position: string;
  subCommittee?: string;
  permissionLevel: string;
  token?: string;
}

export interface AppAuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  ipAddress?: string;
}

export interface CommitteeActivityLog {
  id: string;
  user: string;
  role: string;
  action: string;
  date: string;
  time: string;
  ipAddress: string;
}

export interface CommitteeNotification {
  id: string;
  type: 'pledge' | 'payment' | 'completed' | 'target_reached';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

