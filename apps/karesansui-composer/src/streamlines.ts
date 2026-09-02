import type { Point, SandParams, Stone, Streamline } from './types';
import {
  buildFieldContext,
  isInsideAnyStone,
  resolveStoneCollision,
  sampleField,
} from './vectorField';

const STEP_LENGTH = 6; // logical px per RK4 step
const STONE_MARGIN = 7; // keep lines this far from a stone's surface
const CANVAS_MARGIN = 10; // allow lines to travel slightly past the edge before clipping

interface TraceState {
  p: Point;
  s: number; // arc length travelled so far, signed by direction of travel
}

function rk4Step(
  ctxDir: (p: Point, s: number) => Point,
  state: TraceState,
  ds: number,
): Point {
  const { p, s } = state;
  const k1 = ctxDir(p, s);
  const p2 = { x: p.x + (k1.x * ds) / 2, y: p.y + (k1.y * ds) / 2 };
  const k2 = ctxDir(p2, s + ds / 2);
  const p3 = { x: p.x + (k2.x * ds) / 2, y: p.y + (k2.y * ds) / 2 };
  const k3 = ctxDir(p3, s + ds / 2);
  const p4 = { x: p.x + k3.x * ds, y: p.y + k3.y * ds };
  const k4 = ctxDir(p4, s + ds);

  return {
    x: p.x + ((k1.x + 2 * k2.x + 2 * k3.x + k4.x) / 6) * ds,
    y: p.y + ((k1.y + 2 * k2.y + 2 * k3.y + k4.y) / 6) * ds,
  };
}

function traceDirection(
  seed: Point,
  stones: Stone[],
  fieldCtx: ReturnType<typeof buildFieldContext>,
  sign: 1 | -1,
  width: number,
  height: number,
  maxSteps: number,
): Point[] {
  const path: Point[] = [];
  const state: TraceState = { p: seed, s: 0 };
  const dirFn = (p: Point, s: number) => {
    const d = sampleField(fieldCtx, p, s * sign);
    return { x: d.x * sign, y: d.y * sign };
  };

  for (let i = 0; i < maxSteps; i++) {
    let next = rk4Step(dirFn, state, STEP_LENGTH);
    next = resolveStoneCollision(stones, next, STONE_MARGIN);

    if (
      next.x < -CANVAS_MARGIN ||
      next.x > width + CANVAS_MARGIN ||
      next.y < -CANVAS_MARGIN ||
      next.y > height + CANVAS_MARGIN
    ) {
      break;
    }

    path.push(next);
    state.p = next;
    state.s += STEP_LENGTH;
  }

  return path;
}

/**
 * Trace one streamline through `seed` in both directions and stitch the
 * halves into a single ordered polyline.
 */
function traceStreamline(
  seed: Point,
  stones: Stone[],
  fieldCtx: ReturnType<typeof buildFieldContext>,
  width: number,
  height: number,
  maxSteps: number,
): Streamline {
  const forward = traceDirection(seed, stones, fieldCtx, 1, width, height, maxSteps);
  const backward = traceDirection(seed, stones, fieldCtx, -1, width, height, maxSteps);
  backward.reverse();
  return [...backward, seed, ...forward];
}

export interface StreamlineOptions {
  width: number;
  height: number;
}

/**
 * Build the full set of raked streamlines for the current garden. Seeds are
 * placed on a staggered grid (offset every other row) spaced by
 * `sand.density`, skipping any seed that already sits inside a stone.
 */
export function generateStreamlines(
  stones: Stone[],
  sand: SandParams,
  opts: StreamlineOptions,
): Streamline[] {
  const { width, height } = opts;
  const fieldCtx = buildFieldContext(stones, sand);
  const spacing = Math.max(8, sand.density);
  const diagonal = Math.hypot(width, height);
  const maxSteps = Math.ceil((diagonal * 0.6) / STEP_LENGTH);

  const lines: Streamline[] = [];
  let row = 0;
  for (let y = spacing / 2; y < height; y += spacing) {
    const offset = row % 2 === 0 ? 0 : spacing / 2;
    for (let x = spacing / 2 + offset; x < width; x += spacing) {
      const seed = { x, y };
      if (isInsideAnyStone(stones, seed, STONE_MARGIN)) continue;
      const line = traceStreamline(seed, stones, fieldCtx, width, height, maxSteps);
      if (line.length > 2) lines.push(line);
    }
    row += 1;
  }

  return lines;
}
