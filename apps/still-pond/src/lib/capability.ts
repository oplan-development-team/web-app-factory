/**
 * Feature detection for device-orientation input, kept as a pure function
 * over an injected description of the runtime environment so it can be
 * unit-tested without touching the real `window`/`DeviceOrientationEvent`.
 *
 * Three states (see FR-6 in docs/specs/still-pond.md):
 *  - 'ios-permission': DeviceOrientationEvent.requestPermission exists as a
 *    function (iOS 13+ Safari-style gated sensor access).
 *  - 'sensor': no permission gate, but the orientation event is otherwise
 *    available (Android Chrome and similar).
 *  - 'none': no orientation sensor support detected (desktop browsers).
 */
export type CapabilityState = 'ios-permission' | 'sensor' | 'none';

export interface CapabilityEnv {
  /** Whatever `window.DeviceOrientationEvent` currently is, or undefined. */
  deviceOrientationEventCtor: unknown;
  /** The result of `'ondeviceorientation' in window`. */
  hasOrientationEventProperty: boolean;
}

function hasRequestPermission(ctor: unknown): boolean {
  if (typeof ctor !== 'function' && typeof ctor !== 'object') return false;
  if (ctor === null) return false;
  const candidate = (ctor as { requestPermission?: unknown }).requestPermission;
  return typeof candidate === 'function';
}

export function detectCapability(env: CapabilityEnv): CapabilityState {
  if (hasRequestPermission(env.deviceOrientationEventCtor)) {
    return 'ios-permission';
  }
  if (env.hasOrientationEventProperty) {
    return 'sensor';
  }
  return 'none';
}

/** Reads the real browser environment. Not unit-tested (thin DOM adapter). */
export function readCapabilityEnv(): CapabilityEnv {
  return {
    deviceOrientationEventCtor: (window as unknown as { DeviceOrientationEvent?: unknown })
      .DeviceOrientationEvent,
    hasOrientationEventProperty: 'ondeviceorientation' in window,
  };
}

/**
 * Returns iOS's gated `DeviceOrientationEvent.requestPermission`, bound to
 * its constructor, or null if unavailable. Thin DOM adapter, not unit-tested.
 */
export function getIosRequestPermission(): (() => Promise<string>) | null {
  const ctor = (
    window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }
  ).DeviceOrientationEvent;
  return typeof ctor?.requestPermission === 'function' ? ctor.requestPermission.bind(ctor) : null;
}
