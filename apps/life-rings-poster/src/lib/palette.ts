import type { WoodPalette, WoodTone } from './types';

export const WOOD_PALETTES: Record<WoodTone, WoodPalette> = {
  oak: {
    name: 'oak',
    label: 'オーク',
    paper: '#efe0bd',
    pith: '#8a5a2b',
    ringLow: '#e6cd94',
    ringHigh: '#9c6830',
    shadow: '#54350f',
    bark: '#7a5227',
    barkDark: '#442c11',
  },
  walnut: {
    name: 'walnut',
    label: 'ウォルナット',
    paper: '#6b4a30',
    pith: '#1c110a',
    ringLow: '#5d4128',
    ringHigh: '#2a190e',
    shadow: '#100a05',
    bark: '#20130a',
    barkDark: '#0e0805',
  },
  ash: {
    name: 'ash',
    label: 'アッシュ',
    paper: '#f2ead9',
    pith: '#b7a077',
    ringLow: '#ece0c8',
    ringHigh: '#c4ab7e',
    shadow: '#7c6845',
    bark: '#a48c62',
    barkDark: '#6c5836',
  },
};

export function hexLerp(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const tt = Math.max(0, Math.min(1, t));
  const r = Math.round(ca.r + (cb.r - ca.r) * tt);
  const g = Math.round(ca.g + (cb.g - ca.g) * tt);
  const bch = Math.round(ca.b + (cb.b - ca.b) * tt);
  return rgbToHex(r, g, bch);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => n.toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
