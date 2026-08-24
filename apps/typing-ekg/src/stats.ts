import type { Beat } from './waveform';

export interface Summary {
  elapsedMs: number;
  charCount: number;
  cpm: number;
  wpm: number;
  backspaceCount: number;
  /** 0..100, higher = more erratic rhythm (based on interval variance) */
  irregularityScore: number;
}

/**
 * Coefficient of variation of inter-keystroke intervals, scaled to a 0-100
 * "irregularity score". A perfectly metronomic typist scores near 0; wildly
 * uneven rhythm (long pauses mixed with bursts) pushes the score up.
 */
function irregularityFromIntervals(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (mean === 0) return 0;
  const variance =
    intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean; // coefficient of variation
  // Empirically CV ~0.2 = very steady, ~1.2+ = very erratic. Scale + clamp.
  return Math.max(0, Math.min(100, Math.round((cv / 1.4) * 100)));
}

export function computeSummary(
  beats: readonly Beat[],
  elapsedMs: number,
  charCount: number,
): Summary {
  const normalBeats = beats.filter((b) => b.kind === 'normal');
  const backspaceCount = beats.filter((b) => b.kind === 'backspace').length;

  const intervals: number[] = [];
  for (let i = 1; i < normalBeats.length; i++) {
    intervals.push(normalBeats[i]!.t - normalBeats[i - 1]!.t);
  }

  const minutes = Math.max(elapsedMs, 1) / 60000;
  const cpm = charCount / minutes;
  const wpm = cpm / 5;

  return {
    elapsedMs,
    charCount,
    cpm: Math.round(cpm),
    wpm: Math.round(wpm),
    backspaceCount,
    irregularityScore: irregularityFromIntervals(intervals),
  };
}
