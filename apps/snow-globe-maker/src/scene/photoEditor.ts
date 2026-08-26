import { clamp, loadImageFromFile } from '../utils/canvas';

const SCENE_SIZE = 400;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 20 * 1024 * 1024;

export class PhotoEditor {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private img: HTMLImageElement | null = null;
  private zoom = 1;
  private offsetX = 0;
  private offsetY = 0;
  private baseScale = 1;
  private dragging = false;
  private dragStart = { x: 0, y: 0, offX: 0, offY: 0 };
  onChange: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context is not available');
    this.ctx = ctx;
    this.bindDrag();
  }

  hasImage(): boolean {
    return this.img !== null;
  }

  validateFile(file: File): string | null {
    if (!ACCEPTED.includes(file.type)) {
      return 'JPEG・PNG・WebP形式の画像を選んでください。';
    }
    if (file.size > MAX_BYTES) {
      return 'ファイルサイズが大きすぎます（20MBまで）。';
    }
    return null;
  }

  async loadFile(file: File): Promise<void> {
    const img = await loadImageFromFile(file);
    this.img = img;
    this.zoom = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.baseScale = Math.max(SCENE_SIZE / img.naturalWidth, SCENE_SIZE / img.naturalHeight);
    this.render();
  }

  setZoom(zoom: number): void {
    this.zoom = clamp(zoom, 1, 3);
    this.clampOffsets();
    this.render();
  }

  getZoom(): number {
    return this.zoom;
  }

  private clampOffsets(): void {
    if (!this.img) return;
    const scale = this.baseScale * this.zoom;
    const drawnW = this.img.naturalWidth * scale;
    const drawnH = this.img.naturalHeight * scale;
    const maxX = Math.max(0, (drawnW - SCENE_SIZE) / 2);
    const maxY = Math.max(0, (drawnH - SCENE_SIZE) / 2);
    this.offsetX = clamp(this.offsetX, -maxX, maxX);
    this.offsetY = clamp(this.offsetY, -maxY, maxY);
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SCENE_SIZE, SCENE_SIZE);
    if (!this.img) return;
    const scale = this.baseScale * this.zoom;
    const drawnW = this.img.naturalWidth * scale;
    const drawnH = this.img.naturalHeight * scale;
    const x = SCENE_SIZE / 2 - drawnW / 2 + this.offsetX;
    const y = SCENE_SIZE / 2 - drawnH / 2 + this.offsetY;
    ctx.drawImage(this.img, x, y, drawnW, drawnH);
    this.onChange?.();
  }

  private canvasScaleFactor(): number {
    const rect = this.canvas.getBoundingClientRect();
    return rect.width > 0 ? this.canvas.width / rect.width : 1;
  }

  private bindDrag(): void {
    const onDown = (ev: PointerEvent) => {
      if (!this.img) return;
      this.dragging = true;
      this.dragStart = { x: ev.clientX, y: ev.clientY, offX: this.offsetX, offY: this.offsetY };
      this.canvas.setPointerCapture(ev.pointerId);
    };
    const onMove = (ev: PointerEvent) => {
      if (!this.dragging || !this.img) return;
      const f = this.canvasScaleFactor();
      this.offsetX = this.dragStart.offX + (ev.clientX - this.dragStart.x) * f;
      this.offsetY = this.dragStart.offY + (ev.clientY - this.dragStart.y) * f;
      this.clampOffsets();
      this.render();
    };
    const onUp = () => {
      this.dragging = false;
    };
    this.canvas.addEventListener('pointerdown', onDown);
    this.canvas.addEventListener('pointermove', onMove);
    this.canvas.addEventListener('pointerup', onUp);
    this.canvas.addEventListener('pointercancel', onUp);
    this.canvas.style.touchAction = 'none';
  }
}
