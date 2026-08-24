import { PLATE_COLORS } from "./theme.ts";

/** シード付き疑似乱数（mulberry32）。位置は固定し、強度スライダーで濃さ/量だけ変える。 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface FoxingSpot {
  fx: number; // 0-1 相対座標
  fy: number;
  fr: number; // 0-1 相対半径
  alpha: number;
}

let cachedSpots: FoxingSpot[] | null = null;
function getFoxingSpots(): FoxingSpot[] {
  if (cachedSpots) return cachedSpots;
  const rnd = mulberry32(20260824);
  const spots: FoxingSpot[] = [];
  for (let i = 0; i < 22; i++) {
    spots.push({
      fx: rnd(),
      fy: rnd(),
      fr: 0.015 + rnd() * 0.05,
      alpha: 0.35 + rnd() * 0.5,
    });
  }
  cachedSpots = spots;
  return spots;
}

let cachedGrainTile: HTMLCanvasElement | null = null;
function getGrainTile(): HTMLCanvasElement {
  if (cachedGrainTile) return cachedGrainTile;
  const size = 96;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const ctx = tile.getContext("2d")!;
  const imageData = ctx.createImageData(size, size);
  const rnd = mulberry32(7);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = 128 + Math.floor((rnd() - 0.5) * 140);
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
    imageData.data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  cachedGrainTile = tile;
  return tile;
}

/**
 * プロシージャルな経年紙テクスチャ（下地グラデーション＋粒状ノイズ＋フォクシング染み）を描画する。
 * intensity は 0-70 を想定（上限を設け、強すぎて視認性を損なわないようにする）。
 */
export function drawPaperTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
): void {
  const t = Math.min(70, Math.max(0, intensity)) / 70;

  // 下地：ごくわずかな対角グラデーションで、均一なフラット塗りを避ける
  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, "#f1e6c9");
  base.addColorStop(0.55, PLATE_COLORS.paperBase);
  base.addColorStop(1, PLATE_COLORS.paperShadowBottom);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // 粒状ノイズ（グレイン）
  const tile = getGrainTile();
  const pattern = ctx.createPattern(tile, "repeat");
  if (pattern) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.08 + t * 0.22;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // フォクシング（経年染み）
  const spots = getFoxingSpots();
  const spotsToDraw = Math.max(2, Math.round(spots.length * (0.15 + t * 0.85)));
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < spotsToDraw; i++) {
    const s = spots[i];
    const cx = s.fx * width;
    const cy = s.fy * height;
    const r = s.fr * Math.max(width, height);
    const alpha = s.alpha * (0.25 + t * 0.75);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(156, 106, 52, ${alpha})`);
    grad.addColorStop(0.6, `rgba(156, 106, 52, ${alpha * 0.4})`);
    grad.addColorStop(1, "rgba(156, 106, 52, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 四隅の軽いヴィネット（強度スライダーに依らず常に薄く。奥行きを出す固定演出）
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72,
  );
  vignette.addColorStop(0, "rgba(36, 26, 16, 0)");
  vignette.addColorStop(1, "rgba(36, 26, 16, 0.14)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}
