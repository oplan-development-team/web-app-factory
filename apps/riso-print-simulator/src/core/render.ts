import { AppState } from '../types';
import { drawCover, makeAlphaSampler } from '../utils/canvas';
import { buildPlates } from './plates';
import { computeLuminanceMap, toneBandDensity } from './densityMap';
import { drawAngledDotScreen, makeArraySampler } from './halftone';
import { drawPaper } from './paper';
import { drawRegistrationMarks } from './registrationMarks';
import { buildContentMask, drawFlatContent } from './content';

/**
 * Runs the entire riso-decomposition pipeline (photo grayscale → tone bands →
 * angled halftone screens → flat text/shape plate → misregistered multiply
 * overprint → paper texture) into `ctx` at the given pixel resolution. Used
 * both for the live preview canvas and, at a higher resolution, for PNG
 * export — the same function guarantees export isn't just an upscaled
 * screenshot of the preview.
 */
export function renderPoster(ctx: CanvasRenderingContext2D, width: number, height: number, state: AppState): void {
  ctx.clearRect(0, 0, width, height);
  drawPaper(ctx, width, height, state.paperTone, state.paperGrain);

  const plates = buildPlates(state.selectedInks, state.angleSpread, state.misregistrationStrength, state.registrationSeed);
  const plateCount = plates.length;

  let luminance: Float32Array | null = null;
  if (state.photo.bitmap) {
    const photoCanvas = document.createElement('canvas');
    photoCanvas.width = width;
    photoCanvas.height = height;
    const photoCtx = photoCanvas.getContext('2d');
    if (photoCtx) {
      drawCover(photoCtx, state.photo.bitmap, width, height);
      luminance = computeLuminanceMap(photoCtx.getImageData(0, 0, width, height));
    }
  }

  const hasTextShapeContent = state.heading.trim() !== '' || state.subtext.trim() !== '' || state.shape !== 'none';
  let maskSampler: ((x: number, y: number) => number) | null = null;
  if (hasTextShapeContent) {
    const maskCanvas = buildContentMask(width, height, state);
    const maskCtx = maskCanvas.getContext('2d');
    if (maskCtx) {
      maskSampler = makeAlphaSampler(maskCtx.getImageData(0, 0, width, height), width, height);
    }
  }

  const cellSize = Math.max(4, Math.round(width / 100));

  for (const plate of plates) {
    const plateCanvas = document.createElement('canvas');
    plateCanvas.width = width;
    plateCanvas.height = height;
    const plateCtx = plateCanvas.getContext('2d');
    if (!plateCtx) continue;

    const isTextPlate = hasTextShapeContent && plate.ink === state.textPlateInk;

    if (luminance) {
      const band = toneBandDensity(luminance, plateCount, plate.bandIndex);
      const bandSampler = makeArraySampler(band, width, height);
      const sampler = isTextPlate && maskSampler
        ? (x: number, y: number) => bandSampler(x, y) * (1 - maskSampler!(x, y))
        : bandSampler;
      drawAngledDotScreen(plateCtx, {
        width,
        height,
        angleDeg: plate.angleDeg,
        cellSize,
        color: plate.hex,
        maxAlpha: 0.92,
        sampleDensity: sampler,
      });
    }

    if (isTextPlate) {
      drawFlatContent(plateCtx, width, height, state, plate.hex);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(plateCanvas, plate.offset.dx, plate.offset.dy);
    ctx.restore();
  }

  if (state.showRegistrationMarks) {
    drawRegistrationMarks(ctx, width, height);
  }
}
