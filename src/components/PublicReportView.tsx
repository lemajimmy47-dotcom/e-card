import React, { useState } from 'react';
import { EventDetails, Guest } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Legend } from 'recharts';
import { 
  Download, FileText, CheckCircle, AlertTriangle, TrendingUp, DollarSign, Users, Calendar
} from 'lucide-react';
import { ReportWatermark } from './ReportWatermark';

interface PublicReportViewProps {
  event: EventDetails;
  guests: Guest[];
}

export default function PublicReportView({ event, guests }: PublicReportViewProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  const [selectedReport, setSelectedReport] = useState<string>('Summary');

  // Calculations
  const fundraisingTarget = event.fundraisingGoal || 15000000;
  
  const totalPledged = guests.reduce((sum, g) => sum + (Number(g.pledgeAmount) || 0), 0);
  const totalPaid = guests.reduce((sum, g) => sum + (Number(g.paidAmount) || 0), 0);
  const totalOutstanding = totalPledged - totalPaid;

  const percentagePledged = Math.min(100, (totalPledged / fundraisingTarget) * 100);
  const percentageCollected = Math.min(100, (totalPaid / fundraisingTarget) * 100);
  const percentageOfPledgesCollected = totalPledged > 0 ? Math.min(100, (totalPaid / totalPledged) * 100) : 0;

  const activePledgeList = guests.filter(g => (Number(g.pledgeAmount) || 0) > 0 || (Number(g.paidAmount) || 0) > 0);
  const fullyPaidList = activePledgeList.filter(g => (Number(g.paidAmount) || 0) >= (Number(g.pledgeAmount) || 0));
  const partialPaidList = activePledgeList.filter(g => (Number(g.paidAmount) || 0) > 0 && (Number(g.paidAmount) || 0) < (Number(g.pledgeAmount) || 0));
  const noPaymentPledgeList = activePledgeList.filter(g => (Number(g.pledgeAmount) || 0) > 0 && (Number(g.paidAmount) || 0) === 0);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount) + ' TZS';
  };

  const reports = [
    { id: 'Summary', name: isEn ? '1. Progress & Summary' : '1. Muhtasari wa Makusanyo' },
    { id: 'Collection', name: isEn ? '2. Collections Log' : '2. Ripoti ya Makusanyo' },
    { id: 'FullyPaid', name: isEn ? '3. Fully Paid' : '3. Waliolipa Yote' },
    { id: 'Outstanding', name: isEn ? '4. Outstanding Pledges' : '4. Wanaodaiwa (Madeni)' }
  ];

  return (
    <div className="min-h-screen bg-[#050b18] text-white p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white/[0.02] border border-white/10 rounded-[2rem] p-8">
          <div>
            <h1 className="text-3xl font-black uppercase text-white tracking-wider">{event.name || 'Event Report'}</h1>
            <div className="flex items-center gap-4 mt-2 text-slate-400 text-sm font-mono">
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {event.date}</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {guests.length} Guests</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl text-center">
               <p className="text-[10px] text-emerald-400 font-bold uppercase">{isEn ? 'Collected' : 'Zilizokusanywa'}</p>
               <p className="text-xl font-black text-white">{formatMoney(totalPaid)}</p>
             </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap gap-2">
          {reports.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedReport(r.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                selectedReport === r.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white text-slate-900 rounded-[2rem] p-6 sm:p-10 shadow-2xl relative min-h-[500px]">
          <ReportWatermark />
          
          <div className="relative z-10">
            {selectedReport === 'Summary' && (
              <div className="space-y-8">
                <div className="text-center border-b border-slate-200 pb-6">
                  <h2 className="text-2xl font-black uppercase tracking-widest">{isEn ? 'Contributions Summary' : 'Muhtasari wa Makusanyo'}</h2>
                  <p className="text-sm text-slate-500 mt-2">{event.name} • {new Date().toLocaleDateString()}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-center">
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">{isEn ? 'Target Goal' : 'Lengo la Makusanyo'}</p>
                    <p className="text-xl font-black text-slate-900">{formatMoney(fundraisingTarget)}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center">
                    <p className="text-xs text-emerald-600 font-bold uppercase mb-1">{isEn ? 'Total Collected' : 'Jumla Iliyokusanywa'}</p>
                    <p className="text-2xl font-black text-emerald-700">{formatMoney(totalPaid)}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center">
                    <p className="text-xs text-amber-600 font-bold uppercase mb-1">{isEn ? 'Outstanding Pledges' : 'Ahadi Zinazodaiwa'}</p>
                    <p className="text-xl font-black text-amber-700">{formatMoney(totalOutstanding)}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-sm uppercase text-slate-400">{isEn ? 'Progress' : 'Maendeleo'}</h3>
                  <div className="w-full bg-slate-100 h-6 rounded-full overflow-hidden relative">
                    <div 
                      className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-1000"
                      style={{ width: `${percentagePledged}%` }}
                    />
                    <div 
                      className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-1000"
                      style={{ width: `${percentageCollected}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span className="text-emerald-600">{percentageCollected.toFixed(1)}% {isEn ? 'Collected' : 'Imekusanywa'}</span>
                    <span className="text-blue-600">{percentagePledged.toFixed(1)}% {isEn ? 'Pledged' : 'Imeahidiwa'}</span>
                  </div>
                </div>
              </div>
            )}

            {selectedReport === 'Collection' && (
              <div className="space-y-6">
                <h2 className="text-xl font-black uppercase text-center">{isEn ? 'Collections Log' : 'Log ya Makusanyo'}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="py-3 px-4 uppercase font-bold text-slate-500 text-center w-12">Na.</th>
                        <th className="py-3 px-4 uppercase font-bold text-slate-500">Jina</th>
                        <th className="py-3 px-4 uppercase font-bold text-slate-500 text-right">Ahadi (TZS)</th>
                        <th className="py-3 px-4 uppercase font-bold text-emerald-600 text-right">Imelipwa (TZS)</th>
                        <th className="py-3 px-4 uppercase font-bold text-amber-600 text-right">Baki (TZS)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePledgeList.map((g, idx) => {
                         const pledge = Number(g.pledgeAmount) || 0;
                         const paid = Number(g.paidAmount) || 0;
                         return (
                           <tr key={g.id} className="border-b border-slate-100 hover:bg-slate-50">
                             <td className="py-3 px-4 font-mono text-slate-400 text-center font-bold text-xs">{idx + 1}</td>
                             <td className="py-3 px-4 font-medium">{g.name}</td>
                             <td className="py-3 px-4 text-right font-mono">{pledge > 0 ? formatMoney(pledge) : '-'}</td>
                             <td className="py-3 px-4 text-right font-mono text-emerald-600 font-bold">{paid > 0 ? formatMoney(paid) : '-'}</td>
                             <td className="py-3 px-4 text-right font-mono text-amber-600">{pledge - paid > 0 ? formatMoney(pledge - paid) : '-'}</td>
                           </tr>
                         );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedReport === 'FullyPaid' && (
              <div className="space-y-6">
                <h2 className="text-xl font-black uppercase text-center">{isEn ? 'Fully Paid' : 'Waliolipa Kikamilifu'}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="py-3 px-4 uppercase font-bold text-slate-500 text-center w-12">Na.</th>
                        <th className="py-3 px-4 uppercase font-bold text-slate-500">Jina</th>
                        <th className="py-3 px-4 uppercase font-bold text-emerald-600 text-right">Kiasi (TZS)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fullyPaidList.map((g, idx) => (
                        <tr key={g.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono text-slate-400 text-center font-bold text-xs">{idx + 1}</td>
                          <td className="py-3 px-4 font-medium flex items-center gap-2">
                             <CheckCircle className="w-4 h-4 text-emerald-500" />
                             {g.name}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-600 font-bold">{formatMoney(Number(g.paidAmount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedReport === 'Outstanding' && (
              <div className="space-y-6">
                <h2 className="text-xl font-black uppercase text-center">{isEn ? 'Outstanding Pledges' : 'Wanaodaiwa'}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="py-3 px-4 uppercase font-bold text-slate-500 text-center w-12">Na.</th>
                        <th className="py-3 px-4 uppercase font-bold text-slate-500">Jina</th>
                        <th className="py-3 px-4 uppercase font-bold text-slate-500 text-right">Ahadi (TZS)</th>
                        <th className="py-3 px-4 uppercase font-bold text-emerald-600 text-right">Imelipwa (TZS)</th>
                        <th className="py-3 px-4 uppercase font-bold text-rose-600 text-right">Deni (TZS)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...partialPaidList, ...noPaymentPledgeList].map((g, idx) => {
                         const pledge = Number(g.pledgeAmount) || 0;
                         const paid = Number(g.paidAmount) || 0;
                         return (
                           <tr key={g.id} className="border-b border-slate-100 hover:bg-slate-50">
                             <td className="py-3 px-4 font-mono text-slate-400 text-center font-bold text-xs">{idx + 1}</td>
                             <td className="py-3 px-4 font-medium">{g.name}</td>
                             <td className="py-3 px-4 text-right font-mono">{formatMoney(pledge)}</td>
                             <td className="py-3 px-4 text-right font-mono text-emerald-600">{paid > 0 ? formatMoney(paid) : '-'}</td>
                             <td className="py-3 px-4 text-right font-mono text-rose-600 font-bold">{formatMoney(pledge - paid)}</td>
                           </tr>
                         );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
