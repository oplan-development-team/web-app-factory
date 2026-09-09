import { BASE_RATE_PER_TAB, GHOST_TIMEOUT_MS, MAX_TICK_DELTA_MS } from './constants';
import type { Progress, TabPresence, UpgradeLevels } from './types';
import { effectsOf } from './upgrades';

/**
 * The きらめき economy.
 *
 * The balance is *derived*, never incremented in place:
 *
 *   balance = progress.banked + Σ(live tabs' earned) - progress.spent
 *
 * Each tab advances only its own `earned`, from wall-clock deltas. When a tab
 * leaves the registry its `earned` moves into `banked`, so the balance is
 * continuous across a tab closing rather than jumping. Two tabs racing to
 * retire the same ghost both write the same result, so last-write-wins
 * converges instead of double-crediting.
 */

/** Per-tab きらめき per second, after the 共鳴 multiplier. */
export function ratePerTab(levels: UpgradeLevels): number {
  return BASE_RATE_PER_TAB * effectsOf(levels).rateMultiplier;
}

/** What the stats panel shows as the current combined income. */
export function totalRate(liveTabCount: number, levels: UpgradeLevels): number {
  return Math.max(0, liveTabCount) * ratePerTab(levels);
}

/**
 * Clamps a wall-clock delta before it is turned into currency. A negative delta
 * (clock stepped backwards) credits nothing; an enormous one (sleep, bfcache
 * restore) is capped instead of paying out hours in a single tick.
 */
export function clampDelta(deltaMs: number, maxMs = MAX_TICK_DELTA_MS): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return Math.min(deltaMs, maxMs);
}

/** Advances the caller's own record. Only ever applied to one's own tab. */
export function advanceOwn(own: TabPresence, now: number, rate: number): TabPresence {
  const credited = (clampDelta(now - own.lastSeenAt) / 1000) * rate;
  return { ...own, lastSeenAt: now, earned: own.earned + credited };
}

/**
 * What a tab has earned including the time since its last heartbeat.
 *
 * A backgrounded tab may only write once a minute, so reading `earned` straight
 * from the registry makes the shared counter visibly stall and then jump. The
 * projection is capped at exactly `GHOST_TIMEOUT_MS`, which is the same cap
 * used when banking a ghost -- so the number the user was watching is precisely
 * the number that gets banked, and the balance does not drop at eviction.
 */
export function projectedEarned(tab: TabPresence, now: number, rate: number): number {
  return tab.earned + (clampDelta(now - tab.lastSeenAt, GHOST_TIMEOUT_MS) / 1000) * rate;
}

export function balanceOf(
  progress: Progress,
  liveTabs: readonly TabPresence[],
  now: number,
  rate: number,
): number {
  let live = 0;
  for (const tab of liveTabs) live += projectedEarned(tab, now, rate);
  return Math.max(0, progress.banked + live - progress.spent);
}

/** Moves departing tabs' earnings into the shared bank. Safe to apply twice with the same input. */
export function bankTabs(
  progress: Progress,
  departing: readonly TabPresence[],
  now: number,
  rate: number,
): Progress {
  if (departing.length === 0) return progress;
  let sum = 0;
  for (const tab of departing) sum += projectedEarned(tab, now, rate);
  return { ...progress, banked: progress.banked + sum };
}

/**
 * Repairs the caller's record after it was evicted from the registry while it
 * was frozen or throttled into silence.
 *
 * Its earnings up to eviction are already in `banked`. Rejoining while still
 * holding them would credit the same time twice, so the revived tab restarts
 * its counter at zero and keeps only its original open time.
 */
export function reconcileSelf(tabs: readonly TabPresence[], own: TabPresence): TabPresence {
  const stillRegistered = tabs.some((t) => t.id === own.id);
  if (stillRegistered || own.earned === 0) return own;
  return { ...own, earned: 0 };
}
