import { describe, expect, test } from 'vitest';
import { MAX_GRAVEYARD, STORAGE_KEY_GRAVEYARD, STORAGE_KEY_PLANTS } from '../domain/constants';
import { emptyLedger } from '../domain/ledger';
import type { GraveyardEntry, PlantRecord } from '../domain/types';
import {
  capGraveyard,
  createMemoryStorage,
  GardenStore,
  isGraveyardEntry,
  isPlantRecord,
  isStorageUsable,
} from './storage';

const T0 = 1_700_000_000_000;

function plant(overrides: Partial<PlantRecord> = {}): PlantRecord {
  return {
    id: 'p1',
    name: 'n',
    note: '',
    species: 'flower',
    plantedAt: T0,
    lastFocusAt: T0,
    lastHeartbeatAt: T0,
    ...overrides,
  };
}

function grave(overrides: Partial<GraveyardEntry> = {}): GraveyardEntry {
  return {
    id: 'g1',
    name: '',
    note: '',
    species: 'tree',
    plantedAt: T0,
    diedAt: T0 + 1000,
    cause: 'closed',
    neglectMsAtDeath: 10,
    lifespanMs: 1000,
    ...overrides,
  };
}

describe('isStorageUsable (FR-300)', () => {
  test('rejects absent or non-object candidates', () => {
    for (const bad of [null, undefined, 0, 'localStorage']) {
      expect(isStorageUsable(bad)).toBe(false);
    }
  });

  test('rejects the Node 25 shape where setItem is not a function', () => {
    expect(isStorageUsable({ setItem: undefined, getItem: () => null })).toBe(false);
    expect(isStorageUsable({ setItem: 'nope', getItem: () => null, removeItem: () => {} })).toBe(
      false,
    );
  });

  test('rejects a Storage that throws on write (private browsing)', () => {
    const throwing = {
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {
        throw new DOMException('QuotaExceededError');
      },
    };
    expect(isStorageUsable(throwing)).toBe(false);
  });

  test('accepts a working Storage and leaves no probe behind', () => {
    const s = createMemoryStorage();
    expect(isStorageUsable(s)).toBe(true);
    expect(s.length).toBe(0);
  });
});

describe('GardenStore fallback (AC-300a/b)', () => {
  test('falls back to memory and flags itself when storage is unusable', () => {
    const store = new GardenStore(null);
    expect(store.ephemeral).toBe(true);
    // Still fully operable, just not persistent.
    store.savePlants([plant()]);
    expect(store.loadPlants()).toHaveLength(1);
  });

  test('uses the provided storage and is not ephemeral when it works', () => {
    const store = new GardenStore(createMemoryStorage());
    expect(store.ephemeral).toBe(false);
  });

  test('survives a storage whose setItem throws at write time', () => {
    // Passes the probe, then starts failing -- e.g. quota reached mid-session.
    let failing = false;
    const backing = createMemoryStorage();
    const flaky = {
      ...backing,
      getItem: (k: string) => backing.getItem(k),
      removeItem: (k: string) => backing.removeItem(k),
      setItem: (k: string, v: string) => {
        if (failing) throw new DOMException('QuotaExceededError');
        backing.setItem(k, v);
      },
    } as Storage;
    const store = new GardenStore(flaky);
    failing = true;
    expect(() => store.savePlants([plant()])).not.toThrow();
    expect(() => store.saveGraveyard([grave()])).not.toThrow();
    expect(() => store.saveLedger(emptyLedger())).not.toThrow();
  });
});

describe('schema validation (FR-301 / E-02)', () => {
  test('isPlantRecord rejects malformed records', () => {
    expect(isPlantRecord(plant())).toBe(true);
    expect(isPlantRecord({ broken: true })).toBe(false);
    expect(isPlantRecord(null)).toBe(false);
    expect(isPlantRecord([])).toBe(false);
    expect(isPlantRecord({ ...plant(), id: '' })).toBe(false);
    expect(isPlantRecord({ ...plant(), plantedAt: 'soon' })).toBe(false);
    expect(isPlantRecord({ ...plant(), lastFocusAt: Number.NaN })).toBe(false);
  });

  test('isGraveyardEntry rejects malformed records', () => {
    expect(isGraveyardEntry(grave())).toBe(true);
    expect(isGraveyardEntry({ ...grave(), cause: 'exploded' })).toBe(false);
    expect(isGraveyardEntry({ ...grave(), diedAt: null })).toBe(false);
    expect(isGraveyardEntry('tombstone')).toBe(false);
  });

  test('a non-JSON payload yields an empty garden instead of throwing', () => {
    const s = createMemoryStorage();
    s.setItem(STORAGE_KEY_PLANTS, 'not json');
    s.setItem(STORAGE_KEY_GRAVEYARD, '{{{');
    const store = new GardenStore(s);
    expect(store.loadPlants()).toEqual([]);
    expect(store.loadGraveyard()).toEqual([]);
  });

  test('a JSON object where an array is expected yields empty', () => {
    const s = createMemoryStorage();
    s.setItem(STORAGE_KEY_PLANTS, '{"nope":1}');
    expect(new GardenStore(s).loadPlants()).toEqual([]);
  });

  test('drops only the invalid records and keeps the good ones', () => {
    const s = createMemoryStorage();
    s.setItem(
      STORAGE_KEY_PLANTS,
      JSON.stringify([plant({ id: 'ok' }), { broken: true }, null, plant({ id: 'ok2' })]),
    );
    const loaded = new GardenStore(s).loadPlants();
    expect(loaded.map((p) => p.id)).toEqual(['ok', 'ok2']);
  });

  test('coerces an unknown species to a renderable default', () => {
    const s = createMemoryStorage();
    s.setItem(STORAGE_KEY_PLANTS, JSON.stringify([{ ...plant(), species: 'triffid' }]));
    expect(new GardenStore(s).loadPlants()[0]?.species).toBe('flower');
  });
});

describe('graveyard capacity (FR-302 / E-03)', () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => grave({ id: `g${i}`, diedAt: T0 + i }));

  test('capGraveyard is a no-op below the cap', () => {
    const few = many(3);
    expect(capGraveyard(few)).toHaveLength(3);
  });

  test('keeps the newest MAX_GRAVEYARD deaths and drops the oldest', () => {
    const capped = capGraveyard(many(MAX_GRAVEYARD + 10));
    expect(capped).toHaveLength(MAX_GRAVEYARD);
    expect(capped[0]?.id).toBe('g10');
    expect(capped.at(-1)?.id).toBe(`g${MAX_GRAVEYARD + 9}`);
  });

  test('saving beyond the cap persists only the newest entries', () => {
    const store = new GardenStore(createMemoryStorage());
    store.saveGraveyard(many(MAX_GRAVEYARD + 5));
    expect(store.loadGraveyard()).toHaveLength(MAX_GRAVEYARD);
  });

  test('halves and retries once when the write is rejected (E-04)', () => {
    const backing = createMemoryStorage();
    let rejectBig = true;
    const tight = {
      ...backing,
      getItem: (k: string) => backing.getItem(k),
      removeItem: (k: string) => backing.removeItem(k),
      setItem: (k: string, v: string) => {
        // Reject the first, larger payload only.
        if (rejectBig && k === STORAGE_KEY_GRAVEYARD) {
          rejectBig = false;
          throw new DOMException('QuotaExceededError');
        }
        backing.setItem(k, v);
      },
    } as Storage;
    const store = new GardenStore(tight);
    store.saveGraveyard(many(40));
    const persisted = store.loadGraveyard();
    expect(persisted).toHaveLength(20);
    // The retry keeps the newest half.
    expect(persisted.at(-1)?.id).toBe('g39');
  });
});

describe('reset semantics (AC-400a / AC-500d)', () => {
  test('clearGarden wipes plants and graves but keeps the ledger and intro flag', () => {
    const store = new GardenStore(createMemoryStorage());
    store.savePlants([plant()]);
    store.saveGraveyard([grave()]);
    store.saveLedger({ ...emptyLedger(), totalBuried: 12 });
    store.markIntroSeen();

    store.clearGarden();

    expect(store.loadPlants()).toEqual([]);
    expect(store.loadGraveyard()).toEqual([]);
    expect(store.loadLedger().totalBuried).toBe(12);
    expect(store.hasSeenIntro()).toBe(true);
  });

  test('clearEverything also wipes the ledger (AC-400c)', () => {
    const store = new GardenStore(createMemoryStorage());
    store.saveLedger({ ...emptyLedger(), totalBuried: 12 });
    store.clearEverything();
    expect(store.loadLedger()).toEqual(emptyLedger());
  });
});

describe('intro flag (FR-500)', () => {
  test('defaults to unseen and persists once marked', () => {
    const store = new GardenStore(createMemoryStorage());
    expect(store.hasSeenIntro()).toBe(false);
    store.markIntroSeen();
    expect(store.hasSeenIntro()).toBe(true);
  });
});

describe('ledger persistence', () => {
  test('returns an empty ledger when nothing is stored', () => {
    expect(new GardenStore(createMemoryStorage()).loadLedger()).toEqual(emptyLedger());
  });

  test('round-trips and repairs a corrupted ledger', () => {
    const s = createMemoryStorage();
    const store = new GardenStore(s);
    store.saveLedger({ ...emptyLedger(), totalPlanted: 3 });
    expect(store.loadLedger().totalPlanted).toBe(3);

    s.setItem('tgg:ledger:v1', '"garbage"');
    expect(store.loadLedger()).toEqual(emptyLedger());
  });
});
