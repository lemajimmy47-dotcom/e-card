import { motion } from 'motion/react';
import { MessageSquare, ArrowRight, Clipboard, AlertCircle } from 'lucide-react';
import { EventDetails } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface CardPreviewProps {
  event: EventDetails;
  onNextStep: () => void; // Must link directly to templates to skip pricing
}

export default function CardPreview({ event, onNextStep }: CardPreviewProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  
  // Custom generated mock message that is fully reactive
  const mockMessage = isEn ? `Hello {Guest Name},
The family of ${event.hostName || "[Host Name]"} is pleased to warmly invite you to the ${event.name || "[Event Name]"} ceremony.

Date: ${event.date || "[Date]"}
Time: ${event.time || "[Time]"} ${event.period || ""}
Venue: ${event.eventHallName || "[Venue Hall]"}
Dress Code: ${event.dressCode || "[Dress Code]"}
Invitation Code: #IP-${event.id?.substring(0, 4)?.toUpperCase() || 'XXXX'}

Get your digital card and RSVP here:
👉 https://eventcard.co.tz/invite/{CARD_ID}`
  : `Habari {Jina la Mgeni},
Familia ya ${event.hostName || "[Jina la Mwenyeji]"} inakualika kwa furaha kushiriki katika sherehe ya ${event.name || "[Jina la Sherehe / Harusi]"}.

Siku: Tarehe ${event.date || "[Tarehe]"}
Saa: ${event.time || "[Saa]"} ${event.period || ""}
Ukumbi: ${event.eventHallName || "[Jina la Ukumbi]"}
Mavazi (Dress Code): ${event.dressCode || "[Mavazi ya Sherehe]"}
Code ya Mwaliko: #IP-${event.id?.substring(0, 4)?.toUpperCase() || 'XXXX'}

Pata Kadi yako maalum na ujibu mwaliko (RSVP) hapa haraka:
👉 https://eventcard.co.tz/invite/{KADI_ID}`;
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(mockMessage);
    alert(isEn ? "Message copied to clipboard!" : "Meseji imesafishwa kwenye clipboard!");
  };

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[1.75rem] p-6 sm:p-8 space-y-6 font-sans text-xs text-white" id="card-preview-container">
      
      {/* Header Info */}
      <div className="border-b border-white/10 pb-5">
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <span>{isEn ? "Message Preview & Layout" : "Uhakiki wa Meseji ya Mwaliko (Message Preview)"}</span>
        </h2>
        <p className="text-slate-350 mt-0.5">
          {isEn 
            ? "This is how guests will receive their short message via SMS and WhatsApp." 
            : "Hivi ndivyo wageni watakavyopokea ujumbe wao mfupi kupitia SMS na WhatsApp."}
        </p>
      </div>

      {/* Warning/Skip pricing badge */}
      <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-xs text-emerald-300 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-emerald-450 shrink-0 mt-0.5 animate-pulse" />
        <div className="space-y-1">
          <p className="font-bold">
            {isEn ? "✓ Pricing Step Bypassed Successfully!" : "✓ Kipengele cha 'Pricing' Kimerukwa kwa Mafanikio!"}
          </p>
          <p className="text-slate-300">
            {isEn 
              ? "By clicking the next step, you will go directly to editing Card Templates to arrange name positions and QR codes without having to pay or select a package."
              : "Ukibofya hatua inayofuata, utapelekwa moja kwa moja kwenye kuhariri **Kadi Templates** ili kupanga eneo la majina na QR codes bila kulazimika kulipia au kuchagua kifurushi."}
          </p>
        </div>
      </div>

      {/* Interactive layouts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Left pane: The customizable text template */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono">
              {isEn ? "Outbound Message Structure" : "Muundo wa Meseji ya Mwaliko"}
            </h3>
            <button 
              id="preview-copy-btn"
              onClick={copyToClipboard}
              className="text-[11px] bg-white/10 hover:bg-white/15 border border-white/10 text-white px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>{isEn ? "Copy Message" : "Copy Meseji"}</span>
            </button>
          </div>
          
          <div className="bg-slate-950/60 border border-white/10 p-5 rounded-2xl font-mono text-xs text-slate-205 leading-relaxed whitespace-pre-wrap select-all">
            {mockMessage}
          </div>
        </div>

        {/* Right pane: Phone simulator displaying the message flow */}
        <div className="space-y-4 flex flex-col items-center">
          <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono self-start">
            {isEn ? "Guest's WhatsApp Preview" : "Mwonekano kwenye WhatsApp ya Mgeni"}
          </h3>
          
          {/* WhatsApp mock preview */}
          <div className="w-full max-w-sm bg-[#0b141a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[320px]">
            {/* WhatsApp Topbar */}
            <div className="bg-[#1f2c34] text-white px-4 py-2.5 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center font-bold text-[10px] text-white uppercase">
                  IP
                </div>
                <div>
                  <h4 className="font-semibold text-xs tracking-tight">EVENTCARD Bot</h4>
                  <p className="text-[8px] text-emerald-400">{isEn ? "Online" : "Inatumika (Online)"}</p>
                </div>
              </div>
            </div>

            {/* Chat list */}
            <div className="flex-grow p-4 overflow-y-auto space-y-4 flex flex-col justify-end text-[11px] bg-[#0b141a]/95">
              
              {/* Bot chat bubble */}
              <div className="bg-[#005c4b] text-slate-100 rounded-xl rounded-tl-none p-3 max-w-[85%] self-start shadow-sm border border-emerald-500/10 relative leading-relaxed">
                <p className="font-bold text-teal-300 text-[10px] mb-1">EVENTCARD DIGITAL INVITATION</p>
                <p>{isEn ? "Hello" : "Habari"} <strong>{isEn ? 'Guest Name' : 'Jina la Mwalikwa'}</strong>,</p>
                <p className="mt-1">
                  {isEn ? "The family of" : "Familia ya"} <strong>{event.hostName || (isEn ? "Family / Hosts" : "Familia / Waandaji")}</strong> {isEn ? "warmly invites you to our ceremony..." : "inakualika kwa furaha kwenye mwaliko wetu..."}
                </p>
                <p className="mt-2 text-blue-300 underline cursor-pointer truncate font-bold text-[10px]">👉 apps.eventcard.co.tz/invite/guest-1</p>
                <span className="text-[7.5px] text-slate-400 absolute bottom-1 right-2 font-mono">08:18 AM</span>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Navigation Buttons skipping pricing */}
      <div className="flex justify-end pt-4 border-t border-white/10">
        <button
          id="preview-next-btn"
          onClick={onNextStep}
          className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] text-white font-bold rounded-xl transition shadow flex items-center space-x-2"
        >
          <span>{isEn ? "Continue to Templates" : "Endelea Kwenye Templates"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
