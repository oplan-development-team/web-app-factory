/**
 * `Ctx2D` の記録用フェイク。
 *
 * 実際に絵を描くのではなく、呼び出し列と、そのとき有効だった状態
 * （色・不透明度・合成モード）を記録する。描画ロジックの検証はこの列に対して行う。
 *
 * `measureText` はフォントサイズに比例させる。固定幅を返すと
 * 「収まるまで縮小する」系のロジックがテストを素通りしてしまう。
 */

import type { CanvasFactory, CanvasLike, Ctx2D, GradientLike, ImageDataLike } from '../../src/core/ctx2d';

export interface DrawCall {
  op: string;
  args: number[];
  text?: string;
  fillStyle: string;
  strokeStyle: string;
  globalAlpha: number;
  composite: string;
  lineWidth: number;
  font: string;
}

interface State {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  globalAlpha: number;
  globalCompositeOperation: GlobalCompositeOperation;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  imageSmoothingEnabled: boolean;
}

function initialState(): State {
  return {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    imageSmoothingEnabled: true,
  };
}

class FakeGradient implements GradientLike {
  readonly stops: Array<{ offset: number; color: string }> = [];
  addColorStop(offset: number, color: string): void {
    this.stops.push({ offset, color });
  }
}

/** 現在のパスの通過点。図形が領域に収まっているかの検証に使う。 */
export interface PathBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  points: number;
}

export class FakeCtx implements Ctx2D {
  readonly calls: DrawCall[] = [];
  readonly canvas: CanvasLike;
  private state: State = initialState();
  private stack: State[] = [];
  private pathPoints: Array<[number, number]> = [];
  /** fill() / stroke() 時点でのパス範囲の履歴 */
  readonly paintedBounds: PathBounds[] = [];

  constructor(width: number, height: number) {
    this.canvas = { width, height };
  }

  /* -- 状態プロパティ -- */
  get fillStyle(): string | CanvasGradient | CanvasPattern {
    return this.state.fillStyle;
  }
  set fillStyle(v: string | CanvasGradient | CanvasPattern) {
    this.state.fillStyle = v;
  }
  get strokeStyle(): string | CanvasGradient | CanvasPattern {
    return this.state.strokeStyle;
  }
  set strokeStyle(v: string | CanvasGradient | CanvasPattern) {
    this.state.strokeStyle = v;
  }
  get lineWidth(): number {
    return this.state.lineWidth;
  }
  set lineWidth(v: number) {
    this.state.lineWidth = v;
  }
  get lineCap(): CanvasLineCap {
    return this.state.lineCap;
  }
  set lineCap(v: CanvasLineCap) {
    this.state.lineCap = v;
  }
  get lineJoin(): CanvasLineJoin {
    return this.state.lineJoin;
  }
  set lineJoin(v: CanvasLineJoin) {
    this.state.lineJoin = v;
  }
  get globalAlpha(): number {
    return this.state.globalAlpha;
  }
  set globalAlpha(v: number) {
    this.state.globalAlpha = v;
  }
  get globalCompositeOperation(): GlobalCompositeOperation {
    return this.state.globalCompositeOperation;
  }
  set globalCompositeOperation(v: GlobalCompositeOperation) {
    this.state.globalCompositeOperation = v;
  }
  get imageSmoothingEnabled(): boolean {
    return this.state.imageSmoothingEnabled;
  }
  set imageSmoothingEnabled(v: boolean) {
    this.state.imageSmoothingEnabled = v;
  }
  get font(): string {
    return this.state.font;
  }
  set font(v: string) {
    this.state.font = v;
  }
  get textAlign(): CanvasTextAlign {
    return this.state.textAlign;
  }
  set textAlign(v: CanvasTextAlign) {
    this.state.textAlign = v;
  }
  get textBaseline(): CanvasTextBaseline {
    return this.state.textBaseline;
  }
  set textBaseline(v: CanvasTextBaseline) {
    this.state.textBaseline = v;
  }

  private record(op: string, args: number[], text?: string): void {
    const call: DrawCall = {
      op,
      args: args.map((n) => (Number.isFinite(n) ? Math.round(n * 1000) / 1000 : n)),
      fillStyle: String(this.state.fillStyle),
      strokeStyle: String(this.state.strokeStyle),
      globalAlpha: Math.round(this.state.globalAlpha * 1000) / 1000,
      composite: this.state.globalCompositeOperation,
      lineWidth: Math.round(this.state.lineWidth * 1000) / 1000,
      font: this.state.font,
    };
    if (text !== undefined) call.text = text;
    this.calls.push(call);
  }

  private track(x: number, y: number): void {
    this.pathPoints.push([x, y]);
  }

  private capturePath(): void {
    if (this.pathPoints.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of this.pathPoints) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    this.paintedBounds.push({ minX, minY, maxX, maxY, points: this.pathPoints.length });
  }

  save(): void {
    this.stack.push({ ...this.state });
    this.record('save', []);
  }
  restore(): void {
    const prev = this.stack.pop();
    if (prev) this.state = prev;
    this.record('restore', []);
  }
  translate(x: number, y: number): void {
    this.record('translate', [x, y]);
  }
  rotate(a: number): void {
    this.record('rotate', [a]);
  }
  scale(x: number, y: number): void {
    this.record('scale', [x, y]);
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    this.record('clearRect', [x, y, w, h]);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.record('fillRect', [x, y, w, h]);
  }

  beginPath(): void {
    this.pathPoints = [];
    this.record('beginPath', []);
  }
  closePath(): void {
    this.record('closePath', []);
  }
  moveTo(x: number, y: number): void {
    this.track(x, y);
    this.record('moveTo', [x, y]);
  }
  lineTo(x: number, y: number): void {
    this.track(x, y);
    this.record('lineTo', [x, y]);
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    this.track(x, y);
    this.record('quadraticCurveTo', [cx, cy, x, y]);
  }
  bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number): void {
    this.track(x, y);
    this.record('bezierCurveTo', [a, b, c, d, x, y]);
  }
  arc(x: number, y: number, r: number, s: number, e: number, ccw?: boolean): void {
    this.track(x - r, y - r);
    this.track(x + r, y + r);
    this.record('arc', [x, y, r, s, e, ccw ? 1 : 0]);
  }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, s: number, e: number, ccw?: boolean): void {
    const rr = Math.max(rx, ry);
    this.track(x - rr, y - rr);
    this.track(x + rr, y + rr);
    this.record('ellipse', [x, y, rx, ry, rot, s, e, ccw ? 1 : 0]);
  }
  fill(): void {
    this.capturePath();
    this.record('fill', []);
  }
  stroke(): void {
    this.capturePath();
    this.record('stroke', []);
  }
  clip(): void {
    this.record('clip', []);
  }

  fillText(text: string, x: number, y: number): void {
    this.record('fillText', [x, y], text);
  }
  measureText(text: string): { width: number } {
    // フォントサイズに比例させる（固定幅だと自動縮小ロジックが素通りする）
    const match = /(\d+(?:\.\d+)?)px/.exec(this.state.font);
    const size = match?.[1] !== undefined ? Number(match[1]) : 10;
    return { width: text.length * size * 0.5 };
  }

  createLinearGradient(): GradientLike {
    return new FakeGradient();
  }
  createRadialGradient(): GradientLike {
    return new FakeGradient();
  }
  createPattern(): CanvasPattern | null {
    return { __fake: 'pattern' } as unknown as CanvasPattern;
  }

  createImageData(width: number, height: number): ImageDataLike {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
  }
  getImageData(_x: number, _y: number, w: number, h: number): ImageDataLike {
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  }
  putImageData(data: ImageDataLike, x: number, y: number): void {
    this.record('putImageData', [data.width, data.height, x, y]);
  }

  drawImage(image: CanvasLike | CanvasImageSource, ...rest: number[]): void {
    const w = (image as CanvasLike).width;
    const h = (image as CanvasLike).height;
    this.record('drawImage', [typeof w === 'number' ? w : -1, typeof h === 'number' ? h : -1, ...rest]);
  }

  /* -- 検証用ヘルパ -- */

  ops(): string[] {
    return this.calls.map((c) => c.op);
  }

  /** 呼び出し列を比較可能な文字列へ（決定性の検証に使う） */
  signature(): string {
    return this.calls
      .map((c) => `${c.op}(${c.args.join(',')})|${c.fillStyle}|${c.strokeStyle}|${c.globalAlpha}|${c.text ?? ''}`)
      .join('\n');
  }

  /** 実際に塗り／線に使われた CSS 色の集合 */
  usedColors(): string[] {
    const seen = new Set<string>();
    for (const c of this.calls) {
      if (c.op === 'fill' || c.op === 'fillRect') seen.add(c.fillStyle);
      if (c.op === 'stroke') seen.add(c.strokeStyle);
    }
    return [...seen];
  }
}

export function fakeCanvasFactory(): CanvasFactory {
  return (width, height) => {
    const ctx = new FakeCtx(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
    return { canvas: ctx.canvas, ctx };
  };
}

/** `rgb(r, g, b)` から輝度を取り出す（階調範囲の検証に使う） */
export function grayValueOf(color: string): number | null {
  const m = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(color);
  if (!m || m[1] === undefined || m[2] === undefined || m[3] === undefined) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  if (r !== g || g !== b) return null;
  return r;
}
