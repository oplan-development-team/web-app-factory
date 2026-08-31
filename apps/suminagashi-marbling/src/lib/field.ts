import type { CombDensity, DistortionField } from './types';
import { wrapDelta } from './toroidal';

/** Low-res grid the distortion vectors live on; bilinear-sampled at render time. */
export const FIELD_RES = 48;

/** Cap on displacement magnitude per cell, so repeated strokes can't blow up the warp. */
const MAX_DISPLACEMENT = 0.24;

const TOOTH_SPACING: Record<CombDensity, number> = {
  coarse: 0.09,
  medium: 0.055,
  dense: 0.032,
};

export function createField(res: number = FIELD_RES): DistortionField {
  return { res, data: new Float32Array(res * res * 2) };
}

export function cloneField(field: DistortionField): DistortionField {
  return { res: field.res, data: field.data.slice() };
}

export function zeroField(res: number = FIELD_RES): Float32Array {
  return new Float32Array(res * res * 2);
}

function cellIndex(res: number, i: number, j: number): number {
  const ii = ((i % res) + res) % res;
  const jj = ((j % res) + res) % res;
  return (jj * res + ii) * 2;
}

/** Bilinear-sample the (dx, dy) displacement at a normalized toroidal coordinate. */
export function sampleFieldBilinear(field: DistortionField, u: number, v: number): [number, number] {
  const { res, data } = field;
  const fx = ((u % 1) + 1) % 1;
  const fy = ((v % 1) + 1) % 1;
  const gx = fx * res - 0.5;
  const gy = fy * res - 0.5;
  const i0 = Math.floor(gx);
  const j0 = Math.floor(gy);
  const tx = gx - i0;
  const ty = gy - j0;

  const i00 = cellIndex(res, i0, j0);
  const i10 = cellIndex(res, i0 + 1, j0);
  const i01 = cellIndex(res, i0, j0 + 1);
  const i11 = cellIndex(res, i0 + 1, j0 + 1);

  const dx =
    data[i00] * (1 - tx) * (1 - ty) +
    data[i10] * tx * (1 - ty) +
    data[i01] * (1 - tx) * ty +
    data[i11] * tx * ty;
  const dy =
    data[i00 + 1] * (1 - tx) * (1 - ty) +
    data[i10 + 1] * tx * (1 - ty) +
    data[i01 + 1] * (1 - tx) * ty +
    data[i11 + 1] * tx * ty;

  return [dx, dy];
}

/**
 * Clamp a displacement vector's magnitude. Applied where the field is
 * *read* (not where it is written) so commit/subtract stay exact inverses
 * of each other for Undo, regardless of saturation.
 */
export function clampMagnitude(x: number, y: number, max: number = MAX_DISPLACEMENT): [number, number] {
  const m = Math.hypot(x, y);
  if (m <= max || m === 0) return [x, y];
  const s = max / m;
  return [x * s, y * s];
}

/**
 * Add one "stamp" of comb distortion into `delta` (same shape as field.data),
 * centered at (cx, cy) moving in direction (dirX, dirY) [unit vector].
 * Produces parallel wavy displacement across the tooth spacing, localized
 * along the stroke by a Gaussian tube — the classic marbling-comb signature.
 */
export function applyCombStamp(
  delta: Float32Array,
  res: number,
  cx: number,
  cy: number,
  dirX: number,
  dirY: number,
  density: CombDensity,
  strength: number
): void {
  const spacing = TOOTH_SPACING[density];
  const perpX = -dirY;
  const perpY = dirX;
  const sigmaAlong = 0.045;
  const sigmaAcross = 0.34;

  for (let j = 0; j < res; j++) {
    const gy = (j + 0.5) / res;
    for (let i = 0; i < res; i++) {
      const gx = (i + 0.5) / res;
      const relX = wrapDelta(gx, cx);
      const relY = wrapDelta(gy, cy);
      const along = relX * dirX + relY * dirY;
      const across = relX * perpX + relY * perpY;

      if (Math.abs(along) > sigmaAlong * 3 || Math.abs(across) > sigmaAcross * 2) continue;

      const falloffAlong = Math.exp(-(along * along) / (2 * sigmaAlong * sigmaAlong));
      const falloffAcross = Math.exp(-(across * across) / (2 * sigmaAcross * sigmaAcross));
      const toothPhase = Math.sin((2 * Math.PI * across) / spacing);
      const magnitude = strength * falloffAlong * falloffAcross * toothPhase;

      const idx = (j * res + i) * 2;
      delta[idx] += dirX * magnitude;
      delta[idx + 1] += dirY * magnitude;
    }
  }
}

/**
 * Add one "stamp" of swirl distortion into `delta`, centered at (cx, cy).
 * Combines a tangential (rotational) component with a directional (drag)
 * component, both under Gaussian decay from the stamp center.
 */
export function applySwirlStamp(
  delta: Float32Array,
  res: number,
  cx: number,
  cy: number,
  dirX: number,
  dirY: number,
  strength: number
): void {
  const sigma = 0.09;
  for (let j = 0; j < res; j++) {
    const gy = (j + 0.5) / res;
    for (let i = 0; i < res; i++) {
      const gx = (i + 0.5) / res;
      const relX = wrapDelta(gx, cx);
      const relY = wrapDelta(gy, cy);
      const dist = Math.hypot(relX, relY);
      if (dist > sigma * 3.2) continue;

      const falloff = Math.exp(-(dist * dist) / (2 * sigma * sigma));
      // Tangential unit vector (perpendicular to radius), rotating counter-clockwise.
      const tanX = dist > 1e-6 ? -relY / dist : 0;
      const tanY = dist > 1e-6 ? relX / dist : 0;

      const magnitude = strength * falloff;
      const idx = (j * res + i) * 2;
      delta[idx] += (tanX * 0.85 + dirX * 0.4) * magnitude;
      delta[idx + 1] += (tanY * 0.85 + dirY * 0.4) * magnitude;
    }
  }
}

/** Merge `delta` into `field` (plain accumulation — exact inverse of subtractDelta). */
export function commitDelta(field: DistortionField, delta: Float32Array): void {
  const { data } = field;
  for (let i = 0; i < data.length; i++) {
    data[i] += delta[i];
  }
}

/** Subtract `delta` from `field` (used to undo a comb/swirl stroke). */
export function subtractDelta(field: DistortionField, delta: Float32Array): void {
  const { data } = field;
  for (let i = 0; i < data.length; i++) {
    data[i] -= delta[i];
  }
}
