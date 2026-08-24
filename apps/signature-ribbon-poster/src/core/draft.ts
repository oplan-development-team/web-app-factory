import { type ResolutionId, DEFAULT_RESOLUTION_ID, isResolutionId } from "./export-presets";
import { clamp } from "./geometry";
import {
  type BackgroundId,
  type RibbonHueId,
  DEFAULT_BACKGROUND_ID,
  DEFAULT_HUE_ID,
  isBackgroundId,
  isRibbonHueId,
} from "./palette";
import type { RibbonPoint, Stroke } from "./stroke";

export const DRAFT_VERSION = 1;

/** Everything needed to reconstruct the studio exactly as the user left it. */
export interface DraftSnapshot {
  readonly backgroundId: BackgroundId;
  readonly hueId: RibbonHueId;
  readonly response: number;
  readonly resolutionId: ResolutionId;
  readonly caption: string;
  readonly strokes: readonly Stroke[];
}

/**
 * Wire format. Points are flattened to `[x, y, dt, speed]` tuples and rounded, which
 * keeps a long signature well inside the localStorage budget (FR-011.3).
 */
export interface SerializedStroke {
  readonly c: RibbonHueId;
  readonly p: number[];
}

export interface SerializedDraft {
  readonly version: number;
  readonly backgroundId: BackgroundId;
  readonly hueId: RibbonHueId;
  readonly response: number;
  readonly resolutionId: ResolutionId;
  readonly caption: string;
  readonly strokes: SerializedStroke[];
}

const VALUES_PER_POINT = 4;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function serializeDraft(snapshot: DraftSnapshot): SerializedDraft {
  return {
    version: DRAFT_VERSION,
    backgroundId: snapshot.backgroundId,
    hueId: snapshot.hueId,
    response: snapshot.response,
    resolutionId: snapshot.resolutionId,
    caption: snapshot.caption,
    strokes: snapshot.strokes.map((stroke) => {
      const origin = stroke.points[0]?.t ?? 0;
      const flat: number[] = [];
      for (const point of stroke.points) {
        flat.push(
          round(point.x, 1),
          round(point.y, 1),
          round(point.t - origin, 1),
          round(point.speed, 4)
        );
      }
      return { c: stroke.colorId, p: flat };
    }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deserializeStroke(raw: unknown): Stroke | null {
  if (!isRecord(raw) || !Array.isArray(raw.p)) {
    return null;
  }
  const flat = raw.p;
  if (flat.length === 0 || flat.length % VALUES_PER_POINT !== 0) {
    return null;
  }
  if (!flat.every((value) => typeof value === "number" && Number.isFinite(value))) {
    return null;
  }

  const points: RibbonPoint[] = [];
  for (let i = 0; i < flat.length; i += VALUES_PER_POINT) {
    points.push({
      x: flat[i] as number,
      y: flat[i + 1] as number,
      t: flat[i + 2] as number,
      speed: flat[i + 3] as number,
    });
  }

  return { colorId: isRibbonHueId(raw.c) ? raw.c : DEFAULT_HUE_ID, points };
}

/**
 * Parses persisted draft JSON. Never throws: anything unrecognised is reported as
 * "no usable draft" so a corrupted entry can never break start-up (FR-011.4, E-09).
 */
export function parseDraft(json: string): DraftSnapshot | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }

  if (!isRecord(raw) || raw.version !== DRAFT_VERSION || !Array.isArray(raw.strokes)) {
    return null;
  }

  const strokes = raw.strokes
    .map(deserializeStroke)
    .filter((stroke): stroke is Stroke => stroke !== null);

  return {
    backgroundId: isBackgroundId(raw.backgroundId) ? raw.backgroundId : DEFAULT_BACKGROUND_ID,
    hueId: isRibbonHueId(raw.hueId) ? raw.hueId : DEFAULT_HUE_ID,
    response:
      typeof raw.response === "number" && Number.isFinite(raw.response)
        ? clamp(Math.round(raw.response), 0, 100)
        : 50,
    resolutionId: isResolutionId(raw.resolutionId) ? raw.resolutionId : DEFAULT_RESOLUTION_ID,
    caption: typeof raw.caption === "string" ? raw.caption : "",
    strokes,
  };
}
