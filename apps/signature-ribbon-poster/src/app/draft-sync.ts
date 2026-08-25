import type { DraftStorage } from "../core/draft-storage";
import type { Studio } from "./studio";

/** Debounce window for autosave. Long enough that a fast signature saves once. */
export const AUTOSAVE_DELAY_MS = 800;

export interface DraftSyncOptions {
  readonly studio: Studio;
  readonly storage: DraftStorage;
  /** Called the first time a save fails, and never again (FR-011.5). */
  readonly onSaveFailed: () => void;
  readonly delayMs?: number;
}

/**
 * Persists the studio to local storage as the user works.
 *
 * Saving is a convenience, not a guarantee: if the backing store refuses (private
 * mode, quota) the user is told once and the app carries on without nagging.
 */
export class DraftSync {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private reportedFailure = false;
  private disposed = false;
  private readonly delayMs: number;
  private readonly unsubscribe: () => void;

  constructor(private readonly options: DraftSyncOptions) {
    this.delayMs = options.delayMs ?? AUTOSAVE_DELAY_MS;
    this.unsubscribe = options.studio.subscribe((_, change) => {
      // No point saving mid-stroke; the stroke is not committed yet anyway.
      if (change === "stroke-extended" && options.studio.isDrawing) {
        return;
      }
      this.schedule();
    });
  }

  private schedule(): void {
    if (this.disposed) {
      return;
    }
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.delayMs);
  }

  /** Writes immediately, bypassing the debounce. */
  flush(): void {
    if (this.disposed) {
      return;
    }
    const saved = this.options.storage.save(this.options.studio.toDraft());
    if (!saved && !this.reportedFailure) {
      this.reportedFailure = true;
      this.options.onSaveFailed();
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.unsubscribe();
  }
}
