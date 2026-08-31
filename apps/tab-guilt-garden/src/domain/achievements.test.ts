import { describe, expect, test } from 'vitest';
import {
  ACHIEVEMENTS,
  achievementById,
  evaluateAchievements,
  type AchievementContext,
} from './achievements';
import { emptyLedger, withUnlocked } from './ledger';
import type { LifetimeLedger, Stage } from './types';

function ctx(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return {
    ledger: emptyLedger(),
    aliveCount: 0,
    stages: [],
    hasGhostGrave: false,
    ...overrides,
  };
}

function ledger(overrides: Partial<LifetimeLedger> = {}): LifetimeLedger {
  return { ...emptyLedger(), ...overrides };
}

describe('ACHIEVEMENTS catalogue', () => {
  test('has ten achievements with unique ids', () => {
    expect(ACHIEVEMENTS).toHaveLength(10);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(10);
  });

  test('every achievement states its requirement so it is discoverable (AC-402b)', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.requirement.length).toBeGreaterThan(0);
    }
  });

  test('achievementById finds known ids and rejects unknown ones', () => {
    expect(achievementById('arsonist')?.label).toBe('放火魔');
    expect(achievementById('nope')).toBeUndefined();
  });
});

describe('unlock rules', () => {
  test('first-sprout unlocks on the first planting', () => {
    expect(evaluateAchievements(ctx({ ledger: ledger({ totalPlanted: 1 }) }))).toContain(
      'first-sprout',
    );
  });

  test('first-grave and gravekeeper track lifetime burials', () => {
    expect(evaluateAchievements(ctx({ ledger: ledger({ totalBuried: 1 }) }))).toContain(
      'first-grave',
    );
    expect(evaluateAchievements(ctx({ ledger: ledger({ totalBuried: 9 }) }))).not.toContain(
      'gravekeeper',
    );
    expect(evaluateAchievements(ctx({ ledger: ledger({ totalBuried: 10 }) }))).toContain(
      'gravekeeper',
    );
  });

  test('full-bloom needs a currently blooming plant', () => {
    expect(evaluateAchievements(ctx({ stages: ['bloom'] }))).toContain('full-bloom');
    expect(evaluateAchievements(ctx({ stages: ['leaf'] }))).not.toContain('full-bloom');
  });

  test('first-wilt also counts stages reached by passing through wilt', () => {
    const pastWilt: Stage[] = ['dead', 'husk', 'fossil'];
    for (const s of pastWilt) {
      expect(evaluateAchievements(ctx({ stages: [s] }))).toContain('first-wilt');
    }
    expect(evaluateAchievements(ctx({ stages: ['wilt'] }))).toContain('first-wilt');
    expect(evaluateAchievements(ctx({ stages: ['bloom'] }))).not.toContain('first-wilt');
  });

  test('fossil-hunter requires the deepest decay stage', () => {
    expect(evaluateAchievements(ctx({ stages: ['husk'] }))).not.toContain('fossil-hunter');
    expect(evaluateAchievements(ctx({ stages: ['fossil'] }))).toContain('fossil-hunter');
  });

  test('simultaneous-tab achievements use the peak, not just the current count', () => {
    // The player may have closed tabs before this evaluation ran.
    expect(evaluateAchievements(ctx({ aliveCount: 0, ledger: ledger({ peakAlive: 5 }) }))).toContain(
      'five-alive',
    );
    expect(evaluateAchievements(ctx({ aliveCount: 5 }))).toContain('five-alive');
    expect(evaluateAchievements(ctx({ aliveCount: 5 }))).not.toContain('ten-alive');
    expect(evaluateAchievements(ctx({ aliveCount: 10 }))).toContain('ten-alive');
  });

  test('ghosted requires a grave created by a ghost sweep', () => {
    expect(evaluateAchievements(ctx({ hasGhostGrave: true }))).toContain('ghosted');
    expect(evaluateAchievements(ctx({ hasGhostGrave: false }))).not.toContain('ghosted');
  });

  test('arsonist requires an actual burn', () => {
    expect(evaluateAchievements(ctx({ ledger: ledger({ burnCount: 1 }) }))).toContain('arsonist');
  });

  test('nothing unlocks from a pristine context', () => {
    expect(evaluateAchievements(ctx())).toEqual([]);
  });
});

describe('idempotence (AC-402a)', () => {
  test('an already-unlocked achievement is never reported again', () => {
    const base = ledger({ totalPlanted: 1 });
    const first = evaluateAchievements(ctx({ ledger: base }));
    expect(first).toContain('first-sprout');

    const after = withUnlocked(base, first);
    expect(evaluateAchievements(ctx({ ledger: after }))).not.toContain('first-sprout');
  });

  test('re-evaluating with the same state yields nothing new', () => {
    let l = ledger({ totalPlanted: 3, totalBuried: 12, burnCount: 2 });
    const newly = evaluateAchievements(ctx({ ledger: l, stages: ['fossil'] }));
    expect(newly.length).toBeGreaterThan(0);
    l = withUnlocked(l, newly);
    expect(evaluateAchievements(ctx({ ledger: l, stages: ['fossil'] }))).toEqual([]);
  });

  test('unlocking is irreversible once the condition lapses (AC-402c)', () => {
    // Bloom now, then let it wilt: the achievement must not be revoked.
    let l = emptyLedger();
    l = withUnlocked(l, evaluateAchievements(ctx({ ledger: l, stages: ['bloom'] })));
    expect(l.unlocked).toContain('full-bloom');
    // Condition no longer holds, but the ledger keeps it.
    expect(evaluateAchievements(ctx({ ledger: l, stages: ['dead'] }))).not.toContain('full-bloom');
    expect(l.unlocked).toContain('full-bloom');
  });
});

describe('purity (AC-402c)', () => {
  test('evaluation does not mutate the context or ledger', () => {
    const c = ctx({ ledger: ledger({ totalPlanted: 1 }), stages: ['bloom'] });
    const snapshot = JSON.stringify(c);
    evaluateAchievements(c);
    expect(JSON.stringify(c)).toBe(snapshot);
  });

  test('depends only on its inputs (same input, same output)', () => {
    const c = ctx({ ledger: ledger({ totalBuried: 10 }), stages: ['wilt'] });
    expect(evaluateAchievements(c)).toEqual(evaluateAchievements(c));
  });
});
