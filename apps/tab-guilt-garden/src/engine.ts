import { evaluateAchievements } from './domain/achievements';
import { GHOST_TIMEOUT_MS, HEARTBEAT_BROADCAST_MS } from './domain/constants';
import {
  buryInto,
  createPlant,
  dedupeGraveyard,
  orderForDisplay,
  refreshOwn,
  removeBuried,
  sweepGhosts,
  toGraveyardEntry,
  upsertOwn,
} from './domain/garden';
import { describePlant } from './domain/health';
import {
  recordAlive,
  recordBuried,
  recordBurn,
  recordNeglect,
  recordPlanted,
  withUnlocked,
} from './domain/ledger';
import { pickRandomSpecies } from './domain/species';
import type {
  GraveyardEntry,
  LifetimeLedger,
  PlantRecord,
  SpeciesId,
  Stage,
} from './domain/types';
import type { GardenStore } from './infra/storage';

export interface EngineChannel {
  post(msg: { type: 'planted' | 'heartbeat' | 'buried' | 'reset'; id?: string }): void;
}

export interface EngineDeps {
  store: GardenStore;
  channel: EngineChannel;
  selfId: string;
  now(): number;
  isFocused(): boolean;
  pickSpecies?(): SpeciesId;
}

/** Everything a view needs for one frame. */
export interface GardenSnapshot {
  plants: PlantRecord[];
  graveyard: GraveyardEntry[];
  ledger: LifetimeLedger;
  selfId: string;
  now: number;
  stages: Stage[];
  aliveCount: number;
  /** Achievement ids unlocked by *this* tick, for one-shot notifications. */
  newlyUnlocked: string[];
  ephemeral: boolean;
}

/**
 * Owns the garden's per-tick logic with every side effect injected, so the whole
 * simulation can be driven by a fake clock in tests rather than by real elapsed
 * time. Nothing in here touches the DOM.
 */
export class GardenEngine {
  private lastHeartbeatBroadcast = 0;
  private buriedSelf = false;

  constructor(private deps: EngineDeps) {}

  private get store() {
    return this.deps.store;
  }

  /** Registers this tab's plant. Safe to call again after a bfcache restore. */
  plantSelf(): void {
    const now = this.deps.now();
    const plants = this.store.loadPlants();
    if (plants.some((p) => p.id === this.deps.selfId)) {
      this.buriedSelf = false;
      return;
    }
    const species = (this.deps.pickSpecies ?? pickRandomSpecies)();
    const own = createPlant(this.deps.selfId, species, now);
    this.store.savePlants(upsertOwn(plants, own));
    this.store.saveLedger(recordPlanted(this.store.loadLedger(), now));
    this.buriedSelf = false;
    this.deps.channel.post({ type: 'planted', id: this.deps.selfId });
  }

  /**
   * One simulation step: refresh our own liveness, sweep crashed peers, update
   * the lifetime records, and return a snapshot for rendering.
   */
  tick(): GardenSnapshot {
    const now = this.deps.now();
    const selfId = this.deps.selfId;

    let graveyard = dedupeGraveyard(this.store.loadGraveyard());
    let plants = removeBuried(this.store.loadPlants(), graveyard);

    if (!this.buriedSelf) {
      const existing = plants.find((p) => p.id === selfId);
      const own = existing
        ? refreshOwn(existing, now, this.deps.isFocused())
        : createPlant(selfId, (this.deps.pickSpecies ?? pickRandomSpecies)(), now);
      plants = upsertOwn(plants, own);
    }

    const { survivors, ghosts } = sweepGhosts(plants, selfId, now, GHOST_TIMEOUT_MS);

    let graveyardChanged = false;
    if (ghosts.length > 0) {
      const entries = ghosts.map((g) => toGraveyardEntry(g, now, 'ghost'));
      const result = buryInto(graveyard, entries);
      if (result.added.length > 0) {
        graveyard = result.graveyard;
        graveyardChanged = true;
        this.store.saveGraveyard(graveyard);
        for (const added of result.added) {
          this.deps.channel.post({ type: 'buried', id: added.id });
        }
      }
    }

    this.store.savePlants(survivors);

    if (now - this.lastHeartbeatBroadcast > HEARTBEAT_BROADCAST_MS) {
      this.lastHeartbeatBroadcast = now;
      this.deps.channel.post({ type: 'heartbeat', id: selfId });
    }

    const ordered = orderForDisplay(survivors, selfId);
    const described = ordered.map((p) => describePlant(p, now));
    const stages = described.map((d) => d.stage);

    let ledger = this.store.loadLedger();
    const before = ledger;

    if (graveyardChanged) {
      ledger = recordBuried(
        ledger,
        graveyard.filter((g) => ghosts.some((x) => x.id === g.id)),
      );
    }
    ledger = recordAlive(ledger, ordered.length);
    for (const d of described) ledger = recordNeglect(ledger, d.neglectMs);

    const newlyUnlocked = evaluateAchievements({
      ledger,
      aliveCount: ordered.length,
      stages,
      hasGhostGrave: graveyard.some((g) => g.cause === 'ghost'),
    });
    ledger = withUnlocked(ledger, newlyUnlocked);

    if (ledger !== before) this.store.saveLedger(ledger);

    return {
      plants: ordered,
      graveyard,
      ledger,
      selfId,
      now,
      stages,
      aliveCount: ordered.length,
      newlyUnlocked,
      ephemeral: this.store.ephemeral,
    };
  }

  /** Updates a field on this tab's own plant only. Ignores requests for other ids. */
  patchOwn(id: string, patch: Partial<Pick<PlantRecord, 'name' | 'note'>>): void {
    if (id !== this.deps.selfId) return;
    const plants = this.store.loadPlants();
    const own = plants.find((p) => p.id === this.deps.selfId);
    if (!own) return;
    this.store.savePlants(upsertOwn(plants, { ...own, ...patch }));
  }

  /**
   * Buries this tab's own plant on close. Idempotent, because pagehide and
   * beforeunload both fire and either may be the only one that does.
   */
  buryOwn(): void {
    if (this.buriedSelf) return;
    this.buriedSelf = true;

    const now = this.deps.now();
    const plants = this.store.loadPlants();
    const own = plants.find((p) => p.id === this.deps.selfId);
    this.store.savePlants(plants.filter((p) => p.id !== this.deps.selfId));

    if (!own) return;

    const result = buryInto(dedupeGraveyard(this.store.loadGraveyard()), [
      toGraveyardEntry(own, now, 'closed'),
    ]);
    if (result.added.length > 0) {
      this.store.saveGraveyard(result.graveyard);
      this.store.saveLedger(recordBuried(this.store.loadLedger(), result.added));
    }
    this.deps.channel.post({ type: 'buried', id: this.deps.selfId });
  }

  /** Called when a bfcache restore brings this tab back to life. */
  restore(): void {
    this.buriedSelf = false;
    this.plantSelf();
  }

  /**
   * Burns the plot. The lifetime ledger survives by design -- see FR-400 -- unless
   * the caller explicitly opts into wiping it too.
   */
  reset(alsoWipeLedger: boolean): void {
    const now = this.deps.now();
    if (alsoWipeLedger) {
      this.store.clearEverything();
    } else {
      const ledger = recordBurn(this.store.loadLedger());
      this.store.clearGarden();
      this.store.saveLedger(ledger);
    }
    this.buriedSelf = false;
    const species = (this.deps.pickSpecies ?? pickRandomSpecies)();
    this.store.savePlants([createPlant(this.deps.selfId, species, now)]);
    this.store.saveLedger(recordPlanted(this.store.loadLedger(), now));
    this.deps.channel.post({ type: 'reset' });
  }

  /** Replants this tab after another tab burned the garden. */
  handleRemoteReset(): void {
    this.buriedSelf = false;
    this.plantSelf();
  }
}
