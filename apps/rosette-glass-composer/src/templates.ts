import type { RoseSegments, TemplateKind } from './types.ts';

export interface TemplateGeometry {
  kind: TemplateKind;
  path: Path2D;
  /** Outer silhouette only, no mullions -- used for hit testing / clipping. */
  center: { x: number; y: number };
  bounds: { left: number; top: number; right: number; bottom: number };
  /** Lines belonging to the structural stonework: outer tracery + mullions. */
  structuralLines: Array<[number, number, number, number]>;
  structuralPath: Path2D;
  roseSegments?: RoseSegments;
  roseRadius?: number;
}

// A shared canvas + context used purely for geometric point-in-path tests.
// It never gets attached to the DOM or rendered.
const probeCanvas = document.createElement('canvas');
const probeCtx = probeCanvas.getContext('2d')!;

export function buildTemplate(
  kind: TemplateKind,
  roseSegments: RoseSegments,
  w: number,
  h: number,
): TemplateGeometry {
  if (kind === 'rose') return buildRose(roseSegments, w, h);
  return buildArch(w, h);
}

function buildArch(w: number, h: number): TemplateGeometry {
  const marginX = w * 0.11;
  const marginTop = h * 0.06;
  const marginBottom = h * 0.05;

  const left = marginX;
  const right = w - marginX;
  const bottom = h - marginBottom;
  const width = right - left;

  // Equilateral gothic arch: the two curves are struck from the opposite
  // springing points with a radius equal to the window's width.
  const springY = marginTop + width * 0.62;
  const apexY = springY - width * (Math.sqrt(3) / 2);

  const path = new Path2D();
  path.moveTo(left, bottom);
  path.lineTo(left, springY);
  // Left curve: centred on the right springing point, sweeping up to apex.
  path.arc(right, springY, width, Math.PI, (4 * Math.PI) / 3, false);
  // Right curve: centred on the left springing point, sweeping down to the right spring.
  path.arc(left, springY, width, (5 * Math.PI) / 3, 0, false);
  path.lineTo(right, bottom);
  path.closePath();

  const structuralPath = new Path2D(path);
  const structuralLines: Array<[number, number, number, number]> = [];

  return {
    kind: 'arch',
    path,
    center: { x: (left + right) / 2, y: (springY + bottom) / 2 },
    bounds: { left, top: apexY, right, bottom },
    structuralLines,
    structuralPath,
  };
}

function buildRose(segments: RoseSegments, w: number, h: number): TemplateGeometry {
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.44;

  const path = new Path2D();
  path.arc(cx, cy, radius, 0, Math.PI * 2);

  const structuralPath = new Path2D();
  structuralPath.arc(cx, cy, radius, 0, Math.PI * 2);
  // Small central boss (oculus ring) plus radial mullions, in the manner of
  // bar-tracery rose windows.
  const hubRadius = radius * 0.12;
  structuralPath.moveTo(cx + hubRadius, cy);
  structuralPath.arc(cx, cy, hubRadius, 0, Math.PI * 2);

  const structuralLines: Array<[number, number, number, number]> = [];
  for (let i = 0; i < segments; i++) {
    const ang = (i / segments) * Math.PI * 2;
    const x1 = cx + Math.cos(ang) * hubRadius;
    const y1 = cy + Math.sin(ang) * hubRadius;
    const x2 = cx + Math.cos(ang) * radius;
    const y2 = cy + Math.sin(ang) * radius;
    structuralPath.moveTo(x1, y1);
    structuralPath.lineTo(x2, y2);
    structuralLines.push([x1, y1, x2, y2]);
  }

  return {
    kind: 'rose',
    path,
    center: { x: cx, y: cy },
    bounds: { left: cx - radius, top: cy - radius, right: cx + radius, bottom: cy + radius },
    structuralLines,
    structuralPath,
    roseSegments: segments,
    roseRadius: radius,
  };
}

/** Sector index (0..segments-1) of a canvas-space point within a rose window. -1 outside the hub-less center. */
export function sectorIndexForPoint(x: number, y: number, geom: TemplateGeometry): number {
  if (geom.kind !== 'rose' || !geom.roseSegments) return 0;
  const dx = x - geom.center.x;
  const dy = y - geom.center.y;
  let ang = Math.atan2(dy, dx);
  if (ang < 0) ang += Math.PI * 2;
  const seg = geom.roseSegments;
  const idx = Math.floor(ang / ((Math.PI * 2) / seg));
  return Math.min(seg - 1, Math.max(0, idx));
}

export function isInside(geom: TemplateGeometry, x: number, y: number): boolean {
  return probeCtx.isPointInPath(geom.path, x, y);
}
