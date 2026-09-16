/**
 * Pure motion model for the lotus leaves / stones floating on the water.
 * Tilt acts like gravity pulling the floater "downhill"; position is
 * clamped to the pond radius so floaters never drift off the visible water
 * (FR-15's "does not break down at extreme tilt" requirement applies to
 * floaters too, not just the water plane itself).
 */
import { TILT_CLAMP_DEG, type TiltState } from './tiltState';

export interface FloaterState {
  x: number;
  z: number;
  /** Rotation around the world X axis, radians — rolling from north/south drift. */
  rollX: number;
  /** Rotation around the world Z axis, radians — rolling from east/west drift. */
  rollZ: number;
}

export function createFloaterState(x: number, z: number): FloaterState {
  return { x, z, rollX: 0, rollZ: 0 };
}

function clampToRadius(x: number, z: number, radius: number): { x: number; z: number } {
  const distance = Math.hypot(x, z);
  if (distance <= radius || distance === 0) return { x, z };
  const scale = radius / distance;
  return { x: x * scale, z: z * scale };
}

/**
 * Advances a floater by one physics step. `driftSpeed` is world units/second
 * at full tilt; `floaterRadius` controls how fast it visually rolls per unit
 * of travel (smaller radius = faster apparent spin, like a real object).
 */
export function nextFloaterState(
  previous: FloaterState,
  tilt: TiltState,
  dt: number,
  driftSpeed: number,
  pondRadius: number,
  floaterRadius: number,
): FloaterState {
  if (dt <= 0) return previous;

  const vx = (tilt.gamma / TILT_CLAMP_DEG) * driftSpeed;
  const vz = (tilt.beta / TILT_CLAMP_DEG) * driftSpeed;

  const rawX = previous.x + vx * dt;
  const rawZ = previous.z + vz * dt;
  const { x, z } = clampToRadius(rawX, rawZ, pondRadius);

  const safeFloaterRadius = floaterRadius > 0 ? floaterRadius : 1;
  const rollX = previous.rollX + (vz * dt) / safeFloaterRadius;
  const rollZ = previous.rollZ - (vx * dt) / safeFloaterRadius;

  return { x, z, rollX, rollZ };
}
