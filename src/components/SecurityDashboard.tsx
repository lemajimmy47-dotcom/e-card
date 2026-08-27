import React, { useState, useEffect } from 'react';
import { ShieldAlert, Server, ShieldCheck, Activity, RefreshCcw } from 'lucide-react';

interface SecurityDashboardProps {
  language: string;
}

export default function SecurityDashboard({ language }: SecurityDashboardProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login-logs');
      const data = await res.json();
      if (Array.isArray(data)) {
        setLogs(data);
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-red-500" />
            {language === 'sw' ? 'Dashibodi ya Ulinzi (Security Dashboard)' : 'Security Dashboard'}
          </h2>
          <p className="text-slate-400 mt-2 text-sm max-w-xl">
            {language === 'sw' 
               ? 'Fuatilia logi za waliojaribu kuingia kwenye mfumo wa EVENT_CARD na IP zao, ili kugundua majaribio ya udukuzi.' 
               : 'Monitor login attempts to the EVENT_CARD system and their IP addresses to detect potential hacking attempts.'}
          </p>
        </div>
        <button 
          onClick={fetchLogs}
          disabled={isLoading}
          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-3 flex border border-red-500/20 rounded-xl transition disabled:opacity-50"
        >
          <RefreshCcw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-[#0b1328]/80 backdrop-blur-xl border border-red-500/20 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(239,68,68,0.1)] relative">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <ShieldAlert className="w-48 h-48 text-red-500" />
        </div>
        
        <div className="p-6 relative z-10">
          {isLoading ? (
             <div className="flex flex-col items-center justify-center p-12">
               <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500 mb-4"></div>
               <p className="text-xs text-slate-400 animate-pulse uppercase tracking-widest">{language === 'sw' ? 'Inapakia Logi...' : 'Loading logs...'}</p>
             </div>
          ) : logs.length === 0 ? (
             <div className="text-center py-20 px-6">
               <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-4" />
               <p className="text-slate-300 font-bold mb-2">{language === 'sw' ? 'Hakuna Majaribio Yoyote' : 'No Login Attempts Found'}</p>
               <p className="text-xs text-slate-500">{language === 'sw' ? 'Mfumo haujarekodi jaribio lolote la kuingia hivi karibuni.' : 'No recent login attempts recorded.'}</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-red-500/20 text-xs uppercase tracking-wider text-slate-400 font-extrabold pb-3">
                    <th className="py-4 px-4 whitespace-nowrap">{language === 'sw' ? 'Muda (Time)' : 'Time'}</th>
                    <th className="py-4 px-4 whitespace-nowrap">{language === 'sw' ? 'Jina la Mtumiaji' : 'Username Attempt'}</th>
                    <th className="py-4 px-4 whitespace-nowrap">{language === 'sw' ? 'IP Address' : 'IP Address'}</th>
                    <th className="py-4 px-4 whitespace-nowrap">{language === 'sw' ? 'Hali (Status)' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-white/5">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-white font-bold whitespace-nowrap">
                        {log.username}
                      </td>
                      <td className="py-4 px-4 text-slate-400 font-mono text-[10px] whitespace-nowrap flex items-center gap-1.5">
                        <Server className="w-3 h-3 translate-y-[-1px] text-red-400/70" />
                        {log.ipAddress}
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        {log.success ? (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase">
                            {language === 'sw' ? 'Imekubaliwa' : 'Success'}
                          </span>
                        ) : (
                          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase">
                            {language === 'sw' ? 'Imekataliwa' : 'Failed'}
                          </span>
                        )}
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
