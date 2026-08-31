import type { LifetimeLedger } from './types';

/**
 * The rank ladder is the visible progression spine of the idle loop. It is keyed
 * to lifetime burials, which never decrease, so the rank can never regress --
 * burning the garden does not launder your record.
 */
export interface Rank {
  id: string;
  label: string;
  /** Lifetime burials required to reach this rank. */
  threshold: number;
}

export const RANKS: readonly Rank[] = [
  { id: 'innocent', label: '無垢', threshold: 0 },
  { id: 'petty', label: '軽犯罪', threshold: 1 },
  { id: 'habitual', label: '常習犯', threshold: 3 },
  { id: 'felon', label: '重罪人', threshold: 6 },
  { id: 'destroyer', label: '庭の破壊神', threshold: 11 },
];

export interface RankProgress {
  current: Rank;
  next: Rank | null;
  /** 0..1 toward the next rank. Exactly 1 once the ladder is topped out. */
  ratio: number;
  /** Burials still needed for the next rank; 0 at the top. */
  remaining: number;
  isMax: boolean;
}

export function rankFor(totalBuried: number): Rank {
  const n = Math.max(0, totalBuried);
  let current = RANKS[0] as Rank;
  for (const r of RANKS) {
    if (n >= r.threshold) current = r;
  }
  return current;
}

export function rankProgress(ledger: LifetimeLedger): RankProgress {
  const buried = Math.max(0, ledger.totalBuried);
  const current = rankFor(buried);
  const index = RANKS.findIndex((r) => r.id === current.id);
  const next = RANKS[index + 1] ?? null;

  if (!next) {
    return { current, next: null, ratio: 1, remaining: 0, isMax: true };
  }

  const span = next.threshold - current.threshold;
  const done = buried - current.threshold;
  const ratio = span <= 0 ? 1 : Math.min(1, Math.max(0, done / span));
  return {
    current,
    next,
    ratio,
    remaining: Math.max(0, next.threshold - buried),
    isMax: false,
  };
}
