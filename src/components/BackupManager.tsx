import React, { useState, useRef } from 'react';
import { Database, Download, UploadCloud, FileJson, CheckCircle, AlertTriangle, RefreshCw, X, FileUp, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useEventCard } from '../context/EventCardContext';
import { EventDetails, Guest } from '../types';

interface BackupManagerProps {
  eventDetails: EventDetails | null;
  eventsList: EventDetails[];
  guests: Guest[];
}

interface BackupPreview {
  events: EventDetails[];
  guests: Guest[];
  activeEvent: EventDetails | null;
  templateSettings?: any;
  userAccount?: any;
  exportedAt?: string;
  version?: string;
  sourceAppName?: string;
}

export default function BackupManager({ eventDetails, eventsList, guests }: BackupManagerProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const { saveState, refreshState, setEventDetails, setEventsList, setGuests } = useEventCard();

  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<BackupPreview | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');

  const fileInputRef = useRef<HTMLInputElement>(null);

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

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (error) {
      console.error('Error generating backup:', error);
      setErrorMessage(isEn ? 'Failed to generate backup file.' : 'Imeshindwa kutengeneza faili la nakala ya dharura.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processBackupFile(file);
    // Reset the input value so selecting the same file again triggers onChange
    e.target.value = '';
  };

  const processBackupFile = (file: File) => {
    setErrorMessage(null);
    setRestoreSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object') {
          throw new Error(isEn ? 'Invalid JSON file format.' : 'Faili halina muundo sahihi wa JSON.');
        }

        // Handle various JSON backup structures
        let extractedEvents: EventDetails[] = [];
        let extractedGuests: Guest[] = [];
        let extractedActiveEvent: EventDetails | null = null;
        let extractedTemplateSettings: any = parsed.templateSettings || null;
        let extractedUserAccount: any = parsed.userAccount || null;

        if (Array.isArray(parsed.allEvents)) {
          extractedEvents = parsed.allEvents;
        } else if (Array.isArray(parsed.eventsList)) {
          extractedEvents = parsed.eventsList;
        } else if (Array.isArray(parsed.events)) {
          extractedEvents = parsed.events;
        } else if (parsed.activeEvent && parsed.activeEvent.id) {
          extractedEvents = [parsed.activeEvent];
        }

        if (Array.isArray(parsed.guests)) {
          extractedGuests = parsed.guests;
        }

        if (parsed.activeEvent && parsed.activeEvent.name) {
          extractedActiveEvent = parsed.activeEvent;
        } else if (extractedEvents.length > 0) {
          extractedActiveEvent = extractedEvents[0];
        }

        // Validate that we found meaningful data
        if (extractedEvents.length === 0 && extractedGuests.length === 0) {
          throw new Error(
            isEn 
              ? 'The selected backup file does not contain any recognizable event or guest records.' 
              : 'Faili halina rekodi zozote za matukio au wageni zinazotambulika.'
          );
        }

        setPreviewData({
          events: extractedEvents,
          guests: extractedGuests,
          activeEvent: extractedActiveEvent,
          templateSettings: extractedTemplateSettings,
          userAccount: extractedUserAccount,
          exportedAt: parsed.exportedAt,
          version: parsed.version || '1.0',
          sourceAppName: parsed.appName || 'EVENTCARD'
        });
      } catch (err: any) {
        console.error('Failed to parse backup:', err);
        setErrorMessage(err.message || (isEn ? 'Could not read backup file.' : 'Imeshindwa kusoma faili la backup.'));
      }
    };

    reader.onerror = () => {
      setErrorMessage(isEn ? 'Error reading file from disk.' : 'Hitilafu imetokea wakati wa kusoma faili.');
    };

    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!previewData) return;

    setIsRestoring(true);
    setErrorMessage(null);
    setRestoreSuccess(null);

    try {
      let finalEventsList: EventDetails[] = [];
      let finalGuests: Guest[] = [];
      let finalActiveEvent: EventDetails | null = eventDetails;

      if (restoreMode === 'replace') {
        // Full replace
        finalEventsList = previewData.events.length > 0 ? previewData.events : eventsList;
        finalGuests = previewData.guests.length > 0 ? previewData.guests : guests;
        if (previewData.activeEvent) {
          finalActiveEvent = previewData.activeEvent;
        } else if (finalEventsList.length > 0) {
          finalActiveEvent = finalEventsList[0];
        }
      } else {
        // Merge mode: combine without duplicates
        const existingEventMap = new Map(eventsList.map(e => [e.id, e]));
        previewData.events.forEach(e => existingEventMap.set(e.id, e));
        finalEventsList = Array.from(existingEventMap.values());

        const existingGuestMap = new Map(guests.map(g => [g.id, g]));
        previewData.guests.forEach(g => existingGuestMap.set(g.id, g));
        finalGuests = Array.from(existingGuestMap.values());

        if (previewData.activeEvent) {
          finalActiveEvent = previewData.activeEvent;
        }
      }

      // Prepare state update payload
      const updates: any = {
        eventsList: finalEventsList,
        guests: finalGuests,
      };

      if (finalActiveEvent) {
        updates.eventDetails = finalActiveEvent;
      }
      if (previewData.templateSettings) {
        updates.templateSettings = previewData.templateSettings;
      }

      // Update local Context immediately for instant UI response
      setEventsList(finalEventsList);
      setGuests(finalGuests);
      if (finalActiveEvent) {
        setEventDetails(finalActiveEvent);
      }

      // Save to CloudSQL / Backend server state
      await saveState(
        updates,
        'Backup Restored',
        `Restored ${finalEventsList.length} events and ${finalGuests.length} guests via JSON Restore (${restoreMode} mode)`
      );

      await refreshState();

      const successMsg = isEn 
        ? `Successfully restored ${finalEventsList.length} ceremonies and ${finalGuests.length} guests!`
        : `Nakala imerejeshwa kwa mafanikio! Matukio: ${finalEventsList.length}, Wageni: ${finalGuests.length}.`;

      setRestoreSuccess(successMsg);
      setPreviewData(null);
      setTimeout(() => setRestoreSuccess(null), 6000);
    } catch (err: any) {
      console.error('Error executing restore:', err);
      setErrorMessage(
        err.message || (isEn ? 'Failed to restore backup data.' : 'Imeshindwa kurejesha taarifa za backup.')
      );
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div id="backup-manager-card" className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-5 space-y-5 max-w-xl h-full flex flex-col justify-between shadow-2xl">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-400" />
            {isEn ? "Data Backup & Restore (JSON)" : "Hifadhi & Urejeshaji wa Data (Backup & Restore)"}
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
            v1.0 JSON
          </span>
        </div>

        <p className="text-[11.5px] text-slate-300 leading-relaxed">
          {isEn 
            ? "Safeguard your entire celebration by exporting a full offline backup, or restore previously saved event configurations, settings, and guest lists anytime." 
            : "Pakua nakala kamili ya dharura ya mipangilio ya matukio na wageni wote, au rejesha faili la awali pindi unapobadili kifaa au kutaka kurejesha taarifa zilizopita."}
        </p>

        {/* Current Database Summary */}
        <div className="grid grid-cols-2 gap-3 bg-black/30 p-3.5 rounded-xl border border-white/5">
          <div className="space-y-0.5">
            <span className="text-[9.5px] text-slate-400 uppercase font-semibold tracking-wider">
              {isEn ? "Ceremonies" : "Matukio (Ceremonies)"}
            </span>
            <p className="text-lg font-bold text-white font-mono">{eventsList.length}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[9.5px] text-slate-400 uppercase font-semibold tracking-wider">
              {isEn ? "Guest Profiles" : "Wageni Wote (Guests)"}
            </span>
            <p className="text-lg font-bold text-white font-mono">{guests.length}</p>
          </div>
          <div className="col-span-2 border-t border-white/5 pt-2.5 mt-1 space-y-0.5">
            <span className="text-[9.5px] text-slate-400 uppercase font-semibold tracking-wider">
              {isEn ? "Active Event" : "Tukio Linalosimamiwa"}
            </span>
            <p className="text-xs font-bold text-blue-300 truncate font-mono">
              {eventDetails ? eventDetails.name : (isEn ? "None Selected" : "Hakuna tukio")}
            </p>
          </div>
        </div>

        {/* Success Banner */}
        {restoreSuccess && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-3.5 flex items-center gap-3 text-emerald-300 text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium leading-normal">{restoreSuccess}</span>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3 text-rose-300 text-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setErrorMessage(null)} 
              className="text-rose-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Restore Preview Modal / Section */}
        {previewData && (
          <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-4 space-y-3.5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  {isEn ? "Backup Verification & Preview" : "Uhakiki wa Faili la Backup"}
                </h4>
              </div>
              <button 
                type="button"
                onClick={() => setPreviewData(null)}
                className="text-slate-400 hover:text-white text-xs p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] bg-black/20 p-2.5 rounded-lg border border-white/5">
              <div>
                <span className="text-slate-400 text-[10px] block">{isEn ? "Ceremonies Found:" : "Matukio Yaliyomo:"}</span>
                <strong className="text-emerald-400 font-mono text-sm">{previewData.events.length}</strong>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">{isEn ? "Guests Found:" : "Wageni Waliomo:"}</span>
                <strong className="text-emerald-400 font-mono text-sm">{previewData.guests.length}</strong>
              </div>
              <div className="col-span-2 pt-1 border-t border-white/5">
                <span className="text-slate-400 text-[10px] block">{isEn ? "Active Ceremony:" : "Sherehe Kuu:"}</span>
                <span className="text-slate-200 font-medium truncate block">
                  {previewData.activeEvent?.name || (isEn ? "Standard Database" : "Database ya Kawaida")}
                </span>
              </div>
              {previewData.exportedAt && (
                <div className="col-span-2 text-[9.5px] text-slate-400">
                  {isEn ? "Created on: " : "Ilitengenezwa: "}
                  {new Date(previewData.exportedAt).toLocaleString(isEn ? 'en-US' : 'sw-TZ')}
                </div>
              )}
            </div>

            {/* Restore Strategy Switcher */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-300 font-semibold uppercase tracking-wider block">
                {isEn ? "Restoration Method:" : "Njia ya Kurejesha:"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRestoreMode('merge')}
                  className={`px-3 py-2 rounded-lg text-[10.5px] font-medium border text-left transition ${
                    restoreMode === 'merge'
                      ? 'bg-blue-600/30 border-blue-400 text-white font-bold'
                      : 'bg-black/20 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold">{isEn ? "Merge (Safe)" : "Unganisha (Merge)"}</div>
                  <div className="text-[9px] opacity-80">{isEn ? "Keep current & add new" : "Hifadhi vilivyopo & ongeza vipya"}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRestoreMode('replace')}
                  className={`px-3 py-2 rounded-lg text-[10.5px] font-medium border text-left transition ${
                    restoreMode === 'replace'
                      ? 'bg-amber-600/30 border-amber-400 text-white font-bold'
                      : 'bg-black/20 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold">{isEn ? "Overwrite" : "Badilisha Kamili"}</div>
                  <div className="text-[9px] opacity-80">{isEn ? "Replace all with backup" : "Weka vya backup pekee"}</div>
                </button>
              </div>
            </div>

            {/* Actions for Restore */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleConfirmRestore}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50 cursor-pointer"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {isEn ? "Restoring Data..." : "Inarejesha Data..."}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    {isEn ? "Confirm & Restore Now" : "Thibitisha na Urejeshe Sasa"}
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isRestoring}
                onClick={() => setPreviewData(null)}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                {isEn ? "Cancel" : "Ghairi"}
              </button>
            </div>
          </div>
        )}

        {/* Specification Note */}
        {!previewData && (
          <div className="bg-blue-900/15 border border-blue-500/20 rounded-xl p-3 flex items-start gap-2.5">
            <FileJson className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                {isEn ? "Format Specification & Compatibility" : "Muundo na Usalama wa Faili"}
              </h4>
              <p className="text-[9.5px] text-slate-300 leading-normal">
                {isEn
                  ? "Standardized JSON format containing ceremony details, seating charts, and guest registries for instant one-click recovery."
                  : "Faili la JSON lililohakikiwa lenye orodha kamili ya sherehe, namba za viti vya wageni, na michango kwa ajili ya kurejeshwa kwa mguso mmoja."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons: Export & Restore */}
      {!previewData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Download / Export Button */}
          <button
            type="button"
            onClick={handleExportBackup}
            className={`py-3 px-4 rounded-xl font-bold uppercase tracking-wider text-[11px] transition duration-200 flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
              downloadSuccess 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
            }`}
          >
            {downloadSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 animate-bounce" />
                {isEn ? "Backup Downloaded!" : "Imepakuliwa!"}
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                {isEn ? "Export (Download JSON)" : "Pakua Nakala (JSON)"}
              </>
            )}
          </button>

          {/* Upload / Restore Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="py-3 px-4 rounded-xl font-bold uppercase tracking-wider text-[11px] transition duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/20 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            {isEn ? "Restore Backup (JSON)" : "Rejesha Nakala (Restore)"}
          </button>
        </div>
      )}
    </div>
  );
}

