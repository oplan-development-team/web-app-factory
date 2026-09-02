export type Mode = 'photo' | 'geometric';

export type TemplateId = 'diagonal' | 'typography' | 'circle' | 'grid';

export interface TemplateMeta {
  id: TemplateId;
  num: string;
  name: string;
  description: string;
}

export interface Palette {
  id: string;
  num: string;
  name: string;
  /** Used for light source pixels (photo mode) / dominant field (geometric mode). */
  highlight: string;
  /** Used for dark source pixels (photo mode) / accent field (geometric mode). */
  shadow: string;
}

export interface PhotoTransform {
  /** -100..100, percentage offset of the visible crop window. */
  cropX: number;
  cropY: number;
  /** 100..250, percentage zoom (100 = cover-fit, no extra zoom). */
  zoom: number;
  /** -30..30 degrees, diagonal cut / rotation angle. */
  angle: number;
  /** 0..100, luminance threshold used to posterize into two tones. */
  threshold: number;
}

export interface CoverState {
  bandName: string;
  albumName: string;
  tracks: string[];
  mode: Mode;
  templateId: TemplateId;
  paletteId: string;
  photo: HTMLImageElement | null;
  transform: PhotoTransform;
  catalogLabel: string;
}
