import { PARTICLES_PER_DENSITY } from './constants';
import type { Progress, UpgradeDef, UpgradeId, UpgradeLevels, UpgradeView } from './types';

/**
 * Upgrades are global to the browser, not per tab.
 *
 * A tab is ephemeral -- it can be closed by accident at any moment -- so
 * anything bought with accumulated きらめき has to outlive it, otherwise the
 * only sane strategy would be "never close a tab", which is the opposite of a
 * calm ambient object.
 */
export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'density',
    name: '粒子密度',
    description: 'クラスタあたりの粒子数を増やす',
    maxLevel: 4,
    baseCost: 500,
    costGrowth: 2.2,
  },
  {
    id: 'orbit',
    name: '軌道エフェクト',
    description: '粒子がゆるく周回するようになる',
    maxLevel: 3,
    baseCost: 1200,
    costGrowth: 2.4,
  },
  {
    id: 'bloom',
    name: '発光強化',
    description: '光のにじみを強く、広くする',
    maxLevel: 3,
    baseCost: 3000,
    costGrowth: 2.4,
  },
  {
    id: 'resonance',
    name: '共鳴',
    description: 'きらめきの貯まる速度が上がる',
    maxLevel: 4,
    baseCost: 800,
    costGrowth: 2.6,
  },
  {
    id: 'spectrum',
    name: '色域拡張',
    description: 'クラスタが帯びる色相が増える',
    maxLevel: 2,
    baseCost: 2000,
    costGrowth: 3,
  },
] as const;

const BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

export function emptyLevels(): UpgradeLevels {
  return { density: 0, orbit: 0, bloom: 0, resonance: 0, spectrum: 0 };
}

export function emptyProgress(): Progress {
  return { banked: 0, spent: 0, levels: emptyLevels() };
}

export function definitionOf(id: UpgradeId): UpgradeDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`unknown upgrade: ${id}`);
  return def;
}

/** Geometric cost curve, rounded to a readable figure. Null once maxed out. */
export function costAt(def: UpgradeDef, level: number): number | null {
  if (level >= def.maxLevel) return null;
  const raw = def.baseCost * Math.pow(def.costGrowth, Math.max(0, level));
  return Math.round(raw / 10) * 10;
}

export interface UpgradeEffects {
  readonly particleBonus: number;
  /** 0 means orbital motion is still locked. */
  readonly orbitStrength: number;
  readonly haloScale: number;
  readonly haloOpacity: number;
  readonly rateMultiplier: number;
  /** How many hues the cluster palette may draw from. */
  readonly paletteSize: number;
}

export function effectsOf(levels: UpgradeLevels): UpgradeEffects {
  return {
    particleBonus: levels.density * PARTICLES_PER_DENSITY,
    orbitStrength: levels.orbit,
    haloScale: 1 + levels.bloom * 0.42,
    haloOpacity: 0.16 + levels.bloom * 0.085,
    rateMultiplier: 1 + levels.resonance * 0.35,
    paletteSize: 2 + levels.spectrum,
  };
}

export function canAfford(progress: Progress, id: UpgradeId, balance: number): boolean {
  const cost = costAt(definitionOf(id), progress.levels[id]);
  return cost !== null && balance >= cost;
}

/**
 * Returns the progress after buying, or the original object when the purchase
 * is not allowed. Callers re-read the shared state immediately before calling
 * this, so an affordability check that passed a second ago cannot let a tab
 * overdraw the shared balance.
 */
export function purchase(progress: Progress, id: UpgradeId, balance: number): Progress {
  const def = definitionOf(id);
  const level = progress.levels[id];
  const cost = costAt(def, level);
  if (cost === null || balance < cost) return progress;
  return {
    ...progress,
    spent: progress.spent + cost,
    levels: { ...progress.levels, [id]: level + 1 },
  };
}

/** Everything the upgrade panel needs to render one row. */
export function viewsOf(progress: Progress, balance: number): UpgradeView[] {
  return UPGRADES.map((def) => {
    const level = progress.levels[def.id];
    const cost = costAt(def, level);
    const maxed = cost === null;
    const affordable = !maxed && balance >= cost;
    return {
      id: def.id,
      name: def.name,
      description: maxed ? '最大まで育っています' : affordable ? def.description : 'きらめきが足りません',
      level,
      maxLevel: def.maxLevel,
      maxed,
      cost,
      affordable,
    };
  });
}
