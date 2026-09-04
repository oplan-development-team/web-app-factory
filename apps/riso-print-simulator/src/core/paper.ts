import { mixHex } from '../utils/color';
import { mulberry32 } from '../utils/prng';

const WARM_PAPER = '#F1E3C6';
const COOL_PAPER = '#EDEEEE';

export function paperColor(tone: number): string {
  return mixHex(WARM_PAPER, COOL_PAPER, tone / 100);
}

/** Flat paper base color plus a stable speckled grain texture. */
export function drawPaper(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tone: number,
  grain: number,
): void {
  ctx.fillStyle = paperColor(tone);
  ctx.fillRect(0, 0, width, height);
  if (grain <= 0) return;

  const rand = mulberry32(913 + Math.round(grain) * 97);
  const count = Math.round(((width * height) / 1400) * (grain / 100));
  for (let i = 0; i < count; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const isDark = rand() > 0.45;
    const alpha = 0.05 + rand() * 0.12;
    const r = 0.4 + rand() * 1.1;
    ctx.fillStyle = isDark ? `rgba(24,18,10,${alpha.toFixed(3)})` : `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
