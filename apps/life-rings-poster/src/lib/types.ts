export type WoodTone = 'oak' | 'walnut' | 'ash';

export interface EventEntry {
  id: string;
  year: number;
  label: string;
  major: boolean;
}

export interface PosterData {
  birthYear: number | null;
  endYear: number;
  title: string;
  subtitle: string;
  woodTone: WoodTone;
  events: EventEntry[];
}

/** One growth ring, corresponding to a single calendar year. */
export interface RingModel {
  year: number;
  /** 0 = the ring immediately around the pith. */
  index: number;
  hasEvent: boolean;
  major: boolean;
  events: EventEntry[];
  /** Relative width multiplier applied to the base ring thickness. */
  widthFactor: number;
  /** 0 (pale, quiet year) .. 1 (dense, eventful year) */
  colorFactor: number;
  /** Angle (radians) of the knot, only set for rings with a major event. */
  knotAngle?: number;
}

export interface WoodPalette {
  name: string;
  label: string;
  /** background of the whole poster stock, behind the pith */
  paper: string;
  /** pith / heartwood centre */
  pith: string;
  /** quiet, low-contrast ring color */
  ringLow: string;
  /** dense, high-contrast ring color (event years) */
  ringHigh: string;
  /** knot / crack shadow color */
  shadow: string;
  /** bark band base */
  bark: string;
  barkDark: string;
}
