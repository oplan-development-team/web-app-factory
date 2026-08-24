import { toGrayscale, sobelMagnitude } from "./sobel.ts";
import { PLATE_COLORS } from "./theme.ts";

export interface EngravingOptions {
  /** Sobelエッジのしきい値（0-255）。低いほど弱いエッジも輪郭として拾う。 */
  threshold: number;
  /** ハッチング密度（0-100）。高いほどセルが小さくなり線が密になる。 */
  density: number;
  /** 線の濃さ（0-100）。線幅と、階調が濃い側に倒れる度合いの両方に効く。 */
  weight: number;
  /** 明暗の反転（トーンマッピングを反転する）。 */
  invert: boolean;
}

/** 0〜1の疑似乱数を、整数シードから決定的に得る（毎回同じ絵になるように）。 */
function hash01(seed: number): number {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

function densityToCellSize(density: number): number {
  const d = Math.min(100, Math.max(0, density));
  // density 0 → 16px（粗い）, density 100 → 4px（密）
  return Math.round(16 - (d / 100) * 12);
}

/**
 * ソース画像（sourceCanvas）から銅版画風のクロスハッチング線画を生成する。
 * 戻り値のCanvasは透明背景に、インク色のストロークのみが描かれている。
 */
export function renderEngraving(
  sourceCanvas: HTMLCanvasElement,
  opts: EngravingOptions,
): HTMLCanvasElement {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  const srcCtx = sourceCanvas.getContext("2d");
  if (!srcCtx) throw new Error("Canvas 2D コンテキストを取得できませんでした。");
  const imageData = srcCtx.getImageData(0, 0, width, height);

  const gray = toGrayscale(imageData);
  const edges = sobelMagnitude(gray, width, height);

  const cellSize = densityToCellSize(opts.density);
  const weightBias = (opts.weight - 50) * 1.2;
  const lineWidth = 0.5 + (opts.weight / 100) * 1.6;
  const edgeBoost = 130;

  const layerDiag1 = new Path2D();
  const layerDiag2 = new Path2D();
  const layerHoriz = new Path2D();
  const layerVert = new Path2D();

  for (let cy = 0; cy < height; cy += cellSize) {
    const y1 = Math.min(height, cy + cellSize);
    for (let cx = 0; cx < width; cx += cellSize) {
      const x1 = Math.min(width, cx + cellSize);

      // セル内を間引きサンプリングして平均輝度・最大エッジ強度を求める
      let sumGray = 0;
      let maxEdge = 0;
      let count = 0;
      const step = 2;
      for (let y = cy; y < y1; y += step) {
        for (let x = cx; x < x1; x += step) {
          const idx = y * width + x;
          sumGray += gray[idx];
          if (edges[idx] > maxEdge) maxEdge = edges[idx];
          count++;
        }
      }
      if (count === 0) continue;
      const avgGray = sumGray / count;

      const lightness = opts.invert ? avgGray : 255 - avgGray;
      const edgeContribution = maxEdge > opts.threshold ? edgeBoost : 0;
      const darkness = Math.min(255, Math.max(0, lightness * 0.72 + edgeContribution + weightBias));

      if (darkness < 40) continue; // ほぼ白紙のまま

      const level = darkness < 95 ? 1 : darkness < 150 ? 2 : darkness < 205 ? 3 : 4;

      const seed = cx * 928371 + cy * 128371;
      const jitter = (hash01(seed) - 0.5) * (cellSize * 0.18);
      const ccx = (cx + x1) / 2 + jitter;
      const ccy = (cy + y1) / 2 + (hash01(seed + 7) - 0.5) * (cellSize * 0.18);
      const half = cellSize * 0.62;

      if (level >= 1) {
        layerDiag1.moveTo(ccx - half, ccy + half);
        layerDiag1.lineTo(ccx + half, ccy - half);
      }
      if (level >= 2) {
        layerDiag2.moveTo(ccx - half, ccy - half);
        layerDiag2.lineTo(ccx + half, ccy + half);
      }
      if (level >= 3) {
        layerHoriz.moveTo(cx, ccy);
        layerHoriz.lineTo(x1, ccy);
      }
      if (level >= 4) {
        layerVert.moveTo(ccx, cy);
        layerVert.lineTo(ccx, y1);
      }
    }
  }

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D コンテキストを取得できませんでした。");

  ctx.strokeStyle = PLATE_COLORS.ink;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.stroke(layerDiag1);
  ctx.stroke(layerDiag2);
  ctx.stroke(layerHoriz);
  ctx.stroke(layerVert);

  return out;
}

/** アップロード画像を、指定サイズに contain-fit で描画したソースCanvasを作る。 */
export function makeSourceCanvas(image: HTMLImageElement, targetW: number, targetH: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(targetW));
  canvas.height = Math.max(1, Math.round(targetH));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D コンテキストを取得できませんでした。");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
