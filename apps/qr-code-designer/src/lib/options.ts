import type { DotStyle, EccLevel, EyeStyle, LogoFrame } from './types';

export interface Option<T extends string> {
  value: T;
  label: string;
  sublabel?: string;
}

export const DOT_STYLE_OPTIONS: ReadonlyArray<Option<DotStyle>> = [
  { value: 'square', label: '四角' },
  { value: 'rounded', label: '角丸' },
  { value: 'fluid', label: '連結' },
  { value: 'dot', label: '丸' },
];

export const EYE_STYLE_OPTIONS: ReadonlyArray<Option<EyeStyle>> = [
  { value: 'square', label: '四角' },
  { value: 'rounded', label: '角丸' },
  { value: 'circle', label: '円' },
  { value: 'leaf', label: 'リーフ' },
];

export const LOGO_FRAME_OPTIONS: ReadonlyArray<Option<LogoFrame>> = [
  { value: 'none', label: 'なし' },
  { value: 'square', label: '四角' },
  { value: 'rounded', label: '角丸' },
  { value: 'circle', label: '円' },
];

export const ECC_OPTIONS: ReadonlyArray<Option<EccLevel>> = [
  { value: 'L', label: 'L', sublabel: '7%' },
  { value: 'M', label: 'M', sublabel: '15%' },
  { value: 'Q', label: 'Q', sublabel: '25%' },
  { value: 'H', label: 'H', sublabel: '30%' },
];

export type PaintMode = 'solid' | 'linear' | 'radial';

export const PAINT_MODE_OPTIONS: ReadonlyArray<Option<PaintMode>> = [
  { value: 'solid', label: '単色' },
  { value: 'linear', label: '線形' },
  { value: 'radial', label: '放射' },
];

/** PNG export presets, with the physical size each one prints at 300dpi. */
export const PNG_SIZES: ReadonlyArray<{ px: number; mm: number }> = [
  { px: 512, mm: 43 },
  { px: 1024, mm: 87 },
  { px: 2048, mm: 173 },
  { px: 4096, mm: 347 },
];
