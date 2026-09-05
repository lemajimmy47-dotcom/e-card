import React, { useState, useRef } from 'react';
import { UwalemiState, UwalemiMember, UwalemiMemberRole, UwalemiMemberStatus } from '../../types/uwalemi';
import { sortMembersByLeadership } from '../../services/uwalemiService';
import { 
  Users, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  FileSpreadsheet, 
  QrCode, 
  ExternalLink,
  CreditCard,
  UserCheck,
  Upload,
  Download,
  FileText,
  AlertCircle,
  RefreshCw,
  X,
  Check,
  Receipt,
  Scale
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { UwalemiFinePaymentModal } from './UwalemiFinePaymentModal';
import { calculateMemberFeeDebt } from '../../services/uwalemiService';

interface Props {
  state: UwalemiState;
  onSaveState: (state: UwalemiState) => Promise<boolean>;
  onOpenSmsForMember?: (member: UwalemiMember) => void;
}

export const UwalemiMembers: React.FC<Props> = ({ state, onSaveState, onOpenSmsForMember }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [regFeeFilter, setRegFeeFilter] = useState<string>('all');
  
  // Modals
  const [editingMember, setEditingMember] = useState<UwalemiMember | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [viewingStatementMember, setViewingStatementMember] = useState<UwalemiMember | null>(null);
  const [viewingCardMember, setViewingCardMember] = useState<UwalemiMember | null>(null);

  // Fine Payment Modal
  const [isFinePaymentModalOpen, setIsFinePaymentModalOpen] = useState(false);
  const [fineModalMemberId, setFineModalMemberId] = useState<string | undefined>(undefined);
  const [fineModalMeetingId, setFineModalMeetingId] = useState<string | undefined>(undefined);
  const [fineModalType, setFineModalType] = useState<'kikao' | 'ada_late_fee' | 'nyingine'>('kikao');
  const [fineModalAmount, setFineModalAmount] = useState<number | undefined>(undefined);

  // Custom Confirmation Dialog States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<{ id: string; name: string } | null>(null);
  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false);
  const [clearAllInput, setClearAllInput] = useState('');
  const [clearPaymentsWithMembers, setClearPaymentsWithMembers] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // Multi-Selection State
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [deleteSelectedConfirmOpen, setDeleteSelectedConfirmOpen] = useState(false);

  // Bulk Import State
  const [bulkInputMode, setBulkInputMode] = useState<'file' | 'paste'>('file');
  const [pasteText, setPasteText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<Partial<UwalemiMember>[]>([]);
  const [importAction, setImportAction] = useState<'replace' | 'append'>('append');
  const [bulkError, setBulkError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const members = state.members || [];
  const nextMemberNumber = `UWL-${String(members.length + 1).padStart(3, '0')}`;

  const [formData, setFormData] = useState<Partial<UwalemiMember>>({
    memberNo: nextMemberNumber,
    fullName: '',
    phone: '',
    email: '',
    residence: 'Dar es Salaam',
    role: 'Mjumbe',
    status: 'active',
    registrationFeePaid: false,
    registrationFeeAmount: 0,
    monthlyFeeAmount: 0,
    nextOfKin: { name: '', relation: 'Mwenzi', phone: '' },
    notes: ''
  });

  // Calculate Registration (Kiingilio) Statistics
  const totalRegFeesExpected = members.reduce((sum, m) => sum + (Number(m.registrationFeeAmount) || 0), 0);
  const totalRegFeesCollected = members.reduce((sum, m) => sum + (m.registrationFeePaid ? (Number(m.registrationFeeAmount) || 0) : 0), 0);
  const paidRegMembersCount = members.filter(m => m.registrationFeePaid).length;
  const unpaidRegMembersCount = members.filter(m => !m.registrationFeePaid).length;

  const filteredMembers = sortMembersByLeadership(members.filter(m => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      m.fullName.toLowerCase().includes(term) ||
      m.memberNo.toLowerCase().includes(term) ||
      m.phone.includes(term) ||
      (m.residence && m.residence.toLowerCase().includes(term));
    
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchesRegFee = 
      regFeeFilter === 'all' || 
      (regFeeFilter === 'paid' && m.registrationFeePaid) || 
      (regFeeFilter === 'unpaid' && !m.registrationFeePaid);

    return matchesSearch && matchesRole && matchesStatus && matchesRegFee;
  }));

  const handleToggleRegFee = async (member: UwalemiMember) => {
    const newStatus = !member.registrationFeePaid;
    const updatedMembers = members.map(m => 
      m.id === member.id ? { ...m, registrationFeePaid: newStatus } : m
    );
    await onSaveState({ ...state, members: updatedMembers });
  };

  // Phone Normalizer helper
  const normalizePhone = (phoneInput: string | number | undefined): string => {
    if (!phoneInput) return '';
    let p = String(phoneInput).trim().replace(/[^\d+]/g, '');
    if (p.startsWith('0')) {
      p = '+255' + p.substring(1);
    } else if (p.startsWith('255')) {
      p = '+' + p;
    } else if (p.length === 9 && !p.startsWith('+')) {
      p = '+255' + p;
    }
    return p;
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone || !formData.memberNo) {
      alert('Tafadhali jaza Jina Kamili, Namba ya Mwanachama, na Namba ya Simu.');
      return;
    }

    let updatedMembers = [...members];
    const cleanedPhone = normalizePhone(formData.phone);

    if (editingMember) {
      updatedMembers = updatedMembers.map(m => 
        m.id === editingMember.id ? { ...m, ...formData, phone: cleanedPhone } as UwalemiMember : m
      );
    } else {
      const newMember: UwalemiMember = {
        id: `uwl-mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        memberNo: (formData.memberNo || nextMemberNumber).toUpperCase(),
        fullName: formData.fullName.trim(),
        phone: cleanedPhone,
        email: formData.email ? formData.email.trim() : '',
        residence: formData.residence?.trim() || 'Dar es Salaam',
        joinDate: formData.joinDate || new Date().toISOString().split('T')[0],
        role: (formData.role as UwalemiMemberRole) || 'Mjumbe',
        status: (formData.status as UwalemiMemberStatus) || 'active',
        registrationFeePaid: formData.registrationFeePaid ?? false,
        registrationFeeAmount: Number(formData.registrationFeeAmount) || 0,
        monthlyFeeAmount: Number(formData.monthlyFeeAmount) || 0,
        nextOfKin: {
          name: formData.nextOfKin?.name?.trim() || 'Mwanafamilia',
          relation: formData.nextOfKin?.relation?.trim() || 'Mwenzi',
          phone: normalizePhone(formData.nextOfKin?.phone) || cleanedPhone
        },
        notes: formData.notes?.trim() || ''
      };
      updatedMembers.push(newMember);
    }

    // Sort by memberNo naturally
    updatedMembers.sort((a, b) => a.memberNo.localeCompare(b.memberNo, undefined, { numeric: true, sensitivity: 'base' }));

    const updatedState = { ...state, members: updatedMembers };
    await onSaveState(updatedState);
    setIsAddModalOpen(false);
    setEditingMember(null);
  };

  const handleDeleteMember = (id: string, name: string) => {
    setMemberToDelete({ id, name });
    setDeleteConfirmOpen(true);
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMemberIds(filteredMembers.map(m => m.id));
    } else {
      setSelectedMemberIds([]);
    }
  };

  const handleToggleSelectMember = (id: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedMembers = async () => {
    if (selectedMemberIds.length === 0) return;
    setIsDeleting(true);
    try {
      const selectedSet = new Set(selectedMemberIds);
      const remainingMembers = members.filter(m => !selectedSet.has(m.id));
      const remainingMonthlyPayments = (state.monthlyPayments || []).filter(p => !selectedSet.has(p.memberId));
      const updatedEmergencyFunds = (state.emergencyFunds || []).map(ef => ({
        ...ef,
        payments: (ef.payments || []).filter(p => !selectedSet.has(p.memberId))
      }));
      const updatedMeetings = (state.meetings || []).map(m => ({
        ...m,
        attendees: (m.attendees || []).filter(a => !selectedSet.has(a.memberId))
      }));

      const updatedState: UwalemiState = {
        ...state,
        members: remainingMembers,
        monthlyPayments: remainingMonthlyPayments,
        emergencyFunds: updatedEmergencyFunds,
        meetings: updatedMeetings
      };

      await onSaveState(updatedState);
      setSelectedMemberIds([]);
      setDeleteSelectedConfirmOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAllMembers = () => {
    setClearAllConfirmOpen(true);
    setClearAllInput('');
  };

  const executeClearAllMembers = async () => {
    setIsDeleting(true);
    try {
      const updatedEmergencyFunds = clearPaymentsWithMembers 
        ? (state.emergencyFunds || []).map(ef => ({ ...ef, payments: [] }))
        : (state.emergencyFunds || []);
        
      const updatedMeetings = clearPaymentsWithMembers 
        ? (state.meetings || []).map(m => ({ ...m, attendees: [] }))
        : (state.meetings || []);

      const updatedState: UwalemiState = {
        ...state,
        members: [],
        monthlyPayments: clearPaymentsWithMembers ? [] : (state.monthlyPayments || []),
        emergencyFunds: updatedEmergencyFunds,
        meetings: updatedMeetings
      };

      await onSaveState(updatedState);
      setSelectedMemberIds([]);
      setClearAllConfirmOpen(false);
      setClearAllInput('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (members.length === 0) {
      alert('Hakuna wanachama kwenye daftari la kupakua.');
      return;
    }
    const sortedList = sortMembersByLeadership(members);
    const exportData = sortedList.map((m, idx) => ({
      'Na.': idx + 1,
      'Namba ya Mwanachama': m.memberNo,
      'Jina Kamili': m.fullName,
      'Nafasi / Wadhifa': m.role,
      'Namba ya Simu': m.phone,
      'Barua Pepe': m.email || '-',
      'Makazi / Eneo': m.residence || 'Dar es Salaam',
      'Hali': m.status === 'active' ? 'Hai' : m.status === 'suspended' ? 'Amesitishwa' : 'Amejitoa',
      'Ada ya Kila Mwezi (TZS)': Number(m.monthlyFeeAmount) || 0,
      'Kiingilio (TZS)': Number(m.registrationFeeAmount) || 0,
      'Hali ya Kiingilio': m.registrationFeePaid ? 'Kimelipwa' : 'Deni (Hajalipa)',
      'Mtu wa Karibu - Jina': m.nextOfKin?.name || '-',
      'Mtu wa Karibu - Uhusiano': m.nextOfKin?.relation || '-',
      'Mtu wa Karibu - Simu': m.nextOfKin?.phone || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Wanachama UWALEMI');
    XLSX.writeFile(wb, `Orodha_Wanachama_UWALEMI_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Download Sample Template
  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    const sampleRows = [
      {
        'Namba ya Mwanachama': 'UWL-001',
        'Jina Kamili': 'Mfano Jina',
        'Namba ya Simu': '0712345678',
        'Wadhifa': 'Mjumbe',
        'Makazi': 'Dar es Salaam',
        'Barua Pepe': 'mfano@gmail.com',
        'Ada ya Mwezi': 0,
        'Kiingilio': 0,
        'Mtu wa Karibu - Jina': 'Mwanafamilia Mfano',
        'Mtu wa Karibu - Uhusiano': 'Mwenzi',
        'Mtu wa Karibu - Simu': '0712345678'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Wanachama');
    
    if (format === 'csv') {
      XLSX.writeFile(wb, 'Kiolezo_Wanachama_UWALEMI.csv', { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, 'Kiolezo_Wanachama_UWALEMI.xlsx');
    }
  };

  // Helper to parse key-value raw objects into standard UwalemiMember objects
  const processParsedRows = (rawRows: any[]): Partial<UwalemiMember>[] => {
    const list: Partial<UwalemiMember>[] = [];
    const startIndex = importAction === 'append' ? members.length : 0;

    rawRows.forEach((row, idx) => {
      // Find keys fuzzily
      const keys = Object.keys(row);
      const findVal = (possibleNames: string[]): any => {
        for (const k of keys) {
          const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const p of possibleNames) {
            if (cleanK.includes(p.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
              return row[k];
            }
          }
        }
        return undefined;
      };

      const fullName = findVal(['jina', 'name', 'full_name', 'mwanachama', 'member_name']);
      const phone = findVal(['simu', 'phone', 'mobile', 'telephone', 'namba_ya_simu']);
      
      // If row has no name and no phone, ignore
      if (!fullName && !phone) return;

      const memberNo = findVal(['namba_ya_mwanachama', 'member_no', 'namba', 'id', 'no', 'memberno']) 
        || `UWL-${String(startIndex + list.length + 1).padStart(3, '0')}`;
      
      const role = findVal(['wadhifa', 'cheo', 'role', 'position', 'nafasi']) || 'Mjumbe';
      const residence = findVal(['makazi', 'eneo', 'mahali', 'residence', 'address', 'location']) || 'Dar es Salaam';
      const email = findVal(['email', 'barua_pepe', 'barua']) || '';
      const monthlyFee = findVal(['ada', 'monthly_fee', 'fee', 'kiasi_cha_ada', 'ada_ya_mwezi']) || 0;
      const regFee = findVal(['kiingilio', 'registration_fee', 'ada_ya_usajili']) || 0;

      const kinName = findVal(['mtu_wa_karibu_jina', 'kin_name', 'next_of_kin', 'ndugu', 'jina_la_ndugu', 'kin']) || '';
      const kinRelation = findVal(['mtu_wa_karibu_uhusiano', 'uhusiano', 'kin_relation', 'relation']) || 'Mwenzi';
      const kinPhone = findVal(['mtu_wa_karibu_simu', 'kin_phone', 'simu_ya_ndugu', 'simu_ya_mtu_wa_karibu']) || '';

      list.push({
        memberNo: String(memberNo).trim().toUpperCase(),
        fullName: String(fullName || 'Mjumbe').trim(),
        phone: normalizePhone(phone),
        email: email ? String(email).trim() : '',
        residence: String(residence).trim(),
        role: (role as UwalemiMemberRole) || 'Mjumbe',
        status: 'active',
        registrationFeePaid: false,
        registrationFeeAmount: Number(regFee) || 0,
        monthlyFeeAmount: Number(monthlyFee) || 0,
        nextOfKin: {
          name: String(kinName || 'Mwanafamilia').trim(),
          relation: String(kinRelation || 'Mwenzi').trim(),
          phone: normalizePhone(kinPhone) || normalizePhone(phone)
        },
        notes: 'Imeingizwa kwa Excel/CSV'
      });
    });

    return list;
  };

  // Handle Excel / CSV File upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBulkError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const jsonData = XLSX.utils.sheet_to_json(ws);

        if (!Array.isArray(jsonData) || jsonData.length === 0) {
          setBulkError('Faili halina data au halikusomeka vizuri. Tafadhali hakikisha lina vichwa vya habari na safu za wanachama.');
          return;
        }

        const membersList = processParsedRows(jsonData);
        if (membersList.length === 0) {
          setBulkError('Hakuna wanachama waliotambuliwa. Hakikisha faili lina safu ya "Jina Kamili" na "Namba ya Simu".');
          return;
        }

        setParsedPreview(membersList);
      } catch (err: any) {
        setBulkError(`Hitilafu ya kusoma faili: ${err.message || 'Muundo usio sahihi'}`);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Handle Paste CSV / Tab-separated text
  const handleParsePastedText = () => {
    setBulkError(null);
    if (!pasteText.trim()) {
      setBulkError('Tafadhali bandika maandishi ya wanachama kwanza.');
      return;
    }

    try {
      const lines = pasteText.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        setBulkError('Hakuna mistari iliyopatikana.');
        return;
      }

      // Check delimiter (tab, comma, semicolon, or pipe)
      const firstLine = lines[0];
      let delimiter = '\t';
      if (firstLine.includes(',')) delimiter = ',';
      else if (firstLine.includes(';')) delimiter = ';';
      else if (firstLine.includes('|')) delimiter = '|';

      // If first line has headers
      const hasHeader = /jina|name|simu|phone|namba|member/i.test(firstLine);
      const headers = hasHeader 
        ? firstLine.split(delimiter).map(h => h.trim()) 
        : ['Namba ya Mwanachama', 'Jina Kamili', 'Namba ya Simu', 'Wadhifa', 'Makazi'];

      const startIdx = hasHeader ? 1 : 0;
      const rawRows: any[] = [];

      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(delimiter).map(p => p.trim());
        const rowObj: any = {};
        headers.forEach((h, hIdx) => {
          rowObj[h] = parts[hIdx] || '';
        });
        rawRows.push(rowObj);
      }

      const membersList = processParsedRows(rawRows);
      if (membersList.length === 0) {
        setBulkError('Hakuna wanachama waliotambuliwa toka kwenye maandishi uliyobandika.');
        return;
      }

      setParsedPreview(membersList);
    } catch (err: any) {
      setBulkError(`Hitilafu ya kuchakata maandishi: ${err.message}`);
    }
  };

  // Finalize Bulk Import
  const handleConfirmBulkImport = async () => {
    if (parsedPreview.length === 0) return;

    let updatedMembers: UwalemiMember[] = [];
    if (importAction === 'append') {
      updatedMembers = [...members];
    }

    const timestamp = Date.now();
    parsedPreview.forEach((p, idx) => {
      const memberId = `uwl-mem-${timestamp}-${idx}`;
      const newMember: UwalemiMember = {
        id: memberId,
        memberNo: p.memberNo || `UWL-${String(updatedMembers.length + 1).padStart(3, '0')}`,
        fullName: p.fullName || `Mjumbe ${updatedMembers.length + 1}`,
        phone: p.phone || '',
        email: p.email || '',
        residence: p.residence || 'Dar es Salaam',
        joinDate: new Date().toISOString().split('T')[0],
        role: (p.role as UwalemiMemberRole) || 'Mjumbe',
        status: 'active',
        registrationFeePaid: p.registrationFeePaid ?? false,
        registrationFeeAmount: Number(p.registrationFeeAmount) || 0,
        monthlyFeeAmount: Number(p.monthlyFeeAmount) || 0,
        nextOfKin: p.nextOfKin || { name: 'Mwanafamilia', relation: 'Mwenzi', phone: p.phone || '' },
        notes: p.notes || 'Bulk Import'
      };
      updatedMembers.push(newMember);
    });

    // Sort by memberNo
    updatedMembers.sort((a, b) => a.memberNo.localeCompare(b.memberNo, undefined, { numeric: true, sensitivity: 'base' }));

    const updatedState = { ...state, members: updatedMembers };
    await onSaveState(updatedState);
    setIsBulkModalOpen(false);
    setParsedPreview([]);
    setPasteText('');
    alert(`Wajumbe ${parsedPreview.length} wameingizwa kwenye mfumo wa UWALEMI kwa ufanisi!`);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12" id="uwalemi-members">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Daftari la Wanachama wa UWALEMI
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-bold border border-slate-700">
              {members.length} Wajumbe
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Weka na simamia wajumbe wa kikundi (mmoja mmoja au kwa wingi kupitia Excel/CSV).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Clear All button if list has members */}
          {members.length > 0 && (
            <button
              onClick={handleClearAllMembers}
              title="Futa wanachama wote waliopo na uanze upya"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-rose-400 text-xs font-semibold border border-slate-800 hover:border-rose-800/60 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Futa Wanachama Wote
            </button>
          )}

          {/* Download Excel */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            Pakua Excel
          </button>

          {/* Bulk Import Button */}
          <button
            onClick={() => {
              setParsedPreview([]);
              setPasteText('');
              setBulkError(null);
              setIsBulkModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Ingiza kwa Wingi (Excel / CSV)
          </button>

          {/* Add Single Member */}
          <button
            onClick={() => {
              setEditingMember(null);
              setFormData({
                memberNo: nextMemberNumber,
                fullName: '',
                phone: '',
                email: '',
                residence: 'Dar es Salaam',
                role: 'Mjumbe',
                status: 'active',
                registrationFeePaid: false,
                registrationFeeAmount: 0,
                monthlyFeeAmount: 0,
                nextOfKin: { name: '', relation: 'Mwenzi', phone: '' },
                notes: ''
              });
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Sajili Mwanachama Mpya
          </button>
        </div>
      </div>

      {/* Registration & Members Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Wanachama Waliosajiliwa</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {members.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Wajumbe hai: <span className="text-emerald-400 font-semibold">{members.filter(m => m.status === 'active').length}</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Waliolipa Kiingilio</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {paidRegMembersCount} <span className="text-xs text-slate-400 font-normal">/ {members.length}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Makusanyo: <span className="text-emerald-400 font-semibold">TZS {totalRegFeesCollected.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Madeni ya Kiingilio</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400">
            {unpaidRegMembersCount} <span className="text-xs text-slate-400 font-normal">wajumbe</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Deni la Kiingilio: <span className="text-rose-400 font-semibold">TZS {(totalRegFeesExpected - totalRegFeesCollected).toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Ada za Mwezi Zilizopangwa</span>
            <CreditCard className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400">
            TZS {members.reduce((sum, m) => sum + (Number(m.monthlyFeeAmount) || 0), 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Jumla kwa mwezi (Wajumbe wote)
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tafuta kwa jina, namba, simu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="all">Nafasi Zote (Wote)</option>
          <option value="Mwenyekiti">Mwenyekiti</option>
          <option value="Makamu Mwenyekiti">Makamu Mwenyekiti</option>
          <option value="Katibu">Katibu</option>
          <option value="Katibu Msaidizi">Katibu Msaidizi</option>
          <option value="Mweka Hazina">Mweka Hazina</option>
          <option value="Mweka Hazina Msaidizi">Mweka Hazina Msaidizi</option>
          <option value="Mjumbe">Mjumbe</option>
          <option value="Mlezi">Mlezi</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="all">Hali ya Uanachama (Zote)</option>
          <option value="active">Wajumbe Hai (Active)</option>
          <option value="inactive">Wasio Hai (Inactive)</option>
          <option value="suspended">Waliositishwa (Suspended)</option>
        </select>

        <select
          value={regFeeFilter}
          onChange={(e) => setRegFeeFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="all">Kiingilio (Wote)</option>
          <option value="paid">✓ Waliolipa Kiingilio</option>
          <option value="unpaid">✗ Wenye Deni la Kiingilio</option>
        </select>
      </div>

      {/* Members Grid / Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md">
        {/* Floating Batch Selection Bar */}
        {selectedMemberIds.length > 0 && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/30 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Umechagua wajumbe <strong>{selectedMemberIds.length}</strong> kati ya {members.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDeleteSelectedConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-md cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Futa Waliochaguliwa ({selectedMemberIds.length})
              </button>
              <button
                onClick={() => setSelectedMemberIds([])}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Acha Kuchagua
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredMembers.length > 0 && selectedMemberIds.length === filteredMembers.length}
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    title="Chagua wote"
                  />
                </th>
                <th className="py-3 px-3">Namba</th>
                <th className="py-3 px-4">Jina la Mjumbe</th>
                <th className="py-3 px-4">Wadhifa</th>
                <th className="py-3 px-4">Mawasiliano</th>
                <th className="py-3 px-4">Kiingilio (Once)</th>
                <th className="py-3 px-4">Mtu wa Karibu</th>
                <th className="py-3 px-4">Hali</th>
                <th className="py-3 px-4 text-right">Vitendo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="max-w-md mx-auto space-y-4">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                        <Users className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">Daftari la Wanachama Liko Wazi</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Hakuna wanachama waliosajiliwa kwa sasa. Unaweza kusajili mmoja mmoja au kupakia orodha ya wajumbe wote kwa mara moja kupitia Excel au CSV.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <button
                          onClick={() => {
                            setParsedPreview([]);
                            setPasteText('');
                            setBulkError(null);
                            setIsBulkModalOpen(true);
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-900/30 cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          Ingiza kwa Wingi (Excel / CSV)
                        </button>
                        <button
                          onClick={() => {
                            setEditingMember(null);
                            setFormData({
                              memberNo: nextMemberNumber,
                              fullName: '',
                              phone: '',
                              email: '',
                              residence: 'Dar es Salaam',
                              role: 'Mjumbe',
                              status: 'active',
                              registrationFeePaid: false,
                              registrationFeeAmount: 0,
                              monthlyFeeAmount: 0,
                              nextOfKin: { name: '', relation: 'Mwenzi', phone: '' },
                              notes: ''
                            });
                            setIsAddModalOpen(true);
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-900/30 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          Sajili Mwanachama wa Kwanza
                        </button>
                      </div>

                      <div className="pt-2 text-center">
                        <button
                          onClick={() => handleDownloadTemplate('xlsx')}
                          className="text-[11px] text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Pakua Kiolezo cha Excel cha Kujaza Wajumbe (Template)
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const isSelected = selectedMemberIds.includes(member.id);
                  return (
                  <tr key={member.id} className={`transition-colors ${isSelected ? 'bg-emerald-950/30 hover:bg-emerald-950/40' : 'hover:bg-slate-800/40'}`}>
                    <td className="py-3.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectMember(member.id)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-emerald-400">
                      {member.memberNo}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-[11px]">
                          {member.fullName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div>{member.fullName}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 font-normal">
                            <MapPin className="w-2.5 h-2.5 text-slate-500" />
                            {member.residence || 'Dar es Salaam'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        member.role === 'Mwenyekiti' || member.role === 'Makamu Mwenyekiti' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        member.role === 'Katibu' || member.role === 'Katibu Msaidizi' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                        member.role === 'Mweka Hazina' || member.role === 'Mweka Hazina Msaidizi' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {member.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-slate-300">
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span className="font-mono">{member.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {member.registrationFeePaid ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>TZS {(Number(member.registrationFeeAmount) || 0).toLocaleString()}</span>
                          <button
                            onClick={() => handleToggleRegFee(member)}
                            title="Bonyeza kubadili iwe haijalipwa"
                            className="ml-1 text-[10px] text-slate-500 hover:text-rose-400 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleToggleRegFee(member)}
                          title="Bonyeza hapa kuweka kuwa mwanachama amelipa kiingilio"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-emerald-500/20 border border-rose-500/30 hover:border-emerald-500/40 text-rose-300 hover:text-emerald-300 text-[11px] font-semibold transition-all cursor-pointer group"
                        >
                          <XCircle className="w-3.5 h-3.5 group-hover:hidden text-rose-400 shrink-0" />
                          <CheckCircle2 className="w-3.5 h-3.5 hidden group-hover:inline text-emerald-400 shrink-0" />
                          <span className="group-hover:hidden">Hajalipa (TZS {(Number(member.registrationFeeAmount) || 0).toLocaleString()})</span>
                          <span className="hidden group-hover:inline">Weka Kimelipwa</span>
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {member.nextOfKin?.name ? (
                        <div>
                          <div className="font-medium text-slate-200">{member.nextOfKin.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {member.nextOfKin.relation} • {member.nextOfKin.phone}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Haijawekwa</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        member.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        member.status === 'suspended' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {member.status === 'active' ? 'Hai' : member.status === 'suspended' ? 'Amesitishwa' : 'Amejitoa'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingCardMember(member)}
                          title="Kadi ya Mwanachama & QR Code"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setViewingStatementMember(member)}
                          title="Tazama Taarifa ya Michango"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 transition-colors cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingMember(member);
                            setFormData(member);
                            setIsAddModalOpen(true);
                          }}
                          title="Hariri Mjumbe"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMember(member.id, member.fullName)}
                          title="Futa Mjumbe"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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

      {/* MODAL: BULK IMPORT (EXCEL / CSV / PASTE) */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-400" />
                  Ingiza Wanachama kwa Wingi (Bulk Import)
                </h3>
                <p className="text-xs text-slate-400">
                  Pakia faili la Excel (.xlsx, .xls) au CSV, au bandika orodha moja kwa moja.
                </p>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Download Banner */}
            <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-emerald-200">Unahitaji kiolezo cha kuanzia?</div>
                  <div className="text-[11px] text-slate-300">Pakua mfano uliopangwa na vichwa vya habari (Headers).</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('xlsx')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('csv')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
              </div>
            </div>

            {/* Tabs for Upload vs Paste */}
            <div className="flex border-b border-slate-800">
              <button
                onClick={() => setBulkInputMode('file')}
                className={`py-2 px-4 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                  bulkInputMode === 'file'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                1. Pakia Faili la Excel / CSV
              </button>
              <button
                onClick={() => setBulkInputMode('paste')}
                className={`py-2 px-4 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                  bulkInputMode === 'paste'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                2. Bandika Maandishi (Copy & Paste)
              </button>
            </div>

            {/* Mode 1: File Upload */}
            {bulkInputMode === 'file' && (
              <div className="space-y-3">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-2xl p-8 text-center bg-slate-950/40 cursor-pointer transition-all"
                >
                  <Upload className="w-10 h-10 text-blue-400 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-semibold text-white">Bofya hapa au kokota faili lako hapa</p>
                  <p className="text-[11px] text-slate-400 mt-1">Inakubali Excel (.xlsx, .xls) au CSV (.csv)</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {/* Mode 2: Paste text */}
            {bulkInputMode === 'paste' && (
              <div className="space-y-3">
                <label className="text-xs text-slate-300 font-semibold block">
                  Bandika orodha ya wanachama hapa (toka Excel au WhatsApp):
                </label>
                <textarea
                  rows={6}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`Jina Kamili\tSimu\tWadhifa\tMakazi\nJimson Lema\t0622443249\tMwenyekiti\tKijitonyama\nJoachim Tarimo\t0653792361\tMakamu\tSinza`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleParsePastedText}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Chakata Maandishi (Parse)
                  </button>
                </div>
              </div>
            )}

            {/* Bulk Error Alert */}
            {bulkError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}

            {/* Parsed Preview Table */}
            {parsedPreview.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Wajumbe {parsedPreview.length} Wametambuliwa Vizuri
                  </div>
                  
                  {/* Action Mode Choice */}
                  <div className="flex items-center gap-2 text-xs">
                    <label className="text-slate-400">Mfumo wa kuingiza:</label>
                    <select
                      value={importAction}
                      onChange={(e) => setImportAction(e.target.value as any)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs"
                    >
                      <option value="append">Ongeza kwenye waliopo ({members.length})</option>
                      <option value="replace">Futa waliopo na uweke hawa wapya</option>
                    </select>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 text-[10px] sticky top-0">
                      <tr>
                        <th className="p-2">Namba</th>
                        <th className="p-2">Jina Kamili</th>
                        <th className="p-2">Simu</th>
                        <th className="p-2">Wadhifa</th>
                        <th className="p-2">Makazi</th>
                        <th className="p-2">Mtu wa Karibu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px]">
                      {parsedPreview.slice(0, 15).map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="p-2 font-mono text-emerald-400 font-bold">{p.memberNo}</td>
                          <td className="p-2 font-semibold text-white">{p.fullName}</td>
                          <td className="p-2 font-mono">{p.phone}</td>
                          <td className="p-2">{p.role}</td>
                          <td className="p-2">{p.residence}</td>
                          <td className="p-2 text-slate-400">{p.nextOfKin?.name} ({p.nextOfKin?.relation})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedPreview.length > 15 && (
                  <p className="text-[10px] text-slate-500 italic text-center">
                    ...na wajumbe wengine {parsedPreview.length - 15} wataingizwa.
                  </p>
                )}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsBulkModalOpen(false);
                  setParsedPreview([]);
                  setPasteText('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Ghairi
              </button>
              <button
                type="button"
                disabled={parsedPreview.length === 0}
                onClick={handleConfirmBulkImport}
                className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  parsedPreview.length > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                Thibitisha na Ingiza Wajumbe ({parsedPreview.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT SINGLE MEMBER */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                {editingMember ? `Hariri Mjumbe (${formData.memberNo})` : 'Sajili Mjumbe Mpya wa UWALEMI'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Namba ya Mwanachama *</label>
                  <input
                    type="text"
                    required
                    value={formData.memberNo || ''}
                    onChange={(e) => setFormData({ ...formData, memberNo: e.target.value.toUpperCase() })}
                    placeholder="UWL-001"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Wadhifa / Nafasi</label>
                  <select
                    value={formData.role || 'Mjumbe'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UwalemiMemberRole })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Mwenyekiti">Mwenyekiti</option>
                    <option value="Makamu Mwenyekiti">Makamu Mwenyekiti</option>
                    <option value="Katibu">Katibu</option>
                    <option value="Katibu Msaidizi">Katibu Msaidizi</option>
                    <option value="Mweka Hazina">Mweka Hazina</option>
                    <option value="Mweka Hazina Msaidizi">Mweka Hazina Msaidizi</option>
                    <option value="Mjumbe">Mjumbe</option>
                    <option value="Mlezi">Mlezi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Jina Kamili la Mjumbe *</label>
                <input
                  type="text"
                  required
                  value={formData.fullName || ''}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Mfano: Jimson Lema"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Namba ya Simu (WhatsApp / SMS) *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="07XXXXXXXX au +255..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Makazi / Eneo</label>
                  <input
                    type="text"
                    value={formData.residence || ''}
                    onChange={(e) => setFormData({ ...formData, residence: e.target.value })}
                    placeholder="Sinza / Kijitonyama"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Next of Kin (Mtu wa Karibu) */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  Mtu wa Karibu (Next of Kin - Taarifa za Dharura)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Jina la Ndugu</label>
                    <input
                      type="text"
                      value={formData.nextOfKin?.name || ''}
                      onChange={(e) => setFormData({ ...formData, nextOfKin: { ...formData.nextOfKin!, name: e.target.value } })}
                      placeholder="Jina la mwenzi/mzazi"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Uhusiano</label>
                    <select
                      value={formData.nextOfKin?.relation || 'Mwenzi'}
                      onChange={(e) => setFormData({ ...formData, nextOfKin: { ...formData.nextOfKin!, relation: e.target.value } })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      <option value="Mke">Mke</option>
                      <option value="Mume">Mume</option>
                      <option value="Mtoto">Mtoto</option>
                      <option value="Mzazi">Mzazi</option>
                      <option value="Kaka">Kaka</option>
                      <option value="Dada">Dada</option>
                      <option value="Ndugu">Ndugu mwingine</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Namba ya Simu</label>
                    <input
                      type="text"
                      value={formData.nextOfKin?.phone || ''}
                      onChange={(e) => setFormData({ ...formData, nextOfKin: { ...formData.nextOfKin!, phone: e.target.value } })}
                      placeholder="07XXXXXXXX"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Kiingilio & Ada za Kila Mwezi */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    Kiingilio cha Mwanachama (One-Time Entrance Fee)
                  </div>
                  <span className="text-[10px] text-slate-400">Hulipwa mara 1 tu</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Kiasi cha Kiingilio (TZS)</label>
                    <input
                      type="number"
                      value={formData.registrationFeeAmount !== undefined ? formData.registrationFeeAmount : 0}
                      onChange={(e) => setFormData({ ...formData, registrationFeeAmount: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:bg-slate-800/60 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.registrationFeePaid ?? false}
                        onChange={(e) => setFormData({ ...formData, registrationFeePaid: e.target.checked })}
                        className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-semibold text-slate-200">
                        {formData.registrationFeePaid ? '✓ Kiingilio Kimelipwa' : '✗ Bado Hajalipa Kiingilio'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Ada ya Kila Mwezi (TZS)</label>
                  <input
                    type="number"
                    value={formData.monthlyFeeAmount !== undefined ? formData.monthlyFeeAmount : 0}
                    onChange={(e) => setFormData({ ...formData, monthlyFeeAmount: Number(e.target.value) })}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Hali ya Mwanachama</label>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as UwalemiMemberStatus })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="active">Hai (Active)</option>
                    <option value="inactive">Amejitoa (Inactive)</option>
                    <option value="suspended">Amesitishwa (Suspended)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 cursor-pointer"
                >
                  {editingMember ? 'Hifadhi Mabadiliko' : 'Sajili Mjumbe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MEMBER CARD & PORTAL LINK */}
      {viewingCardMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 text-center shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-emerald-400 uppercase">Kadi ya Mjumbe wa UWALEMI</span>
              <button onClick={() => setViewingCardMember(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Virtual Membership Card Badge */}
            <div className="bg-gradient-to-br from-emerald-900/60 via-slate-900 to-teal-950/80 border border-emerald-500/40 rounded-2xl p-5 text-left relative overflow-hidden shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">UWALEMI GROUP</div>
                  <div className="text-xs text-slate-300 font-medium">Kadi ya Uanachama</div>
                </div>
                <div className="text-right font-mono font-bold text-emerald-300 text-sm">
                  {viewingCardMember.memberNo}
                </div>
              </div>

              <div className="my-4">
                <div className="text-base font-bold text-white">{viewingCardMember.fullName}</div>
                <div className="text-xs text-emerald-400 font-semibold">{viewingCardMember.role}</div>
                <div className="text-[11px] text-slate-400 mt-1">{viewingCardMember.phone}</div>
              </div>

              <div className="pt-3 border-t border-emerald-500/20 flex items-center justify-between text-[10px] text-slate-400">
                <span>Tarehe: {viewingCardMember.joinDate || '2026-01-01'}</span>
                <span className="text-emerald-400 font-semibold">Mwanachama Hai</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-left space-y-1">
              <div className="text-[11px] font-semibold text-slate-300">Kiungo cha Mjumbe Kwenye Simu:</div>
              <div className="text-[10px] font-mono text-emerald-400 break-all select-all">
                {window.location.origin}/?uwalemiMember={viewingCardMember.memberNo}
              </div>
            </div>

            <a
              href={`/?uwalemiMember=${viewingCardMember.memberNo}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              Fungua Ukurasa wa Mjumbe (Portal)
            </a>
          </div>
        </div>
      )}

      {/* MODAL: MEMBER FINANCIAL STATEMENT */}
      {viewingStatementMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  Taarifa ya Michango ya Mjumbe: {viewingStatementMember.fullName} ({viewingStatementMember.memberNo})
                </h3>
                <p className="text-xs text-slate-400">Wadhifa: {viewingStatementMember.role} • Simu: {viewingStatementMember.phone}</p>
              </div>
              <button
                onClick={() => setViewingStatementMember(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Kiingilio cha Usajili */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-amber-400 uppercase">Kiingilio cha Mwanachama (Entrance Fee)</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Ada ya kujiunga inayolipwa mara moja tu</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${viewingStatementMember.registrationFeePaid ? 'text-emerald-400' : 'text-rose-400'}`}>
                      TZS {(Number(viewingStatementMember.registrationFeeAmount) || 0).toLocaleString()}
                    </div>
                    <div className="text-[10px]">
                      {viewingStatementMember.registrationFeePaid ? (
                        <span className="text-emerald-400 font-semibold">✓ Kimelipwa</span>
                      ) : (
                        <span className="text-rose-400 font-semibold">✗ Deni (Bado Hajalipa)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ada za Kila Mwezi */}
              <div>
                <h4 className="font-bold text-slate-200 mb-2">1. Malipo ya Ada za Kila Mwezi</h4>
                {(() => {
                  const fees = (state.monthlyPayments || []).filter(p => p.memberId === viewingStatementMember.id || p.memberNo === viewingStatementMember.memberNo);
                  if (fees.length === 0) {
                    return <p className="text-slate-500 italic">Hakuna kumbukumbu za malipo ya ada zilizorekodiwa.</p>;
                  }
                  return (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-slate-400 text-[10px]">
                          <tr>
                            <th className="p-2">Mwaka/Mwezi</th>
                            <th className="p-2">Kiasi</th>
                            <th className="p-2">Tarehe</th>
                            <th className="p-2">Njia</th>
                            <th className="p-2">Stakabadhi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {fees.map(f => (
                            <tr key={f.id}>
                              <td className="p-2 font-mono">{f.year} - Mwezi {f.month}</td>
                              <td className="p-2 text-emerald-400 font-bold">TZS {f.paidAmount.toLocaleString()}</td>
                              <td className="p-2 text-slate-400">{f.paymentDate || '-'}</td>
                              <td className="p-2">{f.paymentMethod || 'M-Pesa'}</td>
                              <td className="p-2 font-mono text-[10px] text-slate-400">{f.receiptNo || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Michango ya Dharura */}
              <div>
                <h4 className="font-bold text-slate-200 mb-2">2. Michango ya Dharura & Misiba</h4>
                {(() => {
                  const emergencyPaid = (state.emergencyFunds || []).map(emg => {
                    const myP = (emg.payments || []).filter(p => p.memberId === viewingStatementMember.id || p.memberNo === viewingStatementMember.memberNo);
                    const total = myP.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                    return { emg, myP, total };
                  });

                  if (emergencyPaid.length === 0) {
                    return <p className="text-slate-500 italic">Hakuna michango ya dharura iliyofunguliwa.</p>;
                  }

                  return (
                    <div className="space-y-2">
                      {emergencyPaid.map(({ emg, total }) => (
                        <div key={emg.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-white">{emg.title}</div>
                            <div className="text-[11px] text-slate-400">Lengo la Mjumbe: TZS {(emg.perMemberTarget || 20000).toLocaleString()}</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-bold ${total >= (emg.perMemberTarget || 20000) ? 'text-emerald-400' : total > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                              TZS {total.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {total >= (emg.perMemberTarget || 20000) ? 'Amekamilisha' : total > 0 ? 'Kiasi Kimelipwa' : 'Hajachanga'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Faini na Adhabu */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-200">3. Kumbukumbu za Faini & Risiti za Malipo</h4>
                  <button
                    onClick={() => {
                      setFineModalMemberId(viewingStatementMember.id);
                      setFineModalMeetingId(undefined);
                      setFineModalType('kikao');
                      setFineModalAmount(10000);
                      setIsFinePaymentModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer transition-all shadow-sm"
                  >
                    <Receipt className="w-3 h-3" />
                    + Rekodi Malipo ya Faini
                  </button>
                </div>

                {(() => {
                  const mDebt = calculateMemberFeeDebt(viewingStatementMember, state);
                  const memberMeetings = (state.meetings || []).flatMap(m => {
                    const att = (m.attendees || []).find(a => a.memberId === viewingStatementMember.id || a.memberNo === viewingStatementMember.memberNo);
                    if (att && ((att.fineAmount && att.fineAmount > 0) || att.status === 'absent' || att.status === 'late')) {
                      return [{
                        meeting: m,
                        att,
                        amount: att.fineAmount || (att.status === 'late' ? (state.groupSettings?.meetingFineLateDefault || 2000) : (state.groupSettings?.meetingFineDefault || 10000)),
                        paid: att.finePaid ?? false,
                        reason: att.fineReason || (att.status === 'late' ? 'Kuchelewa kikao' : 'Kutohudhuria kikao')
                      }];
                    }
                    return [];
                  });

                  const finePayments = (state.finePayments || []).filter(p => p.memberId === viewingStatementMember.id || p.memberNo === viewingStatementMember.memberNo);

                  return (
                    <div className="space-y-3">
                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                          <div className="text-[10px] text-slate-400">Deni la Faini ya Ada (&gt;3M)</div>
                          <div className={`text-sm font-bold ${mDebt.lateFeePenalty > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                            TZS {mDebt.lateFeePenalty.toLocaleString()}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                          <div className="text-[10px] text-slate-400">Deni la Faini za Vikao</div>
                          <div className="text-sm font-bold text-rose-400">
                            TZS {memberMeetings.filter(m => !m.paid).reduce((s, m) => s + m.amount, 0).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Meeting fines breakdown */}
                      {memberMeetings.length > 0 && (
                        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-900 text-slate-400 text-[10px]">
                              <tr>
                                <th className="p-2">Kikao</th>
                                <th className="p-2">Tarehe</th>
                                <th className="p-2">Sababu</th>
                                <th className="p-2 text-right">Kiasi</th>
                                <th className="p-2 text-center">Hali</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-slate-300">
                              {memberMeetings.map((m, idx) => (
                                <tr key={idx}>
                                  <td className="p-2 font-semibold text-white">{m.meeting.title}</td>
                                  <td className="p-2 text-slate-400">{m.meeting.date}</td>
                                  <td className="p-2 text-slate-300">{m.reason}</td>
                                  <td className="p-2 text-right text-rose-400 font-bold">TZS {m.amount.toLocaleString()}</td>
                                  <td className="p-2 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      m.paid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                    }`}>
                                      {m.paid ? 'Imelipwa' : 'Deni'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Fine Payment Receipts history */}
                      {finePayments.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                            Risiti za Malipo ya Faini Yaliyorekodiwa:
                          </div>
                          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-900 text-slate-400 text-[10px]">
                                <tr>
                                  <th className="p-2">Risiti #</th>
                                  <th className="p-2">Tarehe</th>
                                  <th className="p-2">Aina</th>
                                  <th className="p-2 text-right">Kiasi</th>
                                  <th className="p-2">Njia</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                                {finePayments.map(fp => (
                                  <tr key={fp.id}>
                                    <td className="p-2 font-mono text-emerald-400">{fp.receiptNo}</td>
                                    <td className="p-2 text-slate-400">{fp.paymentDate}</td>
                                    <td className="p-2">{fp.fineType === 'kikao' ? 'Faini ya Kikao' : fp.fineType === 'ada_late_fee' ? 'Faini ya Ada' : 'Faini Nyingine'}</td>
                                    <td className="p-2 text-right font-bold text-emerald-400">TZS {(Number(fp.amount) || Number((fp as any).paidAmount) || 0).toLocaleString()}</td>
                                    <td className="p-2 text-slate-400">{fp.paymentMethod}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setViewingStatementMember(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
              >
                Funga
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: DELETE CONFIRMATION */}
      {deleteConfirmOpen && memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Thibitisha Kufuta</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Je, una uhakika unataka kumfuta mwanachama <strong className="text-white">"{memberToDelete.name}"</strong> kutoka kwenye daftari la UWALEMI? Hatua hii haiwezi kurudishwa nyuma.
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setMemberToDelete(null);
                }}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Ghairi
              </button>
              <button
                onClick={async () => {
                  const deletedId = memberToDelete.id;
                  const updatedMembers = members.filter(m => m.id !== deletedId);
                  const updatedPayments = (state.monthlyPayments || []).filter(p => p.memberId !== deletedId);
                  const updatedEmergencyFunds = (state.emergencyFunds || []).map(ef => ({
                    ...ef,
                    payments: (ef.payments || []).filter(p => p.memberId !== deletedId)
                  }));
                  const updatedMeetings = (state.meetings || []).map(m => ({
                    ...m,
                    attendees: (m.attendees || []).filter(a => a.memberId !== deletedId)
                  }));

                  await onSaveState({
                    ...state,
                    members: updatedMembers,
                    monthlyPayments: updatedPayments,
                    emergencyFunds: updatedEmergencyFunds,
                    meetings: updatedMeetings
                  });
                  setDeleteConfirmOpen(false);
                  setMemberToDelete(null);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/30 cursor-pointer"
              >
                Futa Mjumbe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: DELETE SELECTED MEMBERS */}
      {deleteSelectedConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Futa Wajumbe Waliochaguliwa</h3>
                <p className="text-xs text-rose-400 font-semibold">{selectedMemberIds.length} Wajumbe</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Una uhakika unataka kuwafuta wajumbe <strong>{selectedMemberIds.length}</strong> uliowachagua kwenye daftari? Rekodi zao za michango na mahudhurio zitaondolewa.
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                disabled={isDeleting}
                onClick={() => setDeleteSelectedConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Ghairi
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDeleteSelectedMembers}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Inafuta...
                  </>
                ) : (
                  `Ndiyo, Futa (${selectedMemberIds.length})`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: CLEAR ALL MEMBERS */}
      {clearAllConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-11 h-11 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Futa Wanachama Wote</h3>
                <p className="text-xs text-rose-400 font-semibold">{members.length} Wanachama kwenye daftari</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Hatua hii itaondoa wanachama wote <strong className="text-white">({members.length})</strong> kutoka kwenye mfumo wa UWALEMI ili kukuwezesha kuanza upya au kupakia orodha mpya.
            </p>

            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearPaymentsWithMembers}
                  onChange={(e) => setClearPaymentsWithMembers(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-rose-500"
                />
                <span>Safisha pia rekodi za michango (ada na mfuko wa dharura)</span>
              </label>
            </div>

            <div className="space-y-2 pt-2">
              <button
                disabled={isDeleting}
                onClick={executeClearAllMembers}
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white text-xs font-bold shadow-lg shadow-rose-900/40 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Inafuta Wanachama Wote...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Ndiyo, Futa Wanachama Wote ({members.length})
                  </>
                )}
              </button>

              <button
                disabled={isDeleting}
                onClick={() => {
                  setClearAllConfirmOpen(false);
                  setClearAllInput('');
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Ghairi (Sitaki Kufuta)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fine Payment & Receipt Modal */}
      <UwalemiFinePaymentModal
        isOpen={isFinePaymentModalOpen}
        onClose={() => setIsFinePaymentModalOpen(false)}
        state={state}
        onSaveState={onSaveState}
        initialMemberId={fineModalMemberId}
        initialMeetingId={fineModalMeetingId}
        initialFineType={fineModalType}
        initialAmount={fineModalAmount}
        onOpenSmsWithTemplate={onOpenSmsForMember ? (recipients, template) => {
          if (recipients.length > 0) {
            const mem = members.find(m => m.memberNo === recipients[0].memberNo || m.phone === recipients[0].phone);
            if (mem) onOpenSmsForMember(mem);
          }
        } : undefined}
      />
    </div>
  );
};

export default UwalemiMembers;
