import { contours as contourGenerator, type ContourMultiPolygon } from 'd3-contour';
import { ART_H, ART_W, GRID_H, GRID_W } from './constants';
import type { ContourBand, TraceResult } from '../types';

/**
 * Slices the luminance grid into `lineCount` equally-spaced elevation
 * thresholds (a fixed contour interval, as on a real topographic sheet) and
 * runs marching squares (d3-contour) at each one. Each threshold's ring
 * boundary IS the isoline at that elevation, so stroking the ring with
 * fill:none renders a single contour line rather than a filled band.
 */
export function traceContours(grid: Float32Array, lineCount: number, invert: boolean): TraceResult {
  const values = invert ? invertGrid(grid) : grid;

  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < 1e-3) {
    return { bands: [], gridWidth: GRID_W, gridHeight: GRID_H, min: 0, max: 0, contourInterval: 0 };
  }

  const interval = (max - min) / (lineCount + 1);
  const thresholds: number[] = [];
  for (let i = 1; i <= lineCount; i++) {
    thresholds.push(min + interval * i);
  }

  const generator = contourGenerator().size([GRID_W, GRID_H]).thresholds(thresholds);
  const features = generator(values);

  const scaleX = ART_W / GRID_W;
  const scaleY = ART_H / GRID_H;

  const bands: ContourBand[] = features.map((feature, i) => ({
    t: lineCount === 1 ? 0 : i / (lineCount - 1),
    threshold: feature.value,
    path: featureToPath(feature, scaleX, scaleY),
  }));

  return { bands, gridWidth: GRID_W, gridHeight: GRID_H, min, max, contourInterval: interval };
}

function invertGrid(grid: Float32Array): Float32Array {
  const out = new Float32Array(grid.length);
  for (let i = 0; i < grid.length; i++) out[i] = 255 - grid[i];
  return out;
}

function featureToPath(feature: ContourMultiPolygon, scaleX: number, scaleY: number): string {
  let d = '';
  for (const polygon of feature.coordinates) {
    for (const ring of polygon) {
      if (ring.length < 2) continue;
      d += `M${fmt(ring[0][0] * scaleX)},${fmt(ring[0][1] * scaleY)}`;
      for (let i = 1; i < ring.length; i++) {
        d += `L${fmt(ring[i][0] * scaleX)},${fmt(ring[i][1] * scaleY)}`;
      }
      d += 'Z';
    }
  }
  return d;
}

function fmt(n: number): string {
  return Math.round(n * 100) / 100 + '';
}
