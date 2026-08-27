import { EventDetails, Guest, ContributionCardTemplate } from '../types';
import QRCode from 'qrcode';

const qrCache = new Map<string, HTMLImageElement>();

export const PREMADE_THEMES = [
  { 
    id: 'midnight-gold', 
    nameEn: 'Midnight Royal', 
    nameSw: 'Midnight Gold', 
    bg: 'from-slate-900 to-slate-950', 
    border: 'border-amber-600/30', 
    text: 'text-amber-500', 
    primaryColor: '#fbbf24', 
    guestColor: '#FFFFFF', 
    pledgeColor: '#f43f5e', 
    deadlineColor: '#94a3b8', 
    badgeColor: '#fbbf24' 
  },
  { 
    id: 'emerald-luxury', 
    nameEn: 'Emerald Luxury', 
    nameSw: 'Zamaradi Classic', 
    bg: 'from-emerald-900 to-emerald-950', 
    border: 'border-amber-500/30', 
    text: 'text-amber-400', 
    primaryColor: '#f59e0b', 
    guestColor: '#ecd06f', 
    pledgeColor: '#fbbf24', 
    deadlineColor: '#6ee7b7', 
    badgeColor: '#f59e0b' 
  },
  { 
    id: 'velvet-plum', 
    nameEn: 'Velvet Plum', 
    nameSw: 'Velvet Plum', 
    bg: 'from-purple-900 to-purple-950', 
    border: 'border-pink-500/30', 
    text: 'text-pink-400', 
    primaryColor: '#f472b6', 
    guestColor: '#c084fc', 
    pledgeColor: '#f472b6', 
    deadlineColor: '#d8b4fe', 
    badgeColor: '#f472b6' 
  },
  { 
    id: 'onyx-minimal', 
    nameEn: 'Onyx Tech', 
    nameSw: 'Onyx Minimal', 
    bg: 'from-neutral-900 to-neutral-950', 
    border: 'border-neutral-700', 
    text: 'text-teal-500', 
    primaryColor: '#a3a3a3', 
    guestColor: '#FFFFFF', 
    pledgeColor: '#f43f5e', 
    deadlineColor: '#404040', 
    badgeColor: '#14b8a6' 
  }
];

function getOrCreateQRImage(text: string, callback: (img: HTMLImageElement) => void) {
  const cached = qrCache.get(text);
  if (cached) {
    callback(cached);
    return;
  }

  QRCode.toDataURL(text, {
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  }, (err, url) => {
    if (err || !url) return;
    const img = new Image();
    img.onload = () => {
      qrCache.set(text, img);
      callback(img);
    };
    img.src = url;
  });
}

export const drawContributionCardToCanvas = (
  canvas: HTMLCanvasElement,
  evt: EventDetails,
  tpl: ContributionCardTemplate,
  guest: Guest,
  pledgeText: string,
  isEn: boolean = false,
  onImageLoaded?: () => void
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  const drawOverlaysOnContext = (currentCtx: CanvasRenderingContext2D, currentH: number) => {
    // 1. Guest Name - Only item remaining per user request
    currentCtx.save();
    const gX = ((tpl.guestNameX || 50) / 100) * w;
    const gY = ((tpl.guestNameY || 50) / 100) * currentH;
    const scale = w / 450;
    currentCtx.fillStyle = tpl.guestNameColor || '#FFFFFF';
    currentCtx.font = `bold italic ${(tpl.guestNameSize || 32) * scale}px "Inter", sans-serif`;
    currentCtx.textAlign = 'center';
    currentCtx.textBaseline = 'middle';
    currentCtx.fillText(guest.name, gX, gY);
    currentCtx.restore();
  };

  function drawFallback() {
    const themeId = tpl.themeId || 'midnight-gold';
    ctx.clearRect(0, 0, w, h);

    // Define themes
    let bgGrad = ctx.createLinearGradient(0, 0, w, h);
    let primaryColor = '#fbbf24';
    let outlineColor = '#d97706';
    
    if (themeId === 'emerald-luxury') {
      bgGrad.addColorStop(0, '#022c22');
      bgGrad.addColorStop(0.5, '#011c15');
      bgGrad.addColorStop(1, '#04211a');
      primaryColor = '#f59e0b';
      outlineColor = '#ecd06f';
    } else if (themeId === 'velvet-plum') {
      bgGrad.addColorStop(0, '#1e0524');
      bgGrad.addColorStop(0.5, '#2d0b38');
      bgGrad.addColorStop(1, '#0f0212');
      primaryColor = '#f472b6';
      outlineColor = '#f472b6';
    } else if (themeId === 'onyx-minimal') {
      bgGrad.addColorStop(0, '#0d0d0d');
      bgGrad.addColorStop(0.5, '#141414');
      bgGrad.addColorStop(1, '#050505');
      primaryColor = '#a3a3a3';
      outlineColor = '#404040';
    } else { // midnight-gold
      bgGrad.addColorStop(0, '#0a0f1d');
      bgGrad.addColorStop(0.5, '#0f172a');
      bgGrad.addColorStop(1, '#020617');
      primaryColor = '#fbbf24';
      outlineColor = '#d97706';
    }

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    if (themeId === 'onyx-minimal') {
      // Draw modern minimal tech brackets/coordinates
      ctx.strokeStyle = '#14b8a680'; // teal
      ctx.lineWidth = 2;
      const brLen = 20;
      const margin = 20;

      // Top Left
      ctx.beginPath(); ctx.moveTo(margin + brLen, margin); ctx.lineTo(margin, margin); ctx.lineTo(margin, margin + brLen); ctx.stroke();
      // Top Right
      ctx.beginPath(); ctx.moveTo(w - margin - brLen, margin); ctx.lineTo(w - margin, margin); ctx.lineTo(w - margin, margin + brLen); ctx.stroke();
      // Bottom Left
      ctx.beginPath(); ctx.moveTo(margin + brLen, h - margin); ctx.lineTo(margin, h - margin); ctx.lineTo(margin, h - margin - brLen); ctx.stroke();
      // Bottom Right
      ctx.beginPath(); ctx.moveTo(w - margin - brLen, h - margin); ctx.lineTo(w - margin, h - margin); ctx.lineTo(w - margin, h - margin - brLen); ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(margin + 10, margin + 10, w - (margin + 10) * 2, h - (margin + 10) * 2);
    } 

    drawOverlaysOnContext(ctx, h);

    if (onImageLoaded) onImageLoaded();
  }

  if (tpl.imageUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Dynamically adjust canvas dimensions to match custom image aspect ratio
      const ratio = img.naturalHeight / img.naturalWidth;
      const targetHeight = Math.round(w * ratio);
      canvas.height = targetHeight;

      // Re-get context because changing canvas size resets it
      const dynamicCtx = canvas.getContext('2d') || ctx;
      dynamicCtx.clearRect(0, 0, w, targetHeight);
      dynamicCtx.drawImage(img, 0, 0, w, targetHeight);

      drawOverlaysOnContext(dynamicCtx, targetHeight);

      if (onImageLoaded) onImageLoaded();
    };
    img.onerror = () => {
      drawFallback();
    };
    img.src = tpl.imageUrl;
  } else {
    drawFallback();
  }
};

export async function generateContributionCardImage(
  evt: EventDetails,
  tpl: ContributionCardTemplate,
  guest: Guest,
  pledgeText: string,
  isEn: boolean = false
): Promise<string> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(tpl.imageUrl || '');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 900;
    
    drawContributionCardToCanvas(canvas, evt, tpl, guest, pledgeText, isEn, () => {
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch (err) {
        console.error("Failed to generate contribution card image:", err);
        resolve(tpl.imageUrl || '');
      }
    });
  });
}
