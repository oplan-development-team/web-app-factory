import type { Rng } from './prng.ts';
import { sampleTrochoid, transformPoints, type Point } from './trochoid.ts';

export interface GuillocheLayer {
  /** Points already positioned in note-space (absolute) coordinates. */
  points: Point[];
  /** Base stroke width in note-space units, before the weight slider multiplier. */
  width: number;
  /** Base stroke alpha (0..1), before any zone-level opacity multiplier. */
  alpha: number;
}

function map(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = (v - inMin) / (inMax - inMin);
  return outMin + Math.max(0, Math.min(1, t)) * (outMax - outMin);
}

export interface EngravingSettings {
  /** 0..100 */
  precision: number;
}

export function layerCountFor(precision: number, min = 3, max = 8): number {
  return Math.round(map(precision, 0, 100, min, max));
}

export function samplesPerTurnFor(precision: number, min = 36, max = 190): number {
  return Math.round(map(precision, 0, 100, min, max));
}

/**
 * Build one concentric "rosette" motif — several layered hypotrochoid /
 * epitrochoid curves of shrinking radius sharing a common center. Used for
 * the central medallion, corner denomination rosettes, and (rescaled, then
 * repeated by the caller) the border band motif.
 */
export function buildUnitRosette(
  rng: Rng,
  radius: number,
  layerCount: number,
  samplesPerTurn: number,
  maxPointsPerLayer = 4000
): GuillocheLayer[] {
  const layers: GuillocheLayer[] = [];
  for (let i = 0; i < layerCount; i++) {
    const kind = rng.chance(0.5) ? 'hypo' : 'epi';
    const r = rng.int(3, 12);
    const k = rng.int(2, 9);
    const R = Math.max(r + 1, r * k + rng.int(-1, 1));
    const d = r * rng.range(0.35, 1.25);
    const phase = rng.range(0, Math.PI * 2);

    const raw = sampleTrochoid({
      kind,
      R,
      r,
      d,
      samplesPerTurn,
      phase,
      maxPoints: maxPointsPerLayer,
    });

    let maxExtent = 0;
    for (const p of raw) {
      const dist = Math.hypot(p.x, p.y);
      if (dist > maxExtent) maxExtent = dist;
    }
    if (maxExtent < 1e-6) continue;

    // Successive layers nest inward, each a bit smaller than the last, for
    // the classic layered-guilloche "depth" look rather than N identical
    // rings stacked on top of each other.
    const targetRadius = radius * (1 - i * rng.range(0.06, 0.11)) * rng.range(0.94, 1.0);
    const scale = Math.max(radius * 0.18, targetRadius) / maxExtent;
    const rotate = rng.range(0, Math.PI * 2);

    const points = transformPoints(raw, { scale, rotate, tx: 0, ty: 0 });

    layers.push({
      points,
      width: rng.range(0.55, 1.35),
      alpha: map(i, 0, Math.max(1, layerCount - 1), 0.85, 0.4),
    });
  }
  return layers;
}

/** Translate a layer set (as produced by buildUnitRosette) to an absolute center. */
export function placeRosette(layers: GuillocheLayer[], cx: number, cy: number): GuillocheLayer[] {
  return layers.map((l) => ({
    ...l,
    points: l.points.map((p) => ({ x: p.x + cx, y: p.y + cy })),
  }));
}

/**
 * Build the repeating border band: a small motif tiled at even intervals
 * along a rectangle's perimeter (a continuous reflected repeat, as on real
 * banknote frame borders).
 */
export function buildBorderBand(
  rng: Rng,
  rect: { x0: number; y0: number; x1: number; y1: number },
  bandWidth: number,
  precision: number
): GuillocheLayer[] {
  const layerCount = layerCountFor(precision, 3, 5);
  const samplesPerTurn = samplesPerTurnFor(precision, 24, 90);
  const motifRadius = bandWidth * 0.46;
  const motif = buildUnitRosette(rng, motifRadius, layerCount, samplesPerTurn, 600);

  const { x0, y0, x1, y1 } = rect;
  const spacing = bandWidth * map(precision, 0, 100, 1.7, 1.05);
  const cyTop = y0 + bandWidth / 2;
  const cyBottom = y1 - bandWidth / 2;
  const cxLeft = x0 + bandWidth / 2;
  const cxRight = x1 - bandWidth / 2;

  const out: GuillocheLayer[] = [];
  const stampAt = (cx: number, cy: number) => {
    for (const l of motif) {
      out.push({
        width: l.width,
        alpha: l.alpha,
        points: l.points.map((p) => ({ x: p.x + cx, y: p.y + cy })),
      });
    }
  };

  const nHoriz = Math.max(2, Math.round((x1 - x0) / spacing));
  const nVert = Math.max(2, Math.round((y1 - y0) / spacing));

  for (let i = 0; i <= nHoriz; i++) {
    const cx = x0 + (i / nHoriz) * (x1 - x0);
    stampAt(cx, cyTop);
    stampAt(cx, cyBottom);
  }
  for (let i = 1; i < nVert; i++) {
    const cy = y0 + (i / nVert) * (y1 - y0);
    stampAt(cxLeft, cy);
    stampAt(cxRight, cy);
  }

  return out;
}

/**
 * Build the faint full-field tint pattern: a handful of very large, thin,
 * low-alpha trochoid curves whose arcs sweep through the content rectangle,
 * producing an "engine turning" moiré field to sit under all text.
 */
export function buildTintField(
  rng: Rng,
  rect: { x0: number; y0: number; x1: number; y1: number },
  precision: number
): GuillocheLayer[] {
  const layerCount = layerCountFor(precision, 4, 7);
  const samplesPerTurn = samplesPerTurnFor(precision, 30, 110);
  const cx = (rect.x0 + rect.x1) / 2;
  const cy = (rect.y0 + rect.y1) / 2;
  const spanRadius = Math.hypot(rect.x1 - rect.x0, rect.y1 - rect.y0) * 0.5;

  const layers: GuillocheLayer[] = [];
  for (let i = 0; i < layerCount; i++) {
    const kind = rng.chance(0.5) ? 'hypo' : 'epi';
    const r = rng.int(6, 16);
    const k = rng.int(3, 11);
    const R = r * k + rng.int(-2, 2);
    const d = r * rng.range(0.5, 1.1);
    const phase = rng.range(0, Math.PI * 2);
    const raw = sampleTrochoid({ kind, R, r, d, samplesPerTurn, phase, maxPoints: 5000 });

    let maxExtent = 0;
    for (const p of raw) {
      const dist = Math.hypot(p.x, p.y);
      if (dist > maxExtent) maxExtent = dist;
    }
    if (maxExtent < 1e-6) continue;

    const jitterX = rng.range(-spanRadius * 0.12, spanRadius * 0.12);
    const jitterY = rng.range(-spanRadius * 0.12, spanRadius * 0.12);
    const scale = (spanRadius * rng.range(0.62, 0.98)) / maxExtent;
    const rotate = rng.range(0, Math.PI * 2);

    const points = transformPoints(raw, { scale, rotate, tx: cx + jitterX, ty: cy + jitterY });
    layers.push({ points, width: rng.range(0.35, 0.6), alpha: rng.range(0.06, 0.16) });
  }
  return layers;
}
