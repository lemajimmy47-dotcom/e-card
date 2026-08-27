import React, { useState, useEffect } from 'react';
import { UwalemiState, UwalemiMember } from '../../types/uwalemi';
import { 
  ShieldCheck, 
  Award, 
  CreditCard, 
  HeartHandshake, 
  Calendar, 
  Wallet, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  MapPin, 
  Clock, 
  ArrowLeft,
  Share2
} from 'lucide-react';

interface Props {
  memberNoOrPhone: string;
  onClose?: () => void;
  standalone?: boolean;
}

export const UwalemiMemberPortal: React.FC<Props> = ({ memberNoOrPhone, onClose, standalone = false }) => {
  const [data, setData] = useState<{
    member: UwalemiMember;
    groupSettings: any;
    monthlyPayments: any[];
    emergencyContributions: any[];
    upcomingMeetings: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const res = await fetch(`/api/uwalemi/member/${encodeURIComponent(memberNoOrPhone)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.member) {
            setData(json);
          } else {
            setError('Mwanachama hakupatikana.');
          }
        } else {
          setError('Mwanachama hakupatikana.');
        }
      } catch (e: any) {
        setError(e.message || 'Hitilafu ya mtandao.');
      } finally {
        setLoading(false);
      }
    }
    if (memberNoOrPhone) {
      loadProfile();
    }
  }, [memberNoOrPhone]);

  const monthNamesSw = ['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-medium text-slate-400">Inapakia taarifa za mwanachama wa UWALEMI...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold">Taarifa Hazikupatikana</h2>
        <p className="text-sm text-slate-400 mt-1 max-w-sm">
          Namba ya mwanachama "{memberNoOrPhone}" haijasajiliwa kwenye daftari la UWALEMI.
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-6 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
          >
            Rudi Nyuma
          </button>
        )}
      </div>
    );
  }

  const { member, groupSettings, monthlyPayments, emergencyContributions, upcomingMeetings } = data;

  const totalFeesPaid = monthlyPayments.reduce((s, p) => s + (Number(p.paidAmount) || 0), 0);
  const totalEmergencyPaid = emergencyContributions.reduce((s, emg) => s + (Number(emg.totalPaid) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8" id="uwalemi-member-portal">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Top Nav */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm uppercase tracking-wider text-emerald-400">
              {groupSettings?.groupName || 'UWALEMI'} Member Portal
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Rudi Kwenye Dashibodi
            </button>
          )}
        </div>

        {/* Digital Member Card */}
        <div className="bg-gradient-to-br from-emerald-900/80 via-slate-900 to-teal-950 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-1 border border-emerald-500/30">
                <Award className="w-3 h-3" />
                Mjumbe Rasmi
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{member.fullName}</h1>
              <div className="text-xs text-emerald-400 font-semibold">{member.role}</div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Namba ya Mjumbe</span>
              <span className="text-lg sm:text-xl font-black font-mono text-emerald-300">{member.memberNo}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-4 border-t border-emerald-500/20">
            <div>
              <span className="text-[10px] text-slate-400 block">Simu</span>
              <span className="font-semibold text-slate-200">{member.phone}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Makazi</span>
              <span className="font-semibold text-slate-200">{member.residence || 'Dar es Salaam'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Mtu wa Karibu</span>
              <span className="font-semibold text-slate-200">{member.nextOfKin?.name || '-'} ({member.nextOfKin?.relation})</span>
            </div>
          </div>
        </div>

        {/* Member Financial Totals */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] text-slate-400 block">Ada za Mwezi Zilizolipwa</span>
            <span className="text-xl font-bold text-emerald-400 font-mono mt-0.5 block">
              TZS {totalFeesPaid.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">{monthlyPayments.length} miezi imerekodiwa</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] text-slate-400 block">Michango ya Dharura & Misiba</span>
            <span className="text-xl font-bold text-rose-400 font-mono mt-0.5 block">
              TZS {totalEmergencyPaid.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">{emergencyContributions.length} kampeni za ustawi</span>
          </div>
        </div>

        {/* Payment Methods / Lipa Namba */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-400" />
            Njia za Malipo ya Ada & Michango
          </h3>

          <div className="space-y-2">
            {(groupSettings?.paymentMethods || []).map((pm: any, idx: number) => (
              <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white">{pm.provider} ({pm.type})</div>
                  <div className="text-[11px] text-slate-400">Jina: {pm.accountName}</div>
                </div>
                <div className="text-right font-mono font-bold text-amber-400 text-sm">
                  {pm.number}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Fee Records */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            Kumbukumbu za Ada za Kila Mwezi
          </h3>

          {monthlyPayments.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Hakuna malipo ya ada yaliyorekodiwa bado.</p>
          ) : (
            <div className="divide-y divide-slate-800/60 text-xs">
              {monthlyPayments.map((p: any) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">Ada ya {monthNamesSw[p.month - 1]} {p.year}</div>
                    <div className="text-[10px] text-slate-400">{p.paymentDate} • {p.paymentMethod}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-emerald-400">TZS {p.paidAmount.toLocaleString()}</div>
                    <div className="text-[10px] font-mono text-slate-500">{p.receiptNo}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Emergency Funds Status */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-rose-400" />
            Michango ya Dharura & Misiba
          </h3>

          {emergencyContributions.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Hakuna kampeni za dharura kwa sasa.</p>
          ) : (
            <div className="space-y-2.5 text-xs">
              {emergencyContributions.map((emg: any) => (
                <div key={emg.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{emg.title}</div>
                    <div className="text-[10px] text-slate-400">Lengo la Mjumbe: TZS {(emg.perMemberTarget || 20000).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono font-bold ${emg.totalPaid >= (emg.perMemberTarget || 20000) ? 'text-emerald-400' : 'text-amber-400'}`}>
                      TZS {emg.totalPaid.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {emg.totalPaid >= (emg.perMemberTarget || 20000) ? '✓ Imekamilika' : 'Bado unadaiwa'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Meetings */}
        {upcomingMeetings && upcomingMeetings.length > 0 && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              Taarifa ya Kikao Kijacho
            </h3>

            {upcomingMeetings.map((mtg: any) => (
              <div key={mtg.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-white">{mtg.title}</div>
                <div className="text-slate-400 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" /> {mtg.date} ({mtg.time})
                </div>
                <div className="text-slate-400 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" /> {mtg.location}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer & Print */}
        <div className="text-center pt-4 pb-8 space-y-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold border border-slate-800 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Chapisha / Hifadhi Taarifa Yangu (PDF)
          </button>
          <p className="text-[11px] text-slate-500">
            {groupSettings?.groupName || 'UWALEMI'} • Kusaidiana Katika Shida na Raha
          </p>
        </div>
      </div>
    </div>
  );
};
