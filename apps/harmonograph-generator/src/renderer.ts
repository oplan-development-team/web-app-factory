import { PAPER_SIZE_MM } from './constants';
import { drawInkSegments } from './ink';
import {
  detuneForSecondPass,
  fitTrajectoryToPaper,
  simulateTrajectory,
  type ScaledGeometry,
} from './pendulum';
import { drawPaperTexture } from './paper';
import type { AppState } from './types';

export interface RenderProgress {
  pass: 1 | 2;
  totalPasses: 1 | 2;
  fraction: number; // 0-1
  done: boolean;
}

export interface ComputedGeometry {
  pass1: ScaledGeometry;
  pass2: ScaledGeometry | null;
}

export const BASE_INK_WIDTH_MM = 0.42;

export function computeGeometry(state: AppState): ComputedGeometry {
  const traj1 = simulateTrajectory(state.pendulums, state.periods);
  const pass1 = fitTrajectoryToPaper(traj1, PAPER_SIZE_MM);

  let pass2: ScaledGeometry | null = null;
  if (state.twoPass) {
    const detuned = detuneForSecondPass(state.pendulums);
    const traj2 = simulateTrajectory(detuned, state.periods);
    pass2 = fitTrajectoryToPaper(traj2, PAPER_SIZE_MM);
  }
  return { pass1, pass2 };
}

export class HarmonographRenderer {
  private inkCanvas: HTMLCanvasElement;
  private tipCanvas: HTMLCanvasElement;
  private inkCtx: CanvasRenderingContext2D;
  private tipCtx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private sizePx = 0;
  private scale = 1;
  private dpr = 1;

  constructor(inkCanvas: HTMLCanvasElement, tipCanvas: HTMLCanvasElement) {
    this.inkCanvas = inkCanvas;
    this.tipCanvas = tipCanvas;
    const inkCtx = inkCanvas.getContext('2d');
    const tipCtx = tipCanvas.getContext('2d');
    if (!inkCtx || !tipCtx) throw new Error('2D canvas context を取得できませんでした');
    this.inkCtx = inkCtx;
    this.tipCtx = tipCtx;
  }

  resize(cssSizePx: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.sizePx = Math.round(cssSizePx * this.dpr);
    for (const canvas of [this.inkCanvas, this.tipCanvas]) {
      canvas.width = this.sizePx;
      canvas.height = this.sizePx;
      canvas.style.width = `${cssSizePx}px`;
      canvas.style.height = `${cssSizePx}px`;
    }
    this.scale = this.sizePx / PAPER_SIZE_MM;
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private clearTip(): void {
    this.tipCtx.clearRect(0, 0, this.sizePx, this.sizePx);
  }

  private drawTipDot(x: number, y: number): void {
    this.clearTip();
    this.tipCtx.save();
    this.tipCtx.fillStyle = '#c9a227';
    this.tipCtx.shadowColor = 'rgba(201,162,39,0.85)';
    this.tipCtx.shadowBlur = 6 * this.dpr;
    this.tipCtx.beginPath();
    this.tipCtx.arc(x, y, 2.6 * this.scale * (PAPER_SIZE_MM / 200), 0, Math.PI * 2);
    this.tipCtx.fill();
    this.tipCtx.restore();
  }

  paperTexture(state: AppState): void {
    drawPaperTexture(this.inkCtx, this.sizePx, this.sizePx, state.paper);
    this.clearTip();
  }

  instantDraw(state: AppState, geometry: ComputedGeometry): void {
    this.stop();
    this.paperTexture(state);
    const pass1Px = geometry.pass1.points.map((p) => ({ x: p.x * this.scale, y: p.y * this.scale }));
    drawInkSegments(
      this.inkCtx,
      pass1Px,
      geometry.pass1.normSpeeds,
      { color: state.inkColor, baseWidthMm: BASE_INK_WIDTH_MM },
      this.scale,
      0,
      pass1Px.length - 1,
    );
    if (geometry.pass2) {
      const pass2Px = geometry.pass2.points.map((p) => ({ x: p.x * this.scale, y: p.y * this.scale }));
      drawInkSegments(
        this.inkCtx,
        pass2Px,
        geometry.pass2.normSpeeds,
        { color: state.inkColor2, baseWidthMm: BASE_INK_WIDTH_MM },
        this.scale,
        0,
        pass2Px.length - 1,
      );
    }
    this.clearTip();
  }

  /**
   * requestAnimationFrame で逐次パスを延長していくトレース・アニメーション。
   * 「実機が今まさに描いている」感を出す。2パス時はパス1完了後にパス2を続けて描く。
   */
  startTrace(
    state: AppState,
    geometry: ComputedGeometry,
    traceSeconds: number,
    onProgress: (p: RenderProgress) => void,
  ): void {
    this.stop();
    this.paperTexture(state);

    const passes: { geometry: ScaledGeometry; color: string; passNo: 1 | 2 }[] = [
      { geometry: geometry.pass1, color: state.inkColor, passNo: 1 },
    ];
    if (geometry.pass2) {
      passes.push({ geometry: geometry.pass2, color: state.inkColor2, passNo: 2 });
    }
    const totalPasses = passes.length === 2 ? 2 : 1;

    let passIndex = 0;
    let lastDrawnIndex = 0;
    let startTime: number | null = null;

    const drawNextFrame = (now: number): void => {
      const current = passes[passIndex];
      if (!current) return;
      if (startTime === null) startTime = now;
      const elapsed = (now - startTime) / 1000;
      const fraction = Math.min(1, elapsed / Math.max(0.1, traceSeconds));

      const pxPoints = current.geometry.points.map((p) => ({ x: p.x * this.scale, y: p.y * this.scale }));
      const targetIndex = Math.min(
        pxPoints.length - 1,
        Math.floor(fraction * (pxPoints.length - 1)),
      );

      if (targetIndex > lastDrawnIndex) {
        drawInkSegments(
          this.inkCtx,
          pxPoints,
          current.geometry.normSpeeds,
          { color: current.color, baseWidthMm: BASE_INK_WIDTH_MM },
          this.scale,
          lastDrawnIndex,
          targetIndex,
        );
        lastDrawnIndex = targetIndex;
      }
      const tip = pxPoints[targetIndex];
      if (tip) this.drawTipDot(tip.x, tip.y);

      onProgress({
        pass: current.passNo,
        totalPasses,
        fraction,
        done: false,
      });

      if (fraction >= 1) {
        if (passIndex < passes.length - 1) {
          passIndex += 1;
          lastDrawnIndex = 0;
          startTime = null;
          this.rafId = requestAnimationFrame(drawNextFrame);
        } else {
          this.clearTip();
          onProgress({ pass: current.passNo, totalPasses, fraction: 1, done: true });
          this.rafId = null;
        }
        return;
      }
      this.rafId = requestAnimationFrame(drawNextFrame);
    };

    this.rafId = requestAnimationFrame(drawNextFrame);
  }
}
