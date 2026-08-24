import { describe, expect, it } from "vitest";
import { SMOOTHING_WINDOW, SpeedSmoother, rawSpeed } from "../../src/core/speed";

describe("rawSpeed", () => {
  it("is distance over elapsed time", () => {
    expect(rawSpeed(20, 10)).toBe(2);
  });

  it("treats sub-millisecond gaps as one millisecond so it never divides by zero", () => {
    expect(rawSpeed(20, 0)).toBe(20);
    expect(rawSpeed(20, -5)).toBe(20);
  });
});

describe("SpeedSmoother", () => {
  it("returns the first sample unchanged", () => {
    const smoother = new SpeedSmoother();
    expect(smoother.push(1.2)).toBeCloseTo(1.2);
  });

  it("averages the samples seen so far", () => {
    const smoother = new SpeedSmoother();
    smoother.push(1);
    expect(smoother.push(3)).toBeCloseTo(2);
  });

  it("only averages the most recent window", () => {
    const smoother = new SpeedSmoother();
    for (let i = 0; i < SMOOTHING_WINDOW; i++) {
      smoother.push(10);
    }
    // Pushing a single 0 drops the oldest 10: (10*4 + 0) / 5 = 8
    expect(smoother.push(0)).toBeCloseTo((10 * (SMOOTHING_WINDOW - 1)) / SMOOTHING_WINDOW);
  });

  it("uses a five-sample window as specified", () => {
    expect(SMOOTHING_WINDOW).toBe(5);
  });

  it("forgets everything on reset", () => {
    const smoother = new SpeedSmoother();
    smoother.push(100);
    smoother.push(100);
    smoother.reset();
    expect(smoother.push(4)).toBeCloseTo(4);
  });

  it("smooths a spike instead of following it", () => {
    const smoother = new SpeedSmoother();
    for (let i = 0; i < SMOOTHING_WINDOW; i++) {
      smoother.push(1);
    }
    const spiked = smoother.push(6);
    expect(spiked).toBeLessThan(6);
    expect(spiked).toBeGreaterThan(1);
  });
});
