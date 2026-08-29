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
  Award
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { sortMembersByLeadership, triggerAutoReceiptSms } from '../../services/uwalemiService';

interface Props {
  state: UwalemiState;
  onSaveState: (state: UwalemiState) => Promise<boolean>;
  onOpenSmsWithTemplate?: (recipients: { name: string; phone: string; memberNo: string }[], templateText: string) => void;
  autoOpenNewFund?: boolean;
  onResetAutoOpen?: () => void;
}

export const UwalemiEmergencyFunds: React.FC<Props> = ({ 
  state, 
  onSaveState, 
  onOpenSmsWithTemplate,
  autoOpenNewFund,
  onResetAutoOpen
}) => {
  useEffect(() => {
    if (autoOpenNewFund) {
      setIsNewFundModalOpen(true);
      if (onResetAutoOpen) {
        onResetAutoOpen();
      }
    }
  }, [autoOpenNewFund, onResetAutoOpen]);

  const [selectedFundId, setSelectedFundId] = useState<string | null>(
    state.emergencyFunds?.[0]?.id || null
  );

  // Modals
  const [isNewFundModalOpen, setIsNewFundModalOpen] = useState(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);

  // New Fund Form State
  const [fundForm, setFundForm] = useState<{
    title: string;
    type: UwalemiEmergencyType;
    targetAmount: number;
    perMemberTarget: number;
    beneficiaryName: string;
    beneficiaryPhone: string;
    beneficiaryRelation: string;
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
    paymentMethod: 'M-Pesa (Lipa Namba)',
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

    const updatedPayments = [...(selectedFund.payments || []).filter(p => p.memberId !== member.id), newPayment];
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

        <button
          onClick={() => {
            setFundForm({
              title: '',
              type: 'msiba',
              targetAmount: 1000000,
              perMemberTarget: 20000,
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

      {/* Emergency Fund Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {emergencyFunds.map(fund => {
          const pSum = (fund.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const isSelected = selectedFund?.id === fund.id;
          const pCount = (fund.payments || []).length;

          return (
            <button
              key={fund.id}
              onClick={() => setSelectedFundId(fund.id)}
              className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
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
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  fund.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                  fund.status === 'disbursed' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {fund.status === 'active' ? 'Inaendelea' : fund.status === 'disbursed' ? 'Imekabidhiwa' : 'Imefungwa'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white line-clamp-1">{fund.title}</h3>
              <div className="text-xs text-slate-400 mt-0.5">Mfaidikaji: {fund.beneficiaryName}</div>
              <div className="flex items-center justify-between text-xs mt-3 pt-2 border-t border-slate-800">
                <span className="font-bold text-rose-400">TZS {pSum.toLocaleString()}</span>
                <span className="text-slate-400">{pCount}/{members.length} wajumbe</span>
              </div>
            </button>
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

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={handleExportExcel}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Pakua Excel
              </button>

              <button
                onClick={handleSendReminderToUnpaid}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-900/30 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
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
                    paymentMethod: 'M-Pesa (Lipa Namba)',
                    note: ''
                  });
                  setIsRecordPaymentModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/30 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Rekodi Mchango
              </button>
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
                          <button
                            onClick={() => {
                              setPaymentForm({
                                memberId: m.id,
                                amount: payment ? payment.amount : targetAmt,
                                paymentDate: payment?.paymentDate || new Date().toISOString().split('T')[0],
                                paymentMethod: payment?.paymentMethod || 'M-Pesa (Lipa Namba)',
                                note: payment?.note || ''
                              });
                              setIsRecordPaymentModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-semibold cursor-pointer"
                          >
                            {payment ? 'Hariri' : '+ Rekodi'}
                          </button>
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

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Kichwa cha Mchango *</label>
                <input
                  type="text"
                  required
                  value={fundForm.title}
                  onChange={(e) => setFundForm({ ...fundForm, title: e.target.value })}
                  placeholder="Mfano: Mchango wa Msiba wa Mama yake Mjumbe UWL-015"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Mfaidikaji (Anayesaidiwa) *</label>
                  <input
                    type="text"
                    required
                    value={fundForm.beneficiaryName}
                    onChange={(e) => setFundForm({ ...fundForm, beneficiaryName: e.target.value })}
                    placeholder="Jina la Mjumbe au Familia"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Uhusiano</label>
                  <input
                    type="text"
                    value={fundForm.beneficiaryRelation}
                    onChange={(e) => setFundForm({ ...fundForm, beneficiaryRelation: e.target.value })}
                    placeholder="Mwanachama / Mama / Mtoto"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Lengo Kuu (TZS)</label>
                  <input
                    type="number"
                    value={fundForm.targetAmount}
                    onChange={(e) => setFundForm({ ...fundForm, targetAmount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Kila Mjumbe Achange (TZS)</label>
                  <input
                    type="number"
                    value={fundForm.perMemberTarget}
                    onChange={(e) => setFundForm({ ...fundForm, perMemberTarget: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-rose-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Tarehe ya Mwisho ya Kuchanga (Deadline)</label>
                <input
                  type="date"
                  value={fundForm.deadline}
                  onChange={(e) => setFundForm({ ...fundForm, deadline: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Maelezo ya Ziada</label>
                <textarea
                  rows={3}
                  value={fundForm.description}
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
                    <option value="M-Pesa (Lipa Namba)">M-Pesa (Lipa Namba)</option>
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
    </div>
  );
};
