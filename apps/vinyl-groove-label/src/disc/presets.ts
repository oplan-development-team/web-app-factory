import type { LabelPreset } from '../types';

export const LABEL_PRESETS: LabelPreset[] = [
  {
    id: 'black-gold',
    name: 'ブラック × ゴールド',
    base: '#0c0b09',
    baseTint: '#1a1712',
    accent: '#c9a24b',
    accentSoft: '#8a6425',
    text: '#efe2ba',
    textMuted: '#9c8f68',
  },
  {
    id: 'red-cream',
    name: 'ディープレッド × クリーム',
    base: '#5c1620',
    baseTint: '#722033',
    accent: '#ecdfc0',
    accentSoft: '#b9a173',
    text: '#f3e9d2',
    textMuted: '#d8b9a8',
  },
  {
    id: 'navy-silver',
    name: 'ネイビー × シルバー',
    base: '#16233a',
    baseTint: '#203150',
    accent: '#c7cdd6',
    accentSoft: '#8891a1',
    text: '#e7ebf1',
    textMuted: '#9aa4b5',
  },
  {
    id: 'forest-brass',
    name: 'フォレスト × ブラス',
    base: '#152318',
    baseTint: '#1e3122',
    accent: '#b98d3e',
    accentSoft: '#7d5f28',
    text: '#e9e2c8',
    textMuted: '#9caa8d',
  },
];

export function findPreset(id: string): LabelPreset {
  return LABEL_PRESETS.find((p) => p.id === id) ?? LABEL_PRESETS[0];
}
