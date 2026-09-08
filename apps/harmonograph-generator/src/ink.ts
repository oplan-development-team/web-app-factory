export interface InkStyle {
  color: string;
  /** mm換算の基準線幅。速度に応じて変調される。 */
  baseWidthMm: number;
}

/**
 * ペン先の局所速度 (正規化 0-1) から線幅・不透明度を導く。
 * 速度が遅い (減衰し切る終盤・方向転換の頂点) ほど太く/濃くなり、
 * 実機のインクだまりを模す。
 */
export function widthForSpeed(normSpeed: number, baseWidthPx: number): number {
  return baseWidthPx * (1.7 - 1.1 * normSpeed);
}

export function alphaForSpeed(normSpeed: number): number {
  return 0.5 + 0.42 * (1 - normSpeed);
}

/**
 * points[fromIndex..toIndex] の区間を、区間ごとに変化する線幅・不透明度で描画する。
 * points, scale, offset は既にキャンバスpx座標系に変換済みであること。
 */
export function drawInkSegments(
  ctx: CanvasRenderingContext2D,
  pointsPx: { x: number; y: number }[],
  normSpeeds: Float64Array,
  style: InkStyle,
  scalePxPerMm: number,
  fromIndex: number,
  toIndex: number,
): void {
  const baseWidthPx = style.baseWidthMm * scalePxPerMm;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = style.color;

  const start = Math.max(0, fromIndex);
  const end = Math.min(pointsPx.length - 1, toIndex);

  for (let i = start; i < end; i++) {
    const a = pointsPx[i];
    const b = pointsPx[i + 1];
    if (!a || !b) continue;
    const speed = normSpeeds[i] ?? 0.5;
    ctx.globalAlpha = alphaForSpeed(speed);
    ctx.lineWidth = widthForSpeed(speed, baseWidthPx);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
