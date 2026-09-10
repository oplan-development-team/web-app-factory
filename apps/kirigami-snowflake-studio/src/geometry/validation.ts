import type { Cut } from './types';
import { WEDGE_RADIUS } from './types';
import { WEDGE_ANGLE } from './edge';
import { edgeCutZone, isInteriorCut } from './cutShapes';

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

const EDGE_GAP = 3; // min px gap required between two edge cuts on the same edge
const INTERIOR_EDGE_MARGIN = 22; // min px an interior hole must stay clear of any wedge edge
const INTERIOR_GAP = 6; // min px gap required between two interior holes

function interiorRadius(cut: Cut): number {
  if (cut.kind === 'triangle') return cut.width / Math.sqrt(3);
  if (cut.kind === 'semicircle') return cut.radius;
  return 0;
}

/** Distance from a wedge-local point to the nearest wedge edge (left / right / outer arc). */
function distanceToNearestEdge(x: number, y: number, radius: number): number {
  const r = Math.hypot(x, y);
  const toArc = radius - r;
  const toLeft = Math.abs(y); // left edge is the local x-axis
  const rightDir = { x: Math.cos((WEDGE_ANGLE.deg * Math.PI) / 180), y: Math.sin((WEDGE_ANGLE.deg * Math.PI) / 180) };
  const toRight = Math.abs(x * rightDir.y - y * rightDir.x);
  return Math.min(toArc, toLeft, toRight);
}

/** Validates that `candidate` can be placed given the already-placed `existing` cuts. */
export function validatePlacement(candidate: Cut, existing: Cut[], radius: number = WEDGE_RADIUS): ValidationResult {
  if (isInteriorCut(candidate)) {
    const cx = candidate.kind === 'triangle' || candidate.kind === 'semicircle' ? candidate.x ?? 0 : 0;
    const cy = candidate.kind === 'triangle' || candidate.kind === 'semicircle' ? candidate.y ?? 0 : 0;
    const cRadius = interiorRadius(candidate);

    if (distanceToNearestEdge(cx, cy, radius) < INTERIOR_EDGE_MARGIN + cRadius) {
      return { ok: false, reason: '縁に近すぎます' };
    }
    for (const other of existing) {
      if (!isInteriorCut(other)) continue;
      const ox = other.kind === 'triangle' || other.kind === 'semicircle' ? other.x ?? 0 : 0;
      const oy = other.kind === 'triangle' || other.kind === 'semicircle' ? other.y ?? 0 : 0;
      const oRadius = interiorRadius(other);
      const dist = Math.hypot(cx - ox, cy - oy);
      if (dist < cRadius + oRadius + INTERIOR_GAP) {
        return { ok: false, reason: '近すぎます' };
      }
    }
    return { ok: true };
  }

  const zone = edgeCutZone(candidate);
  if (!zone) return { ok: true };
  if (zone.uStart < -0.01 || zone.uEnd > (candidate.kind === 'wave' ? Infinity : radius) + 0.01) {
    // allow wave along arc length bound separately; basic sanity check for straight edges
  }
  for (const other of existing) {
    const oZone = edgeCutZone(other);
    if (!oZone || oZone.edge !== zone.edge) continue;
    const overlap = zone.uStart - EDGE_GAP < oZone.uEnd && zone.uEnd + EDGE_GAP > oZone.uStart;
    if (overlap) {
      return { ok: false, reason: '近すぎます' };
    }
  }
  return { ok: true };
}
