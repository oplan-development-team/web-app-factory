/**
 * The narrow slice of the Canvas 2D API this app actually uses.
 *
 * Depending on this instead of `CanvasRenderingContext2D` lets the whole render
 * layer run against a recording fake, so the drawing logic is unit-testable in
 * jsdom (which ships no canvas implementation at all) — see NFR-003.3.
 * A real `CanvasRenderingContext2D` satisfies this structurally.
 */
export interface Ctx2D {
  globalCompositeOperation: GlobalCompositeOperation;
  globalAlpha: number;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  filter: string;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;

  save(): void;
  restore(): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  stroke(): void;
  fill(): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { readonly width: number };
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
  drawImage(image: DrawableSource, dx: number, dy: number, dw: number, dh: number): void;
}

/**
 * A real context only accepts `CanvasImageSource`; the fake only accepts its own
 * `CanvasLike`. Widening to the union keeps both assignable to {@link Ctx2D}.
 */
export type DrawableSource = CanvasLike | CanvasImageSource;

export interface CanvasLike {
  width: number;
  height: number;
  getContext(contextId: "2d"): Ctx2D | null;
}

export type CanvasFactory = (width: number, height: number) => CanvasLike;

/** Creates a detached DOM canvas. The only browser-specific piece of the render layer. */
export const domCanvasFactory: CanvasFactory = (width, height) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export function require2d(canvas: CanvasLike): Ctx2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context is not available");
  }
  return ctx;
}

/**
 * True when the platform honours `ctx.filter`. Safari only gained support in 17,
 * and the bloom pipeline has a downscale-only fallback for the rest (E-16).
 */
export function supportsCanvasFilter(ctx: Ctx2D): boolean {
  let original = "none";
  try {
    original = ctx.filter;
    ctx.filter = "blur(1px)";
    const supported = ctx.filter === "blur(1px)";
    ctx.filter = original;
    return supported;
  } catch {
    return false;
  }
}
