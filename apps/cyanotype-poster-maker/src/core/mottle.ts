import { fbm2D } from './random';

/**
 * Returns a sampler for the "hand-brushed" ink-wash unevenness: a slow,
 * organic field in 0..1 evaluated over normalized (0..1) image
 * coordinates. Used to modulate ink opacity per pixel so flat digital
 * fills never read as machine-uniform.
 */
export function createMottleSampler(seed: number): (nx: number, ny: number) => number {
  return (nx: number, ny: number) => fbm2D(nx * 3.4, ny * 3.4, seed + 4021, 3);
}
