/** Number of recent raw speed samples averaged to smooth out sensor noise (FR-002.2). */
export const SMOOTHING_WINDOW = 5;

/**
 * Instantaneous speed in poster-space px per millisecond. Pointer events can
 * report identical or non-monotonic timestamps, so the elapsed time is floored
 * at one millisecond (FR-002.1).
 */
export function rawSpeed(distance: number, elapsedMs: number): number {
  return distance / Math.max(1, elapsedMs);
}

/** Simple moving average over the last {@link SMOOTHING_WINDOW} speed samples. */
export class SpeedSmoother {
  private readonly samples: number[] = [];

  push(sample: number): number {
    this.samples.push(sample);
    if (this.samples.length > SMOOTHING_WINDOW) {
      this.samples.shift();
    }
    const total = this.samples.reduce((sum, value) => sum + value, 0);
    return total / this.samples.length;
  }

  reset(): void {
    this.samples.length = 0;
  }
}
