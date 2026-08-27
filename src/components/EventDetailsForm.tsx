import React, { useState, useEffect } from 'react';
import { Save, Calendar, Clock, MapPin, Layers, Phone, Edit3, User, Check, Heart, Eye } from 'lucide-react';
import { EventDetails } from '../types';
import { useLanguage } from '../context/LanguageContext';

const extractCoordinates = (url: string): string => {
  if (!url) return '';
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch && atMatch[1] && atMatch[2]) {
    return `${atMatch[1]}, ${atMatch[2]}`;
  }
  const qMatch = url.match(/[?&](q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch && qMatch[2] && qMatch[3]) {
    return `${qMatch[2]}, ${qMatch[3]}`;
  }
  const generalMatch = url.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (generalMatch && generalMatch[1] && generalMatch[2]) {
    return `${generalMatch[1]}, ${generalMatch[2]}`;
  }
  return '';
};

interface EventDetailsFormProps {
  initialData: EventDetails;
  isAlreadySaved: boolean;
  onSave: (data: EventDetails, oldId?: string) => void;
  onDelete?: () => void;
}

export default function EventDetailsForm({ initialData, isAlreadySaved, onSave, onDelete }: EventDetailsFormProps) {
  const { language, t } = useLanguage();
  const [formData, setFormData] = useState<EventDetails>({ ...initialData });
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(!isAlreadySaved);

  useEffect(() => {
    setFormData({ ...initialData });
    setIsEditing(!isAlreadySaved);
  }, [initialData, isAlreadySaved]);

  const getFieldHelp = (fieldName: keyof EventDetails, fallbackPlaceholder: string) => {
    let val = (formData[fieldName] as string) || "";
    
    // If the saved data exactly matches one of our default sample placeholders, 
    // treat it as empty so it shows up as a faint placeholder that disappears when typing.
    const samplePlaceholders = [
      "Wedding of Jimson",
      "Isamuhyo Hall - Mbezi Beach",
      "-6.7924, 39.2083",
      "Ramadhani & Family",
      "White & Gold",
      "Ally",
      "+255 712 345 678",
      "Aisha",
      "+255 789 012 345",
      "Harusi ya Jimson Lema",
      "Mlimani City Complex, Dar es Salaam",
      "Fanuel Lema",
      "Royal Blue & Emerald Green",
      "+255 784 999 888",
      "Ally Swai (Mwenyekiti)",
      "Irene Lema (Katibu)"
    ];
    
    if (samplePlaceholders.includes(val)) {
      val = "";
    }
    
    return {
      value: val,
      placeholder: fallbackPlaceholder
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const defaults: Record<string, string> = {
      name: "Harusi ya Jimson Lema",
      hostName: "Fanuel Lema",
      date: "2026-08-06",
      time: "18:30",
      eventHallName: "Mlimani City Complex, Dar es Salaam",
      coordinates: "-6.7924, 39.2083",
      dressCode: "Royal Blue & Emerald Green",
      contact1: "+255 712 345 678",
      contact1Name: "Ally Swai (Mwenyekiti)",
      contact2: "+255 784 999 888",
      contact2Name: "Irene Lema (Katibu)",
    };

    const savedData = { ...formData };
    if (formData.id === 'wedding-jimson-lema' || formData.id === 'wedding-jimson-aisha') {
      (Object.keys(defaults) as Array<keyof EventDetails>).forEach((key) => {
        if (!savedData[key]) {
          // @ts-ignore
          savedData[key] = defaults[key];
        }
      });
    }

    onSave(savedData, initialData.id);
    setIsSaved(true);
    setIsEditing(false);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[1.75rem] shadow-2xl p-6 sm:p-8 space-y-6 font-sans text-xs text-white" id="event-form-container">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-405" />
            <span>
              {isEditing 
                ? (language === 'sw' ? 'Sanidi / Hariri Taarifa za Sherehe' : 'Configure / Edit Event Information')
                : (language === 'sw' ? 'Taarifa za Sherehe Zilizohifadhiwa' : 'Registered Event Information')}
            </span>
          </h2>
          <p className="text-slate-350 mt-0.5">
            {language === 'sw' 
              ? 'Thibitisha na hifadhi maelezo ya sherehe yako ili yawekwe kwenye kadi za wageni.'
              : 'Provide or modify the ceremony data structures to render onto generated visitor invites.'}
          </p>
        </div>

        {/* Buttons for already saved events */}
        {!isEditing && isAlreadySaved && (
          <div className="flex space-x-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-blue-500/30 text-white px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>{language === 'sw' ? 'Hariri Taarifa (Edit Event)' : 'Edit Event Details'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 mb-2 animate-fade-in">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            {language === 'sw' ? 'Kitambulisho (Event ID)' : 'System Event ID'}
          </span>
          <span className="font-mono font-bold text-blue-300 text-sm mt-0.5">
            {formData.id}
          </span>
        </div>
        <div className="px-2 py-1 bg-white/5 rounded text-[10px] text-slate-400 font-medium">
          {language === 'sw' ? 'Imetengenezwa Kiotomatiki' : 'Auto-Generated'}
        </div>
      </div>

      {isSaved && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold rounded-xl flex items-center space-x-2 text-[11px] animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            {language === 'sw' ? 'Taarifa zimehifadhiwa kikamilifu kwenye database ya mradi!' : 'Event details successfully committed and safely updated!'}
          </span>
        </div>
      )}

      {/* VIEW MODE LAYOUT (READ-ONLY) */}
      {!isEditing ? (
        <div className="space-y-6 animate-fade-in" id="event-view-mode-panel">
          
          {/* Main Visual Title Header Card */}
          <div className={`p-6 rounded-2xl border border-white/10 space-y-3 relative overflow-hidden ${formData.eventImgUrl ? 'h-48 flex flex-col justify-end' : 'bg-gradient-to-br from-blue-900/20 via-slate-900/40 to-purple-900/20'}`}>
            {formData.eventImgUrl ? (
              <div className="absolute inset-0 z-0">
                <img src={formData.eventImgUrl} alt="Event Cover" className="w-full h-full object-cover opacity-40" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent"></div>
              </div>
            ) : (
              <>
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-5 -mt-5" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl -ml-5 -mb-5" />
              </>
            )}
            
            <div className="relative z-10 flex items-center space-x-2">
              <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full border border-blue-500/30 font-mono text-[9px] font-bold uppercase tracking-wider">
                {formData.senderId || 'EVENT'}
              </span>
              <span className="text-slate-400 text-[10px] font-mono">ID: {formData.id}</span>
            </div>

            <h3 className="relative z-10 text-base sm:text-xl font-extrabold text-[#f8fafc] tracking-tight leading-snug">
              {formData.name || (language === 'sw' ? 'Bado Jina la Sherehe Halijawekwa' : 'Untitled Event')}
            </h3>
          </div>

          {/* Details Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Left Box: DateTime & Venue schedule */}
            <div className="p-5 bg-white/5 border border-white/5 rounded-2xl space-y-4">
              <h4 className="font-bold text-blue-400 text-[11px] tracking-wider uppercase font-mono border-b border-white/5 pb-2">
                {language === 'sw' ? 'LIV RATIBA & ENEO' : 'SCHEDULE & LOCATION'}
              </h4>

              <div className="space-y-3.5 text-[11.5px]">
                <div className="flex items-start space-x-3">
                  <Calendar className="w-4 h-4 text-blue-405 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-mono">Tarehe ya Tukio (Date)</p>
                    <p className="font-semibold text-white mt-0.5">{formData.date || 'Not Provided'}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Clock className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-mono">Muda wa Kuanza (Time)</p>
                    <p className="font-semibold text-white mt-0.5">
                      {formData.time || 'Not Provided'} ({formData.period || 'Mchana'})
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <MapPin className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-mono">Ukumbi (Venue Hall)</p>
                    <p className="font-semibold text-white mt-0.5">{formData.eventHallName || 'Not Provided'}</p>
                  </div>
                </div>

                {formData.coordinates && (
                  <div className="flex items-start space-x-3 pt-1">
                    <div className="w-4 h-4 flex items-center justify-center text-emerald-400 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-mono">GPS Coordinates</p>
                      <span className="font-mono text-emerald-300 text-[10.5px] font-bold">{formData.coordinates}</span>
                    </div>
                  </div>
                )}

                {formData.mapsLink && (
                  <div className="flex items-start space-x-3 pt-1">
                    <div className="w-4 h-4 flex items-center justify-center text-blue-400 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                    <div className="min-w-0 pr-1">
                      <p className="text-slate-400 text-[10px] uppercase font-mono">Google Maps Link</p>
                      <a 
                        href={formData.mapsLink} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-blue-400 text-[10.5px] font-bold block truncate hover:underline"
                        title={formData.mapsLink}
                      >
                        {formData.mapsLink}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Box: Family, Dress Code & Contacts */}
            <div className="p-5 bg-white/5 border border-white/5 rounded-2xl space-y-4">
              <h4 className="font-bold text-purple-400 text-[11px] tracking-wider uppercase font-mono border-b border-white/5 pb-2">
                {language === 'sw' ? 'WAANDAJI & MAVAZI' : 'HOSTS & DRESSCODE'}
              </h4>

              <div className="space-y-3.5 text-[11.5px]">
                <div className="flex items-start space-x-3">
                  <User className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-mono">Waandaji wa Sherehe (Hosts)</p>
                    <p className="font-semibold text-white mt-0.5">{formData.hostName || 'Not Provided'}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Heart className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-mono">Mavazi (Dress Code)</p>
                    <p className="font-semibold text-white mt-0.5">{formData.dressCode || 'Not Specified'}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Phone className="w-4 h-4 text-blue-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-mono">Namba za Maswali RSVP</p>
                    <div className="space-y-1 mt-0.5 font-mono text-[10.5px] font-semibold text-blue-200">
                      {formData.contact1 && <p>📞 {formData.contact1Name ? `${formData.contact1Name}: ` : ''}{formData.contact1}</p>}
                      {formData.contact2 && <p>📞 {formData.contact2Name ? `${formData.contact2Name}: ` : ''}{formData.contact2}</p>}
                      {formData.contact3 && <p>📞 {formData.contact3Name ? `${formData.contact3Name}: ` : ''}{formData.contact3}</p>}
                      {!formData.contact1 && !formData.contact2 && !formData.contact3 && <p className="text-slate-500">None provided</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Action indicator warning */}
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-slate-300 flex items-start space-x-2">
            <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[10px] leading-normal leading-relaxed">
              {language === 'sw' 
                ? 'Kama unataka kubadilisha ukumbi, muda, au code ya mavazi wakati wowote, bofya kitufe cha "Hariri Taarifa" hapo juu.'
                : 'If you wish to modify coordinates, time, or dresscode, simply click "Edit Event Details" to update the values live.'}
            </p>
          </div>

        </div>
      ) : (
        /* EDIT / CREATE FORM MODE */
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* General Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Sender ID (Event Type) */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 block" htmlFor="input-sender-id">
                {language === 'sw' ? 'Aina ya Tukio (SENDER ID / Harusi / Send-off)' : 'Event Type (Top Badge Header)'}
              </label>
              <select 
                id="input-sender-id"
                required
                value={formData.senderId}
                onChange={(e) => setFormData({ ...formData, senderId: e.target.value })}
                className="w-full bg-[#050b18] border border-[#1b253b] rounded-xl px-4 py-2.5 text-white focus:outline-[#2563eb] cursor-pointer"
              >
                <option value="" disabled>-- Chagua Aina ya Tukio --</option>
                <option value="HARUSI">HARUSI (Wedding)</option>
                <option value="SEND OFF">SEND OFF (Pre-marriage)</option>
                <option value="KIPAIMARA">KIPAIMARA (Confirmation)</option>
                <option value="MKUTANO">MKUTANO (Meeting)</option>
                <option value="MWALIKO MAALUM">MWALIKO MAALUM (Private Invite)</option>
                <option value="SHEREHE MAALUM">SHEREHE MAALUM (Special Party)</option>
              </select>
            </div>

            {/* Event Name */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 block" htmlFor="input-event-name">
                {language === 'sw' ? 'Jina la Sherehe (Event Title)' : 'Official Event Name (Title)'}
              </label>
              <input 
                id="input-event-name"
                type="text"
                required
                value={getFieldHelp('name', 'Wedding of Jimson').value}
                placeholder={getFieldHelp('name', 'Wedding of Jimson').placeholder}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-bold placeholder-slate-500/50"
              />
            </div>

            {/* Unique Event ID (Added by request) */}
            <div className="space-y-1 md:col-span-2">
              <div className="flex justify-between items-center">
                <label className="font-semibold text-slate-300 block text-xs" htmlFor="input-event-id">
                  {language === 'sw' ? 'ID ya Kipekee ya Sherehe (Unique Event ID)' : 'Unique Event ID (ID / Slug)'}
                </label>
                <span className="text-[10px] text-amber-400 italic">
                  *{language === 'sw' ? 'Herufi, namba na alama ya - tu' : 'Only letters, numbers, and - allowed'}
                </span>
              </div>
              <input 
                id="input-event-id"
                type="text"
                required
                value={formData.id}
                onChange={(e) => {
                  const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
                  setFormData({ ...formData, id: sanitized });
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder-slate-500"
                placeholder={language === 'sw' ? 'Mfano: harusi-ya-lema' : 'e.g. wedding-of-lema'}
              />
              <p className="text-[10px] text-slate-400 leading-normal">
                {language === 'sw' 
                  ? '⚠️ Kubadilisha ID hii kitahamisha wageni wote kuwa chini ya ID mpya. Hakikisha ni ya kipekee na kamilifu.'
                  : '⚠️ Changing this Event ID slug will migrate all guest references and credentials to the new ID.'}
              </p>
            </div>

          </div>

          {/* Date, Time & Period Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
            
            {/* Date */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 flex items-center gap-1" htmlFor="input-event-date">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>{language === 'sw' ? 'Tarehe ya Sherehe' : 'Event Calendar Date'}</span>
              </label>
              <input 
                id="input-event-date"
                type="date"
                required
                value={getFieldHelp('date', '').value}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-[#050b18] border border-[#1b253b] rounded-xl px-4 py-2.5 text-white focus:outline-[#2563eb] cursor-pointer font-bold text-xs"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            {/* Contribution Deadline */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 flex items-center gap-1" htmlFor="input-contribution-deadline">
                <Calendar className="w-3.5 h-3.5 text-rose-400" />
                <span>{language === 'sw' ? 'Mwisho wa Michango' : 'Pledge Deadline'}</span>
              </label>
              <input 
                id="input-contribution-deadline"
                type="date"
                value={formData.contributionDeadline || ''}
                onChange={(e) => setFormData({ ...formData, contributionDeadline: e.target.value })}
                className="w-full bg-[#050b18] border border-[#1b253b] rounded-xl px-4 py-2.5 text-white focus:outline-[#2563eb] cursor-pointer font-bold text-xs"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            {/* Time */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 flex items-center gap-1" htmlFor="input-event-time">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span>{language === 'sw' ? 'Saa ya Kuanza (Format ya Saa)' : 'Opening Hour (Time format)'}</span>
              </label>
              <input 
                id="input-event-time"
                type="time"
                required
                value={getFieldHelp('time', '').value}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full bg-[#050b18] border border-[#1b253b] rounded-xl px-4 py-2.5 text-white focus:outline-[#2563eb] cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            {/* Period Selection */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 block" htmlFor="input-event-period">
                {language === 'sw' ? 'Muda wa Siku (Period)' : 'Time of Day (Period)'}
              </label>
              <select
                id="input-event-period"
                value={formData.period}
                onChange={(e) => setFormData({ ...formData, period: e.target.value as any })}
                className="w-full bg-[#050b18] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-[#2563eb] cursor-pointer font-bold"
              >
                <option value="Asubuhi" className="bg-[#050b18] text-white">
                  {language === 'sw' ? 'Asubuhi (Morning)' : 'Asubuhi (Morning)'}
                </option>
                <option value="Mchana" className="bg-[#050b18] text-white">
                  {language === 'sw' ? 'Mchana (Afternoon)' : 'Mchana (Afternoon)'}
                </option>
                <option value="Jioni" className="bg-[#050b18] text-white">
                  {language === 'sw' ? 'Jioni (Evening)' : 'Jioni (Evening)'}
                </option>
                <option value="Usiku" className="bg-[#050b18] text-white">
                  {language === 'sw' ? 'Usiku (Night)' : 'Usiku (Night)'}
                </option>
              </select>
            </div>

          </div>

                   {/* Location & Maps coordinates */}
          <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/10">
            <h4 className="font-bold text-rose-400 text-[11px] tracking-wider uppercase font-mono">
              {language === 'sw' ? 'MIPANGILIO YA RAMANI & MAHALI' : 'MAPS & VENUE LOCATION CONFIG'}
            </h4>
            
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 block text-[11px]" htmlFor="input-maps-link">
                {language === 'sw' ? 'Kiungo cha Google Maps (Google Maps Link)' : 'Google Maps Location Link'}
              </label>
              <div className="flex gap-2 items-center">
                <input 
                  id="input-maps-link"
                  type="text"
                  placeholder={language === 'sw' ? 'Weka au paste kiungo cha Google Maps hapa...' : 'Paste Google Maps URL here (e.g., https://maps.app.goo.gl/...)'}
                  value={formData.mapsLink || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const extracted = extractCoordinates(val);
                    setFormData({
                      ...formData,
                      mapsLink: val,
                      coordinates: extracted || formData.coordinates
                    });
                  }}
                  className="flex-1 bg-[#050b18] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-[#2563eb] transition-all placeholder-slate-500"
                />
                {(!formData.mapsLink || formData.mapsLink.trim().length === 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      const hall = formData.eventHallName || formData.name || 'Ukumbi';
                      const generated = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hall + ' Dar es Salaam')}`;
                      setFormData({ ...formData, mapsLink: generated });
                    }}
                    className="shrink-0 px-3 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    🗺️ {language === 'sw' ? 'Tengeneza Link ya Ramani' : 'Auto-Generate Link'}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                {language === 'sw' 
                  ? 'Ukishikilia na kupaste link ya ramani ya Google Maps hapa, coordinates zitajazwa zenyewe automatically chini.'
                  : 'Pasting a Google Maps link here will automatically parse and pre-populate the precise latitude/longitude inputs below.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Hall Name */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 flex items-center gap-1" htmlFor="input-hall-name">
                  <MapPin className="w-3.5 h-3.5 text-rose-450" />
                  <span>{language === 'sw' ? 'Jina la Jengo/Ukumbi (Hall Name)' : 'Reception Hall / Venue Name'}</span>
                </label>
                <input 
                  id="input-hall-name"
                  type="text"
                  required
                  value={getFieldHelp('eventHallName', 'Isamuhyo Hall - Mbezi Beach').value}
                  placeholder={getFieldHelp('eventHallName', 'Isamuhyo Hall - Mbezi Beach').placeholder}
                  onChange={(e) => setFormData({ ...formData, eventHallName: e.target.value })}
                  className="w-full bg-[#050b18] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-[#2563eb] transition-all placeholder-slate-500/50"
                />
              </div>

              {/* Coordinates */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-slate-300 block text-[11px]" htmlFor="input-coordinates">
                    {language === 'sw' ? 'Coordinates za GPS Ramani' : 'Map Latitude, Longitude (Coordinates)'}
                  </label>
                  <span className="text-[10px] text-slate-450 italic">
                    {language === 'sw' ? 'Mfano: -6.85202, 39.27158' : 'Sample: -6.85202, 39.27158'}
                  </span>
                </div>
                <input 
                  id="input-coordinates"
                  type="text"
                  value={getFieldHelp('coordinates', '-6.7924, 39.2083').value}
                  placeholder={getFieldHelp('coordinates', '-6.7924, 39.2083').placeholder}
                  onChange={(e) => setFormData({ ...formData, coordinates: e.target.value })}
                  className="w-full bg-[#050b18] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-[#2563eb] transition-all font-mono placeholder-slate-500/50"
                />
              </div>
            </div>
          </div>

          {/* Host details & Dress Code */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Host Name */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 block" htmlFor="input-host-name">
                {language === 'sw' ? 'Waandaji wa Sherehe (Host Name)' : 'Event Organizers / Host Name'}
              </label>
              <input 
                id="input-host-name"
                type="text"
                required
                value={getFieldHelp('hostName', 'Ramadhani & Family').value}
                placeholder={getFieldHelp('hostName', 'Ramadhani & Family').placeholder}
                onChange={(e) => setFormData({ ...formData, hostName: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder-slate-500/50"
              />
            </div>

            {/* Dress Code */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 block" htmlFor="input-dress-code">
                {language === 'sw' ? 'Code ya Mavazi (Dress Code)' : 'Dress Code Theme'}
              </label>
              <input 
                id="input-dress-code"
                type="text"
                value={getFieldHelp('dressCode', 'White & Gold').value}
                placeholder={getFieldHelp('dressCode', 'White & Gold').placeholder}
                onChange={(e) => setFormData({ ...formData, dressCode: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder-slate-500/50"
              />
            </div>

            {/* Spacer before submit */}
            <div className="col-span-1 md:col-span-2 pt-4"></div>

          </div>

          {/* VIP Contacts for RSVP Responses */}
          <div className="space-y-2">
            <h4 className="font-bold text-blue-400 flex items-center gap-1.5 border-t border-white/10 pt-4">
              <Phone className="w-3.5 h-3.5" />
              <span>
                {language === 'sw' ? 'Vipengele vya RSVP (Namba Tatu za Maswali)' : 'RSVP Contact Center (3 Hotline numbers)'}
              </span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="space-y-1">
                <label className="font-mono text-[10px] text-slate-400 block" htmlFor="input-contact1">
                  RSVP 1 ({language === 'sw' ? 'Lazima' : 'Required'})
                </label>
                <div className="flex flex-col gap-2">
                  <input 
                    type="text"
                    value={getFieldHelp('contact1Name', 'Ally').value}
                    placeholder={getFieldHelp('contact1Name', 'Ally').placeholder}
                    onChange={(e) => setFormData({ ...formData, contact1Name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-mono placeholder-slate-500/50"
                  />
                  <input 
                    id="input-contact1"
                    type="text"
                    required
                    value={getFieldHelp('contact1', '+255 712 345 678').value}
                    placeholder={getFieldHelp('contact1', '+255 712 345 678').placeholder}
                    onChange={(e) => setFormData({ ...formData, contact1: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono placeholder-slate-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] text-slate-400 block" htmlFor="input-contact2">
                  RSVP 2 ({language === 'sw' ? 'Hiyari' : 'Optional'})
                </label>
                <div className="flex flex-col gap-2">
                  <input 
                    type="text"
                    value={getFieldHelp('contact2Name', 'Aisha').value}
                    placeholder={getFieldHelp('contact2Name', 'Aisha').placeholder}
                    onChange={(e) => setFormData({ ...formData, contact2Name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-mono placeholder-slate-500/50"
                  />
                  <input 
                    id="input-contact2"
                    type="text"
                    value={getFieldHelp('contact2', '+255 789 012 345').value}
                    placeholder={getFieldHelp('contact2', '+255 789 012 345').placeholder}
                    onChange={(e) => setFormData({ ...formData, contact2: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono placeholder-slate-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] text-slate-400 block" htmlFor="input-contact3">
                  RSVP 3 ({language === 'sw' ? 'Hiyari' : 'Optional'})
                </label>
                <div className="flex flex-col gap-2">
                  <input 
                    type="text"
                    value={getFieldHelp('contact3Name', language === 'sw' ? 'Jina' : 'Name').value}
                    placeholder={getFieldHelp('contact3Name', language === 'sw' ? 'Jina' : 'Name').placeholder}
                    onChange={(e) => setFormData({ ...formData, contact3Name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-mono placeholder-slate-500/50"
                  />
                  <input 
                    id="input-contact3"
                    type="text"
                    value={getFieldHelp('contact3', '0682 444 555').value}
                    placeholder={getFieldHelp('contact3', '0682 444 555').placeholder}
                    onChange={(e) => setFormData({ ...formData, contact3: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono placeholder-slate-500/50"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Event Official Image & Logo Section */}
          <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/10">
            <h4 className="font-bold text-blue-400 text-[11px] tracking-wider uppercase font-mono flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" />
              <span>{t('form.labelEventCover')}</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="font-semibold text-slate-300 block text-[11px]">
                  {t('form.labelEventCover')}
                </label>
                <div className="flex flex-col space-y-2">
                  <input 
                    type="file"
                    id="event-img-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const dataUrl = event.target?.result as string;
                          if (dataUrl) {
                            const img = new Image();
                            img.onload = () => {
                              const canvas = document.createElement('canvas');
                              let width = img.width;
                              let height = img.height;
                              const maxW = 2048; // Imeongezwa kuruhusu ubora wa hali ya juu (high-res)
                              if (width > maxW) {
                                height = (maxW / width) * height;
                                width = maxW;
                              }
                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext('2d');
                              ctx?.drawImage(img, 0, 0, width, height);
                              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.95);

                              setFormData({ ...formData, eventImgUrl: compressedDataUrl });
                            };
                            img.src = dataUrl;
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <label 
                    htmlFor="event-img-upload"
                    className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl text-blue-300 font-bold text-[10px] cursor-pointer transition flex items-center justify-center space-x-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>{formData.eventImgUrl ? t('form.btnChange') : t('form.btnUpload')}</span>
                  </label>
                  
                  {formData.eventImgUrl && (
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[9px] text-blue-400 font-bold">✓ Picha imepakiwa</span>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, eventImgUrl: undefined })}
                        className="text-rose-400 hover:text-rose-300 text-[9px] font-bold underline cursor-pointer"
                      >
                        {language === 'sw' ? 'Futa' : 'Remove'}
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed italic border-l-2 border-blue-500/30 pl-2 mt-2">
                  {t('form.eventCoverHint')}
                </p>
              </div>

              {/* Preview Box */}
              <div className="flex justify-center md:justify-end items-center">
                <div className="w-full max-w-[200px] aspect-[3/4] bg-black/40 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center relative shadow-inner">
                  {formData.eventImgUrl ? (
                    <img src={formData.eventImgUrl} alt="Event Hero Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4 space-y-2 opacity-20">
                      <Eye className="w-8 h-8 mx-auto text-slate-500" />
                      <p className="text-[9px] font-mono uppercase font-bold text-slate-500 text-center">Hero Preview</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Buttons / Actions */}
          <div className="flex justify-between items-center pt-4 border-t border-white/10">
            {isAlreadySaved && (
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...initialData });
                  setIsEditing(false);
                }}
                className="px-4 py-2 text-slate-400 hover:text-white transition font-bold"
              >
                {language === 'sw' ? 'Ghairi (Cancel)' : 'Cancel'}
              </button>
            )}
            <div className="flex-grow flex justify-end">
              <button
                type="submit"
                id="event-save-btn"
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] text-white font-bold rounded-xl transition shadow flex items-center space-x-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>
                  {language === 'sw' ? 'Hifadhi Taarifa (Save Event)' : 'Save Event Details ✓'}
                </span>
              </button>
            </div>
          </div>

        </form>
      )}
    </div>
  );
}
