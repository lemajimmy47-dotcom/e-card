import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clipboard, CheckCircle, XCircle, HelpCircle, MessageSquare, AlertCircle, RefreshCw, Send, ArrowRight, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { EventDetails, Guest } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface RSVPResponsesProps {
  event: EventDetails;
  guests: Guest[];
  onUpdateGuests: (guests: Guest[]) => void;
  onNext: () => void;
}

export default function RSVPResponses({ event, guests, onUpdateGuests, onNext }: RSVPResponsesProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const [selectedSimGuestId, setSelectedSimGuestId] = useState('');
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  
  // Simulator form local fields
  const [simStatus, setSimStatus] = useState<'Atahudhuria' | 'Hatahudhuria' | 'Labda'>('Atahudhuria');
  const [simCompanions, setSimCompanions] = useState(1);
  const [simComment, setSimComment] = useState('');

  // Search and Sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'rsvpStatus' | 'none'>('none');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Multi-Filter sidebar states
  const [filterRsvpStatus, setFilterRsvpStatus] = useState<string>('ALL');
  const [filterCardType, setFilterCardType] = useState<string>('ALL');

  // Computations
  const totalGuests = guests.length;
  const countAttending = guests.filter(g => g.rsvpStatus === 'Atahudhuria').reduce((acc, current) => acc + (current.rsvpGuestsCount || 1), 0);
  const countDeclined = guests.filter(g => g.rsvpStatus === 'Hatahudhuria').length;
  const countMaybe = guests.filter(g => g.rsvpStatus === 'Labda').length;
  const countNotResponded = guests.filter(g => g.rsvpStatus === 'Bado' || !g.rsvpStatus).length;

  const handleLaunchSimulator = (guestId: string) => {
    setSelectedSimGuestId(guestId);
    const target = guests.find(g => g.id === guestId);
    if (target) {
      setSimStatus(target.rsvpStatus !== 'Bado' ? target.rsvpStatus as any : 'Atahudhuria');
      setSimCompanions(target.rsvpGuestsCount || (target.cardType === 'DOUBLE' ? 2 : 1));
      setSimComment(target.rsvpComment || '');
      setIsSimulatorOpen(true);
    }
  };

  const handleSaveSimulation = () => {
    if (!selectedSimGuestId) return;

    const updated = guests.map(g => {
      if (g.id === selectedSimGuestId) {
        return {
          ...g,
          rsvpStatus: simStatus as any,
          rsvpGuestsCount: simStatus === 'Hatahudhuria' ? 0 : simCompanions,
          rsvpComment: simComment ? simComment.trim() : undefined
        };
      }
      return g;
    });

    onUpdateGuests(updated);
    setIsSimulatorOpen(false);
  };

  const handlePrepopulateRSVPs = () => {
    const statuses: ('Atahudhuria' | 'Hatahudhuria' | 'Labda')[] = ['Atahudhuria', 'Atahudhuria', 'Hatahudhuria', 'Labda', 'Atahudhuria'];
    const comments = [
      isEn ? 'Thank you so much, I will definitely attend!' : 'Asante sana, nitafika bila kukosa!',
      isEn ? 'Congratulations to our family, wishing you many blessings.' : 'Hongereni sana familia yetu, nawaombea baraka tele.',
      isEn ? 'I will not be able to attend due to a sudden business trip. So sorry.' : 'Sitaweza kuhudhuria kutokana na safari ya kikazi ya ghafla. Poleni sana.',
      isEn ? 'I am not sure, if I get a chance I will come.' : 'Sina uhakika, nikipata wepesi nitakuja.',
      isEn ? 'I will come with my wife as invited!' : 'Nitakuja na mke wangu kama mlivyotualika!'
    ];

    const randomized = guests.map((g, idx) => {
      const isDeclined = statuses[idx % statusLength()] === 'Hatahudhuria';
      return {
        ...g,
        rsvpStatus: statuses[idx % statusLength()],
        rsvpGuestsCount: isDeclined ? 0 : (g.cardType === 'DOUBLE' ? 2 : 1),
        rsvpComment: comments[idx % commentLength()]
      };
    });

    function statusLength() { return statuses.length; }
    function commentLength() { return comments.length; }

    onUpdateGuests(randomized);
  };

  const handleSort = (field: 'name' | 'rsvpStatus') => {
    if (sortBy === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortBy('none');
      }
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const filteredGuests = guests.filter(g => {
    const matchSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        g.phone.includes(searchTerm) ||
                        (g.code && g.code.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchStatus = filterRsvpStatus === 'ALL' || 
                        (filterRsvpStatus === 'BADO' && (!g.rsvpStatus || g.rsvpStatus === 'Bado')) ||
                        g.rsvpStatus === filterRsvpStatus;

    const matchCardType = filterCardType === 'ALL' || g.cardType === filterCardType;

    return matchSearch && matchStatus && matchCardType;
  });

  const sortedGuests = [...filteredGuests].sort((a, b) => {
    if (sortBy === 'name') {
      const valA = a.name.toLowerCase();
      const valB = b.name.toLowerCase();
      return sortOrder === 'asc' ? valA.localeCompare(valB, 'sw') : valB.localeCompare(valA, 'sw');
    }
    if (sortBy === 'rsvpStatus') {
      const valA = a.rsvpStatus || 'Bado';
      const valB = b.rsvpStatus || 'Bado';
      return sortOrder === 'asc' ? valA.localeCompare(valB, 'sw') : valB.localeCompare(valA, 'sw');
    }
    return 0;
  });

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[1.75rem] p-6 sm:p-8 space-y-6 font-sans text-xs text-white" id="rsvp-responses-container">
      
      {/* Header and top tools */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Clipboard className="w-5 h-5 text-blue-400" />
            <span>{isEn ? 'RSVP Responses' : 'Mrejesho wa Mwaliko (RSVP Responses)'}</span>
          </h2>
          <p className="text-slate-350 mt-0.5">{isEn ? 'View statistics, number of attending guests, and congratulatory messages.' : 'Angalia takwimu, idadi ya wageni wanaokuja, na ujumbe wa pongezi walioandika wageni.'}</p>
        </div>
      </div>

      {/* Numerical Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Attending card */}
        <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center space-x-3 text-white">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] text-slate-400 font-mono tracking-wider font-semibold uppercase">{isEn ? 'Attending' : 'Wanakuja (Attending)'}</p>
            <p className="text-lg font-extrabold text-emerald-400 mt-0.5">{countAttending} {isEn ? 'Guests' : 'Wageni'}</p>
          </div>
        </div>

        {/* Declined card */}
        <div className="backdrop-blur-md bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center space-x-3 text-white">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 text-rose-400 flex items-center justify-center shrink-0 border border-red-500/20">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] text-slate-400 font-mono tracking-wider font-semibold uppercase">{isEn ? 'Declined' : 'Hawaji (Declined)'}</p>
            <p className="text-lg font-extrabold text-rose-400 mt-0.5">{countDeclined} {isEn ? 'Cards' : 'Kadi'}</p>
          </div>
        </div>

        {/* Maybe Card */}
        <div className="backdrop-blur-md bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center space-x-3 text-white">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] text-slate-400 font-mono tracking-wider font-semibold uppercase">{isEn ? 'Maybe' : 'Hawana Uhakika'}</p>
            <p className="text-lg font-extrabold text-amber-400 mt-0.5">{countMaybe} {isEn ? 'Guests' : 'Wageni'}</p>
          </div>
        </div>

        {/* Pending Card */}
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center space-x-3 text-white">
          <div className="w-10 h-10 rounded-xl bg-white/10 text-slate-300 flex items-center justify-center shrink-0 border border-white/10">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] text-slate-400 font-mono tracking-wider font-semibold uppercase">{isEn ? 'Pending' : 'Bado Kujibu'}</p>
            <p className="text-lg font-extrabold text-white mt-0.5">{countNotResponded} {isEn ? 'Cards' : 'Kadi'}</p>
          </div>
        </div>

      </div>

      {/* SVG-based bar graph design */}
      {guests.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 text-xs font-sans">
          <h3 className="font-bold text-white text-xs">{isEn ? 'RSVP Attendance Analytics' : 'Chati ya Mrejesho (RSVP Attendance Analytics)'}</h3>
          
          <div className="space-y-4">
            {/* Attending bar */}
            <div>
              <div className="flex justify-between font-semibold text-slate-300 font-mono text-[9px] mb-1">
                <span>{isEn ? `ATTENDING (${countAttending})` : `WATAKAO HUDHURIA (${countAttending})`}</span>
                <span>{totalGuests > 0 ? Math.round((guests.filter(g => g.rsvpStatus === 'Atahudhuria').length / totalGuests) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-white/10 h-5 rounded-lg overflow-hidden flex border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${totalGuests > 0 ? (guests.filter(g => g.rsvpStatus === 'Atahudhuria').length / totalGuests) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full"
                />
              </div>
            </div>

            {/* Declined bar */}
            <div>
              <div className="flex justify-between font-semibold text-slate-300 font-mono text-[9px] mb-1">
                <span>{isEn ? `DECLINED (${countDeclined})` : `HAWATAWEZA KUJA (${countDeclined})`}</span>
                <span>{totalGuests > 0 ? Math.round((countDeclined / totalGuests) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-white/10 h-5 rounded-lg overflow-hidden flex border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${totalGuests > 0 ? (countDeclined / totalGuests) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="bg-gradient-to-r from-red-500 to-rose-455 h-full"
                />
              </div>
            </div>

            {/* Not Responded bar */}
            <div>
              <div className="flex justify-between font-semibold text-slate-300 font-mono text-[9px] mb-1">
                <span>{isEn ? `PENDING (${countNotResponded})` : `BADO KUJIBU MREJESHO (${countNotResponded})`}</span>
                <span>{totalGuests > 0 ? Math.round((countNotResponded / totalGuests) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-white/10 h-5 rounded-lg overflow-hidden flex border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${totalGuests > 0 ? (countNotResponded / totalGuests) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="bg-gradient-to-r from-slate-600 to-slate-400 h-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Multi-Filter and Directory Layout */}
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Dedicated Search and Filter Sidebar */}
        <div className="w-full md:w-64 bg-white/5 border border-white/10 rounded-2xl p-5 space-y-5 shrink-0 h-fit" id="rsvp-filter-sidebar">
          <div>
            <h3 className="font-bold text-white text-xs tracking-tight flex items-center gap-1.5 uppercase font-sans">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span>{isEn ? 'Filters' : 'Vichujio (Filters)'}</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">{isEn ? 'Search and filter guests by RSVP status or category.' : 'Tafuta mgeni na uchuje kwa hali ya rsvp au kundi la kadi.'}</p>
          </div>

          {/* Search Input */}
          <div className="space-y-1">
            <label className="font-bold text-slate-300 block text-[9px] uppercase font-mono tracking-wider">{isEn ? 'Search Name / Phone / Code' : 'Tafuta Jina / Simu / Code'}</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input 
                id="search-sidebar-input"
                type="text"
                placeholder={isEn ? "Search guest..." : "Tafuta mgeni..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-white/10 bg-[#050b18]/50 text-white focus:outline-none focus:ring-1 focus:ring-blue-550 text-xs font-sans placeholder-slate-500"
              />
            </div>
          </div>

          {/* RSVP Status Selection */}
          <div className="space-y-1">
            <label className="font-bold text-slate-300 block text-[9px] uppercase font-mono tracking-wider">{isEn ? 'RSVP Status' : 'Hali ya RSVP (Response)'}</label>
            <select
              id="sidebar-rsvp-filter"
              value={filterRsvpStatus}
              onChange={(e) => setFilterRsvpStatus(e.target.value)}
              className="w-full border border-white/10 bg-[#050b18] px-3.5 py-2.5 rounded-xl text-white focus:outline-none font-bold text-xs cursor-pointer"
            >
              <option value="ALL">{isEn ? 'All Responses' : 'Zote (All Responses)'}</option>
              <option value="Atahudhuria">{isEn ? 'Attending' : 'Atahudhuria (Attending)'}</option>
              <option value="Hatahudhuria">{isEn ? 'Declined' : 'Hatahudhuria (Declined)'}</option>
              <option value="Labda">{isEn ? 'Maybe' : 'Labda (Maybe)'}</option>
              <option value="BADO">{isEn ? 'Pending' : 'Bado Kujibu (Pending)'}</option>
            </select>
          </div>

          {/* Card Type Selection */}
          <div className="space-y-1">
            <label className="font-bold text-slate-300 block text-[9px] uppercase font-mono tracking-wider">{isEn ? 'Card Category' : 'Kundi / Aina ya Kadi (Category)'}</label>
            <select
              id="sidebar-cardtype-filter"
              value={filterCardType}
              onChange={(e) => setFilterCardType(e.target.value)}
              className="w-full border border-white/10 bg-[#050b18] px-3.5 py-2.5 rounded-xl text-white focus:outline-none font-bold text-xs cursor-pointer"
            >
              <option value="ALL">{isEn ? 'All Categories' : 'Kundi Lote (All Categories)'}</option>
              {Array.from(new Set(guests.map(g => g.cardType).filter(Boolean))).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters button */}
          {(searchTerm || filterRsvpStatus !== 'ALL' || filterCardType !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterRsvpStatus('ALL');
                setFilterCardType('ALL');
              }}
              className="w-full py-2.5 bg-white/15 hover:bg-white/20 border border-white/10 text-white font-bold rounded-xl transition text-[10px] flex items-center justify-center space-x-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 text-blue-400" />
              <span>{isEn ? 'Reset Filters' : 'Safi Vichujio (Reset)'}</span>
            </button>
          )}

          {/* Directory Stats block */}
          <div className="bg-[#050b18]/30 p-3.5 rounded-xl border border-white/5 space-y-1.5 font-mono text-[9px] text-slate-400">
            <p className="font-bold text-white text-[9.5px] uppercase">{isEn ? 'Filter Stats:' : 'Takwimu za Chujio:'}</p>
            <div className="flex justify-between">
              <span>{isEn ? 'Found:' : 'Waliopatikana:'}</span>
              <span className="font-bold text-white">{filteredGuests.length} {isEn ? 'cards' : 'kadi'}</span>
            </div>
            <div className="flex justify-between">
              <span>{isEn ? 'Total:' : 'Kadi Zote:'}</span>
              <span className="font-bold text-white">{totalGuests} {isEn ? 'cards' : 'kadi'}</span>
            </div>
          </div>
        </div>

        {/* Column 2: Main RSVP Records Table */}
        <div className="flex-1 border border-white/10 rounded-2xl overflow-hidden bg-white/5 text-xs h-fit self-start">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-slate-400 font-mono font-bold uppercase text-[9px] tracking-wider">
                <th 
                  className="px-5 py-3 cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>{isEn ? 'Guest Name' : 'Mwalikwa (Guest Name)'}</span>
                    {sortBy === 'name' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-5 py-3 whitespace-nowrap">{isEn ? 'Phone' : 'Mawasiliano (Phone)'}</th>
                <th 
                  className="px-5 py-3 text-center cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap"
                  onClick={() => handleSort('rsvpStatus')}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>RSVP Status</span>
                    {sortBy === 'rsvpStatus' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-5 py-3 text-center whitespace-nowrap">{isEn ? 'Attending Count' : 'Wageni wanaokuja'}</th>
                <th className="px-5 py-3">{isEn ? 'Comments' : 'Kumbukumbu / Maoni ya pongezi'}</th>
                <th className="px-5 py-3 text-right">{isEn ? 'Tools' : 'Zana / Hali'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {sortedGuests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 font-sans">
                    {isEn ? 'No guests found for RSVP tracking.' : 'Hakuna wageni waliopatikana kwa ajili ya kufuatilia RSVP.'}
                  </td>
                </tr>
              ) : (
                sortedGuests.map((g) => (
                  <tr key={g.id} className="hover:bg-white/5 transition border-b border-white/5">
                    <td className="px-5 py-3 font-bold text-white">{g.name}</td>
                    <td className="px-5 py-3 font-mono text-slate-300">{g.phone}</td>
                    
                    {/* Status Badge */}
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold border inline-flex items-center space-x-1 ${
                        g.rsvpStatus === 'Atahudhuria' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        g.rsvpStatus === 'Hatahudhuria' ? 'bg-red-500/10 text-rose-350 border-red-500/20' :
                        g.rsvpStatus === 'Labda' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-white/5 text-slate-400 border-white/10'
                      }`}>
                        {g.rsvpStatus === 'Bado' || !g.rsvpStatus ? 'Bado Jibu' : g.rsvpStatus}
                      </span>
                    </td>

                    <td className="px-5 py-3 text-center font-bold font-mono text-slate-200">
                      {g.rsvpStatus === 'Hatahudhuria' ? 0 : g.rsvpGuestsCount}
                    </td>

                    <td className="px-5 py-3 italic text-slate-300 font-sans max-w-[200px] truncate" title={g.rsvpComment}>
                      {g.rsvpComment || '-'}
                    </td>

                    {/* Test IFrame / Simulator launch */}
                    <td className="px-5 py-3 text-right font-bold">
                      <button
                        onClick={() => handleLaunchSimulator(g.id)}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 text-white text-[10px] font-bold rounded-lg transition shrink-0 cursor-pointer"
                      >
                        {isEn ? 'Simulate RSVP' : 'Jaribu RSVP (Simulate)'}
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div> {/* End of main multi-filter layout container */}

      {/* Navigation section */}
      <div className="flex justify-end pt-4 border-t border-white/10">
        <button
          onClick={onNext}
          className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] text-white font-bold rounded-xl transition shadow flex items-center space-x-2 text-xs"
        >
          <span>{isEn ? 'Gate Check-in (QR Scanner)' : 'Uhakiki wa Mlangoni (QR Scanner)'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* GUEST RSVP SIMULATOR DIALOG */}
      <AnimatePresence>
        {isSimulatorOpen && selectedSimGuestId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="backdrop-blur-xl bg-[#090f1d] border border-white/15 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-xs text-white font-sans relative rounded-3xl"
            >
              
              <button 
                onClick={() => setIsSimulatorOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white bg-white/10 p-1.5 rounded-full"
              >
                ✕
              </button>

              {/* Simulation Header Badge */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3.5 rounded-2xl text-center space-y-1">
                <p className="text-[9px] uppercase tracking-widest font-mono font-bold">{isEn ? 'Simulator: Mobile View for Guest' : 'Simulator: Muonekano upande wa Simu ya Mgeni'}</p>
                <h4 className="text-[10px] font-bold">{isEn ? 'PERSONAL INVITATION PORTAL (RSVP LINK)' : 'TOVUTI BINAFSI YA MWALIKO (RSVP LINK)'}</h4>
              </div>

              {/* Guest Card Mockup details */}
              <div className="border border-white/10 bg-[#050b18]/50 p-4 rounded-2xl flex flex-col items-center text-center space-y-1">
                <p className="text-[10px] text-blue-400 font-mono uppercase tracking-wider font-bold">{event.senderId || 'SEND OFF'}</p>
                <h3 className="font-bold text-white font-sans">
                  {guests.find(g => g.id === selectedSimGuestId)?.name.toUpperCase()}
                </h3>
                <p className="text-[10px] text-slate-350 italic mt-0.5">{isEn ? 'You are welcome to respond to your invitation now.' : 'Karibu sana kujibu mwaliko wa sherehe sasa.'}</p>
              </div>

              {/* Form elements mimicking what guests will click in real life */}
              <div className="space-y-4">
                
                {/* RSVP Choice Buttons */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300 block">{isEn ? 'Will you be attending?' : 'Je, utahudhuria sherehe hii ya mwaliko?'}</label>
                  <div className="grid grid-cols-3 gap-2">
                    
                    <button
                      type="button"
                      onClick={() => setSimStatus('Atahudhuria')}
                      className={`py-2 rounded-xl border text-center font-bold tracking-tight transition text-[11px] cursor-pointer ${
                        simStatus === 'Atahudhuria' 
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300' 
                          : 'bg-[#050b18] border-white/10 text-slate-300'
                      }`}
                    >
                      {isEn ? '✓ Attending' : '✓ Nitafika'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSimStatus('Hatahudhuria')}
                      className={`py-2 rounded-xl border text-center font-bold tracking-tight transition text-[11px] cursor-pointer ${
                        simStatus === 'Hatahudhuria' 
                          ? 'bg-red-500/10 border-red-500 text-rose-300' 
                          : 'bg-[#050b18] border-white/10 text-slate-300'
                      }`}
                    >
                      {isEn ? '✕ Cannot Attend' : '✕ Sitaweza'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSimStatus('Labda')}
                      className={`py-2 rounded-xl border text-center font-bold tracking-tight transition text-[11px] cursor-pointer ${
                        simStatus === 'Labda' 
                          ? 'bg-amber-500/10 border-amber-500 text-amber-300' 
                          : 'bg-[#050b18] border-white/10 text-slate-300'
                      }`}
                    >
                      {isEn ? '? Maybe' : '? Labda'}
                    </button>

                  </div>
                </div>

                {/* Companions Counter for Attending */}
                {simStatus !== 'Hatahudhuria' && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="font-semibold text-slate-300 block" htmlFor="companions-select">{isEn ? 'How many seats should we reserve?' : 'Umekuja na wenza wangapi kuhifadhi siti?'}</label>
                    <select
                      id="companions-select"
                      value={simCompanions}
                      onChange={(e) => setSimCompanions(parseInt(e.target.value))}
                      className="w-full border border-white/10 bg-[#050b18] rounded-xl px-3 py-2 text-white focus:outline-none"
                    >
                      <option value={1} className="bg-[#050b18] text-white">{isEn ? 'Just me (1 Seat)' : 'Mimi peke yangu (Siti 1)'}</option>
                      <option value={2} className="bg-[#050b18] text-white">{isEn ? 'With my partner (2 Seats)' : 'Nitafika na Mwenza wangu (Siti 2)'}</option>
                      <option value={3} className="bg-[#050b18] text-white">{isEn ? 'Three people (3 Seats)' : 'Watatu (Siti 3)'}</option>
                    </select>
                  </div>
                )}

                {/* Message Box */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block" htmlFor="companions-comment">{isEn ? 'Message / Wishes for the hosts' : 'Ujumbe maalum wa Pongezi kwa Waandaji (Pongezi/Ombi)'}</label>
                  <textarea
                    id="companions-comment"
                    rows={3}
                    placeholder={isEn ? "e.g. Congratulations! We will be there to celebrate!" : "e.g. Hongereni sana, nitakuja kufanikisha sherehe hii!"}
                    value={simComment}
                    onChange={(e) => setSimComment(e.target.value)}
                    className="w-full border border-white/10 bg-[#050b18] rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                  />
                </div>

                {/* Submit simulation */}
                <button
                  type="button"
                  onClick={handleSaveSimulation}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>{isEn ? 'Submit RSVP ✓' : 'Wasilisha Mrejesho RSVP ✓'}</span>
                </button>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
