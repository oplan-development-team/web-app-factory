import { describe, expect, test } from 'vitest';
import { PARTICLES_PER_DENSITY } from './constants';
import {
  canAfford,
  costAt,
  definitionOf,
  effectsOf,
  emptyLevels,
  emptyProgress,
  purchase,
  UPGRADES,
  viewsOf,
} from './upgrades';
import type { UpgradeId } from './types';

describe('definitions', () => {
  test('exposes five upgrades with unique ids', () => {
    const ids = UPGRADES.map((u) => u.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });

  test('starts every upgrade at level zero', () => {
    expect(emptyProgress()).toEqual({ banked: 0, spent: 0, levels: emptyLevels() });
  });

  test('throws on an unknown id rather than silently returning a default', () => {
    expect(() => definitionOf('nope' as UpgradeId)).toThrow(/unknown upgrade/);
  });

  test('keeps the opening costs shown in the design reference', () => {
    expect(costAt(definitionOf('density'), 0)).toBe(500);
    expect(costAt(definitionOf('orbit'), 0)).toBe(1200);
    expect(costAt(definitionOf('bloom'), 0)).toBe(3000);
  });
});

describe('costAt', () => {
  test('grows geometrically with level', () => {
    const def = definitionOf('density');
    expect(costAt(def, 1)).toBe(1100);
    expect(costAt(def, 2)).toBe(2420);
  });

  test('returns null once the level cap is reached', () => {
    const def = definitionOf('spectrum');
    expect(costAt(def, def.maxLevel)).toBeNull();
    expect(costAt(def, def.maxLevel + 3)).toBeNull();
  });

  test('treats a negative level as level zero', () => {
    const def = definitionOf('density');
    expect(costAt(def, -4)).toBe(def.baseCost);
  });
});

describe('effectsOf', () => {
  test('a fresh browser has no particle bonus and locked orbits', () => {
    const e = effectsOf(emptyLevels());
    expect(e.particleBonus).toBe(0);
    expect(e.orbitStrength).toBe(0);
    expect(e.rateMultiplier).toBe(1);
    expect(e.paletteSize).toBe(2);
  });

  test('density adds a fixed number of particles per level', () => {
    expect(effectsOf({ ...emptyLevels(), density: 3 }).particleBonus).toBe(3 * PARTICLES_PER_DENSITY);
  });

  test('bloom widens and brightens the halo', () => {
    const none = effectsOf(emptyLevels());
    const full = effectsOf({ ...emptyLevels(), bloom: 3 });
    expect(full.haloScale).toBeGreaterThan(none.haloScale);
    expect(full.haloOpacity).toBeGreaterThan(none.haloOpacity);
  });

  test('resonance speeds up accumulation', () => {
    expect(effectsOf({ ...emptyLevels(), resonance: 4 }).rateMultiplier).toBeCloseTo(2.4);
  });

  test('spectrum widens the palette one hue per level', () => {
    expect(effectsOf({ ...emptyLevels(), spectrum: 2 }).paletteSize).toBe(4);
  });
});

describe('purchase', () => {
  test('spends the cost and raises the level', () => {
    const next = purchase(emptyProgress(), 'density', 500);
    expect(next.levels.density).toBe(1);
    expect(next.spent).toBe(500);
  });

  test('refuses when the balance is one short', () => {
    const before = emptyProgress();
    expect(purchase(before, 'density', 499)).toBe(before);
  });

  test('refuses once the upgrade is maxed', () => {
    const maxed = { ...emptyProgress(), levels: { ...emptyLevels(), spectrum: 2 } };
    expect(purchase(maxed, 'spectrum', 1_000_000)).toBe(maxed);
  });

  test('does not mutate the progress it was given', () => {
    const before = emptyProgress();
    purchase(before, 'density', 5000);
    expect(before.levels.density).toBe(0);
    expect(before.spent).toBe(0);
  });

  test('leaves other upgrade levels alone', () => {
    const next = purchase({ ...emptyProgress(), levels: { ...emptyLevels(), orbit: 2 } }, 'density', 500);
    expect(next.levels.orbit).toBe(2);
  });
});

describe('canAfford', () => {
  test('is true exactly at the cost', () => {
    expect(canAfford(emptyProgress(), 'density', 500)).toBe(true);
    expect(canAfford(emptyProgress(), 'density', 499)).toBe(false);
  });

  test('is false for a maxed upgrade regardless of balance', () => {
    const maxed = { ...emptyProgress(), levels: { ...emptyLevels(), spectrum: 2 } };
    expect(canAfford(maxed, 'spectrum', 9_999_999)).toBe(false);
  });
});

describe('viewsOf', () => {
  test('swaps the description for a reason when the balance is short', () => {
    const rows = viewsOf(emptyProgress(), 0);
    const density = rows.find((r) => r.id === 'density');
    expect(density?.affordable).toBe(false);
    expect(density?.description).toBe('きらめきが足りません');
  });

  test('shows the real description once affordable', () => {
    const rows = viewsOf(emptyProgress(), 10_000);
    expect(rows.find((r) => r.id === 'density')?.description).toBe('クラスタあたりの粒子数を増やす');
  });

  test('marks maxed rows with no cost and no purchase', () => {
    const maxed = { ...emptyProgress(), levels: { ...emptyLevels(), spectrum: 2 } };
    const row = viewsOf(maxed, 10_000).find((r) => r.id === 'spectrum');
    expect(row).toMatchObject({ maxed: true, cost: null, affordable: false });
  });

  test('returns one row per upgrade, in definition order', () => {
    expect(viewsOf(emptyProgress(), 0).map((r) => r.id)).toEqual(UPGRADES.map((u) => u.id));
  });
});
