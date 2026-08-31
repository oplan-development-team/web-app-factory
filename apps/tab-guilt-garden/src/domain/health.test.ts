import { describe, expect, test } from 'vitest';
import {
  DEAD_AT,
  DECAY_MS,
  FOSSIL_AT_MS,
  GROWTH_MS,
  HUSK_AT_MS,
  WILT_AT,
} from './constants';
import {
  computeDroopDeg,
  computeMaturity,
  computeNeglectMs,
  computeScale,
  computeStage,
  computeVitality,
  describePlant,
  STAGE_LABEL,
  STAGE_TAUNT,
} from './health';
import type { PlantRecord, Stage } from './types';

const T0 = 1_700_000_000_000;

function plant(overrides: Partial<PlantRecord> = {}): PlantRecord {
  return {
    id: 'p1',
    name: '',
    note: '',
    species: 'flower',
    plantedAt: T0,
    lastFocusAt: T0,
    lastHeartbeatAt: T0,
    ...overrides,
  };
}

describe('computeMaturity', () => {
  test('starts at 0 the instant it is planted', () => {
    expect(computeMaturity(plant(), T0)).toBe(0);
  });

  test('reaches 100 exactly at GROWTH_MS and stays capped', () => {
    expect(computeMaturity(plant(), T0 + GROWTH_MS)).toBe(100);
    expect(computeMaturity(plant(), T0 + GROWTH_MS * 10)).toBe(100);
  });

  test('grows regardless of focus (half-way at half GROWTH_MS)', () => {
    expect(computeMaturity(plant(), T0 + GROWTH_MS / 2)).toBeCloseTo(50, 5);
  });

  test('clamps to 0 when the clock runs backwards (E-10)', () => {
    expect(computeMaturity(plant(), T0 - 60_000)).toBe(0);
  });
});

describe('computeVitality', () => {
  test('is full while focused', () => {
    expect(computeVitality(plant(), T0)).toBe(100);
  });

  test('decays linearly to 0 across DECAY_MS', () => {
    expect(computeVitality(plant(), T0 + DECAY_MS / 2)).toBeCloseTo(50, 5);
    expect(computeVitality(plant(), T0 + DECAY_MS)).toBe(0);
  });

  test('does not go below 0 no matter how long the neglect', () => {
    expect(computeVitality(plant(), T0 + DECAY_MS * 100)).toBe(0);
  });

  test('recovers fully when focus returns (AC-102a)', () => {
    const neglected = plant({ lastFocusAt: T0 });
    const later = T0 + DECAY_MS * 0.9;
    expect(computeVitality(neglected, later)).toBeLessThan(20);
    // Focusing rewrites lastFocusAt to "now"; vitality must snap back to full.
    const refocused = plant({ lastFocusAt: later });
    expect(computeVitality(refocused, later)).toBe(100);
  });

  test('never returns NaN or >100 when the clock runs backwards (AC-102b)', () => {
    const v = computeVitality(plant(), T0 - 999_999);
    expect(Number.isNaN(v)).toBe(false);
    expect(v).toBe(100);
  });
});

describe('computeNeglectMs', () => {
  test('measures real unfocused time', () => {
    expect(computeNeglectMs(plant(), T0 + 5000)).toBe(5000);
  });

  test('floors at zero for a backwards clock (E-10)', () => {
    expect(computeNeglectMs(plant(), T0 - 5000)).toBe(0);
  });
});

describe('computeStage', () => {
  const cases: Array<[string, number, number, number, Stage]> = [
    ['fresh sprout', 10, 100, 0, 'sprout'],
    ['sprout upper boundary', 32.9, 100, 0, 'sprout'],
    ['leaf lower boundary', 33, 100, 0, 'leaf'],
    ['leaf upper boundary', 74.9, 100, 0, 'leaf'],
    ['bloom lower boundary', 75, 100, 0, 'bloom'],
    ['fully grown bloom', 100, 100, 0, 'bloom'],
    ['wilt at threshold', 100, WILT_AT, DECAY_MS / 2, 'wilt'],
    ['dead at threshold', 100, DEAD_AT, DECAY_MS, 'dead'],
  ];

  test.each(cases)('%s', (_label, maturity, vitality, neglect, expected) => {
    expect(computeStage(maturity, vitality, neglect)).toBe(expected);
  });

  test('progresses dead -> husk -> fossil purely on neglect time (AC-103a)', () => {
    expect(computeStage(100, 0, DECAY_MS)).toBe('dead');
    expect(computeStage(100, 0, HUSK_AT_MS + 1)).toBe('husk');
    expect(computeStage(100, 0, FOSSIL_AT_MS + 1)).toBe('fossil');
  });

  test('husk/fossil boundaries are exclusive', () => {
    expect(computeStage(100, 0, HUSK_AT_MS)).toBe('dead');
    expect(computeStage(100, 0, FOSSIL_AT_MS)).toBe('husk');
  });

  test('a fossil recovers when focus returns (AC-103b)', () => {
    // Refocusing zeroes neglect and restores vitality, so the late stages
    // must not be sticky.
    expect(computeStage(100, 100, 0)).toBe('bloom');
  });
});

describe('describePlant', () => {
  test('bundles the whole instantaneous view of a plant', () => {
    const d = describePlant(plant(), T0 + GROWTH_MS);
    expect(d).toEqual({
      maturity: 100,
      vitality: expect.any(Number),
      neglectMs: GROWTH_MS,
      stage: expect.any(String),
    });
  });

  test('reports a long-neglected plant as fossil', () => {
    expect(describePlant(plant(), T0 + FOSSIL_AT_MS + 1000).stage).toBe('fossil');
  });
});

describe('stage copy', () => {
  const stages: Stage[] = ['sprout', 'leaf', 'bloom', 'wilt', 'dead', 'husk', 'fossil'];

  test('every stage has a label and a taunt (no blank UI)', () => {
    for (const s of stages) {
      expect(STAGE_LABEL[s]?.length).toBeGreaterThan(0);
      expect(STAGE_TAUNT[s]?.length).toBeGreaterThan(0);
    }
  });
});

describe('visual interpolation', () => {
  test('droop deepens continuously as vitality falls', () => {
    expect(computeDroopDeg(100)).toBe(-0);
    expect(computeDroopDeg(50)).toBeCloseTo(-11, 5);
    expect(computeDroopDeg(0)).toBeCloseTo(-22, 5);
  });

  test('droop stays within bounds for out-of-range vitality', () => {
    expect(computeDroopDeg(140)).toBe(-0);
    expect(computeDroopDeg(-40)).toBeCloseTo(-22, 5);
  });

  test('scale grows with maturity and shrinks with neglect', () => {
    const young = computeScale(100, 0);
    const grown = computeScale(100, 100);
    expect(grown).toBeGreaterThan(young);
    expect(computeScale(0, 100)).toBeLessThan(grown);
  });

  test('scale never collapses to zero or inverts', () => {
    expect(computeScale(0, 0)).toBeGreaterThan(0);
    expect(computeScale(-50, -50)).toBeGreaterThan(0);
  });
});
