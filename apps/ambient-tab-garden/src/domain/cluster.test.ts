import { describe, expect, test } from 'vitest';
import {
  CLUSTER_DEPTH,
  CLUSTER_RADIUS_MAX,
  CLUSTER_RADIUS_MIN,
  MAX_STAGE,
  PARTICLES_BASE,
  PARTICLES_PER_DENSITY,
  PARTICLES_PER_STAGE,
  STAGE_THRESHOLDS_MS,
} from './constants';
import {
  buildClusterViews,
  clusterHue,
  clusterPosition,
  makeRandom,
  PALETTE,
  particleCountFor,
  stageOf,
} from './cluster';
import { hashSeed } from './presence';
import { emptyLevels } from './upgrades';
import type { TabPresence } from './types';

describe('makeRandom', () => {
  test('produces the same sequence for the same seed', () => {
    const a = makeRandom(12345);
    const b = makeRandom(12345);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  test('produces different sequences for different seeds', () => {
    expect(makeRandom(1)()).not.toBe(makeRandom(2)());
  });

  test('stays within [0, 1)', () => {
    const rnd = makeRandom(hashSeed('sample-tab-id'));
    for (let i = 0; i < 500; i++) {
      const v = rnd();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('does not collapse when seeded with zero', () => {
    const rnd = makeRandom(0);
    const values = [rnd(), rnd(), rnd()];
    expect(new Set(values).size).toBe(3);
  });
});

describe('clusterPosition', () => {
  test('is stable for a given seed', () => {
    expect(clusterPosition(999)).toEqual(clusterPosition(999));
  });

  test('stays inside the annulus and depth budget', () => {
    for (let seed = 1; seed < 400; seed++) {
      const [x, y, z] = clusterPosition(seed);
      const radius = Math.hypot(x, y / 0.62);
      expect(radius).toBeGreaterThanOrEqual(CLUSTER_RADIUS_MIN - 1e-6);
      expect(radius).toBeLessThanOrEqual(CLUSTER_RADIUS_MAX + 1e-6);
      expect(Math.abs(z)).toBeLessThanOrEqual(CLUSTER_DEPTH);
    }
  });

  test('spreads real tab ids around rather than stacking them', () => {
    const points = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => clusterPosition(hashSeed(id)));
    let tooClose = 0;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const d = Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]);
        if (d < 0.9) tooClose++;
      }
    }
    expect(tooClose).toBe(0);
  });
});

describe('clusterHue', () => {
  test('is stable for a given seed and palette size', () => {
    expect(clusterHue(4242, 4)).toEqual(clusterHue(4242, 4));
  });

  test('only uses unlocked hues', () => {
    for (let seed = 1; seed < 200; seed++) {
      expect(PALETTE.slice(0, 2)).toContainEqual(clusterHue(seed, 2));
    }
  });

  test('clamps a nonsense palette size instead of returning undefined', () => {
    expect(clusterHue(7, 0)).toEqual(PALETTE[0]);
    expect(PALETTE).toContainEqual(clusterHue(7, 99));
  });

  test('widening the palette lets new hues appear', () => {
    const narrow = new Set(Array.from({ length: 200 }, (_, i) => clusterHue(i + 1, 2).join()));
    const wide = new Set(Array.from({ length: 200 }, (_, i) => clusterHue(i + 1, 4).join()));
    expect(wide.size).toBeGreaterThan(narrow.size);
  });
});

describe('stageOf', () => {
  test('a brand new tab is stage 0', () => {
    expect(stageOf(0)).toBe(0);
  });

  test('advances exactly at each threshold', () => {
    STAGE_THRESHOLDS_MS.forEach((threshold, i) => {
      expect(stageOf(threshold - 1)).toBe(i);
      expect(stageOf(threshold)).toBe(i + 1);
    });
  });

  test('saturates at the final stage', () => {
    expect(stageOf(365 * 24 * 60 * 60 * 1000)).toBe(MAX_STAGE);
  });
});

describe('particleCountFor', () => {
  test('a new cluster starts at the base count', () => {
    expect(particleCountFor(0, 0)).toBe(PARTICLES_BASE);
  });

  test('grows with stage and with the density upgrade', () => {
    expect(particleCountFor(2, 0)).toBe(PARTICLES_BASE + 2 * PARTICLES_PER_STAGE);
    expect(particleCountFor(0, PARTICLES_PER_DENSITY)).toBe(PARTICLES_BASE + PARTICLES_PER_DENSITY);
  });

  test('clamps nonsense input instead of producing a negative buffer size', () => {
    expect(particleCountFor(-5, -100)).toBe(PARTICLES_BASE);
    expect(particleCountFor(999, 0)).toBe(PARTICLES_BASE + MAX_STAGE * PARTICLES_PER_STAGE);
  });
});

describe('buildClusterViews', () => {
  const tab = (id: string, openedAt: number): TabPresence => ({
    id,
    openedAt,
    lastSeenAt: openedAt,
    seed: hashSeed(id),
    earned: 0,
  });

  test('labels by open order and flags the caller own cluster', () => {
    const views = buildClusterViews([tab('later', 5000), tab('first', 1000)], 'later', emptyLevels(), 6000);
    const self = views.find((v) => v.id === 'later');
    expect(self?.label).toBe('タブB');
    expect(self?.isSelf).toBe(true);
    expect(views.find((v) => v.id === 'first')?.isSelf).toBe(false);
  });

  test('preserves the input order so the renderer can diff by index', () => {
    const views = buildClusterViews([tab('b', 5000), tab('a', 1000)], 'a', emptyLevels(), 6000);
    expect(views.map((v) => v.id)).toEqual(['b', 'a']);
  });

  test('derives age and stage from the open time', () => {
    const now = STAGE_THRESHOLDS_MS[1] + 1000;
    const view = buildClusterViews([tab('a', 0)], 'a', emptyLevels(), now)[0];
    expect(view.ageMs).toBe(now);
    expect(view.stage).toBe(2);
  });

  test('never reports a negative age for a tab opened in the future', () => {
    expect(buildClusterViews([tab('a', 9000)], 'a', emptyLevels(), 1000)[0].ageMs).toBe(0);
  });

  test('applies the density upgrade to every cluster', () => {
    const views = buildClusterViews(
      [tab('a', 0), tab('b', 0)],
      'a',
      { ...emptyLevels(), density: 2 },
      1000,
    );
    for (const v of views) {
      expect(v.particleCount).toBe(PARTICLES_BASE + 2 * PARTICLES_PER_DENSITY);
    }
  });
});
