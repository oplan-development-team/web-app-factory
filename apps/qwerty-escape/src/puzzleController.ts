import type { Puzzle } from './types';
import type { KeyActivateSource } from './keyboardView';

export interface PuzzleCallbacks {
  onEngagedChange: (code: string, engaged: boolean) => void;
  onCorrectStep: (code: string, order: number) => void;
  onError: (code: string) => void;
  onSolved: () => void;
  /** Sequence mode only: fired when a wrong key wipes progress back to the start. */
  onSequenceReset: () => void;
}

/**
 * Judges input for a single puzzle.
 *
 * 'simultaneous' puzzles: the "active set" is the union of physically-held
 * codes and click-toggled codes. Clicking a key toggles it on/off (a mouse
 * has no way to hold N keys at once), which is functionally equivalent to
 * a physical simultaneous press once the full target set is active together.
 *
 * 'sequence' puzzles: codes must be activated one at a time, in the exact
 * order given. Any wrong key resets progress to the start (no other
 * penalty — the player can retry immediately).
 */
export class PuzzleController {
  private puzzle: Puzzle;
  private callbacks: PuzzleCallbacks;
  private targetSet: Set<string>;
  private heldPhysical = new Set<string>();
  private toggledClick = new Set<string>();
  private seqProgress = 0;
  private solved = false;

  constructor(puzzle: Puzzle, callbacks: PuzzleCallbacks) {
    this.puzzle = puzzle;
    this.callbacks = callbacks;
    this.targetSet = new Set(puzzle.codes);
  }

  reset(): void {
    for (const code of this.heldPhysical) this.callbacks.onEngagedChange(code, false);
    for (const code of this.toggledClick) this.callbacks.onEngagedChange(code, false);
    this.heldPhysical.clear();
    this.toggledClick.clear();
    this.seqProgress = 0;
    this.solved = false;
  }

  activate(code: string, source: KeyActivateSource): void {
    if (this.solved) return;
    if (this.puzzle.mode === 'simultaneous') {
      this.activateSimultaneous(code, source);
    } else {
      this.activateSequence(code);
    }
  }

  deactivatePhysical(code: string): void {
    if (this.solved) return;
    if (this.puzzle.mode !== 'simultaneous') return;
    if (this.heldPhysical.delete(code)) {
      // Only visually disengage if it isn't also click-toggled on.
      if (!this.toggledClick.has(code)) this.callbacks.onEngagedChange(code, false);
    }
  }

  private activeUnion(): Set<string> {
    return new Set([...this.heldPhysical, ...this.toggledClick]);
  }

  private activateSimultaneous(code: string, source: KeyActivateSource): void {
    if (source === 'physical') {
      this.heldPhysical.add(code);
      this.callbacks.onEngagedChange(code, true);
    } else if (this.toggledClick.has(code)) {
      this.toggledClick.delete(code);
      if (!this.heldPhysical.has(code)) this.callbacks.onEngagedChange(code, false);
    } else if (this.targetSet.has(code)) {
      // Only target keys are toggle-able, so a stray wrong click can't
      // permanently pollute the active set with no way to "release" it
      // (unlike a physical key, a click toggle has no natural keyup).
      this.toggledClick.add(code);
      this.callbacks.onEngagedChange(code, true);
    }

    const active = this.activeUnion();
    if (active.size === this.targetSet.size && [...active].every((c) => this.targetSet.has(c))) {
      this.succeed();
      return;
    }
    if (!this.targetSet.has(code)) {
      this.callbacks.onError(code);
    }
  }

  private activateSequence(code: string): void {
    const expected = this.puzzle.codes[this.seqProgress];
    if (code === expected) {
      this.seqProgress += 1;
      this.callbacks.onCorrectStep(code, this.seqProgress);
      if (this.seqProgress >= this.puzzle.codes.length) {
        this.succeed();
      }
    } else {
      this.callbacks.onError(code);
      if (this.seqProgress > 0) {
        this.seqProgress = 0;
        this.callbacks.onSequenceReset();
      }
    }
  }

  private succeed(): void {
    this.solved = true;
    this.callbacks.onSolved();
  }
}
