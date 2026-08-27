import React from 'react';
import { UwalemiState, UwalemiMember } from '../../types/uwalemi';
import { 
  Users, 
  Wallet, 
  Calendar, 
  HeartHandshake, 
  AlertCircle, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  Send,
  PlusCircle,
  FileSpreadsheet,
  Award
} from 'lucide-react';

interface Props {
  state: UwalemiState;
  onNavigateTab: (tab: string) => void;
  onOpenNewFeeModal: () => void;
  onOpenNewEmergencyModal: () => void;
  onOpenNewExpenseModal: () => void;
  onOpenNewMeetingModal: () => void;
}

export const UwalemiOverview: React.FC<Props> = ({
  state,
  onNavigateTab,
  onOpenNewFeeModal,
  onOpenNewEmergencyModal,
  onOpenNewExpenseModal,
  onOpenNewMeetingModal
}) => {
  const members = state.members || [];
  const activeMembers = members.filter(m => m.status === 'active');
  
  // Calculate Finances
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12

  // Total Registration Fees (Kiingilio)
  const totalRegFees = members.reduce((sum, m) => {
    if (m.registrationFeePaidAmount !== undefined) return sum + m.registrationFeePaidAmount;
    return sum + (m.registrationFeePaid ? (Number(m.registrationFeeAmount) || 0) : 0);
  }, 0);
  
  // Total Monthly Fees
  const totalMonthlyFees = (state.monthlyPayments || []).reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);

  // Total Meeting Fines Collected
  const totalMeetingFines = (state.meetings || []).reduce((sum, mtg) => {
    return sum + (mtg.attendees || []).reduce((aSum, att) => aSum + (att.finePaid ? (Number(att.fineAmount) || 0) : 0), 0);
  }, 0);
  
  // Total Emergency Contributions Collected
  const totalEmergencyCollected = (state.emergencyFunds || []).reduce((sum, emg) => {
    const pSum = (emg.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return sum + pSum;
  }, 0);

  // Total Expenses
  const totalExpenses = (state.expenses || []).reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  // Net Treasury Balance (Salio la Hazina)
  const treasuryBalance = (totalRegFees + totalMonthlyFees + totalMeetingFines + totalEmergencyCollected) - totalExpenses;

  // Current Month Fees Status
  const currentMonthPayments = (state.monthlyPayments || []).filter(p => p.year === currentYear && p.month === currentMonth);
  const paidThisMonthCount = currentMonthPayments.filter(p => p.status === 'paid').length;
  const partialThisMonthCount = currentMonthPayments.filter(p => p.status === 'partial').length;
  const unpaidThisMonthCount = Math.max(0, activeMembers.length - (paidThisMonthCount + partialThisMonthCount));
  const currentMonthProgress = activeMembers.length > 0 ? Math.round((paidThisMonthCount / activeMembers.length) * 100) : 0;

  // Active Emergency Funds
  const activeEmergencyFunds = (state.emergencyFunds || []).filter(e => e.status === 'active');

  // Next Upcoming Meeting
  const upcomingMeetings = (state.meetings || []).filter(m => m.status === 'upcoming');
  const nextMeeting = upcomingMeetings.length > 0 ? upcomingMeetings[0] : null;

  const monthNamesSw = ['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'];
  const currentMonthName = monthNamesSw[currentMonth - 1];

  return (
    <div className="space-y-6 animate-fadeIn pb-12" id="uwalemi-overview">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-900/40 via-teal-900/30 to-slate-900/60 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Award className="w-3.5 h-3.5" />
              <span>Chama cha Kijamii cha UWALEMI</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              {state.groupSettings.groupName || 'UWALEMI'}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal border border-slate-700">
                Wanachama {members.length}
              </span>
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              {state.groupSettings?.slogan && !state.groupSettings.slogan.includes('Shida na Raha') ? state.groupSettings.slogan : 'Lema, Nguvu Moja.'} • Moduli inayojitegemea ya uendeshaji wa ada za kila mwezi, michango ya misiba, matibabu, na vikao vya kikundi (Kuanzia 2023).
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={onOpenNewFeeModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Rekodi Ada ya Mwezi
            </button>
            <button
              onClick={onOpenNewEmergencyModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600/90 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-900/30 transition-all cursor-pointer"
            >
              <HeartHandshake className="w-4 h-4" />
              Fungua Mchango wa Dharura
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Salio la Hazina */}
        <div className="bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 backdrop-blur-md transition-all shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Salio la Hazina (Mfuko Mkuu)</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            TZS {treasuryBalance.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
            <span className="text-emerald-400 flex items-center font-medium">
              <ArrowUpRight className="w-3.5 h-3.5 inline" /> TZS {(totalRegFees + totalMonthlyFees + totalMeetingFines + totalEmergencyCollected).toLocaleString()}
            </span>
            <span>mapato yote</span>
          </div>
        </div>

        {/* Card 2: Wanachama */}
        <div className="bg-slate-900/70 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-5 backdrop-blur-md transition-all shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Wanachama Waliosajiliwa</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {activeMembers.length} <span className="text-sm font-normal text-slate-400">wajumbe hai ({members.length} jumla)</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>{activeMembers.length} Wako Hai (Active)</span>
            {members.length - activeMembers.length > 0 && (
              <span className="text-rose-400 font-medium">({members.length - activeMembers.length} Wasio hai)</span>
            )}
          </div>
        </div>

        {/* Card 3: Ada ya Mwezi Huu */}
        <div className="bg-slate-900/70 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 backdrop-blur-md transition-all shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Ada ya {currentMonthName} {currentYear}</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-400 tracking-tight">
            {paidThisMonthCount} <span className="text-sm font-normal text-slate-400">wamelipa ({currentMonthProgress}%)</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, currentMonthProgress)}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
            <span className="text-emerald-400">{paidThisMonthCount} wamelipa</span>
            <span className="text-rose-400">{unpaidThisMonthCount} bado</span>
          </div>
        </div>

        {/* Card 4: Michango ya Dharura */}
        <div className="bg-slate-900/70 border border-slate-800 hover:border-rose-500/40 rounded-2xl p-5 backdrop-blur-md transition-all shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Michango ya Dharura</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <HeartHandshake className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-400 tracking-tight">
            {activeEmergencyFunds.length} <span className="text-sm font-normal text-slate-400">kampeni hai</span>
          </div>
          <div className="text-xs text-slate-400 mt-2 truncate">
            {activeEmergencyFunds.length > 0 ? (
              <span className="text-slate-300 font-medium">{activeEmergencyFunds[0].title}</span>
            ) : (
              <span>Hakuna dharura inayochangiwa sasa</span>
            )}
          </div>
        </div>
      </div>

      {/* 2-Column Section: Active Emergencies & Next Meeting */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Michango ya Dharura Inayoendelea */}
        <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <HeartHandshake className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Michango ya Dharura & Ustawi (SOS Welfare)</h2>
                <p className="text-xs text-slate-400">Misiba, matibabu na msaada wa kijamii kwa wajumbe</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('emergency')}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              Tazama Yote <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeEmergencyFunds.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-60" />
              <p className="text-sm text-slate-300 font-medium">Hakuna kampeni ya dharura inayoendelea sasa</p>
              <p className="text-xs text-slate-500 mt-1">Mjumbe akipata shida au msiba, fungua mchango hapa kusaidiana.</p>
              <button
                onClick={onOpenNewEmergencyModal}
                className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Fungua Mchango wa Dharura
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeEmergencyFunds.map((fund) => {
                const totalPaid = (fund.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                const percent = fund.targetAmount > 0 ? Math.round((totalPaid / fund.targetAmount) * 100) : 0;
                const paidCount = (fund.payments || []).length;

                return (
                  <div key={fund.id} className="bg-slate-950/60 border border-slate-800/80 hover:border-rose-500/30 rounded-xl p-4.5 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            fund.type === 'msiba' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                            fund.type === 'ugonjwa' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {fund.type.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Mwisho: {fund.deadline || 'Bado'}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white mt-1.5">{fund.title}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Mfaidikaji: <strong className="text-slate-200">{fund.beneficiaryName}</strong> ({fund.beneficiaryRelation || 'Mwanachama'})
                        </p>
                      </div>

                      <div className="text-right sm:self-center">
                        <div className="text-sm font-bold text-rose-400">
                          TZS {totalPaid.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Lengo: TZS {fund.targetAmount.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                      <div 
                        className="bg-gradient-to-r from-rose-500 to-amber-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, percent)}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                      <span>Wajumbe <strong>{paidCount}</strong> kati ya {members.length} wameshachanga ({percent}%)</span>
                      <button
                        onClick={() => onNavigateTab('emergency')}
                        className="text-xs text-rose-400 hover:underline font-semibold cursor-pointer"
                      >
                        Rekodi Mchango →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Col: Ratiba ya Kikao Kijacho & Quick Links */}
        <div className="space-y-6">
          {/* Upcoming Meeting Card */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Kikao Kijacho</h3>
              </div>
              <button
                onClick={() => onNavigateTab('meetings')}
                className="text-[11px] text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                Ratiba Yote →
              </button>
            </div>

            {nextMeeting ? (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="text-xs font-bold text-white">{nextMeeting.title}</div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>{nextMeeting.date} ({nextMeeting.time})</span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{nextMeeting.location}</span>
                </div>
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-semibold text-slate-300 mb-1">Ajenda Kuu:</div>
                  <ul className="text-[11px] text-slate-400 space-y-0.5 list-disc list-inside">
                    {(nextMeeting.agendas || []).slice(0, 3).map((ag, idx) => (
                      <li key={idx} className="truncate">{ag}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400">Hakuna kikao kilichopangwa kwa sasa</p>
                <button
                  onClick={onOpenNewMeetingModal}
                  className="mt-2 text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                >
                  + Panga Kikao Kipya
                </button>
              </div>
            )}
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-md space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Njia za Mkato (Quick Actions)</h3>
            
            <button
              onClick={() => onNavigateTab('sms')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-left text-xs font-semibold text-slate-200 transition-all cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Send className="w-4 h-4 text-emerald-400" />
                Tuma SMS / WhatsApp kwa Wajumbe
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-500" />
            </button>

            <button
              onClick={onOpenNewExpenseModal}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-left text-xs font-semibold text-slate-200 transition-all cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <ArrowDownRight className="w-4 h-4 text-rose-400" />
                Rekodi Matumizi ya Hazina
              </span>
              <PlusCircle className="w-4 h-4 text-slate-500" />
            </button>

            <button
              onClick={() => onNavigateTab('expenses')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-left text-xs font-semibold text-slate-200 transition-all cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                Ripoti ya Mapato & Matumizi ya Kikundi
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
