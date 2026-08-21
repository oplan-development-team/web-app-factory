export type MoodTag = 'dark' | 'mid' | 'light' | 'warm' | 'cool' | 'mono' | 'neutral';

export interface ImageAnalysis {
  /** 0-360 の色相平均（円環平均） */
  hue: number;
  /** 0-1 の彩度平均 */
  saturation: number;
  /** 0-1 の明度平均 */
  lightness: number;
  /** 元画像の 幅/高さ */
  aspectRatio: number;
  /** 解析から導かれるムードタグ（生成時の重み付けに使う） */
  tags: MoodTag[];
}

export interface GeneratedCaption {
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  body: string;
}

export interface WeightedItem {
  text: string;
  tags: MoodTag[];
}
