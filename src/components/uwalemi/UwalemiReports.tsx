import React, { useState } from 'react';
import { UwalemiState } from '../../types/uwalemi';
import { 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  Users, 
  Wallet, 
  HeartHandshake, 
  CheckCircle2, 
  FileSpreadsheet, 
  Send,
  Eye,
  ShieldCheck,
  Building,
  TrendingUp,
  Layers,
  ExternalLink,
  X,
  Search,
  AlertTriangle,
  Scale,
  Receipt,
  Plus,
  Share2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  sortMembersByLeadership, 
  getDefaultFeeForMonth, 
  calculateMemberFeeDebt, 
  calculateAllMembersFeeDebts,
  calculateLateFeePenalty
} from '../../services/uwalemiService';
import { UwalemiFinePaymentModal } from './UwalemiFinePaymentModal';
import { 
  generateFinancialReportPDF, 
  generateMembersLedgerPDF, 
  generateEmergencyFundReportPDF, 
  generateFinesReportPDF,
  downloadPdfDocument,
  getPdfBlobUrl,
  formatTZS,
  ReportPeriodFilter,
  isPeriodMatch,
  normalizeDateToISO,
  calculateExpectedFeeMonths,
  getMonthlyBreakdownString,
  getActiveMonthsForPeriod,
  shouldIncludeRegistrationFee
} from '../../services/uwalemiPdfGenerator';

interface Props {
  state: UwalemiState;
  onSaveState?: (state: UwalemiState) => Promise<boolean>;
  onOpenSmsWithTemplate?: (recipients: { name: string; phone: string; memberNo: string }[], templateText: string) => void;
}

export const UwalemiReports: React.FC<Props> = ({ state, onSaveState, onOpenSmsWithTemplate }) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const availableYears = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];
  const monthNamesSw = [
    'Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni',
    'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'
  ];

  const [reportType, setReportType] = useState<'financial' | 'members' | 'fines' | 'emergency'>('financial');
  const [filterPeriodMode, setFilterPeriodMode] = useState<'single_year' | 'single_month' | 'multi_year' | 'custom_dates'>('single_year');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  const [multiStartYear, setMultiStartYear] = useState<number>(2023);
  const [multiEndYear, setMultiEndYear] = useState<number>(2026);
  const [customStartDate, setCustomStartDate] = useState<string>('2023-01-01');
  const [customEndDate, setCustomEndDate] = useState<string>('2026-12-31');
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');
  const [finesFilterOnlyWithDebt, setFinesFilterOnlyWithDebt] = useState<boolean>(false);

  // Fine Payment Modal state
  const [isFinePaymentModalOpen, setIsFinePaymentModalOpen] = useState<boolean>(false);
  const [finePaymentModalMemberId, setFinePaymentModalMemberId] = useState<string | undefined>(undefined);
  const [finePaymentModalMeetingId, setFinePaymentModalMeetingId] = useState<string | undefined>(undefined);
  const [finePaymentModalType, setFinePaymentModalType] = useState<'kikao' | 'ada_late_fee' | 'nyingine'>('kikao');
  const [finePaymentModalAmount, setFinePaymentModalAmount] = useState<number | undefined>(undefined);

  const [selectedEmergencyId, setSelectedEmergencyId] = useState<string>(
    state.emergencyFunds?.[0]?.id || ''
  );
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<{
    show: boolean;
    fileName: string;
    blobUrl?: string;
  } | null>(null);

  const [previewPdfModal, setPreviewPdfModal] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
    fileName: string;
  } | null>(null);

  const members = sortMembersByLeadership(state.members || []);
  const monthlyPayments = state.monthlyPayments || [];
  const emergencyFunds = state.emergencyFunds || [];
  const expenses = state.expenses || [];

  const getReportPeriodFilter = (): ReportPeriodFilter => {
    if (filterPeriodMode === 'multi_year') {
      return {
        mode: 'multi_year',
        startYear: multiStartYear,
        endYear: multiEndYear,
        periodLabel: `Kipindi cha Miaka ${multiStartYear} - ${multiEndYear}`
      };
    } else if (filterPeriodMode === 'custom_dates') {
      return {
        mode: 'custom_dates',
        startDate: customStartDate,
        endDate: customEndDate,
        periodLabel: `Kipindi cha ${customStartDate} hadi ${customEndDate}`
      };
    } else if (filterPeriodMode === 'single_month') {
      if (selectedMonth === 'all') {
        return {
          mode: 'month',
          year: selectedYear,
          month: 'all',
          periodLabel: `Miezi Yote ya Mwaka ${selectedYear}`
        };
      }
      return {
        mode: 'month',
        year: selectedYear,
        month: selectedMonth,
        periodLabel: `Mwezi wa ${monthNamesSw[selectedMonth - 1]} ${selectedYear}`
      };
    } else {
      return {
        mode: 'year',
        year: selectedYear,
        month: 'all',
        periodLabel: `Mwaka Mzima wa ${selectedYear}`
      };
    }
  };

  const currentPeriodFilter = getReportPeriodFilter();
  const includeRegFee = shouldIncludeRegistrationFee(currentPeriodFilter);

  // Filtered dataset for preview using shared isPeriodMatch
  const filteredPayments = monthlyPayments.filter(p => isPeriodMatch(currentPeriodFilter, p.year, p.month, p.paymentDate));

  const filteredExpenses = expenses.filter(e => {
    const iso = normalizeDateToISO(e.date);
    const y = iso ? Number(iso.substring(0, 4)) : 0;
    const m = iso ? Number(iso.substring(5, 7)) : 0;
    return isPeriodMatch(currentPeriodFilter, y, m, e.date);
  });

  const totalMonthlyCollected = filteredPayments.reduce((s, p) => s + (Number(p.paidAmount) || 0), 0);
  const totalRegFees = includeRegFee ? members.reduce((s, m) => {
    if (m.registrationFeePaidAmount !== undefined) return s + m.registrationFeePaidAmount;
    return s + (m.registrationFeePaid ? (Number(m.registrationFeeAmount) || 0) : 0);
  }, 0) : 0;
  const totalExpensesPeriod = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  
  // Meeting Fines Period Calculation
  let totalMeetingFinesPeriodCollected = 0;
  let totalMeetingFinesPeriodUnpaid = 0;
  const meetingFinesDetailedList: {
    id: string;
    date: string;
    title: string;
    memberNo: string;
    memberName: string;
    reason: string;
    amount: number;
    paid: boolean;
  }[] = [];

  const defaultAbsentFine = state.groupSettings?.meetingFineDefault || 10000;
  const defaultLateFine = state.groupSettings?.meetingFineLateDefault || 2000;

  (state.meetings || []).forEach(mtg => {
    const iso = normalizeDateToISO(mtg.date);
    const mYear = iso ? Number(iso.substring(0, 4)) : 0;
    const mMonth = iso ? Number(iso.substring(5, 7)) : 0;
    if (isPeriodMatch(currentPeriodFilter, mYear, mMonth, mtg.date)) {
      (mtg.attendees || []).forEach(att => {
        let fine = Number(att.fineAmount) || 0;
        if (fine === 0) {
          if (att.status === 'absent') fine = defaultAbsentFine;
          else if (att.status === 'late') fine = defaultLateFine;
        }
        if (fine > 0) {
          if (att.finePaid) {
            totalMeetingFinesPeriodCollected += fine;
          } else {
            totalMeetingFinesPeriodUnpaid += fine;
          }
          const mMember = members.find(m => m.id === att.memberId || m.memberNo === att.memberNo);
          meetingFinesDetailedList.push({
            id: `${mtg.id}-${att.memberId || att.memberNo}`,
            date: mtg.date,
            title: mtg.title || 'Mkutano wa UWALEMI',
            memberNo: mMember?.memberNo || att.memberNo || '',
            memberName: mMember ? mMember.fullName : (att.memberName || 'Mjumbe'),
            reason: att.fineReason || (att.status === 'absent' ? 'Kutohudhuria Kikao (Utoro)' : 'Kuchelewa Kikao'),
            amount: fine,
            paid: !!att.finePaid
          });
        }
      });
    }
  });

  // Late Fee Penalty Period Calculation (> 3 months overdue)
  let totalLateFeePenaltyPeriod = 0;
  members.forEach(m => {
    const debtInfo = calculateMemberFeeDebt(m, state);
    totalLateFeePenaltyPeriod += (debtInfo.lateFeePenalty || 0);
  });

  const periodFinePayments = (state.finePayments || []).filter(fp => {
    const iso = normalizeDateToISO(fp.paymentDate);
    const y = iso ? Number(iso.substring(0, 4)) : 0;
    const m = iso ? Number(iso.substring(5, 7)) : 0;
    return isPeriodMatch(currentPeriodFilter, y, m, fp.paymentDate);
  });
  const totalFinePaymentsCollected = periodFinePayments.reduce((s, fp) => s + (Number(fp.amount) || 0), 0);
  const totalAllFinesPeriodCollected = Math.max(totalMeetingFinesPeriodCollected, totalFinePaymentsCollected);

  const totalAllFinesPeriodGrand = totalLateFeePenaltyPeriod + totalMeetingFinesPeriodCollected + totalMeetingFinesPeriodUnpaid;
  const totalAllFinesPeriodPending = totalLateFeePenaltyPeriod + totalMeetingFinesPeriodUnpaid;

  let emergencyCollectedInPeriod = 0;
  emergencyFunds.forEach(ef => {
    (ef.payments || []).forEach(p => {
      const iso = normalizeDateToISO(p.paymentDate);
      const pYear = iso ? Number(iso.substring(0, 4)) : 0;
      const pMonth = iso ? Number(iso.substring(5, 7)) : 0;
      if (isPeriodMatch(currentPeriodFilter, pYear, pMonth, p.paymentDate)) {
        emergencyCollectedInPeriod += Number(p.amount) || 0;
      }
    });
  });

  const totalInflowsPeriod = totalMonthlyCollected + totalRegFees + totalAllFinesPeriodCollected + emergencyCollectedInPeriod;
  const netBalancePeriod = totalInflowsPeriod - totalExpensesPeriod;

  // Selected Emergency Fund
  const currentEmergencyFund = emergencyFunds.find(f => f.id === selectedEmergencyId) || emergencyFunds[0];

  // Helper to build current document
  const getCurrentPDFDoc = (): { doc: any; fileName: string; title: string } => {
    const filter = getReportPeriodFilter();
    if (reportType === 'financial') {
      const doc = generateFinancialReportPDF(state, filter);
      const safeLabel = (filter.periodLabel || 'Kipindi').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `UWALEMI_Ripoti_Fedha_${safeLabel}.pdf`;
      const title = `Taarifa ya Fedha na Hazina (${filter.periodLabel})`;
      return { doc, fileName, title };
    } else if (reportType === 'members') {
      const doc = generateMembersLedgerPDF(state, filter);
      const safeLabel = (filter.periodLabel || 'Kipindi').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `UWALEMI_Hali_ya_Wanachama_na_Ada_${safeLabel}.pdf`;
      const title = `Daftari la Wanachama na Ada (${filter.periodLabel})`;
      return { doc, fileName, title };
    } else if (reportType === 'fines') {
      const doc = generateFinesReportPDF(state, filter);
      const safeLabel = (filter.periodLabel || 'Kipindi').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `UWALEMI_Ripoti_ya_Faini_${safeLabel}.pdf`;
      const title = `Ripoti Maalum ya Faini na Adhabu za Wanachama (${filter.periodLabel})`;
      return { doc, fileName, title };
    } else {
      if (!currentEmergencyFund) {
        throw new Error('Tafadhali chagua mchango wa dharura kwanza.');
      }
      const doc = generateEmergencyFundReportPDF(state, currentEmergencyFund.id);
      const fileName = `UWALEMI_Mchango_${currentEmergencyFund.title.replace(/\s+/g, '_')}.pdf`;
      const title = `Ripoti ya Mchango: ${currentEmergencyFund.title}`;
      return { doc, fileName, title };
    }
  };

  // Actions
  const handleDownloadPDF = () => {
    setIsGenerating(true);
    try {
      const { doc, fileName } = getCurrentPDFDoc();
      const blobUrl = downloadPdfDocument(doc, fileName);
      setDownloadSuccessToast({
        show: true,
        fileName,
        blobUrl: blobUrl || undefined
      });
      setTimeout(() => {
        setDownloadSuccessToast(prev => prev ? { ...prev, show: false } : null);
      }, 7000);
    } catch (err: any) {
      console.error(err);
      alert('Hitilafu katika kutengeneza PDF: ' + (err?.message || ''));
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewPDF = () => {
    try {
      const { doc, fileName, title } = getCurrentPDFDoc();
      const blobUrl = getPdfBlobUrl(doc);
      setPreviewPdfModal({
        isOpen: true,
        url: blobUrl,
        title,
        fileName
      });
    } catch (err: any) {
      console.error(err);
      alert('Hitilafu katika kufungua muonekano wa PDF: ' + (err?.message || ''));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (reportType === 'financial') {
      const data = [
        ['UWALEMI - TAARIFA YA FEDHA NA HAZINA'],
        ['Mwaka', selectedYear, 'Mwezi', selectedMonth === 'all' ? 'Mwaka Mzima' : monthNamesSw[selectedMonth - 1]],
        [],
        ['AINA YA MAPATO', 'KIASI (TZS)'],
        ['Ada za Kila Mwezi', totalMonthlyCollected],
        ...(includeRegFee ? [['Ada za Usajili wa Wanachama (2023)', totalRegFees]] : []),
        ['Michango ya Dharura & Misiba', emergencyCollectedInPeriod],
        ['JUMLA KUU YA MAPATO', totalInflowsPeriod],
        [],
        ['ORODHA YA MATUMIZI'],
        ['Tarehe', 'Aina ya Matumizi', 'Kundi', 'Mlipwaji', 'Mwidhinishaji', 'Kiasi (TZS)'],
        ...filteredExpenses.map(e => [e.date, e.title, e.category, e.paidTo, e.approvedBy, e.amount]),
        [],
        ['JUMLA YA MATUMIZI', totalExpensesPeriod],
        ['SALIO HALISI LA KIPINDI', netBalancePeriod]
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ripoti ya Fedha');
      XLSX.writeFile(wb, `UWALEMI_Fedha_${selectedYear}.xlsx`);
    } else if (reportType === 'members') {
      const defaultMonthlyFee = Number(state.groupSettings?.monthlyFeeDefault) || 0;
      const activeMonths = getActiveMonthsForPeriod(currentPeriodFilter);

      const rows = members.map(m => {
        // 1. Registration (Only in 2023)
        const regFeeAmount = includeRegFee ? (Number(m.registrationFeeAmount) || 0) : 0;
        const regPaid = includeRegFee ? (m.registrationFeePaidAmount !== undefined ? m.registrationFeePaidAmount : (m.registrationFeePaid ? regFeeAmount : 0)) : 0;
        const regDebt = includeRegFee ? Math.max(0, regFeeAmount - regPaid) : 0;

        // 2. Month-by-month values
        const monthCols: Record<string, any> = {};
        activeMonths.forEach(am => {
          const rec = monthlyPayments.find(p => p.memberId === m.id && Number(p.year) === Number(am.year) && Number(p.month) === Number(am.month));
          monthCols[am.label] = rec && Number(rec.paidAmount) > 0 ? Number(rec.paidAmount) : 0;
        });

        // 3. Monthly Fee Total & Late Fee Penalty
        const expFee = activeMonths.reduce((s, am) => s + getDefaultFeeForMonth(am.year, am.month, m.monthlyFeeAmount), 0);
        const paidFee = monthlyPayments.filter(p => p.memberId === m.id && isPeriodMatch(currentPeriodFilter, p.year, p.month, p.paymentDate)).reduce((s, p) => s + (Number(p.paidAmount) || 0), 0);
        const feeDebt = Math.max(0, expFee - paidFee);

        // Calculate member debt info with late fee penalty
        const memberDebtInfo = calculateMemberFeeDebt(m, state);
        const lateFeePenalty = memberDebtInfo.lateFeePenalty || 0;

        // 4. Meeting Fines
        let meetingFinesPaid = 0;
        let meetingFinesDebt = 0;
        (state.meetings || []).forEach(mtg => {
          const iso = normalizeDateToISO(mtg.date);
          const mYear = iso ? Number(iso.substring(0, 4)) : 0;
          const mMonth = iso ? Number(iso.substring(5, 7)) : 0;
          if (isPeriodMatch(currentPeriodFilter, mYear, mMonth, mtg.date)) {
            const att = (mtg.attendees || []).find(a => a.memberId === m.id);
            if (att && att.fineAmount && att.fineAmount > 0) {
              if (att.finePaid) meetingFinesPaid += Number(att.fineAmount) || 0;
              else meetingFinesDebt += Number(att.fineAmount) || 0;
            }
          }
        });

        // 5. Emergency
        let emergencyPaid = 0;
        (state.emergencyFunds || []).forEach(ef => {
          (ef.payments || []).forEach(p => {
            if (p.memberId === m.id) {
              const iso = normalizeDateToISO(p.paymentDate);
              const pYear = iso ? Number(iso.substring(0, 4)) : 0;
              const pMonth = iso ? Number(iso.substring(5, 7)) : 0;
              if (isPeriodMatch(currentPeriodFilter, pYear, pMonth, p.paymentDate)) {
                emergencyPaid += Number(p.amount) || 0;
              }
            }
          });
        });

        const totalFinesDebt = lateFeePenalty + meetingFinesDebt;
        const memberTotalContributed = regPaid + paidFee + meetingFinesPaid + emergencyPaid;
        const memberTotalDebt = regDebt + feeDebt + totalFinesDebt;

        const rowData: Record<string, any> = {
          'Namba ya Mwanachama': m.memberNo,
          'Jina Kamili': m.fullName,
          'Namba ya Simu': m.phone,
          'Wadhifa': m.role || 'Mjumbe'
        };

        if (includeRegFee) {
          rowData['KIINGILIO (2023)'] = regPaid > 0 ? regPaid : 0;
        }

        Object.assign(rowData, monthCols);
        rowData['Ada Zilizolipwa'] = paidFee;
        rowData['Deni la Ada'] = feeDebt;
        rowData['Faini ya Kuchelewa Ada (>Miezi 3)'] = lateFeePenalty;
        rowData['Faini za Vikao'] = meetingFinesDebt;
        rowData['Jumla ya Faini'] = totalFinesDebt;
        rowData['Michango ya Dharura'] = emergencyPaid;
        rowData['Jumla ya Fedha Alizotoa'] = memberTotalContributed;
        rowData['Jumla ya Madeni & Faini'] = memberTotalDebt;
        rowData['Hali ya Malipo'] = memberTotalDebt === 0 ? 'Amelipa' : (paidFee > 0 || regPaid > 0) ? 'Pungufu' : 'Ana Deni';

        return rowData;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daftari la Wanachama');
      XLSX.writeFile(wb, `UWALEMI_Daftari_la_Wanachama_${Date.now()}.xlsx`);
    } else if (reportType === 'fines') {
      const rows = members.map(m => {
        const debtInfo = calculateMemberFeeDebt(m, state);
        const lateFeePenalty = debtInfo.lateFeePenalty || 0;
        const unpaidMonthsCount = debtInfo.unpaidCount || 0;

        let meetingFinesPaid = 0;
        let meetingFinesDebt = 0;
        (state.meetings || []).forEach(mtg => {
          const iso = normalizeDateToISO(mtg.date);
          const mYear = iso ? Number(iso.substring(0, 4)) : 0;
          const mMonth = iso ? Number(iso.substring(5, 7)) : 0;
          if (isPeriodMatch(currentPeriodFilter, mYear, mMonth, mtg.date)) {
            const att = (mtg.attendees || []).find(a => a.memberId === m.id);
            if (att && att.fineAmount && att.fineAmount > 0) {
              if (att.finePaid) meetingFinesPaid += Number(att.fineAmount) || 0;
              else meetingFinesDebt += Number(att.fineAmount) || 0;
            }
          }
        });

        const totalMemberFineDebt = lateFeePenalty + meetingFinesDebt;
        const totalMemberFines = lateFeePenalty + meetingFinesDebt + meetingFinesPaid;

        return {
          'Namba ya Mwanachama': m.memberNo,
          'Jina Kamili': m.fullName,
          'Namba ya Simu': m.phone,
          'Wadhifa': m.role || 'Mjumbe',
          'Miezi ya Deni la Ada': unpaidMonthsCount,
          'Faini ya Kuchelewa Ada (>Miezi 3)': lateFeePenalty,
          'Faini za Vikao (Zisizolipwa)': meetingFinesDebt,
          'Faini za Vikao (Zilizolipwa)': meetingFinesPaid,
          'Jumla ya Faini Zinazodaiwa': totalMemberFineDebt,
          'Jumla ya Faini Zote': totalMemberFines,
          'Hali ya Faini': totalMemberFineDebt > 0 ? 'Inadaiwa' : meetingFinesPaid > 0 ? 'Imelipwa' : 'Hakuna Faini'
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ripoti ya Faini');
      XLSX.writeFile(wb, `UWALEMI_Ripoti_ya_Faini_${Date.now()}.xlsx`);
    } else {
      if (!currentEmergencyFund) return;
      const rows = (currentEmergencyFund.payments || []).map(p => ({
        'Namba ya Mjumbe': p.memberNo,
        'Jina la Mjumbe': p.memberName,
        'Tarehe': p.paymentDate,
        'Njia ya Malipo': p.paymentMethod,
        'Kumbukumbu': p.referenceNo || p.receiptNo || '',
        'Kiasi Kilicholipwa': p.amount
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Mchango wa Dharura');
      XLSX.writeFile(wb, `UWALEMI_${currentEmergencyFund.title.replace(/\s+/g, '_')}.xlsx`);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12" id="uwalemi-reports-center">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            Kituo cha Ripoti Rasmi za PDF & Excel
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tengeneza na pakua ripoti safi za PDF zenye barua rasmi ya UWALEMI, mihuri, saini na takwimu kamili za fedha na faini.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isGenerating ? 'Inatengeneza PDF...' : reportType === 'fines' ? 'Pakua PDF ya Faini' : 'Pakua Ripoti ya PDF'}
          </button>

          <button
            onClick={handlePreviewPDF}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            Tazama PDF (Preview)
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-400 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Pakua Excel
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Chapisha
          </button>
        </div>
      </div>

      {/* Filter and Configuration Controls */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-md space-y-4">
        {/* Report Type Selector Pills */}
        <div>
          <label className="text-xs font-semibold text-slate-300 mb-2 block">1. Chagua Aina ya Ripoti:</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <button
              onClick={() => setReportType('financial')}
              className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                reportType === 'financial'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-md'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className={`p-2 rounded-lg ${reportType === 'financial' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-900 text-slate-400'}`}>
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold block text-white">Taarifa ya Fedha & Hazina</span>
                <span className="text-[10px] text-slate-400">Mapato, matumizi na salio</span>
              </div>
            </button>

            <button
              onClick={() => setReportType('members')}
              className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                reportType === 'members'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-md'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className={`p-2 rounded-lg ${reportType === 'members' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-900 text-slate-400'}`}>
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold block text-white">Hali ya Wanachama & Ada</span>
                <span className="text-[10px] text-slate-400">Orodha na ada zote</span>
              </div>
            </button>

            <button
              onClick={() => setReportType('fines')}
              className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                reportType === 'fines'
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-md'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className={`p-2 rounded-lg ${reportType === 'fines' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-900 text-slate-400'}`}>
                <Scale className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold block text-white">Ripoti ya Faini Pekee</span>
                <span className="text-[10px] text-slate-400">Faini za ada (&gt;3M) &amp; za vikao</span>
              </div>
            </button>

            <button
              onClick={() => setReportType('emergency')}
              className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                reportType === 'emergency'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-md'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className={`p-2 rounded-lg ${reportType === 'emergency' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-900 text-slate-400'}`}>
                <HeartHandshake className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold block text-white">Michango ya Dharura</span>
                <span className="text-[10px] text-slate-400">Misiba na dharura zote</span>
              </div>
            </button>
          </div>
        </div>

        {/* Date / Fund Selectors */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {reportType !== 'emergency' ? (
            <div className="w-full space-y-3">
              {/* Mode Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-slate-400 font-semibold text-[11px] whitespace-nowrap">Chagua Kipindi:</span>
                
                <button
                  onClick={() => {
                    setFilterPeriodMode('single_year');
                    setSelectedMonth('all');
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                    filterPeriodMode === 'single_year'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  📅 Mwaka Mmoja
                </button>

                <button
                  onClick={() => setFilterPeriodMode('single_month')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                    filterPeriodMode === 'single_month'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  📆 Mwezi Maalumu
                </button>

                <button
                  onClick={() => setFilterPeriodMode('multi_year')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                    filterPeriodMode === 'multi_year'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  📊 Miaka Mingi (k.m 2023 - 2026)
                </button>

                <button
                  onClick={() => setFilterPeriodMode('custom_dates')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                    filterPeriodMode === 'custom_dates'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  🗓️ Tarehe Maalumu (Custom)
                </button>
              </div>

              {/* Sub-controls based on mode */}
              {filterPeriodMode === 'single_year' && (
                <div className="flex items-center gap-1.5 flex-wrap bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-semibold mr-1">Chagua Mwaka:</span>
                  {availableYears.map(yr => (
                    <button
                      key={yr}
                      onClick={() => setSelectedYear(yr)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedYear === yr 
                          ? 'bg-amber-500 text-slate-950 shadow-md' 
                          : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              )}

              {filterPeriodMode === 'single_month' && (
                <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400 font-semibold">Mwaka:</span>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-bold"
                    >
                      {availableYears.map(yr => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
                    {monthNamesSw.map((mName, idx) => {
                      const mNum = idx + 1;
                      return (
                        <button
                          key={mNum}
                          onClick={() => setSelectedMonth(mNum)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                            selectedMonth === mNum
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {mName.substring(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {filterPeriodMode === 'multi_year' && (
                <div className="flex flex-wrap items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-semibold">Kuanzia Mwaka:</span>
                    <select
                      value={multiStartYear}
                      onChange={(e) => setMultiStartYear(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-bold"
                    >
                      {availableYears.map(yr => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-semibold">Hadi Mwaka:</span>
                    <select
                      value={multiEndYear}
                      onChange={(e) => setMultiEndYear(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-bold"
                    >
                      {availableYears.map(yr => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setMultiStartYear(2023);
                        setMultiEndYear(2026);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold text-[11px] hover:bg-purple-500/30 cursor-pointer"
                    >
                      ⚡ 2023 - 2026 (Miaka 4)
                    </button>
                    <button
                      onClick={() => {
                        setMultiStartYear(2023);
                        setMultiEndYear(2025);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-bold text-[11px] hover:bg-slate-700 cursor-pointer"
                    >
                      2023 - 2025
                    </button>
                  </div>
                </div>
              )}

              {filterPeriodMode === 'custom_dates' && (
                <div className="flex flex-wrap items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-semibold">Kuanzia Tarehe:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-semibold">Hadi Tarehe:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCustomStartDate('2023-01-01');
                        setCustomEndDate('2026-12-31');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold text-[11px] hover:bg-blue-500/30 cursor-pointer"
                    >
                      ⚡ 2023 - 2026
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full">
              <label className="text-xs text-slate-400 block mb-1">Chagua Mchango wa Dharura:</label>
              <select
                value={selectedEmergencyId}
                onChange={(e) => setSelectedEmergencyId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              >
                {emergencyFunds.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.title} (Mfaidikaji: {f.beneficiaryName}) - TZS {(f.targetAmount || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Live Report Document Preview (Styled Sheet) */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-8 backdrop-blur-md" id="printable-report-area">
        {/* Letterhead Preview */}
        <div className="border-b-2 border-emerald-600/60 pb-5 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-2">
            <Building className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-black text-white tracking-tight uppercase">
            {state.groupSettings?.groupName || 'UWALEMI'}
          </h3>
          <p className="text-xs text-slate-400 italic">
            {state.groupSettings?.slogan && !state.groupSettings.slogan.includes('Shida na Raha') ? state.groupSettings.slogan : 'Lema, Nguvu Moja.'}
          </p>

          <div className="mt-4 inline-block bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
              {reportType === 'financial' && `TAARIFA YA MAPATO, MATUMIZI NA SALIO - ${currentPeriodFilter.periodLabel?.toUpperCase()}`}
              {reportType === 'members' && `DAFTARI LA WANACHAMA NA HALI YA ADA - ${currentPeriodFilter.periodLabel?.toUpperCase()}`}
              {reportType === 'emergency' && `RIPOTI YA MCHANGO WA DHARURA: ${currentEmergencyFund?.title || ''}`}
            </span>
          </div>
        </div>

        {/* 1. FINANCIAL REPORT PREVIEW */}
        {reportType === 'financial' && (
          <div className="space-y-6">
            {/* Top Summary Stats */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3`}>
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Ada za Mwezi</span>
                <span className="text-base font-black text-emerald-400">{formatTZS(totalMonthlyCollected)}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">{filteredPayments.length} miamala</span>
              </div>

              {includeRegFee && (
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Ada za Kiingilio (2023)
                  </span>
                  <span className="text-base font-black text-amber-400">{formatTZS(totalRegFees)}</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {members.filter(m => m.registrationFeePaid).length} waliojiunga (2023)
                  </span>
                </div>
              )}

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Faini za Vikao</span>
                <span className="text-base font-black text-purple-400">{formatTZS(totalMeetingFinesPeriodCollected)}</span>
                <span className="text-[10px] text-amber-500 block mt-0.5">Deni: {formatTZS(totalMeetingFinesPeriodUnpaid)}</span>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Faini za Ada (&gt;Miezi 3)</span>
                <span className="text-base font-black text-amber-400">{formatTZS(totalLateFeePenaltyPeriod)}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Deni la &gt; miezi 3</span>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/10">
                <span className="text-[10px] text-rose-300 uppercase font-semibold block">Jumla Kuu Faini Zote</span>
                <span className="text-base font-black text-rose-400">{formatTZS(totalAllFinesPeriodGrand)}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Lipo: <span className="text-emerald-400 font-bold">{formatTZS(totalAllFinesPeriodCollected)}</span> | Deni: <span className="text-amber-400 font-bold">{formatTZS(totalAllFinesPeriodPending)}</span>
                </span>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Michango Dharura</span>
                <span className="text-base font-black text-blue-400">{formatTZS(emergencyCollectedInPeriod)}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Ustawi wa jamii</span>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Jumla Matumizi</span>
                <span className="text-base font-black text-rose-400">{formatTZS(totalExpensesPeriod)}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">{filteredExpenses.length} gharama</span>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 bg-emerald-950/20 border-emerald-500/30">
                <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Salio Halisi Hazina</span>
                <span className={`text-base font-black ${netBalancePeriod >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatTZS(netBalancePeriod)}
                </span>
                <span className="text-[10px] text-emerald-500 block mt-0.5 font-semibold">Salio Chanya</span>
              </div>
            </div>

            {/* Expenses List */}
            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                Orodha ya Matumizi Yaliyofanyika Katika Kipindi Hiki:
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Tarehe</th>
                      <th className="p-3">Aina ya Matumizi</th>
                      <th className="p-3">Kundi</th>
                      <th className="p-3">Mlipwaji</th>
                      <th className="p-3 text-right">Kiasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-500">
                          Hakuna rekodi za matumizi katika kipindi hiki.
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map((exp, idx) => (
                        <tr key={exp.id || idx} className="hover:bg-slate-900/40">
                          <td className="p-3 text-slate-500">{idx + 1}</td>
                          <td className="p-3 text-slate-300">{exp.date}</td>
                          <td className="p-3 font-semibold text-white">{exp.title}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 uppercase">
                              {exp.category}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400">{exp.paidTo || '-'}</td>
                          <td className="p-3 text-right font-bold text-rose-400">{formatTZS(exp.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Meeting Fines Detailed List in Financial Report */}
            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Orodha na Mchanganuo wa Faini za Vikao (Utoro & Kuchelewa):</span>
                <span className="text-[11px] text-purple-400 font-normal lowercase">
                  ({meetingFinesDetailedList.length} faini, Jumla Imelipwa: {formatTZS(totalMeetingFinesPeriodCollected)}, Deni: {formatTZS(totalMeetingFinesPeriodUnpaid)})
                </span>
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Tarehe</th>
                      <th className="p-3">Kikao / Mkutano</th>
                      <th className="p-3">Mjumbe</th>
                      <th className="p-3">Sababu / Aina ya Faini</th>
                      <th className="p-3 text-right">Kiasi</th>
                      <th className="p-3 text-center">Hali ya Malipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {meetingFinesDetailedList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-500">
                          Hakuna faini za vikao zilizotozwa katika kipindi hiki.
                        </td>
                      </tr>
                    ) : (
                      meetingFinesDetailedList.map((f, idx) => (
                        <tr key={f.id || idx} className="hover:bg-slate-900/40">
                          <td className="p-3 text-slate-500">{idx + 1}</td>
                          <td className="p-3 text-slate-300">{f.date}</td>
                          <td className="p-3 font-semibold text-white">{f.title}</td>
                          <td className="p-3 text-slate-300">
                            <span className="font-mono font-bold text-emerald-400 mr-1.5">{f.memberNo}</span>
                            {f.memberName}
                          </td>
                          <td className="p-3 text-slate-400">{f.reason}</td>
                          <td className="p-3 text-right font-bold text-purple-300">{formatTZS(f.amount)}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${f.paid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                              {f.paid ? 'IMELIPWA' : 'HAIJALIPWA'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Members Breakdown Table in Financial Report */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Orodha ya Wanachama na Mchanganuo wa Fedha za Kila Mjumbe ({members.length}):
                </h4>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Namba</th>
                      <th className="p-3">Jina Kamili la Mjumbe</th>
                      <th className="p-3">Wadhifa</th>
                      {includeRegFee && <th className="p-3 text-center">Usajili</th>}
                      <th className="p-3 text-right">Ada Mwezi</th>
                      <th className="p-3 text-right">Faini Ada</th>
                      <th className="p-3 text-right">Faini Vikao</th>
                      <th className="p-3 text-right">Dharura</th>
                      <th className="p-3 text-right text-emerald-400">Jumla Aliyotoa</th>
                      <th className="p-3 text-right text-rose-400">Jumla ya Deni</th>
                      <th className="p-3 text-center">Hali</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {members.map((m, idx) => {
                      const defaultFee = Number(state.groupSettings?.monthlyFeeDefault) || 0;
                      const memberFee = Number(m.monthlyFeeAmount) || defaultFee;

                      // 1. Registration Fee (Only in 2023)
                      const regFeeAmount = includeRegFee ? (Number(m.registrationFeeAmount) || 0) : 0;
                      const regPaid = includeRegFee ? (m.registrationFeePaidAmount !== undefined ? m.registrationFeePaidAmount : (m.registrationFeePaid ? regFeeAmount : 0)) : 0;
                      const regDebt = includeRegFee ? Math.max(0, regFeeAmount - regPaid) : 0;

                      // 2. Monthly Fee
                      const expectedMonths = calculateExpectedFeeMonths(currentPeriodFilter);
                      const expFee = memberFee * expectedMonths;
                      const paidFee = monthlyPayments.filter(p => p.memberId === m.id && isPeriodMatch(currentPeriodFilter, p.year, p.month, p.paymentDate)).reduce((s, p) => s + (Number(p.paidAmount) || 0), 0);
                      const feeDebt = Math.max(0, expFee - paidFee);

                      // Late fee penalty for arrears > 3 months
                      const debtInfo = calculateMemberFeeDebt(m, state);
                      const lateFeePenalty = debtInfo.lateFeePenalty || 0;

                      // 3. Fines
                      let meetingFinesPaid = 0;
                      let meetingFinesDebt = 0;
                      const defaultAbsentFine = state.groupSettings?.meetingFineDefault || 10000;
                      const defaultLateFine = state.groupSettings?.meetingFineLateDefault || 2000;
                      (state.meetings || []).forEach(mtg => {
                        const iso = normalizeDateToISO(mtg.date);
                        const mYear = iso ? Number(iso.substring(0, 4)) : 0;
                        const mMonth = iso ? Number(iso.substring(5, 7)) : 0;
                        if (isPeriodMatch(currentPeriodFilter, mYear, mMonth, mtg.date)) {
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

                      const memberFinePaymentsInPeriod = (state.finePayments || []).filter(fp => {
                        const isMem = fp.memberId === m.id || fp.memberNo === m.memberNo;
                        if (!isMem) return false;
                        const iso = normalizeDateToISO(fp.paymentDate);
                        const pYear = iso ? Number(iso.substring(0, 4)) : 0;
                        const pMonth = iso ? Number(iso.substring(5, 7)) : 0;
                        return isPeriodMatch(currentPeriodFilter, pYear, pMonth, fp.paymentDate);
                      });
                      const totalMemberFinesPaid = Math.max(
                        meetingFinesPaid,
                        memberFinePaymentsInPeriod.reduce((s, fp) => s + (Number(fp.amount) || 0), 0)
                      );

                      // 4. Emergency
                      let emergencyPaid = 0;
                      (state.emergencyFunds || []).forEach(ef => {
                        (ef.payments || []).forEach(p => {
                          if (p.memberId === m.id) {
                            const iso = normalizeDateToISO(p.paymentDate);
                            const pYear = iso ? Number(iso.substring(0, 4)) : 0;
                            const pMonth = iso ? Number(iso.substring(5, 7)) : 0;
                            if (isPeriodMatch(currentPeriodFilter, pYear, pMonth, p.paymentDate)) {
                              emergencyPaid += Number(p.amount) || 0;
                            }
                          }
                        });
                      });

                      const totPaid = regPaid + paidFee + totalMemberFinesPaid + emergencyPaid;
                      const totDebt = regDebt + feeDebt + lateFeePenalty + meetingFinesDebt;

                      return (
                        <tr key={m.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="p-3 text-slate-500">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-emerald-400">{m.memberNo}</td>
                          <td className="p-3 font-semibold text-white">
                            <div>{m.fullName}</div>
                            {m.status === 'suspended' && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase mt-0.5 inline-block">Amesitishwa</span>
                            )}
                            {m.status === 'inactive' && (
                              <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold uppercase mt-0.5 inline-block">Amejitoa</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-400">{m.role || 'Mjumbe'}</td>
                          {includeRegFee && (
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.registrationFeePaid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                {m.registrationFeePaid ? 'Imelipwa' : 'Hajalipa'}
                              </span>
                            </td>
                          )}
                          <td className="p-3 text-right font-mono text-slate-300">
                            <div className="font-bold text-slate-200">{formatTZS(paidFee)}</div>
                            <div className="text-[10px] text-emerald-400 font-normal">
                              {getMonthlyBreakdownString(m.id, monthlyPayments, currentPeriodFilter)}
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono text-slate-300">
                            {lateFeePenalty > 0 ? (
                              <span className="font-bold text-amber-400">{formatTZS(lateFeePenalty)}</span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-300">
                            <div className="font-bold text-purple-300">{formatTZS(totalMemberFinesPaid)}</div>
                            {meetingFinesDebt > 0 && (
                              <div className="text-[9px] text-amber-400 font-bold">
                                Deni: {formatTZS(meetingFinesDebt)}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-300">{formatTZS(emergencyPaid)}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400">{formatTZS(totPaid)}</td>
                          <td className="p-3 text-right font-mono font-bold text-rose-400">{formatTZS(totDebt)}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${totDebt === 0 ? 'bg-emerald-500/20 text-emerald-400' : (paidFee > 0 || regPaid > 0) ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}`}>
                              {totDebt === 0 ? 'AMELIPA' : (paidFee > 0 || regPaid > 0) ? 'PUNGUFU' : 'ANA DENI'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. MEMBERS LEDGER PREVIEW */}
        {reportType === 'members' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Tafuta mjumbe kwa jina, namba (UWL-...) au simu..." 
                  value={memberSearchQuery} 
                  onChange={e => setMemberSearchQuery(e.target.value)} 
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500" 
                />
              </div>
              <div className="text-xs text-slate-400">
                Wanaodhihirishwa: <span className="font-bold text-emerald-400">
                  {members.filter(m => 
                    !memberSearchQuery || 
                    m.fullName.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
                    m.memberNo.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                    m.phone.includes(memberSearchQuery)
                  ).length}
                </span> kati ya {members.length}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Namba</th>
                    <th className="p-3">Jina Kamili</th>
                    <th className="p-3">Simu</th>
                    <th className="p-3">Wadhifa</th>
                    {includeRegFee && <th className="p-3 text-center">Usajili</th>}
                    <th className="p-3 text-right">Ada Mwezi</th>
                    <th className="p-3 text-right">Faini ya Ada (&gt;3M)</th>
                    <th className="p-3 text-right">Faini Vikao</th>
                    <th className="p-3 text-right">Dharura</th>
                    <th className="p-3 text-right text-emerald-400">Jumla Aliyotoa</th>
                    <th className="p-3 text-right text-rose-400">Jumla ya Deni & Faini</th>
                    <th className="p-3 text-center">Hali</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {members
                    .filter(m => 
                      !memberSearchQuery || 
                      m.fullName.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
                      m.memberNo.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                      m.phone.includes(memberSearchQuery)
                    )
                    .map((m, idx) => {
                      const defaultFee = Number(state.groupSettings?.monthlyFeeDefault) || 0;
                      const memberFee = Number(m.monthlyFeeAmount) || defaultFee;

                      // 1. Registration Fee (Kiingilio - Only in 2023)
                      const regFeeAmount = includeRegFee ? (Number(m.registrationFeeAmount) || 0) : 0;
                      const regPaid = includeRegFee ? (m.registrationFeePaidAmount !== undefined ? m.registrationFeePaidAmount : (m.registrationFeePaid ? regFeeAmount : 0)) : 0;
                      const regDebt = includeRegFee ? Math.max(0, regFeeAmount - regPaid) : 0;

                      // 2. Monthly Fee
                      const expectedMonths = calculateExpectedFeeMonths(currentPeriodFilter);
                      const expFee = memberFee * expectedMonths;
                      const paidFee = monthlyPayments.filter(p => p.memberId === m.id && isPeriodMatch(currentPeriodFilter, p.year, p.month, p.paymentDate)).reduce((s, p) => s + (Number(p.paidAmount) || 0), 0);
                      const feeDebt = Math.max(0, expFee - paidFee);

                      // Member debt info with 5,000 TZS late penalty (>3 months)
                      const debtInfo = calculateMemberFeeDebt(m, state);
                      const lateFeePenalty = debtInfo.lateFeePenalty || 0;

                      // 3. Fines (Meetings)
                      let finesPaid = 0;
                      let finesDebt = 0;
                      (state.meetings || []).forEach(mtg => {
                        const iso = normalizeDateToISO(mtg.date);
                        const mYear = iso ? Number(iso.substring(0, 4)) : 0;
                        const mMonth = iso ? Number(iso.substring(5, 7)) : 0;
                        if (isPeriodMatch(currentPeriodFilter, mYear, mMonth, mtg.date)) {
                          const att = (mtg.attendees || []).find(a => a.memberId === m.id);
                          if (att && att.fineAmount && att.fineAmount > 0) {
                            if (att.finePaid) finesPaid += Number(att.fineAmount) || 0;
                            else finesDebt += Number(att.fineAmount) || 0;
                          }
                        }
                      });

                      // 4. Emergency
                      let emergencyPaid = 0;
                      (state.emergencyFunds || []).forEach(ef => {
                        (ef.payments || []).forEach(p => {
                          if (p.memberId === m.id) {
                            const iso = normalizeDateToISO(p.paymentDate);
                            const pYear = iso ? Number(iso.substring(0, 4)) : 0;
                            const pMonth = iso ? Number(iso.substring(5, 7)) : 0;
                            if (isPeriodMatch(currentPeriodFilter, pYear, pMonth, p.paymentDate)) {
                              emergencyPaid += Number(p.amount) || 0;
                            }
                          }
                        });
                      });

                      const totalFinesDebt = lateFeePenalty + finesDebt;
                      const memberTotalContributed = regPaid + paidFee + finesPaid + emergencyPaid;
                      const memberTotalDebt = regDebt + feeDebt + totalFinesDebt;

                      return (
                        <tr key={m.id || idx} className="hover:bg-slate-900/40">
                          <td className="p-3 text-slate-500">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-emerald-400">{m.memberNo}</td>
                          <td className="p-3 font-semibold text-white">
                            <div>{m.fullName}</div>
                            {m.status === 'suspended' && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase mt-0.5 inline-block">Amesitishwa</span>
                            )}
                            {m.status === 'inactive' && (
                              <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold uppercase mt-0.5 inline-block">Amejitoa</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-400">{m.phone}</td>
                          <td className="p-3 text-slate-400">{m.role || 'Mjumbe'}</td>
                          {includeRegFee && (
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.registrationFeePaid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                {m.registrationFeePaid ? 'Imelipwa' : 'Hajalipa'}
                              </span>
                            </td>
                          )}
                          <td className="p-3 text-right font-mono text-slate-300">
                            <div className="font-bold text-emerald-400">{formatTZS(paidFee)}</div>
                            <div className="text-[10px] text-emerald-400/80 font-normal">
                              {getMonthlyBreakdownString(m.id, monthlyPayments, currentPeriodFilter)}
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono text-slate-300">
                            {lateFeePenalty > 0 ? (
                              <span className="text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded">
                                {formatTZS(lateFeePenalty)}
                              </span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </td>
                          <td className="p-3 text-right text-slate-300">{formatTZS(finesPaid)}</td>
                          <td className="p-3 text-right text-slate-300">{formatTZS(emergencyPaid)}</td>
                          <td className="p-3 text-right font-black text-emerald-400">{formatTZS(memberTotalContributed)}</td>
                          <td className="p-3 text-right font-black text-rose-400">{formatTZS(memberTotalDebt)}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              memberTotalDebt === 0 ? 'bg-emerald-500/20 text-emerald-300' : (paidFee > 0 || regPaid > 0) ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-400'
                            }`}>
                              {memberTotalDebt === 0 ? 'Amelipa' : (paidFee > 0 || regPaid > 0) ? 'Pungufu' : 'Ana Deni'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. FINES AND PENALTIES REPORT PREVIEW */}
        {reportType === 'fines' && (() => {
          let totalLateFeePenalty = 0;
          let totalMeetingFinesPaid = 0;
          let totalMeetingFinesDebt = 0;
          let membersWithFinesCount = 0;
          const recipientsWithFines: { name: string; phone: string; memberNo: string }[] = [];
          const recipientsWithFeeDebt: { name: string; phone: string; memberNo: string }[] = [];

          const processedMembers = members.map(m => {
            const debtInfo = calculateMemberFeeDebt(m, state);
            const lateFee = debtInfo.lateFeePenalty || 0;
            const unpaidMonthsCount = debtInfo.unpaidCount || 0;
            const penaltyMonths = debtInfo.penaltyMonthsCount || 0;
            const unpaidFromJuneCount = debtInfo.unpaidFromJuneCount || 0;

            let meetingPaid = 0;
            let meetingUnpaid = 0;

            const defaultAbsentFine = state.groupSettings?.meetingFineDefault || 10000;
            const defaultLateFine = state.groupSettings?.meetingFineLateDefault || 2000;

            (state.meetings || []).forEach(mtg => {
              const iso = normalizeDateToISO(mtg.date);
              const mYear = iso ? Number(iso.substring(0, 4)) : 0;
              const mMonth = iso ? Number(iso.substring(5, 7)) : 0;
              if (isPeriodMatch(currentPeriodFilter, mYear, mMonth, mtg.date)) {
                const att = (mtg.attendees || []).find(a => a.memberId === m.id || a.memberNo === m.memberNo);
                if (att) {
                  let fAmt = Number(att.fineAmount) || 0;
                  if (fAmt === 0) {
                    if (att.status === 'absent') fAmt = defaultAbsentFine;
                    else if (att.status === 'late') fAmt = defaultLateFine;
                  }
                  if (fAmt > 0) {
                    if (att.finePaid) meetingPaid += fAmt;
                    else meetingUnpaid += fAmt;
                  }
                }
              }
            });

            const memberFinePayments = (state.finePayments || []).filter(fp => {
              const isMem = fp.memberId === m.id || fp.memberNo === m.memberNo;
              if (!isMem) return false;
              const iso = normalizeDateToISO(fp.paymentDate);
              const pYear = iso ? Number(iso.substring(0, 4)) : 0;
              const pMonth = iso ? Number(iso.substring(5, 7)) : 0;
              return isPeriodMatch(currentPeriodFilter, pYear, pMonth, fp.paymentDate);
            });
            const memberFinesPaidAmt = Math.max(
              meetingPaid,
              memberFinePayments.reduce((s, fp) => s + (Number(fp.amount) || 0), 0)
            );

            const totalMemberFineDebt = lateFee + meetingUnpaid;
            const totalMemberFines = totalMemberFineDebt + memberFinesPaidAmt;

            if (totalMemberFines > 0) {
              membersWithFinesCount++;
            }

            if (totalMemberFineDebt > 0 && m.phone) {
              recipientsWithFines.push({
                name: m.fullName,
                phone: m.phone,
                memberNo: m.memberNo
              });
            }

            if ((debtInfo.feeDebt || 0) > 0 && m.phone && m.status === 'active') {
              recipientsWithFeeDebt.push({
                name: m.fullName,
                phone: m.phone,
                memberNo: m.memberNo
              });
            }

            totalLateFeePenalty += lateFee;
            totalMeetingFinesPaid += memberFinesPaidAmt;
            totalMeetingFinesDebt += meetingUnpaid;

            let feeDebtNote = 'Hakuna deni';
            if (unpaidMonthsCount > 0) {
              if (penaltyMonths > 0) {
                feeDebtNote = `${unpaidMonthsCount} miezi (${penaltyMonths} ya faini Mz 6+)`;
              } else {
                feeDebtNote = `${unpaidMonthsCount} miezi (msamaha <=3M Mz 6+)`;
              }
            }

            return {
              member: m,
              unpaidMonthsCount,
              penaltyMonths,
              feeDebtNote,
              lateFee,
              meetingUnpaid,
              meetingPaid: memberFinesPaidAmt,
              totalMemberFineDebt,
              totalMemberFines,
              status: totalMemberFineDebt > 0 ? 'Inadaiwa' : memberFinesPaidAmt > 0 ? 'Imelipwa' : 'Hakuna Faini'
            };
          });

          const grandTotalFines = totalLateFeePenalty + totalMeetingFinesDebt + totalMeetingFinesPaid;
          const grandTotalFinesPending = totalLateFeePenalty + totalMeetingFinesDebt;

          const filteredFinesList = processedMembers.filter(d => {
            const matchSearch = memberSearchQuery === '' ||
              d.member.fullName.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
              d.member.memberNo.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
              (d.member.phone && d.member.phone.includes(memberSearchQuery));
            
            if (!matchSearch) return false;
            if (finesFilterOnlyWithDebt) return d.totalMemberFineDebt > 0;
            return true;
          });

          const detailedMeetingFines: any[] = [];
          (state.meetings || []).forEach(mtg => {
            const iso = normalizeDateToISO(mtg.date);
            const mYear = iso ? Number(iso.substring(0, 4)) : 0;
            const mMonth = iso ? Number(iso.substring(5, 7)) : 0;
            if (isPeriodMatch(currentPeriodFilter, mYear, mMonth, mtg.date)) {
              (mtg.attendees || []).forEach(att => {
                if (att.fineAmount && att.fineAmount > 0) {
                  const mInfo = members.find(m => m.id === att.memberId);
                  detailedMeetingFines.push({
                    date: mtg.date,
                    title: mtg.title || 'Kikao cha UWALEMI',
                    memberNo: mInfo?.memberNo || '-',
                    memberName: mInfo?.fullName || 'Mjumbe',
                    amount: Number(att.fineAmount) || 0,
                    paid: !!att.finePaid,
                    reason: att.fineReason || (att.status === 'absent' ? 'Kutohudhuria Kikao' : 'Kuchelewa Kikao')
                  });
                }
              });
            }
          });

          return (
            <div className="space-y-6 animate-fadeIn">
              {/* Top KPI Cards for Fines */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="bg-slate-950/80 p-4 rounded-xl border border-emerald-500/30">
                  <div className="flex items-center justify-between text-emerald-400 mb-1">
                    <span className="text-[11px] font-semibold">Faini Zilizokusanywa (Zilizolipwa)</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-emerald-400">{formatTZS(totalMeetingFinesPaid)}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Pesa ya faini zilizokwisha ingia hazina
                  </span>
                </div>

                <div className="bg-slate-950/80 p-4 rounded-xl border border-rose-500/30">
                  <div className="flex items-center justify-between text-rose-400 mb-1">
                    <span className="text-[11px] font-semibold">Faini Zinazodaiwa (Bado)</span>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-rose-400">{formatTZS(grandTotalFinesPending)}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Wenye madeni: {recipientsWithFines.length} wanachama
                  </span>
                </div>

                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between text-amber-400 mb-1">
                    <span className="text-[11px] font-semibold">Faini za Ada (&gt;Miezi 3, Mz 6+)</span>
                    <Scale className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-amber-400">{formatTZS(totalLateFeePenalty)}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Kuanzia Mwezi wa 6: TZS 5,000 kila mwezi unaozidi miezi 3
                  </span>
                </div>

                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between text-purple-300 mb-1">
                    <span className="text-[11px] font-semibold">Faini za Vikao (Jumla)</span>
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-purple-300">{formatTZS(totalMeetingFinesDebt + totalMeetingFinesPaid)}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Zilizolipwa: {formatTZS(totalMeetingFinesPaid)} | Deni: {formatTZS(totalMeetingFinesDebt)}
                  </span>
                </div>

                <div className="bg-slate-950/80 p-4 rounded-xl border border-cyan-500/30">
                  <div className="flex items-center justify-between text-cyan-400 mb-1">
                    <span className="text-[11px] font-semibold">Jumla Kuu ya Faini Zote</span>
                    <Receipt className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-cyan-400">{formatTZS(grandTotalFines)}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Wanachama: {membersWithFinesCount} wenye faini
                  </span>
                </div>
              </div>

              {/* Filter Controls & SMS Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3 flex-1 max-w-md">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tafuta jina, simu, au namba ya mjumbe..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg pl-9 pr-3 py-1.5 text-xs placeholder:text-slate-500"
                    />
                  </div>

                  <button
                    onClick={() => setFinesFilterOnlyWithDebt(!finesFilterOnlyWithDebt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      finesFilterOnlyWithDebt
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-700'
                    }`}
                  >
                    {finesFilterOnlyWithDebt ? '🔴 Wenye Faini Pekee' : '⚪ Wanachama Wote'}
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {onSaveState && (
                    <button
                      onClick={() => {
                        setFinePaymentModalMemberId(undefined);
                        setFinePaymentModalMeetingId(undefined);
                        setFinePaymentModalType('kikao');
                        setFinePaymentModalAmount(undefined);
                        setIsFinePaymentModalOpen(true);
                      }}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/30 transition-all cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      + Rekodi Malipo ya Faini
                    </button>
                  )}

                  {onOpenSmsWithTemplate && recipientsWithFeeDebt.length > 0 && (
                    <button
                      onClick={() => {
                        const templateText = "Habari {name}, kikundi cha UWALEMI kinakukumbusha kulipa ada yako ya miezi iliyopita: unadaiwa ada TZS {feeDebt} {periodSummary} ({unpaidMonths}). Lipa kupitia {lipaNamba}. Tafadhali kamilisha malipo yako kuepuka faini ya kuchelewa kulipa ada na kuwa nje ya umoja kwa mujibu wa katiba. Lema, Nguvu Moja!";
                        onOpenSmsWithTemplate(recipientsWithFeeDebt, templateText);
                      }}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5 text-emerald-400" />
                      💳 Kumbusha Ada Pekee (SMS {recipientsWithFeeDebt.length})
                    </button>
                  )}

                  {onOpenSmsWithTemplate && recipientsWithFines.length > 0 && (
                    <button
                      onClick={() => {
                        const templateText = "Habari {name} ({memberNo}), Taarifa ya UWALEMI: Unakumbushwa kulipa faini zako: {fainiSummary}. Jumla ya faini unayodaiwa ni {faini}. Tafadhali lipa kupitia {lipaNamba}. Ahsante, Lema, Nguvu Moja!";
                        onOpenSmsWithTemplate(recipientsWithFines, templateText);
                      }}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30 text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5 text-rose-400" />
                      🚨 Kumbusha Faini Pekee (SMS {recipientsWithFines.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Main Fines Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Namba</th>
                      <th className="p-3">Jina Kamili</th>
                      <th className="p-3">Simu</th>
                      <th className="p-3">Wadhifa</th>
                      <th className="p-3">Deni la Ada (Miezi)</th>
                      <th className="p-3 text-right">Faini Ada (&gt;3M)</th>
                      <th className="p-3 text-right">Faini Vikao (Deni)</th>
                      <th className="p-3 text-right">Faini Vikao (Paid)</th>
                      <th className="p-3 text-right">Jumla ya Faini</th>
                      <th className="p-3 text-center">Hali</th>
                      <th className="p-3 text-center">Kitendo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredFinesList.map((d, idx) => {
                      const hasFines = d.totalMemberFineDebt > 0;
                      const fineSummaryText = d.lateFee > 0 && d.meetingUnpaid > 0
                        ? `Faini ya kuchelewa ada (TZS ${d.lateFee.toLocaleString()}) na faini ya vikao (TZS ${d.meetingUnpaid.toLocaleString()})`
                        : d.lateFee > 0
                        ? `Faini ya kuchelewa ada (>miezi 3) kiasi cha TZS ${d.lateFee.toLocaleString()}`
                        : `Faini ya kikao kiasi cha TZS ${d.meetingUnpaid.toLocaleString()}`;
                      const fineReminderText = `Habari ${d.member.fullName} (${d.member.memberNo}), Taarifa ya UWALEMI: Unakumbushwa kulipa ${fineSummaryText}. Jumla ya faini: TZS ${d.totalMemberFineDebt.toLocaleString()}. Tafadhali lipa kupitia M Koba au 0758 219 298 Eva O Lema. Lema, Nguvu Moja!`;

                      return (
                        <tr key={d.member.id || idx} className="hover:bg-slate-900/40">
                          <td className="p-3 text-slate-500">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-emerald-400">{d.member.memberNo}</td>
                          <td className="p-3 font-semibold text-white">
                            <div>{d.member.fullName}</div>
                            {d.member.status === 'suspended' && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase mt-0.5 inline-block">Amesitishwa</span>
                            )}
                            {d.member.status === 'inactive' && (
                              <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold uppercase mt-0.5 inline-block">Amejitoa</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-400">{d.member.phone || '-'}</td>
                          <td className="p-3 text-slate-400">{d.member.role || 'Mjumbe'}</td>
                          <td className="p-3 text-slate-300">
                            <span className={d.unpaidMonthsCount > 3 ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                              {d.feeDebtNote}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono">
                            {d.lateFee > 0 ? (
                              <span className="text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded">
                                {formatTZS(d.lateFee)}
                              </span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono">
                            {d.meetingUnpaid > 0 ? (
                              <span className="text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded">
                                {formatTZS(d.meetingUnpaid)}
                              </span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-400">
                            {d.meetingPaid > 0 ? formatTZS(d.meetingPaid) : <span className="text-slate-500">0</span>}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-rose-400">
                            {formatTZS(d.totalMemberFineDebt)}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              d.totalMemberFineDebt > 0 
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                                : d.meetingPaid > 0 
                                ? 'bg-emerald-500/20 text-emerald-300' 
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {d.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {onSaveState && (
                                <button
                                  onClick={() => {
                                    setFinePaymentModalMemberId(d.member.id);
                                    setFinePaymentModalMeetingId(undefined);
                                    setFinePaymentModalType(d.meetingUnpaid > 0 ? 'kikao' : d.lateFee > 0 ? 'ada_late_fee' : 'kikao');
                                    setFinePaymentModalAmount(d.totalMemberFineDebt > 0 ? d.totalMemberFineDebt : 10000);
                                    setIsFinePaymentModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white text-[11px] font-semibold transition-all cursor-pointer border border-slate-700 hover:border-rose-500"
                                  title="Rekodi malipo ya faini na toa risiti"
                                >
                                  <Receipt className="w-3 h-3 text-rose-400" />
                                  Lipia
                                </button>
                              )}

                              {hasFines && onOpenSmsWithTemplate && (
                                <button
                                  onClick={() => {
                                    onOpenSmsWithTemplate([{
                                      name: d.member.fullName,
                                      phone: d.member.phone || '',
                                      memberNo: d.member.memberNo
                                    }], fineReminderText);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600/20 text-rose-300 hover:bg-rose-600 hover:text-white text-[11px] font-semibold transition-all cursor-pointer border border-rose-500/30"
                                  title="Tuma SMS ya kumkumbusha faini pekee"
                                >
                                  <Send className="w-3 h-3" />
                                  Kumbusha
                                </button>
                              )}

                              {hasFines && d.member.phone && (
                                <button
                                  onClick={() => {
                                    const cleanPhone = (d.member.phone || '').replace(/[^0-9]/g, '');
                                    const fullPhone = cleanPhone.startsWith('0') ? '255' + cleanPhone.substring(1) : cleanPhone;
                                    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(fineReminderText)}`, '_blank');
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600 hover:text-white text-[11px] font-semibold transition-all cursor-pointer border border-emerald-500/30"
                                  title="Tuma ukumbusho wa faini kwa WhatsApp"
                                >
                                  <Share2 className="w-3 h-3" />
                                  WA
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Detailed Meeting Fines Records */}
              {detailedMeetingFines.length > 0 && (
                <div className="space-y-3 pt-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Scale className="w-4 h-4 text-amber-400" />
                    Kumbukumbu za Faini za Vikao vya UWALEMI ({detailedMeetingFines.length}):
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">Tarehe</th>
                          <th className="p-3">Kikao</th>
                          <th className="p-3">Namba</th>
                          <th className="p-3">Jina la Mjumbe</th>
                          <th className="p-3">Sababu ya Faini</th>
                          <th className="p-3 text-right">Kiasi</th>
                          <th className="p-3 text-center">Hali</th>
                          <th className="p-3 text-center">Kitendo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {detailedMeetingFines.map((f, i) => (
                          <tr key={i} className="hover:bg-slate-900/40">
                            <td className="p-3 text-slate-500">{i + 1}</td>
                            <td className="p-3 text-slate-400">{f.date}</td>
                            <td className="p-3 font-semibold text-white">{f.title}</td>
                            <td className="p-3 font-mono font-bold text-emerald-400">{f.memberNo}</td>
                            <td className="p-3 text-slate-200">{f.memberName}</td>
                            <td className="p-3 text-slate-300">{f.reason}</td>
                            <td className="p-3 text-right font-bold text-rose-400">{formatTZS(f.amount)}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                f.paid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                              }`}>
                                {f.paid ? 'Imelipwa' : 'Haijalipwa'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                {onSaveState && !f.paid && (
                                  <button
                                    onClick={() => {
                                      const targetMember = members.find(m => m.memberNo === f.memberNo);
                                      const targetMtg = (state.meetings || []).find(m => m.title === f.title || m.date === f.date);
                                      setFinePaymentModalMemberId(targetMember?.id);
                                      setFinePaymentModalMeetingId(targetMtg?.id);
                                      setFinePaymentModalType('kikao');
                                      setFinePaymentModalAmount(f.amount);
                                      setIsFinePaymentModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600 hover:text-white text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    <Receipt className="w-2.5 h-2.5" />
                                    Lipia & Toa Risiti
                                  </button>
                                )}

                                {!f.paid && (() => {
                                  const targetMember = members.find(m => m.memberNo === f.memberNo);
                                  const msg = `Habari ${f.memberName} (${f.memberNo}), Taarifa ya UWALEMI: Unakumbushwa kulipa faini ya ${f.reason} ya ${f.title} (${f.date}) kiasi cha TZS ${f.amount.toLocaleString()}. Tafadhali lipa kupitia M Koba au 0758 219 298 Eva O Lema. Lema, Nguvu Moja!`;
                                  return (
                                    <>
                                      {onOpenSmsWithTemplate && targetMember && (
                                        <button
                                          onClick={() => {
                                            onOpenSmsWithTemplate([{
                                              name: targetMember.fullName,
                                              phone: targetMember.phone || '',
                                              memberNo: targetMember.memberNo
                                            }], msg);
                                          }}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-rose-600 hover:text-white text-[10px] font-semibold transition-all cursor-pointer border border-slate-700"
                                          title="Tuma SMS ya kumkumbusha faini ya kikao"
                                        >
                                          <Send className="w-2.5 h-2.5" />
                                          SMS
                                        </button>
                                      )}
                                      {targetMember?.phone && (
                                        <button
                                          onClick={() => {
                                            const cleanPhone = (targetMember.phone || '').replace(/[^0-9]/g, '');
                                            const fullPhone = cleanPhone.startsWith('0') ? '255' + cleanPhone.substring(1) : cleanPhone;
                                            window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                                          }}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 hover:bg-emerald-600 hover:text-white text-[10px] font-semibold transition-all cursor-pointer border border-emerald-700/40"
                                          title="Tuma ukumbusho kwa WhatsApp"
                                        >
                                          <Share2 className="w-2.5 h-2.5" />
                                          WA
                                        </button>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 4. EMERGENCY FUND REPORT PREVIEW */}
        {reportType === 'emergency' && currentEmergencyFund && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Lengo la Mchango (Target)</span>
                <span className="text-lg font-black text-rose-400">{formatTZS(currentEmergencyFund.targetAmount)}</span>
                <span className="text-[10px] text-slate-500 block mt-1">Kila mjumbe: {formatTZS(currentEmergencyFund.perMemberTarget || 20000)}</span>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Kiasi Kilichokusanywa</span>
                <span className="text-lg font-black text-emerald-400">
                  {formatTZS((currentEmergencyFund.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0))}
                </span>
                <span className="text-[10px] text-emerald-500/80 block mt-1">
                  {currentEmergencyFund.payments?.length || 0} wamechanga
                </span>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Mfaidikaji</span>
                <span className="text-lg font-black text-white">{currentEmergencyFund.beneficiaryName}</span>
                <span className="text-[10px] text-slate-400 block mt-1">Uhusiano: {currentEmergencyFund.beneficiaryRelation || 'Mwanachama'}</span>
              </div>
            </div>

            {/* List of payments */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                Orodha ya Wajumbe Waliochanga ({currentEmergencyFund.payments?.length || 0}):
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Namba</th>
                      <th className="p-3">Jina la Mjumbe</th>
                      <th className="p-3">Tarehe</th>
                      <th className="p-3">Njia ya Malipo</th>
                      <th className="p-3 text-right">Kiasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(currentEmergencyFund.payments || []).map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-slate-900/40">
                        <td className="p-3 text-slate-500">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-emerald-400">{p.memberNo}</td>
                        <td className="p-3 font-semibold text-white">{p.memberName}</td>
                        <td className="p-3 text-slate-400">{p.paymentDate}</td>
                        <td className="p-3 text-slate-400">{p.paymentMethod}</td>
                        <td className="p-3 text-right font-bold text-emerald-400">{formatTZS(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Signatures & Official Stamp Preview */}
        {(() => {
          const mwenyekiti = (state.members || []).find(m => m.role === 'Mwenyekiti') || (state.members || []).find(m => m.role === 'Makamu Mwenyekiti');
          const katibu = (state.members || []).find(m => m.role === 'Katibu') || (state.members || []).find(m => m.role === 'Katibu Msaidizi');
          const mwekaHazina = (state.members || []).find(m => m.role === 'Mweka Hazina') || (state.members || []).find(m => m.role === 'Mweka Hazina Msaidizi');

          return (
            <div className="mt-10 pt-6 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
              <div>
                <div className="h-10 border-b border-dashed border-slate-700 mb-2 flex items-end justify-center">
                  <span className="text-[11px] font-serif text-emerald-500 italic">
                    {mwenyekiti?.fullName || 'Jimson Lema'}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-300 block">
                  {mwenyekiti?.fullName || 'Jimson Lema'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {mwenyekiti ? (mwenyekiti.role === 'Mwenyekiti' ? 'Mwenyekiti wa UWALEMI' : 'Makamu Mwenyekiti') : 'Mwenyekiti wa UWALEMI'}
                </span>
              </div>

              <div>
                <div className="h-10 border-b border-dashed border-slate-700 mb-2 flex items-end justify-center">
                  {katibu && (
                    <span className="text-[11px] font-serif text-blue-400 italic">
                      {katibu.fullName}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-slate-300 block">
                  {katibu?.fullName || 'Katibu Mkuu'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {katibu ? `${katibu.role} • Kumbukumbu` : 'Uthibitisho wa Kumbukumbu'}
                </span>
              </div>

              <div>
                <div className="h-10 border-b border-dashed border-slate-700 mb-2 flex items-end justify-center">
                  {mwekaHazina && (
                    <span className="text-[11px] font-serif text-emerald-400 italic">
                      {mwekaHazina.fullName}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-slate-300 block">
                  {mwekaHazina?.fullName || 'Mweka Hazina'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {mwekaHazina ? 'Mweka Hazina • Hesabu & Fedha' : 'Hesabu & Fedha za Kikundi'}
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Download Success Notification Banner */}
      {downloadSuccessToast && downloadSuccessToast.show && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 border border-emerald-500/50 rounded-2xl p-4 shadow-2xl shadow-emerald-950/60 flex items-start gap-3 animate-slideUp">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white">Ripoti ya PDF Imetengenezwa!</h4>
            <p className="text-[11px] text-slate-300 truncate mt-0.5">{downloadSuccessToast.fileName}</p>
            <div className="flex items-center gap-3 mt-2">
              {downloadSuccessToast.blobUrl && (
                <a
                  href={downloadSuccessToast.blobUrl}
                  download={downloadSuccessToast.fileName}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Bofya kupakua tena
                </a>
              )}
              {downloadSuccessToast.blobUrl && (
                <a
                  href={downloadSuccessToast.blobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-teal-400 hover:text-teal-300 underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Fungua Tab Mpya
                </a>
              )}
            </div>
          </div>
          <button
            onClick={() => setDownloadSuccessToast(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PDF Interactive Preview Modal */}
      {previewPdfModal && previewPdfModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">{previewPdfModal.title}</h3>
                  <p className="text-[11px] text-slate-400">{previewPdfModal.fileName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewPdfModal.url}
                  download={previewPdfModal.fileName}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Pakua PDF
                </a>
                <a
                  href={previewPdfModal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Fungua Tab Mpya
                </a>
                <button
                  onClick={() => setPreviewPdfModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 p-2 overflow-hidden">
              <iframe
                src={previewPdfModal.url}
                title="UWALEMI PDF Preview"
                className="w-full h-full rounded-xl border border-slate-800 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Fine Payment & Receipt Modal */}
      {onSaveState && (
        <UwalemiFinePaymentModal
          isOpen={isFinePaymentModalOpen}
          onClose={() => setIsFinePaymentModalOpen(false)}
          state={state}
          onSaveState={onSaveState}
          initialMemberId={finePaymentModalMemberId}
          initialMeetingId={finePaymentModalMeetingId}
          initialFineType={finePaymentModalType}
          initialAmount={finePaymentModalAmount}
          onOpenSmsWithTemplate={onOpenSmsWithTemplate}
        />
      )}
    </div>
  );
};
