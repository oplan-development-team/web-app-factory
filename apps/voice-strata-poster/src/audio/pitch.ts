/**
 * Autocorrelation-based fundamental frequency estimator (ACF2+ style),
 * a well-known self-contained technique for near-real-time pitch detection
 * on a single time-domain buffer. No external libraries.
 *
 * Returns the estimated F0 in Hz, or -1 if no confident periodicity was found
 * (e.g. silence, noise, unvoiced consonants).
 */
export function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length;

  // RMS gate: skip clearly silent/near-silent buffers.
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.008) return -1;

  // Trim leading/trailing near-zero samples to tighten the analysis window.
  let start = 0;
  let end = SIZE - 1;
  const trimThreshold = 0.2;
  while (start < SIZE / 2 && Math.abs(buffer[start]) < trimThreshold) start++;
  while (end > SIZE / 2 && Math.abs(buffer[end]) < trimThreshold) end--;

  const trimmed = buffer.slice(start, end + 1);
  const n = trimmed.length;
  if (n < 64) return -1;

  const c = new Float32Array(n);
  for (let lag = 0; lag < n; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) {
      sum += trimmed[i] * trimmed[i + lag];
    }
    c[lag] = sum;
  }

  // Find the first significant dip after lag 0, then the peak after it.
  let d = 0;
  while (d + 1 < n && c[d] > c[d + 1]) d++;

  let maxVal = -Infinity;
  let maxPos = -1;
  for (let i = d; i < n; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }

  if (maxPos <= 0) return -1;

  // Parabolic interpolation around the peak for sub-sample precision.
  let T0 = maxPos;
  const x1 = c[T0 - 1] ?? c[T0];
  const x2 = c[T0];
  const x3 = c[T0 + 1] ?? c[T0];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a !== 0) T0 = T0 - b / (2 * a);

  const freq = sampleRate / T0;

  // Human voice fundamental plausibility range.
  if (freq < 50 || freq > 800) return -1;
  return freq;
}

/** Convert a frequency ratio to semitone distance, used for jitter measurement. */
export function hzToSemitone(hz: number): number {
  return 12 * Math.log2(hz / 440);
}
