// Poster composition + export (PNG via offscreen Canvas, SVG via string
// template). The poster deliberately uses a completely different visual
// language from the on-screen control panel: ivory "lab record" paper,
// monochrome ink, a single accent color, technical-drawing framing.

import type { Particle } from './particles';
import type { PlateShape } from './chladni';
import { extractNodeLines } from './marchingSquares';

export interface PosterInfo {
  n: number;
  m: number;
  shape: PlateShape;
  sizeMm: number;
  frequencyHz: number;
  serial: string;
  timestamp: string;
  approxNote: string;
}

const POSTER_W = 1240;
const POSTER_H = 1660;
const MARGIN = 72;
const INK = '#1c1a16';
const ACCENT = '#c1442a';
const PAPER = '#f3efe3';

function drawPaperTexture(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * POSTER_W;
    const y = Math.random() * POSTER_H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.random() * 2 - 1, y + Math.random() * 2 - 1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFrame(ctx: CanvasRenderingContext2D, info: PosterInfo) {
  // paper base
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  drawPaperTexture(ctx);

  // outer + inner rule (technical-drawing double border)
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(MARGIN, MARGIN, POSTER_W - MARGIN * 2, POSTER_H - MARGIN * 2);
  ctx.lineWidth = 1;
  ctx.strokeRect(MARGIN + 10, MARGIN + 10, POSTER_W - (MARGIN + 10) * 2, POSTER_H - (MARGIN + 10) * 2);

  // header
  const headX = MARGIN + 38;
  let headY = MARGIN + 62;
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 26px "Space Grotesk", sans-serif';
  ctx.fillText('CYMATICS EXPERIMENT RECORD', headX, headY);

  headY += 26;
  ctx.font = '400 13px "JetBrains Mono", monospace';
  ctx.fillStyle = ACCENT;
  ctx.fillText('CHLADNI PLATE VIBRATION MODE — VISUAL FIELD OBSERVATION', headX, headY);

  // serial block, right aligned
  ctx.textAlign = 'right';
  ctx.font = '400 12px "JetBrains Mono", monospace';
  ctx.fillStyle = INK;
  ctx.fillText(`NO. ${info.serial}`, POSTER_W - MARGIN - 38, MARGIN + 50);
  ctx.fillText(info.timestamp, POSTER_W - MARGIN - 38, MARGIN + 68);
  ctx.textAlign = 'left';

  // rule under header
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN + 30, MARGIN + 92);
  ctx.lineTo(POSTER_W - MARGIN - 30, MARGIN + 92);
  ctx.stroke();
}

function drawDataPlate(ctx: CanvasRenderingContext2D, info: PosterInfo, top: number) {
  const left = MARGIN + 38;
  const right = POSTER_W - MARGIN - 38;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.stroke();

  const fields: [string, string][] = [
    ['MODE (n, m)', `${info.n} , ${info.m}`],
    ['FREQUENCY', `${info.frequencyHz.toFixed(1)} Hz  (f = k·√(n²+m²))`],
    ['PLATE', `${info.shape === 'square' ? 'SQUARE' : 'CIRCLE'} — ${info.sizeMm} mm`],
    ['METHOD', info.approxNote],
  ];

  const colW = (right - left) / 2;
  ctx.font = '400 11px "JetBrains Mono", monospace';
  fields.forEach(([label, value], idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = left + col * colW;
    const y = top + 34 + row * 46;
    ctx.fillStyle = ACCENT;
    ctx.fillText(label, x, y);
    ctx.fillStyle = INK;
    ctx.font = '500 15px "JetBrains Mono", monospace';
    ctx.fillText(value, x, y + 20);
    ctx.font = '400 11px "JetBrains Mono", monospace';
  });
}

/**
 * Draws the full poster (frame + node pattern rendered from live particle
 * positions + data plate) onto the given canvas at POSTER_W x POSTER_H
 * logical pixels (caller may pre-scale the context for higher resolution
 * export).
 */
export function composePoster(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  info: PosterInfo
): void {
  drawFrame(ctx, info);

  const plateTop = MARGIN + 118;
  const plateSize = POSTER_W - MARGIN * 2 - 76;
  const plateLeft = (POSTER_W - plateSize) / 2;

  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  if (info.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(plateLeft + plateSize / 2, plateTop + plateSize / 2, plateSize / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.clip();
  } else {
    ctx.strokeRect(plateLeft, plateTop, plateSize, plateSize);
    ctx.beginPath();
    ctx.rect(plateLeft, plateTop, plateSize, plateSize);
    ctx.clip();
  }

  // fillRect per grain is significantly cheaper than beginPath+arc+fill at
  // poster resolution (thousands of grains on a multi-megapixel canvas) and
  // is visually indistinguishable at this dot size.
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.78;
  const dot = 2.1;
  for (const p of particles) {
    const px = plateLeft + ((p.x + 1) / 2) * plateSize;
    const py = plateTop + ((p.y + 1) / 2) * plateSize;
    ctx.fillRect(px - dot / 2, py - dot / 2, dot, dot);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawDataPlate(ctx, info, plateTop + plateSize + 34);

  // footer
  ctx.font = '400 10px "JetBrains Mono", monospace';
  ctx.fillStyle = ACCENT;
  ctx.fillText(
    'GENERATED — CHLADNI POSTER LAB — SIMULATED PARTICLE FIELD, NOT A PHYSICAL MEASUREMENT',
    MARGIN + 38,
    POSTER_H - MARGIN - 30
  );
}

// Triggering `<a download>` via a synthetic click only reliably starts a
// download in every browser/automation context if the anchor is actually
// attached to the document while clicked, and the object URL is revoked
// slightly after the click (revoking immediately can race the download
// start in some engines).
function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Renders the poster to an offscreen canvas and triggers a PNG download.
 * Returns a promise that resolves only once the (potentially slow, for a
 * multi-megapixel canvas) encode + download-trigger has actually happened,
 * so callers can keep a "processing" state visible for the full duration
 * instead of reporting success prematurely.
 */
export function downloadPng(particles: Particle[], info: PosterInfo, scale = 2): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_W * scale;
  canvas.height = POSTER_H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas 2D context unavailable'));
  ctx.scale(scale, scale);
  composePoster(ctx, particles, info);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNG encoding failed'));
        return;
      }
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `chladni-${info.serial}.png`);
      resolve();
    }, 'image/png');
  });
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function downloadSvg(info: PosterInfo): void {
  const plateTop = MARGIN + 118;
  const plateSize = POSTER_W - MARGIN * 2 - 76;
  const plateLeft = (POSTER_W - plateSize) / 2;

  const segments = extractNodeLines(info.n, info.m, info.shape, 160);
  const toPx = (v: number) => ((v + 1) / 2) * plateSize;

  const paths = segments
    .map((s) => {
      const x1 = plateLeft + toPx(s.x1);
      const y1 = plateTop + toPx(s.y1);
      const x2 = plateLeft + toPx(s.x2);
      const y2 = plateTop + toPx(s.y2);
      return `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`;
    })
    .join(' ');

  const clipShape =
    info.shape === 'circle'
      ? `<circle cx="${plateLeft + plateSize / 2}" cy="${plateTop + plateSize / 2}" r="${plateSize / 2}" />`
      : `<rect x="${plateLeft}" y="${plateTop}" width="${plateSize}" height="${plateSize}" />`;

  const fields: [string, string][] = [
    ['MODE (n, m)', `${info.n} , ${info.m}`],
    ['FREQUENCY', `${info.frequencyHz.toFixed(1)} Hz  (f = k sqrt(n^2+m^2))`],
    ['PLATE', `${info.shape === 'square' ? 'SQUARE' : 'CIRCLE'} - ${info.sizeMm} mm`],
    ['METHOD', info.approxNote],
  ];
  const left = MARGIN + 38;
  const right = POSTER_W - MARGIN - 38;
  const colW = (right - left) / 2;
  const dataTop = plateTop + plateSize + 34;

  const fieldSvg = fields
    .map(([label, value], idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = left + col * colW;
      const y = dataTop + 34 + row * 46;
      return `
        <text x="${x}" y="${y}" font-family="JetBrains Mono, monospace" font-size="11" fill="${ACCENT}">${escapeXml(label)}</text>
        <text x="${x}" y="${y + 20}" font-family="JetBrains Mono, monospace" font-size="15" font-weight="500" fill="${INK}">${escapeXml(value)}</text>`;
    })
    .join('');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_W}" height="${POSTER_H}" viewBox="0 0 ${POSTER_W} ${POSTER_H}">
  <rect width="${POSTER_W}" height="${POSTER_H}" fill="${PAPER}" />
  <rect x="${MARGIN}" y="${MARGIN}" width="${POSTER_W - MARGIN * 2}" height="${POSTER_H - MARGIN * 2}" fill="none" stroke="${INK}" stroke-width="2" />
  <rect x="${MARGIN + 10}" y="${MARGIN + 10}" width="${POSTER_W - (MARGIN + 10) * 2}" height="${POSTER_H - (MARGIN + 10) * 2}" fill="none" stroke="${INK}" stroke-width="1" />
  <text x="${MARGIN + 38}" y="${MARGIN + 62}" font-family="Space Grotesk, sans-serif" font-size="26" font-weight="700" fill="${INK}">CYMATICS EXPERIMENT RECORD</text>
  <text x="${MARGIN + 38}" y="${MARGIN + 88}" font-family="JetBrains Mono, monospace" font-size="13" fill="${ACCENT}">CHLADNI PLATE VIBRATION MODE — VISUAL FIELD OBSERVATION</text>
  <text x="${POSTER_W - MARGIN - 38}" y="${MARGIN + 50}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="12" fill="${INK}">NO. ${escapeXml(info.serial)}</text>
  <text x="${POSTER_W - MARGIN - 38}" y="${MARGIN + 68}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="12" fill="${INK}">${escapeXml(info.timestamp)}</text>
  <line x1="${MARGIN + 30}" y1="${MARGIN + 92}" x2="${POSTER_W - MARGIN - 30}" y2="${MARGIN + 92}" stroke="${INK}" stroke-width="1" />
  <clipPath id="plate-clip">${clipShape}</clipPath>
  ${info.shape === 'circle'
    ? `<circle cx="${plateLeft + plateSize / 2}" cy="${plateTop + plateSize / 2}" r="${plateSize / 2}" fill="none" stroke="${INK}" stroke-width="1.5" />`
    : `<rect x="${plateLeft}" y="${plateTop}" width="${plateSize}" height="${plateSize}" fill="none" stroke="${INK}" stroke-width="1.5" />`}
  <g clip-path="url(#plate-clip)">
    <path d="${paths}" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round" />
  </g>
  <line x1="${left}" y1="${dataTop}" x2="${right}" y2="${dataTop}" stroke="${INK}" stroke-width="1" />
  ${fieldSvg}
  <text x="${MARGIN + 38}" y="${POSTER_H - MARGIN - 30}" font-family="JetBrains Mono, monospace" font-size="10" fill="${ACCENT}">GENERATED — CHLADNI POSTER LAB — VECTOR NODE-LINE EXTRACTION (MARCHING SQUARES)</text>
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `chladni-${info.serial}.svg`);
}

export function makeSerial(): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${y}${mo}${d}-${rand}`;
}

export function makeTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}
