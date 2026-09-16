/**
 * Pure state transition for the tilt values that drive the water surface:
 * clamps raw readings to a range the scene can render without breaking
 * (FR-15), and ignores invalid readings by keeping the previous value
 * (AC-14) instead of ever propagating NaN into the render loop.
 */
export interface TiltState {
  /** Front/back tilt in degrees, roughly [-1, 1] range after normalization. */
  beta: number;
  /** Left/right tilt in degrees, roughly [-1, 1] range after normalization. */
  gamma: number;
}

/** A perfectly flat, face-up device — the starting pose before any input arrives. */
export const HORIZONTAL_TILT_STATE: TiltState = { beta: 0, gamma: 0 };

/** Degrees beyond which further tilt no longer increases the visual effect. */
export const TILT_CLAMP_DEG = 45;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Computes the next tilt state from a raw device-orientation (or drag-derived)
 * reading. Invalid readings (NaN, null, undefined) leave the corresponding
 * axis unchanged rather than corrupting the state.
 */
export function nextTiltState(
  previous: TiltState,
  rawBeta: number | null | undefined,
  rawGamma: number | null | undefined,
): TiltState {
  const beta = isFiniteNumber(rawBeta)
    ? clamp(rawBeta, -TILT_CLAMP_DEG, TILT_CLAMP_DEG)
    : previous.beta;
  const gamma = isFiniteNumber(rawGamma)
    ? clamp(rawGamma, -TILT_CLAMP_DEG, TILT_CLAMP_DEG)
    : previous.gamma;
  return { beta, gamma };
}

/** Normalizes a clamped tilt state to roughly [-1, 1] for use as a shader/scene uniform. */
export function normalizeTilt(state: TiltState): TiltState {
  return {
    beta: clamp(state.beta / TILT_CLAMP_DEG, -1, 1),
    gamma: clamp(state.gamma / TILT_CLAMP_DEG, -1, 1),
  };
}
