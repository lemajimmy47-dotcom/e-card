import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QrCode, X, CheckCircle, AlertCircle, RefreshCw, Camera } from 'lucide-react';
import jsQR from 'jsqr';
import { Guest } from '../types';

interface QuickGuestScannerProps {
  isOpen: boolean;
  onClose: () => void;
  guests: Guest[];
  onCheckIn: (guest: Guest) => void;
  language: 'sw' | 'en';
}

export default function QuickGuestScanner({ isOpen, onClose, guests, onCheckIn, language }: QuickGuestScannerProps) {
  const [cameraError, setCameraError] = useState<string>('');
  const [scanResult, setScanResult] = useState<{ status: 'success' | 'duplicate' | 'error'; guestName?: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const stopCamera = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(track => track.stop());
      activeStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    try {
      setCameraError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      activeStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        requestAnimationFrame(scanLoop);
      }
    } catch (err: any) {
      console.error('QuickScanner Error:', err);
      setCameraError(language === 'sw' ? 'Hakuweza kufungua kamera. Hakikisha umetoa ruhusa.' : 'Could not open camera. Please ensure permissions are granted.');
    }
  };

  const scanLoop = () => {
    if (!activeStreamRef.current || isProcessingRef.current) return;

    const video = videoRef.current;
    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code) {
          handleScan(code.data);
        }
      }
    }
    requestAnimationFrame(scanLoop);
  };

  const handleScan = (scannedData: string) => {
    if (isProcessingRef.current) return;
    
    // Simple match logic (match ID or Code)
    const normalizedData = scannedData.trim().toUpperCase();
    const guest = guests.find(g => 
      g.id.toUpperCase() === normalizedData || 
      g.code.toUpperCase() === normalizedData ||
      (g.id && normalizedData.includes(g.id.toUpperCase())) ||
      (g.code && normalizedData.includes(g.code.toUpperCase()))
    );

    if (guest) {
      isProcessingRef.current = true;
      if (guest.checkedIn) {
        setScanResult({ status: 'duplicate', guestName: guest.name });
      } else {
        onCheckIn(guest);
        setScanResult({ status: 'success', guestName: guest.name });
      }
      
      setTimeout(() => {
        setScanResult(null);
        isProcessingRef.current = false;
      }, 2500);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-[#0f172a] border border-[#1e2d53] rounded-[2rem] w-full max-w-sm overflow-hidden flex flex-col relative"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 text-center">
              <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-400" />
                <span>{language === 'sw' ? 'Skani Kadi ya Mgeni' : 'Scan Guest Card'}</span>
              </h3>
              <p className="text-slate-400 text-[10px] mt-1 font-mono uppercase tracking-widest">CHECK-IN MODE ACTIVE</p>
            </div>

            <div className="aspect-square relative bg-black flex items-center justify-center overflow-hidden">
              {cameraError ? (
                <div className="p-8 text-center space-y-4">
                  <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
                  <p className="text-rose-400 text-xs font-semibold leading-relaxed">{cameraError}</p>
                  <button 
                    onClick={startCamera}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition"
                  >
                    {language === 'sw' ? 'Jaribu Tena' : 'Retry Camera'}
                  </button>
                </div>
              ) : (
                <>
                  <video 
                    ref={videoRef} 
                    className="w-full h-full object-cover"
                    playsInline 
                    muted 
                  />
                  {/* Scanner overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-emerald-500/50 rounded-2xl">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg"></div>
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg"></div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-lg"></div>
                      {/* Laser beam animated */}
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-400/80 shadow-[0_0_15px_#10b981] animate-[scan_2s_ease-in-out_infinite]"></div>
                    </div>
                  </div>
                </>
              )}

              {/* Scan Status Overlay */}
              <AnimatePresence>
                {scanResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className={`absolute bottom-6 left-6 right-6 p-4 rounded-2xl flex items-center gap-3 backdrop-blur-md shadow-2xl ${
                      scanResult.status === 'success' ? 'bg-emerald-500/90' : 'bg-amber-500/90'
                    }`}
                  >
                    {scanResult.status === 'success' ? (
                      <CheckCircle className="w-6 h-6 text-white shrink-0" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-white shrink-0" />
                    )}
                    <div className="text-white">
                      <p className="font-bold text-sm leading-tight">{scanResult.guestName}</p>
                      <p className="text-[10px] font-medium opacity-90">
                        {scanResult.status === 'success' 
                          ? (language === 'sw' ? 'Amefanikiwa kuingia! ✅' : 'Successfully Checked In! ✅')
                          : (language === 'sw' ? 'Tayari ameshaingia! ⚠️' : 'Already Checked In! ⚠️')
                        }
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-6 bg-slate-900/50">
              <p className="text-slate-400 text-center text-[10px] leading-relaxed">
                {language === 'sw' 
                  ? 'Weka QR msimbo wa mgeni ndani ya kisanduku ili kumsajili ameingia sherehe.' 
                  : 'Position the guest\'s QR code within the frame to automatically check them in.'}
              </p>
            </div>
          </motion.div>
          
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes scan {
              0%, 100% { top: 0% }
              50% { top: 100% }
            }
          `}} />
        </div>
      )}
    </AnimatePresence>
  );
}
