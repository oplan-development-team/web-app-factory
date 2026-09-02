import type { Stone } from './types';

/**
 * Minimal single-level undo: remembers the stone layout immediately before
 * the last mutating action (add / move / delete). No persistence, no deep
 * history — the state disappears entirely on reload anyway.
 */
export class UndoBuffer {
  private snapshot: Stone[] | null = null;

  capture(stones: Stone[]): void {
    this.snapshot = stones.map((s) => ({ ...s }));
  }

  get hasSnapshot(): boolean {
    return this.snapshot !== null;
  }

  pop(): Stone[] | null {
    const s = this.snapshot;
    this.snapshot = null;
    return s;
  }
}
