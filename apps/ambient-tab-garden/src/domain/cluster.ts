import {
  CLUSTER_DEPTH,
  CLUSTER_RADIUS_BANDS,
  CLUSTER_RADIUS_MAX,
  CLUSTER_RADIUS_MIN,
  CLUSTER_SECTORS,
  MAX_STAGE,
  PARTICLES_BASE,
  PARTICLES_PER_STAGE,
  STAGE_THRESHOLDS_MS,
} from './constants';
import { assignLabels } from './presence';
import type { ClusterView, TabPresence, UpgradeLevels } from './types';
import { effectsOf } from './upgrades';

const TAU = Math.PI * 2;

/**
 * Hues a cluster can take, in unlock order. The first two are always available;
 * 色域拡張 reveals the rest. Values are the design reference's orb colours.
 */
export const PALETTE: readonly (readonly [number, number, number])[] = [
  [0.851, 0.788, 1.0], // #d9c9ff lavender
  [0.749, 0.827, 1.0], // #bfd3ff periwinkle
  [1.0, 0.839, 0.878], // #ffd6e0 blush
  [1.0, 0.890, 0.761], // #ffe3c2 amber
] as const;

/**
 * xorshift32. Small, fast, and above all *deterministic*: a tab must land in
 * the same place with the same colour on every reload and in every other tab
 * that draws it, from nothing but its id.
 *
 * The first few outputs of a raw xorshift are strongly correlated with the
 * seed, so nearby seeds otherwise produce nearly identical first draws -- which
 * showed up as every cluster picking the same hue. Discarding a short warm-up
 * decorrelates them.
 */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  const step = () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
  for (let i = 0; i < 6; i++) step();
  return step;
}

/**
 * Places a cluster from its seed alone.
 *
 * Deliberately independent of how many tabs are open: a cluster must not slide
 * across the screen just because someone opened another tab. Sectors and radius
 * bands are quantised so that independent seeds still tend to spread out
 * instead of piling into the same spot.
 */
export function clusterPosition(seed: number): [number, number, number] {
  const rnd = makeRandom(seed);
  const sector = Math.floor(rnd() * CLUSTER_SECTORS);
  const band = Math.floor(rnd() * CLUSTER_RADIUS_BANDS);
  const angle = ((sector + rnd() * 0.7 + 0.15) / CLUSTER_SECTORS) * TAU;
  const bandT = (band + rnd() * 0.7 + 0.15) / CLUSTER_RADIUS_BANDS;
  const radius = CLUSTER_RADIUS_MIN + (CLUSTER_RADIUS_MAX - CLUSTER_RADIUS_MIN) * Math.sqrt(bandT);
  return [
    Math.cos(angle) * radius,
    // Flattened, because the viewport is almost always wider than it is tall.
    Math.sin(angle) * radius * 0.62,
    (rnd() * 2 - 1) * CLUSTER_DEPTH,
  ];
}

export function clusterHue(seed: number, paletteSize: number): readonly [number, number, number] {
  const size = Math.max(1, Math.min(PALETTE.length, Math.floor(paletteSize)));
  const rnd = makeRandom(seed ^ 0x5bf03635);
  return PALETTE[Math.floor(rnd() * size) % size];
}

export function stageOf(ageMs: number): number {
  let stage = 0;
  for (const threshold of STAGE_THRESHOLDS_MS) {
    if (ageMs >= threshold) stage += 1;
  }
  return Math.min(stage, MAX_STAGE);
}

export function particleCountFor(stage: number, particleBonus: number): number {
  const clamped = Math.max(0, Math.min(MAX_STAGE, stage));
  return PARTICLES_BASE + clamped * PARTICLES_PER_STAGE + Math.max(0, particleBonus);
}

export function buildClusterViews(
  tabs: readonly TabPresence[],
  selfId: string,
  levels: UpgradeLevels,
  now: number,
): ClusterView[] {
  const effects = effectsOf(levels);
  const labels = assignLabels(tabs);
  return tabs.map((tab) => {
    const ageMs = Math.max(0, now - tab.openedAt);
    const stage = stageOf(ageMs);
    return {
      id: tab.id,
      label: labels.get(tab.id) ?? 'タブ?',
      isSelf: tab.id === selfId,
      stage,
      ageMs,
      particleCount: particleCountFor(stage, effects.particleBonus),
      position: clusterPosition(tab.seed),
      hue: clusterHue(tab.seed, effects.paletteSize),
      seed: tab.seed,
    };
  });
}
