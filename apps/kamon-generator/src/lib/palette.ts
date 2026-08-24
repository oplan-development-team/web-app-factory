/**
 * 配色プリセット（FR-200）。
 *
 * 家紋は単色エンブレムであることが成立要件であるため、任意配色は持たない。
 * 幾何構造は配色に一切依存しない（FR-200.1）。
 */

export type PaletteId = "sumi" | "shu" | "kon";

export interface Palette {
  id: PaletteId;
  label: string;
  /** 紋そのものの色 */
  ink: string;
  /** 紋の下地（円地）の色 */
  paper: string;
}

export const PALETTES: readonly Palette[] = [
  { id: "sumi", label: "墨 × 白", ink: "#1f1b16", paper: "#fbf7ec" },
  { id: "shu", label: "朱 × 白", ink: "#b4342a", paper: "#fbf7ec" },
  { id: "kon", label: "白 × 紺", ink: "#f4efe2", paper: "#1b2a4a" },
] as const;

export const DEFAULT_PALETTE_ID: PaletteId = "sumi";

export function paletteById(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? (PALETTES[0] as Palette);
}

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === "string" && PALETTES.some((p) => p.id === value);
}
