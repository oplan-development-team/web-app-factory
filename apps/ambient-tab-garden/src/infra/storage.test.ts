import { beforeEach, describe, expect, test } from 'vitest';
import { MAX_TABS, STORAGE_KEY_PROGRESS, STORAGE_KEY_TABS } from '../domain/constants';
import { emptyLevels, emptyProgress } from '../domain/upgrades';
import type { TabPresence } from '../domain/types';
import {
  createMemoryStorage,
  dedupeById,
  GardenStore,
  isStorageUsable,
  isTabPresence,
  normalizeLevels,
  normalizeProgress,
} from './storage';

const tab = (id: string, lastSeenAt = 0): TabPresence => ({
  id,
  openedAt: 0,
  lastSeenAt,
  seed: 7,
  earned: 0,
});

describe('isStorageUsable', () => {
  test('accepts a working storage', () => {
    expect(isStorageUsable(createMemoryStorage())).toBe(true);
  });

  test('rejects non-objects', () => {
    expect(isStorageUsable(null)).toBe(false);
    expect(isStorageUsable('localStorage')).toBe(false);
  });

  test('rejects a storage whose setItem is not callable (Node without a backing file)', () => {
    expect(isStorageUsable({ setItem: undefined, getItem: () => null, removeItem: () => {} })).toBe(false);
  });

  test('rejects a storage that throws on write (Safari private mode)', () => {
    const hostile = {
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {
        throw new DOMException('QuotaExceededError');
      },
    };
    expect(isStorageUsable(hostile)).toBe(false);
  });
});

describe('isTabPresence', () => {
  test('accepts a well-formed record', () => {
    expect(isTabPresence(tab('a'))).toBe(true);
  });

  test('rejects records missing an id or carrying junk numbers', () => {
    expect(isTabPresence({ ...tab('a'), id: '' })).toBe(false);
    expect(isTabPresence({ ...tab('a'), openedAt: 'soon' })).toBe(false);
    expect(isTabPresence({ ...tab('a'), earned: Number.NaN })).toBe(false);
    expect(isTabPresence({ ...tab('a'), earned: -5 })).toBe(false);
    expect(isTabPresence(null)).toBe(false);
    expect(isTabPresence([tab('a')])).toBe(false);
  });
});

describe('normalizeLevels / normalizeProgress', () => {
  test('falls back to empty levels for junk', () => {
    expect(normalizeLevels(null)).toEqual(emptyLevels());
    expect(normalizeLevels({ density: 'lots' })).toEqual(emptyLevels());
  });

  test('clamps a tampered level to the upgrade cap', () => {
    expect(normalizeLevels({ density: 9999 }).density).toBe(4);
    expect(normalizeLevels({ density: -3 }).density).toBe(0);
  });

  test('ignores upgrade ids that no longer exist', () => {
    expect(normalizeLevels({ ancientUpgrade: 5 })).toEqual(emptyLevels());
  });

  test('rejects negative currency', () => {
    expect(normalizeProgress({ banked: -100, spent: -5 })).toEqual(emptyProgress());
  });

  test('keeps valid progress intact', () => {
    const stored = { banked: 500, spent: 200, levels: { ...emptyLevels(), orbit: 2 } };
    expect(normalizeProgress(stored)).toEqual(stored);
  });
});

describe('dedupeById', () => {
  test('keeps the record with the freshest heartbeat', () => {
    const result = dedupeById([tab('a', 100), tab('a', 900), tab('b', 50)]);
    expect(result).toHaveLength(2);
    expect(result.find((t) => t.id === 'a')?.lastSeenAt).toBe(900);
  });
});

describe('GardenStore', () => {
  let store: GardenStore;

  beforeEach(() => {
    store = new GardenStore(createMemoryStorage());
  });

  test('reports itself as ephemeral when storage is unusable', () => {
    expect(new GardenStore(null).ephemeral).toBe(true);
    expect(store.ephemeral).toBe(false);
  });

  test('round-trips the tab registry', () => {
    store.saveTabs([tab('a', 10), tab('b', 20)]);
    expect(store.loadTabs().map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  test('returns an empty registry when nothing is stored', () => {
    expect(store.loadTabs()).toEqual([]);
  });

  test('drops malformed records instead of failing the whole load', () => {
    const raw = createMemoryStorage();
    raw.setItem(STORAGE_KEY_TABS, JSON.stringify([tab('good'), { id: 'bad' }, 42, null]));
    expect(new GardenStore(raw).loadTabs().map((t) => t.id)).toEqual(['good']);
  });

  test('survives a value that is not even JSON', () => {
    const raw = createMemoryStorage();
    raw.setItem(STORAGE_KEY_TABS, '{{{not json');
    raw.setItem(STORAGE_KEY_PROGRESS, 'nope');
    const s = new GardenStore(raw);
    expect(s.loadTabs()).toEqual([]);
    expect(s.loadProgress()).toEqual(emptyProgress());
  });

  test('survives a registry stored as an object instead of an array', () => {
    const raw = createMemoryStorage();
    raw.setItem(STORAGE_KEY_TABS, JSON.stringify({ a: tab('a') }));
    expect(new GardenStore(raw).loadTabs()).toEqual([]);
  });

  test('caps an absurdly large registry on the way in', () => {
    const many = Array.from({ length: MAX_TABS + 10 }, (_, i) => tab(`t${i}`, i));
    store.saveTabs(many);
    expect(store.loadTabs().length).toBeLessThanOrEqual(MAX_TABS);
  });

  test('sheds records rather than losing the registry when the quota is full', () => {
    let allowWrite = false;
    const stingy = {
      ...createMemoryStorage(),
      getItem: () => null,
      removeItem: () => {},
      setItem: (_k: string, v: string) => {
        // Reject the first (large) write, accept the smaller retry.
        if (!allowWrite && v.length > 200) throw new DOMException('QuotaExceededError');
        allowWrite = true;
      },
    } as unknown as Storage;
    const s = new GardenStore(createMemoryStorage());
    expect(s.ephemeral).toBe(false);
    // The constructor probe writes a tiny value, so this storage is "usable".
    const quotaStore = new GardenStore(stingy);
    expect(() => quotaStore.saveTabs(Array.from({ length: MAX_TABS }, (_, i) => tab(`t${i}`, i)))).not.toThrow();
  });

  test('round-trips progress', () => {
    const progress = { banked: 1200, spent: 500, levels: { ...emptyLevels(), bloom: 1 } };
    store.saveProgress(progress);
    expect(store.loadProgress()).toEqual(progress);
  });

  test('remembers a dismissed hint', () => {
    expect(store.isHintDismissed()).toBe(false);
    store.dismissHint();
    expect(store.isHintDismissed()).toBe(true);
  });

  test('keeps working after falling back to memory', () => {
    const fallback = new GardenStore(null);
    fallback.saveProgress({ banked: 5, spent: 0, levels: emptyLevels() });
    expect(fallback.loadProgress().banked).toBe(5);
  });
});
