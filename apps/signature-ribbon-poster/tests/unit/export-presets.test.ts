import { describe, expect, it } from "vitest";
import { POSTER_HEIGHT, POSTER_WIDTH } from "../../src/core/poster";
import {
  DEFAULT_RESOLUTION_ID,
  RESOLUTION_PRESETS,
  isResolutionId,
  resolveResolution,
} from "../../src/core/export-presets";

describe("resolution presets", () => {
  it("offers study / edition / archival", () => {
    expect(RESOLUTION_PRESETS.map((preset) => preset.id)).toEqual([
      "study",
      "edition",
      "archival",
    ]);
  });

  it("defaults to edition, which matches the prototype resolution", () => {
    expect(DEFAULT_RESOLUTION_ID).toBe("edition");
    const edition = resolveResolution("edition");
    expect(edition.width).toBe(POSTER_WIDTH);
    expect(edition.height).toBe(POSTER_HEIGHT);
    expect(edition.scale).toBe(1);
  });

  it("keeps the poster aspect ratio at every resolution, within rounding (FR-010.3)", () => {
    for (const preset of RESOLUTION_PRESETS) {
      expect(preset.width / preset.height).toBeCloseTo(POSTER_WIDTH / POSTER_HEIGHT, 3);
    }
  });

  it("derives the scale factor from the poster width", () => {
    expect(resolveResolution("study").scale).toBeCloseTo(0.5);
    expect(resolveResolution("archival").scale).toBeCloseTo(2);
  });

  it("orders the presets from small to large", () => {
    const widths = RESOLUTION_PRESETS.map((preset) => preset.width);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
  });

  it("gives every preset integer pixel dimensions", () => {
    for (const preset of RESOLUTION_PRESETS) {
      expect(Number.isInteger(preset.width)).toBe(true);
      expect(Number.isInteger(preset.height)).toBe(true);
    }
  });

  it("falls back to the default for an unknown id", () => {
    expect(resolveResolution("huge").id).toBe(DEFAULT_RESOLUTION_ID);
  });

  it("guards ids", () => {
    expect(isResolutionId("archival")).toBe(true);
    expect(isResolutionId("ARCHIVAL")).toBe(false);
    expect(isResolutionId(null)).toBe(false);
  });
});
