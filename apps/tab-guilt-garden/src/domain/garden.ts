import { GHOST_TIMEOUT_MS } from './constants';
import type { DeathCause, GraveyardEntry, PlantRecord, SpeciesId } from './types';

/**
 * Pure state transitions for the garden.
 *
 * Cross-tab writes to localStorage are inherently last-write-wins; there is no
 * lock available. Rather than pretending to serialise them, every operation here
 * is written to be *idempotent* and *scoped to the caller's own record*, so that
 * a racing tab can at worst repeat work rather than corrupt it.
 */

export function createPlant(id: string, species: SpeciesId, now: number): PlantRecord {
  return {
    id,
    name: '',
    note: '',
    species,
    plantedAt: now,
    lastFocusAt: now,
    lastHeartbeatAt: now,
  };
}

export function toGraveyardEntry(
  p: PlantRecord,
  now: number,
  cause: DeathCause,
): GraveyardEntry {
  return {
    id: p.id,
    name: p.name,
    note: p.note,
    species: p.species,
    plantedAt: p.plantedAt,
    diedAt: now,
    cause,
    neglectMsAtDeath: Math.max(0, now - p.lastFocusAt),
    lifespanMs: Math.max(0, now - p.plantedAt),
  };
}

/**
 * Replaces only the caller's own record, preserving every other tab's record
 * exactly as read. This is what stops one tab's tick from reverting the name
 * another tab is currently typing (AC-203a).
 */
export function upsertOwn(plants: PlantRecord[], own: PlantRecord): PlantRecord[] {
  let replaced = false;
  const next = plants.map((p) => {
    if (p.id !== own.id) return p;
    replaced = true;
    return own;
  });
  return replaced ? next : [...next, own];
}

/** Drops any plant whose id already has a tombstone (undoes a racing resurrection). */
export function removeBuried(
  plants: PlantRecord[],
  graveyard: GraveyardEntry[],
): PlantRecord[] {
  if (graveyard.length === 0) return plants;
  const buried = new Set(graveyard.map((g) => g.id));
  return plants.filter((p) => !buried.has(p.id));
}

/** Appends tombstones, ignoring any id that is already buried (AC-204a / AC-205a). */
export function buryInto(
  graveyard: GraveyardEntry[],
  entries: GraveyardEntry[],
): { graveyard: GraveyardEntry[]; added: GraveyardEntry[] } {
  if (entries.length === 0) return { graveyard, added: [] };
  const known = new Set(graveyard.map((g) => g.id));
  const added: GraveyardEntry[] = [];
  for (const e of entries) {
    if (known.has(e.id)) continue;
    known.add(e.id);
    added.push(e);
  }
  if (added.length === 0) return { graveyard, added: [] };
  return { graveyard: [...graveyard, ...added], added };
}

/** Removes duplicate tombstones that two tabs may have written concurrently. */
export function dedupeGraveyard(graveyard: GraveyardEntry[]): GraveyardEntry[] {
  const seen = new Set<string>();
  const out: GraveyardEntry[] = [];
  for (const g of graveyard) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    out.push(g);
  }
  return out;
}

export interface SweepResult {
  survivors: PlantRecord[];
  ghosts: PlantRecord[];
}

/**
 * A tab that crashed or was force-quit never gets to bury itself, so its record
 * would otherwise haunt the garden forever. Any *other* tab whose heartbeat has
 * gone silent past the timeout is presumed dead.
 */
export function sweepGhosts(
  plants: PlantRecord[],
  selfId: string,
  now: number,
  timeoutMs: number = GHOST_TIMEOUT_MS,
): SweepResult {
  const survivors: PlantRecord[] = [];
  const ghosts: PlantRecord[] = [];
  for (const p of plants) {
    // Never ghost yourself: your own heartbeat is written by this same tick.
    if (p.id === selfId || now - p.lastHeartbeatAt <= timeoutMs) {
      survivors.push(p);
    } else {
      ghosts.push(p);
    }
  }
  return { survivors, ghosts };
}

/** Applies the caller's own liveness for this tick without touching other tabs. */
export function refreshOwn(
  own: PlantRecord,
  now: number,
  focused: boolean,
): PlantRecord {
  return {
    ...own,
    lastHeartbeatAt: now,
    lastFocusAt: focused ? now : own.lastFocusAt,
  };
}

/** Self first, then oldest first -- keeps card order stable as the garden changes. */
export function orderForDisplay(plants: PlantRecord[], selfId: string): PlantRecord[] {
  return [...plants].sort((a, b) => {
    if (a.id === selfId) return -1;
    if (b.id === selfId) return 1;
    return a.plantedAt - b.plantedAt;
  });
}
