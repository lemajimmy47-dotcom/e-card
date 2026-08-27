import React from 'react';
import { motion } from 'motion/react';
import { Calendar, Heart, Share2, MessageSquare } from 'lucide-react';
import { Guest, EventDetails } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  guest: Guest;
  event: EventDetails;
  saveTheDateImage?: string; // Loaded base64 image or default placeholder
  customMessage?: string;
}

export default function GuestSaveTheDatePage({ guest, event, saveTheDateImage, customMessage }: Props) {
  const { language, setLanguage } = useLanguage();
  const isEn = language === 'en';

  // Try to find if there is a custom image in saveTheDates on local storage fallback
  const getSaveTheDateImage = () => {
    if (saveTheDateImage) return saveTheDateImage;
    
    // Check local storage for template image or fallback
    try {
      const savedStds = localStorage.getItem('kadi_save_the_dates');
      if (savedStds) {
        const stds = JSON.parse(savedStds);
        const match = stds.find((s: any) => s.event_id === event.id);
        if (match && match.image_url) {
          return match.image_url;
        }
      }
    } catch {
      // ignore
    }

    return "";
  };

  const activeImage = getSaveTheDateImage();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center py-10 px-4 font-sans relative pb-32 overflow-hidden">
      {/* Floating Language Switcher */}
      <div className="absolute top-4 right-4 z-50 flex gap-1 bg-white/5 border border-white/10 p-1 rounded-full backdrop-blur-md">
        <button
          type="button"
          onClick={() => setLanguage('sw')}
          className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all cursor-pointer ${!isEn ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md' : 'text-slate-450 hover:text-white'}`}
        >
          SW
        </button>
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all cursor-pointer ${isEn ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md' : 'text-slate-455 hover:text-white'}`}
        >
          EN
        </button>
      </div>

      {/* Background radial glow */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-rose-500/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-[440px] space-y-6 z-10 relative">
        <div className="text-center space-y-2">
          <span className="px-4 py-1.5 bg-rose-500/10 text-rose-450 border border-rose-500/20 rounded-full text-[10px] font-extrabold uppercase tracking-widest inline-flex items-center gap-1">
            <Heart className="w-3 h-3 fill-rose-500 animate-pulse" />
            <span>SAVE THE DATE</span>
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight uppercase mt-2">
            {isEn ? "SAVE OUR DATE" : "HIFADHI TAREHE YETU"}
          </h1>
          <p className="text-xs text-slate-400">
            {isEn ? "Dear" : "Mpendwa"} <span className="font-bold text-rose-300 uppercase">{guest.name}</span>, {isEn ? "please save the date for our ceremony." : "tafadhali hifadhi tarehe ya sherehe yetu."}
          </p>
        </div>

        {/* Elegant aspect-ratio matched Save the Date Card Container (matching 9:13 aspect ratio exactly) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-full aspect-[450/650] max-w-[360px] rounded-[1.75rem] overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(244,63,94,0.15)] bg-slate-900 relative group"
        >
          {activeImage ? (
            <img 
              referrerPolicy="no-referrer"
              src={activeImage} 
              alt="Save The Date Card" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
              <h2 className="text-2xl font-black uppercase tracking-tight text-white/50">Save The Date</h2>
              <p className="text-xs text-white/40">{event.name}</p>
            </div>
          )}
          {/* Subtle overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-6 text-center">
            <p className="text-xl font-mono font-bold text-white tracking-widest uppercase mb-1">
              {event.name || (isEn ? "SPECIAL EVENT" : "SHEREHE MAALUM")}
            </p>
            <p className="text-xs text-rose-300 font-bold tracking-widest uppercase mb-3">
              {isEn ? "DATE:" : "TAREHE:"} {event.date}
            </p>
            <div className="w-[100px] h-[1px] bg-rose-500/50 mx-auto mb-2"></div>
            <p className="text-[10px] text-slate-400 italic">
              {isEn ? '"Your presence is our joy"' : '"Ushiriki wako ni furaha yetu"'}
            </p>
          </div>
        </motion.div>

        {/* Dynamic Swahili Invitation message */}
        <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-5 shadow-inner backdrop-blur-md text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto border border-rose-500/25">
            <Calendar className="w-5 h-5 text-rose-400" />
          </div>
          <div className="space-y-2">
            <h3 className="font-extrabold text-rose-400 text-sm uppercase tracking-wide">{isEn ? "Event Details" : "Taarifa za Sherehe"}</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {isEn ? "The " : "Familia ya "}<span className="font-bold text-white">{event.hostName || (isEn ? "Hosts" : "Waandaji")}</span> {isEn ? "family is pleased to inform you that the preparations for our " : "inayo furaha kukujulisha kuwa maandalizi ya sherehe yetu ya "}<span className="font-bold text-white">{event.name}</span> {isEn ? "ceremony are progressing with great success." : "yanasonga mbele kwa ufanisi mkubwa."}
            </p>
            <p className="text-xs text-slate-300 leading-relaxed font-sans mt-2">
              {isEn ? "Please save the date of " : "Tafadhali karibu uhifadhi tarehe ya "}<span className="font-bold text-rose-300">{event.date}</span>. {isEn ? "A formal invitation with a digital admission card and QR Code will be sent to you soon via your phone number. Stay tuned!" : "Mwaliko rasmi ukiwa na kadi ya kiingilio ya kidigitali yenye QR Code utatumwa kwako hivi karibuni kupitia namba yako ya simu. Stay tuned!"}
            </p>
          </div>

          <div className="pt-2">
            <button 
              onClick={() => {
                const titleStr = encodeURIComponent(`Save the Date: ${event.name}`);
                const dateClean = event.date.replace(/-/g, '');
                window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titleStr}&dates=${dateClean}/${dateClean}`, '_blank');
              }}
              className="px-5 py-3 w-full bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition border border-white/15 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-rose-400" />
              <span>{isEn ? "Add to Your Calendar" : "Weka Kwenye Kalenda Yako"}</span>
            </button>
          </div>
        </div>

        {/* Footer info box */}
        <div className="text-center text-[10px] text-slate-500 space-y-1">
          <p>© EVENTCARD DIGITAL SYSTEM - All Rights Reserved</p>
          <p>{isEn ? "This invitation is digitally crafted with high quality." : "Mwaliko huu umetengenezwa kidigitali kwa ubora wa hali ya juu."}</p>
        </div>
      </div>
    </div>
  );
}
