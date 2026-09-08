import type { Cut, EdgeId, NotchCut, Point, SemicircleCut, TriangleCut, WaveCut } from './types';
import { NOTCH_SIZES, WEDGE_RADIUS } from './types';
import { localToGlobal } from './edge';

/** [uStart, uEnd] span an edge-cut occupies along its edge, used for overlap validation & path splicing. */
export function edgeCutZone(cut: Cut): { edge: EdgeId; uStart: number; uEnd: number } | null {
  switch (cut.kind) {
    case 'triangle':
      if (cut.placement !== 'edge' || cut.edge === undefined || cut.u === undefined) return null;
      return { edge: cut.edge, uStart: cut.u - cut.width / 2, uEnd: cut.u + cut.width / 2 };
    case 'semicircle':
      if (cut.placement !== 'edge' || cut.edge === undefined || cut.u === undefined) return null;
      return { edge: cut.edge, uStart: cut.u - cut.radius, uEnd: cut.u + cut.radius };
    case 'notch': {
      const { width } = NOTCH_SIZES[cut.size];
      return { edge: cut.edge, uStart: cut.u - width / 2, uEnd: cut.u + width / 2 };
    }
    case 'wave':
      return { edge: cut.edge, uStart: cut.uStart, uEnd: cut.uEnd };
  }
}

interface UV {
  u: number;
  v: number;
}

function triangleProfile(uCenter: number, width: number, depth: number): UV[] {
  return [
    { u: uCenter - width / 2, v: 0 },
    { u: uCenter, v: depth },
    { u: uCenter + width / 2, v: 0 },
  ];
}

function semicircleProfile(uCenter: number, radius: number): UV[] {
  const pts: UV[] = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const angle = Math.PI - (Math.PI * i) / steps;
    pts.push({ u: uCenter + radius * Math.cos(angle), v: radius * Math.sin(angle) });
  }
  return pts;
}

function waveProfile(uStart: number, uEnd: number, amplitude: number, count: number): UV[] {
  const pts: UV[] = [];
  const subWidth = (uEnd - uStart) / count;
  const stepsPerScallop = 10;
  for (let seg = 0; seg < count; seg++) {
    const segStart = uStart + seg * subWidth;
    for (let i = 0; i <= stepsPerScallop; i++) {
      const t = i / stepsPerScallop;
      pts.push({ u: segStart + t * subWidth, v: amplitude * Math.sin(t * Math.PI) });
    }
  }
  return pts;
}

/** Wedge-local (global-to-wedge) points for an edge cut's indentation profile, in increasing-u order. */
export function edgeCutProfile(cut: Cut, radius: number = WEDGE_RADIUS): Point[] {
  let edge: EdgeId;
  let uv: UV[];
  if (cut.kind === 'triangle' && cut.placement === 'edge' && cut.edge && cut.u !== undefined) {
    edge = cut.edge;
    uv = triangleProfile(cut.u, cut.width, cut.depth);
  } else if (cut.kind === 'semicircle' && cut.placement === 'edge' && cut.edge && cut.u !== undefined) {
    edge = cut.edge;
    uv = semicircleProfile(cut.u, cut.radius);
  } else if (cut.kind === 'notch') {
    edge = cut.edge;
    const { width, depth } = NOTCH_SIZES[cut.size];
    uv = triangleProfile(cut.u, width, depth);
  } else if (cut.kind === 'wave') {
    edge = cut.edge;
    uv = waveProfile(cut.uStart, cut.uEnd, cut.amplitude, cut.count);
  } else {
    return [];
  }
  return uv.map(({ u, v }) => localToGlobal(edge, u, 0, v, radius));
}

/** Closed polygon (wedge-local coords) for an interior hole cut. Empty array if not an interior cut. */
export function interiorHolePolygon(cut: Cut): Point[] {
  if (cut.kind === 'triangle' && cut.placement === 'interior') {
    return trianglePolygon(cut);
  }
  if (cut.kind === 'semicircle' && cut.placement === 'interior') {
    return circlePolygon(cut);
  }
  return [];
}

function trianglePolygon(cut: TriangleCut): Point[] {
  const cx = cut.x ?? 0;
  const cy = cut.y ?? 0;
  const size = cut.width;
  const rot = ((cut.rotation ?? 0) * Math.PI) / 180;
  // equilateral-ish triangle, circumradius derived from `size`
  const r = size / Math.sqrt(3);
  const pts: Point[] = [];
  for (let i = 0; i < 3; i++) {
    const a = rot + (i * 2 * Math.PI) / 3 - Math.PI / 2;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

function circlePolygon(cut: SemicircleCut): Point[] {
  const cx = cut.x ?? 0;
  const cy = cut.y ?? 0;
  const steps = 28;
  const pts: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    pts.push({ x: cx + cut.radius * Math.cos(a), y: cy + cut.radius * Math.sin(a) });
  }
  return pts;
}

export function isInteriorCut(cut: Cut): boolean {
  return (cut.kind === 'triangle' || cut.kind === 'semicircle') && cut.placement === 'interior';
}

export function isEdgeCut(cut: Cut): cut is TriangleCut | SemicircleCut | WaveCut | NotchCut {
  return !isInteriorCut(cut);
}
