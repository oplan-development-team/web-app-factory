export interface InkPreset {
  id: string;
  name: string;
  /** Main engraving ink used for the guilloche lattice and most text. */
  main: string;
  /** Secondary ink used only for the serial number, per real banknote convention. */
  serial: string;
}

export interface PaperPreset {
  id: string;
  name: string;
  color: string;
  /** Very faint fiber/grain tint drawn under the tint pattern. */
  grain: string;
}

export const INK_PRESETS: InkPreset[] = [
  { id: 'intaglio-green', name: 'Intaglio Green', main: '#1f5c46', serial: '#7a1f2c' },
  { id: 'sepia', name: 'Sepia', main: '#7a4a22', serial: '#2c3a5c' },
  { id: 'indigo', name: 'Indigo', main: '#33417a', serial: '#7a2f2f' },
  { id: 'crimson', name: 'Deep Crimson', main: '#7a2230', serial: '#1f3a52' },
  { id: 'violet-brown', name: 'Violet Umber', main: '#5a3450', serial: '#3a5a3a' },
];

export const PAPER_PRESETS: PaperPreset[] = [
  { id: 'ivory', name: 'Unbleached Ivory', color: '#f2ead6', grain: '#e2d6b8' },
  { id: 'bleached', name: 'Bleached White', color: '#f8f6ef', grain: '#e6e2d3' },
  { id: 'blue-grey', name: 'Pale Blue-Grey', color: '#e8ecee', grain: '#d3dade' },
];

export const DENOMINATIONS = [1, 5, 10, 20, 50, 100, 500, 1000] as const;
export type Denomination = (typeof DENOMINATIONS)[number];

/** Default ink preset index per denomination, loosely inspired by real note families. */
const DENOMINATION_INK_DEFAULT: Record<Denomination, number> = {
  1: 1, // sepia
  5: 0, // intaglio green
  10: 2, // indigo
  20: 3, // crimson
  50: 4, // violet umber
  100: 0, // intaglio green
  500: 2, // indigo
  1000: 3, // crimson
};

/** Default paper preset index per denomination — lower notes lighter, higher notes warmer. */
const DENOMINATION_PAPER_DEFAULT: Record<Denomination, number> = {
  1: 1,
  5: 1,
  10: 0,
  20: 0,
  50: 0,
  100: 0,
  500: 2,
  1000: 2,
};

export function defaultInkIndexFor(denomination: number): number {
  return DENOMINATION_INK_DEFAULT[denomination as Denomination] ?? 0;
}

export function defaultPaperIndexFor(denomination: number): number {
  return DENOMINATION_PAPER_DEFAULT[denomination as Denomination] ?? 0;
}
