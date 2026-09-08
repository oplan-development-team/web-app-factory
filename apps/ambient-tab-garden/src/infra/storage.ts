import {
  MAX_TABS,
  STORAGE_KEY_HINT_DISMISSED,
  STORAGE_KEY_PROGRESS,
  STORAGE_KEY_TABS,
} from '../domain/constants';
import { capTabs } from '../domain/presence';
import type { Progress, TabPresence, UpgradeId, UpgradeLevels } from '../domain/types';
import { emptyLevels, emptyProgress, UPGRADES } from '../domain/upgrades';

/**
 * Detects a *working* Storage rather than merely a present one.
 *
 * Two real cases motivate the write probe: Safari's private mode exposes
 * localStorage but throws on write, and Node exposes a native localStorage
 * whose setItem is not callable unless the process was started with a backing
 * file. A `typeof !== 'undefined'` check passes in both and then explodes on
 * the first save.
 */
export function isStorageUsable(candidate: unknown): candidate is Storage {
  if (!candidate || typeof candidate !== 'object') return false;
  const s = candidate as Partial<Storage>;
  if (typeof s.setItem !== 'function' || typeof s.getItem !== 'function') return false;
  if (typeof s.removeItem !== 'function') return false;
  try {
    const probe = '__atg_probe__';
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
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  } as Storage;
}

// --- validation -------------------------------------------------------
// Anything can turn up in localStorage: an older schema, a half-written value,
// or someone poking at devtools. Validate per record and drop the bad ones
// instead of letting one malformed entry take the whole garden down.

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isTabPresence(v: unknown): v is TabPresence {
  if (!isObject(v)) return false;
  return (
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    isFiniteNumber(v.openedAt) &&
    isFiniteNumber(v.lastSeenAt) &&
    isFiniteNumber(v.seed) &&
    isFiniteNumber(v.earned) &&
    v.earned >= 0
  );
}

/** Coerces stored levels into the current upgrade set, clamped to their caps. */
export function normalizeLevels(raw: unknown): UpgradeLevels {
  const levels = emptyLevels();
  if (!isObject(raw)) return levels;
  for (const def of UPGRADES) {
    const value = raw[def.id];
    if (!isFiniteNumber(value)) continue;
    levels[def.id as UpgradeId] = Math.max(0, Math.min(def.maxLevel, Math.floor(value)));
  }
  return levels;
}

export function normalizeProgress(raw: unknown): Progress {
  if (!isObject(raw)) return emptyProgress();
  return {
    banked: isFiniteNumber(raw.banked) ? Math.max(0, raw.banked) : 0,
    spent: isFiniteNumber(raw.spent) ? Math.max(0, raw.spent) : 0,
    levels: normalizeLevels(raw.levels),
  };
}

/** Drops duplicate ids, keeping the record with the freshest heartbeat. */
export function dedupeById(tabs: readonly TabPresence[]): TabPresence[] {
  const best = new Map<string, TabPresence>();
  for (const tab of tabs) {
    const existing = best.get(tab.id);
    if (!existing || tab.lastSeenAt > existing.lastSeenAt) best.set(tab.id, tab);
  }
  return [...best.values()];
}

export class GardenStore {
  private storage: Storage;

  /** True when the real Storage was unusable and we fell back to memory. */
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

  loadTabs(): TabPresence[] {
    const raw = this.read(STORAGE_KEY_TABS);
    if (!Array.isArray(raw)) return [];
    return capTabs(dedupeById(raw.filter(isTabPresence)));
  }

  saveTabs(tabs: readonly TabPresence[]): void {
    const capped = capTabs(dedupeById(tabs));
    if (this.write(STORAGE_KEY_TABS, capped)) return;
    // A full quota is the only realistic failure here. Shed the least recently
    // seen half rather than losing the registry entirely.
    this.write(STORAGE_KEY_TABS, capped.slice(0, Math.max(1, Math.floor(MAX_TABS / 2))));
  }

  loadProgress(): Progress {
    return normalizeProgress(this.read(STORAGE_KEY_PROGRESS));
  }

  saveProgress(progress: Progress): void {
    this.write(STORAGE_KEY_PROGRESS, progress);
  }

  isHintDismissed(): boolean {
    try {
      return this.storage.getItem(STORAGE_KEY_HINT_DISMISSED) === '1';
    } catch {
      return false;
    }
  }

  dismissHint(): void {
    try {
      this.storage.setItem(STORAGE_KEY_HINT_DISMISSED, '1');
    } catch {
      /* a lost preference only re-shows the hint; nothing to recover */
    }
  }
}

function safeAmbientStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Reading localStorage itself throws when storage is blocked by policy.
    return null;
  }
}
