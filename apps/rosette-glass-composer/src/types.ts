export type TemplateKind = 'arch' | 'rose';
export type RoseSegments = 6 | 8 | 12;
export type ViewMode = 'backlight' | 'natural';

export interface PlacedPoint {
  id: number;
  x: number;
  y: number;
  color: string;
}

export interface GemColor {
  id: string;
  name: string;
  hex: string;
  extracted?: boolean;
}

export interface Settings {
  irregularity: number; // 0..1
  leadThickness: number; // px, display-scale
  glassNoise: number; // 0..1
  backlightIntensity: number; // 0..1
}
