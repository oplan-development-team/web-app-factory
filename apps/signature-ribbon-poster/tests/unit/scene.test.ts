import { describe, expect, it } from "vitest";
import { composeScene } from "../../src/render/scene";
import { BloomPipeline, PREVIEW_BLOOM_LEVELS } from "../../src/render/bloom";
import { FakeCanvas, FakeCtx, fakeCanvasFactory } from "../helpers/fake-canvas";

function scene(): {
  target: FakeCtx;
  core: FakeCanvas;
  bloom: BloomPipeline;
} {
  const { factory } = fakeCanvasFactory();
  const bloom = new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS);
  bloom.resize(800, 1200);
  const core = new FakeCanvas(800, 1200);
  bloom.update(core);
  return { target: new FakeCtx(), core, bloom };
}

describe("composeScene", () => {
  it("fills the whole surface with the background colour first", () => {
    const { target, core, bloom } = scene();
    composeScene(target, { width: 800, height: 1200, backgroundHex: "#0b1220", core, bloom });

    const fill = target.ops("fillRect")[0]!;
    expect(fill.args).toEqual([0, 0, 800, 1200]);
    expect(fill.state.fillStyle).toBe("#0b1220");
    expect(fill.state.globalCompositeOperation).toBe("source-over");
  });

  it("paints the background before any ribbon layer", () => {
    const { target, core, bloom } = scene();
    composeScene(target, { width: 800, height: 1200, backgroundHex: "#0a0908", core, bloom });

    const order = target.calls.map((call) => call.op);
    expect(order.indexOf("fillRect")).toBeLessThan(order.indexOf("drawImage"));
  });

  it("adds the bloom levels and then the core, all additively (FR-004.2)", () => {
    const { target, core, bloom } = scene();
    composeScene(target, { width: 800, height: 1200, backgroundHex: "#0a0908", core, bloom });

    const draws = target.ops("drawImage");
    expect(draws).toHaveLength(PREVIEW_BLOOM_LEVELS.length + 1);
    expect(draws.at(-1)!.args[0]).toBe(core);
    for (const draw of draws) {
      expect(draw.state.globalCompositeOperation).toBe("lighter");
    }
  });

  it("draws the core at full opacity so the ribbon keeps a crisp centre", () => {
    const { target, core, bloom } = scene();
    composeScene(target, { width: 800, height: 1200, backgroundHex: "#0a0908", core, bloom });
    expect(target.ops("drawImage").at(-1)!.state.globalAlpha).toBe(1);
  });

  it("stretches the core to the requested surface size", () => {
    const { target, core, bloom } = scene();
    composeScene(target, { width: 640, height: 905, backgroundHex: "#0a0908", core, bloom });
    expect(target.ops("drawImage").at(-1)!.args.slice(1)).toEqual([0, 0, 640, 905]);
  });

  it("leaves the context in a neutral state for whatever draws next", () => {
    const { target, core, bloom } = scene();
    composeScene(target, { width: 800, height: 1200, backgroundHex: "#0a0908", core, bloom });
    expect(target.globalCompositeOperation).toBe("source-over");
    expect(target.globalAlpha).toBe(1);
  });

  it("still renders the background when there is no bloom to composite", () => {
    const { factory } = fakeCanvasFactory();
    const target = new FakeCtx();
    composeScene(target, {
      width: 800,
      height: 1200,
      backgroundHex: "#1a0a10",
      core: new FakeCanvas(800, 1200),
      bloom: new BloomPipeline(factory, PREVIEW_BLOOM_LEVELS),
    });
    expect(target.ops("fillRect")).toHaveLength(1);
    expect(target.ops("drawImage")).toHaveLength(1);
  });
});
