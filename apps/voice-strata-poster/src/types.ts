/** A single 200ms-resolution sample extracted from the live mic analysis loop. */
export interface RawSample {
  /** Seconds since recording started. */
  t: number;
  /** Root-mean-square amplitude, roughly 0..1 (clipped). */
  rms: number;
  /** Estimated fundamental frequency in Hz, or null if no confident pitch was found (e.g. silence/noise). */
  f0: number | null;
  /** Standard deviation of pitch (in semitones) across sub-frames within this tick — proxy for vibrato/instability. */
  jitterSemitones: number;
  /** True if this tick was classified as silence (below the RMS gate). */
  silent: boolean;
}

export type TextureId =
  | 'basalt'
  | 'slate'
  | 'shale'
  | 'sandstone'
  | 'limestone'
  | 'quartz';

export interface LithologyBin {
  id: TextureId;
  /** Display name, e.g. "玄武岩". */
  name: string;
  /** Romanized/English subtitle for the specimen-label aesthetic. */
  label: string;
  /** Lower bound of the pitch range this bin covers, in Hz (inclusive). Use -Infinity for the lowest bin. */
  minHz: number;
  /** Upper bound in Hz (exclusive). Use Infinity for the highest bin. */
  maxHz: number;
  /** Base fill color. */
  color: string;
  /** Slightly darker tone used for texture strokes/marks. */
  accent: string;
}

export type SegmentKind = 'lithology' | 'unconformity';

export interface Segment {
  kind: SegmentKind;
  startT: number;
  endT: number;
  /** Present when kind === 'lithology'. */
  lithology?: LithologyBin;
  /** True when the segment's pitch was unstable enough to render as wavy cross-lamina instead of the bin's normal texture. */
  jittery: boolean;
  avgRms: number;
  /** Normalized thickness in poster px, assigned after the full column is laid out. */
  thicknessPx: number;
  /** Top y offset within the strata column, assigned after layout. */
  yPx: number;
}

export interface RecordingStats {
  durationSec: number;
  voicedSegmentCount: number;
  silentSegmentCount: number;
  loudestLithology: LithologyBin | null;
  highestLithology: LithologyBin | null;
}

export interface SpecimenMeta {
  title: string;
  collector: string;
  specimenNumber: string;
  dateLabel: string;
}
