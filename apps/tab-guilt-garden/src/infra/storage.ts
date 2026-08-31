import {
  MAX_GRAVEYARD,
  STORAGE_KEY_GRAVEYARD,
  STORAGE_KEY_INTRO_SEEN,
  STORAGE_KEY_LEDGER,
  STORAGE_KEY_PLANTS,
} from '../domain/constants';
import { emptyLedger, normalizeLedger } from '../domain/ledger';
import type { GraveyardEntry, LifetimeLedger, PlantRecord, SpeciesId } from '../domain/types';

const SPECIES: readonly SpeciesId[] = ['flower', 'cactus', 'mushroom', 'tree'];

/**
 * Detect a *working* Storage rather than merely a present one.
 *
 * Two real-world cases motivate this: Safari private mode exposes localStorage
 * but throws on write, and Node 25 exposes a native localStorage whose setItem
 * is not a function unless --localstorage-file is supplied. Checking
 * `typeof localStorage !== 'undefined'` passes in both cases and then explodes
 * at the first write.
 */
export function isStorageUsable(candidate: unknown): candidate is Storage {
  if (!candidate || typeof candidate !== 'object') return false;
  const s = candidate as Partial<Storage>;
  if (typeof s.setItem !== 'function' || typeof s.getItem !== 'function') return false;
  if (typeof s.removeItem !== 'function') return false;
  try {
    const probe = '__tgg_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => {
      map.clear();
    },
  } as Storage;
}

// --- validation --------------------------------------------------------
// Anything can end up in localStorage: an older schema, a half-written value,
// or a user poking at devtools. Validate per record and drop the bad ones
// rather than letting one malformed entry take down the whole garden.

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function coerceSpecies(v: unknown): SpeciesId {
  return SPECIES.includes(v as SpeciesId) ? (v as SpeciesId) : 'flower';
}

export function isPlantRecord(v: unknown): v is PlantRecord {
  if (!isObject(v)) return false;
  return (
    isNonEmptyString(v.id) &&
    typeof v.name === 'string' &&
    typeof v.note === 'string' &&
    isFiniteNumber(v.plantedAt) &&
    isFiniteNumber(v.lastFocusAt) &&
    isFiniteNumber(v.lastHeartbeatAt)
  );
}

export function isGraveyardEntry(v: unknown): v is GraveyardEntry {
  if (!isObject(v)) return false;
  return (
    isNonEmptyString(v.id) &&
    typeof v.name === 'string' &&
    typeof v.note === 'string' &&
    isFiniteNumber(v.plantedAt) &&
    isFiniteNumber(v.diedAt) &&
    isFiniteNumber(v.neglectMsAtDeath) &&
    isFiniteNumber(v.lifespanMs) &&
    (v.cause === 'closed' || v.cause === 'ghost')
  );
}

function sanitizePlant(v: PlantRecord): PlantRecord {
  return { ...v, species: coerceSpecies(v.species) };
}

function sanitizeGrave(v: GraveyardEntry): GraveyardEntry {
  return { ...v, species: coerceSpecies(v.species) };
}

/** The app's whole persistence surface, so callers never touch raw Storage. */
export class GardenStore {
  private storage: Storage;

  /** True when the real Storage was unusable and we silently fell back to memory. */
  readonly ephemeral: boolean;

  constructor(storage?: Storage | null) {
    const candidate = storage === undefined ? safeAmbientStorage() : storage;
    if (isStorageUsable(candidate)) {
      this.storage = candidate;
      this.ephemeral = false;
    } else {
      this.storage = createMemoryStorage();
      this.ephemeral = true;
    }
  }

  private read(key: string): unknown {
    try {
      const raw = this.storage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): boolean {
    try {
      this.storage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  loadPlants(): PlantRecord[] {
    const raw = this.read(STORAGE_KEY_PLANTS);
    if (!Array.isArray(raw)) return [];
    return raw.filter(isPlantRecord).map(sanitizePlant);
  }

  savePlants(plants: PlantRecord[]): void {
    this.write(STORAGE_KEY_PLANTS, plants);
  }

  loadGraveyard(): GraveyardEntry[] {
    const raw = this.read(STORAGE_KEY_GRAVEYARD);
    if (!Array.isArray(raw)) return [];
    return capGraveyard(raw.filter(isGraveyardEntry).map(sanitizeGrave));
  }

  /**
   * Tombstones accumulate forever by design, so they are the one thing that can
   * realistically exhaust the quota. Cap on the way in, and if a write still
   * fails, halve the history once and retry rather than losing the whole garden.
   */
  saveGraveyard(entries: GraveyardEntry[]): void {
    const capped = capGraveyard(entries);
    if (this.write(STORAGE_KEY_GRAVEYARD, capped)) return;
    const halved = capped.slice(Math.floor(capped.length / 2));
    this.write(STORAGE_KEY_GRAVEYARD, halved);
  }

  loadLedger(): LifetimeLedger {
    const raw = this.read(STORAGE_KEY_LEDGER);
    return raw === null ? emptyLedger() : normalizeLedger(raw);
  }

  saveLedger(ledger: LifetimeLedger): void {
    this.write(STORAGE_KEY_LEDGER, ledger);
  }

  hasSeenIntro(): boolean {
    try {
      return this.storage.getItem(STORAGE_KEY_INTRO_SEEN) === '1';
    } catch {
      return false;
    }
  }

  markIntroSeen(): void {
    try {
      this.storage.setItem(STORAGE_KEY_INTRO_SEEN, '1');
    } catch {
      /* non-essential preference; losing it only re-shows the intro */
    }
  }

  /** Burns the plot. The lifetime ledger and the intro flag deliberately survive. */
  clearGarden(): void {
    try {
      this.storage.removeItem(STORAGE_KEY_PLANTS);
      this.storage.removeItem(STORAGE_KEY_GRAVEYARD);
    } catch {
      /* nothing useful to do if removal fails */
    }
  }

  /** Also wipes the lifetime ledger. Only reachable via an explicit opt-in. */
  clearEverything(): void {
    this.clearGarden();
    try {
      this.storage.removeItem(STORAGE_KEY_LEDGER);
    } catch {
      /* ignore */
    }
  }
}

/** Keeps the newest MAX_GRAVEYARD entries, dropping the oldest deaths first. */
export function capGraveyard(entries: GraveyardEntry[]): GraveyardEntry[] {
  if (entries.length <= MAX_GRAVEYARD) return entries;
  return [...entries].sort((a, b) => a.diedAt - b.diedAt).slice(entries.length - MAX_GRAVEYARD);
}

function safeAmbientStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Accessing localStorage itself can throw when cookies/storage are blocked.
    return null;
  }
}
