import { describe, expect, test } from 'vitest';
import { BASE_RATE_PER_TAB, GHOST_TIMEOUT_MS, MAX_TICK_DELTA_MS } from './constants';
import {
  advanceOwn,
  balanceOf,
  bankTabs,
  clampDelta,
  projectedEarned,
  ratePerTab,
  reconcileSelf,
  totalRate,
} from './glimmer';
import { emptyLevels, emptyProgress } from './upgrades';
import type { Progress, TabPresence } from './types';

const tab = (id: string, lastSeenAt: number, earned: number): TabPresence => ({
  id,
  openedAt: 0,
  lastSeenAt,
  seed: 1,
  earned,
});

describe('rates', () => {
  test('a fresh browser earns the base rate per tab', () => {
    expect(ratePerTab(emptyLevels())).toBe(BASE_RATE_PER_TAB);
  });

  test('共鳴 multiplies the per-tab rate', () => {
    expect(ratePerTab({ ...emptyLevels(), resonance: 2 })).toBeCloseTo(BASE_RATE_PER_TAB * 1.7);
  });

  test('two tabs earn twice as fast as one', () => {
    const one = totalRate(1, emptyLevels());
    expect(totalRate(2, emptyLevels())).toBeCloseTo(one * 2);
  });

  test('a negative tab count cannot produce negative income', () => {
    expect(totalRate(-3, emptyLevels())).toBe(0);
  });
});

describe('clampDelta', () => {
  test('passes an ordinary tick through untouched', () => {
    expect(clampDelta(1000)).toBe(1000);
  });

  test('credits nothing when the clock steps backwards', () => {
    expect(clampDelta(-50_000)).toBe(0);
  });

  test('caps a sleep/bfcache sized delta', () => {
    expect(clampDelta(48 * 60 * 60 * 1000)).toBe(MAX_TICK_DELTA_MS);
  });

  test('credits nothing for a non-finite delta', () => {
    // A corrupt timestamp is not a very long session; paying out the cap for it
    // would reward whatever produced the garbage.
    expect(clampDelta(Number.NaN)).toBe(0);
    expect(clampDelta(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('advanceOwn', () => {
  test('credits elapsed real time, not tick count', () => {
    const next = advanceOwn(tab('a', 1000, 0), 4000, 10);
    expect(next.earned).toBeCloseTo(30);
    expect(next.lastSeenAt).toBe(4000);
  });

  test('one long delta credits the same as many short ones', () => {
    const rate = 7;
    let stepwise = tab('a', 0, 0);
    for (let t = 1000; t <= 10_000; t += 1000) stepwise = advanceOwn(stepwise, t, rate);
    const single = advanceOwn(tab('a', 0, 0), 10_000, rate);
    expect(stepwise.earned).toBeCloseTo(single.earned);
  });

  test('a backwards clock does not erase existing earnings', () => {
    const next = advanceOwn(tab('a', 10_000, 500), 2000, 10);
    expect(next.earned).toBe(500);
  });

  test('does not mutate the record it was given', () => {
    const before = tab('a', 0, 0);
    advanceOwn(before, 5000, 10);
    expect(before.earned).toBe(0);
    expect(before.lastSeenAt).toBe(0);
  });
});

describe('projectedEarned', () => {
  test('matches the stored value when the heartbeat is current', () => {
    expect(projectedEarned(tab('a', 5000, 120), 5000, 10)).toBe(120);
  });

  test('fills in the gap while a throttled tab stays silent', () => {
    expect(projectedEarned(tab('a', 0, 100), 30_000, 10)).toBeCloseTo(400);
  });

  test('stops projecting at the ghost timeout so display and banking agree', () => {
    const rate = 10;
    const stale = tab('a', 0, 100);
    const atTimeout = projectedEarned(stale, GHOST_TIMEOUT_MS, rate);
    const wellPast = projectedEarned(stale, GHOST_TIMEOUT_MS * 9, rate);
    expect(atTimeout).toBeCloseTo(100 + (GHOST_TIMEOUT_MS / 1000) * rate);
    expect(wellPast).toBeCloseTo(atTimeout);
  });
});

describe('balanceOf', () => {
  test('is banked plus live earnings minus spending', () => {
    const progress: Progress = { ...emptyProgress(), banked: 1000, spent: 300 };
    expect(balanceOf(progress, [tab('a', 500, 200)], 500, 10)).toBe(900);
  });

  test('never goes negative even if spending somehow exceeds income', () => {
    expect(balanceOf({ ...emptyProgress(), spent: 9999 }, [], 0, 10)).toBe(0);
  });

  test('two open tabs contribute independently', () => {
    const now = 1000;
    const solo = balanceOf(emptyProgress(), [tab('a', now, 50)], now, 10);
    const duo = balanceOf(emptyProgress(), [tab('a', now, 50), tab('b', now, 50)], now, 10);
    expect(duo).toBeCloseTo(solo * 2);
  });
});

describe('bankTabs', () => {
  test('is a no-op when nobody left', () => {
    const before = emptyProgress();
    expect(bankTabs(before, [], 0, 10)).toBe(before);
  });

  test('a cleanly closed tab moves its earnings across without changing the balance', () => {
    const now = 10_000;
    const rate = 10;
    const leaving = tab('a', now, 640);
    const before = balanceOf(emptyProgress(), [leaving], now, rate);
    const after = balanceOf(bankTabs(emptyProgress(), [leaving], now, rate), [], now, rate);
    expect(after).toBeCloseTo(before);
  });

  test('an evicted ghost banks exactly what was last displayed for it', () => {
    const rate = 10;
    const ghost = tab('a', 0, 300);
    const evictionTime = GHOST_TIMEOUT_MS + 1;
    const displayed = balanceOf(emptyProgress(), [ghost], evictionTime, rate);
    const banked = balanceOf(bankTabs(emptyProgress(), [ghost], evictionTime, rate), [], evictionTime, rate);
    expect(banked).toBeCloseTo(displayed);
  });

  test('two tabs retiring the same ghost converge on one result', () => {
    const rate = 10;
    const ghost = tab('a', 0, 300);
    const byFirstTab = bankTabs(emptyProgress(), [ghost], GHOST_TIMEOUT_MS + 500, rate);
    const bySecondTab = bankTabs(emptyProgress(), [ghost], GHOST_TIMEOUT_MS + 90_000, rate);
    expect(byFirstTab.banked).toBeCloseTo(bySecondTab.banked);
  });
});

describe('reconcileSelf', () => {
  test('leaves a registered tab alone', () => {
    const own = tab('a', 0, 500);
    expect(reconcileSelf([own], own)).toBe(own);
  });

  test('resets earnings for a tab that was evicted while frozen', () => {
    const own = tab('a', 0, 500);
    expect(reconcileSelf([tab('other', 0, 0)], own).earned).toBe(0);
  });

  test('keeps the original open time so the cluster does not restart its growth', () => {
    const own: TabPresence = { id: 'a', openedAt: 1234, lastSeenAt: 5000, seed: 9, earned: 500 };
    expect(reconcileSelf([], own).openedAt).toBe(1234);
  });

  test('is a no-op on first join, when there is nothing to double-credit', () => {
    const own = tab('a', 0, 0);
    expect(reconcileSelf([], own)).toBe(own);
  });

  test('eviction while frozen does not pay the same seconds twice', () => {
    const rate = 10;
    // The tab earned 500, went silent, and was banked by another tab.
    const frozen = tab('a', 0, 500);
    const afterEviction = bankTabs(emptyProgress(), [frozen], GHOST_TIMEOUT_MS + 1, rate);
    const bankedTotal = afterEviction.banked;

    // It then wakes up, still holding its stale `earned`, and rejoins.
    const revived = reconcileSelf([], frozen);
    const balance = balanceOf(afterEviction, [revived], GHOST_TIMEOUT_MS + 1, rate);

    // The projection from its stale heartbeat is capped, so the only thing that
    // matters is that its own 500 is not counted a second time.
    expect(balance).toBeLessThanOrEqual(bankedTotal + (GHOST_TIMEOUT_MS / 1000) * rate);
    expect(revived.earned).toBe(0);
  });
});
