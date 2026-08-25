import { drawPoster, POSTER_W, POSTER_H } from './draw';
import type { Segment, RecordingStats, SpecimenMeta } from '../types';

const EXPORT_SCALE = 3;

export function exportPosterPng(args: { segments: Segment[]; stats: RecordingStats; meta: SpecimenMeta }): void {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_W * EXPORT_SCALE;
  canvas.height = POSTER_H * EXPORT_SCALE;
  drawPoster(canvas, args, EXPORT_SCALE);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${args.meta.specimenNumber || 'voice-strata'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}
