/** Number of concentric groove rings extracted from the amplitude envelope. */
export const ENVELOPE_SEGMENT_COUNT = 450;

/** Normalized (0..1) RMS amplitude envelope extracted from an audio source. */
export interface Envelope {
  /** One value per groove ring, 0 (silence) .. 1 (loudest region of the track). */
  values: Float32Array;
  durationSec: number;
  /** Human-readable label for the source, shown in the UI (filename or "マイク録音"). */
  sourceLabel: string;
}

export type PresetId = 'black-gold' | 'red-cream' | 'navy-silver' | 'forest-brass';

export interface LabelPreset {
  id: PresetId;
  name: string;
  /** Label field background (solid, or paired with a subtle radial tint). */
  base: string;
  baseTint: string;
  /** Accent used for the label border ring and small print. */
  accent: string;
  accentSoft: string;
  /** Primary large text color on the label (title/artist). */
  text: string;
  textMuted: string;
}

export interface DiscTextData {
  title: string;
  artist: string;
  catalogNumber: string;
  sideLabel: string;
}

export interface DiscOptions {
  envelope: Envelope | null;
  modStrength: number; // 0..1
  preset: LabelPreset;
  text: DiscTextData;
}

export class AudioProcessingError extends Error {
  constructor(
    message: string,
    public readonly kind: 'decode' | 'permission' | 'silence' | 'unsupported' | 'unknown',
  ) {
    super(message);
    this.name = 'AudioProcessingError';
  }
}
