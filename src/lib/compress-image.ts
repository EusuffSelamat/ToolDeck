/**
 * Client-side image compression per §4:
 * max edge 1280px, JPEG quality 0.8, via canvas.
 * The same compressed image goes to both the vision API (M4) and Storage.
 *
 * Uses createImageBitmap with imageOrientation: "from-image" to preserve
 * EXIF orientation — critical for phone cameras that encode portrait shots
 * as "rotate 90°" metadata. Falls back to Image + URL.createObjectURL for
 * older browsers (Safari < 15).
 *
 * Accepts a File (from <input type="file" capture>), returns a base64 JPEG string.
 */
export async function compressImage(
  file: File,
  maxEdge = 1280,
  quality = 0.8
): Promise<string> {
  // Use createImageBitmap (respects EXIF) where available
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      try {
        return drawAndExport(bitmap.width, bitmap.height, (ctx, w, h) =>
          ctx.drawImage(bitmap, 0, 0, w, h), maxEdge, quality
        );
      } finally {
        bitmap.close();
      }
    } catch {
      // Fall through to legacy path
    }
  }

  // Legacy path: Image + URL.createObjectURL (more memory-efficient than data URL)
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return drawAndExport(img.naturalWidth, img.naturalHeight, (ctx, w, h) =>
      ctx.drawImage(img, 0, 0, w, h), maxEdge, quality
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawAndExport(
  srcW: number,
  srcH: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  maxEdge: number,
  quality: number
): string {
  // Calculate target dimensions (preserve aspect ratio, cap longest edge)
  let width = srcW;
  let height = srcH;
  const longestEdge = Math.max(width, height);
  if (longestEdge > maxEdge) {
    const scale = maxEdge / longestEdge;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  draw(ctx, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}
