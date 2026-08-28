import { MULTI_PRESETS } from './constants';
import type { MultiPreset } from '../types';

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linearly interpolates across a preset's color stops for band position t (0..1, low->high elevation). */
export function hypsometricColor(preset: MultiPreset, t: number): string {
  const stops = MULTI_PRESETS[preset].stops.map(hexToRgb);
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  const localT = scaled - i;
  const a = stops[i];
  const b = stops[i + 1];
  return rgbToHex([a[0] + (b[0] - a[0]) * localT, a[1] + (b[1] - a[1]) * localT, a[2] + (b[2] - a[2]) * localT]);
}
