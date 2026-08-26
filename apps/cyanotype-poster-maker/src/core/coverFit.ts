/**
 * Draws `source` into a target canvas of size (targetW, targetH) using
 * "object-fit: cover" semantics — crops instead of stretching.
 */
export function drawCoverFit(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement,
  targetW: number,
  targetH: number,
): void {
  const sourceW = source.naturalWidth || source.width;
  const sourceH = source.naturalHeight || source.height;
  const sourceRatio = sourceW / sourceH;
  const targetRatio = targetW / targetH;

  let sx = 0;
  let sy = 0;
  let sw = sourceW;
  let sh = sourceH;

  if (sourceRatio > targetRatio) {
    sw = sourceH * targetRatio;
    sx = (sourceW - sw) / 2;
  } else {
    sh = sourceW / targetRatio;
    sy = (sourceH - sh) / 2;
  }

  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, targetW, targetH);
}
