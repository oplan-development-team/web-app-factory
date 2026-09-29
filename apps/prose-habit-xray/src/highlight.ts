import type { CategoryKey, Finding } from './types';
import { CATEGORY_ORDER } from './types';

export interface Segment {
  start: number;
  end: number;
  categories: CategoryKey[];
  findingIds: string[];
}

/**
 * 複数の findings (start/end レンジ) を、重なりを考慮して
 * 「同じカテゴリ集合が適用される」連続区間の並びに変換する。
 */
export function buildSegments(text: string, findings: Finding[]): Segment[] {
  if (findings.length === 0) {
    return [{ start: 0, end: text.length, categories: [], findingIds: [] }];
  }

  const boundarySet = new Set<number>([0, text.length]);
  findings.forEach((f) => {
    boundarySet.add(f.start);
    boundarySet.add(f.end);
  });
  const boundaries = Array.from(boundarySet).sort((a, b) => a - b);

  const segments: Segment[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    if (start >= end) continue;
    const covering = findings.filter((f) => f.start <= start && f.end >= end);
    const categories = CATEGORY_ORDER.filter((c) =>
      covering.some((f) => f.category === c),
    );
    const findingIds = covering.map((f) => f.id);
    segments.push({ start, end, categories, findingIds });
  }
  return segments;
}
