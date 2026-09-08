import { GHOST_TIMEOUT_MS, MAX_TABS } from './constants';
import type { TabPresence } from './types';

/**
 * The shared tab registry, as pure transitions.
 *
 * Every tab writes to the same localStorage key with no lock available, so the
 * only safe shape is: read, change *only my own record*, write back. Each
 * function here is written to be idempotent and order-independent so that two
 * tabs racing on the same key converge instead of corrupting each other.
 */

/** FNV-1a, 32-bit. Turns a tab's uuid into a stable seed for its visuals. */
export function hashSeed(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createPresence(id: string, now: number): TabPresence {
  return { id, openedAt: now, lastSeenAt: now, seed: hashSeed(id), earned: 0 };
}

/**
 * Writes the caller's record back, leaving every other record byte-identical to
 * what was read. This is what stops one tab's heartbeat from rolling back the
 * earnings another tab just wrote.
 */
export function upsertOwn(tabs: readonly TabPresence[], own: TabPresence): TabPresence[] {
  let replaced = false;
  const next = tabs.map((t) => {
    if (t.id !== own.id) return t;
    replaced = true;
    return own;
  });
  return replaced ? next : [...next, own];
}

export function removeTab(tabs: readonly TabPresence[], id: string): TabPresence[] {
  return tabs.filter((t) => t.id !== id);
}

export function isGhost(tab: TabPresence, now: number): boolean {
  return now - tab.lastSeenAt > GHOST_TIMEOUT_MS;
}

/**
 * Splits the registry into tabs that are presumed open and tabs presumed dead.
 *
 * A record timestamped in the future (another machine's clock, a DST jump)
 * counts as live: refusing to evict is always the safer error here, because the
 * worst case is a phantom cluster that ages out later, versus deleting the
 * record of a tab that is genuinely open.
 */
export function partitionGhosts(
  tabs: readonly TabPresence[],
  now: number,
): { live: TabPresence[]; ghosts: TabPresence[] } {
  const live: TabPresence[] = [];
  const ghosts: TabPresence[] = [];
  for (const tab of tabs) {
    if (isGhost(tab, now)) ghosts.push(tab);
    else live.push(tab);
  }
  return { live, ghosts };
}

/** Stable ordering: open time first, id as the tiebreak so labels never flicker. */
export function sortByOpenOrder(tabs: readonly TabPresence[]): TabPresence[] {
  return [...tabs].sort((a, b) => a.openedAt - b.openedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** タブA, タブB, ... falling back to a number past the alphabet. */
export function labelAt(index: number): string {
  if (index < 0) return 'タブ?';
  if (index < 26) return `タブ${String.fromCharCode(65 + index)}`;
  return `タブ${index + 1}`;
}

export function assignLabels(tabs: readonly TabPresence[]): Map<string, string> {
  const labels = new Map<string, string>();
  sortByOpenOrder(tabs).forEach((tab, i) => labels.set(tab.id, labelAt(i)));
  return labels;
}

/** Keeps the most recently seen records if the registry ever grows absurdly. */
export function capTabs(tabs: readonly TabPresence[]): TabPresence[] {
  if (tabs.length <= MAX_TABS) return [...tabs];
  return [...tabs].sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, MAX_TABS);
}

export function longestRunning(
  tabs: readonly TabPresence[],
  now: number,
): { tab: TabPresence; label: string; ageMs: number } | null {
  const ordered = sortByOpenOrder(tabs);
  const oldest = ordered[0];
  if (!oldest) return null;
  return { tab: oldest, label: labelAt(0), ageMs: Math.max(0, now - oldest.openedAt) };
}
