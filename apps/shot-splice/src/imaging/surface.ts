/**
 * Structural stand-ins for the Canvas APIs this app actually uses.
 *
 * jsdom ships no Canvas 2D implementation, so any module that names
 * `CanvasRenderingContext2D` directly becomes impossible to unit test. Naming
 * only the members we call keeps the real browser objects structurally
 * assignable while letting tests pass in a recorder.
 */
export interface Ctx2DLike {
  fillStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
  filter: string;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  save(): void;
  restore(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(source: CanvasLike | CanvasImageSource, dx: number, dy: number): void;
  drawImage(
    source: CanvasLike | CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  getImageData(x: number, y: number, w: number, h: number): ImageData;
  putImageData(data: ImageData, x: number, y: number): void;
  createImageData(w: number, h: number): ImageData;
}

export interface CanvasLike {
  width: number;
  height: number;
  getContext(id: '2d', options?: { willReadFrequently?: boolean }): Ctx2DLike | null;
}

export type CanvasFactory = (width: number, height: number) => CanvasLike;

/** The single place the app touches the DOM to obtain a drawing surface. */
export const createCanvas: CanvasFactory = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas as unknown as CanvasLike;
};

export function context2d(canvas: CanvasLike, willReadFrequently = false): Ctx2DLike {
  const ctx = canvas.getContext('2d', { willReadFrequently });
  if (!ctx) throw new Error('Canvas 2D コンテキストを取得できませんでした');
  return ctx;
}
