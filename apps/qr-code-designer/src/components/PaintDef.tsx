import { gradientVector } from '../lib/color';
import type { Paint } from '../lib/types';

interface PaintDefProps {
  id: string;
  paint: Paint;
  /** Region the gradient should span, in user units. */
  origin: number;
  span: number;
}

/**
 * Gradients use `userSpaceOnUse` so every layer that shares a paint also shares
 * one continuous ramp, instead of each mapping the ramp onto its own bounding
 * box and visibly stepping at the seams.
 */
export function PaintDef({ id, paint, origin, span }: PaintDefProps) {
  if (paint.kind === 'solid') return null;

  if (paint.kind === 'linear') {
    const v = gradientVector(paint.angle);
    return (
      <linearGradient
        id={id}
        gradientUnits="userSpaceOnUse"
        x1={origin + v.x1 * span}
        y1={origin + v.y1 * span}
        x2={origin + v.x2 * span}
        y2={origin + v.y2 * span}
      >
        <stop offset="0%" stopColor={paint.from} />
        <stop offset="100%" stopColor={paint.to} />
      </linearGradient>
    );
  }

  return (
    <radialGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      cx={origin + span / 2}
      cy={origin + span / 2}
      r={span * 0.72}
    >
      <stop offset="0%" stopColor={paint.from} />
      <stop offset="100%" stopColor={paint.to} />
    </radialGradient>
  );
}

export function paintFill(paint: Paint, id: string): string {
  return paint.kind === 'solid' ? paint.color : `url(#${id})`;
}
