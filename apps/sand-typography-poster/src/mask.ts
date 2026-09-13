/**
 * Builds a binary occupancy mask for a short phrase, at the resolution of
 * the simulation grid. Text is rendered to a super-sampled offscreen canvas
 * first so that thin strokes and inner counters (o, e, あ, ...) survive
 * downsampling, then block-averaged + thresholded down to the grid.
 */
export interface MaskResult {
  mask: Uint8Array;
  insideCount: number;
  width: number;
  height: number;
}

const SUPERSAMPLE = 4;

export async function buildTextMask(
  text: string,
  fontFamily: string,
  gridW: number,
  gridH: number,
): Promise<MaskResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('empty');
  }

  const w = gridW * SUPERSAMPLE;
  const h = gridH * SUPERSAMPLE;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('canvas-unavailable');
  }

  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = 'center';
  // Centering uses the glyph's own measured ink box (below) rather than
  // relying on 'middle' baseline, whose vertical anchor is defined by the
  // font's em-box metrics — for CJK faces in particular that anchor sits
  // well above the glyph's visual center, so text drawn with it looks
  // pushed toward the top of the stage instead of centered.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';

  const maxWidth = w * 0.86;
  const maxHeight = h * 0.62;

  let fontSize = h * 0.6;
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  let metrics = ctx.measureText(trimmed);
  if (metrics.width > maxWidth) {
    fontSize *= maxWidth / metrics.width;
  }
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  metrics = ctx.measureText(trimmed);
  let ascent = metrics.actualBoundingBoxAscent ?? fontSize * 0.7;
  let descent = metrics.actualBoundingBoxDescent ?? fontSize * 0.25;
  const measuredHeight = ascent + descent;
  if (measuredHeight > maxHeight) {
    fontSize *= maxHeight / measuredHeight;
  }
  fontSize = Math.max(fontSize, 4);
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  metrics = ctx.measureText(trimmed);
  ascent = metrics.actualBoundingBoxAscent ?? fontSize * 0.7;
  descent = metrics.actualBoundingBoxDescent ?? fontSize * 0.25;

  // Baseline placed so the glyph's actual ink bounding box — not the
  // font's abstract em-box — is vertically centered in the canvas.
  const baselineY = h / 2 + (ascent - descent) / 2;
  ctx.fillText(trimmed, w / 2, baselineY);

  const { data } = ctx.getImageData(0, 0, w, h);
  const mask = new Uint8Array(gridW * gridH);
  const threshold = 0.42 * 255 * SUPERSAMPLE * SUPERSAMPLE;
  let insideCount = 0;

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      let sum = 0;
      const baseY = gy * SUPERSAMPLE;
      const baseX = gx * SUPERSAMPLE;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        const rowStart = ((baseY + sy) * w + baseX) * 4;
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          sum += data[rowStart + sx * 4 + 3] ?? 0;
        }
      }
      if (sum > threshold) {
        mask[gy * gridW + gx] = 1;
        insideCount++;
      }
    }
  }

  if (insideCount < 12) {
    throw new Error('no-glyph');
  }

  return { mask, insideCount, width: gridW, height: gridH };
}
