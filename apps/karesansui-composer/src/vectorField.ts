import type { Point, SandParams, Stone } from './types';

/**
 * The raking vector field.
 *
 * For every point on the canvas we blend two candidate directions:
 *  - the "concentric" direction: the tangent to a circle centred on a nearby
 *    stone, so lines sweep around the stone like water around a rock.
 *  - the "base" direction: a fixed compass heading representing the plain
 *    raked sand far from any stone.
 *
 * Each stone contributes a weight that fades with distance from its edge
 * (governed by `influence`). When two stones are close together their
 * weighted tangents blend, which is what makes streamlines thread the gap
 * between them instead of just orbiting a single stone.
 */

const TAU = Math.PI * 2;

function normalize(x: number, y: number): Point {
  const len = Math.hypot(x, y);
  if (len < 1e-6) return { x: 1, y: 0 };
  return { x: x / len, y: y / len };
}

/** Smooth falloff from 1 (at the stone surface) to 0 (beyond `influence`). */
function edgeWeight(distanceFromSurface: number, influence: number): number {
  if (distanceFromSurface <= 0) return 1;
  const t = Math.min(1, distanceFromSurface / influence);
  // smoothstep-style ease-out so the handoff to the base field is gentle
  const eased = 1 - t;
  return eased * eased * (3 - 2 * eased);
}

export interface FieldContext {
  stones: Stone[];
  sand: SandParams;
  baseDir: Point;
}

export function buildFieldContext(stones: Stone[], sand: SandParams): FieldContext {
  const rad = (sand.angleDeg * Math.PI) / 180;
  return {
    stones,
    sand,
    baseDir: { x: Math.cos(rad), y: Math.sin(rad) },
  };
}

/**
 * Evaluate the un-perturbed direction field at point p (before undulation).
 * Returns a unit vector, plus the summed stone weight (used by the caller to
 * decide how close the point is to a stone for collision handling).
 */
export function evaluateField(ctx: FieldContext, p: Point): { dir: Point; weight: number } {
  let sumX = 0;
  let sumY = 0;
  let totalWeight = 0;

  for (const stone of ctx.stones) {
    const dx = p.x - stone.x;
    const dy = p.y - stone.y;
    const dist = Math.hypot(dx, dy);
    const distFromSurface = dist - stone.radius;
    if (distFromSurface > ctx.sand.influence) continue;

    const w = edgeWeight(Math.max(0, distFromSurface), ctx.sand.influence);
    if (w <= 0) continue;

    // tangent = radial vector rotated 90deg; sign chosen so flow direction
    // is consistent (counter-clockwise) which reads as a natural sweep
    const radial = dist < 1e-6 ? { x: 1, y: 0 } : { x: dx / dist, y: dy / dist };
    const tangent = { x: -radial.y, y: radial.x };

    sumX += tangent.x * w;
    sumY += tangent.y * w;
    totalWeight += w;
  }

  const clampedWeight = Math.min(1, totalWeight);
  const baseWeight = 1 - clampedWeight;
  const finalX = sumX + ctx.baseDir.x * baseWeight;
  const finalY = sumY + ctx.baseDir.y * baseWeight;

  return { dir: normalize(finalX, finalY), weight: clampedWeight };
}

/**
 * Full field sample including the sinusoidal undulation, parameterised by
 * arc-length travelled `s` along the current streamline.
 */
export function sampleField(ctx: FieldContext, p: Point, s: number): Point {
  const { dir } = evaluateField(ctx, p);
  const { amplitude, period } = ctx.sand;
  if (amplitude <= 0 || period <= 0) return dir;

  const wobble = Math.sin((TAU * s) / period);
  const curvature = (wobble * amplitude) / period; // small-angle rotation proxy
  const angle = Math.atan2(dir.y, dir.x) + curvature;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

/** Push a point back out of any stone it has drifted into (soft collision). */
export function resolveStoneCollision(stones: Stone[], p: Point, margin: number): Point {
  let out = p;
  for (const stone of stones) {
    const dx = out.x - stone.x;
    const dy = out.y - stone.y;
    const dist = Math.hypot(dx, dy);
    const minDist = stone.radius + margin;
    if (dist < minDist) {
      const dir = dist < 1e-6 ? { x: 1, y: 0 } : { x: dx / dist, y: dy / dist };
      out = { x: stone.x + dir.x * minDist, y: stone.y + dir.y * minDist };
    }
  }
  return out;
}

export function isInsideAnyStone(stones: Stone[], p: Point, margin: number): boolean {
  for (const stone of stones) {
    const dist = Math.hypot(p.x - stone.x, p.y - stone.y);
    if (dist < stone.radius + margin) return true;
  }
  return false;
}
