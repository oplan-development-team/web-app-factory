import { describe, expect, it } from "vitest";
import { clamp, distance, lerp, midpoint } from "../../src/core/geometry";
import { POSTER_ASPECT, POSTER_HEIGHT, POSTER_WIDTH, toPosterSpace } from "../../src/core/poster";

describe("clamp", () => {
  it("returns the value when it is inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps below the minimum", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it("clamps above the maximum", () => {
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe("lerp", () => {
  it("returns the start value at t=0", () => {
    expect(lerp(2, 8, 0)).toBe(2);
  });

  it("returns the end value at t=1", () => {
    expect(lerp(2, 8, 1)).toBe(8);
  });

  it("interpolates linearly in between", () => {
    expect(lerp(2, 8, 0.5)).toBe(5);
  });
});

describe("distance", () => {
  it("measures a 3-4-5 triangle", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("is zero for identical points", () => {
    expect(distance({ x: 7, y: 7 }, { x: 7, y: 7 })).toBe(0);
  });
});

describe("midpoint", () => {
  it("returns the average of both coordinates", () => {
    expect(midpoint({ x: 0, y: 10 }, { x: 4, y: 20 })).toEqual({ x: 2, y: 15 });
  });
});

describe("poster space", () => {
  it("uses the ISO A ratio", () => {
    expect(POSTER_WIDTH).toBe(1800);
    expect(POSTER_HEIGHT).toBe(2545);
    expect(POSTER_ASPECT).toBeCloseTo(Math.SQRT2, 2);
  });

  it("maps a client point in the middle of the rect to the poster centre", () => {
    const rect = { left: 100, top: 50, width: 360, height: 509 };
    expect(toPosterSpace(280, 304.5, rect)).toEqual({ x: POSTER_WIDTH / 2, y: POSTER_HEIGHT / 2 });
  });

  it("maps the rect origin to the poster origin", () => {
    const rect = { left: 100, top: 50, width: 360, height: 509 };
    expect(toPosterSpace(100, 50, rect)).toEqual({ x: 0, y: 0 });
  });

  it("returns the origin when the rect has no area", () => {
    expect(toPosterSpace(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });
});
