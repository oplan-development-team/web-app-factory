import type { Stone, Streamline } from './types';
import { paintWashiBackground } from './washiTexture';

const INK_COLOR = { r: 106, g: 88, b: 66 };
const VERMILLION = '#b3392c';

export interface RenderOptions {
  width: number;
  height: number;
  stones: Stone[];
  streamlines: Streamline[];
  selectedStoneId: string | null;
  /** deterministic per-line alpha jitter so re-renders don't flicker */
  lineSeed: number[];
}

function drawStreamline(ctx: CanvasRenderingContext2D, line: Streamline, alpha: number): void {
  if (line.length < 2) return;
  ctx.beginPath();
  const first = line[0]!;
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < line.length - 1; i++) {
    const cur = line[i]!;
    const next = line[i + 1]!;
    const midX = (cur.x + next.x) / 2;
    const midY = (cur.y + next.y) / 2;
    ctx.quadraticCurveTo(cur.x, cur.y, midX, midY);
  }
  const last = line[line.length - 1]!;
  ctx.lineTo(last.x, last.y);
  ctx.strokeStyle = `rgba(${INK_COLOR.r}, ${INK_COLOR.g}, ${INK_COLOR.b}, ${alpha})`;
  ctx.lineWidth = 0.85;
  ctx.stroke();
}

function drawStone(ctx: CanvasRenderingContext2D, stone: Stone, selected: boolean): void {
  const { x, y, radius } = stone;

  // soft warm cast shadow, offset down-right
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x + radius * 0.16, y + radius * 0.38, radius * 0.92, radius * 0.5, 0, 0, Math.PI * 2);
  const shadowGrad = ctx.createRadialGradient(
    x + radius * 0.16,
    y + radius * 0.38,
    0,
    x + radius * 0.16,
    y + radius * 0.38,
    radius * 1.05,
  );
  shadowGrad.addColorStop(0, 'rgba(90, 68, 40, 0.32)');
  shadowGrad.addColorStop(1, 'rgba(90, 68, 40, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.fill();
  ctx.restore();

  // stone body: radial gradient light source upper-left, flat-illustration feel
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(
    x - radius * 0.38,
    y - radius * 0.42,
    radius * 0.08,
    x,
    y,
    radius * 1.05,
  );
  grad.addColorStop(0, '#4a4a48');
  grad.addColorStop(0.45, '#2b2b2b');
  grad.addColorStop(1, '#121110');
  ctx.fillStyle = grad;
  ctx.fill();

  // subtle rim light catching the washi tone, bottom-right edge
  ctx.beginPath();
  ctx.arc(x, y, radius - 0.75, Math.PI * 0.15, Math.PI * 0.85);
  ctx.strokeStyle = 'rgba(244, 237, 224, 0.14)';
  ctx.lineWidth = Math.max(1, radius * 0.05);
  ctx.stroke();
  ctx.restore();

  if (selected) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = VERMILLION;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([1, 4]);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }
}

export function renderGarden(ctx: CanvasRenderingContext2D, opts: RenderOptions): void {
  const { width, height, stones, streamlines, selectedStoneId, lineSeed } = opts;
  ctx.clearRect(0, 0, width, height);
  paintWashiBackground(ctx, width, height);

  ctx.save();
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  streamlines.forEach((line, i) => {
    const jitter = lineSeed[i % lineSeed.length] ?? 0.7;
    drawStreamline(ctx, line, 0.14 + jitter * 0.2);
  });
  ctx.restore();

  for (const stone of stones) {
    drawStone(ctx, stone, stone.id === selectedStoneId);
  }
}

export function makeLineSeed(count: number): number[] {
  const seed: number[] = [];
  for (let i = 0; i < count; i++) seed.push(Math.random());
  return seed;
}
