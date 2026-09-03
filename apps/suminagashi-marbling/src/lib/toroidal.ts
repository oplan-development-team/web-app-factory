/**
 * Toroidal (periodic-boundary) math. The basin's visible area IS one seamless
 * tile: every distance/coordinate calculation wraps at [0, 1) so a pattern
 * that drifts off the right edge re-enters from the left, top<->bottom too.
 */

/** Wrap a coordinate into [0, 1). */
export function wrapCoord(v: number): number {
  const w = v % 1;
  return w < 0 ? w + 1 : w;
}

/** Shortest signed delta a-b on a circular [0,1) domain, in [-0.5, 0.5). */
export function wrapDelta(a: number, b: number): number {
  let d = a - b;
  d -= Math.round(d);
  return d;
}

/** Shortest toroidal distance between two normalized points. */
export function toroidalDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = wrapDelta(ax, bx);
  const dy = wrapDelta(ay, by);
  return Math.hypot(dx, dy);
}
