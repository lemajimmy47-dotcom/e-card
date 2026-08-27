import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, User, AlertCircle, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { safeLocalStorage } from '../utils/storage';

interface LoginProps {
  onSuccess: () => void;
  onBack: () => void;
}

export default function Login({ onSuccess, onBack }: LoginProps) {
  const { language, setLanguage, t } = useLanguage();
  const [username, setUsername] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('username') || params.get('user') || '';
    } catch (e) {
      return '';
    }
  });
  const [password, setPassword] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('password') || params.get('pass') || '';
    } catch (e) {
      return '';
    }
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Fetch the latest state to dynamically validate Event IDs on any device
      const response = await fetch('/api/state');
      const validEventIds = ['event-starter', 'wedding-jimson-lema'];

      if (response.ok) {
        const data = await response.json();
        const currentEvents = data.eventsList || [];
        const currentEventDetails = data.eventDetails || null;

        if (Array.isArray(currentEvents)) {
          currentEvents.forEach((ev: any) => {
            if (ev.id && !validEventIds.includes(ev.id)) {
              validEventIds.push(ev.id);
            }
          });
        }
        if (currentEventDetails && currentEventDetails.id && !validEventIds.includes(currentEventDetails.id)) {
          validEventIds.push(currentEventDetails.id);
        }
      }

      const trimmedUser = username.trim().toLowerCase();
      const trimmedPass = password.trim();

      const logAttempt = async (success: boolean) => {
        try {
          await fetch('/api/auth/login-attempt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: trimmedUser, success })
          });
        } catch (err) {
          console.warn('Failed to log login attempt', err);
        }
      };

      if (trimmedUser === 'jimson' && (trimmedPass === 'jimson' || trimmedPass === 'admin')) {
        await logAttempt(true);
        safeLocalStorage.removeItem('eventcard_scanner_mode');
        safeLocalStorage.removeItem('eventcard_scanner_event_id');
        onSuccess();
      } else if (
        trimmedUser === 'scanner' && 
        (validEventIds.includes(trimmedPass) || 
         validEventIds.map(id => id.toLowerCase()).includes(trimmedPass.toLowerCase()))
      ) {
        await logAttempt(true);
        // Find correct cased ID if matched in a case-insensitive way
        const correctCasedId = validEventIds.find(id => id.toLowerCase() === trimmedPass.toLowerCase()) || trimmedPass;
        safeLocalStorage.setItem('eventcard_scanner_mode', 'true');
        safeLocalStorage.setItem('eventcard_scanner_event_id', correctCasedId);
        onSuccess();
      } else {
        await logAttempt(false);
        setError(language === 'sw' 
          ? 'Jina la mtumiaji au nenosiri si sahihi! Kwa mlinzi mlangoni, weka username kuelekezwa "scanner" na password kuwa ID ya tukio.'
          : 'Incorrect username or password! Scanners should use username "scanner" and Event ID as password.');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.warn('Network issue fetching state, falling back to local storage:', err);
      const savedEvents = safeLocalStorage.getItem('kadi_events_list');
      const savedEvent = safeLocalStorage.getItem('kadi_event');
      const fallbackEventIds = ['event-starter', 'wedding-jimson-lema'];

      if (savedEvents) {
        try {
          const parsed = JSON.parse(savedEvents);
          if (Array.isArray(parsed)) {
            parsed.forEach((ev: any) => {
              if (ev.id) fallbackEventIds.push(ev.id);
            });
          }
        } catch (e) {}
      }
      if (savedEvent) {
        try {
          const parsed = JSON.parse(savedEvent);
          if (parsed.id) fallbackEventIds.push(parsed.id);
        } catch (e) {}
      }

      const trimmedUser = username.trim().toLowerCase();
      const trimmedPass = password.trim();

      const logAttempt = async (success: boolean) => {
        try {
          await fetch('/api/auth/login-attempt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: trimmedUser, success })
          });
        } catch (err) {
          console.warn('Failed to log login attempt', err);
        }
      };

      if (trimmedUser === 'jimson' && (trimmedPass === 'jimson' || trimmedPass === 'admin')) {
        await logAttempt(true);
        safeLocalStorage.removeItem('eventcard_scanner_mode');
        safeLocalStorage.removeItem('eventcard_scanner_event_id');
        onSuccess();
      } else if (
        trimmedUser === 'scanner' && 
        (fallbackEventIds.includes(trimmedPass) || 
         fallbackEventIds.map(id => id.toLowerCase()).includes(trimmedPass.toLowerCase()))
      ) {
        await logAttempt(true);
        const correctCasedId = fallbackEventIds.find(id => id.toLowerCase() === trimmedPass.toLowerCase()) || trimmedPass;
        safeLocalStorage.setItem('eventcard_scanner_mode', 'true');
        safeLocalStorage.setItem('eventcard_scanner_event_id', correctCasedId);
        onSuccess();
      } else {
        await logAttempt(false);
        setError(language === 'sw' 
          ? 'Hitilafu ya mtandao au taarifa zisizo sahihi! Tafadhali thibitisha muunganisho wa internet na ujaribu tena.'
          : 'Network error or incorrect credentials! Please check your internet connection and verify credentials.');
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#050b18] text-white flex flex-col justify-center items-center px-4 font-sans relative overflow-hidden" id="login-root">
      
      {/* Absolute Ambient Background Blur circles aligned with Design HTML guidelines */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/15 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/15 rounded-full blur-[140px]"></div>
      </div>

      {/* Floating Back Button */}
      <button 
        id="login-back-btn"
        onClick={onBack}
        className="absolute top-6 left-6 flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/10 shadow-sm transition backdrop-blur-md relative z-10 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{t('login.btnBack')}</span>
      </button>

      {/* Floating Language Toggler on Top Right */}
      <div className="absolute top-6 right-6 flex bg-white/5 p-0.5 rounded-xl border border-white/10 shadow-sm transition backdrop-blur-md relative z-10">
        <button
          onClick={() => setLanguage('sw')}
          className={`px-2 py-1 text-[9px] font-extrabold rounded-lg transition-all cursor-pointer ${
            language === 'sw' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          SW
        </button>
        <button
          onClick={() => setLanguage('en')}
          className={`px-2 py-1 text-[9px] font-extrabold rounded-lg transition-all cursor-pointer ${
            language === 'en' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          EN
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl rounded-[1.75rem] p-8 space-y-6 relative z-10"
      >
        {/* Brand / Title Header */}
        <div className="text-center space-y-4">
          <img src="/logo.png" alt="Event Card Logo" className="h-16 w-auto object-contain mx-auto" />
          <p className="text-xs text-slate-300">
            {t('login.sub')}
          </p>
        </div>

        {/* Informative Hint Banner */}
        <div className="backdrop-blur-md bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl text-[11px] text-slate-300 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full filter blur-lg pointer-events-none"></div>

          <div className="space-y-1">
            <p className="font-bold uppercase tracking-wider text-[9px] text-emerald-400 font-mono">
              {language === 'sw' ? 'Jopo la Msomaji Kadi TU (Restricted Scanner):' : 'Scanner-Only Portal (Scanner):'}
            </p>
            <div className="space-y-2 font-sans text-[11px] pl-2 leading-relaxed">
              <p>• {t('login.username')}: <strong className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white border border-white/5">scanner</strong></p>
              <p>• {t('login.password')}: <strong className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white border border-white/5">ID ya Sherehe (Event ID)</strong></p>
              <p className="text-[10px] text-slate-400 italic">
                {language === 'sw' 
                  ? 'Inaruhusu kuskani kadi na kuhakiki wageni mlangoni bila kuona salio, kuongeza wageni au kubenua mipangilio ya mwaliko.'
                  : 'Allows scanning and checking in guests without access to dashboard metrics, template settings, or financial panels.'}
              </p>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-2xl text-xs text-rose-300 flex items-start space-x-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Standard Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          
          {/* Username Input */}
          <div className="space-y-1">
            <label className="block text-slate-300 font-semibold" htmlFor="login-username-input">
              {t('login.username')}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 font-mono">
                <User className="w-4 h-4" />
              </span>
              <input 
                id="login-username-input"
                type="text"
                autoFocus
                required
                placeholder={language === 'sw' ? "Mtumiaji" : "Username"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-xs font-mono transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-slate-300 font-semibold" htmlFor="login-password-input">
                {t('login.password')}
              </label>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input 
                id="login-password-input"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-[#030712]/5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-xs font-mono transition-all"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button 
            id="login-submit-btn"
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] text-white font-semibold rounded-xl tracking-wide transition shadow-md disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{language === 'sw' ? 'Inahakiki...' : 'Verifying...'}</span>
              </>
            ) : (
              <span>{t('login.btnSubmit')}</span>
            )}
          </button>

        </form>
      </motion.div>
    </div>
  );
}
