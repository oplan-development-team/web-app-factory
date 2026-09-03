import {
  cloneField,
  commitDelta,
  createField,
  subtractDelta,
  zeroField,
} from './lib/field';
import type { CombDensity, DistortionField, DropRecord, InkId, PrintRecord, ToolId } from './lib/types';

const MAX_HISTORY = 16;
/** Soft cap on total drops kept, bounding worst-case per-pixel render cost. */
const MAX_DROPS = 320;

type HistoryEntry = { kind: 'drop'; count: number } | { kind: 'warp'; delta: Float32Array };

export class StudioState {
  drops: DropRecord[] = [];
  field: DistortionField = createField();
  prints: PrintRecord[] = [];

  activeTool: ToolId = 'drop';
  selectedInk: InkId = 'shu';
  combDensity: CombDensity = 'medium';

  private history: HistoryEntry[] = [];
  private nextSeq = 0;
  private printCounter = 0;

  get dropCount(): number {
    return this.drops.length;
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  get nextPrintIndex(): number {
    return this.printCounter + 1;
  }

  get historyCount(): number {
    return this.history.length;
  }

  /** Add a single drop, returning it. Caller decides how it groups into history. */
  addDrop(x: number, y: number, ink: InkId): DropRecord {
    const drop: DropRecord = { x, y, ink, seq: this.nextSeq++ };
    this.drops.push(drop);
    if (this.drops.length > MAX_DROPS) {
      // Evict the oldest drop to bound render cost; history references stay
      // valid since undo only ever pops from the tail.
      this.drops.shift();
    }
    return drop;
  }

  /** Commit a drop-tool interaction (one press, possibly several auto-added drops) to history. */
  commitDropAction(count: number): void {
    if (count <= 0) return;
    this.pushHistory({ kind: 'drop', count });
  }

  /** Begin a fresh zeroed delta buffer for an in-progress comb/swirl stroke. */
  createStrokeDelta(): Float32Array {
    return zeroField(this.field.res);
  }

  /** Merge a finished stroke's delta into the field and record it for undo. */
  commitWarpAction(delta: Float32Array): void {
    commitDelta(this.field, delta);
    this.pushHistory({ kind: 'warp', delta });
  }

  private pushHistory(entry: HistoryEntry): void {
    this.history.push(entry);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
  }

  undo(): boolean {
    const entry = this.history.pop();
    if (!entry) return false;
    if (entry.kind === 'drop') {
      this.drops.splice(Math.max(0, this.drops.length - entry.count), entry.count);
    } else {
      subtractDelta(this.field, entry.delta);
    }
    return true;
  }

  reset(): void {
    this.drops = [];
    this.field = createField();
    this.history = [];
  }

  /** Freeze a snapshot of the current basin as a new print. */
  makePrint(thumbnail: string): PrintRecord {
    this.printCounter++;
    const print: PrintRecord = {
      id: `print-${Date.now()}-${this.printCounter}`,
      createdAt: Date.now(),
      drops: this.drops.map((d) => ({ ...d })),
      field: cloneField(this.field),
      thumbnail,
    };
    this.prints.push(print);
    return print;
  }
}
