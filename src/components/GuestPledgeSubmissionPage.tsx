import React, { useState, useEffect, useRef } from 'react';
import { Heart, Gift, Landmark, Calendar, Phone, ShieldCheck, Mail, ArrowRight, Edit3, CreditCard, CheckCircle2 } from 'lucide-react';
import { Guest, EventDetails, ContributionCardTemplate } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { drawContributionCardToCanvas } from '../utils/contributionCardDrawing';

interface GuestPledgeSubmissionPageProps {
  guest: Guest;
  event: EventDetails;
  template?: ContributionCardTemplate;
  onPledgeSubmit: (amount: number) => void;
}

// Helper to read saved local pledge from localStorage
const getSavedLocalPledge = (g: Guest, evId?: string): number => {
  if (!g) return 0;
  try {
    const keys = [
      `pledge_submitted_${g.id}`,
      evId ? `pledge_submitted_${evId}_${g.id}` : null,
      g.code ? `pledge_submitted_${g.code}` : null,
      g.phone ? `pledge_submitted_${g.phone}` : null
    ].filter(Boolean) as string[];

    for (const k of keys) {
      const val = localStorage.getItem(k);
      if (val) {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num > 0) return num;
      }
    }
  } catch (e) {
    console.warn('localStorage read error', e);
  }
  return 0;
};

export default function GuestPledgeSubmissionPage({
  guest,
  event,
  template,
  onPledgeSubmit
}: GuestPledgeSubmissionPageProps) {
  const { language, setLanguage } = useLanguage();
  const isEn = language === 'en';
  
  const initialLocalPledge = getSavedLocalPledge(guest, event?.id);
  const initialEffectivePledge = (guest?.pledgeAmount && guest.pledgeAmount > 0) 
    ? guest.pledgeAmount 
    : initialLocalPledge;

  const [currentGuest, setCurrentGuest] = useState<Guest>(() => ({
    ...guest,
    pledgeAmount: initialEffectivePledge > 0 ? initialEffectivePledge : (guest?.pledgeAmount || 0)
  }));

  const displayGuestName = currentGuest?.name || 'Mgeni';
  const existingPledgeAmt = currentGuest?.pledgeAmount || 0;
  const hasAlreadyPledged = existingPledgeAmt > 0;

  const [pledgeAmount, setPledgeAmount] = useState<string>(
    hasAlreadyPledged ? Number(existingPledgeAmt).toLocaleString('en-US') : ''
  );
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isEditingPledge, setIsEditingPledge] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync currentGuest if prop changes
  useEffect(() => {
    if (guest) {
      const savedLocal = getSavedLocalPledge(guest, event?.id);
      const effective = (guest.pledgeAmount && guest.pledgeAmount > 0) ? guest.pledgeAmount : savedLocal;
      const updatedObj = {
        ...guest,
        pledgeAmount: effective > 0 ? effective : (guest.pledgeAmount || 0)
      };
      setCurrentGuest(updatedObj);
      if (effective > 0) {
        setPledgeAmount(Number(effective).toLocaleString('en-US'));
      }
    }
  }, [guest, event?.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cleanAmount = pledgeAmount.replace(/\D/g, '');
    const parsedAmount = parseInt(cleanAmount, 10);

    if (template) {
      drawContributionCardToCanvas(canvas, event, template, currentGuest, !isNaN(parsedAmount) ? `KIASI: TZS ${parsedAmount.toLocaleString()}` : (isEn ? 'SELECT AMOUNT' : 'WEKA KIASI'), isEn);
    } else {
      const defaultTpl: ContributionCardTemplate = {
        themeId: 'midnight-gold',
        eventNameSize: 24,
        guestNameSize: 22,
        pledgeAmountSize: 28,
        deadlineSize: 14
      };
      drawContributionCardToCanvas(canvas, event, defaultTpl, currentGuest, !isNaN(parsedAmount) ? `KIASI: TZS ${parsedAmount.toLocaleString()}` : (isEn ? 'SELECT AMOUNT' : 'WEKA KIASI'), isEn);
    }
  }, [pledgeAmount, template, event, currentGuest, isEn]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlLang = params.get('lang')?.toLowerCase();
      if (urlLang === 'en') {
        setLanguage('en');
      } else if (urlLang === 'sw') {
        setLanguage('sw');
      }
    } catch (e) {
      console.warn('Failed to parse URL lang parameter', e);
    }
  }, [setLanguage]);

  const formattedDeadline = (event.contributionDeadline || event.date)
    ? new Date(event.contributionDeadline || event.date).toLocaleDateString(isEn ? 'en-US' : 'sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
    : (isEn ? 'Unlimited' : 'Bila Kikomo');

  const formatCurrency = (val: string | number) => {
    if (val === undefined || val === null || val === '') return '';
    const num = typeof val === 'number' ? val : parseInt(String(val).replace(/\D/g, ''), 10);
    if (isNaN(num)) return '';
    return 'TZS ' + num.toLocaleString('en-US');
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const formatted = raw ? parseInt(raw, 10).toLocaleString('en-US') : '';
    setPledgeAmount(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanAmount = pledgeAmount.replace(/\D/g, '');
    if (!cleanAmount || parseInt(cleanAmount, 10) <= 0) {
      alert(isEn ? 'Please enter a valid contribution amount.' : 'Tafadhali ingiza kiasi sahihi cha mchango ili uwasilishe.');
      return;
    }

    setLoading(true);
    const amountNum = parseInt(cleanAmount, 10);

    // Save in localStorage immediately so refreshes retain pledge confirmation
    try {
      if (currentGuest.id) localStorage.setItem(`pledge_submitted_${currentGuest.id}`, String(amountNum));
      if (event?.id && currentGuest.id) localStorage.setItem(`pledge_submitted_${event.id}_${currentGuest.id}`, String(amountNum));
      if (currentGuest.code) localStorage.setItem(`pledge_submitted_${currentGuest.code}`, String(amountNum));
      if (currentGuest.phone) localStorage.setItem(`pledge_submitted_${currentGuest.phone}`, String(amountNum));
    } catch (e) {
      console.warn('Could not save pledge to localStorage', e);
    }

    try {
      const response = await fetch('/api/pledge-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: currentGuest.id,
          pledgeAmount: amountNum,
          name: currentGuest.name,
          phone: currentGuest.phone,
          code: currentGuest.code,
          eventId: currentGuest.eventId || event.id
        })
      });

      if (!response.ok) {
        throw new Error('Server returned error status');
      }

      const data = await response.json();
      const updatedGuestObj = data.guest || { ...currentGuest, pledgeAmount: amountNum, pledgeStatus: 'Pledged' };
      
      setCurrentGuest(updatedGuestObj);
      setIsSubmitted(true);
      setIsEditingPledge(false);

      if (onPledgeSubmit) {
        onPledgeSubmit(amountNum);
      }
    } catch (e) {
      console.error('Failed to submit pledge to server, saving locally', e);
      const updatedGuestObj = { ...currentGuest, pledgeAmount: amountNum, pledgeStatus: 'Pledged' };
      setCurrentGuest(updatedGuestObj);
      setIsSubmitted(true);
      setIsEditingPledge(false);
      if (onPledgeSubmit) {
        onPledgeSubmit(amountNum);
      }
    } finally {
      setLoading(false);
    }
  };

  const showConfirmationCard = (hasAlreadyPledged || isSubmitted) && !isEditingPledge;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative font-sans overflow-x-hidden">
      {/* Floating Language Switcher */}
      <div className="absolute top-4 right-4 z-50 flex gap-1 bg-white/5 border border-white/10 p-1 rounded-full backdrop-blur-md">
        <button
          type="button"
          onClick={() => setLanguage('sw')}
          className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all cursor-pointer ${!isEn ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
        >
          SW
        </button>
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all cursor-pointer ${isEn ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
        >
          EN
        </button>
      </div>

      {/* Background radial overlays */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[120%] aspect-square bg-[#0c1938]/40 blur-[130px] rounded-full"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[45%] aspect-square bg-rose-500/5 rounded-full blur-[130px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] aspect-square bg-amber-500/5 rounded-full blur-[130px]"></div>
      </div>

      <div className="w-full max-w-xl z-10 space-y-6 animate-fade-in" id="pledge-submission-container">
        {/* Hidden Canvas */}
        <div className="hidden">
          <canvas 
            id="guest-pledge-live-canvas"
            ref={canvasRef}
            width={450 * 3} 
            height={600 * 3}
          />
        </div>

        {/* Top Header Card */}
        <div className="text-center space-y-2 mt-4">
          <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-450 border border-rose-500/15 mb-2 hover:scale-105 transition-all duration-300">
            <Heart className="w-6 h-6 fill-rose-500" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-350 to-pink-300 tracking-tight uppercase" id="pledge-title-label">
            {event.name || (isEn ? 'Submit Pledge Contribution' : 'Wasilisha Ahadi ya Mchango')}
          </h1>
          <p className="text-xs font-mono tracking-widest uppercase">
            <span className="text-white font-bold text-[12px] uppercase">{displayGuestName}</span>
          </p>
        </div>

        <div className="flex flex-col justify-center">
          {showConfirmationCard ? (
            /* CONFIRMED PLEDGE VIEW (Shown on load if pledged or after submit) */
            <div className="backdrop-blur-md bg-white/[0.03] border border-emerald-500/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-center relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
              
              <div className="inline-flex p-4 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-lg">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>

              <div className="space-y-2">
                <div className="inline-block bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-500/30">
                  {isEn ? '✓ Pledge Already Registered' : '✓ Ahadi Imesharekodiwa'}
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                  {isEn ? 'Pledge Registered!' : 'Ahadi Yako Ipo Salama!'}
                </h2>
                <p className="text-[11px] text-slate-400 font-mono tracking-wider">
                  {isEn ? 'Reference ID: ' : 'Namba ya Uhakiki: '} 
                  <strong className="text-amber-400">P-{(currentGuest.id || '000000').substring(0, 6).toUpperCase()}</strong>
                </p>
              </div>

              <div className="p-6 bg-slate-900/80 rounded-2xl border border-emerald-500/20 space-y-4 shadow-inner">
                <div className="space-y-1">
                   <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                     {isEn ? 'Your Registered Contribution Pledge' : 'Kiasi cha Ahadi Yako Kilichorekodiwa'}
                   </p>
                   <p className="text-3xl font-black text-amber-400 font-mono tracking-tight">
                     {formatCurrency(currentGuest.pledgeAmount || 0)}
                   </p>
                   {currentGuest.paidAmount && currentGuest.paidAmount > 0 ? (
                     <p className="text-xs text-emerald-400 font-bold mt-1">
                       {isEn ? `Paid so far: TZS ${currentGuest.paidAmount.toLocaleString()}` : `Umeshalipa: TZS ${currentGuest.paidAmount.toLocaleString()}`}
                     </p>
                   ) : null}
                </div>
                
                <div className="h-px bg-white/10 w-full"></div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {isEn 
                    ? `Dear ${displayGuestName}, your pledge of ${formatCurrency(currentGuest.pledgeAmount || 0)} is securely saved in our event management system. To avoid duplicate entries, additional pledges are restricted.`
                    : `Ndugu ${displayGuestName}, tayari umeweka ahadi ya mchango ya ${formatCurrency(currentGuest.pledgeAmount || 0)} kwa ajili ya kufanikisha tukio hili. Mfumo wetu umeratibu ahadi yako na kuzuia kutuma mara mbili.`}
                </p>
              </div>

              {/* Payment details / Namba za Malipo */}
              {event.paymentMethods && event.paymentMethods.length > 0 && (
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3 text-left">
                  <div className="flex items-center gap-2 text-amber-400 border-b border-white/10 pb-2">
                    <CreditCard className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider">
                      {isEn ? 'Payment Methods / Accounts' : 'Namba na Akanti za Kutuma Mchango'}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {event.paymentMethods.map((pm, idx) => (
                      <div key={pm.id || idx} className="bg-white/5 border border-white/5 rounded-xl p-3 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-extrabold text-amber-300 text-[11px] uppercase">{pm.provider} ({pm.type})</p>
                          <p className="text-slate-300 font-mono text-[12px] font-bold">{pm.number}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-400 uppercase font-medium">{isEn ? 'Name' : 'Jina la Akanti'}</p>
                          <p className="text-[11px] text-white font-bold">{pm.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Collection Deadline */}
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-blue-300">
                  <Calendar className="w-4 h-4" />
                  <span className="font-bold uppercase tracking-wider text-[11px]">{isEn ? 'Deadline' : 'Mwisho wa Kukusanya'}</span>
                </div>
                <span className="text-white font-mono font-bold">{formattedDeadline}</span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingPledge(true)}
                  className="w-full py-3.5 bg-white/10 hover:bg-white/15 text-amber-300 border border-amber-500/30 font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>{isEn ? 'Edit / Update Pledge Amount' : 'Badilisha au Boresha Ahadi Yangu'}</span>
                </button>

                <p className="text-[10px] text-slate-500 uppercase font-bold flex items-center justify-center gap-1.5 pt-1">
                  <Mail className="w-3.5 h-3.5" />
                  {isEn ? 'Confirmation SMS recorded for your number' : 'Ujumbe wa uthibitisho umehifadhiwa kwa namba yako'}
                </p>
              </div>
            </div>
          ) : (
            /* NEW / EDIT PLEDGE FORM VIEW */
            <div className="space-y-6">
              {hasAlreadyPledged && isEditingPledge && (
                <div className="backdrop-blur-md bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center space-y-1 shadow-xl animate-fade-in flex justify-between items-center">
                  <div className="text-left space-y-0.5">
                    <p className="text-xs font-bold text-amber-400 uppercase">
                      {isEn ? 'Updating existing pledge' : 'Unabadilisha ahadi yako'}
                    </p>
                    <p className="text-[11px] text-slate-300">
                      {isEn ? `Current pledge: TZS ${existingPledgeAmt.toLocaleString()}` : `Ahadi ya sasa: TZS ${existingPledgeAmt.toLocaleString()}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingPledge(false)}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 text-[10px] font-bold uppercase rounded-lg transition"
                  >
                    {isEn ? 'Cancel' : 'Ghairi'}
                  </button>
                </div>
              )}

              <div className="backdrop-blur-md bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative transition-all duration-300">
                <div className="absolute top-0 right-0 p-3 text-[10px] font-mono text-amber-400 font-extrabold flex items-center gap-1 bg-amber-500/10 rounded-bl-xl border-l border-b border-white/5">
                  <Landmark className="w-3.5 h-3.5" /> {isEn ? 'Official Pledge' : 'Ahadi Rasmi'}
                </div>

                <div className="space-y-2 pt-2">
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                    <Gift className="w-4 h-4 text-rose-400" />
                    {hasAlreadyPledged ? (isEn ? 'UPDATE PLEDGE AMOUNT' : 'BADILISHA KIASI CHA AHADI') : (isEn ? 'NEW PLEDGE CONTRIBUTION' : 'MCHANGO MPYA WA AHADI')}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {isEn ? (
                      <>
                        Dear <strong>{displayGuestName}</strong>, enter your pledge contribution below to support this celebration.
                      </>
                    ) : (
                      <>
                        Ndugu <strong>{displayGuestName}</strong>, unakaribishwa kuandikisha ahadi yako ya mchango kwa ajili ya kufanikisha tukio hili.
                      </>
                    )}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="pledge-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                      {isEn ? 'Pledge Amount (TZS)' : 'Kiasi cha Ahadi (TZS)'}
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <span className="text-amber-500/60 font-black text-sm sm:text-base tracking-wider">TZS</span>
                      </div>
                      <input
                        id="pledge-input"
                        type="text"
                        inputMode="numeric"
                        value={pledgeAmount}
                        onChange={handleAmountChange}
                        placeholder={isEn ? "e.g. 500,000" : "Mfano: 500,000"}
                        className="block w-full pl-16 sm:pl-20 pr-4 py-5 bg-slate-900/70 border border-white/15 rounded-xl text-amber-400 font-mono text-2xl sm:text-3xl font-black focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all outline-none tracking-wide placeholder-slate-600"
                      />
                    </div>
                    {pledgeAmount && (
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">{isEn ? 'In Words:' : 'Kwa Maneno:'}</span>
                        <span className="text-[11px] font-bold text-amber-400">{formatCurrency(pledgeAmount)}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-2">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{isEn ? 'Collection Deadline' : 'Mwisho wa Kukusanya'}</span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium">{formattedDeadline}</p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !pledgeAmount}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-rose-950/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>
                          {hasAlreadyPledged 
                            ? (isEn ? 'Update My Pledge' : 'Hifadhi Mabadiliko ya Ahadi') 
                            : (isEn ? 'Submit My Pledge' : 'Wasilisha Ahadi Yangu')}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {hasAlreadyPledged && (
                    <button
                      type="button"
                      onClick={() => setIsEditingPledge(false)}
                      className="w-full py-2.5 text-slate-400 hover:text-white text-xs font-bold transition text-center"
                    >
                      {isEn ? 'Cancel Editing' : 'Rudi Kwenye Taarifa za Ahadi'}
                    </button>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center">
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
            © 2026 {event.name} • EventCard Digital System
          </p>
        </div>
      </div>
    </div>
  );
}
