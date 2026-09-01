import { sampleGrayscaleRegion, type GraySample } from './grayscale';
import type { LoadedImage } from './types';

export class AlignmentError extends Error {}

export const MIN_OVERLAP_PX = 4;

// 段階1(粗探索): 画像サイズによらず一定コストで済むよう、常に一定の行数へ縮小してから全域探索する。
const COARSE_WIDTH = 48;
const COARSE_ROWS_TARGET = 200;

// 段階2(精密探索): 粗探索で得た近似値の周辺だけ、縮小率の低いサンプルで1px単位に絞り込む。
const FINE_WIDTH = 220;

interface EffectiveRegion {
  topSrcEnd: number; // top画像の有効領域の終端(自然座標系)
  bottomSrcStart: number; // bottom画像の有効領域の開始(自然座標系)
  maxOverlap: number;
}

function computeEffectiveRegion(
  top: LoadedImage,
  bottom: LoadedImage,
  cutBottomOfTop: number,
  cutTopOfBottom: number,
): EffectiveRegion {
  const topSrcEnd = top.naturalHeight - cutBottomOfTop;
  const bottomSrcStart = cutTopOfBottom;
  const effTopHeight = topSrcEnd;
  const effBottomHeight = bottom.naturalHeight - bottomSrcStart;

  if (effTopHeight <= 0 || effBottomHeight <= 0) {
    throw new AlignmentError('カット量が画像の高さを超えている');
  }

  return {
    topSrcEnd,
    bottomSrcStart,
    maxOverlap: Math.min(effTopHeight, effBottomHeight),
  };
}

/** 候補範囲[candidateMin, candidateMax]の中で、行差分コストが最小になる重なり幅を探す。 */
function searchBestOverlap(
  topSample: GraySample,
  bottomSample: GraySample,
  candidateMin: number,
  candidateMax: number,
): number {
  const width = topSample.width;
  let bestD = candidateMin;
  let bestCost = Infinity;

  for (let d = candidateMin; d <= candidateMax; d++) {
    const topRowStart = topSample.height - d;
    if (topRowStart < 0 || d > bottomSample.height) continue;

    let sum = 0;
    for (let row = 0; row < d; row++) {
      const topOffset = (topRowStart + row) * width;
      const bottomOffset = row * width;
      for (let col = 0; col < width; col++) {
        sum += Math.abs(topSample.data[topOffset + col] - bottomSample.data[bottomOffset + col]);
      }
    }
    const cost = sum / (d * width);
    if (cost < bestCost) {
      bestCost = cost;
      bestD = d;
    }
  }
  return bestD;
}

/**
 * 上画像の下端と下画像の上端を比較し、最もずれの少ない重なり幅(px)を検出する。
 * 低解像度での粗探索→その近傍のみ高解像度で追加探索、の2段階で計算量を抑える。
 */
export function detectOverlap(
  top: LoadedImage,
  bottom: LoadedImage,
  cutBottomOfTop: number,
  cutTopOfBottom: number,
): number {
  const region = computeEffectiveRegion(top, bottom, cutBottomOfTop, cutTopOfBottom);
  const { topSrcEnd, bottomSrcStart, maxOverlap } = region;

  if (maxOverlap < MIN_OVERLAP_PX) {
    return Math.max(0, maxOverlap);
  }

  // --- 段階1: 粗探索 ---
  const coarseScale = Math.min(6, Math.max(0.02, COARSE_ROWS_TARGET / maxOverlap));
  const topCoarse = sampleGrayscaleRegion(
    top.element,
    topSrcEnd - maxOverlap,
    maxOverlap,
    COARSE_WIDTH,
    coarseScale,
  );
  const bottomCoarse = sampleGrayscaleRegion(
    bottom.element,
    bottomSrcStart,
    maxOverlap,
    COARSE_WIDTH,
    coarseScale,
  );
  const scaledRows = Math.min(topCoarse.height, bottomCoarse.height);
  const coarseBestScaled = searchBestOverlap(topCoarse, bottomCoarse, 1, scaledRows);

  // --- 段階2: 精密探索(粗探索結果の近傍だけを1px刻みで再探索) ---
  const approxOverlap = Math.round(coarseBestScaled / coarseScale);
  const quantError = Math.ceil(1 / coarseScale);
  const margin = Math.max(12, quantError * 3);

  const fineSpan = Math.min(maxOverlap, approxOverlap + margin);
  const topFine = sampleGrayscaleRegion(top.element, topSrcEnd - fineSpan, fineSpan, FINE_WIDTH, 1);
  const bottomFine = sampleGrayscaleRegion(bottom.element, bottomSrcStart, fineSpan, FINE_WIDTH, 1);

  const fineMin = Math.max(MIN_OVERLAP_PX, approxOverlap - margin);
  const fineMax = Math.min(fineSpan, approxOverlap + margin);
  const fineBest = searchBestOverlap(topFine, bottomFine, fineMin, fineMax);

  return Math.min(maxOverlap, Math.max(0, fineBest));
}
