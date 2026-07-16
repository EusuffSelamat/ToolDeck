// One-off icon generator for TOOLDECK PWA (§10 brand).
// Renders maskable + any PNG icons from inline SVG via sharp.
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const OUT = join(process.cwd(), "public", "icons");
mkdirSync(OUT, { recursive: true });

const BG = "#030A0A";
const TEAL = "#19E3C4";
const TEAL_BRIGHT = "#6BFFE9";

// "any" icon: rounded-square bg + scan-frame monogram.
function anySvg(size: number) {
  const pad = size * 0.18;
  const frame = size - pad * 2;
  const cx = size / 2;
  const br = size * 0.22; // corner radius of bg
  const corner = frame * 0.18;
  const stroke = Math.max(2, size * 0.022);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="g" cx="50%" cy="35%" r="75%">
      <stop offset="0%" stop-color="#0E4F4A"/>
      <stop offset="100%" stop-color="${BG}"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${br}" ry="${br}" fill="url(#g)"/>
  <rect x="${pad}" y="${pad}" width="${frame}" height="${frame}" rx="${corner}" ry="${corner}" fill="none" stroke="${TEAL}" stroke-width="${stroke}"/>
  <rect x="${pad - stroke*1.6}" y="${pad - stroke*1.6}" width="${frame*0.16}" height="${frame*0.16}" fill="none" stroke="${TEAL_BRIGHT}" stroke-width="${stroke}"/>
  <rect x="${size - pad - frame*0.16 + stroke*1.6}" y="${size - pad - frame*0.16 + stroke*1.6}" width="${frame*0.16}" height="${frame*0.16}" fill="none" stroke="${TEAL_BRIGHT}" stroke-width="${stroke}"/>
  <text x="${cx}" y="${cx + size*0.085}" text-anchor="middle" font-family="Space Grotesk, Arial, sans-serif" font-weight="700" font-size="${size*0.30}" fill="${TEAL}">TD</text>
</svg>`;
}

// "maskable" icon: full-bleed bg + logo inside 80% safe zone.
function maskableSvg(size: number) {
  const safe = size * 0.8;
  const pad = (size - safe) / 2;
  const frame = safe * 0.72;
  const fpad = (safe - frame) / 2;
  const corner = frame * 0.18;
  const stroke = Math.max(2.5, size * 0.025);
  const cx = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="g2" cx="50%" cy="40%" r="80%">
      <stop offset="0%" stop-color="#0E4F4A"/>
      <stop offset="100%" stop-color="${BG}"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" fill="url(#g2)"/>
  <rect x="${pad + fpad}" y="${pad + fpad}" width="${frame}" height="${frame}" rx="${corner}" ry="${corner}" fill="none" stroke="${TEAL}" stroke-width="${stroke}"/>
  <text x="${cx}" y="${cx + size*0.07}" text-anchor="middle" font-family="Space Grotesk, Arial, sans-serif" font-weight="700" font-size="${size*0.26}" fill="${TEAL}">TD</text>
</svg>`;
}

async function gen(svg: string, file: string, size: number) {
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(join(OUT, file), buf);
  console.log("wrote", file, size + "px", buf.length, "bytes");
}

await gen(anySvg(192), "icon-192.png", 192);
await gen(anySvg(512), "icon-512.png", 512);
await gen(maskableSvg(192), "icon-192-maskable.png", 192);
await gen(maskableSvg(512), "icon-512-maskable.png", 512);
await gen(anySvg(180), "apple-touch-icon.png", 180);
console.log("done");
