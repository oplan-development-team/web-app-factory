import type { ScaleName } from '../types';

// Self-implemented scale quantization (no music-theory library).
// Degrees are semitone offsets within one octave.
const SCALE_DEGREES: Record<ScaleName, number[]> = {
  pentatonic: [0, 2, 4, 7, 9], // major pentatonic — consonant, ambient
  wholetone: [0, 2, 4, 6, 8, 10], // whole-tone — floating, ambiguous center
};

// 3-octave range, C3 (MIDI 48) .. C6 (MIDI 84)
const MIDI_LOW = 48;
const MIDI_HIGH = 84;

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function buildScaleTable(scale: ScaleName): number[] {
  const degrees = SCALE_DEGREES[scale];
  const notes: number[] = [];
  for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
    const semitone = ((midi % 12) + 12) % 12;
    if (degrees.includes(semitone)) notes.push(midi);
  }
  return notes;
}

const tables: Record<ScaleName, number[]> = {
  pentatonic: buildScaleTable('pentatonic'),
  wholetone: buildScaleTable('wholetone'),
};

/**
 * Maps a normalized vertical position (0 = top of the ink area, 1 = bottom)
 * to a frequency quantized onto the chosen scale. Top = high pitch.
 */
export function yToFrequency(yNorm: number, scale: ScaleName): number {
  const table = tables[scale];
  const clamped = Math.max(0, Math.min(1, yNorm));
  const idx = Math.round((1 - clamped) * (table.length - 1));
  const midi = table[idx];
  return midiToFreq(midi);
}
