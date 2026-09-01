import type { EffectiveDimensions, LoadedImage } from './types';

export function computeDimensions(
  top: LoadedImage,
  bottom: LoadedImage,
  cutBottomOfTop: number,
  cutTopOfBottom: number,
  overlapPx: number,
): EffectiveDimensions {
  const topHeight = Math.max(0, top.naturalHeight - cutBottomOfTop);
  const bottomHeight = Math.max(0, bottom.naturalHeight - cutTopOfBottom);
  const maxOverlap = Math.max(0, Math.min(topHeight, bottomHeight));
  const overlapClamped = Math.max(0, Math.min(overlapPx, maxOverlap));
  const outputWidth = Math.max(0, Math.min(top.naturalWidth, bottom.naturalWidth));
  const outputHeight = topHeight + bottomHeight - overlapClamped;

  return { topHeight, bottomHeight, maxOverlap, outputWidth, outputHeight };
}
