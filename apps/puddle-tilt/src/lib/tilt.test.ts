import { describe, expect, it } from 'vitest';
import { angularSpeed, lowPass, orientationToGravity } from './tilt';

describe('orientationToGravity', () => {
  it('returns flat gravity when readings are unavailable', () => {
    expect(orientationToGravity(null, null)).toEqual({ gx: 0, gy: 0 });
  });

  it('maps gamma to gx and beta to gy within [-1, 1]', () => {
    const g = orientationToGravity(22.5, 22.5);
    expect(g.gx).toBeCloseTo(0.5);
    expect(g.gy).toBeCloseTo(0.5);
  });

  it('clamps extreme tilt angles to +-1', () => {
    const g = orientationToGravity(170, -170);
    expect(g.gx).toBe(-1);
    expect(g.gy).toBe(1);
  });

  it('returns zero gravity for a flat device', () => {
    expect(orientationToGravity(0, 0)).toEqual({ gx: 0, gy: 0 });
  });
});

describe('lowPass', () => {
  it('moves partway toward the target', () => {
    expect(lowPass(0, 10, 0.5)).toBeCloseTo(5);
  });

  it('does nothing with factor 0', () => {
    expect(lowPass(3, 99, 0)).toBe(3);
  });

  it('reaches the target instantly with factor 1', () => {
    expect(lowPass(3, 99, 1)).toBe(99);
  });
});

describe('angularSpeed', () => {
  it('is zero when gravity does not change', () => {
    const g = { gx: 0.2, gy: -0.1 };
    expect(angularSpeed(g, g, 1 / 60)).toBe(0);
  });

  it('scales with the magnitude of change over dt', () => {
    const prev = { gx: 0, gy: 0 };
    const next = { gx: 0.3, gy: 0.4 };
    // magnitude of change = hypot(0.3, 0.4) = 0.5
    expect(angularSpeed(prev, next, 0.5)).toBeCloseTo(1);
  });

  it('returns 0 for non-positive dt', () => {
    expect(angularSpeed({ gx: 0, gy: 0 }, { gx: 1, gy: 1 }, 0)).toBe(0);
  });
});
