import React, { useState, useEffect } from 'react';
import { UwalemiState, UwalemiTab } from '../../types/uwalemi';
import { fetchUwalemiState, saveUwalemiState, INITIAL_UWALEMI_STATE } from '../../services/uwalemiService';
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
  FileText
} from 'lucide-react';

interface Props {
  onBackToMainApp?: () => void;
}

export const UwalemiModule: React.FC<Props> = ({ onBackToMainApp }) => {
  const [activeTab, setActiveTab] = useState<UwalemiTab>('overview');
  const [state, setState] = useState<UwalemiState>(INITIAL_UWALEMI_STATE);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Cross-tab SMS payload trigger
  const [smsPayload, setSmsPayload] = useState<{
    recipients?: { name: string; phone: string; memberNo: string }[];
    template?: string;
  } | null>(null);

  // Portal preview modal for a specific member
  const [previewMemberNo, setPreviewMemberNo] = useState<string | null>(null);

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
    setIsSaving(true);
    setState(newState);
    const success = await saveUwalemiState(newState);
    setIsSaving(false);
    return success;
  };

  const handleOpenSmsWithTemplate = (
    recipients: { name: string; phone: string; memberNo: string }[],
    templateText: string
  ) => {
    setSmsPayload({ recipients, template: templateText });
    setActiveTab('sms_center');
  };

  const navItems: { key: UwalemiTab; label: string; icon: React.FC<{ className?: string }>; badge?: string }[] = [
    { key: 'overview', label: 'Dashibodi Kuu', icon: LayoutDashboard },
    { key: 'members', label: 'Wanachama', icon: Users, badge: `${state.members?.length || 0}` },
    { key: 'monthly_fees', label: 'Ada za Kila Mwezi', icon: CreditCard },
    { key: 'emergency_funds', label: 'Michango & Misiba', icon: HeartHandshake, badge: `${state.emergencyFunds?.filter(f => f.status === 'active').length || ''}` },
    { key: 'expenses', label: 'Hazina & Matumizi', icon: Wallet },
    { key: 'meetings', label: 'Vikao & Mahudhurio', icon: Calendar },
    { key: 'sms_center', label: 'Kituo cha SMS', icon: MessageSquare },
    { key: 'reports', label: 'Ripoti & PDF', icon: FileText },
    { key: 'settings', label: 'Mipangilio', icon: Settings },
  ];

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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-950/50 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Shield className="w-5 h-5 text-emerald-400" />
                </div>
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
                  setActiveTab('monthly_fees');
                  setAutoOpenNewFee(true);
                }}
                onOpenNewEmergencyModal={() => {
                  setActiveTab('emergency_funds');
                  setAutoOpenNewEmergency(true);
                }}
                onOpenNewExpenseModal={() => {
                  setActiveTab('expenses');
                }}
                onOpenNewMeetingModal={() => {
                  setActiveTab('meetings');
                }}
              />
            )}

            {activeTab === 'members' && (
              <UwalemiMembers
                state={state}
                onSaveState={handleSaveState}
                onOpenMemberPortal={(mNo) => setPreviewMemberNo(mNo)}
              />
            )}

            {activeTab === 'monthly_fees' && (
              <UwalemiMonthlyFees
                state={state}
                onSaveState={handleSaveState}
                onOpenSmsWithTemplate={handleOpenSmsWithTemplate}
                autoOpenRecordModal={autoOpenNewFee}
                onResetAutoOpen={() => setAutoOpenNewFee(false)}
              />
            )}

            {activeTab === 'emergency_funds' && (
              <UwalemiEmergencyFunds
                state={state}
                onSaveState={handleSaveState}
                onOpenSmsWithTemplate={handleOpenSmsWithTemplate}
                autoOpenNewFund={autoOpenNewEmergency}
                onResetAutoOpen={() => setAutoOpenNewEmergency(false)}
              />
            )}

            {activeTab === 'expenses' && (
              <UwalemiExpensesTreasury
                state={state}
                onSaveState={handleSaveState}
              />
            )}

            {activeTab === 'meetings' && (
              <UwalemiMeetings
                state={state}
                onSaveState={handleSaveState}
                onOpenSmsWithTemplate={handleOpenSmsWithTemplate}
              />
            )}

            {activeTab === 'sms_center' && (
              <UwalemiSmsCenter
                state={state}
                onSaveState={handleSaveState}
                initialRecipients={smsPayload?.recipients}
                initialTemplate={smsPayload?.template}
              />
            )}

            {activeTab === 'reports' && (
              <UwalemiReports
                state={state}
                onSaveState={handleSaveState}
                onOpenSmsWithTemplate={handleOpenSmsWithTemplate}
              />
            )}

            {activeTab === 'settings' && (
              <UwalemiSettings
                state={state}
                onSaveState={handleSaveState}
              />
            )}
          </>
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
