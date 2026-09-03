import type { CanvasFactory, CanvasLike, Ctx2DLike } from '../../src/imaging/surface';

export interface DrawCall {
  readonly source: unknown;
  readonly args: readonly number[];
}

export interface FakeCanvas extends CanvasLike {
  readonly calls: DrawCall[];
  readonly fills: { style: unknown; rect: readonly number[] }[];
  readonly puts: { data: ImageData; x: number; y: number }[];
  /** RGBA bytes the fake reports from getImageData. */
  pixels: Uint8ClampedArray | null;
}

function imageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  return { data, width, height, colorSpace: 'srgb' } as unknown as ImageData;
}

/**
 * A CanvasLike that records what was drawn instead of rasterising it.
 *
 * `fill` decides what getImageData reports, so tests can drive the luminance
 * conversion without a real 2D context.
 */
export function fakeCanvas(width = 0, height = 0, fill?: (i: number) => number): FakeCanvas {
  const calls: DrawCall[] = [];
  const fills: { style: unknown; rect: readonly number[] }[] = [];
  const puts: { data: ImageData; x: number; y: number }[] = [];

  const canvas: FakeCanvas = {
    width,
    height,
    calls,
    fills,
    puts,
    pixels: null,
    getContext(): Ctx2DLike {
      return ctx;
    },
  };

  const ctx: Ctx2DLike = {
    fillStyle: '#000',
    globalAlpha: 1,
    filter: 'none',
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    save: () => {},
    restore: () => {},
    fillRect: (x, y, w, h) => {
      fills.push({ style: ctx.fillStyle, rect: [x, y, w, h] });
    },
    drawImage: (source: unknown, ...args: number[]) => {
      calls.push({ source, args });
    },
    getImageData: (_x, _y, w, h) => {
      if (canvas.pixels) return imageData(canvas.pixels, w, h);
      const data = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < data.length; i += 1) data[i] = fill ? fill(i) : 0;
      return imageData(data, w, h);
    },
    putImageData: (data, x, y) => {
      puts.push({ data, x, y });
    },
    createImageData: (w, h) => imageData(new Uint8ClampedArray(w * h * 4), w, h),
  };

  return canvas;
}

/** Factory that hands out fakes and remembers each one it created. */
export function fakeFactory(fill?: (i: number) => number): CanvasFactory & { created: FakeCanvas[] } {
  const created: FakeCanvas[] = [];
  const factory: CanvasFactory = (width: number, height: number) => {
    const canvas = fakeCanvas(width, height, fill);
    created.push(canvas);
    return canvas;
  };
  return Object.assign(factory, { created });
}

/** Stands in for an HTMLImageElement in drawImage calls. */
export function fakeSource(width: number, height: number): CanvasImageSource {
  return { width, height } as unknown as CanvasImageSource;
}

/**
 * Real DOM canvas elements with a stubbed 2D context.
 *
 * jsdom can create the element but cannot give it a context, and components
 * append the element to the document — so neither a plain fake nor the real
 * thing works on its own.
 */
export function domFakeFactory(): CanvasFactory & { created: HTMLCanvasElement[] } {
  const created: HTMLCanvasElement[] = [];
  const factory: CanvasFactory = (width: number, height: number) => {
    const backing = fakeCanvas(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    Object.defineProperty(canvas, 'getContext', { value: () => backing.getContext('2d') });
    created.push(canvas);
    return canvas as unknown as CanvasLike;
  };
  return Object.assign(factory, { created });
}
