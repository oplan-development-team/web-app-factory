import type { DistortionField, DropRecord, InkDefinition, InkId } from './types';
import { toroidalDistance, wrapCoord } from './toroidal';
import { clampMagnitude, sampleFieldBilinear } from './field';
import { mulberry32 } from './prng';

export const INK_PALETTE: InkDefinition[] = [
  { id: 'sumi', name: '墨', label: 'Sumi', color: [30, 27, 26], isResist: false },
  { id: 'ai', name: '藍', label: 'Ai', color: [40, 68, 92], isResist: false },
  { id: 'shu', name: '朱', label: 'Shu', color: [179, 69, 44], isResist: false },
  { id: 'kondo', name: '金土', label: 'Kondo', color: [176, 141, 87], isResist: false },
  { id: 'matsuba', name: '松葉', label: 'Matsuba', color: [68, 88, 58], isResist: false },
  { id: 'dousa', name: '礬水', label: 'Dousa', color: [236, 229, 216], isResist: true },
];

export const INK_BY_ID: Record<InkId, InkDefinition> = Object.fromEntries(
  INK_PALETTE.map((ink) => [ink.id, ink])
) as Record<InkId, InkDefinition>;

/** Background water/washi tone the basin evaluates against. */
export const WASHI_BG: readonly [number, number, number] = [236, 229, 216];

const SAME_SPOT_THRESHOLD = 0.1;
const RADIUS_BASE = 0.05;
const RADIUS_STEP = 0.026;
const RADIUS_MAX = 0.44;
const RING_WIDTH_BASE = 0.016;
const RING_WIDTH_STEP = 0.0016;
const RESIST_WIDTH_MULTIPLIER = 1.7;

export interface DropRenderParams {
  radius: number;
  width: number;
}

/**
 * Derive each drop's ring radius/width from its position in the placement
 * history alone (no extra fields stored on DropRecord). Successive drops
 * placed near the same spot (as during a long-press) nest outward, which is
 * what produces the tree-ring look of a real suminagashi core.
 */
export function computeDropRenderParams(drops: DropRecord[]): DropRenderParams[] {
  const params: DropRenderParams[] = new Array(drops.length);
  for (let i = 0; i < drops.length; i++) {
    const d = drops[i];
    let localIndex = 0;
    for (let k = 0; k < i; k++) {
      const prev = drops[k];
      if (toroidalDistance(d.x, d.y, prev.x, prev.y) < SAME_SPOT_THRESHOLD) {
        localIndex++;
      }
    }
    const jitter = (mulberry32(d.seq * 2654435761 + 17)() - 0.5) * 0.006;
    const radius = Math.min(RADIUS_BASE + localIndex * RADIUS_STEP + jitter, RADIUS_MAX);
    const ink = INK_BY_ID[d.ink];
    const baseWidth = RING_WIDTH_BASE + localIndex * RING_WIDTH_STEP;
    const width = ink.isResist ? baseWidth * RESIST_WIDTH_MULTIPLIER : baseWidth;
    params[i] = { radius, width };
  }
  return params;
}

/** Gaussian ring-band intensity: peaks at distance === radius. */
export function ringProfile(distance: number, radius: number, width: number): number {
  const d = distance - radius;
  return Math.exp(-(d * d) / (2 * width * width));
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Evaluate the composited ink color at an *original* (pre-warp) basin
 * coordinate, compositing every drop in temporal order. Later drops (higher
 * index) paint over earlier ones where their ring bands overlap — this is
 * exactly how a 礬水 (dousa) resist "pushes aside" ink beneath it to leave a
 * blank ring.
 */
export function evaluateInkAt(
  origX: number,
  origY: number,
  drops: DropRecord[],
  params: DropRenderParams[],
  background: readonly [number, number, number] = WASHI_BG
): [number, number, number] {
  let r = background[0];
  let g = background[1];
  let b = background[2];

  for (let i = 0; i < drops.length; i++) {
    const d = drops[i];
    const p = params[i];
    const dist = toroidalDistance(origX, origY, d.x, d.y);
    if (dist > p.radius + p.width * 3.2) continue;
    const intensity = ringProfile(dist, p.radius, p.width);
    if (intensity < 0.004) continue;

    const ink = INK_BY_ID[d.ink];
    if (ink.isResist) {
      r = mix(r, background[0], intensity);
      g = mix(g, background[1], intensity);
      b = mix(b, background[2], intensity);
    } else {
      r = mix(r, ink.color[0], intensity);
      g = mix(g, ink.color[1], intensity);
      b = mix(b, ink.color[2], intensity);
    }
  }

  return [r, g, b];
}

/**
 * Back-project a *current* basin coordinate through the distortion field to
 * find where that point's material originally came from, then evaluate the
 * ink function there. This single-step backward warp (no iterative
 * advection) is what the spec means by "re-evaluating the concentric ink
 * function at the field-derived original coordinate" every frame.
 */
export function evaluateBasinAt(
  u: number,
  v: number,
  drops: DropRecord[],
  params: DropRenderParams[],
  field: DistortionField,
  background: readonly [number, number, number] = WASHI_BG
): [number, number, number] {
  const [rawDx, rawDy] = sampleFieldBilinear(field, u, v);
  const [dx, dy] = clampMagnitude(rawDx, rawDy);
  const origX = wrapCoord(u - dx);
  const origY = wrapCoord(v - dy);
  return evaluateInkAt(origX, origY, drops, params, background);
}
