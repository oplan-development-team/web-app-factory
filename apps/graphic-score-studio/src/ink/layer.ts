import type { InkBlob, Stroke, StrokePoint } from '../types';

/**
 * The shared ink data structure used by BOTH the hand-draw mode and the
 * image-upload mode. Two sources are kept:
 *
 *  - `strokes`: vector stroke data (hand drawing), rasterized onto
 *    `strokesCanvas`. Kept as vectors so SVG export can emit true paths.
 *  - grayscale image samples, rasterized onto `imageCanvas` from a stored
 *    grayscale buffer + the current threshold (so moving the threshold
 *    slider is cheap and never touches the hand-drawn strokes).
 *
 * Both canvases share the exact same pixel dimensions (the ink/score area)
 * and are composited into one canvas for playback sampling, on-screen
 * rendering and PNG export. This is the "single shared internal structure"
 * (per-column ink position / thickness / density) the two input modes
 * both feed and the playback + export logic both read from identically.
 */
export class InkLayer {
  readonly w: number;
  readonly h: number;

  readonly strokesCanvas: HTMLCanvasElement;
  readonly imageCanvas: HTMLCanvasElement;
  readonly compositeCanvas: HTMLCanvasElement;

  private strokesCtx: CanvasRenderingContext2D;
  private imageCtx: CanvasRenderingContext2D;
  private compositeCtx: CanvasRenderingContext2D;

  strokes: Stroke[] = [];
  private undoStack: Stroke[][] = [];
  private activeStroke: Stroke | null = null;

  /** grayscale luminance 0..255 per pixel of the current uploaded image, or null */
  private grayscale: Uint8ClampedArray | null = null;
  hasImage = false;

  private compositeDirty = true;
  private compositeImageData: ImageData | null = null;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.strokesCanvas = document.createElement('canvas');
    this.imageCanvas = document.createElement('canvas');
    this.compositeCanvas = document.createElement('canvas');
    for (const c of [this.strokesCanvas, this.imageCanvas, this.compositeCanvas]) {
      c.width = w;
      c.height = h;
    }
    this.strokesCtx = this.strokesCanvas.getContext('2d')!;
    this.imageCtx = this.imageCanvas.getContext('2d')!;
    // composite is read back via getImageData on every sampled column during
    // playback, so hint the browser to optimize for that access pattern
    this.compositeCtx = this.compositeCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  isEmpty(): boolean {
    return this.strokes.length === 0 && !this.hasImage;
  }

  // ---- hand-draw ----------------------------------------------------

  /** Starts a new stroke (e.g. on pointerdown) and draws its first point. */
  beginStroke(width: number, opacity: number, point: StrokePoint): void {
    const stroke: Stroke = { points: [point], width, opacity };
    this.strokes.push(stroke);
    this.undoStack = [];
    this.activeStroke = stroke;
    this.renderStroke(stroke);
    this.compositeDirty = true;
  }

  /** Appends a point to the in-progress stroke (e.g. on pointermove) with an incremental draw. */
  extendStroke(point: StrokePoint): void {
    if (!this.activeStroke) return;
    const prev = this.activeStroke.points[this.activeStroke.points.length - 1];
    this.activeStroke.points.push(point);
    const ctx = this.strokesCtx;
    ctx.save();
    ctx.globalAlpha = this.activeStroke.opacity;
    ctx.strokeStyle = '#14120f';
    ctx.lineWidth = this.activeStroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.restore();
    this.compositeDirty = true;
  }

  /** Ends the in-progress stroke (e.g. on pointerup/pointercancel). */
  endStroke(): void {
    this.activeStroke = null;
  }

  private renderStroke(stroke: Stroke): void {
    const ctx = this.strokesCtx;
    ctx.save();
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = '#14120f';
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const pts = stroke.points;
    if (pts.length === 1) {
      // a dot / tap
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private redrawAllStrokes(): void {
    this.strokesCtx.clearRect(0, 0, this.w, this.h);
    for (const s of this.strokes) this.renderStroke(s);
    this.compositeDirty = true;
  }

  undo(): boolean {
    if (this.strokes.length === 0) return false;
    const last = this.strokes.pop()!;
    this.undoStack.push([last]);
    this.redrawAllStrokes();
    return true;
  }

  redo(): boolean {
    if (this.undoStack.length === 0) return false;
    const back = this.undoStack.pop()!;
    this.strokes.push(...back);
    this.redrawAllStrokes();
    return true;
  }

  clearStrokes(): void {
    this.strokes = [];
    this.undoStack = [];
    this.activeStroke = null;
    this.strokesCtx.clearRect(0, 0, this.w, this.h);
    this.compositeDirty = true;
  }

  clearAll(): void {
    this.clearStrokes();
    this.grayscale = null;
    this.hasImage = false;
    this.imageCtx.clearRect(0, 0, this.w, this.h);
    this.compositeDirty = true;
  }

  // ---- image upload ---------------------------------------------------

  /**
   * Loads an image, converts it to grayscale luminance at the ink-area
   * resolution (letterboxed / centered, aspect preserved), and stores the
   * grayscale buffer so the threshold can be re-applied cheaply afterwards.
   */
  setImageFromBitmap(bitmap: ImageBitmap | HTMLImageElement, threshold: number): void {
    const tmp = document.createElement('canvas');
    tmp.width = this.w;
    tmp.height = this.h;
    const tctx = tmp.getContext('2d')!;

    const srcW = 'width' in bitmap ? bitmap.width : 0;
    const srcH = 'height' in bitmap ? bitmap.height : 0;
    const scale = Math.min(this.w / srcW, this.h / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const dx = (this.w - drawW) / 2;
    const dy = (this.h - drawH) / 2;
    tctx.fillStyle = '#ffffff';
    tctx.fillRect(0, 0, this.w, this.h);
    tctx.drawImage(bitmap, dx, dy, drawW, drawH);

    const data = tctx.getImageData(0, 0, this.w, this.h);
    const gray = new Uint8ClampedArray(this.w * this.h);
    const px = data.data;
    for (let i = 0, p = 0; i < px.length; i += 4, p++) {
      // standard luminance weighting, self-implemented (no image libs)
      gray[p] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    }
    this.grayscale = gray;
    this.hasImage = true;
    this.applyThreshold(threshold);
  }

  /** Re-renders the image layer from the stored grayscale buffer + a new threshold. */
  applyThreshold(threshold: number): void {
    if (!this.grayscale) return;
    const out = this.imageCtx.createImageData(this.w, this.h);
    const gray = this.grayscale;
    const d = out.data;
    for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
      const lum = gray[p];
      // darker than threshold -> ink. Density graded near the threshold edge
      // so mid-tones still contribute a softer alpha (kept intentionally
      // simple: luminance-threshold only, no edge detection).
      let alpha = 0;
      if (lum < threshold) {
        alpha = threshold <= 0 ? 1 : Math.min(1, (threshold - lum) / threshold + 0.25);
      }
      d[i] = 0x14;
      d[i + 1] = 0x12;
      d[i + 2] = 0x0f;
      d[i + 3] = Math.round(alpha * 255);
    }
    this.imageCtx.putImageData(out, 0, 0);
    this.compositeDirty = true;
  }

  clearImage(): void {
    this.grayscale = null;
    this.hasImage = false;
    this.imageCtx.clearRect(0, 0, this.w, this.h);
    this.compositeDirty = true;
  }

  // ---- composite --------------------------------------------------------

  private rebuildComposite(): void {
    const ctx = this.compositeCtx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.drawImage(this.imageCanvas, 0, 0);
    ctx.drawImage(this.strokesCanvas, 0, 0);
    this.compositeImageData = ctx.getImageData(0, 0, this.w, this.h);
    this.compositeDirty = false;
  }

  getComposite(): HTMLCanvasElement {
    if (this.compositeDirty) this.rebuildComposite();
    return this.compositeCanvas;
  }

  private getCompositeData(): ImageData {
    if (this.compositeDirty || !this.compositeImageData) this.rebuildComposite();
    return this.compositeImageData!;
  }

  /**
   * Samples one column of the composite ink map and returns up to
   * `maxBlobs` contiguous ink runs (top to bottom), each reduced to a
   * center/thickness/density triple used for audio mapping.
   */
  sampleColumn(x: number, maxBlobs: number): InkBlob[] {
    const xi = Math.max(0, Math.min(this.w - 1, Math.round(x)));
    const data = this.getCompositeData();
    const alphaAt = (y: number): number => data.data[(y * this.w + xi) * 4 + 3] / 255;

    const MIN_ALPHA = 0.06;
    const runs: { start: number; end: number; sumAlpha: number; n: number }[] = [];
    let run: { start: number; end: number; sumAlpha: number; n: number } | null = null;
    let gap = 0;
    const MAX_GAP = 3; // merge runs separated by a tiny gap (anti-aliasing)

    for (let y = 0; y < this.h; y++) {
      const a = alphaAt(y);
      if (a >= MIN_ALPHA) {
        if (!run) run = { start: y, end: y, sumAlpha: 0, n: 0 };
        run.end = y;
        run.sumAlpha += a;
        run.n += 1;
        gap = 0;
      } else if (run) {
        gap++;
        if (gap > MAX_GAP) {
          runs.push(run);
          run = null;
          gap = 0;
        }
      }
    }
    if (run) runs.push(run);

    const blobs: InkBlob[] = runs.map((r) => ({
      yCenter: (r.start + r.end) / 2 / this.h,
      thickness: r.end - r.start + 1,
      density: r.sumAlpha / Math.max(1, r.n),
    }));

    if (blobs.length <= maxBlobs) return blobs;
    // keep the most prominent blobs (thickness x density), preserving
    // top-to-bottom order for a stable, readable voice layout
    return blobs
      .map((b, idx) => ({ b, idx, score: b.thickness * (0.4 + b.density) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxBlobs)
      .sort((a, b) => a.idx - b.idx)
      .map((e) => e.b);
  }

  /** Cell-based vector sampling of the image layer alone, for SVG export. */
  sampleImageCells(cell: number): { x: number; y: number; alpha: number }[] {
    if (!this.hasImage) return [];
    const ctx = this.imageCtx;
    const data = ctx.getImageData(0, 0, this.w, this.h).data;
    const out: { x: number; y: number; alpha: number }[] = [];
    for (let y = 0; y < this.h; y += cell) {
      for (let x = 0; x < this.w; x += cell) {
        let sum = 0;
        let n = 0;
        for (let dy = 0; dy < cell && y + dy < this.h; dy++) {
          for (let dx = 0; dx < cell && x + dx < this.w; dx++) {
            sum += data[((y + dy) * this.w + (x + dx)) * 4 + 3];
            n++;
          }
        }
        const alpha = sum / n / 255;
        if (alpha > 0.08) out.push({ x, y, alpha });
      }
    }
    return out;
  }
}

export function pointFromEvent(canvasRect: DOMRect, clientX: number, clientY: number, scaleX: number, scaleY: number): StrokePoint {
  return {
    x: (clientX - canvasRect.left) * scaleX,
    y: (clientY - canvasRect.top) * scaleY,
  };
}
