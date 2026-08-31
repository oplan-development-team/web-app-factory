import type { GraveyardEntry, LifetimeLedger } from './types';

/**
 * The lifetime ledger is the idle-game spine: it is the one thing that only ever
 * goes up. "庭を焼き払う" resets the plot, but every total here survives it, so
 * walking away and coming back still leaves you with something accumulated.
 *
 * Every function is pure and returns a new ledger; none of them may decrease a
 * total (burnCount aside, which counts the burns themselves).
 */

export function emptyLedger(): LifetimeLedger {
  return {
    totalPlanted: 0,
    totalBuried: 0,
    longestNeglectMs: 0,
    longestLifespanMs: 0,
    peakAlive: 0,
    burnCount: 0,
    firstPlantedAt: null,
    unlocked: [],
  };
}

function nonNegativeInt(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

function nonNegative(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

/** Repairs a ledger read from storage, whatever shape it turns out to be. */
export function normalizeLedger(raw: unknown): LifetimeLedger {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return emptyLedger();
  const r = raw as Record<string, unknown>;
  const firstPlantedAt =
    typeof r.firstPlantedAt === 'number' && Number.isFinite(r.firstPlantedAt)
      ? r.firstPlantedAt
      : null;
  return {
    totalPlanted: nonNegativeInt(r.totalPlanted),
    totalBuried: nonNegativeInt(r.totalBuried),
    longestNeglectMs: nonNegative(r.longestNeglectMs),
    longestLifespanMs: nonNegative(r.longestLifespanMs),
    peakAlive: nonNegativeInt(r.peakAlive),
    burnCount: nonNegativeInt(r.burnCount),
    firstPlantedAt,
    unlocked: Array.isArray(r.unlocked)
      ? [...new Set(r.unlocked.filter((x): x is string => typeof x === 'string'))]
      : [],
  };
}

export function recordPlanted(ledger: LifetimeLedger, now: number): LifetimeLedger {
  return {
    ...ledger,
    totalPlanted: ledger.totalPlanted + 1,
    firstPlantedAt: ledger.firstPlantedAt ?? now,
  };
}

export function recordBuried(ledger: LifetimeLedger, entries: GraveyardEntry[]): LifetimeLedger {
  if (entries.length === 0) return ledger;
  return {
    ...ledger,
    totalBuried: ledger.totalBuried + entries.length,
    longestNeglectMs: Math.max(
      ledger.longestNeglectMs,
      ...entries.map((e) => Math.max(0, e.neglectMsAtDeath)),
    ),
    longestLifespanMs: Math.max(
      ledger.longestLifespanMs,
      ...entries.map((e) => Math.max(0, e.lifespanMs)),
    ),
  };
}

/** Living plants also set neglect records -- you should not have to close a tab to score. */
export function recordNeglect(ledger: LifetimeLedger, neglectMs: number): LifetimeLedger {
  const candidate = Math.max(0, neglectMs);
  if (candidate <= ledger.longestNeglectMs) return ledger;
  return { ...ledger, longestNeglectMs: candidate };
}

export function recordAlive(ledger: LifetimeLedger, aliveCount: number): LifetimeLedger {
  const candidate = Math.max(0, Math.floor(aliveCount));
  if (candidate <= ledger.peakAlive) return ledger;
  return { ...ledger, peakAlive: candidate };
}

export function recordBurn(ledger: LifetimeLedger): LifetimeLedger {
  return { ...ledger, burnCount: ledger.burnCount + 1 };
}

export function withUnlocked(ledger: LifetimeLedger, ids: string[]): LifetimeLedger {
  if (ids.length === 0) return ledger;
  const merged = new Set([...ledger.unlocked, ...ids]);
  if (merged.size === ledger.unlocked.length) return ledger;
  return { ...ledger, unlocked: [...merged] };
}
