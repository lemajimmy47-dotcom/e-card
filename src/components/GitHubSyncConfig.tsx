import React, { useState, useEffect } from 'react';
import { GitBranch, Github, RefreshCw, CheckCircle, AlertCircle, Play, Clipboard, Key, Settings, HelpCircle, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface SyncLog {
  id: string;
  timestamp: string;
  commitHash: string;
  commitMessage: string;
  author: string;
  status: 'success' | 'failed' | 'pending';
  details?: string;
}

export default function GitHubSyncConfig() {
  const { language, t } = useLanguage();
  const isEn = language === 'en';
  
  // Settings State
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [accessToken, setAccessToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'guide' | 'logs'>('config');
  const [saveStatus, setSaveStatus] = useState<{ status: 'success' | 'error', message: string } | null>(null);

  // Live Sync Logs with some initial interactive mock/real state
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  // Automatic webhook URL generation based on active browser URL
  const webhookUrl = `${window.location.protocol}//${window.location.host}/api/github/webhook`;

  // Fetch current configs on mount
  useEffect(() => {
    setIsLoading(true);
    fetch('/api/github/settings')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch configurations');
        return res.json();
      })
      .then((data) => {
        if (data) {
          setRepoUrl(data.repoUrl || '');
          setBranch(data.branch || 'main');
          setAccessToken(data.accessToken ? '••••••••••••••••••••' : '');
          setWebhookSecret(data.webhookSecret || '');
          setAutoSync(data.autoSync !== false);
          setSyncLogs(data.logs || []);
        }
      })
      .catch((err) => console.warn('Could not load github settings backend, using local fallback:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);

    fetch('/api/github/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoUrl,
        branch,
        accessToken: accessToken === '••••••••••••••••••••' ? undefined : accessToken, // don't overwrite if unchanged representation
        webhookSecret,
        autoSync
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Marekebisho yamegoma');
        setSaveStatus({
          status: 'success',
          message: isEn 
            ? 'GitHub syncing settings updated successfully!' 
            : 'Mipangilio ya kuoanisha na GitHub imehifadhiwa kikamilifu!'
        });
        if (data.logs) setSyncLogs(data.logs);
      })
      .catch((err) => {
        setSaveStatus({
          status: 'error',
          message: (isEn ? 'Failed to save settings: ' : 'Imeshindwa kuhifadhi: ') + err.message
        });
      })
      .finally(() => setIsSaving(false));
  };

  const triggerManualSync = () => {
    if (!repoUrl) {
      alert(isEn ? "Please configure a GitHub Repository URL first." : "Tafadhali ingiza URL ya GitHub kwanza kabla ya kuanzisha sync.");
      return;
    }

    setIsSyncing(true);
    fetch('/api/github/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Sync failed');
        alert(isEn ? 'GitHub synchronization triggered successfully!' : 'Zoezi la kuvuta updates kutoka GitHub limeanza rasmi!');
        if (data.logs) setSyncLogs(data.logs);
      })
      .catch((err) => {
        alert((isEn ? 'Error syncing: ' : 'Hitilafu ya kuunganisha: ') + err.message);
      })
      .finally(() => setIsSyncing(false));
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 max-w-xl w-full">
      <div className="flex items-center justify-between border-b border-white/10 pb-3 h-12">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Github className="w-5 h-5 text-indigo-400" />
          {isEn ? "GitHub Repository Sync" : "Muoanisho wa GitHub (Code Sync)"}
        </h3>
        
        {/* Sync Mini Status */}
        <div className="flex gap-1.5 p-0.5 bg-black/30 rounded-lg">
          <button
            onClick={() => setActiveSubTab('config')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              activeSubTab === 'config' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isEn ? "Config" : "Mipangilio"}
          </button>
          <button
            onClick={() => setActiveSubTab('guide')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              activeSubTab === 'guide' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isEn ? "Guide" : "Mwongozo"}
          </button>
          <button
            onClick={() => setActiveSubTab('logs')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              activeSubTab === 'logs' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isEn ? "Logs" : "Kumbukumbu"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center items-center">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* CONFIG TAB PANEL */}
          {activeSubTab === 'config' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              {saveStatus && (
                <div className={`p-3 rounded-lg flex items-center gap-2 text-xs font-medium border ${
                  saveStatus.status === 'success' 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {saveStatus.status === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{saveStatus.message}</span>
                </div>
              )}

              {/* Repo URL */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 block">
                  {isEn ? "GitHub Repository URL" : "URL ya Repositori ya GitHub"}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs">
                    github.com/
                  </span>
                  <input
                    type="text"
                    required
                    value={repoUrl.replace(/^(http(s)?:\/\/)?(www\.)?github\.com\//, '')}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="lemajimi/kadi-harusi"
                    className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-[84px] pr-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  {isEn 
                    ? "Specify the user/organization and name, e.g. lemajimi/kadi-harusi" 
                    : "Ingiza jina la mmiliki na repositori mfano: lemajimi/kadi-harusi"}
                </p>
              </div>

              {/* Branch and Token */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 block">
                    {isEn ? "Target Branch" : "Tawi Linalolengwa (Branch)"}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="main"
                      className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-3 pr-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <GitBranch className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 block flex items-center justify-between">
                    <span>{isEn ? "Personal Access Token" : "AccessToken"}</span>
                    <span className="text-[9px] text-slate-500 font-normal">({isEn ? "Optional for public public repos" : "Kwa repo ya binafsi tu"})</span>
                  </label>
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder={isEn ? "ghp_xxxxxxxxxxxx" : "Weka nenosiri la GitHub yaani Token"}
                    className="w-full bg-black/20 border border-white/10 rounded-lg py-2 px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Webhook Configuration fields */}
              <div className="border-t border-white/5 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-200">
                  {isEn ? "GitHub Deployment Webhook (Optional)" : "Kiuunganishi cha Webhook ya GitHub"}
                </h4>
                
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400 block">
                    {isEn ? "Payload URL (Put this inside GitHub repo settings)" : "Anwani ya Webhook (Weka hii kwenye Mipangilio ya GitHub)"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="w-full bg-slate-800/50 border border-white/10 rounded-lg py-1.5 px-3 text-xs text-indigo-300 select-all font-mono focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(webhookUrl, 'webhook')}
                      className="px-3 bg-white/10 hover:bg-white/15 border border-white/15 text-slate-300 rounded-lg text-xs transition duration-150 flex items-center gap-1 shrink-0"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      {copiedField === 'webhook' ? (isEn ? "Copied" : "Kopi!") : (isEn ? "Copy" : "Nakili")}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400 block">
                    {isEn ? "Webhook Secret Token" : "Token siri ya Webhook"}
                  </label>
                  <input
                    type="text"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="e.g. smart-card-automatic-deployment-key"
                    className="w-full bg-black/20 border border-white/10 rounded-lg py-1.5 px-3 text-xs text-white placeholder:text-slate-600 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="auto-deploy"
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                    className="rounded bg-black/20 border-white/10 text-indigo-600 focus:ring-0"
                  />
                  <label htmlFor="auto-deploy" className="text-xs text-slate-300 cursor-pointer">
                    {isEn 
                      ? "Enable real-time Webhook Auto-pull of code adjustments" 
                      : "Wezesha upakuaji wa siri otomatiki (punde tu usukumapo mabadiliko)"}
                  </label>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex justify-between items-center border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={triggerManualSync}
                  disabled={isSyncing}
                  className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-medium transition duration-150 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? (isEn ? "Syncing..." : "Inaoanisha...") : (isEn ? "Sync Now (Force Pull)" : "Oanisha Sasa hivi")}
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition duration-150 flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {isSaving ? (isEn ? "Saving..." : "Inahifadhi...") : (isEn ? "Save Settings" : "Hifadhi Mipangilio")}
                </button>
              </div>
            </form>
          )}

          {/* GUIDE TAB PANEL */}
          {activeSubTab === 'guide' && (
            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 text-xs">
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3.5 space-y-1.5">
                <h4 className="font-bold text-indigo-300 flex items-center gap-1.5 text-xs">
                  <HelpCircle className="w-4 h-4 text-indigo-400" />
                  {isEn ? "How does GitHub Code Syncing work?" : "Ni kwa jinsi gani muunganisho huu unafanya kazi?"}
                </h4>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  {isEn 
                    ? "By linking your GitHub repo, you don't need to manually upload ZIP files of code to have your changes reflected. When you commit or perform a push on branch, this system triggers an automated Git Pull, runs compilation, and updates itself in real-time."
                    : "Ukishaunganisha na akaunti yako ya GitHub, unakuwa huna haja ya kupakia tena faili za ZIP au kuandika programu upya toka mwanzo. Unapofanya marekebisho na kusukuma (push) kwenye tawi (branch), mfumo unajivuta na kujihuisha wenyewe!"}
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-white text-[12px]">
                  {isEn ? "Step-By-Step Setup Guide" : "Hatua kwa Hatua kuanzisha Muunganisho"}
                </h4>

                <div className="flex gap-3 leading-relaxed items-start">
                  <div className="w-5 h-5 bg-white/10 text-white rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</div>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-200">
                      {isEn ? "Create / Select Repo" : "Undasaji wa Repo ya GitHub"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {isEn 
                        ? "Ensure your project files (index.html, package.json, server.ts, src/) are at the root or correctly organized in your GitHub repo."
                        : "Hakikisha maelezo na maongezeko yako yote yapo pale kwenye chanzo kikuu (root folder) cha mtandao wako wa GitHub."}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 leading-relaxed items-start">
                  <div className="w-5 h-5 bg-white/10 text-white rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</div>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-200">
                      {isEn ? "Configure Webhook in GitHub Settings" : "Tengeneza Webhook kwenye Mipangilio ya GitHub"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {isEn 
                        ? "Navigate to Webhooks on GitHub, click 'Add Webhook'. Use the Payload URL displayed in the Config tab, select 'Content type: application/json', and paste your Webhook Secret Token."
                        : "Ingia kule mapendekezo (Settings) ya repo yako ya GitHub, bonyeza Webhooks kisha upandikize URL yetu ile yenye mwisho wa /api/github/webhook na uchague 'Content-Type: application/json'."}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 leading-relaxed items-start">
                  <div className="w-5 h-5 bg-white/10 text-white rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</div>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-200">
                      {isEn ? "Sync and Compile" : "Oanisha na uone Mabadiliko"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {isEn 
                        ? "Click the 'Sync Now' button or try committing code on GitHub. Code changes reflect in the browser instantly."
                        : "Bonyeza kifungo cha 'Oanisha sasa' au jaribu kufanya badiliko lolote kule GitHub, utagundua mfumo unapakua nambari upya moja kwa moja."}
                    </p>
                  </div>
                </div>
              </div>

              {/* FAQ Section addressing original sync concern */}
              <div className="border-t border-white/10 pt-3 space-y-2">
                <h4 className="font-bold text-white text-[11px]">
                  {isEn ? "FAQ: Syncing this AI with your domain website" : "Masaali (FAQ): Kuoanisha AI hii na tovuti yako binafsi"}
                </h4>
                <div className="bg-black/30 p-3 rounded-lg space-y-2 text-[11px]">
                  <div>
                    <h5 className="font-bold text-indigo-300">
                      {isEn 
                        ? "Question: How do I ensure my own server or custom domain uses this same setup?" 
                        : "Uulizaji: Nitafanyaje tovuti yangu binafsi ya kustomu iende sawa na mabadiliko?"}
                    </h5>
                    <p className="text-slate-400 leading-normal mt-1">
                      {isEn
                        ? "1. Share the database URL: Ensure your custom server config (.env) points to the same PostgreSQL database URL on Google Cloud SQL.\n2. GitHub Action deployment: Use this repository mapping to auto-deploy changes to both Cloud Run and your hosting domain."
                        : "1. Shiriki Hifadhidata ya pamoja: Hakikisha tovuti nyingine pia imelengwa kwenye ile anwani ya Postgres (DATABASE_URL).\n2. Tumia muundo thabiti wa GitHub kufanya 'deployment' otomatiki kote kote."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LOGS TAB PANEL */}
          {activeSubTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-300">
                  {isEn ? "Recent Sync Executions" : "Kumbukumbu za Kuvuta Updates (Syncs)"}
                </h4>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-mono">
                  {syncLogs.length} {isEn ? "records" : "rekodi"}
                </span>
              </div>

              {syncLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-xl">
                  {isEn ? "No deployment logs yet. Trigger a sync to start." : "Hakuna kumbukumbu za uoanisho bado. Gonga Oanisha Sasa."}
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                  {syncLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 hover:border-white/10 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <code className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                            {log.commitHash}
                          </code>
                          <span className="text-[10px] text-slate-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            by {log.author}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-200">
                          {log.commitMessage}
                        </p>
                        {log.details && (
                          <p className="text-[10px] text-slate-400 font-mono mt-1 bg-black/10 p-1.5 rounded leading-normal max-w-full overflow-x-auto whitespace-pre-wrap">
                            {log.details}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center justify-end">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                          log.status === 'success' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : log.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            log.status === 'success' 
                              ? 'bg-emerald-400' 
                              : log.status === 'pending'
                              ? 'bg-amber-400'
                              : 'bg-red-400'
                          }`} />
                          {log.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
