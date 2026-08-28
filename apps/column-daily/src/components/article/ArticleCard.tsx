import { Link } from 'react-router-dom';
import type { Article } from '../../data/types';
import { formatDotted } from '../../lib/format';
import { AuthorLine } from '../ui/AuthorLine';
import { CategoryTag } from '../ui/CategoryTag';
import { ArticleImage } from './ArticleImage';

interface ArticleCardProps {
  readonly article: Article;
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <article className="article-card min-w-0">
      <Link className="article-card__media" to={`/articles/${article.id}`} tabIndex={-1} aria-hidden="true">
        <span className="image-plate image-plate--card">
          <ArticleImage article={article} />
        </span>
      </Link>

      <div className="article-card__tagline">
        <CategoryTag category={article.category} />
      </div>

      <h3 className="article-card__title">
        <Link className="headline-link" to={`/articles/${article.id}`}>
          {article.title}
        </Link>
      </h3>

      <div className="article-card__foot">
        <AuthorLine author={article.author} />
        <span className="meta meta__date">{formatDotted(article.publishedAt)}</span>
      </div>
    </article>
  );
}
