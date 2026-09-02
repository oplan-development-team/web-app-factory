export interface Stone {
  id: string;
  /** logical canvas-space position in pixels (relative to current preset resolution) */
  x: number;
  y: number;
  /** radius in logical pixels */
  radius: number;
}

export type StoneSize = 'small' | 'medium' | 'large';

export type RatioKey = 'horizontal' | 'square' | 'vertical';

export interface RatioPreset {
  key: RatioKey;
  label: string;
  captionLabel: string;
  width: number;
  height: number;
}

export interface SandParams {
  /** spacing between seeded streamlines, in logical px */
  density: number;
  /** radius of influence of a stone's concentric field, in logical px */
  influence: number;
  /** base flow angle in degrees (0-180) */
  angleDeg: number;
  /** lateral undulation amplitude in logical px (0 = straight) */
  amplitude: number;
  /** undulation period, in logical px of arc length travelled */
  period: number;
}

export interface Point {
  x: number;
  y: number;
}

/** A single raked streamline as an ordered polyline. */
export type Streamline = Point[];

export interface GardenState {
  ratio: RatioKey;
  stones: Stone[];
  sand: SandParams;
  selectedStoneId: string | null;
}
