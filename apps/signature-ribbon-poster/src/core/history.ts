/** Maximum number of undoable steps kept in memory (FR-008.5). */
export const HISTORY_LIMIT = 50;

/**
 * Undo/redo over whole snapshots. Snapshots are treated as immutable values, so
 * "clear" is just another pushed state and becomes undoable for free (FR-008.4).
 */
export class History<T> {
  private past: T[] = [];
  private current: T;
  private future: T[] = [];

  constructor(initial: T) {
    this.current = initial;
  }

  get present(): T {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  push(next: T): void {
    this.past.push(this.current);
    if (this.past.length > HISTORY_LIMIT) {
      this.past.shift();
    }
    this.current = next;
    this.future = [];
  }

  undo(): T | null {
    const previous = this.past.pop();
    if (previous === undefined) {
      return null;
    }
    this.future.push(this.current);
    this.current = previous;
    return this.current;
  }

  redo(): T | null {
    const next = this.future.pop();
    if (next === undefined) {
      return null;
    }
    this.past.push(this.current);
    this.current = next;
    return this.current;
  }

  /** Replaces the whole timeline, e.g. after restoring a saved draft. */
  reset(state: T): void {
    this.past = [];
    this.future = [];
    this.current = state;
  }
}
