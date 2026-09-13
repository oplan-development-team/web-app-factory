export type ColorPresetId = 'amber' | 'terracotta' | 'indigo';
export type FontPresetId = 'serif' | 'slab';

export interface ColorPreset {
  id: ColorPresetId;
  label: string;
  h: number;
  s: number;
  l: number;
  /** how far lightness may drift per-grain, in percentage points */
  lJitter: number;
  /** how far hue may drift per-grain, in degrees */
  hJitter: number;
}

export const COLOR_PRESETS: Record<ColorPresetId, ColorPreset> = {
  amber: { id: 'amber', label: 'アンバー', h: 37, s: 68, l: 50, lJitter: 12, hJitter: 4 },
  terracotta: {
    id: 'terracotta',
    label: 'テラコッタ',
    h: 13,
    s: 58,
    l: 47,
    lJitter: 11,
    hJitter: 3,
  },
  indigo: {
    id: 'indigo',
    label: 'インディゴスレート',
    h: 221,
    s: 26,
    l: 40,
    lJitter: 10,
    hJitter: 3,
  },
};

export interface FontPreset {
  id: FontPresetId;
  label: string;
  family: string;
  cssVar: string;
}

export const FONT_PRESETS: Record<FontPresetId, FontPreset> = {
  serif: {
    id: 'serif',
    label: 'Serif',
    family: '"Playfair Display", "Times New Roman", serif',
    cssVar: 'var(--font-serif)',
  },
  slab: {
    id: 'slab',
    label: 'Slab',
    family: '"Arvo", "Courier New", serif',
    cssVar: 'var(--font-slab)',
  },
};

/** Pack an HSL colour jittered per-grain into a single RGBA byte quad. */
export function jitteredRgba(preset: ColorPreset, rand: () => number): [number, number, number, number] {
  const l = clamp(preset.l + (rand() * 2 - 1) * preset.lJitter, 12, 92);
  const h = preset.h + (rand() * 2 - 1) * preset.hJitter;
  const [r, g, b] = hslToRgb(h, preset.s, l);
  return [r, g, b, 255];
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hh = ((h % 360) + 360) % 360;
  const ss = s / 100;
  const ll = l / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) {
    r = c;
    g = x;
  } else if (hh < 120) {
    r = x;
    g = c;
  } else if (hh < 180) {
    g = c;
    b = x;
  } else if (hh < 240) {
    g = x;
    b = c;
  } else if (hh < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}
