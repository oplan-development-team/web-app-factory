import { leafCorners, rrPath, uniformCorners, type Corners } from './geometry';
import { finderOrigins, isDark, isInFinder, type QrMatrix } from './qr';
import type { DotStyle, EyeStyle, LogoConfig } from './types';

/** Axis-aligned square (in module units) hidden behind the logo. */
export interface LogoMask {
  x: number;
  y: number;
  size: number;
}

export function computeLogoMask(matrixSize: number, logo: LogoConfig | null): LogoMask | null {
  if (!logo) return null;
  const side = matrixSize * logo.sizeRatio + logo.padding * 2;
  const start = (matrixSize - side) / 2;
  return { x: start, y: start, size: side };
}

/**
 * A module is masked when it overlaps the mask square at all, not merely when
 * its centre is covered. Clipping conservatively keeps stray module corners
 * from poking into the logo backdrop.
 */
export function isMasked(mask: LogoMask | null, row: number, col: number): boolean {
  if (!mask) return false;
  return (
    col + 1 > mask.x && col < mask.x + mask.size && row + 1 > mask.y && row < mask.y + mask.size
  );
}

export function countMaskedModules(matrixSize: number, mask: LogoMask | null): number {
  if (!mask) return 0;
  let count = 0;
  for (let row = 0; row < matrixSize; row += 1) {
    for (let col = 0; col < matrixSize; col += 1) {
      if (isMasked(mask, row, col)) count += 1;
    }
  }
  return count;
}

const FIXED_ROUNDED_RADIUS = 0.28;

export type DrawnPredicate = (row: number, col: number) => boolean;

function cornersForDot(dotStyle: DotStyle, isDrawn: DrawnPredicate, row: number, col: number): Corners {
  switch (dotStyle) {
    case 'square':
      return uniformCorners(0);
    case 'rounded':
      return uniformCorners(FIXED_ROUNDED_RADIUS);
    case 'dot':
      return uniformCorners(0.5);
    case 'fluid': {
      // Round only the corners that face open space, so runs of modules fuse
      // into one continuous stroke.
      const up = isDrawn(row - 1, col);
      const down = isDrawn(row + 1, col);
      const left = isDrawn(row, col - 1);
      const right = isDrawn(row, col + 1);
      return [
        !up && !left ? 0.5 : 0,
        !up && !right ? 0.5 : 0,
        !down && !right ? 0.5 : 0,
        !down && !left ? 0.5 : 0,
      ];
    }
  }
}

/**
 * Turn any boolean grid into one `<path>` `d` string. Shared by the real code
 * and by the shape-picker glyphs so a preview can never drift from the output.
 */
export function buildGridPath(
  size: number,
  isDrawn: DrawnPredicate,
  dotStyle: DotStyle,
  offset: number,
): string {
  const parts: string[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!isDrawn(row, col)) continue;
      parts.push(rrPath(col + offset, row + offset, 1, 1, cornersForDot(dotStyle, isDrawn, row, col)));
    }
  }
  return parts.join('');
}

/**
 * Body modules only. Finder patterns and masked modules are excluded — they are
 * drawn by their own layers.
 */
export function buildBodyPath(
  matrix: QrMatrix,
  dotStyle: DotStyle,
  mask: LogoMask | null,
  offset: number,
): string {
  const isDrawn: DrawnPredicate = (row, col) =>
    isDark(matrix, row, col) && !isInFinder(matrix.size, row, col) && !isMasked(mask, row, col);
  return buildGridPath(matrix.size, isDrawn, dotStyle, offset);
}

/**
 * Leaf shapes are mirrored per corner so each finder's rounded axis points away
 * from the centre of the code.
 */
function cornersForEye(style: EyeStyle, radius: number, finderIndex: number): Corners {
  switch (style) {
    case 'square':
      return uniformCorners(0);
    case 'rounded':
      return uniformCorners(radius);
    case 'circle':
      return uniformCorners(Number.POSITIVE_INFINITY);
    case 'leaf':
      return finderIndex === 0 ? leafCorners(radius) : [0, radius, 0, radius];
  }
}

const EYE_FRAME_OUTER_RADIUS = 1.75;
const EYE_FRAME_INNER_RADIUS = 1.15;
const EYE_BALL_RADIUS = 0.85;

/** One 7x7 finder ring. Render with `fill-rule="evenodd"` to punch the hole. */
export function eyeFrameShape(x: number, y: number, style: EyeStyle, finderIndex = 0): string {
  const outer = rrPath(x, y, 7, 7, cornersForEye(style, EYE_FRAME_OUTER_RADIUS, finderIndex));
  const inner = rrPath(x + 1, y + 1, 5, 5, cornersForEye(style, EYE_FRAME_INNER_RADIUS, finderIndex));
  return outer + inner;
}

/** The 3x3 centre of a finder pattern. */
export function eyeBallShape(x: number, y: number, style: EyeStyle, finderIndex = 0): string {
  return rrPath(x + 2, y + 2, 3, 3, cornersForEye(style, EYE_BALL_RADIUS, finderIndex));
}

export function buildEyeFramePath(size: number, style: EyeStyle, offset: number): string {
  return finderOrigins(size)
    .map(([row, col], index) => eyeFrameShape(col + offset, row + offset, style, index))
    .join('');
}

export function buildEyeBallPath(size: number, style: EyeStyle, offset: number): string {
  return finderOrigins(size)
    .map(([row, col], index) => eyeBallShape(col + offset, row + offset, style, index))
    .join('');
}
