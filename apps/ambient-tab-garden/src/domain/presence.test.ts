import { describe, expect, test } from 'vitest';
import { GHOST_TIMEOUT_MS, MAX_TABS } from './constants';
import {
  assignLabels,
  capTabs,
  createPresence,
  hashSeed,
  isGhost,
  labelAt,
  longestRunning,
  partitionGhosts,
  removeTab,
  sortByOpenOrder,
  upsertOwn,
} from './presence';
import type { TabPresence } from './types';

const at = (id: string, openedAt: number, lastSeenAt = openedAt, earned = 0): TabPresence => ({
  id,
  openedAt,
  lastSeenAt,
  seed: hashSeed(id),
  earned,
});

describe('hashSeed', () => {
  test('is deterministic for the same id', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
  });

  test('separates different ids', () => {
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
  });

  test('stays an unsigned 32-bit integer even for long ids', () => {
    const seed = hashSeed('f47ac10b-58cc-4372-a567-0e02b2c3d479');
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });

  test('handles the empty id without throwing', () => {
    expect(hashSeed('')).toBe(0x811c9dc5);
  });
});

describe('createPresence', () => {
  test('starts with zero earnings and a matching heartbeat', () => {
    const p = createPresence('tab-1', 1000);
    expect(p).toEqual({ id: 'tab-1', openedAt: 1000, lastSeenAt: 1000, seed: hashSeed('tab-1'), earned: 0 });
  });
});

describe('upsertOwn', () => {
  test('appends when the tab is not registered yet', () => {
    const own = at('b', 200);
    expect(upsertOwn([at('a', 100)], own).map((t) => t.id)).toEqual(['a', 'b']);
  });

  test('replaces only the caller record and leaves the others untouched', () => {
    const other = at('a', 100, 100, 500);
    const before = [other, at('b', 200, 200, 10)];
    const next = upsertOwn(before, at('b', 200, 999, 42));

    expect(next).toHaveLength(2);
    expect(next[0]).toBe(other);
    expect(next[1]).toMatchObject({ id: 'b', lastSeenAt: 999, earned: 42 });
  });

  test('does not mutate the input array', () => {
    const before = [at('a', 100)];
    upsertOwn(before, at('b', 200));
    expect(before).toHaveLength(1);
  });
});

describe('removeTab', () => {
  test('drops the named tab and keeps the rest', () => {
    expect(removeTab([at('a', 1), at('b', 2)], 'a').map((t) => t.id)).toEqual(['b']);
  });

  test('is a no-op for an unknown id', () => {
    expect(removeTab([at('a', 1)], 'zz')).toHaveLength(1);
  });
});

describe('isGhost / partitionGhosts', () => {
  test('a tab exactly at the timeout is still live', () => {
    expect(isGhost(at('a', 0, 0), GHOST_TIMEOUT_MS)).toBe(false);
  });

  test('a tab one millisecond past the timeout is a ghost', () => {
    expect(isGhost(at('a', 0, 0), GHOST_TIMEOUT_MS + 1)).toBe(true);
  });

  test('a heartbeat from the future is treated as live rather than evicted', () => {
    expect(isGhost(at('a', 0, 5_000_000), 1000)).toBe(false);
  });

  test('splits the registry into live and dead records', () => {
    const now = 1_000_000;
    const { live, ghosts } = partitionGhosts(
      [at('fresh', 0, now - 1000), at('stale', 0, now - GHOST_TIMEOUT_MS - 1)],
      now,
    );
    expect(live.map((t) => t.id)).toEqual(['fresh']);
    expect(ghosts.map((t) => t.id)).toEqual(['stale']);
  });
});

describe('ordering and labels', () => {
  test('sorts by open time', () => {
    expect(sortByOpenOrder([at('b', 300), at('a', 100)]).map((t) => t.id)).toEqual(['a', 'b']);
  });

  test('breaks ties on id so labels do not flicker between ticks', () => {
    const one = sortByOpenOrder([at('z', 100), at('a', 100)]).map((t) => t.id);
    const two = sortByOpenOrder([at('a', 100), at('z', 100)]).map((t) => t.id);
    expect(one).toEqual(['a', 'z']);
    expect(two).toEqual(one);
  });

  test('labels run through the alphabet and then fall back to numbers', () => {
    expect(labelAt(0)).toBe('タブA');
    expect(labelAt(25)).toBe('タブZ');
    expect(labelAt(26)).toBe('タブ27');
    expect(labelAt(-1)).toBe('タブ?');
  });

  test('assigns labels by open order, not array order', () => {
    const labels = assignLabels([at('second', 200), at('first', 100)]);
    expect(labels.get('first')).toBe('タブA');
    expect(labels.get('second')).toBe('タブB');
  });
});

describe('capTabs', () => {
  test('passes small registries through untouched', () => {
    expect(capTabs([at('a', 1)])).toHaveLength(1);
  });

  test('keeps the most recently seen records when the registry overflows', () => {
    const many = Array.from({ length: MAX_TABS + 5 }, (_, i) => at(`t${i}`, i, i));
    const capped = capTabs(many);
    expect(capped).toHaveLength(MAX_TABS);
    expect(capped.some((t) => t.id === 't0')).toBe(false);
    expect(capped.some((t) => t.id === `t${MAX_TABS + 4}`)).toBe(true);
  });
});

describe('longestRunning', () => {
  test('returns null for an empty registry', () => {
    expect(longestRunning([], 1000)).toBeNull();
  });

  test('reports the oldest tab, its label and its age', () => {
    const result = longestRunning([at('b', 5000), at('a', 1000)], 9000);
    expect(result).toMatchObject({ label: 'タブA', ageMs: 8000 });
    expect(result?.tab.id).toBe('a');
  });

  test('never reports a negative age', () => {
    expect(longestRunning([at('a', 9000)], 1000)?.ageMs).toBe(0);
  });
});
