import type { CrackSegment } from './types';
import type { GlazeSpec } from './glaze';
import { paintGlaze } from './glaze';
import type { VesselSpec, VesselTransform } from './vessels';
import { buildCanvasPath, getBounds, toCanvasPoint } from './vessels';
import { drawGoldPolyline, drawRawCrack } from './goldStroke';
import { slicePolyline } from './cracks';

/** Warm, low-contrast backdrop: a black-lacquer field with a soft central
 * glow (so the vessel reads as lit from the front) and a fine grain texture
 * to avoid a dead-flat digital black. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.fillStyle = '#100e0c';
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.65);
  glow.addColorStop(0, 'rgba(58,46,26,0.55)');
  glow.addColorStop(0.55, 'rgba(30,22,14,0.25)');
  glow.addColorStop(1, 'rgba(16,14,12,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Faint grain: sparse dark/light dots, seeded per canvas size so it stays
  // stable across re-draws without needing to persist a texture.
  const grainCount = Math.floor((w * h) / 2600);
  let seed = Math.floor(w * 7919 + h * 104729);
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < grainCount; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const a = 0.015 + rand() * 0.025;
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,232,180,${a})` : `rgba(0,0,0,${a * 1.4})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

export interface DrawVesselOptions {
  progressMap?: Map<CrackSegment, number> | null;
  /** When true, all segments render fully mended (used for the poster stage). */
  fullyMended?: boolean;
}

/**
 * Draws the vessel (glaze-filled silhouette) plus every crack segment, in
 * whatever mend state `options` describes. Shared by the live workbench view
 * and the poster/export composition so the two never visually drift apart.
 */
export function drawVesselWithCracks(
  ctx: CanvasRenderingContext2D,
  spec: VesselSpec,
  glaze: GlazeSpec,
  transform: VesselTransform,
  segments: CrackSegment[],
  options: DrawVesselOptions = {},
): void {
  const bounds = getBounds(spec);
  const path = buildCanvasPath(spec, transform);
  const radius = (Math.max(bounds.width, bounds.height) / 2) * transform.scale;

  paintGlaze(ctx, path, glaze, transform.cx, transform.cy, radius);

  ctx.save();
  ctx.clip(path);
  for (const seg of segments) {
    const canvasPts = seg.points.map((p) => toCanvasPoint(p, transform, bounds));
    const progress = options.fullyMended ? 1 : (options.progressMap?.get(seg) ?? 0);
    const widthPx = seg.widthBase * transform.scale;

    if (progress <= 0) {
      drawRawCrack(ctx, canvasPts, widthPx * 0.55);
    } else if (progress < 1) {
      drawRawCrack(ctx, canvasPts, widthPx * 0.55);
      const sliced = slicePolyline(seg.points, progress);
      const slicedCanvas = sliced.map((p) => toCanvasPoint(p, transform, bounds));
      drawGoldPolyline(ctx, slicedCanvas, widthPx);
    } else {
      drawGoldPolyline(ctx, canvasPts, widthPx);
    }
  }
  ctx.restore();
}
