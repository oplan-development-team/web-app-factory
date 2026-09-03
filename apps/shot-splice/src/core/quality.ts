import { MATCH_COST_THRESHOLD } from './alignment';

export type MatchGrade = 'aligned' | 'close' | 'drifting' | 'unknown';

/** Cost at or below which a seam is considered pixel-perfect. */
export const ALIGNED_COST = 1.5;

/**
 * Buckets a seam cost into the three states the UI communicates with colour.
 *
 * Colour is an information channel here, not decoration: cyan means "these rows
 * are the same pixels", amber means "you still need to nudge this".
 */
export function gradeCost(cost: number | null): MatchGrade {
  if (cost === null || !Number.isFinite(cost)) return 'unknown';
  if (cost <= ALIGNED_COST) return 'aligned';
  if (cost <= MATCH_COST_THRESHOLD) return 'close';
  return 'drifting';
}

export const GRADE_LABEL: Record<MatchGrade, string> = {
  aligned: '一致',
  close: 'ほぼ一致',
  drifting: '要調整',
  unknown: '未検出',
};

/**
 * Maps a seam cost onto 0..1, where 1 is a perfect match. Drives the colour
 * interpolation between the "drift" and "align" tokens.
 */
export function alignmentRatio(cost: number | null): number {
  if (cost === null || !Number.isFinite(cost)) return 0;
  if (cost <= ALIGNED_COST) return 1;
  const span = MATCH_COST_THRESHOLD * 2;
  if (cost >= span) return 0;
  return 1 - (cost - ALIGNED_COST) / (span - ALIGNED_COST);
}
