import type { Palette, PhotoTransform } from './types.ts';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

/**
 * Renders `img` into an off-screen canvas sized (boxW, boxH), honoring the
 * cover-fit + pan (cropX/cropY) + zoom transform, then manually walks every
 * pixel to: 1) compute luminance, 2) threshold it into two bands, 3) replace
 * the pixel with the palette's highlight or shadow color. No canvas filter()
 * or third-party image library is used — this is the "自前実装" pixel pass
 * the concept calls for.
 */
export function buildDuotoneCanvas(
  img: HTMLImageElement,
  transform: PhotoTransform,
  boxW: number,
  boxH: number,
  palette: Palette,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(boxW));
  canvas.height = Math.max(1, Math.round(boxH));
  const ctx = canvas.getContext('2d')!;

  const scale = Math.max(canvas.width / img.width, canvas.height / img.height) * (transform.zoom / 100);
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;

  const panX = ((drawWidth - canvas.width) / 2) * (transform.cropX / 100);
  const panY = ((drawHeight - canvas.height) / 2) * (transform.cropY / 100);
  const offsetX = (canvas.width - drawWidth) / 2 - panX;
  const offsetY = (canvas.height - drawHeight) / 2 - panY;

  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

  const [hr, hg, hb] = hexToRgb(palette.highlight);
  const [sr, sg, sb] = hexToRgb(palette.shadow);
  const thresholdValue = (transform.threshold / 100) * 255;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    // Perceptual luminance (Rec. 709 coefficients).
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (luminance >= thresholdValue) {
      data[i] = hr;
      data[i + 1] = hg;
      data[i + 2] = hb;
    } else {
      data[i] = sr;
      data[i + 1] = sg;
      data[i + 2] = sb;
    }
    data[i + 3] = a === 0 ? 0 : 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
