import type { Cut } from './geometry/types';

export type ViewMode = 'wedge' | 'expanded';

export type ToolId = 'triangle' | 'semicircle' | 'wave' | 'notch';

export interface ToolDefaults {
  triangleWidth: number;
  triangleDepth: number;
  semicircleRadius: number;
  waveAmplitude: number;
  waveCount: number;
  notchSize: 'small' | 'medium' | 'large';
}

export const DEFAULT_TOOL_SETTINGS: ToolDefaults = {
  triangleWidth: 24,
  triangleDepth: 18,
  semicircleRadius: 16,
  waveAmplitude: 6,
  waveCount: 5,
  notchSize: 'medium',
};

type Listener = () => void;

interface Snapshot {
  cuts: Cut[];
}

function cloneCuts(cuts: Cut[]): Cut[] {
  return cuts.map((c) => ({ ...c }));
}

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

class SnowflakeStore {
  cuts: Cut[] = [];
  selectedId: string | null = null;
  viewMode: ViewMode = 'wedge';
  activeTool: ToolId | null = 'triangle';
  toolSettings: ToolDefaults = { ...DEFAULT_TOOL_SETTINGS };

  private past: Snapshot[] = [];
  private future: Snapshot[] = [];
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private pushHistory() {
    this.past.push({ cuts: cloneCuts(this.cuts) });
    if (this.past.length > 50) this.past.shift();
    this.future = [];
  }

  addCut(cut: Cut) {
    this.pushHistory();
    this.cuts.push(cut);
    this.selectedId = cut.id;
    this.emit();
  }

  removeCut(id: string) {
    this.pushHistory();
    this.cuts = this.cuts.filter((c) => c.id !== id);
    if (this.selectedId === id) this.selectedId = null;
    this.emit();
  }

  updateCut(id: string, patch: Partial<Cut>) {
    this.pushHistory();
    this.cuts = this.cuts.map((c) => (c.id === id ? ({ ...c, ...patch } as Cut) : c));
    this.emit();
  }

  /** Like updateCut but does not record a history step (for live-drag previews). */
  updateCutLive(id: string, patch: Partial<Cut>) {
    this.cuts = this.cuts.map((c) => (c.id === id ? ({ ...c, ...patch } as Cut) : c));
    this.emit();
  }

  commitLiveEdit(beforeSnapshot: Cut[]) {
    this.past.push({ cuts: beforeSnapshot });
    if (this.past.length > 50) this.past.shift();
    this.future = [];
    this.emit();
  }

  reorderCut(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    this.pushHistory();
    const arr = this.cuts.slice();
    const [item] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, item);
    this.cuts = arr;
    this.emit();
  }

  select(id: string | null) {
    this.selectedId = id;
    this.emit();
  }

  setTool(tool: ToolId | null) {
    this.activeTool = tool;
    this.select(null);
    this.emit();
  }

  setToolSettings(patch: Partial<ToolDefaults>) {
    this.toolSettings = { ...this.toolSettings, ...patch };
    this.emit();
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
    this.emit();
  }

  /** Loads a preset design. If cuts already exist, this is recorded as an undoable step. */
  loadPreset(cuts: Cut[]) {
    this.pushHistory();
    this.cuts = cloneCuts(cuts);
    this.selectedId = null;
    this.emit();
  }

  clearAll() {
    this.pushHistory();
    this.cuts = [];
    this.selectedId = null;
    this.emit();
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }

  undo() {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push({ cuts: cloneCuts(this.cuts) });
    this.cuts = prev.cuts;
    if (this.selectedId && !this.cuts.some((c) => c.id === this.selectedId)) {
      this.selectedId = null;
    }
    this.emit();
  }

  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push({ cuts: cloneCuts(this.cuts) });
    this.cuts = next.cuts;
    if (this.selectedId && !this.cuts.some((c) => c.id === this.selectedId)) {
      this.selectedId = null;
    }
    this.emit();
  }

  get selectedCut(): Cut | null {
    return this.cuts.find((c) => c.id === this.selectedId) ?? null;
  }
}

export const store = new SnowflakeStore();
