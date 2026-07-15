/**
 * Client-side image compression per §4:
 * max edge 1280px, JPEG quality 0.8, via canvas.
 * The same compressed image goes to both the vision API (M4) and Storage.
 *
 * Accepts a File (from <input type="file" capture>), returns a base64 JPEG string.
 */
export async function compressImage(
  file: File,
  maxEdge = 1280,
  quality = 0.8
): Promise<string> {
  // Read file → HTMLImageElement
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  // Calculate target dimensions (preserve aspect ratio, cap longest edge)
  let { width, height } = img;
  const longestEdge = Math.max(width, height);
  if (longestEdge > maxEdge) {
    const scale = maxEdge / longestEdge;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  // Draw to canvas → export as JPEG
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}
