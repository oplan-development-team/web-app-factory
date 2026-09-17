/** A single physical key, addressed by its KeyboardEvent.code (layout-independent). */
export interface KeyDef {
  /** KeyboardEvent.code value, e.g. "KeyQ", "Digit1", "ShiftLeft". */
  code: string;
  /** Row index, 0 = top (number row) .. 4 = bottom (space row). */
  row: number;
  /** Horizontal position in "key units" (1u = width of a standard letter key). */
  col: number;
  /** Width in key units. Defaults to 1. */
  width?: number;
  /** Height in rows (used for the JIS Enter key which spans two rows). Defaults to 1. */
  heightRows?: number;
  /** Visible label on the keycap. */
  label: string;
  /** Smaller secondary label (shown above the main label), e.g. shifted symbol. */
  subLabel?: string;
  /** Keys not part of the puzzle-answerable alphanumeric block render as structural/inert. */
  structural?: boolean;
}

export type LayoutId = 'us' | 'jis';

/** How a puzzle's key set must be entered. */
export type PuzzleMode = 'simultaneous' | 'sequence';

export interface Puzzle {
  id: string;
  /** 1-based display index. */
  index: number;
  title: string;
  /** Flavor text describing the shape riddle, without naming keys directly. */
  flavor: string;
  mode: PuzzleMode;
  /** Target codes. For 'sequence' mode, order matters. */
  codes: string[];
  /** Short label describing the shape, shown once solved (e.g. "三角形"). */
  shapeName: string;
}

export type ScreenId = 'title' | 'game' | 'finale';
