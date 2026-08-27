export type PaperId = 'a4' | 'a3' | 'square';

export interface PaperSpec {
  id: PaperId;
  label: string;
  /** width : height */
  ratio: number;
  /** base export width in px (2x multiplier applied on top for PNG) */
  exportW: number;
  exportH: number;
}

export type PresetId = 'blueprint' | 'survey' | 'ink';

export interface ColorPreset {
  id: PresetId;
  nameJa: string;
  nameEn: string;
  bg: string;
  bgVignette: string;
  lineMinor: string;
  lineMajor: string;
  frame: string;
  text: string;
  textMuted: string;
  labelBg: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface ContourPolyline {
  level: number;
  isIndex: boolean;
  points: Point[];
  closed: boolean;
}

export interface PosterState {
  paper: PaperId;
  preset: PresetId;
  levels: number;
  brushRadius: number;
  brushStrength: number;
  title: string;
  subtitle: string;
  showTitle: boolean;
  showSubtitle: boolean;
  showFrame: boolean;
  showScaleBar: boolean;
  showCompass: boolean;
}
