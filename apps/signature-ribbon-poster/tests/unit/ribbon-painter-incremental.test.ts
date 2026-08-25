import { describe, expect, it } from "vitest";
import { RibbonPainter } from "../../src/render/ribbon-painter";
import { responseToMaxSpeed } from "../../src/core/ribbon-metrics";
import type { RibbonPoint, Stroke } from "../../src/core/stroke";
import { FakeCtx } from "../helpers/fake-canvas";

const OPTIONS = {
  scale: 1,
  maxSpeed: responseToMaxSpeed(50),
  width: 1800,
  height: 2545,
  pass: "body" as const,
};

function point(x: number): RibbonPoint {
  return { x, y: 0, t: x, speed: 0.5 };
}

function growing(count: number): Stroke {
  return { colorId: "gold", points: Array.from({ length: count }, (_, i) => point(i * 10)) };
}

/** Segments actually committed to the layer, identified by their control point. */
function paintedControls(ctx: FakeCtx): number[] {
  return ctx.ops("quadraticCurveTo").map((call) => call.args[0] as number);
}

describe("RibbonPainter — incremental drawing", () => {
  it("draws nothing for an open stroke that only has one point", () => {
    const ctx = new FakeCtx();
    const painter = new RibbonPainter(ctx, OPTIONS);
    painter.appendPending([growing(1)], true);
    expect(ctx.ops("stroke")).toHaveLength(0);
  });

  it("holds back the trailing segment of an open stroke until its neighbour arrives", () => {
    const ctx = new FakeCtx();
    const painter = new RibbonPainter(ctx, OPTIONS);
    painter.appendPending([growing(2)], true);
    // Segment around p1 needs p2 to know where to stop.
    expect(paintedControls(ctx)).toEqual([]);

    painter.appendPending([growing(3)], true);
    expect(paintedControls(ctx)).toEqual([10]);
  });

  it("never redraws a segment it has already committed", () => {
    const ctx = new FakeCtx();
    const painter = new RibbonPainter(ctx, OPTIONS);
    for (let count = 2; count <= 8; count++) {
      painter.appendPending([growing(count)], true);
    }
    expect(paintedControls(ctx)).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it("draws the final segment when the stroke closes", () => {
    const ctx = new FakeCtx();
    const painter = new RibbonPainter(ctx, OPTIONS);
    painter.appendPending([growing(4)], true);
    expect(paintedControls(ctx)).toEqual([10, 20]);
    painter.appendPending([growing(4)], false);
    expect(paintedControls(ctx)).toEqual([10, 20, 30]);
  });

  it("draws the dot of a closed single-point stroke exactly once", () => {
    const ctx = new FakeCtx();
    const painter = new RibbonPainter(ctx, OPTIONS);
    painter.appendPending([growing(1)], false);
    painter.appendPending([growing(1)], false);
    expect(ctx.ops("arc")).toHaveLength(1);
  });

  it("moves on to the next stroke once the previous one is closed", () => {
    const ctx = new FakeCtx();
    const painter = new RibbonPainter(ctx, OPTIONS);
    painter.appendPending([growing(3)], false);
    ctx.reset();
    painter.appendPending([growing(3), growing(3)], true);
    // Only the second stroke's first segment is new.
    expect(paintedControls(ctx)).toEqual([10]);
  });

  it("does not clear the layer when appending", () => {
    const ctx = new FakeCtx();
    const painter = new RibbonPainter(ctx, OPTIONS);
    painter.appendPending([growing(5)], true);
    expect(ctx.ops("clearRect")).toHaveLength(0);
  });

  it("clears and redraws everything on repaint", () => {
    const ctx = new FakeCtx();
    const painter = new RibbonPainter(ctx, OPTIONS);
    painter.appendPending([growing(5)], false);
    ctx.reset();
    painter.repaint([growing(5)]);
    expect(ctx.ops("clearRect")).toHaveLength(1);
    expect(paintedControls(ctx)).toEqual([10, 20, 30, 40]);
  });

  it("resumes appending from a fresh cursor after a repaint", () => {
    const ctx = new FakeCtx();
    const painter = new RibbonPainter(ctx, OPTIONS);
    painter.repaint([growing(4)]);
    ctx.reset();
    painter.appendPending([growing(4)], false);
    expect(paintedControls(ctx)).toEqual([]);
  });

  it("re-issues style state on every append so a shared context cannot leak into it", () => {
    const ctx = new FakeCtx();
    const painter = new RibbonPainter(ctx, OPTIONS);
    painter.appendPending([growing(3)], true);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "butt";
    painter.appendPending([growing(4)], true);
    const last = ctx.ops("stroke").at(-1)!;
    expect(last.state.globalCompositeOperation).toBe("source-over");
    expect(last.state.lineCap).toBe("round");
  });

  it("keeps the amount of work per appended point constant regardless of stroke length", () => {
    const ctx = new FakeCtx();
    const painter = new RibbonPainter(ctx, OPTIONS);
    painter.appendPending([growing(500)], true);
    ctx.reset();
    painter.appendPending([growing(501)], true);
    // One new segment => one stroke call, no matter how long the stroke already is.
    expect(ctx.ops("stroke")).toHaveLength(1);
  });
});
