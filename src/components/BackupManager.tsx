import React from 'react';
import { Database, Download, FileJson, CheckCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { EventDetails, Guest } from '../types';

interface BackupManagerProps {
  eventDetails: EventDetails | null;
  eventsList: EventDetails[];
  guests: Guest[];
}

export default function BackupManager({ eventDetails, eventsList, guests }: BackupManagerProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const [copied, setCopied] = React.useState(false);

  const handleExportBackup = () => {
    try {
      const backupData = {
        appName: 'EVENTCARD',
        exportedAt: new Date().toISOString(),
        version: '1.0',
        activeEvent: eventDetails,
        allEvents: eventsList,
        guests: guests,
      };

      const dataStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      const eventNameClean = eventDetails 
        ? eventDetails.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
        : 'all-events';
      
      link.href = url;
      link.download = `eventcard-backup-${eventNameClean}-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error('Error generating backup:', error);
      alert(isEn ? 'Failed to generate backup file.' : 'Imeshindwa kutengeneza faili la nakala ya dharura.');
    }
  };

  return (
    <div id="backup-manager-card" className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 max-w-lg h-full flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-400" />
            {isEn ? "Data Backup & Recovery (JSON)" : "Hifadhi ya Ndani ya Data (Backup)"}
          </h3>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          {isEn 
            ? "Download a complete offline copy of your active settings, current event configurations, and uploaded guest logs. You can store this backup file securely on your local computer." 
            : "Pakua nakala kamili ya dharura ya mipangilio yako, taarifa za sherehe, na rasilimali za wageni wote waliopakiwa ili kuilinda dhidi ya upotevu wa data."}
        </p>

        {/* Diagnostic Metadata Stats */}
        <div className="grid grid-cols-2 gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-500 uppercase font-semibold">
              {isEn ? "Ceremonies" : "Matukio (Ceremonies)"}
            </span>
            <p className="text-lg font-bold text-white font-mono">{eventsList.length}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-500 uppercase font-semibold">
              {isEn ? "Guest Profiles" : "Wageni Wote (Guests)"}
            </span>
            <p className="text-lg font-bold text-white font-mono">{guests.length}</p>
          </div>
          <div className="col-span-2 border-t border-white/5 pt-2 mt-1 space-y-0.5">
            <span className="text-[9px] text-slate-500 uppercase font-semibold">
              {isEn ? "Active Event" : "Tukio Linalosimamiwa"}
            </span>
            <p className="text-xs font-bold text-slate-300 truncate font-mono">
              {eventDetails ? eventDetails.name : (isEn ? "None Selected" : "Hakuna tukio")}
            </p>
          </div>
        </div>

        <div className="bg-blue-900/10 border border-blue-500/10 rounded-xl p-3 flex items-start gap-2.5">
          <FileJson className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
              {isEn ? "Format Specification" : "Maelezo ya Muundo"}
            </h4>
            <p className="text-[9.5px] text-slate-400 leading-normal">
              {isEn
                ? "The exports use standardized, human-readable JSON payloads containing full structured arrays of schema databases."
                : "Faili linapakuliwa kama muundo wa JSON uliosimbwa kusanifishwa kamili, tayari kurejeshwa pindi unapolihitaji."}
            </p>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleExportBackup}
          className={`w-full py-3 rounded-xl font-bold uppercase tracking-wider text-[11px] transition duration-200 flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
            copied 
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/10' 
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/10'
          }`}
        >
          {copied ? (
            <>
              <CheckCircle className="w-3.5 h-3.5 animate-bounce" />
              {isEn ? "Backup Completed!" : "Backup Imekamilika!"}
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              {isEn ? "Export Backup (JSON)" : "Pakua Nakala (JSON Backup)"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
