import type { Layer } from './types';

/**
 * Shared geometry-generation module. Both the Canvas 2D renderer and the SVG
 * exporter call these functions so the live preview and the vector export
 * are structurally identical (same primitives, same coordinates) — only the
 * rendering target differs.
 */

export interface LineGeom {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DotGeom {
  kind: 'dot';
  cx: number;
  cy: number;
  r: number;
}

export interface RingGeom {
  kind: 'ring';
  cx: number;
  cy: number;
  r: number;
}

export type Geom = LineGeom | DotGeom | RingGeom;

const DEG2RAD = Math.PI / 180;

/** A field of parallel lines, spaced `spacing` apart, rotated by `rotation` degrees,
 * generated wide enough to always cover the full canvas regardless of angle. */
function buildLines(layer: Layer, size: number): LineGeom[] {
  const spacing = Math.max(layer.spacing, 2);
  const diagonal = Math.sqrt(size * size + size * size);
  const half = diagonal; // over-generate so rotated lines still cover corners
  const cx = size / 2;
  const cy = size / 2;
  const angle = layer.rotation * DEG2RAD;
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const perp = { x: -Math.sin(angle), y: Math.cos(angle) };
  const count = Math.ceil(half / spacing);

  const lines: LineGeom[] = [];
  for (let i = -count; i <= count; i += 1) {
    const offset = i * spacing;
    const ox = cx + perp.x * offset;
    const oy = cy + perp.y * offset;
    lines.push({
      kind: 'line',
      x1: ox - dir.x * half,
      y1: oy - dir.y * half,
      x2: ox + dir.x * half,
      y2: oy + dir.y * half,
    });
  }
  return lines;
}

/** A rotated square grid of dots. */
function buildDots(layer: Layer, size: number): DotGeom[] {
  const spacing = Math.max(layer.spacing, 4);
  const r = Math.max(layer.thickness / 2, 0.5);
  const cx = size / 2;
  const cy = size / 2;
  const diagonal = Math.sqrt(size * size + size * size) / 2 + spacing;
  const angle = layer.rotation * DEG2RAD;
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const perp = { x: -Math.sin(angle), y: Math.cos(angle) };
  const count = Math.ceil(diagonal / spacing) + 1;

  const dots: DotGeom[] = [];
  for (let i = -count; i <= count; i += 1) {
    for (let j = -count; j <= count; j += 1) {
      const px = cx + dir.x * i * spacing + perp.x * j * spacing;
      const py = cy + dir.y * i * spacing + perp.y * j * spacing;
      if (px < -r || py < -r || px > size + r || py > size + r) continue;
      dots.push({ kind: 'dot', cx: px, cy: py, r });
    }
  }
  return dots;
}

/** Concentric rings. `rotation` is repurposed as the angle of a small center
 * offset (proportional to spacing) — this is what produces the classic
 * "two offset circle grids" moiré interference when two circle layers with
 * different rotation values are stacked. */
function buildCircles(layer: Layer, size: number): RingGeom[] {
  const spacing = Math.max(layer.spacing, 4);
  const angle = layer.rotation * DEG2RAD;
  const offsetRadius = spacing * 0.35;
  const cx = size / 2 + Math.cos(angle) * offsetRadius;
  const cy = size / 2 + Math.sin(angle) * offsetRadius;
  const maxR = Math.sqrt(size * size + size * size) / 2 + offsetRadius + spacing;
  const count = Math.ceil(maxR / spacing);

  const rings: RingGeom[] = [];
  for (let k = 1; k <= count; k += 1) {
    rings.push({ kind: 'ring', cx, cy, r: k * spacing });
  }
  return rings;
}

export function buildGeometry(layer: Layer, size: number): Geom[] {
  switch (layer.type) {
    case 'lines':
      return buildLines(layer, size);
    case 'dots':
      return buildDots(layer, size);
    case 'circles':
      return buildCircles(layer, size);
    default:
      return [];
  }
}

/** Contextual labels: the same five sliders mean slightly different things
 * depending on the pattern type, so the panel should say so. */
export function fieldLabels(type: Layer['type']): {
  rotation: string;
  spacing: string;
  thickness: string;
} {
  switch (type) {
    case 'lines':
      return { rotation: 'ROTATION', spacing: 'SPACING', thickness: 'LINE WEIGHT' };
    case 'dots':
      return { rotation: 'ROTATION', spacing: 'GRID SPACING', thickness: 'DOT RADIUS' };
    case 'circles':
      return { rotation: 'OFFSET ANGLE', spacing: 'RING SPACING', thickness: 'RING WEIGHT' };
    default:
      return { rotation: 'ROTATION', spacing: 'SPACING', thickness: 'WEIGHT' };
  }
}
