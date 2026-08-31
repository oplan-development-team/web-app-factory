// Self-implemented value noise (no external noise/graphics libraries).
// A permutation table maps lattice coordinates to a pseudo-random scalar,
// which is then smoothly interpolated in 3D (x, y, time) with a quintic
// fade curve. fbm() layers several octaves for organic, aurora-like
// turbulence.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class ValueNoise3D {
  private perm: Uint8Array;
  private grad: Float32Array;

  constructor(seed = 1337) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    this.grad = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.grad[i] = rand();
    }
  }

  private hash(x: number, y: number, z: number): number {
    const h = this.perm[(this.perm[(this.perm[x & 255] + y) & 255] + z) & 255];
    return this.grad[h];
  }

  /** Smoothly varying value roughly in [0, 1]. */
  noise(x: number, y: number, z: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const xf = x - xi;
    const yf = y - yi;
    const zf = z - zi;
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);

    const c000 = this.hash(xi, yi, zi);
    const c100 = this.hash(xi + 1, yi, zi);
    const c010 = this.hash(xi, yi + 1, zi);
    const c110 = this.hash(xi + 1, yi + 1, zi);
    const c001 = this.hash(xi, yi, zi + 1);
    const c101 = this.hash(xi + 1, yi, zi + 1);
    const c011 = this.hash(xi, yi + 1, zi + 1);
    const c111 = this.hash(xi + 1, yi + 1, zi + 1);

    const x00 = lerp(c000, c100, u);
    const x10 = lerp(c010, c110, u);
    const x01 = lerp(c001, c101, u);
    const x11 = lerp(c011, c111, u);

    const y0 = lerp(x00, x10, v);
    const y1 = lerp(x01, x11, v);

    return lerp(y0, y1, w);
  }

  /** Fractal Brownian Motion: layered octaves for organic turbulence. */
  fbm(
    x: number,
    y: number,
    z: number,
    octaves = 4,
    gain = 0.55,
    lacunarity = 2.05,
  ): number {
    let amplitude = 1;
    let frequency = 1;
    let sum = 0;
    let max = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise(x * frequency, y * frequency, z * frequency) * amplitude;
      max += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return sum / max;
  }
}
