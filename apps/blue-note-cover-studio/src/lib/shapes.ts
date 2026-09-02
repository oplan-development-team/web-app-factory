// Reusable geometry for the Blue Note layout grammar. Every template clips
// either a duotone photo or a flat palette color into these same paths, so
// "photo duotone" and "geometric only" modes stay visually consistent.

export function diagonalBandPath(
  width: number,
  height: number,
  angleDeg: number,
  centerXFraction: number,
  bandWidthFraction: number,
): Path2D {
  const angleRad = (angleDeg * Math.PI) / 180;
  const shear = height * Math.tan(angleRad);
  const bandWidth = width * bandWidthFraction;
  const centerX = width * centerXFraction;
  const topLeftX = centerX - bandWidth / 2;
  const topRightX = centerX + bandWidth / 2;
  const bottomLeftX = topLeftX + shear;
  const bottomRightX = topRightX + shear;

  const path = new Path2D();
  path.moveTo(topLeftX, 0);
  path.lineTo(topRightX, 0);
  path.lineTo(bottomRightX, height);
  path.lineTo(bottomLeftX, height);
  path.closePath();
  return path;
}

/**
 * Splits the canvas into two regions along a sheared vertical boundary at
 * `xFraction`. Used for the asymmetric Swiss grid template.
 */
export function splitPath(
  width: number,
  height: number,
  angleDeg: number,
  xFraction: number,
  side: 'left' | 'right',
): Path2D {
  const angleRad = (angleDeg * Math.PI) / 180;
  const shear = height * Math.tan(angleRad);
  const topX = width * xFraction;
  const bottomX = topX + shear;

  const path = new Path2D();
  if (side === 'left') {
    path.moveTo(0, 0);
    path.lineTo(topX, 0);
    path.lineTo(bottomX, height);
    path.lineTo(0, height);
  } else {
    path.moveTo(topX, 0);
    path.lineTo(width, 0);
    path.lineTo(width, height);
    path.lineTo(bottomX, height);
  }
  path.closePath();
  return path;
}

/**
 * X position of the sheared split boundary (see splitPath) at a given y.
 * Lets callers size text to the actually-available panel width instead of
 * assuming a fixed rectangle, since the boundary moves with the cut angle.
 */
export function splitBoundaryXAt(y: number, angleDeg: number, xFraction: number, width: number): number {
  const angleRad = (angleDeg * Math.PI) / 180;
  return width * xFraction + y * Math.tan(angleRad);
}

export function circlePath(cx: number, cy: number, r: number): Path2D {
  const path = new Path2D();
  path.arc(cx, cy, r, 0, Math.PI * 2);
  return path;
}

/** Axis-aligned bounding box a path's shape occupies, for sizing a source image. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
