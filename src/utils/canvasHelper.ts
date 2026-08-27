import { EventDetails, TemplateSettings } from '../types';
import QRCode from 'qrcode';

const imageCache = new Map<string, HTMLImageElement>();
const qrCache = new Map<string, HTMLImageElement>();

function isLightColor(hex: string): boolean {
  if (!hex || typeof hex !== 'string' || hex.startsWith('url')) return true;
  let color = hex.replace('#', '');
  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }
  if (color.length !== 6) return true;
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 125;
}

function getOrCreateQRImage(text: string, callback: (img: HTMLImageElement) => void) {
  const textToEncode = text || "EVENTCARD";
  const cached = qrCache.get(textToEncode);
  if (cached) {
    callback(cached);
    return;
  }

  QRCode.toDataURL(textToEncode, {
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  }, (err, url) => {
    if (err || !url) {
      console.error("[canvasHelper] QR Code generation failed:", err);
      const dummyImg = new Image();
      dummyImg.onload = () => {
        qrCache.set(textToEncode, dummyImg);
        callback(dummyImg);
      };
      dummyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      return;
    }
    const img = new Image();
    img.onload = () => {
      qrCache.set(textToEncode, img);
      callback(img);
    };
    img.onerror = () => {
      console.error("[canvasHelper] QR Image loading failed");
      callback(img);
    };
    img.src = url;
  });
}

export function drawCardToCanvas(
  canvas: HTMLCanvasElement,
  event: EventDetails,
  settings: TemplateSettings,
  guestName: string,
  cardType: string,
  qrCodeText: string = 'EVENTCARD-' + event.id,
  onImageLoaded?: () => void
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Safe fallback template coordinates if any are undefined or NaN
  const guestNameX = typeof settings.guestNameX === 'number' && !isNaN(settings.guestNameX) ? settings.guestNameX : 50;
  const guestNameY = typeof settings.guestNameY === 'number' && !isNaN(settings.guestNameY) ? settings.guestNameY : 45;
  const guestNameSize = typeof settings.guestNameSize === 'number' && !isNaN(settings.guestNameSize) ? settings.guestNameSize : 24;

  const qrCodeX = typeof settings.qrCodeX === 'number' && !isNaN(settings.qrCodeX) ? settings.qrCodeX : 50;
  const qrCodeY = typeof settings.qrCodeY === 'number' && !isNaN(settings.qrCodeY) ? settings.qrCodeY : 75;
  const qrCodeSize = typeof settings.qrCodeSize === 'number' && !isNaN(settings.qrCodeSize) ? settings.qrCodeSize : 120;

  const cardTypeX = typeof settings.cardTypeX === 'number' && !isNaN(settings.cardTypeX) ? settings.cardTypeX : 50;
  const cardTypeY = typeof settings.cardTypeY === 'number' && !isNaN(settings.cardTypeY) ? settings.cardTypeY : 15;
  const cardTypeSize = typeof settings.cardTypeSize === 'number' && !isNaN(settings.cardTypeSize) ? settings.cardTypeSize : 14;

  // Render overlay items (Guest Name, QR Code, and Card Type Badge)
  const renderOverlays = () => {
    const baseW = settings.orientation === 'landscape' ? 600 : 450;
    const scale = w / baseW;
    // 1. Draw Dynamic Guest Name
    ctx.save();
    const nameX = (guestNameX / 100) * w;
    const nameY = (guestNameY / 100) * h;
    ctx.fillStyle = settings.guestNameColor || settings.textColor || '#d97706';
    ctx.font = `bold ${(guestNameSize || 32) * scale}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(guestName || 'MGENI WA HESHIMA / GUEST NAME', nameX, nameY);
    ctx.restore();

    // 2. Draw Dynamic Card Type Badge at relative coordinates
    if (cardType) {
      ctx.save();
      const badgeX = (cardTypeX / 100) * w;
      const badgeY = (cardTypeY / 100) * h;
      
      const badgeText = cardType.toUpperCase();
      ctx.font = `bold ${(cardTypeSize || 13) * scale}px "${settings.fontFamily || 'Inter'}", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Calculate dimensions of the text for background pill
      const textMetrics = ctx.measureText(badgeText);
      const textWidth = textMetrics.width;
      const paddingH = 12 * scale;
      const paddingV = 6 * scale;
      const rectW = textWidth + paddingH * 2;
      const rectH = ((cardTypeSize || 13) * scale) + paddingV * 2;
      
      // Draw background pill - fallback to warm gold/amber
      const badgeBg = settings.cardTypeColor || '#fbbf24';
      ctx.fillStyle = badgeBg;
      const rx = badgeX - rectW / 2;
      const ry = badgeY - rectH / 2;
      const radius = rectH / 2;
      
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(rx, ry, rectW, rectH, radius) : ctx.rect(rx, ry, rectW, rectH);
      ctx.fill();
      
      // Draw text in high contrast color (dark charcoal if badge is light, otherwise white)
      ctx.fillStyle = isLightColor(badgeBg) ? '#121824' : '#ffffff';
      ctx.fillText(badgeText, badgeX, badgeY);
      ctx.restore();
    }

    // 3. Draw QR Code at relative coordinates
    const qrX = (qrCodeX / 100) * w;
    const qrY = (qrCodeY / 100) * h;
    const qrSize = (qrCodeSize || 100) * scale;

    const cachedQR = qrCache.get(qrCodeText || 'EVENTCARD');
    if (cachedQR) {
      ctx.save();
      // Draw a subtle border frame behind the QR to make it stand out on complex backgrounds
      ctx.fillStyle = '#ffffff'; // Always white background for QR code scan longevity
      ctx.beginPath();
      // Round corners for the QR white board
      const padding = 6 * scale;
      ctx.roundRect ? ctx.roundRect(qrX - qrSize / 2 - padding, qrY - qrSize / 2 - padding, qrSize + padding * 2, qrSize + padding * 2, 8 * scale) : ctx.rect(qrX - qrSize / 2 - padding, qrY - qrSize / 2 - padding, qrSize + padding * 2, qrSize + padding * 2);
      ctx.fill();
      
      // Draw the QR Image
      ctx.drawImage(cachedQR, qrX - qrSize / 2, qrY - qrSize / 2, qrSize, qrSize);
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      const padding = 6 * scale;
      ctx.roundRect ? ctx.roundRect(qrX - qrSize / 2 - padding, qrY - qrSize / 2 - padding, qrSize + padding * 2, qrSize + padding * 2, 8 * scale) : ctx.rect(qrX - qrSize / 2 - padding, qrY - qrSize / 2 - padding, qrSize + padding * 2, qrSize + padding * 2);
      ctx.fill();

      // Placeholder text in black/gray
      ctx.fillStyle = '#1e293b';
      ctx.font = `${9 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SCAN PASS', qrX, qrY);
      ctx.restore();

      // Trigger asynchronous generation and cache it. Once loaded, it calls drawing again.
      getOrCreateQRImage(qrCodeText, () => {
        drawCardToCanvas(canvas, event, settings, guestName, cardType, qrCodeText, onImageLoaded);
      });
    }
  };

  // Check if image is a custom Base64 uploaded or dynamic web image URL
  const isWebImage = settings.imageUrl && (
    settings.imageUrl.startsWith('data:') || 
    settings.imageUrl.startsWith('http://') || 
    settings.imageUrl.startsWith('https://') || 
    settings.imageUrl.startsWith('/')
  );

  if (isWebImage) {
    const src = settings.imageUrl!;
    const cachedImg = imageCache.get(src);
    
    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      // Draw synchronously immediately! This prevents flickering and lag
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(cachedImg, 0, 0, w, h);
      renderOverlays();
      if (onImageLoaded) onImageLoaded();
    } else {
      const img = cachedImg || new Image();
      if (!cachedImg) {
        img.crossOrigin = 'anonymous';
        imageCache.set(src, img);
      }
      
      img.onload = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        renderOverlays();
        if (onImageLoaded) onImageLoaded();
      };
      img.onerror = () => {
        // Background color design fallback
        ctx.fillStyle = '#FAF8F5';
        ctx.fillRect(0, 0, w, h);
        renderOverlays();
        if (onImageLoaded) onImageLoaded();
      };
      
      if (!cachedImg) {
        img.src = src;
      }
    }
  } else {
    // 1. Clear & draw background color
    ctx.fillStyle = settings.imageUrl || '#FAF8F5';
    ctx.fillRect(0, 0, w, h);

    // 2. Draw aesthetic borders & frame
    ctx.strokeStyle = settings.textColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(15, 15, w - 30, h - 30);
    
    ctx.strokeStyle = settings.textColor + '40'; // semi-transparent
    ctx.lineWidth = 1;
    ctx.strokeRect(25, 25, w - 50, h - 50);
    
    // 3. Draw simple decorative background shapes depending on event type
    ctx.fillStyle = settings.textColor + '08';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 4. Draw Header/Header Quote
    ctx.fillStyle = settings.textColor;
    ctx.textAlign = 'center';
    ctx.font = `italic 300 ${h * 0.024}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.fillText("Mwaliko wa Kipekee", w / 2, h * 0.07);

    // 5. Draw Sender ID & Title
    ctx.font = `bold ${h * 0.052}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.fillText(event.senderId || 'SEND OFF', w / 2, h * 0.15);

    // Decorator line
    ctx.strokeStyle = settings.textColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 60, h * 0.18);
    ctx.lineTo(w / 2 + 60, h * 0.18);
    ctx.stroke();

    // 6. Draw Content & Host Name
    ctx.font = `500 ${h * 0.026}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.fillText("Familia ya", w / 2, h * 0.23);
    
    ctx.font = `bold ${h * 0.038}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    const hostWords = (event.hostName || "Ndugu, Jamaa na Marafiki").split(' ');
    if (hostWords.length > 3) {
      const half = Math.ceil(hostWords.length / 2);
      ctx.fillText(hostWords.slice(0, half).join(' '), w / 2, h * 0.28);
      ctx.fillText(hostWords.slice(half).join(' '), w / 2, h * 0.33);
    } else {
      ctx.fillText(event.hostName || "Ndugu, Jamaa na Marafiki", w / 2, h * 0.29);
    }

    ctx.font = `500 ${h * 0.024}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.fillText("Inakukaribisha katika sherehe ya", w / 2, h * 0.38);

    ctx.font = `bold italic ${h * 0.046}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.fillText(event.name || "[Jina la Sherehe / Event Name]", w / 2, h * 0.44);

    // 7. Event Meta Info Panel (Time, Date, Place)
    ctx.font = `bold ${h * 0.024}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.fillStyle = settings.textColor;
    ctx.fillText(`TAREHE: ${event.date || 'DD/MM/YYYY'}`, w / 2, h * 0.52);
    ctx.fillText(`SAA: ${event.time || '12:00'} ${event.period || ''}`, w / 2, h * 0.56);
    ctx.fillText(`UKUMBI: ${event.eventHallName || '[Jina la Ukumbi / Venue]'}`, w / 2, h * 0.60);
    
    if (event.dressCode) {
      ctx.font = `italic ${h * 0.022}px "${settings.fontFamily || 'Inter'}", sans-serif`;
      ctx.fillText(`Mavazi (Dress Code): ${event.dressCode}`, w / 2, h * 0.64);
    }

    renderOverlays();

    // 11. Core Footer
    ctx.fillStyle = settings.textColor + 'C0';
    ctx.font = `${h * 0.018}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.fillText("Mwasiliano ya Maswali au RSVPs:", w / 2, h * 0.94);
    const contactText = [event.contact1, event.contact2].filter(Boolean).join('  /  ');
    ctx.fillText(contactText || "0755 000 111 / 0713 222 333", w / 2, h * 0.975);

    if (onImageLoaded) onImageLoaded();
  }
}

export function ensureAssetsLoaded(
  settings: TemplateSettings,
  qrCodeText: string,
  callback: () => void
) {
  let bgLoaded = false;
  let qrLoaded = false;

  const checkDone = () => {
    if (bgLoaded && qrLoaded) {
      callback();
    }
  };

  const isWebImage = settings.imageUrl && (
    settings.imageUrl.startsWith('data:') || 
    settings.imageUrl.startsWith('http://') || 
    settings.imageUrl.startsWith('https://') || 
    settings.imageUrl.startsWith('/')
  );

  if (isWebImage) {
    const src = settings.imageUrl!;
    const cachedImg = imageCache.get(src);
    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      bgLoaded = true;
      checkDone();
    } else {
      const img = cachedImg || new Image();
      if (!cachedImg) {
        img.crossOrigin = 'anonymous';
        imageCache.set(src, img);
      }
      img.onload = () => {
        bgLoaded = true;
        checkDone();
      };
      img.onerror = () => {
        bgLoaded = true;
        checkDone();
      };
      if (!cachedImg) {
        img.src = src;
      }
    }
  } else {
    bgLoaded = true;
    checkDone();
  }

  getOrCreateQRImage(qrCodeText, () => {
    qrLoaded = true;
    checkDone();
  });
}

export async function generateGuestCardImage(
  event: EventDetails,
  settings: TemplateSettings,
  guestName: string,
  cardType: string,
  qrCodeText: string
): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const isLandscape = settings.orientation === 'landscape';
    canvas.width = isLandscape ? 1200 : 900;
    canvas.height = isLandscape ? 900 : 1200;

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn("[canvasHelper] Card image generation timed out, falling back to raw settings image");
        resolve(settings.imageUrl || "");
      }
    }, 5000); // 5 second safety fallback timeout

    ensureAssetsLoaded(settings, qrCodeText, () => {
      drawCardToCanvas(
        canvas,
        event,
        settings,
        guestName,
        cardType,
        qrCodeText,
        () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            try {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
              resolve(dataUrl);
            } catch (e) {
              console.error("[canvasHelper] Error exporting canvas to dataUrl", e);
              resolve(settings.imageUrl || "");
            }
          }
        }
      );
    });
  });
}

