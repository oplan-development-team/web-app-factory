import type { Segment, SegmentKind } from '../diff/types';
import { tokenize } from '../diff/tokenize';
import { seedFromString } from '../render/sketch';

/**
 * Self-contained Canvas 2D re-implementation of the proof sheet, used only
 * for PNG export. It intentionally does NOT snapshot the live DOM/SVG
 * (e.g. via html2canvas or an SVG <foreignObject> trick) — both routes are
 * either a banned dependency or trigger canvas tainting in Chromium when a
 * foreignObject is drawn to an <img>. Instead it re-derives a simplified
 * line-wrapped layout directly from the same Segment[] data and draws body
 * text, strikes, loops, carets, ruby corrections and move arrows by hand.
 */

const PAPER = '#f2ebda';
const INK = '#1c1a17';
const VERMILLION = '#b8382a';
const RULE = 'rgba(28,26,23,0.14)';

const BODY_FONT_SIZE = 18;
const HAND_FONT_SIZE = 15;
const LINE_HEIGHT = 48;
const PAD_X = 48;
const PAD_TOP = 76;
const PAD_BOTTOM = 56;

interface DrawUnit {
  text: string;
  kind: SegmentKind;
  segId: string;
  correctionText?: string;
  isRubyStart?: boolean;
  isSegEnd?: boolean;
  moveId?: string;
  line: number;
  x: number;
  w: number;
}

function bodyFont(): string {
  return `${BODY_FONT_SIZE}px "Shippori Mincho", serif`;
}
function handFont(): string {
  return `${HAND_FONT_SIZE}px "Klee One", "Kalam", cursive`;
}

function flattenToUnits(segments: Segment[]): Omit<DrawUnit, 'line' | 'x' | 'w'>[] {
  const out: Omit<DrawUnit, 'line' | 'x' | 'w'>[] = [];
  for (const seg of segments) {
    if (seg.kind === 'insert') {
      out.push({ text: '', kind: seg.kind, segId: seg.id, correctionText: seg.correctionText, isRubyStart: true });
      continue;
    }
    const chars = tokenize(seg.text, 'char');
    chars.forEach((tok, i) => {
      out.push({
        text: tok.text,
        kind: seg.kind,
        segId: seg.id,
        moveId: seg.moveId,
        correctionText: i === 0 ? seg.correctionText : undefined,
        isRubyStart: i === 0 && seg.kind === 'replace',
        isSegEnd: i === chars.length - 1,
      });
    });
  }
  return out;
}

function wrapUnits(
  ctx: CanvasRenderingContext2D,
  units: Omit<DrawUnit, 'line' | 'x' | 'w'>[],
  contentWidth: number,
): { placed: DrawUnit[]; lineCount: number } {
  ctx.font = bodyFont();
  const placed: DrawUnit[] = [];
  let line = 0;
  let x = 0;
  for (const u of units) {
    const w = u.text.length ? ctx.measureText(u.text).width : 0;
    if (x + w > contentWidth && x > 0) {
      line += 1;
      x = 0;
    }
    // hard line breaks in the source text
    if (u.text === '\n') {
      placed.push({ ...u, text: '', line, x, w: 0 });
      line += 1;
      x = 0;
      continue;
    }
    placed.push({ ...u, line, x, w });
    x += w;
  }
  return { placed, lineCount: line + 1 };
}

function drawWavyLine(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, seed: number) {
  const phase = seed * Math.PI * 2;
  ctx.beginPath();
  const steps = Math.max(2, Math.round((x2 - x1) / 10));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y + Math.sin(t * 9 + phase) * 1.1;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function drawLoop(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy + 2);
  ctx.bezierCurveTo(cx - 6, cy - 8, cx + 6, cy - 9, cx + 7, cy - 1);
  ctx.bezierCurveTo(cx + 8, cy + 6, cx - 1, cy + 9, cx - 5, cy + 4);
  ctx.bezierCurveTo(cx - 7, cy + 1, cx - 2, cy - 2, cx + 3, cy - 1);
  ctx.stroke();
}

function drawCaret(ctx: CanvasRenderingContext2D, x: number, tipY: number) {
  ctx.beginPath();
  ctx.moveTo(x - 6, tipY + 7);
  ctx.lineTo(x, tipY - 2);
  ctx.lineTo(x + 6, tipY + 7);
  ctx.stroke();
}

function drawLasso(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, seed: number) {
  ctx.beginPath();
  const start = -0.15;
  const end = Math.PI * 2 + 0.25;
  const turns = 24;
  for (let i = 0; i <= turns; i++) {
    const t = start + ((end - start) * i) / turns;
    const jitter = 1 + Math.sin(i * 12.9 + seed * 30) * 0.045;
    const x = cx + Math.cos(t) * rx * jitter;
    const y = cy + Math.sin(t) * ry * jitter;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, seed: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const bow = Math.min(50, Math.max(20, dist * 0.2)) * (seed > 0.5 ? 1 : -1);
  const mx = (x1 + x2) / 2 + nx * bow;
  const my = (y1 + y2) / 2 + ny * bow;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(mx, my, x2, y2);
  ctx.stroke();

  // arrowhead
  const tangentX = x2 - mx;
  const tangentY = y2 - my;
  const tLen = Math.hypot(tangentX, tangentY) || 1;
  const ux = tangentX / tLen;
  const uy = tangentY / tLen;
  const perpX = -uy;
  const perpY = ux;
  const headLen = 9;
  const headW = 5;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * headLen + perpX * headW, y2 - uy * headLen + perpY * headW);
  ctx.lineTo(x2 - ux * headLen - perpX * headW, y2 - uy * headLen - perpY * headW);
  ctx.closePath();
  ctx.fillStyle = VERMILLION;
  ctx.fill();
}

export async function exportManuscriptPNG(segments: Segment[], widthCss: number, filename: string): Promise<void> {
  await Promise.all([
    document.fonts.load(`${BODY_FONT_SIZE}px "Shippori Mincho"`),
    document.fonts.load(`${HAND_FONT_SIZE}px "Klee One"`),
    document.fonts.load(`12px "IBM Plex Mono"`),
  ]).catch(() => undefined);
  await document.fonts.ready;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) throw new Error('Canvas 2D context unavailable');

  const contentWidth = widthCss - PAD_X * 2;
  const units = flattenToUnits(segments);
  const { placed, lineCount } = wrapUnits(mctx, units, contentWidth);

  const heightCss = PAD_TOP + lineCount * LINE_HEIGHT + PAD_BOTTOM;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(widthCss * dpr);
  canvas.height = Math.round(heightCss * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.scale(dpr, dpr);

  // paper background
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, widthCss, heightCss);

  // faint grain
  ctx.fillStyle = 'rgba(28,26,23,0.035)';
  const grainSeed = seedFromString('grain');
  for (let i = 0; i < 900; i++) {
    const gx = ((Math.sin(i * 12.9898 + grainSeed) * 43758.5453) % 1) * widthCss;
    const gy = ((Math.sin(i * 78.233 + grainSeed) * 12543.789) % 1) * heightCss;
    ctx.fillRect(Math.abs(gx), Math.abs(gy), 1, 1);
  }

  // faint manuscript rule lines
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  for (let i = 0; i < lineCount; i++) {
    const y = PAD_TOP + i * LINE_HEIGHT + 8;
    ctx.beginPath();
    ctx.moveTo(PAD_X - 12, y);
    ctx.lineTo(widthCss - PAD_X + 12, y);
    ctx.stroke();
  }

  // group units by segment for post-pass marks (loop/lasso/arrow anchors)
  const segRects = new Map<string, { line: number; minX: number; maxX: number }[]>();
  for (const u of placed) {
    if (u.kind === 'equal') continue;
    const list = segRects.get(u.segId) ?? [];
    const last = list[list.length - 1];
    if (last && last.line === u.line) {
      last.maxX = Math.max(last.maxX, u.x + u.w);
    } else {
      list.push({ line: u.line, minX: u.x, maxX: u.x + u.w });
    }
    segRects.set(u.segId, list);
  }

  const lineY = (line: number) => PAD_TOP + line * LINE_HEIGHT;

  // pass 1: body text
  ctx.textBaseline = 'alphabetic';
  for (const u of placed) {
    if (!u.text) continue;
    const baseY = lineY(u.line) + BODY_FONT_SIZE * 0.85;
    ctx.font = bodyFont();
    ctx.fillStyle = u.kind === 'delete' || u.kind === 'replace' || u.kind === 'move-out' ? 'rgba(28,26,23,0.55)' : INK;
    ctx.fillText(u.text, PAD_X + u.x, baseY);
  }

  // pass 2: strikes
  ctx.strokeStyle = VERMILLION;
  ctx.lineWidth = 1.6;
  for (const [segId, rects] of segRects) {
    const seg = segments.find((s) => s.id === segId);
    if (!seg || (seg.kind !== 'delete' && seg.kind !== 'replace')) continue;
    rects.forEach((r, i) => {
      const y = lineY(r.line) + BODY_FONT_SIZE * 0.62;
      drawWavyLine(ctx, PAD_X + r.minX, y, PAD_X + r.maxX, seedFromString(`${segId}-${i}`));
    });
  }

  // pass 3: loop glyphs (delete)
  for (const [segId, rects] of segRects) {
    const seg = segments.find((s) => s.id === segId);
    if (!seg || seg.kind !== 'delete') continue;
    const last = rects[rects.length - 1];
    const y = lineY(last.line) + BODY_FONT_SIZE * 0.4;
    drawLoop(ctx, PAD_X + last.maxX + 10, y);
  }

  // pass 4: ruby corrections (replace) + insert carets/annotations
  ctx.font = handFont();
  ctx.fillStyle = VERMILLION;
  for (const seg of segments) {
    if (seg.kind === 'replace' && seg.correctionText) {
      const rects = segRects.get(seg.id);
      if (!rects || rects.length === 0) continue;
      const first = rects[0];
      const y = lineY(first.line) - 12;
      ctx.fillText(seg.correctionText, PAD_X + first.minX, y);
    }
  }

  const insertUnits = placed.filter((u) => u.kind === 'insert');
  for (const u of insertUnits) {
    const tipY = lineY(u.line) + BODY_FONT_SIZE * 0.85;
    ctx.strokeStyle = VERMILLION;
    ctx.lineWidth = 1.6;
    drawCaret(ctx, PAD_X + u.x, tipY);
    if (u.correctionText) {
      ctx.font = handFont();
      ctx.fillStyle = VERMILLION;
      ctx.fillText(u.correctionText, PAD_X + u.x - 4, lineY(u.line) - 12);
    }
  }

  // pass 5: move lassos + arrows
  const moveAnchors = new Map<string, { out?: { x: number; y: number }; in?: { x: number; y: number } }>();
  for (const [segId, rects] of segRects) {
    const seg = segments.find((s) => s.id === segId);
    if (!seg || (seg.kind !== 'move-out' && seg.kind !== 'move-in') || !seg.moveId) continue;
    const first = rects[0];
    const cx = PAD_X + (first.minX + first.maxX) / 2;
    const cy = lineY(first.line) + BODY_FONT_SIZE * 0.5;
    const rx = (first.maxX - first.minX) / 2 + 8;
    const ry = BODY_FONT_SIZE * 0.75;
    ctx.strokeStyle = VERMILLION;
    ctx.lineWidth = 1.4;
    drawLasso(ctx, cx, cy, rx, ry, seedFromString(segId));
    const entry = moveAnchors.get(seg.moveId) ?? {};
    if (seg.kind === 'move-out') entry.out = { x: cx, y: cy + ry + 6 };
    else entry.in = { x: cx, y: cy - ry - 6 };
    moveAnchors.set(seg.moveId, entry);
  }
  ctx.lineWidth = 1.6;
  for (const [moveId, { out, in: inn }] of moveAnchors) {
    if (!out || !inn) continue;
    ctx.strokeStyle = VERMILLION;
    drawArrow(ctx, out.x, out.y, inn.x, inn.y, seedFromString(moveId));
  }

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG generation failed');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
