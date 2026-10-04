import React, { useState, useEffect } from 'react';
import { UwalemiState, UwalemiEmergencyFund, UwalemiContributionPayment, UwalemiEmergencyType } from '../../types/uwalemi';
import { 
  HeartHandshake, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Users, 
  CreditCard, 
  Send, 
  FileSpreadsheet, 
  Printer, 
  DollarSign, 
  X,
  AlertTriangle,
  Gift,
  Activity,
  Award,
  Trash2,
  Edit3,
  Building2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { sortMembersByLeadership, triggerAutoReceiptSms, normalizePaymentMethod, formatSwahiliDate, buildOfficialBereavementSms } from '../../services/uwalemiService';
import { FuneralScheduleBuilder } from './FuneralScheduleBuilder';

interface Props {
  state: UwalemiState;
  onSaveState: (state: UwalemiState) => Promise<boolean>;
  onOpenSmsWithTemplate?: (recipients: { name: string; phone: string; memberNo: string }[], templateText: string) => void;
  autoOpenNewFund?: boolean;
  onResetAutoOpen?: () => void;
  readOnly?: boolean;
}

export const UwalemiEmergencyFunds: React.FC<Props> = ({ 
  state, 
  onSaveState, 
  onOpenSmsWithTemplate,
  autoOpenNewFund,
  onResetAutoOpen,
  readOnly
}) => {
  useEffect(() => {
    if (autoOpenNewFund && !readOnly) {
      setIsNewFundModalOpen(true);
      if (onResetAutoOpen) {
        onResetAutoOpen();
      }
    }
  }, [autoOpenNewFund, onResetAutoOpen, readOnly]);

  const [selectedFundId, setSelectedFundId] = useState<string | null>(
    state.emergencyFunds?.[0]?.id || null
  );

  // Modals
  const [isNewFundModalOpen, setIsNewFundModalOpen] = useState(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [isEditFundModalOpen, setIsEditFundModalOpen] = useState(false);
  const [editingFund, setEditingFund] = useState<UwalemiEmergencyFund | null>(null);
  const [fundToDelete, setFundToDelete] = useState<UwalemiEmergencyFund | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<{ memberId: string; memberName: string; amount: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New Fund Form State
  const [fundForm, setFundForm] = useState<{
    title: string;
    type: UwalemiEmergencyType;
    targetAmount: number;
    perMemberTarget: number;
    beneficiaryName: string;
    beneficiaryPhone: string;
    beneficiaryRelation: string;
    deceasedName: string;
    deathDate: string;
    deathPlace: string;
    location: string;
    burialSchedule: string;
    deadline: string;
    description: string;
  }>({
    title: '',
    type: 'msiba',
    targetAmount: 0,
    perMemberTarget: 0,
    beneficiaryName: '',
    beneficiaryPhone: '',
    beneficiaryRelation: 'Mwanachama',
    deceasedName: '',
    deathDate: new Date().toISOString().split('T')[0],
    deathPlace: '',
    location: 'Mbezi Makabe - Kwa Paulo',
    burialSchedule: 'Ratiba rasmi ya mazishi, kuaga na safari itatolewa mara baada ya taratibu za kifamilia kukamilika.',
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: ''
  });

  // Record Payment Form State
  const [paymentForm, setPaymentForm] = useState<{
    memberId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    note: string;
  }>({
    memberId: '',
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'M Koba',
    note: ''
  });

  // Disbursement Form
  const [disburseForm, setDisburseForm] = useState<{
    amount: number;
    disbursedDate: string;
    disbursementNote: string;
  }>({
    amount: 0,
    disbursedDate: new Date().toISOString().split('T')[0],
    disbursementNote: 'Msaada umekabidhiwa kwa mfaidikaji mbele ya uongozi wa UWALEMI.'
  });

  const members = sortMembersByLeadership(state.members || []);
  const emergencyFunds = state.emergencyFunds || [];
  const selectedFund = emergencyFunds.find(f => f.id === selectedFundId) || emergencyFunds[0];

  // Calculations for selected fund
  const payments = selectedFund?.payments || [];
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const target = selectedFund?.targetAmount || 1;
  const progressPercent = Math.min(100, Math.round((totalPaid / target) * 100));

  const handleCreateFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) {
      alert('Hali ya Kutazama Tu: Hauruhusiwi kufungua mchango mpya.');
      return;
    }
    if (!fundForm.title || !fundForm.beneficiaryName) {
      alert('Tafadhali jaza Jina la Kampeni na Mfaidikaji.');
      return;
    }

    const newFund: UwalemiEmergencyFund = {
      id: `emg-${Date.now()}`,
      title: fundForm.title,
      type: fundForm.type,
      targetAmount: Number(fundForm.targetAmount) || 1000000,
      perMemberTarget: Number(fundForm.perMemberTarget) || 20000,
      beneficiaryName: fundForm.beneficiaryName,
      beneficiaryPhone: fundForm.beneficiaryPhone,
      beneficiaryRelation: fundForm.beneficiaryRelation,
      deceasedName: fundForm.deceasedName,
      deathDate: fundForm.deathDate,
      deathPlace: fundForm.deathPlace,
      location: fundForm.location,
      burialSchedule: fundForm.burialSchedule,
      startDate: new Date().toISOString().split('T')[0],
      deadline: fundForm.deadline,
      status: 'active',
      description: fundForm.description,
      payments: []
    };

    const updatedFunds = [newFund, ...emergencyFunds];
    await onSaveState({ ...state, emergencyFunds: updatedFunds });
    setSelectedFundId(newFund.id);
    setIsNewFundModalOpen(false);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) {
      alert('Hali ya Kutazama Tu: Hauruhusiwi kurekodi mchango.');
      return;
    }
    if (!selectedFund || !paymentForm.memberId) return;

    const member = members.find(m => m.id === paymentForm.memberId);
    if (!member) return;

    const receiptNo = `EMG-${selectedFund.id.slice(-4)}-${member.memberNo.replace('UWL-', '')}`;

    const newPayment: UwalemiContributionPayment = {
      id: `p-${Date.now()}`,
      emergencyId: selectedFund.id,
      memberId: member.id,
      memberNo: member.memberNo,
      memberName: member.fullName,
      amount: Number(paymentForm.amount),
      paymentDate: paymentForm.paymentDate,
      paymentMethod: paymentForm.paymentMethod,
      receiptNo,
      note: paymentForm.note
    };

    const updatedPayments = [...(selectedFund.payments || []).filter(p => p.memberId !== member.id && p.memberNo !== member.memberNo), newPayment];
    const updatedFund = { ...selectedFund, payments: updatedPayments };
    const updatedFunds = emergencyFunds.map(f => f.id === selectedFund.id ? updatedFund : f);

    await onSaveState({ ...state, emergencyFunds: updatedFunds });
    setIsRecordPaymentModalOpen(false);

    // Tuma Stakabadhi ya SMS Kiotomatiki (kama imewashwa)
    if (state.groupSettings?.smsConfig?.autoSendReceipts && Number(paymentForm.amount) > 0) {
      triggerAutoReceiptSms({
        state,
        member,
        paymentType: 'emergency',
        amount: Number(paymentForm.amount),
        purpose: `Mchango wa ${selectedFund.title}`,
        receiptNo,
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod
      }).catch(err => console.warn('[Auto Receipt SMS Error]:', err));
    }
  };

  const handleDeleteFund = (fundId: string) => {
    if (readOnly) {
      alert('Hali ya Kutazama Tu: Hauruhusiwi kufuta mchango.');
      return;
    }
    const targetFund = emergencyFunds.find(f => f.id === fundId);
    if (!targetFund) return;
    setFundToDelete(targetFund);
  };

  const confirmDeleteFund = async () => {
    if (!fundToDelete) return;
    if (readOnly) {
      alert('Hali ya Kutazama Tu: Hauruhusiwi kufuta mchango.');
      setFundToDelete(null);
      return;
    }

    try {
      setIsDeleting(true);
      const fundId = fundToDelete.id;
      const updatedFunds = emergencyFunds.filter(f => f.id !== fundId);
      await onSaveState({ ...state, emergencyFunds: updatedFunds });
      if (selectedFundId === fundId) {
        setSelectedFundId(updatedFunds[0]?.id || null);
      }
      setFundToDelete(null);
    } catch (err) {
      console.error('Error deleting fund:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeletePayment = (memberId: string, memberName: string, amount: number = 0) => {
    if (readOnly) {
      alert('Hali ya Kutazama Tu: Hauruhusiwi kufuta malipo.');
      return;
    }
    if (!selectedFund) return;
    setPaymentToDelete({ memberId, memberName, amount });
  };

  const confirmDeletePayment = async () => {
    if (!paymentToDelete || !selectedFund) return;
    if (readOnly) {
      alert('Hali ya Kutazama Tu: Hauruhusiwi kufuta malipo.');
      setPaymentToDelete(null);
      return;
    }

    try {
      setIsDeleting(true);
      const { memberId } = paymentToDelete;
      const updatedPayments = (selectedFund.payments || []).filter(p => p.memberId !== memberId && p.id !== memberId && p.memberNo !== memberId);
      const updatedFund = { ...selectedFund, payments: updatedPayments };
      const updatedFunds = emergencyFunds.map(f => f.id === selectedFund.id ? updatedFund : f);
      await onSaveState({ ...state, emergencyFunds: updatedFunds });
      setPaymentToDelete(null);
    } catch (err) {
      console.error('Error deleting payment:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenEditFund = (fund: UwalemiEmergencyFund) => {
    if (readOnly) {
      alert('Hali ya Kutazama Tu: Hauruhusiwi kuhariri mchango.');
      return;
    }
    const locationVal = fund.location || (fund.description ? fund.description.split('\n')[0].replace(/^Eneo\s*la\s*msiba\s*:\s*/i, '').replace(/^Msiba\s*upo\s*:\s*/i, '').trim() : 'Mbezi Makabe - Kwa Paulo');
    const burialVal = fund.burialSchedule || '';
    setEditingFund({ 
      ...fund,
      location: locationVal,
      burialSchedule: burialVal,
      deathDate: fund.deathDate || '',
      deathPlace: fund.deathPlace || ''
    });
    setIsEditFundModalOpen(true);
  };

  const handleSaveEditFund = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (readOnly || !editingFund) return;

    const updatedFunds = emergencyFunds.map(f => f.id === editingFund.id ? editingFund : f);
    await onSaveState({ ...state, emergencyFunds: updatedFunds });
    setIsEditFundModalOpen(false);
  };

  const handleResendBereavementAnnouncement = (fund: UwalemiEmergencyFund) => {
    if (!fund) return;
    const perMember = fund.perMemberTarget || 5000;
    const beneficiary = fund.beneficiaryName || '[Jina la Mwanachama]';
    const relation = fund.beneficiaryRelation || 'mama mkwe';

    const officialSms = buildOfficialBereavementSms({
      memberName: beneficiary,
      relationType: relation.toLowerCase().includes('mwenyewe') || relation.toLowerCase() === 'mwanachama' ? 'mwanachama' : 'custom',
      relationCustomLabel: relation,
      deceasedName: fund.deceasedName,
      deathDate: fund.deathDate,
      deathPlace: fund.deathPlace,
      location: fund.location || fund.description,
      meetingLocation: fund.meetingLocation,
      meetingDate: fund.meetingDate,
      meetingTime: fund.meetingTime,
      contributionAmount: perMember,
      paymentMethod: 'M Koba au 0758219298 (Eva O. Lema)',
      deadlineDate: fund.deadline,
      burialSchedule: fund.burialSchedule,
      includeGreeting: true
    });

    if (onOpenSmsWithTemplate) {
      const allRecipients = members.map(m => ({
        name: m.fullName,
        phone: m.phone,
        memberNo: m.memberNo
      }));
      onOpenSmsWithTemplate(allRecipients, officialSms);
    } else {
      navigator.clipboard.writeText(officialSms);
      alert('Ujumbe rasmi wa tangazo la msiba umenakiliwa! Unaweza kuutuma sasa kwa wanachama kupitia Kituo cha SMS au WhatsApp.');
    }
  };

  const handleSaveAndResendAnnouncement = async (fund: UwalemiEmergencyFund) => {
    if (readOnly) return;
    const updatedFunds = emergencyFunds.map(f => f.id === fund.id ? fund : f);
    await onSaveState({ ...state, emergencyFunds: updatedFunds });
    setIsEditFundModalOpen(false);
    handleResendBereavementAnnouncement(fund);
  };

  const handleDisburseFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFund) return;

    const updatedFund: UwalemiEmergencyFund = {
      ...selectedFund,
      status: 'disbursed',
      disbursedAmount: Number(disburseForm.amount) || totalPaid,
      disbursedDate: disburseForm.disbursedDate,
      disbursementNote: disburseForm.disbursementNote
    };

    const updatedFunds = emergencyFunds.map(f => f.id === selectedFund.id ? updatedFund : f);
    await onSaveState({ ...state, emergencyFunds: updatedFunds });
    setIsDisburseModalOpen(false);
  };

  const handleExportExcel = () => {
    if (!selectedFund) return;

    const data = members.map((m, idx) => {
      const p = (selectedFund.payments || []).find(pay => pay.memberId === m.id || pay.memberNo === m.memberNo);
      return {
        'Na.': idx + 1,
        'Namba ya Mjumbe': m.memberNo,
        'Jina la Mjumbe': m.fullName,
        'Namba ya Simu': m.phone,
        'Lengo la Mjumbe (TZS)': selectedFund.perMemberTarget || 20000,
        'Kiasi Kilichotolewa (TZS)': p ? p.amount : 0,
        'Hali': p && p.amount >= (selectedFund.perMemberTarget || 20000) ? 'Amekamilisha' : p ? 'Nusu' : 'Hajachanga',
        'Tarehe ya Mchango': p?.paymentDate || '-',
        'Njia ya Malipo': p?.paymentMethod || '-',
        'Namba ya Stakabadhi': p?.receiptNo || '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Michango');
    XLSX.writeFile(wb, `Michango_${selectedFund.title.substring(0, 20)}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleSendReminderToUnpaid = () => {
    if (!selectedFund) return;

    const paidMemberIds = new Set((selectedFund.payments || []).map(p => p.memberId));
    const unpaidList = members
      .filter(m => m.status === 'active' && !paidMemberIds.has(m.id))
      .map(m => ({
        name: m.fullName,
        phone: m.phone,
        memberNo: m.memberNo
      }));

    if (unpaidList.length === 0) {
      alert('Wajumbe wote wameshiriki mchango huu!');
      return;
    }

    const templateText = `Habari {name}, kikundi cha UWALEMI kinakukumbusha kushiriki mchango wa dharura wa "${selectedFund.title}" (TZS ${(selectedFund.perMemberTarget || 20000).toLocaleString()}). Mwisho wa kuchanga ni ${selectedFund.deadline}. Lipa kupitia M Koba au 0758 219 298 Eva O Lema. Lema, Nguvu Moja!`;

    if (onOpenSmsWithTemplate) {
      onOpenSmsWithTemplate(unpaidList, templateText);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12" id="uwalemi-emergency-funds">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-rose-400" />
            Michango ya Dharura, Misiba & Ustawi wa Jamii
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Usimamizi wa michango ya dharura (Misiba, Matibabu, Harusi) na ufuatiliaji wa michango ya wanachama wote.
          </p>
        </div>

        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (onOpenSmsWithTemplate) {
                  onOpenSmsWithTemplate(
                    members.map(m => ({ name: m.fullName, phone: m.phone, memberNo: m.memberNo })),
                    'emergency_alert_open_modal'
                  );
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/30 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              🕊️ Tangaza Msiba & Tuma SMS
            </button>
            <button
              onClick={() => {
                setFundForm({
                  title: '',
                  type: 'msiba',
                  targetAmount: 10000 * (members.length || 1),
                  perMemberTarget: 10000,
                  beneficiaryName: '',
                  beneficiaryPhone: '',
                  beneficiaryRelation: 'Mwanachama',
                  deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  description: ''
                });
                setIsNewFundModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Fungua Mchango Mpya wa Dharura
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <span>👁️ Hali ya Kutazama Tu</span>
          </div>
        )}
      </div>

      {/* Emergency Fund Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {emergencyFunds.map(fund => {
          const pSum = (fund.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const isSelected = selectedFund?.id === fund.id;
          const pCount = (fund.payments || []).length;

          return (
            <div
              key={fund.id}
              className={`p-4 rounded-xl text-left border transition-all relative group ${
                isSelected 
                  ? 'bg-rose-950/30 border-rose-500/60 shadow-lg shadow-rose-950/50' 
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  fund.type === 'msiba' ? 'bg-rose-500/20 text-rose-300' :
                  fund.type === 'ugonjwa' ? 'bg-amber-500/20 text-amber-300' :
                  'bg-blue-500/20 text-blue-300'
                }`}>
                  {fund.type}
                </span>
                
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    fund.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                    fund.status === 'disbursed' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {fund.status === 'active' ? 'Inaendelea' : fund.status === 'disbursed' ? 'Imekabidhiwa' : 'Imefungwa'}
                  </span>

                  {!readOnly && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditFund(fund);
                        }}
                        title="Hariri Tangazo na Taarifa za Mchango Huu"
                        className="p-1 rounded-lg hover:bg-purple-500/20 text-slate-500 hover:text-purple-400 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFund(fund.id);
                        }}
                        title="Futa Mchango / Tangazo Hili la Msiba"
                        className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div 
                onClick={() => setSelectedFundId(fund.id)}
                className="cursor-pointer"
              >
                <h3 className="text-sm font-bold text-white line-clamp-1">{fund.title}</h3>
                <div className="text-xs text-slate-400 mt-0.5">Mfaidikaji: {fund.beneficiaryName}</div>
                <div className="flex items-center justify-between text-xs mt-3 pt-2 border-t border-slate-800">
                  <span className="font-bold text-rose-400 font-mono">TZS {pSum.toLocaleString()}</span>
                  <span className="text-slate-400">{pCount}/{members.length} wajumbe</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Fund Detailed Section */}
      {selectedFund ? (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {selectedFund.type}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Tarehe ya Mwisho: {selectedFund.deadline}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white mt-1.5">{selectedFund.title}</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">{selectedFund.description}</p>
              <div className="mt-2 text-xs text-slate-400 flex items-center gap-4">
                <span>Mfaidikaji: <strong className="text-slate-200">{selectedFund.beneficiaryName}</strong> ({selectedFund.beneficiaryRelation})</span>
                {selectedFund.beneficiaryPhone && <span>Simu: <strong className="text-slate-200">{selectedFund.beneficiaryPhone}</strong></span>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleExportExcel}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Pakua Excel
              </button>

              {!readOnly && (
                <>
                  <button
                    onClick={() => handleOpenEditFund(selectedFund)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold transition-all cursor-pointer"
                    title="Hariri taarifa za msiba, kiasi, au eneo"
                  >
                    <Edit3 className="w-4 h-4 text-purple-400" />
                    Hariri Tangazo
                  </button>

                  <button
                    onClick={() => handleResendBereavementAnnouncement(selectedFund)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/30 transition-all cursor-pointer"
                    title="Tuma tena tangazo hili rasmi la msiba kwa wanachama wote kwa SMS"
                  >
                    <Send className="w-4 h-4" />
                    Tuma Tangazo Tena (SMS)
                  </button>

                  <button
                    onClick={handleSendReminderToUnpaid}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-900/30 transition-all cursor-pointer"
                    title="Tuma ujumbe wa kuwakumbusha wanachama ambao hawajachanga bado"
                  >
                    <Clock className="w-4 h-4" />
                    Kumbusha Wasiochanga
                  </button>

                  {selectedFund.status === 'active' && (
                    <button
                      onClick={() => {
                        setDisburseForm({
                          amount: totalPaid,
                          disbursedDate: new Date().toISOString().split('T')[0],
                          disbursementNote: `Msaada wa TZS ${totalPaid.toLocaleString()} umekabidhiwa kwa ${selectedFund.beneficiaryName}.`
                        });
                        setIsDisburseModalOpen(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Gift className="w-4 h-4" />
                      Toa Msaada kwa Mfaidikaji
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setPaymentForm({
                        memberId: members[0]?.id || '',
                        amount: selectedFund.perMemberTarget || 20000,
                        paymentDate: new Date().toISOString().split('T')[0],
                        paymentMethod: 'M Koba',
                        note: ''
                      });
                      setIsRecordPaymentModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/30 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Rekodi Mchango
                  </button>

                  <button
                    onClick={() => handleDeleteFund(selectedFund.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-800/60 text-xs font-semibold transition-all cursor-pointer"
                    title="Futa Kabisa Mchango na Tangazo Hili"
                  >
                    <Trash2 className="w-4 h-4" />
                    Futa Mchango
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Progress Section */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs text-slate-400">Jumla ya Michango Iliyokusanywa</span>
                <div className="text-3xl font-black text-rose-400 font-mono">
                  TZS {totalPaid.toLocaleString()}
                  <span className="text-sm font-normal text-slate-400 ml-2">/ TZS {target.toLocaleString()}</span>
                </div>
              </div>
              <div className="text-right sm:self-center">
                <span className="text-2xl font-bold text-white">{progressPercent}%</span>
                <div className="text-xs text-slate-400">{payments.length} kati ya {members.length} wajumbe wamechanga</div>
              </div>
            </div>

            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Members Contribution Checklist */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Orodha ya Wajumbe na Hali ya Michango Yao
            </h4>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Namba</th>
                    <th className="p-3">Mjumbe</th>
                    <th className="p-3">Lengo</th>
                    <th className="p-3">Kiasi Kilichotolewa</th>
                    <th className="p-3">Hali</th>
                    <th className="p-3">Tarehe & Njia</th>
                    <th className="p-3 text-right">Vitendo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {members.map(m => {
                    const payment = (selectedFund.payments || []).find(p => p.memberId === m.id || p.memberNo === m.memberNo);
                    const targetAmt = selectedFund.perMemberTarget || 20000;
                    const paidAmt = payment ? payment.amount : 0;
                    const hasPaidFull = paidAmt >= targetAmt;

                    return (
                      <tr key={m.id} className="hover:bg-slate-800/30">
                        <td className="p-3 font-mono font-bold text-emerald-400">{m.memberNo}</td>
                        <td className="p-3 font-semibold text-white">
                          <div>{m.fullName}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{m.phone}</div>
                        </td>
                        <td className="p-3 font-mono text-slate-400">TZS {targetAmt.toLocaleString()}</td>
                        <td className="p-3 font-mono font-bold">
                          <span className={hasPaidFull ? 'text-emerald-400' : paidAmt > 0 ? 'text-amber-400' : 'text-slate-600'}>
                            TZS {paidAmt.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            hasPaidFull ? 'bg-emerald-500/10 text-emerald-400' :
                            paidAmt > 0 ? 'bg-amber-500/10 text-amber-400' :
                            'bg-rose-500/10 text-rose-400'
                          }`}>
                            {hasPaidFull ? 'Amekamilisha' : paidAmt > 0 ? 'Amelipa Kiasi' : 'Hajachanga'}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-slate-400">
                          {payment ? `${payment.paymentDate} (${payment.paymentMethod})` : '-'}
                        </td>
                        <td className="p-3 text-right">
                          {!readOnly ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setPaymentForm({
                                    memberId: m.id,
                                    amount: payment ? payment.amount : targetAmt,
                                    paymentDate: payment?.paymentDate || new Date().toISOString().split('T')[0],
                                    paymentMethod: normalizePaymentMethod(payment?.paymentMethod),
                                    note: payment?.note || ''
                                  });
                                  setIsRecordPaymentModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-semibold cursor-pointer"
                              >
                                {payment ? 'Hariri' : '+ Rekodi'}
                              </button>

                              {payment && (
                                <button
                                  type="button"
                                  onClick={() => handleDeletePayment(m.id, m.fullName)}
                                  title="Futa Malipo Haya"
                                  className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
          <HeartHandshake className="w-12 h-12 text-slate-600 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-300">Hakuna Kampeni ya Dharura</h3>
          <p className="text-xs text-slate-500 mt-1">Bofya kitufe cha hapo juu kuanzisha mchango mpya wa msiba au matibabu.</p>
        </div>
      )}

      {/* MODAL: CREATE NEW EMERGENCY FUND */}
      {isNewFundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-rose-400" />
                Fungua Mchango Mpya wa Dharura
              </h3>
              <button onClick={() => setIsNewFundModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFund} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Aina ya Dharura</label>
                <select
                  value={fundForm.type}
                  onChange={(e) => setFundForm({ ...fundForm, type: e.target.value as UwalemiEmergencyType })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="msiba">Msiba / Rambirambi</option>
                  <option value="ugonjwa">Ugonjwa / Matibabu</option>
                  <option value="harusi">Harusi / Sherehe</option>
                  <option value="pongezi">Pongezi / Uzazi</option>
                  <option value="dharura">Dharura Nyingine</option>
                </select>
              </div>

              {/* Special Bereavement Helpers if Type is Msiba */}
              {fundForm.type === 'msiba' && (
                <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                    <HeartHandshake className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Mwongozo wa Michango ya Msiba (UWALEMI):</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    • <strong>TZS 10,000</strong>: Mwanachama, Mke, Mume, Mtoto, na Wazazi (Baba / Mama).<br/>
                    • <strong>TZS 5,000</strong>: Wakwe wa mwanachama (Baba Mkwe au Mama Mkwe).
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="text-slate-300 font-bold block mb-1">Chagua Mwanachama Aliyefiwa</label>
                      <select
                        onChange={(e) => {
                          const mId = e.target.value;
                          const selectedM = members.find(m => m.id === mId);
                          if (selectedM) {
                            setFundForm(prev => ({
                              ...prev,
                              beneficiaryName: selectedM.fullName,
                              beneficiaryPhone: selectedM.phone,
                              title: prev.title || `Msiba: ${prev.beneficiaryRelation} (${selectedM.fullName})`
                            }));
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white"
                      >
                        <option value="">-- Chagua kutoka kwa Wanachama --</option>
                        {members.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.memberNo} - {m.fullName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-300 font-bold block mb-1">Uhusiano wa Aliyefariki *</label>
                      <select
                        value={fundForm.beneficiaryRelation}
                        onChange={(e) => {
                          const rel = e.target.value;
                          const isMkwe = rel.toLowerCase().includes('mkwe');
                          const perAmount = isMkwe ? 5000 : 10000;
                          setFundForm(prev => ({
                            ...prev,
                            beneficiaryRelation: rel,
                            perMemberTarget: perAmount,
                            targetAmount: perAmount * (members.length || 1),
                            title: `Msiba: ${rel} wa ${prev.beneficiaryName || 'Mwanachama'}`
                          }));
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-rose-300 font-bold"
                      >
                        <optgroup label="Kiwango: TZS 10,000">
                          <option value="Mwanachama Mwenyewe">Mwanachama Mwenyewe (TZS 10,000)</option>
                          <option value="Mke wa Mwanachama">Mke wa Mwanachama (TZS 10,000)</option>
                          <option value="Mume wa Mwanachama">Mume wa Mwanachama (TZS 10,000)</option>
                          <option value="Mtoto wa Mwanachama">Mtoto wa Mwanachama (TZS 10,000)</option>
                          <option value="Mama Mzazi wa Mwanachama">Mama Mzazi wa Mwanachama (TZS 10,000)</option>
                          <option value="Baba Mzazi wa Mwanachama">Baba Mzazi wa Mwanachama (TZS 10,000)</option>
                        </optgroup>
                        <optgroup label="Kiwango: TZS 5,000">
                          <option value="Mama Mkwe wa Mwanachama">Mama Mkwe wa Mwanachama (TZS 5,000)</option>
                          <option value="Baba Mkwe wa Mwanachama">Baba Mkwe wa Mwanachama (TZS 5,000)</option>
                        </optgroup>
                        <optgroup label="Nyingine">
                          <option value="Ndugu wa Karibu">Ndugu wa Karibu</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Kichwa cha Mchango *</label>
                <input
                  type="text"
                  required
                  value={fundForm.title || ''}
                  onChange={(e) => setFundForm({ ...fundForm, title: e.target.value })}
                  placeholder="Mfano: Msiba: Mama Mzazi wa Jimmy Lema (UWL-003)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Mfaidikaji (Anayesaidiwa) *</label>
                  <input
                    type="text"
                    required
                    value={fundForm.beneficiaryName || ''}
                    onChange={(e) => setFundForm({ ...fundForm, beneficiaryName: e.target.value })}
                    placeholder="Jina la Mjumbe au Familia"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Uhusiano</label>
                  <input
                    type="text"
                    value={fundForm.beneficiaryRelation || ''}
                    onChange={(e) => setFundForm({ ...fundForm, beneficiaryRelation: e.target.value })}
                    placeholder="Mwanachama / Mama / Mtoto"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {fundForm.type === 'msiba' && (
                <div className="space-y-3 p-3 bg-rose-950/20 border border-rose-900/30 rounded-xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Jina la Marehemu (Aliyefariki)</label>
                      <input
                        type="text"
                        value={fundForm.deceasedName || ''}
                        onChange={(e) => setFundForm({ ...fundForm, deceasedName: e.target.value })}
                        placeholder="Mfano: Mama Grace Fransic Masawe"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Eneo la Msiba (Kufariji)</label>
                      <input
                        type="text"
                        value={fundForm.location || ''}
                        onChange={(e) => setFundForm({ ...fundForm, location: e.target.value })}
                        placeholder="Mfano: Mbezi Makabe - Kwa Paulo"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Tarehe Aliyofariki</label>
                      <input
                        type="date"
                        value={fundForm.deathDate || ''}
                        onChange={(e) => setFundForm({ ...fundForm, deathDate: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Mahali Alipofia (Amefia wapi?)</label>
                      <input
                        type="text"
                        value={fundForm.deathPlace || ''}
                        onChange={(e) => setFundForm({ ...fundForm, deathPlace: e.target.value })}
                        placeholder="Mfano: Hospitali ya Muhimbili / Nyumbani Mbezi"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  {/* TAARIFA ZA VIKAO VYA MSIBA */}
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                      <Building2 className="w-4 h-4" />
                      <span>Taarifa za Vikao vya Msiba (Hiari)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-slate-300 font-medium block mb-1 text-xs">
                          Ukumbi / Eneo la Kikao
                        </label>
                        <input
                          type="text"
                          value={fundForm.meetingLocation || ''}
                          onChange={(e) => setFundForm({ ...fundForm, meetingLocation: e.target.value })}
                          placeholder="Mfano: Riverside Hall"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-medium block mb-1 text-xs flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-400" />
                          Tarehe ya Kikao
                        </label>
                        <input
                          type="date"
                          value={fundForm.meetingDate || ''}
                          onChange={(e) => setFundForm({ ...fundForm, meetingDate: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-medium block mb-1 text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          Muda wa Kikao
                        </label>
                        <input
                          type="text"
                          value={fundForm.meetingTime || ''}
                          onChange={(e) => setFundForm({ ...fundForm, meetingTime: e.target.value })}
                          placeholder="Mfano: Saa 11:00 Jioni"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <FuneralScheduleBuilder
                      value={fundForm.burialSchedule || ''}
                      onChange={(val) => setFundForm(prev => ({ ...prev, burialSchedule: val }))}
                      defaultLocation={fundForm.location}
                      themeColor="rose"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Lengo Kuu (TZS)</label>
                  <input
                    type="number"
                    value={fundForm.targetAmount || 0}
                    onChange={(e) => setFundForm({ ...fundForm, targetAmount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Kila Mjumbe Achange (TZS)</label>
                  <input
                    type="number"
                    value={fundForm.perMemberTarget || 0}
                    onChange={(e) => setFundForm({ ...fundForm, perMemberTarget: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-rose-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Tarehe ya Mwisho ya Kuchanga (Deadline)</label>
                <input
                  type="date"
                  value={fundForm.deadline || ''}
                  onChange={(e) => setFundForm({ ...fundForm, deadline: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Maelezo ya Ziada</label>
                <textarea
                  rows={3}
                  value={fundForm.description || ''}
                  onChange={(e) => setFundForm({ ...fundForm, description: e.target.value })}
                  placeholder="Maelezo kuhusu msiba au hali ya mfaidikaji..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewFundModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/30 cursor-pointer"
                >
                  Anzisha Mchango
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD CONTRIBUTION */}
      {isRecordPaymentModalOpen && selectedFund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Rekodi Mchango wa Dharura
              </h3>
              <button onClick={() => setIsRecordPaymentModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Mwanachama Aliyechanga *</label>
                <select
                  required
                  value={paymentForm.memberId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, memberId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="">-- Chagua Mjumbe --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.memberNo} - {m.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Kiasi Kilichotolewa (TZS) *</label>
                <input
                  type="number"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-emerald-400 text-base"
                />
              </div>

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
                    <option value="M Koba">M Koba</option>
                    <option value="Tigo Pesa">Tigo Pesa</option>
                    <option value="Airtel Money">Airtel Money</option>
                    <option value="Benki (CRDB/NMB)">Benki (CRDB/NMB)</option>
                    <option value="Taslimu (Cash)">Taslimu (Cash)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRecordPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 cursor-pointer"
                >
                  Hifadhi Mchango
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DISBURSE TO BENEFICIARY */}
      {isDisburseModalOpen && selectedFund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-blue-400" />
                Kabidhi Msaada kwa Mfaidikaji
              </h3>
              <button onClick={() => setIsDisburseModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDisburseFund} className="space-y-3.5 text-xs">
              <div className="p-3 bg-blue-950/30 border border-blue-500/20 rounded-xl text-blue-300">
                Unakaribia kufunga kampeni hii na kurekodi kwamba kiasi cha <strong>TZS {totalPaid.toLocaleString()}</strong> kimekabidhiwa kwa <strong>{selectedFund.beneficiaryName}</strong>.
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Kiasi Kilichokabidhiwa (TZS)</label>
                <input
                  type="number"
                  value={disburseForm.amount}
                  onChange={(e) => setDisburseForm({ ...disburseForm, amount: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-blue-400"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Tarehe ya Makabidhiano</label>
                <input
                  type="date"
                  value={disburseForm.disbursedDate}
                  onChange={(e) => setDisburseForm({ ...disburseForm, disbursedDate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Maelezo ya Makabidhiano</label>
                <textarea
                  rows={3}
                  value={disburseForm.disbursementNote}
                  onChange={(e) => setDisburseForm({ ...disburseForm, disbursementNote: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDisburseModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 cursor-pointer"
                >
                  Thibitisha Makabidhiano
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT EMERGENCY FUND / TANGZO LA MSIBA */}
      {isEditFundModalOpen && editingFund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-purple-400" />
                Hariri Tangazo & Taarifa za Msiba / Mchango
              </h3>
              <button 
                type="button"
                onClick={() => setIsEditFundModalOpen(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditFund} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Aina ya Mchango</label>
                  <select
                    value={editingFund.type || 'msiba'}
                    onChange={(e) => setEditingFund({ ...editingFund, type: e.target.value as UwalemiEmergencyType })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="msiba">Msiba / Rambirambi</option>
                    <option value="ugonjwa">Ugonjwa / Matibabu</option>
                    <option value="harusi">Harusi / Sherehe</option>
                    <option value="pongezi">Pongezi / Uzazi</option>
                    <option value="dharura">Dharura Nyingine</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Hali ya Mchango</label>
                  <select
                    value={editingFund.status || 'active'}
                    onChange={(e) => setEditingFund({ ...editingFund, status: e.target.value as 'active' | 'disbursed' | 'closed' })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="active">Inaendelea (Active)</option>
                    <option value="disbursed">Imekabidhiwa (Disbursed)</option>
                    <option value="closed">Imefungwa (Closed)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Kichwa cha Tangazo / Mchango *</label>
                <input
                  type="text"
                  required
                  value={editingFund.title || ''}
                  onChange={(e) => setEditingFund({ ...editingFund, title: e.target.value })}
                  placeholder="Mfano: Msiba: Mama Mkwe wa Jimson Lema"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Mfaidikaji / Aliyefiwa *</label>
                  <input
                    type="text"
                    required
                    value={editingFund.beneficiaryName || ''}
                    onChange={(e) => setEditingFund({ ...editingFund, beneficiaryName: e.target.value })}
                    placeholder="Jina la Mjumbe au Mfiwa"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Simu ya Mfaidikaji</label>
                  <input
                    type="text"
                    value={editingFund.beneficiaryPhone || ''}
                    onChange={(e) => setEditingFund({ ...editingFund, beneficiaryPhone: e.target.value })}
                    placeholder="Mfano: 0743788734"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Uhusiano wa Aliyefariki / Mgonjwa</label>
                  <input
                    type="text"
                    value={editingFund.beneficiaryRelation || ''}
                    onChange={(e) => setEditingFund({ ...editingFund, beneficiaryRelation: e.target.value })}
                    placeholder="Mfano: Mama Mkwe wa Mwanachama"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Jina la Aliyefariki / Marehemu</label>
                  <input
                    type="text"
                    value={editingFund.deceasedName || ''}
                    onChange={(e) => setEditingFund({ ...editingFund, deceasedName: e.target.value })}
                    placeholder="Mfano: Mama Grace Fransic Masawe"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 -mt-1">
                {[
                  { label: 'Mama Mzazi (10k)', relation: 'Mama Mzazi wa Mwanachama', amount: 10000 },
                  { label: 'Baba Mzazi (10k)', relation: 'Baba Mzazi wa Mwanachama', amount: 10000 },
                  { label: 'Mama Mkwe (5k)', relation: 'Mama Mkwe wa Mwanachama', amount: 5000 },
                  { label: 'Baba Mkwe (5k)', relation: 'Baba Mkwe wa Mwanachama', amount: 5000 },
                  { label: 'Mke/Mume (10k)', relation: 'Mke / Mume wa Mwanachama', amount: 10000 },
                  { label: 'Mtoto (10k)', relation: 'Mtoto wa Mwanachama', amount: 10000 },
                ].map(quick => (
                  <button
                    key={quick.label}
                    type="button"
                    onClick={() => {
                      setEditingFund(prev => prev ? {
                        ...prev,
                        beneficiaryRelation: quick.relation,
                        perMemberTarget: quick.amount,
                        targetAmount: quick.amount * (members.length || 1)
                      } : null);
                    }}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] border border-slate-700 cursor-pointer"
                  >
                    {quick.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Tarehe Aliyofariki</label>
                  <input
                    type="date"
                    value={editingFund.deathDate || ''}
                    onChange={(e) => setEditingFund({ ...editingFund, deathDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Mahali Alipofia (Amefia wapi?)</label>
                  <input
                    type="text"
                    value={editingFund.deathPlace || ''}
                    onChange={(e) => setEditingFund({ ...editingFund, deathPlace: e.target.value })}
                    placeholder="Mfano: Hospitali ya Muhimbili / Nyumbani"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Eneo la Msiba (Location) *</label>
                <input
                  type="text"
                  value={editingFund.location || ''}
                  onChange={(e) => setEditingFund({ ...editingFund, location: e.target.value })}
                  placeholder="Mfano: Mbezi Makabe - Kwa Paulo"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {/* TAARIFA ZA VIKAO VYA MSIBA */}
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <Building2 className="w-4 h-4" />
                  <span>Taarifa za Vikao vya Msiba (Hiari)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-300 font-medium block mb-1 text-xs">
                      Ukumbi / Eneo la Kikao
                    </label>
                    <input
                      type="text"
                      value={editingFund.meetingLocation || ''}
                      onChange={(e) => setEditingFund({ ...editingFund, meetingLocation: e.target.value })}
                      placeholder="Mfano: Riverside Hall"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-medium block mb-1 text-xs flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-400" />
                      Tarehe ya Kikao
                    </label>
                    <input
                      type="date"
                      value={editingFund.meetingDate || ''}
                      onChange={(e) => setEditingFund({ ...editingFund, meetingDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-medium block mb-1 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      Muda wa Kikao
                    </label>
                    <input
                      type="text"
                      value={editingFund.meetingTime || ''}
                      onChange={(e) => setEditingFund({ ...editingFund, meetingTime: e.target.value })}
                      placeholder="Mfano: Saa 11:00 Jioni"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* RATIBA YA MAZISHI / KUAGA / SAFARI */}
              <div>
                <FuneralScheduleBuilder
                  value={editingFund.burialSchedule || ''}
                  onChange={(val) => setEditingFund(prev => prev ? ({ ...prev, burialSchedule: val }) : null)}
                  defaultLocation={editingFund.location}
                  themeColor="purple"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Kila Mjumbe Achange (TZS) *</label>
                  <input
                    type="number"
                    required
                    value={editingFund.perMemberTarget || 0}
                    onChange={(e) => {
                      const perVal = Number(e.target.value);
                      setEditingFund(prev => prev ? {
                        ...prev,
                        perMemberTarget: perVal,
                        targetAmount: perVal * (members.length || 1)
                      } : null);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-rose-400"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Jumla ya Lengo (TZS)</label>
                  <input
                    type="number"
                    value={editingFund.targetAmount || 0}
                    onChange={(e) => setEditingFund({ ...editingFund, targetAmount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Tarehe ya Mwisho ya Kuchanga (Deadline) *</label>
                <input
                  type="date"
                  required
                  value={editingFund.deadline || ''}
                  onChange={(e) => setEditingFund({ ...editingFund, deadline: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Maelezo Mengine ya Ziada (Hiari)</label>
                <textarea
                  rows={2}
                  value={editingFund.description || ''}
                  onChange={(e) => setEditingFund({ ...editingFund, description: e.target.value })}
                  placeholder="Maelezo mengine yoyote ya ziada..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditFundModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Ghairi
                </button>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/40 text-xs font-semibold cursor-pointer"
                  >
                    Hifadhi Tu
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveAndResendAnnouncement(editingFund)}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/30 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Hifadhi & Tuma Tangazo Tena (SMS)
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting Fund / Emergency Campaign */}
      {fundToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-900/50 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">Futa Mchango / Tangazo la Msiba?</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Je, una uhakika unataka kufuta kabisa mfuko na tangazo hili:
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
              <div className="font-bold text-sm text-white">{fundToDelete.title}</div>
              <div className="text-xs text-slate-400">
                Mfaidikaji: <strong className="text-slate-200">{fundToDelete.beneficiaryName}</strong> ({fundToDelete.beneficiaryRelation})
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                <span className="text-slate-400">Michango Iliyokusanywa:</span>
                <span className="font-mono font-bold text-rose-400">
                  TZS {((fundToDelete.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)).toLocaleString()} ({fundToDelete.payments?.length || 0} wajumbe)
                </span>
              </div>
            </div>

            <div className="p-3 bg-rose-950/30 border border-rose-900/40 rounded-xl text-[11px] text-rose-300">
              ⚠️ <strong>Onyo:</strong> Tangazo hili, takwimu zake na rekodi za michango ya wajumbe zitaondolewa kabisa kwenye mfumo (Ripoti, Daftari la Michango na SMS).
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setFundToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Ghairi
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteFund}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/40 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? 'Inafuta...' : 'Ndio, Futa Kabisa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting Single Payment */}
      {paymentToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-900/50 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">Futa Rekodi ya Mchango?</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Je, una uhakika unataka kufuta rekodi ya mchango wa:
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1 text-xs">
              <div className="font-bold text-white text-sm">{paymentToDelete.memberName}</div>
              <div className="text-rose-400 font-mono font-bold">
                Kiasi: TZS {paymentToDelete.amount ? paymentToDelete.amount.toLocaleString() : '0'}
              </div>
              <div className="text-slate-400 text-[11px] pt-1">
                Kwenye mfuko wa: <strong>{selectedFund?.title}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPaymentToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Ghairi
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeletePayment}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? 'Inafuta...' : 'Ndio, Futa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
