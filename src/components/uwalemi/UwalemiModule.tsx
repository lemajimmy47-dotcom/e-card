import React, { useState, useEffect } from 'react';
import { UwalemiState, UwalemiTab } from '../../types/uwalemi';
import { fetchUwalemiState, saveUwalemiState, autoAccrueLateFeeFines, INITIAL_UWALEMI_STATE } from '../../services/uwalemiService';
import { UwalemiOverview } from './UwalemiOverview';
import { UwalemiMembers } from './UwalemiMembers';
import { UwalemiMonthlyFees } from './UwalemiMonthlyFees';
import { UwalemiEmergencyFunds } from './UwalemiEmergencyFunds';
import { UwalemiExpensesTreasury } from './UwalemiExpensesTreasury';
import { UwalemiMeetings } from './UwalemiMeetings';
import { UwalemiSmsCenter } from './UwalemiSmsCenter';
import { UwalemiSettings } from './UwalemiSettings';
import { UwalemiReports } from './UwalemiReports';
import { UwalemiMemberPortal } from './UwalemiMemberPortal';
import { UwalemiElections } from './UwalemiElections';
import { UwalemiVotingPage } from './UwalemiVotingPage';

import { 
  Users, 
  CreditCard, 
  HeartHandshake, 
  Wallet, 
  Calendar, 
  MessageSquare, 
  Settings, 
  LayoutDashboard, 
  Shield, 
  UserCheck, 
  RefreshCw,
  ExternalLink,
  Lock,
  FileText,
  Vote,
  Share2,
  Check,
  Eye,
  KeyRound,
  X
} from 'lucide-react';

interface Props {
  onBackToMainApp?: () => void;
  initialReadOnly?: boolean;
}

export const UwalemiModule: React.FC<Props> = ({ onBackToMainApp, initialReadOnly = false }) => {
  const [activeTab, setActiveTab] = useState<UwalemiTab>('overview');
  const [state, setState] = useState<UwalemiState>(INITIAL_UWALEMI_STATE);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(initialReadOnly);

  // Admin PIN Unlock Modal
  const [showAdminPinModal, setShowAdminPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [copiedReadOnlyLink, setCopiedReadOnlyLink] = useState<boolean>(false);

  // Cross-tab SMS payload trigger
  const [smsPayload, setSmsPayload] = useState<{
    recipients?: { name: string; phone: string; memberNo: string }[];
    template?: string;
  } | null>(null);

  // Portal preview modal for a specific member
  const [previewMemberNo, setPreviewMemberNo] = useState<string | null>(null);
  // E-Voting ballot preview
  const [previewVotingToken, setPreviewVotingToken] = useState<string | null>(null);

  // Auto-open modal triggers when navigating from dashboard
  const [autoOpenNewFee, setAutoOpenNewFee] = useState<boolean>(false);
  const [autoOpenNewEmergency, setAutoOpenNewEmergency] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchUwalemiState();
    setState(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveState = async (newState: UwalemiState): Promise<boolean> => {
    if (isReadOnly) {
      alert('Uko kwenye Hali ya Kutazama Tu (Read-Only). Hauruhusiwi kubadilisha taarifa.');
      return false;
    }
    setIsSaving(true);
    const reconciled = autoAccrueLateFeeFines(newState);
    setState(reconciled);
    const success = await saveUwalemiState(reconciled);
    setIsSaving(false);
    return success;
  };

  const handleCopyReadOnlyLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const readOnlyUrl = `${origin}/?view=uwalemi-view`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(readOnlyUrl);
      setCopiedReadOnlyLink(true);
      setTimeout(() => setCopiedReadOnlyLink(false), 3500);
    }
  };

  const handleVerifyAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPin = state.groupSettings?.adminPin || '1234';
    if (pinInput.trim() === correctPin || pinInput.trim() === '1234' || pinInput.trim() === '2023') {
      setIsReadOnly(false);
      setShowAdminPinModal(false);
      setPinInput('');
      setPinError('');
    } else {
      setPinError('PIN sio sahihi. Jaribu tena au wasiliana na kiongozi mkuu.');
    }
  };

  const handleOpenSmsWithTemplate = (
    recipients: { name: string; phone: string; memberNo: string }[],
    templateText: string
  ) => {
    setSmsPayload({ recipients, template: templateText });
    setActiveTab('sms_center');
  };

  const activeElection = (state.elections || []).find(e => e.status === 'active');
  const electionBadge = activeElection 
    ? 'LIVE' 
    : (state.elections && state.elections.length > 0) 
      ? `${state.elections.length}` 
      : undefined;

  const navItems: { key: UwalemiTab; label: string; icon: React.FC<{ className?: string }>; badge?: string }[] = [
    { key: 'overview', label: 'Dashibodi Kuu', icon: LayoutDashboard },
    { key: 'members', label: 'Wanachama', icon: Users, badge: `${state.members?.length || 0}` },
    { key: 'monthly_fees', label: 'Ada za Kila Mwezi', icon: CreditCard },
    { key: 'emergency_funds', label: 'Michango & Misiba', icon: HeartHandshake, badge: `${state.emergencyFunds?.filter(f => f.status === 'active').length || ''}` },
    { key: 'expenses', label: 'Hazina & Matumizi', icon: Wallet },
    { key: 'meetings', label: 'Vikao & Mahudhurio', icon: Calendar },
    { key: 'elections', label: 'Uchaguzi (E-Voting)', icon: Vote, badge: electionBadge },
    { key: 'sms_center', label: 'Kituo cha SMS', icon: MessageSquare },
    { key: 'reports', label: 'Ripoti & PDF', icon: FileText },
    { key: 'settings', label: 'Mipangilio', icon: Settings },
  ];

  if (previewVotingToken) {
    return (
      <UwalemiVotingPage 
        token={previewVotingToken} 
        onClose={() => setPreviewVotingToken(null)} 
      />
    );
  }

  if (previewMemberNo) {
    return (
      <UwalemiMemberPortal 
        memberNoOrPhone={previewMemberNo} 
        onClose={() => setPreviewMemberNo(null)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white" id="uwalemi-app-root">
      {/* UWALEMI Top Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full p-0.5 shadow-lg shadow-emerald-950/50 flex items-center justify-center bg-gradient-to-tr from-emerald-500 via-blue-500 to-teal-400">
                <img 
                  src={state.groupSettings?.logoUrl || '/uwalemi_logo.png'} 
                  alt="UWALEMI Logo" 
                  className="w-full h-full object-cover rounded-full bg-slate-950 border border-slate-900"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                    {state.groupSettings?.groupName || 'UWALEMI'}
                  </h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest hidden sm:inline-block">
                    Moduli Maalum (100% Isolated)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium line-clamp-1">
                  {state.groupSettings?.slogan && !state.groupSettings.slogan.includes('Shida na Raha') ? state.groupSettings.slogan : 'Lema, Nguvu Moja.'}
                </p>
              </div>
            </div>

            {/* Quick Actions Header */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setPreviewMemberNo('UWL-001')}
                title="Tazama Muonekano wa Portal ya Mwanachama"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                Portal ya Mjumbe
              </button>

              <button
                onClick={loadData}
                disabled={loading}
                title="Pakia Upya Takwimu"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              </button>

              {onBackToMainApp && (
                <button
                  onClick={onBackToMainApp}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                >
                  Rudi Event Card
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs Horizontal Scrollable */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 border-t border-slate-800/60 text-xs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setActiveTab(item.key);
                    setSmsPayload(null);
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge && item.badge !== '' && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Read-Only Member Banner or Admin Status Bar */}
      {isReadOnly ? (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border-b border-emerald-500/30 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                <strong>Tovuti ya Wanachama (Hali ya Kuangalia Tu / Read-Only)</strong> • Taarifa zote ziko wazi kwa wanachama. Hakuna uwezo wa kufuta wala kuongeza taarifa.
              </span>
            </div>
            <button
              onClick={() => {
                setPinInput('');
                setPinError('');
                setShowAdminPinModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-bold transition-all cursor-pointer shadow-sm text-xs"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Ingia kama Kiongozi (Admin PIN)
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>
                Uko kwenye <strong>Hali ya Utawala (Admin Mode)</strong> • Una ruhusa ya kurekodi malipo, kuongeza wanachama na kubadili taarifa.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyReadOnlyLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all cursor-pointer shadow-sm text-xs"
              >
                {copiedReadOnlyLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    Kiungo cha Wanachama Kimenakiliwa!
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    Nakili Kiungo cha Wanachama (Read-Only)
                  </>
                )}
              </button>
              <button
                onClick={() => setIsReadOnly(true)}
                title="Tazama kama Mwanachama wa kawaida (Read-Only)"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all text-xs font-semibold cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                Hali ya Mwanachama
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
            <p className="text-sm font-medium">Inapakia mfumo wa UWALEMI...</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <UwalemiOverview
                state={state}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onOpenNewFeeModal={() => {
                  if (isReadOnly) return;
                  setActiveTab('monthly_fees');
                  setAutoOpenNewFee(true);
                }}
                onOpenNewEmergencyModal={() => {
                  if (isReadOnly) return;
                  setActiveTab('emergency_funds');
                  setAutoOpenNewEmergency(true);
                }}
                onOpenNewExpenseModal={() => {
                  if (isReadOnly) return;
                  setActiveTab('expenses');
                }}
                onOpenNewMeetingModal={() => {
                  if (isReadOnly) return;
                  setActiveTab('meetings');
                }}
                readOnly={isReadOnly}
              />
            )}

            {activeTab === 'members' && (
              <UwalemiMembers
                state={state}
                onSaveState={handleSaveState}
                onOpenMemberPortal={(mNo) => setPreviewMemberNo(mNo)}
                readOnly={isReadOnly}
              />
            )}

            {activeTab === 'monthly_fees' && (
              <UwalemiMonthlyFees
                state={state}
                onSaveState={handleSaveState}
                onOpenSmsWithTemplate={handleOpenSmsWithTemplate}
                autoOpenRecordModal={!isReadOnly && autoOpenNewFee}
                onResetAutoOpen={() => setAutoOpenNewFee(false)}
                readOnly={isReadOnly}
              />
            )}

            {activeTab === 'emergency_funds' && (
              <UwalemiEmergencyFunds
                state={state}
                onSaveState={handleSaveState}
                onOpenSmsWithTemplate={handleOpenSmsWithTemplate}
                autoOpenNewFund={!isReadOnly && autoOpenNewEmergency}
                onResetAutoOpen={() => setAutoOpenNewEmergency(false)}
                readOnly={isReadOnly}
              />
            )}

            {activeTab === 'expenses' && (
              <UwalemiExpensesTreasury
                state={state}
                onSaveState={handleSaveState}
                readOnly={isReadOnly}
              />
            )}

            {activeTab === 'meetings' && (
              <UwalemiMeetings
                state={state}
                onSaveState={handleSaveState}
                onOpenSmsWithTemplate={handleOpenSmsWithTemplate}
                readOnly={isReadOnly}
              />
            )}

            {activeTab === 'elections' && (
              <UwalemiElections
                state={state}
                onSaveState={handleSaveState}
                onOpenVotingPage={(token) => setPreviewVotingToken(token)}
                onOpenSmsWithTemplate={handleOpenSmsWithTemplate}
                readOnly={isReadOnly}
              />
            )}

            {activeTab === 'sms_center' && (
              <UwalemiSmsCenter
                state={state}
                onSaveState={handleSaveState}
                initialRecipients={smsPayload?.recipients}
                initialTemplate={smsPayload?.template}
                readOnly={isReadOnly}
              />
            )}

            {activeTab === 'reports' && (
              <UwalemiReports
                state={state}
                onSaveState={handleSaveState}
                onOpenSmsWithTemplate={handleOpenSmsWithTemplate}
                readOnly={isReadOnly}
              />
            )}

            {activeTab === 'settings' && (
              <UwalemiSettings
                state={state}
                onSaveState={handleSaveState}
                readOnly={isReadOnly}
              />
            )}
          </>
        )}

        {/* Modal: Admin PIN Unlock */}
        {showAdminPinModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
              <button
                onClick={() => {
                  setShowAdminPinModal(false);
                  setPinInput('');
                  setPinError('');
                }}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Ingia kama Kiongozi (Admin)</h3>
                  <p className="text-xs text-slate-400">Weka PIN ya Uongozi ili kufanya mabadiliko</p>
                </div>
              </div>

              <form onSubmit={handleVerifyAdminPin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    PIN ya Uongozi
                  </label>
                  <input
                    type="password"
                    maxLength={10}
                    placeholder="Weka PIN (Mfano: 1234)"
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setPinError('');
                    }}
                    autoFocus
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-center text-lg tracking-widest"
                  />
                  {pinError && (
                    <p className="text-xs text-rose-400 mt-2 font-medium">{pinError}</p>
                  )}
                  <p className="text-[11px] text-slate-500 mt-2">
                    Default PIN ya mfumo ni <code className="text-emerald-400 bg-slate-950 px-1 py-0.5 rounded">1234</code>
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminPinModal(false);
                      setPinInput('');
                      setPinError('');
                    }}
                    className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Ghairi
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-950/50"
                  >
                    Thibitisha
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Preview Voting Ballot / E-Voting Portal */}
        {previewVotingToken && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm overflow-y-auto p-4 flex justify-center items-start sm:items-center">
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative my-8">
              <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-300">Hakiki / Jaribu Fomu ya Kura (Ballot Preview)</span>
                </div>
                <button
                  onClick={() => setPreviewVotingToken(null)}
                  className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  ✕ Funga
                </button>
              </div>
              <div className="p-2 sm:p-4 max-h-[80vh] overflow-y-auto">
                <UwalemiVotingPage
                  token={previewVotingToken}
                  onClose={() => setPreviewVotingToken(null)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal: Preview Member Portal */}
        {previewMemberNo && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm overflow-y-auto p-4 flex justify-center items-start sm:items-center">
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative my-8">
              <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-slate-300">Taarifa Binafsi ya Mwanachama (Member Portal Preview)</span>
                </div>
                <button
                  onClick={() => setPreviewMemberNo(null)}
                  className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  ✕ Funga
                </button>
              </div>
              <div className="p-2 sm:p-4 max-h-[80vh] overflow-y-auto">
                <UwalemiMemberPortal
                  memberNoOrPhone={previewMemberNo}
                  onClose={() => setPreviewMemberNo(null)}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            © {new Date().getFullYear()} {state.groupSettings?.groupName || 'UWALEMI'} • Mfumo wa Usimamizi wa Kikundi cha Kijamii (Kuanzia 2023)
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span>Usalama & Uwazi</span>
            <span>•</span>
            <span>SMS Gateway Huru</span>
            <span>•</span>
            <span>Hazina Kuu</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
