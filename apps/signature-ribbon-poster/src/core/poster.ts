import type { Vec2 } from "./geometry";

/**
 * The poster's logical coordinate system. Every stroke coordinate, line width and
 * caption offset is expressed here, so the on-screen preview and any export
 * resolution describe the exact same artwork (FR-001.8, FR-010.3).
 */
export const POSTER_WIDTH = 1800;
export const POSTER_HEIGHT = 2545;
export const POSTER_ASPECT = POSTER_HEIGHT / POSTER_WIDTH;

export interface RectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Converts a viewport (client) coordinate into poster space. */
export function toPosterSpace(clientX: number, clientY: number, rect: RectLike): Vec2 {
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: ((clientX - rect.left) * POSTER_WIDTH) / rect.width,
    y: ((clientY - rect.top) * POSTER_HEIGHT) / rect.height,
  };
}
