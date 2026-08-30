import type { Tier } from './judge';

const BASE_POINTS: Record<Tier, number> = {
  2: 100,
  1: 40,
  0: 0,
};

const MAX_STREAK_FOR_MULTIPLIER = 5; // streak 5以上で倍率頭打ち(x3.0)

export interface ScoreOutcome {
  /** この判定を反映した後のストリーク数 */
  nextStreak: number;
  /** この判定に適用された倍率 */
  multiplier: number;
  /** この判定で獲得した点数 */
  roundScore: number;
}

/**
 * tier=2(最高一致)のときのみストリークが伸びる。
 * tier=1(惜しい/部分一致)はストリークを維持（切れない）が伸ばさない。
 * tier=0(不一致)はストリークをリセットする。
 */
export function applyScore(currentStreak: number, tier: Tier): ScoreOutcome {
  let nextStreak = currentStreak;
  if (tier === 2) {
    nextStreak = currentStreak + 1;
  } else if (tier === 0) {
    nextStreak = 0;
  }
  // tier === 1 はストリーク維持

  const effectiveStreak = Math.min(nextStreak, MAX_STREAK_FOR_MULTIPLIER);
  const multiplier = nextStreak > 0 ? 1 + (effectiveStreak - 1) * 0.5 : 1;
  const roundScore = Math.round(BASE_POINTS[tier] * multiplier);

  return { nextStreak, multiplier, roundScore };
}
