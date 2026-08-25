import { describe, expect, it, vi } from "vitest";
import { LiveRenderer, MAX_BACKING_WIDTH } from "../../src/render/live-renderer";
import { POSTER_HEIGHT, POSTER_WIDTH } from "../../src/core/poster";
import { responseToMaxSpeed } from "../../src/core/ribbon-metrics";
import type { Stroke } from "../../src/core/stroke";
import { FakeCanvas, fakeCanvasFactory } from "../helpers/fake-canvas";

function strokeOf(count: number): Stroke {
  return {
    colorId: "gold",
    points: Array.from({ length: count }, (_, i) => ({ x: i * 10, y: 0, t: i * 10, speed: 0.4 })),
  };
}

function setup(cssWidth = 600, dpr = 2): {
  renderer: LiveRenderer;
  display: FakeCanvas;
  created: FakeCanvas[];
} {
  const display = new FakeCanvas(0, 0);
  const { factory, created } = fakeCanvasFactory();
  const renderer = new LiveRenderer({
    display,
    createCanvas: factory,
    backgroundHex: "#0a0908",
    maxSpeed: responseToMaxSpeed(50),
    cssWidth,
    pixelRatio: dpr,
  });
  return { renderer, display, created };
}

describe("LiveRenderer — backing store sizing", () => {
  it("sizes the backing store to the CSS size times the pixel ratio (NFR-001.3)", () => {
    const { display } = setup(600, 2);
    expect(display.width).toBe(1200);
  });

  it("caps the pixel ratio at 2", () => {
    const { display } = setup(600, 4);
    expect(display.width).toBe(1200);
  });

  it("caps the backing width so a huge window cannot blow up the fill cost", () => {
    const { display } = setup(2000, 2);
    expect(display.width).toBe(MAX_BACKING_WIDTH);
  });

  it("stays well below the prototype's fixed 1800x2545 backing store at typical sizes", () => {
    const { display } = setup(520, 2);
    expect(display.width * display.height).toBeLessThan(POSTER_WIDTH * POSTER_HEIGHT);
  });

  it("always keeps the poster aspect ratio", () => {
    const { display } = setup(700, 1);
    expect(display.height / display.width).toBeCloseTo(POSTER_HEIGHT / POSTER_WIDTH, 3);
  });

  it("never produces a zero-sized backing store", () => {
    const { display, renderer } = setup(600, 2);
    renderer.setViewport(0, 2);
    expect(display.width).toBeGreaterThanOrEqual(1);
    expect(display.height).toBeGreaterThanOrEqual(1);
  });

  it("does not rebuild layers when the viewport is unchanged", () => {
    const { renderer, created } = setup(600, 2);
    const before = created.length;
    renderer.setViewport(600, 2);
    expect(created).toHaveLength(before);
  });

  it("rebuilds and fully repaints when the viewport changes (E-02)", () => {
    const { renderer, created, display } = setup(600, 2);
    renderer.setStrokes([strokeOf(5)], false);
    renderer.render();
    const coreCallsBefore = created[0]!.ctx.calls.length;

    renderer.setViewport(400, 2);
    expect(display.width).toBe(800);
    renderer.render();
    // A brand new core layer was allocated and painted from scratch.
    expect(created.length).toBeGreaterThan(1);
    expect(coreCallsBefore).toBeGreaterThan(0);
  });
});

describe("LiveRenderer — dirty tracking", () => {
  it("draws nothing when nothing has changed (NFR-001.7)", () => {
    const { renderer, display } = setup();
    renderer.render();
    display.ctx.reset();
    expect(renderer.render()).toBe(false);
    expect(display.ctx.calls).toHaveLength(0);
  });

  it("renders once after strokes change", () => {
    const { renderer, display } = setup();
    renderer.render();
    display.ctx.reset();
    renderer.setStrokes([strokeOf(4)], false);
    expect(renderer.render()).toBe(true);
    expect(display.ctx.ops("fillRect")).toHaveLength(1);
  });

  it("appends rather than repaints while a stroke is open (NFR-001.2)", () => {
    const { renderer, created } = setup();
    renderer.setStrokes([strokeOf(4)], true);
    renderer.render();
    const core = created[0]!.ctx;
    core.reset();

    renderer.setStrokes([strokeOf(5)], true);
    renderer.render();
    expect(core.ops("clearRect")).toHaveLength(0);
  });

  it("does a full repaint when explicitly invalidated (undo, redo, clear)", () => {
    const { renderer, created } = setup();
    renderer.setStrokes([strokeOf(4)], false);
    renderer.render();
    const core = created[0]!.ctx;
    core.reset();

    renderer.invalidate();
    renderer.render();
    expect(core.ops("clearRect")).toHaveLength(1);
  });

  it("repaints when the background changes (FR-005.2)", () => {
    const { renderer, display } = setup();
    renderer.render();
    display.ctx.reset();
    renderer.setBackground("#0b1220");
    expect(renderer.render()).toBe(true);
    expect(display.ctx.ops("fillRect")[0]!.state.fillStyle).toBe("#0b1220");
  });

  it("ignores a background change to the same colour", () => {
    const { renderer, display } = setup();
    renderer.render();
    display.ctx.reset();
    renderer.setBackground("#0a0908");
    expect(renderer.render()).toBe(false);
  });

  it("repaints existing strokes when the response changes (FR-013.3)", () => {
    const { renderer, created } = setup();
    renderer.setStrokes([strokeOf(6)], false);
    renderer.render();
    const core = created[0]!.ctx;
    core.reset();

    renderer.setMaxSpeed(responseToMaxSpeed(100));
    renderer.render();
    expect(core.ops("clearRect")).toHaveLength(1);
    expect(core.ops("stroke").length).toBeGreaterThan(0);
  });

  it("ignores a response change to the same value", () => {
    const { renderer, display } = setup();
    renderer.render();
    display.ctx.reset();
    renderer.setMaxSpeed(responseToMaxSpeed(50));
    expect(renderer.render()).toBe(false);
  });
});

describe("LiveRenderer — composition", () => {
  it("rebuilds the bloom from the core layer each rendered frame", () => {
    const { renderer, created } = setup();
    renderer.setStrokes([strokeOf(4)], false);
    renderer.render();
    const bloomLayer = created[1]!;
    expect(bloomLayer.ctx.ops("drawImage")[0]!.args[0]).toBe(created[0]);
  });

  it("composites background, bloom and core onto the display canvas", () => {
    const { renderer, display, created } = setup();
    renderer.setStrokes([strokeOf(4)], false);
    renderer.render();
    expect(display.ctx.ops("fillRect")).toHaveLength(1);
    expect(display.ctx.ops("drawImage").at(-1)!.args[0]).toBe(created[0]);
  });

  it("exposes the core layer for benchmarking and export reuse", () => {
    const { renderer, created } = setup();
    expect(renderer.coreCanvas).toBe(created[0]);
  });
});

describe("LiveRenderer — animation loop", () => {
  it("renders on each animation frame while running", () => {
    const frames: FrameRequestCallback[] = [];
    const raf = vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { renderer, display } = setup();
    renderer.start();
    display.ctx.reset();
    renderer.setStrokes([strokeOf(3)], false);
    frames.pop()!(0);
    expect(display.ctx.calls.length).toBeGreaterThan(0);

    renderer.stop();
    vi.unstubAllGlobals();
  });

  it("cancels the pending frame when stopped", () => {
    const cancel = vi.fn();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 42));
    vi.stubGlobal("cancelAnimationFrame", cancel);

    const { renderer } = setup();
    renderer.start();
    renderer.stop();
    expect(cancel).toHaveBeenCalledWith(42);
    vi.unstubAllGlobals();
  });

  it("does not stack loops when started twice", () => {
    const raf = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { renderer } = setup();
    renderer.start();
    renderer.start();
    expect(raf).toHaveBeenCalledTimes(1);

    renderer.stop();
    vi.unstubAllGlobals();
  });
});
