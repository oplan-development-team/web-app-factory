import { beforeEach, describe, expect, test } from 'vitest';
import { DECAY_MS, FOSSIL_AT_MS, GHOST_TIMEOUT_MS, HUSK_AT_MS } from './domain/constants';
import type { PlantRecord, SpeciesId } from './domain/types';
import { GardenEngine, type EngineChannel } from './engine';
import { createMemoryStorage, GardenStore } from './infra/storage';

const T0 = 1_700_000_000_000;

interface Posted {
  type: string;
  id?: string;
}

class FakeChannel implements EngineChannel {
  sent: Posted[] = [];
  post(msg: Posted): void {
    this.sent.push(msg);
  }
  typesOf(type: string): Posted[] {
    return this.sent.filter((m) => m.type === type);
  }
}

/** Builds an engine over an in-memory store with a clock we control. */
function harness(opts: { selfId?: string; storage?: Storage; focused?: boolean } = {}) {
  const storage = opts.storage ?? createMemoryStorage();
  const store = new GardenStore(storage);
  const channel = new FakeChannel();
  let clock = T0;
  let focused = opts.focused ?? true;

  const engine = new GardenEngine({
    store,
    channel,
    selfId: opts.selfId ?? 'me',
    now: () => clock,
    isFocused: () => focused,
    pickSpecies: (): SpeciesId => 'flower',
  });

  return {
    engine,
    store,
    storage,
    channel,
    advance: (ms: number) => {
      clock += ms;
    },
    setClock: (t: number) => {
      clock = t;
    },
    setFocused: (v: boolean) => {
      focused = v;
    },
    now: () => clock,
  };
}

function seedPeer(store: GardenStore, id: string, overrides: Partial<PlantRecord> = {}): void {
  store.savePlants([
    ...store.loadPlants(),
    {
      id,
      name: '',
      note: '',
      species: 'tree',
      plantedAt: T0,
      lastFocusAt: T0,
      lastHeartbeatAt: T0,
      ...overrides,
    },
  ]);
}

describe('plantSelf', () => {
  test('adds this tab and counts it in the lifetime ledger', () => {
    const h = harness();
    h.engine.plantSelf();
    expect(h.store.loadPlants().map((p) => p.id)).toEqual(['me']);
    expect(h.store.loadLedger().totalPlanted).toBe(1);
    expect(h.channel.typesOf('planted')).toHaveLength(1);
  });

  test('is idempotent -- replanting does not double-count', () => {
    const h = harness();
    h.engine.plantSelf();
    h.engine.plantSelf();
    expect(h.store.loadPlants()).toHaveLength(1);
    expect(h.store.loadLedger().totalPlanted).toBe(1);
  });

  test('leaves other tabs untouched', () => {
    const h = harness();
    seedPeer(h.store, 'other');
    h.engine.plantSelf();
    expect(h.store.loadPlants().map((p) => p.id).sort()).toEqual(['me', 'other']);
  });
});

describe('tick -- growth and decay over injected time', () => {
  test('a focused plant stays at full vitality', () => {
    const h = harness({ focused: true });
    h.engine.plantSelf();
    h.advance(DECAY_MS * 2);
    const snap = h.engine.tick();
    expect(snap.stages[0]).not.toBe('dead');
  });

  test('an unfocused plant wilts and then dies on the real schedule', () => {
    const h = harness({ focused: true });
    h.engine.plantSelf();
    h.engine.tick();
    h.setFocused(false);

    h.advance(DECAY_MS * 0.6);
    expect(h.engine.tick().stages[0]).toBe('wilt');

    h.advance(DECAY_MS * 0.5);
    expect(h.engine.tick().stages[0]).toBe('dead');
  });

  test('keeps decaying past death into husk and fossil (AC-103a)', () => {
    const h = harness({ focused: true });
    h.engine.plantSelf();
    h.engine.tick();
    h.setFocused(false);

    h.advance(HUSK_AT_MS + 1000);
    expect(h.engine.tick().stages[0]).toBe('husk');

    h.advance(FOSSIL_AT_MS - HUSK_AT_MS);
    expect(h.engine.tick().stages[0]).toBe('fossil');
  });

  test('refocusing revives even a fossil (AC-103b)', () => {
    const h = harness({ focused: false });
    h.engine.plantSelf();
    h.advance(FOSSIL_AT_MS + 5000);
    expect(h.engine.tick().stages[0]).toBe('fossil');

    h.setFocused(true);
    expect(h.engine.tick().stages[0]).not.toBe('fossil');
  });

  test('records the longest neglect while the plant is still alive (FR-400)', () => {
    const h = harness({ focused: false });
    h.engine.plantSelf();
    h.advance(45_000);
    h.engine.tick();
    expect(h.store.loadLedger().longestNeglectMs).toBeGreaterThanOrEqual(45_000);
  });
});

describe('tick -- ghost sweeping (FR-204)', () => {
  test('buries a peer whose heartbeat went silent', () => {
    const h = harness();
    h.engine.plantSelf();
    seedPeer(h.store, 'crashed', { lastHeartbeatAt: T0 });

    h.advance(GHOST_TIMEOUT_MS + 1000);
    const snap = h.engine.tick();

    expect(snap.plants.map((p) => p.id)).toEqual(['me']);
    expect(snap.graveyard.map((g) => g.id)).toEqual(['crashed']);
    expect(snap.graveyard[0]?.cause).toBe('ghost');
  });

  test('broadcasts the ghost id, not the sweeping tab id (AC-202a)', () => {
    const h = harness();
    h.engine.plantSelf();
    seedPeer(h.store, 'crashed', { lastHeartbeatAt: T0 });
    h.advance(GHOST_TIMEOUT_MS + 1000);
    h.engine.tick();

    const buried = h.channel.typesOf('buried');
    expect(buried).toHaveLength(1);
    expect(buried[0]?.id).toBe('crashed');
  });

  test('two tabs sweeping the same ghost produce one tombstone (AC-204a / E-06)', () => {
    const storage = createMemoryStorage();
    const a = harness({ selfId: 'a', storage });
    const b = harness({ selfId: 'b', storage });
    a.engine.plantSelf();
    b.engine.plantSelf();
    seedPeer(a.store, 'crashed', { lastHeartbeatAt: T0 });

    // Both live tabs keep ticking, so their heartbeats stay fresh and only
    // 'crashed' goes silent. Ticking in lockstep means both tabs reach the
    // sweep for the same ghost.
    const step = GHOST_TIMEOUT_MS / 3;
    for (let i = 0; i < 4; i += 1) {
      a.advance(step);
      b.advance(step);
      a.engine.tick();
      b.engine.tick();
    }

    expect(a.store.loadPlants().map((p) => p.id).sort()).toEqual(['a', 'b']);
    expect(a.store.loadGraveyard().filter((g) => g.id === 'crashed')).toHaveLength(1);
    expect(a.store.loadLedger().totalBuried).toBe(1);
  });

  test('never ghosts itself even after a long unfocused stretch (AC-204b)', () => {
    const h = harness({ focused: false });
    h.engine.plantSelf();
    h.advance(GHOST_TIMEOUT_MS * 5);
    const snap = h.engine.tick();
    expect(snap.plants.map((p) => p.id)).toEqual(['me']);
    expect(snap.graveyard).toEqual([]);
  });

  test('does not bury a peer that is still beating', () => {
    const h = harness();
    h.engine.plantSelf();
    h.advance(GHOST_TIMEOUT_MS + 1000);
    seedPeer(h.store, 'alive', { lastHeartbeatAt: h.now() });
    expect(h.engine.tick().graveyard).toEqual([]);
  });
});

describe('buryOwn (FR-205)', () => {
  test('moves this tab to the graveyard with cause closed', () => {
    const h = harness();
    h.engine.plantSelf();
    h.advance(5000);
    h.engine.buryOwn();

    expect(h.store.loadPlants()).toEqual([]);
    const graves = h.store.loadGraveyard();
    expect(graves).toHaveLength(1);
    expect(graves[0]).toMatchObject({ id: 'me', cause: 'closed' });
    expect(h.store.loadLedger().totalBuried).toBe(1);
  });

  test('double-firing pagehide and beforeunload leaves one tombstone (AC-205a / E-07)', () => {
    const h = harness();
    h.engine.plantSelf();
    h.engine.buryOwn();
    h.engine.buryOwn();
    expect(h.store.loadGraveyard()).toHaveLength(1);
    expect(h.store.loadLedger().totalBuried).toBe(1);
  });

  test('a tick after burial does not resurrect the plant (FR-206)', () => {
    const h = harness();
    h.engine.plantSelf();
    h.engine.buryOwn();
    const snap = h.engine.tick();
    expect(snap.plants).toEqual([]);
    expect(snap.graveyard).toHaveLength(1);
  });

  test('is a no-op when the plant is already gone', () => {
    const h = harness();
    h.engine.plantSelf();
    h.store.savePlants([]);
    expect(() => h.engine.buryOwn()).not.toThrow();
    expect(h.store.loadGraveyard()).toEqual([]);
  });
});

describe('restore -- bfcache (AC-205b / E-08)', () => {
  test('a restored tab comes back as a living plant and can be buried again', () => {
    const h = harness();
    h.engine.plantSelf();
    h.engine.buryOwn();
    expect(h.store.loadPlants()).toEqual([]);

    h.advance(1000);
    h.engine.restore();
    expect(h.store.loadPlants().map((p) => p.id)).toEqual(['me']);

    h.advance(1000);
    h.engine.buryOwn();
    expect(h.store.loadPlants()).toEqual([]);
    // Two genuine lives, two tombstones is wrong -- the id is the same, so the
    // second burial is deduped. What matters is that it did not throw or leak.
    expect(h.store.loadGraveyard()).toHaveLength(1);
  });

  test('ticking after restore keeps the plant alive', () => {
    const h = harness();
    h.engine.plantSelf();
    h.engine.buryOwn();
    h.engine.restore();
    h.advance(1000);
    expect(h.engine.tick().plants.map((p) => p.id)).toEqual(['me']);
  });
});

describe('reset -- burning the garden (FR-400)', () => {
  test('clears plot but preserves lifetime totals (AC-400a)', () => {
    const h = harness();
    h.engine.plantSelf();
    h.advance(1000);
    h.engine.buryOwn();
    const beforeBuried = h.store.loadLedger().totalBuried;
    expect(beforeBuried).toBe(1);

    h.engine.reset(false);

    expect(h.store.loadGraveyard()).toEqual([]);
    const after = h.store.loadLedger();
    expect(after.totalBuried).toBe(beforeBuried);
    expect(after.burnCount).toBe(1);
  });

  test('replants this tab so the garden is never left empty', () => {
    const h = harness();
    h.engine.plantSelf();
    h.engine.reset(false);
    expect(h.store.loadPlants().map((p) => p.id)).toEqual(['me']);
  });

  test('counts the burn toward the arsonist achievement', () => {
    const h = harness();
    h.engine.plantSelf();
    h.engine.reset(false);
    const snap = h.engine.tick();
    expect(snap.ledger.unlocked).toContain('arsonist');
  });

  test('the opt-in wipe clears the ledger too (AC-400c)', () => {
    const h = harness();
    h.engine.plantSelf();
    h.advance(1000);
    h.engine.buryOwn();
    h.engine.reset(true);

    const after = h.store.loadLedger();
    expect(after.totalBuried).toBe(0);
    expect(after.burnCount).toBe(0);
    // The fresh replant is still counted, so the garden stays consistent.
    expect(after.totalPlanted).toBe(1);
  });

  test('broadcasts the reset so peers replant', () => {
    const h = harness();
    h.engine.plantSelf();
    h.engine.reset(false);
    expect(h.channel.typesOf('reset')).toHaveLength(1);
  });

  test('handleRemoteReset replants this tab after a peer burned the garden', () => {
    const h = harness();
    h.engine.plantSelf();
    h.store.clearGarden();
    h.engine.handleRemoteReset();
    expect(h.store.loadPlants().map((p) => p.id)).toEqual(['me']);
  });
});

describe('patchOwn (FR-203)', () => {
  test('updates this tab name and excuse', () => {
    const h = harness();
    h.engine.plantSelf();
    h.engine.patchOwn('me', { name: 'あとで読む' });
    h.engine.patchOwn('me', { note: '本当に読む' });
    const own = h.store.loadPlants().find((p) => p.id === 'me');
    expect(own?.name).toBe('あとで読む');
    expect(own?.note).toBe('本当に読む');
  });

  test('refuses to edit another tab plant', () => {
    const h = harness();
    h.engine.plantSelf();
    seedPeer(h.store, 'other', { name: 'theirs' });
    h.engine.patchOwn('other', { name: 'hijacked' });
    expect(h.store.loadPlants().find((p) => p.id === 'other')?.name).toBe('theirs');
  });

  test('a peer tick does not revert an in-progress edit (AC-203a / E-09)', () => {
    const storage = createMemoryStorage();
    const a = harness({ selfId: 'a', storage });
    const b = harness({ selfId: 'b', storage });
    a.engine.plantSelf();
    b.engine.plantSelf();

    a.engine.patchOwn('a', { name: '入力中のテキスト' });
    b.advance(1000);
    b.engine.tick();

    expect(a.store.loadPlants().find((p) => p.id === 'a')?.name).toBe('入力中のテキスト');
  });
});

describe('snapshot contents', () => {
  test('orders the caller first', () => {
    const h = harness();
    seedPeer(h.store, 'older', { plantedAt: T0 - 10_000 });
    h.engine.plantSelf();
    expect(h.engine.tick().plants[0]?.id).toBe('me');
  });

  test('reports newly unlocked achievements only once (AC-402a)', () => {
    const h = harness();
    h.engine.plantSelf();
    const first = h.engine.tick();
    expect(first.newlyUnlocked).toContain('first-sprout');

    h.advance(1000);
    expect(h.engine.tick().newlyUnlocked).not.toContain('first-sprout');
  });

  test('surfaces the ephemeral storage flag (AC-300b)', () => {
    const h = harness();
    expect(h.engine.tick().ephemeral).toBe(false);

    const broken = new GardenStore(null);
    const engine = new GardenEngine({
      store: broken,
      channel: new FakeChannel(),
      selfId: 'me',
      now: () => T0,
      isFocused: () => true,
    });
    expect(engine.tick().ephemeral).toBe(true);
  });

  test('exposes the ledger for the scoreboard', () => {
    const h = harness();
    h.engine.plantSelf();
    expect(h.engine.tick().ledger.totalPlanted).toBe(1);
  });
});

describe('resilience', () => {
  test('survives corrupt stored data and rebuilds the garden (E-02)', () => {
    const storage = createMemoryStorage();
    storage.setItem('tgg:plants:v1', 'not json');
    storage.setItem('tgg:graveyard:v1', '[{"broken":true}]');
    storage.setItem('tgg:ledger:v1', '"nope"');

    const h = harness({ storage });
    expect(() => h.engine.plantSelf()).not.toThrow();
    const snap = h.engine.tick();
    expect(snap.plants.map((p) => p.id)).toEqual(['me']);
    expect(snap.graveyard).toEqual([]);
  });

  test('keeps running against an unusable storage (E-01)', () => {
    const store = new GardenStore(null);
    const engine = new GardenEngine({
      store,
      channel: new FakeChannel(),
      selfId: 'me',
      now: () => T0,
      isFocused: () => true,
    });
    engine.plantSelf();
    expect(engine.tick().plants).toHaveLength(1);
  });

  test('a backwards clock never produces NaN durations (E-10)', () => {
    const h = harness({ focused: false });
    h.engine.plantSelf();
    h.setClock(T0 - 60_000);
    const snap = h.engine.tick();
    expect(snap.stages[0]).toBeDefined();
    expect(Number.isNaN(snap.ledger.longestNeglectMs)).toBe(false);
  });
});

describe('heartbeat broadcasting', () => {
  test('throttles heartbeats rather than sending one every tick', () => {
    const h = harness();
    h.engine.plantSelf();
    for (let i = 0; i < 5; i += 1) {
      h.advance(200);
      h.engine.tick();
    }
    expect(h.channel.typesOf('heartbeat').length).toBeLessThan(5);
  });

  test('does eventually send once the interval passes', () => {
    const h = harness();
    h.engine.plantSelf();
    h.advance(10_000);
    h.engine.tick();
    expect(h.channel.typesOf('heartbeat').length).toBeGreaterThan(0);
  });
});

describe('multi-tab garden', () => {
  let storage: Storage;
  beforeEach(() => {
    storage = createMemoryStorage();
  });

  test('every tab sees every other tab plant', () => {
    const a = harness({ selfId: 'a', storage });
    const b = harness({ selfId: 'b', storage });
    const c = harness({ selfId: 'c', storage });
    a.engine.plantSelf();
    b.engine.plantSelf();
    c.engine.plantSelf();

    expect(a.engine.tick().plants.map((p) => p.id).sort()).toEqual(['a', 'b', 'c']);
    expect(b.engine.tick().aliveCount).toBe(3);
  });

  test('closing one tab leaves a tombstone the others can see', () => {
    const a = harness({ selfId: 'a', storage });
    const b = harness({ selfId: 'b', storage });
    a.engine.plantSelf();
    b.engine.plantSelf();

    a.advance(2000);
    a.engine.buryOwn();

    b.advance(2000);
    const snap = b.engine.tick();
    expect(snap.plants.map((p) => p.id)).toEqual(['b']);
    expect(snap.graveyard.map((g) => g.id)).toEqual(['a']);
  });

  test('peak simultaneous tabs is remembered after tabs close', () => {
    const a = harness({ selfId: 'a', storage });
    const b = harness({ selfId: 'b', storage });
    a.engine.plantSelf();
    b.engine.plantSelf();
    a.engine.tick();
    expect(a.store.loadLedger().peakAlive).toBe(2);

    b.engine.buryOwn();
    a.advance(1000);
    expect(a.engine.tick().ledger.peakAlive).toBe(2);
  });
});
