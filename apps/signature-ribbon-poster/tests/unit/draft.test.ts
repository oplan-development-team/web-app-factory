import { describe, expect, it } from "vitest";
import { DRAFT_VERSION, parseDraft, serializeDraft } from "../../src/core/draft";
import type { DraftSnapshot } from "../../src/core/draft";
import type { Stroke } from "../../src/core/stroke";

function stroke(points: [number, number, number, number][]): Stroke {
  return {
    colorId: "gold",
    points: points.map(([x, y, t, speed]) => ({ x, y, t, speed })),
  };
}

const snapshot: DraftSnapshot = {
  backgroundId: "midnight-navy",
  hueId: "crimson",
  response: 70,
  resolutionId: "archival",
  caption: "Hotta / 2026",
  strokes: [stroke([[10, 20, 1000, 0], [30, 40, 1010, 2]])],
};

describe("serializeDraft / parseDraft", () => {
  it("round-trips a snapshot", () => {
    const parsed = parseDraft(JSON.stringify(serializeDraft(snapshot)));
    expect(parsed).not.toBeNull();
    expect(parsed?.backgroundId).toBe("midnight-navy");
    expect(parsed?.hueId).toBe("crimson");
    expect(parsed?.response).toBe(70);
    expect(parsed?.resolutionId).toBe("archival");
    expect(parsed?.caption).toBe("Hotta / 2026");
    expect(parsed?.strokes).toHaveLength(1);
  });

  it("stamps the schema version", () => {
    expect(serializeDraft(snapshot).version).toBe(DRAFT_VERSION);
  });

  it("rounds coordinates to one decimal to keep the payload small (FR-011.3)", () => {
    const serialized = serializeDraft({
      ...snapshot,
      strokes: [stroke([[10.04, 20.06, 0, 0]])],
    });
    expect(serialized.strokes[0]!.p.slice(0, 2)).toEqual([10, 20.1]);
  });

  it("stores timestamps relative to the start of each stroke", () => {
    const serialized = serializeDraft({
      ...snapshot,
      strokes: [stroke([[0, 0, 5_000_000, 0], [10, 0, 5_000_040, 1]])],
    });
    expect(serialized.strokes[0]!.p[2]).toBe(0);
    expect(serialized.strokes[0]!.p[6]).toBe(40);
  });

  it("restores absolute-enough timestamps so speeds stay comparable", () => {
    const parsed = parseDraft(
      JSON.stringify(
        serializeDraft({ ...snapshot, strokes: [stroke([[0, 0, 900, 0], [10, 0, 940, 0.25]])] })
      )
    );
    const points = parsed!.strokes[0]!.points;
    expect(points[1]!.t - points[0]!.t).toBe(40);
    expect(points[1]!.speed).toBeCloseTo(0.25);
  });

  it("returns null for malformed JSON (E-09)", () => {
    expect(parseDraft("{ not json")).toBeNull();
  });

  it("returns null for a different schema version (FR-011.4)", () => {
    const payload = { ...serializeDraft(snapshot), version: 99 };
    expect(parseDraft(JSON.stringify(payload))).toBeNull();
  });

  it("returns null when the payload is not an object", () => {
    expect(parseDraft("42")).toBeNull();
    expect(parseDraft("null")).toBeNull();
    expect(parseDraft('"hi"')).toBeNull();
  });

  it("falls back to defaults for unknown preset ids instead of failing", () => {
    const payload = { ...serializeDraft(snapshot), backgroundId: "chartreuse", hueId: "puce" };
    const parsed = parseDraft(JSON.stringify(payload));
    expect(parsed?.backgroundId).toBe("noir");
    expect(parsed?.hueId).toBe("gold");
  });

  it("clamps an out-of-range response", () => {
    const payload = { ...serializeDraft(snapshot), response: 5000 };
    expect(parseDraft(JSON.stringify(payload))?.response).toBe(100);
  });

  it("coerces a non-string caption to empty", () => {
    const payload = { ...serializeDraft(snapshot), caption: { evil: true } };
    expect(parseDraft(JSON.stringify(payload))?.caption).toBe("");
  });

  it("drops strokes whose point array length is not a multiple of four", () => {
    const payload = { ...serializeDraft(snapshot), strokes: [{ c: "gold", p: [1, 2, 3] }] };
    expect(parseDraft(JSON.stringify(payload))?.strokes).toEqual([]);
  });

  it("drops strokes containing non-finite numbers", () => {
    const payload = {
      ...serializeDraft(snapshot),
      strokes: [{ c: "gold", p: [1, 2, 0, 0, Number.NaN, 5, 10, 1] }],
    };
    expect(parseDraft(JSON.stringify(payload))?.strokes).toEqual([]);
  });

  it("returns null when strokes is not an array", () => {
    const payload = { ...serializeDraft(snapshot), strokes: "nope" };
    expect(parseDraft(JSON.stringify(payload))).toBeNull();
  });

  it("handles an empty draft", () => {
    const parsed = parseDraft(
      JSON.stringify(serializeDraft({ ...snapshot, strokes: [], caption: "" }))
    );
    expect(parsed?.strokes).toEqual([]);
    expect(parsed?.caption).toBe("");
  });
});
