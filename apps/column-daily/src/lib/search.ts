import { ARTICLES } from '../data/articles';
import type { Article } from '../data/types';
import { newestFirst } from './selectors';

/**
 * Title-only, client-side substring search (SPEC FR-06).
 *
 * NFKC normalisation matters here: Japanese IMEs routinely produce full-width
 * latin characters, so a user typing "ＣＯＬＵＭＮ" should still match "column".
 */
function normalize(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase();
}

export function searchArticlesByTitle(query: string): Article[] {
  const needle = normalize(query);
  if (needle === '') {
    return [];
  }

  return newestFirst(
    ARTICLES.filter((article) => normalize(article.title).includes(needle)),
  );
}
