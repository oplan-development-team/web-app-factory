/**
 * The whole app state is a single immutable `QrDesign` object. Every update
 * returns a new object; nothing is mutated in place.
 */

export type EccLevel = 'L' | 'M' | 'Q' | 'H';

/** Fraction of codewords Reed-Solomon can recover at each level. */
export const ECC_CAPACITY: Record<EccLevel, number> = {
  L: 0.07,
  M: 0.15,
  Q: 0.25,
  H: 0.3,
};

export const ECC_LABELS: Record<EccLevel, string> = {
  L: 'L · 7%',
  M: 'M · 15%',
  Q: 'Q · 25%',
  H: 'H · 30%',
};

export type DotStyle = 'square' | 'rounded' | 'fluid' | 'dot';
export type EyeStyle = 'square' | 'rounded' | 'circle' | 'leaf';
export type LogoFrame = 'none' | 'square' | 'rounded' | 'circle';

export type Paint =
  | { kind: 'solid'; color: string }
  | { kind: 'linear'; from: string; to: string; angle: number }
  | { kind: 'radial'; from: string; to: string };

export interface LogoConfig {
  /** Always a data URL — the file never leaves the browser. */
  dataUrl: string;
  name: string;
  /** Logo side length as a fraction of the QR body side. */
  sizeRatio: number;
  /** Quiet space around the logo, in modules. */
  padding: number;
  frame: LogoFrame;
}

export interface QrDesign {
  text: string;
  ecc: EccLevel;
  /** When true, `ecc` is derived from whether a logo is present. */
  eccAuto: boolean;
  /** Quiet zone width in modules. */
  margin: number;
  dotStyle: DotStyle;
  bodyPaint: Paint;
  /** `null` means a transparent background. */
  background: Paint | null;
  /** When true the finder patterns reuse `bodyPaint`. */
  eyeInherit: boolean;
  eyeFrameStyle: EyeStyle;
  eyeFramePaint: Paint;
  eyeBallStyle: EyeStyle;
  eyeBallPaint: Paint;
  logo: LogoConfig | null;
}

/** The visual half of a design — what a preset replaces. */
export type DesignAppearance = Pick<
  QrDesign,
  | 'margin'
  | 'dotStyle'
  | 'bodyPaint'
  | 'background'
  | 'eyeInherit'
  | 'eyeFrameStyle'
  | 'eyeFramePaint'
  | 'eyeBallStyle'
  | 'eyeBallPaint'
>;

export const LOGO_SIZE_MIN = 0.1;
export const LOGO_SIZE_MAX = 0.32;
export const MARGIN_MIN = 0;
export const MARGIN_MAX = 8;
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const DEFAULT_DESIGN: QrDesign = {
  text: 'https://example.com',
  ecc: 'M',
  eccAuto: true,
  margin: 4,
  dotStyle: 'fluid',
  bodyPaint: { kind: 'linear', from: '#1d2b4f', to: '#3a63c2', angle: 135 },
  background: { kind: 'solid', color: '#ffffff' },
  eyeInherit: false,
  eyeFrameStyle: 'rounded',
  eyeFramePaint: { kind: 'solid', color: '#1d2b4f' },
  eyeBallStyle: 'rounded',
  eyeBallPaint: { kind: 'solid', color: '#b8431f' },
  logo: null,
};
