import { AspectId } from '../types';

export const ASPECT_SIZES: Record<AspectId, { width: number; height: number }> = {
  portrait: { width: 1200, height: 1600 },
  square: { width: 1400, height: 1400 },
};

const PREVIEW_MAX_DIMENSION = 620;

export function previewSize(aspect: AspectId): { width: number; height: number } {
  const base = ASPECT_SIZES[aspect];
  const scale = PREVIEW_MAX_DIMENSION / Math.max(base.width, base.height);
  return {
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale),
  };
}
