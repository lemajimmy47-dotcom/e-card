import React, { useState } from 'react';
import { UwalemiState, UwalemiGroupSettings, UwalemiPaymentMethod, UwalemiMember, UwalemiMemberRole } from '../../types/uwalemi';
import { INITIAL_UWALEMI_STATE } from '../../services/uwalemiService';
import { 
  Settings, 
  CreditCard, 
  BookOpen, 
  Download, 
  Upload, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2,
  ShieldCheck,
  Building,
  Crown,
  UserCheck,
  Award,
  Users,
  Shield,
  Phone,
  ArrowRightLeft,
  Receipt,
  Scale
} from 'lucide-react';

interface Props {
  state: UwalemiState;
  onSaveState: (state: UwalemiState) => Promise<boolean>;
}

const LEADERSHIP_ROLES: { role: UwalemiMemberRole; label: string; badgeColor: string; description: string }[] = [
  { role: 'Mwenyekiti', label: 'Mwenyekiti', badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20', description: 'Kiongozi Mkuu wa Umoja' },
  { role: 'Makamu Mwenyekiti', label: 'Makamu Mwenyekiti', badgeColor: 'bg-orange-500/10 text-orange-400 border-orange-500/20', description: 'Msaidizi wa Mwenyekiti' },
  { role: 'Katibu', label: 'Katibu Mkuu', badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20', description: 'Mratibu wa Rekodi, Barua & Mikutano' },
  { role: 'Katibu Msaidizi', label: 'Katibu Msaidizi', badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', description: 'Msaidizi wa Katibu Mkuu' },
  { role: 'Mweka Hazina', label: 'Mweka Hazina', badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', description: 'Msimamizi Mkuu wa Fedha na Akaunti' },
  { role: 'Mweka Hazina Msaidizi', label: 'Mweka Hazina Msaidizi', badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/20', description: 'Msaidizi wa Mweka Hazina katika Fedha na Kumbukumbu' },
  { role: 'Mlezi', label: 'Mlezi / Mshauri', badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20', description: 'Mshauri Mkuu na Mlezi wa Umoja' },
];

export const UwalemiSettings: React.FC<Props> = ({ state, onSaveState }) => {
  const [settings, setSettings] = useState<UwalemiGroupSettings>(state.groupSettings);
  const [members, setMembers] = useState<UwalemiMember[]>(state.members || []);
  const [isSaved, setIsSaved] = useState(false);

  // Custom Confirmation Dialog States
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [assignModalRole, setAssignModalRole] = useState<UwalemiMemberRole | null>(null);
  const [selectedMemberIdForRole, setSelectedMemberIdForRole] = useState<string>('');

  const handleAddPaymentMethod = () => {
    const newPm: UwalemiPaymentMethod = {
      id: `pm-${Date.now()}`,
      provider: 'M-Pesa (Lipa Namba)',
      type: 'Till',
      number: '',
      accountName: settings.groupName || 'UWALEMI GROUP'
    };
    setSettings({
      ...settings,
      paymentMethods: [...(settings.paymentMethods || []), newPm]
    });
  };

  const handleRemovePaymentMethod = (id: string) => {
    setSettings({
      ...settings,
      paymentMethods: (settings.paymentMethods || []).filter(p => p.id !== id)
    });
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updatedState: UwalemiState = { 
      ...state, 
      groupSettings: settings,
      members: members 
    };
    await onSaveState(updatedState);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Leadership Assignment Handler
  const handleAssignRole = async (targetRole: UwalemiMemberRole, targetMemberId: string) => {
    if (!targetMemberId) return;

    const updatedMembers = members.map(m => {
      if (m.id === targetMemberId) {
        return { ...m, role: targetRole };
      }
      return m;
    });

    setMembers(updatedMembers);
    const updatedState: UwalemiState = { 
      ...state, 
      groupSettings: settings,
      members: updatedMembers 
    };
    await onSaveState(updatedState);
    setAssignModalRole(null);
    setSelectedMemberIdForRole('');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Demote or Remove leader role back to Mjumbe
  const handleRemoveLeaderRole = async (memberId: string) => {
    const updatedMembers = members.map(m => {
      if (m.id === memberId) {
        return { ...m, role: 'Mjumbe' as UwalemiMemberRole };
      }
      return m;
    });

    setMembers(updatedMembers);
    const updatedState: UwalemiState = { 
      ...state, 
      groupSettings: settings,
      members: updatedMembers 
    };
    await onSaveState(updatedState);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleDownloadBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `UWALEMI_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.members)) {
          await onSaveState(parsed);
          alert('Nakala ya UWALEMI imerejeshwa (restored) kwa mafanikio!');
          window.location.reload();
        } else {
          alert('Faili hili halina muundo sahihi wa UWALEMI.');
        }
      } catch (err) {
        alert('Hitilafu katika kusoma faili la backup.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetToDefault = () => {
    setResetConfirmOpen(true);
  };

  // Current leaders list (all members with roles other than 'Mjumbe')
  const currentLeaders = members.filter(m => m.role && m.role !== 'Mjumbe');

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl pb-12" id="uwalemi-settings">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            Mipangilio ya Kikundi cha UWALEMI
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Usimamizi wa viongozi wa umoja, taarifa za msingi, akaunti za malipo (Lipa Namba & Benki), na nakala ya kumbukumbu (Backup).
          </p>
        </div>

        {isSaved && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4" />
            Imehifadhiwa!
          </div>
        )}
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Section 1: Profile Details */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Building className="w-4 h-4 text-emerald-400" />
            Taarifa za Msingi za Kikundi
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Jina la Kikundi</label>
              <input
                type="text"
                value={settings.groupName}
                onChange={(e) => setSettings({ ...settings, groupName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Kauli Mbiu (Slogan)</label>
              <input
                type="text"
                value={settings.slogan}
                onChange={(e) => setSettings({ ...settings, slogan: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-slate-300 font-semibold block mb-1">Maelezo Mafupi ya Kikundi & Madhumuni</label>
              <textarea
                rows={2}
                value={settings.constitutionSummary || ''}
                onChange={(e) => setSettings({ ...settings, constitutionSummary: e.target.value })}
                placeholder="Maelezo au madhumuni ya kikundi..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white resize-none"
              />
            </div>
          </div>
        </div>

        {/* Section 1.5: Viwango vya Faini na Ada */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-4" id="viwango-vya-faini-section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-400" />
                Viwango Rasmi vya Faini za Vikao & Ucheleweshaji
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Viwango vya faini vinavyotumika moja kwa moja wakati wa kuchukua mahudhurio ya vikao na ukokotoaji wa madeni.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-950 border border-rose-900/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-200 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Faini ya Utoro / Kutohudhuria Kikao (TZS) *
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                  Rasmi: TZS 10,000
                </span>
              </div>
              <input
                type="number"
                min={0}
                step="any"
                value={settings.meetingFineDefault || 10000}
                onChange={(e) => setSettings({ ...settings, meetingFineDefault: Number(e.target.value) || 10000 })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-rose-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400">
                Hutozwa kwa kila mwanachama anayekosa kikao bila kutoa udhuru rasmi kwa mujibu wa kanuni za UWALEMI.
              </p>
            </div>

            <div className="p-4 bg-slate-950 border border-indigo-900/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-200 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Faini ya Kuchelewa Kikao (TZS) *
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Rasmi: TZS 2,000
                </span>
              </div>
              <input
                type="number"
                min={0}
                step="any"
                value={settings.meetingFineLateDefault || 2000}
                onChange={(e) => setSettings({ ...settings, meetingFineLateDefault: Number(e.target.value) || 2000 })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-indigo-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400">
                Hutozwa kwa mwanachama anayeingia kikaoni baada ya muda uliopangwa (kuchelewa).
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-xl flex items-start gap-3">
            <Scale className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-amber-300">Kanuni ya Faini ya Kuchelewesha Ada (Kuanzia Mwezi 6 / Juni 2026):</div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Faini ya kuchelewesha ada inaanza kuhesabiwa kuanzia <strong className="text-white">Mwezi wa 6 (Juni 2026)</strong>. Mwanachama anayedaiwa zaidi ya <strong className="text-white">miezi 3</strong> kuanzia mwezi huo hutozwa faini ya <strong className="text-amber-400 font-mono">TZS 5,000</strong> kwa kila mwezi unaozidi miezi 3 ya kwanza.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Viongozi wa Umoja (Executive Leadership Setup) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-5" id="viongozi-wa-umoja-section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                Viongozi wa Umoja (Kamati Tendaji)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Weka na kubadili viongozi wa nafasi mbalimbali za uongozi kwenye umoja.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                {currentLeaders.length} Viongozi Waliopo
              </span>
            </div>
          </div>

          {/* Cards for each major executive position */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {LEADERSHIP_ROLES.map(({ role, label, badgeColor, description }) => {
              const assignedMembers = members.filter(m => m.role === role);

              return (
                <div key={role} className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${badgeColor}`}>
                        {label}
                      </span>
                      {role === 'Mwenyekiti' && <Crown className="w-4 h-4 text-amber-400" />}
                      {role === 'Katibu' && <Award className="w-4 h-4 text-blue-400" />}
                      {role === 'Mweka Hazina' && <Shield className="w-4 h-4 text-emerald-400" />}
                      {role === 'Mweka Hazina Msaidizi' && <Shield className="w-4 h-4 text-teal-400" />}
                    </div>
                    <div className="text-[10px] text-slate-400">{description}</div>
                  </div>

                  {/* Leader details or Unassigned */}
                  <div className="space-y-2">
                    {assignedMembers.length > 0 ? (
                      assignedMembers.map(leader => (
                        <div key={leader.id} className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-white truncate flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-emerald-400 shrink-0">{leader.memberNo}</span>
                              <span className="truncate">{leader.fullName}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                              <Phone className="w-2.5 h-2.5 text-slate-500" />
                              <span>{leader.phone || '-'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setAssignModalRole(role);
                                setSelectedMemberIdForRole(leader.id);
                              }}
                              title="Badili Mwanachama wa nafasi hii"
                              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveLeaderRole(leader.id)}
                              title="Ondoa kwenye uongozi (Mrejeshe kuwa Mjumbe)"
                              className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-md transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 rounded-lg bg-slate-900/40 border border-dashed border-slate-800 text-center">
                        <span className="text-[11px] text-slate-400 italic">Bado haijapangiwa kiongozi</span>
                      </div>
                    )}
                  </div>

                  {/* Assign button */}
                  <button
                    type="button"
                    onClick={() => {
                      setAssignModalRole(role);
                      setSelectedMemberIdForRole('');
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{assignedMembers.length > 0 ? 'Ongeza / Badili Kiongozi' : 'Weka Kiongozi'}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Quick Leadership Summary Table */}
          {currentLeaders.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                Orodha ya Viongozi Wote Walioteuliwa:
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                      <th className="py-2 px-3">Wadhifa</th>
                      <th className="py-2 px-3">Namba</th>
                      <th className="py-2 px-3">Jina Kamili</th>
                      <th className="py-2 px-3">Namba ya Simu</th>
                      <th className="py-2 px-3">Makazi</th>
                      <th className="py-2 px-3 text-right">Vitendo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium text-slate-200">
                    {currentLeaders.map(leader => (
                      <tr key={leader.id} className="hover:bg-slate-950/40">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-amber-400">{leader.role}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{leader.memberNo}</td>
                        <td className="py-2.5 px-3 font-semibold text-white">{leader.fullName}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{leader.phone}</td>
                        <td className="py-2.5 px-3 text-slate-400">{leader.residence || '-'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveLeaderRole(leader.id)}
                            className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-2 py-1 rounded-md"
                          >
                            <Trash2 className="w-3 h-3" />
                            Ondoa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Payment Channels (Lipa Namba & Bank Accounts) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              Akaunti za Malipo za Kikundi (Lipa Namba & Benki)
            </h3>
            <button
              type="button"
              onClick={handleAddPaymentMethod}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Ongeza Njia ya Malipo
            </button>
          </div>

          <div className="space-y-3">
            {(settings.paymentMethods || []).map((pm, idx) => (
              <div key={pm.id || idx} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-center text-xs">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Mtoa Huduma</label>
                  <input
                    type="text"
                    value={pm.provider}
                    onChange={(e) => {
                      const updated = [...(settings.paymentMethods || [])];
                      updated[idx].provider = e.target.value;
                      setSettings({ ...settings, paymentMethods: updated });
                    }}
                    placeholder="M-Pesa / CRDB / Tigo Pesa"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-medium"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Aina</label>
                  <select
                    value={pm.type}
                    onChange={(e) => {
                      const updated = [...(settings.paymentMethods || [])];
                      updated[idx].type = e.target.value as any;
                      setSettings({ ...settings, paymentMethods: updated });
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                  >
                    <option value="Till">Till / Lipa Namba</option>
                    <option value="Bank">Akaunti ya Benki</option>
                    <option value="Paybill">Paybill</option>
                    <option value="Mobile">Namba ya Simu</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Namba ya Malipo</label>
                  <input
                    type="text"
                    value={pm.number}
                    onChange={(e) => {
                      const updated = [...(settings.paymentMethods || [])];
                      updated[idx].number = e.target.value;
                      setSettings({ ...settings, paymentMethods: updated });
                    }}
                    placeholder="5566778"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 block mb-0.5">Jina la Akaunti</label>
                    <input
                      type="text"
                      value={pm.accountName}
                      onChange={(e) => {
                        const updated = [...(settings.paymentMethods || [])];
                        updated[idx].accountName = e.target.value;
                        setSettings({ ...settings, paymentMethods: updated });
                      }}
                      placeholder="UWALEMI GROUP"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePaymentMethod(pm.id)}
                    className="mt-4 p-1.5 text-rose-400 hover:bg-slate-900 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Katiba & Mwongozo Summary */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            Muhtasari wa Katiba & Kanuni za Kikundi
          </h3>

          <div>
            <textarea
              rows={4}
              value={settings.constitutionSummary || ''}
              onChange={(e) => setSettings({ ...settings, constitutionSummary: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white leading-relaxed"
              placeholder="Andika muhtasari wa kanuni, wajibu wa mwanachama, na madhumuni ya UWALEMI..."
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Hifadhi Mipangilio ya UWALEMI
          </button>
        </div>
      </form>

      {/* Section 5: Data Management & Backup */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-4 mt-8">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Hifadhi ya Nakala & Usalama wa Takwimu (Backup & Restore)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-center transition-all cursor-pointer group"
          >
            <Download className="w-6 h-6 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white">Pakua Backup JSON</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Hifadhi rekodi zote kwenye kompyuta au simu</span>
          </button>

          <label className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-center transition-all cursor-pointer group">
            <Upload className="w-6 h-6 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white">Rejesha Kutoka Backup</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Pakia faili la JSON lililohifadhiwa awali</span>
            <input type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" />
          </label>

          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/20 text-center transition-all cursor-pointer group"
          >
            <RotateCcw className="w-6 h-6 text-rose-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-rose-400">Weka Upya Mfumo</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Futa takwimu na weka upya mipangilio</span>
          </button>
        </div>
      </div>

      {/* MODAL: ASSIGN LEADER ROLE */}
      {assignModalRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Chagua Kiongozi: <span className="text-amber-400">{assignModalRole}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalRole(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1.5">
                  Chagua Mwanachama atakayepewa nafasi hii:
                </label>
                <select
                  value={selectedMemberIdForRole}
                  onChange={(e) => setSelectedMemberIdForRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                >
                  <option value="">-- Chagua Mwanachama --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.memberNo} - {m.fullName} ({m.role || 'Mjumbe'})
                    </option>
                  ))}
                </select>
              </div>

              {selectedMemberIdForRole && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-slate-300">
                  {(() => {
                    const sel = members.find(m => m.id === selectedMemberIdForRole);
                    if (!sel) return null;
                    return (
                      <>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{sel.fullName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">Simu: {sel.phone} | Makazi: {sel.residence || 'Dar es Salaam'}</div>
                        <div className="text-[11px] text-amber-400 font-semibold mt-1">
                          Wadhifa wa Sasa: {sel.role || 'Mjumbe'} ➔ Atabadilishwa kuwa: {assignModalRole}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setAssignModalRole(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Ghairi
              </button>
              <button
                type="button"
                disabled={!selectedMemberIdForRole}
                onClick={() => handleAssignRole(assignModalRole, selectedMemberIdForRole)}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 cursor-pointer"
              >
                Thibitisha Kiongozi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: RESET CONFIRMATION */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center animate-pulse">
                <RotateCcw className="w-5 h-5 animate-spin" />
              </div>
              <h3 className="text-base font-bold text-white">Thibitisha Weka Upya</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Je, una uhakika unataka kuweka upya (reset) moduli ya UWALEMI kurudi kwenye mipangilio ya asili? 
              <span className="text-rose-400 font-bold block mt-2">Hatua hii itafuta data zote zilizorekodiwa na haiwezi kurudishwa nyuma!</span>
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Ghairi
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onSaveState(INITIAL_UWALEMI_STATE);
                  setResetConfirmOpen(false);
                  alert('UWALEMI imewekwa upya kwa mafanikio!');
                  window.location.reload();
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/30 cursor-pointer"
              >
                Weka Upya
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

