/**
 * The prototype's renderer, kept verbatim as the benchmark baseline.
 *
 * Extracted from the app-factory prototype (commit 6db4bdc, `src/ribbon.ts`)
 * with only the pointer-handling class removed. The drawing maths — three
 * `shadowBlur` passes per segment onto a fixed 1800×2545 backing store — is
 * unchanged, including `lighten()` returning `rgb(...)`, which `hexToRgb` could
 * not parse and which therefore left the third pass reusing the previous stroke
 * style. Reproducing that faithfully matters: it is what the artwork actually
 * looked like when the prototype was approved.
 *
 * Not part of the shipped app; `dist/` never includes this directory.
 */

export interface LegacyPoint {
  x: number;
  y: number;
  t: number;
  speed: number;
}

export interface LegacyStroke {
  points: LegacyPoint[];
  color: string;
}

export const LEGACY_CANVAS_WIDTH = 1800;
export const LEGACY_CANVAS_HEIGHT = 2545;

const MAX_SPEED = 1.6;
const MIN_WIDTH = 5;
const MAX_WIDTH = 34;
const MIN_BLUR = 6;
const MAX_BLUR = 40;
const MIN_ALPHA = 0.38;
const MAX_ALPHA = 0.95;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (channel: number): number => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

interface SegmentStyle {
  lineWidth: number;
  strokeStyle: string;
  shadowBlur: number;
  shadowColor: string;
}

function strokeSegment(
  ctx: CanvasRenderingContext2D,
  from: LegacyPoint,
  to: LegacyPoint,
  style: SegmentStyle
): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.lineWidth = style.lineWidth;
  ctx.strokeStyle = style.strokeStyle;
  ctx.shadowBlur = style.shadowBlur;
  ctx.shadowColor = style.shadowColor;
  ctx.stroke();
}

function drawDot(ctx: CanvasRenderingContext2D, point: LegacyPoint, color: string): void {
  ctx.beginPath();
  ctx.fillStyle = rgba(color, 0.85);
  ctx.shadowBlur = MAX_BLUR * 0.5;
  ctx.shadowColor = color;
  ctx.arc(point.x, point.y, MIN_WIDTH / 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: LegacyStroke): void {
  const { points, color } = stroke;
  if (points.length < 2) {
    if (points.length === 1) {
      drawDot(ctx, points[0]!, color);
    }
    return;
  }

  const hotCore = lighten(color, 0.72);

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const speedNorm = clamp(curr.speed / MAX_SPEED, 0, 1);

    const width = lerp(MAX_WIDTH, MIN_WIDTH, speedNorm);
    const blur = lerp(MAX_BLUR, MIN_BLUR, speedNorm);
    const alpha = lerp(MAX_ALPHA, MIN_ALPHA, speedNorm);

    strokeSegment(ctx, prev, curr, {
      lineWidth: width * 1.7,
      strokeStyle: rgba(color, alpha * 0.32),
      shadowBlur: blur * 1.5,
      shadowColor: color,
    });

    strokeSegment(ctx, prev, curr, {
      lineWidth: width,
      strokeStyle: rgba(color, alpha),
      shadowBlur: blur * 0.6,
      shadowColor: color,
    });

    strokeSegment(ctx, prev, curr, {
      lineWidth: Math.max(1.2, width * 0.32),
      strokeStyle: rgba(hotCore, alpha * 0.85),
      shadowBlur: blur * 0.25,
      shadowColor: hotCore,
    });
  }
}

export function legacyRenderScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  backgroundHex: string,
  strokes: LegacyStroke[]
): void {
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
  ctx.fillStyle = backgroundHex;
  ctx.fillRect(0, 0, width, height);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "lighter";

  for (const stroke of strokes) {
    drawStroke(ctx, stroke);
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
}
