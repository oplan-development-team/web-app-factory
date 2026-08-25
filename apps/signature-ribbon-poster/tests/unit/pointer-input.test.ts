import { beforeEach, describe, expect, it, vi } from "vitest";
import { PointerInput } from "../../src/app/pointer-input";
import { Studio } from "../../src/app/studio";
import { POSTER_HEIGHT, POSTER_WIDTH } from "../../src/core/poster";

const RECT = { left: 0, top: 0, width: 360, height: 509, right: 360, bottom: 509 };

function setup(): { element: HTMLElement; studio: Studio; input: PointerInput } {
  const element = document.createElement("div");
  element.getBoundingClientRect = () => ({ ...RECT, x: 0, y: 0, toJSON: () => RECT }) as DOMRect;
  document.body.appendChild(element);
  const studio = new Studio();
  return { element, studio, input: new PointerInput(element, studio) };
}

function fire(
  element: HTMLElement,
  type: string,
  init: { pointerId?: number; clientX?: number; clientY?: number } = {}
): PointerEvent {
  const event = new PointerEvent(type, {
    pointerId: init.pointerId ?? 1,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("PointerInput", () => {
  it("starts a stroke on pointerdown", () => {
    const { element, studio } = setup();
    fire(element, "pointerdown");
    expect(studio.isDrawing).toBe(true);
  });

  it("converts client coordinates into poster space (FR-001.8)", () => {
    const { element, studio } = setup();
    fire(element, "pointerdown", { clientX: RECT.width / 2, clientY: RECT.height / 2 });
    const point = studio.strokes[0]!.points[0]!;
    expect(point.x).toBeCloseTo(POSTER_WIDTH / 2, 0);
    expect(point.y).toBeCloseTo(POSTER_HEIGHT / 2, 0);
  });

  it("captures the pointer so a stroke can run past the poster edge (E-04)", () => {
    const { element } = setup();
    const capture = vi.spyOn(element, "setPointerCapture");
    fire(element, "pointerdown", { pointerId: 3 });
    expect(capture).toHaveBeenCalledWith(3);
  });

  it("keeps drawing when the capture API is unavailable", () => {
    const { element, studio } = setup();
    vi.spyOn(element, "setPointerCapture").mockImplementation(() => {
      throw new Error("unsupported");
    });
    fire(element, "pointerdown");
    expect(studio.isDrawing).toBe(true);
  });

  it("extends the stroke as the pointer moves", () => {
    const { element, studio } = setup();
    fire(element, "pointerdown", { clientX: 0, clientY: 0 });
    fire(element, "pointermove", { clientX: 100, clientY: 0 });
    expect(studio.strokes[0]!.points).toHaveLength(2);
  });

  it("ignores moves from a pointer it is not tracking (E-03)", () => {
    const { element, studio } = setup();
    fire(element, "pointerdown", { pointerId: 1, clientX: 0, clientY: 0 });
    fire(element, "pointermove", { pointerId: 2, clientX: 100, clientY: 0 });
    expect(studio.strokes[0]!.points).toHaveLength(1);
  });

  it("ignores a second pointer pressed during a stroke (E-03)", () => {
    const { element, studio } = setup();
    fire(element, "pointerdown", { pointerId: 1 });
    fire(element, "pointerdown", { pointerId: 2, clientX: 200, clientY: 200 });
    expect(studio.strokes).toHaveLength(1);
  });

  it("commits the stroke on pointerup", () => {
    const { element, studio } = setup();
    fire(element, "pointerdown", { clientX: 0, clientY: 0 });
    fire(element, "pointermove", { clientX: 100, clientY: 0 });
    fire(element, "pointerup", { clientX: 100, clientY: 0 });
    expect(studio.isDrawing).toBe(false);
    expect(studio.state.canUndo).toBe(true);
  });

  it("commits the stroke on pointercancel too, so it is never left dangling", () => {
    const { element, studio } = setup();
    fire(element, "pointerdown");
    fire(element, "pointercancel");
    expect(studio.isDrawing).toBe(false);
  });

  it("ignores pointerup from another pointer", () => {
    const { element, studio } = setup();
    fire(element, "pointerdown", { pointerId: 1 });
    fire(element, "pointerup", { pointerId: 2 });
    expect(studio.isDrawing).toBe(true);
  });

  it("accepts a new stroke after the previous one ended", () => {
    const { element, studio } = setup();
    fire(element, "pointerdown", { pointerId: 1 });
    fire(element, "pointerup", { pointerId: 1 });
    fire(element, "pointerdown", { pointerId: 2 });
    expect(studio.isDrawing).toBe(true);
  });

  it("prevents the default so touch scrolling never fights the stroke (FR-001.7)", () => {
    const { element } = setup();
    expect(fire(element, "pointerdown").defaultPrevented).toBe(true);
    expect(fire(element, "pointermove", { clientX: 100 }).defaultPrevented).toBe(true);
  });

  it("survives a release that the platform has already discarded", () => {
    const { element, studio } = setup();
    vi.spyOn(element, "releasePointerCapture").mockImplementation(() => {
      throw new Error("no capture");
    });
    fire(element, "pointerdown");
    expect(() => fire(element, "pointerup")).not.toThrow();
    expect(studio.isDrawing).toBe(false);
  });

  it("stops listening once destroyed", () => {
    const { element, studio, input } = setup();
    input.destroy();
    fire(element, "pointerdown");
    expect(studio.isDrawing).toBe(false);
  });
});
