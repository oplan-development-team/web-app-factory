import type { Point } from './geometry';

// All preset stamps are expressed as sparse/ordered vertex lists in
// normalized [-1, 1] space, centered on the scope origin. The geometry
// pipeline's dense arc-length resampling turns straight vertex-to-vertex
// runs into true straight edges (polygons) and fine-angle circle samples
// into a smooth round trace.

export type PresetId = 'circle' | 'star' | 'triangle' | 'square' | 'lissajous';

export const PRESET_LABELS: Record<PresetId, string> = {
  circle: 'CIRCLE',
  star: 'STAR',
  triangle: 'TRIANGLE',
  square: 'SQUARE',
  lissajous: 'LISSAJOUS'
};

function circlePreset(): Point[] {
  const pts: Point[] = [];
  const segments = 128;
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push({ x: Math.cos(t) * 0.82, y: Math.sin(t) * 0.82 });
  }
  return pts;
}

function starPreset(): Point[] {
  const pts: Point[] = [];
  const points = 5;
  const outer = 0.88;
  const inner = 0.36;
  for (let i = 0; i < points * 2; i++) {
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return pts;
}

function trianglePreset(): Point[] {
  const pts: Point[] = [];
  const r = 0.9;
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return pts;
}

function squarePreset(): Point[] {
  const r = 0.72;
  return [
    { x: -r, y: -r },
    { x: r, y: -r },
    { x: r, y: r },
    { x: -r, y: r }
  ];
}

function lissajousPreset(): Point[] {
  const pts: Point[] = [];
  const segments = 256;
  const a = 3;
  const b = 2;
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push({ x: Math.cos(a * t) * 0.85, y: Math.sin(b * t) * 0.85 });
  }
  return pts;
}

export function getPreset(id: PresetId): Point[] {
  switch (id) {
    case 'circle':
      return circlePreset();
    case 'star':
      return starPreset();
    case 'triangle':
      return trianglePreset();
    case 'square':
      return squarePreset();
    case 'lissajous':
      return lissajousPreset();
  }
}
