import { type Ctx2D, clamp01, hexToRgba } from './ctx2d';

/**
 * 感光域に対する放射状の暗化（FR-303）。手塗りの印画で縁ほど露光が
 * 不均一になる様子を模す。`strength` は 0..1。
 */
export function applyVignette(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  inkColor: string,
  strength: number,
): void {
  if (strength <= 0) return;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const radius = Math.hypot(w, h) / 2;
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, hexToRgba(inkColor, 0.55 * clamp01(strength)));

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** 台紙全体にかかる、ごく淡い経年の四隅暗化（FR-305）。 */
export function applyPageAge(ctx: Ctx2D, width: number, height: number, inkColor: string): void {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.hypot(width, height) / 2,
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, hexToRgba(inkColor, 0.12));

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
