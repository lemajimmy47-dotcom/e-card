/**
 * Phone Number & WhatsApp Identification Utilities
 * 
 * Provides unified logic for detecting whether a guest phone number is on WhatsApp,
 * identifying landlines (which cannot have WhatsApp), invalid numbers, and automatically
 * filtering out non-WhatsApp numbers so they are never queued or sent via WhatsApp.
 */

export interface WhatsAppDetectionResult {
  hasWhatsApp: boolean;
  statusDetail: string;
  noWhatsAppFlag: 'true' | 'false';
  formattedPhone: string;
}

/**
 * Standardizes a phone number into international Tanzanian (+255) or clean format
 */
export const standardisePhoneNumber = (phone: string): string => {
  let clean = (phone || '').trim().replace(/\s+/g, '');
  if (!clean) return '';

  // If already starts with +
  if (clean.startsWith('+')) {
    return clean;
  }

  // Clean pure digits for standard checks
  const digits = clean.replace(/\D/g, '');

  // If starts with 0 and is 10 digits long, e.g. 0714786751 or 06...
  if (digits.startsWith('0') && digits.length === 10) {
    return '+255' + digits.slice(1);
  }

  // If starts with 255 and is 12 digits long, e.g. 255714786751
  if (digits.startsWith('255') && digits.length === 12) {
    return '+' + digits;
  }

  // If is 9 digits long starting with 6 or 7, e.g. 714786751
  if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('6'))) {
    return '+255' + digits;
  }

  // Other Tanzanian landlines or numbers
  if (digits.length === 9 && digits.startsWith('2')) {
    return '+255' + digits;
  }

  return clean.startsWith('+') ? clean : (digits ? '+' + digits : clean);
};

/**
 * Checks whether a phone number is a Tanzanian landline (02... / +2552...)
 * Landlines do not support WhatsApp.
 */
export const isLandlinePhoneNumber = (phone: string): boolean => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return false;

  // e.g. 022xxxxxxx (10 digits) or 2552xxxxxxx (12 digits) or starts with 2552 / 02
  if (digits.startsWith('2552') && digits.length === 12) return true;
  if (digits.startsWith('02') && digits.length === 10) return true;
  if (digits.length === 9 && digits.startsWith('2')) return true; // e.g. 222123456

  return false;
};

/**
 * Checks whether a phone number is too short or malformed
 */
export const isInvalidPhoneNumber = (phone: string): boolean => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits || digits.length < 9 || digits.length > 15) return true;
  return false;
};

/**
 * Evaluates a phone number and guest metadata to determine WhatsApp capability
 */
export const detectGuestWhatsAppStatus = (
  phone: string,
  existingCustomFields?: Record<string, any>,
  existingHasWhatsApp?: boolean | string
): WhatsAppDetectionResult => {
  const formatted = standardisePhoneNumber(phone);
  const digits = String(phone || '').replace(/\D/g, '');

  // 1. If explicitly marked as not having WhatsApp
  if (existingHasWhatsApp === false || existingCustomFields?.noWhatsApp === 'true') {
    return {
      hasWhatsApp: false,
      statusDetail: 'Haipo WhatsApp (SMS Tu)',
      noWhatsAppFlag: 'true',
      formattedPhone: formatted
    };
  }

  // 2. Check for invalid or empty phone number
  if (!digits || digits.length < 9) {
    return {
      hasWhatsApp: false,
      statusDetail: 'Haipo WhatsApp (Namba fupi / isiyo kamili)',
      noWhatsAppFlag: 'true',
      formattedPhone: formatted
    };
  }

  if (digits.length > 15) {
    return {
      hasWhatsApp: false,
      statusDetail: 'Haipo WhatsApp (Namba ndefu mno)',
      noWhatsAppFlag: 'true',
      formattedPhone: formatted
    };
  }

  // 3. Check for Landline (Fixed line)
  if (isLandlinePhoneNumber(phone)) {
    return {
      hasWhatsApp: false,
      statusDetail: 'Haipo WhatsApp (Namba ya Mezani / SMS Tu)',
      noWhatsAppFlag: 'true',
      formattedPhone: formatted
    };
  }

  // 4. Tanzanian mobile or international valid mobile
  // Tanzania mobile: starts with 2557 or 2556 (12 digits) or 07 / 06 (10 digits)
  const isTzMobile = 
    ((digits.startsWith('2557') || digits.startsWith('2556')) && digits.length === 12) ||
    ((digits.startsWith('07') || digits.startsWith('06')) && digits.length === 10) ||
    ((digits.startsWith('7') || digits.startsWith('6')) && digits.length === 9);

  const isIntlMobile = digits.length >= 10 && digits.length <= 15 && !digits.startsWith('255');

  if (isTzMobile || isIntlMobile) {
    return {
      hasWhatsApp: true,
      statusDetail: 'Ipo WhatsApp',
      noWhatsAppFlag: 'false',
      formattedPhone: formatted
    };
  }

  // Default fallback if format doesn't match standard mobile
  return {
    hasWhatsApp: false,
    statusDetail: 'Haipo WhatsApp (Muundo usio wa simu ya mkononi)',
    noWhatsAppFlag: 'true',
    formattedPhone: formatted
  };
};

/**
 * Checks whether a guest is eligible to receive WhatsApp messages.
 * Returns FALSE if:
 * - guest.hasWhatsApp === false
 * - guest.customFields.noWhatsApp === 'true'
 * - number is a landline
 * - number is invalid / too short
 */
export const isEligibleWhatsAppNumber = (
  phone?: string,
  guest?: { hasWhatsApp?: boolean | string; customFields?: Record<string, any> }
): boolean => {
  if (!phone) return false;

  // Explicit user or system flag
  if (guest?.hasWhatsApp === false) return false;
  if (guest?.customFields?.noWhatsApp === 'true') return false;

  // Landline check
  if (isLandlinePhoneNumber(phone)) return false;

  // Invalid length check
  if (isInvalidPhoneNumber(phone)) return false;

  // If already verified as true
  if (guest?.hasWhatsApp === true) return true;

  // Check format
  const detection = detectGuestWhatsAppStatus(phone, guest?.customFields, guest?.hasWhatsApp);
  return detection.hasWhatsApp;
};

/**
 * Filters a list of guests into those eligible for WhatsApp and those excluded (SMS Only)
 */
export const filterGuestsForWhatsApp = <T extends { phone?: string; hasWhatsApp?: boolean | string; customFields?: Record<string, any> }>(
  guests: T[]
): { eligibleGuests: T[]; excludedGuests: T[]; countExcluded: number } => {
  const eligibleGuests: T[] = [];
  const excludedGuests: T[] = [];

  guests.forEach(g => {
    if (isEligibleWhatsAppNumber(g.phone, g)) {
      eligibleGuests.push(g);
    } else {
      excludedGuests.push(g);
    }
  });

  return {
    eligibleGuests,
    excludedGuests,
    countExcluded: excludedGuests.length
  };
};
