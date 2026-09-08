import { fbm, hashSeed, makeRingNoise, mulberry32, angleDelta, type NoiseLayer } from './noise';
import { primaryCrackAngles } from './rings';
import { hexLerp, WOOD_PALETTES } from './palette';
import type { PosterData, RingModel } from './types';

export const CANVAS_W = 1100;
export const CANVAS_H = 1400;

const SEGMENTS = 144;
const TAU = Math.PI * 2;

interface Point {
  x: number;
  y: number;
}

interface Knot {
  ringIndex: number; // index into rings[]
  angle: number;
  sigma: number;
  magnitude: number;
}

interface Ctx {
  center: Point;
  pithRadius: number;
  baseThickness: number;
  baseRadii: number[]; // length numRings+2, boundary radii before noise
  boundaryAmp: number[];
  boundaryNoise: NoiseLayer[][];
  globalNoise: NoiseLayer[];
  globalAmp: number;
  knots: Knot[];
  numRings: number;
}

function polar(center: Point, r: number, angle: number): Point {
  return { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r };
}

function gaussian(x: number, sigma: number): number {
  return Math.exp(-(x * x) / (2 * sigma * sigma));
}

export function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Catmull-Rom (tension 1/6) closed smooth path through points. */
function smoothClosedPathD(points: Point[]): string {
  const n = points.length;
  if (n < 3) return '';
  const p = (i: number) => points[((i % n) + n) % n];
  let d = `M ${p(0).x.toFixed(2)} ${p(0).y.toFixed(2)} `;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} `;
  }
  return `${d}Z`;
}

/** Catmull-Rom smooth *open* path (end tangents clamped by duplicating end points). */
function smoothOpenPathD(points: Point[]): string {
  const n = points.length;
  if (n < 2) return '';
  const p = (i: number) => points[Math.max(0, Math.min(n - 1, i))];
  let d = `M ${p(0).x.toFixed(2)} ${p(0).y.toFixed(2)} `;
  for (let i = 0; i < n - 1; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} `;
  }
  return d;
}

function buildContext(birthYear: number, rings: RingModel[]): Ctx {
  const numRings = rings.length;
  const pithRadius = 13;
  const ringsBudget = 300;
  const barkThickness = 22;

  const sumWidth = rings.reduce((s, r) => s + r.widthFactor, 0) || 1;
  const baseThickness = ringsBudget / sumWidth;

  const baseRadii: number[] = [pithRadius];
  let acc = pithRadius;
  for (let k = 0; k < numRings; k++) {
    acc += rings[k].widthFactor * baseThickness;
    baseRadii.push(acc);
  }
  baseRadii.push(acc + barkThickness); // bark outer boundary

  const boundaryCount = baseRadii.length; // numRings + 2
  const boundaryAmp: number[] = [];
  const boundaryNoise: NoiseLayer[][] = [];
  for (let b = 0; b < boundaryCount; b++) {
    const isBark = b === boundaryCount - 1;
    const bandBefore = b > 0 ? baseRadii[b] - baseRadii[b - 1] : pithRadius;
    const bandAfter = b < boundaryCount - 1 ? baseRadii[b + 1] - baseRadii[b] : bandBefore;
    const ref = Math.min(bandBefore, bandAfter);
    boundaryAmp.push(isBark ? bandBefore * 0.85 : ref * 0.34);
    boundaryNoise.push(
      makeRingNoise(hashSeed(birthYear, 'boundary', b), 22, 6, isBark ? 1.15 : 0.42),
    );
  }

  // small consistent trunk eccentricity shared by every boundary
  const globalNoise = makeRingNoise(hashSeed(birthYear, 'global'), 10, 4, 0.55);
  const globalAmp = ringsBudget * 0.035;

  // off-center pith
  const centerRng = mulberry32(hashSeed(birthYear, 'center'));
  const centerAngle = centerRng() * TAU;
  const centerDist = 10 + centerRng() * 16;
  const center: Point = {
    x: CANVAS_W / 2 + Math.cos(centerAngle) * centerDist,
    y: CANVAS_H / 2 + Math.sin(centerAngle) * centerDist,
  };

  const knots: Knot[] = [];
  for (const r of rings) {
    if (!r.major || r.knotAngle === undefined) continue;
    const rng = mulberry32(hashSeed(birthYear, 'knotshape', r.year));
    knots.push({
      ringIndex: r.index,
      angle: r.knotAngle,
      sigma: 0.1 + rng() * 0.07,
      magnitude: baseThickness * (1.3 + rng() * 0.5),
    });
  }

  return {
    center,
    pithRadius,
    baseThickness,
    baseRadii,
    boundaryAmp,
    boundaryNoise,
    globalNoise,
    globalAmp,
    knots,
    numRings,
  };
}

const KNOT_OFFSET_STRENGTH: Record<number, number> = { 0: 0.32, 1: 1, 2: 0.52, 3: 0.22 };

function knotBumpAt(ctx: Ctx, boundaryIndex: number, angle: number): number {
  let sum = 0;
  for (const knot of ctx.knots) {
    const ownBoundary = knot.ringIndex + 1; // boundary right after its ring
    const offset = boundaryIndex - (ownBoundary - 1); // -1..3 relative window
    const strength = KNOT_OFFSET_STRENGTH[offset];
    if (strength === undefined) continue;
    const d = angleDelta(angle, knot.angle);
    sum += strength * knot.magnitude * gaussian(d, knot.sigma);
  }
  return sum;
}

function boundaryRadiusAt(ctx: Ctx, b: number, angle: number): number {
  let r = ctx.baseRadii[b];
  r += ctx.globalAmp * fbm(ctx.globalNoise, angle);
  r += ctx.boundaryAmp[b] * fbm(ctx.boundaryNoise[b], angle);
  r += knotBumpAt(ctx, b, angle);
  return Math.max(3, r);
}

function boundaryPoints(ctx: Ctx, b: number, segments = SEGMENTS): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (TAU * i) / segments;
    const r = boundaryRadiusAt(ctx, b, angle);
    pts.push(polar(ctx.center, r, angle));
  }
  return pts;
}

function ringFill(colorFactor: number, low: string, high: string): string {
  return hexLerp(low, high, colorFactor);
}

function buildCrack(
  ctx: Ctx,
  angle: number,
  rStart: number,
  rEnd: number,
  seed: number,
  jitterAmp: number,
  steps: number,
): Point[] {
  const rng = mulberry32(seed);
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = rStart + (rEnd - rStart) * t;
    const wobble = (rng() - 0.5) * jitterAmp * Math.sin(Math.PI * t + 0.001);
    const a = angle + wobble / Math.max(r, 8);
    pts.push(polar(ctx.center, r, a));
  }
  return pts;
}

export interface PosterRenderResult {
  svg: string;
  outerRadius: number;
  center: Point;
}

export function renderPosterSVG(data: PosterData, rings: RingModel[]): PosterRenderResult {
  const palette = WOOD_PALETTES[data.woodTone];

  if (data.birthYear === null || rings.length === 0) {
    return renderEmptyPoster(data, palette.paper, palette.shadow);
  }

  const ctx = buildContext(data.birthYear, rings);
  const numRings = ctx.numRings;
  const barkBoundaryIdx = ctx.baseRadii.length - 1;
  const outerRadius = ctx.baseRadii[barkBoundaryIdx];

  let bands = '';

  // pith blob (boundary 0)
  const pithPts = boundaryPoints(ctx, 0);
  bands += `<path class="ring pith" d="${smoothClosedPathD(pithPts)}" fill="${palette.pith}" />`;

  // growth rings
  for (let k = 0; k < numRings; k++) {
    const ring = rings[k];
    const innerB = k;
    const outerB = k + 1;
    const outerPts = boundaryPoints(ctx, outerB);
    const innerPts = boundaryPoints(ctx, innerB);
    const d = `${smoothClosedPathD(outerPts)} ${smoothClosedPathD(innerPts)}`;
    const fill = ringFill(ring.colorFactor, palette.ringLow, palette.ringHigh);
    const cls = ring.hasEvent ? (ring.major ? 'ring event major' : 'ring event') : 'ring quiet';
    bands += `<path class="${cls}" fill-rule="evenodd" d="${d}" fill="${fill}" data-year="${ring.year}" />`;
  }

  // bark band
  {
    const outerPts = boundaryPoints(ctx, barkBoundaryIdx);
    const innerPts = boundaryPoints(ctx, barkBoundaryIdx - 1);
    const d = `${smoothClosedPathD(outerPts)} ${smoothClosedPathD(innerPts)}`;
    bands += `<path class="ring bark" fill-rule="evenodd" d="${d}" fill="${palette.bark}" />`;
  }

  // knot shading + crease + cracks
  let knotLayer = '';
  for (const knot of ctx.knots) {
    const b = knot.ringIndex + 1;
    const peakR = boundaryRadiusAt(ctx, b, knot.angle);
    const peak = polar(ctx.center, peakR - knot.magnitude * 0.28, knot.angle);
    const rx = knot.magnitude * 1.3;
    const ry = knot.magnitude * 0.95;
    const gradId = `knotGrad-${knot.ringIndex}-${Math.round(knot.angle * 1000)}`;
    knotLayer += `<radialGradient id="${gradId}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${palette.shadow}" stop-opacity="0.65" />
      <stop offset="70%" stop-color="${palette.shadow}" stop-opacity="0.28" />
      <stop offset="100%" stop-color="${palette.shadow}" stop-opacity="0" />
    </radialGradient>`;
    knotLayer += `<ellipse class="knot-shade" cx="${peak.x.toFixed(1)}" cy="${peak.y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="url(#${gradId})" transform="rotate(${((knot.angle * 180) / Math.PI).toFixed(1)} ${peak.x.toFixed(1)} ${peak.y.toFixed(1)})" />`;

    // crease arc just inside the bump
    const innerB = Math.max(0, knot.ringIndex);
    const creasePts: Point[] = [];
    for (let i = -8; i <= 8; i++) {
      const a = knot.angle + (i / 8) * knot.sigma * 2.4;
      const r = boundaryRadiusAt(ctx, innerB, a) - 1.5;
      creasePts.push(polar(ctx.center, r, a));
    }
    knotLayer += `<path class="knot-crease" d="${smoothOpenPathD(creasePts)}" fill="none" stroke="${palette.shadow}" stroke-width="1.4" stroke-opacity="0.5" stroke-linecap="round" />`;

    // radial crack shooting from the knot out to the bark
    const crackStartR = peakR + knot.magnitude * 0.15;
    const crackSeed = hashSeed(data.birthYear!, 'knotcrack', knot.ringIndex);
    const crackPts = buildCrack(ctx, knot.angle, crackStartR, outerRadius + 6, crackSeed, 10, 9);
    knotLayer += crackPath(crackPts, palette.shadow, 2.1);
  }

  // primary bark-to-pith cracks
  let crackLayer = '';
  const crackAngles = primaryCrackAngles(data.birthYear);
  crackAngles.forEach((angle, i) => {
    const seed = hashSeed(data.birthYear!, 'crack', i);
    const pts = buildCrack(ctx, angle, ctx.pithRadius * 0.5, outerRadius + 8, seed, 14, 14);
    crackLayer += crackPath(pts, palette.shadow, 2.6);
  });

  const labels = buildLabels(ctx, rings, data, outerRadius, palette.shadow);
  const grainSeed = ((data.birthYear % 1000) + 1000) % 1000;
  const bandsClipD = smoothClosedPathD(boundaryPoints(ctx, barkBoundaryIdx));

  const frame = buildFrame(data, palette, outerRadius, ctx.center);

  const svg = `<svg viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(data.title || 'Life Rings poster')}">
  <defs>
    <clipPath id="posterClip"><path d="${bandsClipD}" /></clipPath>
    <filter id="woodGrain" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.011 0.05" numOctaves="3" seed="${grainSeed}" result="turb" />
      <feColorMatrix in="turb" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.33 0.33 0.33 0 0" result="alpha" />
      <feComponentTransfer in="alpha" result="alpha2">
        <feFuncA type="gamma" amplitude="1" exponent="2.6" offset="0" />
      </feComponentTransfer>
      <feComposite in="alpha2" in2="SourceGraphic" operator="in" />
    </filter>
  </defs>
  <rect x="0" y="0" width="${CANVAS_W}" height="${CANVAS_H}" fill="${palette.paper}" />
  ${frame.back}
  <g class="rings-group">
    ${bands}
    ${knotLayer}
    ${crackLayer}
    <rect class="grain-overlay" x="0" y="0" width="${CANVAS_W}" height="${CANVAS_H}" fill="${palette.barkDark}" filter="url(#woodGrain)" clip-path="url(#posterClip)" opacity="0.4" style="mix-blend-mode:multiply" />
    <path class="rim-shade" d="${bandsClipD}" fill="none" stroke="${palette.shadow}" stroke-opacity="0.35" stroke-width="3" clip-path="url(#posterClip)" />
  </g>
  ${labels}
  ${frame.front}
</svg>`;

  return { svg, outerRadius, center: ctx.center };
}

function crackPath(pts: Point[], color: string, width: number): string {
  const d = smoothOpenPathD(pts);
  return `<g class="crack">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="${(width + 1).toFixed(1)}" stroke-opacity="0.28" stroke-linecap="round" />
    <path d="${d}" fill="none" stroke="${color}" stroke-width="${width.toFixed(1)}" stroke-opacity="0.62" stroke-linecap="round" />
  </g>`;
}

function buildLabels(
  ctx: Ctx,
  rings: RingModel[],
  data: PosterData,
  outerRadius: number,
  lineColor: string,
): string {
  const entries: { ring: RingModel; event: RingModel['events'][number] }[] = [];
  for (const r of rings) {
    for (const e of r.events) entries.push({ ring: r, event: e });
  }
  if (entries.length === 0) return '';

  const n = entries.length;
  const startAngle = -Math.PI / 2;
  const leaderOuter = outerRadius + 26;
  const edgeMargin = 20;
  const charWidth = 11.5; // conservative estimate for mixed CJK/Latin at 12.5px
  let out = '<g class="labels">';

  entries.forEach(({ ring, event }, i) => {
    const angle = startAngle + (TAU * i) / n;
    const ownBoundary = ring.index + 1;
    const bandInner = boundaryRadiusAt(ctx, ring.index, angle);
    const bandOuter = boundaryRadiusAt(ctx, ownBoundary, angle);
    const startR = (bandInner + bandOuter) / 2;
    const p0 = polar(ctx.center, startR, angle);
    const p1 = polar(ctx.center, leaderOuter, angle);
    const goRight = p1.x >= ctx.center.x;
    const elbow = 18;
    const p2: Point = { x: p1.x + (goRight ? elbow : -elbow), y: p1.y };
    const anchor = goRight ? 'start' : 'end';
    const textX = p2.x + (goRight ? 6 : -6);
    const majorCls = event.major ? ' major' : '';

    // Clamp label length to whatever horizontal room is actually left at
    // this angle, so long labels near the 3/9 o'clock positions never spill
    // past the canvas edge (which would otherwise be hard-clipped by the
    // SVG viewBox).
    const availableWidth = goRight ? CANVAS_W - edgeMargin - textX : textX - edgeMargin;
    const maxChars = Math.max(3, Math.min(13, Math.floor(availableWidth / charWidth)));

    out += `<path class="leader${majorCls}" d="M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}" fill="none" stroke="${lineColor}" stroke-width="${event.major ? 1.6 : 1.1}" stroke-opacity="${event.major ? 0.75 : 0.55}" />`;
    out += `<circle class="leader-dot${majorCls}" cx="${p0.x.toFixed(1)}" cy="${p0.y.toFixed(1)}" r="${event.major ? 4 : 2.4}" fill="${lineColor}" fill-opacity="${event.major ? 0.85 : 0.6}" />`;
    out += `<text class="label-year" x="${textX.toFixed(1)}" y="${(p2.y - 5).toFixed(1)}" text-anchor="${anchor}">${event.year}</text>`;
    out += `<text class="label-text${majorCls}" x="${textX.toFixed(1)}" y="${(p2.y + 9).toFixed(1)}" text-anchor="${anchor}">${escapeXml(truncate(event.label || '(無題)', maxChars))}</text>`;
  });

  out += '</g>';
  return out;
}

function buildFrame(
  data: PosterData,
  palette: { shadow: string },
  outerRadius: number,
  center: Point,
) {
  const inset = 44;
  const w = CANVAS_W - inset * 2;
  const h = CANVAS_H - inset * 2;
  const title = escapeXml(truncate(data.title || 'Untitled Life', 40));
  const subtitle = escapeXml(truncate(data.subtitle || '', 60));

  const back = `<g class="plate-title">
    <text x="${CANVAS_W / 2}" y="118" text-anchor="middle" class="poster-title">${title}</text>
    <text x="${CANVAS_W / 2}" y="150" text-anchor="middle" class="poster-subtitle">${subtitle}</text>
  </g>`;

  const front = `<g class="plate-frame">
    <rect x="${inset}" y="${inset}" width="${w}" height="${h}" fill="none" stroke="${palette.shadow}" stroke-opacity="0.32" stroke-width="1.2" />
    ${cornerMark(inset, inset, 1, 1, palette.shadow)}
    ${cornerMark(inset + w, inset, -1, 1, palette.shadow)}
    ${cornerMark(inset, inset + h, 1, -1, palette.shadow)}
    ${cornerMark(inset + w, inset + h, -1, -1, palette.shadow)}
    <text x="${inset + 6}" y="${CANVAS_H - inset - 14}" class="plate-caption">${data.birthYear ?? '—'}–${data.endYear}</text>
    <text x="${CANVAS_W - inset - 6}" y="${CANVAS_H - inset - 14}" text-anchor="end" class="plate-caption">LIFE RINGS</text>
  </g>`;

  return { back, front };
}

function cornerMark(x: number, y: number, dx: number, dy: number, color: string): string {
  const len = 12;
  return `<path d="M ${x + dx * len} ${y} L ${x} ${y} L ${x} ${y + dy * len}" fill="none" stroke="${color}" stroke-opacity="0.45" stroke-width="1" />`;
}

function renderEmptyPoster(
  data: PosterData,
  paper: string,
  shadow: string,
): PosterRenderResult {
  const center = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  const svg = `<svg viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="empty poster">
  <rect x="0" y="0" width="${CANVAS_W}" height="${CANVAS_H}" fill="${paper}" />
  <rect x="44" y="44" width="${CANVAS_W - 88}" height="${CANVAS_H - 88}" fill="none" stroke="${shadow}" stroke-opacity="0.3" stroke-width="1.2" stroke-dasharray="6 8" />
  <circle cx="${center.x}" cy="${center.y}" r="180" fill="none" stroke="${shadow}" stroke-opacity="0.35" stroke-width="1.4" stroke-dasharray="3 7" />
  <text x="${center.x}" y="${center.y}" text-anchor="middle" class="empty-hint">生まれた年を入力してください</text>
  <text x="${center.x}" y="${center.y + 28}" text-anchor="middle" class="empty-hint-sub">Enter a birth year to begin growing rings</text>
</svg>`;
  return { svg, outerRadius: 0, center };
}
