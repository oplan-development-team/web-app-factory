import { describe, expect, it } from "vitest";
import { require2d, supportsCanvasFilter } from "../../src/render/types";
import { FakeCanvas, FakeCtx } from "../helpers/fake-canvas";

describe("require2d", () => {
  it("returns the context", () => {
    const canvas = new FakeCanvas(10, 10);
    expect(require2d(canvas)).toBe(canvas.ctx);
  });

  it("throws a clear error when the context is unavailable", () => {
    const canvas = { width: 1, height: 1, getContext: () => null };
    expect(() => require2d(canvas)).toThrow(/2D canvas context is not available/);
  });
});

describe("supportsCanvasFilter", () => {
  it("detects support", () => {
    expect(supportsCanvasFilter(new FakeCtx())).toBe(true);
  });

  it("detects a platform that silently drops the filter (E-16)", () => {
    const ctx = new FakeCtx();
    ctx.filterSupported = false;
    expect(supportsCanvasFilter(ctx)).toBe(false);
  });

  it("restores the previous filter value", () => {
    const ctx = new FakeCtx();
    ctx.filter = "blur(9px)";
    supportsCanvasFilter(ctx);
    expect(ctx.filter).toBe("blur(9px)");
  });

  it("treats a throwing setter as unsupported", () => {
    const ctx = new FakeCtx();
    Object.defineProperty(ctx, "filter", {
      get: () => "none",
      set: () => {
        throw new Error("unsupported");
      },
    });
    expect(supportsCanvasFilter(ctx)).toBe(false);
  });
});
