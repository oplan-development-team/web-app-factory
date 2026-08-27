import type { Ctx2D } from './ctx2d';

/**
 * `source` を (targetW, targetH) の領域へ `object-fit: cover` 相当で描く。
 * 引き伸ばさず、中央基準で切り抜く（FR-112）。
 */
export function drawCoverFit(ctx: Ctx2D, source: HTMLImageElement, targetW: number, targetH: number): void {
  const sourceW = source.naturalWidth || source.width;
  const sourceH = source.naturalHeight || source.height;
  const rect = coverRect(sourceW, sourceH, targetW, targetH);
  ctx.drawImage(source, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, targetW, targetH);
}

export interface CoverRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** cover 配置で切り出す元画像側の矩形。純関数として切り出しテスト可能にする。 */
export function coverRect(sourceW: number, sourceH: number, targetW: number, targetH: number): CoverRect {
  if (sourceW <= 0 || sourceH <= 0 || targetW <= 0 || targetH <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(1, sourceW), sh: Math.max(1, sourceH) };
  }

  const sourceRatio = sourceW / sourceH;
  const targetRatio = targetW / targetH;

  if (sourceRatio > targetRatio) {
    const sw = sourceH * targetRatio;
    return { sx: (sourceW - sw) / 2, sy: 0, sw, sh: sourceH };
  }
  const sh = sourceW / targetRatio;
  return { sx: 0, sy: (sourceH - sh) / 2, sw: sourceW, sh };
}
