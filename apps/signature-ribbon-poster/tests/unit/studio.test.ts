import { describe, expect, it, vi } from "vitest";
import { Studio, type StudioChange } from "../../src/app/studio";
import { responseToMaxSpeed } from "../../src/core/ribbon-metrics";

function drawStroke(studio: Studio, points: [number, number][], startTime = 0): void {
  const [first, ...rest] = points;
  studio.beginStroke({ x: first![0], y: first![1] }, startTime);
  rest.forEach(([x, y], index) => studio.extendStroke({ x, y }, startTime + (index + 1) * 10));
  studio.finishStroke();
}

describe("Studio — drawing", () => {
  it("starts with no strokes and nothing to undo", () => {
    const studio = new Studio();
    expect(studio.state.strokes).toEqual([]);
    expect(studio.state.canUndo).toBe(false);
    expect(studio.state.canRedo).toBe(false);
  });

  it("exposes the in-progress stroke while drawing", () => {
    const studio = new Studio();
    studio.beginStroke({ x: 0, y: 0 }, 0);
    expect(studio.strokes).toHaveLength(1);
    expect(studio.isDrawing).toBe(true);
  });

  it("commits the stroke on finish", () => {
    const studio = new Studio();
    drawStroke(studio, [[0, 0], [100, 0]]);
    expect(studio.strokes).toHaveLength(1);
    expect(studio.isDrawing).toBe(false);
    expect(studio.state.canUndo).toBe(true);
  });

  it("keeps the committed stroke at the same index it had while open", () => {
    const studio = new Studio();
    drawStroke(studio, [[0, 0], [100, 0]]);
    studio.beginStroke({ x: 0, y: 50 }, 100);
    expect(studio.strokes).toHaveLength(2);
    studio.finishStroke();
    expect(studio.strokes).toHaveLength(2);
  });

  it("ignores extend and finish when no stroke is open", () => {
    const studio = new Studio();
    expect(studio.extendStroke({ x: 10, y: 10 }, 10)).toBe(false);
    studio.finishStroke();
    expect(studio.strokes).toEqual([]);
  });

  it("drops an in-progress stroke on cancel", () => {
    const studio = new Studio();
    studio.beginStroke({ x: 0, y: 0 }, 0);
    studio.cancelStroke();
    expect(studio.strokes).toEqual([]);
    expect(studio.state.canUndo).toBe(false);
  });

  it("records the current hue on each stroke, so a mid-artwork colour change only affects later strokes (FR-006.2)", () => {
    const studio = new Studio();
    drawStroke(studio, [[0, 0], [100, 0]]);
    studio.setHue("emerald");
    drawStroke(studio, [[0, 50], [100, 50]], 100);
    expect(studio.strokes.map((stroke) => stroke.colorId)).toEqual(["gold", "emerald"]);
  });
});

describe("Studio — history", () => {
  it("undoes and redoes a stroke", () => {
    const studio = new Studio();
    drawStroke(studio, [[0, 0], [100, 0]]);
    studio.undo();
    expect(studio.strokes).toHaveLength(0);
    expect(studio.state.canRedo).toBe(true);
    studio.redo();
    expect(studio.strokes).toHaveLength(1);
  });

  it("makes clear undoable (FR-008.4)", () => {
    const studio = new Studio();
    drawStroke(studio, [[0, 0], [100, 0]]);
    studio.clear();
    expect(studio.strokes).toHaveLength(0);
    studio.undo();
    expect(studio.strokes).toHaveLength(1);
  });

  it("does not push a history entry when clearing an already empty canvas", () => {
    const studio = new Studio();
    studio.clear();
    expect(studio.state.canUndo).toBe(false);
  });

  it("discards the redo branch once a new stroke is drawn (FR-008.3, E-11)", () => {
    const studio = new Studio();
    drawStroke(studio, [[0, 0], [100, 0]]);
    studio.undo();
    expect(studio.state.canRedo).toBe(true);
    drawStroke(studio, [[0, 50], [100, 50]], 100);
    expect(studio.state.canRedo).toBe(false);
  });

  it("clear also abandons the stroke in progress", () => {
    const studio = new Studio();
    studio.beginStroke({ x: 0, y: 0 }, 0);
    studio.clear();
    expect(studio.isDrawing).toBe(false);
  });
});

describe("Studio — settings", () => {
  it("resolves the background and hue to hex for the renderer", () => {
    const studio = new Studio();
    expect(studio.backgroundHex).toBe("#0a0908");
    studio.setBackground("midnight-navy");
    expect(studio.backgroundHex).toBe("#0b1220");
    studio.setHue("crimson");
    expect(studio.hueHex).toBe("#d1264f");
  });

  it("derives the saturation speed from the response setting", () => {
    const studio = new Studio();
    expect(studio.maxSpeed).toBeCloseTo(responseToMaxSpeed(50));
    studio.setResponse(100);
    expect(studio.maxSpeed).toBeCloseTo(responseToMaxSpeed(100));
  });
});

describe("Studio — notifications", () => {
  it("tells listeners what changed", () => {
    const studio = new Studio();
    const changes: StudioChange[] = [];
    studio.subscribe((_, change) => void changes.push(change));

    studio.setBackground("midnight-navy");
    studio.setHue("pearl");
    studio.setResponse(80);
    studio.setResolution("archival");
    studio.setCaption("Hotta");
    drawStroke(studio, [[0, 0], [100, 0]]);
    studio.undo();

    expect(changes).toEqual([
      "background",
      "hue",
      "response",
      "resolution",
      "caption",
      "stroke-extended",
      "stroke-extended",
      "stroke-extended",
      "strokes-replaced",
    ]);
  });

  it("stays silent when a setter is called with the current value", () => {
    const studio = new Studio();
    const listener = vi.fn();
    studio.subscribe(listener);
    studio.setBackground("noir");
    studio.setHue("gold");
    studio.setResponse(50);
    studio.setResolution("edition");
    studio.setCaption("");
    expect(listener).not.toHaveBeenCalled();
  });

  it("stays silent when undo or redo has nothing to do", () => {
    const studio = new Studio();
    const listener = vi.fn();
    studio.subscribe(listener);
    studio.undo();
    studio.redo();
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", () => {
    const studio = new Studio();
    const listener = vi.fn();
    const unsubscribe = studio.subscribe(listener);
    unsubscribe();
    studio.setCaption("Hotta");
    expect(listener).not.toHaveBeenCalled();
  });

  it("only emits a rejected extend as no change at all", () => {
    const studio = new Studio();
    studio.beginStroke({ x: 0, y: 0 }, 0);
    const listener = vi.fn();
    studio.subscribe(listener);
    expect(studio.extendStroke({ x: 0.2, y: 0 }, 10)).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("Studio — draft round trip", () => {
  it("serialises only committed strokes, never the one in progress", () => {
    const studio = new Studio();
    drawStroke(studio, [[0, 0], [100, 0]]);
    studio.beginStroke({ x: 0, y: 50 }, 100);
    expect(studio.toDraft().strokes).toHaveLength(1);
  });

  it("carries every setting into the draft", () => {
    const studio = new Studio();
    studio.setBackground("deep-bordeaux");
    studio.setHue("ice-blue");
    studio.setResponse(20);
    studio.setResolution("study");
    studio.setCaption("Hotta / 2026");
    expect(studio.toDraft()).toMatchObject({
      backgroundId: "deep-bordeaux",
      hueId: "ice-blue",
      response: 20,
      resolutionId: "study",
      caption: "Hotta / 2026",
    });
  });

  it("restores a draft and resets the timeline", () => {
    const studio = new Studio();
    drawStroke(studio, [[0, 0], [100, 0]]);
    const draft = studio.toDraft();

    const restored = new Studio();
    restored.restore(draft);
    expect(restored.strokes).toHaveLength(1);
    expect(restored.state.canUndo).toBe(false);
    expect(restored.state.canRedo).toBe(false);
  });

  it("abandons an in-progress stroke when restoring", () => {
    const studio = new Studio();
    studio.beginStroke({ x: 0, y: 0 }, 0);
    studio.restore({
      backgroundId: "noir",
      hueId: "gold",
      response: 50,
      resolutionId: "edition",
      caption: "",
      strokes: [],
    });
    expect(studio.isDrawing).toBe(false);
    expect(studio.strokes).toEqual([]);
  });
});
