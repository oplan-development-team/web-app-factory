import {
  DEAD_AT,
  DECAY_MS,
  FOSSIL_AT_MS,
  GROWTH_MS,
  HUSK_AT_MS,
  WILT_AT,
} from './constants';
import type { PlantRecord, Stage } from './types';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Real ms this plant has gone unfocused. Never negative, even if the clock jumps back. */
export function computeNeglectMs(plant: PlantRecord, now: number): number {
  return Math.max(0, now - plant.lastFocusAt);
}

/** 0 (just planted) to 100 (fully aged into bloom), grows regardless of focus. */
export function computeMaturity(plant: PlantRecord, now: number): number {
  const age = now - plant.plantedAt;
  if (!Number.isFinite(age)) return 0;
  return clamp((age / GROWTH_MS) * 100, 0, 100);
}

/** 100 (just focused) down to 0 (fully neglected), decays only while unfocused. */
export function computeVitality(plant: PlantRecord, now: number): number {
  const neglect = now - plant.lastFocusAt;
  if (!Number.isFinite(neglect) || neglect <= 0) return 100;
  return clamp(100 - (neglect / DECAY_MS) * 100, 0, 100);
}

/**
 * Stages past `dead` are driven by raw neglect rather than vitality, because
 * vitality bottoms out at 0 and stops carrying information. Evaluated worst-first.
 */
export function computeStage(maturity: number, vitality: number, neglectMs: number): Stage {
  if (neglectMs > FOSSIL_AT_MS) return 'fossil';
  if (neglectMs > HUSK_AT_MS) return 'husk';
  if (vitality <= DEAD_AT) return 'dead';
  if (vitality <= WILT_AT) return 'wilt';
  if (maturity < 33) return 'sprout';
  if (maturity < 75) return 'leaf';
  return 'bloom';
}

/** Convenience wrapper: everything a view needs about one plant at one instant. */
export function describePlant(plant: PlantRecord, now: number) {
  const maturity = computeMaturity(plant, now);
  const vitality = computeVitality(plant, now);
  const neglectMs = computeNeglectMs(plant, now);
  return {
    maturity,
    vitality,
    neglectMs,
    stage: computeStage(maturity, vitality, neglectMs),
  };
}

export const STAGE_LABEL: Record<Stage, string> = {
  sprout: '発芽',
  leaf: '若葉',
  bloom: '満開',
  wilt: 'しおれ',
  dead: '枯死',
  husk: '立ち枯れ',
  fossil: '化石化',
};

/** Short jab shown under the stage badge -- the self-mockery, in one line. */
export const STAGE_TAUNT: Record<Stage, string> = {
  sprout: '芽が出た。まだ間に合う。',
  leaf: '順調。見ているうちは。',
  bloom: '満開。今が一番いい時。',
  wilt: 'しおれてきた。戻れば助かる。',
  dead: '枯れた。まだ閉じてはいない。',
  husk: '立ち枯れ。もう形だけが残っている。',
  fossil: '化石化。地層の一部になった。',
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
