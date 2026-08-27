import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { EventDetails, TemplateSettings, Guest } from '../types';
import { drawCardToCanvas } from '../utils/canvasHelper';
import { useLanguage } from '../context/LanguageContext';

interface GuestInvitePageProps {
  guest: Guest;
  event: EventDetails;
  settings: TemplateSettings;
  viewMode?: 'seating' | 'venue' | 'card';
  onRsvpSubmit: (updatedGuest: Guest) => void;
}

interface TableData {
  tableName: string;
  headcount: number;
  capacity: number;
  guests: { id: string; name: string; rsvpGuestsCount: number }[];
}

export default function GuestInvitePage({ guest, event, settings, viewMode: propViewMode, onRsvpSubmit }: GuestInvitePageProps) {
  const { language, setLanguage } = useLanguage();
  const isEn = language === 'en';
  const [rsvpStatus, setRsvpStatus] = useState(guest.rsvpStatus || 'Bado');
  const [rsvpGuestsCount, setRsvpGuestsCount] = useState(guest.rsvpGuestsCount || 1);
  const [rsvpComment, setRsvpComment] = useState(guest.rsvpComment || '');
  const [rsvpUpdating, setRsvpUpdating] = useState(false);
  const [rsvpFeedback, setRsvpFeedback] = useState<string | null>(null);
  const [cardImageUrl, setCardImageUrl] = useState<string>('');
  const [showPreviewMap, setShowPreviewMap] = useState(true);
  
  // Determine view mode from URL parameters or props
  const [urlViewMode] = useState<'all' | 'seating' | 'venue' | 'card'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('view') || params.get('mode');
      if (v === 'seating' || v === 'table' || v === 'map' || v === 'tables') return 'seating';
      if (v === 'venue' || v === 'location' || v === 'ukumbi') return 'venue';
      if (v === 'card' || v === 'invite') return 'card';
      return 'all';
    } catch (e) {
      return 'all';
    }
  });

  const effectiveViewMode = propViewMode || (urlViewMode !== 'all' ? urlViewMode : 'all');

  const hideCard = effectiveViewMode === 'seating' || effectiveViewMode === 'venue';
  const hideRSVP = effectiveViewMode === 'seating' || effectiveViewMode === 'venue' || effectiveViewMode === 'card';
  const seatingOnly = effectiveViewMode === 'seating';
  const venueOnly = effectiveViewMode === 'venue';

  const [activeTab, setActiveTab] = useState<'seating' | 'card' | 'venue'>(() => {
    if (effectiveViewMode === 'card') return 'card';
    if (effectiveViewMode === 'venue') return 'venue';
    return 'seating';
  });

  // Ensure activeTab is consistent with viewMode
  useEffect(() => {
    if (effectiveViewMode === 'seating') {
      setActiveTab('seating');
    } else if (effectiveViewMode === 'venue') {
      setActiveTab('venue');
    } else if (effectiveViewMode === 'card') {
      setActiveTab('card');
    }
  }, [effectiveViewMode]);

  // Helper to dynamically calculate effective map link
  const getEffectiveMapsLink = () => {
    if (event.mapsLink && event.mapsLink.trim().length > 0) {
      const trimmed = event.mapsLink.trim();
      return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
    }
    if (event.coordinates && event.coordinates.trim().length > 0) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.coordinates.trim())}`;
    }
    if (event.eventHallName && event.eventHallName.trim().length > 0) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.eventHallName.trim() + " Dar es Salaam")}`;
    }
    if (event.name && event.name.trim().length > 0) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.name.trim() + " Dar es Salaam")}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Dar es Salaam")}`;
  };

  const effectiveMapsLink = getEffectiveMapsLink();

  // If in venue mode, auto-redirect directly to Google Maps immediately
  useEffect(() => {
    if (venueOnly && effectiveMapsLink) {
      try {
        window.location.href = effectiveMapsLink;
      } catch (e) {
        // Fallback
      }
    }
  }, [venueOnly, effectiveMapsLink]);

  // Handle auto-map preview
  useEffect(() => {
    if (hideRSVP) {
      setShowPreviewMap(true);
    }
  }, [hideRSVP]);

  // Table selection states
  const committeeAssignedTable = guest.customFields?.tableNumber || '';
  const [selectedTable, setSelectedTable] = useState<string>(guest.customFields?.tableNumber || '');
  const [tablesList, setTablesList] = useState<TableData[]>([]);
  const [loadingTables, setLoadingTables] = useState<boolean>(false);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const scaleFactor = 3;
    canvas.width = (settings.orientation === 'landscape' ? 600 : 450) * scaleFactor;
    canvas.height = (settings.orientation === 'landscape' ? 450 : 600) * scaleFactor;
    
    drawCardToCanvas(
        canvas, 
        event, 
        settings, 
        guest.name.toUpperCase(), 
        guest.cardType, 
        guest.code ? `EVENTCARD-${guest.code}` : `EVENTCARD-${guest.id}`,
        () => {
            setCardImageUrl(canvas.toDataURL('image/jpeg', 0.95));
        }
    );
  }, [guest, event, settings]);

  // Plus-one limits verification calculation
  const allowedMaxGuests = guest.maxGuests || (guest.cardType === 'DOUBLE' ? 2 : (guest.cardType === 'TABLE' ? 10 : 1));

  // Load tables whenever user enters the "Atahudhuria" (Attending) RSVP state or enables preview map
  useEffect(() => {
    if (rsvpStatus === 'Atahudhuria' || showPreviewMap) {
      setLoadingTables(true);
      fetch(`/api/event-tables?eventId=${event.id}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.tables) {
            setTablesList(data.tables);
          }
        })
        .catch(err => console.error("Error fetching tables:", err))
        .finally(() => setLoadingTables(false));
    }
  }, [rsvpStatus, showPreviewMap, event.id]);

  const performRsvpUpdate = (status: string, explicitCount?: number, explicitTable?: string) => {
    setRsvpUpdating(true);
    setRsvpFeedback(null);

    const finalCount = status === 'Atahudhuria' ? (explicitCount !== undefined ? explicitCount : rsvpGuestsCount) : 0;
    const finalTable = status === 'Atahudhuria' ? (explicitTable !== undefined ? explicitTable : selectedTable) : '';

    // Frontend Plus-One capacity verification safety check
    if (status === 'Atahudhuria' && finalCount > allowedMaxGuests) {
      setRsvpFeedback(isEn 
        ? `Error: You cannot register more than ${allowedMaxGuests} guests.` 
        : `Hitilafu: Huruhusiwi kusajili zaidi ya wageni ${allowedMaxGuests}.`
      );
      setRsvpUpdating(false);
      return;
    }

    fetch('/api/rsvp-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestId: guest.id,
        rsvpStatus: status,
        rsvpGuestsCount: finalCount,
        rsvpComment: rsvpComment,
        tableNumber: finalTable
      })
    })
    .then(res => {
      if (!res.ok) throw new Error("RSVP update failed");
      return res.json();
    })
    .then(() => {
      setRsvpStatus(status);
      setRsvpGuestsCount(finalCount);
      setSelectedTable(finalTable);
      onRsvpSubmit({
        ...guest,
        rsvpStatus: status as any,
        rsvpGuestsCount: finalCount,
        rsvpComment: rsvpComment,
        customFields: {
          ...(guest.customFields || {}),
          tableNumber: finalTable
        }
      });
      setRsvpFeedback(isEn 
        ? "Thank you! Your RSVP response and table selection have been recorded." 
        : "Ahsante sana! Ushiriki wako na uchaguzi wako wa meza umerekodiwa kikamilifu."
      );
      setTimeout(() => setRsvpFeedback(null), 5000);
    })
    .catch(err => {
      console.error(err);
      setRsvpFeedback(isEn ? "An error occurred. Please try again." : "Hitilafu imetokea. Tafadhali jaribu tena.");
    })
    .finally(() => setRsvpUpdating(false));
  };

  // Helper to generate coordinates around the table (e.g. radius of 30px from center 50%, 50%)
  const getSeatPosition = (index: number, total: number) => {
    const angle = (index * 2 * Math.PI) / total - Math.PI / 2; // start from the top
    const radius = 34; // percent radius
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    return { left: `${x}%`, top: `${y}%` };
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center py-8 px-4 font-sans relative pb-32">
      {/* Floating Language Switcher */}
      {!venueOnly && !seatingOnly && (
        <div className="absolute top-4 right-4 z-50 flex gap-1 bg-white/5 border border-white/10 p-1 rounded-full backdrop-blur-md animate-fade-in">
          <button
            type="button"
            onClick={() => setLanguage('sw')}
            className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all cursor-pointer ${!isEn ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md' : 'text-neutral-400 hover:text-white'}`}
          >
            SW
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all cursor-pointer ${isEn ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md' : 'text-neutral-400 hover:text-white'}`}
          >
            EN
          </button>
        </div>
      )}
      
      {/* Background Decor */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-rose-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-[480px] space-y-6 z-10 relative">
        
        {/* Modern Tab Selector */}
        {!hideCard && (
          <div className="flex bg-neutral-900/90 border border-white/10 p-1 rounded-2xl backdrop-blur-md relative z-10 shadow-xl">
            <button
              type="button"
              onClick={() => setActiveTab('seating')}
              className={`flex-1 py-2.5 text-[10px] sm:text-[11px] font-black rounded-xl transition-all tracking-wider uppercase cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                activeTab === 'seating'
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-lg'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              🎟️ {isEn ? "RSVP & SEATING" : "RSVP & MEZA"}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('venue')}
              className={`flex-1 py-2.5 text-[10px] sm:text-[11px] font-black rounded-xl transition-all tracking-wider uppercase cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                activeTab === 'venue'
                  ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              📍 {isEn ? "LOCATION" : "UKUMBI"}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('card')}
              className={`flex-1 py-2.5 text-[10px] sm:text-[11px] font-black rounded-xl transition-all tracking-wider uppercase cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                activeTab === 'card'
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-lg'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              ✉️ {isEn ? "CARD" : "KADI"}
            </button>
          </div>
        )}

        {/* Dedicated Venue / Location View */}
        {(activeTab === 'venue' || venueOnly) && (
          <div className="space-y-6 py-2 animate-fade-in">
            <div className="text-center space-y-2">
              <p className="text-[12.5px] text-rose-400 font-extrabold tracking-wider uppercase">
                📍 {isEn ? "VENUE LOCATION & MAP" : "RAMANI NA MAHALI PA UKUMBI"}
              </p>
              <p className="text-xs text-neutral-300">
                {isEn ? "Location details for the event:" : "Maelezo ya mahali ukumbi wa sherehe ulipo:"}
              </p>
            </div>

            <div className="bg-neutral-900/90 border border-white/10 rounded-3xl p-6 text-center space-y-5 shadow-2xl backdrop-blur-md">
              <div className="space-y-2">
                {event.eventHallName && (
                  <span className="inline-block px-3.5 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-black uppercase tracking-widest rounded-full">
                    🏛️ {event.eventHallName}
                  </span>
                )}
                <h2 className="text-xl font-black text-white uppercase tracking-tight">
                  {event.name}
                </h2>
                {event.date && (
                  <p className="text-xs text-neutral-300 font-bold">
                    📅 {event.date} {event.time ? `• ${event.time} ${event.period || ''}` : ''}
                  </p>
                )}
                {event.coordinates && (
                  <p className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-1 px-3 rounded-lg inline-block">
                    📍 GPS: {event.coordinates}
                  </p>
                )}
              </div>

              {effectiveMapsLink ? (
                <div className="space-y-4 pt-2">
                  {/* Embedded Google Maps iFrame Preview */}
                  <div className="w-full h-52 rounded-2xl overflow-hidden border border-white/10 shadow-inner relative bg-neutral-950">
                    <iframe 
                      title="Venue Map Preview"
                      width="100%" 
                      height="100%" 
                      style={{ border: 0 }} 
                      loading="lazy" 
                      allowFullScreen
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(event.coordinates || event.eventHallName || 'Dar es Salaam')}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    ></iframe>
                  </div>

                  <a 
                    href={effectiveMapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-full py-4.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black rounded-2xl transition shadow-xl active:scale-95 gap-3 text-sm cursor-pointer border border-rose-400/20"
                  >
                    🚀 {isEn ? "OPEN IN GOOGLE MAPS" : "FUNGUA KWENYE GOOGLE MAPS"}
                  </a>

                  <p className="text-[10.5px] text-neutral-400 leading-relaxed italic">
                    {isEn 
                      ? "Click the button above to launch live GPS directions on your phone." 
                      : "Bofya kitufe hapo juu kuanza kupelekwa ukumbini moja kwa moja na simu yako."}
                  </p>
                </div>
              ) : (
                <div className="py-6 px-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-200 text-xs space-y-2 text-center">
                  <p className="font-bold text-sm">📍 {isEn ? "Location Link Not Configured" : "Kiungo cha Ramani (Google Maps) Bado Hakijawekwa"}</p>
                  <p className="text-[11.5px] text-amber-100/80 leading-relaxed">
                    {isEn 
                      ? "The event organizers have not set a Google Maps link or coordinates yet in 'Event Details'. Please contact the committee or host for direct directions." 
                      : "Kamati haijaweka Link ya Google Maps kwenye 'Taarifa za Sherehe'. Tafadhali wasiliana na kamati au mwenyeji kwa msaada wa kuelekezwa ukumbini."}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Event Hero Image & Invitation Card (Shown only when Card tab is active) */}

        {/* Event Hero Image & Invitation Card (Shown only when Card tab is active) */}
        {activeTab === 'card' && (
          <div className="space-y-6">
            {event.eventImgUrl && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }} 
                animate={{ opacity: 1, y: 0 }}
                className="w-full rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl aspect-[3/4] md:aspect-[4/5] relative mx-auto"
              >
                <img src={event.eventImgUrl} className="w-full h-full object-cover" alt="Event Cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent"></div>
              </motion.div>
            )}

            {cardImageUrl && (
              <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="text-center space-y-3">
                <img src={cardImageUrl} className="mx-auto rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5" alt={isEn ? "Invitation Card" : "Kadi ya Mwaliko"} />
              </motion.div>
            )}
          </div>
        )}

        {/* Header */}
        {!hideRSVP && !venueOnly && (
          <div className="text-center space-y-2 pb-1 animate-fade-in">
             <h1 className="text-2xl font-extrabold tracking-tight text-white uppercase">
               {isEn ? "INVITATION TO" : "MWALIKO WA"} {(event.name || (isEn ? "Event" : "Tukio")).replace(/^(MWALIKO\s+WA\s+|INVITATION\s+TO\s+)+/i, '').trim().toUpperCase()}
             </h1>
             <p className="text-sm text-neutral-400">
               {isEn ? "Welcome, dear" : "Karibu, mpendwa"} <span className="font-bold text-amber-400 uppercase">{guest.name}</span>
             </p>
          </div>
        )}
        
        {seatingOnly && !venueOnly && (
          <div className="text-center space-y-2 pb-1 animate-fade-in">
             <h1 className="text-2xl font-extrabold tracking-tight text-amber-400 uppercase">
               {isEn ? "YOUR TABLE SELECTION" : "MEZA YAKO NA UCHAGUZI"}
             </h1>
             <p className="text-sm text-neutral-400">
               {isEn ? "Hello" : "Habari"} <span className="font-bold text-white uppercase">{guest.name}</span>, {isEn ? "find your seat below:" : "angalia meza yako hapa chini:"}
             </p>
          </div>
        )}

        {!venueOnly && activeTab === 'seating' && (
          <div className="space-y-6">
          <div className={`bg-neutral-900/60 border border-white/5 rounded-3xl shadow-2xl backdrop-blur-md ${hideRSVP ? 'p-4' : 'p-6'}`}>
            {!hideRSVP && (
              <div className="text-center mb-6 space-y-2">
                <p className="text-[12.5px] text-emerald-400 font-extrabold tracking-wider uppercase">
                  {isEn ? "🎟️ RSVP - CONFIRMATION" : "🎟️ RSVP - THIBITISHA USHIRIKI"}
                </p>
                <p className="text-xs text-neutral-300">
                  {rsvpStatus === 'Bado'
                    ? (isEn 
                      ? "Please select your option below to let the hosts know if you can make it:" 
                      : "Tafadhali chagua ushiriki wako hapa chini ili kumjulisha mualikaji:")
                    : (isEn 
                      ? "Fill in your RSVP details below to complete your response:" 
                      : "Jaza maelezo yako ya ushiriki hapa chini ili kukamilisha usajili:")}
                </p>
              </div>
            )}

            {(hideRSVP || rsvpStatus === 'Atahudhuria') ? (
              <div className="space-y-6">
                {!hideRSVP && (
                  <div className="text-center bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                    <p className="text-xs text-emerald-400 font-bold">
                      {guest.rsvpStatus === 'Atahudhuria' 
                        ? (isEn ? "🎉 Your attendance is confirmed!" : "🎉 Ushiriki wako umethibitishwa!")
                        : (isEn ? "Confirming your attendance..." : "Unathibitisha ushiriki wako...")}
                    </p>
                  </div>
                )}

                {/* PLUS-ONE CAPACITY VERIFICATION DISPLAY */}
                {!hideRSVP && (
                  <div className="bg-neutral-950/40 border border-white/5 rounded-2xl p-4.5 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-400 font-bold uppercase tracking-wider">{isEn ? "🎟️ Card Type" : "🎫 Aina ya Kadi"}</span>
                      <span className="bg-amber-500/10 text-amber-400 font-extrabold px-3 py-1 rounded-lg text-[10px] tracking-wide uppercase border border-amber-500/20">
                        {guest.cardType}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-400 font-bold uppercase tracking-wider">{isEn ? "👥 Allowed Attendance" : "👥 Kikomo cha Wageni"}</span>
                      <span className="text-white font-extrabold text-sm">
                        {allowedMaxGuests} {allowedMaxGuests === 1 ? (isEn ? "person" : "mtu") : (isEn ? "people max" : "watu kiupeo")}
                      </span>
                    </div>
                    {allowedMaxGuests === 1 && (
                      <div className="text-[10.5px] text-neutral-450 border-t border-white/5 pt-2 mt-2 leading-relaxed">
                        💡 {isEn ? "This invitation card is personalized for 1 guest only." : "Kadi hii ya mwaliko inaruhusu mgeni mmoja (1) tu."}
                      </div>
                    )}
                  </div>
                )}

                {/* GUEST NUMBER COUNT dropdown if more than 1 allowed */}
                {allowedMaxGuests > 1 && !hideRSVP && (
                  <div className="space-y-1.5 text-left">
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                      {isEn ? "👥 Number of guests attending" : "👥 Idadi ya wageni mtakaohudhuria"}
                    </label>
                    <select
                      value={rsvpGuestsCount}
                      onChange={(e) => setRsvpGuestsCount(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-bold text-xs cursor-pointer"
                    >
                      {Array.from({ length: allowedMaxGuests }, (_, i) => i + 1).map((num) => (
                        <option key={num} value={num} className="bg-neutral-900 text-white">
                          {num} {num === 1 ? (isEn ? "Guest (Self Only)" : "Mgeni 1 (Wewe tu)") : (isEn ? `${num} Guests (Max ${allowedMaxGuests})` : `${num} Wageni (Upeo ${allowedMaxGuests})`)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* INTERACTIVE SEAT SELECTOR / TABLE MAP */}
                <div className={`${hideRSVP ? 'pt-0' : 'border-t border-white/5 pt-5'} space-y-4`}>
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      🗺️ {isEn ? "Seat Map & Table Selection" : "Ramani ya Meza na Uchaguzi"}
                    </h3>
                    {loadingTables && (
                      <span className="text-[10px] text-neutral-500 animate-pulse">
                        {isEn ? "Refreshing..." : "Inatafuta..."}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    {isEn 
                      ? "Choose where you would like to be seated from the available tables below. Click a table to select it." 
                      : "Chagua meza unayotaka kuketi kati ya meza zilizopo chini. Bonyeza meza ili kuichagua."}
                  </p>

                  {/* Committee Assignment Badge info */}
                  {committeeAssignedTable && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-300 flex items-center gap-2.5">
                      <span>📌</span>
                      <p>
                        {isEn 
                          ? `The committee assigned you to: ` 
                          : `Kamati imekupangia kuketi: `}
                        <strong className="text-white underline">{committeeAssignedTable}</strong>. 
                        {isEn ? " You can keep it or switch to another available table below." : " Unaweza kuibakisha au kuchagua nyingine hapa chini."}
                      </p>
                    </div>
                  )}

                  {/* Dynamic Table Selector Grid */}
                  <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1 py-1 scrollbar-thin scrollbar-thumb-white/10">
                    {tablesList.map((table) => {
                      const isSelected = selectedTable === table.tableName;
                      const isAssigned = committeeAssignedTable === table.tableName;
                      const isFull = table.headcount >= table.capacity;

                      return (
                        <div
                          key={table.tableName}
                          onClick={() => {
                            if (!isFull || isSelected) {
                              setSelectedTable(table.tableName);
                            }
                          }}
                          className={`relative flex flex-col items-center p-3 rounded-2xl border transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-gradient-to-b from-amber-500/20 to-amber-950/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)] scale-[1.02]' 
                              : isFull 
                                ? 'bg-neutral-900/20 border-neutral-800/40 opacity-50 cursor-not-allowed' 
                                : 'bg-neutral-900/40 border-white/5 hover:border-white/15'
                          }`}
                        >
                          {/* Round Table Graphic with Seat Dots surrounding it */}
                          <div className="relative w-18 h-18 my-2 flex items-center justify-center">
                            {/* Outer seat dots container */}
                            <div className="absolute inset-0">
                              {Array.from({ length: table.capacity }).map((_, seatIdx) => {
                                const pos = getSeatPosition(seatIdx, table.capacity);
                                const isSeatOccupied = seatIdx < table.headcount;
                                return (
                                  <span
                                    key={seatIdx}
                                    style={pos}
                                    className={`absolute w-1.5 h-1.5 rounded-full ${
                                      isSeatOccupied 
                                        ? 'bg-emerald-400' 
                                        : 'bg-neutral-700'
                                    }`}
                                  />
                                );
                              })}
                            </div>

                            {/* Center circle Table Graphic */}
                            <div className={`w-10 h-10 rounded-full flex flex-col items-center justify-center text-[10px] font-black tracking-tight z-10 ${
                              isSelected 
                                ? 'bg-amber-500 text-neutral-950' 
                                : 'bg-neutral-800 text-neutral-300'
                            }`}>
                              M-{table.tableName.replace(/^\D+/g, '') || table.tableName}
                            </div>
                          </div>

                          {/* Table text descriptions */}
                          <div className="text-center mt-1 space-y-0.5">
                            <span className="text-[11px] font-extrabold block text-white">
                              {table.tableName}
                            </span>
                            <span className="text-[9.5px] text-neutral-400 block font-medium">
                              {table.headcount}/{table.capacity} {isEn ? "seats" : "viti"}
                            </span>
                          </div>

                          {/* Mini flags badges inside table card */}
                          {isFull && (
                            <span className="absolute top-1.5 right-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[7.5px] font-black px-1.5 py-0.5 rounded uppercase">
                              {isEn ? "FULL" : "IMEJAA"}
                            </span>
                          )}
                          {isAssigned && (
                            <span className="absolute top-1.5 left-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[7.5px] font-black px-1.5 py-0.5 rounded uppercase">
                              {isEn ? "Assigned" : "Kikao"}
                            </span>
                          )}
                          {isSelected && !isFull && (
                            <span className="absolute top-1.5 right-1.5 bg-emerald-500/20 text-emerald-400 text-[7.5px] font-black px-1.5 py-0.5 rounded uppercase">
                              {isEn ? "Selected" : "Umechagua"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Detail listing attendees inside currently selected table */}
                  {selectedTable && (
                    <div className="bg-neutral-950/60 border border-white/5 rounded-xl p-3.5 space-y-1.5 text-xs">
                      <p className="font-extrabold text-[11px] text-neutral-300 uppercase tracking-wider">
                        👥 {isEn ? "Sitting at " : "Wanaokaa "} {selectedTable}:
                      </p>
                      {(() => {
                        const activeTable = tablesList.find(t => t.tableName === selectedTable);
                        if (!activeTable || activeTable.guests.length === 0) {
                          return (
                            <p className="text-[11px] text-neutral-500 italic">
                              {isEn ? "No other guests have confirmed this table yet. Be the first!" : "Hakuna mgeni mwingine aliyethibitisha kuketi hapa bado."}
                            </p>
                          );
                        }
                        return (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {activeTable.guests.map(gAtTable => (
                              <span key={gAtTable.id} className="bg-white/5 border border-white/5 text-[10.5px] px-2.5 py-1 rounded-full text-neutral-300 font-medium">
                                👤 {gAtTable.name} {gAtTable.rsvpGuestsCount > 1 ? `(+${gAtTable.rsvpGuestsCount - 1})` : ''}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {!hideRSVP && (
                  <div className="space-y-1.5 text-left">
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                      {isEn ? "✍️ Wishes/Message for the hosts" : "✍️ Hongera / Ujumbe kwa wahusika"}
                    </label>
                    <textarea
                      value={rsvpComment}
                      onChange={(e) => setRsvpComment(e.target.value)}
                      placeholder={isEn ? "Write your wishes..." : "Andika salamu zako hapa..."}
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-xs resize-none"
                    />
                  </div>
                )}

                <button 
                  onClick={() => performRsvpUpdate('Atahudhuria')}
                  disabled={rsvpUpdating}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition active:scale-95 disabled:opacity-50 text-[13px] cursor-pointer shadow-lg flex items-center justify-center gap-2"
                >
                  {rsvpUpdating ? (isEn ? 'Saving...' : 'Inahifadhi...') : (hideRSVP ? (isEn ? 'Confirm Seating Selection ✓' : 'Thibitisha Chaguo la Meza ✓') : (isEn ? 'Confirm RSVP ✓' : 'Thibitisha RSVP ✓'))}
                </button>

                {!hideRSVP && (
                  <div className="flex gap-2 justify-between">
                    {effectiveMapsLink && (
                      <a 
                        href={effectiveMapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-3 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 font-bold rounded-xl transition text-[11px] text-center border border-rose-500/20 flex items-center justify-center cursor-pointer"
                      >
                        📍 {isEn ? "View Location" : "Ramani"}
                      </a>
                    )}
                    <button
                      onClick={() => setRsvpStatus('Bado')}
                      className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white font-bold rounded-xl transition text-[11px]"
                    >
                      🔄 {isEn ? "Change Status" : "Badili Chaguo"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl">
                  <p className="text-xs text-rose-400 font-bold">
                    {guest.rsvpStatus === 'Hatahudhuria'
                      ? (isEn ? "😔 You declined this invitation." : "😔 Ulighairi kuhudhuria tukio hili.")
                      : (isEn ? "Confirming you won't attend..." : "Unasajili udhuru wako...")}
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                    {isEn ? "✍️ Leave a note (Optional)" : "✍️ Ujumbe wako kwa wahusika (Sio lazima)"}
                  </label>
                  <textarea
                    value={rsvpComment}
                    onChange={(e) => setRsvpComment(e.target.value)}
                    placeholder={isEn ? "I'm sorry I can't attend..." : "Samahani sitaweza kuhudhuria..."}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-xs resize-none"
                  />
                </div>

                <button 
                  onClick={() => performRsvpUpdate('Hatahudhuria', 0)}
                  disabled={rsvpUpdating}
                  className="w-full py-4 bg-neutral-800 hover:bg-neutral-700 text-white font-extrabold rounded-xl transition active:scale-95 disabled:opacity-50 text-[13px] cursor-pointer flex items-center justify-center gap-2"
                >
                  {rsvpUpdating ? (isEn ? 'Saving...' : 'Inahifadhi...') : (isEn ? 'Confirm Decline ✓' : 'Thibitisha Udhuru ✓')}
                </button>

                <button
                  onClick={() => setRsvpStatus('Bado')}
                  className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-500 hover:text-white font-bold rounded-xl transition text-[11px]"
                >
                  🔄 {isEn ? "Change RSVP Option" : "Badilisha Chaguo la RSVP"}
                </button>
              </div>
            )}
          </div>
          
          {rsvpFeedback && (
              <motion.div initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-center mt-4">
                {rsvpFeedback}
              </motion.div>
          )}
          
          {rsvpUpdating && (
              <div className="text-[11px] text-center text-neutral-500 mt-4">{isEn ? "Submitting..." : "Inatuma..."}</div>
          )}
        </div>
        )}

      </div>
    </div>
  );
}
