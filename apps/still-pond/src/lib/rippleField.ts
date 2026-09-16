/**
 * Deterministic, dependency-free procedural ripple pattern used to build the
 * water's normal map (FR-1, FR-3: no external texture/HDRI files allowed —
 * see docs/specs/still-pond.md "データ・API"). The numeric core is kept as
 * plain arrays so it can be unit-tested without touching THREE.DataTexture;
 * a thin adapter in src/scene wraps the output into a real texture.
 */

export interface RippleOctave {
  freqX: number;
  freqY: number;
  phase: number;
  phaseY: number;
  amplitude: number;
}

/** Small seeded PRNG (mulberry32) so the ripple pattern is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a handful of octaves with integer x/y frequencies (in cycles per
 * texture width/height) so the resulting field tiles seamlessly at the
 * texture edges, and decreasing amplitude per octave for a natural ripple
 * look. Each octave is later evaluated as a *product* of an X-wave and a
 * Y-wave (see sampleRippleHeight) rather than a sum, which avoids the
 * single-direction "plane wave" look (visible as hard diagonal stripes)
 * that a purely additive sin(fx·u + fy·v) term produces.
 */
export function buildRippleOctaves(seed: number, count = 4): RippleOctave[] {
  const rand = mulberry32(seed);
  const octaves: RippleOctave[] = [];
  for (let i = 0; i < count; i++) {
    octaves.push({
      freqX: 1 + Math.floor(rand() * 7),
      freqY: 1 + Math.floor(rand() * 7),
      phase: rand() * Math.PI * 2,
      phaseY: rand() * Math.PI * 2,
      amplitude: 1 / (i + 1),
    });
  }
  return octaves;
}

/** Samples the summed octave height at normalized (u, v) in [0, 1). */
export function sampleRippleHeight(octaves: RippleOctave[], u: number, v: number): number {
  let height = 0;
  for (const octave of octaves) {
    const waveX = Math.sin(2 * Math.PI * octave.freqX * u + octave.phase);
    const waveY = Math.sin(2 * Math.PI * octave.freqY * v + octave.phaseY);
    height += octave.amplitude * waveX * waveY;
  }
  return height;
}

/** Rasterizes the ripple octaves into a `size`x`size` height field. */
export function computeHeightField(size: number, seed = 1, octaveCount = 10): Float64Array {
  const octaves = buildRippleOctaves(seed, octaveCount);
  const field = new Float64Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      field[y * size + x] = sampleRippleHeight(octaves, x / size, y / size);
    }
  }
  return field;
}

/**
 * Converts a height field into an RGBA tangent-space normal map buffer via
 * central differences, wrapping at the edges so the texture tiles. Flat
 * regions encode to the "pointing straight up" normal (128, 128, 255, 255).
 */
export function heightFieldToNormalRGBA(
  height: Float64Array,
  size: number,
  strength = 2,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const left = height[y * size + ((x - 1 + size) % size)] ?? 0;
      const right = height[y * size + ((x + 1) % size)] ?? 0;
      const up = height[((y - 1 + size) % size) * size + x] ?? 0;
      const down = height[((y + 1) % size) * size + x] ?? 0;

      const dx = (right - left) * strength;
      const dy = (down - up) * strength;
      const nx = -dx;
      const ny = -dy;
      const nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

      const i = (y * size + x) * 4;
      out[i] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      out[i + 3] = 255;
    }
  }
  return out;
}
