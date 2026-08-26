/**
 * Radial darkening applied over a rectangular region — mimics the
 * uneven light exposure at the edges of a hand-coated print. `strength`
 * is 0..1.
 */
export function applyVignette(
  ctx: CanvasRenderingContext2D,
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
  gradient.addColorStop(1, hexToRgba(inkColor, 0.55 * strength));

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** A very faint overall page-age darkening toward the sheet's corners. */
export function applyPageAge(ctx: CanvasRenderingContext2D, width: number, height: number, inkColor: string): void {
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

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
