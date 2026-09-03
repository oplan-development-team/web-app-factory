/**
 * Deterministic seeded PRNG (mulberry32). Used anywhere we want organic-looking
 * variation (ring width jitter, teardrop swatch silhouettes, deckle edges,
 * gallery card tilt) that must still be *reproducible* — the same seed always
 * yields the same shape, so a re-render at export resolution matches the
 * on-screen preview exactly.
 */
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

/** Hash a string into a 32-bit seed, for keying the PRNG off ids. */
export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
