export type InkId =
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'teal'
  | 'blue'
  | 'purple'
  | 'black';

export interface InkPreset {
  id: InkId;
  label: string;
  hex: string;
}

// Approximations of common Riso corp fluorescent / special ink swatches.
export const INK_PRESETS: InkPreset[] = [
  { id: 'pink', label: '蛍光ピンク', hex: '#FF48B0' },
  { id: 'orange', label: '蛍光オレンジ', hex: '#FF6E28' },
  { id: 'red', label: 'ブライトレッド', hex: '#FF3939' },
  { id: 'yellow', label: 'イエロー', hex: '#FFE800' },
  { id: 'teal', label: 'ティール', hex: '#00A95C' },
  { id: 'blue', label: 'ブルー', hex: '#0078BF' },
  { id: 'purple', label: 'パープル', hex: '#7B5AA6' },
  { id: 'black', label: 'ブラック', hex: '#1A1A1A' },
];

export const INK_MAP: Record<InkId, InkPreset> = INK_PRESETS.reduce(
  (acc, ink) => {
    acc[ink.id] = ink;
    return acc;
  },
  {} as Record<InkId, InkPreset>,
);

export type LayoutPreset = 'center' | 'diagonal' | 'stamp';
export type ShapeKind = 'none' | 'circle' | 'band' | 'triangle';
export type AspectId = 'portrait' | 'square';
export type ExportScale = 1 | 2 | 3;

export interface PhotoState {
  bitmap: ImageBitmap | null;
  fileName: string | null;
}

export interface AppState {
  photo: PhotoState;
  heading: string;
  subtext: string;
  shape: ShapeKind;
  layout: LayoutPreset;
  selectedInks: InkId[];
  textPlateInk: InkId | null;
  misregistrationStrength: number;
  registrationSeed: number;
  angleSpread: number;
  paperTone: number;
  paperGrain: number;
  showRegistrationMarks: boolean;
  aspect: AspectId;
  isExporting: boolean;
  exportScale: ExportScale;
  inkLimitNotice: string | null;
}

export type Action =
  | { type: 'SET_PHOTO'; bitmap: ImageBitmap; fileName: string }
  | { type: 'CLEAR_PHOTO' }
  | { type: 'SET_HEADING'; value: string }
  | { type: 'SET_SUBTEXT'; value: string }
  | { type: 'SET_SHAPE'; value: ShapeKind }
  | { type: 'SET_LAYOUT'; value: LayoutPreset }
  | { type: 'TOGGLE_INK'; id: InkId }
  | { type: 'SET_TEXT_PLATE_INK'; id: InkId }
  | { type: 'SET_MISREGISTRATION'; value: number }
  | { type: 'RESHUFFLE_SEED' }
  | { type: 'SET_ANGLE_SPREAD'; value: number }
  | { type: 'SET_PAPER_TONE'; value: number }
  | { type: 'SET_PAPER_GRAIN'; value: number }
  | { type: 'TOGGLE_REGISTRATION_MARKS' }
  | { type: 'SET_ASPECT'; value: AspectId }
  | { type: 'SET_EXPORTING'; value: boolean }
  | { type: 'SET_EXPORT_SCALE'; value: ExportScale }
  | { type: 'CLEAR_INK_NOTICE' };
