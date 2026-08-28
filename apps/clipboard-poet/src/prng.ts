/**
 * mulberry32 — small, fast, seedable PRNG.
 * Each "print poem" press seeds a fresh instance so the same fragment pool
 * reliably produces a different arrangement every time, while a run itself
 * stays internally deterministic (useful for reasoning about a single output).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function freshSeed(): number {
  // Combine wall-clock time with an extra random tick so two prints fired in
  // the same millisecond still diverge.
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/** Fisher-Yates shuffle using an injected RNG, returns a new array. */
export function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pick<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)];
}
