import type { Article } from '../../data/types';
import { EmptyState } from '../ui/EmptyState';
import { ArticleListRow } from './ArticleListRow';

interface ArticleListingProps {
  readonly articles: readonly Article[];
  /** Show 1..n ordinals — used by the popularity listing. */
  readonly ranked?: boolean;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
}

export function ArticleListing({
  articles,
  ranked = false,
  emptyTitle,
  emptyDescription,
}: ArticleListingProps) {
  if (articles.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="article-listing">
      {articles.map((article, index) => (
        <ArticleListRow
          key={article.id}
          article={article}
          rank={ranked ? index + 1 : undefined}
        />
      ))}
    </div>
  );
}
