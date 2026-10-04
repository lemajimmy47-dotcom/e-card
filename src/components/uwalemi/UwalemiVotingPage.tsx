import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Vote, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  User, 
  ChevronRight, 
  Send, 
  Sparkles, 
  ArrowLeft, 
  Printer, 
  Share2, 
  Check, 
  Info,
  Lock,
  Calendar,
  Phone,
  RefreshCw,
  Award
} from 'lucide-react';
import { UwalemiElection, UwalemiElectionPosition, UwalemiCandidate } from '../../types/uwalemi';

interface Props {
  token: string;
  onClose?: () => void;
}

export const UwalemiVotingPage: React.FC<Props> = ({ token, onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [election, setElection] = useState<any | null>(null);
  const [voter, setVoter] = useState<{
    memberNo: string;
    fullName: string;
    phone: string;
    isEligible: boolean;
    ineligibilityReason?: string;
    hasVoted: boolean;
    votedAt?: string;
    receiptCode?: string;
  } | null>(null);
  const [timeStatus, setTimeStatus] = useState<'not_started' | 'open' | 'ended'>('open');
  const [groupSettings, setGroupSettings] = useState<{ groupName: string; slogan: string }>({
    groupName: 'UWALEMI',
    slogan: 'Lema, Nguvu Moja.'
  });

  // Selected votes: { [positionId]: candidateId[] }
  const [selectedVotes, setSelectedVotes] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [submitSuccessReceipt, setSubmitSuccessReceipt] = useState<{
    receiptCode: string;
    votedAt: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [resultsTally, setResultsTally] = useState<any | null>(null);

  const fetchBallot = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/uwalemi/election-ballot/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setElection(data.election);
        setVoter(data.voter);
        setTimeStatus(data.timeStatus || 'open');
        setResultsTally(data.resultsTally || null);
        if (data.groupSettings) {
          setGroupSettings(data.groupSettings);
        }
        if (data.voter.hasVoted && data.voter.receiptCode) {
          setSubmitSuccessReceipt({
            receiptCode: data.voter.receiptCode,
            votedAt: data.voter.votedAt || new Date().toISOString()
          });
        }
      } else {
        setError(data.error || 'Imeshindwa kupakia fomu ya kura.');
      }
    } catch (err: any) {
      setError('Hitilafu ya mtandao wakati wa kupakia ukurasa wa kura.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchBallot();
    }
  }, [token]);

  const handleToggleCandidate = (positionId: string, candidateId: string, maxWinners: number) => {
    setSelectedVotes(prev => {
      const current = prev[positionId] || [];
      const isSelected = current.includes(candidateId);
      
      if (isSelected) {
        // Deselect
        return {
          ...prev,
          [positionId]: current.filter(id => id !== candidateId)
        };
      } else {
        // Select
        if (maxWinners === 1) {
          // Single select replaces
          return {
            ...prev,
            [positionId]: [candidateId]
          };
        } else {
          // Multi-select up to maxWinners
          if (current.length >= maxWinners) {
            // Already reached limit, replace the oldest selection or alert
            const updated = [...current.slice(1), candidateId];
            return {
              ...prev,
              [positionId]: updated
            };
          } else {
            return {
              ...prev,
              [positionId]: [...current, candidateId]
            };
          }
        }
      }
    });
  };

  const handleSubmitVotes = async () => {
    if (!election || !voter || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/uwalemi/election/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          electionId: election.id,
          votes: selectedVotes
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitSuccessReceipt({
          receiptCode: data.receiptCode,
          votedAt: data.votedAt
        });
        setShowReviewModal(false);
        setVoter(prev => prev ? { ...prev, hasVoted: true, receiptCode: data.receiptCode, votedAt: data.votedAt } : null);
        // Load fresh tally and state
        fetchBallot();
      } else {
        setError(data.error || 'Imeshindwa kurekodi kura yako.');
        setShowReviewModal(false);
      }
    } catch (err: any) {
      setError('Hitilafu ya mtandao wakati wa kuwasilisha kura.');
      setShowReviewModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleShareReceipt = () => {
    const text = `UWALEMI: Kura yangu ya viongozi imerekodiwa kwa siri. Stakabadhi ya Ushiriki: ${submitSuccessReceipt?.receiptCode}.`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Inathibitisha Kifunguo cha Kura...</h2>
        <p className="text-sm text-slate-400 max-w-sm">
          Tafadhali subiri kidogo wakati mfumo wa UWALEMI unathibitisha usalama na haki yako ya kupiga kura.
        </p>
      </div>
    );
  }

  if (error && !election) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Hitilafu ya Kiungo cha Kura</h2>
        <p className="text-sm text-slate-300 max-w-md mb-6 leading-relaxed">
          {error}
        </p>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 max-w-md text-left mb-6">
          <p className="font-semibold text-slate-200 mb-1">Unahitaji Msaada?</p>
          <p>Wasiliana na Kamati ya Uchaguzi ya UWALEMI au Katibu Mkuu kupitia simu yako ya mwanachama ili upate kiungo sahihi.</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-all cursor-pointer"
          >
            Rudi Nyuma
          </button>
        )}
      </div>
    );
  }

  // Already voted state - Show digital certificate receipt
  if (submitSuccessReceipt || voter?.hasVoted) {
    const receipt = submitSuccessReceipt?.receiptCode || voter?.receiptCode || 'UWL-VT-SUCCESS';
    const votedDateStr = submitSuccessReceipt?.votedAt || voter?.votedAt || new Date().toISOString();

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle Decorative Header */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
          
          <div className="text-center mb-6 pt-2">
            <div className="w-20 h-20 mx-auto rounded-full p-1 bg-gradient-to-tr from-emerald-500 via-blue-500 to-teal-400 shadow-xl shadow-emerald-950/60 mb-4 flex items-center justify-center">
              <img 
                src={groupSettings.logoUrl || '/uwalemi_logo.png'} 
                alt="UWALEMI Emblem" 
                className="w-full h-full object-cover rounded-full bg-slate-950 border border-slate-900"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              Kura Imepokelewa Kikamilifu
            </span>
            <h2 className="text-2xl font-black text-white mt-3 mb-1">
              Asante kwa Kushiriki!
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              {groupSettings.groupName} • {election?.title || 'Uchaguzi wa Viongozi'}
            </p>
          </div>

          {/* Official Digital Certificate Box */}
          <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-5 mb-6 text-left relative overflow-hidden">
            <div className="absolute top-2 right-2 opacity-10">
              <ShieldCheck className="w-24 h-24 text-emerald-400" />
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Mpiga Kura Aliyeidhinishwa</p>
                <p className="text-sm font-bold text-slate-200">{voter?.fullName}</p>
                <p className="text-xs text-emerald-400 font-semibold">{voter?.memberNo}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Imethibitishwa
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Namba ya Stakabadhi:</span>
                <span className="font-mono font-bold text-emerald-400 tracking-wider text-sm">{receipt}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Tarehe na Saa:</span>
                <span className="text-slate-300 font-medium">
                  {new Date(votedDateStr).toLocaleString('sw-TZ', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Hali ya Usiri:</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Imelindwa 100% (Anonymous)
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 italic">
              "Kura yako imehifadhiwa kwa siri bila kuambatanishwa na jina lako. Hakuna mtu au kiongozi yeyote anayeweza kuona nani umempigia kura."
            </div>
          </div>

          {/* Live Election Results Panel */}
          {resultsTally && (
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 mb-6 text-left">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  Matokeo ya Moja kwa Moja (Live)
                </h3>
                <span className="text-[10px] text-slate-400 font-medium font-mono">
                  Kura: <strong>{resultsTally.totalBallotsCast}</strong> / {resultsTally.totalEligibleVoters} ({resultsTally.turnoutPercentage}%)
                </span>
              </div>

              <div className="space-y-4 max-h-60 overflow-y-auto pr-1 no-scrollbar">
                {resultsTally.positionsTally.map((pos: any) => {
                  return (
                    <div key={pos.positionId} className="space-y-1.5 pb-2 border-b border-slate-800/50 last:border-0 last:pb-0">
                      <p className="text-[11px] font-extrabold text-slate-300 flex items-center justify-between">
                        <span>{pos.positionTitle}</span>
                        <span className="text-[9px] text-slate-500 font-normal">Nafasi: {pos.maxWinners}</span>
                      </p>
                      
                      <div className="space-y-1.5">
                        {pos.results.length === 0 ? (
                          <p className="text-[10px] text-slate-500 italic">Hakuna wagombea bado.</p>
                        ) : (
                          pos.results.map((cand: any) => (
                            <div key={cand.candidateId} className="text-[10px]">
                              <div className="flex justify-between text-slate-400 mb-0.5">
                                <span className="font-medium text-slate-300">
                                  {cand.candidateName} <span className="text-slate-500 font-mono text-[9px]">({cand.candidateNo})</span>
                                </span>
                                <span className="font-mono text-slate-200 font-bold">
                                  {cand.votesCount} <span className="text-slate-500 text-[9px]">({cand.percentage}%)</span>
                                </span>
                              </div>
                              
                              <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    cand.isWinner ? 'bg-emerald-500' : cand.isTie ? 'bg-amber-500' : 'bg-slate-700'
                                  }`}
                                  style={{ width: `${cand.percentage}%` }}
                                />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
            <button
              onClick={handlePrintReceipt}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Chapisha / Hifadhi PDF
            </button>
            <button
              onClick={handleShareReceipt}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {copiedLink ? 'Imenakiliwa!' : 'Nakili Uthibitisho'}
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="w-full py-2 text-center text-xs text-slate-400 hover:text-slate-200 font-medium cursor-pointer"
            >
              Funga Ukurasa
            </button>
          )}
        </div>
      </div>
    );
  }

  // Voter not eligible
  if (voter && !voter.isEligible) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Hujatimiza Sifa za Kupiga Kura</h2>
        <p className="text-sm text-slate-300 max-w-md mb-4 leading-relaxed">
          Ndugu <strong>{voter.fullName} ({voter.memberNo})</strong>, mfumo umetambua kuwa haujakidhi vigezo vya kikatiba vya kushiriki katika uchaguzi huu:
        </p>
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300 max-w-md text-left mb-6 font-medium">
          Sababu: {voter.ineligibilityReason || 'Hali ya uanachama au ada za mwezi haijakidhi vigezo vilivyowekwa na Kamati ya Uchaguzi.'}
        </div>
        <p className="text-xs text-slate-400 max-w-md mb-6">
          Ikiwa unaona kuna makosa, tafadhali wasiliana na Kamati ya Uchaguzi au Mweka Hazina wa UWALEMI ili kurekebisha taarifa zako.
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-all cursor-pointer"
          >
            Rudi Nyuma
          </button>
        )}
      </div>
    );
  }

  // Election paused or closed
  if (election && (election.status === 'paused' || election.status === 'completed' || timeStatus !== 'open')) {
    const isPaused = election.status === 'paused';
    const isEnded = election.status === 'completed' || timeStatus === 'ended';
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4 text-slate-300">
          <Clock className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {isPaused ? 'Uchaguzi Umesitishwa kwa Muda' : isEnded ? 'Dirisha la Uchaguzi Limefungwa' : 'Uchaguzi Bado Haujaanza'}
        </h2>
        <p className="text-sm text-slate-300 max-w-md mb-6 leading-relaxed">
          {isPaused 
            ? 'Kamati ya Uchaguzi ya UWALEMI imesitisha shughuli ya upigaji kura kwa muda kwa ajili ya mapitio ya kiufundi. Tafadhali tembelea tena baadae.'
            : isEnded
              ? 'Muda uliopangwa kikatiba wa kupiga kura umemalizika rasmi. Matokeo rasmi yatatangazwa na Kamati ya Uchaguzi punde baada ya majumuisho kukamilika.'
              : `Upigaji kura utaanza rasmi tarehe ${election.startDate ? new Date(election.startDate).toLocaleString('sw-TZ') : 'hivi karibuni'}.`}
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-all cursor-pointer"
          >
            Rudi Nyuma
          </button>
        )}
      </div>
    );
  }

  const positions: UwalemiElectionPosition[] = election?.positions || [];

  // Count how many positions have at least one selection
  const positionsVotedCount = positions.filter(pos => (selectedVotes[pos.id]?.length || 0) > 0).length;
  const isAllPositionsVoted = positions.length > 0 && positionsVotedCount === positions.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-emerald-500 via-blue-500 to-teal-400 shadow-md shadow-emerald-950/50 flex-shrink-0">
              <img 
                src={groupSettings.logoUrl || '/uwalemi_logo.png'} 
                alt="UWALEMI Emblem" 
                className="w-full h-full object-cover rounded-full bg-slate-950 border border-slate-900"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-white leading-tight">
                {groupSettings.groupName} E-VOTING
              </h1>
              <p className="text-[11px] text-slate-400 line-clamp-1">
                {election?.title || 'Uchaguzi Mkuu wa Viongozi'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live & Salama
            </span>
          </div>
        </div>
      </header>

      {/* Main Ballot Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        {/* Error notification */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <div className="flex-1 font-medium">{error}</div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 cursor-pointer font-bold">×</button>
          </div>
        )}

        {/* Voter Greeting & Instructions Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mwanachama Mpiga Kura:</span>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{voter?.fullName}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700 font-mono">
                  {voter?.memberNo}
                </span>
              </h2>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl font-medium self-start sm:self-auto">
              <ShieldCheck className="w-4 h-4" />
              Kura ya Siri (Secret Ballot 100%)
            </div>
          </div>

          <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Muda wa Kufunga: {election?.endDate ? new Date(election.endDate).toLocaleString('sw-TZ', { dateStyle: 'medium', timeStyle: 'short' }) : 'Haijabainishwa'}</span>
            </div>
            <div className="text-slate-300 font-medium">
              Maendeleo ya Kura: <span className="text-emerald-400 font-bold">{positionsVotedCount}</span> / {positions.length} Nafasi
            </div>
          </div>
        </div>

        {/* Ballot Positions Form */}
        <div className="space-y-6">
          {positions.map((pos, idx) => {
            const maxWinners = Math.max(1, pos.maxWinners || 1);
            const currentSelected = selectedVotes[pos.id] || [];
            const isFilled = currentSelected.length > 0;

            return (
              <section 
                key={pos.id} 
                className={`bg-slate-900 border rounded-2xl p-5 transition-all ${
                  isFilled ? 'border-emerald-500/40 shadow-lg shadow-emerald-950/20' : 'border-slate-800'
                }`}
              >
                {/* Position Title & Rule */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800/80 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold font-mono">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-wide">
                        {pos.title}
                      </h3>
                      {pos.description && (
                        <p className="text-xs text-slate-400 mt-0.5">{pos.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${
                      currentSelected.length === maxWinners 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : currentSelected.length > 0
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {maxWinners === 1 
                        ? (currentSelected.length === 1 ? '✓ Umechagua 1' : 'Chagua mgombea 1')
                        : `Umechagua ${currentSelected.length} kati ya ${maxWinners}`}
                    </span>
                  </div>
                </div>

                {/* Candidate Selection Cards */}
                {pos.candidates.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 italic bg-slate-950/40 rounded-xl">
                    Hakuna wagombea waliopitishwa kwa nafasi hii bado.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pos.candidates.map(candidate => {
                      const isSelected = currentSelected.includes(candidate.id);

                      return (
                        <div
                          key={candidate.id}
                          onClick={() => handleToggleCandidate(pos.id, candidate.id, maxWinners)}
                          className={`relative rounded-xl p-3.5 border transition-all cursor-pointer select-none flex items-start gap-3 ${
                            isSelected 
                              ? 'bg-emerald-950/30 border-emerald-500 shadow-md shadow-emerald-950/40' 
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950/90'
                          }`}
                        >
                          {/* Candidate Avatar / Initials */}
                          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex-shrink-0 flex items-center justify-center overflow-hidden">
                            {candidate.avatarUrl ? (
                              <img src={candidate.avatarUrl} alt={candidate.fullName} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold text-slate-300">
                                {candidate.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                              </span>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="text-sm font-bold text-white truncate">
                                {candidate.fullName}
                              </h4>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              )}
                            </div>
                            <p className="text-[11px] text-emerald-400 font-mono font-medium">
                              {candidate.memberNo}
                            </p>
                            {(candidate.slogan || candidate.manifesto) && (
                              <p className="text-[11px] text-slate-400 italic line-clamp-2 mt-1">
                                "{candidate.slogan || candidate.manifesto}"
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Submit Review Card */}
        <div className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-xl">
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-white mb-1">
              Je, Uko Tayari Kuwasilisha Kura Yako?
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Tafadhali kagua kura zako kabla ya kubofya hapa. Kura yako ikishawasilishwa inarekodiwa kwa siri na huwezi kuibadilisha tena.
            </p>

            <button
              onClick={() => setShowReviewModal(true)}
              disabled={isSubmitting || positionsVotedCount === 0}
              className={`w-full py-3 px-6 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                positionsVotedCount > 0
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/60'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
              Kagua na Wasilisha Kura ({positionsVotedCount}/{positions.length} Zilizochaguliwa)
            </button>
          </div>
        </div>
      </main>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Thibitisha Kura Yako</h3>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <p className="text-slate-400">Mpiga Kura:</p>
                <p className="text-sm font-bold text-white">{voter?.fullName} ({voter?.memberNo})</p>
              </div>

              <div className="space-y-3">
                {positions.map(pos => {
                  const chosenIds = selectedVotes[pos.id] || [];
                  const chosenCandidates = pos.candidates.filter(c => chosenIds.includes(c.id));

                  return (
                    <div key={pos.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <p className="font-bold text-slate-300 mb-1">{pos.title}:</p>
                      {chosenCandidates.length > 0 ? (
                        <div className="space-y-1">
                          {chosenCandidates.map(c => (
                            <div key={c.id} className="flex items-center justify-between text-emerald-300 font-medium">
                              <span>✓ {c.fullName}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{c.memberNo}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 italic">Hakuna uliyemchagua (Umeacha tupu)</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 flex items-start gap-2">
                <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Uthibitisho wa Usiri: Mfumo unahifadhi kura hizi bila kuambatanisha utambulisho wako. Baada ya kuwasilisha, utapokea Stakabadhi ya kidijitali (Receipt Code).
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2 mt-2">
              <button
                onClick={() => setShowReviewModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer text-xs"
              >
                Rekebisha Kura
              </button>
              <button
                onClick={handleSubmitVotes}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer text-xs flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Inawasilisha Kura...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Thibitisha & Wasilisha Kura
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
