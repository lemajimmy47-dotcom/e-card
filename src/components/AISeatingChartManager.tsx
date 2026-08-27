import React, { useState, useEffect } from 'react';
import { Sparkles, Users, RefreshCw, CheckCircle, Search, Printer, Download, MapPin, Grid, Shield, AlertTriangle, Layers } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { EventDetails, Guest } from '../types';

interface AISeatingChartManagerProps {
  event: EventDetails;
  guests: Guest[];
  onUpdateGuests: (updated: Guest[]) => void;
}

export default function AISeatingChartManager({ event, guests, onUpdateGuests }: AISeatingChartManagerProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  const [capacity, setCapacity] = useState<number>(10);
  const [isLoading, setIsLoading] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch current seating chart on mount or load from guests
  useEffect(() => {
    fetchSeatingChart();
  }, [guests.length]);

  const fetchSeatingChart = async () => {
    try {
      const res = await fetch('/api/ai/seating-chart');
      const data = await res.json();
      if (data.success && data.tables) {
        setTables(data.tables);
      }
    } catch (e) {
      console.error("Failed to load seating chart:", e);
    }
  };

  const handleAutoAssign = async () => {
    setIsLoading(true);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/ai/generate-seating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxCapacityPerTable: capacity
        })
      });

      const data = await res.json();
      if (data.success) {
        setTables(data.tables);
        setSuccessMsg(data.summary || (isEn ? "Seating plan updated successfully!" : "Mpangilio wa meza na viti umekamilika!"));
        
        // Refresh guests from server if needed
        const guestRes = await fetch('/api/guests');
        if (guestRes.ok) {
          const freshGuests = await guestRes.json();
          onUpdateGuests(freshGuests);
        }
      }
    } catch (e) {
      console.error("Error generating seating:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered tables based on search query or category filter
  const filteredTables = tables.map(tbl => {
    const matchingGuests = tbl.guests.filter((g: any) => {
      const matchesSearch = !searchQuery || 
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (g.phone && g.phone.includes(searchQuery));
      const matchesCat = selectedCategory === 'all' || 
        g.category?.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCat;
    });

    return {
      ...tbl,
      filteredGuests: matchingGuests
    };
  }).filter(tbl => searchQuery ? tbl.filteredGuests.length > 0 : true);

  const totalAssigned = guests.filter(g => g.customFields?.tableNumber).length;

  return (
    <div className="space-y-6 text-white font-sans" id="ai-seating-chart-container">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border-2 border-indigo-500/40 p-6 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shrink-0">
            <Grid className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-white tracking-tight">
                {isEn ? "Smart AI Seating Chart & Table Organizer" : "Upangaji wa Viti na Meza Ukumbini (Smart AI Seating)"}
              </h3>
              <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9px] font-mono px-2 py-0.5 rounded-full uppercase">
                EVENTCARD AI
              </span>
            </div>
            <p className="text-xs text-slate-350 mt-1">
              {isEn
                ? "AI groups confirmed guests automatically by RSVP status, contributions, and relationship categories without table conflicts."
                : "AI inatengeneza mpangilio wa meza na viti bila migongano, ikipanga wageni kulingana na makundi yao (Wanafamilia, Wafanyakazi, VVIP, na Marafiki)."}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 self-stretch md:self-auto">
          <div className="flex items-center gap-2 bg-slate-950 border border-white/10 px-3 py-2 rounded-xl text-xs font-mono">
            <span className="text-slate-400">{isEn ? "Seats/Table:" : "Viti/Meza:"}</span>
            <select
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="bg-transparent text-amber-300 font-bold focus:outline-none"
            >
              <option value={6} className="bg-slate-900 text-white">6 Viti</option>
              <option value={8} className="bg-slate-900 text-white">8 Viti</option>
              <option value={10} className="bg-slate-900 text-white">10 Viti</option>
              <option value={12} className="bg-slate-900 text-white">12 Viti</option>
            </select>
          </div>

          <button
            onClick={handleAutoAssign}
            disabled={isLoading}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>{isEn ? "AI Organizing Tables..." : "AI Inapanga Meza..."}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>{isEn ? "Panga Meza kwa AI" : "Panga Meza & Viti kwa AI"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 p-4 rounded-2xl text-emerald-300 text-xs font-mono flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-slate-400 uppercase">{isEn ? "Total Guests" : "Jumla ya Wageni"}</p>
            <p className="text-xl font-black text-white">{guests.length}</p>
          </div>
          <Users className="w-6 h-6 text-indigo-400" />
        </div>

        <div className="bg-slate-900/80 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-slate-400 uppercase">{isEn ? "Assigned Seats" : "Waliopangiwa Meza"}</p>
            <p className="text-xl font-black text-emerald-400">{totalAssigned} / {guests.length}</p>
          </div>
          <CheckCircle className="w-6 h-6 text-emerald-400" />
        </div>

        <div className="bg-slate-900/80 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-slate-400 uppercase">{isEn ? "Total Tables" : "Idadi ya Meza"}</p>
            <p className="text-xl font-black text-amber-300">{tables.length}</p>
          </div>
          <Grid className="w-6 h-6 text-amber-300" />
        </div>

        <div className="bg-slate-900/80 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-slate-400 uppercase">{isEn ? "RSVP Attending" : "Watahudhuria (RSVP)"}</p>
            <p className="text-xl font-black text-blue-400">
              {guests.filter(g => g.rsvpStatus === 'Atahudhuria').length}
            </p>
          </div>
          <Shield className="w-6 h-6 text-blue-400" />
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/80 border border-white/10 p-4 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={isEn ? "Search guest or table..." : "Tafuta mgeni au namba ya meza..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
          />
        </div>

        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-xl text-xs font-mono flex items-center gap-2 cursor-pointer"
        >
          <Printer className="w-4 h-4 text-amber-400" />
          <span>{isEn ? "Print Seating Chart" : "Chapisha Orodha ya Meza (Print)"}</span>
        </button>
      </div>

      {/* Visual Tables Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTables.map((tbl, idx) => {
          const displayGuests = tbl.filteredGuests || tbl.guests;

          return (
            <div
              key={tbl.tableName || idx}
              className="bg-slate-950/80 border border-white/10 rounded-2xl p-5 shadow-xl space-y-4 hover:border-amber-400/40 transition relative overflow-hidden"
            >
              {/* Table Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 font-extrabold font-mono text-xs">
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">{tbl.tableName}</h4>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {displayGuests.length} / {capacity} {isEn ? "seats occupied" : "viti vimetumiwa"}
                    </p>
                  </div>
                </div>

                <span className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase">
                  {tbl.tableName.includes('VVIP') ? 'VVIP' : tbl.tableName.includes('Familia') ? 'Familia' : 'Standard'}
                </span>
              </div>

              {/* Guests Seat List */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {displayGuests.map((g: any, gIdx: number) => {
                  const isAttending = g.rsvpStatus === 'Atahudhuria' || g.rsvpStatus === 'Attending';
                  const isDeclined = g.rsvpStatus === 'Hatahudhuria' || g.rsvpStatus === 'Declined';

                  return (
                    <div
                      key={g.id || gIdx}
                      className="flex items-center justify-between bg-slate-900/90 border border-white/5 p-2.5 rounded-xl text-xs hover:bg-slate-850 transition"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono text-[9.5px] font-bold flex items-center justify-center shrink-0">
                          {gIdx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-white text-xs leading-tight">{g.name}</p>
                          <p className="text-[9.5px] text-slate-400 font-mono">{g.phone || 'Hana simu'} • {g.category || 'Mgeni'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isAttending && (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[8px] font-mono px-1.5 py-0.5 rounded uppercase font-bold">
                            ✓ RSVP
                          </span>
                        )}
                        {isDeclined && (
                          <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[8px] font-mono px-1.5 py-0.5 rounded uppercase font-bold">
                            ✕ Declined
                          </span>
                        )}
                        <span className="bg-amber-400/10 text-amber-300 text-[9px] font-mono px-1.5 py-0.5 rounded border border-amber-400/20">
                          TZS {(Number(g.paidAmount) || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
