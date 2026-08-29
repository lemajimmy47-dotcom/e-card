import React, { useState } from 'react';
import { UwalemiState, UwalemiMeeting, UwalemiMeetingAttendee, UwalemiMember } from '../../types/uwalemi';
import { sortMembersByLeadership, getSwahiliDayAndDate, getMemberLocationGroup } from '../../services/uwalemiService';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Plus, 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Send, 
  FileText, 
  Edit3, 
  X,
  Share2,
  Printer,
  Receipt,
  MessageSquare,
  MessageCircle,
  Copy,
  Check,
  Search,
  CheckSquare,
  Square,
  User,
  UserCheck,
  Building2,
  Globe,
  SlidersHorizontal
} from 'lucide-react';
import { UwalemiFinePaymentModal } from './UwalemiFinePaymentModal';

interface Props {
  state: UwalemiState;
  onSaveState: (state: UwalemiState) => Promise<boolean>;
  onOpenSmsWithTemplate?: (recipients: { name: string; phone: string; memberNo: string }[], templateText: string) => void;
}

export const UwalemiMeetings: React.FC<Props> = ({ state, onSaveState, onOpenSmsWithTemplate }) => {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(
    state.meetings?.[0]?.id || null
  );

  // Modals
  const [isNewMeetingModalOpen, setIsNewMeetingModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isMinutesModalOpen, setIsMinutesModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  // Attendance Modal Filtering
  const [attendanceLocationFilter, setAttendanceLocationFilter] = useState<'all' | 'Dar es Salaam' | 'Mkoani'>('all');
  const [attendanceSearch, setAttendanceSearch] = useState<string>('');

  // Broadcast Messaging Center in Meetings
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'dar' | 'mkoani' | 'single' | 'selected' | 'absent' | 'late' | 'unconfirmed' | 'leaders'>('all');
  const [selectedSingleMemberId, setSelectedSingleMemberId] = useState<string>('');
  const [selectedCustomMemberIds, setSelectedCustomMemberIds] = useState<string[]>([]);
  const [memberFilterSearch, setMemberFilterSearch] = useState<string>('');
  const [broadcastChannel, setBroadcastChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [broadcastTemplateType, setBroadcastTemplateType] = useState<'official_invitation' | 'reminder_urgent' | 'resolutions_feedback' | 'fine_absentee'>('official_invitation');
  const [broadcastCustomText, setBroadcastCustomText] = useState('');
  const [copiedBroadcast, setCopiedBroadcast] = useState(false);

  // Fine Payment Modal
  const [isFinePaymentModalOpen, setIsFinePaymentModalOpen] = useState(false);
  const [fineModalMemberId, setFineModalMemberId] = useState<string | undefined>(undefined);
  const [fineModalMeetingId, setFineModalMeetingId] = useState<string | undefined>(undefined);
  const [fineModalAmount, setFineModalAmount] = useState<number | undefined>(undefined);

  // Meeting Form
  const [meetingForm, setMeetingForm] = useState<{
    title: string;
    date: string;
    time: string;
    location: string;
    agendas: string[];
    newAgendaInput: string;
  }>({
    title: 'Kikao cha Kawaida cha Mwezi',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: '14:00 - 17:00',
    location: 'Sinza, Dar es Salaam',
    agendas: [
      'Kufungua kikao na sala',
      'Kupitia muhtasari wa kikao kilichopita',
      'Taarifa ya mapato, ada na matumizi ya hazina',
      'Mengineyo na kufunga kikao'
    ],
    newAgendaInput: ''
  });

  // Minutes State
  const [minutesText, setMinutesText] = useState('');
  const [resolutionsList, setResolutionsList] = useState<string[]>([]);
  const [newResolutionInput, setNewResolutionInput] = useState('');

  const members = sortMembersByLeadership(state.members || []);
  const meetings = state.meetings || [];
  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId) || meetings[0];

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingForm.title || !meetingForm.date) {
      alert('Tafadhali jaza Jina na Tarehe ya Kikao.');
      return;
    }

    const newMeeting: UwalemiMeeting = {
      id: `mtg-${Date.now()}`,
      meetingNo: meetings.length + 1,
      title: meetingForm.title,
      date: meetingForm.date,
      time: meetingForm.time,
      location: meetingForm.location,
      agendas: meetingForm.agendas,
      attendees: members.map(m => ({
        memberId: m.id,
        memberNo: m.memberNo,
        memberName: m.fullName,
        status: 'present',
        fineAmount: 0,
        finePaid: false
      })),
      status: 'upcoming'
    };

    const updatedMeetings = [newMeeting, ...meetings];
    await onSaveState({ ...state, meetings: updatedMeetings });
    setSelectedMeetingId(newMeeting.id);
    setIsNewMeetingModalOpen(false);
  };

  const handleUpdateAttendance = async (attendees: UwalemiMeetingAttendee[]) => {
    if (!selectedMeeting) return;

    const updatedMeeting: UwalemiMeeting = {
      ...selectedMeeting,
      attendees
    };

    const updatedMeetings = meetings.map(m => m.id === selectedMeeting.id ? updatedMeeting : m);
    await onSaveState({ ...state, meetings: updatedMeetings });
  };

  const handleSaveMinutes = async () => {
    if (!selectedMeeting) return;

    const updatedMeeting: UwalemiMeeting = {
      ...selectedMeeting,
      minutes: minutesText,
      resolutions: resolutionsList,
      status: 'completed'
    };

    const updatedMeetings = meetings.map(m => m.id === selectedMeeting.id ? updatedMeeting : m);
    await onSaveState({ ...state, meetings: updatedMeetings });
    setIsMinutesModalOpen(false);
  };

  const getMeetingMessageTemplate = (type: 'official_invitation' | 'reminder_urgent' | 'resolutions_feedback' | 'fine_absentee') => {
    if (!selectedMeeting) return '';
    const { dayName, formattedDate } = getSwahiliDayAndDate(selectedMeeting.date);
    const timeStr = selectedMeeting.time || '14:00 - 17:00';
    const locationStr = selectedMeeting.location || 'Sinza, Dar es Salaam';

    if (type === 'official_invitation') {
      return `Ndugu {name}, unakumbushwa kuwa kutakuwa na kikao cha wanachama siku ya ${dayName} Tarehe ${formattedDate}, saa ${timeStr}, mahali ${locationStr}.

Kikao hiki ni muhimu, kwani kuna mambo muhimu sana ya kujadili yanayohusu umoja na ustawi wa wanachama. Hivyo, tunasisitiza kila mwanachama kuhudhuria.

Pia, unasisitizwa kulipa ada yako kwa wakati ili kuepuka faini na kuwa nje ya umoja kwa mujibu wa Katiba.

Lipa ada yako kupitia M-Koba au kwa namba 0758219298 – Eva O. Lema.

Aidha, unasisitizwa kufika kwenye kikao kwa wakati bila kuchelewa, ili kuepuka faini.

Tunakuhitaji kwenye kikao. Ushiriki wako ni muhimu sana kwa maendeleo ya umoja wetu.

Karibu na asante kwa ushirikiano wako.

Lema, Nguvu Moja!`;
    }

    if (type === 'reminder_urgent') {
      return `KUMBUKIZI MUHIMU YA KIKAO - UWALEMI
Habari {name}, unakumbushwa kuhusu ${selectedMeeting.title} siku ya ${dayName} tarehe ${formattedDate}, kuanzia saa ${timeStr}, eneo: ${locationStr}.

Tafadhali fika mapema bila kuchelewa ili kuepuka faini ya kuchelewa/utoro.

Lema, Nguvu Moja!`;
    }

    if (type === 'resolutions_feedback') {
      const resText = (selectedMeeting.resolutions && selectedMeeting.resolutions.length > 0)
        ? selectedMeeting.resolutions.map((r, i) => `${i + 1}. ${r}`).join('\n')
        : 'Muhtasari na maazimio yamehifadhiwa kwenye mfumo.';
      return `MAAZIMIO YA KIKAO CHA UWALEMI
Ndugu {name}, yafuatayo ni maazimio makuu yaliyofikiwa katika ${selectedMeeting.title} ya tarehe ${formattedDate}:\n\n${resText}\n\nAsante kwa kuendelea kujenga umoja wetu.\nLema, Nguvu Moja!`;
    }

    if (type === 'fine_absentee') {
      const fineAmt = (state.groupSettings.meetingFineDefault || 10000).toLocaleString();
      return `TAARIFA YA FAINI YA KIKAO - UWALEMI
Habari {name} ({memberNo}), unataarifiwa kuwa kwa kutohudhuria ${selectedMeeting.title} ya tarehe ${formattedDate} bila kutoa udhuru rasmi, umetozwa faini ya TZS ${fineAmt} kwa mujibu wa Katiba ya UWALEMI.

Tafadhali kamilisha malipo kupitia M-Koba au namba 0758219298 – Eva O. Lema.
Lema, Nguvu Moja!`;
    }

    return '';
  };

  const openMemberWhatsApp = (phone: string | undefined, textTemplate: string, memberName: string) => {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('0') ? '255' + cleanPhone.substring(1) : cleanPhone;
    const personalizedText = textTemplate.replace('{name}', memberName);
    if (fullPhone) {
      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(personalizedText)}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(personalizedText)}`, '_blank');
    }
  };

  const handleOpenBroadcastModal = (
    template: 'official_invitation' | 'reminder_urgent' | 'resolutions_feedback' | 'fine_absentee' = 'official_invitation',
    targetMode?: 'all' | 'single' | 'selected' | 'absent' | 'unconfirmed' | 'leaders',
    memberId?: string
  ) => {
    setBroadcastTemplateType(template);
    setBroadcastCustomText(getMeetingMessageTemplate(template));
    
    if (targetMode) {
      setBroadcastTarget(targetMode);
    } else if (template === 'fine_absentee') {
      setBroadcastTarget('absent');
    } else {
      setBroadcastTarget('all');
    }

    if (memberId) {
      setSelectedSingleMemberId(memberId);
    } else if (!selectedSingleMemberId && members.length > 0) {
      setSelectedSingleMemberId(members[0].id);
    }

    setIsBroadcastModalOpen(true);
  };

  const handleSendMeetingAlert = () => {
    handleOpenBroadcastModal('official_invitation', 'all');
  };

  // Compute attendance stats
  const attendees = selectedMeeting?.attendees || [];
  const presentCount = attendees.filter(a => a.status === 'present').length;
  const lateCount = attendees.filter(a => a.status === 'late').length;
  const apologyCount = attendees.filter(a => a.status === 'apology').length;
  const absentCount = attendees.filter(a => a.status === 'absent').length;

  // Grouped members: 1. Dar es Salaam, 2. Mkoani
  const darMembers = members.filter(m => getMemberLocationGroup(m) === 'Dar es Salaam');
  const mkoaniMembers = members.filter(m => getMemberLocationGroup(m) === 'Mkoani');

  const darAttendees = attendees.filter(a => {
    const mem = members.find(m => m.id === a.memberId);
    return mem && getMemberLocationGroup(mem) === 'Dar es Salaam';
  });
  const mkoaniAttendees = attendees.filter(a => {
    const mem = members.find(m => m.id === a.memberId);
    return mem && getMemberLocationGroup(mem) === 'Mkoani';
  });

  const darPresentCount = darAttendees.filter(a => a.status === 'present').length;
  const darLateCount = darAttendees.filter(a => a.status === 'late').length;
  const darApologyCount = darAttendees.filter(a => a.status === 'apology').length;
  const darAbsentCount = darAttendees.filter(a => a.status === 'absent').length;

  const mkoaniPresentCount = mkoaniAttendees.filter(a => a.status === 'present').length;
  const mkoaniLateCount = mkoaniAttendees.filter(a => a.status === 'late').length;
  const mkoaniApologyCount = mkoaniAttendees.filter(a => a.status === 'apology').length;
  const mkoaniAbsentCount = mkoaniAttendees.filter(a => a.status === 'absent').length;

  // Quick Batch Attendance Handler for Groups
  const handleMarkGroupAttendance = async (group: 'Dar es Salaam' | 'Mkoani', status: 'present' | 'apology' | 'absent' | 'late') => {
    if (!selectedMeeting) return;
    const targetGroupMembers = group === 'Dar es Salaam' ? darMembers : mkoaniMembers;
    const targetIds = targetGroupMembers.map(m => m.id);

    const updatedAttendees = members.map(mem => {
      const existing = (selectedMeeting.attendees || []).find(a => a.memberId === mem.id);
      if (targetIds.includes(mem.id)) {
        let fineAmt = 0;
        if (status === 'absent') {
          fineAmt = state.groupSettings.meetingFineDefault || 10000;
        } else if (status === 'late') {
          fineAmt = state.groupSettings.meetingFineLateDefault || 2000;
        }
        return {
          memberId: mem.id,
          memberNo: mem.memberNo,
          memberName: mem.fullName,
          status,
          fineAmount: fineAmt,
          finePaid: false
        };
      }
      return existing || {
        memberId: mem.id,
        memberNo: mem.memberNo,
        memberName: mem.fullName,
        status: 'present' as const
      };
    });

    await handleUpdateAttendance(updatedAttendees);
  };

  // Change a member's location group (Dar es Salaam vs Mkoani)
  const handleToggleMemberLocation = async (memberId: string, newGroup: 'Dar es Salaam' | 'Mkoani') => {
    const updatedMembers = (state.members || []).map(m => {
      if (m.id === memberId) {
        return {
          ...m,
          locationGroup: newGroup
        };
      }
      return m;
    });

    await onSaveState({
      ...state,
      members: updatedMembers
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12" id="uwalemi-meetings">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Ratiba ya Vikao & Mahudhurio ya Wajumbe
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Upangaji wa vikao vya kila mwezi, mahudhurio ya wajumbe yaliyogawanywa katika makundi (1. Dar es Salaam, 2. Mkoani), faini za utoro, na maazimio.
          </p>
        </div>

        <button
          onClick={() => {
            setMeetingForm({
              title: `Kikao cha Kawaida cha Mwezi`,
              date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              time: '14:00 - 17:00',
              location: 'Sinza, Dar es Salaam',
              agendas: [
                'Kufungua kikao na sala',
                'Kupitia muhtasari wa kikao kilichopita',
                'Taarifa ya mapato, ada na matumizi ya hazina',
                'Mengineyo na kufunga kikao'
              ],
              newAgendaInput: ''
            });
            setIsNewMeetingModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Panga Kikao Kipya
        </button>
      </div>

      {/* Meetings Selector Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {meetings.map(m => {
          const isSelected = selectedMeeting?.id === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedMeetingId(m.id)}
              className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                isSelected 
                  ? 'bg-blue-950/30 border-blue-500/60 shadow-lg shadow-blue-950/50' 
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                  Kikao Na. {m.meetingNo || 1}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  m.status === 'upcoming' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {m.status === 'upcoming' ? 'Kinachokuja' : 'Kimekamilika'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white line-clamp-1">{m.title}</h3>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-blue-400" /> {m.date} ({m.time})
              </div>
              <div className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {m.location}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Meeting Details */}
      {selectedMeeting ? (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Kikao Na. {selectedMeeting.meetingNo}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {selectedMeeting.date}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {selectedMeeting.time}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white mt-1.5">{selectedMeeting.title}</h3>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-400" /> Eneo la Kikao: <strong className="text-slate-200">{selectedMeeting.location}</strong>
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => handleOpenBroadcastModal('official_invitation')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Tuma Wito / Taarifa (SMS)
              </button>

              <button
                onClick={() => {
                  const waText = getMeetingMessageTemplate('official_invitation');
                  window.open(`https://wa.me/?text=${encodeURIComponent(waText.replace('{name}', 'Mwanachama wa UWALEMI'))}`, '_blank');
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
                title="Tuma wito huu kwenye Group la WhatsApp la UWALEMI"
              >
                <Share2 className="w-4 h-4" />
                WhatsApp Group
              </button>

              <button
                onClick={() => {
                  setMinutesText(selectedMeeting.minutes || '');
                  setResolutionsList(selectedMeeting.resolutions || []);
                  setIsMinutesModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                Muhtasari & Maazimio
              </button>
            </div>
          </div>

          {/* Group Breakdown Cards (1. Dar es Salaam & 2. Mkoani) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Kundi 1: Dar es Salaam Card */}
            <div className="bg-slate-950/80 border border-blue-900/40 rounded-xl p-4.5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300">
                      1. Kundi la Dar es Salaam
                    </h4>
                    <p className="text-[11px] text-slate-400">Jumla ya Wajumbe: <strong className="text-white">{darMembers.length}</strong></p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAttendanceLocationFilter('Dar es Salaam');
                    setIsAttendanceModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-[11px] font-semibold transition-all border border-blue-500/30 cursor-pointer"
                >
                  Daftari la Dar →
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Wamehudhuria</span>
                  <span className="text-base font-bold text-emerald-400">{darPresentCount}</span>
                </div>
                <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Udhuru</span>
                  <span className="text-base font-bold text-amber-400">{darApologyCount}</span>
                </div>
                <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Wasiohudhuria</span>
                  <span className="text-base font-bold text-rose-400">{darAbsentCount}</span>
                </div>
              </div>
            </div>

            {/* Kundi 2: Mkoani Card */}
            <div className="bg-slate-950/80 border border-purple-900/40 rounded-xl p-4.5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                      2. Kundi la Mkoani
                    </h4>
                    <p className="text-[11px] text-slate-400">Jumla ya Wajumbe: <strong className="text-white">{mkoaniMembers.length}</strong></p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAttendanceLocationFilter('Mkoani');
                    setIsAttendanceModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white text-[11px] font-semibold transition-all border border-purple-500/30 cursor-pointer"
                >
                  Daftari la Mkoani →
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Wamehudhuria</span>
                  <span className="text-base font-bold text-emerald-400">{mkoaniPresentCount}</span>
                </div>
                <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Udhuru</span>
                  <span className="text-base font-bold text-amber-400">{mkoaniApologyCount}</span>
                </div>
                <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Wasiohudhuria</span>
                  <span className="text-base font-bold text-rose-400">{mkoaniAbsentCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Agendas & Attendance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ajenda za Kikao */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4.5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                Ajenda Zilizopangwa ({selectedMeeting.agendas?.length || 0})
              </h4>
              <ul className="space-y-2 text-xs text-slate-300">
                {(selectedMeeting.agendas || []).map((ag, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{ag}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Attendance Overview Card */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4.5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Jumla Kuu ya Mahudhurio
                </h4>
                <button
                  onClick={() => {
                    setAttendanceLocationFilter('all');
                    setIsAttendanceModalOpen(true);
                  }}
                  className="text-xs text-emerald-400 hover:underline font-semibold cursor-pointer"
                >
                  Chukua Mahudhurio Wote →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <div className="p-3 bg-slate-900 rounded-lg text-center border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Waliohudhuria</span>
                  <span className="text-lg font-bold text-emerald-400 mt-0.5 block">{presentCount}</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg text-center border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Kuchelewa (2k)</span>
                  <span className="text-lg font-bold text-indigo-400 mt-0.5 block">{lateCount}</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg text-center border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Udhuru</span>
                  <span className="text-lg font-bold text-amber-400 mt-0.5 block">{apologyCount}</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg text-center border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Watoro (10k)</span>
                  <span className="text-lg font-bold text-rose-400 mt-0.5 block">{absentCount}</span>
                </div>
              </div>

              {selectedMeeting.minutes && (
                <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 line-clamp-2">
                  <strong className="text-slate-300">Muhtasari: </strong> {selectedMeeting.minutes}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* MODAL: CREATE MEETING */}
      {isNewMeetingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                Panga Kikao Kipya cha UWALEMI
              </h3>
              <button onClick={() => setIsNewMeetingModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMeeting} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Jina la Kikao *</label>
                <input
                  type="text"
                  required
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                  placeholder="Mfano: Kikao cha Kawaida cha Mwezi Agosti"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Tarehe ya Kikao *</label>
                  <input
                    type="date"
                    required
                    value={meetingForm.date}
                    onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Muda (Masaa)</label>
                  <input
                    type="text"
                    value={meetingForm.time}
                    onChange={(e) => setMeetingForm({ ...meetingForm, time: e.target.value })}
                    placeholder="14:00 - 17:00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Ukumbi au Eneo la Kikao *</label>
                <input
                  type="text"
                  required
                  value={meetingForm.location}
                  onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                  placeholder="Sinza / Ukumbi wa Vatican / Kijitonyama"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {/* Agendas Builder */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Ajenda za Kikao</label>
                <div className="space-y-1.5 mb-2">
                  {meetingForm.agendas.map((ag, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
                      <span>{idx + 1}. {ag}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = meetingForm.agendas.filter((_, i) => i !== idx);
                          setMeetingForm({ ...meetingForm, agendas: updated });
                        }}
                        className="text-rose-400 hover:text-rose-300"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={meetingForm.newAgendaInput}
                    onChange={(e) => setMeetingForm({ ...meetingForm, newAgendaInput: e.target.value })}
                    placeholder="Andika ajenda mpya..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && meetingForm.newAgendaInput.trim()) {
                        e.preventDefault();
                        setMeetingForm({
                          ...meetingForm,
                          agendas: [...meetingForm.agendas, meetingForm.newAgendaInput.trim()],
                          newAgendaInput: ''
                        });
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (meetingForm.newAgendaInput.trim()) {
                        setMeetingForm({
                          ...meetingForm,
                          agendas: [...meetingForm.agendas, meetingForm.newAgendaInput.trim()],
                          newAgendaInput: ''
                        });
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                  >
                    + Ongeza
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewMeetingModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 cursor-pointer"
                >
                  Panga Kikao
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ATTENDANCE REGISTER */}
      {isAttendanceModalOpen && selectedMeeting && (() => {
        // Filter members by search
        const filteredAll = members.filter(m => {
          if (!attendanceSearch.trim()) return true;
          const q = attendanceSearch.toLowerCase();
          return (
            m.fullName.toLowerCase().includes(q) ||
            m.memberNo.toLowerCase().includes(q) ||
            (m.residence && m.residence.toLowerCase().includes(q)) ||
            (m.phone && m.phone.includes(q))
          );
        });

        const filteredDar = filteredAll.filter(m => getMemberLocationGroup(m) === 'Dar es Salaam');
        const filteredMkoani = filteredAll.filter(m => getMemberLocationGroup(m) === 'Mkoani');

        const renderMemberRow = (m: typeof members[0]) => {
          const att = (selectedMeeting.attendees || []).find(a => a.memberId === m.id) || {
            memberId: m.id,
            memberNo: m.memberNo,
            memberName: m.fullName,
            status: 'present' as const
          };
          const locGroup = getMemberLocationGroup(m);

          const updateStatus = (newStatus: 'present' | 'absent' | 'apology' | 'late') => {
            const updatedAttendees = members.map(mem => {
              if (mem.id === m.id) {
                let fineAmt = 0;
                if (newStatus === 'absent') {
                  fineAmt = state.groupSettings.meetingFineDefault || 10000;
                } else if (newStatus === 'late') {
                  fineAmt = state.groupSettings.meetingFineLateDefault || 2000;
                }
                return {
                  memberId: mem.id,
                  memberNo: mem.memberNo,
                  memberName: mem.fullName,
                  status: newStatus,
                  fineAmount: fineAmt,
                  finePaid: false
                };
              }
              const existing = (selectedMeeting.attendees || []).find(a => a.memberId === mem.id);
              return existing || {
                memberId: mem.id,
                memberNo: mem.memberNo,
                memberName: mem.fullName,
                status: 'present' as const
              };
            });
            handleUpdateAttendance(updatedAttendees);
          };

          const toggleFinePaid = () => {
            const updatedAttendees = members.map(mem => {
              const existing = (selectedMeeting.attendees || []).find(a => a.memberId === mem.id);
              if (mem.id === m.id) {
                const defaultFine = att.status === 'late' ? (state.groupSettings.meetingFineLateDefault || 2000) : (state.groupSettings.meetingFineDefault || 10000);
                return {
                  memberId: mem.id,
                  memberNo: mem.memberNo,
                  memberName: mem.fullName,
                  status: att.status,
                  fineAmount: att.fineAmount || defaultFine,
                  finePaid: !att.finePaid
                };
              }
              return existing || {
                memberId: mem.id,
                memberNo: mem.memberNo,
                memberName: mem.fullName,
                status: 'present' as const
              };
            });
            handleUpdateAttendance(updatedAttendees);
          };

          return (
            <div key={m.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-emerald-400 mr-1">{m.memberNo}</span>
                  <span className="font-semibold text-white">{m.fullName}</span>
                  <span className="text-slate-500">({m.role})</span>

                  {/* Location Group Badge & Switcher */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                    locGroup === 'Dar es Salaam'
                      ? 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                      : 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                  }`}>
                    {locGroup === 'Dar es Salaam' ? <Building2 className="w-3 h-3 text-blue-400" /> : <Globe className="w-3 h-3 text-purple-400" />}
                    {locGroup} {m.residence ? `(${m.residence})` : ''}
                  </span>

                  {/* Quick Toggle Location */}
                  <button
                    type="button"
                    onClick={() => handleToggleMemberLocation(m.id, locGroup === 'Dar es Salaam' ? 'Mkoani' : 'Dar es Salaam')}
                    className="text-[10px] text-slate-500 hover:text-slate-300 underline cursor-pointer"
                    title="Badili Kundi (Dar / Mkoani)"
                  >
                    Badili Kundi
                  </button>
                  
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      type="button"
                      onClick={() => handleOpenBroadcastModal('official_invitation', 'single', m.id)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 hover:bg-blue-600 text-blue-400 hover:text-white text-[10.5px] font-semibold border border-blue-500/20 transition-all cursor-pointer"
                      title={`Tuma SMS ya Kikao kwa ${m.fullName}`}
                    >
                      <Send className="w-2.5 h-2.5" />
                      SMS
                    </button>
                    {m.phone && (
                      <button
                        type="button"
                        onClick={() => openMemberWhatsApp(m.phone, getMeetingMessageTemplate('official_invitation'), m.fullName)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-600 text-emerald-400 hover:text-white text-[10.5px] font-semibold border border-emerald-500/20 transition-all cursor-pointer"
                        title={`Tuma WhatsApp ya Kikao kwa ${m.fullName}`}
                      >
                        <Share2 className="w-2.5 h-2.5" />
                        WA
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => updateStatus('present')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      att.status === 'present'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ✓ Ahudhuria
                  </button>
                  <button
                    onClick={() => updateStatus('late')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      att.status === 'late'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ⏱ Kuchelewa
                  </button>
                  <button
                    onClick={() => updateStatus('apology')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      att.status === 'apology'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ⏱ Udhuru
                  </button>
                  <button
                    onClick={() => updateStatus('absent')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      att.status === 'absent'
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ✕ Hakuhudhuria
                  </button>
                </div>
              </div>

              {(att.status === 'absent' || att.status === 'late' || (att.fineAmount && att.fineAmount > 0)) && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-900 text-[11px]">
                  <span className="text-rose-400 font-medium">
                    Faini ya {att.status === 'late' ? 'Kuchelewa' : 'Utoro'}: <strong>TZS {(att.fineAmount || (att.status === 'late' ? (state.groupSettings.meetingFineLateDefault || 2000) : (state.groupSettings.meetingFineDefault || 10000))).toLocaleString()}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={toggleFinePaid}
                      className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all cursor-pointer ${
                        att.finePaid
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-emerald-500/20 hover:text-emerald-300'
                      }`}
                    >
                      {att.finePaid ? '✓ Faini Imelipwa' : '✗ Deni (Weka Imelipwa)'}
                    </button>

                    {!att.finePaid && (
                      <>
                        <button
                          onClick={() => {
                            setFineModalMemberId(m.id);
                            setFineModalMeetingId(selectedMeeting.id);
                            setFineModalAmount(att.fineAmount || (att.status === 'late' ? (state.groupSettings.meetingFineLateDefault || 2000) : (state.groupSettings.meetingFineDefault || 10000)));
                            setIsFinePaymentModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] shadow-sm transition-all cursor-pointer"
                        >
                          <Receipt className="w-3 h-3" />
                          Lipia & Risiti
                        </button>

                        {onOpenSmsWithTemplate && (
                          <button
                            onClick={() => {
                              const amount = (att.fineAmount || (att.status === 'late' ? (state.groupSettings.meetingFineLateDefault || 2000) : (state.groupSettings.meetingFineDefault || 10000))).toLocaleString();
                              const text = `Habari ${m.fullName} (${m.memberNo}), Taarifa ya UWALEMI: Unakumbushwa kulipa faini ya ${att.status === 'late' ? 'kuchelewa' : 'kutohudhuria'} ${selectedMeeting.title} ya tarehe ${selectedMeeting.date} kiasi cha TZS ${amount}. Tafadhali lipa kupitia M Koba au 0758 219 298 Eva O Lema. Lema, Nguvu Moja!`;
                              onOpenSmsWithTemplate([{
                                name: m.fullName,
                                phone: m.phone || '',
                                memberNo: m.memberNo
                              }], text);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-rose-600 hover:text-white font-semibold text-[11px] transition-all cursor-pointer border border-slate-700"
                            title="Tuma SMS ya faini ya kikao"
                          >
                            <Send className="w-3 h-3" />
                            SMS
                          </button>
                        )}

                        {m.phone && (
                          <button
                            onClick={() => {
                              const cleanPhone = (m.phone || '').replace(/[^0-9]/g, '');
                              const fullPhone = cleanPhone.startsWith('0') ? '255' + cleanPhone.substring(1) : cleanPhone;
                              const amount = (att.fineAmount || (att.status === 'late' ? (state.groupSettings.meetingFineLateDefault || 2000) : (state.groupSettings.meetingFineDefault || 10000))).toLocaleString();
                              const text = `Habari ${m.fullName} (${m.memberNo}), Taarifa ya UWALEMI: Unakumbushwa kulipa faini ya ${att.status === 'late' ? 'kuchelewa' : 'kutohudhuria'} ${selectedMeeting.title} ya tarehe ${selectedMeeting.date} kiasi cha TZS ${amount}. Tafadhali lipa kupitia M Koba au 0758 219 298 Eva O Lema. Lema, Nguvu Moja!`;
                              window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`, '_blank');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 hover:bg-emerald-600 hover:text-white font-semibold text-[11px] transition-all cursor-pointer border border-emerald-800/50"
                            title="Tuma WhatsApp ya faini ya kikao"
                          >
                            <Share2 className="w-3 h-3" />
                            WA
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" />
                    Daftari la Mahudhurio: {selectedMeeting.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tarehe: {selectedMeeting.date} • Eneo: {selectedMeeting.location} • Makundi: 1. Dar es Salaam | 2. Mkoani
                  </p>
                </div>
                <button onClick={() => setIsAttendanceModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Location Group Tabs & Search Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                {/* 1. Dar es Salaam & 2. Mkoani Group Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
                  <button
                    type="button"
                    onClick={() => setAttendanceLocationFilter('all')}
                    className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      attendanceLocationFilter === 'all'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    👥 Wote ({members.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setAttendanceLocationFilter('Dar es Salaam')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      attendanceLocationFilter === 'Dar es Salaam'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-blue-400 hover:bg-blue-950/40'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    1. Dar es Salaam ({darMembers.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setAttendanceLocationFilter('Mkoani')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      attendanceLocationFilter === 'Mkoani'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-purple-400 hover:bg-purple-950/40'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    2. Mkoani ({mkoaniMembers.length})
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Tafuta jina, namba, makazi..."
                    value={attendanceSearch}
                    onChange={(e) => setAttendanceSearch(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-white text-xs w-full sm:w-56 placeholder-slate-500"
                  />
                </div>
              </div>

              {/* Quick Batch Actions for Groups */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl text-xs">
                <span className="text-slate-400 text-[11px] font-semibold flex items-center gap-1">
                  ⚡ Hatua za Haraka kwa Makundi:
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleMarkGroupAttendance('Dar es Salaam', 'present')}
                    className="px-2.5 py-1 rounded-lg bg-blue-900/30 hover:bg-blue-600 text-blue-300 hover:text-white text-[11px] font-semibold border border-blue-700/40 transition-all cursor-pointer"
                  >
                    ✓ Weka Wote wa Dar Wamehudhuria
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMarkGroupAttendance('Mkoani', 'present')}
                    className="px-2.5 py-1 rounded-lg bg-purple-900/30 hover:bg-purple-600 text-purple-300 hover:text-white text-[11px] font-semibold border border-purple-700/40 transition-all cursor-pointer"
                  >
                    ✓ Weka Wote wa Mkoani Wamehudhuria
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMarkGroupAttendance('Mkoani', 'apology')}
                    className="px-2.5 py-1 rounded-lg bg-amber-900/30 hover:bg-amber-600 text-amber-300 hover:text-white text-[11px] font-semibold border border-amber-700/40 transition-all cursor-pointer"
                  >
                    ⏱ Weka Wote wa Mkoani Wana Udhuru
                  </button>
                </div>
              </div>

              {/* Members Attendance List Grouped */}
              <div className="max-h-[58vh] overflow-y-auto space-y-4 pr-1">
                {/* 1. Dar es Salaam Section */}
                {(attendanceLocationFilter === 'all' || attendanceLocationFilter === 'Dar es Salaam') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-blue-950/40 border border-blue-800/40 px-3 py-2 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-400" />
                        <span className="font-bold text-xs text-blue-300 uppercase tracking-wide">
                          1. Kundi la Dar es Salaam ({filteredDar.length})
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Wamehudhuria: <strong className="text-emerald-400">{darPresentCount}</strong> • Udhuru: <strong className="text-amber-400">{darApologyCount}</strong> • Utoro: <strong className="text-rose-400">{darAbsentCount}</strong>
                      </span>
                    </div>

                    {filteredDar.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 text-center bg-slate-950 rounded-xl border border-slate-800">
                        Hakuna mwanachama aliyepatikana katika kundi la Dar es Salaam.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filteredDar.map(renderMemberRow)}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Mkoani Section */}
                {(attendanceLocationFilter === 'all' || attendanceLocationFilter === 'Mkoani') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-purple-950/40 border border-purple-800/40 px-3 py-2 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-purple-400" />
                        <span className="font-bold text-xs text-purple-300 uppercase tracking-wide">
                          2. Kundi la Mkoani ({filteredMkoani.length})
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Wamehudhuria: <strong className="text-emerald-400">{mkoaniPresentCount}</strong> • Udhuru: <strong className="text-amber-400">{mkoaniApologyCount}</strong> • Utoro: <strong className="text-rose-400">{mkoaniAbsentCount}</strong>
                      </span>
                    </div>

                    {filteredMkoani.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 text-center bg-slate-950 rounded-xl border border-slate-800">
                        Hakuna mwanachama aliyepatikana katika kundi la Mkoani.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filteredMkoani.map(renderMemberRow)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-800">
                <button
                  onClick={() => setIsAttendanceModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer shadow-lg shadow-emerald-900/30"
                >
                  Hifadhi na Funga
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: MINUTES & RESOLUTIONS */}
      {isMinutesModalOpen && selectedMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                Muhtasari & Maazimio ya Kikao
              </h3>
              <button onClick={() => setIsMinutesModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Muhtasari wa Kikao (Minutes Summary)</label>
                <textarea
                  rows={6}
                  value={minutesText}
                  onChange={(e) => setMinutesText(e.target.value)}
                  placeholder="Andika muhtasari wa yaliyojadiliwa katika kikao hiki..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Maazimio Yaliyofikiwa (Resolutions)</label>
                <div className="space-y-1.5 mb-2">
                  {resolutionsList.map((res, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800 text-slate-300">
                      <span>✓ {res}</span>
                      <button
                        onClick={() => setResolutionsList(resolutionsList.filter((_, i) => i !== idx))}
                        className="text-rose-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newResolutionInput}
                    onChange={(e) => setNewResolutionInput(e.target.value)}
                    placeholder="Andika azimio jipya..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newResolutionInput.trim()) {
                        e.preventDefault();
                        setResolutionsList([...resolutionsList, newResolutionInput.trim()]);
                        setNewResolutionInput('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newResolutionInput.trim()) {
                        setResolutionsList([...resolutionsList, newResolutionInput.trim()]);
                        setNewResolutionInput('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 font-semibold cursor-pointer"
                  >
                    + Ongeza Azimio
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsMinutesModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Ghairi
              </button>
              <button
                onClick={handleSaveMinutes}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 cursor-pointer"
              >
                Hifadhi Muhtasari
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MEETING BROADCAST & SMS/WHATSAPP CENTER */}
      {isBroadcastModalOpen && selectedMeeting && (() => {
        let currentRecipients: typeof members = [];
        if (broadcastTarget === 'all') {
          currentRecipients = members.filter(m => m.status === 'active');
        } else if (broadcastTarget === 'dar') {
          currentRecipients = members.filter(m => m.status === 'active' && getMemberLocationGroup(m) === 'Dar es Salaam');
        } else if (broadcastTarget === 'mkoani') {
          currentRecipients = members.filter(m => m.status === 'active' && getMemberLocationGroup(m) === 'Mkoani');
        } else if (broadcastTarget === 'single') {
          const single = members.find(m => m.id === selectedSingleMemberId);
          currentRecipients = single ? [single] : [];
        } else if (broadcastTarget === 'selected') {
          currentRecipients = members.filter(m => selectedCustomMemberIds.includes(m.id));
        } else if (broadcastTarget === 'absent') {
          const absentIds = attendees.filter(a => a.status === 'absent').map(a => a.memberId);
          currentRecipients = members.filter(m => absentIds.includes(m.id));
        } else if (broadcastTarget === 'late') {
          const lateIds = attendees.filter(a => a.status === 'late').map(a => a.memberId);
          currentRecipients = members.filter(m => lateIds.includes(m.id));
        } else if (broadcastTarget === 'unconfirmed') {
          const apologyIds = attendees.filter(a => a.status === 'apology').map(a => a.memberId);
          currentRecipients = members.filter(m => apologyIds.includes(m.id));
        } else if (broadcastTarget === 'leaders') {
          currentRecipients = members.filter(m => m.role && m.role !== 'Mjumbe');
        }

        const activeDarCount = members.filter(m => m.status === 'active' && getMemberLocationGroup(m) === 'Dar es Salaam').length;
        const activeMkoaniCount = members.filter(m => m.status === 'active' && getMemberLocationGroup(m) === 'Mkoani').length;

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-400" />
                  Kituo cha Jumbe na Wito wa Kikao
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kikao: <strong className="text-slate-200">{selectedMeeting.title}</strong> (Na. {selectedMeeting.meetingNo})
                </p>
              </div>
              <button onClick={() => setIsBroadcastModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Template Presets Selector */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1.5">
                  Chagua Aina ya Ujumbe / Kiolezo:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTemplateType('official_invitation');
                      setBroadcastCustomText(getMeetingMessageTemplate('official_invitation'));
                    }}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      broadcastTemplateType === 'official_invitation'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold block text-[11.5px] text-white">📜 Wito Rasmi</span>
                    <span className="text-[10px] text-slate-400 mt-1">Ujumbe rasmi wa kisheria na ada</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTemplateType('reminder_urgent');
                      setBroadcastCustomText(getMeetingMessageTemplate('reminder_urgent'));
                    }}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      broadcastTemplateType === 'reminder_urgent'
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold block text-[11.5px] text-white">⏰ Kumbukizi ya Haraka</span>
                    <span className="text-[10px] text-slate-400 mt-1">Kabla ya kikao kuanza</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTemplateType('resolutions_feedback');
                      setBroadcastCustomText(getMeetingMessageTemplate('resolutions_feedback'));
                    }}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      broadcastTemplateType === 'resolutions_feedback'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold block text-[11.5px] text-white">📋 Maazimio ya Kikao</span>
                    <span className="text-[10px] text-slate-400 mt-1">Taarifa baada ya kikao</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTemplateType('fine_absentee');
                      setBroadcastCustomText(getMeetingMessageTemplate('fine_absentee'));
                      setBroadcastTarget('absent');
                    }}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      broadcastTemplateType === 'fine_absentee'
                        ? 'bg-rose-600/20 border-rose-500 text-rose-300 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold block text-[11.5px] text-white">⚠️ Faini ya Utoro</span>
                    <span className="text-[10px] text-slate-400 mt-1">Kwa wasiohudhuria tu</span>
                  </button>
                </div>
              </div>

              {/* Target Mode Tabs */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1.5">
                  Tuma Kwa: (Mmoja Mmoja, Makundi au Pamoja)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setBroadcastTarget('all')}
                    className={`py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer text-center ${
                      broadcastTarget === 'all'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    👥 Wote ({members.filter(m => m.status === 'active').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastTarget('dar')}
                    className={`py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer text-center ${
                      broadcastTarget === 'dar'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-blue-400 hover:text-blue-300'
                    }`}
                  >
                    🏢 1. Dar ({activeDarCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastTarget('mkoani')}
                    className={`py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer text-center ${
                      broadcastTarget === 'mkoani'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-purple-400 hover:text-purple-300'
                    }`}
                  >
                    🌍 2. Mkoani ({activeMkoaniCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTarget('single');
                      if (!selectedSingleMemberId && members.length > 0) {
                        setSelectedSingleMemberId(members[0].id);
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer text-center ${
                      broadcastTarget === 'single'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    👤 Mmoja Mmoja
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastTarget('selected')}
                    className={`py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer text-center ${
                      broadcastTarget === 'selected'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ☑️ Chagua ({selectedCustomMemberIds.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastTarget('absent')}
                    className={`py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer text-center ${
                      broadcastTarget === 'absent'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ❌ Watoro ({attendees.filter(a => a.status === 'absent').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastTarget('late')}
                    className={`py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer text-center ${
                      broadcastTarget === 'late'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ⏱ Kuchelewa ({attendees.filter(a => a.status === 'late').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastTarget('unconfirmed')}
                    className={`py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer text-center ${
                      broadcastTarget === 'unconfirmed'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ⏱ Udhuru ({attendees.filter(a => a.status === 'apology').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastTarget('leaders')}
                    className={`py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer text-center ${
                      broadcastTarget === 'leaders'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    👑 Viongozi ({members.filter(m => m.role && m.role !== 'Mjumbe').length})
                  </button>
                </div>
              </div>

              {/* SINGLE MEMBER SELECTOR VIEW */}
              {broadcastTarget === 'single' && (
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-indigo-500/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-indigo-300 font-bold text-xs flex items-center gap-1.5">
                      <User className="w-4 h-4 text-indigo-400" />
                      Chagua Mwanachama Unayetaka Kumtumia Ujumbe Huu:
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Tafuta jina au namba..."
                        value={memberFilterSearch}
                        onChange={(e) => setMemberFilterSearch(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-white text-xs w-48 placeholder-slate-500"
                      />
                    </div>
                  </div>

                  <select
                    value={selectedSingleMemberId}
                    onChange={(e) => setSelectedSingleMemberId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-medium"
                  >
                    {members
                      .filter(m => {
                        if (!memberFilterSearch) return true;
                        const query = memberFilterSearch.toLowerCase();
                        return (
                          m.fullName.toLowerCase().includes(query) ||
                          m.memberNo.toLowerCase().includes(query) ||
                          (m.phone && m.phone.includes(query))
                        );
                      })
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.memberNo} - {m.fullName} ({getMemberLocationGroup(m)} • {m.phone || 'Hana simu'}) • {m.role}
                        </option>
                      ))}
                  </select>

                  {/* Selected Member Details Card */}
                  {(() => {
                    const selectedSingle = members.find(m => m.id === selectedSingleMemberId);
                    if (!selectedSingle) return null;
                    const att = attendees.find(a => a.memberId === selectedSingle.id);
                    const locGroup = getMemberLocationGroup(selectedSingle);

                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-emerald-400">{selectedSingle.memberNo}</span>
                            <span className="font-bold text-white text-sm">{selectedSingle.fullName}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                              {selectedSingle.role}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
                              {locGroup}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] mt-0.5">
                            Simu: <strong className="text-slate-200">{selectedSingle.phone || 'Hajajaza namba'}</strong> • Hali Kikao: {' '}
                            <span className={
                              att?.status === 'present' ? 'text-emerald-400 font-bold' :
                              att?.status === 'apology' ? 'text-amber-400 font-bold' :
                              'text-rose-400 font-bold'
                            }>
                              {att?.status === 'present' ? 'Ahudhuria' : att?.status === 'apology' ? 'Udhuru' : 'Hakuhudhuria'}
                            </span>
                          </p>
                        </div>

                        {selectedSingle.phone && (
                          <button
                            type="button"
                            onClick={() => openMemberWhatsApp(selectedSingle.phone, broadcastCustomText, selectedSingle.fullName)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer shrink-0"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            Fungua WhatsApp Yake
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* CUSTOM MULTI-SELECT VIEW */}
              {broadcastTarget === 'selected' && (
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-purple-500/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-300 font-bold text-xs">
                        Chagua Wanachama ({selectedCustomMemberIds.length} wameteuliwa):
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomMemberIds(members.map(m => m.id))}
                        className="text-[11px] text-blue-400 hover:underline font-semibold cursor-pointer"
                      >
                        Chagua Wote
                      </button>
                      <span className="text-slate-600">•</span>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomMemberIds([])}
                        className="text-[11px] text-slate-400 hover:underline font-semibold cursor-pointer"
                      >
                        Ondoa Wote
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Tafuta jina au namba..."
                        value={memberFilterSearch}
                        onChange={(e) => setMemberFilterSearch(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-white text-xs w-44 placeholder-slate-500"
                      />
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {members
                      .filter(m => {
                        if (!memberFilterSearch) return true;
                        const query = memberFilterSearch.toLowerCase();
                        return (
                          m.fullName.toLowerCase().includes(query) ||
                          m.memberNo.toLowerCase().includes(query) ||
                          (m.phone && m.phone.includes(query))
                        );
                      })
                      .map(m => {
                        const isChecked = selectedCustomMemberIds.includes(m.id);
                        const locGroup = getMemberLocationGroup(m);
                        return (
                          <div
                            key={m.id}
                            onClick={() => {
                              if (isChecked) {
                                setSelectedCustomMemberIds(selectedCustomMemberIds.filter(id => id !== m.id));
                              } else {
                                setSelectedCustomMemberIds([...selectedCustomMemberIds, m.id]);
                              }
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-purple-950/40 border-purple-500/50 text-white'
                                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-purple-400 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600 shrink-0" />
                              )}
                              <span className="font-mono font-bold text-emerald-400">{m.memberNo}</span>
                              <span className="font-semibold text-slate-200">{m.fullName}</span>
                              <span className="text-[11px] text-slate-500">({m.role})</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                {locGroup}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">{m.phone || 'Hana namba'}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Channel Selector (SMS vs WhatsApp) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1 text-[11px]">
                    Njia ya Kutuma Ujumbe:
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBroadcastChannel('sms')}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        broadcastChannel === 'sms'
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      SMS Moja kwa Moja
                    </button>
                    <button
                      type="button"
                      onClick={() => setBroadcastChannel('whatsapp')}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        broadcastChannel === 'whatsapp'
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      WhatsApp
                    </button>
                  </div>
                </div>

                <div className="flex flex-col justify-center">
                  <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">Ufafanuzi wa Njia:</span>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    {broadcastChannel === 'sms'
                      ? 'SMS inafungua kituo cha kutuma SMS kwa walengwa wote kwa jina binafsi la kila mwanachama.'
                      : broadcastTarget === 'single'
                      ? 'WhatsApp itafungua chat ya WhatsApp ya mwanachama huyu moja kwa moja akiwa na jina lake.'
                      : 'WhatsApp itafungua ujumbe tayari kushirikiwa kwenye Group la WhatsApp la UWALEMI.'}
                  </p>
                </div>
              </div>

              {/* Message Editor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">
                    Ujumbe (Unaweza kuhariri au kuongeza taarifa):
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {broadcastCustomText.length} herufi
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={broadcastCustomText}
                  onChange={(e) => setBroadcastCustomText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-mono leading-relaxed"
                />
              </div>

              {/* Recipient Count Summary */}
              <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-800/40 text-[11.5px] text-blue-300 flex items-center justify-between">
                <span>
                  👥 Jumla ya walengwa walioteuliwa: <strong className="text-white">{currentRecipients.length}</strong> {broadcastTarget === 'single' && currentRecipients[0] ? `(${currentRecipients[0].fullName})` : ''}
                </span>
                <span className="text-slate-400 text-[11px]">
                  Kigezo <code>{`{name}`}</code> kitajaza jina halisi la mwanachama
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-800">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(broadcastCustomText);
                    setCopiedBroadcast(true);
                    setTimeout(() => setCopiedBroadcast(false), 2500);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer border border-slate-700"
                >
                  {copiedBroadcast ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedBroadcast ? 'Imenakiliwa!' : 'Nakili Ujumbe'}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsBroadcastModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Ghairi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (currentRecipients.length === 0) {
                      alert('Tafadhali chagua mwanachama au kundi la walengwa kwanza.');
                      return;
                    }

                    if (broadcastChannel === 'whatsapp') {
                      if (broadcastTarget === 'single' && currentRecipients[0]) {
                        openMemberWhatsApp(currentRecipients[0].phone, broadcastCustomText, currentRecipients[0].fullName);
                      } else {
                        const sampleText = broadcastCustomText.replace('{name}', 'Wana-UWALEMI');
                        window.open(`https://wa.me/?text=${encodeURIComponent(sampleText)}`, '_blank');
                      }
                      setIsBroadcastModalOpen(false);
                      return;
                    }

                    const recipients = currentRecipients.map(m => ({
                      name: m.fullName,
                      phone: m.phone || '',
                      memberNo: m.memberNo,
                      memberId: m.id
                    }));

                    if (onOpenSmsWithTemplate) {
                      onOpenSmsWithTemplate(recipients, broadcastCustomText);
                      setIsBroadcastModalOpen(false);
                    }
                  }}
                  className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-xs font-bold shadow-lg transition-all cursor-pointer ${
                    broadcastChannel === 'whatsapp'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
                      : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  {broadcastChannel === 'whatsapp'
                    ? (broadcastTarget === 'single' ? 'Fungua WhatsApp Binafsi' : 'Tuma kwenye WhatsApp Group')
                    : (broadcastTarget === 'single' ? 'Tuma SMS kwa Mwanachama' : `Tuma SMS kwa Walengwa (${currentRecipients.length})`)}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Fine Payment Modal */}
      <UwalemiFinePaymentModal
        isOpen={isFinePaymentModalOpen}
        onClose={() => setIsFinePaymentModalOpen(false)}
        state={state}
        onSaveState={onSaveState}
        initialMemberId={fineModalMemberId}
        initialMeetingId={fineModalMeetingId}
        initialFineType="kikao"
        initialAmount={fineModalAmount}
        onOpenSmsWithTemplate={onOpenSmsWithTemplate}
      />
    </div>
  );
};
