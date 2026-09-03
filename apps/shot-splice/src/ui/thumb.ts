import { type CanvasFactory, context2d, createCanvas } from '../imaging/surface';
import type { Shot } from './store';

export const THUMB_WIDTH = 54;
export const THUMB_HEIGHT = 92;

/**
 * Renders a shot into a fixed thumbnail box, letterboxed rather than cropped.
 *
 * Phone screenshots are far taller than they are wide, so a fill-and-crop
 * thumbnail would show only the status bar — precisely the part that is
 * identical across every shot and therefore useless for telling them apart.
 */
export function drawThumb(
  shot: Shot,
  ratio: number,
  factory: CanvasFactory = createCanvas,
): { canvas: ReturnType<CanvasFactory>; width: number; height: number } {
  const boxW = THUMB_WIDTH;
  const boxH = THUMB_HEIGHT;
  const scale = Math.min(boxW / shot.naturalWidth, boxH / shot.naturalHeight);
  const width = Math.max(1, Math.round(shot.naturalWidth * scale));
  const height = Math.max(1, Math.round(shot.naturalHeight * scale));

  const canvas = factory(width * ratio, height * ratio);
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const ctx = context2d(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(
    shot.source,
    0,
    0,
    shot.naturalWidth,
    shot.naturalHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return { canvas, width, height };
}

export function cssColor(shot: Shot, alpha: number): string {
  const { r, g, b } = shot.averageColor;
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}
