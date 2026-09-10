// Lightweight, dependency-free 2D value-noise with fractal Brownian motion.
// This is a hand-rolled approximation of Perlin/Simplex noise -- not a
// faithful implementation of either, but it produces coherent, organic
// gradients that are enough to jitter distance-field boundaries and to
// paint subtle streak/bubble texture into the glass panes.

function hash2(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Coherent 2D value noise in the range [0, 1]. */
export function valueNoise2D(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const tl = hash2(xi, yi, seed);
  const tr = hash2(xi + 1, yi, seed);
  const bl = hash2(xi, yi + 1, seed);
  const br = hash2(xi + 1, yi + 1, seed);

  const u = smooth(xf);
  const v = smooth(yf);

  return lerp(lerp(tl, tr, u), lerp(bl, br, u), v);
}

/** Fractal sum of a few octaves of value noise, range [0, 1]. */
export function fbm2D(x: number, y: number, seed = 0, octaves = 3): number {
  let total = 0;
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  for (let i = 0; i < octaves; i++) {
    total += valueNoise2D(x * freq, y * freq, seed + i * 17.13) * amp;
    sum += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum > 0 ? total / sum : 0;
}
