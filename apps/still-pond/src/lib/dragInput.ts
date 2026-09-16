/**
 * Converts a mouse drag gesture into the same pseudo tilt-state shape that
 * device-orientation readings produce, so the rest of the app (water tilt,
 * wave advection, floater motion) does not need to know which input source
 * is active (FR-12).
 */
import { TILT_CLAMP_DEG, type TiltState } from './tiltState';

export interface DragOrigin {
  startX: number;
  startY: number;
  baseTilt: TiltState;
}

/** How many drag pixels correspond to one degree of pseudo tilt. Lower = more sensitive. */
export const DRAG_PIXELS_PER_DEGREE = 6;

export function beginDrag(x: number, y: number, currentTilt: TiltState): DragOrigin {
  return { startX: x, startY: y, baseTilt: currentTilt };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Given the drag origin and the pointer's current position, returns the
 * resulting tilt state. Horizontal movement maps to gamma (left/right),
 * vertical movement maps to beta (front/back), matching how tilting a
 * physical device toward/away from you and side-to-side behaves.
 */
export function dragToTilt(
  origin: DragOrigin,
  currentX: number,
  currentY: number,
  pixelsPerDegree: number = DRAG_PIXELS_PER_DEGREE,
): TiltState {
  const dx = currentX - origin.startX;
  const dy = currentY - origin.startY;
  const gamma = clamp(
    origin.baseTilt.gamma + dx / pixelsPerDegree,
    -TILT_CLAMP_DEG,
    TILT_CLAMP_DEG,
  );
  const beta = clamp(
    origin.baseTilt.beta + dy / pixelsPerDegree,
    -TILT_CLAMP_DEG,
    TILT_CLAMP_DEG,
  );
  return { beta, gamma };
}
