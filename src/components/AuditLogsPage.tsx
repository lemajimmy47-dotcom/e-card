import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Database, Server, RefreshCcw } from 'lucide-react';
import { AppAuditLog } from '../types';

interface AuditLogsPageProps {
  language: string;
}

export default function AuditLogsPage({ language }: AuditLogsPageProps) {
  const [logs, setLogs] = useState<AppAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      if (data && Array.isArray(data.auditLogs)) {
        setLogs(data.auditLogs);
      } else {
        setLogs([]);
      }
    } catch (e) {
      console.error("Failed to fetch logs:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-500" />
            {language === 'sw' ? 'Mabadiliko ya Mfumo (Audit Logs)' : 'Audit Logs & Security'}
          </h2>
          <p className="text-slate-400 mt-2 text-sm max-w-xl">
            {language === 'sw' 
              ? 'Fuatilia kila badiliko lililofanywa kwenye matukio na wageni, ikijumuisha nani, lini, na kutoka IP ipi, kwa ajili ya ulinzi thabiti wa data (Security & Tracking).' 
              : 'Track every modification made to events and guests, including who, when, and from what IP address, for robust data security.'}
          </p>
        </div>
        <button 
          onClick={fetchLogs}
          disabled={isLoading}
          className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 p-3 flex border border-blue-500/20 rounded-xl transition disabled:opacity-50"
        >
          <RefreshCcw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-[#0b1328]/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Database className="w-48 h-48" />
        </div>
        
        <div className="p-6">
          {isLoading ? (
             <div className="flex flex-col items-center justify-center p-12">
               <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
               <p className="text-xs text-slate-400 animate-pulse uppercase tracking-widest">{language === 'sw' ? 'Inapakia Logi...' : 'Loading logs...'}</p>
             </div>
          ) : logs.length === 0 ? (
             <div className="text-center py-20 px-6">
               <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
               <p className="text-slate-300 font-bold mb-2">{language === 'sw' ? 'Hakuna Mabadiliko Yoyote' : 'No Audit Logs Found'}</p>
               <p className="text-xs text-slate-500">{language === 'sw' ? 'Anza kutumia mfumo ili kurekodi matukio.' : 'Start using the system to record events.'}</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-450 font-extrabold pb-3">
                    <th className="py-4 px-4 whitespace-nowrap">{language === 'sw' ? 'Muda (Time)' : 'Time'}</th>
                    <th className="py-4 px-4 whitespace-nowrap">{language === 'sw' ? 'Mtumiaji (User)' : 'User'}</th>
                    <th className="py-4 px-4 whitespace-nowrap">{language === 'sw' ? 'Kitendo (Action)' : 'Action'}</th>
                    <th className="py-4 px-4 whitespace-nowrap">{language === 'sw' ? 'Maelezo (Details)' : 'Details'}</th>
                    <th className="py-4 px-4 whitespace-nowrap">{language === 'sw' ? 'IP Address' : 'IP Address'}</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-white/5">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-white font-bold whitespace-nowrap">
                        {log.user}
                      </td>
                      <td className="py-4 px-4 text-blue-400 font-semibold whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="py-4 px-4 text-slate-400 max-w-xs truncate" title={log.details}>
                        {log.details}
                      </td>
                      <td className="py-4 px-4 text-slate-500 font-mono text-[10px] whitespace-nowrap flex items-center gap-1.5">
                        <Server className="w-3 h-3 translate-y-[-1px]" />
                        {log.ipAddress || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
