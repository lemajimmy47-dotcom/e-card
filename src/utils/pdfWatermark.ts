export async function compressElementOrUrlForPdf(
  inputSrc: string | HTMLImageElement,
  maxDim = 2400,
  preferPng = true
): Promise<{ dataUrl: string; format: string; w: number; h: number }> {
  return new Promise((resolve) => {
    const processImage = (img: HTMLImageElement) => {
      const origW = img.naturalWidth || img.width || 500;
      const origH = img.naturalHeight || img.height || 500;

      // Upscale/preserve high DPI (target minimum 1800px to 2400px for crisp vector-like printing)
      const targetMax = Math.max(maxDim, 2000);
      let targetW = origW;
      let targetH = origH;

      if (origW < targetMax && origH < targetMax) {
        const scale = targetMax / Math.max(origW, origH);
        targetW = Math.round(origW * scale);
        targetH = Math.round(origH * scale);
      } else if (targetW > targetMax || targetH > targetMax) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * targetMax) / targetW);
          targetW = targetMax;
        } else {
          targetW = Math.round((targetW * targetMax) / targetH);
          targetH = targetMax;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const dataUrl = canvas.toDataURL('image/png');
        resolve({ dataUrl, format: 'PNG', w: targetW, h: targetH });
      } else {
        const srcStr = typeof inputSrc === 'string' ? inputSrc : inputSrc.src;
        resolve({ dataUrl: srcStr, format: 'PNG', w: origW, h: origH });
      }
    };

    if (typeof inputSrc === 'string') {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => processImage(img);
      img.onerror = () => resolve({ dataUrl: inputSrc, format: 'PNG', w: maxDim, h: maxDim });
      img.src = inputSrc;
    } else if (inputSrc && inputSrc.complete && (inputSrc.naturalWidth > 0 || inputSrc.width > 0)) {
      processImage(inputSrc);
    } else if (inputSrc) {
      inputSrc.crossOrigin = 'Anonymous';
      inputSrc.onload = () => processImage(inputSrc);
      inputSrc.onerror = () => resolve({ dataUrl: inputSrc.src || '', format: 'PNG', w: maxDim, h: maxDim });
    } else {
      resolve({ dataUrl: '', format: 'PNG', w: maxDim, h: maxDim });
    }
  });
}

export async function addPdfWatermarks(doc: any, logoBase64Input?: string) {
  let logoB64 = logoBase64Input;
  let dims = { w: 500, h: 500 };

  if (!logoB64) {
    try {
      const res = await fetch('/logo.png');
      const blob = await res.blob();
      logoB64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Could not load logo for watermark:", e);
    }
  }

  if (!logoB64) return;

  // Process logo to HD high resolution transparent PNG (2400px max dimension for crisp PDF rendering)
  try {
    const compressed = await compressElementOrUrlForPdf(logoB64, 2400, true);
    logoB64 = compressed.dataUrl;
    dims = { w: compressed.w, h: compressed.h };
  } catch (e) {
    console.warn("Error processing watermark logo:", e);
  }

  const pageCount = typeof doc.internal.getNumberOfPages === 'function' 
    ? doc.internal.getNumberOfPages() 
    : (doc as any).internal.pages?.length - 1 || 1;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const aspect = dims.h > 0 ? dims.w / dims.h : 1;
  const cornerW = Math.min(26, pageWidth * 0.13); // mm
  const cornerH = cornerW / aspect;

  const centerW = Math.min(75, pageWidth * 0.36); // mm
  const centerH = centerW / aspect;

  const marginX = 8;
  const marginY = 8;

  // Reusable image alias so jsPDF stores image cleanly
  const alias = 'PDF_WATERMARK_LOGO_ALIAS_HD';

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    if (typeof doc.saveGraphicsState === 'function') doc.saveGraphicsState();
    if (typeof doc.setGState === 'function') {
      try {
        const GStateClass = (doc.constructor as any)?.GState || (doc as any)?.GState;
        const stateObj = { opacity: 0.18, 'fill-opacity': 0.18, 'stroke-opacity': 0.18 };
        if (GStateClass) {
          doc.setGState(new GStateClass(stateObj));
        } else {
          doc.setGState(stateObj as any);
        }
      } catch (e) {}
    }

    try {
      const format = logoB64.includes('image/png') ? 'PNG' : 'JPEG';
      // 1. Top Left
      doc.addImage(logoB64, format, marginX, marginY, cornerW, cornerH, alias, 'NONE');
      // 2. Top Right
      doc.addImage(logoB64, format, pageWidth - marginX - cornerW, marginY, cornerW, cornerH, alias, 'NONE');
      // 3. Bottom Left
      doc.addImage(logoB64, format, marginX, pageHeight - marginY - cornerH, cornerW, cornerH, alias, 'NONE');
      // 4. Bottom Right
      doc.addImage(logoB64, format, pageWidth - marginX - cornerW, pageHeight - marginY - cornerH, cornerW, cornerH, alias, 'NONE');
      // 5. Center
      doc.addImage(logoB64, format, (pageWidth - centerW) / 2, (pageHeight - centerH) / 2, centerW, centerH, alias, 'NONE');
    } catch (err) {
      console.warn("Could not draw watermark on PDF page", i, err);
    }

    if (typeof doc.restoreGraphicsState === 'function') doc.restoreGraphicsState();
  }
}
