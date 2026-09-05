import React, { useState, useEffect, useMemo } from 'react';
import { UwalemiState, UwalemiMember, UwalemiMonthlyPayment } from '../../types/uwalemi';
import { 
  Calendar, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  Send, 
  FileSpreadsheet, 
  Printer, 
  Search, 
  Check, 
  X,
  Share2,
  Wallet,
  Download,
  Sparkles,
  Zap,
  CheckCheck,
  RotateCcw,
  Calculator,
  CalendarDays,
  Layers,
  ArrowRight,
  Receipt,
  Info,
  ShieldCheck,
  Coins
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { generatePaymentReceiptPDF } from '../../services/uwalemiPdfGenerator';
import { 
  sortMembersByLeadership, 
  getDefaultFeeForMonth, 
  triggerAutoReceiptSms,
  calculateMemberFeeDebt,
  formatMemberReceiptDebtLines 
} from '../../services/uwalemiService';

interface Props {
  state: UwalemiState;
  onSaveState: (state: UwalemiState) => Promise<boolean>;
  onOpenSmsWithTemplate?: (recipients: { name: string; phone: string; memberNo: string }[], templateText: string) => void;
  autoOpenRecordModal?: boolean;
  onResetAutoOpen?: () => void;
}

export const UwalemiMonthlyFees: React.FC<Props> = ({ 
  state, 
  onSaveState, 
  onOpenSmsWithTemplate,
  autoOpenRecordModal,
  onResetAutoOpen
}) => {
  useEffect(() => {
    if (autoOpenRecordModal) {
      setIsRecordModalOpen(true);
      if (onResetAutoOpen) {
        onResetAutoOpen();
      }
    }
  }, [autoOpenRecordModal, onResetAutoOpen]);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const availableYears = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // all, paid, unpaid, partial
  
  // View & Bulk Modes
  const [viewMode, setViewMode] = useState<'single' | 'matrix'>('single');
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [recordMode, setRecordMode] = useState<'smart' | 'single'>('smart');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [viewingReceipt, setViewingReceipt] = useState<UwalemiMonthlyPayment | null>(null);
  const [viewingMultiReceipt, setViewingMultiReceipt] = useState<{
    member: UwalemiMember;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    referenceNo: string;
    receiptNo: string;
    months: {
      year: number;
      month: number;
      monthName: string;
      paid: number;
      expected: number;
      isPartial: boolean;
      balance: number;
    }[];
    totalDebtAfter: number;
  } | null>(null);

  // Custom Confirmation Dialog States
  const [wholeYearConfirmOpen, setWholeYearConfirmOpen] = useState(false);
  const [wholeYearData, setWholeYearData] = useState<{ member: UwalemiMember; year: number } | null>(null);

  // Annual Manual Entry Modal State (Jan - Dec)
  const [isAnnualModalOpen, setIsAnnualModalOpen] = useState<boolean>(false);
  const [annualFastFillAmount, setAnnualFastFillAmount] = useState<number>(state.groupSettings?.monthlyFeeDefault || 10000);
  const [annualForm, setAnnualForm] = useState<{
    targetMemberId: string; // 'all' or specific memberId
    year: number;
    monthlyAmounts: { [month: number]: number }; // 1 to 12
    paymentDate: string;
    paymentMethod: string;
    referenceNo: string;
    note: string;
  }>({
    targetMemberId: 'all',
    year: currentYear,
    monthlyAmounts: {
      1: getDefaultFeeForMonth(currentYear, 1),
      2: getDefaultFeeForMonth(currentYear, 2),
      3: getDefaultFeeForMonth(currentYear, 3),
      4: getDefaultFeeForMonth(currentYear, 4),
      5: getDefaultFeeForMonth(currentYear, 5),
      6: getDefaultFeeForMonth(currentYear, 6),
      7: getDefaultFeeForMonth(currentYear, 7),
      8: getDefaultFeeForMonth(currentYear, 8),
      9: getDefaultFeeForMonth(currentYear, 9),
      10: getDefaultFeeForMonth(currentYear, 10),
      11: getDefaultFeeForMonth(currentYear, 11),
      12: getDefaultFeeForMonth(currentYear, 12),
    },
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'M-Pesa (Lipa Namba)',
    referenceNo: '',
    note: `Ada ya mwaka mzima wa ${currentYear}`
  });

  // Bulk Payment Form
  const [bulkForm, setBulkForm] = useState<{
    targetMemberId: string; // 'all' or specific memberId
    year: number;
    months: number[]; // 1 - 12
    amountPerMonth: number;
    useDefaultRates: boolean;
    paymentDate: string;
    paymentMethod: string;
    referenceNo: string;
  }>({
    targetMemberId: 'all',
    year: currentYear,
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    amountPerMonth: getDefaultFeeForMonth(currentYear, currentMonth),
    useDefaultRates: true,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'M-Pesa (Lipa Namba)',
    referenceNo: ''
  });

  // Form State
  const [paymentForm, setPaymentForm] = useState<{
    memberId: string;
    year: number;
    month: number;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    referenceNo: string;
    note: string;
    isTopUp: boolean;
  }>({
    memberId: '',
    year: currentYear,
    month: currentMonth,
    amount: getDefaultFeeForMonth(currentYear, currentMonth),
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'M-Pesa (Lipa Namba)',
    referenceNo: '',
    note: '',
    isTopUp: true
  });

  const members = sortMembersByLeadership(state.members || []);
  const monthlyPayments = state.monthlyPayments || [];

  const monthNamesSw = ['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'];

  // Current selected member in modal
  const selectedModalMember = useMemo(() => {
    return members.find(m => m.id === paymentForm.memberId);
  }, [members, paymentForm.memberId]);

  // Selected member debt info
  const selectedMemberDebtInfo = useMemo(() => {
    if (!selectedModalMember) return null;
    return calculateMemberFeeDebt(selectedModalMember, state);
  }, [selectedModalMember, state]);

  // Smart allocation calculation for entered amount across unpaid/partial months
  const smartAllocation = useMemo(() => {
    if (!selectedModalMember || Number(paymentForm.amount) <= 0) {
      return { months: [], totalAllocated: 0, remainder: 0, debtAfter: selectedMemberDebtInfo?.feeDebt || 0 };
    }

    let available = Number(paymentForm.amount);
    const resultMonths: {
      year: number;
      month: number;
      monthName: string;
      expected: number;
      previouslyPaid: number;
      amountAllocated: number;
      newTotalPaid: number;
      isPartial: boolean;
      balanceRemaining: number;
    }[] = [];

    const startYear = selectedModalMember.joinDate ? new Date(selectedModalMember.joinDate).getFullYear() : 2024;
    const currentY = new Date().getFullYear();
    const currentM = new Date().getMonth() + 1;

    // First scan all past/current unpaid or partially paid months
    for (let y = Math.min(startYear, 2024); y <= currentY; y++) {
      const endM = y === currentY ? currentM : 12;
      for (let m = 1; m <= endM; m++) {
        const exp = getDefaultFeeForMonth(y, m, selectedModalMember.monthlyFeeAmount);
        const existing = monthlyPayments.find(p => p.memberId === selectedModalMember.id && Number(p.year) === y && Number(p.month) === m);
        const prevPaid = existing ? Number(existing.paidAmount) || 0 : 0;
        const needed = Math.max(0, exp - prevPaid);
        if (needed > 0 && available > 0) {
          const alloc = Math.min(needed, available);
          const newTotal = prevPaid + alloc;
          const isPart = newTotal < exp;
          const bal = exp - newTotal;
          resultMonths.push({
            year: y,
            month: m,
            monthName: monthNamesSw[m - 1],
            expected: exp,
            previouslyPaid: prevPaid,
            amountAllocated: alloc,
            newTotalPaid: newTotal,
            isPartial: isPart,
            balanceRemaining: bal
          });
          available -= alloc;
        }
      }
    }

    // If still amount left, advance into upcoming future months
    if (available > 0) {
      let nextY = currentY;
      let nextM = currentM + 1;
      while (available > 0 && nextY <= currentY + 1) {
        if (nextM > 12) {
          nextM = 1;
          nextY += 1;
        }
        const exp = getDefaultFeeForMonth(nextY, nextM, selectedModalMember.monthlyFeeAmount);
        const existing = monthlyPayments.find(p => p.memberId === selectedModalMember.id && Number(p.year) === nextY && Number(p.month) === nextM);
        const prevPaid = existing ? Number(existing.paidAmount) || 0 : 0;
        const needed = Math.max(0, exp - prevPaid);
        const alloc = Math.min(needed > 0 ? needed : exp, available);
        const newTotal = prevPaid + alloc;
        const isPart = newTotal < exp;
        const bal = exp - newTotal;
        resultMonths.push({
          year: nextY,
          month: nextM,
          monthName: monthNamesSw[nextM - 1],
          expected: exp,
          previouslyPaid: prevPaid,
          amountAllocated: alloc,
          newTotalPaid: newTotal,
          isPartial: isPart,
          balanceRemaining: bal
        });
        available -= alloc;
        nextM += 1;
      }
    }

    const totalAllocated = Number(paymentForm.amount) - available;
    const currentFeeDebt = selectedMemberDebtInfo?.feeDebt || 0;
    const debtAfter = Math.max(0, currentFeeDebt - totalAllocated);

    return {
      months: resultMonths,
      totalAllocated,
      remainder: available,
      debtAfter
    };
  }, [selectedModalMember, paymentForm.amount, selectedMemberDebtInfo, monthlyPayments, monthNamesSw]);

  // Payments for selected year and month
  const currentMonthRecords = monthlyPayments.filter(p => Number(p.year) === Number(selectedYear) && Number(p.month) === Number(selectedMonth));

  // Aggregate stats
  const activeMembers = members.filter(m => m.status === 'active');
  const paidMembersCount = currentMonthRecords.filter(p => p.status === 'paid').length;
  const partialMembersCount = currentMonthRecords.filter(p => p.status === 'partial').length;
  const unpaidMembersCount = Math.max(0, activeMembers.length - (paidMembersCount + partialMembersCount));
  const totalAmountCollected = currentMonthRecords.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
  const targetMonthlyAmount = activeMembers.reduce((sum, m) => sum + getDefaultFeeForMonth(selectedYear, selectedMonth, m.monthlyFeeAmount), 0);

  // Filtered members for table
  const membersWithStatus = members.map(m => {
    const payment = currentMonthRecords.find(p => p.memberId === m.id || p.memberNo === m.memberNo);
    const expected = getDefaultFeeForMonth(selectedYear, selectedMonth, m.monthlyFeeAmount);
    const paid = payment ? Number(payment.paidAmount) || 0 : 0;
    let status: 'paid' | 'partial' | 'unpaid' = 'unpaid';
    if (paid >= expected && expected > 0) status = 'paid';
    else if (paid > 0) status = 'partial';
    else if (expected === 0 && paid === 0) status = 'paid';

    return {
      member: m,
      payment,
      expected,
      paid,
      status
    };
  });

  const filteredItems = membersWithStatus.filter(item => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      item.member.fullName.toLowerCase().includes(term) ||
      item.member.memberNo.toLowerCase().includes(term) ||
      item.member.phone.includes(term);
    
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.memberId) {
      alert('Tafadhali chagua mwanachama.');
      return;
    }

    const member = members.find(m => m.id === paymentForm.memberId);
    if (!member) return;

    const paidAmount = Number(paymentForm.amount);
    if (paidAmount <= 0) {
      alert('Tafadhali weka kiasi halali kilicholipwa.');
      return;
    }

    if (recordMode === 'smart' && smartAllocation.months.length > 0) {
      // Smart Multi-Month / Lump Sum Allocation
      let updatedPayments = [...monthlyPayments];
      const masterReceiptNo = `UWL-REC-${paymentForm.year}${String(paymentForm.month).padStart(2, '0')}-${member.memberNo.replace('UWL-', '')}-${Date.now().toString().slice(-4)}`;

      smartAllocation.months.forEach(alloc => {
        const pStatus: 'paid' | 'partial' | 'unpaid' = alloc.newTotalPaid >= alloc.expected ? 'paid' : alloc.newTotalPaid > 0 ? 'partial' : 'unpaid';
        const singleReceiptNo = `UWL-REC-${alloc.year}${String(alloc.month).padStart(2, '0')}-${member.memberNo.replace('UWL-', '')}`;
        
        const newP: UwalemiMonthlyPayment = {
          id: `uwl-fee-${member.id}-${alloc.year}-${alloc.month}`,
          memberId: member.id,
          memberNo: member.memberNo,
          memberName: member.fullName,
          year: alloc.year,
          month: alloc.month,
          expectedAmount: alloc.expected,
          paidAmount: alloc.newTotalPaid,
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod,
          referenceNo: paymentForm.referenceNo,
          status: pStatus,
          receiptNo: singleReceiptNo,
          note: paymentForm.note || `Malipo ya ada (${alloc.monthName} ${alloc.year})`
        };

        updatedPayments = updatedPayments.filter(
          p => !(p.memberId === member.id && Number(p.year) === alloc.year && Number(p.month) === alloc.month)
        );
        updatedPayments.push(newP);
      });

      const updatedState = { ...state, monthlyPayments: updatedPayments };
      await onSaveState(updatedState);
      setIsRecordModalOpen(false);

      // Open Multi-Month Receipt Viewer
      setViewingMultiReceipt({
        member,
        amount: paidAmount,
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod,
        referenceNo: paymentForm.referenceNo,
        receiptNo: masterReceiptNo,
        months: smartAllocation.months.map(m => ({
          year: m.year,
          month: m.month,
          monthName: m.monthName,
          paid: m.amountAllocated,
          expected: m.expected,
          isPartial: m.isPartial,
          balance: m.balanceRemaining
        })),
        totalDebtAfter: smartAllocation.debtAfter
      });

      // Trigger Automated Receipt SMS
      if (state.groupSettings?.smsConfig?.autoSendReceipts) {
        triggerAutoReceiptSms({
          state: updatedState,
          member,
          paymentType: 'ada',
          amount: paidAmount,
          purpose: smartAllocation.months.length === 1 
            ? `Ada ya mwezi wa ${smartAllocation.months[0].monthName} ${smartAllocation.months[0].year}` 
            : `Ada ya Miezi (${smartAllocation.months.length})`,
          receiptNo: masterReceiptNo,
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod,
          isPartial: smartAllocation.months.length === 1 ? smartAllocation.months[0].isPartial : false,
          expectedAmount: smartAllocation.months.length === 1 ? smartAllocation.months[0].expected : undefined,
          monthBalance: smartAllocation.months.length === 1 ? smartAllocation.months[0].balanceRemaining : undefined,
          multiMonthBreakdown: smartAllocation.months.map(m => ({
            monthName: m.monthName,
            year: m.year,
            paid: m.amountAllocated,
            expected: m.expected,
            isPartial: m.isPartial,
            balance: m.balanceRemaining
          })),
          totalDebtAfter: smartAllocation.debtAfter
        }).catch(err => console.warn('[Auto Receipt SMS Error]:', err));
      }
    } else {
      // Single Specific Month Mode
      const expected = getDefaultFeeForMonth(paymentForm.year, paymentForm.month, member.monthlyFeeAmount);
      const existingPayment = monthlyPayments.find(
        p => p.memberId === member.id && Number(p.year) === Number(paymentForm.year) && Number(p.month) === Number(paymentForm.month)
      );
      const prevPaid = existingPayment ? Number(existingPayment.paidAmount) || 0 : 0;
      
      const totalPaidThisMonth = paymentForm.isTopUp ? prevPaid + paidAmount : paidAmount;
      const status: 'paid' | 'partial' | 'unpaid' = (totalPaidThisMonth >= expected && expected > 0) || (expected === 0 && totalPaidThisMonth === 0) 
        ? 'paid' 
        : totalPaidThisMonth > 0 
          ? 'partial' 
          : 'unpaid';
      
      const receiptNo = `UWL-REC-${paymentForm.year}${String(paymentForm.month).padStart(2, '0')}-${member.memberNo.replace('UWL-', '')}`;

      const newPayment: UwalemiMonthlyPayment = {
        id: `uwl-fee-${member.id}-${paymentForm.year}-${paymentForm.month}`,
        memberId: member.id,
        memberNo: member.memberNo,
        memberName: member.fullName,
        year: Number(paymentForm.year),
        month: Number(paymentForm.month),
        expectedAmount: expected,
        paidAmount: totalPaidThisMonth,
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod,
        referenceNo: paymentForm.referenceNo,
        status,
        receiptNo,
        note: paymentForm.note || `Ada ya mwezi wa ${monthNamesSw[paymentForm.month - 1]} ${paymentForm.year}`
      };

      const updatedPayments = monthlyPayments.filter(
        p => !(p.memberId === member.id && Number(p.year) === Number(paymentForm.year) && Number(p.month) === Number(paymentForm.month))
      );
      updatedPayments.push(newPayment);

      const updatedState = { ...state, monthlyPayments: updatedPayments };
      await onSaveState(updatedState);
      setIsRecordModalOpen(false);
      setViewingReceipt(newPayment);

      // Compute remaining fee debt after saving
      const debtAfter = Math.max(0, (selectedMemberDebtInfo?.feeDebt || 0) - paidAmount);

      // Trigger Automated Receipt SMS
      if (state.groupSettings?.smsConfig?.autoSendReceipts && paidAmount > 0) {
        triggerAutoReceiptSms({
          state: updatedState,
          member,
          paymentType: 'ada',
          amount: paidAmount,
          purpose: `Ada ya mwezi wa ${monthNamesSw[Number(paymentForm.month) - 1]} ${paymentForm.year}`,
          receiptNo,
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod,
          isPartial: status === 'partial',
          expectedAmount: expected,
          monthBalance: Math.max(0, expected - totalPaidThisMonth),
          totalDebtAfter: debtAfter
        }).catch(err => console.warn('[Auto Receipt SMS Error]:', err));
      }
    }
  };

  const handleQuickMarkPaid = async (member: UwalemiMember) => {
    const expected = getDefaultFeeForMonth(selectedYear, selectedMonth, member.monthlyFeeAmount);
    const receiptNo = `UWL-REC-${selectedYear}${String(selectedMonth).padStart(2, '0')}-${member.memberNo.replace('UWL-', '')}`;

    const newPayment: UwalemiMonthlyPayment = {
      id: `uwl-fee-${member.id}-${selectedYear}-${selectedMonth}`,
      memberId: member.id,
      memberNo: member.memberNo,
      memberName: member.fullName,
      year: selectedYear,
      month: selectedMonth,
      expectedAmount: expected,
      paidAmount: expected,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'M-Pesa (Lipa Namba)',
      referenceNo: `AUTO-${Date.now().toString().slice(-6)}`,
      status: 'paid',
      receiptNo,
      note: `Ada ya mwezi wa ${monthNamesSw[selectedMonth - 1]} ${selectedYear}`
    };

    const updatedPayments = monthlyPayments.filter(
      p => !(p.memberId === member.id && p.year === selectedYear && p.month === selectedMonth)
    );
    updatedPayments.push(newPayment);

    const updatedState = { ...state, monthlyPayments: updatedPayments };
    await onSaveState(updatedState);

    // Tuma Stakabadhi ya SMS Kiotomatiki
    if (state.groupSettings?.smsConfig?.autoSendReceipts && expected > 0) {
      triggerAutoReceiptSms({
        state: updatedState,
        member,
        paymentType: 'ada',
        amount: expected,
        purpose: `Ada ya mwezi wa ${monthNamesSw[selectedMonth - 1]} ${selectedYear}`,
        receiptNo,
        paymentDate: newPayment.paymentDate,
        paymentMethod: newPayment.paymentMethod
      }).catch(err => console.warn('[Auto Receipt SMS Error]:', err));
    }
  };

  // Toggle single cell in Matrix Mode
  const handleToggleMonthCell = async (member: UwalemiMember, year: number, month: number) => {
    const existing = monthlyPayments.find(p => p.memberId === member.id && p.year === year && p.month === month);
    const expected = getDefaultFeeForMonth(year, month, member.monthlyFeeAmount);

    let updatedPayments = [...monthlyPayments];
    if (existing && existing.paidAmount >= expected) {
      // Toggle to unpaid
      updatedPayments = updatedPayments.filter(p => !(p.memberId === member.id && p.year === year && p.month === month));
    } else {
      // Mark as paid
      const receiptNo = `UWL-REC-${year}${String(month).padStart(2, '0')}-${member.memberNo.replace('UWL-', '')}`;
      const newPayment: UwalemiMonthlyPayment = {
        id: `uwl-fee-${member.id}-${year}-${month}`,
        memberId: member.id,
        memberNo: member.memberNo,
        memberName: member.fullName,
        year,
        month,
        expectedAmount: expected,
        paidAmount: expected,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Taslimu / Benki',
        referenceNo: `BULK-${year}`,
        status: 'paid',
        receiptNo,
        note: `Ada ya mwezi wa ${monthNamesSw[month - 1]} ${year}`
      };
      updatedPayments = updatedPayments.filter(p => !(p.memberId === member.id && p.year === year && p.month === month));
      updatedPayments.push(newPayment);
    }
    await onSaveState({ ...state, monthlyPayments: updatedPayments });
  };

  // Mark all 12 months paid for a member in a specific year
  const handleMarkWholeYearPaid = (member: UwalemiMember, year: number) => {
    setWholeYearData({ member, year });
    setWholeYearConfirmOpen(true);
  };

  const executeMarkWholeYearPaid = async (member: UwalemiMember, year: number) => {
    let updatedPayments = monthlyPayments.filter(p => !(p.memberId === member.id && p.year === year));

    const startMonthForYear = year < 2023 ? 13 : year === 2023 ? 11 : 1;
    for (let m = startMonthForYear; m <= 12; m++) {
      const expected = getDefaultFeeForMonth(year, m, member.monthlyFeeAmount);
      const receiptNo = `UWL-REC-${year}${String(m).padStart(2, '0')}-${member.memberNo.replace('UWL-', '')}`;
      const monthStr = String(m).padStart(2, '0');
      updatedPayments.push({
        id: `uwl-fee-${member.id}-${year}-${m}`,
        memberId: member.id,
        memberNo: member.memberNo,
        memberName: member.fullName,
        year,
        month: m,
        expectedAmount: expected,
        paidAmount: expected,
        paymentDate: `${year}-${monthStr}-15`,
        paymentMethod: 'Taslimu / Benki',
        referenceNo: `YEAR-${year}`,
        status: 'paid',
        receiptNo,
        note: `Ada ya mwaka mzima wa ${year}`
      });
    }

    await onSaveState({ ...state, monthlyPayments: updatedPayments });
  };

  // Open Annual Manual Entry Modal
  const handleOpenAnnualModal = (memberId: string = 'all', targetYear: number = selectedYear) => {
    // Calculate initial amounts for all 12 months
    const initialAmounts: { [m: number]: number } = {};
    if (memberId !== 'all') {
      const mem = members.find(m => m.id === memberId);
      for (let m = 1; m <= 12; m++) {
        const existing = monthlyPayments.find(
          p => p.memberId === memberId && Number(p.year) === Number(targetYear) && Number(p.month) === Number(m)
        );
        const mFee = getDefaultFeeForMonth(targetYear, m, mem?.monthlyFeeAmount);
        initialAmounts[m] = existing ? Number(existing.paidAmount) : mFee;
      }
      setAnnualFastFillAmount(getDefaultFeeForMonth(targetYear, 1, mem?.monthlyFeeAmount));
    } else {
      for (let m = 1; m <= 12; m++) {
        initialAmounts[m] = getDefaultFeeForMonth(targetYear, m);
      }
      setAnnualFastFillAmount(getDefaultFeeForMonth(targetYear, 1));
    }

    setAnnualForm({
      targetMemberId: memberId,
      year: targetYear,
      monthlyAmounts: initialAmounts,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'M-Pesa (Lipa Namba)',
      referenceNo: '',
      note: `Ada ya mwaka mzima wa ${targetYear}`
    });
    setIsAnnualModalOpen(true);
  };

  // Fast apply specific amount across all 12 months in the modal
  const handleApplyAmountToAllMonths = (amount: number) => {
    const newAmounts: { [m: number]: number } = {};
    for (let m = 1; m <= 12; m++) {
      newAmounts[m] = amount;
    }
    setAnnualForm(prev => ({ ...prev, monthlyAmounts: newAmounts }));
  };

  // Save Annual Payments (Jan - Dec)
  const handleSaveAnnualPayments = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const targetMembers = annualForm.targetMemberId === 'all' 
      ? members.filter(m => m.status === 'active')
      : members.filter(m => m.id === annualForm.targetMemberId);

    if (targetMembers.length === 0) {
      alert('Hakuna wajumbe waliochaguliwa.');
      return;
    }

    let updatedPayments = [...monthlyPayments];
    let countRecordsSaved = 0;

    targetMembers.forEach(mem => {
      for (let m = 1; m <= 12; m++) {
        const memberExpected = getDefaultFeeForMonth(annualForm.year, m, mem.monthlyFeeAmount);
        const paidVal = Number(annualForm.monthlyAmounts[m]) || 0;
        
        // Remove any existing payment for this member, year and month
        updatedPayments = updatedPayments.filter(
          p => !(p.memberId === mem.id && Number(p.year) === Number(annualForm.year) && Number(p.month) === Number(m))
        );

        if (paidVal > 0) {
          countRecordsSaved++;
          const status: 'paid' | 'partial' | 'unpaid' = (paidVal >= memberExpected && memberExpected > 0) || (memberExpected === 0 && paidVal === 0) 
            ? 'paid' 
            : 'partial';
          const receiptNo = `UWL-REC-${annualForm.year}${String(m).padStart(2, '0')}-${mem.memberNo.replace('UWL-', '')}`;
          const monthStr = String(m).padStart(2, '0');
          const calculatedDate = annualForm.paymentDate && annualForm.paymentDate.startsWith(String(annualForm.year))
            ? annualForm.paymentDate
            : `${annualForm.year}-${monthStr}-15`;

          updatedPayments.push({
            id: `uwl-fee-${mem.id}-${annualForm.year}-${m}`,
            memberId: mem.id,
            memberNo: mem.memberNo,
            memberName: mem.fullName,
            year: Number(annualForm.year),
            month: Number(m),
            expectedAmount: memberExpected,
            paidAmount: paidVal,
            paymentDate: calculatedDate,
            paymentMethod: annualForm.paymentMethod,
            referenceNo: annualForm.referenceNo || `YEAR-${annualForm.year}`,
            status,
            receiptNo,
            note: annualForm.note || `Ada ya mwezi wa ${monthNamesSw[m - 1]} ${annualForm.year}`
          });
        }
      }
    });

    await onSaveState({ ...state, monthlyPayments: updatedPayments });
    setIsAnnualModalOpen(false);
    alert(`Taarifa za ada za mwaka ${annualForm.year} kuanzia Januari hadi Desemba zimehifadhiwa kikamilifu kwa wajumbe ${targetMembers.length}! (Miamala ${countRecordsSaved})`);
  };

  // Bulk Multi-Month Save
  const handleSaveBulkPayments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkForm.months.length === 0) {
      alert('Tafadhali chagua angalau mwezi mmoja.');
      return;
    }

    const targetMembers = bulkForm.targetMemberId === 'all' 
      ? members.filter(m => m.status === 'active')
      : members.filter(m => m.id === bulkForm.targetMemberId);

    if (targetMembers.length === 0) {
      alert('Hakuna wanachama waliochaguliwa.');
      return;
    }

    let updatedPayments = [...monthlyPayments];

    targetMembers.forEach(mem => {
      bulkForm.months.forEach(m => {
        const expected = bulkForm.useDefaultRates
          ? getDefaultFeeForMonth(bulkForm.year, m, mem.monthlyFeeAmount)
          : (bulkForm.amountPerMonth || getDefaultFeeForMonth(bulkForm.year, m, mem.monthlyFeeAmount));
        const receiptNo = `UWL-REC-${bulkForm.year}${String(m).padStart(2, '0')}-${mem.memberNo.replace('UWL-', '')}`;
        const monthStr = String(m).padStart(2, '0');
        const calculatedDate = `${bulkForm.year}-${monthStr}-15`;
        // Remove existing
        updatedPayments = updatedPayments.filter(p => !(p.memberId === mem.id && p.year === bulkForm.year && p.month === m));
        updatedPayments.push({
          id: `uwl-fee-${mem.id}-${bulkForm.year}-${m}`,
          memberId: mem.id,
          memberNo: mem.memberNo,
          memberName: mem.fullName,
          year: Number(bulkForm.year),
          month: Number(m),
          expectedAmount: expected,
          paidAmount: expected,
          paymentDate: bulkForm.paymentDate && bulkForm.paymentDate.startsWith(String(bulkForm.year)) ? bulkForm.paymentDate : calculatedDate,
          paymentMethod: bulkForm.paymentMethod,
          referenceNo: bulkForm.referenceNo || `BULK-${bulkForm.year}`,
          status: 'paid',
          receiptNo,
          note: `Uingizaji wa kihistoria (${bulkForm.year})`
        });
      });
    });

    await onSaveState({ ...state, monthlyPayments: updatedPayments });
    setIsBulkModalOpen(false);
    alert(`Miamala ya ada kwa miezi ${bulkForm.months.length} kwa wanachama ${targetMembers.length} imewasilishwa kwa ufanisi!`);
  };

  // Download Import Template for Historical Payments
  const handleDownloadFeeImportTemplate = () => {
    const rows = [
      {
        'Namba ya Mwanachama': 'UWL-001',
        'Jina Kamili': 'Jimson Lema',
        'Mwaka': 2023,
        'Mwezi (1-12)': 1,
        'Kiasi Kilicholipwa': 10000,
        'Tarehe (YYYY-MM-DD)': '2023-01-15',
        'Njia ya Malipo': 'M-Pesa'
      },
      {
        'Namba ya Mwanachama': 'UWL-001',
        'Jina Kamili': 'Jimson Lema',
        'Mwaka': 2023,
        'Mwezi (1-12)': 2,
        'Kiasi Kilicholipwa': 10000,
        'Tarehe (YYYY-MM-DD)': '2023-02-15',
        'Njia ya Malipo': 'M-Pesa'
      },
      {
        'Namba ya Mwanachama': 'UWL-002',
        'Jina Kamili': 'Joachim Tarimo',
        'Mwaka': 2024,
        'Mwezi (1-12)': 6,
        'Kiasi Kilicholipwa': 10000,
        'Tarehe (YYYY-MM-DD)': '2024-06-10',
        'Njia ya Malipo': 'Benki'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kiolezo_cha_Ada_2023_2026');
    XLSX.writeFile(wb, 'Kiolezo_Cha_Kuingiza_Ada_UWALEMI_2023_2026.xlsx');
  };

  // Process Excel File Upload
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (!data || data.length === 0) {
          alert('Faili lililopakiwa halina data au kiolezo si sahihi.');
          return;
        }

        let updatedPayments = [...monthlyPayments];
        let count = 0;

        data.forEach(row => {
          const memberNo = String(row['Namba ya Mwanachama'] || row['MemberNo'] || row['Namba'] || '').trim();
          const year = Number(row['Mwaka'] || row['Year'] || 2023);
          const month = Number(row['Mwezi (1-12)'] || row['Mwezi'] || row['Month'] || 1);
          const amount = Number(row['Kiasi Kilicholipwa'] || row['Amount'] || row['Kiasi'] || 10000);
          const pDate = String(row['Tarehe (YYYY-MM-DD)'] || row['Tarehe'] || new Date().toISOString().split('T')[0]);
          const pMethod = String(row['Njia ya Malipo'] || row['Njia'] || 'M-Pesa');

          const member = members.find(m => m.memberNo.toLowerCase() === memberNo.toLowerCase() || m.fullName.toLowerCase() === memberNo.toLowerCase());
          if (member && year >= 2020 && month >= 1 && month <= 12) {
            const expected = member.monthlyFeeAmount || 10000;
            const receiptNo = `UWL-REC-${year}${String(month).padStart(2, '0')}-${member.memberNo.replace('UWL-', '')}`;

            updatedPayments = updatedPayments.filter(p => !(p.memberId === member.id && p.year === year && p.month === month));
            updatedPayments.push({
              id: `uwl-fee-${member.id}-${year}-${month}`,
              memberId: member.id,
              memberNo: member.memberNo,
              memberName: member.fullName,
              year,
              month,
              expectedAmount: expected,
              paidAmount: amount,
              paymentDate: pDate,
              paymentMethod: pMethod,
              referenceNo: `EXCEL-${year}`,
              status: amount >= expected ? 'paid' : amount > 0 ? 'partial' : 'unpaid',
              receiptNo,
              note: 'Uingizaji kupitia Excel'
            });
            count++;
          }
        });

        await onSaveState({ ...state, monthlyPayments: updatedPayments });
        setIsImportModalOpen(false);
        alert(`Ufanisi! Miamala ${count} ya ada za historia kuanzia 2023 imeingizwa kwenye mfumo.`);
      } catch (err) {
        console.error(err);
        alert('Ilihitilafu wakati wa kusoma faili la Excel. Hakikisha umetumia kiolezo sahihi.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExportExcel = () => {
    const data = membersWithStatus.map((item, idx) => ({
      'Na.': idx + 1,
      'Namba ya Mjumbe': item.member.memberNo,
      'Jina Kamili': item.member.fullName,
      'Namba ya Simu': item.member.phone,
      'Mwaka': selectedYear,
      'Mwezi': monthNamesSw[selectedMonth - 1],
      'Kiasi Kinachotakiwa (TZS)': item.expected,
      'Kiasi Kilicholipwa (TZS)': item.paid,
      'Baki / Deni (TZS)': Math.max(0, item.expected - item.paid),
      'Hali ya Malipo': item.status === 'paid' ? 'Amelipa Kamili' : item.status === 'partial' ? 'Amelipa Nusu' : 'Hajalipa',
      'Tarehe ya Malipo': item.payment?.paymentDate || '-',
      'Njia ya Malipo': item.payment?.paymentMethod || '-',
      'Namba ya Stakabadhi': item.payment?.receiptNo || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Ada_${monthNamesSw[selectedMonth - 1]}_${selectedYear}`);
    XLSX.writeFile(wb, `Ada_UWALEMI_${monthNamesSw[selectedMonth - 1]}_${selectedYear}.xlsx`);
  };

  const handleSendUnpaidReminder = () => {
    const unpaidList = membersWithStatus
      .filter(item => item.status !== 'paid' && item.member.status === 'active')
      .map(item => ({
        name: item.member.fullName,
        phone: item.member.phone,
        memberNo: item.member.memberNo
      }));

    if (unpaidList.length === 0) {
      alert('Wajumbe wote hai wamelipa ada ya mwezi huu!');
      return;
    }

    const expectedAmountForSelectedMonth = getDefaultFeeForMonth(selectedYear, selectedMonth);
    const template = `Habari {name}, hii ni taarifa ya kukumbusha ada yako ya kikundi cha UWALEMI ya mwezi wa ${monthNamesSw[selectedMonth - 1]} ${selectedYear} (TZS ${expectedAmountForSelectedMonth.toLocaleString()}). Tafadhali kamilisha malipo kupitia M Koba au 0758 219 298 Eva O Lema. Lema, Nguvu Moja!`;

    if (onOpenSmsWithTemplate) {
      onOpenSmsWithTemplate(unpaidList, template);
    }
  };

  const handleSendFeeDebtOnlyReminder = () => {
    const activeM = members.filter(m => m.status === 'active');
    const debtors = activeM.filter(m => {
      const debtInfo = calculateMemberFeeDebt(m, state);
      return debtInfo.feeDebt > 0;
    }).map(m => {
      const debtInfo = calculateMemberFeeDebt(m, state);
      return {
        name: m.fullName,
        phone: m.phone,
        memberNo: m.memberNo,
        memberId: m.id,
        debtAmount: debtInfo.feeDebt,
        feeDebt: debtInfo.feeDebt,
        lateFeePenalty: 0,
        otherFinesDebt: 0,
        totalFinesDebt: 0,
        startMonth: debtInfo.startMonthName,
        endMonth: debtInfo.endMonthName,
        unpaidMonths: debtInfo.unpaidMonthsText,
        periodSummary: debtInfo.periodSummary,
        monthsCount: debtInfo.unpaidCount
      };
    });

    if (debtors.length === 0) {
      alert('Hakuna mwanachama anayedaiwa ada!');
      return;
    }

    const template = `Habari {name}, kikundi cha UWALEMI kinakukumbusha kulipa ada yako ya miezi iliyopita: unadaiwa ada TZS {feeDebt} {periodSummary} ({unpaidMonths}). Lipa kupitia M Koba au 0758 219 298 Eva O Lema. Tafadhali kamilisha malipo yako kuepuka faini ya kuchelewa kulipa ada na kuwa nje ya umoja kwa mujibu wa katiba. Lema, Nguvu Moja!`;

    if (onOpenSmsWithTemplate) {
      onOpenSmsWithTemplate(debtors, template);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12" id="uwalemi-monthly-fees">
      {/* Header Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl font-bold text-white">Ada za Kila Mwezi za Wajumbe</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Usimamizi wa ada za kila mwezi (TZS 15,000 hadi Mei 2026 / TZS 20,000 kuanzia Juni 2026), utoaji stakabadhi rasmi na vikumbusho vya SMS/WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* View Switcher */}
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
              <button
                onClick={() => setViewMode('single')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'single'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Orodha ya Mwezi
              </button>
              <button
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'matrix'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Jedwali la Miezi 12 (Matrix)
              </button>
            </div>

            <button
              onClick={() => handleOpenAnnualModal('all', selectedYear)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-950/40 transition-all cursor-pointer transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              ⚡ Jaza Mwaka Mzima (Jan - Des)
            </button>

            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-900/30 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Miezi Mingi (Bulk)
            </button>

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md shadow-teal-900/30 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Pakia Excel Ada
            </button>

            {onOpenSmsWithTemplate && (
              <button
                onClick={handleSendFeeDebtOnlyReminder}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <Send className="w-3.5 h-3.5 text-emerald-400" />
                💳 Kumbusha Ada Pekee (SMS)
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Pakua
            </button>

            <button
              onClick={() => {
                setPaymentForm({
                  memberId: members[0]?.id || '',
                  year: selectedYear,
                  month: selectedMonth,
                  amount: getDefaultFeeForMonth(selectedYear, selectedMonth, members[0]?.monthlyFeeAmount),
                  paymentDate: new Date().toISOString().split('T')[0],
                  paymentMethod: 'M-Pesa (Lipa Namba)',
                  referenceNo: '',
                  note: ''
                });
                setIsRecordModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Mwezi Mmoja
            </button>
          </div>
        </div>

        {/* Year and Month Selector Buttons */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-400 font-semibold mr-1">Mwaka:</span>
            {availableYears.map(yr => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedYear === yr 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          {/* 12 Months Pill Switcher */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
            {monthNamesSw.map((mName, idx) => {
              const mNum = idx + 1;
              const isSelected = selectedMonth === mNum;
              return (
                <button
                  key={mNum}
                  onClick={() => setSelectedMonth(mNum)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {mName.substring(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Month Collection Progress Bar & Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block">Jumla Iliyokusanywa</span>
          <span className="text-xl font-bold text-emerald-400 mt-1 block">
            TZS {totalAmountCollected.toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-500">Lengo: TZS {targetMonthlyAmount.toLocaleString()}</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block">Waliolipa Kamili</span>
          <span className="text-xl font-bold text-white mt-1 block">
            {paidMembersCount} <span className="text-xs font-normal text-slate-400">/ {activeMembers.length}</span>
          </span>
          <span className="text-[11px] text-emerald-400">
            {activeMembers.length > 0 ? Math.round((paidMembersCount / activeMembers.length) * 100) : 0}% wametekeleza
          </span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block">Waliolipa Nusu</span>
          <span className="text-xl font-bold text-amber-400 mt-1 block">
            {partialMembersCount}
          </span>
          <span className="text-[11px] text-slate-500">Kiasi kimesalia</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block">Wasolipa (Madeni)</span>
          <span className="text-xl font-bold text-rose-400 mt-1 block">
            {unpaidMembersCount}
          </span>
          <span className="text-[11px] text-rose-400">Wanahitaji kukumbushwa</span>
        </div>
      </div>

      {/* FILTER & SEARCH or MATRIX VIEW */}
      {viewMode === 'single' ? (
        <>
          {/* Filter and Search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Tafuta mwanachama kwa jina au namba ya UWL...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Wote ({membersWithStatus.length})</option>
              <option value="paid">Waliolipa Tu ({paidMembersCount})</option>
              <option value="partial">Waliolipa Nusu ({partialMembersCount})</option>
              <option value="unpaid">Wasolipa Tu ({unpaidMembersCount})</option>
            </select>
          </div>

          {/* 50-Members Fee Matrix Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Namba</th>
                    <th className="py-3 px-4">Jina la Mjumbe</th>
                    <th className="py-3 px-4">Wadhifa</th>
                    <th className="py-3 px-4">Inayotakiwa</th>
                    <th className="py-3 px-4">Iliyolipwa</th>
                    <th className="py-3 px-4">Hali ya Malipo</th>
                    <th className="py-3 px-4">Tarehe / Stakabadhi</th>
                    <th className="py-3 px-4 text-right">Vitendo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500">
                        Hakuna kumbukumbu za wanachama zinazolingana na utafutaji.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map(({ member, payment, expected, paid, status }) => (
                      <tr key={member.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                          {member.memberNo}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <div>{member.fullName}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{member.phone}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-[10px] text-slate-400">{member.role}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          TZS {expected.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold">
                          <span className={paid >= expected ? 'text-emerald-400' : paid > 0 ? 'text-amber-400' : 'text-slate-500'}>
                            TZS {paid.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                            status === 'partial' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                            'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}>
                            {status === 'paid' ? <Check className="w-3 h-3" /> : status === 'partial' ? <Clock className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {status === 'paid' ? 'Amelipa' : status === 'partial' ? 'Nusu' : 'Hajalipa'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[11px] text-slate-400">
                          {payment ? (
                            <div>
                              <div className="text-slate-300">{payment.paymentDate}</div>
                              <div className="font-mono text-[10px] text-emerald-400">{payment.receiptNo}</div>
                            </div>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {status !== 'paid' ? (
                              <button
                                onClick={() => handleQuickMarkPaid(member)}
                                title="Weka Alama ya 'Amelipa Kamili' Moja kwa Moja"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-all cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                Lipa
                              </button>
                            ) : (
                              <button
                                onClick={() => payment && setViewingReceipt(payment)}
                                title="Tazama Stakabadhi ya Malipo"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-semibold transition-all cursor-pointer"
                              >
                                <Printer className="w-3 h-3" />
                                Stakabadhi
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setPaymentForm({
                                  memberId: member.id,
                                  year: selectedYear,
                                  month: selectedMonth,
                                  amount: payment ? payment.paidAmount : expected,
                                  paymentDate: payment?.paymentDate || new Date().toISOString().split('T')[0],
                                  paymentMethod: payment?.paymentMethod || 'M-Pesa (Lipa Namba)',
                                  referenceNo: payment?.referenceNo || '',
                                  note: payment?.note || ''
                                });
                                setIsRecordModalOpen(true);
                              }}
                              title="Rekodi / Hariri Kiasi Maalumu cha Mwezi Huu"
                              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleOpenAnnualModal(member.id, selectedYear)}
                              title={`Jaza Taarifa za Mwaka Mzima wa ${selectedYear} (Jan - Des) kwa ${member.fullName}`}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500 hover:text-slate-950 text-amber-400 border border-amber-500/30 text-[10.5px] font-bold transition-all cursor-pointer whitespace-nowrap"
                            >
                              <Sparkles className="w-3 h-3" />
                              Mwaka
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* 12-MONTH MATRIX GRID VIEW */
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-300">
            <div>
              <span className="font-bold block text-sm text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Ujazaji wa Taarifa za Mwaka Mzima ({selectedYear}):
              </span>
              <span className="text-slate-300 text-xs">
                Weka kiasi kwa mkono kuanzia Januari hadi Desemba kwa mbofyo mmoja, au badili malipo ya mwezi mmoja mmoja moja kwa moja kwenye jedwali.
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleOpenAnnualModal('all', selectedYear)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-slate-950 font-black cursor-pointer text-xs whitespace-nowrap shadow-md flex items-center gap-1.5"
              >
                <Zap className="w-4 h-4 text-slate-950" />
                Jaza Mwaka Mzima (Jan - Des)
              </button>
              <button
                onClick={() => setIsBulkModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 font-semibold hover:bg-slate-700 cursor-pointer text-xs whitespace-nowrap"
              >
                Miezi Mingi (Bulk)
              </button>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-sky-950/60 text-sky-200 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3 font-mono">Na.</th>
                    <th className="py-3 px-3">Mjumbe</th>
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((mShort, i) => (
                      <th key={i} className="py-3 px-2 text-center font-bold text-slate-300">
                        {`${String(selectedYear).substring(2)}-${mShort}`}
                      </th>
                    ))}
                    <th className="py-3 px-3 text-right text-emerald-400">JUMLA</th>
                    <th className="py-3 px-3 text-right">Kitendo Cha Haraka</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {members.map((m) => {
                    const totalMonthsInYear = selectedYear < 2023 ? 0 : selectedYear === 2023 ? 2 : 12;
                    const yearPayments = monthlyPayments.filter(p => p.memberId === m.id && Number(p.year) === Number(selectedYear));
                    const totalPaidInYear = yearPayments.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
                    const paidCount = yearPayments.filter(p => Number(p.paidAmount) >= getDefaultFeeForMonth(selectedYear, Number(p.month), m.monthlyFeeAmount)).length;

                    return (
                      <tr key={m.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-400 text-[11px]">
                          {m.memberNo}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white">
                          <div className="whitespace-nowrap text-xs">{m.fullName}</div>
                          <div className="text-[10px] text-slate-500 font-normal">
                            Iliyolipiwa: {paidCount}/{totalMonthsInYear} miezi
                          </div>
                        </td>

                        {/* 12 Months Cells */}
                        {Array.from({ length: 12 }, (_, idx) => idx + 1).map((mNum) => {
                          const isBeforeStart = selectedYear < 2023 || (selectedYear === 2023 && mNum < 11);
                          const payment = monthlyPayments.find(p => p.memberId === m.id && Number(p.year) === Number(selectedYear) && Number(p.month) === Number(mNum));
                          const paidAmountValue = payment ? Number(payment.paidAmount) : 0;
                          const expectedForCell = getDefaultFeeForMonth(selectedYear, mNum, m.monthlyFeeAmount);
                          const isPaid = paidAmountValue >= expectedForCell;

                          if (isBeforeStart) {
                            return (
                              <td key={mNum} className="py-2.5 px-1 text-center bg-slate-950/40 text-slate-700 font-mono text-[10px] border-r border-slate-800/40">
                                -
                              </td>
                            );
                          }

                          return (
                            <td key={mNum} className="py-2.5 px-1 text-center border-r border-slate-800/40">
                              <button
                                onClick={() => handleToggleMonthCell(m, selectedYear, mNum)}
                                title={`Mwezi ${mNum} (${monthNamesSw[mNum - 1]} ${selectedYear}) - Bonyeza kubadili malipo`}
                                className={`px-1.5 py-1.5 rounded font-mono text-[9.5px] font-medium transition-all w-[64px] inline-block text-center cursor-pointer ${
                                  isPaid
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                    : 'bg-slate-950 text-slate-500 border border-slate-800/60 hover:border-slate-700 hover:text-slate-400'
                                }`}
                              >
                                {paidAmountValue > 0 
                                  ? paidAmountValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) 
                                  : '0'}
                              </button>
                            </td>
                          );
                        })}

                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 text-[11px] border-r border-slate-800/40">
                          {totalPaidInYear.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenAnnualModal(m.id, selectedYear)}
                              title={`Jaza kiasi maalum kwa miezi yote 12 ya mwaka ${selectedYear} kwa ${m.fullName}`}
                              className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-400 text-[10px] font-bold border border-amber-500/30 transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1"
                            >
                              <Sparkles className="w-3 h-3" />
                              Jaza Mwaka
                            </button>
                            <button
                              onClick={() => handleMarkWholeYearPaid(m, selectedYear)}
                              title="Weka miezi yote 12 kuwa imelipwa ada kamili mara moja"
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 hover:text-white text-emerald-400 text-[10px] font-bold border border-emerald-500/30 transition-all cursor-pointer whitespace-nowrap"
                            >
                              ⚡ Mwaka Wote
                            </button>
                          </div>
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

      {/* MODAL: RECORD PAYMENT */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  Rekodi Malipo ya Ada ya Mwezi
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Inasaidia malipo kamili, malipo ya nusu/pungufu, na malipo ya miezi mingi mara moja.
                </p>
              </div>
              <button 
                onClick={() => setIsRecordModalOpen(false)} 
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setRecordMode('smart')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  recordMode === 'smart'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Ugawaji Kiotomatiki (Smart)
              </button>
              <button
                type="button"
                onClick={() => setRecordMode('single')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  recordMode === 'single'
                    ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-900/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-sky-300" />
                Mwezi Mahsusi (Single)
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4 text-xs">
              {/* Member Selection */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Mwanachama Mlipaji *</label>
                <select
                  required
                  value={paymentForm.memberId}
                  onChange={(e) => {
                    const mId = e.target.value;
                    const mem = members.find(m => m.id === mId);
                    const defAmt = getDefaultFeeForMonth(paymentForm.year, paymentForm.month, mem?.monthlyFeeAmount);
                    setPaymentForm({
                      ...paymentForm,
                      memberId: mId,
                      amount: defAmt
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- Chagua Mwanachama --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.memberNo} - {m.fullName} ({m.role}) - Ada: TZS {m.monthlyFeeAmount ? m.monthlyFeeAmount.toLocaleString() : (state.groupSettings?.monthlyFeeDefault || 20000).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Member Debt & Financial Status Banner */}
              {selectedModalMember && selectedMemberDebtInfo && (
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs">
                        {selectedModalMember.memberNo.slice(-3)}
                      </div>
                      <div>
                        <div className="font-bold text-white text-xs">{selectedModalMember.fullName}</div>
                        <div className="text-[10px] text-slate-400">{selectedModalMember.phone || 'Hakuna namba ya simu'}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">Deni la Ada Hivi Sasa:</div>
                      <div className={`text-xs font-mono font-bold ${selectedMemberDebtInfo.feeDebt > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {selectedMemberDebtInfo.feeDebt > 0 ? `TZS ${selectedMemberDebtInfo.feeDebt.toLocaleString()}` : 'Hakuna Deni (✓)'}
                      </div>
                    </div>
                  </div>

                  {selectedMemberDebtInfo.breakdown && selectedMemberDebtInfo.breakdown.length > 0 && (
                    <div className="text-[10.5px] text-slate-400 bg-slate-900/90 rounded-xl p-2 border border-slate-800/50 flex items-center justify-between gap-2">
                      <span>Anadaiwa miezi ({selectedMemberDebtInfo.breakdown.length}): <strong className="text-slate-300">{selectedMemberDebtInfo.breakdown.slice(0, 3).map(m => `${monthNamesSw[m.month - 1].slice(0, 3)} ${m.year}`).join(', ')}{selectedMemberDebtInfo.breakdown.length > 3 ? ` na mengineyo ${selectedMemberDebtInfo.breakdown.length - 3}` : ''}</strong></span>
                      {recordMode === 'smart' && selectedMemberDebtInfo.feeDebt > 0 && (
                        <button
                          type="button"
                          onClick={() => setPaymentForm({ ...paymentForm, amount: selectedMemberDebtInfo.feeDebt })}
                          className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-300 text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer"
                        >
                          Lipa Deni Lote
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Single Month Specific Controls */}
              {recordMode === 'single' && (
                <div className="bg-slate-950/60 border border-slate-800/70 p-3.5 rounded-2xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Mwezi Unaolipiwa</label>
                      <select
                        value={paymentForm.month}
                        onChange={(e) => {
                          const newM = Number(e.target.value);
                          const mem = members.find(m => m.id === paymentForm.memberId);
                          setPaymentForm({
                            ...paymentForm,
                            month: newM,
                            amount: getDefaultFeeForMonth(paymentForm.year, newM, mem?.monthlyFeeAmount)
                          });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      >
                        {monthNamesSw.map((name, idx) => (
                          <option key={idx + 1} value={idx + 1}>{name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Mwaka</label>
                      <input
                        type="number"
                        value={paymentForm.year}
                        onChange={(e) => {
                          const newY = Number(e.target.value);
                          const mem = members.find(m => m.id === paymentForm.memberId);
                          setPaymentForm({
                            ...paymentForm,
                            year: newY,
                            amount: getDefaultFeeForMonth(newY, paymentForm.month, mem?.monthlyFeeAmount)
                          });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="isTopUp"
                      checked={paymentForm.isTopUp}
                      onChange={(e) => setPaymentForm({ ...paymentForm, isTopUp: e.target.checked })}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-900 cursor-pointer"
                    />
                    <label htmlFor="isTopUp" className="text-slate-300 text-[11px] cursor-pointer">
                      Jumlisha kiasi hiki kwenye malipo yaliyokuwepo awali kwa mwezi huu (Top-up)
                    </label>
                  </div>
                </div>
              )}

              {/* Amount Input and Quick Preset Chips */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold block">Kiasi Kilicholipwa (TZS) *</label>
                  {selectedModalMember && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      Ada ya Kawaida: TZS {getDefaultFeeForMonth(paymentForm.year, paymentForm.month, selectedModalMember.monthlyFeeAmount).toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1"
                    value={paymentForm.amount || ''}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                    placeholder="Weka kiasi, mf. 5,000, 10,000, 20,000, 60,000..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-white font-mono text-base font-bold text-emerald-400 focus:outline-none"
                  />
                </div>

                {/* Quick Action Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-500 mr-1 flex items-center gap-1">
                    <Coins className="w-3 h-3" /> Viwango:
                  </span>
                  {[
                    { label: '5,000 (Nusu)', val: 5000 },
                    { label: '10,000 (Nusu)', val: 10000 },
                    { label: '15,000', val: 15000 },
                    { label: '20,000 (Kamili)', val: 20000 },
                    { label: '40,000 (Miezi 2)', val: 40000 },
                    { label: '60,000 (Miezi 3)', val: 60000 }
                  ].map(preset => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setPaymentForm({ ...paymentForm, amount: preset.val })}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-semibold transition-all cursor-pointer ${
                        paymentForm.amount === preset.val
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Live Allocation & Breakdown Preview */}
              {recordMode === 'smart' && smartAllocation.months.length > 0 && (
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Mfumo Utakavyogawa Malipo Haya ({smartAllocation.months.length} Miezi):
                    </span>
                    <span className="font-mono text-[11px] text-slate-300">
                      Jumla: <strong>TZS {smartAllocation.totalAllocated.toLocaleString()}</strong>
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {smartAllocation.months.map((m, idx) => (
                      <div 
                        key={idx} 
                        className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 flex items-center justify-between text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{m.monthName} {m.year}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold ${
                            !m.isPartial 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {!m.isPartial ? '✓ Kamili' : `⚠ Nusu (Salio: TZS ${m.balanceRemaining.toLocaleString()})`}
                          </span>
                        </div>

                        <div className="text-right font-mono">
                          <span className="text-emerald-400 font-bold">+TZS {m.amountAllocated.toLocaleString()}</span>
                          <span className="text-slate-500 text-[10px] block">Inayotakiwa: TZS {m.expected.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary After Payment */}
                  <div className="border-t border-emerald-500/20 pt-2 flex items-center justify-between text-[11px] text-slate-300">
                    <span>Salio la Deni Baada ya Malipo:</span>
                    <span className={`font-mono font-bold ${smartAllocation.debtAfter > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {smartAllocation.debtAfter > 0 ? `TZS ${smartAllocation.debtAfter.toLocaleString()}` : 'TZS 0 (Umelipa Yote ✓)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Single Mode Status Hint */}
              {recordMode === 'single' && selectedModalMember && Number(paymentForm.amount) > 0 && (
                <div className={`p-3 rounded-2xl border text-xs space-y-1 ${
                  Number(paymentForm.amount) < getDefaultFeeForMonth(paymentForm.year, paymentForm.month, selectedModalMember.monthlyFeeAmount)
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    <Info className="w-4 h-4" />
                    {Number(paymentForm.amount) < getDefaultFeeForMonth(paymentForm.year, paymentForm.month, selectedModalMember.monthlyFeeAmount)
                      ? 'Malipo ya Nusu / Pungufu (Partial Payment)'
                      : 'Malipo Kamili ya Ada (Full Payment)'}
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Ada ya {monthNamesSw[paymentForm.month - 1]} {paymentForm.year} ni TZS {getDefaultFeeForMonth(paymentForm.year, paymentForm.month, selectedModalMember.monthlyFeeAmount).toLocaleString()}. 
                    {Number(paymentForm.amount) < getDefaultFeeForMonth(paymentForm.year, paymentForm.month, selectedModalMember.monthlyFeeAmount) && (
                      <span> Salio linalobaki kwa mwezi huu litakuwa <strong>TZS {(getDefaultFeeForMonth(paymentForm.year, paymentForm.month, selectedModalMember.monthlyFeeAmount) - Number(paymentForm.amount)).toLocaleString()}</strong>.</span>
                    )}
                  </p>
                </div>
              )}

              {/* Payment Meta: Date, Method, Reference */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Tarehe ya Malipo</label>
                  <input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Njia ya Malipo</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="M-Pesa (Lipa Namba)">M-Pesa (Lipa Namba)</option>
                    <option value="Tigo Pesa">Tigo Pesa</option>
                    <option value="Airtel Money">Airtel Money</option>
                    <option value="CRDB Bank">CRDB Bank</option>
                    <option value="NMB Bank">NMB Bank</option>
                    <option value="Taslimu (Cash)">Taslimu (Cash)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Namba ya Muamala / Reference No</label>
                <input
                  type="text"
                  value={paymentForm.referenceNo}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                  placeholder="Mfano: QZ89XX9923 au Namba ya Simu"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              {/* Automated SMS Notice */}
              <div className="bg-sky-950/40 border border-sky-500/20 rounded-xl p-3 flex items-start gap-2 text-[11px] text-sky-300">
                <Send className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Stakabadhi ya SMS Kiotomatiki:</span>
                  <p className="text-slate-300 mt-0.5">
                    Mwanachama atapokea ujumbe mfupi (SMS) moja kwa moja kwenye namba yake ya simu ukieleza kiasi alicholipa, mwezi husika, kama ni malipo ya nusu (pamoja na salio lililobaki), au mchanganuo wa miezi aliyolipa.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCheck className="w-4 h-4" />
                  Hifadhi na Toa Stakabadhi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SINGLE PAYMENT OFFICIAL RECEIPT */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            {/* Header of Receipt */}
            <div className="text-center border-b-2 border-dashed border-slate-300 pb-4">
              <div className="text-xs font-bold uppercase tracking-widest text-emerald-800">KIKUNDI CHA KIJAMII CHA</div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{state.groupSettings.groupName || 'UWALEMI'}</h2>
              <p className="text-xs text-slate-600 italic mt-0.5">"{state.groupSettings.slogan || 'Kusaidiana Katika Shida na Raha'}"</p>
              <div className="mt-2 inline-block bg-slate-100 text-slate-800 font-mono text-[11px] font-bold px-3 py-1 rounded-full border border-slate-300">
                {viewingReceipt.status === 'partial' ? 'STAKABADHI YA MALIPO YA NUSU' : 'STAKABADHI YA ADA YA MWEZI'}
              </div>
            </div>

            {/* Receipt Details */}
            <div className="space-y-2.5 text-xs border-b-2 border-dashed border-slate-300 pb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Namba ya Stakabadhi:</span>
                <span className="font-mono font-bold text-slate-900">{viewingReceipt.receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tarehe ya Malipo:</span>
                <span className="font-semibold text-slate-900">{viewingReceipt.paymentDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mjumbe:</span>
                <span className="font-bold text-slate-900">{viewingReceipt.memberName} ({viewingReceipt.memberNo})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kipindi cha Ada:</span>
                <span className="font-semibold text-slate-900">{monthNamesSw[viewingReceipt.month - 1]} {viewingReceipt.year}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ada Inayotakiwa:</span>
                <span className="font-mono text-slate-900">TZS {viewingReceipt.expectedAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Njia ya Malipo:</span>
                <span className="font-semibold text-slate-900">{viewingReceipt.paymentMethod}</span>
              </div>
              {viewingReceipt.referenceNo && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Kumbukumbu ya Muamala:</span>
                  <span className="font-mono text-slate-900">{viewingReceipt.referenceNo}</span>
                </div>
              )}
            </div>

            {/* Amount Box */}
            <div className={`border rounded-xl p-3.5 text-center ${
              viewingReceipt.status === 'partial' 
                ? 'bg-amber-50 border-amber-200' 
                : 'bg-emerald-50 border-emerald-200'
            }`}>
              <span className={`text-[11px] font-semibold uppercase tracking-wider block ${
                viewingReceipt.status === 'partial' ? 'text-amber-800' : 'text-emerald-800'
              }`}>
                Kiasi Kilichopokelewa
              </span>
              <span className={`text-2xl font-black font-mono ${
                viewingReceipt.status === 'partial' ? 'text-amber-900' : 'text-emerald-900'
              }`}>
                TZS {viewingReceipt.paidAmount.toLocaleString()}
              </span>
              <span className={`text-[10px] block mt-0.5 font-semibold ${
                viewingReceipt.status === 'paid' ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {viewingReceipt.status === 'paid' 
                  ? '✓ Malipo Yamekamilika' 
                  : `⚠ Malipo ya Nusu (Salio Linalobaki: TZS ${Math.max(0, viewingReceipt.expectedAmount - viewingReceipt.paidAmount).toLocaleString()})`}
              </span>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-500 space-y-1">
              <p>Imethibitishwa na Mfumo wa UWALEMI Treasury.</p>
              <p className="font-medium text-slate-700">Ahsante kwa kuwajibika na kujenga kikundi chetu.</p>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => {
                  try {
                    const member = state.members.find(m => m.id === viewingReceipt.memberId);
                    const doc = generatePaymentReceiptPDF({
                      receiptNo: viewingReceipt.receiptNo || `REC-${viewingReceipt.id.slice(-6)}`,
                      groupName: state.groupSettings?.groupName || 'UWALEMI',
                      slogan: state.groupSettings?.slogan,
                      memberNo: viewingReceipt.memberNo,
                      memberName: viewingReceipt.memberName,
                      memberPhone: member?.phone,
                      paymentType: 'Ada ya Kila Mwezi',
                      periodOrTitle: `${monthNamesSw[viewingReceipt.month - 1]} ${viewingReceipt.year}`,
                      amount: viewingReceipt.paidAmount,
                      paymentDate: viewingReceipt.paymentDate || new Date().toISOString().split('T')[0],
                      paymentMethod: viewingReceipt.paymentMethod || 'M-Pesa',
                      referenceNo: viewingReceipt.referenceNo,
                      receivedBy: 'Mweka Hazina wa UWALEMI',
                      statusType: viewingReceipt.status === 'partial' ? 'partial' : 'paid',
                      balanceRemaining: Math.max(0, viewingReceipt.expectedAmount - viewingReceipt.paidAmount)
                    });
                    doc.save(`Risiti_${viewingReceipt.receiptNo || viewingReceipt.memberNo}_${viewingReceipt.month}_${viewingReceipt.year}.pdf`);
                  } catch (err) {
                    console.error(err);
                    alert('Hitilafu katika kutengeneza PDF ya risiti.');
                  }
                }}
                className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/30 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Pakua PDF
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Chapisha
              </button>
              <button
                onClick={() => {
                  const rem = Math.max(0, viewingReceipt.expectedAmount - viewingReceipt.paidAmount);
                  const memberObj = members.find(m => m.id === viewingReceipt.memberId || m.memberNo === viewingReceipt.memberNo) || {
                    id: viewingReceipt.memberId,
                    memberNo: viewingReceipt.memberNo,
                    fullName: viewingReceipt.memberName
                  };
                  const debtSummary = formatMemberReceiptDebtLines(memberObj, state);
                  const debtBlock = debtSummary.fullSummaryText ? `\n${debtSummary.fullSummaryText}` : '';
                  const msg = `STAKABADHI YA ADA YA UWALEMI\nNamba: ${viewingReceipt.receiptNo}\nMjumbe: ${viewingReceipt.memberName} (${viewingReceipt.memberNo})\nAda ya: ${monthNamesSw[viewingReceipt.month - 1]} ${viewingReceipt.year}\nKiasi Kilicholipwa: TZS ${viewingReceipt.paidAmount.toLocaleString()}\nHali: ${viewingReceipt.status === 'paid' ? 'IMEKAMILIKA (PAID)' : `MALIPO YA NUSU (Salio: TZS ${rem.toLocaleString()})`}\nTarehe: ${viewingReceipt.paymentDate}${debtBlock}\n\nAhsante kwa kuwajibika na kujenga UWALEMI!`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                WhatsApp
              </button>
              <button
                onClick={() => setViewingReceipt(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
              >
                Funga
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MULTI-MONTH OFFICIAL RECEIPT */}
      {viewingMultiReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            {/* Header of Receipt */}
            <div className="text-center border-b-2 border-dashed border-slate-300 pb-4">
              <div className="text-xs font-bold uppercase tracking-widest text-emerald-800">KIKUNDI CHA KIJAMII CHA</div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{state.groupSettings.groupName || 'UWALEMI'}</h2>
              <p className="text-xs text-slate-600 italic mt-0.5">"{state.groupSettings.slogan || 'Kusaidiana Katika Shida na Raha'}"</p>
              <div className="mt-2 inline-block bg-emerald-100 text-emerald-900 font-mono text-[11px] font-bold px-3 py-1 rounded-full border border-emerald-300">
                STAKABADHI YA MALIPO YA ADA (MIEZI {viewingMultiReceipt.months.length})
              </div>
            </div>

            {/* Receipt Details */}
            <div className="space-y-2 text-xs border-b-2 border-dashed border-slate-300 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Namba ya Stakabadhi:</span>
                <span className="font-mono font-bold text-slate-900">{viewingMultiReceipt.receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tarehe ya Malipo:</span>
                <span className="font-semibold text-slate-900">{viewingMultiReceipt.paymentDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mjumbe:</span>
                <span className="font-bold text-slate-900">{viewingMultiReceipt.member.fullName} ({viewingMultiReceipt.member.memberNo})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Njia ya Malipo:</span>
                <span className="font-semibold text-slate-900">{viewingMultiReceipt.paymentMethod}</span>
              </div>
              {viewingMultiReceipt.referenceNo && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Kumbukumbu ya Muamala:</span>
                  <span className="font-mono text-slate-900">{viewingMultiReceipt.referenceNo}</span>
                </div>
              )}
            </div>

            {/* Breakdown Table */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">Mchanganuo wa Miezi Iliyolipiwa:</span>
              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-200/80 text-slate-700 font-bold text-[10px] uppercase">
                    <tr>
                      <th className="py-2 px-3">Mwezi</th>
                      <th className="py-2 px-3 text-right">Kiasi</th>
                      <th className="py-2 px-3 text-right">Hali</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {viewingMultiReceipt.months.map((m, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-medium text-slate-900">{m.monthName} {m.year}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">TZS {m.paid.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            !m.isPartial ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {!m.isPartial ? '✓ Kamili' : `⚠ Nusu (Salio: ${m.balance.toLocaleString()})`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Amount Box */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
              <span className="text-[11px] text-emerald-800 font-semibold uppercase tracking-wider block">Jumla Iliyolipwa</span>
              <span className="text-2xl font-black text-emerald-900 font-mono">
                TZS {viewingMultiReceipt.amount.toLocaleString()}
              </span>
              <span className="text-[10.5px] text-slate-600 block mt-0.5">
                Salio la Deni Baada ya Malipo: <strong className="text-slate-900 font-mono">TZS {viewingMultiReceipt.totalDebtAfter.toLocaleString()}</strong>
              </span>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-500 space-y-0.5">
              <p>Imethibitishwa na Mfumo wa UWALEMI Treasury.</p>
              <p className="font-medium text-slate-700">Ahsante kwa kuwajibika na kujenga kikundi chetu.</p>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => {
                  try {
                    const doc = generatePaymentReceiptPDF({
                      receiptNo: viewingMultiReceipt.receiptNo,
                      groupName: state.groupSettings?.groupName || 'UWALEMI',
                      slogan: state.groupSettings?.slogan,
                      memberNo: viewingMultiReceipt.member.memberNo,
                      memberName: viewingMultiReceipt.member.fullName,
                      memberPhone: viewingMultiReceipt.member.phone,
                      paymentType: 'Ada ya Kila Mwezi (Miezi Mingi)',
                      periodOrTitle: `Miezi ${viewingMultiReceipt.months.length} (${viewingMultiReceipt.months.map(m => `${m.monthName.slice(0, 3)} ${m.year}`).join(', ')})`,
                      amount: viewingMultiReceipt.amount,
                      paymentDate: viewingMultiReceipt.paymentDate,
                      paymentMethod: viewingMultiReceipt.paymentMethod,
                      referenceNo: viewingMultiReceipt.referenceNo,
                      receivedBy: 'Mweka Hazina wa UWALEMI',
                      balanceRemaining: viewingMultiReceipt.totalDebtAfter,
                      breakdownItems: viewingMultiReceipt.months.map(m => ({
                        label: `${m.monthName} ${m.year}`,
                        amount: `TZS ${m.paid.toLocaleString()}`,
                        status: !m.isPartial ? 'Kamili' : `Nusu (Salio: ${m.balance.toLocaleString()})`
                      }))
                    });
                    doc.save(`Risiti_${viewingMultiReceipt.receiptNo}_${viewingMultiReceipt.member.memberNo}.pdf`);
                  } catch (err) {
                    console.error(err);
                    alert('Hitilafu katika kutengeneza PDF ya risiti.');
                  }
                }}
                className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/30 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Pakua PDF
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Chapisha
              </button>
              <button
                onClick={() => {
                  const monthsList = viewingMultiReceipt.months.map(m => `- ${m.monthName} ${m.year}: TZS ${m.paid.toLocaleString()} (${!m.isPartial ? 'Kamili' : `Nusu, Salio: TZS ${m.balance.toLocaleString()}`})`).join('\n');
                  const debtSummary = formatMemberReceiptDebtLines(viewingMultiReceipt.member, state, { totalDebtAfter: viewingMultiReceipt.totalDebtAfter });
                  const debtBlock = debtSummary.fullSummaryText ? `\n${debtSummary.fullSummaryText}` : '';
                  const msg = `STAKABADHI YA ADA YA UWALEMI\nNamba: ${viewingMultiReceipt.receiptNo}\nMjumbe: ${viewingMultiReceipt.member.fullName} (${viewingMultiReceipt.member.memberNo})\nJumla Iliyolipwa: TZS ${viewingMultiReceipt.amount.toLocaleString()}\nTarehe: ${viewingMultiReceipt.paymentDate}\n\nMchanganuo:\n${monthsList}${debtBlock}\n\nAhsante kwa kuwajibika na kujenga UWALEMI!`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                WhatsApp
              </button>
              <button
                onClick={() => setViewingMultiReceipt(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
              >
                Funga
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BULK MULTI-MONTH RECORDING */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-8 text-xs text-slate-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                Rekodi Ada za Miezi Mingi Mara Moja (2023 - 2026)
              </h3>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-400">
              Inakuruhusu kuchagua mjumbe au wajumbe WOTE, kuchagua mwaka na kuweka alama ya ada zote zilizolipwa kwa miezi uliyoichagua kwa wakati mmoja.
            </p>

            <form onSubmit={handleSaveBulkPayments} className="space-y-4 pt-2">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Chagua Mjumbe:</label>
                <select
                  value={bulkForm.targetMemberId}
                  onChange={(e) => setBulkForm({ ...bulkForm, targetMemberId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-medium focus:outline-none focus:border-purple-500"
                >
                  <option value="all">👥 WAJUMBE WOTE HAI ({members.filter(m => m.status === 'active').length})</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.memberNo} - {m.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Mwaka wa Ada:</label>
                  <select
                    value={bulkForm.year}
                    onChange={(e) => setBulkForm({ ...bulkForm, year: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    {[2023, 2024, 2025, 2026, 2027, 2028].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Mpangilio wa Ada:</label>
                  <label className="flex items-center gap-2 bg-slate-950 border border-purple-800/40 p-2.5 rounded-xl cursor-pointer hover:border-purple-500/50 transition-all">
                    <input
                      type="checkbox"
                      checked={bulkForm.useDefaultRates}
                      onChange={(e) => setBulkForm({ ...bulkForm, useDefaultRates: e.target.checked })}
                      className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                    />
                    <span className="text-[11px] font-bold text-purple-300">
                      Tumia Ada Rasmi ({bulkForm.year === 2026 ? 'Jan-Mei: 15k | Jun-Des: 20k' : 'TZS 15,000 / mwezi'})
                    </span>
                  </label>
                </div>
              </div>

              {!bulkForm.useDefaultRates && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <label className="block text-slate-400 mb-1 font-semibold text-xs">Weka Kiasi cha Kawaida kwa Kila Mwezi (TZS):</label>
                  <input
                    type="number"
                    value={bulkForm.amountPerMonth}
                    onChange={(e) => setBulkForm({ ...bulkForm, amountPerMonth: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-purple-500 text-xs"
                    placeholder="20000"
                  />
                </div>
              )}

              {/* Month Checkboxes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold text-xs flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-purple-400" />
                    Chagua Miezi ya Kuingiza ({bulkForm.months.length}/12):
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (bulkForm.months.length === 12) {
                        setBulkForm({ ...bulkForm, months: [] });
                      } else {
                        setBulkForm({ ...bulkForm, months: [1,2,3,4,5,6,7,8,9,10,11,12] });
                      }
                    }}
                    className="text-purple-400 hover:text-purple-300 font-bold text-[11px] cursor-pointer"
                  >
                    {bulkForm.months.length === 12 ? 'Acha Yote' : 'Chagua Miezi Yote 12'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {monthNamesSw.map((mName, idx) => {
                    const mNum = idx + 1;
                    const isChecked = bulkForm.months.includes(mNum);
                    const expectedFee = bulkForm.useDefaultRates
                      ? getDefaultFeeForMonth(bulkForm.year, mNum)
                      : (bulkForm.amountPerMonth || getDefaultFeeForMonth(bulkForm.year, mNum));

                    return (
                      <button
                        type="button"
                        key={mNum}
                        onClick={() => {
                          const newMonths = isChecked
                            ? bulkForm.months.filter(m => m !== mNum)
                            : [...bulkForm.months, mNum].sort((a,b) => a - b);
                          setBulkForm({ ...bulkForm, months: newMonths });
                        }}
                        className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border flex flex-col justify-between ${
                          isChecked 
                            ? 'bg-purple-600/30 text-purple-200 border-purple-500/60 shadow-md ring-1 ring-purple-500/40'
                            : 'bg-slate-900/80 text-slate-500 border-slate-800 hover:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold text-xs text-white">{mName}</span>
                          <span className={`text-[9px] font-mono px-1 rounded ${isChecked ? 'bg-purple-500/30 text-purple-200 font-bold' : 'text-slate-600'}`}>
                            Mz #{mNum}
                          </span>
                        </div>
                        <div className={`text-[11px] font-mono font-bold mt-1.5 ${isChecked ? 'text-emerald-400' : 'text-slate-400'}`}>
                          TZS {expectedFee.toLocaleString()}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Dynamic Breakdown Summary Card */}
                {bulkForm.months.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-950/40 via-slate-950 to-purple-950/20 p-3 rounded-xl border border-purple-500/30 space-y-1">
                    <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                      <span className="font-bold text-purple-300 flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 text-purple-400" />
                        Mchanganuo wa Ada ya Miezi {bulkForm.months.length}:
                      </span>
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        Jumla: TZS {
                          bulkForm.months.reduce((sum, m) => {
                            const fee = bulkForm.useDefaultRates
                              ? getDefaultFeeForMonth(bulkForm.year, m)
                              : (bulkForm.amountPerMonth || getDefaultFeeForMonth(bulkForm.year, m));
                            return sum + fee;
                          }, 0).toLocaleString()
                        } / mjumbe
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono">
                      {bulkForm.year === 2026 && bulkForm.useDefaultRates ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {bulkForm.months.filter(m => m <= 5).length > 0 && (
                            <span className="text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              • Mz 1-5 ({bulkForm.months.filter(m => m <= 5).length}x @ 15,000 = TZS {(bulkForm.months.filter(m => m <= 5).length * 15000).toLocaleString()})
                            </span>
                          )}
                          {bulkForm.months.filter(m => m >= 6).length > 0 && (
                            <span className="text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              • Mz 6-12 ({bulkForm.months.filter(m => m >= 6).length}x @ 20,000 = TZS {(bulkForm.months.filter(m => m >= 6).length * 20000).toLocaleString()})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">
                          • Miezi {bulkForm.months.length} x TZS {(bulkForm.useDefaultRates ? getDefaultFeeForMonth(bulkForm.year, bulkForm.months[0] || 1) : bulkForm.amountPerMonth).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Njia ya Malipo:</label>
                  <select
                    value={bulkForm.paymentMethod}
                    onChange={(e) => setBulkForm({ ...bulkForm, paymentMethod: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="M-Pesa (Lipa Namba)">M-Pesa</option>
                    <option value="Airtel Money">Airtel Money</option>
                    <option value="Mix/Tigo Pesa">Tigo Pesa</option>
                    <option value="Amana / NMB / CRDB">Benki</option>
                    <option value="Taslimu / Cash">Taslimu</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Tarehe ya Malipo:</label>
                  <input
                    type="date"
                    value={bulkForm.paymentDate}
                    onChange={(e) => setBulkForm({ ...bulkForm, paymentDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer font-semibold"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer shadow-lg shadow-purple-900/30 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Hifadhi Miezi {bulkForm.months.length} Yote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXCEL IMPORT */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl my-8 text-xs text-slate-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-teal-400" />
                Pakia Ada za Historia kwa Excel (2023-2026)
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-400">
              Ikiwa una fainali la Excel lenye taarifa za ada za miaka iliyopita, unaweza kupakua kiolezo rasmi au kupakia faili moja kwa moja.
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="font-bold text-white block">Hatua ya 1: Pakua Kiolezo cha Excel</span>
              <button
                onClick={handleDownloadFeeImportTemplate}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold border border-teal-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Download className="w-4 h-4" />
                Pakua Kiolezo cha Excel (.xlsx)
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="font-bold text-white block">Hatua ya 2: Pakia Faili Lako la Excel</span>
              <label className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-900/30 transition-all text-center">
                <FileSpreadsheet className="w-5 h-5" />
                Chagua Faili la Excel
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer font-semibold"
              >
                Funga
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: WHOLE YEAR PAID CONFIRMATION */}
      {wholeYearConfirmOpen && wholeYearData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-400">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-white">Lipa Mwaka Mzima</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Je, una uhakika unataka kuweka ada za miezi <strong className="text-white">YOTE 12</strong> ya mwaka <strong className="text-white">{wholeYearData.year}</strong> kuwa <strong className="text-emerald-400">ZIMELIPWA</strong> kwa <strong className="text-white">"{wholeYearData.member.fullName}"</strong>?
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setWholeYearConfirmOpen(false);
                  setWholeYearData(null);
                }}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Ghairi
              </button>
              <button
                type="button"
                onClick={async () => {
                  await executeMarkWholeYearPaid(wholeYearData.member, wholeYearData.year);
                  setWholeYearConfirmOpen(false);
                  setWholeYearData(null);
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 cursor-pointer"
              >
                Thibitisha Malipo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ANNUAL MANUAL ENTRY (JAN - DEC) */}
      {isAnnualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-5 shadow-2xl my-6 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start sm:items-center justify-between border-b border-slate-800 pb-3.5 gap-2 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    Jaza Taarifa za Mwaka Mzima (Jan - Des)
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30">
                      Mwaka {annualForm.year}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Weka kiasi kwa kila mwezi (Januari - Desemba) kwa mikono, au tumia zana ya kujaza kote mara moja.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAnnualModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveAnnualPayments} className="space-y-5 overflow-y-auto pr-1 flex-1">
              {/* Row 1: Target Member & Year Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Mjumbe / Wanachama Walengwa
                  </label>
                  <select
                    value={annualForm.targetMemberId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      handleOpenAnnualModal(selectedId, annualForm.year);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="all">👥 Wajumbe Wote Hai ({members.filter(m => m.status === 'active').length})</option>
                    <optgroup label="Wajumbe Mmoja Mmoja (Kulingana na Vyeo)">
                      {members.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.memberNo} - {m.fullName} ({m.role})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Mwaka wa Ada
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {availableYears.map(yr => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          handleOpenAnnualModal(annualForm.targetMemberId, yr);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          annualForm.year === yr
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2: Smart Auto-Fill Toolbar */}
              <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent p-4 rounded-xl border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Zana ya Haraka: Sambaza Kiasi kwa Miezi Yote 12 (Jan - Des)</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Kiasi kitanakiliwa moja kwa moja kwenye visanduku vyote 12 hapa chini.
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1 max-w-xs">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-bold">TZS</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={annualFastFillAmount}
                      onChange={(e) => setAnnualFastFillAmount(Number(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-12 pr-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                      placeholder="10000"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyAmountToAllMonths(annualFastFillAmount)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Sambaza Kote (Miezi 12)
                  </button>

                  <div className="flex items-center gap-1.5 flex-wrap sm:ml-auto">
                    <button
                      type="button"
                      onClick={() => {
                        const targetMem = members.find(m => m.id === annualForm.targetMemberId);
                        const defaultAmounts: { [m: number]: number } = {};
                        for (let m = 1; m <= 12; m++) {
                          defaultAmounts[m] = getDefaultFeeForMonth(annualForm.year, m, targetMem?.monthlyFeeAmount);
                        }
                        setAnnualForm(prev => ({ ...prev, monthlyAmounts: defaultAmounts }));
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      Ada Rasmi ({annualForm.year === 2026 ? '15k/20k' : '15k'})
                    </button>
                    {[15000, 20000, 10000].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setAnnualFastFillAmount(preset);
                          handleApplyAmountToAllMonths(preset);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-mono cursor-pointer transition-all"
                      >
                        TZS {preset.toLocaleString()}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleApplyAmountToAllMonths(0)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Futa Yote (0)
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 3: 12 Month Grid Cards (Jan - Dec) */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-emerald-400" />
                    Kiasi cha Kila Mwezi (Januari - Desemba {annualForm.year}):
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Unaweza kubadilisha au kuandika kiasi chochote kwa kila mwezi
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((mNum) => {
                    const targetMem = members.find(m => m.id === annualForm.targetMemberId);
                    const defaultFee = getDefaultFeeForMonth(annualForm.year, mNum, targetMem?.monthlyFeeAmount);
                    const currentVal = annualForm.monthlyAmounts[mNum] ?? defaultFee;
                    const isFullyPaid = currentVal >= defaultFee;
                    const isPartial = currentVal > 0 && currentVal < defaultFee;

                    return (
                      <div
                        key={mNum}
                        className={`p-3 rounded-xl border transition-all ${
                          isFullyPaid
                            ? 'bg-emerald-950/20 border-emerald-500/30'
                            : isPartial
                            ? 'bg-amber-950/20 border-amber-500/30'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-white flex items-center gap-1">
                            <span className="font-mono text-slate-400">{String(mNum).padStart(2, '0')}.</span>
                            {monthNamesSw[mNum - 1]}
                          </span>
                          <span
                            className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full ${
                              isFullyPaid
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : isPartial
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {isFullyPaid ? 'Kamili' : isPartial ? 'Nusu' : 'Hajalipa'}
                          </span>
                        </div>

                        <div className="relative mb-2">
                          <span className="absolute left-2.5 top-2 text-[10px] text-slate-500 font-mono font-bold">TZS</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={currentVal}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setAnnualForm(prev => ({
                                ...prev,
                                monthlyAmounts: {
                                  ...prev.monthlyAmounts,
                                  [mNum]: val
                                }
                              }));
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-2 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500 text-right"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => {
                              setAnnualForm(prev => ({
                                ...prev,
                                monthlyAmounts: {
                                  ...prev.monthlyAmounts,
                                  [mNum]: defaultFee
                                }
                              }));
                            }}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer font-mono"
                          >
                            {defaultFee.toLocaleString()}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAnnualForm(prev => ({
                                ...prev,
                                monthlyAmounts: {
                                  ...prev.monthlyAmounts,
                                  [mNum]: 0
                                }
                              }));
                            }}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-rose-400 cursor-pointer font-mono"
                          >
                            0
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Row 4: Summary Card */}
              {(() => {
                const targetMembersCount = annualForm.targetMemberId === 'all' 
                  ? members.filter(m => m.status === 'active').length 
                  : 1;
                const totalPerMember = (Object.values(annualForm.monthlyAmounts) as number[]).reduce((sum, val) => sum + (Number(val) || 0), 0);
                const grandTotal = totalPerMember * targetMembersCount;
                const paidMonthsCount = (Object.values(annualForm.monthlyAmounts) as number[]).filter(v => Number(v) > 0).length;

                return (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Miezi Iliyojazwa Kiasi</span>
                      <span className="text-base font-bold text-white font-mono mt-0.5 block">
                        {paidMonthsCount} / 12 Miezi
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Jumla kwa Kila Mjumbe ({annualForm.year})</span>
                      <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">
                        TZS {totalPerMember.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Jumla Kuu ({targetMembersCount} Wajumbe)</span>
                      <span className="text-base font-bold text-amber-400 font-mono mt-0.5 block">
                        TZS {grandTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Row 5: Payment Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Njia ya Malipo
                  </label>
                  <select
                    value={annualForm.paymentMethod}
                    onChange={(e) => setAnnualForm({ ...annualForm, paymentMethod: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="M-Pesa (Lipa Namba)">M-Pesa (Lipa Namba)</option>
                    <option value="Tigo Pesa">Tigo Pesa</option>
                    <option value="Airtel Money">Airtel Money</option>
                    <option value="Benki ya CRDB / NMB">Benki ya CRDB / NMB</option>
                    <option value="Taslimu (Cash)">Taslimu (Cash)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Kumbukumbu / Ref No
                  </label>
                  <input
                    type="text"
                    value={annualForm.referenceNo}
                    onChange={(e) => setAnnualForm({ ...annualForm, referenceNo: e.target.value })}
                    placeholder={`YEAR-${annualForm.year}`}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Maelezo (Note)
                  </label>
                  <input
                    type="text"
                    value={annualForm.note}
                    onChange={(e) => setAnnualForm({ ...annualForm, note: e.target.value })}
                    placeholder={`Ada ya mwaka mzima wa ${annualForm.year}`}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAnnualModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-all"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition-all"
                >
                  <Check className="w-4 h-4" />
                  Hifadhi Taarifa za Mwaka Mzima (Jan - Des)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
