import type { Palette } from './types.ts';

// Six curated duotone presets, each keyed to a real Blue Note-era pressing's
// mood rather than an arbitrary color-wheel pick. No free color picker is
// offered on purpose (see concept: reproducibility of the design system
// matters more than open-ended color freedom).
export const PALETTES: Palette[] = [
  { id: 'navy-cream', num: '01', name: 'ネイビー × クリーム', highlight: '#F1E9D6', shadow: '#1B2A4A' },
  { id: 'orange-black', num: '02', name: 'オレンジ × ブラック', highlight: '#E2711D', shadow: '#141311' },
  { id: 'teal-offwhite', num: '03', name: 'ティール × オフホワイト', highlight: '#ECE7DA', shadow: '#0F4C4C' },
  { id: 'mustard-charcoal', num: '04', name: 'マスタード × チャコール', highlight: '#D8A93A', shadow: '#2B2A28' },
  { id: 'wine-cream', num: '05', name: 'ワインレッド × クリーム', highlight: '#F1E6D4', shadow: '#5B1A2B' },
  { id: 'olive-black', num: '06', name: 'オリーブ × ブラック', highlight: '#A9A05A', shadow: '#131310' },
];

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]!;
}
