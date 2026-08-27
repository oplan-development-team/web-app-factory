/**
 * 描画層が依存する Canvas API の「構造的部分型」（PLAN 3.4 / NFR-007.2）。
 *
 * jsdom には Canvas 2D の実装が無い。描画コードが `CanvasRenderingContext2D` に
 * 直接依存していると、絵を組み立てるロジックを一切テストできなくなる。
 * 実際に使うメンバーだけをここに並べ、描画層はこの型に依存させる。
 * 実ブラウザの context は構造的に適合し、テストからは呼び出しを記録する
 * フェイクを渡せる。
 *
 * 型の決まりごと:
 * - `fillStyle` などは DOM の型をそのまま採る。独自の union にすると
 *   実 context を代入できなくなる。
 * - `drawImage` の第1引数は `CanvasLike | CanvasImageSource` の union にする。
 *   どちらか片方だけだと双変性チェックが両方向とも失敗する。
 */

export interface ImageDataLike {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface GradientLike {
  addColorStop(offset: number, color: string): void;
}

/** キャンバス（本物の HTMLCanvasElement / OffscreenCanvas が適合する） */
export interface CanvasLike {
  width: number;
  height: number;
}

export interface Ctx2D {
  canvas: CanvasLike;

  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  globalAlpha: number;
  globalCompositeOperation: GlobalCompositeOperation;
  imageSmoothingEnabled: boolean;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;

  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;

  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;

  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number, counterclockwise?: boolean): void;
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    start: number,
    end: number,
    counterclockwise?: boolean,
  ): void;
  fill(): void;
  stroke(): void;
  clip(): void;

  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): GradientLike;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): GradientLike;
  createPattern(image: CanvasLike | CanvasImageSource, repetition: string): CanvasPattern | null;

  createImageData(width: number, height: number): ImageDataLike;
  getImageData(x: number, y: number, w: number, h: number): ImageDataLike;
  putImageData(data: ImageDataLike, x: number, y: number): void;

  drawImage(image: CanvasLike | CanvasImageSource, dx: number, dy: number): void;
  drawImage(image: CanvasLike | CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  drawImage(
    image: CanvasLike | CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
}

/**
 * オフスクリーンのキャンバスを作る唯一の注入口。
 * 差し替え口を増やすと本番経路とテスト経路が乖離するので、ここ 1 箇所に絞る。
 */
export type CanvasFactory = (width: number, height: number) => { canvas: CanvasLike; ctx: Ctx2D };

/** ブラウザ既定の実装。 */
export const domCanvasFactory: CanvasFactory = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D コンテキストを取得できませんでした');
  return { canvas, ctx };
};

let activeFactory: CanvasFactory = domCanvasFactory;

export function setCanvasFactory(factory: CanvasFactory): void {
  activeFactory = factory;
}

export function createCanvas(width: number, height: number): { canvas: CanvasLike; ctx: Ctx2D } {
  return activeFactory(width, height);
}

/** `#rrggbb` を 0-255 の成分へ。 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 0-255 のグレー値を CSS 色へ。所蔵標本の階調指定に使う。 */
export function gray(value: number): string {
  const v = Math.round(clamp(value, 0, 255));
  return `rgb(${v}, ${v}, ${v})`;
}
