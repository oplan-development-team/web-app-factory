/**
 * Pure helpers for turning device orientation into a 2D "downhill" gravity
 * vector, plus the smoothing/angular-speed math used to drive slosh.
 *
 * Note: this deliberately uses only beta/gamma (not alpha/compass heading)
 * for a simple, believable "tilt the tray" feel rather than a physically
 * exact device-to-world rotation — that precision isn't needed for a
 * sensory toy and would add a lot of matrix math for no visible benefit.
 */

export interface Gravity {
  gx: number;
  gy: number;
}

const TILT_RANGE_DEG = 45;

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/**
 * Converts raw DeviceOrientationEvent beta/gamma (degrees) into a
 * normalized downhill direction vector, each component roughly in [-1, 1].
 * Returns {gx: 0, gy: 0} (flat) when either reading is unavailable.
 */
export function orientationToGravity(beta: number | null, gamma: number | null): Gravity {
  if (beta === null || gamma === null || Number.isNaN(beta) || Number.isNaN(gamma)) {
    return { gx: 0, gy: 0 };
  }
  const gx = clamp(gamma / TILT_RANGE_DEG, -1, 1);
  const gy = clamp(beta / TILT_RANGE_DEG, -1, 1);
  return { gx, gy };
}

/** Exponential smoothing toward a target value; factor in (0,1], higher = snappier. */
export function lowPass(previous: number, target: number, factor: number): number {
  return previous + (target - previous) * clamp(factor, 0, 1);
}

/** Magnitude of change in the gravity vector per second — drives slosh intensity. */
export function angularSpeed(prev: Gravity, next: Gravity, dt: number): number {
  if (dt <= 0) return 0;
  const dx = next.gx - prev.gx;
  const dy = next.gy - prev.gy;
  return Math.hypot(dx, dy) / dt;
}
