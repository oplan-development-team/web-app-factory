import type { FrontLayer, Layout, PlacedShot } from '../core/types';
import { type CanvasFactory, type CanvasLike, context2d, createCanvas } from './surface';

export interface ShotSource {
  readonly source: CanvasImageSource;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
}

export interface ComposeOptions {
  /** Which side wins inside each overlap band. Length = shots.length - 1. */
  readonly fronts?: readonly FrontLayer[];
  readonly factory?: CanvasFactory;
  /** 1 = full resolution. The preview renders small; only the export is full size. */
  readonly scale?: number;
  readonly background?: string;
}

/**
 * Maps a Y coordinate from layout space (where every shot has been normalised
 * to the output width) back into the source image's own pixel grid.
 */
function toSourceY(shot: ShotSource, layoutHeight: number, y: number): number {
  if (layoutHeight <= 0) return 0;
  return (y * shot.naturalHeight) / layoutHeight;
}

/** Full height of a shot in layout space, before cuts. */
function layoutHeightOf(placed: PlacedShot): number {
  return placed.cutTop + placed.height + placed.cutBottom;
}

function drawRegion(
  ctx: ReturnType<typeof context2d>,
  shot: ShotSource,
  placed: PlacedShot,
  fromLayoutY: number,
  rows: number,
  destY: number,
  destWidth: number,
  scale: number,
): void {
  if (rows <= 0) return;
  const full = layoutHeightOf(placed);
  const sy = toSourceY(shot, full, fromLayoutY);
  const sh = toSourceY(shot, full, rows);
  ctx.drawImage(
    shot.source,
    0,
    sy,
    shot.naturalWidth,
    sh,
    0,
    destY * scale,
    destWidth * scale,
    rows * scale,
  );
}

/**
 * Paints the finished splice.
 *
 * Shots are drawn in order, so by default the lower shot covers the seam. Where
 * the user asked for the upper shot to win, its overlap band is repainted
 * afterwards — this keeps the ordering rule local to each seam instead of
 * forcing a global draw order that cannot satisfy conflicting choices.
 */
export function composeCanvas(
  shots: readonly ShotSource[],
  layout: Layout,
  options: ComposeOptions = {},
): CanvasLike {
  const factory = options.factory ?? createCanvas;
  const scale = options.scale ?? 1;
  const width = Math.max(1, Math.round(layout.width * scale));
  const height = Math.max(1, Math.round(layout.height * scale));

  const canvas = factory(width, height);
  canvas.width = width;
  canvas.height = height;
  const ctx = context2d(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';

  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, width, height);
  }

  layout.shots.forEach((placed, i) => {
    const shot = shots[i];
    if (!shot) return;
    drawRegion(ctx, shot, placed, placed.cutTop, placed.height, placed.y, layout.width, scale);
  });

  layout.overlaps.forEach((overlap, i) => {
    if (overlap <= 0) return;
    if ((options.fronts?.[i] ?? 'lower') !== 'upper') return;
    const placed = layout.shots[i];
    const shot = shots[i];
    const lower = layout.shots[i + 1];
    if (!placed || !shot || !lower) return;
    const fromLayoutY = placed.cutTop + placed.height - overlap;
    drawRegion(ctx, shot, placed, fromLayoutY, overlap, lower.y, layout.width, scale);
  });

  return canvas;
}

/** Renders one shot's contribution to a seam band at full resolution. */
function bandCanvas(
  shot: ShotSource,
  placed: PlacedShot,
  fromLayoutY: number,
  rows: number,
  width: number,
  factory: CanvasFactory,
): CanvasLike {
  const canvas = factory(width, rows);
  canvas.width = width;
  canvas.height = rows;
  const ctx = context2d(canvas, true);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  drawRegion(ctx, shot, placed, fromLayoutY, rows, 0, width, 1);
  return canvas;
}

export interface SeamViewOptions extends ComposeOptions {
  /** Rows of surrounding image kept above and below the band, for orientation. */
  readonly contextPx?: number;
  readonly diff?: boolean;
}

export interface SeamView {
  readonly canvas: CanvasLike;
  /** Y offset of the returned crop within the full layout. */
  readonly originY: number;
  /** Y offset of the overlap band within the returned crop. */
  readonly bandY: number;
  readonly bandHeight: number;
}

/**
 * Crops the neighbourhood of one seam at full resolution.
 *
 * In diff mode the shared band is replaced by the absolute per-channel
 * difference between the two shots, so a correct alignment reads as flat black.
 * The difference is always computed on full-resolution pixels even when the
 * result is later displayed small — computing it on a downscaled copy would
 * average away exactly the one-pixel errors it exists to reveal.
 */
export function seamView(
  shots: readonly ShotSource[],
  layout: Layout,
  seamIndex: number,
  options: SeamViewOptions = {},
): SeamView | null {
  const upper = layout.shots[seamIndex];
  const lower = layout.shots[seamIndex + 1];
  const upperShot = shots[seamIndex];
  const lowerShot = shots[seamIndex + 1];
  if (!upper || !lower || !upperShot || !lowerShot) return null;

  const factory = options.factory ?? createCanvas;
  const overlap = layout.overlaps[seamIndex] ?? 0;
  const context = Math.max(0, Math.round(options.contextPx ?? 120));

  const originY = Math.max(0, lower.y - context);
  const endY = Math.min(layout.height, lower.y + overlap + context);
  const height = Math.max(1, Math.round(endY - originY));
  const width = Math.max(1, Math.round(layout.width));

  const canvas = factory(width, height);
  canvas.width = width;
  canvas.height = height;
  const ctx = context2d(canvas, true);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, width, height);
  }

  layout.shots.forEach((placed, i) => {
    const shot = shots[i];
    if (!shot) return;
    if (placed.y + placed.height <= originY || placed.y >= endY) return;
    drawRegion(ctx, shot, placed, placed.cutTop, placed.height, placed.y - originY, width, 1);
  });

  if ((options.fronts?.[seamIndex] ?? 'lower') === 'upper' && overlap > 0) {
    const fromLayoutY = upper.cutTop + upper.height - overlap;
    drawRegion(ctx, upperShot, upper, fromLayoutY, overlap, lower.y - originY, width, 1);
  }

  const bandY = Math.round(lower.y - originY);

  if (options.diff && overlap > 0) {
    const upperBand = bandCanvas(
      upperShot,
      upper,
      upper.cutTop + upper.height - overlap,
      overlap,
      width,
      factory,
    );
    const lowerBand = bandCanvas(lowerShot, lower, lower.cutTop, overlap, width, factory);
    const a = context2d(upperBand, true).getImageData(0, 0, width, overlap);
    const b = context2d(lowerBand, true).getImageData(0, 0, width, overlap);
    const out = ctx.createImageData(width, overlap);
    for (let i = 0; i < out.data.length; i += 4) {
      out.data[i] = Math.abs((a.data[i] as number) - (b.data[i] as number));
      out.data[i + 1] = Math.abs((a.data[i + 1] as number) - (b.data[i + 1] as number));
      out.data[i + 2] = Math.abs((a.data[i + 2] as number) - (b.data[i + 2] as number));
      out.data[i + 3] = 255;
    }
    ctx.putImageData(out, 0, bandY);
  }

  return { canvas, originY, bandY, bandHeight: overlap };
}
