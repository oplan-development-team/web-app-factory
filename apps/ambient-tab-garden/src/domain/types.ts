export type UpgradeId = 'density' | 'orbit' | 'bloom' | 'resonance' | 'spectrum';

export type UpgradeLevels = Record<UpgradeId, number>;

/**
 * One open tab, as seen by every other tab through localStorage.
 *
 * A tab only ever writes its own record. Everything here is either fixed at
 * open time or monotonically advanced by that tab alone, which is what makes
 * last-write-wins safe across tabs.
 */
export interface TabPresence {
  readonly id: string;
  /** Wall-clock ms when this tab first opened (survives reloads). */
  readonly openedAt: number;
  /** Wall-clock ms of this tab's most recent heartbeat. */
  readonly lastSeenAt: number;
  /** Deterministic 32-bit seed derived from `id`; drives position and hue. */
  readonly seed: number;
  /** きらめき this tab has accumulated so far, integrated over real time. */
  readonly earned: number;
}

export interface Progress {
  /** きらめき inherited from tabs that have since closed. */
  readonly banked: number;
  /** Total きらめき spent on upgrades. */
  readonly spent: number;
  readonly levels: UpgradeLevels;
}

export interface UpgradeDef {
  readonly id: UpgradeId;
  readonly name: string;
  readonly description: string;
  readonly maxLevel: number;
  readonly baseCost: number;
  readonly costGrowth: number;
}

export interface UpgradeView {
  readonly id: UpgradeId;
  readonly name: string;
  /** Either the upgrade's description, or why it cannot be bought right now. */
  readonly description: string;
  readonly level: number;
  readonly maxLevel: number;
  readonly maxed: boolean;
  readonly cost: number | null;
  readonly affordable: boolean;
}

/** Everything the renderer needs about one cluster, derived from a TabPresence. */
export interface ClusterView {
  readonly id: string;
  /** Display name: タブA, タブB ... assigned by open order. */
  readonly label: string;
  readonly isSelf: boolean;
  readonly stage: number;
  readonly ageMs: number;
  readonly particleCount: number;
  readonly position: readonly [number, number, number];
  readonly hue: readonly [number, number, number];
  readonly seed: number;
}

export type ChannelMessage =
  | { readonly kind: 'joined'; readonly id: string }
  | { readonly kind: 'left'; readonly id: string }
  | { readonly kind: 'progress' };
