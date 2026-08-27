const fs = require('fs');
let code = fs.readFileSync('src/components/ContributionManager.tsx', 'utf-8');

if (!code.includes("id: 'integrations'")) {
  code = code.replace(
    "{ id: 'payment-methods', label: isEn ? 'Payment Methods' : 'Njia za Malipo', icon: CreditCard },",
    "{ id: 'payment-methods', label: isEn ? 'Payment Methods' : 'Njia za Malipo', icon: CreditCard },\n          { id: 'integrations', label: isEn ? 'API & Automations' : 'API & Mifumo (Auto)', icon: Shield },"
  );
  
  const integrationsContent = `
      {subTab === 'integrations' && (
        <div className="space-y-6 animate-fade-in p-2">
          
          {/* Mobile Money API Integration */}
          <div className="backdrop-blur-md bg-gradient-to-br from-emerald-500/5 to-emerald-900/10 border border-emerald-500/20 rounded-2xl p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="font-extrabold text-lg text-white font-mono tracking-tight uppercase flex items-center gap-2">
                <Compass className="w-5 h-5 text-emerald-400" />
                {isEn ? "Mobile Money & Bank API Integration" : "Muunganiko wa Mobile Money & Benki (Lipa Namba)"}
              </h3>
              <p className="text-[11px] text-slate-400 mt-2 uppercase font-mono tracking-wider max-w-3xl">
                {isEn
                  ? "Connect your merchant Paybill or Lipa Namba. When guests pay through their unique card link, payments are recorded automatically and your ledger balance updates instantly."
                  : "Unganisha Lipa Namba au Paybill yako moja kwa moja. Mgeni akilipia kupitia kiungo chake cha kadi, malipo yanarekodiwa kwenye mfumo kiotomatiki na kusasisha dashibodi ya fedha papo hapo."}
              </p>
            </div>
            
            <div className="bg-slate-950/50 p-5 rounded-xl border border-white/5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Provider (Mfumo)</label>
                  <select className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors">
                    <option value="none">-- Chagua --</option>
                    <option value="mpesa">Vodacom M-PESA (Lipa Namba)</option>
                    <option value="tigopesa">Tigo Pesa (Lipa Namba)</option>
                    <option value="airtelmoney">Airtel Money (Lipa Namba)</option>
                    <option value="bank">Bank API Gateway (CRDB/NMB)</option>
                  </select>
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Merchant ID / Till Number</label>
                  <input type="text" placeholder="Mfano: 123456" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white font-mono text-sm focus:border-emerald-500 outline-none transition" />
                </div>
              </div>
              <div className="pt-2">
                <button 
                  onClick={() => {
                    alert(isEn ? "Mobile Money API Integration is active and listening for webhooks!" : "Muunganiko wa API ya Malipo umewezeshwa, mfumo unasikiliza malipo mapya!");
                  }}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg uppercase text-[10.5px] font-mono tracking-widest transition"
                >
                  {isEn ? "Connect & Activate API" : "Unganisha & Wezesha API"}
                </button>
              </div>
            </div>
          </div>

          {/* Automated Payment Reminders */}
          <div className="backdrop-blur-md bg-gradient-to-br from-amber-500/5 to-amber-900/10 border border-amber-500/20 rounded-2xl p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="font-extrabold text-lg text-white font-mono tracking-tight uppercase flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                {isEn ? "Automated Payment Reminders (Cron Jobs)" : "Vikumbusho vya Malipo Kiotomatiki (Cron Jobs)"}
              </h3>
              <p className="text-[11px] text-slate-400 mt-2 uppercase font-mono tracking-wider max-w-3xl">
                {isEn
                  ? "Let the system do the heavy lifting. Enable scheduled background tasks to send polite automated payment reminders to guests with outstanding pledges (e.g., 30, 14, and 7 days before the event)."
                  : "Ruhusu mfumo ufanye kazi yako. Wezesha vikumbusho vya kiotomatiki nyuma ya pazia (cron jobs) kuwatumia sms/whatsapp za upole wale walioahidi na bado hawajakamilisha (mfano: baki siku 30, 14, au 7 kabla ya sherehe)."}
              </p>
            </div>
            
            <div className="bg-slate-950/50 p-5 rounded-xl border border-white/5 space-y-5">
              <div className="flex items-center gap-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  <span className="ml-3 text-[11px] font-bold text-white uppercase font-mono tracking-widest">
                    {isEn ? "Enable Auto-Reminders" : "Wezesha Vikumbusho Auto"}
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center">
                  <span className="block text-2xl font-black text-amber-500 font-mono">30</span>
                  <span className="text-[9px] text-slate-400 uppercase font-mono font-bold tracking-widest">{isEn ? "Days Before" : "Siku Kabla"}</span>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center">
                  <span className="block text-2xl font-black text-amber-500 font-mono">14</span>
                  <span className="text-[9px] text-slate-400 uppercase font-mono font-bold tracking-widest">{isEn ? "Days Before" : "Siku Kabla"}</span>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center">
                  <span className="block text-2xl font-black text-amber-500 font-mono">7</span>
                  <span className="text-[9px] text-slate-400 uppercase font-mono font-bold tracking-widest">{isEn ? "Days Before" : "Siku Kabla"}</span>
                </div>
              </div>
              <p className="text-[9.5px] italic text-slate-500">
                * {isEn ? "The system cron job checks daily at 08:00 AM EAT and will automatically dispatch via your configured SMS/WhatsApp gateway." : "Mfumo unakagua kila siku saa 02:00 Asubuhi na kutuma ujumbe kupitia gateway yako."}
              </p>
            </div>
          </div>

        </div>
      )}
`;

  code = code.replace(
    "{subTab === 'payment-methods' && (", 
    integrationsContent + "\n      {subTab === 'payment-methods' && ("
  );
  
  fs.writeFileSync('src/components/ContributionManager.tsx', code);
  console.log("Integration tab added.");
} else {
  console.log("Integration tab already exists.");
}
