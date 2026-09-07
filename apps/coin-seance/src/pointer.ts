// Pointer Events で全アクティブタッチを pointerId 単位に管理し、
// 同時接触座標の重心（セントロイド）を算出する。

export interface PointerTrackerOptions {
  onChange?: (count: number) => void;
}

export class PointerTracker {
  private points = new Map<number, { x: number; y: number }>();
  private el: HTMLElement;
  private enabled = true;
  private onChange?: (count: number) => void;

  constructor(el: HTMLElement, opts: PointerTrackerOptions = {}) {
    this.el = el;
    this.onChange = opts.onChange;

    this.el.addEventListener('pointerdown', this.handleDown);
    this.el.addEventListener('pointermove', this.handleMove);
    this.el.addEventListener('pointerup', this.handleUp);
    this.el.addEventListener('pointercancel', this.handleUp);
    this.el.addEventListener('pointerleave', this.handleUp);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.points.clear();
      this.onChange?.(0);
    }
  }

  get count(): number {
    return this.points.size;
  }

  /** 現在アクティブな全接触点の重心。1点も無ければ null。 */
  centroid(): { x: number; y: number } | null {
    if (this.points.size === 0) return null;
    let sx = 0;
    let sy = 0;
    for (const p of this.points.values()) {
      sx += p.x;
      sy += p.y;
    }
    return { x: sx / this.points.size, y: sy / this.points.size };
  }

  private localPoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private handleDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    try {
      this.el.setPointerCapture?.(e.pointerId);
    } catch {
      // 一部の環境/合成イベントでは setPointerCapture が失敗しうるが、
      // 座標追跡自体は継続できるため無視する。
    }
    this.points.set(e.pointerId, this.localPoint(e));
    this.onChange?.(this.points.size);
  };

  private handleMove = (e: PointerEvent) => {
    if (!this.enabled) return;
    if (!this.points.has(e.pointerId)) return;
    this.points.set(e.pointerId, this.localPoint(e));
  };

  private handleUp = (e: PointerEvent) => {
    if (!this.points.has(e.pointerId)) return;
    this.points.delete(e.pointerId);
    this.onChange?.(this.points.size);
  };

  destroy(): void {
    this.el.removeEventListener('pointerdown', this.handleDown);
    this.el.removeEventListener('pointermove', this.handleMove);
    this.el.removeEventListener('pointerup', this.handleUp);
    this.el.removeEventListener('pointercancel', this.handleUp);
    this.el.removeEventListener('pointerleave', this.handleUp);
    this.points.clear();
  }
}
