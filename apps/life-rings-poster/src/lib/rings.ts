import { hashSeed, mulberry32 } from './noise';
import type { EventEntry, PosterData, RingModel } from './types';

/**
 * Turn birth year + events into a per-year ring model. Deterministic:
 * the same input always produces the same rings (subtle "weather" jitter
 * on quiet years included).
 */
export function buildRingModel(data: PosterData): RingModel[] {
  const { birthYear, endYear, events } = data;
  if (birthYear === null || !Number.isFinite(birthYear)) return [];

  const clampedEnd = Math.max(endYear, birthYear);
  const eventsByYear = new Map<number, EventEntry[]>();
  for (const ev of events) {
    if (!Number.isFinite(ev.year)) continue;
    const list = eventsByYear.get(ev.year) ?? [];
    list.push(ev);
    eventsByYear.set(ev.year, list);
  }

  const rings: RingModel[] = [];
  const yearSpan = Math.max(1, clampedEnd - birthYear);

  for (let year = birthYear; year <= clampedEnd; year++) {
    const index = year - birthYear;
    const yearEvents = eventsByYear.get(year) ?? [];
    const major = yearEvents.some((e) => e.major);
    const hasEvent = yearEvents.length > 0;

    // Deterministic gentle "growing season" jitter so even quiet years
    // are not perfectly uniform, like a real tree's annual variance.
    const jitterRng = mulberry32(hashSeed(birthYear, 'width', year));
    const seasonJitter = (jitterRng() - 0.5) * 0.3; // -0.15..0.15

    let widthFactor = 1 + seasonJitter;
    let colorFactor = 0.12 + jitterRng() * 0.08;

    if (hasEvent) {
      widthFactor = major ? 1.75 : 1.3;
      widthFactor += seasonJitter * 0.4;
      colorFactor = major ? 0.85 : 0.55;
    }

    // Rings near the pith are naturally a bit wider (juvenile wood grows
    // faster), tapering toward 1x by mid-life — a small realism touch.
    const juvenileBoost = Math.max(0, 1 - index / (yearSpan * 0.35)) * 0.25;
    widthFactor += juvenileBoost;

    let knotAngle: number | undefined;
    if (major) {
      const angleRng = mulberry32(hashSeed(birthYear, 'knot', year, yearEvents[0]?.label ?? ''));
      knotAngle = angleRng() * Math.PI * 2;
    }

    rings.push({
      year,
      index,
      hasEvent,
      major,
      events: yearEvents,
      widthFactor: Math.max(0.35, widthFactor),
      colorFactor: Math.min(1, Math.max(0, colorFactor)),
      knotAngle,
    });
  }

  return rings;
}

/** The 2-4 primary bark-to-pith cracks, derived purely from birth year. */
export function primaryCrackAngles(birthYear: number): number[] {
  const rng = mulberry32(hashSeed(birthYear, 'cracks'));
  const count = 2 + Math.floor(rng() * 3); // 2..4
  const angles: number[] = [];
  const base = rng() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const evenSpread = (Math.PI * 2 * i) / count;
    const jitter = (rng() - 0.5) * 0.6;
    angles.push(base + evenSpread + jitter);
  }
  return angles;
}
