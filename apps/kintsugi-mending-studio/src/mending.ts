import type { CrackSegment } from './types';

export interface ScheduledSegment {
  seg: CrackSegment;
  tStart: number;
  tEnd: number;
}

/**
 * Orders segments trunk-first (shallow depth before fine capillaries) and
 * assigns each a [tStart, tEnd] window proportional to its own length, so
 * the gold trace animates at a roughly constant "flow speed" rather than
 * spending equal time on a tiny hairline and a long trunk crack.
 */
export function scheduleSegments(segments: CrackSegment[]): ScheduledSegment[] {
  const ordered = [...segments].sort((a, b) => a.depth - b.depth || a.originId - b.originId);
  const total = ordered.reduce((s, seg) => s + seg.length, 0) || 1;
  let acc = 0;
  return ordered.map((seg) => {
    const tStart = acc / total;
    acc += seg.length;
    const tEnd = acc / total;
    return { seg, tStart, tEnd };
  });
}

export function durationForSegmentCount(count: number): number {
  const base = Math.min(4000, Math.max(2200, 1700 + count * 110));
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // Still animate (the gold trace is the app's core payoff, not decoration),
  // but keep it brief for users who asked for reduced motion.
  return reducedMotion ? 500 : base;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Builds a progress map (segment -> 0..1) for the given elapsed fraction. */
export function progressAt(schedule: ScheduledSegment[], rawFraction: number): Map<CrackSegment, number> {
  const f = easeInOutCubic(Math.min(1, Math.max(0, rawFraction)));
  const map = new Map<CrackSegment, number>();
  for (const { seg, tStart, tEnd } of schedule) {
    if (f <= tStart) {
      map.set(seg, 0);
    } else if (f >= tEnd) {
      map.set(seg, 1);
    } else {
      map.set(seg, (f - tStart) / (tEnd - tStart || 1));
    }
  }
  return map;
}
