export type SpeciesId = 'flower' | 'cactus' | 'mushroom' | 'tree';

export type Stage = 'sprout' | 'leaf' | 'bloom' | 'wilt' | 'dead' | 'husk' | 'fossil';

export type DeathCause = 'closed' | 'ghost';

/** A living tab, represented as a plant in the garden. */
export interface PlantRecord {
  id: string;
  name: string;
  note: string;
  species: SpeciesId;
  plantedAt: number;
  /** Timestamp of the last moment this tab was focused/visible. Frozen while unfocused. */
  lastFocusAt: number;
  /** Timestamp of the last liveness signal from this tab's own process. */
  lastHeartbeatAt: number;
}

/** A closed tab's memorial entry. */
export interface GraveyardEntry {
  id: string;
  name: string;
  note: string;
  species: SpeciesId;
  plantedAt: number;
  diedAt: number;
  cause: DeathCause;
  /** now - lastFocusAt at time of death (real ms, not display-scaled). */
  neglectMsAtDeath: number;
  /** diedAt - plantedAt (real ms). */
  lifespanMs: number;
}

/**
 * Totals that deliberately survive "庭を焼き払う". The idle-game payoff depends on
 * some number always going up, so burning the garden resets the *plot* but never
 * the record of what you have already done to it.
 */
export interface LifetimeLedger {
  totalPlanted: number;
  totalBuried: number;
  /** Real ms, not display-scaled. */
  longestNeglectMs: number;
  /** Real ms, not display-scaled. */
  longestLifespanMs: number;
  peakAlive: number;
  burnCount: number;
  firstPlantedAt: number | null;
  unlocked: string[];
}

export interface GardenState {
  plants: PlantRecord[];
  graveyard: GraveyardEntry[];
}

export type ChannelMessage =
  | { type: 'planted'; id: string }
  | { type: 'heartbeat'; id: string }
  /** Carries the id of the plant that was buried -- not the id of the sender. */
  | { type: 'buried'; id: string }
  | { type: 'reset' };
