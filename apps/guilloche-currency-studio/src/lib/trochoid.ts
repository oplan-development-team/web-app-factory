// Self-implemented hypotrochoid / epitrochoid curve sampler. No drawing
// library / spirograph package is used anywhere — this module is the entire
// mathematical core of the guilloche engine.
//
// Hypotrochoid (small circle of radius r rolling INSIDE big circle R):
//   x(θ) = (R - r) cosθ + d cos( ((R - r) / r) θ )
//   y(θ) = (R - r) sinθ - d sin( ((R - r) / r) θ )
//
// Epitrochoid (small circle of radius r rolling OUTSIDE big circle R):
//   x(θ) = (R + r) cosθ - d cos( ((R + r) / r) θ )
//   y(θ) = (R + r) sinθ - d sin( ((R + r) / r) θ )

export type TrochoidKind = 'hypo' | 'epi';

export interface TrochoidParams {
  kind: TrochoidKind;
  /** Fixed circle radius. */
  R: number;
  /** Rolling circle radius. */
  r: number;
  /** Pen distance from rolling circle center. */
  d: number;
  /** Extra samples per revolution (precision). */
  samplesPerTurn: number;
  /** Phase offset in radians. */
  phase?: number;
  /** Hard cap on total sample points (perf guard). */
  maxPoints?: number;
}

export interface Point {
  x: number;
  y: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

/**
 * Number of full 2π revolutions of θ needed for the curve to close, given
 * integer-ish R and r (standard trochoid periodicity result).
 */
export function revolutionsToClose(R: number, r: number): number {
  const g = gcd(Math.round(R), Math.round(r));
  const revs = Math.round(r) / g;
  return Math.max(1, Math.min(revs, 48)); // cap so pathological seeds can't explode
}

/** Sample a hypotrochoid/epitrochoid curve into a flat point list. */
export function sampleTrochoid(p: TrochoidParams): Point[] {
  const { kind, R, r, d } = p;
  const phase = p.phase ?? 0;
  const revs = revolutionsToClose(R, r);
  const thetaMax = 2 * Math.PI * revs;
  const totalSteps = Math.min(
    p.maxPoints ?? 6000,
    Math.max(64, Math.round(revs * p.samplesPerTurn))
  );
  const dTheta = thetaMax / totalSteps;

  const pts: Point[] = new Array(totalSteps + 1);
  const sign = kind === 'hypo' ? -1 : 1;
  const Rr = R + sign * r;
  const ratio = Rr / r;

  for (let i = 0; i <= totalSteps; i++) {
    const theta = i * dTheta + phase;
    const x = Rr * Math.cos(theta) - sign * d * Math.cos(ratio * theta);
    const y = Rr * Math.sin(theta) - d * Math.sin(ratio * theta);
    pts[i] = { x, y };
  }
  return pts;
}

/** Rotate + scale + translate a point list in place into a new array. */
export function transformPoints(
  pts: Point[],
  opts: { scale?: number; scaleX?: number; scaleY?: number; rotate?: number; tx?: number; ty?: number }
): Point[] {
  const scaleX = opts.scaleX ?? opts.scale ?? 1;
  const scaleY = opts.scaleY ?? opts.scale ?? 1;
  const rot = opts.rotate ?? 0;
  const tx = opts.tx ?? 0;
  const ty = opts.ty ?? 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return pts.map(({ x, y }) => {
    const sx = x * scaleX;
    const sy = y * scaleY;
    return {
      x: sx * cos - sy * sin + tx,
      y: sx * sin + sy * cos + ty,
    };
  });
}
