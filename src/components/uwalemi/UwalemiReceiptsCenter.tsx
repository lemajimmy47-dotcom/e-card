import React, { useState, useMemo } from 'react';
import { UwalemiState, UwalemiMember } from '../../types/uwalemi';
import { 
  Receipt, 
  Download, 
  Printer, 
  Share2, 
  Search, 
  CheckCircle2, 
  Eye, 
  Calendar, 
  CreditCard, 
  Send, 
  X, 
  FileText, 
  Sparkles,
  HeartHandshake,
  AlertTriangle
} from 'lucide-react';
import { 
  generatePaymentReceiptPDF, 
  downloadPdfDocument, 
  loadUwalemiLogoAsBase64 
} from '../../services/uwalemiPdfGenerator';
import { 
  normalizePaymentMethod, 
  triggerAutoReceiptSms, 
  formatMemberReceiptDebtLines,
  MONTH_NAMES_SW 
} from '../../services/uwalemiService';

interface Props {
  state: UwalemiState;
  onSaveState: (state: UwalemiState) => Promise<boolean>;
  readOnly?: boolean;
}

export interface UnifiedReceiptItem {
  id: string;
  receiptNo: string;
  type: 'monthly_fee' | 'fine' | 'emergency';
  typeLabel: string;
  memberId: string;
  memberNo: string;
  memberName: string;
  memberPhone?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNo?: string;
  months?: { month: number; monthName: string; year: number; paid: number; balance: number; isPartial: boolean }[];
  fineItems?: { title: string; amount: number; status: string }[];
  emergencyTitle?: string;
  status: 'paid' | 'partial';
  balanceRemaining?: number;
  note?: string;
}

export const UwalemiReceiptsCenter: React.FC<Props> = ({ state, readOnly = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FEES' | 'FINES' | 'EMERGENCY'>('ALL');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('ALL');
  const [groupingMode, setGroupingMode] = useState<'TRANSACTION' | 'MONTHLY'>('TRANSACTION');
  const [previewReceipt, setPreviewReceipt] = useState<UnifiedReceiptItem | null>(null);
  const [resendingSmsId, setResendingSmsId] = useState<string | null>(null);
  const [smsToast, setSmsToast] = useState<{ id: string; type: 'success' | 'error'; message: string } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const membersMap = useMemo(() => {
    const map = new Map<string, UwalemiMember>();
    (state.members || []).forEach(m => {
      map.set(m.id, m);
      if (m.memberNo) map.set(m.memberNo, m);
    });
    return map;
  }, [state.members]);

  // Aggregate and reconstruct ALL receipts from state
  const allReceipts = useMemo(() => {
    const list: UnifiedReceiptItem[] = [];

    // 1. Group Monthly Payments by unique transaction or receiptNo
    const payments = (state.monthlyPayments || []).filter(p => Number(p.paidAmount) > 0);
    const feeGroups = new Map<string, typeof payments>();

    payments.forEach(p => {
      if (groupingMode === 'MONTHLY') {
        // Individual month slip mode
        const rNo = p.receiptNo || `UWL-REC-${p.year}${String(p.month).padStart(2, '0')}-${(p.memberNo || '000').replace('UWL-', '')}`;
        const groupKey = `${p.memberId}_${p.year}_${p.month}_${rNo}`;
        const existing = feeGroups.get(groupKey) || [];
        existing.push(p);
        feeGroups.set(groupKey, existing);
      } else {
        // TRANSACTION BATCH MODE (Default):
        // Group all payments that were made together by the same member in the same transaction
        let groupKey = '';
        if (p.receiptNo && (p.receiptNo.includes('-BATCH-') || p.receiptNo.match(/^UWL-REC-\d{6}-[A-Za-z0-9]+-\d+$/))) {
          groupKey = `${p.memberId}_${p.receiptNo}`;
        } else if (p.paymentDate && p.referenceNo && p.referenceNo.trim() && p.referenceNo !== 'KUTOKA MFUMONI' && p.referenceNo !== '-') {
          groupKey = `${p.memberId}_${p.paymentDate}_${p.referenceNo.trim()}`;
        } else if (p.paymentDate) {
          // Same member paying on the same date with same payment method (e.g. 50,000 for 5 months)
          groupKey = `${p.memberId}_${p.paymentDate}_${p.paymentMethod || 'cash'}`;
        } else {
          groupKey = `${p.memberId}_${p.receiptNo || 'rec'}_${p.year}_${p.month}`;
        }

        const existing = feeGroups.get(groupKey) || [];
        existing.push(p);
        feeGroups.set(groupKey, existing);
      }
    });

    feeGroups.forEach((groupPayments) => {
      const first = groupPayments[0];
      const member = membersMap.get(first.memberId) || membersMap.get(first.memberNo);
      const totalAmt = groupPayments.reduce((sum, p) => sum + Number(p.paidAmount), 0);
      const isMulti = groupPayments.length > 1;

      const monthsBreakdown = groupPayments.map(p => {
        const mName = MONTH_NAMES_SW[p.month - 1] || `Mwezi ${p.month}`;
        const exp = p.expectedAmount || member?.monthlyFeeAmount || 10000;
        const bal = Math.max(0, exp - p.paidAmount);
        return {
          month: p.month,
          monthName: mName,
          year: p.year,
          paid: p.paidAmount,
          balance: bal,
          isPartial: p.status === 'partial' || p.paidAmount < exp
        };
      }).sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));

      const isAnyPartial = monthsBreakdown.some(m => m.isPartial);
      const totalBalanceRemaining = monthsBreakdown.reduce((sum, m) => sum + m.balance, 0);

      // Construct clean master receipt number
      let rNo = first.receiptNo;
      if (!rNo || rNo.startsWith('REC-FEE-')) {
        if (isMulti) {
          rNo = `UWL-REC-BATCH-${first.year}-${(first.memberNo || '000').replace('UWL-', '')}-${monthsBreakdown.length}M`;
        } else {
          rNo = `UWL-REC-${first.year}${String(first.month).padStart(2, '0')}-${(first.memberNo || '000').replace('UWL-', '')}`;
        }
      }

      const monthsSummaryText = isMulti
        ? `STAKABADHI YA MALIPO YA ADA (MIEZI ${groupPayments.length})`
        : `Ada ya ${MONTH_NAMES_SW[first.month - 1] || `Mwezi ${first.month}`} ${first.year}`;

      list.push({
        id: `fee-batch-${rNo}-${first.memberId}-${first.paymentDate}`,
        receiptNo: rNo,
        type: 'monthly_fee',
        typeLabel: monthsSummaryText,
        memberId: first.memberId,
        memberNo: first.memberNo || member?.memberNo || 'UWL-000',
        memberName: first.memberName || member?.fullName || 'Mwanachama',
        memberPhone: member?.phone,
        amount: totalAmt,
        paymentDate: first.paymentDate || new Date().toISOString().split('T')[0],
        paymentMethod: normalizePaymentMethod(first.paymentMethod),
        referenceNo: first.referenceNo || 'KUTOKA MFUMONI',
        months: monthsBreakdown,
        status: isAnyPartial ? 'partial' : 'paid',
        balanceRemaining: totalBalanceRemaining,
        note: first.note
      });
    });

    // 2. Fine Payments
    (state.finePayments || []).forEach(fp => {
      const member = membersMap.get(fp.memberId) || membersMap.get(fp.memberNo);
      const rNo = fp.receiptNo || `UWL-FINE-${fp.id.slice(-6)}`;
      list.push({
        id: `fine-${fp.id}`,
        receiptNo: rNo,
        type: 'fine',
        typeLabel: fp.fineTitle || 'Malipo ya Faini',
        memberId: fp.memberId,
        memberNo: fp.memberNo || member?.memberNo || 'UWL-000',
        memberName: fp.memberName || member?.fullName || 'Mwanachama',
        memberPhone: member?.phone,
        amount: Number(fp.amount) || 0,
        paymentDate: fp.paymentDate || new Date().toISOString().split('T')[0],
        paymentMethod: normalizePaymentMethod(fp.paymentMethod),
        referenceNo: fp.referenceNo || 'KUTOKA MFUMONI',
        fineItems: [{ title: fp.fineTitle || 'Faini', amount: Number(fp.amount) || 0, status: 'Imelipwa' }],
        status: 'paid',
        balanceRemaining: 0,
        note: fp.note
      });
    });

    // 3. Emergency Funds Contributions
    (state.emergencyFunds || []).forEach(ef => {
      (ef.payments || []).forEach(p => {
        const member = membersMap.get(p.memberId) || membersMap.get(p.memberNo);
        const rNo = p.receiptNo || `UWL-EMG-${p.id ? p.id.slice(-6) : Math.floor(1000 + Math.random() * 9000)}`;
        list.push({
          id: `emg-${ef.id}-${p.id || p.memberId}`,
          receiptNo: rNo,
          type: 'emergency',
          typeLabel: `Mchango: ${ef.title}`,
          emergencyTitle: ef.title,
          memberId: p.memberId,
          memberNo: p.memberNo || member?.memberNo || 'UWL-000',
          memberName: p.memberName || member?.fullName || 'Mwanachama',
          memberPhone: member?.phone,
          amount: Number(p.amount) || 0,
          paymentDate: p.paymentDate || new Date().toISOString().split('T')[0],
          paymentMethod: normalizePaymentMethod(p.paymentMethod),
          referenceNo: p.referenceNo || 'KUTOKA MFUMONI',
          status: 'paid',
          balanceRemaining: Math.max(0, (ef.perMemberTarget || 20000) - (Number(p.amount) || 0)),
          note: p.referenceNo
        });
      });
    });

    // Sort with newest payment date first
    return list.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  }, [state.monthlyPayments, state.finePayments, state.emergencyFunds, membersMap]);

  // Extract available years
  const availableYears = useMemo(() => {
    const setYears = new Set<string>();
    allReceipts.forEach(r => {
      if (r.paymentDate) {
        const y = r.paymentDate.split('-')[0];
        if (y && y.length === 4) setYears.add(y);
      }
    });
    return Array.from(setYears).sort().reverse();
  }, [allReceipts]);

  // Filter receipts based on search and filters
  const filteredReceipts = useMemo(() => {
    return allReceipts.filter(r => {
      // Type filter
      if (typeFilter === 'FEES' && r.type !== 'monthly_fee') return false;
      if (typeFilter === 'FINES' && r.type !== 'fine') return false;
      if (typeFilter === 'EMERGENCY' && r.type !== 'emergency') return false;

      // Year filter
      if (selectedYearFilter !== 'ALL') {
        const rYear = r.paymentDate.split('-')[0];
        if (rYear !== selectedYearFilter) return false;
      }

      // Member filter
      if (selectedMemberFilter !== 'ALL') {
        if (r.memberId !== selectedMemberFilter && r.memberNo !== selectedMemberFilter) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesRNo = r.receiptNo.toLowerCase().includes(q);
        const matchesName = r.memberName.toLowerCase().includes(q);
        const matchesMNo = r.memberNo.toLowerCase().includes(q);
        const matchesPhone = !!r.memberPhone && r.memberPhone.includes(q);
        const matchesLabel = r.typeLabel.toLowerCase().includes(q);
        const matchesMonths = r.months && r.months.some(m => m.monthName.toLowerCase().includes(q) || String(m.year).includes(q));

        if (!matchesRNo && !matchesName && !matchesMNo && !matchesPhone && !matchesLabel && !matchesMonths) {
          return false;
        }
      }

      return true;
    });
  }, [allReceipts, typeFilter, selectedYearFilter, selectedMemberFilter, searchQuery]);

  // Statistics
  const totalReceiptsCount = allReceipts.length;
  const totalReceiptedAmount = allReceipts.reduce((sum, r) => sum + r.amount, 0);
  const totalFeesAmount = allReceipts.filter(r => r.type === 'monthly_fee').reduce((sum, r) => sum + r.amount, 0);
  const totalFinesAmount = allReceipts.filter(r => r.type === 'fine' || r.type === 'emergency').reduce((sum, r) => sum + r.amount, 0);

  // Handler to generate and download official PDF
  const handleDownloadPdf = async (receipt: UnifiedReceiptItem) => {
    try {
      setDownloadingId(receipt.id);
      await loadUwalemiLogoAsBase64(state.groupSettings?.logoUrl);

      const breakdownList: { label: string; amount: string; status: string }[] = [];
      if (receipt.months && receipt.months.length > 0) {
        receipt.months.forEach(m => {
          breakdownList.push({
            label: `Ada: ${m.monthName} ${m.year}`,
            amount: `TZS ${m.paid.toLocaleString()}`,
            status: !m.isPartial ? 'Kamili' : `Nusu (Salio: ${m.balance.toLocaleString()})`
          });
        });
      } else if (receipt.fineItems && receipt.fineItems.length > 0) {
        receipt.fineItems.forEach(f => {
          breakdownList.push({
            label: f.title,
            amount: `TZS ${f.amount.toLocaleString()}`,
            status: f.status
          });
        });
      }

      const periodTitle = receipt.months && receipt.months.length > 0
        ? (receipt.months.length > 1 
            ? `Miezi ${receipt.months.length} (${receipt.months.map(m => `${m.monthName.slice(0, 3)} ${m.year}`).join(', ')})`
            : `${receipt.months[0].monthName} ${receipt.months[0].year}`)
        : (receipt.emergencyTitle ? receipt.emergencyTitle : receipt.typeLabel);

      const member = membersMap.get(receipt.memberId) || membersMap.get(receipt.memberNo);
      const debtSummary = member ? formatMemberReceiptDebtLines(member, state) : { grandTotalDebt: 0 };
      const remainingDebtAmt = ('grandTotalDebt' in debtSummary ? debtSummary.grandTotalDebt : (debtSummary as any).totalDebtAfter) || receipt.balanceRemaining || 0;

      const doc = generatePaymentReceiptPDF({
        receiptNo: receipt.receiptNo,
        groupName: state.groupSettings?.groupName || 'UWALEMI',
        slogan: state.groupSettings?.slogan,
        logoUrl: state.groupSettings?.logoUrl || '/uwalemi_logo.png',
        memberNo: receipt.memberNo,
        memberName: receipt.memberName,
        memberPhone: receipt.memberPhone,
        paymentType: receipt.typeLabel,
        periodOrTitle: periodTitle,
        amount: receipt.amount,
        paymentDate: receipt.paymentDate,
        paymentMethod: receipt.paymentMethod,
        referenceNo: receipt.referenceNo || 'KUTOKA MFUMONI',
        receivedBy: 'Mweka Hazina wa UWALEMI',
        statusType: receipt.status,
        balanceRemaining: remainingDebtAmt,
        breakdownItems: breakdownList.length > 0 ? breakdownList : undefined,
        note: receipt.note
      });

      const safeFilename = `Risiti_${receipt.receiptNo}_${receipt.memberNo.replace(/[^a-zA-Z0-9]/g, '')}.pdf`;
      downloadPdfDocument(doc, safeFilename);
    } catch (err: any) {
      console.error("PDF Download Error:", err);
      alert('Hitilafu katika kupakua risiti ya PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Handler to resend Receipt SMS
  const handleResendReceiptSms = async (receipt: UnifiedReceiptItem) => {
    if (readOnly) return;
    const phone = receipt.memberPhone;
    if (!phone) {
      alert(`Mwanachama ${receipt.memberName} hana namba ya simu iliyosajiliwa.`);
      return;
    }

    try {
      setResendingSmsId(receipt.id);
      setSmsToast(null);

      const member = membersMap.get(receipt.memberId) || {
        id: receipt.memberId,
        memberNo: receipt.memberNo,
        fullName: receipt.memberName,
        phone
      } as UwalemiMember;

      const mappedMonths = receipt.months?.map(m => ({
        monthName: m.monthName,
        year: m.year,
        paid: m.paid,
        expected: m.paid + m.balance,
        isPartial: m.isPartial,
        balance: m.balance
      }));

      const res = await triggerAutoReceiptSms({
        state,
        member,
        paymentType: receipt.type === 'fine' ? 'fine' : (receipt.type === 'emergency' ? 'emergency' : 'ada'),
        amount: receipt.amount,
        purpose: receipt.typeLabel,
        receiptNo: receipt.receiptNo,
        paymentDate: receipt.paymentDate,
        paymentMethod: receipt.paymentMethod,
        multiMonthBreakdown: mappedMonths,
        fineBreakdown: receipt.fineItems,
        forceSend: true,
        targetPhone: phone
      });

      if (res.success) {
        setSmsToast({ id: receipt.id, type: 'success', message: `✓ SMS ya risiti ${receipt.receiptNo} imetumwa kwa ${phone}!` });
      } else {
        setSmsToast({ id: receipt.id, type: 'error', message: res.message || 'Haikuweza kutuma SMS ya risiti.' });
      }
    } catch (e: any) {
      setSmsToast({ id: receipt.id, type: 'error', message: e.message || 'Hitilafu ya mtandao wakati wa kutuma SMS.' });
    } finally {
      setResendingSmsId(null);
    }
  };

  // Handler to share receipt on WhatsApp
  const handleShareWhatsApp = (receipt: UnifiedReceiptItem) => {
    let breakdownText = '';
    if (receipt.months && receipt.months.length > 0) {
      breakdownText = 'Mchanganuo wa Miezi:\n' + receipt.months.map(m => `- ${m.monthName} ${m.year}: TZS ${m.paid.toLocaleString()} (${!m.isPartial ? 'Kamili' : `Nusu, Salio: TZS ${m.balance.toLocaleString()}`})`).join('\n') + '\n';
    } else if (receipt.fineItems && receipt.fineItems.length > 0) {
      breakdownText = 'Mchanganuo wa Faini:\n' + receipt.fineItems.map(f => `- ${f.title}: TZS ${f.amount.toLocaleString()} (${f.status})`).join('\n') + '\n';
    }

    const member = membersMap.get(receipt.memberId);
    const debtSummary = member ? formatMemberReceiptDebtLines(member, state) : { fullSummaryText: '' };
    const debtBlock = debtSummary.fullSummaryText ? `\n${debtSummary.fullSummaryText}` : '';

    const msg = `🧾 *${receipt.typeLabel.toUpperCase()}*\n` +
      `*Namba ya Risiti:* ${receipt.receiptNo}\n` +
      `*Mjumbe:* ${receipt.memberName} (${receipt.memberNo})\n` +
      `*Kiasi Kilicholipwa:* TZS ${receipt.amount.toLocaleString()}\n` +
      `*Tarehe ya Malipo:* ${receipt.paymentDate}\n` +
      `*Njia ya Malipo:* ${receipt.paymentMethod}\n\n` +
      (breakdownText ? `${breakdownText}\n` : '') +
      debtBlock +
      `\n_Risiti hii imetolewa kielektroniki na Mfumo Rasmi wa UWALEMI._\n` +
      `*Lema, Nguvu Moja!*`;

    const encoded = encodeURIComponent(msg);
    const targetPhoneClean = (receipt.memberPhone || '').replace(/\D/g, '');
    const waUrl = targetPhoneClean 
      ? `https://wa.me/${targetPhoneClean.startsWith('0') ? '255' + targetPhoneClean.slice(1) : targetPhoneClean}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(waUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 backdrop-blur-md shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">
            <Receipt className="w-4 h-4" />
            Kituo Kikuu cha Risiti & Stakabadhi
          </div>
          <h2 className="text-2xl font-black text-white">Daftari Rasmi la Risiti (Receipts Center)</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Tazama, tafuta, na upakue risiti zote halisi za malipo ya ada za kila mwezi (za mkupuo na mwezi mmoja), faini za vikao, na michango ya dharura wakati wowote kwa mbofyo mmoja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-right">
            <span className="text-[10px] text-slate-400 block font-semibold">Jumla ya Risiti</span>
            <span className="text-lg font-black text-emerald-400 font-mono">{totalReceiptsCount}</span>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-right">
            <span className="text-[10px] text-slate-400 block font-semibold">Jumla ya Fedha</span>
            <span className="text-lg font-black text-white font-mono">TZS {totalReceiptedAmount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Risiti Zote</span>
            <Receipt className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalReceiptsCount}</div>
          <div className="text-[11px] text-slate-400">Stakabadhi rasmi zilizotolewa</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Ada za Kila Mwezi</span>
            <CreditCard className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400 font-mono">TZS {totalFeesAmount.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400">
            {allReceipts.filter(r => r.type === 'monthly_fee').length} risiti za ada
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Faini & Dharura</span>
            <HeartHandshake className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400 font-mono">TZS {totalFinesAmount.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400">
            {allReceipts.filter(r => r.type !== 'monthly_fee').length} risiti za faini/misiba
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Muundo wa Risiti</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">PDF / A5</div>
          <div className="text-[11px] text-slate-400">Nembo, mihuri & saini rasmi</div>
        </div>
      </div>

      {/* Global Toast Alert */}
      {smsToast && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-medium shadow-lg transition-all ${
          smsToast.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200' 
            : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {smsToast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{smsToast.message}</span>
          </div>
          <button type="button" onClick={() => setSmsToast(null)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tafuta kwa Namba ya Risiti (UWL-REC...), Jina la Mwanachama, Namba (UWL-025), au Mwezi..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-medium shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                title="Futa utafutaji"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Member Selector Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold">
                👤 Mwanachama:
              </span>
              <select
                value={selectedMemberFilter}
                onChange={(e) => setSelectedMemberFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs text-white px-3 py-2 rounded-xl outline-none focus:border-emerald-500 cursor-pointer max-w-[200px] truncate"
              >
                <option value="ALL">Wanachama Wote</option>
                {(state.members || []).map(m => (
                  <option key={m.id} value={m.id}>
                    {m.memberNo} - {m.fullName}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold">
                <Calendar className="w-3.5 h-3.5" /> Mwaka:
              </span>
              <select
                value={selectedYearFilter}
                onChange={(e) => setSelectedYearFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs text-white px-3 py-2 rounded-xl outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">Miaka Yote</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Mode Selector and Type Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
          {/* Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                typeFilter === 'ALL'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              Risiti Zote ({allReceipts.length})
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter('FEES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                typeFilter === 'FEES'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-950 text-blue-400 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Ada za Miezi ({allReceipts.filter(r => r.type === 'monthly_fee').length})
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter('FINES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                typeFilter === 'FINES'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-slate-950 text-purple-400 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Faini za Vikao ({allReceipts.filter(r => r.type === 'fine').length})
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter('EMERGENCY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                typeFilter === 'EMERGENCY'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                  : 'bg-slate-950 text-rose-400 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              Dharura & Misiba ({allReceipts.filter(r => r.type === 'emergency').length})
            </button>
          </div>

          {/* Grouping Mode Switcher */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setGroupingMode('TRANSACTION')}
              title="Onyesha risiti kwa muamala uliolipwa (mfano jumla ya TZS 50,000 iliyolipwa mara moja)"
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                groupingMode === 'TRANSACTION'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚡ Malipo ya Mkupuo (Jumla)
            </button>
            <button
              type="button"
              onClick={() => setGroupingMode('MONTHLY')}
              title="Onyesha risiti ya mwezi mmoja mmoja"
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                groupingMode === 'MONTHLY'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📑 Mwezi Mmoja Mmoja
            </button>
          </div>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5">Namba ya Risiti</th>
                <th className="p-3.5">Tarehe</th>
                <th className="p-3.5">Mwanachama</th>
                <th className="p-3.5">Aina ya Malipo & Mchanganuo</th>
                <th className="p-3.5">Kiasi Kilicholipwa</th>
                <th className="p-3.5">Njia</th>
                <th className="p-3.5 text-right">Pakua / Vitendo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Receipt className="w-8 h-8 text-slate-600 opacity-60" />
                      <p className="text-sm font-semibold text-slate-400">Hakuna risiti iliyopatikana kwa kigezo hiki.</p>
                      {(searchQuery || typeFilter !== 'ALL' || selectedYearFilter !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setTypeFilter('ALL');
                            setSelectedYearFilter('ALL');
                          }}
                          className="text-xs text-emerald-400 hover:underline font-semibold cursor-pointer"
                        >
                          Ondoa vichujio vyote (Reset Filters)
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((receipt) => {
                  const isMulti = receipt.months && receipt.months.length > 1;

                  return (
                    <tr key={receipt.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Receipt No */}
                      <td className="p-3.5 font-mono">
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg text-[11px]">
                          <Receipt className="w-3 h-3 text-emerald-400" />
                          {receipt.receiptNo}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        {receipt.paymentDate}
                      </td>

                      {/* Member */}
                      <td className="p-3.5">
                        <div className="font-bold text-white text-xs">{receipt.memberName}</div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <span className="text-emerald-400 font-bold">{receipt.memberNo}</span>
                          <span>•</span>
                          <span>{receipt.memberPhone || 'Hakuna Simu'}</span>
                        </div>
                      </td>

                      {/* Type & Breakdown */}
                      <td className="p-3.5 max-w-xs">
                        <div className="font-semibold text-slate-200">{receipt.typeLabel}</div>
                        {isMulti && receipt.months && (
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono line-clamp-1">
                            {receipt.months.map(m => `${m.monthName.slice(0, 3)}: TZS ${m.paid.toLocaleString()}`).join(' | ')}
                          </div>
                        )}
                        {receipt.status === 'partial' && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded text-[9px] font-bold">
                            Nusu (Salio: TZS {(receipt.balanceRemaining || 0).toLocaleString()})
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="p-3.5 font-mono font-black text-emerald-400 text-sm whitespace-nowrap">
                        TZS {receipt.amount.toLocaleString()}
                      </td>

                      {/* Method */}
                      <td className="p-3.5 text-slate-400 text-[11px] whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          {receipt.paymentMethod}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Download PDF button */}
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(receipt)}
                            disabled={downloadingId === receipt.id}
                            title="Pakua Risiti Rasmi ya PDF (Download PDF)"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-md shadow-emerald-950/40 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {downloadingId === receipt.id ? 'Inapakua...' : 'Pakua PDF'}
                          </button>

                          {/* Preview modal button */}
                          <button
                            type="button"
                            onClick={() => setPreviewReceipt(receipt)}
                            title="Tazama Risiti Kamili"
                            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* WhatsApp button */}
                          <button
                            type="button"
                            onClick={() => handleShareWhatsApp(receipt)}
                            title="Tuma Risiti kwa WhatsApp"
                            className="p-1.5 rounded-xl bg-teal-900/30 hover:bg-teal-600 border border-teal-500/30 text-teal-400 hover:text-white transition-all cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>

                          {/* SMS button */}
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => handleResendReceiptSms(receipt)}
                              disabled={resendingSmsId === receipt.id}
                              title="Tuma Tena SMS ya Risiti"
                              className="p-1.5 rounded-xl bg-blue-900/30 hover:bg-blue-600 border border-blue-500/30 text-blue-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: FULL RECEIPT PREVIEW */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Stakabadhi Rasmi ya Malipo</h3>
                  <span className="text-xs text-slate-400 font-mono">Na: {previewReceipt.receiptNo}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceipt(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Paper Layout Preview */}
            <div className="bg-white text-slate-900 p-5 rounded-2xl border border-slate-300 shadow-inner space-y-4 text-xs font-sans">
              {/* Header Box */}
              <div className="bg-emerald-800 text-white p-3 rounded-xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-white p-1 flex items-center justify-center">
                  <img src={state.groupSettings?.logoUrl || "/uwalemi_logo.png"} alt="UWALEMI" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h4 className="font-black text-sm tracking-wide">{state.groupSettings?.groupName || 'UWALEMI'}</h4>
                  <p className="text-[10px] text-emerald-200 italic">&ldquo;{state.groupSettings?.slogan || 'Lema, Nguvu Moja.'}&rdquo;</p>
                  <p className="text-[9px] text-emerald-300">Kikundi Rasmi cha Kijamii • Mfumo wa Fedha na Stakabadhi</p>
                </div>
              </div>

              <div className="text-center border-b border-slate-200 pb-2">
                <h5 className="font-bold text-slate-800 uppercase tracking-wide">RISITI RASMI YA MALIPO (PAYMENT RECEIPT)</h5>
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1">
                  <span>Na. ya Risiti: <strong>{previewReceipt.receiptNo}</strong></span>
                  <span>Tarehe: <strong>{previewReceipt.paymentDate}</strong></span>
                </div>
              </div>

              {/* Details Table */}
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between border-b border-slate-100 py-1">
                  <span className="text-slate-500">Namba ya Mjumbe:</span>
                  <span className="font-bold font-mono">{previewReceipt.memberNo}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-1">
                  <span className="text-slate-500">Jina la Mjumbe:</span>
                  <span className="font-bold">{previewReceipt.memberName}</span>
                </div>
                {previewReceipt.memberPhone && (
                  <div className="flex justify-between border-b border-slate-100 py-1">
                    <span className="text-slate-500">Simu ya Mjumbe:</span>
                    <span className="font-mono">{previewReceipt.memberPhone}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-slate-100 py-1">
                  <span className="text-slate-500">Aina ya Malipo:</span>
                  <span className="font-bold">{previewReceipt.typeLabel}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-1">
                  <span className="text-slate-500">Njia ya Malipo:</span>
                  <span className="font-semibold">{previewReceipt.paymentMethod}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-1">
                  <span className="text-slate-500">Namba ya Kumbukumbu:</span>
                  <span className="font-mono">{previewReceipt.referenceNo}</span>
                </div>
                <div className="flex justify-between bg-emerald-50 border border-emerald-200 p-2 rounded-lg py-1.5">
                  <span className="font-bold text-emerald-900">Kiasi Kilicholipwa:</span>
                  <span className="font-black font-mono text-emerald-700 text-sm">TZS {previewReceipt.amount.toLocaleString()}</span>
                </div>
              </div>

              {/* Multi-month breakdown table if exists */}
              {previewReceipt.months && previewReceipt.months.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden text-[10px]">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-1.5">Mwezi / Kipindi</th>
                        <th className="p-1.5">Kiasi</th>
                        <th className="p-1.5">Hali</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewReceipt.months.map(m => (
                        <tr key={`${m.month}-${m.year}`}>
                          <td className="p-1.5 font-medium">Ada: {m.monthName} {m.year}</td>
                          <td className="p-1.5 font-mono font-bold">TZS {m.paid.toLocaleString()}</td>
                          <td className="p-1.5 font-semibold text-emerald-700">{!m.isPartial ? 'Kamili' : `Nusu`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Stamp and verification footer */}
              <div className="text-center pt-2 border-t border-slate-200">
                <div className="inline-block border-2 border-emerald-600 text-emerald-700 font-black px-4 py-1 rounded-full text-[10px] tracking-wider uppercase">
                  IMELIPWA • PAID
                </div>
                <p className="text-[8.5px] text-slate-400 mt-1">Risiti hii imetolewa kielektroniki kupitia Mfumo wa UWALEMI.</p>
              </div>
            </div>

            {/* Action buttons inside Modal */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleDownloadPdf(previewReceipt)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/40"
              >
                <Download className="w-4 h-4" />
                Pakua Risiti ya PDF
              </button>

              <button
                type="button"
                onClick={() => handleShareWhatsApp(previewReceipt)}
                className="py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                WhatsApp
              </button>

              <button
                type="button"
                onClick={() => setPreviewReceipt(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
              >
                Funga
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
