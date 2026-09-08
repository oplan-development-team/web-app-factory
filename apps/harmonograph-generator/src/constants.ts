import type { PaperType } from './types';

/** プロッター送稿を想定した紙面の実寸 (正方形、mm)。 */
export const PAPER_SIZE_MM = 200;

export interface PaperDefinition {
  id: PaperType;
  label: string;
  base: string;
  fiber: string;
  vignette: string;
}

export const PAPERS: Record<PaperType, PaperDefinition> = {
  kinari: {
    id: 'kinari',
    label: '生成り紙',
    base: '#f3ecdd',
    fiber: '#d9cdae',
    vignette: 'rgba(60, 46, 24, 0.16)',
  },
  charcoal: {
    id: 'charcoal',
    label: 'チャコール紙',
    base: '#2b2823',
    fiber: '#3c372e',
    vignette: 'rgba(0, 0, 0, 0.35)',
  },
  graph: {
    id: 'graph',
    label: '方眼紙',
    base: '#ede7d6',
    fiber: '#b9ae8f',
    vignette: 'rgba(60, 46, 24, 0.14)',
  },
};

export const DEFAULT_INK = '#241d14';
export const DEFAULT_INK_LIGHT = '#e8dfc8';
export const DEFAULT_INK_2 = '#7a1f1f';
export const DEFAULT_INK_2_LIGHT = '#c9a227';
