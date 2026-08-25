import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraftSync } from "../../src/app/draft-sync";
import { renderPoster, type EncodableCanvas } from "../../src/app/exporter";
import { PointerInput } from "../../src/app/pointer-input";
import { Studio } from "../../src/app/studio";
import { DraftStorage } from "../../src/core/draft-storage";
import { resolveResolution } from "../../src/core/export-presets";
import { POSTER_HEIGHT, POSTER_WIDTH } from "../../src/core/poster";
import { LiveRenderer } from "../../src/render/live-renderer";
import { FakeCanvas, fakeCanvasFactory } from "../helpers/fake-canvas";
import type { CanvasFactory } from "../../src/render/types";

const RECT = { left: 0, top: 0, width: 360, height: 509, right: 360, bottom: 509 };

interface Harness {
  studio: Studio;
  renderer: LiveRenderer;
  element: HTMLElement;
  display: FakeCanvas;
  created: FakeCanvas[];
  /** The body layer, which is also the bloom source. */
  body: FakeCanvas;
}

function harness(): Harness {
  const element = document.createElement("div");
  element.getBoundingClientRect = () => ({ ...RECT, x: 0, y: 0, toJSON: () => RECT }) as DOMRect;
  document.body.appendChild(element);

  const studio = new Studio();
  new PointerInput(element, studio);

  const display = new FakeCanvas(0, 0);
  const { factory, created } = fakeCanvasFactory();
  const renderer = new LiveRenderer({
    display,
    createCanvas: factory,
    backgroundHex: studio.backgroundHex,
    maxSpeed: studio.maxSpeed,
    cssWidth: 360,
    pixelRatio: 1,
  });

  studio.subscribe((_, change) => {
    if (change === "background") {
      renderer.setBackground(studio.backgroundHex);
    } else if (change === "response") {
      renderer.setMaxSpeed(studio.maxSpeed);
    } else if (change === "stroke-extended") {
      renderer.setStrokes(studio.strokes, studio.isDrawing);
    } else if (change === "strokes-replaced") {
      renderer.setStrokes(studio.strokes, studio.isDrawing);
      renderer.invalidate();
    }
  });

  return { studio, renderer, element, display, created, body: created[0]! };
}

function pointer(
  element: HTMLElement,
  type: string,
  clientX: number,
  clientY: number,
  pointerId = 1
): void {
  element.dispatchEvent(
    new PointerEvent(type, { pointerId, clientX, clientY, bubbles: true, cancelable: true })
  );
}

/** Draws one stroke across the middle of the poster, in client coordinates. */
function sign(element: HTMLElement, renderer: LiveRenderer, steps = 12): void {
  pointer(element, "pointerdown", 40, 250);
  renderer.render();
  for (let i = 1; i <= steps; i++) {
    pointer(element, "pointermove", 40 + i * 20, 250 + (i % 2) * 12);
    renderer.render();
  }
  pointer(element, "pointerup", 40 + steps * 20, 250);
  renderer.render();
}

beforeEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
});

describe("drawing pipeline", () => {
  it("carries a pointer gesture through to painted segments", () => {
    const h = harness();
    expect(h.body.ctx.ops("stroke")).toHaveLength(0);

    sign(h.element, h.renderer);

    expect(h.studio.strokes).toHaveLength(1);
    expect(h.body.ctx.ops("stroke").length).toBeGreaterThan(0);
  });

  it("appends while drawing and only fully repaints once the gesture is undone", () => {
    const h = harness();
    sign(h.element, h.renderer);
    const clearsWhileDrawing = h.body.ctx.ops("clearRect").length;

    h.body.ctx.reset();
    h.studio.undo();
    h.renderer.render();

    expect(clearsWhileDrawing).toBeLessThanOrEqual(1);
    expect(h.body.ctx.ops("clearRect")).toHaveLength(1);
    expect(h.body.ctx.ops("stroke")).toHaveLength(0);
  });

  it("keeps per-frame work flat as the stroke grows (NFR-001.2)", () => {
    const h = harness();
    pointer(h.element, "pointerdown", 20, 250);
    h.renderer.render();

    const perFrame: number[] = [];
    for (let i = 1; i <= 30; i++) {
      h.body.ctx.reset();
      pointer(h.element, "pointermove", 20 + i * 12, 250 + (i % 3) * 8);
      h.renderer.render();
      perFrame.push(h.body.ctx.ops("stroke").length);
    }

    // Every frame commits at most the one segment that just became drawable.
    expect(Math.max(...perFrame)).toBeLessThanOrEqual(1);
  });

  it("records strokes in poster space, independent of the on-screen size", () => {
    const h = harness();
    pointer(h.element, "pointerdown", RECT.width / 2, RECT.height / 2);
    const point = h.studio.strokes[0]!.points[0]!;
    expect(point.x).toBeCloseTo(POSTER_WIDTH / 2, 0);
    expect(point.y).toBeCloseTo(POSTER_HEIGHT / 2, 0);
  });

  it("re-renders existing strokes at a new width when the response changes", () => {
    const h = harness();
    // Driven directly rather than through pointer events: jsdom stamps every
    // synthetic event with the same millisecond, so every segment would come out
    // at the maximum speed and the width mapping would never be exercised.
    h.studio.beginStroke({ x: 200, y: 1200 }, 0);
    for (let i = 1; i <= 12; i++) {
      h.studio.extendStroke({ x: 200 + i * 80, y: 1200 + (i % 2) * 40 }, i * 120);
    }
    h.studio.finishStroke();
    h.renderer.render();

    const widthsAt = (response: number): number[] => {
      h.studio.setResponse(response);
      h.body.ctx.reset();
      h.renderer.render();
      return h.body.ctx.ops("stroke").map((call) => call.state.lineWidth as number);
    };

    const calm = widthsAt(0);
    const volatile = widthsAt(100);
    expect(calm.length).toBeGreaterThan(0);
    expect(volatile).toHaveLength(calm.length);
    expect(Math.max(...volatile)).toBeLessThan(Math.max(...calm));
  });

  it("changes the background without discarding the artwork", () => {
    const h = harness();
    sign(h.element, h.renderer);
    const painted = h.body.ctx.ops("stroke").length;

    h.studio.setBackground("midnight-navy");
    h.body.ctx.reset();
    h.renderer.render();

    expect(h.display.ctx.ops("fillRect").at(-1)!.state.fillStyle).toBe("#0b1220");
    expect(h.body.ctx.ops("stroke")).toHaveLength(painted);
  });
});

describe("draft round trip", () => {
  it("restores a saved session into a fresh studio and repaints it", () => {
    vi.useFakeTimers();
    const first = harness();
    const storage = new DraftStorage(window.localStorage);
    const sync = new DraftSync({ studio: first.studio, storage, onSaveFailed: vi.fn() });

    sign(first.element, first.renderer);
    first.studio.setCaption("Hotta / 2026");
    first.studio.setHue("emerald");
    vi.advanceTimersByTime(1000);
    sync.dispose();
    vi.useRealTimers();

    const saved = storage.load();
    expect(saved).not.toBeNull();

    const second = harness();
    second.studio.restore(saved!);
    second.renderer.setStrokes(second.studio.strokes, false);
    second.renderer.invalidate();
    second.renderer.render();

    expect(second.studio.state.caption).toBe("Hotta / 2026");
    expect(second.studio.state.hueId).toBe("emerald");
    expect(second.studio.strokes).toHaveLength(first.studio.strokes.length);
    expect(second.body.ctx.ops("stroke").length).toBeGreaterThan(0);
  });

  it("survives a corrupted saved draft without breaking start-up (E-09)", () => {
    window.localStorage.setItem("signature-ribbon-poster:draft", "{ broken");
    const storage = new DraftStorage(window.localStorage);
    expect(storage.load()).toBeNull();

    const h = harness();
    expect(() => sign(h.element, h.renderer)).not.toThrow();
    expect(h.studio.strokes).toHaveLength(1);
  });
});

describe("export pipeline", () => {
  class EncodableFakeCanvas extends FakeCanvas implements EncodableCanvas {
    toBlob(callback: (blob: Blob | null) => void): void {
      callback(new Blob(["png"], { type: "image/png" }));
    }
  }

  function exportDeps(): { createCanvas: CanvasFactory; created: EncodableFakeCanvas[] } {
    const created: EncodableFakeCanvas[] = [];
    return {
      createCanvas: (width, height) => {
        const canvas = new EncodableFakeCanvas(width, height);
        created.push(canvas);
        return canvas;
      },
      created,
    };
  }

  it("exports what the studio currently holds, at the chosen resolution", async () => {
    const h = harness();
    sign(h.element, h.renderer);
    h.studio.setResolution("archival");
    h.studio.setCaption("Hotta / 2026");
    h.studio.setBackground("deep-bordeaux");

    const deps = exportDeps();
    const result = await renderPoster(
      {
        strokes: h.studio.strokes,
        backgroundHex: h.studio.backgroundHex,
        maxSpeed: h.studio.maxSpeed,
        caption: h.studio.state.caption,
        resolutionId: h.studio.state.resolutionId,
      },
      { createCanvas: deps.createCanvas, loadFonts: async () => undefined, now: () => new Date() }
    );

    const preset = resolveResolution("archival");
    expect(result.width).toBe(preset.width);
    const output = deps.created.at(-1)!;
    expect(output.ctx.ops("fillRect")[0]!.state.fillStyle).toBe("#1a0a10");
    expect(output.ctx.ops("fillText").length).toBeGreaterThan(0);
  });

  it("does not reuse or disturb the preview layers", async () => {
    const h = harness();
    sign(h.element, h.renderer);
    const previewCalls = h.body.ctx.calls.length;

    const deps = exportDeps();
    await renderPoster(
      {
        strokes: h.studio.strokes,
        backgroundHex: h.studio.backgroundHex,
        maxSpeed: h.studio.maxSpeed,
        caption: "",
        resolutionId: "edition",
      },
      { createCanvas: deps.createCanvas, loadFonts: async () => undefined, now: () => new Date() }
    );

    expect(h.body.ctx.calls).toHaveLength(previewCalls);
    expect(deps.created.length).toBeGreaterThan(0);
  });
});
