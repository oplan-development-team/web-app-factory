import { describe, expect, it } from "vitest";
import { BloomPipeline, PREVIEW_BLOOM_LEVELS, EXPORT_BLOOM_LEVELS } from "../../src/render/bloom";
import { FakeCanvas, FakeCtx, fakeCanvasFactory } from "../helpers/fake-canvas";

function core(width = 800, height = 1131): FakeCanvas {
  return new FakeCanvas(width, height);
}

describe("bloom level presets", () => {
  it("uses two levels for the live preview and three for export (NFR-001.4)", () => {
    expect(PREVIEW_BLOOM_LEVELS).toHaveLength(2);
    expect(EXPORT_BLOOM_LEVELS).toHaveLength(3);
  });

  it("orders levels from tight to wide", () => {
    const divisors = PREVIEW_BLOOM_LEVELS.map((level) => level.divisor);
    expect(divisors).toEqual([...divisors].sort((a, b) => a - b));
  });

  it("keeps every level well under the core resolution so the cost stays small", () => {
    for (const level of [...PREVIEW_BLOOM_LEVELS, ...EXPORT_BLOOM_LEVELS]) {
      expect(level.divisor).toBeGreaterThanOrEqual(2);
      expect(level.alpha).toBeGreaterThan(0);
      expect(level.alpha).toBeLessThanOrEqual(1);
    }
  });
});

describe("BloomPipeline", () => {
  it("allocates one layer per level, each downscaled by its divisor", () => {
    const { factory, created } = fakeCanvasFactory();
    new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS).resize(800, 1200);
    expect(created).toHaveLength(PREVIEW_BLOOM_LEVELS.length);
    expect(created[0]!.width).toBe(Math.ceil(800 / PREVIEW_BLOOM_LEVELS[0]!.divisor));
    expect(created[1]!.width).toBe(Math.ceil(800 / PREVIEW_BLOOM_LEVELS[1]!.divisor));
  });

  it("never allocates a zero-sized layer", () => {
    const { factory, created } = fakeCanvasFactory();
    new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS).resize(1, 1);
    for (const canvas of created) {
      expect(canvas.width).toBeGreaterThanOrEqual(1);
      expect(canvas.height).toBeGreaterThanOrEqual(1);
    }
  });

  it("reuses its layers when resized to the same size", () => {
    const { factory, created } = fakeCanvasFactory();
    const bloom = new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS);
    bloom.resize(800, 1200);
    bloom.resize(800, 1200);
    expect(created).toHaveLength(PREVIEW_BLOOM_LEVELS.length);
  });

  it("reallocates when the size changes", () => {
    const { factory, created } = fakeCanvasFactory();
    const bloom = new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS);
    bloom.resize(800, 1200);
    bloom.resize(400, 600);
    expect(created).toHaveLength(PREVIEW_BLOOM_LEVELS.length * 2);
  });

  it("builds the first level from the core layer", () => {
    const { factory, created } = fakeCanvasFactory();
    const bloom = new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS);
    bloom.resize(800, 1200);
    const source = core();
    bloom.update(source);
    const draws = created[0]!.ctx.ops("drawImage");
    expect(draws).toHaveLength(1);
    expect(draws[0]!.args[0]).toBe(source);
  });

  it("chains each further level off the previous one instead of the full-size core", () => {
    const { factory, created } = fakeCanvasFactory();
    const bloom = new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS);
    bloom.resize(800, 1200);
    bloom.update(core());
    expect(created[1]!.ctx.ops("drawImage")[0]!.args[0]).toBe(created[0]);
  });

  it("clears each level before redrawing so old frames do not accumulate", () => {
    const { factory, created } = fakeCanvasFactory();
    const bloom = new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS);
    bloom.resize(800, 1200);
    bloom.update(core());
    expect(created[0]!.ctx.ops("clearRect")).toHaveLength(1);
  });

  it("applies a blur filter when the platform supports it", () => {
    const { factory, created } = fakeCanvasFactory();
    const bloom = new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS);
    bloom.resize(800, 1200);
    bloom.update(core());
    expect(String(created[0]!.ctx.ops("drawImage")[0]!.state.filter)).toMatch(/^blur\(/);
  });

  it("falls back to plain downscaling when ctx.filter is unsupported (E-16)", () => {
    const { factory, created } = fakeCanvasFactory({ filterSupported: false });
    const bloom = new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS);
    bloom.resize(800, 1200);
    bloom.update(core());
    const draw = created[0]!.ctx.ops("drawImage")[0]!;
    expect(draw.state.filter).toBe("none");
    // Smoothing does the blurring instead, so it must stay on.
    expect(draw.state.imageSmoothingEnabled).toBe(true);
  });

  it("resets the filter after building a level so it cannot leak into later draws", () => {
    const { factory, created } = fakeCanvasFactory();
    const bloom = new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS);
    bloom.resize(800, 1200);
    bloom.update(core());
    expect(created[0]!.ctx.filter).toBe("none");
  });

  it("composites every level additively at its own alpha", () => {
    const { factory } = fakeCanvasFactory();
    const bloom = new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS);
    bloom.resize(800, 1200);
    bloom.update(core());

    const target = new FakeCtx();
    bloom.composite(target, 800, 1200);

    const draws = target.ops("drawImage");
    expect(draws).toHaveLength(PREVIEW_BLOOM_LEVELS.length);
    for (const draw of draws) {
      expect(draw.state.globalCompositeOperation).toBe("lighter");
      expect(draw.args.slice(1)).toEqual([0, 0, 800, 1200]);
    }
    expect(draws.map((draw) => draw.state.globalAlpha)).toEqual(
      [...PREVIEW_BLOOM_LEVELS].reverse().map((level) => level.alpha)
    );
  });

  it("composites the widest halo first so the tight glow sits on top", () => {
    const { factory, created } = fakeCanvasFactory();
    const bloom = new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS);
    bloom.resize(800, 1200);
    bloom.update(core());

    const target = new FakeCtx();
    bloom.composite(target, 800, 1200);
    const order = target.ops("drawImage").map((draw) => draw.args[0]);
    expect(order).toEqual([created[1], created[0]]);
  });

  it("restores the target state after compositing", () => {
    const { factory } = fakeCanvasFactory();
    const bloom = new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS);
    bloom.resize(800, 1200);
    bloom.update(core());

    const target = new FakeCtx();
    bloom.composite(target, 800, 1200);
    expect(target.globalAlpha).toBe(1);
    expect(target.globalCompositeOperation).toBe("source-over");
  });

  it("is a no-op when it has never been sized", () => {
    const { factory } = fakeCanvasFactory();
    const bloom = new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS);
    const target = new FakeCtx();
    expect(() => bloom.update(core())).not.toThrow();
    bloom.composite(target, 800, 1200);
    expect(target.ops("drawImage")).toHaveLength(0);
  });

  it("does a fixed amount of work regardless of how much is on the core layer", () => {
    const { factory, created } = fakeCanvasFactory();
    const bloom = new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS);
    bloom.resize(800, 1200);
    bloom.update(core());
    const first = created.map((canvas) => canvas.ctx.calls.length);
    bloom.update(core());
    const second = created.map((canvas) => canvas.ctx.calls.length);
    expect(second.map((n, i) => n - first[i]!)).toEqual(first);
  });
});
