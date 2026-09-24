// Geometry pipeline: raw pointer/stamp points -> closed loop -> evenly
// resampled waveform buffers (X = left channel, Y = right channel).
//
// The "sharpness" parameter controls how much circular moving-average
// smoothing is applied to a densely resampled version of the loop before
// it is down-sampled to the final N-point waveform. Smoothing rounds off
// corners, which removes high harmonic content (a smoothed star becomes
// closer to a pure circle/sine tone). Sharp corners left intact add energy
// at higher partials, producing a brighter/buzzier tone. This is what
// makes the drawn shape audibly distinguishable.

export interface Point {
  x: number;
  y: number;
}

export const RESAMPLE_N = 512;
const DENSE_N = 2048;
const MAX_SMOOTH_FRACTION = 0.07;

function closeLoop(points: Point[]): Point[] {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  const dx = first.x - last.x;
  const dy = first.y - last.y;
  if (dx * dx + dy * dy > 1e-6) {
    return [...points, { x: first.x, y: first.y }];
  }
  return points;
}

/** Resample a closed polyline into `count` points evenly spaced by arc length. */
function resampleEvenArcLength(points: Point[], count: number): Point[] {
  if (points.length < 2) {
    return new Array(count).fill({ x: 0, y: 0 });
  }
  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segLengths.push(len);
    total += len;
  }
  if (total < 1e-6) {
    return new Array(count).fill(points[0]);
  }
  const out: Point[] = [];
  const step = total / count;
  let segIndex = 0;
  let segStart = 0;
  let target = 0;
  for (let i = 0; i < count; i++) {
    while (
      segIndex < segLengths.length - 1 &&
      segStart + segLengths[segIndex] < target
    ) {
      segStart += segLengths[segIndex];
      segIndex++;
    }
    const segLen = segLengths[segIndex] || 1e-9;
    const t = Math.min(1, Math.max(0, (target - segStart) / segLen));
    const a = points[segIndex];
    const b = points[segIndex + 1] ?? points[0];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    target += step;
  }
  return out;
}

/** Circular (wrap-around) moving average — smooths corners of a closed curve. */
function smoothCircular(points: Point[], radius: number): Point[] {
  if (radius <= 0) return points;
  const n = points.length;
  const out: Point[] = new Array(n);
  const windowSize = radius * 2 + 1;
  for (let i = 0; i < n; i++) {
    let sx = 0;
    let sy = 0;
    for (let k = -radius; k <= radius; k++) {
      const idx = ((i + k) % n + n) % n;
      sx += points[idx].x;
      sy += points[idx].y;
    }
    out[i] = { x: sx / windowSize, y: sy / windowSize };
  }
  return out;
}

function normalizeAmplitude(points: Point[], targetPeak = 0.95): Point[] {
  let maxMag = 0;
  for (const p of points) {
    const mag = Math.sqrt(p.x * p.x + p.y * p.y);
    if (mag > maxMag) maxMag = mag;
  }
  if (maxMag < 1e-6) return points;
  const scale = targetPeak / maxMag;
  return points.map((p) => ({ x: p.x * scale, y: p.y * scale }));
}

export interface Waveform {
  x: Float32Array;
  y: Float32Array;
}

/**
 * Build the final N-point waveform buffer from a raw stroke/stamp point list.
 * sharpness: 0 (rounded/smoothed, fewer harmonics) .. 1 (corners preserved, brighter)
 */
export function buildWaveform(
  rawPoints: Point[],
  sharpness: number,
  n: number = RESAMPLE_N
): Waveform {
  if (rawPoints.length < 3) {
    return { x: new Float32Array(n), y: new Float32Array(n) };
  }
  const closed = closeLoop(rawPoints);
  const dense = resampleEvenArcLength(closed, DENSE_N);
  const clampedSharpness = Math.min(1, Math.max(0, sharpness));
  const radius = Math.round(DENSE_N * MAX_SMOOTH_FRACTION * (1 - clampedSharpness));
  const smoothed = smoothCircular(dense, radius);
  const normalized = normalizeAmplitude(smoothed);

  const step = DENSE_N / n;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(i * step) % DENSE_N;
    x[i] = Math.max(-1, Math.min(1, normalized[idx].x));
    y[i] = Math.max(-1, Math.min(1, normalized[idx].y));
  }
  return { x, y };
}

export function isPathUsable(rawPoints: Point[]): boolean {
  return rawPoints.length >= 3;
}
