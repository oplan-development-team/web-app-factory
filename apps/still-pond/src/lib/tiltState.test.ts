import { describe, expect, it } from 'vitest';
import {
  HORIZONTAL_TILT_STATE,
  nextTiltState,
  normalizeTilt,
  TILT_CLAMP_DEG,
} from './tiltState';

describe('HORIZONTAL_TILT_STATE', () => {
  it('starts perfectly flat', () => {
    expect(HORIZONTAL_TILT_STATE).toEqual({ beta: 0, gamma: 0 });
  });
});

describe('nextTiltState', () => {
  it('adopts valid readings as-is when within range', () => {
    const next = nextTiltState(HORIZONTAL_TILT_STATE, 10, -5);
    expect(next).toEqual({ beta: 10, gamma: -5 });
  });

  it('clamps readings beyond the safe range (extreme flip / face-down tilt)', () => {
    const next = nextTiltState(HORIZONTAL_TILT_STATE, 179, -179);
    expect(next.beta).toBe(TILT_CLAMP_DEG);
    expect(next.gamma).toBe(-TILT_CLAMP_DEG);
  });

  it('keeps the previous beta when the new beta reading is NaN', () => {
    const previous = { beta: 12, gamma: 3 };
    const next = nextTiltState(previous, NaN, 7);
    expect(next).toEqual({ beta: 12, gamma: 7 });
  });

  it('keeps the previous gamma when the new gamma reading is null', () => {
    const previous = { beta: 4, gamma: -8 };
    const next = nextTiltState(previous, 9, null);
    expect(next).toEqual({ beta: 9, gamma: -8 });
  });

  it('keeps both previous axes when both readings are undefined', () => {
    const previous = { beta: 4, gamma: -8 };
    const next = nextTiltState(previous, undefined, undefined);
    expect(next).toEqual(previous);
  });

  it('never produces NaN even from repeated invalid readings', () => {
    let state = HORIZONTAL_TILT_STATE;
    state = nextTiltState(state, NaN, NaN);
    state = nextTiltState(state, null, undefined);
    expect(Number.isNaN(state.beta)).toBe(false);
    expect(Number.isNaN(state.gamma)).toBe(false);
    expect(state).toEqual(HORIZONTAL_TILT_STATE);
  });
});

describe('normalizeTilt', () => {
  it('maps the clamp range to [-1, 1]', () => {
    expect(normalizeTilt({ beta: TILT_CLAMP_DEG, gamma: -TILT_CLAMP_DEG })).toEqual({
      beta: 1,
      gamma: -1,
    });
  });

  it('maps a flat state to zero', () => {
    expect(normalizeTilt(HORIZONTAL_TILT_STATE)).toEqual({ beta: 0, gamma: 0 });
  });
});
