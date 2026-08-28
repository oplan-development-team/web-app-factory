import { ARTICLES } from '../data/articles';
import type { Article, CategoryName } from '../data/types';

/**
 * All selectors return new arrays. The source corpus is never mutated,
 * so `.sort()` is always applied to a copy.
 */

export interface SeriesGroup {
  readonly name: string;
  readonly articles: readonly Article[];
}

export interface TagCount {
  readonly tag: string;
  readonly count: number;
}

function compareNewest(a: Article, b: Article): number {
  if (a.publishedAt !== b.publishedAt) {
    return a.publishedAt < b.publishedAt ? 1 : -1;
  }
  // Same day: fall back to popularity so ordering stays stable across renders.
  return b.popularity - a.popularity;
}

export function newestFirst(articles: readonly Article[] = ARTICLES): Article[] {
  return [...articles].sort(compareNewest);
}

export function mostPopularFirst(articles: readonly Article[] = ARTICLES): Article[] {
  return [...articles].sort((a, b) => b.popularity - a.popularity);
}

export function editorsPick(): Article {
  return ARTICLES.find((article) => article.isEditorsPick) ?? newestFirst()[0];
}

export function articlesInCategory(category: CategoryName): Article[] {
  return newestFirst(ARTICLES.filter((article) => article.category === category));
}

export function articlesWithTag(tag: string): Article[] {
  return newestFirst(ARTICLES.filter((article) => article.tags.includes(tag)));
}

export function countByCategory(category: CategoryName): number {
  return ARTICLES.reduce(
    (total, article) => (article.category === category ? total + 1 : total),
    0,
  );
}

export function seriesGroups(): SeriesGroup[] {
  const grouped = new Map<string, Article[]>();

  for (const article of ARTICLES) {
    if (!article.series) continue;
    const bucket = grouped.get(article.series.name);
    if (bucket) {
      bucket.push(article);
    } else {
      grouped.set(article.series.name, [article]);
    }
  }

  return [...grouped.entries()]
    .map(([name, articles]) => ({
      name,
      articles: [...articles].sort(
        (a, b) => (a.series?.episode ?? 0) - (b.series?.episode ?? 0),
      ),
    }))
    .sort((a, b) => b.articles.length - a.articles.length);
}

export function topTags(limit: number): TagCount[] {
  const counts = new Map<string, number>();

  for (const article of ARTICLES) {
    for (const tag of article.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ja'))
    .slice(0, limit);
}

/** Other articles worth reading after this one: same category first, then recent. */
export function relatedArticles(article: Article, limit: number): Article[] {
  const sameCategory = articlesInCategory(article.category).filter(
    (candidate) => candidate.id !== article.id,
  );
  const fallback = newestFirst().filter(
    (candidate) =>
      candidate.id !== article.id &&
      !sameCategory.some((picked) => picked.id === candidate.id),
  );

  return [...sameCategory, ...fallback].slice(0, limit);
}
