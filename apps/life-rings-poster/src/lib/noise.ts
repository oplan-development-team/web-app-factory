/**
 * Seeded PRNG + a small periodic value-noise implementation.
 * No external dependency — this is the whole point: every poster is fully
 * reproducible from its (birthYear, events) input alone.
 */

/** mulberry32 — small, fast, decent-quality 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string/number hash -> uint32 seed. */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Smooth, periodic (angle in [0, 2π) wraps cleanly) 1D value noise built
 * from a ring of random control points interpolated with a smoothstep
 * curve. Deterministic for a given rng.
 */
export class PeriodicNoise1D {
  private readonly values: number[];

  constructor(rng: () => number, private readonly points: number = 16) {
    this.values = Array.from({ length: points }, () => rng() * 2 - 1);
  }

  sample(angle: number): number {
    const twoPi = Math.PI * 2;
    const a = ((angle % twoPi) + twoPi) % twoPi;
    const t = (a / twoPi) * this.points;
    const i0 = Math.floor(t) % this.points;
    const i1 = (i0 + 1) % this.points;
    const f = t - Math.floor(t);
    const smooth = f * f * (3 - 2 * f);
    return this.values[i0] * (1 - smooth) + this.values[i1] * smooth;
  }
}

export interface NoiseLayer {
  noise: PeriodicNoise1D;
  weight: number;
}

/** Fractional-brownian-motion-ish sum of a few octaves. Returns roughly [-1, 1]. */
export function fbm(layers: NoiseLayer[], angle: number): number {
  let sum = 0;
  let norm = 0;
  for (const { noise, weight } of layers) {
    sum += noise.sample(angle) * weight;
    norm += weight;
  }
  return norm === 0 ? 0 : sum / norm;
}

/** Build a 2-octave fbm noise source seeded deterministically. */
export function makeRingNoise(
  seed: number,
  finePoints = 20,
  coarsePoints = 7,
  fineWeight = 0.4,
): NoiseLayer[] {
  const rngCoarse = mulberry32(seed);
  const rngFine = mulberry32(seed ^ 0x9e3779b9);
  return [
    { noise: new PeriodicNoise1D(rngCoarse, coarsePoints), weight: 1 },
    { noise: new PeriodicNoise1D(rngFine, finePoints), weight: fineWeight },
  ];
}

/** Shortest signed angular distance from a to b, in (-π, π]. */
export function angleDelta(a: number, b: number): number {
  const twoPi = Math.PI * 2;
  let d = (b - a) % twoPi;
  if (d > Math.PI) d -= twoPi;
  if (d < -Math.PI) d += twoPi;
  return d;
}
