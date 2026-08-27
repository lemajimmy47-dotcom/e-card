/**
 * Converts a data URL of any format (specifically WebP) to JPEG format.
 * This is crucial because Meta's WhatsApp API does not support WebP uploads.
 */
export async function convertWebPToJpeg(dataUrl: string | null | undefined): Promise<string> {
  if (!dataUrl) return "";
  if (!dataUrl.startsWith("data:image/webp")) return dataUrl;
  
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.95));
      } catch (err) {
        console.error("Failed to convert webp to jpeg via canvas:", err);
        resolve(dataUrl); // fallback to original webp on error
      }
    };
    img.onerror = () => {
      resolve(dataUrl); // fallback
    };
    img.src = dataUrl;
  });
}
