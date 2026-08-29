import { PAPERS } from './constants';
import type { PaperType } from './types';

// 決定論的な疑似乱数 (mulberry32) — 紙のテクスチャが再描画のたびに
// ちらつかないよう、シードから毎回同じノイズを再現する。
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 紙面の質感 (繊維・グリッド・軽いヴィネット) を描画する。
 * ライブCanvasと高解像度PNG書き出しの両方から共通で呼び出す。
 */
export function drawPaperTexture(
  ctx: CanvasRenderingContext2D,
  widthPx: number,
  heightPx: number,
  paper: PaperType,
): void {
  const def = PAPERS[paper];
  ctx.save();
  ctx.clearRect(0, 0, widthPx, heightPx);

  ctx.fillStyle = def.base;
  ctx.fillRect(0, 0, widthPx, heightPx);

  const rand = mulberry32(1337);

  if (paper === 'graph') {
    const step = widthPx / 20;
    ctx.strokeStyle = def.fiber;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(1, widthPx * 0.0009);
    ctx.beginPath();
    for (let x = step; x < widthPx; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, heightPx);
    }
    for (let y = step; y < heightPx; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(widthPx, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = Math.max(1.4, widthPx * 0.0016);
    const bigStep = step * 5;
    ctx.beginPath();
    for (let x = bigStep; x < widthPx; x += bigStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, heightPx);
    }
    for (let y = bigStep; y < heightPx; y += bigStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(widthPx, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    // 微細な繊維ノイズ (短いストローク) を撒いて紙の質感を出す。
    const fiberCount = Math.round((widthPx * heightPx) / 1400);
    ctx.strokeStyle = def.fiber;
    ctx.lineCap = 'round';
    for (let i = 0; i < fiberCount; i++) {
      const x = rand() * widthPx;
      const y = rand() * heightPx;
      const len = 2 + rand() * 6;
      const angle = rand() * Math.PI * 2;
      ctx.globalAlpha = 0.05 + rand() * 0.08;
      ctx.lineWidth = 0.6 + rand() * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // 中央に向けてほんのり明るい／隅がわずかに沈む紙面のムラ。
  const gradient = ctx.createRadialGradient(
    widthPx / 2,
    heightPx / 2,
    widthPx * 0.15,
    widthPx / 2,
    heightPx / 2,
    widthPx * 0.72,
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, def.vignette);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, widthPx, heightPx);

  ctx.restore();
}
