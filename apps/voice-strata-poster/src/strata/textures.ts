import type { LithologyBin, TextureId } from '../types';

/** Deterministic PRNG (mulberry32) so a given segment always renders the same
 * texture whether drawn at preview scale or re-drawn at export resolution. */
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

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Fills the band's base color, then paints a lithology-specific procedural texture, clipped to the band rect. */
export function paintLithologyBand(
  ctx: CanvasRenderingContext2D,
  bin: LithologyBin,
  rect: Rect,
  seed: number,
  jittery: boolean
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  ctx.fillStyle = bin.color;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const rand = mulberry32(seed);

  if (jittery) {
    drawCrossLamina(ctx, rect, bin.accent, rand);
  } else {
    drawTextureFor(ctx, bin.id, rect, bin.accent, rand);
  }

  ctx.restore();
}

function drawTextureFor(ctx: CanvasRenderingContext2D, id: TextureId, rect: Rect, accent: string, rand: () => number) {
  switch (id) {
    case 'basalt':
      return drawSpeckle(ctx, rect, accent, rand, rect.w * rect.h > 0 ? Math.max(30, (rect.w * rect.h) / 90) : 30);
    case 'slate':
      return drawSharpBedding(ctx, rect, accent, rand);
    case 'shale':
      return drawFineLaminae(ctx, rect, accent, rand);
    case 'sandstone':
      return drawGranularStipple(ctx, rect, accent, rand);
    case 'limestone':
      return drawShellFleck(ctx, rect, accent, rand);
    case 'quartz':
      return drawCrystallineVein(ctx, rect, accent, rand);
  }
}

function drawSpeckle(ctx: CanvasRenderingContext2D, rect: Rect, accent: string, rand: () => number, count: number) {
  ctx.fillStyle = accent;
  const n = Math.min(400, Math.max(20, Math.round(count)));
  for (let i = 0; i < n; i++) {
    const x = rect.x + rand() * rect.w;
    const y = rect.y + rand() * rect.h;
    const r = 0.6 + rand() * 1.8;
    ctx.globalAlpha = 0.35 + rand() * 0.35;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSharpBedding(ctx: CanvasRenderingContext2D, rect: Rect, accent: string, rand: () => number) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(0.75, rect.h * 0.01);
  const lineCount = Math.max(2, Math.round(rect.h / 10));
  for (let i = 0; i < lineCount; i++) {
    const y = rect.y + (i + 0.5 + (rand() - 0.5) * 0.3) * (rect.h / lineCount);
    ctx.globalAlpha = 0.55 + rand() * 0.25;
    ctx.beginPath();
    ctx.moveTo(rect.x, y);
    ctx.lineTo(rect.x + rect.w, y + (rand() - 0.5) * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawFineLaminae(ctx: CanvasRenderingContext2D, rect: Rect, accent: string, rand: () => number) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(0.5, rect.h * 0.006);
  const lineCount = Math.max(4, Math.round(rect.h / 4.5));
  for (let i = 0; i < lineCount; i++) {
    const y = rect.y + (i + 0.5) * (rect.h / lineCount) + (rand() - 0.5) * 1.5;
    ctx.globalAlpha = 0.25 + rand() * 0.3;
    ctx.beginPath();
    ctx.moveTo(rect.x, y);
    ctx.lineTo(rect.x + rect.w, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawGranularStipple(ctx: CanvasRenderingContext2D, rect: Rect, accent: string, rand: () => number) {
  ctx.fillStyle = accent;
  const n = Math.max(60, Math.round((rect.w * rect.h) / 22));
  for (let i = 0; i < Math.min(700, n); i++) {
    const x = rect.x + rand() * rect.w;
    const y = rect.y + rand() * rect.h;
    const s = 0.8 + rand() * 1.4;
    ctx.globalAlpha = 0.3 + rand() * 0.3;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

function drawShellFleck(ctx: CanvasRenderingContext2D, rect: Rect, accent: string, rand: () => number) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 0.8;
  const n = Math.max(15, Math.round((rect.w * rect.h) / 260));
  for (let i = 0; i < Math.min(120, n); i++) {
    const x = rect.x + rand() * rect.w;
    const y = rect.y + rand() * rect.h;
    const r = 1.5 + rand() * 3;
    ctx.globalAlpha = 0.3 + rand() * 0.3;
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI * 0.15, Math.PI * 1.1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawCrystallineVein(ctx: CanvasRenderingContext2D, rect: Rect, accent: string, rand: () => number) {
  ctx.strokeStyle = accent;
  const veinCount = Math.max(2, Math.round(rect.h / 22));
  for (let i = 0; i < veinCount; i++) {
    ctx.lineWidth = 0.6 + rand() * 1.4;
    ctx.globalAlpha = 0.4 + rand() * 0.35;
    let x = rect.x + rand() * rect.w;
    let y = rect.y + rand() * rect.h * 0.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (y < rect.y + rect.h) {
      x += (rand() - 0.5) * rect.w * 0.35;
      x = Math.max(rect.x, Math.min(rect.x + rect.w, x));
      y += rect.h * (0.12 + rand() * 0.1);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Wavy cross-bedding lines: used to override a bin's normal texture when the
 * segment's pitch was unstable (vibrato-like), regardless of which lithology it is. */
function drawCrossLamina(ctx: CanvasRenderingContext2D, rect: Rect, accent: string, rand: () => number) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(0.6, rect.h * 0.008);
  const rowCount = Math.max(3, Math.round(rect.h / 9));
  for (let row = 0; row < rowCount; row++) {
    const baseY = rect.y + (row + 0.5) * (rect.h / rowCount);
    const amp = rect.h / rowCount / 2.6;
    const freq = 2 + rand() * 2;
    const phase = rand() * Math.PI * 2;
    ctx.globalAlpha = 0.4 + rand() * 0.3;
    ctx.beginPath();
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const x = rect.x + (i / steps) * rect.w;
      const y = baseY + Math.sin((i / steps) * Math.PI * freq + phase) * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Builds a jagged top/bottom boundary path for an unconformity (silence) band and fills it with hatching. */
export function paintUnconformityBand(ctx: CanvasRenderingContext2D, rect: Rect, seed: number): void {
  const rand = mulberry32(seed);
  const jag = Math.min(6, rect.h * 0.25);
  const path = new Path2D();
  const steps = Math.max(4, Math.round(rect.w / 18));

  path.moveTo(rect.x, rect.y);
  for (let i = 0; i <= steps; i++) {
    const x = rect.x + (i / steps) * rect.w;
    const y = rect.y + (rand() - 0.5) * jag;
    path.lineTo(x, y);
  }
  for (let i = steps; i >= 0; i--) {
    const x = rect.x + (i / steps) * rect.w;
    const y = rect.y + rect.h + (rand() - 0.5) * jag;
    path.lineTo(x, y);
  }
  path.closePath();

  ctx.save();
  ctx.fillStyle = '#8a7a64';
  ctx.fill(path);

  ctx.clip(path);
  ctx.strokeStyle = '#5c4a34';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  const gap = 7;
  for (let x = rect.x - rect.h; x < rect.x + rect.w + rect.h; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, rect.y - 2);
    ctx.lineTo(x + rect.h + 4, rect.y + rect.h + 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#5c4a34';
  ctx.lineWidth = 1.25;
  ctx.stroke(path);
  ctx.restore();
}
