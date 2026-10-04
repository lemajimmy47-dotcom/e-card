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
  Info
} from 'lucide-react';

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

  // Add candidate form
  const [candMemberId, setCandMemberId] = useState<string>('');
  const [candSlogan, setCandSlogan] = useState<string>('');

  // Custom SMS template
  const [smsTargetGroup, setSmsTargetGroup] = useState<'all_eligible' | 'unvoted_only'>('all_eligible');
  const [smsCustomMsg, setSmsCustomMsg] = useState<string>(
    `Habari {name} ({memberNo}), uchaguzi wa viongozi wa UWALEMI unaendelea. Bofya kiungo hiki cha siri kupiga kura yako: {link} . Tafadhali usimtumie mtu mwingine kiungo hiki.`
  );

  // Clipboard feedback
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Calculate live tally
  const tallyData = useMemo(() => {
    if (!activeElection) return null;
    return calculateElectionTally(activeElection);
  }, [activeElection]);

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
      },
      {
        id: `pos-${Date.now()}-7`,
        title: 'Wajumbe wa Kamati Kuu',
        description: 'Wawakilishi wa Wanachama kwenye Kamati ya Uendeshaji',
        maxWinners: 3,
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

  // Print/Export Results Report
  const handlePrintResults = () => {
    if (!activeElection || !tallyData) {
      alert("Hakuna matokeo ya kupakua kwa sasa.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Tafadhali ruhusu Popups (pop-up blocker) kwenye kivinjari chako ili kupakua ripoti.");
      return;
    }

    const groupName = state.groupSettings?.groupName || "UWALEMI";
    const slogan = state.groupSettings?.slogan || "Lema, Nguvu Moja.";
    const title = activeElection.title || "Uchaguzi wa Viongozi";
    const term = activeElection.termYears ? `${activeElection.termYears} (Miaka ${activeElection.termYears})` : "-";
    const dateStr = new Date().toLocaleDateString('sw-TZ', { dateStyle: 'long' });
    const timeStr = new Date().toLocaleTimeString('sw-TZ', { timeStyle: 'short' });

    let positionsHtml = '';
    tallyData.positionsTally.forEach((pos: any) => {
      let candidatesHtml = '';
      pos.results.forEach((cand: any, idx: number) => {
        candidatesHtml += `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; font-weight: bold;">${idx + 1}</td>
            <td style="padding: 10px;">${cand.candidateName} <span style="color: #64748b; font-family: monospace;">(${cand.candidateNo})</span></td>
            <td style="padding: 10px; text-align: center; font-weight: bold; font-family: monospace;">${cand.votesCount}</td>
            <td style="padding: 10px; text-align: right; font-weight: bold; font-family: monospace; color: #0f766e;">${cand.percentage}%</td>
            <td style="padding: 10px; text-align: center;">
              ${cand.isWinner ? '<span style="background-color: #d1fae5; color: #065f46; padding: 3px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold; display: inline-block;">Mshindi ✓</span>' : cand.isTie ? '<span style="background-color: #fef3c7; color: #92400e; padding: 3px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold; display: inline-block;">Sare ⚠</span>' : '-'}
            </td>
          </tr>
        `;
      });

      positionsHtml += `
        <div style="margin-top: 25px; page-break-inside: avoid;">
          <h3 style="background-color: #f1f5f9; padding: 10px 14px; margin-bottom: 10px; border-left: 4px solid #0f766e; color: #1e293b; font-size: 15px; font-weight: bold;">
            ${pos.positionTitle} (Wanaohitajika: ${pos.maxWinners})
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; color: #475569; font-weight: bold;">
                <th style="padding: 10px; text-align: left; width: 50px;">Namba</th>
                <th style="padding: 10px; text-align: left;">Mgombea</th>
                <th style="padding: 10px; text-align: center; width: 100px;">Jumla ya Kura</th>
                <th style="padding: 10px; text-align: right; width: 100px;">Asilimia (%)</th>
                <th style="padding: 10px; text-align: center; width: 120px;">Matokeo / Hali</th>
              </tr>
            </thead>
            <tbody>
              ${candidatesHtml}
            </tbody>
          </table>
        </div>
      `;
    });

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ripoti ya Matokeo ya Uchaguzi - ${groupName}</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #334155;
            line-height: 1.5;
            padding: 30px;
            background-color: #f8fafc;
          }
          .report-container {
            border: 2px solid #0f766e;
            padding: 40px;
            border-radius: 4px;
            background-color: white;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            max-width: 800px;
            margin: 0 auto;
          }
          .stats-grid {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
          }
          .stat-card {
            flex: 1;
            border: 1px solid #e2e8f0;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
            background-color: #f8fafc;
          }
          @media print {
            body { padding: 0; background-color: white; }
            .no-print { display: none; }
            .report-container { border: none; box-shadow: none; padding: 0; max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 15px; border-radius: 12px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; max-width: 800px; margin-left: auto; margin-right: auto; box-sizing: border-box;">
          <div>
            <h4 style="margin: 0; color: #0f766e; font-size: 15px; font-weight: bold;">Kihakiki Ripoti ya Matokeo</h4>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Huu ni mwonekano safi wa kuchapa PDF. Bonyeza kitufe kilicho kulia kuhifadhi kama PDF.</p>
          </div>
          <button onclick="window.print()" style="background-color: #0f766e; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; transition: background-color 0.2s;">
            Chapa / Hifadhi kama PDF
          </button>
        </div>

        <div class="report-container">
          <!-- Offical Crest Header -->
          <div style="text-align: center; border-bottom: 3px double #0f766e; padding-bottom: 15px; margin-bottom: 25px;">
            <h1 style="margin: 0; font-size: 26px; letter-spacing: 1px; color: #0f766e; text-transform: uppercase; font-weight: bold;">${groupName}</h1>
            <p style="margin: 4px 0; font-size: 12px; font-style: italic; color: #64748b; font-weight: bold;">"${slogan}"</p>
            <div style="margin-top: 15px; font-weight: bold; font-size: 16px; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">
              TAARIFA RASMI YA MATOKEO YA UCHAGUZI WA VIONGOZI
            </div>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #475569;">
              <strong>Uchaguzi:</strong> ${title} • <strong>Kipindi:</strong> ${term}
            </p>
          </div>

          <!-- Statistics Cards Grid -->
          <div class="stats-grid">
            <div class="stat-card">
              <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; tracking-wider">Daftari la Wapiga Kura</p>
              <h2 style="margin: 5px 0 0 0; font-size: 24px; color: #1e293b; font-family: monospace; font-weight: bold;">${tallyData.totalEligibleVoters}</h2>
            </div>
            <div class="stat-card">
              <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; tracking-wider">Kura Zilizopigwa</p>
              <h2 style="margin: 5px 0 0 0; font-size: 24px; color: #0f766e; font-family: monospace; font-weight: bold;">${tallyData.totalBallotsCast}</h2>
            </div>
            <div class="stat-card">
              <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; tracking-wider">Asilimia ya Ushiriki</p>
              <h2 style="margin: 5px 0 0 0; font-size: 24px; color: #0d9488; font-family: monospace; font-weight: bold;">${tallyData.turnoutPercentage}%</h2>
            </div>
          </div>

          <!-- Position breakdown -->
          ${positionsHtml}

          <!-- Declaration / Verification Sign-off -->
          <div style="margin-top: 50px; border-top: 1px dashed #cbd5e1; padding-top: 25px; page-break-inside: avoid;">
            <p style="font-size: 12px; color: #475569; font-style: italic; text-align: center;">
              Taarifa hii imetolewa na kujumuishwa kiotomatiki kwa usahihi wa 100% kupitia Mfumo wa Kidijitali wa ${groupName} tarehe ${dateStr} saa ${timeStr}.
            </p>
            
            <div style="display: flex; justify-content: space-between; margin-top: 45px; font-size: 13px;">
              <div style="width: 250px; text-align: center;">
                <div style="border-bottom: 1px solid #94a3b8; height: 40px; margin-bottom: 5px;"></div>
                <strong>Msimamizi wa Uchaguzi</strong>
                <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b;">Sahihi na Tarehe</p>
              </div>
              <div style="width: 250px; text-align: center;">
                <div style="border-bottom: 1px solid #94a3b8; height: 40px; margin-bottom: 5px;"></div>
                <strong>Katibu wa Kamati</strong>
                <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b;">Sahihi na Tarehe</p>
              </div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(reportHtml);
    printWindow.document.close();
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
                  onClick={() => handleUpdateElectionStatus('completed')}
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
              {/* Turnout Stats Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Jumla ya Wapiga Kura Wenye Sifa</span>
                  <p className="text-2xl font-black text-white mt-1">
                    {tallyData?.totalEligibleVoters || 0}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Wanachama walioidhinishwa kikatiba</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kura Zilizopigwa Hadi Sasa</span>
                  <p className="text-2xl font-black text-emerald-400 mt-1">
                    {tallyData?.totalBallotsCast || 0}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Kura zilizorekodiwa kwa siri 100%</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Asilimia ya Ushiriki (Turnout)</span>
                  <p className="text-2xl font-black text-teal-400 mt-1">
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

              {/* Print / Export Action */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Matokeo ya Kila Nafasi ya Uongozi
                  </h3>
                  <p className="text-xs text-slate-400">
                    Kura zote zinasasishwa kwa wakati halisi mpiga kura anapowasilisha kura yake.
                  </p>
                </div>

                <button
                  onClick={handlePrintResults}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  Chapisha Ripoti Rasmi ya Matokeo
                </button>
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
                  <code className="bg-slate-800 text-emerald-400 px-1 rounded">{'{memberNo}'}</code>
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
    </div>
  );
};
