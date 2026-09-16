import { describe, expect, it } from 'vitest';
import { createFloaterState, nextFloaterState } from './floaterMotion';
import { HORIZONTAL_TILT_STATE, TILT_CLAMP_DEG } from './tiltState';

describe('createFloaterState', () => {
  it('starts with no roll', () => {
    expect(createFloaterState(1, 2)).toEqual({ x: 1, z: 2, rollX: 0, rollZ: 0 });
  });
});

describe('nextFloaterState', () => {
  it('does not move when flat (no tilt)', () => {
    const state = createFloaterState(0, 0);
    const next = nextFloaterState(state, HORIZONTAL_TILT_STATE, 1 / 60, 2, 5, 0.3);
    expect(next).toEqual(state);
  });

  it('drifts in the direction of tilt', () => {
    const state = createFloaterState(0, 0);
    const next = nextFloaterState(state, { beta: 0, gamma: TILT_CLAMP_DEG }, 1, 1, 5, 0.3);
    expect(next.x).toBeGreaterThan(0);
    expect(next.z).toBe(0);
  });

  it('rolls proportionally to lateral drift', () => {
    const state = createFloaterState(0, 0);
    const next = nextFloaterState(state, { beta: 0, gamma: TILT_CLAMP_DEG }, 1, 1, 5, 0.5);
    expect(next.rollZ).not.toBe(0);
  });

  it('clamps position to the pond radius so it never leaves the water (FR-15)', () => {
    let state = createFloaterState(0, 0);
    const extremeTilt = { beta: TILT_CLAMP_DEG, gamma: TILT_CLAMP_DEG };
    for (let i = 0; i < 200; i++) {
      state = nextFloaterState(state, extremeTilt, 1, 5, 4, 0.3);
    }
    expect(Math.hypot(state.x, state.z)).toBeLessThanOrEqual(4 + 1e-9);
  });

  it('returns the same state unchanged when dt is zero or negative', () => {
    const state = createFloaterState(1, 1);
    expect(nextFloaterState(state, { beta: 10, gamma: 10 }, 0, 1, 5, 0.3)).toBe(state);
    expect(nextFloaterState(state, { beta: 10, gamma: 10 }, -1, 1, 5, 0.3)).toBe(state);
  });
});
