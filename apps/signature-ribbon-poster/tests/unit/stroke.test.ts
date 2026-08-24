import { describe, expect, it } from "vitest";
import { MIN_POINT_DISTANCE, StrokeBuilder } from "../../src/core/stroke";

describe("StrokeBuilder", () => {
  it("starts with a single zero-speed point", () => {
    const builder = new StrokeBuilder("gold", { x: 10, y: 20 }, 1000);
    const stroke = builder.snapshot();
    expect(stroke.colorId).toBe("gold");
    expect(stroke.points).toEqual([{ x: 10, y: 20, t: 1000, speed: 0 }]);
  });

  it("accepts a point that moved far enough", () => {
    const builder = new StrokeBuilder("gold", { x: 0, y: 0 }, 0);
    expect(builder.extend({ x: 10, y: 0 }, 10)).toBe(true);
    expect(builder.snapshot().points).toHaveLength(2);
  });

  it("rejects a point that has barely moved", () => {
    const builder = new StrokeBuilder("gold", { x: 0, y: 0 }, 0);
    expect(builder.extend({ x: MIN_POINT_DISTANCE * 0.5, y: 0 }, 10)).toBe(false);
    expect(builder.snapshot().points).toHaveLength(1);
  });

  it("uses a 1.5px threshold in poster space", () => {
    expect(MIN_POINT_DISTANCE).toBe(1.5);
  });

  it("measures the next point against the last accepted point, not the rejected one", () => {
    const builder = new StrokeBuilder("gold", { x: 0, y: 0 }, 0);
    builder.extend({ x: 1, y: 0 }, 10); // rejected
    expect(builder.extend({ x: 2, y: 0 }, 20)).toBe(true);
    const points = builder.snapshot().points;
    expect(points).toHaveLength(2);
    expect(points[1]!.x).toBe(2);
  });

  it("records a smoothed speed on accepted points", () => {
    const builder = new StrokeBuilder("gold", { x: 0, y: 0 }, 0);
    builder.extend({ x: 20, y: 0 }, 10); // raw speed 2
    const points = builder.snapshot().points;
    expect(points[1]!.speed).toBeCloseTo(2);
  });

  it("smooths speed across consecutive points", () => {
    const builder = new StrokeBuilder("gold", { x: 0, y: 0 }, 0);
    builder.extend({ x: 10, y: 0 }, 10); // raw 1
    builder.extend({ x: 40, y: 0 }, 20); // raw 3 -> smoothed 2
    const points = builder.snapshot().points;
    expect(points[2]!.speed).toBeCloseTo(2);
  });

  it("keeps the poster-space coordinates it was given", () => {
    const builder = new StrokeBuilder("crimson", { x: 1799.5, y: 2544.5 }, 0);
    expect(builder.snapshot().points[0]).toMatchObject({ x: 1799.5, y: 2544.5 });
  });

  it("reports the point count", () => {
    const builder = new StrokeBuilder("gold", { x: 0, y: 0 }, 0);
    expect(builder.pointCount).toBe(1);
    builder.extend({ x: 50, y: 0 }, 10);
    expect(builder.pointCount).toBe(2);
  });

  it("returns a defensive copy so later extension cannot mutate a taken snapshot", () => {
    const builder = new StrokeBuilder("gold", { x: 0, y: 0 }, 0);
    const before = builder.snapshot();
    builder.extend({ x: 50, y: 0 }, 10);
    expect(before.points).toHaveLength(1);
  });
});
