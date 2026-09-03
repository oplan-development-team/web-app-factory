import { hashSeed, mulberry32 } from '../lib/prng';

/**
 * A CSS polygon() clip-path with a hand-torn "deckle edge" wobble, plus a
 * small deterministic tilt — both keyed off `seed` so a given print always
 * renders with the same silhouette.
 */
export function deckleEdgeFor(seed: string): { clipPath: string; tilt: number } {
  const rand = mulberry32(hashSeed(seed));
  const points: string[] = [];
  const perSide = 6;
  const sides: Array<[number, number, number, number]> = [
    [0, 0, 1, 0], // top
    [1, 0, 1, 1], // right
    [1, 1, 0, 1], // bottom
    [0, 1, 0, 0], // left
  ];
  for (const [x0, y0, x1, y1] of sides) {
    for (let i = 0; i < perSide; i++) {
      const t = i / perSide;
      const jitter = (rand() - 0.5) * 3.2;
      const x = (x0 + (x1 - x0) * t) * 100;
      const y = (y0 + (y1 - y0) * t) * 100;
      const nx = y1 - y0;
      const ny = -(x1 - x0);
      points.push(`${(x + nx * jitter).toFixed(1)}% ${(y + ny * jitter).toFixed(1)}%`);
    }
  }
  const tilt = (rand() - 0.5) * 5.5;
  return { clipPath: `polygon(${points.join(', ')})`, tilt };
}
