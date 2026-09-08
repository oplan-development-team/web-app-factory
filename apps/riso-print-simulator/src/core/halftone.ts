export interface DotScreenOptions {
  width: number;
  height: number;
  angleDeg: number;
  cellSize: number;
  color: string;
  maxAlpha: number;
  sampleDensity: (x: number, y: number) => number;
  minDensity?: number;
}

/**
 * Classic angled amplitude-modulated (AM) dot screen: a rotated grid of
 * circular dots whose radius is driven by sampled ink density at each cell
 * center. Positions are computed analytically (rotation applied to grid
 * coordinates directly) rather than per-pixel, which keeps this fast enough
 * to re-run on every preview change.
 */
export function drawAngledDotScreen(ctx: CanvasRenderingContext2D, opts: DotScreenOptions): void {
  const { width, height, angleDeg, cellSize, color, maxAlpha, sampleDensity } = opts;
  const minDensity = opts.minDensity ?? 0.02;
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = width / 2;
  const cy = height / 2;
  const diag = Math.sqrt(width * width + height * height);
  const half = Math.ceil(diag / 2 / cellSize) + 2;
  const maxRadius = cellSize * 0.58;

  ctx.save();
  ctx.fillStyle = color;
  for (let j = -half; j <= half; j++) {
    const ly = j * cellSize + cellSize / 2;
    for (let i = -half; i <= half; i++) {
      const lx = i * cellSize + cellSize / 2;
      const px = cx + lx * cos - ly * sin;
      const py = cy + lx * sin + ly * cos;
      if (px < -cellSize || px > width + cellSize || py < -cellSize || py > height + cellSize) continue;
      const density = sampleDensity(px, py);
      if (density <= minDensity) continue;
      const r = Math.sqrt(density) * maxRadius;
      ctx.globalAlpha = maxAlpha;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function makeArraySampler(
  arr: Float32Array,
  width: number,
  height: number,
): (x: number, y: number) => number {
  return (x: number, y: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || xi >= width || yi < 0 || yi >= height) return 0;
    return arr[yi * width + xi];
  };
}
