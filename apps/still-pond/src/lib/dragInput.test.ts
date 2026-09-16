import { describe, expect, it } from 'vitest';
import { beginDrag, DRAG_PIXELS_PER_DEGREE, dragToTilt } from './dragInput';
import { HORIZONTAL_TILT_STATE, TILT_CLAMP_DEG } from './tiltState';

describe('beginDrag', () => {
  it('captures the starting point and current tilt as the base', () => {
    const origin = beginDrag(100, 200, HORIZONTAL_TILT_STATE);
    expect(origin).toEqual({ startX: 100, startY: 200, baseTilt: HORIZONTAL_TILT_STATE });
  });
});

describe('dragToTilt', () => {
  it('returns the base tilt unchanged when the pointer has not moved', () => {
    const origin = beginDrag(50, 50, HORIZONTAL_TILT_STATE);
    expect(dragToTilt(origin, 50, 50)).toEqual(HORIZONTAL_TILT_STATE);
  });

  it('maps horizontal movement to gamma proportionally to pixels-per-degree', () => {
    const origin = beginDrag(0, 0, HORIZONTAL_TILT_STATE);
    const next = dragToTilt(origin, DRAG_PIXELS_PER_DEGREE * 10, 0);
    expect(next.gamma).toBeCloseTo(10);
    expect(next.beta).toBe(0);
  });

  it('maps vertical movement to beta proportionally to pixels-per-degree', () => {
    const origin = beginDrag(0, 0, HORIZONTAL_TILT_STATE);
    const next = dragToTilt(origin, 0, DRAG_PIXELS_PER_DEGREE * -10);
    expect(next.beta).toBeCloseTo(-10);
    expect(next.gamma).toBe(0);
  });

  it('accumulates on top of a non-flat base tilt', () => {
    const origin = beginDrag(0, 0, { beta: 5, gamma: -5 });
    const next = dragToTilt(origin, DRAG_PIXELS_PER_DEGREE * 2, 0);
    expect(next.gamma).toBeCloseTo(-3);
    expect(next.beta).toBe(5);
  });

  it('clamps the result to the same safe range as sensor input', () => {
    const origin = beginDrag(0, 0, HORIZONTAL_TILT_STATE);
    const next = dragToTilt(origin, DRAG_PIXELS_PER_DEGREE * 1000, DRAG_PIXELS_PER_DEGREE * -1000);
    expect(next.gamma).toBe(TILT_CLAMP_DEG);
    expect(next.beta).toBe(-TILT_CLAMP_DEG);
  });
});
