/**
 * requestAnimationFrame ベースのカウントダウンタイマー。
 * onTick で残り時間(ms)と経過割合(0〜1)を毎フレーム通知し、
 * 時間切れで onExpire を一度だけ呼ぶ。cancel() で途中停止できる。
 */
export class CountdownTimer {
  private startedAt = 0;
  private rafId: number | null = null;
  private expired = false;

  constructor(
    private readonly durationMs: number,
    private readonly onTick: (remainingMs: number, progress: number) => void,
    private readonly onExpire: () => void,
  ) {}

  start(): void {
    this.startedAt = performance.now();
    const step = (now: number) => {
      if (this.expired) return;
      const elapsed = now - this.startedAt;
      const remaining = Math.max(this.durationMs - elapsed, 0);
      const progress = 1 - remaining / this.durationMs;
      this.onTick(remaining, progress);
      if (remaining <= 0) {
        this.expired = true;
        this.onExpire();
        return;
      }
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  /** 残り時間(ms)を取得する(回答確定時のスコア計算に使用)。 */
  getRemainingMs(): number {
    const elapsed = performance.now() - this.startedAt;
    return Math.max(this.durationMs - elapsed, 0);
  }

  cancel(): void {
    this.expired = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
