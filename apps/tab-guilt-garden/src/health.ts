import { DEAD_AT, DECAY_MS, GROWTH_MS, WILT_AT } from './constants';
import type { PlantRecord, Stage } from './types';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** 0 (just planted) to 100 (fully aged into bloom), grows regardless of focus. */
export function computeMaturity(plant: PlantRecord, now: number): number {
  const age = now - plant.plantedAt;
  return clamp((age / GROWTH_MS) * 100, 0, 100);
}

/** 100 (just focused) down to 0 (fully neglected), decays only while unfocused. */
export function computeVitality(plant: PlantRecord, now: number): number {
  const neglect = now - plant.lastFocusAt;
  if (neglect <= 0) return 100;
  return clamp(100 - (neglect / DECAY_MS) * 100, 0, 100);
}

export function computeStage(maturity: number, vitality: number): Stage {
  if (vitality <= DEAD_AT) return 'dead';
  if (vitality <= WILT_AT) return 'wilt';
  if (maturity < 33) return 'sprout';
  if (maturity < 75) return 'leaf';
  return 'bloom';
}

export const STAGE_LABEL: Record<Stage, string> = {
  sprout: '発芽',
  leaf: '若葉',
  bloom: '満開',
  wilt: 'しおれ',
  dead: '枯死',
};

/** Max droop rotation in degrees, interpolated continuously by neglect (not just stage). */
export function computeDroopDeg(vitality: number): number {
  const neglectRatio = clamp((100 - vitality) / 100, 0, 1);
  return -(neglectRatio * 22);
}

export function computeScale(vitality: number, maturity: number): number {
  const growthScale = 0.55 + clamp(maturity / 100, 0, 1) * 0.45;
  const wiltShrink = 1 - clamp((100 - vitality) / 100, 0, 1) * 0.25;
  return growthScale * wiltShrink;
}
