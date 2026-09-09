import type { PlacedPoint, Settings, ViewMode } from '../types.ts';
import type { TemplateGeometry } from '../templates.ts';
import type { FieldResult } from './field.ts';
import { clamp255, hexToRgb, hslToRgb, rgbToHsl } from './colors.ts';
import { fbm2D } from './noise.ts';

export interface RenderInput {
  ctx: CanvasRenderingContext2D;
  canvasW: number;
  canvasH: number;
  geom: TemplateGeometry;
  field: FieldResult;
  cellBoundaryPath: Path2D;
  points: PlacedPoint[];
  settings: Settings;
  mode: ViewMode;
}

const VOID_STONE = '#0c0a08';

function hashAngle(id: number): number {
  const s = Math.sin(id * 12.9898) * 43758.5453;
  return (s - Math.floor(s)) * Math.PI;
}

function buildFillCanvas(field: FieldResult, points: PlacedPoint[], mode: ViewMode, glassNoise: number): HTMLCanvasElement {
  const { gridW, gridH, cellId } = field;
  const img = new ImageData(gridW, gridH);
  const data = img.data;

  for (let gy = 0; gy < gridH; gy++) {
    const cosCache: number[] = [];
    for (let gx = 0; gx < gridW; gx++) {
      const idx = gy * gridW + gx;
      const id = cellId[idx]!;
      const o = idx * 4;
      if (id < 0) {
        data[o + 3] = 0;
        continue;
      }
      const p = points[id]!;
      let [r, g, b] = hexToRgb(p.color);

      const angle = hashAngle(id);
      const ca = cosCache[id] ?? Math.cos(angle);
      cosCache[id] = ca;
      const sa = Math.sin(angle);
      const nx = gx * ca - gy * sa;
      const ny = gx * sa + gy * ca;
      // Stretched fbm => reamy streaks characteristic of hand-blown glass.
      const streak = fbm2D(nx * 0.05, ny * 0.22, id * 3.1 + 4, 3);
      const bubble = fbm2D(gx * 0.24, gy * 0.24, id * 7.7 + 91, 2);
      const bubbleBoost = bubble > 0.84 ? (bubble - 0.84) * 2.6 : 0;

      let lightness: number;
      if (mode === 'natural') {
        const [h, s, l] = rgbToHsl(r, g, b);
        const desat = Math.max(0, s * 0.5);
        const dark = Math.max(0, l * 0.8);
        [r, g, b] = hslToRgb(h, desat, dark);
        lightness = 1 + (streak - 0.5) * 0.16 * glassNoise;
      } else {
        lightness = 1 + (streak - 0.5) * 0.5 * glassNoise + bubbleBoost * glassNoise;
      }

      data[o] = clamp255(r * lightness);
      data[o + 1] = clamp255(g * lightness);
      data[o + 2] = clamp255(b * lightness);
      data[o + 3] = 255;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = gridW;
  canvas.height = gridH;
  const c = canvas.getContext('2d')!;
  c.putImageData(img, 0, 0);
  return canvas;
}

function strokeBeveled(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  width: number,
  opts: { highlight: string; shadowAlpha: number },
): void {
  if (width <= 0) return;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.strokeStyle = `rgba(4,3,2,${opts.shadowAlpha})`;
  ctx.lineWidth = width;
  ctx.stroke(path);

  ctx.strokeStyle = '#211b14';
  ctx.lineWidth = width * 0.82;
  ctx.stroke(path);

  const off = Math.max(0.6, width * 0.16);
  ctx.save();
  ctx.translate(-off * 0.7, -off * 0.7);
  ctx.strokeStyle = opts.highlight;
  ctx.lineWidth = Math.max(0.6, width * 0.3);
  ctx.stroke(path);
  ctx.restore();

  ctx.restore();
}

function applyChromaticAberration(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number): void {
  if (strength <= 0) return;
  const shift = Math.max(1, Math.round(strength * 3));
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const sd = src.data;
  const od = out.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const rx = Math.min(w - 1, x + shift);
      const bx = Math.max(0, x - shift);
      const ro = (y * w + rx) * 4;
      const bo = (y * w + bx) * 4;
      od[o] = sd[ro]!;
      od[o + 1] = sd[o + 1]!;
      od[o + 2] = sd[bo + 2]!;
      od[o + 3] = sd[o + 3]!;
    }
  }
  ctx.putImageData(out, 0, 0);
}

export function renderWindow(input: RenderInput): void {
  const { ctx, canvasW, canvasH, geom, field, cellBoundaryPath, points, settings, mode } = input;
  const isBacklight = mode === 'backlight';

  ctx.save();
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = VOID_STONE;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Ambient glow spilling from behind the window, drawn unclipped so it
  // bleeds softly past the silhouette into the surrounding darkness.
  if (isBacklight && points.length > 0) {
    const cx = geom.center.x;
    const cy = geom.center.y;
    const radius = Math.max(canvasW, canvasH) * 0.62;
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius);
    const a = 0.16 + settings.backlightIntensity * 0.34;
    glow.addColorStop(0, `rgba(255,232,178,${a})`);
    glow.addColorStop(0.4, `rgba(230,178,96,${a * 0.55})`);
    glow.addColorStop(1, 'rgba(20,16,12,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  ctx.save();
  ctx.clip(geom.path);

  // Base stone/void fill inside the silhouette (visible where no glass has
  // been placed yet).
  ctx.fillStyle = isBacklight ? '#241d14' : '#100e0b';
  ctx.fillRect(geom.bounds.left, geom.bounds.top, geom.bounds.right - geom.bounds.left, geom.bounds.bottom - geom.bounds.top);

  if (points.length > 0) {
    const fillCanvas = buildFillCanvas(field, points, mode, settings.glassNoise);
    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(fillCanvas, 0, 0, canvasW, canvasH);
    ctx.imageSmoothingEnabled = prevSmoothing;

    if (isBacklight) {
      const bloomAlpha = 0.18 + settings.backlightIntensity * 0.55;
      ctx.save();
      ctx.globalAlpha = bloomAlpha;
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = `blur(${6 + settings.backlightIntensity * 10}px)`;
      ctx.drawImage(fillCanvas, 0, 0, canvasW, canvasH);
      ctx.restore();
    }

    // Cell-to-cell lead lines (organic, warped by the distance field).
    const highlight = isBacklight ? 'rgba(226,193,110,0.6)' : 'rgba(180,146,88,0.28)';
    strokeBeveled(ctx, cellBoundaryPath, settings.leadThickness, {
      highlight,
      shadowAlpha: isBacklight ? 0.55 : 0.7,
    });
  }

  // Structural stonework: outer tracery + rose mullions, heavier than cell leads.
  const structuralHighlight = isBacklight ? 'rgba(232,201,124,0.7)' : 'rgba(184,147,90,0.32)';
  strokeBeveled(ctx, geom.structuralPath, settings.leadThickness * 1.9, {
    highlight: structuralHighlight,
    shadowAlpha: 0.8,
  });

  ctx.restore(); // undo clip

  if (isBacklight && points.length > 0) {
    applyChromaticAberration(ctx, canvasW, canvasH, settings.backlightIntensity * 0.5);
  }

  ctx.restore();
}
