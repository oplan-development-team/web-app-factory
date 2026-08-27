/** 図案ソース（SPEC 3.1 / PLAN 3.1）。 */

export type SourceKind = 'upload' | 'specimen';

export interface UploadSource {
  kind: 'upload';
  image: HTMLImageElement;
  width: number;
  height: number;
  fileName: string;
}

export interface SpecimenSource {
  kind: 'specimen';
  specimenId: string;
}

export type PosterSource = UploadSource | SpecimenSource;
