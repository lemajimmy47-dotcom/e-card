import React, { useState } from 'react';
import { Sparkles, FileText, Check, Copy, RefreshCw, Feather, BookOpen, Send, Layout } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { EventDetails } from '../types';

interface AICardCopywriterProps {
  event: EventDetails;
  onApplyCopy?: (invitationText: string, smsText: string) => void;
  onClose?: () => void;
}

export default function AICardCopywriter({ event, onApplyCopy, onClose }: AICardCopywriterProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  const [eventType, setEventType] = useState(event.name?.toLowerCase().includes('send-off') ? 'Send-Off' : event.name?.toLowerCase().includes('birthday') ? 'Birthday' : 'Harusi');
  const [tone, setTone] = useState('Mashairi ya Kiswahili chenye Vina');
  const [hostName, setHostName] = useState(event.hostName || 'Familia ya Mwenyeji');
  const [eventName, setEventName] = useState(event.name || 'Sherehe ya Harusi');
  const [date, setDate] = useState(event.date || '2026-08-08');
  const [venue, setVenue] = useState(event.eventHallName || 'Mlimani City Complex');
  const [dressCode, setDressCode] = useState(event.dressCode || 'Royal Blue & Emerald Green');
  const [customWishes, setCustomWishes] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [copyOptions, setCopyOptions] = useState<any[]>([]);
  const [appliedOptionId, setAppliedOptionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setAppliedOptionId(null);
    try {
      const res = await fetch('/api/ai/card-copywriting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          tone,
          hostName,
          eventName,
          date,
          venue,
          dressCode,
          customWishes
        })
      });

      const data = await res.json();
      if (data.success && data.options) {
        setCopyOptions(data.options);
      }
    } catch (e) {
      console.error("AI Copywriting failed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = (opt: any) => {
    setAppliedOptionId(opt.id);
    if (onApplyCopy) {
      onApplyCopy(opt.invitationText, opt.smsText);
    }
  };

  const handleCopyText = (opt: any) => {
    navigator.clipboard.writeText(`${opt.invitationText}\n\n${opt.smsText}`);
    setCopiedId(opt.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 text-white space-y-6 shadow-2xl relative overflow-hidden" id="ai-card-copywriter-card">
      {/* Background glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
            <Feather className="w-5 h-5 text-amber-200" />
          </div>
          <div>
            <h3 className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
              <span>{isEn ? "AI Creative Card Copywriting" : "Uandishi wa Mashairi na Maneno ya Mwaliko kwa AI"}</span>
              <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9px] font-mono px-2 py-0.5 rounded-full uppercase">
                EVENTCARD AI
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {isEn
                ? "Generate captivating Kiswahili poetry & professional invitation copy tailored to your ceremony."
                : "Tengeneza mashairi matamu ya Kiswahili na maneno ya mwaliko yenye vionjo kwa kutumia Gemini AI."}
            </p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xs font-mono">✕ Close</button>
        )}
      </div>

      {/* Controls Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 border border-white/10 p-4 sm:p-5 rounded-2xl">
        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
            {isEn ? "Ceremony Type" : "Aina ya Sherehe"}
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="Harusi">Harusi (Wedding)</option>
            <option value="Send-Off">Send-Off / Kitchen Party</option>
            <option value="Birthday">Kumbukumbu ya Kuzaliwa (Birthday)</option>
            <option value="Kumbukumbu">Kumbukumbu / Jubilee</option>
            <option value="Kipaimara">Kipaimara / Graduation</option>
            <option value="Arobaini">Arobaini / Sherehe ya Mtoto</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
            {isEn ? "Style & Tone" : "Mitindo & Tone ya Lugha"}
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="Mashairi ya Kiswahili chenye Vina">Mashairi ya Kiswahili (Yenye Vina)</option>
            <option value="Ujumbe wa Kifamilia na Kiroho">Kifamilia & Kiroho / Baraka</option>
            <option value="Ujumbe Mfupi Rasmi na wa Kisasa">Rasmi / Modern & Diplomatic</option>
            <option value="Lugha ya Kiislamu">Kiislamu (Yenye Dua na Bismillah)</option>
            <option value="Lugha ya Kikristo">Kikristo (Yenye Aya za Biblia na Baraka)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
            {isEn ? "Hosts / Family Name" : "Waandaji / Jina la Familia"}
          </label>
          <input
            type="text"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            placeholder="mf. Familia ya Bw. na Bi. Lema"
            className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
            {isEn ? "Event Name / Couple" : "Jina la Sherehe / Maharusi"}
          </label>
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="mf. Harusi ya Jimson na Aisha"
            className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
            {isEn ? "Venue & Date" : "Ukumbi & Tarehe"}
          </label>
          <input
            type="text"
            value={`${venue} (${date})`}
            onChange={(e) => setVenue(e.target.value)}
            className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
            {isEn ? "Dress Code / Custom Wishes" : "Mavazi / Vionjo Maalum"}
          </label>
          <input
            type="text"
            value={customWishes}
            onChange={(e) => setCustomWishes(e.target.value)}
            placeholder="mf. Weka vionjo vya pwani, n.k."
            className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Generate Button */}
      <div className="flex justify-end">
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="px-6 py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
              <span>{isEn ? "Generating AI Verses..." : "AI Inatunga Mashairi..."}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>{isEn ? "Generate Creative Card Copy" : "Tengeneza Mashairi & Maneno kwa AI"}</span>
            </>
          )}
        </button>
      </div>

      {/* Results Grid */}
      {copyOptions.length > 0 && (
        <div className="space-y-4 pt-2 border-t border-white/10">
          <h4 className="font-extrabold text-xs uppercase tracking-wider font-mono text-amber-300 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>{isEn ? "Generated Creative Options:" : "Mashairi na Maneno Yaliyotungwa na AI:"}</span>
          </h4>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {copyOptions.map((opt) => {
              const isApplied = appliedOptionId === opt.id;
              const isCopied = copiedId === opt.id;

              return (
                <div
                  key={opt.id}
                  className={`bg-slate-950/80 border ${isApplied ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-white/10'} rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-lg relative overflow-hidden`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-mono px-2 py-0.5 rounded-md font-bold uppercase">
                        {opt.style}
                      </span>
                      {isApplied && (
                        <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Tumia
                        </span>
                      )}
                    </div>

                    <h5 className="font-bold text-sm text-white">{opt.title}</h5>

                    <div className="bg-slate-900 border border-white/10 p-3 rounded-xl font-sans text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto italic">
                      "{opt.invitationText}"
                    </div>

                    <div className="bg-slate-900/50 border border-white/5 p-2.5 rounded-xl font-mono text-[10px] text-slate-400">
                      <p className="font-bold text-indigo-300 text-[9px] uppercase mb-0.5">Ujumbe wa SMS/WhatsApp:</p>
                      <p className="line-clamp-3">{opt.smsText}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                    <button
                      onClick={() => handleApply(opt)}
                      className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        isApplied 
                          ? 'bg-amber-400 text-slate-950' 
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isApplied ? (isEn ? "Applied!" : "Imetumika Kwenye Kadi!") : (isEn ? "Apply to Card" : "Tumia Kwenye Kadi")}</span>
                    </button>

                    <button
                      onClick={() => handleCopyText(opt)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-white/10"
                      title="Copy"
                    >
                      {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
