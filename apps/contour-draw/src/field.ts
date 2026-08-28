/**
 * A scalar "height" field on a regular grid. Pointer strokes deposit a soft
 * circular kernel of density along their path; repeated passes over the same
 * area accumulate (clamped) so loops and back-and-forth motion build height.
 */
export class ScalarField {
  readonly nx: number;
  readonly ny: number;
  data: Float32Array;
  /** bounding box (in grid cells) touched since the last `consumeDirty()` call */
  private dirtyMinX = Infinity;
  private dirtyMinY = Infinity;
  private dirtyMaxX = -Infinity;
  private dirtyMaxY = -Infinity;

  constructor(nx: number, ny: number) {
    this.nx = nx;
    this.ny = ny;
    this.data = new Float32Array(nx * ny);
  }

  get(x: number, y: number): number {
    return this.data[y * this.nx + x] ?? 0;
  }

  clear(): void {
    this.data.fill(0);
    this.markDirty(0, 0, this.nx - 1, this.ny - 1);
  }

  clone(): Float32Array {
    return this.data.slice();
  }

  restore(snapshot: Float32Array): void {
    this.data.set(snapshot);
    this.markDirty(0, 0, this.nx - 1, this.ny - 1);
  }

  private markDirty(minX: number, minY: number, maxX: number, maxY: number): void {
    if (minX < this.dirtyMinX) this.dirtyMinX = minX;
    if (minY < this.dirtyMinY) this.dirtyMinY = minY;
    if (maxX > this.dirtyMaxX) this.dirtyMaxX = maxX;
    if (maxY > this.dirtyMaxY) this.dirtyMaxY = maxY;
  }

  /** Returns whether anything has changed since the last consume, and resets the flag. */
  consumeDirty(): boolean {
    const dirty = this.dirtyMaxX >= this.dirtyMinX;
    this.dirtyMinX = Infinity;
    this.dirtyMinY = Infinity;
    this.dirtyMaxX = -Infinity;
    this.dirtyMaxY = -Infinity;
    return dirty;
  }

  /**
   * Deposit a soft circular kernel centered at (cx, cy) in grid-cell units.
   * `strength` is the peak height increment added at the very center; it
   * falls off smoothly to 0 at `radius` cells. Values are clamped to 1.
   */
  deposit(cx: number, cy: number, radius: number, strength: number): void {
    const r = Math.max(0.5, radius);
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(this.nx - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(this.ny - 1, Math.ceil(cy + r));
    if (minX > maxX || minY > maxY) return;

    const r2 = r * r;
    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy;
      const rowBase = y * this.nx;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const t = 1 - d2 / r2;
        const falloff = t * t; // smooth (quadratic) falloff
        const idx = rowBase + x;
        const next = (this.data[idx] ?? 0) + strength * falloff;
        this.data[idx] = next > 1 ? 1 : next;
      }
    }
    this.markDirty(minX, minY, maxX, maxY);
  }

  /** Deposit along a line segment by sampling intermediate points, so fast
   * pointer movement doesn't leave gaps in the stroke. */
  depositLine(x0: number, y0: number, x1: number, y1: number, radius: number, strength: number): void {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const step = Math.max(radius * 0.35, 0.5);
    const steps = Math.max(1, Math.ceil(dist / step));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.deposit(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius, strength);
    }
  }
}
