export type CategoryKey =
  | 'ga'
  | 'dougo'
  | 'length'
  | 'passive'
  | 'taigen'
  | 'conjunction';

export type Verdict = '異常なし' | '軽度' | '要注意' | '要精査';

export const VERDICT_SCORE: Record<Verdict, number> = {
  異常なし: 0,
  軽度: 1,
  要注意: 2,
  要精査: 3,
};

export interface Sentence {
  index: number;
  start: number;
  end: number;
  raw: string;
}

export interface Finding {
  id: string;
  category: CategoryKey;
  start: number;
  end: number;
  excerpt: string;
  note: string;
}

export interface CategoryResult {
  key: CategoryKey;
  label: string;
  verdict: Verdict;
  findings: Finding[];
  summary: string;
  metrics: Array<{ label: string; value: string }>;
  histogram?: Array<{ label: string; count: number }>;
}

export interface DiagnosisReport {
  text: string;
  sentences: Sentence[];
  categories: CategoryResult[];
  grade: 'A' | 'B' | 'C' | 'D';
  totalScore: number;
  maxScore: number;
  diagnosisType: string;
  charCount: number;
  sentenceCount: number;
}

export const CATEGORY_ORDER: CategoryKey[] = [
  'ga',
  'dougo',
  'length',
  'passive',
  'taigen',
  'conjunction',
];

export const CATEGORY_COLORS: Record<CategoryKey, string> = {
  ga: '#4fd8ff',
  dougo: '#c99bff',
  length: '#ffe066',
  passive: '#ff9a3d',
  taigen: '#ff6fae',
  conjunction: '#78e6a6',
};

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  ga: '「が」連続',
  dougo: '同語尾連続',
  length: '文長ばらつき',
  passive: '受動態',
  taigen: '体言止め',
  conjunction: '接続詞多用',
};
