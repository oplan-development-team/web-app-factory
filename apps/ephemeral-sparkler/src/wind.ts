// Wind/stability mechanic: periodic randomized gusts perturb the ember.
// Holding perfectly still is no longer enough to guarantee a full burn — the
// player must nudge the pointer within the press zone against the gust
// direction to keep an instability meter from maxing out (which drops the
// ember early, same as letting go). Pure logic, no DOM — mirrors how
// sparkler-physics.ts stays independent of rendering.

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface WindState {
  /** Unit-ish push direction scaled by strength; 0,0 when calm. */
  dx: number;
  dy: number;
  /** 0..1 current gust intensity (already scaled by difficulty). */
  strength: number;
  /** Push direction in radians, meaningful even while strength is ~0. */
  angle: number;
}

const GUST_MIN_INTERVAL_S = 2.4;
const GUST_MAX_INTERVAL_S = 4.6;
const GUST_RAMP_S = 0.5;
const GUST_HOLD_MIN_S = 0.6;
const GUST_HOLD_MAX_S = 1.3;

type GustPhase = 'calm' | 'rampUp' | 'hold' | 'rampDown';

/** Generates the raw gust timeline (direction + 0..1 envelope), independent of difficulty scaling. */
export class WindSystem {
  private phase: GustPhase = 'calm';
  private phaseTimer = 0;
  private calmDuration = randRange(GUST_MIN_INTERVAL_S, GUST_MAX_INTERVAL_S);
  private holdDuration = 0;
  private angle = 0;
  private envelope = 0;

  /** @param difficultyScale 0..1 multiplier on gust strength (ramps with burn progress). */
  update(dt: number, difficultyScale: number): WindState {
    this.phaseTimer += dt;

    if (this.phase === 'calm' && this.phaseTimer >= this.calmDuration) {
      this.phase = 'rampUp';
      this.phaseTimer = 0;
      this.angle = Math.random() * Math.PI * 2;
      this.holdDuration = randRange(GUST_HOLD_MIN_S, GUST_HOLD_MAX_S);
    } else if (this.phase === 'rampUp') {
      this.envelope = Math.min(1, this.phaseTimer / GUST_RAMP_S);
      if (this.envelope >= 1) {
        this.phase = 'hold';
        this.phaseTimer = 0;
      }
    } else if (this.phase === 'hold') {
      this.envelope = 1;
      if (this.phaseTimer >= this.holdDuration) {
        this.phase = 'rampDown';
        this.phaseTimer = 0;
      }
    } else if (this.phase === 'rampDown') {
      this.envelope = Math.max(0, 1 - this.phaseTimer / GUST_RAMP_S);
      if (this.envelope <= 0) {
        this.phase = 'calm';
        this.phaseTimer = 0;
        this.calmDuration = randRange(GUST_MIN_INTERVAL_S, GUST_MAX_INTERVAL_S);
      }
    }

    const strength = this.envelope * clamp(difficultyScale, 0, 1);
    return {
      dx: Math.cos(this.angle) * strength,
      dy: Math.sin(this.angle) * strength,
      strength,
      angle: this.angle,
    };
  }
}

const INSTABILITY_MAX = 100;
/** Instability gained per second from a fully-unmitigated (alignment 0), full-strength (1.0) gust. */
const GAIN_PER_SECOND = 70;
/** Instability drained per second while a gust is active and perfectly countered. */
const RECOVERY_WHILE_GUSTING_PER_SECOND = 34;
/**
 * Instability drained per second while calm (no gust at all). Deliberately
 * modest relative to GAIN_PER_SECOND: the calm gap between gusts averages
 * several seconds (see GUST_*_INTERVAL_S below), so a higher value here let
 * a fully passive, never-countering hold heal almost all accumulated danger
 * every cycle in testing — defeating the "holding still isn't enough"
 * requirement. At this value a passive hold still trends toward failure
 * over the course of a burn, while actively countering gusts (which also
 * drains via RECOVERY_WHILE_GUSTING_PER_SECOND) keeps it near zero.
 */
const PASSIVE_RECOVERY_PER_SECOND = 9;
/** Below this normalized pointer-offset magnitude, a "nudge" doesn't count as a deliberate counter. */
const MIN_COUNTER_MAGNITUDE = 0.18;
/** Flat alignment credit given to keyboard/no-pointer holds, which can't aim a counter-nudge. */
const KEYBOARD_LENIENCY_ALIGNMENT = 0.5;

/** Tracks the 0..100 instability meter and decides when the ember should drop early. */
export class StabilityMeter {
  value = 0;

  reset(): void {
    this.value = 0;
  }

  /**
   * @param counterNx,counterNy Pointer offset from the press-zone center, each -1..1.
   * @param hasPointerControl False for keyboard-only holds (no aim available).
   * @returns true once instability has just reached max (ember should drop).
   */
  update(
    dt: number,
    gust: WindState,
    counterNx: number,
    counterNy: number,
    hasPointerControl: boolean,
  ): boolean {
    const wasBelowMax = this.value < INSTABILITY_MAX;

    if (gust.strength < 0.02) {
      this.value = clamp(this.value - PASSIVE_RECOVERY_PER_SECOND * dt, 0, INSTABILITY_MAX);
      return false;
    }

    const gustDirX = Math.cos(gust.angle);
    const gustDirY = Math.sin(gust.angle);
    const idealCounterX = -gustDirX;
    const idealCounterY = -gustDirY;
    const counterMag = Math.hypot(counterNx, counterNy);

    let alignment: number;
    if (counterMag < MIN_COUNTER_MAGNITUDE) {
      alignment = hasPointerControl ? 0 : KEYBOARD_LENIENCY_ALIGNMENT;
    } else {
      const dot = (counterNx / counterMag) * idealCounterX + (counterNy / counterMag) * idealCounterY;
      alignment = clamp(dot, 0, 1);
    }

    const rate =
      GAIN_PER_SECOND * gust.strength * (1 - alignment) -
      RECOVERY_WHILE_GUSTING_PER_SECOND * gust.strength * alignment;
    this.value = clamp(this.value + rate * dt, 0, INSTABILITY_MAX);

    return wasBelowMax && this.value >= INSTABILITY_MAX;
  }
}
