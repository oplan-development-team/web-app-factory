export interface GrayImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Draws an image into a plain canvas at its natural size. */
export function canvasFromImage(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2Dコンテキストを取得できませんでした');
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/**
 * Cuts a fixed number of pixels off one edge of an image and returns the
 * remainder as a canvas. edge='bottom' trims the tail (for the top shot's
 * footer/header removal); edge='top' trims the head (for the bottom shot's
 * header removal).
 */
export function buildCroppedCanvas(
  img: HTMLImageElement,
  cutPx: number,
  edge: 'top' | 'bottom',
): HTMLCanvasElement {
  const width = img.naturalWidth;
  const clampedCut = Math.max(0, Math.min(cutPx, img.naturalHeight - 1));
  const effectiveHeight = Math.max(1, img.naturalHeight - clampedCut);
  const sourceY = edge === 'top' ? clampedCut : 0;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = effectiveHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2Dコンテキストを取得できませんでした');
  ctx.drawImage(img, 0, sourceY, width, effectiveHeight, 0, 0, width, effectiveHeight);
  return canvas;
}

/** Scales a canvas to a target width, preserving aspect ratio. */
export function scaleToWidth(canvas: HTMLCanvasElement, targetWidth: number): HTMLCanvasElement {
  if (canvas.width === targetWidth) return canvas;
  const scale = targetWidth / canvas.width;
  const targetHeight = Math.max(1, Math.round(canvas.height * scale));
  const out = document.createElement('canvas');
  out.width = targetWidth;
  out.height = targetHeight;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('2Dコンテキストを取得できませんでした');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
  return out;
}

/** Converts a canvas to a flat single-channel luminance buffer, optionally downscaling first. */
export function toGrayscale(canvas: HTMLCanvasElement, maxWidth?: number): GrayImage {
  const source = maxWidth && canvas.width > maxWidth ? scaleToWidth(canvas, maxWidth) : canvas;
  const ctx = source.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2Dコンテキストを取得できませんでした');
  const { data, width, height } = ctx.getImageData(0, 0, source.width, source.height);
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return { data: gray, width, height };
}

/**
 * Converts a canvas to grayscale after squashing only its width (height is
 * left untouched). Used for the coarse alignment pass: a narrower width
 * makes each row cheap to compare, but keeping full vertical resolution
 * preserves a pixel-exact seam instead of blurring it into neighboring rows.
 */
export function toGrayscaleFullHeight(canvas: HTMLCanvasElement, targetWidth: number): GrayImage {
  const width = Math.max(1, Math.min(targetWidth, canvas.width));
  if (width === canvas.width) return toGrayscale(canvas);
  const squashed = document.createElement('canvas');
  squashed.width = width;
  squashed.height = canvas.height;
  const ctx = squashed.getContext('2d');
  if (!ctx) throw new Error('2Dコンテキストを取得できませんでした');
  ctx.drawImage(canvas, 0, 0, width, canvas.height);
  return toGrayscale(squashed);
}
