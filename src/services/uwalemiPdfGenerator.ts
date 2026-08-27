import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  UwalemiState, 
  UwalemiMember, 
  UwalemiEmergencyFund, 
  UwalemiMeeting, 
  UwalemiMonthlyPayment 
} from '../types/uwalemi';
import { 
  sortMembersByLeadership, 
  getDefaultFeeForMonth, 
  calculateMemberFeeDebt, 
  calculateLateFeePenalty,
  calculateMemberOtherFines 
} from './uwalemiService';

const MONTH_NAMES_SW = [
  'Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni',
  'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'
];

/**
 * Format currency with TZS prefix
 */
export const formatTZS = (amount: number): string => {
  return `TZS ${Number(amount || 0).toLocaleString()}`;
};

/**
 * Universal PDF downloader with robust Blob anchor download + fallback
 */
export const downloadPdfDocument = (doc: jsPDF, fileName: string): string => {
  const safeName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  try {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = safeName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 500);
    return blobUrl;
  } catch (err) {
    console.warn('Blob download failed, using doc.save()', err);
    doc.save(safeName);
    return '';
  }
};

/**
 * Helper to get formatted member display name with status for reports
 */
export const getMemberDisplayName = (m: any): string => {
  if (m.status === 'suspended') {
    return `${m.fullName} (Amesitishwa)`;
  }
  if (m.status === 'resigned') {
    return `${m.fullName} (Amejitoa)`;
  }
  return m.fullName;
};

/**
 * Get PDF as object URL for preview/iframe rendering
 */
export const getPdfBlobUrl = (doc: jsPDF): string => {
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
};

/**
 * Draw UWALEMI Official Letterhead on jsPDF document
 */
const drawOfficialHeader = (
  doc: jsPDF, 
  state: UwalemiState, 
  reportTitle: string, 
  subTitle?: string
) => {
  const groupName = state.groupSettings?.groupName || 'UWALEMI';
  const slogan = state.groupSettings?.slogan && !state.groupSettings.slogan.includes('Shida na Raha')
    ? state.groupSettings.slogan
    : 'Lema, Nguvu Moja.';
  
  // Top decorative emerald stripe
  doc.setFillColor(5, 150, 105); // emerald-600
  doc.rect(0, 0, 210, 8, 'F');

  // Group Name Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0); // slate-900 (black)
  doc.text(groupName.toUpperCase(), 105, 18, { align: 'center' });

  // Slogan / Motto
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0); // slate-500 (black)
  doc.text(slogan, 105, 23, { align: 'center' });

  // Divider Line
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.5);
  doc.line(14, 26, 196, 26);

  // Report Title Badge
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(14, 29, 182, 14, 2, 2, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(reportTitle.toUpperCase(), 105, 36, { align: 'center' });

  if (subTitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(subTitle, 105, 41, { align: 'center' });
  }

  // Meta info (Date generated)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  const nowStr = new Date().toLocaleString('sw-TZ', { dateStyle: 'medium', timeStyle: 'short' });
  doc.text(`Tarehe ya Kuchapishwa: ${nowStr}`, 14, 48);
  doc.text(`Mfumo: UWALEMI Management System`, 196, 48, { align: 'right' });

  return 52; // Next Y coordinate
};

/**
 * Draw Official Signatures block at bottom
 */
const drawSignatures = (doc: jsPDF, startY: number, members: UwalemiMember[] = []) => {
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const isLandscape = pageWidth > 250;

  let y = startY;
  if (y + 35 > pageHeight) {
    doc.addPage();
    y = 20;
  }

  // Find leaders
  const mwenyekiti = members.find(m => m.role === 'Mwenyekiti') || members.find(m => m.role === 'Makamu Mwenyekiti');
  const katibu = members.find(m => m.role === 'Katibu') || members.find(m => m.role === 'Katibu Msaidizi');
  const mwekaHazina = members.find(m => m.role === 'Mweka Hazina') || members.find(m => m.role === 'Mweka Hazina Msaidizi');

  const mwenyekitiName = mwenyekiti?.fullName || 'Jimson Lema';
  const mwenyekitiTitle = mwenyekiti ? (mwenyekiti.role === 'Makamu Mwenyekiti' ? 'Makamu Mwenyekiti' : 'Mwenyekiti wa Kikundi') : 'Mwenyekiti wa Kikundi';

  const katibuName = katibu?.fullName || '....................................';
  const katibuTitle = katibu ? (katibu.role === 'Katibu Msaidizi' ? 'Katibu Msaidizi' : 'Katibu Mkuu') : 'Katibu Mkuu';

  const hazinaName = mwekaHazina?.fullName || '....................................';
  const hazinaTitle = mwekaHazina ? (mwekaHazina.role === 'Mweka Hazina Msaidizi' ? 'Mweka Hazina Msaidizi' : 'Mweka Hazina') : 'Mweka Hazina';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('UTHIBITISHO NA SAHIHI ZA UONGOZI WA UWALEMI:', 14, y);

  y += 12;

  if (isLandscape) {
    // Landscape 3 Columns
    doc.setDrawColor(148, 163, 184);
    // Col 1: Mwenyekiti
    doc.line(14, y, 84, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(mwenyekitiName, 14, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(mwenyekitiTitle, 14, y + 8);

    // Col 2: Katibu
    doc.line(105, y, 175, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(katibuName, 105, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`${katibuTitle} • Uthibitisho wa Kumbukumbu`, 105, y + 8);

    // Col 3: Mweka Hazina
    doc.line(200, y, 270, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(hazinaName, 200, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`${hazinaTitle} • Hesabu na Fedha`, 200, y + 8);
  } else {
    // Portrait 3 Columns
    // Mwenyekiti
    doc.setDrawColor(148, 163, 184);
    doc.line(14, y, 64, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(mwenyekitiName, 14, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text(mwenyekitiTitle, 14, y + 8);

    // Katibu
    doc.line(80, y, 130, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(katibuName, 80, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text(`${katibuTitle} • Kumbukumbu`, 80, y + 8);

    // Mweka Hazina
    doc.line(146, y, 196, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(hazinaName, 146, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text(`${hazinaTitle} • Hesabu & Fedha`, 146, y + 8);
  }

  // Footer page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `Ukurasa ${i} kati ya ${totalPages} • Taarifa Rasmi ya UWALEMI • Siri na Salama`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }
};

export interface ReportPeriodFilter {
  mode?: 'month' | 'year' | 'multi_year' | 'custom_dates';
  year?: number;
  month?: number | 'all';
  startYear?: number;
  endYear?: number;
  startDate?: string;
  endDate?: string;
  periodLabel?: string;
}

export function normalizeDateToISO(dateStr?: string, year?: number, month?: number): string {
  if (dateStr && typeof dateStr === 'string' && dateStr.trim()) {
    const s = dateStr.trim();
    // Case 1: YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (isoMatch) {
      const y = isoMatch[1];
      const m = isoMatch[2].padStart(2, '0');
      const d = isoMatch[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // Case 2: DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (ddmmyyyy) {
      const d = ddmmyyyy[1].padStart(2, '0');
      const m = ddmmyyyy[2].padStart(2, '0');
      const y = ddmmyyyy[3];
      return `${y}-${m}-${d}`;
    }
    // Try native Date parsing
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // Fallback: construct date from year and month if available
  if (year && month) {
    const y = year;
    const m = String(month).padStart(2, '0');
    return `${y}-${m}-15`;
  }
  if (year) {
    return `${year}-06-15`;
  }
  return '';
}

export const GROUP_START_YEAR = 2023;
export const GROUP_START_MONTH = 11; // November 2023

export function calculateExpectedFeeMonths(
  periodFilter: ReportPeriodFilter,
  groupStartYear = GROUP_START_YEAR,
  groupStartMonth = GROUP_START_MONTH
): number {
  if (!periodFilter) return 12;

  // 1. Single Year Mode (e.g. 2023 or 2024)
  if (periodFilter.mode === 'year' || !periodFilter.mode) {
    const y = periodFilter.year || new Date().getFullYear();
    if (y < groupStartYear) return 0;
    if (y === groupStartYear) {
      return Math.max(0, 12 - groupStartMonth + 1); // 12 - 11 + 1 = 2 months
    }
    return 12;
  }

  // 2. Single Month Mode
  if (periodFilter.mode === 'month') {
    const y = periodFilter.year || new Date().getFullYear();
    const m = periodFilter.month;
    if (m === 'all' || !m) {
      if (y < groupStartYear) return 0;
      if (y === groupStartYear) return Math.max(0, 12 - groupStartMonth + 1);
      return 12;
    }
    const numM = Number(m);
    if (y < groupStartYear || (y === groupStartYear && numM < groupStartMonth)) return 0;
    return 1;
  }

  // 3. Multi-Year Mode (e.g. 2023 to 2026)
  if (periodFilter.mode === 'multi_year') {
    const sY = Math.min(periodFilter.startYear || 2023, periodFilter.endYear || 2026);
    const eY = Math.max(periodFilter.startYear || 2023, periodFilter.endYear || 2026);
    let totalMonths = 0;
    for (let y = sY; y <= eY; y++) {
      if (y < groupStartYear) continue;
      if (y === groupStartYear) {
        totalMonths += Math.max(0, 12 - groupStartMonth + 1);
      } else {
        totalMonths += 12;
      }
    }
    return totalMonths;
  }

  // 4. Custom Dates Mode (e.g. 2023-01-01 to 2023-12-31 or 2023-11-01 to 2024-12-31)
  if (periodFilter.mode === 'custom_dates') {
    const startDate = periodFilter.startDate || '2023-01-01';
    const endDate = periodFilter.endDate || '2026-12-31';
    const sY = Number(startDate.substring(0, 4)) || 2023;
    const sM = Number(startDate.substring(5, 7)) || 1;
    const eY = Number(endDate.substring(0, 4)) || 2026;
    const eM = Number(endDate.substring(5, 7)) || 12;

    const startYM = sY * 12 + sM;
    const endYM = eY * 12 + eM;
    const groupStartYM = groupStartYear * 12 + groupStartMonth;

    let validMonths = 0;
    for (let ym = startYM; ym <= endYM; ym++) {
      if (ym >= groupStartYM) {
        validMonths++;
      }
    }
    return validMonths;
  }

  return 12;
}

export interface ActiveMonthItem {
  year: number;
  month: number;
  label: string;
}

export function getActiveMonthsForPeriod(
  periodFilter: ReportPeriodFilter,
  groupStartYear = GROUP_START_YEAR,
  groupStartMonth = GROUP_START_MONTH
): ActiveMonthItem[] {
  const result: ActiveMonthItem[] = [];
  const shortYear = (y: number) => String(y).substring(2);
  const monthName = (m: number) => MONTH_NAMES_SW[m - 1] ? MONTH_NAMES_SW[m - 1].substring(0, 3) : `M${m}`;

  if (periodFilter.mode === 'month') {
    const y = periodFilter.year || new Date().getFullYear();
    if (periodFilter.month === 'all' || !periodFilter.month) {
      for (let m = 1; m <= 12; m++) {
        const isBeforeStart = y < groupStartYear || (y === groupStartYear && m < groupStartMonth);
        if (!isBeforeStart) {
          result.push({ year: y, month: m, label: `${shortYear(y)}-${monthName(m)}` });
        }
      }
    } else {
      const m = Number(periodFilter.month);
      const isBeforeStart = y < groupStartYear || (y === groupStartYear && m < groupStartMonth);
      if (!isBeforeStart) {
        result.push({ year: y, month: m, label: `${shortYear(y)}-${monthName(m)}` });
      }
    }
  } else if (periodFilter.mode === 'year') {
    const y = periodFilter.year || new Date().getFullYear();
    for (let m = 1; m <= 12; m++) {
      const isBeforeStart = y < groupStartYear || (y === groupStartYear && m < groupStartMonth);
      if (!isBeforeStart) {
        result.push({ year: y, month: m, label: `${shortYear(y)}-${monthName(m)}` });
      }
    }
  } else if (periodFilter.mode === 'multi_year') {
    const startY = periodFilter.startYear || groupStartYear;
    const endY = periodFilter.endYear || new Date().getFullYear();
    for (let y = startY; y <= endY; y++) {
      for (let m = 1; m <= 12; m++) {
        const isBeforeStart = y < groupStartYear || (y === groupStartYear && m < groupStartMonth);
        if (!isBeforeStart) {
          result.push({ year: y, month: m, label: `${shortYear(y)}-${monthName(m)}` });
        }
      }
    }
  } else if (periodFilter.mode === 'custom_dates') {
    const startIso = periodFilter.startDate ? normalizeDateToISO(periodFilter.startDate) : null;
    const endIso = periodFilter.endDate ? normalizeDateToISO(periodFilter.endDate) : null;

    let startY = startIso ? Number(startIso.substring(0, 4)) : groupStartYear;
    let startM = startIso ? Number(startIso.substring(5, 7)) : groupStartMonth;
    let endY = endIso ? Number(endIso.substring(0, 4)) : new Date().getFullYear();
    let endM = endIso ? Number(endIso.substring(5, 7)) : 12;

    let currY = startY;
    let currM = startM;

    while (currY < endY || (currY === endY && currM <= endM)) {
      const isBeforeStart = currY < groupStartYear || (currY === groupStartYear && currM < groupStartMonth);
      if (!isBeforeStart) {
        result.push({ year: currY, month: currM, label: `${shortYear(currY)}-${monthName(currM)}` });
      }
      currM++;
      if (currM > 12) {
        currM = 1;
        currY++;
      }
    }
  }

  if (result.length === 0) {
    result.push({ year: 2023, month: 11, label: '23-Nov' });
    result.push({ year: 2023, month: 12, label: '23-Dec' });
  }

  return result;
}

export function getMonthlyBreakdownString(
  memberId: string,
  monthlyPayments: UwalemiMonthlyPayment[],
  periodFilter: ReportPeriodFilter,
  groupStartYear = GROUP_START_YEAR,
  groupStartMonth = GROUP_START_MONTH
): string {
  const recs = monthlyPayments.filter(
    p => p.memberId === memberId && isPeriodMatch(periodFilter, p.year, p.month, p.paymentDate)
  );

  if (recs.length === 0) {
    return 'Bado hajalipa';
  }

  // Sort payments chronologically
  recs.sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));

  return recs
    .map(p => {
      const mName = MONTH_NAMES_SW[p.month - 1] ? MONTH_NAMES_SW[p.month - 1].substring(0, 3) : `M${p.month}`;
      const amountFormatted = (p.paidAmount || 0).toLocaleString();
      return `${mName}: ${amountFormatted}`;
    })
    .join(' | ');
}

export function getYearlyMonthMatrixRow(
  memberId: string,
  year: number,
  monthlyPayments: UwalemiMonthlyPayment[],
  groupStartYear = GROUP_START_YEAR,
  groupStartMonth = GROUP_START_MONTH
) {
  const cells: string[] = [];
  let totalPaidInYear = 0;

  for (let m = 1; m <= 12; m++) {
    const isBeforeStart = year < groupStartYear || (year === groupStartYear && m < groupStartMonth);
    if (isBeforeStart) {
      cells.push('-');
      continue;
    }

    const rec = monthlyPayments.find(p => p.memberId === memberId && Number(p.year) === Number(year) && Number(p.month) === Number(m));
    if (rec && Number(rec.paidAmount) > 0) {
      const paid = Number(rec.paidAmount);
      totalPaidInYear += paid;
      const formattedAmt = paid.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      cells.push(formattedAmt);
    } else {
      cells.push('0');
    }
  }

  return { cells, totalPaidInYear };
}

export function isPeriodMatch(
  periodFilter: ReportPeriodFilter,
  itemYear: number,
  itemMonth: number,
  dateStr?: string
): boolean {
  if (!periodFilter) return true;

  // 1. Multi-Year Mode (e.g. 2023 to 2026)
  if (periodFilter.mode === 'multi_year') {
    const startY = Math.min(periodFilter.startYear || 2023, periodFilter.endYear || 2026);
    const endY = Math.max(periodFilter.startYear || 2023, periodFilter.endYear || 2026);
    
    let effYear = itemYear;
    if (!effYear && dateStr) {
      const iso = normalizeDateToISO(dateStr);
      if (iso) effYear = Number(iso.substring(0, 4));
    }
    if (!effYear) return true;
    return effYear >= startY && effYear <= endY;
  }

  // 2. Custom Dates Mode (e.g. 2023-11-01 to 2024-12-31)
  if (periodFilter.mode === 'custom_dates') {
    const startDate = periodFilter.startDate || '2023-01-01';
    const endDate = periodFilter.endDate || '2026-12-31';
    
    // Check by ISO date string if valid dateStr exists
    const isoDate = normalizeDateToISO(dateStr, itemYear, itemMonth);
    const matchesIso = isoDate ? (isoDate >= startDate && isoDate <= endDate) : false;

    // Check by year/month if itemYear and itemMonth exist (e.g. Nov 2023 = 2023*12 + 11)
    let matchesYM = false;
    if (itemYear && itemMonth) {
      const sY = Number(startDate.substring(0, 4)) || 2023;
      const sM = Number(startDate.substring(5, 7)) || 1;
      const eY = Number(endDate.substring(0, 4)) || 2026;
      const eM = Number(endDate.substring(5, 7)) || 12;

      const startYM = sY * 12 + sM;
      const endYM = eY * 12 + eM;
      const itemYM = itemYear * 12 + Number(itemMonth);

      matchesYM = itemYM >= startYM && itemYM <= endYM;
    }

    return matchesIso || matchesYM;
  }

  // 3. Single Month Mode
  if (periodFilter.mode === 'month') {
    const targetYear = periodFilter.year;
    const targetMonth = periodFilter.month;
    if (targetMonth === 'all' || !targetMonth) {
      return Number(itemYear) === Number(targetYear);
    }
    return Number(itemYear) === Number(targetYear) && Number(itemMonth) === Number(targetMonth);
  }

  // 4. Single Year Mode (Default)
  const targetYear = periodFilter.year || new Date().getFullYear();
  if (periodFilter.month && periodFilter.month !== 'all') {
    return Number(itemYear) === Number(targetYear) && Number(itemMonth) === Number(periodFilter.month);
  }
  return Number(itemYear) === Number(targetYear);
}

/**
 * Helper to determine if registration fee (kiingilio cha uanzilishi wa kikundi)
 * should be included in the report.
 * Kiingilio belongs strictly to the inception/founding year (2023).
 * It should NOT appear in reports for subsequent years (2024, 2025, 2026...).
 * For multi-year reports, it only appears if the period range covers the founding year 2023.
 */
export function shouldIncludeRegistrationFee(periodFilter?: ReportPeriodFilter): boolean {
  if (!periodFilter) return false;
  if (periodFilter.mode === 'month') {
    return false; // Monthly reports focus solely on that month's operations
  }
  if (periodFilter.mode === 'year') {
    return Number(periodFilter.year) === 2023;
  }
  if (periodFilter.mode === 'multi_year') {
    const startY = Math.min(periodFilter.startYear || 2023, periodFilter.endYear || 2026);
    const endY = Math.max(periodFilter.startYear || 2023, periodFilter.endYear || 2026);
    return startY <= 2023 && endY >= 2023;
  }
  if (periodFilter.mode === 'custom_dates') {
    const sY = Number((periodFilter.startDate || '2023').substring(0, 4)) || 2023;
    const eY = Number((periodFilter.endDate || '2026').substring(0, 4)) || 2026;
    return sY <= 2023 && eY >= 2023;
  }
  return false;
}

/**
 * 1. RIPOTI YA KIFEDHA & HAZINA (Financial & Treasury PDF Report)
 */
export const generateFinancialReportPDF = (
  state: UwalemiState,
  yearOrFilter: number | ReportPeriodFilter,
  monthParam?: number
): jsPDF => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const members = sortMembersByLeadership(state.members || []);

  let periodFilter: ReportPeriodFilter;
  if (typeof yearOrFilter === 'number') {
    periodFilter = {
      mode: monthParam ? 'month' : 'year',
      year: yearOrFilter,
      month: monthParam || 'all',
      periodLabel: monthParam ? `Mwezi wa ${MONTH_NAMES_SW[monthParam - 1]} ${yearOrFilter}` : `Mwaka Mzima wa ${yearOrFilter}`
    };
  } else {
    periodFilter = yearOrFilter;
  }

  const monthlyPayments = (state.monthlyPayments || []).filter(p => isPeriodMatch(periodFilter, p.year, p.month, p.paymentDate));
  const emergencyFunds = state.emergencyFunds || [];
  const expenses = (state.expenses || []).filter(e => {
    const iso = normalizeDateToISO(e.date);
    const y = iso ? Number(iso.substring(0, 4)) : 0;
    const m = iso ? Number(iso.substring(5, 7)) : 0;
    return isPeriodMatch(periodFilter, y, m, e.date);
  });

  const periodTitle = periodFilter.periodLabel || (periodFilter.month && periodFilter.month !== 'all'
    ? `Mwezi wa ${MONTH_NAMES_SW[Number(periodFilter.month) - 1]} ${periodFilter.year}`
    : periodFilter.mode === 'multi_year'
    ? `Kipindi cha Miaka ${periodFilter.startYear} - ${periodFilter.endYear}`
    : periodFilter.mode === 'custom_dates'
    ? `Kipindi cha ${periodFilter.startDate} hadi ${periodFilter.endDate}`
    : `Mwaka Mzima wa ${periodFilter.year}`);

  let currentY = drawOfficialHeader(
    doc,
    state,
    'TAARIFA YA MAPATO, MATUMIZI NA SALIO LA HAZINA',
    `Kipindi cha Taarifa: ${periodTitle}`
  );

  // Registration Fee inclusion rule: ONLY 2023 or periods covering 2023
  const includeRegFee = shouldIncludeRegistrationFee(periodFilter);

  // Financial Inflows Calculation
  const totalMonthlyCollected = monthlyPayments.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
  const totalRegFees = includeRegFee ? members.reduce((sum, m) => {
    if (m.registrationFeePaidAmount !== undefined) return sum + m.registrationFeePaidAmount;
    return sum + (m.registrationFeePaid ? (Number(m.registrationFeeAmount) || 0) : 0);
  }, 0) : 0;
  const totalRegFeesUnpaid = includeRegFee ? members.reduce((sum, m) => {
    const expected = Number(m.registrationFeeAmount) || 0;
    const paid = m.registrationFeePaidAmount !== undefined ? m.registrationFeePaidAmount : (m.registrationFeePaid ? expected : 0);
    return sum + Math.max(0, expected - paid);
  }, 0) : 0;

  // Meeting Fines Calculation
  let totalMeetingFinesCollected = 0;
  let totalMeetingFinesUnpaid = 0;
  let fineTransactionsCount = 0;

  const defaultAbsentFine = state.groupSettings?.meetingFineDefault || 10000;
  const defaultLateFine = state.groupSettings?.meetingFineLateDefault || 2000;

  (state.meetings || []).forEach(mtg => {
    const iso = normalizeDateToISO(mtg.date);
    const mYear = iso ? Number(iso.substring(0, 4)) : 0;
    const mMonth = iso ? Number(iso.substring(5, 7)) : 0;

    if (isPeriodMatch(periodFilter, mYear, mMonth, mtg.date)) {
      (mtg.attendees || []).forEach(att => {
        let fine = Number(att.fineAmount) || 0;
        if (fine === 0) {
          if (att.status === 'absent') fine = defaultAbsentFine;
          else if (att.status === 'late') fine = defaultLateFine;
        }
        if (fine > 0) {
          fineTransactionsCount++;
          if (att.finePaid) {
            totalMeetingFinesCollected += fine;
          } else {
            totalMeetingFinesUnpaid += fine;
          }
        }
      });
    }
  });

  let emergencyCollectedInPeriod = 0;
  emergencyFunds.forEach(ef => {
    (ef.payments || []).forEach(p => {
      const iso = normalizeDateToISO(p.paymentDate);
      const pYear = iso ? Number(iso.substring(0, 4)) : 0;
      const pMonth = iso ? Number(iso.substring(5, 7)) : 0;
      if (isPeriodMatch(periodFilter, pYear, pMonth, p.paymentDate)) {
        emergencyCollectedInPeriod += Number(p.amount) || 0;
      }
    });
  });

  // Late Fee Penalty Calculation (>Miezi 3)
  let totalLateFeePenalty = 0;
  members.forEach(m => {
    const debtInfo = calculateMemberFeeDebt(m, state);
    totalLateFeePenalty += (debtInfo.lateFeePenalty || 0);
  });

  const totalInflows = totalMonthlyCollected + totalRegFees + totalMeetingFinesCollected + emergencyCollectedInPeriod;
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netSurplus = totalInflows - totalExpenses;

  // 1. Summary Cards in Table format
  const summaryBody: any[] = [
    ['Ada za Kila Mwezi Zilizokusanywa', formatTZS(totalMonthlyCollected), `${monthlyPayments.length} miamala ya ada`],
  ];

  if (includeRegFee) {
    summaryBody.push([
      'Ada za Kiingilio / Usajili (2023)',
      formatTZS(totalRegFees),
      `${members.filter(m => m.registrationFeePaid).length} wanachama wamelipa kiingilio (Mwaka 2023)`
    ]);
  }

  summaryBody.push(
    ['Faini za Vikao Zilizokusanywa', formatTZS(totalMeetingFinesCollected), `${fineTransactionsCount} faini zilizolipiwa hazina kwajili ya vikao`],
    ['Michango ya Dharura & Misiba', formatTZS(emergencyCollectedInPeriod), 'Michango iliyokusanywa kipindi hiki'],
    ['JUMLA KUU YA MAPATO (INFLOWS)', formatTZS(totalInflows), 'Jumla ya fedha zote zilizopokelewa hazina'],
    ['JUMLA KUU YA MATUMIZI (OUTFLOWS)', formatTZS(totalExpenses), `${expenses.length} miamala ya matumizi`],
    ['SALIO HALISI LA HAZINA (NET BALANCE)', formatTZS(netSurplus), netSurplus >= 0 ? 'FAIDA / SALIO CHANYA' : 'UPUNGUFU']
  );

  autoTable(doc, {
    startY: currentY,
    head: [['MUHTASARI WA FEDHA & MAPATO', 'KIASI (TZS)', 'MAELEZO']],
    body: summaryBody,
    theme: 'grid',
    headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { textColor: [0, 0, 0], fontSize: 8.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 80, textColor: [0, 0, 0] },
      1: { fontStyle: 'bold', halign: 'right', cellWidth: 45, textColor: [0, 0, 0] },
      2: { textColor: [0, 0, 0] }
    },
    didParseCell: (data) => {
      const lastIdx = summaryBody.length - 1;
      if (data.row.index === lastIdx - 2 || data.row.index === lastIdx - 1) {
        data.cell.styles.fillColor = [248, 250, 252];
      }
      if (data.row.index === lastIdx) {
        data.cell.styles.fillColor = [236, 253, 245];
        data.cell.styles.textColor = [4, 120, 87];
      }
    }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 6;

  // Outstanding Debts Table
  const debtRows: any[] = [];
  if (includeRegFee && totalRegFeesUnpaid > 0) {
    debtRows.push([
      'Madeni ya Kiingilio (Unpaid Registration Fees 2023)',
      formatTZS(totalRegFeesUnpaid),
      `${members.filter(m => !m.registrationFeePaid).length} wanachama hawajalipa kiingilio cha 2023`
    ]);
  }
  debtRows.push(
    [
      'Madeni ya Faini za Ada (>Miezi 3 ya Kuchelewa)',
      formatTZS(totalLateFeePenalty),
      'Faini ya TZS 5,000 kwa kila mwezi unaozidi miezi 3 ya deni'
    ],
    [
      'Madeni ya Faini za Vikao (Unpaid Meeting Fines)',
      formatTZS(totalMeetingFinesUnpaid),
      'Faini za utoro/kuchelewa vikao zilizotozwa lakini hazijalipwa'
    ],
    [
      'JUMLA YA MADENI YA FAINI ZOTE BADO KULIPWA',
      formatTZS(totalLateFeePenalty + totalMeetingFinesUnpaid),
      'Jumla ya faini za ada na faini za vikao zote zinazodaiwa'
    ]
  );

  autoTable(doc, {
    startY: currentY,
    head: [['MUHTASARI WA MADENI YA KIKUNDI (OUTSTANDING DEBTS)', 'KIASI (TZS)', 'HALI YA MADENI']],
    body: debtRows,
    theme: 'grid',
    headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { textColor: [0, 0, 0], fontSize: 8 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 80, textColor: [0, 0, 0] },
      1: { fontStyle: 'bold', halign: 'right', cellWidth: 45, textColor: [180, 83, 9] },
      2: { textColor: [0, 0, 0] }
    }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 8;

  // 2. Expenses Breakdown Table
  if (expenses.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('ORODHA YA MATUMIZI YALIYOFANYIKA (EXPENSES):', 14, currentY);
    currentY += 3;

    const expenseRows = expenses.map((exp, idx) => [
      idx + 1,
      exp.date,
      exp.title,
      exp.category.toUpperCase(),
      exp.paidTo || '-',
      exp.approvedBy || '-',
      formatTZS(exp.amount)
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Tarehe', 'Aina ya Matumizi', 'Kundi', 'Mlipwaji', 'Mwidhinishaji', 'Kiasi']],
      body: expenseRows,
      theme: 'striped',
      headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { textColor: [0, 0, 0], fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center', textColor: [0, 0, 0] },
        1: { cellWidth: 22, textColor: [0, 0, 0] },
        2: { cellWidth: 45, fontStyle: 'bold', textColor: [0, 0, 0] },
        3: { cellWidth: 25, textColor: [0, 0, 0] },
        4: { cellWidth: 30, textColor: [0, 0, 0] },
        5: { cellWidth: 30, textColor: [0, 0, 0] },
        6: { cellWidth: 25, halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] }
      }
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('Hakuna rekodi za matumizi katika kipindi hiki.', 14, currentY + 5);
    currentY += 15;
  }

  // 2B. Meeting Fines Detailed Breakdown Table
  const periodMeetingFinesPdfRows: any[] = [];
  (state.meetings || []).forEach(mtg => {
    const iso = normalizeDateToISO(mtg.date);
    const mYear = iso ? Number(iso.substring(0, 4)) : 0;
    const mMonth = iso ? Number(iso.substring(5, 7)) : 0;
    if (isPeriodMatch(periodFilter, mYear, mMonth, mtg.date)) {
      (mtg.attendees || []).forEach(att => {
        let fine = Number(att.fineAmount) || 0;
        if (fine === 0) {
          if (att.status === 'absent') fine = defaultAbsentFine;
          else if (att.status === 'late') fine = defaultLateFine;
        }
        if (fine > 0) {
          const mMember = members.find(m => m.id === att.memberId || m.memberNo === att.memberNo);
          periodMeetingFinesPdfRows.push([
            periodMeetingFinesPdfRows.length + 1,
            mtg.date,
            mtg.title || 'Mkutano',
            mMember ? `${mMember.fullName} (${mMember.memberNo})` : (att.memberName || att.memberNo || 'Mjumbe'),
            att.status === 'absent' ? 'Kutohudhuria Kikao (Utoro)' : 'Kuchelewa Kikao',
            formatTZS(fine),
            att.finePaid ? 'IMELIPWA' : 'HAIJALIPWA'
          ]);
        }
      });
    }
  });

  if (periodMeetingFinesPdfRows.length > 0) {
    if (currentY + 35 > doc.internal.pageSize.height) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('ORODHA NA MCHANGANUO WA FAINI ZA VIKAO (UTORO & KUCHELEWA):', 14, currentY);
    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Tarehe', 'Kikao', 'Mjumbe', 'Sababu / Aina ya Faini', 'Kiasi', 'Hali']],
      body: periodMeetingFinesPdfRows,
      theme: 'striped',
      headStyles: { fillColor: [126, 34, 206], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { textColor: [0, 0, 0], fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center', textColor: [0, 0, 0] },
        1: { cellWidth: 20, textColor: [0, 0, 0] },
        2: { cellWidth: 35, fontStyle: 'bold', textColor: [0, 0, 0] },
        3: { cellWidth: 45, textColor: [0, 0, 0] },
        4: { cellWidth: 32, textColor: [0, 0, 0] },
        5: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] },
        6: { cellWidth: 23, halign: 'center', fontStyle: 'bold', textColor: [0, 0, 0] }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          if (data.cell.raw === 'IMELIPWA') {
            data.cell.styles.textColor = [5, 150, 105];
          } else {
            data.cell.styles.textColor = [220, 38, 38];
          }
        }
      }
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 10;
  }

  // 3. ORODHA YA WANACHAMA NA MCHANGANUO WA FEDHA (MEMBERS FINANCIAL BREAKDOWN)
  if (currentY + 45 > doc.internal.pageSize.height) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text('ORODHA YA WANACHAMA NA MCHANGANUO WA FEDHA ZA KILA MJUMBE:', 14, currentY);
  currentY += 4;

  const activeMonths = getActiveMonthsForPeriod(periodFilter);

  const headRows: any[] = includeRegFee ? [[
    '#',
    'Namba',
    'Jina Kamili la Mjumbe',
    'KIINGILIO',
    'ADA MWEZI',
    'FAINI ADA',
    'FAINI VIKAO',
    'DHARURA',
    'JUMLA KUU',
    'DENI & FAINI',
    'HALI'
  ]] : [[
    '#',
    'Namba',
    'Jina Kamili la Mjumbe',
    'ADA MWEZI',
    'FAINI ADA',
    'FAINI VIKAO',
    'DHARURA',
    'JUMLA KUU',
    'DENI & FAINI',
    'HALI'
  ]];

  const defaultMonthlyFee = Number(state.groupSettings?.monthlyFeeDefault) || 0;
  const expectedFeeMonths = calculateExpectedFeeMonths(periodFilter);

  const memberRows = members.map((m, idx) => {
    // 1. Registration Fee (Kiingilio - Only applicable in founding year 2023 or periods covering 2023)
    const regFeeAmount = includeRegFee ? (Number(m.registrationFeeAmount) || 0) : 0;
    const regPaid = includeRegFee ? (m.registrationFeePaidAmount !== undefined ? m.registrationFeePaidAmount : (m.registrationFeePaid ? regFeeAmount : 0)) : 0;
    const regDebt = includeRegFee ? Math.max(0, regFeeAmount - regPaid) : 0;

    const feeExpected = activeMonths.reduce((sum, am) => sum + getDefaultFeeForMonth(am.year, am.month, m.monthlyFeeAmount), 0);
    const recs = monthlyPayments.filter(p => p.memberId === m.id && isPeriodMatch(periodFilter, p.year, p.month, p.paymentDate));
    const feePaid = recs.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
    const feeDebt = Math.max(0, feeExpected - feePaid);

    // Calculate late fee penalty for arrears > 3 months (5,000 TZS per month)
    const memberDebtInfo = calculateMemberFeeDebt(m, state);
    const lateFeePenalty = memberDebtInfo.lateFeePenalty || 0;

    // 3. Meeting Fines in Period
    let meetingFinesPaid = 0;
    let meetingFinesDebt = 0;
    (state.meetings || []).forEach(mtg => {
      const iso = normalizeDateToISO(mtg.date);
      const mYear = iso ? Number(iso.substring(0, 4)) : 0;
      const mMonth = iso ? Number(iso.substring(5, 7)) : 0;
      if (isPeriodMatch(periodFilter, mYear, mMonth, mtg.date)) {
        const att = (mtg.attendees || []).find(a => a.memberId === m.id || a.memberNo === m.memberNo);
        if (att) {
          let fAmt = Number(att.fineAmount) || 0;
          if (fAmt === 0) {
            if (att.status === 'absent') fAmt = defaultAbsentFine;
            else if (att.status === 'late') fAmt = defaultLateFine;
          }
          if (fAmt > 0) {
            if (att.finePaid) meetingFinesPaid += fAmt;
            else meetingFinesDebt += fAmt;
          }
        }
      }
    });

    // 4. Emergency Contributions in Period
    let emergencyPaid = 0;
    (state.emergencyFunds || []).forEach(ef => {
      (ef.payments || []).forEach(p => {
        if (p.memberId === m.id) {
          const iso = normalizeDateToISO(p.paymentDate);
          const pYear = iso ? Number(iso.substring(0, 4)) : 0;
          const pMonth = iso ? Number(iso.substring(5, 7)) : 0;
          if (isPeriodMatch(periodFilter, pYear, pMonth, p.paymentDate)) {
            emergencyPaid += Number(p.amount) || 0;
          }
        }
      });
    });

    const totalFinesDebt = lateFeePenalty + meetingFinesDebt;
    // Grand total paid across all streams including Kiingilio (when active in 2023)
    const grandTotalPaid = regPaid + feePaid + meetingFinesPaid + emergencyPaid;
    const totalDebt = regDebt + feeDebt + totalFinesDebt;
    const statusText = totalDebt === 0 ? 'AMELIPA' : (feePaid > 0 || regPaid > 0) ? 'PUNGUFU' : 'ANA DENI';

    const formatMeetingFinesPdfCell = (paid: number, debt: number) => {
      if (paid > 0 && debt > 0) return `${formatTZS(paid)}\nDeni: ${formatTZS(debt)}`;
      if (debt > 0) return `Deni: ${formatTZS(debt)}`;
      if (paid > 0) return formatTZS(paid);
      return 'TZS 0';
    };

    if (includeRegFee) {
      return [
        idx + 1,
        m.memberNo,
        getMemberDisplayName(m),
        regPaid > 0 ? formatTZS(regPaid) : '0.00',
        formatTZS(feePaid),
        lateFeePenalty > 0 ? formatTZS(lateFeePenalty) : '0.00',
        formatMeetingFinesPdfCell(meetingFinesPaid, meetingFinesDebt),
        formatTZS(emergencyPaid),
        formatTZS(grandTotalPaid),
        formatTZS(totalDebt),
        statusText
      ];
    } else {
      return [
        idx + 1,
        m.memberNo,
        getMemberDisplayName(m),
        formatTZS(feePaid),
        lateFeePenalty > 0 ? formatTZS(lateFeePenalty) : '0.00',
        formatMeetingFinesPdfCell(meetingFinesPaid, meetingFinesDebt),
        formatTZS(emergencyPaid),
        formatTZS(grandTotalPaid),
        formatTZS(totalDebt),
        statusText
      ];
    }
  });

  const statusColIdx = includeRegFee ? 10 : 9;

  autoTable(doc, {
    startY: currentY,
    head: headRows,
    body: memberRows,
    theme: 'grid',
    styles: { textColor: [0, 0, 0], cellPadding: 1, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 6.5, fontStyle: 'bold', halign: 'center', cellPadding: 1 },
    bodyStyles: { textColor: [0, 0, 0], fontSize: 6, halign: 'right', cellPadding: 1 },
    columnStyles: includeRegFee ? {
      0: { cellWidth: 6, halign: 'center', textColor: [0, 0, 0] },
      1: { cellWidth: 12, fontStyle: 'bold', halign: 'left', textColor: [0, 0, 0] },
      2: { cellWidth: 30, fontStyle: 'bold', halign: 'left', textColor: [0, 0, 0] },
      3: { cellWidth: 15, halign: 'right', textColor: [0, 0, 0] },
      4: { cellWidth: 16, halign: 'right', textColor: [0, 0, 0] },
      5: { cellWidth: 15, halign: 'right', textColor: [225, 29, 72] },
      6: { cellWidth: 15, halign: 'right', textColor: [0, 0, 0] },
      7: { cellWidth: 15, halign: 'right', textColor: [0, 0, 0] },
      8: { cellWidth: 19, halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] },
      9: { cellWidth: 20, halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] },
      10: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }
    } : {
      0: { cellWidth: 6, halign: 'center', textColor: [0, 0, 0] },
      1: { cellWidth: 13, fontStyle: 'bold', halign: 'left', textColor: [0, 0, 0] },
      2: { cellWidth: 35, fontStyle: 'bold', halign: 'left', textColor: [0, 0, 0] },
      3: { cellWidth: 18, halign: 'right', textColor: [0, 0, 0] },
      4: { cellWidth: 16, halign: 'right', textColor: [225, 29, 72] },
      5: { cellWidth: 16, halign: 'right', textColor: [0, 0, 0] },
      6: { cellWidth: 16, halign: 'right', textColor: [0, 0, 0] },
      7: { cellWidth: 21, halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] },
      8: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] },
      9: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.column.index === statusColIdx) {
        if (data.cell.raw === 'AMELIPA') {
          data.cell.styles.textColor = [4, 120, 87];
        } else if (data.cell.raw === 'ANA DENI') {
          data.cell.styles.textColor = [225, 29, 72];
        } else {
          data.cell.styles.textColor = [217, 119, 6];
        }
      }
    }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 10;

  // 4. JEDWALI LA MCHANGANUO WA ADA KILA MWEZI (12-MONTH MATRIX GRID)
  const targetYear = periodFilter.year || new Date().getFullYear();
  if (currentY + 40 > doc.internal.pageSize.height) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`JEDWALI LA MCHANGANUO WA ADA KILA MWEZI (MIAKA / MIEZI YA ${targetYear}):`, 14, currentY);
  currentY += 4;

  const monthShorts = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const matrixRows = members.map((m, idx) => {
    const { cells, totalPaidInYear } = getYearlyMonthMatrixRow(m.id, targetYear, monthlyPayments);
    return [
      idx + 1,
      m.memberNo,
      getMemberDisplayName(m),
      ...cells,
      totalPaidInYear.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [[
      '#',
      'Namba',
      'Jina la Mjumbe',
      ...monthShorts,
      'JUMLA'
    ]],
    body: matrixRows,
    theme: 'grid',
    styles: { cellPadding: 1.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [189, 215, 238], textColor: [0, 0, 0], fontSize: 6.5, fontStyle: 'bold', halign: 'center', lineWidth: 0.3, lineColor: [100, 116, 139] },
    bodyStyles: { textColor: [0, 0, 0], fontSize: 5.5, halign: 'center', lineWidth: 0.3, lineColor: [148, 163, 184] },
    columnStyles: {
      0: { cellWidth: 6, halign: 'center' },
      1: { cellWidth: 14, fontStyle: 'bold', halign: 'left' },
      2: { cellWidth: 32, fontStyle: 'bold', halign: 'left' },
      // months 3 to 14
      3: { cellWidth: 9.5 }, 4: { cellWidth: 9.5 }, 5: { cellWidth: 9.5 }, 6: { cellWidth: 9.5 },
      7: { cellWidth: 9.5 }, 8: { cellWidth: 9.5 }, 9: { cellWidth: 9.5 }, 10: { cellWidth: 9.5 },
      11: { cellWidth: 9.5 }, 12: { cellWidth: 9.5 }, 13: { cellWidth: 9.5 }, 14: { cellWidth: 9.5 },
      15: { cellWidth: 16, halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] }
    }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 8;

  // 3. Payment Methods Accounts Summary
  const pMethods = state.groupSettings?.paymentMethods || [];
  if (pMethods.length > 0) {
    if (currentY + 30 > 270) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('AKAUNTI ZA MAPOKEZI YA FEDHA (OFFICIAL CHANNELS):', 14, currentY);
    currentY += 3;

    const pmRows = pMethods.map(pm => [
      pm.provider,
      pm.type,
      pm.number,
      pm.accountName
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Mtoa Huduma', 'Aina', 'Namba ya Akaunti / Lipa Namba', 'Jina la Usajili']],
      body: pmRows,
      theme: 'grid',
      styles: { textColor: [0, 0, 0] },
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { textColor: [0, 0, 0], fontSize: 7.5 }
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 12;
  }

  drawSignatures(doc, currentY, state.members || []);
  return doc;
};

/**
 * 2. RIPOTI YA HALI YA WANACHAMA NA ADA (Members Ledger & Debts PDF)
 */
export const generateMembersLedgerPDF = (
  state: UwalemiState,
  yearOrFilter: number | ReportPeriodFilter,
  monthParam?: number
): jsPDF => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const members = sortMembersByLeadership(state.members || []);
  const monthlyPayments = state.monthlyPayments || [];
  const defaultMonthlyFee = Number(state.groupSettings?.monthlyFeeDefault) || 0;

  let periodFilter: ReportPeriodFilter;
  if (typeof yearOrFilter === 'number') {
    periodFilter = {
      mode: monthParam ? 'month' : 'year',
      year: yearOrFilter,
      month: monthParam || 'all',
      periodLabel: monthParam ? `Mwezi wa ${MONTH_NAMES_SW[monthParam - 1]} ${yearOrFilter}` : `Mwaka wa ${yearOrFilter}`
    };
  } else {
    periodFilter = yearOrFilter;
  }

  const periodTitle = periodFilter.periodLabel || (periodFilter.month && periodFilter.month !== 'all'
    ? `Mwezi wa ${MONTH_NAMES_SW[Number(periodFilter.month) - 1]} ${periodFilter.year}`
    : periodFilter.mode === 'multi_year'
    ? `Kipindi cha Miaka ${periodFilter.startYear} - ${periodFilter.endYear}`
    : periodFilter.mode === 'custom_dates'
    ? `Kipindi cha ${periodFilter.startDate} hadi ${periodFilter.endDate}`
    : `Mwaka Mzima wa ${periodFilter.year}`);

  let currentY = drawOfficialHeader(
    doc,
    state,
    'DAFTARI LA WANACHAMA NA HALI YA MALIPO YA ADA',
    `Kipindi: ${periodTitle} • Jumla ya Wanachama: ${members.length}`
  );

  const meetings = state.meetings || [];
  const emergencyFunds = state.emergencyFunds || [];

  const includeRegFee = shouldIncludeRegistrationFee(periodFilter);
  const activeMonths = getActiveMonthsForPeriod(periodFilter);

  const headRows: any[] = includeRegFee ? [[
    '#',
    'Namba',
    'Jina Kamili la Mjumbe',
    'Simu',
    'KIINGILIO',
    'ADA MWEZI',
    'FAINI ADA',
    'FAINI VIKAO',
    'DHARURA',
    'JUMLA KUU',
    'DENI & FAINI',
    'HALI'
  ]] : [[
    '#',
    'Namba',
    'Jina Kamili la Mjumbe',
    'Simu',
    'ADA MWEZI',
    'FAINI ADA',
    'FAINI VIKAO',
    'DHARURA',
    'JUMLA KUU',
    'DENI & FAINI',
    'HALI'
  ]];

  let grandTotalPaidAll = 0;
  let grandTotalDebtAll = 0;

  const rows = members.map((m, idx) => {
    // 1. Registration Fee (Kiingilio - Only applicable in founding year 2023 or periods covering 2023)
    const regFeeAmount = includeRegFee ? (Number(m.registrationFeeAmount) || 0) : 0;
    const regPaid = includeRegFee ? (m.registrationFeePaidAmount !== undefined ? m.registrationFeePaidAmount : (m.registrationFeePaid ? regFeeAmount : 0)) : 0;
    const regDebt = includeRegFee ? Math.max(0, regFeeAmount - regPaid) : 0;

    const feeExpected = activeMonths.reduce((sum, am) => sum + getDefaultFeeForMonth(am.year, am.month, m.monthlyFeeAmount), 0);
    const recs = monthlyPayments.filter(p => p.memberId === m.id && isPeriodMatch(periodFilter, p.year, p.month, p.paymentDate));
    const feePaid = recs.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
    const feeDebt = Math.max(0, feeExpected - feePaid);

    // Calculate late fee penalty for arrears > 3 months
    const memberDebtInfo = calculateMemberFeeDebt(m, state);
    const lateFeePenalty = memberDebtInfo.lateFeePenalty || 0;

    // 3. Meeting Fines in Period
    let meetingFinesPaid = 0;
    let meetingFinesDebt = 0;
    const defaultAbsentFine = state.groupSettings?.meetingFineDefault || 10000;
    const defaultLateFine = state.groupSettings?.meetingFineLateDefault || 2000;
    meetings.forEach(mtg => {
      const iso = normalizeDateToISO(mtg.date);
      const mYear = iso ? Number(iso.substring(0, 4)) : 0;
      const mMonth = iso ? Number(iso.substring(5, 7)) : 0;
      if (isPeriodMatch(periodFilter, mYear, mMonth, mtg.date)) {
        const att = (mtg.attendees || []).find(a => a.memberId === m.id || a.memberNo === m.memberNo);
        if (att) {
          let fAmt = Number(att.fineAmount) || 0;
          if (fAmt === 0) {
            if (att.status === 'absent') fAmt = defaultAbsentFine;
            else if (att.status === 'late') fAmt = defaultLateFine;
          }
          if (fAmt > 0) {
            if (att.finePaid) meetingFinesPaid += fAmt;
            else meetingFinesDebt += fAmt;
          }
        }
      }
    });

    // 4. Emergency Contributions in Period
    let emergencyPaid = 0;
    emergencyFunds.forEach(ef => {
      (ef.payments || []).forEach(p => {
        if (p.memberId === m.id) {
          const iso = normalizeDateToISO(p.paymentDate);
          const pYear = iso ? Number(iso.substring(0, 4)) : 0;
          const pMonth = iso ? Number(iso.substring(5, 7)) : 0;
          if (isPeriodMatch(periodFilter, pYear, pMonth, p.paymentDate)) {
            emergencyPaid += Number(p.amount) || 0;
          }
        }
      });
    });

    const totalFinesDebt = lateFeePenalty + meetingFinesDebt;
    // Grand total paid across all streams including Kiingilio (when active in 2023)
    const grandTotalPaid = regPaid + feePaid + meetingFinesPaid + emergencyPaid;
    const totalDebt = regDebt + feeDebt + totalFinesDebt;

    grandTotalPaidAll += grandTotalPaid;
    grandTotalDebtAll += totalDebt;

    const statusText = totalDebt === 0 ? 'AMELIPA' : (feePaid > 0 || regPaid > 0) ? 'PUNGUFU' : 'ANA DENI';

    const formatMeetingFinesPdfCell = (paid: number, debt: number) => {
      if (paid > 0 && debt > 0) return `${formatTZS(paid)}\nDeni: ${formatTZS(debt)}`;
      if (debt > 0) return `Deni: ${formatTZS(debt)}`;
      if (paid > 0) return formatTZS(paid);
      return 'TZS 0';
    };

    if (includeRegFee) {
      return [
        idx + 1,
        m.memberNo,
        getMemberDisplayName(m),
        m.phone,
        regPaid > 0 ? formatTZS(regPaid) : '0.00',
        formatTZS(feePaid),
        lateFeePenalty > 0 ? formatTZS(lateFeePenalty) : '0.00',
        formatMeetingFinesPdfCell(meetingFinesPaid, meetingFinesDebt),
        formatTZS(emergencyPaid),
        formatTZS(grandTotalPaid),
        formatTZS(totalDebt),
        statusText
      ];
    } else {
      return [
        idx + 1,
        m.memberNo,
        getMemberDisplayName(m),
        m.phone,
        formatTZS(feePaid),
        lateFeePenalty > 0 ? formatTZS(lateFeePenalty) : '0.00',
        formatMeetingFinesPdfCell(meetingFinesPaid, meetingFinesDebt),
        formatTZS(emergencyPaid),
        formatTZS(grandTotalPaid),
        formatTZS(totalDebt),
        statusText
      ];
    }
  });

  const statusColIdx = includeRegFee ? 11 : 10;

  autoTable(doc, {
    startY: currentY,
    head: headRows,
    body: rows,
    theme: 'grid',
    styles: { textColor: [0, 0, 0] },
    headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor: [0, 0, 0], fontSize: 6.5, halign: 'right' },
    columnStyles: includeRegFee ? {
      0: { cellWidth: 6, halign: 'center', textColor: [0, 0, 0] },
      1: { cellWidth: 14, fontStyle: 'bold', halign: 'left', textColor: [0, 0, 0] },
      2: { cellWidth: 34, fontStyle: 'bold', halign: 'left', textColor: [0, 0, 0] },
      3: { cellWidth: 20, halign: 'left', textColor: [0, 0, 0] },
      4: { cellWidth: 18, halign: 'right', textColor: [0, 0, 0] },
      5: { cellWidth: 18, halign: 'right', textColor: [0, 0, 0] },
      6: { cellWidth: 16, halign: 'right', textColor: [225, 29, 72] },
      7: { cellWidth: 16, halign: 'right', textColor: [0, 0, 0] },
      8: { cellWidth: 16, halign: 'right', textColor: [0, 0, 0] },
      9: { cellWidth: 20, halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] },
      10: { cellWidth: 20, halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] },
      11: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }
    } : {
      0: { cellWidth: 6, halign: 'center', textColor: [0, 0, 0] },
      1: { cellWidth: 15, fontStyle: 'bold', halign: 'left', textColor: [0, 0, 0] },
      2: { cellWidth: 40, fontStyle: 'bold', halign: 'left', textColor: [0, 0, 0] },
      3: { cellWidth: 22, halign: 'left', textColor: [0, 0, 0] },
      4: { cellWidth: 20, halign: 'right', textColor: [0, 0, 0] },
      5: { cellWidth: 18, halign: 'right', textColor: [225, 29, 72] },
      6: { cellWidth: 18, halign: 'right', textColor: [0, 0, 0] },
      7: { cellWidth: 18, halign: 'right', textColor: [0, 0, 0] },
      8: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] },
      9: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] },
      10: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.column.index === statusColIdx) {
        if (data.cell.raw === 'AMELIPA') {
          data.cell.styles.textColor = [4, 120, 87];
        } else if (data.cell.raw === 'ANA DENI') {
          data.cell.styles.textColor = [225, 29, 72];
        } else {
          data.cell.styles.textColor = [217, 119, 6];
        }
      }
    }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 10;

  // 12-MONTH MATRIX GRID IN MEMBERS LEDGER PDF
  const targetYear = periodFilter.year || new Date().getFullYear();
  if (currentY + 40 > doc.internal.pageSize.height) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`JEDWALI LA MCHANGANUO WA ADA KILA MWEZI (MIAKA / MIEZI YA ${targetYear}):`, 14, currentY);
  currentY += 4;

  const monthShorts = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const matrixRows = members.map((m, idx) => {
    const { cells, totalPaidInYear } = getYearlyMonthMatrixRow(m.id, targetYear, monthlyPayments);
    return [
      idx + 1,
      m.memberNo,
      getMemberDisplayName(m),
      ...cells,
      totalPaidInYear.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [[
      '#',
      'Namba',
      'Jina la Mjumbe',
      ...monthShorts,
      'JUMLA'
    ]],
    body: matrixRows,
    theme: 'grid',
    styles: { cellPadding: 1.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [189, 215, 238], textColor: [0, 0, 0], fontSize: 6.5, fontStyle: 'bold', halign: 'center', lineWidth: 0.3, lineColor: [100, 116, 139] },
    bodyStyles: { textColor: [0, 0, 0], fontSize: 5.5, halign: 'center', lineWidth: 0.3, lineColor: [148, 163, 184] },
    columnStyles: {
      0: { cellWidth: 6, halign: 'center' },
      1: { cellWidth: 14, fontStyle: 'bold', halign: 'left' },
      2: { cellWidth: 32, fontStyle: 'bold', halign: 'left' },
      3: { cellWidth: 9.5 }, 4: { cellWidth: 9.5 }, 5: { cellWidth: 9.5 }, 6: { cellWidth: 9.5 },
      7: { cellWidth: 9.5 }, 8: { cellWidth: 9.5 }, 9: { cellWidth: 9.5 }, 10: { cellWidth: 9.5 },
      11: { cellWidth: 9.5 }, 12: { cellWidth: 9.5 }, 13: { cellWidth: 9.5 }, 14: { cellWidth: 9.5 },
      15: { cellWidth: 16, halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] }
    }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 8;

  // Summary footer in document
  if (currentY + 35 > doc.internal.pageSize.height) {
    doc.addPage();
    currentY = 20;
  }

  autoTable(doc, {
    startY: currentY,
    head: [['JUMLA YA TARATIBU ZA KIPINDI HIKI', 'JUMLA YA FEDHA ZILIZOKUSANYWA', 'JUMLA YA MADENI YOTE YA WANACHAMA']],
    body: [[
      `Wanachama Wote: ${members.length}`,
      formatTZS(grandTotalPaidAll),
      formatTZS(grandTotalDebtAll)
    ]],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontStyle: 'bold', fontSize: 8.5, halign: 'center' }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 10;
  drawSignatures(doc, currentY, state.members || []);

  return doc;
};

/**
 * 3. RIPOTI YA MCHANGO WA DHARURA & MISIBA (Emergency Fund PDF)
 */
export const generateEmergencyFundReportPDF = (
  state: UwalemiState,
  fundId: string
): jsPDF => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fund = (state.emergencyFunds || []).find(f => f.id === fundId);
  const members = sortMembersByLeadership(state.members || []);

  if (!fund) {
    throw new Error('Mchango wa dharura haukupatikana.');
  }

  const payments = fund.payments || [];
  const totalCollected = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const target = fund.targetAmount || 1;
  const progressPercent = Math.min(100, Math.round((totalCollected / target) * 100));

  let currentY = drawOfficialHeader(
    doc,
    state,
    `RIPOTI YA MCHANGO WA DHARURA: ${fund.title}`,
    `Mfaidikaji: ${fund.beneficiaryName} (${fund.beneficiaryRelation || 'Mwanachama'}) • Tarehe ya Mwisho: ${fund.deadline}`
  );

  // Fund Metrics Table
  autoTable(doc, {
    startY: currentY,
    head: [['MAELEZO YA MFUKO WA DHARURA', 'TAARIFA / VIWANGO']],
    body: [
      ['Aina ya Mchango', fund.type.toUpperCase()],
      ['Jina la Mfaidikaji', `${fund.beneficiaryName} (${fund.beneficiaryRelation || 'Mwanachama'})`],
      ['Simu ya Mfaidikaji', fund.beneficiaryPhone || '-'],
      ['Kiwango Kinacholengwa (Target)', formatTZS(fund.targetAmount)],
      ['Lengo kwa Kila Mjumbe', formatTZS(fund.perMemberTarget || 20000)],
      ['Jumla Iliyokusanywa', `${formatTZS(totalCollected)} (${progressPercent}%)`],
      ['Hali ya Mchango', fund.status === 'disbursed' ? 'UMEKABIDHIWA KWA MFAIDIKAJI' : fund.status === 'closed' ? 'UMEFUNGWA' : 'UNAENDELEA'],
      ['Tarehe ya Kuanza & Mwisho', `${fund.startDate} hadi ${fund.deadline}`],
      ['Maelezo ya Ziada', fund.description || 'Mchango wa mshikamano wa kijamii']
    ],
    theme: 'grid',
    headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 65 },
      1: { cellWidth: 115 }
    }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 8;

  // Payments List
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`ORODHA YA WALIOCHANGA (${payments.length} MICHANGO):`, 14, currentY);
  currentY += 3;

  const paymentRows = payments.map((p, idx) => [
    idx + 1,
    p.memberNo,
    p.memberName,
    p.paymentDate,
    p.paymentMethod,
    p.referenceNo || p.receiptNo || '-',
    formatTZS(p.amount)
  ]);

  if (paymentRows.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Namba', 'Jina la Mchangiaji', 'Tarehe', 'Njia ya Malipo', 'Kumbukumbu', 'Kiasi']],
      body: paymentRows,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 20, fontStyle: 'bold' },
        2: { cellWidth: 50, fontStyle: 'bold' },
        3: { cellWidth: 22 },
        4: { cellWidth: 30 },
        5: { cellWidth: 25 },
        6: { cellWidth: 27, halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] }
      }
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 8;
  }

  // Unpaid Members list
  const paidMemberIds = new Set(payments.map(p => p.memberId));
  const unpaidMembers = members.filter(m => m.status === 'active' && !paidMemberIds.has(m.id));

  if (unpaidMembers.length > 0) {
    if (currentY + 40 > 270) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(225, 29, 72);
    doc.text(`ORODHA YA WANACHAMA AMBAO BADO HAWAJACHANGA (${unpaidMembers.length}):`, 14, currentY);
    currentY += 3;

    const unpaidRows = unpaidMembers.map((m, idx) => [
      idx + 1,
      m.memberNo,
      m.fullName,
      m.phone,
      m.role || 'Mjumbe',
      formatTZS(fund.perMemberTarget || 20000)
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Namba', 'Jina Kamili', 'Simu', 'Wadhifa', 'Kiasi Kinachodaiwa']],
      body: unpaidRows,
      theme: 'grid',
      headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 22, fontStyle: 'bold' },
        2: { cellWidth: 60, fontStyle: 'bold' },
        3: { cellWidth: 35 },
        4: { cellWidth: 25 },
        5: { cellWidth: 32, halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] }
      }
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 10;
  }

  drawSignatures(doc, currentY, state.members || []);
  return doc;
};

/**
 * 4. RIPOTI MAALUM YA FAINI NA ADHABU ZA WANACHAMA (Official Fines & Penalties PDF Report)
 */
export const generateFinesReportPDF = (
  state: UwalemiState,
  periodFilter: ReportPeriodFilter
): jsPDF => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const members = sortMembersByLeadership(state.members || []);
  const meetings = state.meetings || [];

  const periodLabel = periodFilter.periodLabel || 'Kipindi Chote';
  let currentY = drawOfficialHeader(
    doc,
    state,
    'RIPOTI MAALUM YA FAINI NA ADHABU ZA WANACHAMA',
    `Kipindi: ${periodLabel} • Kanuni ya Faini ya Ada: TZS 5,000 kila mwezi unaozidi miezi 3 ya deni`
  );

  // 1. Gather all fines metrics
  let totalMembersWithFines = 0;
  let totalLateFeePenalty = 0;
  let totalMeetingFinesPaid = 0;
  let totalMeetingFinesDebt = 0;

  const memberRowsData: any[] = [];
  const detailedMeetingFines: any[] = [];

  members.forEach(m => {
    // Late fee penalty
    const debtInfo = calculateMemberFeeDebt(m, state);
    const lateFee = debtInfo.lateFeePenalty || 0;
    const unpaidMonthsCount = debtInfo.unpaidCount || 0;
    const penaltyMonths = Math.max(0, unpaidMonthsCount - 3);

    // Meeting fines in period
    let meetingPaid = 0;
    let meetingUnpaid = 0;
    const defaultAbsentFine = state.groupSettings?.meetingFineDefault || 10000;
    const defaultLateFine = state.groupSettings?.meetingFineLateDefault || 2000;

    meetings.forEach(mtg => {
      const iso = normalizeDateToISO(mtg.date);
      const mYear = iso ? Number(iso.substring(0, 4)) : 0;
      const mMonth = iso ? Number(iso.substring(5, 7)) : 0;
      if (isPeriodMatch(periodFilter, mYear, mMonth, mtg.date)) {
        const att = (mtg.attendees || []).find(a => a.memberId === m.id || a.memberNo === m.memberNo);
        if (att) {
          let fAmt = Number(att.fineAmount) || 0;
          if (fAmt === 0) {
            if (att.status === 'absent') fAmt = defaultAbsentFine;
            else if (att.status === 'late') fAmt = defaultLateFine;
          }
          if (fAmt > 0) {
            if (att.finePaid) {
              meetingPaid += fAmt;
            } else {
              meetingUnpaid += fAmt;
            }
            detailedMeetingFines.push({
              date: mtg.date,
              title: mtg.title || 'Mkutano wa UWALEMI',
              memberNo: m.memberNo,
              memberName: getMemberDisplayName(m),
              amount: fAmt,
              paid: !!att.finePaid,
              reason: att.fineReason || (att.status === 'absent' ? 'Kutohudhuria Kikao' : 'Kuchelewa Kikao')
            });
          }
        }
      }
    });

    const totalMemberFineDebt = lateFee + meetingUnpaid;
    const totalMemberFines = lateFee + meetingUnpaid + meetingPaid;

    if (totalMemberFines > 0) {
      totalMembersWithFines++;
    }

    totalLateFeePenalty += lateFee;
    totalMeetingFinesPaid += meetingPaid;
    totalMeetingFinesDebt += meetingUnpaid;

    let feeDebtNote = 'Hakuna';
    if (unpaidMonthsCount > 0) {
      feeDebtNote = `${unpaidMonthsCount} mwezi (${penaltyMonths > 0 ? `${penaltyMonths} faini` : 'msamaha <=3M'})`;
      if (unpaidMonthsCount > 1) {
        feeDebtNote = `${unpaidMonthsCount} miezi (${penaltyMonths > 0 ? `${penaltyMonths} ya faini` : 'msamaha <=3M'})`;
      }
    }

    let statusText = 'Hakuna Faini';
    if (totalMemberFineDebt > 0) {
      statusText = 'Inadaiwa';
    } else if (meetingPaid > 0) {
      statusText = 'Imelipwa';
    }

    memberRowsData.push({
      member: m,
      unpaidMonthsCount,
      penaltyMonths,
      feeDebtNote,
      lateFee,
      meetingUnpaid,
      meetingPaid,
      totalMemberFineDebt,
      totalMemberFines,
      statusText
    });
  });

  const grandTotalFines = totalLateFeePenalty + totalMeetingFinesDebt + totalMeetingFinesPaid;
  const grandTotalFinesPending = totalLateFeePenalty + totalMeetingFinesDebt;

  // Render Summary KPI autoTable
  autoTable(doc, {
    startY: currentY,
    head: [['MUHTASARI WA FAINI & ADHABU', 'IDADI / KIASI (TZS)', 'MAELEZO YA KANUNI']],
    body: [
      ['Wanachama Wenye Faini', `${totalMembersWithFines} kati ya ${members.length}`, 'Wenye faini ya kuchelewa ada au faini za vikao'],
      ['Jumla ya Faini za Ada (>Miezi 3)', formatTZS(totalLateFeePenalty), 'TZS 5,000 kwa kila mwezi unaozidi miezi 3 ya deni'],
      ['Faini za Vikao Zisizolipwa (Deni)', formatTZS(totalMeetingFinesDebt), 'Faini za kutofika/kuchelewa vikao ambazo hazijalipwa'],
      ['Faini za Vikao Zilizolipwa', formatTZS(totalMeetingFinesPaid), 'Makusanyo ya faini za vikao yaliyokamilika'],
      ['JUMLA YA FAINI ZINAZODAIWA', formatTZS(grandTotalFinesPending), 'Faini za ada zisizolipwa + faini za vikao zisizolipwa'],
      ['JUMLA KUU YA FAINI ZOTE', formatTZS(grandTotalFines), 'Jumla ya faini zote zilizotozwa katika kipindi']
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { fontStyle: 'bold', halign: 'right', cellWidth: 55, textColor: [225, 29, 72] },
      2: { cellWidth: 145, textColor: [71, 85, 105] }
    },
    didParseCell: (data) => {
      if (data.row.index === 4) {
        data.cell.styles.fillColor = [254, 242, 242];
        data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.row.index === 5) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [15, 23, 42];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 8;

  // Main Members Fines Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text('1. ORODHA YA WANACHAMA NA MCHANGANUO WA FAINI ZAO:', 14, currentY);
  currentY += 3;

  const tableRows = memberRowsData.map((d, idx) => [
    idx + 1,
    d.member.memberNo,
    getMemberDisplayName(d.member),
    d.member.phone || '-',
    d.feeDebtNote,
    d.lateFee > 0 ? formatTZS(d.lateFee) : '0.00',
    d.meetingUnpaid > 0 ? formatTZS(d.meetingUnpaid) : '0.00',
    d.meetingPaid > 0 ? formatTZS(d.meetingPaid) : '0.00',
    formatTZS(d.totalMemberFineDebt),
    d.statusText
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [[
      '#',
      'Namba',
      'Jina Kamili la Mjumbe',
      'Simu',
      'Deni la Ada (Miezi)',
      'Faini Ada (>3M)',
      'Faini Vikao (Deni)',
      'Faini Vikao (Paid)',
      'Jumla ya Faini',
      'Hali'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor: [0, 0, 0], fontSize: 7, halign: 'right' },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 16, fontStyle: 'bold', halign: 'left' },
      2: { cellWidth: 50, fontStyle: 'bold', halign: 'left' },
      3: { cellWidth: 26, halign: 'left' },
      4: { cellWidth: 42, halign: 'left' },
      5: { cellWidth: 28, halign: 'right', textColor: [185, 28, 28] },
      6: { cellWidth: 28, halign: 'right', textColor: [185, 28, 28] },
      7: { cellWidth: 26, halign: 'right', textColor: [4, 120, 87] },
      8: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28] },
      9: { cellWidth: 19, halign: 'center', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.column.index === 9 && data.section === 'body') {
        const txt = String(data.cell.raw);
        if (txt === 'Inadaiwa') {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fillColor = [254, 242, 242];
        } else if (txt === 'Imelipwa') {
          data.cell.styles.textColor = [4, 120, 87];
          data.cell.styles.fillColor = [236, 253, 245];
        } else {
          data.cell.styles.textColor = [100, 116, 139];
        }
      }
    }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 8;

  // Table 2: Detailed Meeting Fines (if any exist)
  if (detailedMeetingFines.length > 0) {
    if (currentY + 40 > 185) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`2. KUMBUKUMBU ZA FAINI ZA VIKAO VYA UWALEMI (${detailedMeetingFines.length}):`, 14, currentY);
    currentY += 3;

    const mtgRows = detailedMeetingFines.map((f, i) => [
      i + 1,
      f.date,
      f.title,
      f.memberNo,
      f.memberName,
      f.reason,
      formatTZS(f.amount),
      f.paid ? 'Imelipwa' : 'Haijalipwa'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Tarehe', 'Kikao', 'Namba', 'Jina la Mjumbe', 'Sababu ya Faini', 'Kiasi', 'Hali']],
      body: mtgRows,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 20 },
        2: { cellWidth: 50 },
        3: { cellWidth: 16, fontStyle: 'bold' },
        4: { cellWidth: 50, fontStyle: 'bold' },
        5: { cellWidth: 60 },
        6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.column.index === 7 && data.section === 'body') {
          if (String(data.cell.raw) === 'Imelipwa') {
            data.cell.styles.textColor = [4, 120, 87];
          } else {
            data.cell.styles.textColor = [185, 28, 28];
          }
        }
      }
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 8;
  }

  // Draw Signatures
  if (currentY + 30 > 185) {
    doc.addPage();
    currentY = 20;
  }
  drawSignatures(doc, currentY, state.members || []);

  return doc;
};

/**
 * 5. RISITI RASMI YA MALIPO YA MWANACHAMA (Official Payment Receipt PDF)
 */
export const generatePaymentReceiptPDF = (receiptData: {
  receiptNo: string;
  groupName: string;
  slogan?: string;
  memberNo: string;
  memberName: string;
  memberPhone?: string;
  paymentType: string;
  periodOrTitle: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNo?: string;
  receivedBy?: string;
  note?: string;
}): jsPDF => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [148, 210] }); // A5 size portrait

  // Border Frame
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(1);
  doc.roundedRect(6, 6, 136, 198, 4, 4, 'S');

  // Top header block
  doc.setFillColor(5, 150, 105);
  doc.rect(6, 6, 136, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(receiptData.groupName.toUpperCase(), 74, 15, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.text(receiptData.slogan || 'Umoja wa Wana-Lema Mikocheni • Shida na Raha', 74, 21, { align: 'center' });

  // Receipt Badge
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(12, 34, 124, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('RISITI RASMI YA MALIPO (PAYMENT RECEIPT)', 74, 40.5, { align: 'center' });

  // Receipt Meta
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(5, 150, 105);
  doc.text(`Na. ya Risiti: ${receiptData.receiptNo}`, 14, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(`Tarehe: ${receiptData.paymentDate}`, 134, 50, { align: 'right' });

  // Details Table
  autoTable(doc, {
    startY: 54,
    head: [['MAELEZO YA MALIPO', 'TAARIFA KAMILI']],
    body: [
      ['Namba ya Mjumbe', receiptData.memberNo],
      ['Jina la Mjumbe', receiptData.memberName],
      ['Simu ya Mjumbe', receiptData.memberPhone || '-'],
      ['Aina ya Malipo', receiptData.paymentType],
      ['Madhumuni / Kipindi', receiptData.periodOrTitle],
      ['Njia ya Malipo', receiptData.paymentMethod],
      ['Namba ya Kumbukumbu', receiptData.referenceNo || 'KUTOKA MFUMONI'],
      ['Kiasi Kilicholipwa', formatTZS(receiptData.amount)],
      ['Mpokeaji / Mweka Hazina', receiptData.receivedBy || 'Uongozi wa UWALEMI']
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45 },
      1: { cellWidth: 75 }
    },
    didParseCell: (data) => {
      if (data.row.index === 7) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [236, 253, 245];
        data.cell.styles.textColor = [4, 120, 87];
        data.cell.styles.fontSize = 9;
      }
    }
  });

  // Stamp Badge (PAID / IMELIPWA)
  // @ts-ignore
  const stampY = doc.lastAutoTable.finalY + 8;
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(1.5);
  doc.roundedRect(44, stampY, 60, 16, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(5, 150, 105);
  doc.text('IMELIPWA • PAID', 74, stampY + 8, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text('IMETHIBITISHWA NA MFUMO WA UWALEMI', 74, stampY + 13, { align: 'center' });

  // Signatures
  const sigY = stampY + 28;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.5);
  doc.line(18, sigY, 58, sigY);
  doc.line(90, sigY, 130, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text('Sahihi ya Mweka Hazina', 38, sigY + 4, { align: 'center' });
  doc.text('Sahihi ya Mlipaji', 110, sigY + 4, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Risiti hii imetolewa kielektroniki kupitia Mfumo wa UWALEMI.', 74, 198, { align: 'center' });

  return doc;
};
