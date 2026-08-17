/** Corner radii in [top-left, top-right, bottom-right, bottom-left] order. */
export type Corners = readonly [number, number, number, number];

/** Trim float noise so serialized paths stay small. */
export function num(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

/**
 * Rounded rectangle with independent corner radii.
 * A radius of `min(w, h) / 2` on every corner yields a circle, so this one
 * primitive covers every dot and finder shape the app offers.
 */
export function rrPath(x: number, y: number, w: number, h: number, corners: Corners): string {
  const limit = Math.min(w, h) / 2;
  const clamp = (r: number) => Math.max(0, Math.min(r, limit));
  const tl = clamp(corners[0]);
  const tr = clamp(corners[1]);
  const br = clamp(corners[2]);
  const bl = clamp(corners[3]);

  const parts: string[] = [`M${num(x + tl)} ${num(y)}`];

  parts.push(`H${num(x + w - tr)}`);
  if (tr > 0) parts.push(`A${num(tr)} ${num(tr)} 0 0 1 ${num(x + w)} ${num(y + tr)}`);

  parts.push(`V${num(y + h - br)}`);
  if (br > 0) parts.push(`A${num(br)} ${num(br)} 0 0 1 ${num(x + w - br)} ${num(y + h)}`);

  parts.push(`H${num(x + bl)}`);
  if (bl > 0) parts.push(`A${num(bl)} ${num(bl)} 0 0 1 ${num(x)} ${num(y + h - bl)}`);

  parts.push(`V${num(y + tl)}`);
  if (tl > 0) parts.push(`A${num(tl)} ${num(tl)} 0 0 1 ${num(x + tl)} ${num(y)}`);

  parts.push('Z');
  return parts.join('');
}

export function uniformCorners(r: number): Corners {
  return [r, r, r, r];
}

/** Two opposite corners rounded — the "leaf" silhouette. */
export function leafCorners(r: number): Corners {
  return [r, 0, r, 0];
}

/**
 * A ring built from an outer and an inner outline. Must be rendered with
 * `fill-rule="evenodd"` so the inner outline punches a hole.
 */
export function ringPath(outer: string, inner: string): string {
  return `${outer}${inner}`;
}
