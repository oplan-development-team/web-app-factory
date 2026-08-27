import { fbm2D, mulberry32 } from './random';
import { createCanvas, type CanvasLike } from './ctx2d';
import type { EdgeStyle } from '../types';

export interface EdgeMaskResult {
  canvas: CanvasLike;
  pad: number;
}

/**
 * 手塗りしたサイアノタイプの感光域の形をしたアルファマスクを作る（FR-304）。
 *
 * `straight` は矩形そのまま。`rough` はノイズで揺らした不規則な境界に、
 * 柔らかい欠け（塗り残し）を散らす。外側へ膨らむぶんの余地が要るので、
 * マスクは `pad` の余白付きで生成し、合成側がその分だけずらして描く。
 */
export function buildEdgeMask(imageW: number, imageH: number, style: EdgeStyle, seed: number): EdgeMaskResult {
  if (style === 'straight') {
    const { canvas, ctx } = createCanvas(imageW, imageH);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, imageW, imageH);
    return { canvas, pad: 0 };
  }

  const pad = Math.max(10, Math.round(Math.min(imageW, imageH) * 0.035));
  const { canvas, ctx } = createCanvas(imageW + pad * 2, imageH + pad * 2);

  const jitterAmount = pad * 0.85;
  const segPerSide = 26;
  const x0 = pad;
  const y0 = pad;
  const x1 = pad + imageW;
  const y1 = pad + imageH;
  const points: Array<[number, number]> = [];

  const pushEdge = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    nx: number,
    ny: number,
    seedOffset: number,
  ): void => {
    for (let i = 0; i <= segPerSide; i++) {
      const t = i / segPerSide;
      const px = ax + (bx - ax) * t;
      const py = ay + (by - ay) * t;
      const n = fbm2D(t * 6, seedOffset, seed, 3) - 0.5;
      points.push([px + nx * n * jitterAmount, py + ny * n * jitterAmount]);
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

  // 縁に沿って柔らかい欠け（塗り残し）を食わせる
  const rand = mulberry32(seed + 777);
  ctx.globalCompositeOperation = 'destination-out';
  const biteCount = 16;
  for (let i = 0; i < biteCount; i++) {
    const index = Math.floor(rand() * points.length);
    const point = points[index];
    if (!point) continue;
    const [px, py] = point;
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
