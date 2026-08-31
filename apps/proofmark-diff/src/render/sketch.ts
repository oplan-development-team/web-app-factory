/**
 * Small deterministic "hand-drawn" path builders. Every function takes a
 * numeric seed so the same segment always wobbles the same way across
 * re-layouts (window resize, ResizeObserver ticks) instead of jittering
 * randomly on every redraw.
 */

export function seedFromString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function mulberry32(seed: number) {
  let a = Math.floor(seed * 4294967296) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A slightly wobbly horizontal-ish strike line through [x1,y] -> [x2,y]. */
export function buildStrikePath(x1: number, y1: number, x2: number, y2: number, seed: number): string {
  const rand = mulberry32(seed);
  const steps = Math.max(2, Math.round((x2 - x1) / 18));
  let d = `M ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t + (rand() - 0.5) * 2.4;
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/** A small cursive "loop" glyph (トルツメ mark), centred at (cx, cy). */
export function buildLoopGlyph(cx: number, cy: number, scale = 1): string {
  const s = scale;
  return `M ${cx - 7 * s} ${cy + 2 * s}
    C ${cx - 6 * s} ${cy - 8 * s}, ${cx + 6 * s} ${cy - 9 * s}, ${cx + 7 * s} ${cy - 1 * s}
    C ${cx + 8 * s} ${cy + 6 * s}, ${cx - 1 * s} ${cy + 9 * s}, ${cx - 5 * s} ${cy + 4 * s}
    C ${cx - 7 * s} ${cy + 1 * s}, ${cx - 2 * s} ${cy - 2 * s}, ${cx + 3 * s} ${cy - 1 * s}`;
}

/** A caret (∧) glyph pointing up into the text line, tip at (x, tipY). */
export function buildCaretGlyph(x: number, tipY: number, seed: number): string {
  const rand = mulberry32(seed);
  const wobble = () => (rand() - 0.5) * 1.4;
  const left = { x: x - 6 + wobble(), y: tipY + 7 + wobble() };
  const tip = { x: x + wobble(), y: tipY - 2 + wobble() };
  const right = { x: x + 6 + wobble(), y: tipY + 7 + wobble() };
  return `M ${left.x.toFixed(1)} ${left.y.toFixed(1)} L ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L ${right.x.toFixed(1)} ${right.y.toFixed(1)}`;
}

/** A loose, slightly-open hand-drawn ellipse enclosing a rect, used to
 * lasso the two endpoints of a "move" pair. */
export function buildLassoPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
): string {
  const rand = mulberry32(seed);
  const points: [number, number][] = [];
  const turns = 20;
  // start slightly before 0 and overshoot past 2*PI so the ends overlap
  // like a real pen stroke that doesn't close perfectly.
  const start = -0.15;
  const end = Math.PI * 2 + 0.25;
  for (let i = 0; i <= turns; i++) {
    const t = start + ((end - start) * i) / turns;
    const jitterR = 1 + (rand() - 0.5) * 0.09;
    const x = cx + Math.cos(t) * rx * jitterR;
    const y = cy + Math.sin(t) * ry * jitterR;
    points.push([x, y]);
  }
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0].toFixed(1)} ${points[i][1].toFixed(1)}`;
  }
  return d;
}

/** A wavy cubic-bezier arrow shaft from (x1,y1) to (x2,y2), curving away
 * from the straight line so it reads as a hand-sketched connector rather
 * than a ruler-straight line. Returns path data ending just before the
 * arrowhead so a marker-end can be attached. */
export function buildArrowPath(x1: number, y1: number, x2: number, y2: number, seed: number): string {
  const rand = mulberry32(seed);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const bow = Math.min(46, Math.max(18, dist * 0.18)) * (rand() > 0.5 ? 1 : -1);

  const segments = 5;
  const points: [number, number][] = [];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const baseX = x1 + dx * t;
    const baseY = y1 + dy * t;
    // bow-shaped offset peaking at the midpoint, plus a little per-point jitter
    const bowOffset = bow * Math.sin(Math.PI * t);
    const jitter = (rand() - 0.5) * 3;
    points.push([baseX + nx * (bowOffset + jitter), baseY + ny * (bowOffset + jitter)]);
  }
  // Build a smooth quadratic chain through the sampled points.
  let d = `M ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  let prev: [number, number] = [x1, y1];
  for (const p of points) {
    const mid: [number, number] = [(prev[0] + p[0]) / 2, (prev[1] + p[1]) / 2];
    d += ` Q ${prev[0].toFixed(1)} ${prev[1].toFixed(1)} ${mid[0].toFixed(1)} ${mid[1].toFixed(1)}`;
    prev = p;
  }
  d += ` T ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  return d;
}
