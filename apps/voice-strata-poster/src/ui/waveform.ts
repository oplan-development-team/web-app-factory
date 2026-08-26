/**
 * Scrolling live level meter drawn during recording. Not a true oscilloscope
 * waveform (we only have RMS ticks, not raw samples at draw time) — instead
 * a bar-style meter history that scrolls left as new ticks arrive, styled to
 * match the field-notebook aesthetic (ink bars on cream strip).
 */
export class LiveMeter {
  private ctx: CanvasRenderingContext2D;
  private history: number[] = [];
  private maxPoints: number;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    this.maxPoints = Math.max(40, Math.floor(canvas.clientWidth / 4));
  }

  push(rms: number): void {
    this.history.push(Math.min(1, rms));
    if (this.history.length > this.maxPoints) this.history.shift();
    this.render();
  }

  reset(): void {
    this.history = [];
    this.render();
  }

  private render(): void {
    const { ctx, canvas } = this;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // baseline
    ctx.strokeStyle = 'rgba(43,42,46,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const barW = 3;
    const gap = 1;
    const totalBarW = barW + gap;
    const visibleCount = Math.floor(w / totalBarW);
    const points = this.history.slice(-visibleCount);
    const startX = w - points.length * totalBarW;

    points.forEach((v, i) => {
      const barH = Math.max(2, v * (h * 0.9));
      const x = startX + i * totalBarW;
      const isRecent = i >= points.length - 3;
      ctx.fillStyle = isRecent ? '#8a2f2f' : '#2b2a2e';
      ctx.globalAlpha = 0.35 + v * 0.55;
      ctx.fillRect(x, h / 2 - barH / 2, barW, barH);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
