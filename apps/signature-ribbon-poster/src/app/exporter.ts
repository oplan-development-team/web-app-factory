import { resolveResolution, type ResolutionId } from "../core/export-presets";
import { POSTER_WIDTH } from "../core/poster";
import type { Stroke } from "../core/stroke";
import { BloomPipeline, EXPORT_BLOOM_LEVELS } from "../render/bloom";
import { drawCaption } from "../render/caption";
import { RibbonPainter } from "../render/ribbon-painter";
import { composeScene } from "../render/scene";
import { type CanvasFactory, type CanvasLike, require2d } from "../render/types";

export interface ExportRequest {
  readonly strokes: readonly Stroke[];
  readonly backgroundHex: string;
  readonly maxSpeed: number;
  readonly caption: string;
  readonly resolutionId: ResolutionId;
}

export interface ExportResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly width: number;
  readonly height: number;
}

/** A canvas that can also encode itself, which the fake in tests provides too. */
export interface EncodableCanvas extends CanvasLike {
  toBlob(callback: (blob: Blob | null) => void, type?: string): void;
}

export interface ExporterDeps {
  readonly createCanvas: CanvasFactory;
  /** Waits for the caption web fonts; resolves even if they fail to load (E-12). */
  readonly loadFonts: () => Promise<void>;
  readonly now: () => Date;
}

export function timestampedFilename(date: Date): string {
  return `signature-ribbon-poster-${date.toISOString().replace(/[:.]/g, "-")}.png`;
}

/**
 * Waits for the caption faces, never rejecting: a missing web font must degrade
 * to the fallback serif rather than abort the export (FR-009.4, E-12).
 */
export async function loadCaptionFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) {
    return;
  }
  await Promise.allSettled([
    document.fonts.load('italic 500 64px "Playfair Display"'),
    document.fonts.load('500 28px "Cormorant Garamond"'),
  ]);
  await document.fonts.ready.catch(() => undefined);
}

/**
 * Renders the poster at full export resolution on its own offscreen layers.
 *
 * This deliberately does not reuse the preview layers: the preview is sized for
 * the screen, while the export runs at the chosen resolution with an extra bloom
 * level and high-quality resampling (NFR-001.4).
 */
export async function renderPoster(
  request: ExportRequest,
  deps: ExporterDeps
): Promise<ExportResult> {
  const preset = resolveResolution(request.resolutionId);
  const { width, height } = preset;

  const core = deps.createCanvas(width, height);
  const painter = new RibbonPainter(require2d(core), {
    scale: width / POSTER_WIDTH,
    maxSpeed: request.maxSpeed,
    width,
    height,
  });
  painter.repaint(request.strokes);

  const bloom = new BloomPipeline(deps.createCanvas, EXPORT_BLOOM_LEVELS);
  bloom.resize(width, height);
  bloom.update(core);

  const output = deps.createCanvas(width, height) as EncodableCanvas;
  const ctx = require2d(output);
  composeScene(ctx, { width, height, backgroundHex: request.backgroundHex, core, bloom });

  if (request.caption.trim().length > 0) {
    await deps.loadFonts();
    drawCaption(ctx, { width, height, backgroundHex: request.backgroundHex, text: request.caption });
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    output.toBlob(resolve, "image/png");
  });
  if (!blob) {
    throw new Error("ポスターをPNGに変換できませんでした");
  }

  return { blob, filename: timestampedFilename(deps.now()), width, height };
}

/** Hands the encoded poster to the browser as a download. */
export function downloadResult(result: ExportResult): void {
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
