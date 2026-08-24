import { clamp, lerp } from "./geometry";

/** Ribbon width in poster-space px at the slowest / fastest end of the mapping (FR-003.2). */
export const MAX_RIBBON_WIDTH = 34;
export const MIN_RIBBON_WIDTH = 5;

const MAX_ALPHA = 0.95;
const MIN_ALPHA = 0.38;
const MAX_GLOW = 1;
const MIN_GLOW = 0.35;

/** Saturation speed (poster px/ms) at each end of the response slider (FR-013.2). */
const CALM_MAX_SPEED = 3.2;
const VOLATILE_MAX_SPEED = 0.8;

export const DEFAULT_RESPONSE = 50;

export const RESPONSE_LABELS = {
  calm: "Calm",
  balanced: "Balanced",
  volatile: "Volatile",
} as const;

export interface RibbonMetrics {
  /** Stroke width in poster-space px. */
  readonly width: number;
  /** Core opacity, 0..1. */
  readonly alpha: number;
  /** Relative contribution to the bloom layer, 0..1. */
  readonly glow: number;
}

/**
 * Response 0..100 → the speed at which the width/glow mapping saturates.
 * A low response spreads the mapping over a wide speed range, so most of a
 * signature reads as "slow" and the ribbon stays thick and even. A high response
 * saturates almost immediately, so small speed differences carve deep contrast.
 */
export function responseToMaxSpeed(response: number): number {
  const t = clamp(response, 0, 100) / 100;
  return lerp(CALM_MAX_SPEED, VOLATILE_MAX_SPEED, t);
}

export function responseLabel(response: number): string {
  const value = clamp(response, 0, 100);
  if (value < 34) {
    return RESPONSE_LABELS.calm;
  }
  if (value > 66) {
    return RESPONSE_LABELS.volatile;
  }
  return RESPONSE_LABELS.balanced;
}

/**
 * The core of the app: slower pointer movement reads as a thicker, denser and
 * brighter ribbon; faster movement thins and dims it (FR-003.5).
 */
export function metricsForSpeed(speed: number, maxSpeed: number): RibbonMetrics {
  const ratio = Number.isFinite(speed) && maxSpeed > 0 ? speed / maxSpeed : 1;
  const speedNorm = Number.isFinite(ratio) ? clamp(ratio, 0, 1) : 1;

  return {
    width: lerp(MAX_RIBBON_WIDTH, MIN_RIBBON_WIDTH, speedNorm),
    alpha: lerp(MAX_ALPHA, MIN_ALPHA, speedNorm),
    glow: lerp(MAX_GLOW, MIN_GLOW, speedNorm),
  };
}
