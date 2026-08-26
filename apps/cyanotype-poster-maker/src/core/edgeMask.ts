import { fbm2D, mulberry32 } from './random';
import type { EdgeStyle } from '../types';

export interface EdgeMaskResult {
  canvas: HTMLCanvasElement;
  pad: number;
}

/**
 * Builds an alpha mask shaped like the exposed area of a hand-coated
 * cyanotype print: a straight rectangle, or — for the "rough" style —
 * a wobbly, unevenly coated boundary with soft feathered gaps eaten
 * out of the edge. The mask canvas is padded so outward wobble has
 * room to bulge past the nominal image rectangle.
 */
export function buildEdgeMask(imageW: number, imageH: number, style: EdgeStyle, seed: number): EdgeMaskResult {
  if (style === 'straight') {
    const canvas = document.createElement('canvas');
    canvas.width = imageW;
    canvas.height = imageH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, imageW, imageH);
    }
    return { canvas, pad: 0 };
  }

  const pad = Math.max(10, Math.round(Math.min(imageW, imageH) * 0.035));
  const canvas = document.createElement('canvas');
  canvas.width = imageW + pad * 2;
  canvas.height = imageH + pad * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { canvas, pad };

  const jitter = pad * 0.85;
  const segPerSide = 26;
  const x0 = pad;
  const y0 = pad;
  const x1 = pad + imageW;
  const y1 = pad + imageH;
  const points: Array<[number, number]> = [];

  const pushEdge = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number, seedOffset: number) => {
    for (let i = 0; i <= segPerSide; i++) {
      const t = i / segPerSide;
      const px = ax + (bx - ax) * t;
      const py = ay + (by - ay) * t;
      const n = fbm2D(t * 6, seedOffset, seed, 3) - 0.5;
      points.push([px + nx * n * jitter, py + ny * n * jitter]);
    }
  };

  pushEdge(x0, y0, x1, y0, 0, -1, 11);
  pushEdge(x1, y0, x1, y1, 1, 0, 22);
  pushEdge(x1, y1, x0, y1, 0, 1, 33);
  pushEdge(x0, y1, x0, y0, -1, 0, 44);

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
  ctx.fill();

  const rand = mulberry32(seed + 777);
  ctx.globalCompositeOperation = 'destination-out';
  const biteCount = 16;
  for (let i = 0; i < biteCount; i++) {
    const idx = Math.floor(rand() * points.length);
    const [px, py] = points[idx];
    const r = pad * (0.3 + rand() * 0.95);
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  return { canvas, pad };
}
