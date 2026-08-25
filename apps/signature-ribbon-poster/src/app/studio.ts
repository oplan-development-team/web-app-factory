import type { DraftSnapshot } from "../core/draft";
import { type ResolutionId, DEFAULT_RESOLUTION_ID } from "../core/export-presets";
import { History } from "../core/history";
import {
  type BackgroundId,
  type RibbonHueId,
  DEFAULT_BACKGROUND_ID,
  DEFAULT_HUE_ID,
  resolveBackground,
  resolveHue,
} from "../core/palette";
import type { Vec2 } from "../core/geometry";
import { DEFAULT_RESPONSE, responseToMaxSpeed } from "../core/ribbon-metrics";
import { StrokeBuilder, type Stroke } from "../core/stroke";

export interface StudioState {
  readonly strokes: readonly Stroke[];
  readonly backgroundId: BackgroundId;
  readonly hueId: RibbonHueId;
  readonly response: number;
  readonly resolutionId: ResolutionId;
  readonly caption: string;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly isDrawing: boolean;
}

/** What changed, so listeners can do the cheapest possible thing about it. */
export type StudioChange =
  | "stroke-extended"
  | "strokes-replaced"
  | "background"
  | "hue"
  | "response"
  | "resolution"
  | "caption";

export type StudioListener = (state: StudioState, change: StudioChange) => void;

/**
 * The single owner of everything the artwork is made of. Nothing else mutates
 * stroke or settings state; the renderer, the draft sync and the UI all read
 * from here and react to change notifications.
 */
export class Studio {
  private readonly history = new History<readonly Stroke[]>([]);
  private readonly listeners = new Set<StudioListener>();
  private builder: StrokeBuilder | null = null;

  private backgroundId: BackgroundId = DEFAULT_BACKGROUND_ID;
  private hueId: RibbonHueId = DEFAULT_HUE_ID;
  private response = DEFAULT_RESPONSE;
  private resolutionId: ResolutionId = DEFAULT_RESOLUTION_ID;
  private caption = "";

  subscribe(listener: StudioListener): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  private emit(change: StudioChange): void {
    const state = this.state;
    for (const listener of this.listeners) {
      listener(state, change);
    }
  }

  get state(): StudioState {
    return {
      strokes: this.strokes,
      backgroundId: this.backgroundId,
      hueId: this.hueId,
      response: this.response,
      resolutionId: this.resolutionId,
      caption: this.caption,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      isDrawing: this.builder !== null,
    };
  }

  /** Committed strokes plus the one currently being drawn, in painting order. */
  get strokes(): readonly Stroke[] {
    const committed = this.history.present;
    return this.builder ? [...committed, this.builder.live] : committed;
  }

  get isDrawing(): boolean {
    return this.builder !== null;
  }

  get backgroundHex(): string {
    return resolveBackground(this.backgroundId).hex;
  }

  get hueHex(): string {
    return resolveHue(this.hueId).hex;
  }

  get maxSpeed(): number {
    return responseToMaxSpeed(this.response);
  }

  beginStroke(origin: Vec2, timestamp: number): void {
    this.builder = new StrokeBuilder(this.hueId, origin, timestamp);
    this.emit("stroke-extended");
  }

  /** @returns true when the sample was accepted as a new point. */
  extendStroke(position: Vec2, timestamp: number): boolean {
    if (!this.builder) {
      return false;
    }
    const accepted = this.builder.extend(position, timestamp);
    if (accepted) {
      this.emit("stroke-extended");
    }
    return accepted;
  }

  finishStroke(): void {
    if (!this.builder) {
      return;
    }
    const stroke = this.builder.snapshot();
    this.builder = null;
    this.history.push([...this.history.present, stroke]);
    this.emit("stroke-extended");
  }

  /** Drops the in-progress stroke without committing it. */
  cancelStroke(): void {
    if (!this.builder) {
      return;
    }
    this.builder = null;
    this.emit("strokes-replaced");
  }

  undo(): void {
    if (this.history.undo() !== null) {
      this.emit("strokes-replaced");
    }
  }

  redo(): void {
    if (this.history.redo() !== null) {
      this.emit("strokes-replaced");
    }
  }

  clear(): void {
    if (this.history.present.length === 0 && !this.builder) {
      return;
    }
    this.builder = null;
    this.history.push([]);
    this.emit("strokes-replaced");
  }

  setBackground(id: BackgroundId): void {
    if (this.backgroundId === id) {
      return;
    }
    this.backgroundId = id;
    this.emit("background");
  }

  setHue(id: RibbonHueId): void {
    if (this.hueId === id) {
      return;
    }
    this.hueId = id;
    this.emit("hue");
  }

  setResponse(response: number): void {
    if (this.response === response) {
      return;
    }
    this.response = response;
    this.emit("response");
  }

  setResolution(id: ResolutionId): void {
    if (this.resolutionId === id) {
      return;
    }
    this.resolutionId = id;
    this.emit("resolution");
  }

  setCaption(caption: string): void {
    if (this.caption === caption) {
      return;
    }
    this.caption = caption;
    this.emit("caption");
  }

  toDraft(): DraftSnapshot {
    return {
      backgroundId: this.backgroundId,
      hueId: this.hueId,
      response: this.response,
      resolutionId: this.resolutionId,
      caption: this.caption,
      strokes: this.history.present,
    };
  }

  /** Replaces the whole studio with a saved draft, discarding the undo timeline. */
  restore(draft: DraftSnapshot): void {
    this.builder = null;
    this.backgroundId = draft.backgroundId;
    this.hueId = draft.hueId;
    this.response = draft.response;
    this.resolutionId = draft.resolutionId;
    this.caption = draft.caption;
    this.history.reset([...draft.strokes]);
    this.emit("strokes-replaced");
  }
}
