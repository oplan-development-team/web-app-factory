import type { LifetimeLedger, Stage } from './types';

/**
 * Achievements are the small, discrete rewards that make an idle loop worth
 * checking back on. Unlocking is irreversible and evaluated purely from the
 * current snapshot plus the lifetime ledger, so it never depends on catching a
 * moment in flight -- a tab that was closed while you were away still counts.
 */
export interface Achievement {
  id: string;
  label: string;
  /** Shown whether or not it is unlocked, so the player knows what to aim at. */
  requirement: string;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-sprout', label: '最初の罪', requirement: '苗を1本植える' },
  { id: 'first-grave', label: '初めての葬儀', requirement: '苗を1本埋葬する' },
  { id: 'first-wilt', label: 'しおれの兆し', requirement: 'しおれ段階まで放置する' },
  { id: 'full-bloom', label: '満開', requirement: '苗を満開まで育てる' },
  { id: 'five-alive', label: '同時多発', requirement: '同時に5本生存させる' },
  { id: 'ten-alive', label: '二桁の罪', requirement: '同時に10本生存させる' },
  { id: 'fossil-hunter', label: '化石発掘', requirement: '化石化するまで放置する' },
  { id: 'ghosted', label: '音信不通', requirement: 'ゴースト判定で埋葬される' },
  { id: 'gravekeeper', label: '墓守', requirement: '通算10基を埋葬する' },
  { id: 'arsonist', label: '放火魔', requirement: '庭を焼き払う' },
];

/** Everything the unlock rules are allowed to look at. */
export interface AchievementContext {
  ledger: LifetimeLedger;
  aliveCount: number;
  /** Stages currently visible in the garden. */
  stages: Stage[];
  /** True if any tombstone was ever created by a ghost sweep. */
  hasGhostGrave: boolean;
}

type Rule = (ctx: AchievementContext) => boolean;

const RULES: Record<string, Rule> = {
  'first-sprout': (c) => c.ledger.totalPlanted >= 1,
  'first-grave': (c) => c.ledger.totalBuried >= 1,
  'first-wilt': (c) => c.stages.some((s) => s === 'wilt' || isPastWilt(s)),
  'full-bloom': (c) => c.stages.includes('bloom'),
  'five-alive': (c) => Math.max(c.aliveCount, c.ledger.peakAlive) >= 5,
  'ten-alive': (c) => Math.max(c.aliveCount, c.ledger.peakAlive) >= 10,
  'fossil-hunter': (c) => c.stages.includes('fossil'),
  ghosted: (c) => c.hasGhostGrave,
  gravekeeper: (c) => c.ledger.totalBuried >= 10,
  arsonist: (c) => c.ledger.burnCount >= 1,
};

/** Stages that can only be reached by passing through wilt. */
function isPastWilt(stage: Stage): boolean {
  return stage === 'dead' || stage === 'husk' || stage === 'fossil';
}

/** Returns the ids newly satisfied by this context, excluding already-unlocked ones. */
export function evaluateAchievements(ctx: AchievementContext): string[] {
  const already = new Set(ctx.ledger.unlocked);
  const newly: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (already.has(a.id)) continue;
    if (RULES[a.id]?.(ctx)) newly.push(a.id);
  }
  return newly;
}

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
