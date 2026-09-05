import React, { useState, useMemo } from 'react';
import { 
  UwalemiState, 
  UwalemiMember, 
  UwalemiFinePayment, 
  UwalemiMeeting 
} from '../../types/uwalemi';
import { 
  calculateMemberFeeDebt, 
  sortMembersByLeadership,
  triggerAutoReceiptSms
} from '../../services/uwalemiService';
import { 
  generatePaymentReceiptPDF, 
  downloadPdfDocument, 
  getPdfBlobUrl, 
  formatTZS 
} from '../../services/uwalemiPdfGenerator';
import { 
  X, 
  CheckCircle2, 
  Download, 
  Send, 
  FileText, 
  Scale, 
  CreditCard, 
  Calendar, 
  User, 
  AlertTriangle,
  Receipt,
  Eye,
  Check
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  state: UwalemiState;
  onSaveState: (state: UwalemiState) => Promise<boolean>;
  initialMemberId?: string;
  initialMeetingId?: string;
  initialFineType?: 'kikao' | 'ada_late_fee' | 'nyingine';
  initialAmount?: number;
  onOpenSmsWithTemplate?: (recipients: { name: string; phone: string; memberNo: string }[], templateText: string) => void;
}

export const UwalemiFinePaymentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  state,
  onSaveState,
  initialMemberId,
  initialMeetingId,
  initialFineType = 'kikao',
  initialAmount,
  onOpenSmsWithTemplate
}) => {
  const members = useMemo(() => sortMembersByLeadership(state.members || []), [state.members]);
  
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    initialMemberId || members[0]?.id || ''
  );
  const [fineType, setFineType] = useState<'kikao' | 'ada_late_fee' | 'nyingine'>(
    initialFineType
  );
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(
    initialMeetingId || ''
  );
  const [amount, setAmount] = useState<number>(initialAmount || 10000);
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<string>(
    state.groupSettings?.paymentMethods?.[0]?.provider 
      ? `${state.groupSettings.paymentMethods[0].provider} (${state.groupSettings.paymentMethods[0].number})`
      : 'M Koba / M-Pesa (0758 219 298 - Eva O Lema)'
  );
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [receivedBy, setReceivedBy] = useState<string>('Eva O Lema (Mweka Hazina)');
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [completedPayment, setCompletedPayment] = useState<UwalemiFinePayment | null>(null);

  // When initial props change or modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (initialMemberId) setSelectedMemberId(initialMemberId);
      if (initialMeetingId) setSelectedMeetingId(initialMeetingId);
      if (initialFineType) setFineType(initialFineType);
      if (initialAmount) setAmount(initialAmount);
      setCompletedPayment(null);
      setReferenceNo('');
      setNotes('');
    }
  }, [isOpen, initialMemberId, initialMeetingId, initialFineType, initialAmount]);

  const selectedMember = members.find(m => m.id === selectedMemberId);

  // Calculate current debts for selected member
  const memberDebtInfo = useMemo(() => {
    if (!selectedMember) return null;
    return calculateMemberFeeDebt(selectedMember, state);
  }, [selectedMember, state]);

  // Find all unpaid meeting fines for this member
  const unpaidMeetingFines = useMemo(() => {
    if (!selectedMember) return [];
    const list: { meeting: UwalemiMeeting; fineAmount: number; reason: string }[] = [];
    (state.meetings || []).forEach(mtg => {
      const att = (mtg.attendees || []).find(a => a.memberId === selectedMember.id);
      if (att && att.fineAmount && att.fineAmount > 0 && !att.finePaid) {
        list.push({
          meeting: mtg,
          fineAmount: Number(att.fineAmount) || 0,
          reason: att.fineReason || (att.status === 'absent' ? 'Kutohudhuria Kikao' : 'Kuchelewa Kikao')
        });
      }
    });
    return list;
  }, [selectedMember, state.meetings]);

  // Auto-set amount and meeting when fineType or member changes
  React.useEffect(() => {
    if (fineType === 'kikao') {
      if (unpaidMeetingFines.length > 0) {
        const first = unpaidMeetingFines[0];
        if (!selectedMeetingId || !unpaidMeetingFines.some(u => u.meeting.id === selectedMeetingId)) {
          setSelectedMeetingId(first.meeting.id);
        }
        const currentTarget = unpaidMeetingFines.find(u => u.meeting.id === selectedMeetingId) || first;
        setAmount(currentTarget.fineAmount);
      } else {
        setAmount(state.groupSettings?.meetingFineDefault || 10000);
      }
    } else if (fineType === 'ada_late_fee') {
      if (memberDebtInfo && memberDebtInfo.lateFeePenalty > 0) {
        setAmount(memberDebtInfo.lateFeePenalty);
      } else {
        setAmount(5000);
      }
    }
  }, [fineType, selectedMemberId, unpaidMeetingFines, selectedMeetingId, memberDebtInfo, state.groupSettings]);

  if (!isOpen) return null;

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) {
      alert('Tafadhali chagua mwanachama.');
      return;
    }
    if (amount <= 0) {
      alert('Kiasi cha faini lazima kiwe zaidi ya 0.');
      return;
    }

    setIsSubmitting(true);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const receiptNo = `RCP-FIN-${dateStr}-${randNum}`;

    let fineTitle = 'Malipo ya Faini ya UWALEMI';
    let targetMeetingTitle: string | undefined = undefined;

    if (fineType === 'kikao') {
      const mtg = (state.meetings || []).find(m => m.id === selectedMeetingId);
      targetMeetingTitle = mtg?.title || 'Kikao cha UWALEMI';
      fineTitle = `Faini ya Kikao (${targetMeetingTitle})`;
    } else if (fineType === 'ada_late_fee') {
      fineTitle = `Faini ya Kuchelewa Ada (>Miezi 3)`;
    } else {
      fineTitle = `Faini ya Kikatiba / Utovu wa Nidhamu`;
    }

    const newPayment: UwalemiFinePayment = {
      id: `fine-pay-${Date.now()}`,
      receiptNo,
      memberId: selectedMember.id,
      memberNo: selectedMember.memberNo,
      memberName: selectedMember.fullName,
      memberPhone: selectedMember.phone,
      fineType,
      fineTitle,
      meetingId: fineType === 'kikao' ? selectedMeetingId : undefined,
      meetingTitle: targetMeetingTitle,
      amount: Number(amount),
      paymentDate,
      paymentMethod,
      referenceNo: referenceNo.trim() || undefined,
      receivedBy: receivedBy.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: now.toISOString()
    };

    // Update meetings if this was a meeting fine
    let updatedMeetings = [...(state.meetings || [])];
    if (fineType === 'kikao' && selectedMeetingId) {
      updatedMeetings = updatedMeetings.map(mtg => {
        if (mtg.id === selectedMeetingId) {
          const updatedAttendees = (mtg.attendees || []).map(att => {
            if (att.memberId === selectedMember.id) {
              return {
                ...att,
                finePaid: true
              };
            }
            return att;
          });
          return {
            ...mtg,
            attendees: updatedAttendees
          };
        }
        return mtg;
      });
    }

    // Update accruedFines if this was a late fee fine
    let updatedAccruedFines = [...(state.accruedFines || [])];
    if (fineType === 'ada_late_fee') {
      let paidAllocation = Number(amount);
      updatedAccruedFines = updatedAccruedFines.map(af => {
        if ((af.memberId === selectedMember.id || af.memberNo === selectedMember.memberNo) && af.fineType === 'ada_late_fee' && af.status !== 'paid') {
          const unpaid = Math.max(0, af.amount - (af.paidAmount || 0));
          if (unpaid > 0 && paidAllocation > 0) {
            const alloc = Math.min(unpaid, paidAllocation);
            const newPaid = (af.paidAmount || 0) + alloc;
            paidAllocation -= alloc;
            return {
              ...af,
              paidAmount: newPaid,
              status: (newPaid >= af.amount ? 'paid' : 'partial') as 'paid' | 'partial'
            };
          }
        }
        return af;
      });
    }

    const updatedFinePayments = [newPayment, ...(state.finePayments || [])];

    const updatedState: UwalemiState = {
      ...state,
      meetings: updatedMeetings,
      finePayments: updatedFinePayments,
      accruedFines: updatedAccruedFines,
      lastUpdated: now.toISOString()
    };

    const success = await onSaveState(updatedState);
    setIsSubmitting(false);

    if (success) {
      setCompletedPayment(newPayment);

      // Tuma SMS ya Stakabadhi Kiotomatiki (kama imewashwa)
      if (state.groupSettings?.smsConfig?.autoSendReceipts && newPayment.amount > 0 && selectedMember) {
        triggerAutoReceiptSms({
          state: updatedState,
          member: selectedMember,
          paymentType: 'fine',
          amount: newPayment.amount,
          purpose: `Faini (${newPayment.fineTitle})`,
          receiptNo: newPayment.receiptNo,
          paymentDate: newPayment.paymentDate,
          paymentMethod: newPayment.paymentMethod
        }).catch(err => console.warn('[Auto Receipt SMS Error]:', err));
      }
    } else {
      alert('Hitilafu ilitokea wakati wa kuhifadhi. Tafadhali jaribu tena.');
    }
  };

  const handleDownloadReceiptPdf = () => {
    if (!completedPayment || !selectedMember) return;
    const doc = generatePaymentReceiptPDF({
      receiptNo: completedPayment.receiptNo,
      groupName: state.groupSettings?.groupName || 'UWALEMI',
      slogan: state.groupSettings?.slogan || 'Lema, Nguvu Moja.',
      memberNo: completedPayment.memberNo,
      memberName: completedPayment.memberName,
      memberPhone: completedPayment.memberPhone,
      paymentType: completedPayment.fineTitle,
      periodOrTitle: completedPayment.meetingTitle || completedPayment.fineTitle,
      amount: completedPayment.amount,
      paymentDate: completedPayment.paymentDate,
      paymentMethod: completedPayment.paymentMethod,
      referenceNo: completedPayment.referenceNo || 'KUTOKA MFUMONI',
      receivedBy: completedPayment.receivedBy || 'Eva Lema (Mweka Hazina)',
      note: completedPayment.notes || 'Malipo ya faini yamethibitishwa rasmi na mfumo wa UWALEMI.'
    });

    downloadPdfDocument(doc, `Risiti_Faini_${completedPayment.receiptNo}_${completedPayment.memberNo}.pdf`);
  };

  const handlePreviewReceiptPdf = () => {
    if (!completedPayment || !selectedMember) return;
    const doc = generatePaymentReceiptPDF({
      receiptNo: completedPayment.receiptNo,
      groupName: state.groupSettings?.groupName || 'UWALEMI',
      slogan: state.groupSettings?.slogan || 'Lema, Nguvu Moja.',
      memberNo: completedPayment.memberNo,
      memberName: completedPayment.memberName,
      memberPhone: completedPayment.memberPhone,
      paymentType: completedPayment.fineTitle,
      periodOrTitle: completedPayment.meetingTitle || completedPayment.fineTitle,
      amount: completedPayment.amount,
      paymentDate: completedPayment.paymentDate,
      paymentMethod: completedPayment.paymentMethod,
      referenceNo: completedPayment.referenceNo || 'KUTOKA MFUMONI',
      receivedBy: completedPayment.receivedBy || 'Eva Lema (Mweka Hazina)',
      note: completedPayment.notes || 'Malipo ya faini yamethibitishwa rasmi na mfumo wa UWALEMI.'
    });

    const url = getPdfBlobUrl(doc);
    window.open(url, '_blank');
  };

  const handleSendReceiptSms = () => {
    if (!completedPayment || !selectedMember?.phone || !onOpenSmsWithTemplate) return;
    const template = `UWALEMI RISITI: Ndugu ${completedPayment.memberName} (${completedPayment.memberNo}), tumepokea TZS ${completedPayment.amount.toLocaleString()} kwa ajili ya ${completedPayment.fineTitle}. Risiti Na: ${completedPayment.receiptNo}. Tarehe: ${completedPayment.paymentDate}. Ahsante!`;
    onOpenSmsWithTemplate(
      [{ name: completedPayment.memberName, phone: completedPayment.memberPhone || selectedMember.phone, memberNo: completedPayment.memberNo }],
      template
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl my-8 animate-fadeIn">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {completedPayment ? 'Malipo ya Faini Yamerekodiwa!' : 'Rekodi Malipo ya Faini'}
              </h3>
              <p className="text-xs text-slate-400">
                {completedPayment 
                  ? `Risiti Na: ${completedPayment.receiptNo}` 
                  : 'Ingiza taarifa za malipo ya faini na toa risiti rasmi ya PDF'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SUCCESS VIEW */}
        {completedPayment ? (
          <div className="space-y-5 py-2">
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/40">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-white">Malipo Yamethibitishwa Kikamilifu!</h4>
              <p className="text-xs text-slate-300">
                Malipo ya faini ya <strong>{formatTZS(completedPayment.amount)}</strong> kutoka kwa{' '}
                <strong>{completedPayment.memberName} ({completedPayment.memberNo})</strong> yamerekodiwa kwenye mfumo.
              </p>
              <div className="inline-block font-mono text-xs font-bold bg-slate-900 px-3 py-1 rounded-lg text-emerald-400 border border-emerald-500/30 mt-1">
                {completedPayment.receiptNo}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleDownloadReceiptPdf}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Pakua Risiti Rasmi ya PDF (Download Receipt)
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePreviewReceiptPdf}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-blue-400" />
                  Angalia Risiti (Preview)
                </button>

                {onOpenSmsWithTemplate && selectedMember?.phone && (
                  <button
                    type="button"
                    onClick={handleSendReceiptSms}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-emerald-400" />
                    Tuma SMS ya Risiti
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Funga
              </button>
            </div>
          </div>
        ) : (
          /* PAYMENT FORM */
          <form onSubmit={handleRecordPayment} className="space-y-4">
            
            {/* 1. Member Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                Mwanachama Mwenye Faini *
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-rose-500 focus:outline-none"
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.memberNo} - {m.fullName} ({m.role || 'Mjumbe'}) {m.phone ? `• ${m.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Current Debt Card for Selected Member */}
            {memberDebtInfo && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Hali ya Madeni ya Mwanachama:</span>
                  <span className="font-mono text-white font-bold">{selectedMember?.memberNo}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-900 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Deni la Ada:</span>
                    <span className="font-semibold text-slate-300">{formatTZS(memberDebtInfo.feeDebt)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Faini Ada (&gt;3M):</span>
                    <span className="font-semibold text-rose-400">{formatTZS(memberDebtInfo.lateFeePenalty)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Faini za Vikao:</span>
                    <span className="font-semibold text-rose-400">{formatTZS(memberDebtInfo.otherFinesDebt)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Fine Type Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Aina ya Faini Inayolipwa *</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFineType('kikao')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                    fineType === 'kikao'
                      ? 'bg-rose-500/20 border-rose-500/60 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-[11px]">Faini ya Kikao</span>
                  <span className="text-[9px] text-slate-400 font-normal">Utoro / Kuchelewa</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFineType('ada_late_fee')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                    fineType === 'ada_late_fee'
                      ? 'bg-amber-500/20 border-amber-500/60 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-[11px]">Faini ya Ada</span>
                  <span className="text-[9px] text-slate-400 font-normal">Mz 6+ (&gt;3M)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFineType('nyingine')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                    fineType === 'nyingine'
                      ? 'bg-purple-500/20 border-purple-500/60 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-[11px]">Faini Nyingine</span>
                  <span className="text-[9px] text-slate-400 font-normal">Nidhamu / Kikatiba</span>
                </button>
              </div>
            </div>

            {/* 3. Meeting Selector if Kikao fine */}
            {fineType === 'kikao' && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Chagua Kikao Husika *</label>
                {unpaidMeetingFines.length > 0 ? (
                  <select
                    value={selectedMeetingId}
                    onChange={(e) => setSelectedMeetingId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-rose-500 focus:outline-none"
                  >
                    {unpaidMeetingFines.map(item => (
                      <option key={item.meeting.id} value={item.meeting.id}>
                        {item.meeting.title} ({item.meeting.date}) - Faini: TZS {item.fineAmount.toLocaleString()} ({item.reason})
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={selectedMeetingId}
                    onChange={(e) => setSelectedMeetingId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-rose-500 focus:outline-none"
                  >
                    <option value="">-- Chagua Kikao Chochote --</option>
                    {(state.meetings || []).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.title} ({m.date})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* 4. Amount and Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Kiasi Kilicholipwa (TZS) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  Tarehe ya Malipo *
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 5. Payment Method & Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  Njia ya Malipo *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
                >
                  {(state.groupSettings?.paymentMethods || []).map(pm => (
                    <option key={pm.id} value={`${pm.provider} (${pm.number})`}>
                      {pm.provider} - {pm.number} ({pm.accountName})
                    </option>
                  ))}
                  <option value="Vodacom M-Pesa (0758 219 298 - Eva O Lema)">M-Pesa (0758 219 298 - Eva O Lema)</option>
                  <option value="CRDB Bank (0152435678900)">CRDB Bank (0152435678900)</option>
                  <option value="Taslimu (Cash)">Taslimu (Cash)</option>
                  <option value="Airtel Money">Airtel Money</option>
                  <option value="Tigo Pesa">Tigo Pesa</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Namba ya Muamala (Reference No)</label>
                <input
                  type="text"
                  placeholder="Mfano: QHB7652391 au N/A"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 6. Received By & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Mpokeaji (Mweka Hazina)</label>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Maelezo ya Ziada (Notes)</label>
                <input
                  type="text"
                  placeholder="Maelezo ya ziada..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Ghairi
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/40 transition-all cursor-pointer disabled:opacity-50"
              >
                <Receipt className="w-4 h-4" />
                {isSubmitting ? 'Inarekodi...' : 'Thibitisha Malipo & Toa Risiti'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
