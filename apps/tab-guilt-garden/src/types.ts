export type SpeciesId = 'flower' | 'cactus' | 'mushroom' | 'tree';

export type Stage = 'sprout' | 'leaf' | 'bloom' | 'wilt' | 'dead';

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

export interface GardenState {
  plants: PlantRecord[];
  graveyard: GraveyardEntry[];
}

export type ChannelMessage =
  | { type: 'planted'; id: string }
  | { type: 'heartbeat'; id: string }
  | { type: 'closed'; id: string }
  | { type: 'reset' };
