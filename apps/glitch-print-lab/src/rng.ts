// Deterministic PRNG (mulberry32). Given the same seed, produces the same
// sequence every time — this is what lets a given SIGNAL SEED reproduce an
// identical corruption pattern, while REROLL (new seed) produces a
// completely different one.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export function seedToHex(seed: number): string {
  return '0x' + seed.toString(16).toUpperCase().padStart(8, '0');
}
