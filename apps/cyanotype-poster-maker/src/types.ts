export type EdgeStyle = 'straight' | 'rough';
export type LayoutId = 'vertical' | 'square';

export interface InkPreset {
  id: string;
  label: string;
  labelEn: string;
  ink: string;
  paper: string;
}

export interface LabelFields {
  title: string;
  subtitle: string;
  locality: string;
  lat: string;
  lon: string;
  date: string;
  specimenNo: string;
}

export interface SourceImage {
  bitmap: HTMLImageElement;
  width: number;
  height: number;
  seed: number;
}

export interface AppState {
  source: SourceImage | null;
  contrast: number;
  threshold: number;
  inkPresetId: string;
  mottle: number;
  grain: number;
  vignette: number;
  edgeStyle: EdgeStyle;
  layout: LayoutId;
  label: LabelFields;
}

export interface LayoutMetrics {
  width: number;
  height: number;
  marginX: number;
  marginTop: number;
  labelBandHeight: number;
  imageX: number;
  imageY: number;
  imageW: number;
  imageH: number;
}
