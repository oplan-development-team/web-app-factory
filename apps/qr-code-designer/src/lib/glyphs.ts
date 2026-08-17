import { buildGridPath, eyeBallShape, eyeFrameShape } from './paths';
import type { DotStyle, EyeStyle } from './types';

/**
 * A fixed 5x5 sample with isolated modules, straight runs and an L-bend, so
 * every dot style shows off what makes it different.
 */
const SAMPLE: ReadonlyArray<ReadonlyArray<number>> = [
  [1, 1, 0, 1, 0],
  [1, 1, 0, 1, 1],
  [0, 0, 1, 0, 0],
  [1, 0, 1, 1, 0],
  [1, 1, 0, 1, 1],
];

export const DOT_GLYPH_SIZE = SAMPLE.length;
export const EYE_GLYPH_SIZE = 7;

/** Built through the same path builder as the real code, so it cannot drift. */
export function dotGlyphPath(style: DotStyle): string {
  const isDrawn = (row: number, col: number): boolean =>
    row >= 0 &&
    col >= 0 &&
    row < DOT_GLYPH_SIZE &&
    col < DOT_GLYPH_SIZE &&
    SAMPLE[row][col] === 1;
  return buildGridPath(DOT_GLYPH_SIZE, isDrawn, style, 0);
}

export function eyeFrameGlyphPath(style: EyeStyle): string {
  return eyeFrameShape(0, 0, style);
}

export function eyeBallGlyphPath(style: EyeStyle): string {
  return eyeBallShape(0, 0, style);
}
