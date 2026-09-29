import { NEON_COLORS, type Letter } from './codec';

/**
 * 「見えないインク」を懐中電灯でなぞって発光させる共有エンジン。
 * 読む画面と、書く画面の「懐中電灯でテスト」プレビューの両方がこれを使う
 * （読む/書くで体験がズレないよう、なぞりロジックを1箇所にまとめる）。
 *
 * 合成の考え方:
 *  1. inkLayer  … メッセージをYomogiの手書き風フォント+ネオングローで
 *                 一度だけ描画した静的レイヤー（見た目は変わらない）。
 *  2. maskLayer … 懐中電灯でなぞった軌跡を「熱」として蓄積し、経過時間で
 *                 じわっと減衰させるアルファマスク（色は使わない）。
 *  3. 毎フレーム、inkLayerをmaskLayerで destination-in マスクし、
 *     'lighter' 合成で本体キャンバスに重ねる → 闇の中にそこだけ発光。
 */

const TORCH_RADIUS_RATIO = 0.11; // キャンバス短辺に対する光の半径比
const DECAY_MS = 3200; // 減衰の時定数（ここが「じわっと消える」速さ）
const POINT_LIFETIME_MS = DECAY_MS * 6; // これを超えたら配列から間引く
const MIN_ALPHA = 0.02;

interface StrokePoint {
  x: number;
  y: number;
  time: number;
}

export class FlashlightReveal {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly inkLayer: HTMLCanvasElement;
  private readonly maskLayer: HTMLCanvasElement;
  private readonly maskCtx: CanvasRenderingContext2D;
  private readonly inkCtx: CanvasRenderingContext2D;
  private readonly tempLayer: HTMLCanvasElement;
  private readonly tempCtx: CanvasRenderingContext2D;

  private points: StrokePoint[] = [];
  private rafId = 0;
  private dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  private resizeObserver: ResizeObserver | null = null;
  private torchRadius = 40;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private letter: Letter,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;

    this.inkLayer = document.createElement('canvas');
    const inkCtx = this.inkLayer.getContext('2d');
    if (!inkCtx) throw new Error('2d context unavailable');
    this.inkCtx = inkCtx;

    this.maskLayer = document.createElement('canvas');
    const maskCtx = this.maskLayer.getContext('2d');
    if (!maskCtx) throw new Error('2d context unavailable');
    this.maskCtx = maskCtx;

    this.tempLayer = document.createElement('canvas');
    const tempCtx = this.tempLayer.getContext('2d');
    if (!tempCtx) throw new Error('2d context unavailable');
    this.tempCtx = tempCtx;
  }

  mount(): void {
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    this.loop();

    // canvasのfillText()は、そのフォントがDOM上のどこにも「使われて」いないと
    // @font-face のフェッチを自発的にはトリガーしない(=既定フォントへ黙って
    // フォールバックしたまま二度と手書き風にならない)。明示的にロードを促し、
    // 完了したらインク層を描き直す。
    void document.fonts
      .load("16px 'Yomogi'")
      .catch(() => undefined)
      .then(() => {
        if (!this.disposed) this.renderInkLayer();
      });
  }

  setLetter(letter: Letter): void {
    this.letter = letter;
    this.renderInkLayer();
  }

  /** キャンバス座標系(CSSピクセル)で軌跡点を追加する */
  addTouch(cssX: number, cssY: number): void {
    const now = performance.now();
    const last = this.points[this.points.length - 1];
    if (last) {
      // 速い移動でも軌跡が途切れないよう補間する
      const dx = cssX * this.dpr - last.x;
      const dy = cssY * this.dpr - last.y;
      const dist = Math.hypot(dx, dy);
      const step = this.torchRadius * 0.45;
      const steps = Math.min(24, Math.floor(dist / step));
      for (let i = 1; i <= steps; i++) {
        this.points.push({
          x: last.x + (dx * i) / (steps + 1),
          y: last.y + (dy * i) / (steps + 1),
          time: now,
        });
      }
    }
    this.points.push({ x: cssX * this.dpr, y: cssY * this.dpr, time: now });
    if (this.points.length > 4000) {
      this.points.splice(0, this.points.length - 4000);
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * this.dpr));
    const h = Math.max(1, Math.round(rect.height * this.dpr));
    for (const c of [this.canvas, this.inkLayer, this.maskLayer, this.tempLayer]) {
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
    }
    this.torchRadius = Math.min(w, h) * TORCH_RADIUS_RATIO;
    this.renderInkLayer();
  }

  private renderInkLayer(): void {
    const { width: w, height: h } = this.inkLayer;
    if (w === 0 || h === 0) return;
    const ctx = this.inkCtx;
    ctx.clearRect(0, 0, w, h);

    const color = NEON_COLORS[this.letter.color];
    const padding = w * 0.09;
    const maxWidth = w - padding * 2;
    const fontSize = clamp(w / 13, 22 * this.dpr, 52 * this.dpr);
    const lineHeight = fontSize * 1.3;

    ctx.font = `${fontSize}px 'Yomogi', 'Klee One', 'Yuji Syuku', cursive`;
    ctx.textBaseline = 'alphabetic';
    const lines = wrapText(ctx, this.letter.text, maxWidth);

    const totalHeight = lines.length * lineHeight;
    let startY = h / 2 - totalHeight / 2 + fontSize * 0.7;
    startY = Math.max(startY, fontSize * 1.1);

    const passes: Array<{ blur: number; alpha: number; fill: string }> = [
      { blur: fontSize * 0.9, alpha: 0.55, fill: color },
      { blur: fontSize * 0.4, alpha: 0.85, fill: color },
      { blur: 0, alpha: 0.95, fill: lightenTowardWhite(color, 0.55) },
    ];

    for (const pass of passes) {
      ctx.save();
      ctx.globalAlpha = pass.alpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = pass.blur;
      ctx.fillStyle = pass.fill;
      lines.forEach((line, i) => {
        ctx.fillText(line, padding, startY + i * lineHeight);
      });
      ctx.restore();
    }
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.drawFrame();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private drawFrame(): void {
    const now = performance.now();
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    // 1. 減衰したアルファでマスクを再構成する
    this.maskCtx.clearRect(0, 0, w, h);
    this.maskCtx.globalCompositeOperation = 'lighter';
    let kept: StrokePoint[] = [];
    for (const p of this.points) {
      const age = now - p.time;
      if (age > POINT_LIFETIME_MS) continue;
      kept.push(p);
      const alpha = Math.exp(-age / DECAY_MS);
      if (alpha < MIN_ALPHA) continue;
      const grad = this.maskCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, this.torchRadius);
      grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      this.maskCtx.fillStyle = grad;
      this.maskCtx.beginPath();
      this.maskCtx.arc(p.x, p.y, this.torchRadius, 0, Math.PI * 2);
      this.maskCtx.fill();
    }
    this.maskCtx.globalCompositeOperation = 'source-over';
    this.points = kept;

    // 2. インクをマスクで切り抜く
    this.tempCtx.clearRect(0, 0, w, h);
    this.tempCtx.drawImage(this.inkLayer, 0, 0);
    this.tempCtx.globalCompositeOperation = 'destination-in';
    this.tempCtx.drawImage(this.maskLayer, 0, 0);
    this.tempCtx.globalCompositeOperation = 'source-over';

    // 3. 発光として本体キャンバスへ加算合成
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.drawImage(this.tempLayer, 0, 0);
    this.ctx.globalCompositeOperation = 'source-over';
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (para.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const ch of para) {
      const test = current + ch;
      if (current.length > 0 && ctx.measureText(test).width > maxWidth) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

function lightenTowardWhite(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
