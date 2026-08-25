import type { CanvasFactory, CanvasLike, Ctx2D } from "../../src/render/types";

export interface RecordedCall {
  readonly op: string;
  readonly args: readonly unknown[];
  /** Snapshot of the style state at the moment of the call. */
  readonly state: Readonly<Record<string, unknown>>;
}

const STATE_KEYS = [
  "globalCompositeOperation",
  "globalAlpha",
  "fillStyle",
  "strokeStyle",
  "lineWidth",
  "lineCap",
  "lineJoin",
  "font",
  "textAlign",
  "textBaseline",
  "filter",
  "imageSmoothingEnabled",
  "imageSmoothingQuality",
] as const;

/**
 * Records every drawing operation together with the style state in effect, so
 * tests can assert on what would have been painted without a real canvas.
 */
export class FakeCtx implements Ctx2D {
  readonly calls: RecordedCall[] = [];
  /** Set to false to emulate a platform without `ctx.filter` support (E-16). */
  filterSupported = true;

  globalCompositeOperation: GlobalCompositeOperation = "source-over";
  globalAlpha = 1;
  fillStyle: string | CanvasGradient | CanvasPattern = "#000000";
  strokeStyle: string | CanvasGradient | CanvasPattern = "#000000";
  lineWidth = 1;
  lineCap: CanvasLineCap = "butt";
  lineJoin: CanvasLineJoin = "miter";
  font = "10px sans-serif";
  textAlign: CanvasTextAlign = "start";
  textBaseline: CanvasTextBaseline = "alphabetic";
  imageSmoothingEnabled = true;
  imageSmoothingQuality: ImageSmoothingQuality = "low";

  /** Width per character at a 10px font, scaled by the current font size. */
  charWidth = 10;

  private filterValue = "none";
  private readonly stack: Record<string, unknown>[] = [];

  get filter(): string {
    return this.filterValue;
  }

  set filter(value: string) {
    this.filterValue = this.filterSupported ? value : "none";
  }

  private record(op: string, ...args: unknown[]): void {
    const state: Record<string, unknown> = {};
    for (const key of STATE_KEYS) {
      state[key] = this[key];
    }
    this.calls.push({ op, args, state });
  }

  save(): void {
    const snapshot: Record<string, unknown> = {};
    for (const key of STATE_KEYS) {
      snapshot[key] = this[key];
    }
    this.stack.push(snapshot);
    this.record("save");
  }

  restore(): void {
    const snapshot = this.stack.pop();
    if (snapshot) {
      Object.assign(this, snapshot);
    }
    this.record("restore");
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    this.record("clearRect", x, y, w, h);
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.record("fillRect", x, y, w, h);
  }

  beginPath(): void {
    this.record("beginPath");
  }

  moveTo(x: number, y: number): void {
    this.record("moveTo", x, y);
  }

  lineTo(x: number, y: number): void {
    this.record("lineTo", x, y);
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.record("quadraticCurveTo", cpx, cpy, x, y);
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void {
    this.record("arc", x, y, radius, startAngle, endAngle);
  }

  stroke(): void {
    this.record("stroke");
  }

  fill(): void {
    this.record("fill");
  }

  fillText(text: string, x: number, y: number): void {
    this.record("fillText", text, x, y);
  }

  /** Text width scales with the font size, so shrink-to-fit logic is exercised realistically. */
  measureText(text: string): { readonly width: number } {
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 10);
    return { width: text.length * this.charWidth * (size / 10) };
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient {
    this.record("createLinearGradient", x0, y0, x1, y1);
    const stops: [number, string][] = [];
    return {
      addColorStop: (offset: number, color: string) => void stops.push([offset, color]),
      stops,
    } as unknown as CanvasGradient;
  }

  drawImage(image: CanvasLike, dx: number, dy: number, dw: number, dh: number): void {
    this.record("drawImage", image, dx, dy, dw, dh);
  }

  /** Operations of a given kind, in order. */
  ops(op: string): RecordedCall[] {
    return this.calls.filter((call) => call.op === op);
  }

  reset(): void {
    this.calls.length = 0;
  }
}

export class FakeCanvas implements CanvasLike {
  readonly ctx: FakeCtx;

  constructor(
    public width: number,
    public height: number,
    ctx: FakeCtx = new FakeCtx()
  ) {
    this.ctx = ctx;
  }

  getContext(): Ctx2D {
    return this.ctx;
  }
}

export interface FakeCanvasFactory {
  readonly factory: CanvasFactory;
  readonly created: FakeCanvas[];
}

export function fakeCanvasFactory(options: { filterSupported?: boolean } = {}): FakeCanvasFactory {
  const created: FakeCanvas[] = [];
  const factory: CanvasFactory = (width, height) => {
    const canvas = new FakeCanvas(width, height);
    canvas.ctx.filterSupported = options.filterSupported ?? true;
    created.push(canvas);
    return canvas;
  };
  return { factory, created };
}
