import type { Segment, RecordingStats, SpecimenMeta } from '../types';
import { LITHOLOGY_BINS, UNCONFORMITY_STYLE } from '../strata/lithology';
import { paintLithologyBand, paintUnconformityBand } from '../strata/textures';

export const POSTER_W = 900;
export const POSTER_H = 1350;

const M = 50;
const LABEL_H = 176;
const GAP_LABEL_TO_COLUMN = 34;
const LEGEND_H = 196;
const GAP_COLUMN_TO_LEGEND = 28;

const COLUMN_TOP = M + LABEL_H + GAP_LABEL_TO_COLUMN;
const LEGEND_TOP = POSTER_H - M - LEGEND_H;
const COLUMN_BOTTOM = LEGEND_TOP - GAP_COLUMN_TO_LEGEND;
export const COLUMN_HEIGHT = COLUMN_BOTTOM - COLUMN_TOP;

const COLUMN_X = M + 62;
const COLUMN_W = 320;
const ANNOTATION_X = COLUMN_X + COLUMN_W + 42;

const INK = '#2b2a2e';
const INK_SOFT = 'rgba(43, 42, 46, 0.55)';
const UMBER = '#5c4a34';

const SLAB = '"Fraunces Variable", "Fraunces", Georgia, serif';
const SERIF = '"Source Serif 4 Variable", "Source Serif 4", Georgia, serif';
const MONO = '"IBM Plex Mono", "Courier New", monospace';

interface DrawArgs {
  segments: Segment[];
  stats: RecordingStats;
  meta: SpecimenMeta;
}

export function drawPoster(canvas: HTMLCanvasElement, args: DrawArgs, scale = 1): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = Math.round(POSTER_W * scale);
  canvas.height = Math.round(POSTER_H * scale);

  drawPaperTexture(ctx, canvas.width, canvas.height);

  ctx.save();
  ctx.scale(scale, scale);
  ctx.textBaseline = 'alphabetic';

  drawLabelCard(ctx, args.meta);
  drawDepthScale(ctx, args.segments);
  drawStrataColumn(ctx, args.segments);
  drawLeaderAnnotations(ctx, args.segments, args.stats);
  drawLegend(ctx);
  drawStatsStamp(ctx, args.stats);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Background: kraft-paper noise + fiber texture, drawn directly at device
// pixel resolution (before the vector-content scale transform) so grain
// stays fine regardless of export scale.
// ---------------------------------------------------------------------------
function drawPaperTexture(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#ede6d3';
  ctx.fillRect(0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  let seed = 0x9e3779b9;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 1000) / 1000;
  };
  for (let i = 0; i < data.length; i += 4) {
    const n = (rand() - 0.5) * 14;
    data[i] = clamp8(data[i] + n);
    data[i + 1] = clamp8(data[i + 1] + n);
    data[i + 2] = clamp8(data[i + 2] + n * 0.8);
  }
  ctx.putImageData(img, 0, 0);

  // Sparse long fiber strokes for a hand-felted paper feel.
  const fiberRand = mulberry32(7);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#5c4a34';
  ctx.lineWidth = Math.max(1, w / 900);
  for (let i = 0; i < 260; i++) {
    const x = fiberRand() * w;
    const y = fiberRand() * h;
    const len = (10 + fiberRand() * 40) * (w / 900);
    const angle = fiberRand() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();

  // Soft vignette toward the edges.
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(43,32,20,0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Specimen label card
// ---------------------------------------------------------------------------
function drawLabelCard(ctx: CanvasRenderingContext2D, meta: SpecimenMeta): void {
  const x = M;
  const y = M;
  const w = POSTER_W - M * 2;
  const h = LABEL_H;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = INK_SOFT;
  ctx.lineWidth = 0.75;
  ctx.strokeRect(x + 5.5, y + 5.5, w - 11, h - 11);

  // Kicker
  ctx.fillStyle = INK_SOFT;
  ctx.font = `600 11px ${MONO}`;
  ctx.textAlign = 'left';
  drawLetterSpaced(ctx, 'FIELD SPECIMEN CARD — 標本ラベル', x + 22, y + 34, 1.5);

  // Title, shrink-to-fit
  const title = meta.title || '無題の標本';
  let titleSize = 40;
  ctx.font = `italic 700 ${titleSize}px ${SLAB}`;
  const maxTitleWidth = w - 44 - 224;
  while (ctx.measureText(title).width > maxTitleWidth && titleSize > 20) {
    titleSize -= 1;
    ctx.font = `italic 700 ${titleSize}px ${SLAB}`;
  }
  ctx.fillStyle = INK;
  ctx.fillText(title, x + 22, y + 92);

  ctx.font = `500 12px ${MONO}`;
  ctx.fillStyle = INK_SOFT;
  drawLetterSpaced(ctx, 'VOICE CORE SAMPLE / ボーリングコア標本', x + 22, y + 116, 1.2);

  // Hairline above the meta row
  ctx.strokeStyle = INK_SOFT;
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(x + 22, y + h - 44);
  ctx.lineTo(x + w - 22, y + h - 44);
  ctx.stroke();

  ctx.font = `12px ${MONO}`;
  ctx.fillStyle = INK;
  ctx.fillText(`DATE  ${meta.dateLabel}`, x + 22, y + h - 20);
  const collectorText = `COLLECTOR  ${meta.collector || '匿名 / anonymous'}`;
  ctx.fillText(collectorText, x + 260, y + h - 20);

  // Specimen number stamp, rotated
  ctx.save();
  const sw = 214;
  const sh = 62;
  const stampCx = x + w - sw / 2 - 18;
  const stampCy = y + 58;
  ctx.translate(stampCx, stampCy);
  ctx.rotate((-3.5 * Math.PI) / 180);
  ctx.strokeStyle = '#8a2f2f';
  ctx.fillStyle = 'rgba(138,47,47,0.06)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, -sw / 2, -sh / 2, sw, sh, 4);
  ctx.fill();
  ctx.stroke();
  ctx.strokeRect(-sw / 2 + 5, -sh / 2 + 5, sw - 10, sh - 10);
  ctx.fillStyle = '#8a2f2f';
  ctx.font = `700 10px ${MONO}`;
  ctx.textAlign = 'center';
  drawLetterSpacedCentered(ctx, 'SPECIMEN NO.', 0, -sh / 2 + 22, 1.5);
  let numberSize = 16;
  ctx.font = `700 ${numberSize}px ${MONO}`;
  const maxNumberWidth = sw - 20;
  while (ctx.measureText(meta.specimenNumber).width > maxNumberWidth && numberSize > 10) {
    numberSize -= 1;
    ctx.font = `700 ${numberSize}px ${MONO}`;
  }
  ctx.fillText(meta.specimenNumber, 0, sh / 2 - 14);
  ctx.restore();

  ctx.restore();
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawLetterSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

function drawLetterSpacedCentered(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number) {
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  let totalWidth = 0;
  for (const ch of text) totalWidth += ctx.measureText(ch).width + spacing;
  let x = cx - totalWidth / 2;
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = prevAlign;
}

// ---------------------------------------------------------------------------
// Depth scale
// ---------------------------------------------------------------------------
function timeToY(segments: Segment[], t: number): number {
  for (const s of segments) {
    if (t >= s.startT && t <= s.endT) {
      const span = s.endT - s.startT || 0.001;
      return COLUMN_TOP + s.yPx + ((t - s.startT) / span) * s.thicknessPx;
    }
  }
  if (segments.length === 0) return COLUMN_TOP;
  return t < segments[0].startT ? COLUMN_TOP : COLUMN_TOP + COLUMN_HEIGHT;
}

function pickTickInterval(durationSec: number): number {
  if (durationSec <= 12) return 2;
  if (durationSec <= 30) return 5;
  if (durationSec <= 60) return 10;
  return 15;
}

function drawDepthScale(ctx: CanvasRenderingContext2D, segments: Segment[]): void {
  if (segments.length === 0) return;
  const duration = segments[segments.length - 1].endT;
  const interval = pickTickInterval(duration);

  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.font = `10px ${MONO}`;
  ctx.textAlign = 'right';

  ctx.beginPath();
  ctx.moveTo(COLUMN_X - 14, COLUMN_TOP);
  ctx.lineTo(COLUMN_X - 14, COLUMN_BOTTOM);
  ctx.lineWidth = 1;
  ctx.stroke();

  for (let t = 0; t <= duration + 0.001; t += interval) {
    const y = timeToY(segments, t);
    ctx.beginPath();
    ctx.moveTo(COLUMN_X - 20, y);
    ctx.lineTo(COLUMN_X - 14, y);
    ctx.stroke();
    ctx.fillText(`${Math.round(t)}s`, COLUMN_X - 24, y + 3.5);
  }

  ctx.save();
  ctx.translate(M + 14, (COLUMN_TOP + COLUMN_BOTTOM) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = `600 10px ${MONO}`;
  ctx.fillStyle = INK_SOFT;
  drawLetterSpacedCentered(ctx, 'ELAPSED TIME / 経過秒数', 0, 0, 1.5);
  ctx.restore();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Strata column
// ---------------------------------------------------------------------------
function drawStrataColumn(ctx: CanvasRenderingContext2D, segments: Segment[]): void {
  ctx.save();

  // Core cap notch top & bottom for an instrument-like frame.
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(COLUMN_X, COLUMN_TOP, COLUMN_W, COLUMN_HEIGHT);

  segments.forEach((seg, i) => {
    const rect = { x: COLUMN_X, y: COLUMN_TOP + seg.yPx, w: COLUMN_W, h: seg.thicknessPx };
    if (seg.kind === 'lithology' && seg.lithology) {
      paintLithologyBand(ctx, seg.lithology, rect, i * 7919 + 13, seg.jittery);
    } else {
      paintUnconformityBand(ctx, rect, i * 7919 + 13);
    }
  });

  // Boundary hairlines between beds.
  ctx.strokeStyle = INK_SOFT;
  ctx.lineWidth = 0.75;
  segments.forEach((seg) => {
    const y = COLUMN_TOP + seg.yPx;
    ctx.beginPath();
    ctx.moveTo(COLUMN_X, y);
    ctx.lineTo(COLUMN_X + COLUMN_W, y);
    ctx.stroke();
  });

  // Double-ruled outer border, core-sample style.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(COLUMN_X, COLUMN_TOP, COLUMN_W, COLUMN_HEIGHT);
  ctx.lineWidth = 0.75;
  ctx.strokeRect(COLUMN_X - 5, COLUMN_TOP - 5, COLUMN_W + 10, COLUMN_HEIGHT + 10);

  ctx.font = `600 10px ${MONO}`;
  ctx.fillStyle = INK_SOFT;
  ctx.textAlign = 'left';
  drawLetterSpaced(ctx, 'SURFACE / 地表', COLUMN_X, COLUMN_TOP - 12, 1.2);
  ctx.textAlign = 'right';
  ctx.save();
  ctx.textAlign = 'left';
  const bottomLabel = 'DEPTH / 深部';
  const bw = ctx.measureText(bottomLabel.replace(/ /g, '')).width;
  drawLetterSpaced(ctx, bottomLabel, COLUMN_X + COLUMN_W - bw - 40, COLUMN_BOTTOM + 22, 1.2);
  ctx.restore();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Leader-line annotations (museum panel style)
// ---------------------------------------------------------------------------
function drawLeaderAnnotations(ctx: CanvasRenderingContext2D, segments: Segment[], stats: RecordingStats): void {
  if (segments.length === 0) return;
  const duration = segments[segments.length - 1].endT;

  type Anno = { t: number; lines: string[] };
  const annos: Anno[] = [];

  annos.push({ t: 0.001, lines: ['地表 = 録音開始', 'SURFACE = REC START'] });

  const longestSilence = segments
    .filter((s) => s.kind === 'unconformity')
    .sort((a, b) => b.endT - b.startT - (a.endT - a.startT))[0];
  if (longestSilence) {
    const mid = (longestSilence.startT + longestSilence.endT) / 2;
    const secs = (longestSilence.endT - longestSilence.startT).toFixed(1);
    annos.push({ t: mid, lines: [`最長の間 ${secs}s`, 'LONGEST PAUSE'] });
  }

  if (stats.highestLithology) {
    const seg = segments.find((s) => s.kind === 'lithology' && s.lithology?.id === stats.highestLithology?.id);
    if (seg) {
      const mid = (seg.startT + seg.endT) / 2;
      annos.push({ t: mid, lines: [`最高音層: ${stats.highestLithology.name}`, stats.highestLithology.label] });
    }
  }

  annos.push({ t: duration - 0.001, lines: ['深部 = 録音終了', 'DEPTH = REC END'] });

  ctx.save();
  ctx.font = `11px ${SERIF}`;
  ctx.strokeStyle = UMBER;
  ctx.fillStyle = INK;
  ctx.lineWidth = 0.75;

  const usedY: number[] = [];
  annos.forEach((a) => {
    let y = timeToY(segments, Math.min(duration, Math.max(0, a.t)));
    // nudge to avoid overlapping labels
    for (const u of usedY) {
      if (Math.abs(u - y) < 34) y = u + 34;
    }
    usedY.push(y);
    y = Math.min(COLUMN_BOTTOM - 6, y);

    const anchorX = COLUMN_X + COLUMN_W;
    ctx.beginPath();
    ctx.arc(anchorX, Math.min(COLUMN_BOTTOM, Math.max(COLUMN_TOP, timeToY(segments, a.t))), 2.5, 0, Math.PI * 2);
    ctx.fillStyle = UMBER;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(anchorX, Math.min(COLUMN_BOTTOM, Math.max(COLUMN_TOP, timeToY(segments, a.t))));
    ctx.lineTo(ANNOTATION_X - 10, y);
    ctx.lineTo(ANNOTATION_X, y);
    ctx.stroke();

    ctx.fillStyle = INK;
    ctx.font = `italic 600 12px ${SLAB}`;
    ctx.textAlign = 'left';
    ctx.fillText(a.lines[0], ANNOTATION_X + 4, y - 3);
    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(a.lines[1], ANNOTATION_X + 4, y + 10);
  });

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------
function drawLegend(ctx: CanvasRenderingContext2D): void {
  const x = M;
  const y = LEGEND_TOP;
  const w = 560;
  const h = LEGEND_H;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.font = `italic 700 16px ${SLAB}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.fillText('岩相凡例', x + 18, y + 26);
  ctx.font = `9px ${MONO}`;
  ctx.fillStyle = INK_SOFT;
  drawLetterSpaced(ctx, 'LITHOLOGY KEY — PITCH BY BED', x + 90, y + 25, 1.2);

  const rows = [...LITHOLOGY_BINS, null];
  const cols = 2;
  const rowH = (h - 44) / 4;
  const colW = w / cols;

  rows.forEach((bin, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = x + 16 + col * colW;
    const cellY = y + 40 + row * rowH;

    const swatchSize = 26;
    if (bin) {
      paintLithologyBand(ctx, bin, { x: cellX, y: cellY, w: swatchSize, h: swatchSize }, i * 101 + 3, false);
      ctx.strokeStyle = INK_SOFT;
      ctx.lineWidth = 0.75;
      ctx.strokeRect(cellX, cellY, swatchSize, swatchSize);
    } else {
      paintUnconformityBand(ctx, { x: cellX, y: cellY, w: swatchSize, h: swatchSize }, 999);
    }

    ctx.textAlign = 'left';
    ctx.font = `600 12px ${SERIF}`;
    ctx.fillStyle = INK;
    const name = bin ? bin.name : UNCONFORMITY_STYLE.name;
    ctx.fillText(name, cellX + swatchSize + 10, cellY + 12);
    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = INK_SOFT;
    const label = bin ? bin.label : UNCONFORMITY_STYLE.label;
    ctx.fillText(label, cellX + swatchSize + 10, cellY + 24);
  });

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Stats stamp
// ---------------------------------------------------------------------------
function drawStatsStamp(ctx: CanvasRenderingContext2D, stats: RecordingStats): void {
  const x = M + 580;
  const y = LEGEND_TOP;
  const w = POSTER_W - M - x;
  const h = LEGEND_H;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((1.5 * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);

  ctx.strokeStyle = INK;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.25;
  ctx.strokeRect(0, 0, w, h);
  ctx.fillRect(0, 0, w, h);
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.font = `700 10px ${MONO}`;
  drawLetterSpaced(ctx, 'FIELD NOTES', 12, 20, 1.2);

  ctx.font = `9px ${MONO}`;
  const lines = [
    `DURATION   ${stats.durationSec.toFixed(1)}s`,
    `VOICED BEDS   ${stats.voicedSegmentCount}`,
    `SILENT BEDS   ${stats.silentSegmentCount}`,
    `LOUDEST   ${stats.loudestLithology ? stats.loudestLithology.name : '—'}`,
    `HIGHEST   ${stats.highestLithology ? stats.highestLithology.name : '—'}`,
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, 12, 42 + i * 17);
  });

  ctx.restore();
}
