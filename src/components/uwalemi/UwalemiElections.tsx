import React, { useState, useMemo } from 'react';
import { 
  UwalemiState, 
  UwalemiElection, 
  UwalemiElectionPosition, 
  UwalemiCandidate, 
  UwalemiVoterRecord 
} from '../../types/uwalemi';
import { 
  calculateElectionTally, 
  recomputeElectionVoters, 
  generateVoterToken,
  isElectionConcluded,
  ElectionPositionTally 
} from '../../services/uwalemiService';
import { 
  Vote, 
  Plus, 
  Users, 
  ShieldCheck, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Copy, 
  Check, 
  ExternalLink, 
  Search, 
  Filter, 
  Printer, 
  Award, 
  Lock, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  Calendar, 
  UserCheck, 
  TrendingUp, 
  FileText,
  Share2,
  ChevronRight,
  Sparkles,
  Info,
  Download,
  Eye,
  X
} from 'lucide-react';
import { 
  loadUwalemiLogoAsBase64,
  generateElectionResultsPDF,
  downloadPdfDocument,
  getPdfBlobUrl
} from '../../services/uwalemiPdfGenerator';

interface Props {
  state: UwalemiState;
  onSaveState: (newState: UwalemiState) => Promise<boolean>;
  onOpenVotingPage?: (token: string) => void;
  onOpenSmsWithTemplate?: (recipients: { name: string; phone: string; memberNo: string }[], templateText: string) => void;
  readOnly?: boolean;
}

export const UwalemiElections: React.FC<Props> = ({
  state,
  onSaveState,
  onOpenVotingPage,
  onOpenSmsWithTemplate,
  readOnly
}) => {
  const elections = state.elections || [];
  const [selectedElectionId, setSelectedElectionId] = useState<string>(
    elections.length > 0 ? elections[0].id : ''
  );

  const activeElection = useMemo(() => {
    return elections.find(e => e.id === selectedElectionId) || elections[0] || null;
  }, [elections, selectedElectionId]);

  // Sub-tabs in election manager
  const [subTab, setSubTab] = useState<'tally' | 'voters' | 'positions' | 'audit'>('tally');

  // Search & Filter in voter roll
  const [voterSearch, setVoterSearch] = useState<string>('');
  const [voterStatusFilter, setVoterStatusFilter] = useState<'all' | 'voted' | 'not_voted' | 'ineligible'>('all');

  // Modals
  const [showNewElectionModal, setShowNewElectionModal] = useState<boolean>(false);
  const [showNewPositionModal, setShowNewPositionModal] = useState<boolean>(false);
  const [showAddCandidateModal, setShowAddCandidateModal] = useState<string | null>(null); // holds positionId
  const [showSendSmsModal, setShowSendSmsModal] = useState<boolean>(false);
  const [isSendingSms, setIsSendingSms] = useState<boolean>(false);
  const [smsResultMsg, setSmsResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New election form state
  const [newElectionTitle, setNewElectionTitle] = useState<string>('Uchaguzi Mkuu wa Viongozi wa UWALEMI 2026/2028');
  const [newElectionTerm, setNewElectionTerm] = useState<string>('2026 - 2028');
  const [newElectionStartDate, setNewElectionStartDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [newElectionEndDate, setNewElectionEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 16);
  });
  const [requireActiveOnly, setRequireActiveOnly] = useState<boolean>(true);
  const [requireRegFeePaid, setRequireRegFeePaid] = useState<boolean>(false);
  const [maxDebtMonths, setMaxDebtMonths] = useState<number>(99); // 99 = allow all

  // New position form
  const [newPosTitle, setNewPosTitle] = useState<string>('');
  const [newPosDesc, setNewPosDesc] = useState<string>('');
  const [newPosMaxWinners, setNewPosMaxWinners] = useState<number>(1);

  // Individual SMS sending states
  const [sendingIndividualSmsToken, setSendingIndividualSmsToken] = useState<string | null>(null);

  // PDF Export & Interactive Preview States
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isPrintingReport, setIsPrintingReport] = useState<boolean>(false);
  const [previewPdfModal, setPreviewPdfModal] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
    fileName: string;
  } | null>(null);

  // Confirmation & Report Protection Modals
  const [showCompleteConfirmModal, setShowCompleteConfirmModal] = useState<boolean>(false);
  const [showReportLockedModal, setShowReportLockedModal] = useState<boolean>(false);

  // Add candidate form
  const [candMemberId, setCandMemberId] = useState<string>('');
  const [candSlogan, setCandSlogan] = useState<string>('');

  // Custom SMS template
  const [smsTargetGroup, setSmsTargetGroup] = useState<'all_eligible' | 'unvoted_only'>('all_eligible');
  const [smsCustomMsg, setSmsCustomMsg] = useState<string>(
    `Habari {name}, uchaguzi wa viongozi wa UWALEMI unaendelea. Bofya kiungo hiki cha siri kupiga kura yako: {link} . Tafadhali usimtumie mtu mwingine kiungo hiki.`
  );

  // Clipboard feedback
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const totalGroupMembers = (state.members || []).length || (activeElection?.voters || []).length || 0;

  const isElectionEnded = useMemo(() => {
    return isElectionConcluded(activeElection);
  }, [activeElection]);

  // Calculate live tally using verified member count
  const tallyData = useMemo(() => {
    if (!activeElection) return null;
    return calculateElectionTally(activeElection, totalGroupMembers);
  }, [activeElection, totalGroupMembers]);

  // Handle status toggle
  const handleUpdateElectionStatus = async (newStatus: 'draft' | 'active' | 'paused' | 'completed') => {
    if (readOnly || !activeElection) return;
    const updatedElections = elections.map(e => {
      if (e.id === activeElection.id) {
        return {
          ...e,
          status: newStatus,
          certifiedAt: newStatus === 'completed' ? new Date().toISOString() : e.certifiedAt,
          certifiedBy: newStatus === 'completed' ? 'Kamati ya Uchaguzi' : e.certifiedBy
        };
      }
      return e;
    });

    await onSaveState({
      ...state,
      elections: updatedElections
    });
  };

  // Recompute voter eligibility
  const handleRecomputeVoters = async () => {
    if (readOnly || !activeElection) return;
    const refreshedVoters = recomputeElectionVoters(activeElection, state.members, state.monthlyPayments);
    const updatedElections = elections.map(e => {
      if (e.id === activeElection.id) {
        return { ...e, voters: refreshedVoters };
      }
      return e;
    });
    await onSaveState({
      ...state,
      elections: updatedElections
    });
  };

  // Create new election
  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    if (!newElectionTitle.trim()) return;

    const electionId = `elec-${Date.now()}`;
    
    // Default positions setup for UWALEMI
    const defaultPositions: UwalemiElectionPosition[] = [
      {
        id: `pos-${Date.now()}-1`,
        title: 'Mwenyekiti',
        description: 'Kiongozi Mkuu wa Kikundi cha UWALEMI',
        maxWinners: 1,
        candidates: []
      },
      {
        id: `pos-${Date.now()}-2`,
        title: 'Makamu Mwenyekiti',
        description: 'Msaidizi Mkuu wa Mwenyekiti',
        maxWinners: 1,
        candidates: []
      },
      {
        id: `pos-${Date.now()}-3`,
        title: 'Katibu Mkuu',
        description: 'Msimamizi wa Shughuli za Kila Siku na Kumbukumbu',
        maxWinners: 1,
        candidates: []
      },
      {
        id: `pos-${Date.now()}-4`,
        title: 'Katibu Msaidizi',
        description: 'Msaidizi wa Katibu Mkuu',
        maxWinners: 1,
        candidates: []
      },
      {
        id: `pos-${Date.now()}-5`,
        title: 'Mweka Hazina',
        description: 'Msimamizi Mkuu wa Fedha na Akaunti za UWALEMI',
        maxWinners: 1,
        candidates: []
      },
      {
        id: `pos-${Date.now()}-6`,
        title: 'Mweka Hazina Msaidizi',
        description: 'Msaidizi wa Mweka Hazina',
        maxWinners: 1,
        candidates: []
      }
    ];

    const tempElection: Partial<UwalemiElection> = {
      id: electionId,
      title: newElectionTitle.trim(),
      termYears: newElectionTerm.trim(),
      startDate: newElectionStartDate,
      endDate: newElectionEndDate,
      status: 'draft',
      eligibilityCriteria: {
        activeMembersOnly: requireActiveOnly,
        requireRegistrationFeePaid: requireRegFeePaid,
        maxAllowedFeeDebtMonths: maxDebtMonths
      },
      positions: defaultPositions,
      ballots: [],
      createdAt: new Date().toISOString()
    };

    const initialVoters = recomputeElectionVoters(tempElection, state.members, state.monthlyPayments);

    const fullElection: UwalemiElection = {
      ...(tempElection as UwalemiElection),
      voters: initialVoters
    };

    const updated = [fullElection, ...elections];
    await onSaveState({
      ...state,
      elections: updated
    });

    setSelectedElectionId(fullElection.id);
    setShowNewElectionModal(false);
  };

  // Add Position
  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || !activeElection || !newPosTitle.trim()) return;

    const newPosition: UwalemiElectionPosition = {
      id: `pos-${Date.now()}`,
      title: newPosTitle.trim(),
      description: newPosDesc.trim() || undefined,
      maxWinners: Math.max(1, newPosMaxWinners || 1),
      candidates: []
    };

    const updatedElections = elections.map(elec => {
      if (elec.id === activeElection.id) {
        return {
          ...elec,
          positions: [...elec.positions, newPosition]
        };
      }
      return elec;
    });

    await onSaveState({
      ...state,
      elections: updatedElections
    });

    setNewPosTitle('');
    setNewPosDesc('');
    setNewPosMaxWinners(1);
    setShowNewPositionModal(false);
  };

  // Delete Position
  const handleDeletePosition = async (posId: string) => {
    if (readOnly || !activeElection) return;
    if (!confirm('Je, una uhakika unataka kufuta nafasi hii ya uongozi?')) return;

    const updatedElections = elections.map(elec => {
      if (elec.id === activeElection.id) {
        return {
          ...elec,
          positions: elec.positions.filter(p => p.id !== posId)
        };
      }
      return elec;
    });

    await onSaveState({
      ...state,
      elections: updatedElections
    });
  };

  // Add Candidate to Position
  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || !activeElection || !showAddCandidateModal || !candMemberId) return;

    const member = state.members.find(m => m.id === candMemberId);
    if (!member) return;

    const newCandidate: UwalemiCandidate = {
      id: `cand-${Date.now()}-${member.memberNo}`,
      memberId: member.id,
      memberNo: member.memberNo,
      fullName: member.fullName,
      phone: member.phone,
      avatarUrl: member.avatarUrl,
      slogan: candSlogan.trim() || undefined,
      manifesto: candSlogan.trim() || undefined
    };

    const updatedElections = elections.map(elec => {
      if (elec.id === activeElection.id) {
        return {
          ...elec,
          positions: elec.positions.map(pos => {
            if (pos.id === showAddCandidateModal) {
              // Avoid duplicate candidate in same position
              if (pos.candidates.some(c => c.memberId === member.id)) {
                alert('Mwanachama huyu tayari yumo kwenye nafasi hii!');
                return pos;
              }
              return {
                ...pos,
                candidates: [...pos.candidates, newCandidate]
              };
            }
            return pos;
          })
        };
      }
      return elec;
    });

    await onSaveState({
      ...state,
      elections: updatedElections
    });

    setCandMemberId('');
    setCandSlogan('');
    setShowAddCandidateModal(null);
  };

  // Remove Candidate
  const handleRemoveCandidate = async (posId: string, candidateId: string) => {
    if (readOnly || !activeElection) return;
    if (!confirm('Ondoa mgombea huyu kwenye nafasi hii?')) return;

    const updatedElections = elections.map(elec => {
      if (elec.id === activeElection.id) {
        return {
          ...elec,
          positions: elec.positions.map(pos => {
            if (pos.id === posId) {
              return {
                ...pos,
                candidates: pos.candidates.filter(c => c.id !== candidateId)
              };
            }
            return pos;
          })
        };
      }
      return elec;
    });

    await onSaveState({
      ...state,
      elections: updatedElections
    });
  };

  // Send SMS Links to voters
  const handleDispatchSmsLinks = async () => {
    if (readOnly || !activeElection || isSendingSms) return;
    setIsSendingSms(true);
    setSmsResultMsg(null);

    try {
      const voters = activeElection.voters || [];
      let targetTokens: string[] = [];

      if (smsTargetGroup === 'unvoted_only') {
        targetTokens = voters.filter(v => v.isEligible && !v.hasVoted).map(v => v.voterToken);
      } else {
        targetTokens = voters.filter(v => v.isEligible).map(v => v.voterToken);
      }

      const res = await fetch('/api/uwalemi/election/send-voter-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          electionId: activeElection.id,
          voterTokens: targetTokens,
          customMessageTemplate: smsCustomMsg,
          originUrl: window.location.origin
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSmsResultMsg({
          type: 'success',
          text: data.message || `SMS ${data.sentCount} zimetumwa kwa mafanikio!`
        });
        // Refresh election state locally
        const refreshed = elections.map(elec => {
          if (elec.id === activeElection.id) {
            const nowStr = new Date().toISOString();
            return {
              ...elec,
              voters: elec.voters.map(v => targetTokens.includes(v.voterToken) ? { ...v, smsSentAt: nowStr } : v)
            };
          }
          return elec;
        });
        onSaveState({ ...state, elections: refreshed });
      } else {
        setSmsResultMsg({
          type: 'error',
          text: data.error || 'Imeshindwa kutuma SMS za viungo vya kura.'
        });
      }
    } catch (err: any) {
      setSmsResultMsg({
        type: 'error',
        text: 'Hitilafu ya mtandao wakati wa kutuma SMS.'
      });
    } finally {
      setIsSendingSms(false);
    }
  };

  // Copy voter link
  const handleCopyVoterLink = (token: string) => {
    const origin = window.location.origin;
    const link = `${origin}/?uwalemiVote=${token}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 3000);
    }
  };

  // Send SMS to a single voter
  const handleSendIndividualSms = async (voter: UwalemiVoterRecord) => {
    if (readOnly || !activeElection || sendingIndividualSmsToken) return;
    if (!voter.isEligible) {
      alert('Mwanachama huyu hana sifa za kupiga kura kulingana na vigezo vilivyowekwa.');
      return;
    }

    setSendingIndividualSmsToken(voter.voterToken);

    try {
      const res = await fetch('/api/uwalemi/election/send-voter-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          electionId: activeElection.id,
          voterTokens: [voter.voterToken],
          customMessageTemplate: smsCustomMsg,
          originUrl: window.location.origin
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Refresh election state locally
        const refreshed = elections.map(elec => {
          if (elec.id === activeElection.id) {
            const nowStr = new Date().toISOString();
            return {
              ...elec,
              voters: elec.voters.map(v => v.voterToken === voter.voterToken ? { ...v, smsSentAt: nowStr } : v)
            };
          }
          return elec;
        });
        await onSaveState({ ...state, elections: refreshed });
      } else {
        alert(data.error || 'Imeshindwa kutuma SMS kwa mjumbe huyu.');
      }
    } catch (err: any) {
      alert('Hitilafu ya mtandao wakati wa kutuma SMS.');
    } finally {
      setSendingIndividualSmsToken(null);
    }
  };

  const checkCanExportResults = (): boolean => {
    if (!activeElection) return false;
    if (!isElectionEnded) {
      setShowReportLockedModal(true);
      return false;
    }
    return true;
  };

  const handleCompleteElectionWithConfirmation = () => {
    if (!activeElection) return;
    setShowCompleteConfirmModal(true);
  };

  const handleConfirmCompleteElection = async () => {
    if (readOnly || !activeElection) return;
    await handleUpdateElectionStatus('completed');
    setShowCompleteConfirmModal(false);
    setShowReportLockedModal(false);
  };

  // Print/Export Official Results Report with Logo & Watermark
  const handlePrintResults = async () => {
    if (!checkCanExportResults()) return;
    await handlePreviewPDFResults();
  };

  // Download PDF Results
  const handleDownloadPDFResults = async () => {
    if (!checkCanExportResults()) return;
    if (!activeElection || !tallyData) {
      alert("Hakuna matokeo ya kupakua kwa sasa.");
      return;
    }
    setIsExportingPdf(true);
    try {
      const logoB64 = await loadUwalemiLogoAsBase64(state.groupSettings?.logoUrl);
      const doc = generateElectionResultsPDF(state, activeElection.id, logoB64);
      const safeTitle = (activeElection.title || 'Matokeo_ya_Uchaguzi').replace(/\s+/g, '_');
      const fileName = `UWALEMI_${safeTitle}_${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadPdfDocument(doc, fileName);
    } catch (err: any) {
      console.error(err);
      alert('Hitilafu katika kutengeneza PDF ya matokeo: ' + (err?.message || ''));
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Interactive PDF Preview Modal
  const handlePreviewPDFResults = async () => {
    if (!checkCanExportResults()) return;
    if (!activeElection || !tallyData) {
      alert("Hakuna matokeo ya kupakua kwa sasa.");
      return;
    }
    try {
      const logoB64 = await loadUwalemiLogoAsBase64(state.groupSettings?.logoUrl);
      const doc = generateElectionResultsPDF(state, activeElection.id, logoB64);
      const safeTitle = (activeElection.title || 'Matokeo_ya_Uchaguzi').replace(/\s+/g, '_');
      const fileName = `UWALEMI_${safeTitle}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const blobUrl = getPdfBlobUrl(doc);
      setPreviewPdfModal({
        isOpen: true,
        url: blobUrl,
        title: `Taarifa Rasmi ya Matokeo: ${activeElection.title || 'Uchaguzi'}`,
        fileName
      });
    } catch (err: any) {
      console.error(err);
      alert('Hitilafu katika kufungua muonekano wa PDF: ' + (err?.message || ''));
    }
  };

  // Filtered voters
  const filteredVoters = useMemo(() => {
    if (!activeElection) return [];
    let list = activeElection.voters || [];

    if (voterStatusFilter === 'voted') {
      list = list.filter(v => v.hasVoted);
    } else if (voterStatusFilter === 'not_voted') {
      list = list.filter(v => v.isEligible && !v.hasVoted);
    } else if (voterStatusFilter === 'ineligible') {
      list = list.filter(v => !v.isEligible);
    }

    if (voterSearch.trim()) {
      const q = voterSearch.toLowerCase().trim();
      list = list.filter(v => 
        (v.fullName || '').toLowerCase().includes(q) ||
        (v.memberNo || '').toLowerCase().includes(q) ||
        (v.phone || '').includes(q)
      );
    }

    return list;
  }, [activeElection, voterStatusFilter, voterSearch]);

  return (
    <div className="space-y-6">
      {/* Header Banner & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-950/50 flex items-center justify-center flex-shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Vote className="w-6 h-6 text-emerald-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-white tracking-tight">
                  Uchaguzi wa Kidijitali (E-Voting)
                </h2>
                {activeElection && (
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                    activeElection.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse'
                      : activeElection.status === 'completed'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        : activeElection.status === 'paused'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {activeElection.status === 'active' ? '● LIVE (Kura Zinaendelea)' :
                     activeElection.status === 'completed' ? '✓ Umekamilika' :
                     activeElection.status === 'paused' ? '⏸ Umesitishwa' : 'Matayarisho (Draft)'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Uchaguzi salama wa siri (100% Secret Ballot) kwa wanachama walio mbali na karibu kupitia viungo vya kipekee vya SMS.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {elections.length > 1 && (
              <select
                value={selectedElectionId}
                onChange={(e) => setSelectedElectionId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none focus:border-emerald-500"
              >
                {elections.map(elec => (
                  <option key={elec.id} value={elec.id}>
                    {elec.title} ({elec.termYears || 'Uchaguzi'})
                  </option>
                ))}
              </select>
            )}

            {!readOnly ? (
              <>
                <button
                  onClick={() => setShowNewElectionModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  Uchaguzi Mpya
                </button>

                {activeElection && (
                  <button
                    onClick={() => setShowSendSmsModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-950/40"
                  >
                    <Send className="w-4 h-4" />
                    Tuma Viungo kwa SMS
                  </button>
                )}
              </>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <span>👁️ Hali ya Kutazama Tu</span>
              </div>
            )}
          </div>
        </div>

        {/* Election Status Controller Bar */}
        {activeElection && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>
                Kuanzia: <strong>{activeElection.startDate ? new Date(activeElection.startDate).toLocaleDateString('sw-TZ') : 'Leo'}</strong>
              </span>
              <span>•</span>
              <span>
                Hadi: <strong>{activeElection.endDate ? new Date(activeElection.endDate).toLocaleDateString('sw-TZ') : 'Kufungwa'}</strong>
              </span>
            </div>

            {!readOnly && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Badili Hali:</span>
                <button
                  onClick={() => handleUpdateElectionStatus('active')}
                  disabled={activeElection.status === 'active'}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeElection.status === 'active' 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Fungua (Live)
                </button>
                <button
                  onClick={() => handleUpdateElectionStatus('paused')}
                  disabled={activeElection.status === 'paused'}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeElection.status === 'paused' 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Sitisha
                </button>
                <button
                  onClick={handleCompleteElectionWithConfirmation}
                  disabled={activeElection.status === 'completed'}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeElection.status === 'completed' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Kamilisha
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* If No Elections Exist */}
      {(!activeElection || elections.length === 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <Vote className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Bado Hakuna Uchaguzi Ulioandaliwa</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            Anzisha uchaguzi wa viongozi wa UWALEMI kwa kubofya kitufe hapa chini. Mfumo utaweka nafasi zote kuu za kikatiba na kuandaa daftari la wapiga kura kiotomatiki.
          </p>
          {!readOnly && (
            <button
              onClick={() => setShowNewElectionModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-950/50"
            >
              <Plus className="w-4 h-4" />
              Anzisha Uchaguzi wa UWALEMI Sasa
            </button>
          )}
        </div>
      )}

      {/* Active Election Sub-Tabs */}
      {activeElection && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto no-scrollbar text-xs">
            <button
              onClick={() => setSubTab('tally')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                subTab === 'tally'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Matokeo ya Moja kwa Moja & Takwimu</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-700 text-white">
                {tallyData?.totalBallotsCast || 0}
              </span>
            </button>

            <button
              onClick={() => setSubTab('voters')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                subTab === 'voters'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Daftari la Wapiga Kura & Viungo</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {activeElection.voters?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setSubTab('positions')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                subTab === 'positions'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Nafasi & Wagombea</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {activeElection.positions?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setSubTab('audit')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                subTab === 'audit'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Ukaguzi wa Usalama (Audit Log)</span>
            </button>
          </div>

          {/* SUB-TAB 1: LIVE TALLY & RESULTS */}
          {subTab === 'tally' && (
            <div className="space-y-6">
              {/* Official Letterhead Banner with Emblem Logo */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center relative overflow-hidden backdrop-blur-md">
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full p-0.5 bg-gradient-to-tr from-emerald-500 via-blue-500 to-teal-400 shadow-xl shadow-emerald-950/60 mb-2.5 flex items-center justify-center">
                  <img 
                    src={state.groupSettings?.logoUrl || '/uwalemi_logo.png'} 
                    alt="UWALEMI Emblem" 
                    className="w-full h-full object-cover rounded-full bg-slate-950 border border-slate-900"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
                  {state.groupSettings?.groupName || 'UWALEMI'}
                </h3>
                <p className="text-xs text-slate-400 italic">
                  "{state.groupSettings?.slogan && !state.groupSettings.slogan.includes('Shida na Raha') ? state.groupSettings.slogan : 'Lema, Nguvu Moja.'}"
                </p>

                <div className="mt-3 inline-block bg-slate-800/90 px-4 py-1.5 rounded-full border border-slate-700">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                    TAARIFA RASMI YA MATOKEO YA UCHAGUZI WA VIONGOZI
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Uchaguzi: <strong className="text-slate-200">{activeElection.title}</strong> • Kipindi cha Uongozi: <strong className="text-slate-200">{activeElection.termYears || '-'}</strong>
                </p>
              </div>

              {/* Live Monitoring Notification Banner while Voting is Ongoing */}
              {!isElectionEnded && (
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="relative mt-1">
                      <span className="flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-white">
                          Zoezi la Upigaji Kura Linaendelea (Live Monitoring)
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40 uppercase tracking-wider font-bold">
                          Moja kwa Moja
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
                        Takwimu za ushiriki wa wanachama na idadi ya kura zinasasishwa kwa wakati halisi. Kulingana na kanuni za uchaguzi, 
                        <strong> Ripoti Rasmi ya Matokeo (PDF)</strong> itazalishwa tu baada ya muda uliopangwa kufika mwisho au baada ya kamati kuthibitisha na kukamilisha uchaguzi.
                      </p>
                    </div>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={handleCompleteElectionWithConfirmation}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-2 shrink-0 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Kamilisha Uchaguzi Sasa
                    </button>
                  )}
                </div>
              )}

              {/* Turnout Stats 4-Card Grid with Real Members and Accurate Tally */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    Jumla ya Wanachama Wote
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-white mt-1.5">
                    {totalGroupMembers}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Wanachama wote waliosajiliwa</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Wapiga Kura Wenye Sifa
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-white mt-1.5">
                    {tallyData?.totalEligibleVoters || 0}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Wenye vigezo vya kikatiba</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Vote className="w-3.5 h-3.5 text-emerald-400" />
                    Kura Zilizopigwa
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1.5">
                    {tallyData?.totalBallotsCast || 0}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Kura zilizorekodiwa kwa siri 100%</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                    Asilimia ya Ushiriki
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-teal-400 mt-1.5">
                    {tallyData?.turnoutPercentage || 0}%
                  </p>
                  {/* Progress bar */}
                  <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
                      style={{ width: `${Math.min(100, tallyData?.turnoutPercentage || 0)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Print / Export Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Matokeo ya Kila Nafasi ya Uongozi</span>
                    {!isElectionEnded && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-600/30">
                        Zoezi Linaendelea
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isElectionEnded
                      ? 'Uchaguzi umekamilika rasmi. Unaweza kupakua na kuchapisha ripoti rasmi yenye nembo.'
                      : 'Kura zote zinasasishwa kwa wakati halisi wanachama wanapopiga kura zao.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {isElectionEnded ? (
                    <>
                      <button
                        onClick={handlePreviewPDFResults}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                        title="Kihakiki Ripoti ya PDF yenye Nembo"
                      >
                        <Eye className="w-3.5 h-3.5 text-teal-400" />
                        Kihakiki PDF
                      </button>

                      <button
                        onClick={handleDownloadPDFResults}
                        disabled={isExportingPdf}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold border border-emerald-600 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isExportingPdf ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5 text-white" />
                        )}
                        Pakua PDF ya Matokeo
                      </button>

                      <button
                        onClick={handlePrintResults}
                        disabled={isPrintingReport}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                      >
                        {isPrintingReport ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        ) : (
                          <Printer className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        Chapisha Ripoti Rasmi
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowReportLockedModal(true)}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer group"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                        <span>Ripoti Rasmi ya PDF Imefungwa</span>
                        <span className="text-[10px] text-amber-400 font-mono underline ml-1">Kwanini?</span>
                      </button>
                      {!readOnly && (
                        <button
                          onClick={handleCompleteElectionWithConfirmation}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition-all cursor-pointer shadow-md shadow-emerald-950/40"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          Kamilisha Uchaguzi
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Position Tally Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tallyData?.positionsTally.map(pos => {
                  return (
                    <div key={pos.positionId} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                          <div>
                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                              <span>{pos.positionTitle}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                                Nafasi: {pos.maxWinners}
                              </span>
                            </h4>
                          </div>
                          <span className="text-xs text-slate-400 font-medium">
                            Jumla: <strong>{pos.totalVotesForPosition}</strong> Kura
                          </span>
                        </div>

                        {/* Candidates Breakdown */}
                        <div className="space-y-3">
                          {pos.results.length === 0 ? (
                            <p className="text-xs text-slate-500 italic py-2">Hakuna wagombea walioteuliwa bado.</p>
                          ) : (
                            pos.results.map(cand => {
                              return (
                                <div key={cand.candidateId} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 relative overflow-hidden">
                                  {/* Winner or Tie Banner */}
                                  {cand.isWinner && (
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                                      <Award className="w-3 h-3" /> Mshindi / Anaongoza
                                    </div>
                                  )}
                                  {cand.isTie && (
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">
                                      <AlertTriangle className="w-3 h-3" /> Sare ya Kura
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between text-xs mb-1.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-[11px]">
                                        {cand.candidateName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                      </div>
                                      <div>
                                        <span className="font-bold text-slate-200">{cand.candidateName}</span>
                                        <span className="text-[10px] text-emerald-400 font-mono ml-1.5">{cand.candidateNo}</span>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-bold text-white text-sm">{cand.votesCount}</span>
                                      <span className="text-slate-400 ml-1 text-xs">({cand.percentage}%)</span>
                                    </div>
                                  </div>

                                  {/* Progress bar */}
                                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        cand.isWinner 
                                          ? 'bg-emerald-400' 
                                          : cand.isTie 
                                            ? 'bg-amber-400' 
                                            : 'bg-slate-600'
                                      }`}
                                      style={{ width: `${Math.min(100, cand.percentage)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SUB-TAB 2: VOTER ROLL & LINKS */}
          {subTab === 'voters' && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={voterSearch}
                    onChange={(e) => setVoterSearch(e.target.value)}
                    placeholder="Tafuta jina, namba (UWL-...), simu..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setVoterStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      voterStatusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Wote ({activeElection.voters?.length || 0})
                  </button>
                  <button
                    onClick={() => setVoterStatusFilter('voted')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      voterStatusFilter === 'voted' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Walio Kura ({activeElection.voters?.filter(v => v.hasVoted).length || 0})
                  </button>
                  <button
                    onClick={() => setVoterStatusFilter('not_voted')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      voterStatusFilter === 'not_voted' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Bado ({activeElection.voters?.filter(v => v.isEligible && !v.hasVoted).length || 0})
                  </button>
                  <button
                    onClick={() => setVoterStatusFilter('ineligible')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      voterStatusFilter === 'ineligible' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Wasio na Sifa ({activeElection.voters?.filter(v => !v.isEligible).length || 0})
                  </button>

                  {!readOnly && (
                    <button
                      onClick={handleRecomputeVoters}
                      title="Sasisha vigezo vya wapiga kura kutoka kwenye ada na wanachama"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all cursor-pointer ml-auto"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Voter Roll Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Namba</th>
                        <th className="py-3 px-4">Mwanachama</th>
                        <th className="py-3 px-4">Simu</th>
                        <th className="py-3 px-4">Sifa ya Kura</th>
                        <th className="py-3 px-4">Hali ya Kura</th>
                        <th className="py-3 px-4">Stakabadhi</th>
                        <th className="py-3 px-4 text-right">Hatua & Kiungo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredVoters.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-500 italic">
                            Hakuna mpiga kura anayelingana na utafutaji wako.
                          </td>
                        </tr>
                      ) : (
                        filteredVoters.map(voter => {
                          return (
                            <tr key={voter.voterToken} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                                {voter.memberNo}
                              </td>
                              <td className="py-3 px-4 font-bold text-white">
                                {voter.fullName}
                              </td>
                              <td className="py-3 px-4 text-slate-300 font-mono">
                                {voter.phone}
                              </td>
                              <td className="py-3 px-4">
                                {voter.isEligible ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Ana Sifa
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400" title={voter.ineligibilityReason}>
                                    <AlertTriangle className="w-3.5 h-3.5" /> Hana Sifa
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-col gap-1">
                                  {voter.hasVoted ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold w-fit">
                                      ✓ Amepiga Kura
                                    </span>
                                  ) : voter.isEligible ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold w-fit">
                                      Bado
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500 italic">-</span>
                                  )}
                                  
                                  {voter.smsSentAt && (
                                    <span className="text-[9px] text-slate-400 font-medium inline-flex items-center gap-1" title={`SMS ilitumwa tarehe ${new Date(voter.smsSentAt).toLocaleString('sw-TZ')}`}>
                                      <Send className="w-2.5 h-2.5 text-emerald-400" />
                                      SMS: {new Date(voter.smsSentAt).toLocaleTimeString('sw-TZ', {hour: '2-digit', minute: '2-digit'})}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                                {voter.receiptCode || '-'}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-1.5 justify-end">
                                  {!readOnly && (
                                    <button
                                      onClick={() => handleSendIndividualSms(voter)}
                                      disabled={!voter.isEligible || sendingIndividualSmsToken === voter.voterToken}
                                      title="Tuma kiungo cha kura kwa mwanachama huyu kwa SMS"
                                      className={`p-1.5 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer ${
                                        sendingIndividualSmsToken === voter.voterToken
                                          ? 'bg-slate-800 animate-pulse'
                                          : voter.smsSentAt
                                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-slate-800 hover:bg-slate-700'
                                      }`}
                                    >
                                      {sendingIndividualSmsToken === voter.voterToken ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                      ) : (
                                        <Send className="w-3.5 h-3.5 text-slate-300 hover:text-emerald-400" />
                                      )}
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleCopyVoterLink(voter.voterToken)}
                                    title="Nakili kiungo cha kura kwa ajili ya kutuma WhatsApp/SMS"
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                                  >
                                    {copiedToken === voter.voterToken ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  {onOpenVotingPage && (
                                    <button
                                      onClick={() => onOpenVotingPage(voter.voterToken)}
                                      title="Fungua fomu ya kura ya mpiga kura huyu"
                                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 transition-all cursor-pointer"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 3: POSITIONS & CANDIDATES */}
          {subTab === 'positions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Nafasi za Uongozi na Wagombea</h3>
                  <p className="text-xs text-slate-400">Weka wagombea wanaowania kila nafasi ya uongozi wa UWALEMI.</p>
                </div>

                {!readOnly && (
                  <button
                    onClick={() => setShowNewPositionModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-emerald-400" />
                    Ongeza Nafasi Mpya
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {activeElection.positions.map((pos, idx) => {
                  return (
                    <div key={pos.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 mb-4">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-slate-800 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="text-base font-bold text-white flex items-center gap-2">
                              <span>{pos.title}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                                Washindi: {pos.maxWinners}
                              </span>
                            </h4>
                            {pos.description && (
                              <p className="text-xs text-slate-400">{pos.description}</p>
                            )}
                          </div>
                        </div>

                        {!readOnly && (
                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <button
                              onClick={() => setShowAddCandidateModal(pos.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Weka Mgombea
                            </button>
                            <button
                              onClick={() => handleDeletePosition(pos.id)}
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                              title="Futa nafasi hii"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Candidates List in this position */}
                      {pos.candidates.length === 0 ? (
                        <div className="p-4 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-center text-xs text-slate-500 italic">
                          Hakuna wagombea waliowekwa bado kwenye nafasi hii.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {pos.candidates.map(cand => {
                            return (
                              <div key={cand.id} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-xs flex-shrink-0 overflow-hidden">
                                    {cand.avatarUrl ? (
                                      <img src={cand.avatarUrl} alt={cand.fullName} className="w-full h-full object-cover" />
                                    ) : (
                                      cand.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{cand.fullName}</p>
                                    <p className="text-[10px] text-emerald-400 font-mono">{cand.memberNo}</p>
                                    {cand.slogan && (
                                      <p className="text-[10px] text-slate-400 italic line-clamp-1 mt-0.5">"{cand.slogan}"</p>
                                    )}
                                  </div>
                                </div>

                                {!readOnly && (
                                  <button
                                    onClick={() => handleRemoveCandidate(pos.id, cand.id)}
                                    className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                                    title="Ondoa mgombea"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SUB-TAB 4: AUDIT LOG */}
          {subTab === 'audit' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Daftari la Ukaguzi wa Usalama (Ballot Audit Log)</h3>
                    <p className="text-xs text-slate-400">
                      Kila kura iliyopigwa inarekodiwa na muhuri wa wakati (Timestamp) na Stakabadhi ya Siri (Receipt Code).
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 mb-4 leading-relaxed">
                  <strong className="text-slate-200">Uthibitisho wa Uadilifu:</strong> Jumla ya kura zilizorekodiwa ({activeElection.ballots?.length || 0}) inalingana sawasawa na idadi ya wanachama waliopiga kura ({activeElection.voters?.filter(v => v.hasVoted).length || 0}), bila kuweka utambulisho wa nani amempigia nani.
                </div>

                {activeElection.ballots?.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-500 italic">Bado hakuna kura iliyorekodiwa.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Namba ya Stakabadhi</th>
                          <th className="py-2.5 px-3">Tarehe na Saa</th>
                          <th className="py-2.5 px-3">Nafasi Zilizopigiwa Kura</th>
                          <th className="py-2.5 px-3 text-right">Hali ya Usalama</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50 font-mono">
                        {activeElection.ballots?.slice().reverse().map((b, i) => (
                          <tr key={b.id} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-3 text-slate-500">#{activeElection.ballots.length - i}</td>
                            <td className="py-2.5 px-3 text-emerald-400 font-bold">{b.receiptCode}</td>
                            <td className="py-2.5 px-3 text-slate-300 font-sans">
                              {new Date(b.timestamp).toLocaleString('sw-TZ', { dateStyle: 'short', timeStyle: 'medium' })}
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-400">
                              {Object.keys(b.votes || {}).length} Nafasi
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-400 font-sans text-[11px]">
                              ✓ Siri 100%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: CREATE NEW ELECTION */}
      {showNewElectionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Vote className="w-4 h-4 text-emerald-400" />
                Sanidi Uchaguzi Mpya wa UWALEMI
              </h3>
              <button
                onClick={() => setShowNewElectionModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateElection} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Jina la Uchaguzi:</label>
                <input
                  type="text"
                  required
                  value={newElectionTitle}
                  onChange={(e) => setNewElectionTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Kipindi cha Uongozi (Muhula):</label>
                <input
                  type="text"
                  value={newElectionTerm}
                  onChange={(e) => setNewElectionTerm(e.target.value)}
                  placeholder="mfano: 2026 - 2028"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tarehe ya Kuanza:</label>
                  <input
                    type="datetime-local"
                    required
                    value={newElectionStartDate}
                    onChange={(e) => setNewElectionStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tarehe ya Kufunga:</label>
                  <input
                    type="datetime-local"
                    required
                    value={newElectionEndDate}
                    onChange={(e) => setNewElectionEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Eligibility rules */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <p className="font-bold text-slate-300">Vigezo vya Wapiga Kura:</p>
                <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200">
                  <input
                    type="checkbox"
                    checked={requireActiveOnly}
                    onChange={(e) => setRequireActiveOnly(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Ruhusu wanachama walio Hai tu (Active members only)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200">
                  <input
                    type="checkbox"
                    checked={requireRegFeePaid}
                    onChange={(e) => setRequireRegFeePaid(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Lazima awe amekamilisha ada ya kiingilio</span>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewElectionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  Unda Uchaguzi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD POSITION */}
      {showNewPositionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white">Ongeza Nafasi ya Uongozi</h3>
              <button
                onClick={() => setShowNewPositionModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPosition} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Jina la Nafasi:</label>
                <input
                  type="text"
                  required
                  placeholder="mfano: Mjumbe wa Kamati ya Nidhamu"
                  value={newPosTitle}
                  onChange={(e) => setNewPosTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Maelezo Fupi ya Nafasi (Si Lazima):</label>
                <input
                  type="text"
                  placeholder="Majukumu au vigezo..."
                  value={newPosDesc}
                  onChange={(e) => setNewPosDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Idadi ya Washindi / Wanaochaguliwa:</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={newPosMaxWinners}
                  onChange={(e) => setNewPosMaxWinners(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPositionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  Hifadhi Nafasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CANDIDATE */}
      {showAddCandidateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white">Teua Mgombea</h3>
              <button
                onClick={() => setShowAddCandidateModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCandidate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Chagua Mwanachama:</label>
                <select
                  required
                  value={candMemberId}
                  onChange={(e) => setCandMemberId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Chagua Mwanachama wa UWALEMI --</option>
                  {state.members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.memberNo} - {m.fullName} ({m.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Kauli Mbiu / Sera Fupi (Slogan/Manifesto):</label>
                <textarea
                  rows={2}
                  placeholder="mfano: Umoja na Uwazi katika Hazina ya UWALEMI..."
                  value={candSlogan}
                  onChange={(e) => setCandSlogan(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCandidateModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  disabled={!candMemberId}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold cursor-pointer"
                >
                  Weka Mgombea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SEND SMS VOTING LINKS */}
      {showSendSmsModal && activeElection && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Tuma Viungo vya Kura kwa SMS</h3>
              </div>
              <button
                onClick={() => {
                  setShowSendSmsModal(false);
                  setSmsResultMsg(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {smsResultMsg && (
              <div className={`p-3 rounded-xl mb-4 text-xs font-medium flex items-center gap-2 ${
                smsResultMsg.type === 'success' 
                  ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300' 
                  : 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
              }`}>
                {smsResultMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span>{smsResultMsg.text}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Walengwa wa SMS:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSmsTargetGroup('all_eligible')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      smsTargetGroup === 'all_eligible'
                        ? 'bg-emerald-950/40 border-emerald-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <p className="text-xs">Wanachama Wote Wenye Sifa</p>
                    <p className="text-[10px] text-emerald-400 mt-0.5">
                      ({activeElection.voters?.filter(v => v.isEligible).length || 0} Wapiga Kura)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSmsTargetGroup('unvoted_only')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      smsTargetGroup === 'unvoted_only'
                        ? 'bg-emerald-950/40 border-emerald-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <p className="text-xs">Wale Ambao Hawajapiga Bado</p>
                    <p className="text-[10px] text-amber-400 mt-0.5">
                      ({activeElection.voters?.filter(v => v.isEligible && !v.hasVoted).length || 0} Wapiga Kura)
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Ujumbe wa SMS:</label>
                <textarea
                  rows={4}
                  value={smsCustomMsg}
                  onChange={(e) => setSmsCustomMsg(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
                <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[10px] text-slate-500">
                  <span>Vigezo vinavyojazwa:</span>
                  <code className="bg-slate-800 text-emerald-400 px-1 rounded">{'{name}'}</code>
                  <code className="bg-slate-800 text-emerald-400 px-1 rounded">{'{link}'}</code>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  Kila mwanachama atapokea kiungo chake cha kipekee (Unique Secret Link). Akibonyeza kiungo hicho kwenye simu yake, atafungua fomu ya kura mara moja bila kuhitaji nenosiri lingine.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSendSmsModal(false)}
                  disabled={isSendingSms}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Funga
                </button>
                <button
                  type="button"
                  onClick={handleDispatchSmsLinks}
                  disabled={isSendingSms}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer flex items-center gap-2"
                >
                  {isSendingSms ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Inatuma SMS...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Tuma SMS Sasa
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Interactive Preview Modal with Logo & Letterhead */}
      {previewPdfModal && previewPdfModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{previewPdfModal.title}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">{previewPdfModal.fileName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = previewPdfModal.url;
                    link.download = previewPdfModal.fileName;
                    link.click();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-950/40"
                >
                  <Download className="w-3.5 h-3.5" />
                  Pakua PDF
                </button>
                <button
                  onClick={() => {
                    const win = window.open(previewPdfModal.url, '_blank');
                    if (win) win.print();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  Chapa
                </button>
                <button
                  onClick={() => setPreviewPdfModal(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-950 p-2 overflow-hidden">
              <iframe
                src={previewPdfModal.url}
                className="w-full h-full rounded-xl border border-slate-800 bg-white"
                title="Interactive Election Results PDF Viewer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Complete Election Confirmation Modal ("Nina uhakika?") */}
      {showCompleteConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Je, una uhakika unataka kukamilisha uchaguzi?
                </h3>
                <p className="text-xs text-slate-400">
                  Uchaguzi: <strong className="text-slate-200">{activeElection?.title}</strong>
                </p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-4 space-y-2">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Hali ya Kura Hadi Sasa:
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">Wanachama Wote</span>
                  <span className="text-white font-bold text-sm">{totalGroupMembers}</span>
                </div>
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">Wapiga Kura Wenye Sifa</span>
                  <span className="text-white font-bold text-sm">{tallyData?.totalEligibleVoters || 0}</span>
                </div>
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">Kura Zilizopigwa</span>
                  <span className="text-emerald-400 font-bold text-sm">{tallyData?.totalBallotsCast || 0}</span>
                </div>
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">Asilimia ya Ushiriki</span>
                  <span className="text-teal-400 font-bold text-sm">{tallyData?.turnoutPercentage || 0}%</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-950/30 border border-amber-600/30 rounded-xl p-3.5 mb-6 text-xs text-amber-200/90 leading-relaxed">
              <strong>Zingatia:</strong> Ukithibitisha kukamilisha zoezi hili:
              <ul className="list-disc list-inside mt-1.5 space-y-1 text-slate-300">
                <li>Hakuna mwanachama mwingine atakayeweza kupiga kura baada ya hapa.</li>
                <li>Matokeo ya washindi yatathibitishwa rasmi.</li>
                <li><strong>Ripoti Rasmi ya Matokeo (PDF yenye Nembo)</strong> itafunguliwa na kupakuliwa.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCompleteConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Ghairi
              </button>
              <button
                type="button"
                onClick={handleConfirmCompleteElection}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Ndio, Nina Uhakika - Kamilisha Uchaguzi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Locked Informational Modal */}
      {showReportLockedModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Ripoti Rasmi Haijazalishwa Bado
                </h3>
                <p className="text-xs text-slate-400">
                  Zoezi la upigaji kura bado linaendelea
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-3 leading-relaxed mb-6">
              <p>
                Ripoti rasmi ya matokeo ya uchaguzi haiwezi kuzalishwa au kupakuliwa huku zoezi la upigaji kura likiwa linaendelea.
              </p>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-[11px]">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Jumla ya Wanachama:</span>
                  <span className="font-bold text-white">{totalGroupMembers}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Wapiga Kura Wenye Sifa:</span>
                  <span className="font-bold text-white">{tallyData?.totalEligibleVoters || 0}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Kura Zilizopigwa Hadi Sasa:</span>
                  <span className="font-bold text-emerald-400">{tallyData?.totalBallotsCast || 0}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Asilimia ya Ushiriki:</span>
                  <span className="font-bold text-teal-400">{tallyData?.turnoutPercentage || 0}%</span>
                </div>
              </div>
              <p className="text-slate-400 text-[11px]">
                Ripoti rasmi itazalishwa na kufunguliwa mara tu muda uliopangwa ukifika au baada ya kamati kuthibitisha na kukamilisha uchaguzi.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowReportLockedModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Sawa, Nimeelewa
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setShowReportLockedModal(false);
                    handleCompleteElectionWithConfirmation();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Kamilisha Uchaguzi Sasa
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
