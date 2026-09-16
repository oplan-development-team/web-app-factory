/**
 * Normalizes the outcome of iOS's `DeviceOrientationEvent.requestPermission()`
 * into a small closed union, treating rejection and synchronous throw the
 * same as an explicit "denied" (AC-6, AC-7): none of them should crash the
 * app, and all of them fall back to the same drag-input experience.
 */
export type PermissionOutcome = 'granted' | 'denied';

export async function requestOrientationPermission(
  requestPermission: () => Promise<string>,
): Promise<PermissionOutcome> {
  try {
    const result = await requestPermission();
    return result === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}
