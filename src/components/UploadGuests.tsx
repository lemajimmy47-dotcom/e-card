import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, FileSpreadsheet, Search, Check, FileText, ArrowRight, Eye, Trash2, X, Download, Upload, ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid, ChevronLeft, ChevronRight, Image as ImageIcon, Printer, AlertTriangle } from 'lucide-react';
import { EventDetails, TemplateSettings, Guest } from '../types';
import { drawCardToCanvas } from '../utils/canvasHelper';
import { useLanguage } from '../context/LanguageContext';
import { isStatusSent } from '../utils/statusHelper';
import { safeLocalStorage } from '../utils/storage';
import * as XLSX from 'xlsx';
import { 
  ParsedGuestItem, 
  parseUniversalGuestTable, 
  parseTextToMatrix, 
  parseFileToGuestMatrix 
} from '../utils/excelParser';

export type { ParsedGuestItem };

const isDuplicateGuestUniversal = (name: string, phone: string, existingGuests: Guest[]) => {
  const normName = (name || '').trim().toLowerCase();
  const cleanPhone = (phone || '').replace(/\D/g, ''); // keep only digits
  const lastNdigits = cleanPhone.slice(-9); // compare last 9 digits

  return (existingGuests || []).some(g => {
    if (!g) return false;
    const existingNormName = (g.name || '').trim().toLowerCase();
    const existingCleanPhone = (g.phone || '').replace(/\D/g, '');
    const existingLastNdigits = existingCleanPhone.slice(-9);

    const nameMatches = normName && existingNormName === normName;
    const phoneMatches = lastNdigits && existingLastNdigits && lastNdigits === existingLastNdigits;

    // Only consider duplicate if phone matches, OR if name matches AND both have phones
    if (phoneMatches) return true;
    if (nameMatches && lastNdigits && existingLastNdigits) return true;
    return false;
  });
};

const standardisePhoneNumber = (phone: string): string => {
  let clean = (phone || '').trim().replace(/\s+/g, '');
  if (!clean) return '';

  // If already starts with +
  if (clean.startsWith('+')) {
    return clean;
  }

  // If starts with 0 and is 10 digits long, e.g. 0714786751 or 06...
  if (clean.startsWith('0') && clean.length === 10) {
    return '+255' + clean.slice(1);
  }

  // If starts with 255 and is 12 digits long, e.g. 255714786751
  if (clean.startsWith('255') && clean.length === 12) {
    return '+' + clean;
  }

  // If is 9 digits long and starts with 6 or 7, e.g. 714786751
  if (clean.length === 9 && (clean.startsWith('7') || clean.startsWith('6') || clean.startsWith('8') || clean.startsWith('9') || clean.startsWith('1') || clean.startsWith('2') || clean.startsWith('3') || clean.startsWith('4') || clean.startsWith('5'))) {
    return '+255' + clean;
  }

  return clean;
};

interface LazyGuestCardImageProps {
  guest: Guest;
  event: EventDetails;
  settings: TemplateSettings;
  className?: string;
}

function LazyGuestCardImage({ guest, event, settings, className }: LazyGuestCardImageProps) {
  const [imgUrl, setImgUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    const canvas = document.createElement('canvas');
    const scaleFactor = 3;
    canvas.width = (settings.orientation === 'landscape' ? 600 : 450) * scaleFactor;
    canvas.height = (settings.orientation === 'landscape' ? 450 : 600) * scaleFactor;
    
    drawCardToCanvas(
      canvas,
      event,
      settings,
      guest.name.toUpperCase(),
      guest.cardType,
      guest.code ? `EVENTCARD-${guest.code}` : `EVENTCARD-${guest.id}`,
      () => {
        if (active) {
          try {
            setImgUrl(canvas.toDataURL('image/jpeg', 0.95));
          } catch (err) {
            console.error("Error exporting lazy guest card image canvas:", err);
          }
        }
      }
    );

    return () => {
      active = false;
    };
  }, [guest.id, guest.name, guest.cardType, guest.code, event.id, JSON.stringify(settings)]);

  if (!imgUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center font-bold text-slate-500 text-[10px] bg-slate-800/80 leading-tight p-2 text-center animate-pulse">
        Inatayarishwa...
      </div>
    );
  }

  return (
    <img 
      src={imgUrl} 
      alt={guest.name} 
      referrerPolicy="no-referrer"
      className={className}
    />
  );
}

const getCardImageUrlOnDemand = (g: Guest, event: EventDetails, settings: TemplateSettings): string => {
  const canvas = document.createElement('canvas');
  const scaleFactor = 3;
  canvas.width = (settings.orientation === 'landscape' ? 600 : 450) * scaleFactor;
  canvas.height = (settings.orientation === 'landscape' ? 450 : 600) * scaleFactor;
  drawCardToCanvas(
    canvas,
    event,
    settings,
    g.name.toUpperCase(),
    g.cardType,
    g.code ? `EVENTCARD-${g.code}` : `EVENTCARD-${g.id}`
  );
  return canvas.toDataURL('image/jpeg', 0.95);
};

interface UploadGuestsProps {
  event: EventDetails;
  settings: TemplateSettings;
  guests: Guest[];
  onUpdateGuests: (guests: Guest[], actionDesc?: string, skipServerSave?: boolean) => void;
  onNext: () => void;
}

export default function UploadGuests({ event, settings, guests, onUpdateGuests, onNext }: UploadGuestsProps) {
  const { language, t } = useLanguage();
  const isEn = language === 'en';
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'rsvpStatus' | 'cardType' | 'none'>('none');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBulkPreviewOpen, setIsBulkPreviewOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<'grid' | 'carousel'>('grid');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [previewFilterType, setPreviewFilterType] = useState<string>('ALL');
  const [previewQuery, setPreviewQuery] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Manual & automatic save status tracking
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const isMountedForSave = useRef(false);

  // Progress states for chunked/batched database uploads to Cloud SQL Postgres
  const [chunkUploadProgress, setChunkUploadProgress] = useState<number | null>(null);
  const [chunkUploadedCount, setChunkUploadedCount] = useState<{ current: number; total: number } | null>(null);
  const [isChunkUploading, setIsChunkUploading] = useState(false);
  const [chunkUploadError, setChunkUploadError] = useState<string | null>(null);
  const [lastUploadedGuestName, setLastUploadedGuestName] = useState<string>('');

  const handleUploadInBatches = async (newGuestsList: Guest[], actionDescText: string) => {
    if (newGuestsList.length === 0) return;
    
    setIsChunkUploading(true);
    setChunkUploadProgress(1); // Explicitly start counting from 1% as requested
    setChunkUploadedCount({ current: 0, total: newGuestsList.length });
    setChunkUploadError(null);
    setLastUploadedGuestName('');
    
    // Dynamically adjust batch size to ensure extremely fast upload while keeping a satisfying visual progress
    let BATCH_SIZE = 500;
    if (newGuestsList.length <= 15) {
      BATCH_SIZE = 3; 
    } else if (newGuestsList.length <= 50) {
      BATCH_SIZE = 10;
    } else if (newGuestsList.length <= 200) {
      BATCH_SIZE = 50;
    } else if (newGuestsList.length <= 1000) {
      BATCH_SIZE = 250;
    } else {
      BATCH_SIZE = 500;
    }
    
    const totalToUpload = newGuestsList.length;
    let currentMerged = [...guests];
    
    try {
      let currentProgressVal = 1;
      for (let i = 0; i < totalToUpload; i += BATCH_SIZE) {
        const batch = newGuestsList.slice(i, i + BATCH_SIZE);
        currentMerged = [...batch, ...currentMerged];
        
        // Show last guest being uploaded in this batch
        if (batch.length > 0) {
          setLastUploadedGuestName(batch[batch.length - 1].name || '');
        }
        
        const payload = {
          guests: batch.map(g => {
            const { cardImageUrl, ...rest } = g;
            return rest;
          }),
          auditLog: {
            id: 'log-' + Date.now() + '-' + i,
            timestamp: new Date().toISOString(),
            user: 'Admin',
            action: `${actionDescText}: Wageni ${i + 1} hadi ${Math.min(i + batch.length, totalToUpload)} kati ya ${totalToUpload}`,
            details: `Kundi la wageni lilipakiwa na kusajiliwa salama kwenye PostgreSQL.`
          }
        };
        
        const response = await fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          throw new Error(isEn 
            ? `Failed to upload batch starting at ${i + 1}` 
            : `Imeshindikana kupakia kundi kuanzia mgeni wa ${i + 1}`);
        }
        
        const loadedCount = Math.min(i + BATCH_SIZE, totalToUpload);
        const targetPercent = Math.min(Math.round((loadedCount / totalToUpload) * 100), 99);
        
        // Smoothly tick the visual progress with sequential counts
        const stepDelay = Math.max(2, Math.min(25, 120 / (targetPercent - currentProgressVal || 1)));
        for (let p = currentProgressVal; p <= targetPercent; p++) {
          setChunkUploadProgress(p);
          currentProgressVal = p;
          await new Promise(resolve => setTimeout(resolve, stepDelay));
        }
        
        setChunkUploadedCount({ current: loadedCount, total: totalToUpload });
        // Tiny pacing delay to show name before proceeding to next batch
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      
      // Smoothly roll from the current progress value up to 100%
      for (let p = currentProgressVal; p <= 100; p++) {
        setChunkUploadProgress(p);
        await new Promise(resolve => setTimeout(resolve, 15));
      }
      
      setChunkUploadedCount({ current: totalToUpload, total: totalToUpload });
      await new Promise(resolve => setTimeout(resolve, 850));
      
      // Successfully uploaded everything! Now call the master state updates
      // skipping repetitive heavy redunant server write commands
      onUpdateGuests(currentMerged, `${actionDescText}: Jumla ya wageni wapya ${totalToUpload}`, true);
      
    } catch (err: any) {
      console.error("Batch upload failed:", err);
      setChunkUploadError(err.message || 'Error occurred during upload');
    } finally {
      setIsChunkUploading(false);
      setChunkUploadProgress(null);
      setChunkUploadedCount(null);
      setLastUploadedGuestName('');
    }
  };

  useEffect(() => {
    if (!isMountedForSave.current) {
      isMountedForSave.current = true;
      return;
    }
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      setSaveStatus('saved');
    }, 1200);
    return () => clearTimeout(timer);
  }, [guests]);



  
  // Form fields for single guest
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestType, setGuestType] = useState<string>('DOUBLE');
  const [guestMaxGuests, setGuestMaxGuests] = useState<number>(2);
  const [availableCategories, setAvailableCategories] = useState<string[]>(['SINGLE', 'DOUBLE', 'UNCLASSIFIED']);

  // Tags & Custom Fields states for adding single guest
  const [guestTags, setGuestTags] = useState('');
  const [guestTableNumber, setGuestTableNumber] = useState('');
  const [guestFoodPreference, setGuestFoodPreference] = useState('');

  // Tags & Custom Fields states for editing guest
  const [editGuestTags, setEditGuestTags] = useState('');
  const [editGuestTableNumber, setEditGuestTableNumber] = useState('');
  const [editGuestFoodPreference, setEditGuestFoodPreference] = useState('');
  const [editGuestMaxGuests, setEditGuestMaxGuests] = useState<number>(2);

  // Selected tag filter state
  const [selectedTagFilter, setSelectedTagFilter] = useState('ALL');

  // Conflict queue state for Smart Duplicate Resolution
  const [conflictQueue, setConflictQueue] = useState<{ newGuest: Guest; existingGuest: Guest }[]>([]);

  // Edit guest state
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [editGuestName, setEditGuestName] = useState('');
  const [editGuestPhone, setEditGuestPhone] = useState('');
  const [editGuestType, setEditGuestType] = useState<string>('DOUBLE');

  
  // Bulk input field
  const [bulkTextInput, setBulkTextInput] = useState('');
  const [bulkMode, setBulkMode] = useState<'text' | 'file'>('text');
  const [parsedFileGuests, setParsedFileGuests] = useState<ParsedGuestItem[]>([]);
  const [fileName, setFileName] = useState('');
  const [csvError, setCsvError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Function to deduplicate existing guests in memory and database
  const handleRemoveDuplicates = () => {
    const seenNames = new Set<string>();
    const seenPhones = new Set<string>();
    const uniqueGuests: Guest[] = [];
    let removedCount = 0;

    guests.forEach(g => {
      const normName = (g.name || '').trim().toLowerCase();
      const cleanPhone = (g.phone || '').replace(/\D/g, '');
      const lastNdigits = cleanPhone.length >= 7 ? cleanPhone.slice(-9) : '';

      const isNameDup = normName && seenNames.has(normName);
      const isPhoneDup = lastNdigits && seenPhones.has(lastNdigits);

      if (isNameDup || isPhoneDup) {
        removedCount++;
      } else {
        if (normName) seenNames.add(normName);
        if (lastNdigits) seenPhones.add(lastNdigits);
        uniqueGuests.push(g);
      }
    });

    if (removedCount > 0) {
      onUpdateGuests(uniqueGuests, `Amesafisha wageni waliojirudia (${removedCount} wameondolewa)`);
      alert(isEn 
        ? `Successfully cleaned up! Removed ${removedCount} duplicate guest record(s).` 
        : `Imefanikiwa kusafisha! Wageni ${removedCount} waliojirudia wameondolewa.`);
    } else {
      alert(isEn ? "No duplicate guests found!" : "Hakuna wageni waliojirudia waliopatikana!");
    }
  };

  // Clear states when bulk modal opens/closes
  useEffect(() => {
    if (!isBulkModalOpen) {
      setBulkTextInput('');
      setParsedFileGuests([]);
      setFileName('');
      setCsvError('');
      setBulkMode('text');
    }
  }, [isBulkModalOpen]);

  const handleDownloadSampleCSV = () => {
    const headers = "Guest Full Name *,Phone Number (Optional),Category,Pledge (TZS),Paid (TZS)\n";
    const rows = [
      "Arnold Kimaro,,VIP,5000000,3000000",
      "Ernest Gao,,Wafanyakazi,250000,0",
      "David Komba,,Ndugu,250000,0",
      "Eng Gerald Baslei,0714786751,Kamati,1000000,600000",
      "Kilonzo Izina,0755883901,Wafanyakazi,220000,70000"
    ].join("\n");
    
    try {
      const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'mfano_wa_orodha_ya_wageni.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert(isEn ? "Failed to download sample file." : "Imeshindikana kupakua mfano wa faili.");
    }
  };

  // Handler for parsing raw CSV/Text file content
  const parseCSVFileContent = (content: string) => {
    setCsvError('');
    const matrix = parseTextToMatrix(content);
    const parsed = parseUniversalGuestTable(matrix);

    if (parsed.length === 0) {
      setCsvError('Haikupata mgeni yeyote katika faili la CSV/Text. Hakikisha safu wima zina majina kama "Guest Full Name", "Pledge", "Paid", n.k.');
      setParsedFileGuests([]);
    } else {
      setParsedFileGuests(parsed);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsvError('');
    setParsedFileGuests([]);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (eventOnload) => {
        try {
          const buffer = eventOnload.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
          const parsed = parseUniversalGuestTable(rawMatrix);
          if (parsed.length === 0) {
            setCsvError('Haikupata mgeni yeyote katika faili la Excel. Hakikisha vichwa vya habari vinasomeka mfano "Guest Full Name", "Pledge", "Paid", n.k.');
          } else {
            setParsedFileGuests(parsed);
          }
        } catch (err) {
          setCsvError('Imeshindikana kusoma faili la Excel.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (eventOnload) => {
        const text = eventOnload.target?.result as string;
        if (text) {
          parseCSVFileContent(text);
        }
      };
      reader.onerror = () => {
        setCsvError('Imeshindikana kusoma faili la CSV kwenye kifaa chako.');
      };
      reader.readAsText(file);
    }
  };

  const handleAddParsedFileGuests = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedFileGuests.length === 0) return;

    const nonConflicts: Guest[] = [];
    const conflicts: { newGuest: Guest; existingGuest: Guest }[] = [];

    parsedFileGuests.forEach((item, index) => {
      const id = 'G-' + (Date.now() + index).toString().slice(-6);
      const shortCode = 'IP-' + Math.floor(1100 + Math.random() * 8800);
      const standardisedPhone = standardisePhoneNumber(item.phone);

      const itemTags = item.tags ? item.tags : [];
      const itemCustomFields = item.customFields ? item.customFields : {};

      const newGuest: Guest = {
        id,
        eventId: event.id,
        code: shortCode,
        name: item.name.trim(),
        phone: standardisedPhone,
        cardType: item.cardType,
        smsStatus: 'Sijatuma',
        whatsappStatus: 'Sijatuma',
        rsvpStatus: 'Bado',
        rsvpGuestsCount: item.cardType === 'DOUBLE' ? 2 : 1,
        checkedIn: false,
        category: item.category,
        tags: itemTags,
        customFields: itemCustomFields,
        pledgeAmount: item.pledgeAmount,
        paidAmount: item.paidAmount,
        pledgeStatus: item.pledgeStatus || 'No Pledge'
      };

      // Check for duplicate in existing guests OR within the incoming batch
      const cleanPhone = standardisedPhone.replace(/\D/g, '');
      const lastNdigits = cleanPhone.slice(-9);
      const normName = item.name.trim().toLowerCase();

      const existingDuplicate = guests.find(g => {
        const existingNormName = (g.name || '').trim().toLowerCase();
        const existingCleanPhone = (g.phone || '').replace(/\D/g, '');
        const existingLastNdigits = existingCleanPhone.slice(-9);

        const phoneMatches = lastNdigits.length >= 7 && existingLastNdigits.length >= 7 && lastNdigits === existingLastNdigits;
        const nameMatches = normName && existingNormName === normName;

        return phoneMatches || nameMatches;
      });

      const batchDuplicate = nonConflicts.find(g => {
        const existingNormName = (g.name || '').trim().toLowerCase();
        const existingCleanPhone = (g.phone || '').replace(/\D/g, '');
        const existingLastNdigits = existingCleanPhone.slice(-9);

        const phoneMatches = lastNdigits.length >= 7 && existingLastNdigits.length >= 7 && lastNdigits === existingLastNdigits;
        const nameMatches = normName && existingNormName === normName;

        return phoneMatches || nameMatches;
      });

      if (existingDuplicate) {
        conflicts.push({ newGuest, existingGuest: existingDuplicate });
      } else if (!batchDuplicate) {
        nonConflicts.push(newGuest);
      }
    });

    if (nonConflicts.length > 0) {
      handleUploadInBatches(nonConflicts, "Pakia wageni kupitia faili (CSV/Excel)");
    }

    if (conflicts.length > 0) {
      setConflictQueue(prev => [...prev, ...conflicts]);
    }

    setIsBulkModalOpen(false);
    setParsedFileGuests([]);
    setFileName('');
    setCsvError('');
  };

  // Active guest for preview lightbox
  const [previewGuest, setPreviewGuest] = useState<Guest | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Redraw preview canvas inside the modal lightbox
  useEffect(() => {
    if (previewGuest && previewCanvasRef.current) {
      drawCardToCanvas(
        previewCanvasRef.current,
        event,
        settings,
        previewGuest.name.toUpperCase(),
        previewGuest.cardType,
        previewGuest.code ? `EVENTCARD-${previewGuest.code}` : `EVENTCARD-${previewGuest.id}`
      );
    }
  }, [previewGuest, event, settings]);

  const handleAddSingleGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!guestName.trim()) return;

    setIsSubmitting(true);

    const standardisedPhone = standardisePhoneNumber(guestPhone);
    const finalType = ['SINGLE', 'DOUBLE'].includes(guestType) ? guestType : 'UNCLASSIFIED';
    const rsvpCount = finalType === 'DOUBLE' ? 2 : 1;

    const parsedTags = guestTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const customFieldsObj: Record<string, string> = {};
    if (guestTableNumber.trim()) {
      customFieldsObj.tableNumber = guestTableNumber.trim();
    }
    if (guestFoodPreference.trim()) {
      customFieldsObj.foodPreference = guestFoodPreference.trim();
    }

    const shortCode = 'IP-' + Math.floor(1000 + Math.random() * 9000);
    const newGuest: Guest = {
      id: 'G-' + Date.now().toString().slice(-6),
      eventId: event.id,
      code: shortCode,
      name: guestName.trim(),
      phone: standardisedPhone,
      cardType: finalType,
      smsStatus: 'Sijatuma',
      whatsappStatus: 'Sijatuma',
      rsvpStatus: 'Bado',
      maxGuests: guestMaxGuests,
      rsvpGuestsCount: rsvpCount,
      checkedIn: false,
      tags: parsedTags,
      customFields: customFieldsObj
    };

    // Check for duplicate in existing guests
    const existingDuplicate = guests.find(g => {
      const normName = guestName.trim().toLowerCase();
      const cleanPhone = standardisedPhone.replace(/\D/g, '');
      const lastNdigits = cleanPhone.slice(-9);

      const existingNormName = (g.name || '').trim().toLowerCase();
      const existingCleanPhone = (g.phone || '').replace(/\D/g, '');
      const existingLastNdigits = existingCleanPhone.slice(-9);

      return (normName && existingNormName === normName) || (lastNdigits && existingLastNdigits && lastNdigits === existingLastNdigits);
    });

    if (existingDuplicate) {
      setConflictQueue([{ newGuest, existingGuest: existingDuplicate }]);
      setIsSingleModalOpen(false);
      setIsSubmitting(false);
      // Reset form fields
      setGuestName('');
      setGuestPhone('');
      setGuestType('DOUBLE');
      setGuestMaxGuests(2);
      setGuestTags('');
      setGuestTableNumber('');
      setGuestFoodPreference('');
      return;
    }

    onUpdateGuests([newGuest, ...guests], `Ameongeza mgeni mpya (Added Guest): ${newGuest.name}`);
    setIsSingleModalOpen(false);
    setIsSubmitting(false);
    
    // Reset form
    setGuestName('');
    setGuestPhone('');
    setGuestType('DOUBLE');
    setGuestMaxGuests(2);
    setGuestTags('');
    setGuestTableNumber('');
    setGuestFoodPreference('');
  };

  const handleAddBulkGuests = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkTextInput.trim()) return;

    const matrix = parseTextToMatrix(bulkTextInput);
    const parsedItems = parseUniversalGuestTable(matrix);

    if (parsedItems.length === 0) {
      alert(isEn ? "No guest records found in pasted text." : "Haikupata mgeni yeyote katika maandishi uliyoweka. Hakikisha yapo majina ya wageni.");
      return;
    }

    const nonConflicts: Guest[] = [];
    const conflicts: { newGuest: Guest; existingGuest: Guest }[] = [];

    parsedItems.forEach((item, index) => {
      const id = 'G-' + (Date.now() + index).toString().slice(-6);
      const shortCode = 'IP-' + Math.floor(1100 + Math.random() * 8800);
      const standardisedPhone = standardisePhoneNumber(item.phone);

      const newGuest: Guest = {
        id,
        eventId: event.id,
        code: shortCode,
        name: item.name.trim(),
        phone: standardisedPhone,
        cardType: item.cardType,
        smsStatus: 'Sijatuma',
        whatsappStatus: 'Sijatuma',
        rsvpStatus: 'Bado',
        rsvpGuestsCount: item.cardType === 'DOUBLE' ? 2 : 1,
        checkedIn: false,
        category: item.category,
        tags: item.tags || [],
        customFields: item.customFields || {},
        pledgeAmount: item.pledgeAmount,
        paidAmount: item.paidAmount,
        pledgeStatus: item.pledgeStatus || 'No Pledge'
      };

      // Check for duplicate in existing guests OR within the incoming batch
      const cleanPhone = standardisedPhone.replace(/\D/g, '');
      const lastNdigits = cleanPhone.slice(-9);
      const normName = item.name.trim().toLowerCase();

      const existingDuplicate = guests.find(g => {
        const existingNormName = (g.name || '').trim().toLowerCase();
        const existingCleanPhone = (g.phone || '').replace(/\D/g, '');
        const existingLastNdigits = existingCleanPhone.slice(-9);

        const phoneMatches = lastNdigits.length >= 7 && existingLastNdigits.length >= 7 && lastNdigits === existingLastNdigits;
        const nameMatches = normName && existingNormName === normName;

        return phoneMatches || nameMatches;
      });

      const batchDuplicate = nonConflicts.find(g => {
        const existingNormName = (g.name || '').trim().toLowerCase();
        const existingCleanPhone = (g.phone || '').replace(/\D/g, '');
        const existingLastNdigits = existingCleanPhone.slice(-9);

        const phoneMatches = lastNdigits.length >= 7 && existingLastNdigits.length >= 7 && lastNdigits === existingLastNdigits;
        const nameMatches = normName && existingNormName === normName;

        return phoneMatches || nameMatches;
      });

      if (existingDuplicate) {
        conflicts.push({ newGuest, existingGuest: existingDuplicate });
      } else if (!batchDuplicate) {
        nonConflicts.push(newGuest);
      }
    });

    if (nonConflicts.length > 0) {
      handleUploadInBatches(nonConflicts, "Ameongeza wageni wapya kwa pamoja");
    }

    if (conflicts.length > 0) {
      setConflictQueue(prev => [...prev, ...conflicts]);
    }

    setIsBulkModalOpen(false);
    setBulkTextInput('');
  };

  const handleResolveMerge = (newGuest: Guest, existingGuest: Guest) => {
    // Merge tags
    const existingTags = existingGuest.tags || [];
    const newTags = newGuest.tags || [];
    const mergedTags = Array.from(new Set([...existingTags, ...newTags]));

    // Merge custom fields
    const existingCF = existingGuest.customFields || {};
    const newCF = newGuest.customFields || {};
    const mergedCF = { ...existingCF, ...newCF };

    const mergedGuest: Guest = {
      ...existingGuest,
      name: newGuest.name || existingGuest.name,
      phone: newGuest.phone || existingGuest.phone,
      cardType: newGuest.cardType !== 'UNCLASSIFIED' ? newGuest.cardType : existingGuest.cardType,
      rsvpGuestsCount: newGuest.cardType !== 'UNCLASSIFIED' ? (newGuest.cardType === 'DOUBLE' ? 2 : 1) : (existingGuest.cardType === 'DOUBLE' ? 2 : 1),
      tags: mergedTags,
      customFields: mergedCF
    };

    const updatedList = guests.map(g => g.id === existingGuest.id ? mergedGuest : g);
    onUpdateGuests(updatedList, `Ameunganisha mgeni (Merged Guest): ${mergedGuest.name}`);

    // Remove first item from queue
    setConflictQueue(prev => prev.slice(1));
  };

  const handleResolveSkip = () => {
    // Remove first item from queue
    setConflictQueue(prev => prev.slice(1));
  };

  const handleResolveKeepBoth = (newGuest: Guest) => {
    onUpdateGuests([newGuest, ...guests], `Amesajili mgeni mpya sambamba na aliyepo (Kept both duplicate guests): ${newGuest.name}`);
    // Remove first item from queue
    setConflictQueue(prev => prev.slice(1));
  };

  const handleDeleteGuest = (id: string, name: string) => {
    setConfirmDeleteTarget({ id, name });
  };

  const handleStartEdit = (guest: Guest) => {
    setEditingGuest(guest);
    setEditGuestName(guest.name);
    setEditGuestPhone(guest.phone);
    setEditGuestType(['SINGLE', 'DOUBLE'].includes(guest.cardType) ? guest.cardType : 'UNCLASSIFIED');
    setEditGuestMaxGuests(guest.maxGuests || (guest.cardType === 'DOUBLE' ? 2 : 1));
    setEditGuestTags(guest.tags ? guest.tags.join(', ') : '');
    setEditGuestTableNumber(guest.customFields?.tableNumber || '');
    setEditGuestFoodPreference(guest.customFields?.foodPreference || '');
  };

  const handleSaveEditGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuest) return;

    const finalType = ['SINGLE', 'DOUBLE'].includes(editGuestType) ? editGuestType : 'UNCLASSIFIED';
    const rsvpCount = finalType === 'DOUBLE' ? 2 : 1;
    const standardisedPhone = standardisePhoneNumber(editGuestPhone);

    const parsedTags = editGuestTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const customFieldsObj: Record<string, string> = {};
    if (editGuestTableNumber.trim()) {
      customFieldsObj.tableNumber = editGuestTableNumber.trim();
    }
    if (editGuestFoodPreference.trim()) {
      customFieldsObj.foodPreference = editGuestFoodPreference.trim();
    }

    const updatedGuest: Guest = {
      ...editingGuest,
      name: editGuestName.trim(),
      phone: standardisedPhone,
      cardType: finalType,
      maxGuests: editGuestMaxGuests,
      rsvpGuestsCount: rsvpCount,
      tags: parsedTags,
      customFields: customFieldsObj
    };

    // Update guests list
    const updatedList = guests.map(g => g.id === editingGuest.id ? updatedGuest : g);
    onUpdateGuests(updatedList, `Amefanya mabadiliko kwa mgeni (Edited Guest): ${updatedGuest.name}`);

    setEditingGuest(null);
  };

  // Stat Counters
  const countDouble = guests.filter(g => g.cardType === 'DOUBLE').length;
  const countSingle = guests.filter(g => g.cardType === 'SINGLE').length;
  const countUnclassified = guests.filter(g => g.cardType === 'UNCLASSIFIED').length;
  const totalCards = guests.length;

  // Highlight potential duplicate phone numbers
  const duplicatePhoneMap = useMemo(() => {
    const map = new Map<string, string[]>();
    guests.forEach(g => {
      if (g && g.phone && g.phone.length >= 8) {
        const clean = g.phone.replace(/\D/g, '').slice(-9);
        if (clean) {
          if (!map.has(clean)) map.set(clean, []);
          map.get(clean)!.push(g.id);
        }
      }
    });
    return map;
  }, [guests]);

  const handleSort = (field: 'name' | 'rsvpStatus' | 'cardType') => {
    if (sortBy === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortBy('none');
      }
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const allGuestTags = useMemo(() => {
    const tagsSet = new Set<string>();
    guests.forEach(g => {
      if (g.tags) {
        g.tags.forEach(t => {
          if (t && t.trim()) tagsSet.add(t.trim());
        });
      }
    });
    return Array.from(tagsSet);
  }, [guests]);

  const filteredGuests = guests.filter(g => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      g.name.toLowerCase().includes(term) || 
      g.phone.includes(term) ||
      g.code.toLowerCase().includes(term) ||
      (g.tags && g.tags.some(t => t.toLowerCase().includes(term))) ||
      (g.customFields && Object.values(g.customFields).some(val => val.toLowerCase().includes(term)));

    const matchesTag = selectedTagFilter === 'ALL' || (g.tags && g.tags.includes(selectedTagFilter));

    return matchesSearch && matchesTag;
  });

  const sortedGuests = [...filteredGuests].sort((a, b) => {
    if (sortBy === 'name') {
      const valA = a.name.toLowerCase();
      const valB = b.name.toLowerCase();
      return sortOrder === 'asc' ? valA.localeCompare(valB, 'sw') : valB.localeCompare(valA, 'sw');
    }
    if (sortBy === 'rsvpStatus') {
      const valA = a.rsvpStatus || 'Bado';
      const valB = b.rsvpStatus || 'Bado';
      return sortOrder === 'asc' ? valA.localeCompare(valB, 'sw') : valB.localeCompare(valA, 'sw');
    }
    if (sortBy === 'cardType') {
      const getRank = (type: string) => {
        const t = (type || '').toUpperCase();
        if (t === 'SINGLE') return 1;
        if (t === 'DOUBLE') return 2;
        if (t === 'UNCLASSIFIED') return 3;
        return 4;
      };
      const rankA = getRank(a.cardType);
      const rankB = getRank(b.cardType);
      
      if (rankA !== rankB) {
        return sortOrder === 'asc' ? rankA - rankB : rankB - rankA;
      }
      
      const valA = a.name.toLowerCase();
      const valB = b.name.toLowerCase();
      return sortOrder === 'asc' ? valA.localeCompare(valB, 'sw') : valB.localeCompare(valA, 'sw');
    }
    return 0;
  });

  const handlePrintAllCards = () => {
    // Select the same filtered and query-matched lists as in the view
    const rawItemsToPrint = guests.filter(g => {
      const matchQuery = g.name.toLowerCase().includes(previewQuery.toLowerCase());
      const matchType = previewFilterType === 'ALL' || g.cardType === previewFilterType;
      return matchQuery && matchType;
    });

    if (rawItemsToPrint.length === 0) return;

    // Generate heavy cardImageUrl on-demand only for items being printed to avoid polluting memory or sync overhead
    const itemsToPrint = rawItemsToPrint.map(g => {
      const cardImageUrl = getCardImageUrlOnDemand(g, event, settings);
      return { ...g, cardImageUrl };
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert(isEn 
        ? "Your browser blocked the print window (Popup Blocked). Please allow popups or open this app in a new tab to print these cards."
        : 'Kivinjari chako kimezuia dirisha jipya la uchapaji (Popup Blocked). Tafadhali ruhusu popups au fungua mfumo huu kwenye tab mpya ili uweze kuchapa kadi hizi.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>EVENTCARD - {isEn ? "Print Guest Cards" : "Chapisha Kadi za Wageni"}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
          
          body {
            margin: 0;
            padding: 20px;
            font-family: 'Inter', system-ui, sans-serif;
            background: #ffffff;
            color: #111827;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .no-print-header {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            padding: 18px 24px;
            border-radius: 12px;
            margin-bottom: 25px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .no-print-header h1 {
            margin: 0;
            font-size: 16px;
            font-weight: 800;
            color: #111827;
            letter-spacing: -0.025em;
          }

          .no-print-header p {
            margin: 4px 0 0 0;
            font-size: 12px;
            color: #6b7280;
          }

          .print-btn {
            background-color: #2563eb;
            color: white;
            border: none;
            padding: 10px 18px;
            font-size: 13px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            transition: all 0.15s ease;
          }

          .print-btn:hover {
            background-color: #1d4ed8;
          }

          .print-grid {
            display: grid;
            grid-template-cols: repeat(2, 1fr);
            gap: 24px;
            max-width: 960px;
            margin: 0 auto;
          }

          .card-container {
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 14px;
            background-color: #fcfcfb;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            break-inside: avoid;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .card-image {
            width: 100%;
            aspect-ratio: 3/4;
            object-fit: cover;
            border-radius: 10px;
            border: 1px solid rgba(0,0,0,0.06);
            background-color: #f3f4f6;
          }

          .card-meta {
            margin-top: 12px;
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-sizing: border-box;
            padding: 0 4px;
          }

          .guest-info {
            flex-grow: 1;
            min-width: 0;
            margin-right: 12px;
          }

          .guest-name {
            font-weight: 800;
            font-size: 13px;
            color: #111827;
            margin: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .guest-details {
            font-size: 11px;
            color: #6b7280;
            font-family: monospace;
            margin: 2px 0 0 0;
          }

          .badge {
            font-size: 9px;
            font-weight: 800;
            background: rgba(37, 99, 235, 0.08);
            color: #2563eb;
            border: 1px solid rgba(37, 99, 235, 0.15);
            padding: 3px 10px;
            border-radius: 9999px;
            text-transform: uppercase;
            letter-spacing: 0.025em;
            flex-shrink: 0;
          }

          @media print {
            .no-print-header {
              display: none !important;
            }
            body {
              padding: 0;
              margin: 0;
              background: none;
            }
            .card-container {
              border: 1px solid #e5e7eb;
              background-color: #ffffff !important;
              box-shadow: none !important;
            }
            .print-grid {
              gap: 20px;
              max-width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print-header">
          <div>
            <h1>{isEn ? "Guest Cards" : "Kadi za Wageni"} - EVENTCARD Designer Print</h1>
            <p>{isEn ? "Total cards to print:" : "Jumla ya kadi zinazochapishwa:"} <strong>${itemsToPrint.length}</strong></p>
          </div>
          <button class="print-btn" onclick="window.print()">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Cards
          </button>
        </div>

        <div class="print-grid">
          ${itemsToPrint.map(g => `
            <div class="card-container">
              <img class="card-image" src="${g.cardImageUrl || ''}" referrerpolicy="no-referrer" />
              <div class="card-meta">
                <div class="guest-info">
                  <h2 class="guest-name">${g.name}</h2>
                  <p class="guest-details">${g.code || ''} &bull; ${g.phone || ''}</p>
                </div>
                <span class="badge">${g.cardType}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <script>
          // Automatically trigger print dialog when all card images are loaded completely
          window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
              const imgs = document.querySelectorAll('.card-image');
              let loadedCount = 0;
              if (imgs.length === 0) {
                window.print();
              } else {
                imgs.forEach(img => {
                  if (img.complete) {
                    loadedCount++;
                    if (loadedCount === imgs.length) {
                      window.print();
                    }
                  } else {
                    img.addEventListener('load', () => {
                      loadedCount++;
                      if (loadedCount === imgs.length) {
                        window.print();
                      }
                    });
                    img.addEventListener('error', () => {
                      loadedCount++;
                      if (loadedCount === imgs.length) {
                        window.print();
                      }
                    });
                  }
                });
              }
            }, 400);
          });
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[1.75rem] p-6 sm:p-8 space-y-6 font-sans text-xs text-white" id="upload-guests-container">
      
      {/* Chunk progress overlay */}
      {isChunkUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-2xl text-center space-y-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              {/* Circular custom loader using SVG */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    className="stroke-slate-800"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    className="stroke-blue-500 transition-all duration-300"
                    strokeWidth="6"
                    strokeDasharray={301.6}
                    strokeDashoffset={301.6 - (301.6 * (chunkUploadProgress || 0)) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-2xl font-extrabold text-white">
                    {chunkUploadProgress}%
                  </span>
                  <span className="text-[9px] text-blue-400 font-mono font-bold uppercase tracking-wider">
                    Progress
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {isEn ? "Loading Guests into Database..." : "Inapakia Wageni Kwenye Database..."}
                </h3>
                <p className="text-slate-400 text-xs font-mono pb-1">
                  Uhakiki: wageni {chunkUploadedCount?.current} kati ya {chunkUploadedCount?.total}
                </p>
                {lastUploadedGuestName && (
                  <p className="text-blue-400 text-[11px] font-mono font-medium animate-pulse bg-blue-500/10 py-1 px-3.5 rounded-lg border border-blue-500/10 inline-block max-w-full truncate">
                    {isEn ? "Registering guest:" : "Mgeni anayesajiliwa:"} {lastUploadedGuestName}
                  </p>
                )}
              </div>
            </div>
            
            {/* Horizontal progress bar too for rhythm */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300"
                style={{ width: `${chunkUploadProgress}%` }}
              />
            </div>
            
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans sw-swahili italic p-3 bg-slate-950/40 rounded-xl border border-white/5">
              Mfumo unasajili wageni kwa makundi madogo (batches) kwenye PostgreSQL ili kuhakikisha kila jina linaingia 100% salama bila kujifuta hata kivinjari kikiwa kizito. Tafadhali usifunge wala usisafishe ukurasa huu kwa sasa.
            </p>
          </div>
        </div>
      )}

      {chunkUploadError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl space-y-4">
            <div className="flex items-start space-x-3 text-red-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-white">Itifaki Imefeli Kupakia!</h4>
                <p className="text-[11px] text-slate-300 mt-1">{chunkUploadError}</p>
              </div>
            </div>
            <button
              onClick={() => setChunkUploadError(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-bold cursor-pointer"
            >
              Funga na Jaribu Tena
            </button>
          </div>
        </div>
      )}
      
      {/* Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span>{isEn ? "Upload and Manage Guests" : "Pakia na Simamia Wageni (Upload Guests)"}</span>
          </h2>
          <p className="text-slate-350 mt-0.5">
            {isEn ? "Generate a unique guest invitation card for each guest automatically." : "Tengeneza kadi mwalikwa ya kipekee kwa kila mgeni automatically."}
          </p>
        </div>
      </div>

      {/* Reassuring Save Status Banner */}
      {saveStatus === 'saving' ? (
        <div className="p-4 rounded-2xl border bg-blue-500/10 border-blue-500/20 text-blue-300 transition-all duration-300 flex items-center space-x-2.5">
          <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
          <p className="font-semibold text-xs">
            {isEn ? "Saving changes to database automatically..." : "Inahifadhi mabadiliko kwenye database kiotomatiki..."}
          </p>
        </div>
      ) : (
        <div className="p-4 rounded-2xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-300 transition-all duration-300 flex items-center space-x-2.5 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <p className="font-semibold text-xs">
            {isEn ? "All changes saved successfully to database! ✓" : "Mabadiliko yote yamehifadhiwa vizuri kwenye mfumo na database! ✓"}
          </p>
        </div>
      )}

      {/* Numeric Metrics cards wrapper */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
          <p className="text-[9px] uppercase font-mono tracking-wider text-slate-400 font-bold">DOUBLE</p>
          <p className="text-xl font-extrabold text-white mt-1">{countDouble}</p>
        </div>

        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
          <p className="text-[9px] uppercase font-mono tracking-wider text-slate-400 font-bold">SINGLE</p>
          <p className="text-xl font-extrabold text-white mt-1">{countSingle}</p>
        </div>

        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
          <p className="text-[9px] uppercase font-mono tracking-wider text-slate-400 font-bold">UNCLASSIFIED</p>
          <p className="text-xl font-extrabold text-white mt-1">{countUnclassified}</p>
        </div>

        <div className="backdrop-blur-md bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 text-center">
          <p className="text-[9px] uppercase font-mono tracking-wider text-blue-400 font-bold">{isEn ? "Total Cards" : "Jumla Kadi"}</p>
          <p className="text-xl font-extrabold text-blue-300 mt-1">{totalCards}</p>
        </div>

      </div>

      {/* Action panel & search bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-2">
        
        {/* Search & Tag Filter */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:max-w-2xl">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-450">
              <Search className="w-4 h-4" />
            </span>
            <input 
              type="text"
              placeholder={isEn ? "Search by Name, Phone, or Code..." : "Tafuta kwa Jina, Simu, au Code..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-sans placeholder-slate-400"
            />
          </div>

          {/* Tag Filter Dropdown */}
          {allGuestTags.length > 0 && (
            <div className="relative">
              <select
                value={selectedTagFilter}
                onChange={(e) => setSelectedTagFilter(e.target.value)}
                className="bg-[#090f1d] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-semibold cursor-pointer text-xs h-full w-full sm:w-auto"
              >
                <option value="ALL">{isEn ? "All Tags (Lebo Zote)" : "Lebo Zote"}</option>
                {allGuestTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Action Buttons to open modals */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto font-semibold">
          {saveStatus === 'saving' ? (
            <div className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-xs select-none">
              <div className="w-3.5 h-3.5 rounded-full border border-blue-400 border-t-transparent animate-spin" />
              <span>{isEn ? "Saving automatically..." : "Inahifadhi kiotomatiki..."}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs select-none">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{isEn ? "All Saved ✓" : "Kimehifadhiwa ✓"}</span>
            </div>
          )}

          {guests.length > 0 && (
            <>
              <button
                id="remove-duplicate-guests-btn"
                onClick={handleRemoveDuplicates}
                className="flex-1 sm:flex-initial bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-white px-4 py-2.5 rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer font-bold"
                title={isEn ? "Remove duplicate guest names or numbers" : "Ondoa wageni wote wenye majina au namba zinazofanana"}
              >
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>{isEn ? "Remove Duplicates" : "Safisha Waliojirudia"}</span>
              </button>

              <button
                id="clear-all-guests-btn"
                onClick={() => setShowClearConfirm(true)}
                className="flex-1 sm:flex-initial bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-300 hover:text-white px-4 py-2.5 rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer font-bold"
                title={isEn ? "Delete all guests at once" : "Futa wageni wote kwa wakati mmoja"}
              >
                <Trash2 className="w-4 h-4" />
                <span>{isEn ? "Delete All Guests" : "Futa Wageni Wote"}</span>
              </button>
            </>
          )}

          <button
            id="bulk-preview-btn"
            onClick={() => setIsBulkPreviewOpen(true)}
            disabled={guests.length === 0}
            className="flex-1 sm:flex-initial bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:text-white hover:bg-blue-500/25 px-4 py-2.5 rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            title={isEn ? "Quickly preview each guest's card layout" : "Hakiki muonekano wa kila kadi ya kila mgeni haraka"}
          >
            <ImageIcon className="w-4 h-4" />
            <span>{isEn ? "Bulk Preview Cards" : "Hakiki Kadi (Bulk Preview)"}</span>
          </button>

          <button
            id="add-single-guest-btn"
            onClick={() => setIsSingleModalOpen(true)}
            className="flex-1 sm:flex-initial bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] text-white px-4 py-2.5 rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer font-bold"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isEn ? "Single Guest" : "Mgeni Mmoja"}</span>
          </button>
          
          <button
            id="add-bulk-guests-btn"
            onClick={() => setIsBulkModalOpen(true)}
            className="flex-1 sm:flex-initial bg-[#050b18] border border-white/15 text-slate-200 hover:text-white hover:bg-white/5 px-4 py-2.5 rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer font-bold"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isEn ? "Bulk Upload" : "Pakia kwa Pamoja"}</span>
          </button>
        </div>

      </div>

      {/* Main Guests Grid Table */}
      <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/5 text-xs">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-slate-400 font-mono uppercase text-[9px] tracking-wider border-b border-white/10">
                <th className="px-5 py-3">Serial</th>
                <th 
                  className="px-5 py-3 cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>{isEn ? 'Guest Name' : 'Jina la Mgeni'}</span>
                    {sortBy === 'name' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-5 py-3">{isEn ? 'Contact (Phone)' : 'Mawasiliano (Simu)'}</th>
                <th className="px-5 py-3 text-center">{isEn ? 'Card Code' : 'Namba ya Code'}</th>
                <th 
                  className="px-5 py-3 text-center cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => handleSort('cardType')}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>{isEn ? 'Card Type' : 'Aina ya Kadi'}</span>
                    {sortBy === 'cardType' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-5 py-3 text-center cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => handleSort('rsvpStatus')}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>{isEn ? 'RSVP Status' : 'Hali ya RSVP'}</span>
                    {sortBy === 'rsvpStatus' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-5 py-3 text-right">{isEn ? 'Card Verification' : 'Uhakiki Kadi'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {sortedGuests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 font-sans">
                    {isEn ? "No guests found. Upload or add guests first to begin!" : "Hakuna mgeni aliyepatikana. Pakia au ongeza wageni kwanza kuanza!"}
                  </td>
                </tr>
              ) : (
                sortedGuests.map((guest, rowIndex) => (
                  <tr key={guest.id} className="hover:bg-white/5 transition-colors border-b border-white/5">
                    <td className="px-5 py-3 font-mono text-slate-400">#{rowIndex + 1}</td>
                    <td className="px-5 py-3 font-bold text-white">
                      <div className="max-w-[160px] sm:max-w-[260px] truncate" title={guest.name}>{guest.name}</div>
                      <div className="flex items-center space-x-2 mt-1 text-[10px] font-mono text-slate-400 font-normal">
                        <span className="flex items-center gap-0.5">
                          <span className="text-blue-400">SMS:</span> {guest.smsCount || (isStatusSent(guest.smsStatus) ? 1 : 0)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <span className="text-emerald-400">WA:</span> {guest.whatsappCount || (isStatusSent(guest.whatsappStatus) ? 1 : 0)}
                        </span>
                      </div>
                      {((guest.tags && guest.tags.length > 0) || guest.category || (guest.pledgeAmount && guest.pledgeAmount > 0) || (guest.paidAmount && guest.paidAmount > 0) || (guest.customFields && Object.keys(guest.customFields).length > 0)) && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {guest.category && (
                            <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-300 rounded border border-blue-500/20 text-[9px] font-bold">
                              {guest.category}
                            </span>
                          )}
                          {guest.tags?.filter(t => t !== guest.category).map((tag, tIdx) => (
                            <span key={tIdx} className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-300 rounded border border-indigo-500/20 text-[9px] font-bold">
                              {tag}
                            </span>
                          ))}
                          {guest.pledgeAmount && guest.pledgeAmount > 0 ? (
                            <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-300 rounded border border-purple-500/20 text-[9px] font-bold font-mono">
                              Ahadi: TZS {guest.pledgeAmount.toLocaleString()}
                            </span>
                          ) : null}
                          {guest.paidAmount && guest.paidAmount > 0 ? (
                            <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-300 rounded border border-emerald-500/30 text-[9px] font-bold font-mono">
                              Paid: TZS {guest.paidAmount.toLocaleString()}
                            </span>
                          ) : null}
                          {guest.customFields && guest.customFields.tableNumber && (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-300 rounded border border-amber-500/20 text-[9px] font-bold">
                              {isEn ? 'Table' : 'Meza'}: {guest.customFields.tableNumber}
                            </span>
                          )}
                          {guest.customFields && guest.customFields.foodPreference && (
                            <span className="px-1.5 py-0.5 bg-pink-500/10 text-pink-300 rounded border border-pink-500/20 text-[9px] font-bold">
                              {isEn ? 'Food' : 'Chakula'}: {guest.customFields.foodPreference}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-300 max-w-[125px] sm:max-w-[180px] truncate" title={guest.phone}>
                      <div className="flex items-center space-x-1.5">
                        <span className={(() => {
                           const clean = (guest.phone || '').replace(/\D/g, '').slice(-9);
                           return clean && (duplicatePhoneMap.get(clean)?.length || 0) > 1 ? 'text-amber-400 font-bold' : '';
                        })()}>{guest.phone}</span>
                        {(() => {
                           const clean = (guest.phone || '').replace(/\D/g, '').slice(-9);
                           if (clean && (duplicatePhoneMap.get(clean)?.length || 0) > 1) {
                             return (
                               <AlertTriangle className="w-3.5 h-3.5 text-amber-500" title="Taarifa: Namba hii imejirudia (Duplicate phone number)" />
                             );
                           }
                           return null;
                        })()}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono font-bold px-2 py-0.5 rounded text-[10px]">
                        {guest.code}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        guest.cardType === 'DOUBLE' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        guest.cardType === 'SINGLE' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {guest.cardType}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold border inline-flex items-center space-x-1 ${
                        guest.rsvpStatus === 'Atahudhuria' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        guest.rsvpStatus === 'Hatahudhuria' ? 'bg-red-500/10 text-rose-300 border-red-500/20' :
                        guest.rsvpStatus === 'Labda' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-white/5 text-slate-400 border-white/10'
                      }`}>
                        {guest.rsvpStatus === 'Bado' || !guest.rsvpStatus ? 'Bado Jibu' : guest.rsvpStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right space-x-1.5 flex justify-end items-center font-bold">
                      <button
                        onClick={() => setPreviewGuest(guest)}
                        className="p-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg transition cursor-pointer"
                        title="View Card"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleStartEdit(guest)}
                        className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 rounded-lg transition cursor-pointer"
                        title="Hariri Taarifa"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteGuest(guest.id, guest.name)}
                        className="p-1.5 bg-rose-500/20 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-500 text-rose-300 hover:text-white rounded-lg transition cursor-pointer flex items-center justify-center shadow-sm"
                        title="Futa Mgeni"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigation button */}
      <div className="flex justify-end pt-4 border-t border-white/10">
        <button
          id="guests-next-btn"
          onClick={onNext}
          disabled={guests.length === 0}
          className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] text-white font-bold rounded-xl transition disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center space-x-2 text-xs"
        >
          <span>Anza Kutuma Mialiko (Send)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 1. Modal: Single Guest Addition */}
      <AnimatePresence>
        {isSingleModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="backdrop-blur-xl bg-[#090f1d] rounded-3xl p-6 sm:p-8 max-w-md w-full border border-white/15 shadow-2xl space-y-5 text-xs font-sans relative text-white"
            >
              <button 
                onClick={() => setIsSingleModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-base font-bold text-white pr-8">Weka Mgeni Mpya mmoja</h3>
              
              <form onSubmit={handleAddSingleGuest} className="space-y-4 text-xs font-sans">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-355 block" htmlFor="input-mgeni-single-name">JINA LA MGENI *</label>
                  <input 
                    id="input-mgeni-single-name"
                    type="text" 
                    required 
                    placeholder="Weka jina la mgeni..."
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-355 block" htmlFor="input-mgeni-single-phone">NAMBA YA SIMU (OPTIONAL)</label>
                  <input 
                    id="input-mgeni-single-phone"
                    type="tel" 
                    placeholder="e.g. 0714786751"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  {guestPhone.trim() && (
                    <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
                      {isEn ? "System will format as:" : "Kihifadhiwa kama:"} {standardisePhoneNumber(guestPhone)}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-355 block" htmlFor="input-mgeni-single-tags">LEBO (TAGS) - Tenganisha kwa mkato (,)</label>
                  <input 
                    id="input-mgeni-single-tags"
                    type="text" 
                    placeholder="e.g. Ndugu wa Bwana Harusi, Wafanyakazi"
                    value={guestTags}
                    onChange={(e) => setGuestTags(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-355 block" htmlFor="input-mgeni-single-table">NAMBARI YA MEZA</label>
                    <input 
                      id="input-mgeni-single-table"
                      type="text" 
                      placeholder="e.g. Meza #5"
                      value={guestTableNumber}
                      onChange={(e) => setGuestTableNumber(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-355 block" htmlFor="input-mgeni-single-food">AINA YA CHAKULA</label>
                    <input 
                      id="input-mgeni-single-food"
                      type="text" 
                      placeholder="e.g. Kuku / Mboga"
                      value={guestFoodPreference}
                      onChange={(e) => setGuestFoodPreference(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-355 block" htmlFor="input-mgeni-single-type">KUNDI / AINA YA KADI *</label>
                    <select
                      id="input-mgeni-single-type"
                      value={guestType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGuestType(val);
                        setGuestMaxGuests(val === 'DOUBLE' ? 2 : 1);
                      }}
                      className="w-full bg-[#050b18] border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none font-bold cursor-pointer"
                    >
                      {availableCategories.map(cat => (
                        <option key={cat} value={cat} className="bg-[#050b18] text-white">{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-355 block" htmlFor="input-mgeni-single-max">UPEO WA WAGENI (MAX)</label>
                    <input 
                      id="input-mgeni-single-max"
                      type="number" 
                      min="1"
                      max="100"
                      value={guestMaxGuests}
                      onChange={(e) => setGuestMaxGuests(parseInt(e.target.value) || 1)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-bold"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  id="submit-single-guest-btn"
                  disabled={isSubmitting}
                  className={`w-full py-3 ${isSubmitting ? 'bg-slate-700' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]'} text-white font-bold rounded-xl transition shadow-md cursor-pointer`}
                >
                  {isSubmitting ? 'Inahifadhi...' : 'Ongeza Mgeni Sasa ✓'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Modal: Bulk Import */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="backdrop-blur-xl bg-[#090f1d] rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-white/15 z-50 shadow-2xl space-y-5 text-xs font-sans relative text-white"
            >
              <button 
                onClick={() => setIsBulkModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-base font-bold text-white">Uingizaji Wageni kwa Wingi (Smart Bulk Add)</h3>
              <p className="text-[11px] text-slate-300 leading-normal">
                Mfumo utagundua na kupanga taarifa kiotomatiki kulingana na <strong>Kichwa cha Habari (Headers)</strong> kama <em>Guest Full Name, Phone, Category, Pledge, Paid</em> n.k. Si lazima kuweka taarifa zote au kwa mpangilio ule ule.
              </p>

              {/* Sample hint card */}
              <div className="bg-white/5 p-3 rounded-xl border border-white/10 font-mono text-[10px] text-slate-300 space-y-2">
                <div className="space-y-0.5">
                  <p className="font-bold text-white">Mfano wa kadi/safu wima zinazotambuliwa:</p>
                  <p className="text-emerald-300">Guest Full Name *, Phone Number, Category, Pledge, Paid</p>
                  <p className="text-slate-400">Arnold Kimaro | VIP | Ahadi: 5,000,000 | Paid: 3,000,000</p>
                  <p className="text-slate-400">Ernest Gao | Wafanyakazi | Ahadi: 250,000 | Paid: 0</p>
                </div>
                <div className="pt-2 border-t border-white/5 flex justify-between items-center gap-2">
                  <span className="text-[9px] text-slate-400 font-sans">Unataka mfano wa faili la Excel/CSV?</span>
                  <button
                    type="button"
                    onClick={handleDownloadSampleCSV}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-[10px] font-sans transition cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Pakua Excel/CSV Template</span>
                  </button>
                </div>
              </div>

              {/* Tab Selector inside Bulk Modal */}
              <div className="flex border-b border-white/10 mt-1">
                <button
                  type="button"
                  onClick={() => setBulkMode('text')}
                  className={`flex-1 py-2 font-bold border-b-2 text-center transition-all cursor-pointer text-[11px] ${
                    bulkMode === 'text'
                      ? 'border-blue-500 text-blue-400 font-extrabold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Mbinu ya 1: Paste kutoka Excel/Sheets</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBulkMode('file')}
                  className={`flex-1 py-2 font-bold border-b-2 text-center transition-all cursor-pointer text-[11px] ${
                    bulkMode === 'file'
                      ? 'border-blue-500 text-blue-400 font-extrabold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Mbinu ya 2: Pakia Faili la Excel (.xlsx / .csv)</span>
                </button>
              </div>

              {bulkMode === 'file' ? (
                <div className="space-y-4 text-xs">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        setFileName(file.name);
                        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
                        if (isExcel) {
                          const reader = new FileReader();
                          reader.onload = (eventOnload) => {
                            try {
                              const buffer = eventOnload.target?.result as ArrayBuffer;
                              const workbook = XLSX.read(buffer, { type: 'array' });
                              const sheetName = workbook.SheetNames[0];
                              const rawMatrix: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '' });
                              const parsed = parseUniversalGuestTable(rawMatrix);
                              if (parsed.length === 0) {
                                setCsvError('Haikupata mgeni yeyote katika faili la Excel.');
                              } else {
                                setParsedFileGuests(parsed);
                              }
                            } catch (err) {
                              setCsvError('Imeshindikana kusoma faili la Excel.');
                            }
                          };
                          reader.readAsArrayBuffer(file);
                        } else {
                          const reader = new FileReader();
                          reader.onload = (eventOnload) => {
                            const text = eventOnload.target?.result as string;
                            if (text) parseCSVFileContent(text);
                          };
                          reader.readAsText(file);
                        }
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
                      isDragging
                        ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
                        : fileName
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".xlsx,.xls,.csv,.txt"
                      className="hidden"
                    />
                    
                    {fileName ? (
                      <div className="space-y-2">
                        <FileText className="w-10 h-10 mx-auto text-emerald-400 animate-bounce" />
                        <p className="font-bold text-white max-w-full truncate text-[11px]">{fileName}</p>
                        <p className="text-[10px] text-emerald-450">Bonyeza chini kumalizia kuyaingiza!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-10 h-10 mx-auto text-blue-455 animate-pulse" />
                        <p className="font-semibold text-slate-200">Bofya hapa au Vuta na kuachia faili sasa (Drag & Drop)</p>
                        <p className="text-[10px] text-slate-400">Inasaidia faili za Excel (.xlsx, .xls), CSV na Text (.txt)</p>
                      </div>
                    )}
                  </div>

                  {csvError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-rose-300 p-3 rounded-xl text-[10px] leading-relaxed">
                      ⚠️ {csvError}
                    </div>
                  )}

                  {parsedFileGuests.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                        Wageni waliopatikana kwenye faili ({parsedFileGuests.length}):
                      </p>
                      <div className="border border-white/15 rounded-xl max-h-[140px] overflow-y-auto divide-y divide-white/5 bg-[#050b18] text-[10.5px]">
                        {parsedFileGuests.slice(0, 10).map((g, idx) => (
                          <div key={idx} className="p-2 flex flex-wrap justify-between items-center gap-1.5 text-slate-350">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white truncate max-w-[130px]">{g.name}</span>
                              {g.phone && <span className="font-mono text-[10px] text-slate-400">{g.phone}</span>}
                            </div>
                            <div className="flex items-center gap-1">
                              {g.category && (
                                <span className="bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                  {g.category}
                                </span>
                              )}
                              {(g.pledgeAmount || 0) > 0 && (
                                <span className="bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded">
                                  Ahadi: TZS {g.pledgeAmount?.toLocaleString()}
                                </span>
                              )}
                              {(g.paidAmount || 0) > 0 && (
                                <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded">
                                  Paid: TZS {g.paidAmount?.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {parsedFileGuests.length > 10 && (
                          <div className="p-2 text-center text-[10px] text-slate-500 italic">
                            ... na wageni wengine {parsedFileGuests.length - 10} zaidi.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={parsedFileGuests.length === 0}
                    onClick={handleAddParsedFileGuests}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] text-white font-bold rounded-xl transition shadow-md disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed text-xs cursor-pointer"
                  >
                    Ongeza Wageni ({parsedFileGuests.length}) Kwenye Orodha Sasa ✓
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddBulkGuests} className="space-y-4">
                  <textarea
                    id="bulk-guests-textarea"
                    rows={7}
                    required
                    placeholder={`Paste au andika orodha yako hapa kutoka Excel au Google Sheets...\n\nGuest Full Name *\tPhone Number (Optional)\tCategory\tPledge (TZS)\tPaid (TZS)\nArnold Kimaro\t\tVIP\t5,000,000\t3,000,000\nErnest Gao\t\tWafanyakazi\t250,000\t0`}
                    value={bulkTextInput}
                    onChange={(e) => setBulkTextInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 font-mono text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />

                  <button 
                    type="submit"
                    id="submit-bulk-guests-btn"
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] text-white font-bold rounded-xl transition shadow-md cursor-pointer"
                  >
                    Hifadhi na Ongeza Orodha Sasa ✓
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Modal Lightbox: Guest Card visual previews */}
      <AnimatePresence>
        {previewGuest && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="backdrop-blur-xl bg-[#090f1d] rounded-3xl p-6 max-w-sm w-full border border-white/15 shadow-2xl relative flex flex-col items-center space-y-4 text-white"
            >
              <button 
                onClick={() => setPreviewGuest(null)}
                className="absolute top-4 right-4 text-slate-300 hover:text-white bg-white/10 p-1.5 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center">
                <h4 className="text-sm font-bold text-white uppercase">Kadi ya Mwaliko Binafsi</h4>
                <p className="text-[10px] text-slate-300 font-mono mt-0.5">{previewGuest.name}</p>
              </div>

              {/* Dynamic canvas drawing preview */}
              <div id="preview" className={`relative border-4 border-white/15 rounded-2xl shadow-xl overflow-hidden bg-white w-full ${settings.orientation === 'landscape' ? 'aspect-[4/3] max-w-[340px]' : 'aspect-[3/4] max-w-[280px]'}`}>
                <canvas 
                  ref={previewCanvasRef} 
                  width={(settings.orientation === 'landscape' ? 600 : 450) * 3} 
                  height={(settings.orientation === 'landscape' ? 450 : 600) * 3} 
                  className="w-full h-auto block"
                />
                {/* Transparent 'PREVIEW MODE' watermark overlay */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none z-30 overflow-hidden">
                  <div className="transform -rotate-45 border-3 border-slate-900/15 rounded-xl px-5 py-2 bg-white/10 shadow-inner backdrop-blur-[1px]">
                    <span className="text-slate-900/25 font-black text-lg sm:text-2xl tracking-[0.25em] uppercase whitespace-nowrap select-none">
                      PREVIEW MODE
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full flex gap-3 text-xs">
                <button
                  onClick={() => {
                    const canvas = previewCanvasRef.current;
                    if (canvas) {
                      const link = document.createElement('a');
                      link.href = canvas.toDataURL('image/jpeg', 0.95);
                      link.download = `Kadi_${previewGuest.name.replace(/\s+/g, '_')}.jpg`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Pakua Kadi (Download)</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Modal Lightbox: Bulk card/design gallery and carousel */}
      <AnimatePresence>
        {isBulkPreviewOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="backdrop-blur-xl bg-[#090f1d] rounded-3xl p-6 w-full max-w-5xl h-[85vh] border border-white/15 shadow-2xl relative flex flex-col text-white animate-fade-in"
            >
              {/* Close Button */}
              <button 
                onClick={() => setIsBulkPreviewOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white bg-white/10 p-1.5 rounded-full hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Title Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4 pr-10">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-blue-400" />
                    <span>Uhakiki wa Pamoja wa Kadi (Bulk Card Gallery)</span>
                  </h3>
                  <p className="text-[11px] text-slate-350 mt-0.5">Hakiki muonekano mmoja mmoja au kwa muundo wa kundi kukamilisha wageni wote {guests.length}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
                  {/* Print Cards Button */}
                  <button
                    onClick={handlePrintAllCards}
                    className="bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 hover:text-white px-3.5 py-1.5 rounded-xl text-[10.5px] font-bold inline-flex items-center space-x-1.5 transition cursor-pointer"
                    title="Chapisha Kadi Zote Zinazochujwa Sasa"
                  >
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <span>Chapisha Kadi (Print Cards)</span>
                  </button>

                  {/* Grid vs. Carousel Switcher */}
                  <div className="flex bg-white/5 rounded-xl p-1 border border-white/10 self-start">
                    <button
                      onClick={() => setPreviewTab('grid')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                        previewTab === 'grid' 
                          ? 'bg-blue-600 text-white' 
                          : 'text-slate-405 hover:text-slate-200'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Grid Gallery</span>
                    </button>
                    <button
                      onClick={() => {
                        setPreviewTab('carousel');
                        setCarouselIndex(0);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                        previewTab === 'carousel' 
                          ? 'bg-blue-600 text-white' 
                          : 'text-slate-405 hover:text-slate-200'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Carousel Mode</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Filters Panel */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between py-3 border-b border-white/5 text-[11px]">
                {/* Search Term */}
                <div className="relative w-full sm:max-w-xs">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input 
                    type="text"
                    placeholder="Tafuta jina la mgeni..."
                    value={previewQuery}
                    onChange={(e) => {
                      setPreviewQuery(e.target.value);
                      setCarouselIndex(0);
                    }}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500/55 text-[10.5px] font-sans"
                  />
                </div>

                {/* Badge Type Filter */}
                <div className="flex flex-wrap gap-1.5 self-start sm:self-auto">
                  {['ALL', 'SINGLE', 'DOUBLE', 'UNCLASSIFIED'].map((type) => {
                    const count = type === 'ALL' 
                      ? guests.length 
                      : guests.filter(g => g.cardType === type).length;
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          setPreviewFilterType(type);
                          setCarouselIndex(0);
                        }}
                        className={`px-2.5 py-1 rounded-lg bg-white/5 border text-[9.5px] font-bold transition cursor-pointer ${
                          previewFilterType === type 
                            ? 'bg-blue-600/25 border-blue-500 text-blue-300 font-extrabold' 
                            : 'border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {type} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Body Scroll Container */}
              <div className="flex-grow overflow-y-auto py-4">
                {(() => {
                  const items = guests.filter(g => {
                    const matchQuery = g.name.toLowerCase().includes(previewQuery.toLowerCase());
                    const matchType = previewFilterType === 'ALL' || g.cardType === previewFilterType;
                    return matchQuery && matchType;
                  });

                  if (items.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2 py-12">
                        <ImageIcon className="w-10 h-10 text-slate-600 opacity-60 animate-pulse" />
                        <p className="font-sans">Hakuna kadi zilizopatikana kwenye kundi hili la vichujio.</p>
                      </div>
                    );
                  }

                  if (previewTab === 'grid') {
                    // Render Grid Gallery
                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {items.map((g) => (
                          <div 
                            key={g.id} 
                            style={{ contentVisibility: 'auto', containIntrinsicSize: '200px 280px' }}
                            className="bg-white/5 border border-white/10 rounded-2xl p-2.5 flex flex-col space-y-2 hover:border-blue-500/40 hover:bg-white/10 transition group"
                          >
                            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[#faf8f5] shadow border border-white/5 select-none pointer-events-none">
                              <LazyGuestCardImage 
                                guest={g} 
                                event={event} 
                                settings={settings} 
                                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                              />
                            </div>
                            <div className="flex flex-col text-[10px] leading-tight space-y-1 font-sans">
                              <span className="font-bold text-white truncate" title={g.name}>{g.name}</span>
                              <div className="flex justify-between items-center text-slate-400 font-mono text-[9px]">
                                <span>{g.code}</span>
                                <span className={`px-1.5 py-0.2 rounded-full font-bold text-[8.5px] border ${
                                  g.cardType === 'DOUBLE' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                  g.cardType === 'SINGLE' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                  'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                }`}>
                                  {g.cardType} {g.maxGuests && g.maxGuests > 1 ? `(Max: ${g.maxGuests})` : ''}
                                </span>
                              </div>
                            </div>
                            {/* Individual Action */}
                            <div className="flex justify-between items-center pt-1.5 border-t border-white/5 gap-1 text-[9.5px]">
                              <button
                                onClick={() => setPreviewGuest(g)}
                                className="flex-1 text-center py-1 rounded bg-white/10 text-slate-200 hover:text-white hover:bg-white/20 transition cursor-pointer flex items-center justify-center space-x-1 font-bold"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Lightbox</span>
                              </button>
                              <button
                                onClick={() => {
                                  const url = getCardImageUrlOnDemand(g, event, settings);
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = `Kadi_${g.name.replace(/\s+/g, '_')}.jpg`;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}
                                className="p-1 px-2 rounded bg-blue-600/25 border border-blue-500/30 text-blue-400 hover:text-white hover:bg-blue-600/35 transition cursor-pointer flex items-center justify-center"
                                title="Download image"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  } else {
                    // Render Carousel Mode
                    const activeIndex = Math.min(Math.max(0, carouselIndex), items.length - 1);
                    const activeGuest = items[activeIndex];

                    return (
                      <div className="h-full flex flex-col items-center justify-center md:flex-row md:justify-around gap-6">
                        {/* Carousel Prev Button */}
                        <button
                          type="button"
                          disabled={activeIndex === 0}
                          onClick={() => setCarouselIndex(idx => Math.max(0, idx - 1))}
                          className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition cursor-pointer border border-white/10 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>

                        {/* Slide Card visual wrapper */}
                        <div className="flex flex-col items-center space-y-3 shrink-0 max-w-sm w-full">
                          <div className="relative aspect-[3/4] border-4 border-white/15 rounded-2xl shadow-2xl overflow-hidden bg-white w-full max-w-[270px]">
                            <LazyGuestCardImage 
                              guest={activeGuest} 
                              event={event} 
                              settings={settings} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {/* Active Slide Pagination and guest information info card */}
                          <div className="text-center space-y-1">
                            <span className="text-[10px] font-mono tracking-widest text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-full font-bold">
                              KADI {activeIndex + 1} kati ya {items.length}
                            </span>
                            <h4 className="text-sm font-bold text-white uppercase mt-1">{activeGuest.name}</h4>
                            <p className="text-[10px] text-slate-400 font-mono">CODE: {activeGuest.code} | AINA: {activeGuest.cardType} | SIMU: {activeGuest.phone}</p>
                          </div>
                          
                          {/* Action for Carousel Slider active item */}
                          <div className="flex gap-2 w-full max-w-[270px] text-[10.5px]">
                            <button
                              type="button"
                              onClick={() => setPreviewGuest(activeGuest)}
                              className="flex-1 bg-white/10 hover:bg-white/15 border border-white/10 text-white py-2 rounded-lg font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Preview Lightbox</span>
                            </button>
                            <button
                              onClick={() => {
                                const url = getCardImageUrlOnDemand(activeGuest, event, settings);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `Kadi_${activeGuest.name.replace(/\s+/g, '_')}.jpg`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 rounded-lg font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Pakua (Download)</span>
                            </button>
                          </div>
                        </div>

                        {/* Carousel Next Button */}
                        <button
                          type="button"
                          disabled={activeIndex === items.length - 1}
                          onClick={() => setCarouselIndex(idx => Math.min(items.length - 1, idx + 1))}
                          className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition cursor-pointer border border-white/10 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Modal Footer helper */}
              <div className="border-t border-white/10 pt-3 text-[10px] text-slate-400 flex flex-col md:flex-row items-center justify-between font-mono">
                <span>* Unaweza kufuta mgeni pindi ukiona tatizo la muonekano kwenye orodha kuu ya Directory.</span>
                <span className="text-blue-400 mt-1 md:mt-0 font-bold">EVENT<span className="text-red-500">CARD</span> Designer Studio</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Modal: Edit Guest */}
      <AnimatePresence>
        {editingGuest && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="backdrop-blur-xl bg-[#090f1d] rounded-3xl p-6 sm:p-8 max-w-md w-full border border-white/15 shadow-2xl space-y-5 text-xs font-sans relative text-white"
            >
              <button 
                onClick={() => setEditingGuest(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-base font-bold text-white pr-8">Hariri Taarifa za Mgeni (Edit Guest Information)</h3>
              
              <form onSubmit={handleSaveEditGuest} className="space-y-4 text-xs font-sans">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-355 block" htmlFor="edit-mgeni-name">JINA LA MGENI *</label>
                  <input 
                    id="edit-mgeni-name"
                    type="text" 
                    required 
                    placeholder="Weka jina la mgeni..."
                    value={editGuestName}
                    onChange={(e) => setEditGuestName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-355 block" htmlFor="edit-mgeni-phone">NAMBA YA SIMU (OPTIONAL)</label>
                  <input 
                    id="edit-mgeni-phone"
                    type="tel" 
                    placeholder="e.g. 0714786751"
                    value={editGuestPhone}
                    onChange={(e) => setEditGuestPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  {editGuestPhone.trim() && (
                    <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
                      {isEn ? "System will format as:" : "Kihifadhiwa kama:"} {standardisePhoneNumber(editGuestPhone)}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-355 block" htmlFor="edit-mgeni-tags">LEBO (TAGS) - Tenganisha kwa mkato (,)</label>
                  <input 
                    id="edit-mgeni-tags"
                    type="text" 
                    placeholder="e.g. Ndugu wa Bwana Harusi, Wafanyakazi"
                    value={editGuestTags}
                    onChange={(e) => setEditGuestTags(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-355 block" htmlFor="edit-mgeni-table">NAMBARI YA MEZA</label>
                    <input 
                      id="edit-mgeni-table"
                      type="text" 
                      placeholder="e.g. Meza #5"
                      value={editGuestTableNumber}
                      onChange={(e) => setEditGuestTableNumber(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-355 block" htmlFor="edit-mgeni-food">AINA YA CHAKULA</label>
                    <input 
                      id="edit-mgeni-food"
                      type="text" 
                      placeholder="e.g. Kuku / Mboga"
                      value={editGuestFoodPreference}
                      onChange={(e) => setEditGuestFoodPreference(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-355 block" htmlFor="edit-mgeni-type">KUNDI / AINA YA KADI *</label>
                    <select
                      id="edit-mgeni-type"
                      value={editGuestType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditGuestType(val);
                        setEditGuestMaxGuests(val === 'DOUBLE' ? 2 : 1);
                      }}
                      className="w-full bg-[#050b18] border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none font-bold cursor-pointer"
                    >
                      {availableCategories.map(cat => (
                        <option key={cat} value={cat} className="bg-[#050b18] text-white">{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-355 block" htmlFor="edit-mgeni-max">UPEO WA WAGENI (MAX)</label>
                    <input 
                      id="edit-mgeni-max"
                      type="number" 
                      min="1"
                      max="100"
                      value={editGuestMaxGuests}
                      onChange={(e) => setEditGuestMaxGuests(parseInt(e.target.value) || 1)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-bold"
                    />
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setEditingGuest(null)}
                    className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition cursor-pointer text-center"
                  >
                    Ghairi
                  </button>
                  <button 
                    type="submit"
                    id="save-edit-guest-btn"
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] text-white font-bold rounded-xl transition shadow-md cursor-pointer text-center"
                  >
                    Hifadhi Tofauti ✓
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md z-[9999]" id="clear-all-guests-modal">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-[#0f172a] border border-rose-500/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 font-sans text-xs text-white"
            >
              <div className="w-12 h-12 rounded-full bg-rose-600/20 border border-rose-500 flex items-center justify-center text-rose-500 mx-auto">
                <Trash2 className="w-6 h-6 text-rose-500 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-rose-500">
                  {isEn ? "Delete All Guests ⚠️" : "Futa Wageni Wote ⚠️"}
                </h3>
                <p className="text-xs text-slate-450 leading-normal">
                  {isEn 
                    ? "Are you sure you want to delete ALL guests? This action will remove all registered guests from the table and delete all generated cards. This action cannot be undone." 
                    : "Je, una uhakika unataka kufuta wageni WOTE? Kitendo hiki kitaondoa wageni wote walioandikishwa kwenye jedwali pamoja na kadi zote zilizotengenezwa, na kitendo hiki hakiwezi kurejeshwa."}
                </p>
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-grow py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-bold text-slate-350 transition cursor-pointer"
                >
                  {isEn ? "Cancel" : "Ghairi"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateGuests([], `Amefuta wageni wote (Cleared All Guests)`);
                    setShowClearConfirm(false);
                  }}
                  className="flex-grow py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 hover:shadow-[0_0_15px_rgba(244,63,94,0.30)] text-xs font-bold text-white transition cursor-pointer"
                >
                  {isEn ? "Yes, Delete All" : "Ndiyo, Futa Wote"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDeleteTarget && (
          <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md z-[9999]" id="delete-single-guest-modal">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 font-sans text-xs text-white"
            >
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mx-auto">
                <Trash2 className="w-6 h-6 text-rose-550 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  {isEn ? "Delete Guest ⚠️" : "Futa Mgeni ⚠️"}
                </h3>
                <p className="text-xs text-slate-400 leading-normal">
                  {isEn 
                    ? <>Are you sure you want to permanently delete guest: <strong className="text-white font-extrabold">"{confirmDeleteTarget.name}"</strong>? This action cannot be undone.</>
                    : <>Je, una uhakika unataka kumfuta kabisa mgeni: <strong className="text-white font-extrabold">"{confirmDeleteTarget.name}"</strong> kutoka kwenye mfumo? Kitendo hiki hakiwezi kurejeshwa.</>}
                </p>
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteTarget(null)}
                  className="flex-grow py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-bold text-slate-350 transition cursor-pointer"
                >
                  {isEn ? "Cancel" : "Ghairi"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateGuests(guests.filter(g => g.id !== confirmDeleteTarget.id), `Amefuta mgeni (Deleted Guest): ${confirmDeleteTarget.name}`);
                    setConfirmDeleteTarget(null);
                  }}
                  className="flex-grow py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 hover:shadow-[0_0_15px_rgba(244,63,94,0.30)] text-xs font-bold text-white transition cursor-pointer"
                >
                  {isEn ? "Yes, Delete" : "Ndiyo, Futa"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Modal: Conflict Resolver */}
      <AnimatePresence>
        {conflictQueue.length > 0 && (() => {
          const conflict = conflictQueue[0];
          const newGuest = conflict.newGuest;
          const existingGuest = conflict.existingGuest;

          const isNameIdentical = newGuest.name.trim().toLowerCase() === existingGuest.name.trim().toLowerCase();
          const isPhoneIdentical = newGuest.phone.replace(/\D/g, '') === existingGuest.phone.replace(/\D/g, '');

          return (
            <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md z-[9999]" id="conflict-resolver-modal">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ duration: 0.25 }}
                className="bg-[#090f1d] border border-white/15 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 font-sans text-xs text-white animate-fade-in"
              >
                {/* Header */}
                <div className="flex justify-between items-start border-b border-white/10 pb-4">
                  <div>
                    <div className="flex items-center space-x-2 text-amber-400">
                      <AlertTriangle className="w-5 h-5" />
                      <h3 className="text-base font-bold text-white uppercase tracking-wider">
                        {isEn ? "Duplicate Guest Detected" : "Mgeni Mwenye Taarifa Zinazofanana"}
                      </h3>
                    </div>
                    <p className="text-slate-400 mt-1">
                      {isEn 
                        ? "The guest you are trying to add has duplicate details with an existing guest."
                        : "Mgeni unayejaribu kumuweka ana taarifa zinazolingana na mgeni aliyepo tayari kwenye mfumo."}
                    </p>
                  </div>
                  <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-full font-mono font-bold text-[10px]">
                    {isEn ? "Conflict" : "Mgongano"} 1 / {conflictQueue.length}
                  </span>
                </div>

                {/* Side-by-side comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Left: Existing Guest */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4.5 space-y-3 relative">
                    <span className="absolute top-3 right-3 text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                      {isEn ? "IN SYSTEM" : "ALIYEPO KANZI-DATA"}
                    </span>
                    <h4 className="text-slate-400 font-mono text-[10px] uppercase tracking-wider">{isEn ? "Existing Guest" : "Mgeni wa Sasa"}</h4>
                    
                    <div className="space-y-2.5 pt-1">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold font-mono">{isEn ? "Name" : "Jina la Mgeni"}</p>
                        <p className={`font-bold text-sm ${isNameIdentical ? 'text-amber-400' : 'text-white'}`}>{existingGuest.name}</p>
                      </div>

                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold font-mono">{isEn ? "Phone" : "Namba ya Simu"}</p>
                        <p className={`font-mono text-xs font-bold ${isPhoneIdentical ? 'text-amber-400' : 'text-slate-300'}`}>{existingGuest.phone || (isEn ? "None" : "Haina")}</p>
                      </div>

                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold font-mono">{isEn ? "Card Type" : "Aina ya Kadi"}</p>
                        <span className="inline-block mt-0.5 bg-slate-500/15 border border-slate-500/30 text-slate-300 px-2 py-0.5 rounded font-bold text-[10px]">{existingGuest.cardType}</span>
                      </div>

                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold font-mono">{isEn ? "Tags & Custom Info" : "Lebo na Sehemu Nyingine"}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {existingGuest.tags && existingGuest.tags.length > 0 ? (
                            existingGuest.tags.map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded text-[9px] font-bold">{tag}</span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">{isEn ? "No tags" : "Hakuna lebo"}</span>
                          )}
                        </div>
                        <div className="space-y-1 mt-1 text-[10px] font-mono">
                          {existingGuest.customFields?.tableNumber && (
                            <p className="text-amber-300"><span className="text-slate-500">{isEn ? "Table" : "Meza"}:</span> {existingGuest.customFields.tableNumber}</p>
                          )}
                          {existingGuest.customFields?.foodPreference && (
                            <p className="text-pink-300"><span className="text-slate-500">{isEn ? "Food" : "Chakula"}:</span> {existingGuest.customFields.foodPreference}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: New Incoming Guest */}
                  <div className="bg-[#1e152f]/30 border border-purple-500/15 rounded-2xl p-4.5 space-y-3 relative">
                    <span className="absolute top-3 right-3 text-[9px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                      {isEn ? "INCOMING" : "MPYA ANAYEKUJA"}
                    </span>
                    <h4 className="text-purple-400 font-mono text-[10px] uppercase tracking-wider">{isEn ? "New Details" : "Maelezo Mapya"}</h4>
                    
                    <div className="space-y-2.5 pt-1">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold font-mono">{isEn ? "Name" : "Jina la Mgeni"}</p>
                        <p className={`font-bold text-sm ${isNameIdentical ? 'text-amber-400' : 'text-white'}`}>{newGuest.name}</p>
                      </div>

                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold font-mono">{isEn ? "Phone" : "Namba ya Simu"}</p>
                        <p className={`font-mono text-xs font-bold ${isPhoneIdentical ? 'text-amber-400' : 'text-slate-300'}`}>{newGuest.phone || (isEn ? "None" : "Haina")}</p>
                      </div>

                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold font-mono">{isEn ? "Card Type" : "Aina ya Kadi"}</p>
                        <span className="inline-block mt-0.5 bg-purple-500/15 border border-purple-500/30 text-purple-300 px-2 py-0.5 rounded font-bold text-[10px]">{newGuest.cardType}</span>
                      </div>

                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold font-mono">{isEn ? "Tags & Custom Info" : "Lebo na Sehemu Nyingine"}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {newGuest.tags && newGuest.tags.length > 0 ? (
                            newGuest.tags.map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded text-[9px] font-bold">{tag}</span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">{isEn ? "No tags" : "Hakuna lebo"}</span>
                          )}
                        </div>
                        <div className="space-y-1 mt-1 text-[10px] font-mono">
                          {newGuest.customFields?.tableNumber && (
                            <p className="text-amber-300"><span className="text-slate-500">{isEn ? "Table" : "Meza"}:</span> {newGuest.customFields.tableNumber}</p>
                          )}
                          {newGuest.customFields?.foodPreference && (
                            <p className="text-pink-300"><span className="text-slate-500">{isEn ? "Food" : "Chakula"}:</span> {newGuest.customFields.foodPreference}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Conflict Solver Options */}
                <div className="space-y-2 pt-2">
                  <p className="font-bold text-[10px] uppercase text-slate-400 font-mono tracking-wider">
                    {isEn ? "Select Action to Resolve" : "Chagua Hatua ya Kutatua Mgongano"}
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Option 1: Merge */}
                    <button
                      type="button"
                      onClick={() => handleResolveMerge(newGuest, existingGuest)}
                      className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-amber-300 hover:text-amber-200 transition cursor-pointer text-center space-y-1.5 font-sans"
                    >
                      <span className="font-extrabold text-xs">{isEn ? "Smart Merge" : "Unganisha Taarifa"}</span>
                      <span className="text-[9px] text-slate-400 font-normal leading-tight">
                        {isEn ? "Update existing guest with new info, merging tags/fields" : "Hifadhi mapya juu ya yaliyopo, changanya lebo/meza"}
                      </span>
                    </button>

                    {/* Option 2: Skip */}
                    <button
                      type="button"
                      onClick={handleResolveSkip}
                      className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition cursor-pointer text-center space-y-1.5 font-sans"
                    >
                      <span className="font-extrabold text-xs">{isEn ? "Skip / Discard" : "Kuruka (Skip)"}</span>
                      <span className="text-[9px] text-slate-400 font-normal leading-tight">
                        {isEn ? "Discard the incoming duplicate and keep existing guest" : "Kuruka na kuacha ya sasa ibaki vile vile bila mabadiliko"}
                      </span>
                    </button>

                    {/* Option 3: Keep Both */}
                    <button
                      type="button"
                      onClick={() => handleResolveKeepBoth(newGuest)}
                      className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-300 hover:text-indigo-200 transition cursor-pointer text-center space-y-1.5 font-sans"
                    >
                      <span className="font-extrabold text-xs">{isEn ? "Keep Both" : "Hifadhi Wote Wawili"}</span>
                      <span className="text-[9px] text-slate-400 font-normal leading-tight">
                        {isEn ? "Register incoming as a completely separate guest" : "Sajili mpya pembeni kama mtu mwingine tofauti kabisa"}
                      </span>
                    </button>
                  </div>
                </div>

              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}
