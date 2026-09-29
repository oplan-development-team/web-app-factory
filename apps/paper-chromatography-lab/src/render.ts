import { N, Sim } from './sim';

export const SERIF = '"Playfair Display","Didot","Bodoni 72","Hoefler Text",Georgia,"Noto Serif JP","Hiragino Mincho ProN","Yu Mincho",serif';
export const MONO = 'ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,"Liberation Mono",monospace';
export const HAND = '"Segoe Script","Bradley Hand","Noteworthy","Snell Roundhand","Brush Script MT",cursive';

export const PAPER = '#F7F2E6';
export const INK = '#1C1A17';
export const ACCENT = '#B23A2B';

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasOf(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export interface PaperTex { grain: HTMLCanvasElement; fibers: HTMLCanvasElement }

export function makePaperTex(size: number, seed = 7): PaperTex {
  const r = rng(seed);
  const grain = canvasOf(size, size);
  const g = grain.getContext('2d')!;
  g.fillStyle = PAPER;
  g.fillRect(0, 0, size, size);
  // 低周波のムラ
  for (let i = 0; i < 46; i++) {
    const x = r() * size, y = r() * size, rad = (0.08 + r() * 0.22) * size;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const warm = r() > 0.5;
    gr.addColorStop(0, warm ? 'rgba(214,190,140,0.10)' : 'rgba(255,255,250,0.14)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
  }
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 9;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n * 1.1;
  }
  g.putImageData(img, 0, 0);

  const fibers = canvasOf(size, size);
  const f = fibers.getContext('2d')!;
  const s = size / 800;
  const count = Math.round(2600 * s * s);
  f.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = r() * size, y = r() * size, a = r() * Math.PI * 2;
    const len = (8 + r() * 30) * s;
    const bend = (r() - 0.5) * len * 0.7;
    f.beginPath();
    f.moveTo(x, y);
    f.quadraticCurveTo(x + Math.cos(a) * len * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * len * 0.5 + Math.cos(a) * bend,
      x + Math.cos(a) * len, y + Math.sin(a) * len);
    const dark = r() > 0.45;
    f.strokeStyle = dark ? `rgba(120,98,64,${0.10 + r() * 0.16})` : `rgba(255,255,250,${0.35 + r() * 0.4})`;
    f.lineWidth = (0.5 + r() * 0.9) * s;
    f.stroke();
  }
  return { grain, fibers };
}

/** シミュレーション格子 → 乗算用インク画像 と 湿潤オーバーレイ */
export class InkLayers {
  inkCv = canvasOf(N, N);
  wetCv = canvasOf(N, N);
  private inkCtx = this.inkCv.getContext('2d')!;
  private wetCtx = this.wetCv.getContext('2d')!;
  private inkData = this.inkCtx.createImageData(N, N);
  private wetData = this.wetCtx.createImageData(N, N);

  update(sim: Sim, dry: number) {
    const s = 1.32 - 0.36 * dry; // 湿潤時は濃く、乾燥で落ち着く
    const ink = this.inkData.data, wet = this.wetData.data;
    const [oR, oG, oB] = sim.od;
    const cellW = 2 / N;
    for (let iy = 0; iy < N; iy++) {
      const y = -1 + (iy + 0.5) * cellW;
      for (let ix = 0; ix < N; ix++) {
        const i = iy * N + ix, p = i * 4;
        ink[p] = 255 * Math.exp(-Math.min(3.2, oR[i] * s));
        ink[p + 1] = 255 * Math.exp(-Math.min(3.2, oG[i] * s));
        ink[p + 2] = 255 * Math.exp(-Math.min(3.2, oB[i] * s));
        ink[p + 3] = 255;
        const w = sim.wet[i], rm = sim.rim[i];
        const aDark = w * 0.17 * (1 - dry) + rm * (0.11 * (1 - dry) + 0.07 * dry);
        const x = -1 + (ix + 0.5) * cellW;
        const sheen = Math.max(0, 1 - Math.hypot(x + 0.35, y + 0.4) / 1.0);
        const aWhite = w * sheen * 0.34 * (1 - dry);
        const a = aDark + aWhite;
        if (a <= 0.001) { wet[p + 3] = 0; continue; }
        wet[p] = (58 * aDark + 255 * aWhite) / a;
        wet[p + 1] = (42 * aDark + 255 * aWhite) / a;
        wet[p + 2] = (26 * aDark + 250 * aWhite) / a;
        wet[p + 3] = Math.min(255, a * 255);
      }
    }
    this.inkCtx.putImageData(this.inkData, 0, 0);
    this.wetCtx.putImageData(this.wetData, 0, 0);
  }
}

export function drawPaper(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number,
  layers: InkLayers, tex: PaperTex, dry: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tex.grain, cx - R, cy - R, R * 2, R * 2);
  ctx.globalAlpha = 0.45 + 0.55 * dry;
  ctx.drawImage(tex.fibers, cx - R, cy - R, R * 2, R * 2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(layers.inkCv, cx - R, cy - R, R * 2, R * 2);
  ctx.fillStyle = `rgba(246,232,196,${0.8 * dry})`; // 乾燥後の生成り
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(layers.wetCv, cx - R, cy - R, R * 2, R * 2);
  // 縁の陰影(紙の厚み)
  const edge = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R);
  edge.addColorStop(0, 'rgba(60,44,24,0)');
  edge.addColorStop(1, 'rgba(60,44,24,0.16)');
  ctx.fillStyle = edge;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.restore();
}

export function drawTicks(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, k: number,
  color: string, labels = true) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  for (let deg = 0; deg < 360; deg += 5) {
    const len = deg % 45 === 0 ? 22 : deg % 15 === 0 ? 14 : 7;
    const a = ((deg - 90) * Math.PI) / 180;
    ctx.lineWidth = (deg % 45 === 0 ? 1.6 : 1) * k;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a) * (r + len * k), cy + Math.sin(a) * (r + len * k));
    ctx.stroke();
    if (labels && deg % 90 === 0) {
      ctx.font = `${13 * k}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(deg), cx + Math.cos(a) * (r + 32 * k), cy + Math.sin(a) * (r + 32 * k));
    }
  }
  ctx.restore();
}

export const W = 800;
export const CEN = W / 2;
export const R_PAPER = 302;
export const R_DISH = 362;

/** ペトリ皿風の静的レイヤー */
export function makeDishLayer(): HTMLCanvasElement {
  const c = canvasOf(W, W);
  const g = c.getContext('2d')!;
  g.save();
  g.shadowColor = 'rgba(28,26,23,0.38)';
  g.shadowBlur = 38;
  g.shadowOffsetY = 18;
  g.beginPath();
  g.arc(CEN, CEN, R_DISH, 0, Math.PI * 2);
  g.fillStyle = '#E3D9C2';
  g.fill();
  g.restore();
  const gr = g.createRadialGradient(CEN - 90, CEN - 110, 60, CEN, CEN, R_DISH);
  gr.addColorStop(0, '#F0E9D8');
  gr.addColorStop(0.75, '#E2D8C0');
  gr.addColorStop(1, '#D3C7AB');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(CEN, CEN, R_DISH, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(28,26,23,0.7)';
  g.lineWidth = 1.5;
  g.stroke();
  g.strokeStyle = 'rgba(28,26,23,0.32)';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(CEN, CEN, R_DISH - 7, 0, Math.PI * 2);
  g.stroke();
  // ガラスの反射
  g.strokeStyle = 'rgba(255,255,255,0.65)';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(CEN, CEN, R_DISH - 14, Math.PI * 1.08, Math.PI * 1.42);
  g.stroke();
  drawTicks(g, CEN, CEN, R_PAPER + 8, 1, 'rgba(28,26,23,0.78)');
  // 濾紙の影
  g.save();
  g.shadowColor = 'rgba(28,26,23,0.42)';
  g.shadowBlur = 14;
  g.shadowOffsetY = 5;
  g.fillStyle = PAPER;
  g.beginPath();
  g.arc(CEN, CEN, R_PAPER, 0, Math.PI * 2);
  g.fill();
  g.restore();
  return c;
}
