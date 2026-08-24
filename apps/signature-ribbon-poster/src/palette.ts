export interface BackgroundPreset {
  id: string;
  label: string;
  hex: string;
}

export interface RibbonHue {
  id: string;
  label: string;
  hex: string;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: "noir", label: "Noir", hex: "#0a0908" },
  { id: "midnight-navy", label: "Midnight Navy", hex: "#0b1220" },
  { id: "deep-bordeaux", label: "Deep Bordeaux", hex: "#1a0a10" },
];

export const RIBBON_HUES: RibbonHue[] = [
  { id: "gold", label: "Gold", hex: "#d9ac4c" },
  { id: "ice-blue", label: "Ice Blue", hex: "#9fd3ff" },
  { id: "crimson", label: "Crimson", hex: "#d1264f" },
  { id: "pearl", label: "Pearl", hex: "#f4efe4" },
  { id: "emerald", label: "Emerald", hex: "#3fb08a" },
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Mixes a hex color toward white to build a bright "hot core" tone for the glow. */
export function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
