import { describe, expect, it } from "vitest";
import {
  BACKGROUND_PRESETS,
  DEFAULT_BACKGROUND_ID,
  DEFAULT_HUE_ID,
  RIBBON_HUES,
  hexToRgb,
  isBackgroundId,
  isRibbonHueId,
  lighten,
  resolveBackground,
  resolveHue,
  rgba,
} from "../../src/core/palette";

describe("palette presets", () => {
  it("exposes the three background presets from the prototype", () => {
    expect(BACKGROUND_PRESETS.map((preset) => preset.id)).toEqual([
      "noir",
      "midnight-navy",
      "deep-bordeaux",
    ]);
  });

  it("exposes the five ribbon hues from the prototype", () => {
    expect(RIBBON_HUES.map((hue) => hue.id)).toEqual([
      "gold",
      "ice-blue",
      "crimson",
      "pearl",
      "emerald",
    ]);
  });

  it("defaults to noir and gold", () => {
    expect(DEFAULT_BACKGROUND_ID).toBe("noir");
    expect(DEFAULT_HUE_ID).toBe("gold");
  });

  it("gives every preset a label and a 6-digit hex", () => {
    for (const preset of [...BACKGROUND_PRESETS, ...RIBBON_HUES]) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("resolveBackground / resolveHue", () => {
  it("resolves a known id", () => {
    expect(resolveBackground("midnight-navy").hex).toBe("#0b1220");
    expect(resolveHue("crimson").hex).toBe("#d1264f");
  });

  it("falls back to the default for an unknown id", () => {
    expect(resolveBackground("nope").id).toBe(DEFAULT_BACKGROUND_ID);
    expect(resolveHue("nope").id).toBe(DEFAULT_HUE_ID);
  });
});

describe("id guards", () => {
  it("accepts known ids", () => {
    expect(isBackgroundId("noir")).toBe(true);
    expect(isRibbonHueId("pearl")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isBackgroundId("noir ")).toBe(false);
    expect(isBackgroundId(42)).toBe(false);
    expect(isRibbonHueId(null)).toBe(false);
    expect(isRibbonHueId(undefined)).toBe(false);
  });
});

describe("hexToRgb", () => {
  it("parses a full-length hex", () => {
    expect(hexToRgb("#d9ac4c")).toEqual({ r: 217, g: 172, b: 76 });
  });

  it("parses without the leading hash", () => {
    expect(hexToRgb("ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("expands a 3-digit shorthand", () => {
    expect(hexToRgb("#0f8")).toEqual({ r: 0, g: 255, b: 136 });
  });

  it("returns black for malformed input rather than NaN channels", () => {
    expect(hexToRgb("zzz")).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("rgba", () => {
  it("builds a css rgba string", () => {
    expect(rgba("#000000", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("clamps alpha into 0..1", () => {
    expect(rgba("#ffffff", 3)).toBe("rgba(255, 255, 255, 1)");
    expect(rgba("#ffffff", -1)).toBe("rgba(255, 255, 255, 0)");
  });
});

describe("lighten", () => {
  it("returns the same colour at amount 0", () => {
    expect(lighten("#204060", 0)).toBe("rgb(32, 64, 96)");
  });

  it("returns white at amount 1", () => {
    expect(lighten("#204060", 1)).toBe("rgb(255, 255, 255)");
  });

  it("mixes toward white in between", () => {
    expect(lighten("#000000", 0.5)).toBe("rgb(128, 128, 128)");
  });
});
