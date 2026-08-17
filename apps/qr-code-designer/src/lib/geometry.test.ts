import { describe, expect, it } from 'vitest';
import { leafCorners, num, rrPath, uniformCorners } from './geometry';

describe('num', () => {
  it('rounds to three decimals', () => {
    expect(num(0.123456)).toBe('0.123');
    expect(num(1)).toBe('1');
  });

  it('never emits negative zero', () => {
    expect(num(-0)).toBe('0');
    expect(num(-0.0001)).toBe('0');
  });
});

describe('rrPath', () => {
  it('emits a plain rectangle when every radius is zero', () => {
    const d = rrPath(0, 0, 1, 1, uniformCorners(0));
    expect(d).not.toContain('A');
    expect(d).toBe('M0 0H1V1H0V0Z');
  });

  it('emits one arc per rounded corner', () => {
    const d = rrPath(0, 0, 1, 1, uniformCorners(0.25));
    expect(d.match(/A/g)).toHaveLength(4);
  });

  it('rounds only the requested corners', () => {
    const d = rrPath(0, 0, 1, 1, leafCorners(0.5));
    expect(d.match(/A/g)).toHaveLength(2);
  });

  it('clamps radii to half the shorter side so a full radius makes a circle', () => {
    const clamped = rrPath(0, 0, 1, 1, uniformCorners(10));
    const circle = rrPath(0, 0, 1, 1, uniformCorners(0.5));
    expect(clamped).toBe(circle);
  });

  it('always closes the subpath', () => {
    expect(rrPath(2, 3, 4, 5, uniformCorners(1)).endsWith('Z')).toBe(true);
  });

  it('honours the origin offset', () => {
    expect(rrPath(2, 3, 1, 1, uniformCorners(0))).toBe('M2 3H3V4H2V3Z');
  });
});
