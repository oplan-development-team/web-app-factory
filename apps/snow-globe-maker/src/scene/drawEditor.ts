const SIZE = 400;

export type DrawTool = 'brush' | 'eraser' | 'stamp';

export class DrawEditor {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;
  private ink: HTMLCanvasElement;
  private inkCtx: CanvasRenderingContext2D;

  private tool: DrawTool = 'brush';
  private color = '#2E2620';
  private pendingStamp: string | null = null;
  private drawing = false;
  private lastPoint: { x: number; y: number } | null = null;

  constructor(displayCanvas: HTMLCanvasElement) {
    this.canvas = displayCanvas;
    const ctx = displayCanvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context is not available');
    this.ctx = ctx;

    this.bg = document.createElement('canvas');
    this.bg.width = SIZE;
    this.bg.height = SIZE;
    const bgCtx = this.bg.getContext('2d');
    if (!bgCtx) throw new Error('2D canvas context is not available');
    this.bgCtx = bgCtx;

    this.ink = document.createElement('canvas');
    this.ink.width = SIZE;
    this.ink.height = SIZE;
    const inkCtx = this.ink.getContext('2d');
    if (!inkCtx) throw new Error('2D canvas context is not available');
    this.inkCtx = inkCtx;

    this.paintDefaultBackground();
    this.recomposite();
    this.bindPointer();
  }

  private paintDefaultBackground(): void {
    const ctx = this.bgCtx;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const sky = ctx.createLinearGradient(0, 0, 0, SIZE);
    sky.addColorStop(0, '#dfe9f3');
    sky.addColorStop(1, '#f6f2e8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.fillStyle = '#fbfaf5';
    ctx.beginPath();
    ctx.moveTo(0, SIZE);
    ctx.quadraticCurveTo(SIZE * 0.5, SIZE * 0.72, SIZE, SIZE * 0.88);
    ctx.lineTo(SIZE, SIZE);
    ctx.closePath();
    ctx.fill();
  }

  setTool(tool: DrawTool): void {
    this.tool = tool;
    if (tool !== 'stamp') this.pendingStamp = null;
  }

  setColor(color: string): void {
    this.color = color;
  }

  setStamp(emoji: string): void {
    this.pendingStamp = emoji;
    this.tool = 'stamp';
  }

  getTool(): DrawTool {
    return this.tool;
  }

  clear(): void {
    this.inkCtx.clearRect(0, 0, SIZE, SIZE);
    this.paintDefaultBackground();
    this.recomposite();
  }

  private recomposite(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(this.bg, 0, 0);
    ctx.drawImage(this.ink, 0, 0);
  }

  private canvasPoint(ev: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const f = rect.width > 0 ? SIZE / rect.width : 1;
    return { x: (ev.clientX - rect.left) * f, y: (ev.clientY - rect.top) * f };
  }

  private stampAt(x: number, y: number): void {
    if (!this.pendingStamp) return;
    const ctx = this.inkCtx;
    ctx.save();
    ctx.font = '54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.pendingStamp, x, y);
    ctx.restore();
    this.recomposite();
  }

  private strokeTo(x: number, y: number): void {
    const ctx = this.inkCtx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.tool === 'eraser' ? 26 : 7;
    if (this.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = this.color;
    }
    ctx.beginPath();
    const from = this.lastPoint ?? { x, y };
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    this.lastPoint = { x, y };
    this.recomposite();
  }

  private bindPointer(): void {
    const onDown = (ev: PointerEvent) => {
      const p = this.canvasPoint(ev);
      this.drawing = true;
      this.canvas.setPointerCapture(ev.pointerId);
      if (this.tool === 'stamp') {
        this.stampAt(p.x, p.y);
        this.drawing = false;
        return;
      }
      this.lastPoint = p;
      this.strokeTo(p.x, p.y);
    };
    const onMove = (ev: PointerEvent) => {
      if (!this.drawing || this.tool === 'stamp') return;
      const p = this.canvasPoint(ev);
      this.strokeTo(p.x, p.y);
    };
    const onUp = () => {
      this.drawing = false;
      this.lastPoint = null;
    };
    this.canvas.addEventListener('pointerdown', onDown);
    this.canvas.addEventListener('pointermove', onMove);
    this.canvas.addEventListener('pointerup', onUp);
    this.canvas.addEventListener('pointercancel', onUp);
    this.canvas.style.touchAction = 'none';
  }
}
