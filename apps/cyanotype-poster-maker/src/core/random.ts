/**
 * Deterministic pseudo-random helpers used to generate the paper fiber
 * texture, ink wash mottling, and the irregular "hand-painted" edge.
 * No external noise library — a small hash-based value noise is enough
 * for the coherent, organic irregularity this piece needs.
 */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [min, max) の浮動小数 */
export function randFloat(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** [min, max] の整数 */
export function randInt(rng: Rng, min: number, max: number): number {
  return Math.min(max, min + Math.floor(rng() * (max - min + 1)));
}

/** 配列から 1 つ決定的に選ぶ */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick: 候補が空です');
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[index] as T;
}

/** -amount 〜 +amount の揺らぎ */
export function jitter(rng: Rng, amount: number): number {
  return (rng() * 2 - 1) * amount;
}

function hash2(x: number, y: number, seed: number): number {
  let n = x * 374761393 + y * 668265263 + seed * 2246822519;
  n = (n ^ (n >>> 13)) * 1274126177;
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967295;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Coherent 2D value noise in the 0..1 range. */
export function valueNoise2D(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const v00 = hash2(xi, yi, seed);
  const v10 = hash2(xi + 1, yi, seed);
  const v01 = hash2(xi, yi + 1, seed);
  const v11 = hash2(xi + 1, yi + 1, seed);
  const u = smoothstep(xf);
  const v = smoothstep(yf);
  return lerp(lerp(v00, v10, u), lerp(v01, v11, u), v);
}

/** Fractal Brownian motion built from stacked octaves of value noise. */
export function fbm2D(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2D(x * frequency, y * frequency, seed + i * 101) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / max;
}
