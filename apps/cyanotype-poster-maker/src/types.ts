import type { PosterSource, SourceKind, SpecimenSource, UploadSource } from './source/types';

export type { PosterSource, SourceKind, SpecimenSource, UploadSource };

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

export type LabelFieldKey = keyof LabelFields;

/**
 * 図案ソースの選択状態。
 * 両方を保持し、往復しても復元できるようにする（FR-103）。
 */
export interface SourceSelection {
  active: SourceKind | null;
  upload: (UploadSource & { seed: number }) | null;
  specimen: (SpecimenSource & { seed: number }) | null;
}

export interface AppState {
  source: SourceSelection;
  contrast: number;
  threshold: number;
  inkPresetId: string;
  mottle: number;
  grain: number;
  vignette: number;
  edgeStyle: EdgeStyle;
  layout: LayoutId;
  label: LabelFields;
  /** ユーザーが自分で触ったラベル項目。自動投入の対象外になる（FR-127.1） */
  labelTouched: readonly LabelFieldKey[];
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
