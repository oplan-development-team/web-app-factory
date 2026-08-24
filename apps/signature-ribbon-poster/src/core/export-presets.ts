import { POSTER_HEIGHT, POSTER_WIDTH } from "./poster";

export type ResolutionId = "study" | "edition" | "archival";

export interface ResolutionPreset {
  readonly id: ResolutionId;
  readonly label: string;
  /** Short line explaining what the size is for, shown under the label. */
  readonly note: string;
  readonly width: number;
  readonly height: number;
  /** Poster-space units → export pixels. */
  readonly scale: number;
}

function preset(
  id: ResolutionId,
  label: string,
  note: string,
  scale: number
): ResolutionPreset {
  const width = Math.round(POSTER_WIDTH * scale);
  return {
    id,
    label,
    note,
    width,
    height: Math.round((width * POSTER_HEIGHT) / POSTER_WIDTH),
    scale,
  };
}

export const RESOLUTION_PRESETS: readonly ResolutionPreset[] = [
  preset("study", "Study", "画面共有・下書き", 0.5),
  preset("edition", "Edition", "汎用", 1),
  preset("archival", "Archival", "印刷（300dpi で約 A3）", 2),
];

export const DEFAULT_RESOLUTION_ID: ResolutionId = "edition";

export function isResolutionId(value: unknown): value is ResolutionId {
  return RESOLUTION_PRESETS.some((item) => item.id === value);
}

export function resolveResolution(id: string): ResolutionPreset {
  return RESOLUTION_PRESETS.find((item) => item.id === id) ?? RESOLUTION_PRESETS[1]!;
}
