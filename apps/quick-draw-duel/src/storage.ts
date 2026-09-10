const BEST_MS_KEY = 'quick-draw-duel:best-ms';

/** Returns the all-time best reaction time in ms, or null if never recorded. */
export function getBestMs(): number | null {
  try {
    const raw = localStorage.getItem(BEST_MS_KEY);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    // localStorage unavailable (private mode / disabled) — degrade gracefully.
    return null;
  }
}

/**
 * Stores `ms` as the new best if it beats (or there is no) previous record.
 * Returns true when a new record was set.
 */
export function setBestMsIfBetter(ms: number): boolean {
  try {
    const current = getBestMs();
    if (current === null || ms < current) {
      localStorage.setItem(BEST_MS_KEY, String(ms));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
