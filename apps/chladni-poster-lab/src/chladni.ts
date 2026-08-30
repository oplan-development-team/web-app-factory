// Chladni plate physics — displacement field, node detection, frequency estimate.
//
// Square plate: exact standard Chladni free-plate mode formula
//   z(x, y) = cos(n*pi*x) * cos(m*pi*y) - cos(m*pi*x) * cos(n*pi*y)
// with x, y in normalized plate coordinates [-1, 1].
//
// Circular plate: NOT a rigorous Bessel-function solution. We reuse the same
// square displacement field and clip it to the inscribed circle. This is an
// approximation used purely for a plausible-looking node pattern — it is
// documented as such in the README and is intentionally not claimed to be
// physically exact in the UI copy.

export type PlateShape = 'square' | 'circle';

export interface PlateParams {
  n: number;
  m: number;
  shape: PlateShape;
  /** plate size in millimetres — side length for square, diameter for circle */
  sizeMm: number;
}

/** Raw (unclipped) square-plate displacement field, x/y in [-1, 1]. */
export function fieldValue(n: number, m: number, x: number, y: number): number {
  return (
    Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) -
    Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y)
  );
}

/** Whether a normalized point lies within the active plate domain. */
export function inDomain(shape: PlateShape, x: number, y: number): boolean {
  if (shape === 'circle') {
    return x * x + y * y <= 1;
  }
  return x >= -1 && x <= 1 && y >= -1 && y <= 1;
}

/**
 * Approximate mode frequency, using the classic square-membrane wave-equation
 * form f = (v / 2L) * sqrt(n^2 + m^2), where L is the plate size in metres
 * and v is a fixed nominal phase-velocity constant for this simulated
 * "material". This is a physically-motivated approximation, not a
 * material-calibrated measurement — presented on the poster as such.
 */
export const PHASE_VELOCITY_M_S = 60;

export function estimateFrequencyHz(n: number, m: number, sizeMm: number): number {
  const lengthM = sizeMm / 1000;
  const k = PHASE_VELOCITY_M_S / (2 * lengthM);
  return k * Math.sqrt(n * n + m * m);
}

/** Central-difference gradient of the (unclipped) field at (x, y). */
export function fieldGradient(
  n: number,
  m: number,
  x: number,
  y: number,
  eps = 1e-3
): [number, number] {
  const dzdx = (fieldValue(n, m, x + eps, y) - fieldValue(n, m, x - eps, y)) / (2 * eps);
  const dzdy = (fieldValue(n, m, x, y + eps) - fieldValue(n, m, x, y - eps)) / (2 * eps);
  return [dzdx, dzdy];
}
