import type { ColorPreset, PaperSpec } from './types.ts';

export const PAPERS: PaperSpec[] = [
  { id: 'a4', label: 'A4 縦', ratio: 210 / 297, exportW: 1240, exportH: 1754 },
  { id: 'a3', label: 'A3 縦', ratio: 297 / 420, exportW: 1754, exportH: 2481 },
  { id: 'square', label: '正方形', ratio: 1, exportW: 1600, exportH: 1600 },
];

export const PRESETS: ColorPreset[] = [
  {
    id: 'blueprint',
    nameJa: '藍図',
    nameEn: 'Blueprint',
    bg: '#0f1b2d',
    bgVignette: '#091220',
    lineMinor: '#a9c3d6',
    lineMajor: '#c9a86e',
    frame: '#c9a86e',
    text: '#e9edf2',
    textMuted: '#9fb0c2',
    labelBg: '#0f1b2d',
  },
  {
    id: 'survey',
    nameJa: '測量原図',
    nameEn: 'Survey Buff',
    bg: '#e6dac0',
    bgVignette: '#d9c9a5',
    lineMinor: '#6b4a2c',
    lineMajor: '#3c2712',
    frame: '#3c2712',
    text: '#2b1d10',
    textMuted: '#6b4a2c',
    labelBg: '#e6dac0',
  },
  {
    id: 'ink',
    nameJa: 'モノクローム',
    nameEn: 'Ink',
    bg: '#f6f4ee',
    bgVignette: '#e9e6dc',
    lineMinor: '#3a3a3a',
    lineMajor: '#111111',
    frame: '#111111',
    text: '#111111',
    textMuted: '#555555',
    labelBg: '#f6f4ee',
  },
];

export function findPreset(id: string): ColorPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]!;
}

export function findPaper(id: string): PaperSpec {
  return PAPERS.find((p) => p.id === id) ?? PAPERS[0]!;
}
