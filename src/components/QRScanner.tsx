import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QrCode, CheckCircle, XCircle, AlertTriangle, ShieldCheck, Search, Users, Sparkles, MapPin, History, Clock, Download, Camera, X, Globe, ExternalLink, RefreshCw } from 'lucide-react';
import { EventDetails, Guest } from '../types';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { useLanguage } from '../context/LanguageContext';
import { safeLocalStorage } from '../utils/storage';

interface QRScannerProps {
  event: EventDetails;
  guests: Guest[];
  onUpdateGuests: (guests: Guest[], actionDesc?: string, skipServerSave?: boolean) => void;
  isStandaloneOnly?: boolean;
}

export default function QRScanner({ event, guests, onUpdateGuests, isStandaloneOnly = false }: QRScannerProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const isReadOnlyScanner = typeof window !== 'undefined' && safeLocalStorage.getItem('eventcard_scanner_mode') === 'true';

  // Connection/Sync states
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [forceOffline, setForceOffline] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return safeLocalStorage.getItem(`eventcard_force_offline_${event.id}`) === 'true';
    }
    return false;
  });
  const [pendingSyncQueue, setPendingSyncQueue] = useState<{ guestId: string; checkedInTime: string }[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = safeLocalStorage.getItem(`eventcard_pending_sync_${event.id}`);
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        console.warn('Failed to parse pending sync queue', e);
      }
    }
    return [];
  });
  const [syncingNow, setSyncingNow] = useState<boolean>(false);

  const [selectedGuestSimId, setSelectedGuestSimId] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState('');
  const [scanResult, setScanResult] = useState<{
    status: 'success' | 'duplicate' | 'error';
    guestId?: string;
    guestName?: string;
    cardType?: string;
    companions?: number;
    time?: string;
    isOfflineSaved?: boolean;
  } | null>(null);

  const [activeTab, setActiveTab ] = useState<'scanner' | 'list' | 'logs'>('scanner');
  const [listSearch, setListSearch] = useState('');
  const [listFilter, setListFilter] = useState<'all' | 'checked-in' | 'pending' | 'confirmed'>('confirmed');
  const [recentScans, setRecentScans] = useState<{ id: string; name: string; time: string; cardType: string }[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save manual force offline option when changed
  useEffect(() => {
    safeLocalStorage.setItem(`eventcard_force_offline_${event.id}`, forceOffline ? 'true' : 'false');
  }, [forceOffline, event.id]);

  // Persist pending sync queue
  useEffect(() => {
    safeLocalStorage.setItem(`eventcard_pending_sync_${event.id}`, JSON.stringify(pendingSyncQueue));
  }, [pendingSyncQueue, event.id]);

  // Sync handler for offline updates
  const handleSyncOfflineChanges = async () => {
    if (pendingSyncQueue.length === 0 || syncingNow) return;
    setSyncingNow(true);
    try {
      let updatedGuests = [...guestsRef.current];
      pendingSyncQueue.forEach(item => {
        updatedGuests = updatedGuests.map(g => {
          if (g.id === item.guestId && !g.checkedIn) {
            return {
              ...g,
              checkedIn: true,
              checkedInTime: item.checkedInTime
            };
          }
          return g;
        });
      });

      const syncDesc = isEn 
        ? `Synced ${pendingSyncQueue.length} offline gate check-ins to server` 
        : `Amesawazisha wageni ${pendingSyncQueue.length} walioingia nje ya mtandao kwenda kwenye server kuu`;
      
      await onUpdateGuests(updatedGuests, syncDesc, false);
      
      setPendingSyncQueue([]);
      
      setScanResult({
        status: 'success',
        guestName: isEn ? 'Synchronization Complete!' : 'Marekebisho Yamesawazishwa!',
        cardType: isEn ? `${pendingSyncQueue.length} guests synced` : `Wageni ${pendingSyncQueue.length} wamesawazishwa`
      });
      playFeedbackSound('success');
    } catch (e) {
      console.error('Failed to sync offline changes:', e);
      setManualError(isEn ? 'Failed to synchronize with server. Please check your network.' : 'Haikuweza kusawazisha na server. Tafadhali kagua mtandao.');
    } finally {
      setSyncingNow(false);
    }
  };

  // Auto-sync when online
  useEffect(() => {
    if (isOnline && !forceOffline && pendingSyncQueue.length > 0) {
      handleSyncOfflineChanges();
    }
  }, [isOnline, forceOffline, pendingSyncQueue.length]);
  
  // Real Camera capture state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const cameraActiveRef = useRef<boolean>(false);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Guest photo snapping states
  const [photoGuest, setPhotoGuest] = useState<Guest | null>(null);
  const [snapStream, setSnapStream] = useState<MediaStream | null>(null);
  const [snapImage, setSnapImage] = useState<string | null>(null);
  const snapVideoRef = useRef<HTMLVideoElement | null>(null);
  const [snapCameraError, setSnapCameraError] = useState('');
  const [isMobileIframe, setIsMobileIframe] = useState<boolean>(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'safari' | 'chrome'>('chrome');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isIframe = window.self !== window.top;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobileIframe(isIframe && isMobileDevice);
    }
  }, []);
  
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const frameCountRef = useRef<number>(0);
  const lockCodeRef = useRef<string | null>(null);

  const guestsRef = useRef<Guest[]>(guests);
  useEffect(() => {
    guestsRef.current = guests;
  }, [guests]);

  // Load initially checked-in guests if any exist
  useEffect(() => {
    const checkedInGuests = guestsRef.current
      .filter(g => g.checkedIn && g.checkedInTime)
      .slice(-5)
      .map(g => ({
        id: g.id,
        name: g.name,
        time: g.checkedInTime || '',
        cardType: g.cardType
      }))
      .reverse(); // Newest first
    setRecentScans(checkedInGuests);
  }, []);

  // Pre-fetch camera input devices early on component mount
  useEffect(() => {
    const preFetchDevices = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = allDevices.filter(d => d.kind === 'videoinput');
          setDevices(videoInputs);
        }
      } catch (err) {
        console.warn("Could not pre-fetch camera devices on mount:", err);
      }
    };
    preFetchDevices();
  }, []);

  const handleExportCheckedInCsv = () => {
    const checkedInGuests = guests.filter(g => g.checkedIn);
    if (checkedInGuests.length === 0) return;

    // Build simple CSV with headers
    const headers = isEn 
      ? ["ID", "Card Code", "Guest Name", "Phone Number", "Card Type", "Check-in Time", "RSVP Status", "Companions Count"]
      : isEn ? ["ID", "Code", "Guest Name", "Phone Number", "Card Type", "Check-in Time", "RSVP Status", "Companions"] : ["ID", "Namba ya Kadi (Code)", "Jina la Mgeni", "Namba ya Simu", "Aina ya Kadi (Card Type)", "Muda wa Kuingia (Check-in Time)", "RSVP Status", "Idadi ya Wageni (Companions)"];
    const csvRows = [
      headers.join(","),
      ...checkedInGuests.map(g => [
        g.id || '',
        g.code || '',
        `"${(g.name || '').replace(/"/g, '""')}"`,
        g.phone || '',
        g.cardType || '',
        g.checkedInTime || '',
        g.rsvpStatus || '',
        g.rsvpGuestsCount || 1
      ].join(","))
    ];

    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const cleanFileName = isEn ? `Checked_In_Guests_${(event.name || 'Event').replace(/[^a-zA-Z0-9_\u00c0-\u00ff]+/g, '_')}.csv` : `Wageni_Walioingia_${(event.name || 'Sherehe').replace(/[^a-zA-Z0-9_\u00c0-\u00ff]+/g, '_')}.csv`;
    link.setAttribute("download", cleanFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadBadge = async (guest: Guest) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Badge Size (Portrait)
      canvas.width = 400;
      canvas.height = 550;

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Artistic Header
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#1e3a8a'); // blue-900
      gradient.addColorStop(1, '#581c87'); // purple-900
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, 100);

      // Event Branding
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(event.name.toUpperCase(), canvas.width / 2, 50);
      
      ctx.font = '10px monospace';
      ctx.globalAlpha = 0.8;
      ctx.fillText(event.eventHallName || 'Event Venue', canvas.width / 2, 75);
      ctx.globalAlpha = 1.0;

      // Guest Name
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 24px sans-serif';
      ctx.fillText(guest.name, canvas.width / 2, 160);

      // Guest Role/Type
      ctx.fillStyle = '#6366f1';
      ctx.font = 'bold 14px monospace';
      const typeLabel = (guest.cardType || 'Regular').toUpperCase();
      ctx.fillText(typeLabel, canvas.width / 2, 190);

      // QR Code Generation
      const qrData = guest.code || guest.id;
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 220,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        }
      });

      const qrImg = new Image();
      qrImg.src = qrDataUrl;
      await new Promise(resolve => qrImg.onload = resolve);
      ctx.drawImage(qrImg, (canvas.width - 220) / 2, 220, 220, 220);

      // Footer - Badge ID
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`ID: ${guest.code || guest.id}`, canvas.width / 2, 480);

      // Branding Footer
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'italic 10px sans-serif';
      ctx.fillText('Powered by AI Studio EventCard', canvas.width / 2, 520);

      // Border deco
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      // Trigger Download
      const link = document.createElement('a');
      link.download = `Badge_${guest.name.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Badge generation failed:", err);
    }
  };

  // Simulated Scan triggers
  const playFeedbackSound = (type: 'success' | 'error' | 'duplicate') => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      if (type === 'success') {
        // Notification chime (arpeggio)
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const now = ctx.currentTime + i * 0.1;
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(now);
          osc.stop(now + 0.3);
        });
      } else if (type === 'duplicate' || type === 'error') {
        // Error / duplicate buzz
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        // start low and go lower for an error sound
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {
      console.warn("Audio Context sound failed to play:", e);
    }
  };

  const matchGuestFromScannedText = (scannedText: string) => {
    if (!scannedText) return null;
    let text = scannedText.trim();

    // 1. Try to parse as URL to extract the real guest code/id if scanned from a browser link
    try {
      if (text.toLowerCase().includes('?invite=') || text.toLowerCase().includes('&invite=')) {
        const urlP = new URL(text);
        const inviteParam = urlP.searchParams.get('invite');
        if (inviteParam) {
          text = inviteParam.trim();
        }
      } else if (text.startsWith('http://') || text.startsWith('https://')) {
        const urlP = new URL(text);
        const pathname = urlP.pathname;
        const lastSegment = pathname.substring(pathname.lastIndexOf('/') + 1);
        if (lastSegment) {
          text = lastSegment.trim();
        }
      }
    } catch (e) {
      console.warn("Scan string is not a valid URL URL parsing skipped, using raw:", e);
    }

    // 2. Normalize and check prefixes
    let cleaned = text.toUpperCase();
    if (cleaned.startsWith('EVENTCARD-')) {
      // Replace only the prefix
      cleaned = cleaned.substring('EVENTCARD-'.length);
    }

    // First pass: strict exact match (highest speed & safety level)
    const exactMatch = guestsRef.current.find(g => {
      const gId = g.id ? g.id.toUpperCase() : '';
      const gCode = g.code ? g.code.toUpperCase() : '';
      return gId === cleaned || gCode === cleaned;
    });

    if (exactMatch) return exactMatch;

    // Second pass: robust fallback substring matching (only for strings of length >= 4 to avoid false matches on short IDs)
    return guestsRef.current.find(g => {
      const gId = g.id ? g.id.toUpperCase() : '';
      const gCode = g.code ? g.code.toUpperCase() : '';
      
      return (
        gId === cleaned ||
        gCode === cleaned ||
        (gId && gId.length >= 4 && cleaned.includes(gId)) ||
        (gCode && gCode.length >= 4 && cleaned.includes(gCode)) ||
        (gId && cleaned.length >= 4 && gId.includes(cleaned)) ||
        (gCode && cleaned.length >= 4 && gCode.includes(cleaned))
      );
    });
  };

  const triggerScanResult = (target: Guest | null, isError: boolean = false, errorMsg: string = '') => {
    // If it is a direct check-in (e.g. from table list), bypass throttling. Otherwise enforce scanner throttle.
    if (isProcessingRef.current && !isError && target) {
      // Allow proceeding if triggered directly via guest list action
    } else if (isProcessingRef.current) {
      return;
    }
    isProcessingRef.current = true;

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    if (isError || !target) {
      playFeedbackSound('error');
      setScanResult({ status: 'error' });
      if (errorMsg) {
        setManualError(errorMsg);
      }
      playFeedbackSound('error');
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 1000);
      return;
    }

    const checkInTime = new Date().toLocaleTimeString();

    if (target.checkedIn) {
      playFeedbackSound('duplicate');
      setScanResult({
        status: 'duplicate',
        guestId: target.id,
        guestName: target.name,
        cardType: target.cardType,
        companions: target.rsvpGuestsCount,
        time: target.checkedInTime || checkInTime
      });
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 1000);
    } else {
      // Mark as checked in
      const updated = guestsRef.current.map(g => {
        if (g.id === target.id) {
          return {
            ...g,
            checkedIn: true,
            checkedInTime: checkInTime
          };
        }
        return g;
      });

      const isCurrentlyOffline = !isOnline || forceOffline;

      if (isCurrentlyOffline) {
        // Queue it for later sync
        setPendingSyncQueue(prev => {
          const exists = prev.some(item => item.guestId === target.id);
          if (exists) return prev;
          return [...prev, { guestId: target.id, checkedInTime: checkInTime }];
        });

        // Update local React state, skip saving on server
        onUpdateGuests(updated, `Amethibitisha ushiriki mlangoni nje ya mtandao (Offline Checked-in Guest): ${target.name}`, true);
      } else {
        // Save to Firestore server immediately
        onUpdateGuests(updated, `Amethibitisha ushiriki mlangoni (Checked-in Guest): ${target.name}`, false);
      }

      // Add to recent scans list (keep unique, limit to 5, newest first)
      setRecentScans(prev => {
        const filtered = prev.filter(item => item.id !== target.id);
        return [
          { id: target.id, name: target.name, time: checkInTime, cardType: target.cardType },
          ...filtered
        ].slice(0, 5);
      });

      playFeedbackSound('success');
      setScanResult({
        status: 'success',
        guestId: target.id,
        guestName: target.name,
        cardType: target.cardType,
        companions: target.rsvpGuestsCount,
        time: checkInTime,
        isOfflineSaved: isCurrentlyOffline
      });

      setTimeout(() => {
        isProcessingRef.current = false;
      }, 1000);
    }
  };

  const handleResetCheckins = () => {
    const updated = guestsRef.current.map(g => ({
      ...g,
      checkedIn: false,
      checkedInTime: undefined,
      guestPhotoUrl: undefined // optionally clear photos, maybe not needed, but good measure
    }));
    onUpdateGuests(updated, isEn ? 'Reset all check-in counts to 0' : 'Rudisha namba ya walioingia kuwa 0');
    setShowResetConfirm(false);
  };

  const handleImageUploadAndScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Draw to temporary canvas for decoding
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Limit resolution for speed and compatibility, say max 800px
          const maxDim = 800;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            const ratio = w / h;
            if (w > h) {
              w = maxDim;
              h = Math.round(maxDim / ratio);
            } else {
              h = maxDim;
              w = Math.round(maxDim * ratio);
            }
          }

          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);

          const imageData = ctx.getImageData(0, 0, w, h);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          });

          if (qrCode && qrCode.data) {
            const scannedText = qrCode.data.trim();
            console.log("Scanned QR Text from Image Success:", scannedText);
            const matchedGuest = matchGuestFromScannedText(scannedText);
            if (matchedGuest) {
              triggerScanResult(matchedGuest);
            } else {
              triggerScanResult(null, true, isEn ? `Uploaded QR card (${scannedText}) is not in our guest list.` : `QR kadi uliyopakia (${scannedText}) haimo kwenye mwaliko wetu.`);
            }
          } else {
            // No QR detected in the uploaded image
            playFeedbackSound('error');
            setScanResult({ status: 'error' });
            setManualError(isEn ? 'No QR code found in this image. Ensure the image is clear and well-lit!' : 'Msimbo wa QR haukupatikana kwenye picha hii. Hakikisha picha iko wazi na yenye mwanga wa kutosha!');
            setTimeout(() => {
              setScanResult(null);
              setManualError('');
            }, 3000);
          }
        } catch (err) {
          console.error("Failed to decode uploaded image QR:", err);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    
    // Clear input so same file selection triggers scanner
    e.target.value = '';
  };

  const handleTriggerSimulatedScan = (guestId: string) => {
    if (!guestId) return;
    const target = guestsRef.current.find(g => g.id === guestId);
    triggerScanResult(target || null, !target, !target ? (isEn ? 'This guest was not found in the list!' : 'Mgeni huyu hajapatikana kwenye orodha!') : '');
  };

  const handleManualCodeCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');
    if (!manualCode.trim()) return;

    // Look up guest by Ky code (e.g. KY-4509) or ID
    const target = matchGuestFromScannedText(manualCode);
    if (!target) {
      triggerScanResult(null, true, isEn ? 'Code not found or unrecognized in guest list!' : 'Kodi haipo au haitambuliki kwenye mfumo wa kadi mwalikwa!');
      setManualCode('');
      return;
    }

    triggerScanResult(target);
    setManualCode('');
  };

  // Start / Stop camera stream depending on activeTab and manual retries
  useEffect(() => {
    let active = true;
    let animationFrameId: number;

    const stopActiveStream = () => {
      if (activeStreamRef.current) {
        console.log("Stopping active camera stream...");
        try {
          activeStreamRef.current.getTracks().forEach(track => {
            track.stop();
          });
        } catch (e) {
          console.warn("Failed to stop custom track:", e);
        }
        activeStreamRef.current = null;
      }
    };

    const startCamera = async () => {
      try {
        setCameraError('');
        setCameraActive(false);
        cameraActiveRef.current = false;

        // Stop any currently running stream to release the camera hardware
        stopActiveStream();

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Kivinjari chako hakiauni huduma ya kamera, au muunganisho si salama (HTTPS)!');
        }

        // Define highly robust and lightweight constraint cascades to prevent OverconstrainedError or hardware locks on mobile devices
        const constraintSets: MediaStreamConstraints[] = [];
 
        if (selectedDeviceId) {
          // If a specific camera is user-selected, explicitly attempt it first
          constraintSets.push({
            video: { deviceId: { exact: selectedDeviceId } }
          });
          constraintSets.push({
            video: { deviceId: { ideal: selectedDeviceId } }
          });
        }
 
        // 1. Force back-facing environment mode (highly compatible with standard modern phones)
        constraintSets.push({
          video: { facingMode: 'environment' }
        });

        // 2. Try environment as exact constraints object (often needed on strict iOS/Safari setups)
        constraintSets.push({
          video: { facingMode: { exact: 'environment' } }
        });

        // 3. Try environment ideal facing mode
        constraintSets.push({
          video: { facingMode: { ideal: 'environment' } }
        });

        // 4. Try environment with lightweight resolutions to skip chip/hardware bottlenecks
        constraintSets.push({
          video: {
            facingMode: 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });

        // 5. Try environment at ultra-low resolution (budget mobile fail-safe)
        constraintSets.push({
          video: {
            facingMode: 'environment',
            width: { ideal: 320 },
            height: { ideal: 240 }
          }
        });
 
        // 6. Last-resort fallback for any available camera (e.g. desktop/laptop)
        constraintSets.push({
          video: true
        });
 
        let stream: MediaStream | null = null;
        let lastError: any = null;
 
        // Attempt user media cascades sequentially with a small hardware recovery breather
        for (let i = 0; i < constraintSets.length; i++) {
          const constraints = constraintSets[i];
          try {
            if (!active) return;
            console.log(`Cascade attempt ${i + 1}/${constraintSets.length} with constraints:`, constraints);
            
            const resStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            if (!active) {
              if (resStream) {
                resStream.getTracks().forEach(track => track.stop());
              }
              return;
            }
            
            stream = resStream;
            if (stream) {
              console.log('Camera stream initialized successfully on cascade:', i + 1);
              break;
            }
          } catch (err: any) {
            console.warn(`Cascade ${i + 1} failed:`, err);
            lastError = err;
            
            // Give the browser hardware 100ms breather to fully close locks before trying next cascade
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        if (!active) {
          if (stream) {
            stream.getTracks().forEach(t => t.stop());
          }
          return;
        }

        if (!stream) {
          // If all cascades failed, throw the detailed last exception rather than a generic string
          if (lastError) {
            throw lastError;
          }
          throw new Error('NotAllowedError');
        }

        // Store the successfully acquired stream in the ref so the cleanup function can stop it anytime
        activeStreamRef.current = stream;

        if (videoRef.current && stream) {
          // CRITICAL REACT SAFARI WORKAROUND: Explicitly set the DOM properties
          // before assigning srcObject. This overrides React JSX translation bugs 
          // that can stall or reject raw webcam stream autoplay on iOS browsers.
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          videoRef.current.srcObject = stream;
          
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn('Autoplay / silent play promise interrupted or rejected (benign in iframes):', playErr);
          }
          
          if (active) {
            setCameraActive(true);
            cameraActiveRef.current = true;
          }

          // Once permission is granted and stream starts, enumerate all cameras for selection dropdown
          try {
            if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
              const allDevices = await navigator.mediaDevices.enumerateDevices();
              const videoInputs = allDevices.filter(d => d.kind === 'videoinput');
              
              if (active) {
                setDevices(prev => {
                  const prevKeys = prev.map(d => d.deviceId).join(',');
                  const nextKeys = videoInputs.map(d => d.deviceId).join(',');
                  if (prevKeys !== nextKeys) {
                    return videoInputs;
                  }
                  return prev;
                });
              }
            }
          } catch (enumErr) {
            console.warn('Could not enumerate video inputs:', enumErr);
          }
        }
      } catch (err: any) {
        console.warn('Media capture error details:', err);
        if (active) {
          setCameraActive(false);
          cameraActiveRef.current = false;
          
          let swahiliMessage = '';
          const name = err ? err.name : '';
          
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            swahiliMessage = isEn ? 'Permission Denied! Allow camera access by clicking the lock icon in the address bar and selecting "Allow" for Camera.' : 'Ruhusa Imekataliwa (Permission Denied)! Ruhusu matumizi ya kamera kwa kugusa alama ya kufuli (lock icons) kwenye bar ya anwani na uchague "Ruhusu/Allow" upande wa Kamera.';
          } else if (name === 'NotReadableError' || name === 'TrackStartError') {
            swahiliMessage = isEn ? 'Camera in use (NotReadableError)! It may be in use by another app like WhatsApp/Zoom. Please close those apps and try again.' : 'Kamera Inatumiwa sasa (NotReadableError)! Labda inapiga picha au kutumika na app nyingine kama WhatsApp/Zoom. Tafadhali zima app hizo kisha urudie tena.';
          } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            swahiliMessage = isEn ? 'Camera Device Not Found (NotFoundError)! No working camera detected on this device right now.' : 'Kifaa cha Kamera Hakipatikani (NotFoundError)! Hakuna kamera inayofanya kazi iliyotambuliwa kwenye kifaa hiki kwa sasa.';
          } else if (name === 'SecurityError') {
            swahiliMessage = isEn ? 'Security Error (SecurityError)! Your browser requires a secure HTTPS connection to use the camera, or it is inside a restricted environment.' : 'Hitilafu ya Usalama (SecurityError)! Kivinjari chako kinahitaji kiungo cha salama cha HTTPS ili kuwasha kamera, au kiko ndani ya mfumo uliozuiwa.';
          } else if (name === 'OverconstrainedError') {
            swahiliMessage = isEn ? 'Camera could not satisfy constraint settings (OverconstrainedError). Please switch camera option.' : 'Kamera haikuweza kukubali vigezo vya uboreshaji (OverconstrainedError). Tafadhali badilisha chaguo la kamera.';
          } else {
            swahiliMessage = err.message || (isEn ? 'Camera failed to start or permission denied. Check camera permissions on your device.' : 'Kamera imeshindwa kufunguka au ruhusa imekataliwa. Hakikisha umetoa ruhusa ya kamera kwenye kifaa.');
          }
          
          setCameraError(swahiliMessage);
        }
      }
    };

    if (activeTab === 'scanner' && !photoGuest) {
      startCamera();
    } else {
      setCameraActive(false);
      cameraActiveRef.current = false;
      stopActiveStream();
    }

    // QR detection loop using jsQR
    const scanQRCodeLoop = () => {
      if (!active) return;

      // Increment frame count
      frameCountRef.current++;

      // Frame skip: Only scan every 4th frame to reduce CPU load while maintaining fast response
      if (frameCountRef.current % 4 !== 0) {
        animationFrameId = requestAnimationFrame(scanQRCodeLoop);
         return;
      }

      try {
        const video = videoRef.current;
        if (video && video.readyState >= 2 && cameraActiveRef.current && !isProcessingRef.current) {
          // Initialize memory-only canvas if not already defined
          if (!offscreenCanvasRef.current) {
            offscreenCanvasRef.current = document.createElement('canvas');
          }
          const canvas = offscreenCanvasRef.current;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          
          if (ctx) {
            // Keep analysis canvas resolution small (e.g. max dimension 480px)
            // This prevents mobile devices from choking/hanging and ensures lightning-fast decoding
            const maxDimension = 480;
            let w = video.videoWidth;
            let h = video.videoHeight;
            
            if (w > maxDimension || h > maxDimension) {
              const ratio = w / h;
              if (w > h) {
                w = maxDimension;
                h = Math.round(maxDimension / ratio);
              } else {
                h = maxDimension;
                w = Math.round(maxDimension * ratio);
              }
            }
            
            if (w > 0 && h > 0) {
              canvas.width = w;
              canvas.height = h;
              
              // Draw the entire video frame scaled down (no lag, full coverage)
              ctx.drawImage(video, 0, 0, w, h);
              
              const imageData = ctx.getImageData(0, 0, w, h);
              const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'attemptBoth'
              });
   
              if (qrCode && qrCode.data) {
                const scannedText = qrCode.data.trim();
                
                // Scan-lock: Prevent triggering multiple scans for the same code while processing delay is active
                if (lockCodeRef.current === scannedText) {
                  animationFrameId = requestAnimationFrame(scanQRCodeLoop);
                  return;
                }
                
                // Set scan-lock code
                lockCodeRef.current = scannedText;
                console.log("Scanned QR Text Successfully:", scannedText);
                
                // Try to find the matching guest
                const matchedGuest = matchGuestFromScannedText(scannedText);
                if (matchedGuest) {
                  triggerScanResult(matchedGuest);
                } else {
                  // Only trigger error if the scanned QR code is unique/different to prevent immediate loops
                  triggerScanResult(null, true, isEn ? `Scanned QR code (${scannedText}) is not registered in our guest list.` : `Msimbo wa QR ulioskaniwa (${scannedText}) haujasajiliwa kwani si wa mwaliko wetu.`);
                }
              }
            }
          }
        }
      } catch (loopErr) {
        console.warn('Error inside scanning loop:', loopErr);
      }

      animationFrameId = requestAnimationFrame(scanQRCodeLoop);
    };

    // Delay a bit to let video element mount
    const timer = setTimeout(() => {
      if (activeTab === 'scanner') {
        scanQRCodeLoop();
      }
    }, 800);

    return () => {
      active = false;
      clearTimeout(timer);
      cancelAnimationFrame(animationFrameId);
      stopActiveStream();
      cameraActiveRef.current = false;
    };
  }, [activeTab, retryCount, photoGuest, selectedDeviceId]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  // Camera handler for snapping a Guest profile photo
  useEffect(() => {
    let active = true;
    let streamObj: MediaStream | null = null;

    const startSnapCamera = async () => {
      try {
        setSnapCameraError('');
        setSnapImage(null);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error(isEn ? 'Photo capture service is not allowed or supported here.' : 'Huduma ya piga picha haijaruhusiwa au haiauniwi hapa.');
        }

        const snapConstraintSets = [
          { video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } } },
          { video: { facingMode: 'user' } },
          { video: true }
        ];

        for (const constraints of snapConstraintSets) {
          try {
            streamObj = await navigator.mediaDevices.getUserMedia(constraints);
            if (streamObj) break;
          } catch (e) {
            console.warn('Snap constraint set failed, trying fallback...', constraints, e);
          }
        }

        if (!streamObj) {
          throw new Error(isEn ? 'Could not get camera permission or front camera support was denied.' : 'Haikupata kibali cha kamera au msaada wa kamera ya mbele ulikataliwa.');
        }

        if (!active) {
          if (streamObj) streamObj.getTracks().forEach(t => t.stop());
          return;
        }

        setSnapStream(streamObj);
        if (snapVideoRef.current) {
          // Safari iOS autoplay fix: force muted and playsInline properties on the DOM node directly
          snapVideoRef.current.muted = true;
          snapVideoRef.current.playsInline = true;
          snapVideoRef.current.srcObject = streamObj;
          try {
            await snapVideoRef.current.play();
          } catch (playErr) {
            console.warn('Snap video play promise was interrupted or rejected:', playErr);
          }
        }
      } catch (err: any) {
        console.warn('Snap camera error:', err);
        setSnapCameraError(err.message || (isEn ? 'Failed to get camera permission or camera is in use. Please allow camera and try again.' : 'Haikupata kibali cha kamera au kamera inatumika kwa ajili ya skana. Tafadhali ruhusu kamera na jaribu tena.'));
      }
    };

    if (photoGuest) {
      startSnapCamera();
    } else {
      if (snapStream) {
        snapStream.getTracks().forEach(t => t.stop());
      }
      setSnapStream(null);
      setSnapImage(null);
    }

    return () => {
      active = false;
      if (streamObj) {
        streamObj.getTracks().forEach(t => t.stop());
      }
    };
  }, [photoGuest]);

  const handleCapturePhoto = () => {
    if (snapVideoRef.current) {
      const video = snapVideoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/webp', 0.98);
        setSnapImage(dataUrl);
      }
    }
  };

  const handleSaveSnappedPhoto = () => {
    if (!photoGuest || !snapImage) return;

    const updated = guests.map(g => {
      if (g.id === photoGuest.id) {
        return {
          ...g,
          photoUrl: snapImage
        };
      }
      return g;
    });
    
    onUpdateGuests(updated, `Amesajili picha ya mgeni mlangoni (Saved Guest Photo): ${photoGuest.name}`);

    if (snapStream) {
      snapStream.getTracks().forEach(t => t.stop());
    }
    setSnapStream(null);
    setPhotoGuest(null);
    setSnapImage(null);
  };

  const handleRemovePhoto = (guestId: string) => {
    const target = guests.find(g => g.id === guestId);
    const updated = guests.map(g => {
      if (g.id === guestId) {
        const copy = { ...g };
        delete copy.photoUrl;
        return copy;
      }
      return g;
    });
    onUpdateGuests(updated, `Amefuta picha ya mgeni (Removed Guest Photo): ${target ? target.name : 'Unknown'}`);
  };

  // Stats
  const countCheckedIn = guests.filter(g => g.checkedIn).length;
  const countCheckedInSeats = guests.filter(g => g.checkedIn).reduce((sum, g) => sum + (g.rsvpGuestsCount || 1), 0);
  
  const countConfirmedGuests = guests.filter(g => g.rsvpStatus === 'Atahudhuria').length;
  const countConfirmedSeats = guests.filter(g => g.rsvpStatus === 'Atahudhuria').reduce((sum, g) => sum + (g.rsvpGuestsCount || 1), 0);

  const countPendingGuests = guests.filter(g => g.rsvpStatus === 'Atahudhuria' && !g.checkedIn).length;
  const countPendingSeats = guests.filter(g => g.rsvpStatus === 'Atahudhuria' && !g.checkedIn).reduce((sum, g) => sum + (g.rsvpGuestsCount || 1), 0);

  // Confirmed are those who RSVP'd yes (Atahudhuria) or all guests in draft list
  const countRsvped = countConfirmedGuests || guests.length;

  const filteredGuestsList = useMemo(() => {
    return guests.filter(g => {
      const matchesSearch = g.name.toLowerCase().includes(listSearch.toLowerCase()) || 
                           (g.code || '').toLowerCase().includes(listSearch.toLowerCase());
      
      const matchesFilter = listFilter === 'all' ? true :
                           listFilter === 'checked-in' ? g.checkedIn :
                           listFilter === 'confirmed' ? g.rsvpStatus === 'Atahudhuria' :
                           listFilter === 'pending' ? (g.rsvpStatus === 'Atahudhuria' && !g.checkedIn) :
                           !g.checkedIn;
                           
      return matchesSearch && matchesFilter;
    }).sort((a,b) => {
      if (listFilter === 'checked-in') {
        const timeA = a.checkedInTime || '';
        const timeB = b.checkedInTime || '';
        return timeB.localeCompare(timeA); // reverse chrono for checked in
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [guests, listSearch, listFilter]);

  const isPermissionDenied = Boolean(
    cameraError && (
      cameraError.toLowerCase().includes('ruhusa') ||
      cameraError.toLowerCase().includes('allow') ||
      cameraError.toLowerCase().includes('permission') ||
      cameraError.toLowerCase().includes('kibali') ||
      cameraError.toLowerCase().includes('notallowed') ||
      cameraError.toLowerCase().includes('denied')
    )
  );

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[1.75rem] p-6 sm:p-8 space-y-6 font-sans text-xs text-white" id="qr-scanner-container">
      
      {/* Header and top tools */}
      <div className="border-b border-white/10 pb-5">
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <QrCode className="w-5 h-5 text-blue-400 animate-[pulse_2s_infinite]" />
          <span>{isEn ? 'Gate Guest Check-in (QR Scanner & Verification)' : 'Kagua Wageni Mlangoni (QR Scanner & Check-in)'}</span>
        </h2>
        <p className="text-slate-350 mt-0.5">
          {isEn 
            ? 'Guest hospitality and validation terminal. Scan card QR codes to verify admissions on event day or lookup by name.' 
            : 'Kurasa ya kukaribisha wageni. Skani kadi namba ya QR kuzuia uingiaji haramu siku ya tukio au kagua kwa majina.'}
        </p>

        {/* Scanner Access Sharing Console (Only visible to admin) */}
        {!isReadOnlyScanner && !isStandaloneOnly && (
          <div className="mt-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-blue-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>{isEn ? 'Share Scanner-Only Access Link' : 'Shiriki Kipengele cha Kuskani Pekee (Scanner-Only Access)'}</span>
                </h4>
                <p className="text-[10px] text-slate-300 mt-1 leading-normal">
                  {isEn 
                    ? 'Want to grant a gatekeeper or usher exclusive access to scan cards without disclosing sensitive event dashboards? Share the direct link or copy details below:' 
                    : 'Je, unataka kumpa mtu mwingine au mlinzi mlangoni uwezo wa kuskani kadi TU bila kuona taarifa nyingine za mfumo? Mpe kiungo maalum hapa chini au nenosiri lake la kuingia:'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const link = `${window.location.origin}/?scan_mode=true&event_id=${encodeURIComponent(event.id)}&username=scanner&password=${encodeURIComponent(event.id)}`;
                    navigator.clipboard.writeText(link);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition flex items-center gap-1.5 select-none cursor-pointer text-[10px]"
                >
                  <Globe className="w-3.5 h-3.5 text-blue-200" />
                  <span>{copiedLink ? (isEn ? 'Copied! ✓' : 'Kimekopwa! ✓') : (isEn ? 'Copy Direct Link 🔗' : 'Kopi Kiungo 🔗')}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-blue-500/15 grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] font-mono text-slate-300">
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5 space-y-1">
                <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">{isEn ? 'Method 1: Direct Link (Recommended)' : 'Njia ya 1: Direct Link (Urahisi Zaidi)'}</p>
                <p className="text-slate-300 truncate select-all">{`${window.location.origin}/?scan_mode=true&event_id=${event.id}&username=scanner&password=${event.id}`}</p>
                <p className="text-[9px] text-slate-400 italic font-sans">{isEn ? 'Loads the login page with username and password already pre-filled!' : 'Inafungua ukurasa wa kuingia (Login) ukiwa na jina la mtumiaji na nenosiri vikiwa tayari vimejazwa!'}</p>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5 space-y-1">
                <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">{isEn ? 'Method 2: Manual Portal Login' : 'Njia ya 2: Kuingia kwa Mikono (Manual Login)'}</p>
                <p className="text-slate-300 leading-normal">
                  • {isEn ? 'Username' : 'Jina la Mtumiaji'}: <span className="text-white font-bold bg-white/10 px-1.5 py-0.2 rounded border border-white/5">scanner</span><br />
                  • {isEn ? 'Password (Event ID)' : 'Nenosiri (Event ID)'}: <span className="text-white font-bold bg-white/10 px-1.5 py-0.2 rounded border border-white/5 select-all">{event.id}</span>
                </p>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-[9px] text-slate-400 italic font-sans">{isEn ? 'Use these credentials on the welcome page.' : 'Anaweza kuandika hivi kwenye ukurasa wa Ingia (Login).'}</p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(event.id);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="text-blue-400 hover:text-blue-300 text-[9px] font-bold cursor-pointer"
                  >
                    {copiedCode ? (isEn ? 'Copied!' : 'Ilikopwas!') : (isEn ? 'Copy ID' : 'Kopi ID')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Offline Verification & Connection Sync Bar */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="flex h-3 w-3 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                forceOffline ? 'bg-amber-400' : isOnline ? 'bg-emerald-400' : 'bg-red-500'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${
                forceOffline ? 'bg-amber-500' : isOnline ? 'bg-emerald-500' : 'bg-red-500'
              }`}></span>
            </span>
          </div>
          <div className="text-left">
            <p className="font-extrabold text-white text-[11px] sm:text-xs flex items-center gap-1.5 leading-none">
              <span>
                {forceOffline 
                  ? (isEn ? 'OFFLINE MODE (FORCED)' : 'NJIA YA NJE YA MTANDAO (KULAZIMISHA)') 
                  : isOnline 
                    ? (isEn ? 'ONLINE STATUS' : 'HALI YA MTANDAO: IPO VIZURI') 
                    : (isEn ? 'DISCONNECTED (OFFLINE)' : 'HAUNA MTANDAO (OFFLINE)')}
              </span>
              {pendingSyncQueue.length > 0 && (
                <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-black px-1.5 py-0.5 rounded-md animate-pulse">
                  {isEn ? `${pendingSyncQueue.length} Pending Sync` : `Wageni ${pendingSyncQueue.length} Kusawazishwa`}
                </span>
              )}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {forceOffline 
                ? (isEn ? 'Forcing offline operations. Check-ins are stored locally.' : 'Umelazimisha kufanya kazi nje ya mtandao. Uhakiki unahifadhiwa kwenye kifaa hiki.')
                : isOnline 
                  ? (isEn ? 'Direct sync with Firestore is active. Real-time logging.' : 'Uhakiki unaunganishwa moja kwa moja na database kuu ya server.')
                  : (isEn ? 'Gate operations are safe! Updates will sync once connected.' : 'Usijali! Unaweza kuendelea kuskani wageni, zitasawazishwa mtandao ukirudi.')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Manual Force Offline toggle */}
          <button
            type="button"
            onClick={() => setForceOffline(!forceOffline)}
            className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase transition flex items-center gap-1.5 cursor-pointer ${
              forceOffline 
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30' 
                : 'bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/5 hover:border-white/20'
            }`}
            title={isEn ? 'Toggle manual offline mode' : 'Washa/zima njia ya nje ya mtandao'}
          >
            <Globe className={`w-3.5 h-3.5 ${forceOffline ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>{forceOffline ? (isEn ? 'Go Online' : 'Rudi Mtandaoni') : (isEn ? 'Force Offline' : 'Lazimisha Offline')}</span>
          </button>

          {/* Sync Button */}
          {pendingSyncQueue.length > 0 && (
            <button
              type="button"
              disabled={syncingNow || (!isOnline && !forceOffline)}
              onClick={handleSyncOfflineChanges}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-lg font-black transition flex items-center gap-1.5 cursor-pointer text-[10px] disabled:opacity-50 disabled:cursor-not-allowed select-none uppercase tracking-wider"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingNow ? 'animate-spin' : ''}`} />
              <span>{syncingNow ? (isEn ? 'Syncing...' : 'Inasawazisha...') : (isEn ? 'Sync Now' : 'Sawazisha Sasa')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Export Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex bg-[#050b18]/60 p-1 rounded-xl border border-white/10 w-full sm:max-w-md text-xs font-semibold">
          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex-1 py-1.5 rounded-lg text-center transition cursor-pointer font-bold ${
              activeTab === 'scanner' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {isEn ? 'Scan (QR)' : 'Skani (QR)'}
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-1.5 rounded-lg text-center transition cursor-pointer font-bold ${
              activeTab === 'list' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {isEn ? 'Guests & Check-in' : 'Wageni & Hakiki'} ({countConfirmedGuests})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-1.5 rounded-lg text-center transition cursor-pointer font-bold ${
              activeTab === 'logs' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Log & Uchambuzi
          </button>
        </div>

        {/* Export Button */}
        <button
          type="button"
          onClick={handleExportCheckedInCsv}
          disabled={countCheckedIn === 0}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 disabled:bg-white/5 border border-emerald-500/20 hover:border-emerald-500/40 disabled:border-white/5 text-emerald-300 disabled:text-slate-500 font-bold rounded-xl transition cursor-pointer disabled:cursor-not-allowed text-[11px]"
          title={countCheckedIn === 0 ? (isEn ? "The checked-in list is currently empty" : "Orodha ya walioingia iko wazi kwa sasa") : (isEn ? "Download entire checked-in list as CSV" : "Pakua orodha nzima ya walioingia katika CSV")}
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isEn ? 'Download Checked-in' : 'Pakua Walioingia'} ({countCheckedIn}) - CSV</span>
        </button>
      </div>

      {activeTab === 'scanner' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Area: Viewfinder design with moving laser (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col items-center space-y-4 w-full">
            
            <div className="relative w-full max-w-sm aspect-[4/5] min-h-[450px] border-4 border-white/15 rounded-3xl overflow-hidden bg-slate-950/80 shadow-2xl flex items-center justify-center p-3">
              
              {/* Hidden analysis canvas */}
              <canvas ref={scanCanvasRef} className="hidden" />

              {/* Live Web Camera Video Element Feed */}
              <video 
                ref={videoRef} 
                className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                playsInline
                muted
                autoPlay
              />

              {/* Corner brackets */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl z-10"></div>
              <div className="absolute top-4 right-4 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr z-10"></div>
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl z-10"></div>
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br z-10"></div>

              {/* Animated Laser line sliding up & down */}
              <div className="absolute w-[80%] h-0.5 bg-blue-400 shadow-[0_0_8px_#3b82f6] animate-[bounce_3s_infinite] z-10"></div>

              {/* UI Overlays: Show mock helper when camera is NOT active or preparing */}
              {!cameraActive && (
                <div className="text-center space-y-2 text-slate-400 group z-10 p-4 max-h-full overflow-y-auto w-full h-full flex flex-col justify-center">
                  {!cameraError && <QrCode className="w-12 h-12 mx-auto text-blue-400 opacity-60 animate-pulse" />}
                  {!cameraError && <p className="text-[10px] font-mono tracking-wider text-slate-300 uppercase">{isEn ? 'Waiting for Camera...' : 'Kamera Inasubiriwa...'}</p>}
                  {cameraError ? (
                    isPermissionDenied ? (
                      <div className="w-full flex flex-col h-full justify-between space-y-2 py-1 text-left">
                        {/* Access Denied Header */}
                        <div className="flex items-center gap-2 border-b border-rose-500/20 pb-2 text-rose-300 shrink-0">
                          <XCircle className="w-5 h-5 text-rose-500 animate-pulse shrink-0" />
                          <div className="leading-tight">
                            <h5 className="font-extrabold text-[10px] uppercase tracking-wider font-mono">
                              {isEn ? 'Camera Access Denied' : 'Ruhusa Imekataliwa'}
                            </h5>
                            <p className="text-[8px] text-slate-400 font-sans">
                              {isEn ? 'Permissions are blocked by browser' : 'Kibali kimezuiwa na kivinjari chako'}
                            </p>
                          </div>
                        </div>

                        {/* Interactive Tabs */}
                        <div className="grid grid-cols-2 gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-white/5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveGuideTab('chrome');
                            }}
                            className={`py-1 text-[8px] font-bold rounded-md font-mono transition-all uppercase cursor-pointer ${
                              activeGuideTab === 'chrome'
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm font-black'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Chrome / Android
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveGuideTab('safari');
                            }}
                            className={`py-1 text-[8px] font-bold rounded-md font-mono transition-all uppercase cursor-pointer ${
                              activeGuideTab === 'safari'
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm font-black'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Safari (iPhone)
                          </button>
                        </div>

                        {/* Step Guides Content */}
                        <div className="flex-1 overflow-y-auto bg-slate-950/60 border border-white/5 p-2 rounded-xl text-[8.5px] space-y-2 leading-relaxed text-slate-250 min-h-[90px]">
                          {activeGuideTab === 'chrome' ? (
                            <div className="space-y-1.5 font-sans">
                              <p className="text-blue-300 font-bold uppercase tracking-wider text-[7.5px] font-mono mb-1">
                                {isEn ? '👉 For Google Chrome & Android:' : '👉 Kwa Google Chrome na Android:'}
                              </p>
                              <div className="flex gap-1.5">
                                <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500/15 text-blue-300 text-[8px] font-extrabold shrink-0 mt-0.5">1</span>
                                <p className="text-slate-300">
                                  {isEn 
                                    ? <span>Tap the <strong>Lock (🔒)</strong> icon next to Address Bar.</span>
                                    : <span>Gusa alama ya <strong>Kufuli (🔒)</strong> kwenye bar ya anwani.</span>
                                  }
                                </p>
                              </div>
                              <div className="flex gap-1.5">
                                <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500/15 text-blue-300 text-[8px] font-extrabold shrink-0 mt-0.5">2</span>
                                <p className="text-slate-300">
                                  {isEn 
                                    ? <span>Select <strong>Site Settings</strong> & set <strong>Camera</strong> to <strong>Allow</strong>.</span>
                                    : <span>Chagua <strong>Website Settings</strong> na weka Kamera kuwa <strong>Ruhusu / Allow</strong>.</span>
                                  }
                                </p>
                              </div>
                              <div className="flex gap-1.5">
                                <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500/15 text-blue-300 text-[8px] font-extrabold shrink-0 mt-0.5">3</span>
                                <p className="text-slate-300">
                                  {isEn 
                                    ? <span>Reload / refresh page to scan.</span>
                                    : <span>Reload / fanya kupakia upya ukurasa.</span>
                                  }
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5 font-sans">
                              <p className="text-blue-300 font-bold uppercase tracking-wider text-[7.5px] font-mono mb-1">
                                {isEn ? '👉 For Safari & Apple iOS:' : '👉 Kwa Safari na Apple iOS:'}
                              </p>
                              <div className="flex gap-1.5">
                                <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500/15 text-blue-300 text-[8px] font-extrabold shrink-0 mt-0.5">1</span>
                                <p className="text-slate-300">
                                  {isEn 
                                    ? <span>Tap <strong>"aA"</strong> or the <strong>options lock icon</strong> on Safari Bar.</span>
                                    : <span>Gusa herufi <strong>"aA"</strong> au alama ya kufuli kwenye bar ya anwani Safari.</span>
                                  }
                                </p>
                              </div>
                              <div className="flex gap-1.5">
                                <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500/15 text-blue-300 text-[8px] font-extrabold shrink-0 mt-0.5">2</span>
                                <p className="text-slate-300">
                                  {isEn 
                                    ? <span>Select <strong>Website Settings</strong> & allow <strong>Camera</strong>.</span>
                                    : <span>Fungua <strong>Website Settings</strong> na uweke Kamera kuwa <strong>Allow</strong>.</span>
                                  }
                                </p>
                              </div>
                              <div className="flex gap-1.5">
                                <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500/15 text-blue-300 text-[8px] font-extrabold shrink-0 mt-0.5">3</span>
                                <p className="text-slate-300">
                                  {isEn 
                                    ? <span>Or go to iOS <strong>Settings</strong> &gt; <strong>Safari</strong> &gt; <strong>Camera</strong> &gt; set <strong>Allow</strong>.</span>
                                    : <span>Pia unaweza kwenda kwenye simu yako <strong>Settings</strong> &gt; <strong>Safari</strong> &gt; <strong>Camera</strong> &gt; weka <strong>Allow</strong>.</span>
                                  }
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Interactive Actions Grid */}
                        <div className="grid grid-cols-2 gap-1.5 shrink-0 pt-1.5 border-t border-white/5 w-full">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRetryCount(prev => prev + 1);
                            }}
                            className="w-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-[8.5px] font-extrabold tracking-wider uppercase text-white rounded-lg py-1.5 shadow transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>🔄 {isEn ? 'Retry Camera' : 'Kurudia Skan'}</span>
                          </button>
                          
                          <label 
                            htmlFor="qr-image-fallback-upload-inner"
                            className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-[8.5px] font-extrabold tracking-wider uppercase text-white rounded-lg py-1.5 shadow transition-all flex items-center justify-center gap-1 cursor-pointer text-center"
                          >
                            <Camera className="w-3.5 h-3.5 text-white" />
                            <span>{isEn ? '📸 Take Photo' : '📸 Pakia Faili'}</span>
                          </label>
                        </div>

                        {isMobileIframe && (
                          <div className="shrink-0 mt-0.5">
                            <a 
                              href={window.location.href} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="w-full inline-flex items-center justify-center gap-1 py-1 px-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-[8px] rounded-lg tracking-wider font-mono uppercase shadow active:scale-95 transition"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>{isEn ? 'Open Full Web Page 🌐' : 'Skan Kwenye Tab Mpya 🌐'}</span>
                            </a>
                          </div>
                        )}
                        
                        <input 
                          id="qr-image-fallback-upload-inner"
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleImageUploadAndScan}
                          className="hidden"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[9px] text-rose-300 font-sans leading-normal">
                          {isEn ? 'Camera failed to start:' : 'Kamera imeshindwa kuwaka:'} {cameraError}
                        </p>
                        
                        {isMobileIframe && (
                          <div className="bg-blue-950/40 border border-blue-500/25 p-2 rounded-xl mt-1 space-y-1.5 text-center">
                            <p className="text-[8.5px] text-blue-300 leading-normal">
                              🔒 {isEn ? 'Safari/Chrome security prevents phone camera from working inside an Iframe.' : 'Usalama wa Safari/Chrome huzuia kamera ya simu kufanya kazi ndani ya Iframe.'}
                            </p>
                            <a 
                              href={window.location.href} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-[9px] rounded-lg tracking-wider font-mono uppercase w-full shadow active:scale-95 transition"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Fungua Tab Mpya 🌐</span>
                            </a>
                          </div>
                        )}

                        <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setRetryCount(prev => prev + 1)}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-[9px] font-bold text-white rounded-lg transition shadow-md cursor-pointer"
                          >
                            {isEn ? 'Retry Camera 🔄' : 'Rudia Kamera 🔄'}
                          </button>
                          
                          <label 
                            htmlFor="qr-image-fallback-upload-inner-alt"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-[9px] font-bold text-white rounded-lg transition shadow-md cursor-pointer"
                          >
                            <Camera className="w-3 h-3" />
                            <span>{isEn ? 'Take QR Photo 📸' : 'Piga Picha ya QR 📸'}</span>
                          </label>
                          <input 
                            id="qr-image-fallback-upload-inner-alt"
                            type="file"
                            accept="image/*"
                          capture="environment"
                          onChange={handleImageUploadAndScan}
                          className="hidden"
                        />
                      </div>
                    </div>
                  )) : (
                    <div className="space-y-3.5 max-w-[240px] mx-auto">
                      {isMobileIframe ? (
                        <div className="space-y-2.5 bg-blue-950/35 border border-blue-500/25 p-3.5 rounded-xl">
                          <p className="text-[9.5px] text-blue-300 font-sans font-bold leading-normal">
                            🔒 {isEn ? 'Browser security prevents your phone camera from starting inside AI Studio Preview!' : 'Usalama wa kivinjari unazuia kamera ya simu yako kuwaka ndani ya AI Studio Preview!'}
                          </p>
                          <p className="text-[8.5px] text-slate-350 font-sans leading-relaxed">
                            {isEn ? 'You can take a photo of the card now or tap the button below to open the system in a full page to scan using the camera immediately:' : 'Unaweza kupiga picha ya kadi sasa au gusa kitufe kilicho chini kufungua mfumo kwenye ukurasa kamili ili kuskani ukitumia kamera mara moja:'}
                          </p>
                          <a 
                            href={window.location.href} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-[9.5px] rounded-lg tracking-wider font-mono uppercase w-full shadow active:scale-95 transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Skan kwenye Tab Mpya 🌐</span>
                          </a>
                        </div>
                      ) : (
                        <>
                          <p className="text-[9px] text-slate-350 font-sans leading-relaxed">
                            {isEn ? 'If the camera indicator does not appear, tap the button below to turn on the camera immediately:' : 'Kama kiashiria cha kamera hakitokei, gusa kitufe hapa chini ili kuwasha kamera mara moja:'}
                          </p>
                          
                          <button
                            type="button"
                            onClick={() => setRetryCount(prev => prev + 1)}
                            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] font-extrabold rounded-xl transition shadow-lg shrink-0 cursor-pointer active:scale-95 animate-bounce font-mono uppercase tracking-wider flex items-center gap-1.5 mx-auto"
                          >
                            <Camera className="w-4 h-4" />
                            <span>{isEn ? 'Start Camera Now 🎥' : 'Washa Kamera Sasa 🎥'}</span>
                          </button>
                        </>
                      )}

                      <p className="text-[8px] text-slate-500 font-sans italic leading-normal">
                        {isEn ? 'If you are using a mobile phone, you can also use the "Alternative Method" below to upload/take a picture of the QR code directly.' : 'Kama unatumia simu, unaweza pia kutumia "Njia Mbadala" hapa chini kupakia/kupiga picha ya QR moja kwa moja.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Micro green beacon for active live camera */}
              {cameraActive && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full flex items-center gap-1.5 z-10 border border-emerald-500/20 shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute"></span>
                  <span className="text-[8px] text-emerald-300 font-mono tracking-widest font-extrabold uppercase leading-none">{isEn ? 'CAMERA SCANNING' : 'KAMERA INASOMA'}</span>
                </div>
              )}

              {/* Instant overlay notification depend on scan result */}
              <AnimatePresence>
                {scanResult && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`absolute inset-0 p-6 flex flex-col justify-center items-center text-center text-white z-20 backdrop-blur-md ${
                      scanResult.status === 'success' ? 'bg-emerald-600/95' :
                      scanResult.status === 'duplicate' ? 'bg-amber-600/95 shadow-[inset_0_0_40px_rgba(245,158,11,0.5)]' :
                      'bg-red-600/95 text-rose-100'
                    }`}
                  >
                    {scanResult.status === 'success' && (
                      <div className="space-y-2 flex flex-col items-center w-full">
                        <CheckCircle className="w-12 h-12 text-white animate-bounce" />
                        <h4 className="font-bold text-lg leading-tight uppercase font-sans">{isEn ? 'Guest Admitted!' : 'Mgeni Amekubaliwa!'}</h4>
                        <div className="text-xs space-y-1 font-sans w-full">
                          <p className="font-bold text-sm bg-black/20 px-3 py-1.5 rounded-full inline-block mb-1">{scanResult.guestName}</p>
                          <p>{isEn ? 'Card Type:' : 'Aina ya Kadi:'} <strong>{scanResult.cardType}</strong></p>
                          <p>{isEn ? 'Allowed to enter:' : 'Wanaoruhusiwa Kuingia:'} <strong>{scanResult.companions || (scanResult.cardType === 'DOUBLE' ? 2 : 1)}</strong></p>
                          <p className="italic text-[10px] text-emerald-100 font-mono mt-1">{isEn ? 'Time:' : 'Saa:'} {scanResult.time}</p>

                          {scanResult.isOfflineSaved && (
                            <div className="bg-amber-500/20 text-amber-200 border border-amber-500/30 px-3 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5 text-[10px] mt-2 select-none justify-center animate-pulse">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                              </span>
                              <span>{isEn ? 'Saved Offline (Will Sync Later)' : 'Imehifadhiwa Nje ya Mtandao (Itasawazishwa)'}</span>
                            </div>
                          )}
                          
                          <div className="flex flex-wrap gap-2 justify-center py-2 mt-2 border-t border-white/20 text-[10px] bg-black/10 rounded-lg w-full">
                            <span className="w-full font-bold mb-1">{isEn ? 'Total Checked-in:' : 'Jumla ya Waliokwisha Ingia:'}</span>
                            {['SINGLE', 'DOUBLE', 'VIP', 'VVIP'].map(t => {
                               const c = guests.filter(g => g.checkedIn && g.cardType === t).length;
                               if (c === 0) return null;
                               return <span key={t} className="bg-black/30 px-2 py-0.5 rounded">{t}: {c}</span>
                            })}
                          </div>
                        </div>
                        <div className="pt-2 flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const gst = guests.find(g => g.id === scanResult.guestId);
                              if (gst) {
                                if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                                setScanResult(null);
                                setPhotoGuest(gst);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-black/30 hover:bg-black/50 text-white font-bold rounded-xl transition cursor-pointer text-[11px] border border-white/10"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Take Guest Photo' : 'Piga Picha ya Mgeni'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {scanResult.status === 'duplicate' && (
                      <div className="space-y-2 p-1 flex flex-col items-center w-full">
                        <AlertTriangle className="w-12 h-12 text-yellow-300 animate-pulse" />
                        <h4 className="font-bold text-base leading-tight uppercase font-sans text-yellow-200">{isEn ? 'CARD ALREADY USED!' : 'KADI ISHATUMIWA! DIAL UP'}</h4>
                        <div className="text-[10px] space-y-1 font-sans leading-normal w-full">
                          <p className="font-bold text-xs bg-black/30 px-3 py-1 rounded-full inline-block mb-1 text-white">{scanResult.guestName}</p>
                          <p className="text-slate-100">{isEn ? 'This card has already been scanned before and is used!' : 'Kadi hii imeshapitia skana hapo mbeleni na imetumika tayari!'}</p>
                          <p className="font-semibold text-yellow-200">{isEn ? 'Time of first scan:' : 'Saa ya skan ya kwanza:'} {scanResult.time}</p>
                          
                          <div className="flex flex-wrap gap-2 justify-center py-2 mt-2 border-t border-white/20 text-[9px] bg-black/20 rounded-lg w-full">
                            <span className="w-full font-bold mb-1 text-yellow-200">{isEn ? 'Total Checked-in:' : 'Jumla ya Waliokwisha Ingia:'}</span>
                            {['SINGLE', 'DOUBLE', 'VIP', 'VVIP'].map(t => {
                               const c = guests.filter(g => g.checkedIn && g.cardType === t).length;
                               if (c === 0) return null;
                               return <span key={t} className="bg-black/30 px-2 py-0.5 rounded text-white">{t}: {c}</span>
                            })}
                          </div>

                          <p className="text-[9px] text-amber-200 italic mt-2 border-t border-white/10 pt-1">{isEn ? 'Warning: Ensure usher prevents duplicate entry!' : 'Onyo: Mwezeshe usher kuzuia duplicate entry!'}</p>
                        </div>
                      </div>
                    )}

                    {scanResult.status === 'error' && (
                      <div className="space-y-2 flex flex-col items-center">
                        <XCircle className="w-12 h-12 text-rose-200" />
                        <h4 className="font-bold text-base leading-tight uppercase font-sans text-rose-100">KADI HAIKUTAMBULIKA!</h4>
                        <p className="text-[10px] leading-relaxed text-rose-200 bg-black/20 p-2 rounded-lg">
                          {manualError || (isEn ? 'QR code not recognized or not in the official guest list for this event.' : 'Nambari ya QR haikutambulika au haimo katika orodha rasmi ya sherehe hii.')}
                        </p>
                      </div>
                    )}
                    
                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setScanResult(null);
                          setManualError('');
                          isProcessingRef.current = false;
                          lockCodeRef.current = null;
                        }}
                        className="inline-flex items-center justify-center min-w-[120px] px-6 py-2.5 bg-white text-black font-bold rounded-xl transition cursor-pointer text-sm shadow-lg hover:bg-slate-200"
                      >
                        Ok
                      </button>
                    </div>

                  </motion.div>
                )}
              </AnimatePresence>

            </div>

            {/* Fail-safe standard Image Picker decoder option */}
            <div className="w-full max-w-xs bg-slate-900 border border-blue-500/30 rounded-2xl p-4.5 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-blue-350">
                <Camera className="w-4 h-4 text-blue-400 shrink-0" />
                <h4 className="font-bold text-[10.5px] uppercase tracking-wider font-mono">{isEn ? 'Alternative Verification' : 'Njia Mbadala ya Uhakiki'}</h4>
              </div>
              <p className="text-[10px] text-slate-350 leading-relaxed font-sans">
                Kama kamera yako bado inasubiri ruhusa, unaweza <strong>kupiga picha ya kadi (QR)</strong> au kupakia picha kutoka galari ya simu yako hapa chini kuingiza wageni:
              </p>
              
              <label 
                htmlFor="qr-image-fallback-upload" 
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-550 text-white font-extrabold rounded-xl transition shadow-lg text-center text-[10.5px] uppercase font-mono tracking-wider cursor-pointer active:scale-95"
              >
                <QrCode className="w-4 h-4" />
                <span>{isEn ? 'Upload / Take QR Photo 📸' : 'Pakia / Piga Picha ya QR 📸'}</span>
              </label>
              <input 
                id="qr-image-fallback-upload"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUploadAndScan}
                className="hidden"
              />
            </div>

            {/* Reset Button */}
            <div className="w-full max-w-xs mt-2">
              {!showResetConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition shadow text-[10px] uppercase font-mono tracking-wider flex items-center justify-center gap-2 border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {isEn ? 'Reset All Check-in Counts (0)' : 'Rudisha Namba ya Walioingia Kuwa 0'}
                </button>
              ) : (
                <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-3 space-y-3">
                  <p className="text-[10px] text-rose-200 font-sans text-center">
                    {isEn ? 'Are you sure? This will clear all checked-in statuses for this event.' : 'Una uhakika? Hii itafuta kumbukumbu zote za walioingia kwenye sherehe hii.'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold rounded-lg text-[10px] transition hover:bg-slate-700"
                    >
                      {isEn ? 'Cancel' : 'Ghairi'}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetCheckins}
                      className="flex-1 py-2 bg-rose-600 text-white font-bold rounded-lg text-[10px] transition hover:bg-rose-500 shadow-lg shadow-rose-900/50"
                    >
                      {isEn ? 'Yes, Reset' : 'Ndiyo, Futa'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Kamera inayoshindwa kuwaka: Njia rahisi kabisa za Utatuzi (Camera Troubleshooter Swahili Panel) */}
            {cameraError && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-xs bg-rose-950/20 shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-rose-500/20 rounded-2xl p-4 space-y-3.5 text-slate-300 animate-fade-in"
              >
                <div className="flex items-start gap-2.5 text-rose-300 border-b border-rose-500/10 pb-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <h5 className="font-bold text-[11px] uppercase tracking-wider font-mono">{isEn ? 'Camera Instructions (Help)' : 'Maelekezo ya Kamera (Msaada)'}</h5>
                    <p className="text-[9.5px] font-sans text-rose-300/80 mt-0.5 font-medium leading-tight">Jinsi ya kuwasha kamera kwenye simu/kifaa kingine:</p>
                  </div>
                </div>

                <div className="space-y-3 leading-relaxed text-[10px] font-sans">
                  <div className="flex gap-2.5">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/15 text-rose-300 text-[9px] font-extrabold shrink-0 mt-0.5 border border-rose-500/25">1</span>
                    <p>
                      {isEn 
                        ? <><strong>Grant Permission (Google/Safari):</strong> Tap the <span className="underline decoration-dotted font-semibold text-rose-200">lock or settings icon</span> on the left side of the address bar (top of your browser), change <strong>Camera</strong> permission to <strong>"Allow"</strong>, then reload this page.</>
                        : <><strong>Toa Ruhusa (Google/Safari):</strong> Gusa alama ya <span className="underline decoration-dotted font-semibold text-rose-200">kufuli au kadi ya mpangilio</span> iliyo upande wa kushoto wa bar ya anwani (juu ya kivinjari chako), badilisha ruhusa ya <strong>Kamera</strong> kuwa <strong>"Allow/Ruhusu"</strong>, kisha ipakie upya (reload) kurasa hii.</>}
                    </p>
                  </div>

                  <div className="flex gap-2.5">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/15 text-rose-300 text-[9px] font-extrabold shrink-0 mt-0.5 border border-rose-500/25">2</span>
                    <p>
                      <strong>Ufunguzi kupitia WhatsApp:</strong> Kama umefungulia kiungo hiki ndani ya WhatsApp au Instagram, gusa nukta tatu <span className="font-bold font-mono">get ···</span> zilizo juu mwa skrini, kisha chagua <strong className="text-blue-300">"Fungua kwenye Kivinjari" (Open in Chrome/Safari)</strong>.
                    </p>
                  </div>

                  <div className="flex gap-2.5">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/15 text-rose-300 text-[9px] font-extrabold shrink-0 mt-0.5 border border-rose-500/25">3</span>
                    <p>
                      {isEn 
                        ? <><strong>Close Other Tabs:</strong> Ensure no other browser or app is currently using the camera (e.g., WhatsApp video call, Instagram, etc.) to free up camera access.</>
                        : <><strong>Zima Tab Nyingine:</strong> Hakikisha hakuna kivinjari au tab nyingine inayokaribisha kamera hivi sasa (mfano simu ya video ya WhatsApp, Instagram, n.k.) ili kuachia upatikanaji wa kamera.</>}
                    </p>
                  </div>

                  <div className="flex gap-2.5 border-t border-rose-500/10 pt-2.5">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/15 text-blue-300 text-[9px] font-extrabold shrink-0 mt-0.5 border border-blue-500/25">💡</span>
                    <p>
                      isEn ? <><strong>Quick Alternative:</strong> No problem at all! On the right side, just tap the <strong className="text-blue-300">Search by Name</strong> button or the guest list to check them in with one click without needing a camera!</> : <><strong>Njia Mbadala ya Haraka:</strong> Hakuna shida kabisa! Kwenye upande wa kulia, gusa tu kitufe cha <strong className="text-blue-300">Tafuta kwa Jina</strong> au orodha ya wageni uwa-check in kwa kubofya mara moja tu bila kuhitaji kamera!</>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRetryCount(prev => prev + 1)}
                  className="w-full py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold rounded-xl transition shadow-lg text-center text-[10px] uppercase font-mono tracking-wider cursor-pointer"
                >
                  {isEn ? 'Retry Camera 🔄' : 'Jaribu Tena Kamera 🔄'}
                </button>
              </motion.div>
            )}

            {/* Camera input device selector */}
            {devices.length > 0 && (
              <div className="w-full max-w-xs bg-black/40 border border-white/10 rounded-2xl p-3.5 space-y-2 text-xs animate-fade-in">
                <label className="font-bold text-slate-350 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider" htmlFor="camera-device-select">
                  <Camera className="w-3.5 h-3.5 text-blue-400" />
                  <span>{isEn ? 'Choose Camera (Active Camera)' : 'Chagua Kamera (Active Camera)'}</span>
                </label>
                <select
                  id="camera-device-select"
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="w-full border border-white/10 bg-[#050b18] text-white px-2 py-1.5 rounded-lg focus:outline-none text-[10.5px] cursor-pointer"
                >
                  <option value="" className="bg-[#050b18] text-slate-400 font-sans">{isEn ? '-- Select camera automatically --' : '-- Chagua kamera kiotomatiki --'}</option>
                  {devices.map((device, idx) => (
                    <option key={device.deviceId} value={device.deviceId} className="bg-[#050b18] text-white font-sans">
                      {device.label || (isEn ? `Camera ${idx + 1}` : `Kamera ${idx + 1}`)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Attendance Confirmation Progress bar comparing Checked In vs Confirmed RSVP */}
            <div className="w-full max-w-xs bg-black/40 border border-white/10 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">
                <span>{isEn ? 'Checked-in (Scanned)' : 'Walioingia (Scanned)'}</span>
                <span>{isEn ? 'Confirmed (RSVP)' : 'Waliothibitisha (Confirmed RSVP)'}</span>
              </div>
              
              <div className="flex justify-between items-baseline">
                <span className="text-xl font-extrabold text-white">{countCheckedIn} <span className="text-xs text-slate-400">{isEn ? "Guests" : "Wageni"}</span></span>
                <span className="text-xs font-mono text-slate-350">Kati ya {countRsvped} (RSVP)</span>
              </div>

              {/* Progress gauge visualizer */}
              <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden border border-white/10 flex">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, countRsvped > 0 ? (countCheckedIn / countRsvped) * 100 : 0)}%` }}
                />
              </div>

              <p className="text-[9px] text-slate-400 italic font-sans leading-none text-right">
                Asilimia: {countRsvped > 0 ? Math.round((countCheckedIn / countRsvped) * 100) : 0}% ya walio RSVP wameshakaguliwa.
              </p>
            </div>
          </div>

          {/* Middle Area: Simulated Scanning Dropdown lookup and information (5 Cols) */}
          <div className="lg:col-span-5 space-y-5 text-xs font-sans text-white w-full">
            
            {/* 1. Normal QR simulation scan picker */}
            <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                <span>{isEn ? 'Simulate / Test QR Code Scan' : 'Simulate / Jaribu QR Code Scan (Mlangoni)'}</span>
              </h3>
              
              <p className="text-slate-350 leading-relaxed text-[11px]">
                {isEn ? 'To simulate scanning a card at the gate, select any guest from the list below, then click "Scan Card". The system will read the guest\'s QR and record entry statistics.' : 'Ili kuiga kitendo cha skani kadi mlangoni, chagua mgeni yeyote kutoka kwenye orodha hapa chini, kisha bofya <strong>"Skani Kadi"</strong>. Mfumo utasoma QR ya mgeni huyo na kurekodi takwimu za uingiaji.'}
              </p>

              {/* Selector dropdown */}
              <div className="space-y-1">
                <label className="font-bold text-slate-300 block mb-1" htmlFor="simulate-guest-scan-select">{isEn ? "Edit: Select Guest to Scan" : "Hariri: Chagua Mgeni wa Kuskani"}</label>
                <select
                  id="simulate-guest-scan-select"
                  value={selectedGuestSimId}
                  onChange={(e) => setSelectedGuestSimId(e.target.value)}
                  className="w-full border border-white/10 bg-[#050b18] text-white px-3 py-2.5 rounded-xl focus:outline-none text-xs"
                >
                  <option value="" className="bg-[#050b18] text-slate-400 font-sans">{isEn ? '-- Select guest here --' : '-- Chagua mgeni hapa --'}</option>
                  {guests.map(g => (
                    <option key={g.id} value={g.id} className="bg-[#050b18] text-white">
                      {g.name} ({g.cardType} - {g.checkedIn ? (isEn ? 'Arrived ✓' : 'Kashafika ✓') : (isEn ? 'Pending' : 'Bado')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Trigger Button */}
              <button
                type="button"
                id="scan-trigger-btn"
                onClick={() => handleTriggerSimulatedScan(selectedGuestSimId)}
                disabled={!selectedGuestSimId}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] text-white font-bold rounded-xl transition duration-150 disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 shadow cursor-pointer text-xs"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isEn ? 'Complete QR Scan now' : 'Kamilisha Skani ya QR sasa'}</span>
              </button>
            </div>

            {/* 2. Manual Code CheckIn Fallback form for guest who lost digital invitation */}
            <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-white flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>{isEn ? 'Manual Check-in (Without Card)' : 'Uhakiki Bila Kadi (Manual Code Recovery)'}</span>
              </h3>
              
              <p className="text-slate-350 leading-relaxed text-[11px]">
                {isEn ? 'If a guest lost their card or phone, you can enter their code here (e.g., <strong>KY-4509</strong> or any code) to check them in manually.' : 'Ikiwa mgeni amepoteza kadi yake au hana simu, unaweza kuandika kodi yake hapa chini (mfano: <strong>KY-4509</strong> au kodi yoyote ya mgeni) ili kumuingiza mlangoni.'}
              </p>

              <form onSubmit={handleManualCodeCheckIn} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-mono font-bold block" htmlFor="manual-checkin-code-input">
                    KODI YA UNIQUE YA MGENI (GUEST CODE)
                  </label>
                  <div className="flex gap-2">
                    <input 
                      id="manual-checkin-code-input"
                      type="text"
                      required
                      placeholder="e.g. KY-4509"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono uppercase text-center focus:outline-none focus:ring-1 focus:ring-blue-550 focus:border-blue-500 text-xs"
                    />
                    <button
                      type="submit"
                      id="manual-code-submit-btn"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer text-xs"
                    >
                      {isEn ? 'Check-in Card' : 'Uhakiki Kadi'}
                    </button>
                  </div>
                </div>

                {manualError && (
                  <p className="text-[10px] text-rose-300 font-semibold animate-pulse">
                    ⚠️ {manualError}
                  </p>
                )}
              </form>
            </div>

          </div>

          {/* Right Area: Recent Scans Sidebar (3 Cols) */}
          <div className="lg:col-span-3 space-y-4 w-full">
            <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col h-[400px]">
              
              {/* Header */}
              <div className="flex items-center gap-1.5 pb-2.5 border-b border-white/10 mb-3 shrink-0">
                <History className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-[10px] uppercase tracking-wider">
                  {isEn ? 'Recent Scans' : 'Skani za Hivi Karibuni'}
                </h3>
              </div>

              {/* Scrollable list content */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {recentScans.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-3 text-slate-400 space-y-2">
                    <Clock className="w-8 h-8 opacity-20 text-slate-400 animate-pulse" />
                    <p className="text-[10px] italic">{isEn ? 'No cards verified yet.' : 'Bado hakuna kadi iliyothibitishwa.'}</p>
                  </div>
                ) : (
                  recentScans.map((scan) => (
                    <motion.div 
                      key={`${scan.id}-${scan.time}`}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-2.5 bg-black/40 border border-white/5 hover:border-white/10 rounded-xl flex flex-col space-y-1 transition duration-200"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-white truncate text-[10.5px]" title={scan.name}>
                          {scan.name}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0 mt-1"></span>
                      </div>
                      
                      <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono">
                        <span className="bg-white/10 px-1 py-0.2 rounded border border-white/5 font-bold uppercase text-[8px]">
                          {scan.cardType}
                        </span>
                        <span className="flex items-center gap-0.5 text-emerald-300 font-bold">
                          <Clock className="w-2.5 h-2.5" />
                          {scan.time}
                        </span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Sidebar Footer line */}
              <div className="pt-2.5 border-t border-white/5 mt-auto shrink-0 text-center">
                <p className="text-[9px] text-slate-450 italic">
                  Inaonyesha skani tano za mwisho ✓
                </p>
              </div>

            </div>
          </div>

        </div>
      ) : activeTab === 'list' ? (
        /* Guest Directory & Check-in Registry Log */
        <div className="space-y-4 animate-fade-in" id="check-in-registry-view">
          
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-emerald-950/25 border border-emerald-500/15 rounded-2xl p-4 flex justify-between items-center">
              <div>
                <p className="text-[8.5px] text-emerald-400 font-bold uppercase font-mono tracking-widest">{isEn ? "Confirmed (RSVP)" : "Waliodhibitisha (RSVP)"}</p>
                <p className="text-lg font-extrabold text-white mt-0.5">{countConfirmedGuests} <span className="text-[10px] text-slate-400 font-normal">{isEn ? `Cards (${countConfirmedSeats} Pax)` : `Kadi (${countConfirmedSeats} Watu)`}</span></p>
              </div>
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            </div>

            <div className="bg-blue-950/25 border border-blue-500/15 rounded-2xl p-4 flex justify-between items-center">
              <div>
                <p className="text-[8.5px] text-blue-400 font-bold uppercase font-mono tracking-widest">{isEn ? "Arrived (Check-in)" : "Waliofika (Check-in)"}</p>
                <p className="text-lg font-extrabold text-white mt-0.5">{countCheckedIn} <span className="text-[10px] text-slate-400 font-normal">{isEn ? `Cards (${countCheckedInSeats} Pax)` : `Kadi (${countCheckedInSeats} Watu)`}</span></p>
              </div>
              <Users className="w-5 h-5 text-blue-400 shrink-0" />
            </div>

            <div className="bg-amber-950/25 border border-amber-500/15 rounded-2xl p-4 flex justify-between items-center">
              <div>
                <p className="text-[8.5px] text-amber-400 font-bold uppercase font-mono tracking-widest">{isEn ? 'Pending Arrival' : 'Bado Kufika (Pending)'}</p>
                <p className="text-lg font-extrabold text-white mt-0.5">{countPendingGuests} <span className="text-[10px] text-slate-400 font-normal">{isEn ? `Cards (${countPendingSeats} Pax)` : `Kadi (${countPendingSeats} Watu)`}</span></p>
              </div>
              <Clock className="w-5 h-5 text-amber-400 shrink-0" />
            </div>
          </div>

          {/* List Search and Filter Header */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white/5 border border-white/10 p-4 rounded-2xl">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text"
                placeholder="Tafuta jina au kodi..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
              />
            </div>

            <div className="flex bg-slate-900/60 p-1 rounded-xl border border-white/5 text-[9.5px] font-bold w-full md:w-auto overflow-x-auto whitespace-nowrap scrollbar-none">
              {[
                { id: 'all', label: isEn ? `All (${guests.length})` : `Wote (${guests.length})` },
                { id: 'confirmed', label: isEn ? `Confirmed (${countConfirmedGuests})` : `Waliodhibitisha (${countConfirmedGuests})` },
                { id: 'checked-in', label: isEn ? `Checked-in (${countCheckedIn})` : `Walioingia (${countCheckedIn})` },
                { id: 'pending', label: isEn ? `Pending (${countPendingGuests})` : `Bado Kuingia (${countPendingGuests})` }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setListFilter(f.id as any)}
                  className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                    listFilter === f.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/5 text-xs font-sans text-white" id="check-in-registry-table">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-slate-400 font-mono uppercase text-[9px] border-b border-white/10">
                    <th className="px-5 py-3">{isEn ? 'Photo' : 'Picha'}</th>
                    <th className="px-5 py-3">{isEn ? 'Guest Name' : 'Jina la Mgeni'}</th>
                    <th className="px-5 py-3 text-center">{isEn ? 'Code' : 'Kode'}</th>
                    <th className="px-5 py-3 text-center">{isEn ? 'Ticket' : 'Tiketi'}</th>
                    <th className="px-5 py-3 text-center">{isEn ? 'Time Checked-In' : 'Muda wa Kuingia'}</th>
                    <th className="px-5 py-3 text-center">{isEn ? 'Badge' : 'Badge'}</th>
                    <th className="px-5 py-3 text-right">{isEn ? 'Status' : 'Hali'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredGuestsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400 italic">
                        {listSearch 
                          ? (isEn ? 'No guest found with that name.' : 'Hakuna mgeni aliyepatikana kwa jina hilo.') 
                          : (isEn ? 'The entry log is currently empty.' : 'Orodha iko wazi kwa sasa.')}
                      </td>
                    </tr>
                  ) : (
                    filteredGuestsList.map((g) => (
                      <tr key={g.id} className="hover:bg-white/5 transition border-b border-white/5">
                        <td className="px-5 py-2.5">
                          {g.photoUrl ? (
                            <div className="flex items-center gap-2">
                              <img 
                                src={g.photoUrl} 
                                alt="Guest" 
                                className="w-8 h-8 rounded-full object-cover border-2 border-emerald-500/40"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPhotoGuest(g)}
                              className="w-8 h-8 flex items-center justify-center bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-full transition cursor-pointer"
                              title={isEn ? "Take Photo" : "Piga Picha"}
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-bold text-white uppercase text-[11px]">{g.name}</p>
                          <p className="text-[9px] text-slate-400 font-mono">{g.phone}</p>
                        </td>
                        <td className="px-5 py-3 text-center font-mono text-blue-300">{g.code}</td>
                        <td className="px-5 py-3 text-center">
                          <span className="px-2 py-0.5 bg-white/10 text-slate-350 border border-white/10 rounded-full font-bold text-[8px] font-mono uppercase">
                            {g.cardType}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center font-mono font-bold text-emerald-400">
                          {g.checkedIn ? (g.checkedInTime || 'V') : '--:--'}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDownloadBadge(g)}
                            className="p-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white rounded-xl transition cursor-pointer group"
                            title="Download Guest Badge"
                          >
                            <QrCode className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          </button>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {g.checkedIn ? (
                            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-tight">Checked In</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => triggerScanResult(g)}
                              className="bg-blue-600 hover:bg-blue-500 hover:border-blue-400 border border-transparent text-white px-3 py-1 rounded-xl text-[9px] font-bold uppercase tracking-tight transition cursor-pointer select-none active:scale-95 shadow-md shadow-blue-900/30 font-sans"
                              title={isEn ? "Verify and check in guest" : "Hakiki na ruhusu mgeni kuingia"}
                            >
                              {isEn ? 'Verify Entry' : 'Ruhusu Kuingia'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Logs & Arrival Trends View */
        <div className="space-y-6 animate-fade-in" id="check-in-logs-view">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2 text-white">
              <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                {isEn ? "Current Time" : "Muda uliopo sasa"}
              </h4>
              <p className="text-2xl font-black text-white">{new Date().toLocaleTimeString()}</p>
              <p className="text-[10px] text-slate-450 italic">{isEn ? "Event in progress..." : "Tukio linaendelea..."}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2 text-white">
              <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                {isEn ? "Arrived Guests" : "Wageni Waliofika"}
              </h4>
              <p className="text-2xl font-black text-white">{countCheckedIn}</p>
              <p className="text-[10px] text-slate-450 italic">Kati ya walio RSVP {countRsvped}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2 text-white">
              <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {isEn ? 'Scan Efficiency' : 'Ufanisi wa Scana'}
              </h4>
              <p className="text-2xl font-black text-white">100%</p>
              <p className="text-[10px] text-slate-450 italic">{isEn ? 'All scans passed safely' : 'Skani zote zimepita kwa usalama'}</p>
            </div>
          </div>

          {/* Arrival Timeline Flow Chart (CSS Based) */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6 text-white">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                {isEn ? "Guest Arrival Pattern" : "Mtiririko wa Wageni (Arrival Pattern)"}
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">Imesasishwa sasa hivi</span>
            </div>

            {/* Arrival Distribution Bar Visualization */}
            <div className="space-y-4">
              <div className="h-32 flex items-end gap-1.5 px-2">
                {/* Divide a theoretical 4-hour window from event start into 15 min chunks or just use last few hour bins */}
                {[...Array(12)].map((_, i) => {
                   const now = new Date();
                   const binTime = new Date(now.getTime() - (11 - i) * 15 * 60000);
                   const binLabel = `${binTime.getHours()}:${binTime.getMinutes() < 10 ? '0' : ''}${binTime.getMinutes()}`;
                   
                   // Count guests who arrived in this 15-min window
                   const countInBin = guests.filter(g => {
                     if (!g.checkedIn || !g.checkedInTime) return false;
                     // Rough check: matching hours and near minutes (since we only store T-Strings)
                     const arrivalStr = (g.checkedInTime || '').toLowerCase(); // formats like "2:30:00 PM"
                     const hourStr = binTime.getHours() > 12 ? (binTime.getHours() - 12).toString() : (binTime.getHours() === 0 ? '12' : binTime.getHours().toString());
                     const amPm = binTime.getHours() >= 12 ? 'pm' : 'am';
                     const minsGroup = Math.floor(binTime.getMinutes()/15)*15;
                     const minsLabel = minsGroup < 10 ? '0' + minsGroup : minsGroup.toString();
                     
                     // Highly flexible local time string matching
                     const targetPattern1 = `${hourStr}:${minsLabel}`;
                     const targetPattern2 = `${binTime.getHours()}:${minsLabel}`;
                     
                     return (arrivalStr.includes(targetPattern1) || arrivalStr.includes(targetPattern2)) && arrivalStr.includes(amPm);
                   }).length;

                   const heightPct = countCheckedIn > 0 ? (countInBin / countCheckedIn) * 100 : 0;
                   
                   return (
                     <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                       <div className="relative w-full h-full flex items-end">
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(countInBin > 0 ? 10 : 0, heightPct)}%` }}
                            className={`w-full rounded-t-lg transition-colors ${countInBin > 0 ? 'bg-gradient-to-t from-blue-600 to-blue-400' : 'bg-white/5'}`}
                          />
                          {countInBin > 0 && (
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-blue-600 text-[8px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              {countInBin}
                            </div>
                          )}
                       </div>
                       <span className="text-[8px] font-mono text-slate-500 rotate-45 origin-left h-4 mt-1">{binLabel}</span>
                     </div>
                   );
                })}
              </div>
              <p className="text-[9px] text-slate-450 italic text-center pt-8">Mchoro wa mtiririko wa wageni mlangoni (Kila baada ya dakika 15)</p>
            </div>
          </div>

          {/* Detailed Audit Log Table */}
          <div className="bg-[#050b18]/40 border border-white/5 rounded-2xl overflow-hidden text-white">
            <div className="px-5 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <h4 className="font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-slate-400" />
                {isEn ? "Audit Logs: Scan Time List" : "Audit Logs: Orodha ya Muda wa Skani"}
              </h4>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Realtime</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-[10.5px]">
                <thead className="sticky top-0 bg-[#090f1d] shadow-sm z-10">
                  <tr className="text-slate-500 border-b border-white/5">
                    <th className="px-5 py-2.5 font-bold">{isEn ? "Time" : "Muda (Time)"}</th>
                    <th className="px-5 py-2.5 font-bold">{isEn ? 'Guest' : 'Mgeni (Guest)'}</th>
                    <th className="px-5 py-2.5 font-bold">{isEn ? 'Card' : 'Kadi (Card)'}</th>
                    <th className="px-5 py-2.5 font-bold text-right">{isEn ? 'Status' : 'Hali (Status)'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[...guests]
                    .filter(g => g.checkedIn)
                    .sort((a, b) => {
                      const timeA = a.checkedInTime || '';
                      const timeB = b.checkedInTime || '';
                      return timeB.localeCompare(timeA); // reverse chronological
                    })
                    .map(g => (
                    <tr key={g.id} className="hover:bg-white/5 transition">
                      <td className="px-5 py-2.5 font-mono text-blue-400 font-bold">{g.checkedInTime}</td>
                      <td className="px-5 py-2.5 text-white font-semibold">{g.name}</td>
                      <td className="px-5 py-2.5 text-slate-400 text-[9px] uppercase font-bold">{g.cardType}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-emerald-400">SUCCESS ✓</td>
                    </tr>
                  ))}
                  {guests.filter(g => g.checkedIn).length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-slate-500 italic">{isEn ? 'Logs are currently empty. Scan a card to start seeing entries!' : 'Logs ni tupu kwa sasa. Skani kadi kuanza kuona uingiaji!'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal: Snap Guest Photo */}
      <AnimatePresence>
        {photoGuest && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="backdrop-blur-xl bg-[#090f1d] rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-white/15 shadow-2xl text-xs font-sans relative text-white text-center space-y-5"
            >
              <button 
                onClick={() => setPhotoGuest(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition cursor-pointer"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <span className="p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl inline-block mb-3">
                  <Camera className="w-6 h-6 animate-pulse" />
                </span>
                <h3 className="text-base font-bold text-white tracking-tight">{isEn ? '📸 Guest Photo' : '📸 Picha ya Mwalikwa'}</h3>
                <p className="text-slate-400 text-[10.5px] mt-1 leading-normal">{isEn ? `Capture photo of guest ` : `Nasa picha ya mgeni `}<strong>{photoGuest.name}</strong>{isEn ? ` for registration and security verification at the gate.` : ` kwa ajili ya usajili na uhakiki wa usalama mlangoni.`}</p>
              </div>

              {/* Viewfinder stream */}
              <div className="relative">
                {snapImage ? (
                  <div className="relative w-44 h-44 mx-auto rounded-full overflow-hidden border-4 border-emerald-500 shadow-2xl animate-[fade-in_0.3s_ease]">
                    <img 
                      src={snapImage} 
                      alt="Snapped Profile" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center font-mono text-[9px] text-emerald-400 font-extrabold uppercase">✓ KIMEKAMILIKA</div>
                  </div>
                ) : (
                  <div className="relative w-44 h-44 mx-auto rounded-full overflow-hidden border-4 border-white/10 bg-black shadow-inner flex items-center justify-center">
                    {snapCameraError ? (
                      <div className="p-3 text-center space-y-2 text-rose-300">
                        <p className="text-[10px] leading-relaxed">{snapCameraError}</p>
                      </div>
                    ) : snapStream ? (
                      <video 
                        ref={snapVideoRef} 
                        className="w-full h-full object-cover scale-x-[-1]" 
                        playsInline 
                        autoPlay 
                        muted 
                      />
                    ) : (
                      <div className="text-slate-400 space-y-1">
                        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/80 animate-spin mx-auto animate-[spin_1s_linear_infinite]"></div>
                        <p className="text-[9px] font-mono tracking-widest uppercase">Inaanzisha...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-col space-y-2.5 pt-2">
                {snapImage ? (
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setSnapImage(null)}
                      className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition cursor-pointer text-center text-[11px]"
                    >
                      🔄 Upya
                    </button>
                    <button 
                      type="button"
                      onClick={handleSaveSnappedPhoto}
                      className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-blue-600 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] text-white font-bold rounded-xl transition shadow-md cursor-pointer text-center text-[11px]"
                    >
                      {isEn ? 'Save ✓' : 'Hifadhi ✓'}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setPhotoGuest(null)}
                      className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl transition cursor-pointer text-center text-[11px]"
                    >
                      {isEn ? 'Cancel' : 'Ghairi'}
                    </button>
                    <button 
                      type="button"
                      disabled={!snapStream}
                      onClick={handleCapturePhoto}
                      className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 disabled:opacity-55 disabled:cursor-not-allowed hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] text-white font-bold rounded-xl transition shadow-md cursor-pointer text-center text-[11px]"
                    >
                      {isEn ? '📸 Take Photo' : '📸 Piga Picha'}
                    </button>
                  </div>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
