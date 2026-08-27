import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, CheckCircle, MessageSquare, Phone, Users, Heart, Sparkles, Send, QrCode, X, Shield, FileText, Coins, CheckCircle2, MapPin, Crown, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface LandingPageProps {
  onStart: () => void;
  onLoginClick: () => void;
}

export default function LandingPage({ onStart, onLoginClick }: LandingPageProps) {
  const { language, setLanguage, t } = useLanguage();
  const [activePolicyTab, setActivePolicyTab] = useState<'privacy' | 'terms' | 'delete' | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/privacy-policy') setActivePolicyTab('privacy');
    else if (path === '/terms') setActivePolicyTab('terms');
    else if (path === '/delete-data') setActivePolicyTab('delete');
  }, []);

  return (
    <div className="min-h-screen bg-[#050b18] text-white flex flex-col font-sans relative overflow-x-hidden" id="landing-page-root">
      
      {/* Absolute Ambient Background Blur circles aligned with Design HTML guidelines */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[140px]"></div>
      </div>

      {/* Navigation Header */}
      <header className="backdrop-blur-md bg-[#050b18]/75 border-b border-white/10 sticky top-0 z-50 px-4 py-3 sm:px-6 shadow-lg relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="/logo.png" alt="Event Card Logo" className="h-10 w-auto object-contain" />
          </div>

          <nav className="hidden md:flex space-x-8 text-sm font-medium text-slate-350">
            <a href="#features" className="hover:text-white transition-colors">
              {language === 'sw' ? 'Sifa za Mfumo' : 'System Features'}
            </a>
            <a href="#packages" className="hover:text-white transition-colors">
              {language === 'sw' ? 'Vifurushi (Packages)' : 'Packages'}
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              {language === 'sw' ? 'Jinsi Inavyofanya Kazi' : 'How It Works'}
            </a>
            <a href="#faqs" className="hover:text-white transition-colors">
              {language === 'sw' ? 'Maswali ya Kawaida' : 'FAQs'}
            </a>
            <a href="#contact" className="hover:text-white transition-colors">
              {language === 'sw' ? 'Mawasiliano' : 'Contact Us'}
            </a>
          </nav>

          <div className="flex items-center space-x-3">
            {/* Language Selector */}
            <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 shadow-inner mr-1">
              <button
                onClick={() => setLanguage('sw')}
                className={`px-2 py-1 text-[9px] font-extrabold rounded-lg transition-all cursor-pointer ${
                  language === 'sw' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md' : 'text-slate-405 hover:text-white'
                }`}
              >
                SW
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 text-[9px] font-extrabold rounded-lg transition-all cursor-pointer ${
                  language === 'en' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md' : 'text-slate-405 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            <button 
              id="nav-login-btn"
              onClick={onLoginClick}
              className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 transition"
            >
              {t('landing.btnLogin')}
            </button>
            <button 
              id="landing-register-btn"
              onClick={onStart}
              className="text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] px-4 py-2 rounded-xl transition"
            >
              {t('landing.btnStartNow')}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow relative z-10">
        <section className="relative px-4 py-16 sm:px-6 lg:px-8 overflow-hidden">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left side: text */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider">
                <span className="w-2 h-2 rounded-full bg-blue-450 animate-pulse"></span>
                <span>{t('landing.inviteTag')}</span>
              </div>
              
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-sans tracking-tight text-white leading-none">
                {t('landing.title1')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 underline decoration-purple-400 decoration-wavy">{t('landing.title2')}</span>
              </h2>
              
              <p className="text-lg text-slate-300 leading-relaxed font-sans">
                {t('landing.subtitle')}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button 
                  id="hero-get-started"
                  onClick={onStart}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_20px_rgba(59,130,246,0.40)] text-white font-semibold px-8 py-4 rounded-xl transition duration-150 text-center inline-flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-purple-300" />
                  <span>{t('landing.btnStart')}</span>
                </button>
                <a 
                  href="#how-it-works"
                  className="border border-white/10 backdrop-blur-md bg-white/5 hover:bg-white/10 text-white font-semibold px-8 py-4 rounded-xl transition inline-flex items-center justify-center space-x-2"
                >
                  <span>{t('landing.btnHowItWorks')}</span>
                </a>
              </div>

              {/* Trust/Live Counters REMOVED per user request */}
            </motion.div>

            {/* Right side: Mockup Showcase / Interactive graphics with custom client-logo */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="relative flex justify-center"
            >
              {/* Outer phone container styled as matte glass */}
              <div className="relative w-full max-w-sm rounded-[2.5rem] bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl p-4 aspect-[9/17] flex flex-col justify-between overflow-hidden">
                {/* Speaker pill */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-5 rounded-full bg-slate-900 z-10 flex items-center justify-center border border-white/10">
                  <div className="w-12 h-1 bg-slate-800 rounded-full"></div>
                </div>

                {/* Simulated Invite screen */}
                <div 
                  className="flex-grow mt-6 rounded-[2rem] p-4 flex flex-col text-slate-800 border border-white/15 relative overflow-y-auto bg-cover bg-center shadow-inner"
                  style={{ backgroundImage: "url('/sample_wedding_card.jpg')" }}
                >
                  <div className="absolute inset-0 bg-white/5 backdrop-blur-[0.5px] z-0 pointer-events-none"></div>
                  
                  <div className="relative z-10 flex flex-col justify-between h-full min-h-[360px]">
                    <div className="text-center space-y-1">
                      <p className="text-[10px] text-purple-700 font-extrabold uppercase tracking-wider bg-purple-50/85 backdrop-blur-md px-2.5 py-0.5 rounded-full inline-block border border-purple-200/50 shadow-sm">
                        {language === 'sw' ? 'UHAKIKI WA MWALIKO' : 'EVENT PREVIEW'}
                      </p>
                      <h4 className="font-extrabold text-lg text-purple-950 tracking-tight leading-tight drop-shadow-sm mt-1">
                        {language === 'sw' ? 'JULIE & JULIAN' : 'JULIE & JULIAN'}
                      </h4>
                      <p className="text-[9.5px] text-purple-850 font-semibold italic">
                        {language === 'sw' ? 'Mwaliko wa Kipekee' : 'Exclusive Invitation'}
                      </p>
                    </div>

                    {/* Styled Card Image in Mockup - high premium glassmorphic guest badge */}
                    <div className="my-3 backdrop-blur-md bg-white/80 border border-purple-200/40 rounded-2xl p-4 flex flex-col items-center justify-center shadow-[0_12px_24px_-10px_rgba(109,40,217,0.3)]">
                      <Heart className="w-5.5 h-5.5 text-rose-500 animate-pulse mb-1" />
                      <p className="text-[11.5px] font-black text-slate-900 tracking-wide">
                        {language === 'sw' ? 'JIMSON LEMA' : 'JIMSON LEMA'}
                      </p>
                      <span className="text-[8.5px] font-extrabold bg-gradient-to-r from-purple-600 to-rose-500 text-white px-3 py-0.5 rounded-full mt-1.5 shadow-sm uppercase tracking-wider">
                        DOUBLE
                      </span>
                    </div>

                    <div className="text-[9.5px] text-slate-800 space-y-1 text-left pl-3 py-2 bg-white/85 backdrop-blur-sm border border-purple-100/50 rounded-2xl font-sans shadow-md">
                      <p>• <strong>{language === 'sw' ? 'Tarehe:' : 'Date:'}</strong> Sunday, 20 Aug 2025</p>
                      <p>• <strong>{language === 'sw' ? 'Saa:' : 'Time:'}</strong> 10:00 PM</p>
                      <p>• <strong>{language === 'sw' ? 'Mahali:' : 'Venue:'}</strong> Naeda Social Hall</p>
                    </div>

                    {/* Simulated QR block */}
                    <div className="mt-3 flex flex-col items-center">
                      <div className="w-13 h-13 bg-white/90 backdrop-blur-sm flex items-center justify-center p-1.5 rounded-2xl border border-purple-200/40 shadow-md">
                        <QrCode className="w-10 h-10 text-purple-950" />
                      </div>
                      <span className="text-[7.5px] text-purple-950 bg-white/80 px-2 py-0.5 rounded-full font-mono font-bold mt-1.5 border border-purple-100 shadow-sm uppercase">GUEST QR-982</span>
                    </div>

                    {/* Interactive Simulated RSVP Option */}
                    <div className="flex gap-2.5 mt-3.5 justify-center">
                      <span className="text-[9.5px] bg-gradient-to-r from-purple-600 to-rose-500 hover:shadow-lg text-white font-extrabold py-2 px-4 rounded-full cursor-pointer transition-all active:scale-95 shadow-md shadow-purple-500/10">
                        {language === 'sw' ? 'Nitafika' : 'Attending'}
                      </span>
                      <span className="text-[9.5px] bg-white/85 hover:bg-white text-slate-800 font-extrabold py-2 px-4 rounded-full cursor-pointer transition-all active:scale-95 border border-purple-250/30 shadow-sm">
                        {language === 'sw' ? 'Sitaweza' : 'Declined'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badges REMOVED per user request */}
            </motion.div>
          </div>
        </section>

        {/* Attention-Catching Contribution Collection Announcement Section */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 relative">
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[20%] left-[30%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]"></div>
          </div>
          
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="bg-gradient-to-br from-[#0c152b] via-[#0d1c3e] to-[#0a1024] border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-10 shadow-[0_0_40px_rgba(16,185,129,0.15)] relative overflow-hidden">
              {/* Shiny Corner Tag */}
              <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-600 to-teal-500 text-white font-extrabold text-[10px] sm:text-xs uppercase tracking-widest px-6 py-2 rounded-bl-2xl shadow-md flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                <span>{language === 'sw' ? 'KIPENGELE KIPYA CHA KIPEKEE 💎' : 'NEW EXCLUSIVE FEATURE 💎'}</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mt-4">
                {/* Left Column: Core Message and Value Proposition */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider">
                    <Coins className="w-4 h-4" />
                    <span>{language === 'sw' ? 'USIMAMIZI WA MICHANGO YA SHEREHE' : 'EVENT FUNDRAISING & CONTRIBUTIONS'}</span>
                  </div>

                  <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight font-sans">
                    {language === 'sw' ? (
                      <>Sasa Kusanya Michango ya Sherehe <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Rahisi & Salama Zaidi Kidijitali!</span></>
                    ) : (
                      <>Seamlessly Collect Event Contributions <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">& Pledges Digitally!</span></>
                    )}
                  </h2>

                  <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                    {language === 'sw' ? (
                      'Usisumbuke tena na magroup ya WhatsApp au kufuatilia ahadi (pledges) kwa mkono na makaratasi. Wageni wako wanaweza kutoa michango yao na kujaza ahadi zao moja kwa moja wanapofungua kadi zao za mwaliko wa kidijitali.'
                    ) : (
                      'No more manual follow-ups or chaotic WhatsApp groups. Guests can view payment details, log contributions, or submit formal pledges directly inside their interactive invitation screen.'
                    )}
                  </p>

                  {/* Bullet Highlights */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="flex items-start space-x-3">
                      <div className="bg-emerald-500/10 p-1 rounded-lg border border-emerald-500/20 text-emerald-400 mt-0.5">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{language === 'sw' ? 'Namba za Malipo Moja kwa Moja' : 'Direct Payment Integration'}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{language === 'sw' ? 'Wageni wanaona namba za malipo (Lipa Namba, M-Pesa, n.k.) kwenye kadi zao.' : 'Guests view secure mobile payment details instantly on their cards.'}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="bg-emerald-500/10 p-1 rounded-lg border border-emerald-500/20 text-emerald-400 mt-0.5">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{language === 'sw' ? 'Ufuatiliaji wa Ahadi (Pledges)' : 'Smart Pledge Management'}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{language === 'sw' ? 'Wageni wanaweza kuweka kiwango cha ahadi na tarehe ya kutoa mchango.' : 'Guests can log target pledges and expected dates effortlessly.'}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="bg-emerald-500/10 p-1 rounded-lg border border-emerald-500/20 text-emerald-400 mt-0.5">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{language === 'sw' ? 'Ujumbe wa Shukrani wa Papo Hapo' : 'Automated Thank-You SMS'}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{language === 'sw' ? 'Mfumo unatuma ujumbe maalum wa shukrani kwa kila aliyelipia au kuahidi.' : 'Instant appreciation messages dispatched to guest phones.'}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="bg-emerald-500/10 p-1 rounded-lg border border-emerald-500/20 text-emerald-400 mt-0.5">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{language === 'sw' ? 'Ripoti na Grafu Dashboard' : 'Real-Time Analytics'}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{language === 'sw' ? 'Kagua michango iliyolipwa, ahadi, na kiasi kilichobaki kupitia chati.' : 'Visualize target bars, outstanding logs, and export clean reports.'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={onStart}
                      className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold px-6 py-3 rounded-xl transition duration-150 text-sm shadow-lg flex items-center gap-2 cursor-pointer"
                    >
                      <span>{language === 'sw' ? 'Jaribu Mfumo wa Michango Bure' : 'Try Contribution System Free'}</span>
                      <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Right Column: Live Interactive-Like Mockup of Contribution Dashboard */}
                <div className="lg:col-span-5">
                  <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-5 shadow-2xl relative">
                    {/* Header bar of mini-dashboard */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">{language === 'sw' ? 'MICHANGO LIVE TRACKER' : 'LIVE CONTRIBUTION TRACKER'}</span>
                      </div>
                      <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full">ACTIVE</span>
                    </div>

                    {/* Progress details */}
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-300">{language === 'sw' ? 'Sherehe: Harusi ya Joachim & Diana' : 'Event: Wedding of Joachim & Diana'}</span>
                        <span className="text-emerald-400 font-bold">65%</span>
                      </div>
                      
                      {/* Animated Progress Bar */}
                      <div className="w-full bg-slate-900 rounded-full h-3.5 p-0.5 border border-white/5 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-1000" style={{ width: '65%' }}></div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/50 p-2.5 rounded-lg border border-white/5 font-sans">
                        <div>
                          <p className="text-slate-400">{language === 'sw' ? 'Michango Iliyopokelewa' : 'Collected Cash'}</p>
                          <p className="text-xs font-bold text-white mt-0.5">TSh 7,850,000</p>
                        </div>
                        <div className="border-l border-white/10 pl-3">
                          <p className="text-slate-400">{language === 'sw' ? 'Lengo la Kamati' : 'Target Target'}</p>
                          <p className="text-xs font-bold text-slate-300 mt-0.5">TSh 12,000,000</p>
                        </div>
                      </div>
                    </div>

                    {/* Recent mini logs */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{language === 'sw' ? 'Mwenendo wa Hivi Karibuni' : 'Recent Contributions'}</p>
                      
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        <div className="flex items-center justify-between text-xs bg-white/5 p-2 rounded-lg border border-white/5">
                          <div className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span className="text-slate-200 font-medium">Jimson Lema</span>
                          </div>
                          <span className="text-emerald-400 font-mono font-bold">TSh 500,000</span>
                        </div>

                        <div className="flex items-center justify-between text-xs bg-white/5 p-2 rounded-lg border border-white/5">
                          <div className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span className="text-slate-200 font-medium">Mary Mollel</span>
                          </div>
                          <span className="text-emerald-400 font-mono font-bold">TSh 250,000</span>
                        </div>

                        <div className="flex items-center justify-between text-xs bg-white/5 p-2 rounded-lg border border-white/5">
                          <div className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            <span className="text-slate-300 font-medium">Rev. Fidelis</span>
                          </div>
                          <span className="text-amber-400 font-mono font-bold">TSh 1,000,000 (Ahadi)</span>
                        </div>
                      </div>
                    </div>

                    {/* Micro footnote */}
                    <p className="text-[9px] text-slate-500 mt-3 text-center italic">
                      {language === 'sw' ? '* Ripoti hutolewa kama PDF & Excel papohapo.' : '* Automated reports generated instantly as PDF & Excel.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-white/10 bg-black/10 relative">
          <div className="max-w-7xl mx-auto text-center space-y-4 mb-16 relative z-10">
            <h3 className="text-xs uppercase font-mono tracking-widest text-blue-400 font-bold">{t('landing.featuresTitle')}</h3>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight font-sans">
              {t('landing.featuresHeading')}
            </h2>
            <p className="text-slate-350 max-w-2xl mx-auto">
              {t('landing.featuresSub')}
            </p>
          </div>

          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
            
            {/* Feature 1 */}
            <div className="backdrop-blur-xl bg-white/5 hover:bg-white/10 transition border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="w-12 h-12 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white font-sans">{t('feature.1.title')}</h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                {t('feature.1.desc')}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="backdrop-blur-xl bg-white/5 hover:bg-white/10 transition border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="w-12 h-12 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl flex items-center justify-center">
                <Send className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white font-sans">{t('feature.2.title')}</h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                {t('feature.2.desc')}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="backdrop-blur-xl bg-white/5 hover:bg-white/10 transition border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white font-sans">{t('feature.3.title')}</h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                {t('feature.3.desc')}
              </p>
            </div>

            {/* Feature 4 */}
            <div className="backdrop-blur-xl bg-white/5 hover:bg-white/10 transition border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="w-12 h-12 bg-[#2563eb]/10 text-blue-400 border border-[#2563eb]/20 rounded-xl flex items-center justify-center">
                <QrCode className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white font-sans">{t('feature.4.title')}</h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                {t('feature.4.desc')}
              </p>
            </div>

            {/* Feature 5 */}
            <div className="backdrop-blur-xl bg-white/5 hover:bg-white/10 transition border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="w-12 h-12 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6 animate-pulse" />
              </div>
              <h4 className="text-lg font-bold text-white font-sans">{t('feature.5.title')}</h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                {t('feature.5.desc')}
              </p>
            </div>

          </div>
        </section>

        {/* Packages Section */}
        <section id="packages" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-white/10 bg-gradient-to-b from-slate-950 via-[#0a1228] to-[#050b18] relative overflow-hidden">
          
          {/* Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[160px] pointer-events-none"></div>

          <div className="max-w-7xl mx-auto space-y-10 relative z-10">
            
            {/* Section Header */}
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <div className="inline-flex items-center space-x-2 bg-purple-500/10 border border-purple-500/30 text-purple-300 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>{language === 'sw' ? 'VIFURUSHI NA BEI ZETU' : 'OUR PACKAGES & PRICING'}</span>
              </div>
              
              <h2 className="text-3xl sm:text-5xl font-black text-white font-sans tracking-tight">
                Packages
              </h2>

              {/* Platform Overview Box */}
              <div className="bg-white/5 border border-white/15 backdrop-blur-xl rounded-2xl p-5 sm:p-6 text-slate-200 text-xs sm:text-sm leading-relaxed text-left sm:text-center shadow-2xl space-y-2">
                <h3 className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-300 to-amber-300 font-sans">
                  Event Card Digital Platform
                </h3>
                <p className="text-slate-300">
                  {language === 'sw'
                    ? 'Event Card ni mfumo wa kisasa wa Kidijitali nchini Tanzania unaomwezesha mratibu au kamati yoyote ya sherehe (Harusi, Send-off, Kitchen Party, Kipaimara n.k ), kusimamia mialiko, michango ya fedha, na uthibitisho wa wageni ukumbini kwa njia rahisi na ya kipekee. Mfumo huu hupunguza gharama za uchapishaji na kurahisisha mawasiliano na wageni.'
                    : 'Event Card is a modern Digital Platform in Tanzania enabling event coordinators or planning committees (Weddings, Send-offs, Kitchen Parties, Confirmations, etc.) to manage invitations, financial contributions, and guest verification at the venue seamlessly. This system reduces printing costs and simplifies guest communication.'}
                </p>
              </div>

              {/* Location Badge */}
              <div className="inline-flex items-center space-x-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-lg">
                <MapPin className="w-4 h-4 text-emerald-400 animate-bounce" />
                <span>
                  {language === 'sw'
                    ? 'Huduma Hizi zinapatikana Popote Ulipo Tanzania Nzima'
                    : 'Services Available Everywhere Across Tanzania'}
                </span>
              </div>
            </div>

            {/* Packages Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch pt-4">
              
              {/* 1. Basic Package */}
              <div className="bg-slate-900/90 border border-slate-700/60 rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:border-emerald-500/50 transition-all duration-300 shadow-xl group relative">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="inline-block bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-lg border border-emerald-500/30">
                      BASIC
                    </div>
                    <h3 className="text-2xl font-black text-white font-sans">Basic Package</h3>
                    <div className="bg-emerald-600 text-white font-black text-xl py-2.5 px-4 rounded-xl text-center shadow-md font-mono">
                      TZS 1,000 <span className="text-xs font-normal text-emerald-100">/ {language === 'sw' ? 'Kadi' : 'Card'}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-5 space-y-3 text-xs sm:text-sm text-slate-200">
                    <div className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{language === 'sw' ? 'Ku Design Kadi za Mialiko Za Kidigitali Zenye QR Code.' : 'Design Digital Invitation Cards with QR Code.'}</span>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{language === 'sw' ? 'Kutuma kupitia WhatsApp & SMS' : 'Dispatch via WhatsApp & SMS.'}</span>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{language === 'sw' ? 'Uthibitisho wa Wageni Kujua nani Atahudhuria na ni nani Hatahudhuria' : 'Guest RSVP Confirmation (Attendance Status).'}</span>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{language === 'sw' ? 'Uthibitisho kwa simu kuwapigia wageni simu.' : 'Phone call verification for guests.'}</span>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{language === 'sw' ? 'Scanning Kadi siku ya Sherehe.' : 'Card Scanning on Event Day.'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-8">
                  <button
                    onClick={onStart}
                    className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-emerald-600 text-white font-bold text-sm transition-all duration-200 border border-slate-700 hover:border-emerald-500 shadow-md flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>{language === 'sw' ? 'Chagua Basic Package' : 'Select Basic Package'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 2. Standard Package */}
              <div className="bg-gradient-to-b from-blue-950/90 to-slate-900/90 border-2 border-blue-500/70 rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:border-blue-400 transition-all duration-300 shadow-2xl relative group transform md:-translate-y-2">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] font-black px-4 py-1 rounded-full uppercase tracking-wider shadow-lg border border-blue-400/40">
                  {language === 'sw' ? 'Inayopendekezwa Zaidi' : 'Most Popular'}
                </div>

                <div className="space-y-6">
                  <div className="space-y-3 pt-2">
                    <div className="inline-block bg-blue-500/20 text-blue-300 text-xs font-bold px-3 py-1 rounded-lg border border-blue-500/30">
                      STANDARD
                    </div>
                    <h3 className="text-2xl font-black text-white font-sans">Standard Package</h3>
                    <div className="bg-blue-600 text-white font-black text-xl py-2.5 px-4 rounded-xl text-center shadow-md font-mono">
                      TZS 1,300 <span className="text-xs font-normal text-blue-100">/ {language === 'sw' ? 'Kadi' : 'Card'}</span>
                    </div>
                  </div>

                  <div className="bg-blue-950/90 border border-blue-500/40 rounded-xl p-2.5 text-center text-xs font-black text-blue-200 uppercase tracking-wide">
                    {language === 'sw' ? 'KILA KITU KILICHOPO KWENYE BASIC PACKAGE.' : 'EVERYTHING IN BASIC PACKAGE.'}
                  </div>

                  <div className="space-y-3 text-xs sm:text-sm text-slate-200">
                    <div className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <span className="font-semibold text-white">{language === 'sw' ? 'Ukumbusho wa Tukio (Save the Date)' : 'Event Reminders (Save the Date)'}</span>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <span className="font-semibold text-white">{language === 'sw' ? 'Messages za shukrani baada ya tukio.' : 'Post-event Thank You messages.'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-8">
                  <button
                    onClick={onStart}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm transition-all duration-200 shadow-lg hover:shadow-blue-500/25 flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>{language === 'sw' ? 'Chagua Standard Package' : 'Select Standard Package'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 3. Premium Package */}
              <div className="bg-gradient-to-b from-purple-950/90 to-slate-900/90 border border-purple-500/50 rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:border-purple-400 transition-all duration-300 shadow-xl group relative">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 via-amber-500 to-purple-600 text-white text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-lg border border-purple-300/40 flex items-center space-x-1">
                  <Crown className="w-3 h-3 text-amber-300" />
                  <span>{language === 'sw' ? 'Kifurushi Cha Michango Na Vikao' : 'Full Contributions & Meetings'}</span>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3 pt-2">
                    <div className="inline-block bg-purple-500/20 text-purple-300 text-xs font-bold px-3 py-1 rounded-lg border border-purple-500/30">
                      PREMIUM
                    </div>
                    <h3 className="text-2xl font-black text-white font-sans">Premium Package</h3>
                    <div className="bg-gradient-to-r from-purple-600 to-amber-600 text-white font-black text-xl py-2.5 px-4 rounded-xl text-center shadow-md font-mono">
                      TZS 1,700 <span className="text-xs font-normal text-purple-100">/ {language === 'sw' ? 'Kadi' : 'Card'}</span>
                    </div>
                  </div>

                  <div className="bg-purple-950/90 border border-purple-500/40 rounded-xl p-2.5 text-center text-xs font-black text-purple-200 uppercase tracking-wide">
                    {language === 'sw' ? 'KILA KITU KILICHOPO KWENYE STANDARD PACKAGE.' : 'EVERYTHING IN STANDARD PACKAGE.'}
                  </div>

                  <div className="space-y-3 text-xs sm:text-sm text-slate-200">
                    <div className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                      <span>{language === 'sw' ? 'Ku design kadi za Michango na kutuma Kwa WhatsApp & SMS' : 'Design Contribution Cards & dispatch via WhatsApp & SMS.'}</span>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                      <span>{language === 'sw' ? 'Kukumbusha Michango Kwa wageni Waliotoa Ahadi / Pledge.' : 'Remind Contributions for guests who made pledges (Ahadi).'}</span>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                      <span>{language === 'sw' ? 'SMS za Shukrani baada ya kupokea Michango.' : 'Instant Thank You SMS upon receiving contributions.'}</span>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                      <span>{language === 'sw' ? 'Kupata Report (Real Time) ya Michango kwa Kamati ya maandalizi.' : 'Real-Time Contribution Reports for the planning committee.'}</span>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                      <span>{language === 'sw' ? 'Kutuma SMS za vikao vya Kwa wanakamati.' : 'Send Committee Meeting Reminder SMS to all members.'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-8">
                  <button
                    onClick={onStart}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm transition-all duration-200 shadow-lg hover:shadow-purple-500/25 flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>{language === 'sw' ? 'Chagua Premium Package' : 'Select Premium Package'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-b border-white/10 bg-black/20">
          <div className="max-w-7xl mx-auto text-center space-y-4 mb-16">
            <h3 className="text-xs uppercase font-mono tracking-widest text-[#3b82f6] font-bold">{t('landing.howItWorksTitle')}</h3>
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-sans tracking-tight">
              {t('landing.howItWorksHeading')}
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm">
              {t('landing.howItWorksSub')}
            </p>
          </div>

          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            
            {/* Step 1 */}
            <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-6 border border-white/10 text-center space-y-3 shadow-md relative">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-mono flex items-center justify-center font-bold shadow-lg border border-white/10">1</span>
              <h4 className="font-bold text-white pt-2 font-sans text-base">{t('step.1.title')}</h4>
              <p className="text-xs text-slate-300">
                {t('step.1.desc')}
              </p>
            </div>

            {/* Step 2 */}
            <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-6 border border-white/10 text-center space-y-3 shadow-md relative">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-mono flex items-center justify-center font-bold shadow-lg border border-white/10">2</span>
              <h4 className="font-bold text-white pt-2 font-sans text-base">{t('step.2.title')}</h4>
              <p className="text-xs text-slate-300">
                {t('step.2.desc')}
              </p>
            </div>

            {/* Step 3 */}
            <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-6 border border-white/10 text-center space-y-3 shadow-md relative">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-mono flex items-center justify-center font-bold shadow-lg border border-white/10">3</span>
              <h4 className="font-bold text-white pt-2 font-sans text-base">{t('step.3.title')}</h4>
              <p className="text-xs text-slate-300">
                {t('step.3.desc')}
              </p>
            </div>

            {/* Step 4 */}
            <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-6 border border-white/10 text-center space-y-3 shadow-md relative">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-mono flex items-center justify-center font-bold shadow-lg border border-white/10">4</span>
              <h4 className="font-bold text-white pt-2 font-sans text-base">{t('step.4.title')}</h4>
              <p className="text-xs text-slate-300">
                {t('step.4.desc')}
              </p>
            </div>

          </div>
        </section>

        {/* FAQ Section */}
        <section id="faqs" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-white font-sans tracking-tight">{t('landing.faqTitle')}</h2>
              <p className="text-slate-300 text-sm">{t('landing.faqSub')}</p>
            </div>

            <div className="space-y-4 font-sans text-sm">
              <div className="border border-white/10 p-5 rounded-xl bg-white/5 backdrop-blur-md">
                <h4 className="font-bold text-white mb-1">{t('faq.1.q')}</h4>
                <p className="text-slate-300 leading-relaxed">
                  {t('faq.1.a')}
                </p>
              </div>

              <div className="border border-white/10 p-5 rounded-xl bg-white/5 backdrop-blur-md">
                <h4 className="font-bold text-white mb-1">{t('faq.2.q')}</h4>
                <p className="text-slate-300 leading-relaxed">
                  {t('faq.2.a')}
                </p>
              </div>

              <div className="border border-white/10 p-5 rounded-xl bg-white/5 backdrop-blur-md">
                <h4 className="font-bold text-white mb-1">{t('faq.3.q')}</h4>
                <p className="text-slate-300 leading-relaxed">
                  {t('faq.3.a')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-12 bg-black/45 text-slate-100 px-4 sm:px-6 lg:px-8 border-t border-white/10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="space-y-4 text-left">
              <h3 className="text-xl font-bold font-sans">EVENT<span className="text-red-500">CARD</span> DIGITAL SOLUTIONS</h3>
              <p className="text-slate-400 text-xs max-w-lg">
                {language === 'sw' 
                 ? 'Mfumo Rasmi uliosajiliwa kwa ajili ya usimamizi na uratibu wa matukio, kadi za kidijitali za mwaliko kwa njia ya WhatsApp na SMS dhabiti.' 
                 : 'Official registered platform for digital event management, smart invitations, and seamless WhatsApp & SMS-driven RSVP coordination.'}
              </p>
              <div className="bg-slate-900/60 p-4 border border-white/10 rounded-xl space-y-1 text-xs max-w-md">
                <p className="text-slate-300 font-sans">
                  <strong>{language === 'sw' ? 'Miliki Rasmi ya Kisheria (Legal Entity):' : 'Legal Entity Owner:'}</strong>{' '}
                  <span className="text-white font-bold">EVENT CARD</span>
                </p>
                <p className="text-slate-400">
                  <strong>{language === 'sw' ? 'Namba ya Usajili (BRELA):' : 'BRELA Registration No:'}</strong>{' '}
                  <span className="text-blue-400 font-mono">705371</span>
                </p>
                <p className="text-slate-400">
                  <strong>{language === 'sw' ? 'Namba ya Mlipakodi (TRA TIN):' : 'Taxpayer Identification Number (TIN):'}</strong>{' '}
                  <span className="text-amber-400 font-mono">168-234-698</span>
                </p>
                <p className="text-slate-400">
                  <strong>{language === 'sw' ? 'Mlipakodi Aliyesajiliwa:' : 'Registered Taxpayer:'}</strong>{' '}
                  <span className="text-white font-medium">EVENT CARD</span>
                </p>
                <p className="text-slate-400">
                  <strong>{language === 'sw' ? 'Sheria na Nchi:' : 'Act & Jurisdiction:'}</strong>{' '}
                  <span>The Business Names Act (Cap 213), Tanzania</span>
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-6 text-xs font-mono">
              <span className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-blue-400" />
                <span>info@eventcard.co.tz</span>
              </span>
              <span className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-[#3b82f6]" />
                <span>+255 653 578 184</span>
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer with Compliance Policies */}
      <footer className="bg-[#050b18] text-slate-400 py-8 text-center text-xs border-t border-white/10 space-y-4">
        <div className="flex justify-center space-x-6 text-sm text-slate-400 font-medium">
          <button 
            onClick={() => setActivePolicyTab('privacy')}
            className="hover:text-white transition duration-150 cursor-pointer flex items-center gap-1.5"
          >
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>{language === 'sw' ? 'Sera ya Faragha (Privacy)' : 'Privacy Policy'}</span>
          </button>
          <span className="text-white/10">|</span>
          <button 
            onClick={() => setActivePolicyTab('terms')}
            className="hover:text-white transition duration-150 cursor-pointer flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>{language === 'sw' ? 'Mkataba wa Huduma (Terms)' : 'Terms of Service'}</span>
          </button>
          <span className="text-white/10">|</span>
          <button 
            onClick={() => setActivePolicyTab('delete')}
            className="hover:text-white transition duration-150 cursor-pointer flex items-center gap-1.5"
          >
            <Shield className="w-4 h-4 text-rose-400" />
            <span>{language === 'sw' ? 'Ufutaji wa Data (Data Deletion)' : 'Data Deletion'}</span>
          </button>
        </div>
        <div className="space-y-1.5 max-w-2xl mx-auto px-4">
          <p className="text-slate-500">{t('landing.rights')}</p>
          <p className="text-[11px] text-slate-400 leading-normal font-sans">
            {language === 'sw'
              ? 'EVENTCARD ni jukwaa la kiteknolojia linalomilikiwa na EVENT CARD (Namba ya Usajili BRELA: 705371), Dar es Salaam, Jamhuri ya Muungano wa Tanzania.'
              : 'EVENTCARD is a digital technology platform operated by EVENT CARD (BRELA Registration No: 705371), Dar es Salaam, United Republic of Tanzania.'}
          </p>
        </div>
        <p className="text-[10px] text-slate-600 max-w-2xl mx-auto px-4 leading-relaxed">
          Disclaimer: WhatsApp is a registered trademark of Meta Platforms, Inc. This application uses the official Meta Cloud API strictly to send customized invitations and RSVP checks with positive opt-in consent from our users.
        </p>
      </footer>

      {/* Policies Modal */}
      {activePolicyTab && (
        <div className="fixed inset-0 z-50 bg-[#030712]/92 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0b1328] border border-white/15 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative" id="policy-modal">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#111a36]">
              <div className="flex items-center space-x-2 text-white">
                {activePolicyTab === 'privacy' ? <Shield className="w-5 h-5 text-emerald-400" /> : activePolicyTab === 'delete' ? <Shield className="w-5 h-5 text-rose-400" /> : <FileText className="w-5 h-5 text-blue-400" />}
                <h3 className="text-lg font-bold font-sans">
                  {activePolicyTab === 'privacy' 
                    ? (language === 'sw' ? 'Sera ya Faragha - EVENT CARD' : 'Privacy & Data Protection Policy') 
                    : activePolicyTab === 'delete'
                    ? (language === 'sw' ? 'Maelekezo ya Kufuta Data' : 'Data Deletion Instructions')
                    : (language === 'sw' ? 'Masharti na Mkataba wa Huduma' : 'Terms of Service & API Agreement')}
                </h3>
              </div>
              <button 
                onClick={() => setActivePolicyTab(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition duration-150 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto text-slate-300 space-y-6 text-sm font-sans leading-relaxed text-left">
              {activePolicyTab === 'privacy' ? (
                <>
                  {/* Privacy Policy Content */}
                  <div>
                    <h4 className="font-bold text-white text-base mb-2">1. Utangulizi / Introduction</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Jukwaa la EVENTCARD linaendeshwa na <strong>EVENT CARD</strong> (Namba ya Usajili: 705371). Tunajitolea kulinda faragha ya data zako zote. Sera hii inaeleza jinsi tunavyokusanya, kutumia, kuhifadhi, na kulinda orodha ya wageni (majina na namba za simu) unapojiandikisha kwenye mfumo wetu kutuma kadi za mialiko na kupata RSVP kupitia WhatsApp Business API.
                    </p>
                    <p>
                      <strong>English:</strong> The EVENTCARD platform is operated by <strong>EVENT CARD</strong> (BRELA Registration No: 705371). We are strictly committed to protecting user privacy. This policy details how we collect, process, store, and safeguard guest contact information (names and telephone numbers) when you utilize our digital system to dispatch invitation cards and obtain real-time RSVP responses using the Meta WhatsApp Business API.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base mb-2">2. Ukusanyaji wa Data & Uidhinishaji (Data Harvesting & Consents)</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Unapopakia orodha ya wageni wako, tunajaza majina yao, namba ya simu ya nchi husika, na hadhi zao za RSVP. Ni wajibu wa mratibu wa kamati au bwana/bibi harusi kuhakikisha kuwa wageni waliorodheshwa wanatarajia mwaliko huu na wamekubali kupokea taarifa. Hatutumi na hatutawahi kutuma rasilimali za utangazaji au ujumbe wa spam usiohitajika.
                    </p>
                    <p>
                      <strong>English:</strong> When you upload your guest directory, we process guest names, registered phone numbers under country protocols, and RSVP tallies. It is the sole responsibility of the host (the Event Committee or Couple) to ensure guests have an established active connection model and expect to receive the invitation metadata. We absolutely do not send unauthorized advertising or spam.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base mb-2">3. WhatsApp Business API - Uwasilishaji na Uhakiki wa Ridhaa (Opt-In & Opt-Out Policy)</h4>
                    <p className="mb-2">
                      {language === "en" ? <><strong>English:</strong> Every WhatsApp message sent from our system includes an opt-out guide. A guest can reply with the word <strong>"STOP"</strong> or <strong>"CANCEL"</strong> to trigger an automated response that immediately removes their number from future reminders. This ensures our full compliance with WhatsApp Business policies.</> : <><strong>Swahili:</strong> Kila ujumbe wa WhatsApp unaotumwa kutoka kwenye mfumo wetu unajumuisha mwongozo wa jinsi ya KUKATAA (Exit/Opt-out). Mgeni anaweza kuandika neno <strong>"STOP"</strong> au <strong>"KANSILA"</strong> kurudisha jibu la kiotomatiki linalofuta mara moja namba yake kwenye vikumbusho vya baadae. Hii inahakikisha utii wetu kamili kwa sera za WhatsApp Business.</>}
                    </p>
                    <p>
                      <strong>English:</strong> Every WhatsApp transmission dispatched through our system includes an explicit, interactive guide for Opt-Out. Any guest can reply with the keyword <strong>"STOP"</strong> to instantly suppress future automated reminders. This mechanism strictly complies with Meta’s Core Policy for WhatsApp Interactive Messaging.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base mb-2">4. Kushirikiana kwa Data na Usalama (Data Integrity & Third Party Sharing Restrictions)</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Hatutoi, hatuuzi, wala hatuonyeshi namba za simu za wageni wako kwa makampuni mengine ya biashara au mashirika ya upande wa tatu. Data zote zinasimbwa kwa njia thabiti (encryption) kwenye seva na kutumiwa TU kwa ajili ya mchakato wa RSVP wa tukio husika ambalo mtumiaji amesajili.
                    </p>
                    <p>
                      <strong>English:</strong> We do not sell, rent, or lease your guests' telephone contact lists to independent advertisers, brokers, or external entities. All databases are securely isolated and encrypted under modern TLS/SSL security, analyzed solely to fulfill the RSVP event tracking actions requested by physical organizers.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base mb-2">{language === 'sw' ? '5. Mawasiliano na Maswali' : '5. Contact Information'}</h4>
                    <p className="mb-2 text-slate-400">
                      {language === 'sw' 
                        ? 'Idara ya Utawala na Faragha ya Data - Miliki ya Kisheria:'
                        : 'Administrative & Data Privacy Department - Legal Owner:'}
                    </p>
                    <p className="font-black text-white text-sm">EVENT CARD</p>
                    <p className="text-xs text-slate-400 mb-0.5">
                      {language === 'sw' ? 'Namba ya Sajili BRELA: 705371' : 'Tanzanian BRELA Registration No: 705371'}
                    </p>
                    <p className="text-xs text-slate-400 mb-0.5">
                      {language === 'sw' ? 'TIN ya Mlipakodi: 168-234-698' : 'Taxpayer Identification Number (TIN): 168-234-698'} (EVENT CARD)
                    </p>
                    <p className="text-xs text-slate-400 mb-2">
                      {language === 'sw' ? 'Anwani ya Ofisi: Plot 00, Block 00, Kilungule B, Kinondoni, Dar es Salaam, Tanzania' : 'Physical Address: Plot 00, Block 00, Kilungule B, Kinondoni, Dar es Salaam, Tanzania'}
                    </p>
                    <p>📧 Email: privacy@eventcard.co.tz</p>
                  </div>
                </>
              
              ) : activePolicyTab === 'delete' ? (
                <>
                  <div>
                    <h4 className="font-bold text-white text-base mb-2">1. Jinsi ya Kufuta Data Zako / How to Delete Your Data</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Ikiwa unataka kufuta taarifa zako (kama vile namba yako ya simu au jina lako kwenye orodha ya wageni), unaweza kuwasiliana na mratibu wako wa tukio ambaye atakuondoa kwenye orodha kupitia Mfumo wa EVENTCARD. Pia unaweza kututumia barua pepe moja kwa moja kupitia <strong>info@eventcard.co.tz</strong> au kutumia WhatsApp kwa kutuma neno "FUTA" na tutaziondoa data zako mara moja.
                    </p>
                    <p>
                      <strong>English:</strong> If you wish to delete your data (such as your phone number or name on a guest list), you can contact your event host who can remove you from their directory via the EVENTCARD platform. Alternatively, you can email us directly at <strong>info@eventcard.co.tz</strong> or reply to our WhatsApp messages with the word "REMOVE" and we will permanently delete your data.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base mb-2">2. Akaunti za Kamati au Waandaaji / Hosts & Committee Accounts</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Ikiwa wewe ni mwandaaji (host) na unataka kufuta akaunti yako na data zote zinazohusiana na matukio yako, tafadhali wasiliana na info@eventcard.co.tz ukitaja namba ya tukio lako na tutakufutia data zako zote kwenye seva zetu ndani ya saa 24.
                    </p>
                    <p>
                      <strong>English:</strong> If you are an event host and wish to delete your account along with all associated event and guest data, please email info@eventcard.co.tz specifying your Event ID. We will purge all related data from our servers within 24 hours.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Terms of Service Content */}
                  <div>
                    <h4 className="font-bold text-white text-base mb-2">1. Kukubaliana na Masharti (Acceptance of Terms)</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Kwa kusajili harusi au tukio lolote ndani ya jukwaa la EVENTCARD, unakubali kufuata kanuni na sheria zote za nchi yetu (Sheria ya Ulinzi wa Data ya Kibinafsi, 2022) na Sheria za Biashara za Meta WhatsApp. Huduma hizi zinaendeshwa kisheria na <strong>EVENT CARD</strong> (Namba ya Usajili 705371).
                    </p>
                    <p>
                      <strong>English:</strong> By registering a ceremony, wedding, or gala inside the EVENTCARD dashboard, you fully agree to meet Tanzanian national digital provisions (Personal Data Protection Act, 2022) and standard Meta Platforms Business policies for automated notifications. These services are officially operated by <strong>EVENT CARD</strong> (BRELA Registration No. 705371).
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base mb-2">2. Matumizi Yanayoruhusiwa (Permitted Usage & Compliance)</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Ni marufuku kutumia mfumo huu kutuma ujumbe wowote wa kisiasa, matangazo ya kibiashara kujitafutia wateja binafsi, habari potofu, au tabia ya unyanyasaji. Mfumo huu umetengenezwa kwa ajili ya kadi za matukio (mialiko ya harusi, vipindi vya kwaya, mikutano, nk) pekee.
                    </p>
                    <p>
                      <strong>English:</strong> Users are strictly prohibited from utilizing this system to dispatch political materials, unsolicited retail solicitations, bulk spam sequences, or offensive communications. The application is solely intended as a premium invitation interface for authenticated familial, corporate, and communal gatherings.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base mb-2">3. Gharama za API & Upatikanaji (API Conditions & Service Outages)</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Uwasilishaji wa ujumbe wa WhatsApp huendeshwa kupitia miundombinu thabiti ya Meta Business API. Wakati mwingine matatizo ya mtandao duniani yanaweza kusababisha ucheleweshaji mdogo wa ujumbe unaotumwa. <strong>EVENT CARD</strong> inajitahidi kutoa asilimia 99.9 ya uhakika wa utendaji wa mfumo.
                    </p>
                    <p>
                      <strong>English:</strong> WhatsApp dispatching is serviced by the official Meta Business Cloud API framework. In rare moments of trans-network failures, delivery latency might fluctuate. <strong>EVENT CARD</strong> guarantees a 99.9% system uptime commitment for backend API services.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base mb-2">4. Ukomeshaji wa Akaunti (Account Suspension Actions)</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Akaunti yoyote inayoripotiwa kutuma mwaliko wenye namba zenye mashaka au isiyo na ridhaa itafungwa haraka ili kulinda taswira ya namba zetu za API na usalama wa wateja wengine. Mabadiliko ya usimamizi yanaendeshwa na timu yetu ya usalama ya <strong>EVENT CARD</strong>.
                    </p>
                    <p>
                      <strong>English:</strong> Any user profile flagged for outbound transmission of spam or non-consensual telephone import directories will undergo instant administrative review and termination to protect overall API deliverability standards. Compliance actions are governed securely by the <strong>EVENT CARD</strong> security desk.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex justify-end bg-[#0e172e]">
              <button 
                onClick={() => {
                  setActivePolicyTab(null);
                }}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] text-white text-xs font-semibold px-5 py-2.5 rounded-lg cursor-pointer transition duration-150"
              >
                {language === 'sw' ? 'Nimesoma na Kuelewa' : 'I Understand'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
