// 経年した和紙/お札を思わせる微粒子テクスチャとシミを、
// オフスクリーンキャンバスに一度だけ生成して使い回す（毎フレーム再生成しない）。

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWashiTexture(w: number, h: number, seed = 7): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(seed);

  // ベースの紙色（漆黒背景の上に敷く、少し明るい生成りの層）
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, 'rgba(46, 38, 28, 0.55)');
  grad.addColorStop(0.5, 'rgba(34, 27, 20, 0.4)');
  grad.addColorStop(1, 'rgba(20, 16, 12, 0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 繊維状のかすれ（短い線を大量に低アルファで）
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 900; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 4 + rand() * 14;
    const angle = rand() * Math.PI;
    const alpha = 0.015 + rand() * 0.035;
    ctx.strokeStyle = `rgba(214, 196, 158, ${alpha})`;
    ctx.lineWidth = 0.6 + rand() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  // 微粒子ノイズ
  for (let i = 0; i < 2600; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.4 + rand() * 1.1;
    const alpha = 0.02 + rand() * 0.05;
    ctx.fillStyle = `rgba(200, 180, 140, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // 経年のシミ（大きく柔らかい斑点、暗褐色）
  const stainCount = 6 + Math.floor(rand() * 4);
  for (let i = 0; i < stainCount; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = Math.min(w, h) * (0.06 + rand() * 0.16);
    const stainGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const alpha = 0.08 + rand() * 0.1;
    stainGrad.addColorStop(0, `rgba(58, 38, 20, ${alpha})`);
    stainGrad.addColorStop(0.6, `rgba(40, 26, 14, ${alpha * 0.5})`);
    stainGrad.addColorStop(1, 'rgba(40, 26, 14, 0)');
    ctx.fillStyle = stainGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 縁の暗い焼け（周辺減光）
  const vignette = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.35,
    w / 2, h / 2, Math.max(w, h) * 0.72,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(6, 4, 3, 0.65)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  return canvas;
}
