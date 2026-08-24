import { clamp } from "./geometry";

export type BackgroundId = "noir" | "midnight-navy" | "deep-bordeaux";
export type RibbonHueId = "gold" | "ice-blue" | "crimson" | "pearl" | "emerald";

export interface ColorPreset<Id extends string> {
  readonly id: Id;
  readonly label: string;
  readonly hex: string;
}

export const BACKGROUND_PRESETS: readonly ColorPreset<BackgroundId>[] = [
  { id: "noir", label: "Noir", hex: "#0a0908" },
  { id: "midnight-navy", label: "Midnight Navy", hex: "#0b1220" },
  { id: "deep-bordeaux", label: "Deep Bordeaux", hex: "#1a0a10" },
];

export const RIBBON_HUES: readonly ColorPreset<RibbonHueId>[] = [
  { id: "gold", label: "Gold", hex: "#d9ac4c" },
  { id: "ice-blue", label: "Ice Blue", hex: "#9fd3ff" },
  { id: "crimson", label: "Crimson", hex: "#d1264f" },
  { id: "pearl", label: "Pearl", hex: "#f4efe4" },
  { id: "emerald", label: "Emerald", hex: "#3fb08a" },
];

export const DEFAULT_BACKGROUND_ID: BackgroundId = "noir";
export const DEFAULT_HUE_ID: RibbonHueId = "gold";

export function isBackgroundId(value: unknown): value is BackgroundId {
  return BACKGROUND_PRESETS.some((preset) => preset.id === value);
}

export function isRibbonHueId(value: unknown): value is RibbonHueId {
  return RIBBON_HUES.some((preset) => preset.id === value);
}

export function resolveBackground(id: string): ColorPreset<BackgroundId> {
  return BACKGROUND_PRESETS.find((preset) => preset.id === id) ?? BACKGROUND_PRESETS[0]!;
}

export function resolveHue(id: string): ColorPreset<RibbonHueId> {
  return RIBBON_HUES.find((preset) => preset.id === id) ?? RIBBON_HUES[0]!;
}

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const BLACK: Rgb = { r: 0, g: 0, b: 0 };

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "").trim();
  const expanded =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return BLACK;
  }

  const value = Number.parseInt(expanded, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

/** Mixes a hex colour toward white to build the bright "hot core" tone of the ribbon. */
export function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const t = clamp(amount, 0, 1);
  const mix = (channel: number): number => Math.round(channel + (255 - channel) * t);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
