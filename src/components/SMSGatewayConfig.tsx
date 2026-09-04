import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, Search, Bell, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function SMSGatewayConfig() {
  const { language, t } = useLanguage();
  const isEn = language === 'en';
  const [gatewaySettings, setGatewaySettings] = useState({
    provider: 'simulation',
    url: '',
    apiKey: '',
    apiSecret: '',
    senderId: '',
    senderIdStatus: 'approved',
    whatsappUrl: '',
    customHeaders: '{}',
    customBody: '{\n  "to": "{to}",\n  "message": "{message}"\n}'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [balance, setBalance] = useState<number | string | null>(null);

  // New WhatsApp Integration sub-states
  const [whatsappProvider, setWhatsappProvider] = useState<'simulation' | 'meta' | 'custom_webhook'>('simulation');
  const [whatsappUrlInput, setWhatsappUrlInput] = useState('');
  const [whatsappMetaToken, setWhatsappMetaToken] = useState('');
  const [whatsappMetaPhoneId, setWhatsappMetaPhoneId] = useState('');
  const [whatsappMetaWabaId, setWhatsappMetaWabaId] = useState('');
  const [whatsappMetaTemplateName, setWhatsappMetaTemplateName] = useState('kadi_mwaliko');
  const [whatsappMetaLang, setWhatsappMetaLang] = useState('sw');

  // Automated RSVP WhatsApp Notification States
  const [adminWhatsAppPhone, setAdminWhatsAppPhone] = useState('');
  const [autoRsvpAlertsEnabled, setAutoRsvpAlertsEnabled] = useState(true);
  const [guestRsvpConfirmEnabled, setGuestRsvpConfirmEnabled] = useState(true);
  const [isTestingAdminAlert, setIsTestingAdminAlert] = useState(false);
  const [adminAlertTestResult, setAdminAlertTestResult] = useState<any>(null);
  const [testPhone, setTestPhone] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isTriggeringMeta, setIsTriggeringMeta] = useState(false);
  const [metaTriggerLogs, setMetaTriggerLogs] = useState<string[]>([]);
  const [isFetchingIds, setIsFetchingIds] = useState(false);
  const [hasFetchedIds, setHasFetchedIds] = useState(false);
  const [availableIds, setAvailableIds] = useState<{ id: string, sender_id: string, status: string }[]>([]);

  // WhatsApp Webhook & Auto-Reply Diagnostics State
  const [whatsappLogs, setWhatsappLogs] = useState<any[]>([]);
  const [botTestPhone, setBotTestPhone] = useState('255622443249');
  const [botTestMessage, setBotTestMessage] = useState('Ukumbi uko wapi?');
  const [isTestingBot, setIsTestingBot] = useState(false);
  const [botTestResult, setBotTestResult] = useState<any>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/whatsapp-logs');
      const data = await res.json();
      if (Array.isArray(data)) {
        setWhatsappLogs(data);
      }
    } catch (e) {
      console.warn("Error fetching whatsapp logs:", e);
    }
  };

  const handleTestChatbot = async () => {
    if (!botTestPhone || !botTestMessage) return;
    setIsTestingBot(true);
    setBotTestResult(null);
    try {
      const res = await fetch('/api/whatsapp/test-autoreply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: botTestPhone, message: botTestMessage })
      });
      const data = await res.json();
      setBotTestResult(data);
      fetchLogs();
    } catch (err: any) {
      setBotTestResult({ success: false, error: err.message || "Failed to reach server" });
    } finally {
      setIsTestingBot(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm(isEn ? "Clear all WhatsApp logs?" : "Futa kumbukumbu zote za WhatsApp?")) return;
    try {
      await fetch('/api/whatsapp-logs', { method: 'DELETE' });
      setWhatsappLogs([]);
    } catch (e) {}
  };

  const handleTestAdminAlert = async () => {
    setIsTestingAdminAlert(true);
    setAdminAlertTestResult(null);
    try {
      const res = await fetch('/api/whatsapp/test-admin-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: adminWhatsAppPhone })
      });
      const data = await res.json();
      setAdminAlertTestResult(data);
      fetchLogs();
    } catch (err: any) {
      setAdminAlertTestResult({ success: false, error: err.message || "Hitilafu ya muunganisho wa mfumo" });
    } finally {
      setIsTestingAdminAlert(false);
    }
  };

  useEffect(() => {
    setAvailableIds([]);
    setHasFetchedIds(false);
  }, [gatewaySettings.provider]);

  const fetchEhubIds = async (overrideSettings?: any) => {
    const settingsToUse = overrideSettings || gatewaySettings;
    if (!settingsToUse.apiKey || !settingsToUse.apiSecret) {
      if (!overrideSettings) alert(isEn ? "Please enter API Key and Secret first" : "Tafadhali weka API Key na Secret kwanza");
      return;
    }
    setIsFetchingIds(true);
    setHasFetchedIds(true);
    try {
      const res = await fetch('/api/fetch-ehub-sender-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsToUse })
      });
      const data = await res.json();
      
      const items = Array.isArray(data) 
        ? data 
        : (Array.isArray(data?.own)
            ? data.own
            : (Array.isArray(data?.data) 
                ? data.data 
                : (data?.data?.own && Array.isArray(data.data.own)
                    ? data.data.own
                    : (data?.data?.items && Array.isArray(data.data.items) 
                        ? data.data.items 
                        : []))));

      if (items.length > 0) {
        setAvailableIds(items);
        // Auto-select first approved UUID if current senderId is sample placeholder or non-UUID
        const approvedItem = items.find((it: any) => !it.status || it.status === 'approved' || it.status === 'active') || items[0];
        if (approvedItem) {
          const candidateUuid = approvedItem.id || approvedItem.sender_id;
          if (candidateUuid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateUuid)) {
            if (settingsToUse.senderId === '00420892-38bd-47b0-9a5f-ea55bef5d2d1' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(settingsToUse.senderId)) {
              setGatewaySettings(prev => ({ ...prev, senderId: candidateUuid }));
            }
          }
        }
      } else if (data.success === false || data.error || data.message) {
        const errorMsg = data.message || data.error || (isEn ? "No approved Sender IDs found" : "Hakuna Sender ID zilizoidhinishwa");
        if (!overrideSettings) alert(isEn ? "Imeshindwa: " + errorMsg : "Imeshindwa: " + errorMsg);
        setAvailableIds([]);
      } else {
        setAvailableIds([]);
      }
    } catch (err) {
      if (!overrideSettings) alert(isEn ? "Connection error" : "Hitilafu ya mtandao");
    } finally {
      setIsFetchingIds(false);
    }
  };

  const fetchSwalaIds = async (apiKeyOverride?: string) => {
    const keyToUse = apiKeyOverride || gatewaySettings.apiKey || "swl_live_vtWJVXNYyVpjhUcu3PNFuOvL1WX6nXzE0yz9qVImRwNCP5a3";
    setIsFetchingIds(true);
    setHasFetchedIds(true);
    try {
      const res = await fetch('/api/fetch-swalasms-sender-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToUse })
      });
      const data = await res.json();
      const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      if (items.length > 0) {
        setAvailableIds(items.map((it: any) => ({
          id: it.sender_id,
          sender_id: it.sender_id,
          status: it.status || 'approved'
        })));
      } else {
        setAvailableIds([]);
      }
    } catch {
      setAvailableIds([]);
    } finally {
      setIsFetchingIds(false);
    }
  };

  const fetchBalance = () => {
    fetch('/api/sms-balance')
      .then(res => res.json())
      .then(data => {
        if (data && data.balance !== undefined) {
          setBalance(data.balance);
        }
      })
      .catch(err => console.warn("Failed to fetch balance:", err));
  };

  useEffect(() => {
    fetch('/api/sms-settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.provider) {
          if (data.senderId === '00420892-38bd-47b0-9a5f-ea55bef5d2d1') {
            data.senderId = '339330f1-4e6a-4bf7-a9f8-eaae2a9dd397';
          }
          setGatewaySettings(prev => ({ ...prev, ...data }));
          
          // Deserialize WhatsApp Cloud API settings if packed as generic JSON
          const wUrl = data.whatsappUrl || '';
          if (wUrl.trim().startsWith('{') && wUrl.trim().endsWith('}')) {
            try {
              const parsed = JSON.parse(wUrl);
              if (parsed.provider === 'meta') {
                setWhatsappProvider('meta');
                setWhatsappMetaToken(parsed.meta_token || '');
                setWhatsappMetaPhoneId(parsed.phone_number_id || '');
                setWhatsappMetaWabaId(parsed.waba_id || '');
                setWhatsappMetaTemplateName(parsed.template_name || 'kadi_mwaliko');
                let lang = parsed.template_lang || 'sw';
                if (lang.toLowerCase() === 'swahili') lang = 'sw';
                if (lang.toLowerCase() === 'english') lang = 'en';
                setWhatsappMetaLang(lang);
                setWhatsappUrlInput('');
              } else {
                setWhatsappProvider('custom_webhook');
                setWhatsappUrlInput(wUrl);
              }
            } catch (e) {
              setWhatsappProvider('custom_webhook');
              setWhatsappUrlInput(wUrl);
            }
          } else if (wUrl) {
            setWhatsappProvider('custom_webhook');
            setWhatsappUrlInput(wUrl);
          } else {
            setWhatsappProvider('simulation');
            setWhatsappUrlInput('');
          }
          if (data.provider === 'ehub' && data.apiKey && data.apiSecret) {
            fetchEhubIds(data);
          }
        }
        if (data) {
          if (data.adminWhatsAppPhone !== undefined) {
            setAdminWhatsAppPhone(data.adminWhatsAppPhone);
          }
          if (data.autoRsvpAlertsEnabled !== undefined) {
            setAutoRsvpAlertsEnabled(data.autoRsvpAlertsEnabled !== false);
          }
          if (data.guestRsvpConfirmEnabled !== undefined) {
            setGuestRsvpConfirmEnabled(data.guestRsvpConfirmEnabled !== false);
          }
        }
        setIsLoaded(true);
        fetchBalance();
        fetchLogs();

        // Dedicated alert phone is loaded from its own setting
        if (data && data.adminWhatsAppPhone) {
          setAdminWhatsAppPhone(data.adminWhatsAppPhone);
        }
      })
      .catch(err => {
        console.error("Error fetching SMS gateway settings:", err);
        setIsLoaded(true);
      });
  }, []);

  // Poll for sender ID status if it's pending
  useEffect(() => {
    if (gatewaySettings.provider === 'simulation' || gatewaySettings.senderIdStatus !== 'pending') return;

    const interval = setInterval(() => {
      fetch('/api/sms/request-sender-id')
        .then(res => res.json())
        .then(data => {
          if (data.status && data.status !== gatewaySettings.senderIdStatus) {
            setGatewaySettings(prev => ({ ...prev, senderIdStatus: data.status }));
          }
        })
        .catch(err => console.warn("Failed to poll sender ID status:", err));
    }, 5000);

    return () => clearInterval(interval);
  }, [gatewaySettings.senderIdStatus, gatewaySettings.provider]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // Serialize WhatsApp settings before dispatching to backend
    let finalWhatsappUrl = '';
    if (whatsappProvider === 'meta') {
      let lang = whatsappMetaLang.trim().toLowerCase();
      if (lang === 'swahili') lang = 'sw';
      if (lang === 'english') lang = 'en';
      
      finalWhatsappUrl = JSON.stringify({
        provider: 'meta',
        meta_token: whatsappMetaToken.trim(),
        phone_number_id: whatsappMetaPhoneId.trim(),
        waba_id: whatsappMetaWabaId.trim(),
        template_name: whatsappMetaTemplateName.trim(),
        template_lang: lang
      });
    } else if (whatsappProvider === 'custom_webhook') {
      finalWhatsappUrl = whatsappUrlInput.trim();
    }

    const payload = {
      ...gatewaySettings,
      adminWhatsAppPhone: adminWhatsAppPhone.trim(),
      autoRsvpAlertsEnabled,
      guestRsvpConfirmEnabled,
      whatsappUrl: finalWhatsappUrl
    };

    fetch('/api/sms-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error("Kuhifadhi kulishindwa");
        return res.json();
      })
      .then(() => {
        alert(isEn ? "Gateway configuration saved successfully!" : "Mipangilio ya Gateway imehifadhiwa vizuri!");
      })
      .catch(err => {
        alert((isEn ? "Error saving: " : "Hitilafu imetokea: ") + err.message);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleTestMeta = () => {
    if (!testPhone.trim()) {
      alert(isEn ? "Please enter a test phone number" : "Tafadhali weka namba ya simu ya majaribio");
      return;
    }
    setIsTesting(true);
    fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testPhone.trim(),
        text: isEn ? "Ujumbe wa Majaribio" : "Ujumbe wa Majaribio wa WhatsApp",
        channel: 'whatsapp',
        templateParams: ["Mjaribiwa", "EventCard"]
      })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(err => { throw new Error(err.error || "Failed"); });
        }
        return res.json();
      })
      .then(data => {
        if (data.success) {
          alert(isEn 
            ? "Success! Test message sent. Please check your phone. If you used your Meta sandbox number, the API call should now show 1/1 (Completed) on Meta Developer Portal!" 
            : "Hongera! Ujumbe wa majaribio umetumwa vizuri. Tafadhali kagua simu yako. Kama umetumia namba yako ya sandbox, jaribio la API sasa litaonyesha 1/1 (Completed) kule Meta Developer Portal!");
        } else {
          alert((isEn ? "Failed: " : "Imeshindikana: ") + (data.log || "Unknown error"));
        }
      })
      .catch(err => {
        alert((isEn ? "Error: " : "Hitilafu: ") + err.message);
      })
      .finally(() => {
        setIsTesting(false);
      });
  };

  const handleTriggerMetaReviewCalls = () => {
    if (!whatsappMetaToken.trim()) {
      alert(isEn ? "Please enter your Meta Access Token first" : "Tafadhali weka Meta Access Token kwanza");
      return;
    }
    setIsTriggeringMeta(true);
    setMetaTriggerLogs([isEn ? "Starting Meta API review test queries..." : "Inaanza kufanya majaribio ya API za Meta..."]);

    fetch('/api/meta-trigger-review-calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meta_token: whatsappMetaToken.trim(),
        waba_id: whatsappMetaWabaId.trim(),
        phone_number_id: whatsappMetaPhoneId.trim()
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.logs) {
          setMetaTriggerLogs(data.logs);
          alert(isEn 
            ? "Meta API review calls completed! Please refresh your Meta App Review Testing Dashboard in a few seconds." 
            : "Majaribio ya API za Meta yamekamilika kwa ufanisi! Tafadhali weka upya (refresh) ukurasa wako wa Meta Developer katika sekunde chache.");
        } else {
          setMetaTriggerLogs([`❌ Error: ${data.error || "Unknown error"}`]);
        }
      })
      .catch(err => {
        setMetaTriggerLogs([`❌ Hitilafu: ${err.message}`]);
      })
      .finally(() => {
        setIsTriggeringMeta(false);
      });
  };

  if (!isLoaded) return <div className="animate-pulse text-xs text-slate-400">Loading Gateway Settings...</div>;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 max-w-lg">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-emerald-400" />
          {isEn ? "Global SMS Gateway Settings" : "Mipangilio ya SMS Gateway (Jumla)"}
        </h3>
        {(gatewaySettings.provider !== 'simulation' || gatewaySettings.senderId || balance !== null) && (
          <div className="flex items-center gap-3">
            {balance !== null && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase cursor-pointer hover:bg-blue-500/20 transition" onClick={fetchBalance} title="Click to refresh balance">
                <RefreshCw className="w-2.5 h-2.5" />
                <span>{balance} SMS</span>
              </div>
            )}
            {gatewaySettings.senderId && (
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[9px] font-bold uppercase ${
                gatewaySettings.senderIdStatus === 'approved' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : gatewaySettings.senderIdStatus === 'pending'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                <span>{gatewaySettings.senderId}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        {isEn 
          ? "Configure your SMS Gateway here once, and it will be used across all modules (Invitations, Save the Date, and Contributions)." 
          : "Sanidi Gateway ya Meseji hapa mara moja kwa ajili ya mfumo mzima. Sehemu zote za (Mialiko, Save the Date, na Michango) zitatumia Mipangilio hii."}
      </p>

      <form onSubmit={handleSave} className="space-y-4 pt-2">
        <div className="space-y-1">
          <label className="font-bold text-slate-300 block text-xs">
            {isEn ? "SMS Provider" : "Mtoa Huduma wa SMS (Provider)"}
          </label>
          <select 
            value={gatewaySettings.provider}
            onChange={(e) => {
              const val = e.target.value;
              let defaultUrl = '';
              let defaultSender = gatewaySettings.senderId;
              let defaultApiKey = gatewaySettings.apiKey;
              if (val === 'swalasms') {
                defaultUrl = 'https://swalasms.com/api/v1/sms/quick-message';
                defaultSender = 'EVENT CARD';
                defaultApiKey = defaultApiKey || 'swl_live_vtWJVXNYyVpjhUcu3PNFuOvL1WX6nXzE0yz9qVImRwNCP5a3';
              } else if (val === 'meseji') {
                defaultUrl = 'https://meseji.co.tz/api/v1/sms/send';
                defaultSender = 'MESEJI';
              } else if (val === 'ehub') {
                defaultUrl = 'https://sms.ehub.co.tz/api/v1/sms/send';
                defaultSender = '339330f1-4e6a-4bf7-a9f8-eaae2a9dd397';
              } else if (val === 'beem') {
                defaultUrl = 'https://api.beem.africa/v1/send';
              } else if (val === 'nextsms') {
                defaultUrl = 'https://messaging-service.co.tz/api/sms/v1/text/single';
              } else if (val === 'notifyAfrica') {
                defaultUrl = 'https://api.notify.africa/v1/sms/send';
              } else {
                defaultUrl = gatewaySettings.url;
              }
              setGatewaySettings({ ...gatewaySettings, provider: val, url: defaultUrl, senderId: defaultSender, apiKey: defaultApiKey });
            }}
            className="w-full bg-[#050b18] border border-white/10 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500/50 transition-all font-semibold text-xs cursor-pointer"
          >
            <option value="simulation">Simulated Gateway (Simulation)</option>
            <option value="swalasms">SwalaSMS (Tanzania) - Salio: 100 SMS (Inafanya Kazi)</option>
            <option value="ehub">eHub SMS API (Secure)</option>
            <option value="meseji">Meseji API (Tanzania)</option>
            <option value="beem">Beem Africa (Tanzania)</option>
            <option value="notifyAfrica">Notify Africa</option>
            <option value="nextsms">NextSMS</option>
            <option value="custom">Custom SMS API Endpoint (Custom Hook)</option>
          </select>
        </div>

        {gatewaySettings.provider === 'swalasms' && (
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                SwalaSMS Imeunganishwa (Live)
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                Salio: 100 SMS
              </span>
            </div>
            <p className="text-[11px] text-emerald-200/80 leading-relaxed">
              {isEn 
                ? "Your SwalaSMS Live Application is configured with approved Sender ID 'EVENT CARD'. Click below to auto-fill verified credentials."
                : "Akaunti yako ya SwalaSMS imesanidiwa na Sender ID iliyoidhinishwa ya 'EVENT CARD'. Bonyeza hapa chini kuweka taarifa zilizothibitishwa kiotomatiki."}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setGatewaySettings({
                    ...gatewaySettings,
                    provider: 'swalasms',
                    senderId: 'EVENT CARD',
                    apiKey: 'swl_live_vtWJVXNYyVpjhUcu3PNFuOvL1WX6nXzE0yz9qVImRwNCP5a3',
                    url: 'https://swalasms.com/api/v1/sms/quick-message'
                  });
                }}
                className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                ✓ Weka Mipangilio ya EVENT CARD (SwalaSMS)
              </button>
            </div>
          </div>
        )}

        {gatewaySettings.provider !== 'simulation' && (
          <>
            <div className="space-y-1">
              <label className="font-bold text-slate-300 block text-xs">
                {isEn ? "Sender ID / Brand Name" : "Jina la Kutuma (Sender ID)"}
              </label>
              <input 
                type="text" 
                maxLength={gatewaySettings.provider === 'ehub' ? 40 : 11}
                placeholder={gatewaySettings.provider === 'ehub' ? "UUID ya eHub (e.g. 0042...)" : "Ex. EVENT CARD"}
                value={gatewaySettings.senderId}
                onChange={(e) => {
                  const val = gatewaySettings.provider === 'ehub' ? e.target.value.trim() : e.target.value.toUpperCase().trim();
                  setGatewaySettings({ ...gatewaySettings, senderId: val });
                }}
                className={`w-full bg-[#050b18] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${gatewaySettings.provider === 'ehub' ? '' : 'uppercase font-mono tracking-wider'} transition-all`}
              />
              {gatewaySettings.provider === 'swalasms' && (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGatewaySettings({ ...gatewaySettings, senderId: 'EVENT CARD' })}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all font-semibold cursor-pointer ${gatewaySettings.senderId === 'EVENT CARD' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white/5 hover:bg-white/10 text-emerald-300 border-white/10'}`}
                    >
                      ✓ EVENT CARD (Approved)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGatewaySettings({ ...gatewaySettings, senderId: 'TAARIFA' })}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all font-semibold cursor-pointer ${gatewaySettings.senderId === 'TAARIFA' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white/5 hover:bg-white/10 text-emerald-300 border-white/10'}`}
                    >
                      ✓ TAARIFA (Approved)
                    </button>
                    <button
                      type="button"
                      onClick={() => fetchSwalaIds()}
                      disabled={isFetchingIds}
                      className="text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-3 py-1 rounded-lg border border-emerald-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {isFetchingIds ? <span className="animate-spin">↻</span> : <Search size={11} />}
                      {isEn ? "Fetch SwalaSMS IDs" : "Kagua Sender IDs za SwalaSMS"}
                    </button>
                  </div>
                  {availableIds.length > 0 && (
                    <div className="bg-black/40 border border-white/5 rounded-lg p-2 space-y-1.5 max-h-36 overflow-y-auto">
                      {availableIds.map((item, idx) => (
                        <div 
                          key={item.sender_id || idx}
                          onClick={() => {
                            setGatewaySettings({ ...gatewaySettings, senderId: item.sender_id });
                            setAvailableIds([]);
                          }}
                          className="flex justify-between items-center p-1.5 rounded hover:bg-white/5 cursor-pointer text-xs"
                        >
                          <span className="font-bold text-white">{item.sender_id}</span>
                          <span className="text-[9px] text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {gatewaySettings.provider === 'ehub' && (
                <div className="mt-1 space-y-1">
                  <p className="text-[10px] text-amber-400 font-medium leading-relaxed bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                    {isEn 
                      ? "⚠️ eHub requires a valid Sender ID UUID from your eHub account (not a word like 'EVENT CARD'). Click 'Fetch Sender IDs' below to select your real approved UUID." 
                      : "⚠️ eHub inahitaji 'UUID' ya Sender ID kutoka akaunti yako ya eHub (sio neno kama 'EVENT CARD'). Bonyeza 'Tafuta Sender IDs' hapo chini ili kuchagua UUID yako halisi iliyoidhinishwa."}
                  </p>
                  {(gatewaySettings.senderId === '00420892-38bd-47b0-9a5f-ea55bef5d2d1' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gatewaySettings.senderId)) && (
                    <p className="text-[10px] text-red-400 font-bold bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                      {isEn
                        ? "⚠️ Current Sender ID is invalid or sample placeholder. Please click 'Fetch Sender IDs' below to load your active eHub ID."
                        : "⚠️ Sender ID iliyopo sasa si sahihi au ni mfano tu. Tafadhali bonyeza 'Tafuta Sender IDs' hapo chini kupata ID yako halisi."}
                    </p>
                  )}
                </div>
              )}
              {gatewaySettings.provider === 'meseji' && (!gatewaySettings.senderId || gatewaySettings.senderId === 'EVENT CARD' || gatewaySettings.senderId !== 'MESEJI') && (
                <div className="mt-1 flex items-center justify-between text-[10px] text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                  <span>
                    {isEn 
                      ? "Default approved Sender ID for Meseji is 'MESEJI'." 
                      : "Sender ID ya msingi iliyoidhinishwa Meseji ni 'MESEJI'."}
                  </span>
                  <button
                    type="button"
                    onClick={() => setGatewaySettings({ ...gatewaySettings, senderId: 'MESEJI' })}
                    className="ml-2 text-[9px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-1 rounded border border-amber-500/30 transition-all shrink-0 cursor-pointer"
                  >
                    {isEn ? "Use MESEJI" : "Tumia MESEJI"}
                  </button>
                </div>
              )}
              {gatewaySettings.provider === 'ehub' && (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGatewaySettings({ ...gatewaySettings, senderId: '339330f1-4e6a-4bf7-a9f8-eaae2a9dd397' })}
                      className="text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/30 transition-all font-semibold cursor-pointer"
                    >
                      ✓ EVENT CARD (eHub)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGatewaySettings({ ...gatewaySettings, senderId: '19f41b59-19d0-4f98-b8c9-9d5b1ac31308' })}
                      className="text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/30 transition-all font-semibold cursor-pointer"
                    >
                      ✓ UWALEMI (eHub)
                    </button>
                  </div>
                  <button
                    onClick={fetchEhubIds}
                    disabled={isFetchingIds || !gatewaySettings.apiKey || !gatewaySettings.apiSecret}
                    className="text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFetchingIds ? (
                      <span className="animate-spin text-lg">↻</span>
                    ) : (
                      <Search size={12} />
                    )}
                    {isEn ? "Fetch Sender IDs (Find UUIDs)" : "Tafuta Sender IDs (Pata UUIDs)"}
                  </button>

                  {availableIds.length > 0 ? (
                    <div className="bg-black/40 border border-white/5 rounded-lg p-2 space-y-2 max-h-40 overflow-y-auto">
                      {availableIds.map((item, idx) => (
                          <div 
                            key={item.id || item.sender_id || idx}
                            className="flex flex-col border-b border-white/5 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-white/5 p-1 rounded transition-colors"
                            onClick={() => {
                              setGatewaySettings({ ...gatewaySettings, senderId: item.id });
                              setAvailableIds([]);
                              setHasFetchedIds(false);
                            }}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-white">{item.sender_id}</span>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded ${item.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {item.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-[9px] text-slate-400 break-all bg-white/5 px-1 rounded flex-1">{item.id}</code>
                              <span className="text-[9px] text-emerald-500 font-medium">
                                {isEn ? "Select" : "Chagua"}
                              </span>
                            </div>
                          </div>
                      ))}
                    </div>
                  ) : (
                    isFetchingIds === false && hasFetchedIds && availableIds.length === 0 && (
                      <p className="text-[9px] text-slate-500 italic">
                        {isEn ? "No IDs found. Check your API keys." : "Hakuna ID zilizopatikana. Angalia API Keys zako."}
                      </p>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1 mt-3">
              <label className="font-bold text-slate-300 block text-xs">
                {isEn ? "API Key / Token Secret" : "Ufunguo wa API (API Key / Token)"}
              </label>
              <input 
                type="password" 
                placeholder="Weka ufunguo wako wa API hapa..."
                value={gatewaySettings.apiKey}
                onChange={(e) => setGatewaySettings({ ...gatewaySettings, apiKey: e.target.value.trim() })}
                className="w-full bg-[#050b18] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono transition-all"
              />
              {gatewaySettings.apiKey.startsWith('EAA') && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[10.5px] text-amber-300 leading-normal space-y-1 mt-1">
                  <p className="font-bold">⚠️ {isEn ? "Possible Configuration Mistake!" : "Uwezekano wa Hitilafu ya Usanidi!"}</p>
                  <p>
                    {isEn 
                      ? "This API Key starts with 'EAA...', which looks like a Meta WhatsApp Access Token. This field is for your SMS Gateway API Key (e.g., Meseji.co.tz API Key). Please enter your correct SMS token here, and place your Meta WhatsApp Token in the WhatsApp section below." 
                      : "Ufunguo huu unaanza na 'EAA...', unaofanana na Token ya Meta WhatsApp. Sehemu hii ni kwa ajili ya Ufunguo wa Mtoa Huduma wa SMS za Kawaida (kama Meseji.co.tz). Tafadhali weka ufunguo wako sahihi wa SMS hapa, kisha weka token yako ya Meta WhatsApp chini kwenye sehemu ya WhatsApp."}
                  </p>
                </div>
              )}
            </div>

            {(gatewaySettings.provider === 'beem' || gatewaySettings.provider === 'nextsms' || gatewaySettings.provider === 'ehub') && (
              <div className="space-y-1 mt-3">
                <label className="font-bold text-slate-300 block text-xs">
                  {isEn ? "API Secret Key" : "Ufunguo wa Siri wa API (API Secret)"}
                </label>
                <input 
                  type="password" 
                  placeholder="Weka ufunguo wa siri wa API..."
                  value={gatewaySettings.apiSecret || ''}
                  onChange={(e) => setGatewaySettings({ ...gatewaySettings, apiSecret: e.target.value.trim() })}
                  className="w-full bg-[#050b18] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono transition-all"
                />
              </div>
            )}

            {(gatewaySettings.provider !== 'meseji') && (
              <div className="space-y-1 mt-3">
                <label className="font-bold text-slate-300 block text-xs">API Endpoint URL</label>
                <input 
                  type="url" 
                  placeholder="https://api.example.com/sms/send"
                  value={gatewaySettings.url}
                  onChange={(e) => setGatewaySettings({ ...gatewaySettings, url: e.target.value })}
                  className="w-full bg-[#050b18] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-[10px]"
                />
              </div>
            )}

            {gatewaySettings.provider === 'custom' && (
              <div className="space-y-4 bg-black/20 p-4 border border-white/5 rounded-xl mt-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 block text-xs">Custom Headers (JSON)</label>
                  <textarea 
                    rows={2}
                    value={gatewaySettings.customHeaders}
                    onChange={(e) => setGatewaySettings({ ...gatewaySettings, customHeaders: e.target.value })}
                    className="w-full bg-[#050b18] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-[10px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 block text-xs">Custom Body Payload (JSON)</label>
                  <p className="text-[9px] text-slate-500 pb-1">
                    Use <code className="text-emerald-400">{"{to}"}</code> for phone and <code className="text-emerald-400">{"{message}"}</code> for text content.
                  </p>
                  <textarea 
                    rows={4}
                    value={gatewaySettings.customBody}
                    onChange={(e) => setGatewaySettings({ ...gatewaySettings, customBody: e.target.value })}
                    className="w-full bg-[#050b18] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-[10px]"
                  />
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Custom WhatsApp Gateway Management Area */}
            <div className="space-y-3 border-t border-white/10 pt-4 mt-4">
              <label className="font-bold text-slate-300 block text-xs">
                {isEn ? "WhatsApp Integration Channel" : "Njia ya Ujumbe ya WhatsApp"}
              </label>
              
              <div className="grid grid-cols-3 gap-2 pb-1">
                <button
                  type="button"
                  onClick={() => setWhatsappProvider('simulation')}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition ${
                    whatsappProvider === 'simulation'
                      ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                      : 'bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  Simulation
                </button>
                <button
                  type="button"
                  onClick={() => setWhatsappProvider('meta')}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition ${
                    whatsappProvider === 'meta'
                      ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
                      : 'bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  Official Meta (WABA)
                </button>
                <button
                  type="button"
                  onClick={() => setWhatsappProvider('custom_webhook')}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition ${
                    whatsappProvider === 'custom_webhook'
                      ? 'bg-purple-500/20 border border-purple-500/50 text-purple-400'
                      : 'bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  Webhook API
                </button>
              </div>

              {whatsappProvider === 'simulation' && (
                <p className="text-[10px] text-slate-500 italic bg-white/5 rounded-lg p-2 leading-relaxed">
                  {isEn 
                    ? "Simulation Mode: Sent messages are simulated instantly. You can test without spending and trace messages inside logs."
                    : "Mfumo wa Kujaribu: Ujumbe utatengenezwa na kuonyeshwa kama umetumwa hapa hapa bila gharama yoyote ya salio."}
                </p>
              )}

              {whatsappProvider === 'meta' && (
                <div className="space-y-4 bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 pt-2">
                  <div className="flex items-center justify-between border-b border-white/5 pb-1">
                    <span className="text-[10px] font-bold text-blue-400">SUPPORTED WITH META CLOUD API</span>
                    <a 
                      href="https://developers.facebook.com/" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[9px] text-blue-400 underline flex items-center gap-0.5"
                    >
                      Meta Console
                    </a>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 block">
                      {isEn ? "Meta Permanent Access Token" : "Meta Access Token ya Kudumu"}
                    </label>
                    <input 
                      type="password" 
                      placeholder="EAAGxxxxxxxxxxxx..."
                      value={whatsappMetaToken}
                      onChange={(e) => setWhatsappMetaToken(e.target.value)}
                      className="w-full bg-[#050b18] border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 block">
                      {isEn ? "Meta Phone Number ID" : "ID ya Namba ya Simu Meta (Phone Number ID)"}
                    </label>
                    <input 
                      type="text" 
                      placeholder="E.g. 106338573934827"
                      value={whatsappMetaPhoneId}
                      onChange={(e) => setWhatsappMetaPhoneId(e.target.value)}
                      className="w-full bg-[#050b18] border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 block">
                      {isEn ? "WhatsApp Business Account ID (WABA ID)" : "ID ya Akaunti ya WhatsApp Business (WABA ID)"}
                    </label>
                    <input 
                      type="text" 
                      placeholder="E.g. 1045062067950525"
                      value={whatsappMetaWabaId}
                      onChange={(e) => setWhatsappMetaWabaId(e.target.value)}
                      className="w-full bg-[#050b18] border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 block">
                        {isEn ? "WABA Template Name" : "Jina la Template Meta"}
                      </label>
                      <input 
                        type="text" 
                        placeholder="E.g. kadi_mwaliko"
                        value={whatsappMetaTemplateName}
                        onChange={(e) => setWhatsappMetaTemplateName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                        className="w-full bg-[#050b18] border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 block">
                        {isEn ? "Language Code" : "Lugha ya Template"}
                      </label>
                      <input 
                        type="text" 
                        placeholder="E.g. sw au en"
                        value={whatsappMetaLang}
                        onChange={(e) => setWhatsappMetaLang(e.target.value.toLowerCase().trim())}
                        className="w-full bg-[#050b18] border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                   <div className="text-[9px] text-slate-400 leading-normal p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg mt-1 space-y-1">
                    <p className="font-bold text-amber-300">⚠️ {isEn ? "Important for Live Phone Numbers:" : "Muhimu kwa Namba Halisi (Live Phone Numbers):"}</p>
                    <p>
                      {isEn 
                        ? "If you are using a Live Meta WhatsApp Number, Meta restricts the default 'hello_world' test template. Please create an approved custom template in Meta WhatsApp Manager (e.g. kadi_mwaliko or mwaliko_wa_sherehe) and set its name in the field above."
                        : "Kama unatumia Namba Halisi (Live Number) ya Meta WhatsApp, Meta hairuhusu kutumia template ya majaribio ya 'hello_world'. Tafadhali unda na kusajili Template mpya kule Meta WhatsApp Manager (Mfano: kadi_mwaliko au mwaliko_wa_sherehe) kisha weka jina la template hiyo hapo juu."}
                    </p>
                  </div>

                  <div className="border-t border-white/10 pt-3 mt-3 space-y-2">
                    <span className="text-[10px] font-bold text-emerald-400 block uppercase">
                      🚀 {isEn ? "TEST META CONNECTION" : "JARIBU MUUNGANISHO WA META"}
                    </span>
                    <p className="text-[9px] text-slate-500 leading-relaxed">
                      {isEn 
                        ? "Save your settings first! Then enter your recipient phone number (with country code, e.g., 255712345678) to send a test template message." 
                        : "Hifadhi kwanza mipangilio hapo chini! Kisha weka namba ya simu ya mpokeaji (ikiwa na msimbo wa nchi, mfano 255712345678) ili kutuma ujumbe wa jaribio."}
                    </p>
                    <div className="flex gap-2">
                      <input 
                        type="tel"
                        placeholder="E.g. 255712345678"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value.trim())}
                        className="flex-1 bg-[#050b18] border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleTestMeta}
                        disabled={isTesting}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all whitespace-nowrap"
                      >
                        {isTesting ? (isEn ? "Sending..." : "Inatuma...") : (isEn ? "Send Test" : "Tuma Jaribio")}
                      </button>
                    </div>
                  </div>

                    <div className="space-y-1 mt-2 p-2 bg-black/20 rounded border border-white/5">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">💡 {isEn ? "TEMPLATE TIPS" : "USHAURI WA TEMPLATE"}</span>
                      <p className="text-[8px] text-slate-400 leading-tight">
                        {isEn 
                          ? "Use simple lowercase names like 'mwaliko_wa_sherehe' or 'asante_kushiriki'. Meta names are sensitive to spaces and uppercase."
                          : "Tumia majina madogo na rahisi kama 'mwaliko_wa_sherehe' au 'asante_kushiriki'. Meta inajali herufi kubwa/ndogo na nafasi (spaces)."}
                      </p>
                    </div>

                  <div className="border-t border-white/10 pt-3 mt-3 space-y-2 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                    <span className="text-[10px] font-bold text-emerald-400 block uppercase">
                      🔗 {isEn ? "CONFIGURE META WEBHOOK" : "USANIDI WA WEBHOOK YA META"}
                    </span>
                    <p className="text-[9px] text-slate-300 leading-relaxed">
                      {isEn 
                        ? "Paste these values into Step 2 (Production setup -> Configure Webhooks) on your Meta Developer Portal to receive real-time delivery reports ('Delivered', 'Read') and automatically process RSVPs when guests reply on WhatsApp!" 
                        : "Nakili maelezo haya hapa chini na uyabandike kwenye Meta Developer Portal (Step 2. Production setup -> Configure Webhooks) ili kupokea taarifa za uwasilishaji kwa wakati halisi ('Imefika', 'Imesomwa') na kupokea majibu ya RSVP moja kwa moja mgeni akijibu kupitia WhatsApp!"}
                    </p>
                    <div className="space-y-1.5 font-mono text-[9px] bg-black/40 p-2 rounded-lg text-slate-300 border border-white/5 select-all">
                      <div>
                        <span className="text-emerald-400 font-bold block uppercase text-[8px]">{isEn ? "Callback URL:" : "Callback URL:"}</span>
                        <span className="break-all">{window.location.origin}/api/webhook/whatsapp</span>
                      </div>
                      <div className="pt-1.5 border-t border-white/5">
                        <span className="text-emerald-400 font-bold block uppercase text-[8px]">{isEn ? "Verify Token:" : "Verify Token:"}</span>
                        <span>EventCardWhatsAppWebhookVerifyToken2026</span>
                      </div>
                    </div>
                    <p className="text-[8px] text-amber-400">
                      ⚠️ {isEn 
                        ? "After verification, under 'Webhook fields', make sure to subscribe to 'messages' to receive automated guest responses." 
                        : "Baada ya thibitisho (verification), hakikisha unajiandikisha (subscribe) kwenye sehemu ya 'messages' ili kupokea majibu ya wageni wako."}
                    </p>
                  </div>

                  <div className="border-t border-white/10 pt-3 mt-3 space-y-2 bg-blue-500/10 -mx-3 -mb-3 p-3 rounded-b-xl">
                    <span className="text-[10px] font-bold text-amber-400 block uppercase">
                      ⚡ {isEn ? "COMPLETE META API TESTING (0 OF 1 FIX)" : "KUKAMILISHA MAJARIBIO YA META (0 OF 1 FIX)"}
                    </span>
                    <p className="text-[9px] text-slate-300 leading-relaxed">
                      {isEn 
                        ? "Are you stuck with '0 of 1 API call(s) required' for business_management or whatsapp_business_management? Click below to execute the precise programmatic calls Meta requires to mark them as Completed instantly!" 
                        : "Je, umekwama kwenye '0 of 1 API call(s) required' kwa ajili ya business_management au whatsapp_business_management kule Meta? Bonyeza hapa chini kufanya maombi hayo hapa hapa bila kuhitaji Graph API Explorer!"}
                    </p>
                    
                    <button
                      type="button"
                      onClick={handleTriggerMetaReviewCalls}
                      disabled={isTriggeringMeta}
                      className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all"
                    >
                      {isTriggeringMeta ? (isEn ? "Triggering..." : "Inatuma...") : (isEn ? "Trigger Meta API Review Calls" : "Anza Majaribio Sasa")}
                    </button>

                    {metaTriggerLogs.length > 0 && (
                      <div className="bg-black/60 rounded-lg p-2 font-mono text-[8px] text-emerald-400 max-h-32 overflow-y-auto space-y-1 mt-1 border border-emerald-500/20">
                        {metaTriggerLogs.map((log, idx) => (
                          <div key={idx} className="leading-tight">{log}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {whatsappProvider === 'custom_webhook' && (
                <div className="space-y-2 bg-purple-500/5 border border-purple-500/10 rounded-xl p-3">
                  <label className="font-semibold text-slate-400 block text-[10px]">
                    {isEn ? "Custom WhatsApp URL Endpoint" : "Anwani ya Webhook ya WhatsApp (Custom Webhook)"}
                  </label>
                  <p className="text-[9px] text-slate-500 leading-relaxed pb-1">
                    {isEn 
                      ? "Supports third-party APIs (Evolution, UltraMsg, Baileys, etc.). Use {to} and {message} tokens."
                      : "Inasaidia API mbalimbali za WhatsApp. Tumia alama ya {to} kwa namba ya simu, na {message} kwa ujumbe."}
                  </p>
                  <input 
                    type="url" 
                    placeholder="https://api.yourgateway.com/send?phone={to}&text={message}"
                    value={whatsappUrlInput}
                    onChange={(e) => setWhatsappUrlInput(e.target.value)}
                    className="w-full bg-[#050b18] border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              )}
            </div>

        {/* AUTOMATED INSTANT RSVP & CHANGE-OF-MIND WHATSAPP NOTIFICATIONS */}
        <div className="mt-8 border-t border-emerald-500/30 pt-6 space-y-4">
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{isEn ? "Automated WhatsApp RSVP Notifications & Change Alerts" : "Taarifa za Papo Hapo za WhatsApp (RSVP & Mabadiliko ya Mawazo)"}</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {autoRsvpAlertsEnabled ? (isEn ? "ACTIVE" : "IKO HEWANI") : (isEn ? "PAUSED" : "IMESIMAMA")}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-350 mt-0.5">
                    {isEn 
                      ? "Get real-time WhatsApp alerts when guests RSVP or change their minds on the web portal or via chat." 
                      : "Pata ujumbe wa moja kwa moja kwenye WhatsApp kila mgeni anapojibu mwaliko mtandaoni, akibadilisha mawazo, au akijibu kwa sauti/maandishi."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestAdminAlert}
                disabled={isTestingAdminAlert}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-[11px] transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-lg shadow-emerald-900/30"
              >
                {isTestingAdminAlert ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{isTestingAdminAlert ? (isEn ? "Sending..." : "Inatuma...") : (isEn ? "Test WhatsApp Alert" : "Jaribu Arifa kwa WhatsApp")}</span>
              </button>
            </div>

            {/* Config Form Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  {isEn ? "Dedicated WhatsApp Alert Receiver Phone" : "Namba Maalum ya Kupokea Arifa za WhatsApp (Msimamizi / Wewe Mwenyewe)"}
                </label>
                <input
                  type="tel"
                  placeholder="Mfano: 0755123456 au namba yako yoyote ya WhatsApp"
                  value={adminWhatsAppPhone}
                  onChange={(e) => setAdminWhatsAppPhone(e.target.value)}
                  className="w-full bg-[#050b18] border border-white/15 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-slate-600"
                />
                <p className="text-[10px] text-slate-400">
                  {isEn 
                    ? "This number is completely independent from RSVP 1, 2, 3 in Event Details. Enter any phone number (including your personal WhatsApp) to receive instant alerts." 
                    : "Namba hii imetengwa kabisa na haihusiani na namba za RSVP 1, 2, wala 3 za kwenye kadi. Unaweza kuweka namba yoyote ile (hata ya kwako binafsi) kupokea arifa za papo hapo."}
                </p>
              </div>

              {/* Toggles */}
              <div className="space-y-2.5 flex flex-col justify-center">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRsvpAlertsEnabled}
                    onChange={(e) => setAutoRsvpAlertsEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-[#050b18] border-white/20"
                  />
                  <span className="text-[11px] font-semibold text-slate-200">
                    {isEn ? "Notify organizer when guest submits or changes RSVP" : "Arifu msimamizi kila mgeni anapojibu au akibadilisha mawazo ya RSVP"}
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={guestRsvpConfirmEnabled}
                    onChange={(e) => setGuestRsvpConfirmEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-[#050b18] border-white/20"
                  />
                  <span className="text-[11px] font-semibold text-slate-200">
                    {isEn ? "Send instant confirmation WhatsApp message to guest" : "Tuma ujumbe wa uthibitisho kwenye WhatsApp ya mgeni baada ya kujibu"}
                  </span>
                </label>
              </div>
            </div>

            {/* Test result status feedback */}
            {adminAlertTestResult && (
              <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                adminAlertTestResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {adminAlertTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <p className="font-bold">
                    {adminAlertTestResult.success 
                      ? (isEn ? "WhatsApp Alert Test Successful!" : "Jaribio la Arifa limefanikiwa!") 
                      : (isEn ? "WhatsApp Alert Test Notice" : "Taarifa ya Jaribio")}
                  </p>
                  <p className="text-[11px] opacity-90">{adminAlertTestResult.message || adminAlertTestResult.error}</p>
                  {adminAlertTestResult.channel && (
                    <p className="text-[10px] font-mono text-slate-400 mt-1">
                      Channel: <span className="text-white font-bold">{adminAlertTestResult.channel}</span> | Namba: <span className="text-white font-bold">{adminAlertTestResult.sentTo}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* WHATSAPP CHATBOT LIVE TEST & WEBHOOK LOGS */}
        <div className="mt-8 border-t border-white/10 pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">🤖</span>
                {isEn ? "WhatsApp AI Chatbot & Webhook Diagnostics" : "Uchunguzi & Kumbukumbu za WhatsApp AI Chatbot"}
              </h3>
              <p className="text-[10px] text-slate-400">
                {isEn 
                  ? "Verify real-time incoming messages, AI responses, and Meta API delivery status." 
                  : "Angalia jumbe zinazoingia kutoka kwa wageni, majibu ya AI, na hali ya uwasilishaji kule Meta."}
              </p>
            </div>
            <button
              type="button"
              onClick={fetchLogs}
              className="bg-white/5 hover:bg-white/10 text-xs text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/30 flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              {isEn ? "Refresh Logs" : "Anzisha Kumbukumbu"}
            </button>
          </div>

          {/* Webhook URL & Meta Configuration Guide Box */}
          <div className="bg-[#0b1329] border border-emerald-500/30 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="text-[10px]">
                <span className="text-emerald-400 font-bold block text-[11px] mb-0.5">🔗 {isEn ? "WhatsApp Webhook Callback URL:" : "1. Anwani ya Webhook (Callback URL Meta Dashboard):"}</span>
                <code className="text-emerald-300 font-mono text-[11px] select-all break-all">{typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/whatsapp</code>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard.writeText(`${window.location.origin}/api/webhook/whatsapp`);
                    alert(isEn ? "Webhook URL copied!" : "Webhook URL imekopwa!");
                  }
                }}
                className="bg-emerald-600/30 border border-emerald-500/40 hover:bg-emerald-600/50 text-emerald-200 text-[10px] font-bold px-3 py-1.5 rounded-lg transition shrink-0 cursor-pointer"
              >
                {isEn ? "Copy URL" : "Kopi Anwani"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px]">
              <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 space-y-1">
                <span className="text-slate-300 font-bold block">🔑 {isEn ? "2. Verify Token:" : "2. Neno la Uhakiki (Verify Token):"}</span>
                <div className="flex items-center justify-between bg-black/40 px-2 py-1 rounded text-emerald-300 font-mono text-[11px]">
                  <span>eventcard</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('eventcard');
                      alert(isEn ? "Verify Token copied!" : "Verify Token imekopwa!");
                    }}
                    className="text-[9px] text-slate-400 hover:text-white cursor-pointer ml-2"
                  >
                    Kopi
                  </button>
                </div>
                <p className="text-[9px] text-slate-400">
                  {isEn ? "Use this token when Meta asks for Verify Token." : "Weka neno hili wakati Meta inapoomba Verify Token kule Developer Portal."}
                </p>
              </div>

              <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 space-y-1">
                <span className="text-slate-300 font-bold block">⚡ {isEn ? "3. Required Webhook Field:" : "3. Subiri/Bonyeza Subscribe kwenye Meta:"}</span>
                <div className="bg-black/40 px-2 py-1 rounded text-amber-300 font-mono text-[11px]">
                  messages
                </div>
                <p className="text-[9px] text-slate-400">
                  {isEn 
                    ? "In Meta Dashboard -> WhatsApp -> Configuration, click Subscribe on 'messages'." 
                    : "Kwenye Meta Dashboard -> WhatsApp -> Configuration, hakikisha umebonyeza 'Subscribe' kwenye kisanduku cha 'messages'."}
                </p>
              </div>
            </div>
          </div>

          {/* Direct Chatbot Test Box */}
          <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              🧪 {isEn ? "Direct Chatbot Auto-Reply Tester" : "Jaribu Chatbot Hapa Hapa (Direct Auto-Reply Test)"}
            </h4>
            <p className="text-[10px] text-slate-300">
              {isEn 
                ? "Simulate a guest asking a question (e.g., 'Ukumbi uko wapi?') to test AI response generation and Meta message delivery."
                : "Weka namba ya simu na ujumbe wa mgeni (mf. 'Ukumbi uko wapi?') ili kuona jinsi AI inavyojibu na ikiwa ujumbe unamfikia mgeni."}
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Namba ya Simu (mf: 255622443249)"
                value={botTestPhone}
                onChange={(e) => setBotTestPhone(e.target.value)}
                className="bg-[#050b18] border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <input
                type="text"
                placeholder="Ujumbe (mf: Ukumbi uko wapi?)"
                value={botTestMessage}
                onChange={(e) => setBotTestMessage(e.target.value)}
                className="sm:col-span-2 bg-[#050b18] border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={handleTestChatbot}
              disabled={isTestingBot || !botTestPhone || !botTestMessage}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-[10px] uppercase px-4 py-2 rounded-lg transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isTestingBot ? (isEn ? "Generating Reply & Sending..." : "Inatengeneza Majibu & Kutuma...") : (isEn ? "Send Test Message" : "Tuma Ujumbe Wa Majaribio")}
            </button>

            {botTestResult && (
              <div className={`p-3 rounded-xl border text-[11px] space-y-1.5 ${botTestResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 border-rose-500/30 text-rose-200'}`}>
                <div className="font-bold flex items-center justify-between">
                  <span>{botTestResult.success ? '✅ Ujumbe Umetumwa Kwenye WhatsApp!' : '❌ Shida Imetokea Katika Kutuma'}</span>
                  <span className="text-[9px] opacity-75 font-mono">Meta Token: {botTestResult.metaTokenFound ? 'OK' : 'MISSING'}, Phone ID: {botTestResult.phoneIdFound ? 'OK' : 'MISSING'}</span>
                </div>
                <div className="bg-black/40 p-2 rounded-lg font-sans text-[10px] whitespace-pre-wrap border border-white/10">
                  <strong>Jibu la AI Bot:</strong> {botTestResult.botReply}
                </div>
                {botTestResult.error && (
                  <div className="text-[10px] text-rose-300 font-mono bg-rose-950/60 p-2 rounded">
                    <strong>Meta Error:</strong> {botTestResult.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Live Webhook Logs Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300">
                📜 {isEn ? "Recent WhatsApp Webhook Interactions" : "Kumbukumbu za Ujumbe za Hivi Karibuni"}
              </span>
              {whatsappLogs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="text-[9px] text-rose-400 hover:underline cursor-pointer"
                >
                  {isEn ? "Clear Logs" : "Futa Kumbukumbu"}
                </button>
              )}
            </div>

            {whatsappLogs.length === 0 ? (
              <div className="bg-[#080e1d] border border-white/5 rounded-xl p-4 text-center text-slate-500 text-[11px]">
                {isEn ? "No WhatsApp Webhook events recorded yet. Send a WhatsApp message to your business number to see live interactions here." : "Bado hakuna kumbukumbu za jumbe zilizoingia. Tuma ujumbe kwenye namba yako ya WhatsApp kuona majibu hapa kwa muda halisi."}
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {whatsappLogs.map((log: any, idx: number) => (
                  <div key={log.id || log.timestamp || `log-${idx}`} className="bg-[#070d19] border border-white/10 rounded-xl p-3 space-y-1.5 text-[10px]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{log.guestName}</span>
                        <span className="text-slate-400 font-mono">({log.fromPhone})</span>
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()} - {new Date(log.timestamp).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="bg-blue-500/5 border border-blue-500/10 p-2 rounded-lg text-slate-300">
                      <span className="text-blue-400 font-bold block text-[9px] uppercase">Ujumbe wa Mgeni:</span>
                      "{log.incomingMessage}"
                    </div>

                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-lg text-slate-200">
                      <span className="text-emerald-400 font-bold block text-[9px] uppercase">Jibu la AI Bot:</span>
                      {log.botReply}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {log.status === 'sent' && (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[9px] font-bold">
                          ✅ Imetumwa Vizuri Meta Graph API
                        </span>
                      )}
                      {log.status === 'fallback_sent' && (
                        <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded text-[9px] font-bold">
                          📩 Imetumwa kwa Njia Mbadala (SMS Gateway)
                        </span>
                      )}
                      {log.status === 'no_token' && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[9px] font-bold">
                          ⚠️ Token ya Meta / Phone ID Haipatikani
                        </span>
                      )}
                      {log.status === 'failed' && (
                        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded text-[9px] font-bold">
                          ❌ Imeshindikana ({log.error || 'Meta Error'})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-3">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl font-bold uppercase tracking-wider text-[11px] transition duration-200 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? "Inahifadhi..." : (isEn ? "Save Settings" : "Hifadhi Mipangilio")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(isEn ? 'Are you sure you want to reset all configurations?' : 'Una uhakika unataka kufuta mipangilio yote?')) {
                setGatewaySettings({
                  provider: 'simulation',
                  url: '',
                  apiKey: '',
                  apiSecret: '',
                  senderId: '',
                  senderIdStatus: 'approved',
                  whatsappUrl: '',
                  customHeaders: '{}',
                  customBody: '{\n  "to": "{to}",\n  "message": "{message}"\n}'
                });
                fetch('/api/sms-settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ provider: 'simulation' })
                });
              }
            }}
            className="bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 text-rose-400 px-4 py-2 rounded-xl font-bold uppercase tracking-wider text-[11px] transition flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {isEn ? "Reset" : "Futa"}
          </button>
        </div>
      </form>
    </div>
  );
}
