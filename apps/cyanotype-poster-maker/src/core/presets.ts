import type { InkPreset, LayoutId } from '../types';

export const INK_PRESETS: InkPreset[] = [
  {
    id: 'classic',
    label: 'クラシック濃藍',
    labelEn: 'Classic Prussian',
    ink: '#123a63',
    paper: '#f2ebda',
  },
  {
    id: 'vintage',
    label: '褪色ヴィンテージ',
    labelEn: 'Faded Vintage',
    ink: '#3d5f7d',
    paper: '#e8dcc0',
  },
  {
    id: 'deep',
    label: '深藍',
    labelEn: 'Deep Indigo',
    ink: '#0e2f52',
    paper: '#efe6d2',
  },
];

export function getInkPreset(id: string): InkPreset {
  return INK_PRESETS.find((preset) => preset.id === id) ?? INK_PRESETS[0];
}

interface LayoutSize {
  width: number;
  height: number;
}

/** Base (1x) plate sizes. Export scale multiplies these. */
export const LAYOUT_SIZES: Record<LayoutId, LayoutSize> = {
  vertical: { width: 1200, height: 1600 },
  square: { width: 1200, height: 1200 },
};

export const PREVIEW_MAX_WIDTH = 820;
