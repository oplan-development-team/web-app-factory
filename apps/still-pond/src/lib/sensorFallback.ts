/**
 * Runtime fallback for environments that pass FR-6's static feature
 * detection but never actually deliver a `deviceorientation` reading (FR-16):
 * some desktop browsers expose `DeviceOrientationEvent.requestPermission`
 * (and resolve it to `"granted"` without ever prompting) or expose
 * `'ondeviceorientation' in window` as `true` even though no physical
 * sensor exists, so no event ever fires. Without this runtime check, the
 * app would silently sit in tilt-input mode with a frozen water surface.
 */

export interface SensorWatchState {
  startedAtMs: number;
  receivedValidReading: boolean;
}

/** How long to wait for a first valid deviceorientation reading before assuming the sensor doesn't actually work. */
export const SENSOR_FALLBACK_TIMEOUT_MS = 2500;

export function createSensorWatchState(startedAtMs: number): SensorWatchState {
  return { startedAtMs, receivedValidReading: false };
}

export function markValidReadingReceived(state: SensorWatchState): SensorWatchState {
  return { ...state, receivedValidReading: true };
}

/** A reading counts as valid if at least one of beta/gamma is a real, finite number. */
export function isValidOrientationReading(
  beta: number | null | undefined,
  gamma: number | null | undefined,
): boolean {
  const betaValid = typeof beta === 'number' && Number.isFinite(beta);
  const gammaValid = typeof gamma === 'number' && Number.isFinite(gamma);
  return betaValid || gammaValid;
}

/**
 * Returns true once `timeoutMs` has elapsed since the watch started without
 * ever having received a valid reading. Once a valid reading has been
 * received, this always returns false — the fallback only ever triggers
 * before the first successful reading, not from later gaps or drops.
 */
export function shouldFallBackToDrag(
  state: SensorWatchState,
  nowMs: number,
  timeoutMs: number = SENSOR_FALLBACK_TIMEOUT_MS,
): boolean {
  if (state.receivedValidReading) return false;
  return nowMs - state.startedAtMs >= timeoutMs;
}
