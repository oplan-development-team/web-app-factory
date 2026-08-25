import { describe, expect, it, vi } from "vitest";
import {
  type EncodableCanvas,
  type ExportRequest,
  downloadResult,
  loadCaptionFonts,
  renderPoster,
  timestampedFilename,
} from "../../src/app/exporter";
import { resolveResolution } from "../../src/core/export-presets";
import { responseToMaxSpeed } from "../../src/core/ribbon-metrics";
import type { Stroke } from "../../src/core/stroke";
import { FakeCanvas, type RecordedCall } from "../helpers/fake-canvas";
import type { CanvasFactory } from "../../src/render/types";

class EncodableFakeCanvas extends FakeCanvas implements EncodableCanvas {
  blob: Blob | null = new Blob(["png"], { type: "image/png" });

  toBlob(callback: (blob: Blob | null) => void): void {
    callback(this.blob);
  }
}

function deps(options: { blob?: Blob | null } = {}): {
  createCanvas: CanvasFactory;
  loadFonts: () => Promise<void>;
  now: () => Date;
  created: EncodableFakeCanvas[];
  fontsLoaded: () => number;
} {
  const created: EncodableFakeCanvas[] = [];
  let fontCalls = 0;
  return {
    createCanvas: (width, height) => {
      const canvas = new EncodableFakeCanvas(width, height);
      if (options.blob !== undefined) {
        canvas.blob = options.blob;
      }
      created.push(canvas);
      return canvas;
    },
    loadFonts: async () => {
      fontCalls++;
    },
    now: () => new Date("2026-08-25T04:05:06.789Z"),
    created,
    fontsLoaded: () => fontCalls,
  };
}

const stroke: Stroke = {
  colorId: "gold",
  points: [
    { x: 100, y: 100, t: 0, speed: 0 },
    { x: 400, y: 300, t: 10, speed: 0.5 },
    { x: 900, y: 800, t: 20, speed: 1.2 },
  ],
};

function request(overrides: Partial<ExportRequest> = {}): ExportRequest {
  return {
    strokes: [stroke],
    backgroundHex: "#0a0908",
    maxSpeed: responseToMaxSpeed(50),
    caption: "",
    resolutionId: "edition",
    ...overrides,
  };
}

describe("timestampedFilename", () => {
  it("builds a filesystem-safe name from the timestamp (FR-009.2)", () => {
    expect(timestampedFilename(new Date("2026-08-25T04:05:06.789Z"))).toBe(
      "signature-ribbon-poster-2026-08-25T04-05-06-789Z.png"
    );
  });
});

describe("renderPoster", () => {
  it("renders at the selected resolution (FR-010.1)", async () => {
    const d = deps();
    const result = await renderPoster(request({ resolutionId: "archival" }), d);
    const preset = resolveResolution("archival");
    expect(result.width).toBe(preset.width);
    expect(result.height).toBe(preset.height);
    expect(d.created[0]!.width).toBe(preset.width);
  });

  it("returns an encoded PNG blob and a timestamped filename", async () => {
    const result = await renderPoster(request(), deps());
    expect(result.blob.type).toBe("image/png");
    expect(result.filename).toBe("signature-ribbon-poster-2026-08-25T04-05-06-789Z.png");
  });

  it("scales the artwork with the resolution so the composition is identical (FR-010.3)", async () => {
    const strokeWidthAt = async (resolutionId: "study" | "archival"): Promise<number> => {
      const d = deps();
      await renderPoster(request({ resolutionId }), d);
      const call = d.created[0]!.ctx.ops("stroke")[0] as RecordedCall;
      return call.state.lineWidth as number;
    };
    const small = await strokeWidthAt("study");
    const large = await strokeWidthAt("archival");
    expect(large / small).toBeCloseTo(
      resolveResolution("archival").scale / resolveResolution("study").scale,
      5
    );
  });

  it("paints background, bloom and core onto the output canvas", async () => {
    const d = deps();
    await renderPoster(request(), d);
    const output = d.created.at(-1)!;
    expect(output.ctx.ops("fillRect")[0]!.state.fillStyle).toBe("#0a0908");
    expect(output.ctx.ops("drawImage").length).toBeGreaterThan(1);
  });

  it("uses the three-level export bloom, not the lighter preview one (NFR-001.4)", async () => {
    const d = deps();
    await renderPoster(request(), d);
    // core + 3 bloom levels + output
    expect(d.created).toHaveLength(5);
  });

  it("skips fonts and caption entirely when there is no caption (FR-007.4)", async () => {
    const d = deps();
    await renderPoster(request({ caption: "   " }), d);
    expect(d.fontsLoaded()).toBe(0);
    expect(d.created.at(-1)!.ctx.ops("fillText")).toHaveLength(0);
  });

  it("waits for the caption fonts before burning the caption in (FR-009.4)", async () => {
    const d = deps();
    await renderPoster(request({ caption: "Hotta / 2026" }), d);
    expect(d.fontsLoaded()).toBe(1);
    expect(d.created.at(-1)!.ctx.ops("fillText").length).toBeGreaterThan(0);
  });

  it("reports a clear error when encoding fails (E-13)", async () => {
    await expect(renderPoster(request(), deps({ blob: null }))).rejects.toThrow(
      /PNGに変換できませんでした/
    );
  });

  it("does not reuse the preview layers: every export allocates its own", async () => {
    const d = deps();
    await renderPoster(request(), d);
    const firstBatch = d.created.length;
    await renderPoster(request(), d);
    expect(d.created).toHaveLength(firstBatch * 2);
  });

  it("renders an empty poster without strokes", async () => {
    const d = deps();
    const result = await renderPoster(request({ strokes: [] }), d);
    expect(result.blob).toBeInstanceOf(Blob);
  });
});

describe("loadCaptionFonts", () => {
  it("resolves even when a font fails to load (E-12)", async () => {
    const original = document.fonts;
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        load: () => Promise.reject(new Error("offline")),
        ready: Promise.reject(new Error("offline")),
      },
    });
    await expect(loadCaptionFonts()).resolves.toBeUndefined();
    Object.defineProperty(document, "fonts", { configurable: true, value: original });
  });

  it("resolves when the Font Loading API is unavailable", async () => {
    const original = document.fonts;
    Object.defineProperty(document, "fonts", { configurable: true, value: undefined });
    await expect(loadCaptionFonts()).resolves.toBeUndefined();
    Object.defineProperty(document, "fonts", { configurable: true, value: original });
  });
});

describe("downloadResult", () => {
  it("triggers a download and cleans up the object URL", () => {
    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    const clicked: string[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement): void {
      clicked.push(this.download);
    };

    downloadResult({
      blob: new Blob(["png"]),
      filename: "poster.png",
      width: 1800,
      height: 2545,
    });

    expect(clicked).toEqual(["poster.png"]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    expect(document.querySelector("a")).toBeNull();

    HTMLAnchorElement.prototype.click = originalClick;
    vi.unstubAllGlobals();
  });
});
