/**
 * Minimal self-contained value-noise + PRNG utilities.
 *
 * No external noise/physics library is used anywhere in this app (per the
 * prototype's core requirement) — the flame turbulence and wax-drip
 * randomness are all driven by the tiny generators in this file.
 */

/** Deterministic 32-bit PRNG (mulberry32). Good enough for per-candle seeding. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a single integer lattice point to a pseudo-random float in [0, 1). */
function hash1(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 1D value noise: smooth pseudo-random signal, continuous in x.
 * Each integer lattice point gets a fixed random value; between lattice
 * points we interpolate with a smoothstep easing curve.
 */
export function valueNoise1D(x: number, seed = 0): number {
  const xs = x + seed * 1013.0;
  const xi = Math.floor(xs);
  const xf = xs - xi;
  const v0 = hash1(xi);
  const v1 = hash1(xi + 1);
  return lerp(v0, v1, smoothstep(xf));
}

/**
 * Fractal Brownian Motion: sum of several octaves of value noise for a
 * richer, less mechanical flicker. Returns roughly [0, 1].
 */
export function fbm1D(x: number, octaves = 3, seed = 0): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let ampTotal = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise1D(x * freq, seed + i * 7.13) * amp;
    ampTotal += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / ampTotal;
}

/** Maps a [0,1] value noise sample to a signed [-1, 1] range. */
export function signedNoise(x: number, seed = 0): number {
  return valueNoise1D(x, seed) * 2 - 1;
}
