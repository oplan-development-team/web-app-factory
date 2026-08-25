import { describe, expect, it } from "vitest";
import { RibbonPainter, type RibbonPass } from "../../src/render/ribbon-painter";
import { responseToMaxSpeed } from "../../src/core/ribbon-metrics";
import type { Stroke } from "../../src/core/stroke";
import { FakeCtx } from "../helpers/fake-canvas";

const MAX_SPEED = responseToMaxSpeed(50);

function makeStroke(points: [number, number, number][], colorId: Stroke["colorId"] = "gold"): Stroke {
  return {
    colorId,
    points: points.map(([x, y, speed], index) => ({ x, y, t: index * 10, speed })),
  };
}

function painterOn(ctx: FakeCtx, scale = 1, pass: RibbonPass = "body"): RibbonPainter {
  return new RibbonPainter(ctx, {
    scale,
    maxSpeed: MAX_SPEED,
    width: 1800 * scale,
    height: 2545 * scale,
    pass,
  });
}

describe("RibbonPainter — geometry", () => {
  it("draws nothing for an empty stroke list", () => {
    const ctx = new FakeCtx();
    painterOn(ctx).repaint([]);
    expect(ctx.ops("stroke")).toHaveLength(0);
    expect(ctx.ops("fill")).toHaveLength(0);
  });

  it("draws a dot for a single-point stroke (E-01)", () => {
    const ctx = new FakeCtx();
    painterOn(ctx).repaint([makeStroke([[100, 200, 0]])]);
    const arcs = ctx.ops("arc");
    expect(arcs).toHaveLength(1);
    expect(arcs[0]!.args.slice(0, 2)).toEqual([100, 200]);
    expect(ctx.ops("fill")).toHaveLength(1);
  });

  it("connects points with mid-point quadratics rather than straight polylines (FR-004.3)", () => {
    const ctx = new FakeCtx();
    painterOn(ctx).repaint([makeStroke([[0, 0, 0], [100, 0, 0], [200, 0, 0]])]);
    expect(ctx.ops("quadraticCurveTo").length).toBeGreaterThan(0);
  });

  it("starts the first segment at the first point and ends the last at the last point", () => {
    const ctx = new FakeCtx();
    painterOn(ctx).repaint([makeStroke([[0, 0, 0], [100, 0, 0], [200, 0, 0]])]);
    const moves = ctx.ops("moveTo");
    expect(moves[0]!.args).toEqual([0, 0]);
    const curves = ctx.ops("quadraticCurveTo");
    expect(curves.at(-1)!.args.slice(2)).toEqual([200, 0]);
  });

  it("uses the mid-point between neighbours as the segment boundary", () => {
    const ctx = new FakeCtx();
    painterOn(ctx).repaint([makeStroke([[0, 0, 0], [100, 0, 0], [200, 0, 0], [300, 0, 0]])]);
    const curves = ctx.ops("quadraticCurveTo");
    // Segment around p1 ends at mid(p1, p2) = (150, 0)
    expect(curves[0]!.args).toEqual([100, 0, 150, 0]);
  });

  it("scales every coordinate into layer space", () => {
    const ctx = new FakeCtx();
    painterOn(ctx, 0.5).repaint([makeStroke([[100, 200, 0]])]);
    expect(ctx.ops("arc")[0]!.args.slice(0, 2)).toEqual([50, 100]);
  });
});

describe("RibbonPainter — speed response", () => {
  it("draws a slow segment wider than a fast one (FR-003.5)", () => {
    const slowCtx = new FakeCtx();
    painterOn(slowCtx).repaint([makeStroke([[0, 0, 0], [100, 0, 0], [200, 0, 0]])]);

    const fastCtx = new FakeCtx();
    painterOn(fastCtx).repaint([
      makeStroke([[0, 0, MAX_SPEED], [100, 0, MAX_SPEED], [200, 0, MAX_SPEED]]),
    ]);

    const slowWidth = slowCtx.ops("stroke")[0]!.state.lineWidth as number;
    const fastWidth = fastCtx.ops("stroke")[0]!.state.lineWidth as number;
    expect(slowWidth).toBeGreaterThan(fastWidth);
  });

  it("draws a slow segment more opaquely than a fast one", () => {
    const slowCtx = new FakeCtx();
    painterOn(slowCtx).repaint([makeStroke([[0, 0, 0], [100, 0, 0], [200, 0, 0]])]);
    const fastCtx = new FakeCtx();
    painterOn(fastCtx).repaint([
      makeStroke([[0, 0, MAX_SPEED], [100, 0, MAX_SPEED], [200, 0, MAX_SPEED]]),
    ]);

    const alphaOf = (style: unknown): number =>
      Number(/rgba\([^)]*,\s*([\d.]+)\)/.exec(String(style))?.[1] ?? 0);

    expect(alphaOf(slowCtx.ops("stroke")[0]!.state.strokeStyle)).toBeGreaterThan(
      alphaOf(fastCtx.ops("stroke")[0]!.state.strokeStyle)
    );
  });

  it("paints exactly one pass per segment, on its own layer (FR-004.1)", () => {
    const strokes3 = [makeStroke([[0, 0, 0], [100, 0, 0], [200, 0, 0]])];

    const bodyCtx = new FakeCtx();
    painterOn(bodyCtx, 1, "body").repaint(strokes3);
    const highlightCtx = new FakeCtx();
    painterOn(highlightCtx, 1, "highlight").repaint(strokes3);

    // 2 segments (around p1 and p2), one stroke call each.
    expect(bodyCtx.ops("stroke")).toHaveLength(2);
    expect(highlightCtx.ops("stroke")).toHaveLength(2);
  });

  it("makes the highlight narrower and lighter than the body", () => {
    const strokes3 = [makeStroke([[0, 0, 0], [100, 0, 0], [200, 0, 0]])];
    const bodyCtx = new FakeCtx();
    painterOn(bodyCtx, 1, "body").repaint(strokes3);
    const highlightCtx = new FakeCtx();
    painterOn(highlightCtx, 1, "highlight").repaint(strokes3);

    const body = bodyCtx.ops("stroke")[0]!;
    const highlight = highlightCtx.ops("stroke")[0]!;
    expect(highlight.state.lineWidth as number).toBeLessThan(body.state.lineWidth as number);
    expect(String(highlight.state.strokeStyle)).not.toBe(String(body.state.strokeStyle));
  });

  it("keeps the body in the pure ribbon hue, so the bloom built from it stays gold (NFR-001.6)", () => {
    const ctx = new FakeCtx();
    painterOn(ctx, 1, "body").repaint([makeStroke([[0, 0, 0], [100, 0, 0], [200, 0, 0]])]);
    for (const call of ctx.ops("stroke")) {
      expect(String(call.state.strokeStyle)).toMatch(/^rgba\(217, 172, 76,/);
    }
  });

  it("never emits a NaN colour channel", () => {
    for (const pass of ["body", "highlight"] as const) {
      const ctx = new FakeCtx();
      painterOn(ctx, 1, pass).repaint([makeStroke([[0, 0, 0], [100, 0, 0], [200, 0, 0]])]);
      for (const call of ctx.ops("stroke")) {
        expect(String(call.state.strokeStyle)).not.toContain("NaN");
      }
    }
  });

  it("draws the lone-point dot on the body layer only", () => {
    const bodyCtx = new FakeCtx();
    painterOn(bodyCtx, 1, "body").repaint([makeStroke([[100, 200, 0]])]);
    const highlightCtx = new FakeCtx();
    painterOn(highlightCtx, 1, "highlight").repaint([makeStroke([[100, 200, 0]])]);
    expect(bodyCtx.ops("arc")).toHaveLength(1);
    expect(highlightCtx.ops("arc")).toHaveLength(0);
  });

  it("does not blend additively within a layer, which would clip joints to white (NFR-001.6)", () => {
    const ctx = new FakeCtx();
    painterOn(ctx).repaint([makeStroke([[0, 0, 0], [100, 0, 0], [200, 0, 0]])]);
    expect(ctx.ops("stroke")[0]!.state.globalCompositeOperation).toBe("source-over");
  });

  it("uses round caps and joins (FR-004.4)", () => {
    const ctx = new FakeCtx();
    painterOn(ctx).repaint([makeStroke([[0, 0, 0], [100, 0, 0], [200, 0, 0]])]);
    expect(ctx.ops("stroke")[0]!.state.lineCap).toBe("round");
    expect(ctx.ops("stroke")[0]!.state.lineJoin).toBe("round");
  });

  it("never applies a shadow blur, which is what made the prototype slow (NFR-001.1)", () => {
    const ctx = new FakeCtx();
    painterOn(ctx).repaint([makeStroke([[0, 0, 0], [100, 0, 0], [200, 0, 0]])]);
    expect(Object.keys(ctx)).not.toContain("shadowBlur");
  });

  it("responds to a changed maxSpeed", () => {
    const ctx = new FakeCtx();
    const painter = painterOn(ctx);
    painter.repaint([makeStroke([[0, 0, 0.8], [100, 0, 0.8], [200, 0, 0.8]])]);
    const before = ctx.ops("stroke")[0]!.state.lineWidth as number;

    ctx.reset();
    painter.setOptions({
      scale: 1,
      maxSpeed: responseToMaxSpeed(100),
      width: 1800,
      height: 2545,
      pass: "body",
    });
    painter.repaint([makeStroke([[0, 0, 0.8], [100, 0, 0.8], [200, 0, 0.8]])]);
    const after = ctx.ops("stroke")[0]!.state.lineWidth as number;

    expect(after).toBeLessThan(before);
  });

  it("uses the colour recorded on each stroke, not a global one (FR-006.2)", () => {
    const ctx = new FakeCtx();
    painterOn(ctx).repaint([
      makeStroke([[0, 0, 0], [10, 0, 0], [20, 0, 0]], "gold"),
      makeStroke([[0, 50, 0], [10, 50, 0], [20, 50, 0]], "emerald"),
    ]);
    const styles = ctx.ops("stroke").map((call) => String(call.state.strokeStyle));
    expect(styles.some((style) => style.startsWith("rgba(217, 172, 76"))).toBe(true);
    expect(styles.some((style) => style.startsWith("rgba(63, 176, 138"))).toBe(true);
  });
});
