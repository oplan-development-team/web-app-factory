import type { Point } from './types';

function tracePath(ctx: CanvasRenderingContext2D, pts: Point[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
}

function makeGoldGradient(ctx: CanvasRenderingContext2D, pts: Point[]): CanvasGradient {
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  grad.addColorStop(0, '#f4e5a1');
  grad.addColorStop(0.5, '#d4af37');
  grad.addColorStop(1, '#f4e5a1');
  return grad;
}

/**
 * Draws a kintsugi seam: a soft blurred glow pass, a bright gold-gradient
 * core, and a thin hot highlight, so the repair reads as gilded lacquer
 * rather than a flat colored line.
 */
export function drawGoldPolyline(
  ctx: CanvasRenderingContext2D,
  pts: Point[],
  widthPx: number,
  opacity = 1,
): void {
  if (pts.length < 2) return;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.save();
  ctx.shadowColor = `rgba(244,229,161,${0.7 * opacity})`;
  ctx.shadowBlur = Math.max(4, widthPx * 3.2);
  ctx.strokeStyle = `rgba(212,175,55,${0.5 * opacity})`;
  ctx.lineWidth = widthPx * 2.1;
  tracePath(ctx, pts);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = `rgba(212,175,55,${0.55 * opacity})`;
  ctx.shadowBlur = Math.max(2, widthPx * 1.1);
  ctx.strokeStyle = makeGoldGradient(ctx, pts);
  ctx.lineWidth = widthPx;
  ctx.globalAlpha = opacity;
  tracePath(ctx, pts);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = `rgba(255,250,224,${0.85 * opacity})`;
  ctx.lineWidth = Math.max(0.4, widthPx * 0.34);
  tracePath(ctx, pts);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

/** Draws an unmended fissure: a dark carved groove with a faint edge highlight. */
export function drawRawCrack(ctx: CanvasRenderingContext2D, pts: Point[], widthPx: number): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = widthPx * 1.6;
  tracePath(ctx, pts);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(6,5,4,0.88)';
  ctx.lineWidth = Math.max(0.6, widthPx);
  tracePath(ctx, pts);
  ctx.stroke();

  ctx.restore();
}
