import React from 'react';
import { motion } from 'motion/react';
import { Heart, Gift, Mail, Briefcase, Coins, Ticket, ArrowLeft } from 'lucide-react';

interface CreateEventPageProps {
  onSelect: (typeID: string, defaultName: string, defaultHall: string) => void;
  onBack: () => void;
  language: 'sw' | 'en';
}

export default function CreateEventPage({ onSelect, onBack, language }: CreateEventPageProps) {
  const eventTypes = [
    {
      typeID: 'HARUSI',
      title: language === 'sw' ? 'HARUSI' : 'HARUSI',
      subtitle: language === 'sw' ? 'Wedding event' : 'Wedding event',
      icon: Heart,
      iconColor: 'bg-rose-500/10 text-rose-450 border border-rose-500/20',
      defaultName: language === 'sw' ? 'Mwaliko wa Harusi ya Jimson' : 'Wedding of Jimson',
      defaultHall: language === 'sw' ? 'Ukumbi wa Isamuhyo - Mbezi Beach' : 'Isamuhyo Hall - Mbezi Beach'
    },
    {
      typeID: 'SEND OFF',
      title: language === 'sw' ? 'SEND OFF' : 'SEND OFF',
      subtitle: language === 'sw' ? 'Pre-marriage ceremony' : 'Pre-marriage ceremony',
      icon: Gift,
      iconColor: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
      defaultName: language === 'sw' ? 'Send Off ya Diana Fidelis' : 'Diana\'s Send Off Celebration',
      defaultHall: language === 'sw' ? 'Mwalimu Nyerere Convention Centre' : 'Mwalimu Nyerere Convention Centre'
    },
    {
      typeID: 'MWALIKO',
      title: language === 'sw' ? 'MWALIKO' : 'MWALIKO',
      subtitle: language === 'sw' ? 'Invitation event' : 'Invitation event',
      icon: Mail,
      iconColor: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
      defaultName: language === 'sw' ? 'Mwaliko Maalum wa Sherehe' : 'Celebration Invitation',
      defaultHall: language === 'sw' ? 'Golden Jubilee Hall' : 'Golden Jubilee Hall'
    },
    {
      typeID: 'KIKAO',
      title: language === 'sw' ? 'KIKAO' : 'KIKAO',
      subtitle: language === 'sw' ? 'Meeting event' : 'Meeting event',
      icon: Briefcase,
      iconColor: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      defaultName: language === 'sw' ? 'Kikao cha Kamati ya Sherehe' : 'Committee Meeting',
      defaultHall: language === 'sw' ? 'Ukumbi wa EVENTCARD Boardroom' : 'EVENTCARD Boardroom'
    },
    {
      typeID: 'TIKETI',
      title: language === 'sw' ? 'TIKETI' : 'TIKETI',
      subtitle: language === 'sw' ? 'Ticket Event' : 'Ticket Event',
      icon: Ticket,
      iconColor: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
      defaultName: language === 'sw' ? 'Kadi ya Kiingilio / Tamasha' : 'Entrance / Festival Tickets',
      defaultHall: language === 'sw' ? 'Dar Live Hall' : 'Dar Live Hall'
    }
  ];

  return (
    <div className="space-y-6 sm:space-y-8 font-sans text-xs text-white" id="create-event-screen">
      {/* Top Header Bar with Breadcrumb and WhatsApp Support */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-white/5">
        <div className="flex items-center space-x-2 text-slate-400 font-medium text-[11px]" id="breadcrumbs-bar">
          <span className="hover:text-white cursor-pointer transition" onClick={onBack}>Dashboard</span>
          <span>&gt;</span>
          <span className="text-white font-bold">Create Event</span>
        </div>
        <div className="flex items-center space-x-1.5 text-slate-300 font-semibold text-[11px]" id="customer-support-bar">
          <span>Msaada / Support:</span>
          <a
            href="https://wa.me/255714786751"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 transition"
          >
            <svg className="w-4 h-4 fill-current text-current inline" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.501-5.734-1.451L0 24zm6.59-4.846c1.6.95 3.1 1.452 4.6 1.453 5.4 0 9.8-4.4 9.8-9.8.002-2.6-1-5.05-2.85-6.9C16.3 2.1 13.8 1.1 11.23 1.1 5.86 1.1 1.46 5.5 1.45 10.9c-.001 1.76.452 3.26 1.353 4.8l-.95 3.483 3.56-.934zM18.8 15.6c-.3-.15-1.7-.85-1.95-.95-.25-.1-.45-.15-.65.15-.2.3-.75.95-.9 1.12-.15.17-.3.2-.6.05-.3-.15-1.22-.45-2.32-1.43-.86-.77-1.44-1.72-1.61-2.02-.17-.3-.02-.45.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.65-1.57-.9-2.15-.24-.6-.5-.5-.65-.5h-.55c-.2 0-.5.07-.77.37-.27.3-1.05 1.02-1.05 2.5s1.07 2.9 1.22 3.1c.15.2 2.1 3.2 5.1 4.5.7.3 1.27.5 1.7.63.73.22 1.4.2 1.93.12.6-.1 1.7-.7 1.95-1.37.25-.68.25-1.27.17-1.37-.08-.11-.28-.2-.58-.35z" />
            </svg>
            <span className="font-bold underline text-[11px]">WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Back Button */}
      <div className="flex" id="create-event-navigation-back">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-350 hover:text-white px-3.5 py-2 rounded-xl transition font-extrabold cursor-pointer text-[11px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{language === 'sw' ? 'Ghairi / Rudi' : 'Back'}</span>
        </button>
      </div>

      {/* Page Title & Subtitle */}
      <div className="space-y-1.5" id="create-event-heading-labels">
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          {language === 'sw' ? 'Tengeneza Tukio Jipya' : 'Create New Event'}
        </h2>
        <p className="text-xs text-slate-400">
          {language === 'sw' ? 'Chagua aina ya sherehe au mwaliko unaotaka kuutengeneza' : 'Select the type of event you want to create'}
        </p>
      </div>

      {/* Rounded Wrapper matching the high-fidelity mock image */}
      <div 
        className="max-w-4xl mx-auto rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-5 sm:p-8" 
        id="event-type-selection-wrapper"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5" id="event-types-grid">
          {eventTypes.map((item) => {
            const IconComponent = item.icon;
            return (
              <motion.button
                key={item.typeID}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => onSelect(item.typeID, item.defaultName, item.defaultHall)}
                className="flex items-center space-x-4 bg-[#0a1122] border border-white/10 hover:border-blue-500/40 rounded-2xl p-4 sm:p-5 text-left transition duration-200 cursor-pointer group hover:bg-[#0f1b33]"
              >
                {/* Dynamic Icon Bubble matching design exactly */}
                <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl shrink-0 flex items-center justify-center transition-all bg-white/5 group-hover:bg-blue-500/10 ${item.iconColor}`}>
                  <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>

                {/* Text Block */}
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-extrabold text-white tracking-wide group-hover:text-blue-400 transition-colors uppercase">
                    {item.title}
                  </h4>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5 truncate leading-snug">
                    {item.subtitle}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
