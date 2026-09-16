import { describe, expect, it } from 'vitest';
import { detectCapability } from './capability';

describe('detectCapability', () => {
  it('returns ios-permission when requestPermission is a function on the ctor', () => {
    const state = detectCapability({
      deviceOrientationEventCtor: { requestPermission: () => Promise.resolve('granted') },
      hasOrientationEventProperty: true,
    });
    expect(state).toBe('ios-permission');
  });

  it('prefers ios-permission even if the orientation property is also present', () => {
    const state = detectCapability({
      deviceOrientationEventCtor: { requestPermission: async () => 'granted' },
      hasOrientationEventProperty: true,
    });
    expect(state).toBe('ios-permission');
  });

  it('returns sensor when there is no permission gate but the event property exists', () => {
    const state = detectCapability({
      deviceOrientationEventCtor: undefined,
      hasOrientationEventProperty: true,
    });
    expect(state).toBe('sensor');
  });

  it('returns sensor when the ctor exists but has no requestPermission function', () => {
    const state = detectCapability({
      deviceOrientationEventCtor: {},
      hasOrientationEventProperty: true,
    });
    expect(state).toBe('sensor');
  });

  it('returns none when neither the permission gate nor the sensor property exist', () => {
    const state = detectCapability({
      deviceOrientationEventCtor: undefined,
      hasOrientationEventProperty: false,
    });
    expect(state).toBe('none');
  });

  it('returns none when requestPermission is present but not a function', () => {
    const state = detectCapability({
      deviceOrientationEventCtor: { requestPermission: 'not-a-function' },
      hasOrientationEventProperty: false,
    });
    expect(state).toBe('none');
  });
});
