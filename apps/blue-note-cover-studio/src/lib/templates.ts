import type { TemplateMeta } from './types.ts';

export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'diagonal',
    num: 'A',
    name: 'ダイアゴナル・デュオトーン',
    description: '対角に裁ち落としたデュオトーン写真ブロック + 水平の極端字間タイトル',
  },
  {
    id: 'typography',
    num: 'B',
    name: 'タイポグラフィ・オンリー',
    description: '写真なし。色面グリッドの上に特大コンデンス文字を積層',
  },
  {
    id: 'circle',
    num: 'C',
    name: 'サークル・インセット',
    description: '円形クロップをオフセンター配置 + 90度回転の縦組みバンド名',
  },
  {
    id: 'grid',
    num: 'D',
    name: 'グリッド分割',
    description: 'スイス的な非対称グリッドで色面・写真・文字ブロックを配置',
  },
];

export function getTemplate(id: string): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]!;
}
