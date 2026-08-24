import type { AppSettings, ProcessingState, SourceImage, TraceResult } from '../types';
import { blurGrid, loadImageFile, toLuminanceGrid, UploadError, validateFile } from './image';
import { traceContours } from './contour';
import { GRID_H, GRID_W } from './constants';

const DEBOUNCE_MS = 160;

export const DEFAULT_SETTINGS: AppSettings = {
  lineCount: 26,
  lineWeight: 1.1,
  smoothing: 3,
  invert: false,
  colorMode: 'mono',
  inkColor: '#1A1A1A',
  paperColor: '#F5F3EE',
  multiPreset: 'topo',
  title: 'UNTITLED SUMMIT',
  includeFrame: true,
};

export interface AppState {
  settings: AppSettings;
  source: SourceImage | null;
  trace: TraceResult | null;
  status: ProcessingState;
  errorMessage: string | null;
  exportMessage: string | null;
}

type Listener = () => void;

export class Store {
  state: AppState = {
    settings: { ...DEFAULT_SETTINGS },
    source: null,
    trace: null,
    status: 'empty',
    errorMessage: null,
    exportMessage: null,
  };

  private listeners: Listener[] = [];
  private grid: Float32Array | null = null;
  private timer: number | undefined;

  subscribe(fn: Listener): void {
    this.listeners.push(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  updateSettings(patch: Partial<AppSettings>): void {
    this.state.settings = { ...this.state.settings, ...patch };
    this.state.exportMessage = null;
    this.emit();
    this.scheduleRecompute();
  }

  /** Cheap settings (title text, export toggles, colors that don't affect the trace) skip recompute entirely. */
  updateSettingsQuiet(patch: Partial<AppSettings>): void {
    this.state.settings = { ...this.state.settings, ...patch };
    this.state.exportMessage = null;
    this.emit();
  }

  setExportMessage(message: string | null): void {
    this.state.exportMessage = message;
    this.emit();
  }

  clearError(): void {
    this.state.errorMessage = null;
    this.emit();
  }

  async loadFile(file: File): Promise<void> {
    this.state.errorMessage = null;
    this.state.exportMessage = null;
    try {
      validateFile(file);
    } catch (err) {
      this.state.errorMessage = err instanceof UploadError ? err.message : String(err);
      this.state.status = this.state.trace ? 'ready' : 'empty';
      this.emit();
      return;
    }

    this.state.status = 'loading';
    this.emit();

    try {
      const source = await loadImageFile(file);
      this.state.source = source;
      this.grid = toLuminanceGrid(source);
      this.recomputeNow();
    } catch (err) {
      this.state.errorMessage =
        err instanceof UploadError ? err.message : '画像の処理中に予期しないエラーが発生しました。別の画像でお試しください。';
      this.state.status = 'empty';
      this.emit();
    }
  }

  reset(): void {
    this.grid = null;
    this.state.source = null;
    this.state.trace = null;
    this.state.status = 'empty';
    this.state.errorMessage = null;
    this.state.exportMessage = null;
    this.emit();
  }

  private scheduleRecompute(): void {
    if (!this.grid) return;
    this.state.status = 'loading';
    this.emit();
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      requestAnimationFrame(() => this.recomputeNow());
    }, DEBOUNCE_MS);
  }

  private recomputeNow(): void {
    if (!this.grid) return;
    const { smoothing, lineCount, invert } = this.state.settings;
    const blurred = blurGrid(this.grid, GRID_W, GRID_H, smoothing);
    this.state.trace = traceContours(blurred, lineCount, invert);
    this.state.status = 'ready';
    this.emit();
  }
}
