import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Church, Home, Building2, Car, Sparkles, Check, FileText } from 'lucide-react';
import { getSwahiliDayAndDate } from '../../services/uwalemiService';

export interface FuneralScheduleBuilderProps {
  value: string;
  onChange: (scheduleText: string) => void;
  defaultLocation?: string;
  readOnly?: boolean;
  themeColor?: 'rose' | 'purple' | 'blue';
}

export const FuneralScheduleBuilder: React.FC<FuneralScheduleBuilderProps> = ({
  value,
  onChange,
  defaultLocation = 'Mbezi Makabe - Kwa Paulo',
  readOnly = false,
  themeColor = 'rose'
}) => {
  // Mode: 'structured' | 'pending' | 'custom'
  const [mode, setMode] = useState<'structured' | 'pending' | 'custom'>(() => {
    if (!value || value.toLowerCase().includes('inasubiri') || value.toLowerCase().includes('taratibu za kifamilia')) {
      return 'pending';
    }
    return 'structured';
  });

  // Kuaga details
  const [hasFarewell, setHasFarewell] = useState<boolean>(true);
  const [farewellDate, setFarewellDate] = useState<string>('');
  const [farewellTime, setFarewellTime] = useState<string>('Saa 6:00 Mchana');
  const [farewellVenueType, setFarewellVenueType] = useState<'nyumbani' | 'kanisani' | 'msikitini' | 'mochwari' | 'ukumbi' | 'nyingine'>('kanisani');
  const [farewellChurchName, setFarewellChurchName] = useState<string>('KKKT Mbezi Beach');
  const [farewellMosqueName, setFarewellMosqueName] = useState<string>('Msikiti wa Mtambani');
  const [farewellCustomVenue, setFarewellCustomVenue] = useState<string>('Nyumbani Msibani');

  // Safari details (Transit to another region/village)
  const [hasTravel, setHasTravel] = useState<boolean>(false);
  const [travelDate, setTravelDate] = useState<string>('');
  const [travelTime, setTravelTime] = useState<string>('Asubuhi saa 12:00 alfajiri');
  const [travelDestination, setTravelDestination] = useState<string>('Moshi, Kilimanjaro');

  // Mazishi details
  const [burialDate, setBurialDate] = useState<string>('');
  const [burialTime, setBurialTime] = useState<string>('Saa 9:00 Alasiri');
  const [burialLocation, setBurialLocation] = useState<string>('Kijijini Machame, Kilimanjaro');

  // Helper function to build Swahili date description with day of the week
  const formatFriendlyDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const { dayName, formattedDate } = getSwahiliDayAndDate(dateStr);
      return `${dayName} tarehe ${formattedDate}`;
    } catch {
      return dateStr;
    }
  };

  // Compile schedule string from structured fields
  const buildScheduleString = () => {
    if (mode === 'pending') {
      return 'Ratiba rasmi ya mazishi, kuaga na safari itatolewa mara baada ya taratibu za kifamilia kukamilika.';
    }

    const parts: string[] = [];

    // Part 1: Kuaga (Farewell)
    if (hasFarewell) {
      let venueText = '';
      if (farewellVenueType === 'nyumbani') {
        const homeLoc = farewellCustomVenue.trim() || defaultLocation || 'nyumbani msibani';
        venueText = `nyumbani msibani (${homeLoc})`;
      } else if (farewellVenueType === 'kanisani') {
        const chName = farewellChurchName.trim() || 'Kanisani';
        venueText = `Kanisani ${chName}`;
      } else if (farewellVenueType === 'msikitini') {
        const msqName = farewellMosqueName.trim() || 'Msikitini';
        venueText = `Msikitini ${msqName}`;
      } else if (farewellVenueType === 'mochwari') {
        const mochName = farewellCustomVenue.trim() || 'Mochwari / Hospitali';
        venueText = `katika chumba cha kuhifadhia maiti (${mochName})`;
      } else {
        venueText = farewellCustomVenue.trim() || 'eneo lililotengwa';
      }

      const fDateFormatted = formatFriendlyDate(farewellDate);
      const fTimeText = farewellTime.trim() ? `kuanzia ${farewellTime.trim()}` : '';
      const datePart = fDateFormatted ? `siku ya ${fDateFormatted}` : '';

      if (farewellVenueType === 'kanisani') {
        parts.push(`Ibada ya kuaga mwili itafanyika ${venueText} ${datePart} ${fTimeText}`.replace(/\s+/g, ' ').trim() + '.');
      } else if (farewellVenueType === 'msikitini') {
        parts.push(`Swala ya maiti na shughuli ya kuaga itafanyika ${venueText} ${datePart} ${fTimeText}`.replace(/\s+/g, ' ').trim() + '.');
      } else {
        parts.push(`Shughuli ya kutoa heshima za mwisho na kuaga mwili itafanyika ${venueText} ${datePart} ${fTimeText}`.replace(/\s+/g, ' ').trim() + '.');
      }
    }

    // Part 2: Safari (Travel to upcountry region)
    if (hasTravel) {
      const tDateFormatted = formatFriendlyDate(travelDate);
      const tDatePart = tDateFormatted ? `siku ya ${tDateFormatted}` : '';
      const tTimePart = travelTime.trim() ? `${travelTime.trim()}` : '';
      const tDest = travelDestination.trim() || 'mkoani';

      parts.push(`Safari ya kusafirisha mwili kuelekea ${tDest} itaanza ${tDatePart} ${tTimePart}`.replace(/\s+/g, ' ').trim() + '.');
    }

    // Part 3: Mazishi (Burial)
    if (burialLocation.trim() || burialDate || burialTime) {
      const bDateFormatted = formatFriendlyDate(burialDate);
      const bDatePart = bDateFormatted ? `siku ya ${bDateFormatted}` : '';
      const bTimePart = burialTime.trim() ? `${burialTime.trim()}` : '';
      const bLoc = burialLocation.trim() || 'makaburini';

      parts.push(`Mazishi yatafanyika ${bDatePart} ${bTimePart} ${bLoc}`.replace(/\s+/g, ' ').trim() + '.');
    }

    return parts.join(' ').trim() || 'Ratiba rasmi itatolewa hivi punde mara baada ya taratibu za kifamilia kukamilika.';
  };

  // Sync back to parent when structured fields change
  const applyStructuredChanges = () => {
    const compiled = buildScheduleString();
    onChange(compiled);
  };

  // When mode or internal structured fields change, update parent
  const handleModeSelect = (newMode: 'structured' | 'pending' | 'custom') => {
    setMode(newMode);
    if (newMode === 'pending') {
      onChange('Ratiba rasmi ya mazishi, kuaga na safari itatolewa mara baada ya taratibu za kifamilia kukamilika.');
    } else if (newMode === 'structured') {
      const compiled = buildScheduleString();
      onChange(compiled);
    }
  };

  const accentColor = themeColor === 'rose' 
    ? 'text-rose-400 border-rose-500/50 bg-rose-500/10' 
    : themeColor === 'purple' 
      ? 'text-purple-400 border-purple-500/50 bg-purple-500/10' 
      : 'text-blue-400 border-blue-500/50 bg-blue-500/10';

  const activeTabStyle = themeColor === 'rose'
    ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40'
    : themeColor === 'purple'
      ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
      : 'bg-blue-600 text-white shadow-md shadow-blue-900/40';

  return (
    <div className="space-y-3 p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs">
      {/* Header with Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div>
          <label className="text-white font-bold flex items-center gap-1.5 text-xs">
            <span className="text-sm">🕊️</span> 
            <span>Mpango & Ratiba ya Mazishi / Kuaga / Safari</span>
          </label>
          <p className="text-[11px] text-slate-400">
            Chagua taarifa za tarehe, mahali pa kuaga (kanisa/msikiti/nyumbani) na eneo la mazishi (Dar au Mkoa wowote).
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 self-start sm:self-center">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => handleModeSelect('pending')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              mode === 'pending' ? activeTabStyle : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⏳ Inasubiri Familia
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => handleModeSelect('structured')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
              mode === 'structured' ? activeTabStyle : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Panga Ratiba Kamili
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => handleModeSelect('custom')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              mode === 'custom' ? activeTabStyle : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ✍️ Andika Moja kwa Moja
          </button>
        </div>
      </div>

      {/* Structured Configuration Form */}
      {mode === 'structured' && (
        <div className="space-y-3.5 pt-1">
          {/* SEHEMU YA 1: KUAGA MWILI (VIEWING / FAREWELL) */}
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-rose-300 font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <Church className="w-3.5 h-3.5 text-rose-400" />
                1. Shughuli ya Kuaga Mwili (Farewell & Heshima za Mwisho)
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasFarewell}
                  disabled={readOnly}
                  onChange={(e) => {
                    setHasFarewell(e.target.checked);
                    setTimeout(applyStructuredChanges, 0);
                  }}
                  className="rounded border-slate-700 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-[11px] text-slate-300">Kuna Shughuli ya Kuaga</span>
              </label>
            </div>

            {hasFarewell && (
              <div className="space-y-2.5">
                {/* Dates & Time of Farewell */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-rose-400" />
                      Tarehe ya Kuaga
                    </label>
                    <input
                      type="date"
                      value={farewellDate}
                      disabled={readOnly}
                      onChange={(e) => {
                        setFarewellDate(e.target.value);
                        setTimeout(applyStructuredChanges, 0);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-400" />
                      Saa / Muda wa Kuaga
                    </label>
                    <input
                      type="text"
                      value={farewellTime}
                      disabled={readOnly}
                      onChange={(e) => {
                        setFarewellTime(e.target.value);
                        setTimeout(applyStructuredChanges, 0);
                      }}
                      placeholder="Mfano: Saa 6:00 Mchana / Saa 4:00 Asubuhi"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-rose-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Where to view/farewell? */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">
                    Kuaga ni Wapi? (Chagua Mahali)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { id: 'kanisani', label: '⛪ Kanisani', desc: 'Ibada ya Kuaga' },
                      { id: 'nyumbani', label: '🏠 Nyumbani Msibani', desc: 'Eneo la Msiba' },
                      { id: 'msikitini', label: '🕌 Msikitini', desc: 'Swala ya Maiti' },
                      { id: 'mochwari', label: '🏥 Hospitali / Mochwari', desc: 'Kuhifadhia Maiti' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={readOnly}
                        onClick={() => {
                          setFarewellVenueType(opt.id as any);
                          setTimeout(applyStructuredChanges, 0);
                        }}
                        className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                          farewellVenueType === opt.id
                            ? 'bg-rose-500/20 border-rose-500 text-rose-200 font-bold shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-semibold">{opt.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Specific Venue details depending on selection */}
                {farewellVenueType === 'kanisani' && (
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <label className="text-rose-300 font-semibold block text-[11px]">
                      Jina la Kanisa la Kuagia *
                    </label>
                    <input
                      type="text"
                      value={farewellChurchName}
                      disabled={readOnly}
                      onChange={(e) => {
                        setFarewellChurchName(e.target.value);
                        setTimeout(applyStructuredChanges, 0);
                      }}
                      placeholder="Mfano: KKKT Mbezi Beach / Kanisa Katoliki St. Peter Oysterbay / TAG"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-rose-500 focus:outline-none"
                    />
                    {/* Quick church denomination presets */}
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-slate-400">Mapendekezo:</span>
                      {[
                        'KKKT Mbezi Beach',
                        'Kanisa Katoliki (RC) St. Peter',
                        'KKKT Kijitonyama',
                        'Kanisa Katoliki Mbezi Makabe',
                        'TAG Living Water Centre',
                        'Anglikana St. Albans',
                        'SDA Magomeni'
                      ].map(ch => (
                        <button
                          key={ch}
                          type="button"
                          disabled={readOnly}
                          onClick={() => {
                            setFarewellChurchName(ch);
                            setTimeout(applyStructuredChanges, 0);
                          }}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] border border-slate-700 cursor-pointer"
                        >
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {farewellVenueType === 'msikitini' && (
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <label className="text-rose-300 font-semibold block text-[11px]">
                      Jina la Msikiti wa Kuswalia & Kuagia *
                    </label>
                    <input
                      type="text"
                      value={farewellMosqueName}
                      disabled={readOnly}
                      onChange={(e) => {
                        setFarewellMosqueName(e.target.value);
                        setTimeout(applyStructuredChanges, 0);
                      }}
                      placeholder="Mfano: Msikiti wa Mtambani Kinondoni / Msikiti wa Manyema"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-rose-500 focus:outline-none"
                    />
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-slate-400">Mapendekezo:</span>
                      {[
                        'Msikiti wa Mtambani Kinondoni',
                        'Msikiti wa Manyema Kariakoo',
                        'Msikiti wa Maamur Upanga',
                        'Msikiti wa Gaddafi',
                        'Msikiti wa Kijijini'
                      ].map(ms => (
                        <button
                          key={ms}
                          type="button"
                          disabled={readOnly}
                          onClick={() => {
                            setFarewellMosqueName(ms);
                            setTimeout(applyStructuredChanges, 0);
                          }}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] border border-slate-700 cursor-pointer"
                        >
                          {ms}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(farewellVenueType === 'nyumbani' || farewellVenueType === 'mochwari' || farewellVenueType === 'ukumbi' || farewellVenueType === 'nyingine') && (
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                    <label className="text-slate-300 font-semibold block text-[11px]">
                      {farewellVenueType === 'nyumbani' ? 'Eneo la Nyumba Msibani' : farewellVenueType === 'mochwari' ? 'Jina la Mochwari / Hospitali' : 'Jina la Ukumbi / Eneo'}
                    </label>
                    <input
                      type="text"
                      value={farewellCustomVenue}
                      disabled={readOnly}
                      onChange={(e) => {
                        setFarewellCustomVenue(e.target.value);
                        setTimeout(applyStructuredChanges, 0);
                      }}
                      placeholder={farewellVenueType === 'nyumbani' ? defaultLocation || 'Nyumbani Mbezi Makabe' : 'Hospitali ya Jeshi Lugalo / Muhimbili'}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-rose-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SEHEMU YA 2: SAFARI YA MWILI (OPTIONAL TRANSIT TO REGION/VILLAGE) */}
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-blue-300 font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <Car className="w-3.5 h-3.5 text-blue-400" />
                2. Safari ya Kusafirisha Mwili (Mkoani / Kijijini)
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasTravel}
                  disabled={readOnly}
                  onChange={(e) => {
                    setHasTravel(e.target.checked);
                    setTimeout(applyStructuredChanges, 0);
                  }}
                  className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-300">Kuna Safari ya Mwili Mkoani / Kijijini</span>
              </label>
            </div>

            {hasTravel && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-blue-400" />
                      Tarehe ya Kuanza Safari
                    </label>
                    <input
                      type="date"
                      value={travelDate}
                      disabled={readOnly}
                      onChange={(e) => {
                        setTravelDate(e.target.value);
                        setTimeout(applyStructuredChanges, 0);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-400" />
                      Saa ya Kuanza Safari
                    </label>
                    <input
                      type="text"
                      value={travelTime}
                      disabled={readOnly}
                      onChange={(e) => {
                        setTravelTime(e.target.value);
                        setTimeout(applyStructuredChanges, 0);
                      }}
                      placeholder="Mfano: Asubuhi saa 12:00 alfajiri"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Mkoa & Kijiji Safari Inakoelekea
                  </label>
                  <input
                    type="text"
                    value={travelDestination}
                    disabled={readOnly}
                    onChange={(e) => {
                      setTravelDestination(e.target.value);
                      setTimeout(applyStructuredChanges, 0);
                    }}
                    placeholder="Mfano: Moshi, Kilimanjaro / Arusha / Mbeya"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SEHEMU YA 3: MAZISHI (BURIAL DETAILS & ANY REGION / CEMETERY) */}
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2.5">
            <div className="border-b border-slate-800/80 pb-2">
              <span className="text-emerald-300 font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                3. Mazishi (Tarehe, Saa & Mahali pa Mazishi - Popote Tanzania au Nje)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-emerald-400" />
                  Tarehe ya Kuzika *
                </label>
                <input
                  type="date"
                  value={burialDate}
                  disabled={readOnly}
                  onChange={(e) => {
                    setBurialDate(e.target.value);
                    setTimeout(applyStructuredChanges, 0);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  Saa ya Mazishi *
                </label>
                <input
                  type="text"
                  value={burialTime}
                  disabled={readOnly}
                  onChange={(e) => {
                    setBurialTime(e.target.value);
                    setTimeout(applyStructuredChanges, 0);
                  }}
                  placeholder="Mfano: Saa 9:00 Alasiri / Saa 8:00 Mchana"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Burial Location input and easy region choices */}
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Eneo la Mazishi / Makaburi / Kijiji & Mkoa (Sio lazima Dar es Salaam!) *
              </label>
              <input
                type="text"
                value={burialLocation}
                disabled={readOnly}
                onChange={(e) => {
                  setBurialLocation(e.target.value);
                  setTimeout(applyStructuredChanges, 0);
                }}
                placeholder="Mfano: Kijijini Machame, Wilaya ya Hai, Kilimanjaro / Makaburi ya Kinondoni / Arusha / Mbeya"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-emerald-500 focus:outline-none font-medium"
              />

              {/* Quick region presets */}
              <div className="mt-2 pt-2 border-t border-slate-800/60">
                <span className="text-[10px] text-slate-400 block mb-1.5 font-semibold">
                  Chagua au Badilisha Mkoa / Eneo kwa Haraka:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '🏔️ Kilimanjaro (Machame/Moshi)', text: 'Kijijini Machame, Kilimanjaro' },
                    { label: '🏔️ Kilimanjaro (Kibosho/Marangu/Rombo)', text: 'Kijijini Kibosho, Moshi, Kilimanjaro' },
                    { label: '🌋 Arusha', text: 'Kijijini kwao Arusha' },
                    { label: '⛰️ Mbeya / Rungwe', text: 'Kijijini kwao Mbeya' },
                    { label: '🌴 Tanga / Lushoto', text: 'Lushoto, Mkoa wa Tanga' },
                    { label: '🌾 Morogoro', text: 'Mkoa wa Morogoro' },
                    { label: '🌿 Iringa', text: 'Kijijini kwao Iringa' },
                    { label: '🏛️ Dodoma', text: 'Dodoma' },
                    { label: '🏡 Kijijini kwao (Popote)', text: 'Kijijini kwao' },
                    { label: '📍 Dar (Makaburi ya Mbezi Makabe)', text: 'Makaburini Mbezi Makabe, Dar es Salaam' },
                    { label: '📍 Dar (Makaburi ya Kinondoni)', text: 'Makaburi ya Kinondoni, Dar es Salaam' },
                    { label: '📍 Dar (Makaburi ya Segerea/Kinyerezi)', text: 'Makaburini Segerea, Dar es Salaam' },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={readOnly}
                      onClick={() => {
                        setBurialLocation(preset.text);
                        setTimeout(applyStructuredChanges, 0);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white text-[10px] border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode: Custom / Direct Text Editing */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-slate-300 font-bold block flex items-center gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            Maandishi ya Ratiba Yatakayoingizwa kwenye SMS & Mfuko:
          </label>
          <span className="text-[10px] text-slate-400">
            {mode === 'structured' ? '✓ Inajiunda papo hapo kulingana na chaguo zako hapo juu' : 'Unaweza kuhariri moja kwa moja'}
          </span>
        </div>

        <textarea
          rows={3}
          value={value || ''}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Mfano: Ibada ya kuaga mwili itafanyika Kanisani KKKT Mbezi Beach Jumamosi tarehe 26/09/2026 saa 6:00 mchana, na mazishi yatafanyika Jumapili tarehe 27/09/2026 saa 9:00 alasiri Kijijini Machame, Kilimanjaro."
          className="w-full bg-slate-900 border border-slate-700/90 rounded-xl px-3 py-2 text-white text-xs placeholder:text-slate-500 focus:border-rose-500 focus:outline-none leading-relaxed"
        />

        {/* Quick helper buttons */}
        <div className="flex flex-wrap gap-1.5 pt-1 items-center">
          <span className="text-[10px] text-slate-400">Violezo vya Haraka:</span>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              setMode('pending');
              onChange('Ratiba rasmi ya mazishi, kuaga na safari itatolewa mara baada ya taratibu za kifamilia kukamilika.');
            }}
            className="px-2 py-0.5 rounded-md bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-[10px] border border-rose-700/50 cursor-pointer"
          >
            ⏳ Inasubiri Familia
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              setMode('structured');
              setFarewellVenueType('kanisani');
              setFarewellChurchName('KKKT Mbezi Beach');
              setHasTravel(true);
              setTravelDestination('Moshi, Kilimanjaro');
              setBurialLocation('Kijijini Machame, Kilimanjaro');
              onChange('Ibada ya kuaga itafanyika Kanisani KKKT Mbezi Beach kuanzia saa 6:00 mchana. Safari ya kusafirisha mwili kuelekea Moshi, Kilimanjaro itaanza asubuhi, na mazishi yatafanyika saa 9:00 alasiri Kijijini Machame, Kilimanjaro.');
            }}
            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 cursor-pointer"
          >
            ⛪ Kanisani & Mazishi Mkoani (Kilimanjaro)
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              setMode('structured');
              setFarewellVenueType('nyumbani');
              setHasTravel(false);
              setBurialLocation('Makaburini Mbezi Makabe, Dar es Salaam');
              onChange('Kuaga kutafanyika nyumbani msibani Mbezi Makabe kuanzia saa 6:00 mchana, na mazishi yatafanyika saa 9:00 alasiri Makaburini Mbezi Makabe, Dar es Salaam.');
            }}
            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 cursor-pointer"
          >
            🏠 Nyumbani & Mazishi Dar es Salaam
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              setMode('structured');
              setFarewellVenueType('msikitini');
              setFarewellMosqueName('Msikiti wa Mtambani');
              setHasTravel(false);
              setBurialLocation('Makaburi ya Kinondoni');
              onChange('Swala ya maiti na kuaga itafanyika Msikitini Mtambani kuanzia saa 7:00 mchana, na mazishi yatafanyika saa 10:00 jioni Makaburi ya Kinondoni.');
            }}
            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 cursor-pointer"
          >
            🕌 Msikitini & Makaburini
          </button>
        </div>
      </div>
    </div>
  );
};
