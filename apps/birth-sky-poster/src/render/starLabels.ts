import type { ProjectedStar } from '../astro/compute';
import { starDotRadius } from '../astro/compute';

/** Only stars this bright are worth naming; below it the chart turns to text. */
export const LABEL_MAGNITUDE_LIMIT = 2.5;

/** Font size of a star label, in SVG user units. Mirrors `.star-label` in the poster CSS. */
const LABEL_FONT_SIZE = 9.5;

/*
 * Metrics for JetBrains Mono, read off getBBox() on rendered labels in every
 * supported engine rather than guessed. The advance is exactly 0.6em
 * everywhere, but the surrounding box is not:
 *
 *              advance   side bearing   ascent   descent
 *   Chromium     0.60em      0.00em      1.06em   0.30em
 *   WebKit       0.60em      0.00em      1.02em   0.30em
 *   Firefox      0.60em      0.25em      1.13em   0.38em
 *
 * The constants below take the widest of each column, so a label that clears
 * the check here clears it in all three. Sizing them to Chromium alone lets
 * labels overlap in Firefox only -- the kind of defect that never shows up in
 * whichever browser happens to be open.
 */
const CHAR_WIDTH_RATIO = 0.6;
const SIDE_BEARING_RATIO = 0.26;
const ASCENT_RATIO = 1.13;
const DESCENT_RATIO = 0.38;

/** Gap between a star's dot and the start of its label. */
const LABEL_GAP = 4;

/** Padding added around a label's box when testing for overlap. */
const COLLISION_PADDING = 1;

export interface StarLabel {
  text: string;
  x: number;
  y: number;
}

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * The area a label's glyphs occupy, padded. Exported so tests can check
 * placement against the same geometry the layout uses rather than a
 * duplicated approximation that could drift from it.
 */
export function labelBoundingBox(label: StarLabel): Box {
  const width = label.text.length * LABEL_FONT_SIZE * CHAR_WIDTH_RATIO;
  const bearing = LABEL_FONT_SIZE * SIDE_BEARING_RATIO;
  return {
    left: label.x - bearing - COLLISION_PADDING,
    right: label.x + width + bearing + COLLISION_PADDING,
    // The y coordinate is the text baseline; glyphs sit mostly above it with
    // descenders reaching below.
    top: label.y - LABEL_FONT_SIZE * ASCENT_RATIO - COLLISION_PADDING,
    bottom: label.y + LABEL_FONT_SIZE * DESCENT_RATIO + COLLISION_PADDING,
  };
}

/**
 * Chooses which named stars get a label.
 *
 * Labels are placed brightest-first and any that would collide with one
 * already placed is dropped rather than nudged. Nudging is the usual answer,
 * but this chart's whole idiom is a ruled instrument plate: a label sitting
 * slightly off its star reads as a printing fault, whereas an absent label
 * reads as deliberate restraint (FR-006.2).
 *
 * @param chartRadius Radius of the horizon circle; labels are not allowed to
 *   spill outside it.
 */
export function layOutStarLabels(
  stars: readonly ProjectedStar[],
  chartRadius: number,
): StarLabel[] {
  const candidates = stars
    .filter((p) => p.star.name !== undefined && p.star.mag <= LABEL_MAGNITUDE_LIMIT)
    .sort((a, b) => a.star.mag - b.star.mag);

  const placed: StarLabel[] = [];
  const boxes: Box[] = [];

  for (const candidate of candidates) {
    const label: StarLabel = {
      text: candidate.star.name ?? '',
      x: candidate.x + starDotRadius(candidate.star.mag) + LABEL_GAP,
      y: candidate.y + LABEL_FONT_SIZE / 3,
    };
    const box = labelBoundingBox(label);

    if (!fitsInsideChart(box, chartRadius)) continue;
    if (boxes.some((other) => overlaps(box, other))) continue;

    placed.push(label);
    boxes.push(box);
  }

  return placed;
}

/** True when every corner of the box lies within the horizon circle. */
function fitsInsideChart(box: Box, chartRadius: number): boolean {
  const corners: [number, number][] = [
    [box.left, box.top],
    [box.right, box.top],
    [box.left, box.bottom],
    [box.right, box.bottom],
  ];

  return corners.every(([x, y]) => Math.hypot(x, y) <= chartRadius);
}
