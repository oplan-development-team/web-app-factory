export const CATEGORY_NAMES = [
  'ライフスタイル',
  'エッセイ',
  '仕事術',
  'フード',
  '旅',
  '暮らし',
  'カルチャー',
  'その他',
] as const;

export type CategoryName = (typeof CATEGORY_NAMES)[number];

export type CategoryIcon =
  | 'cup'
  | 'nib'
  | 'case'
  | 'plate'
  | 'mountain'
  | 'house'
  | 'book'
  | 'asterisk';

export interface Category {
  readonly name: CategoryName;
  readonly slug: string;
  readonly blurb: string;
  readonly icon: CategoryIcon;
}

export interface Author {
  readonly name: string;
  /** Short self-description shown on the article page. */
  readonly bio: string;
}

export interface SeriesRef {
  readonly name: string;
  readonly episode: number;
}

export interface Article {
  readonly id: string;
  readonly title: string;
  readonly category: CategoryName;
  /** ISO `YYYY-MM-DD`, derived from `daysAgo` so the front page never goes stale. */
  readonly publishedAt: string;
  readonly excerpt: string;
  readonly body: readonly string[];
  readonly author: Author;
  readonly tags: readonly string[];
  readonly readMinutes: number;
  /** Relative score used for the popularity ranking. Higher ranks first. */
  readonly popularity: number;
  readonly series?: SeriesRef;
  readonly isEditorsPick?: boolean;
}
