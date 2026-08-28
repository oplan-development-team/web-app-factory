import { Link } from 'react-router-dom';
import type { Article } from '../../data/types';
import { formatDotted } from '../../lib/format';
import { AuthorLine } from '../ui/AuthorLine';
import { CategoryTag } from '../ui/CategoryTag';
import { ArticleImage } from './ArticleImage';

interface ArticleListRowProps {
  readonly article: Article;
  /** Ordinal shown in ranked listings. */
  readonly rank?: number;
}

export function ArticleListRow({ article, rank }: ArticleListRowProps) {
  return (
    <article className="list-row">
      {rank !== undefined ? (
        <p className={rank <= 3 ? 'list-row__rank list-row__rank--top' : 'list-row__rank'}>
          {rank}
        </p>
      ) : null}

      <Link className="list-row__media" to={`/articles/${article.id}`} tabIndex={-1} aria-hidden="true">
        <span className="image-plate image-plate--row">
          <ArticleImage article={article} />
        </span>
      </Link>

      <div className="list-row__body min-w-0">
        <div className="list-row__tagline">
          <CategoryTag category={article.category} />
          {article.series ? (
            <span className="list-row__series">
              {article.series.name}・第{article.series.episode}回
            </span>
          ) : null}
        </div>

        <h3 className="list-row__title">
          <Link className="headline-link" to={`/articles/${article.id}`}>
            {article.title}
          </Link>
        </h3>

        <p className="list-row__excerpt">{article.excerpt}</p>

        <div className="list-row__foot">
          <AuthorLine author={article.author} />
          <span className="meta meta__date">{formatDotted(article.publishedAt)}</span>
          <span className="meta">読了 約{article.readMinutes}分</span>
        </div>
      </div>
    </article>
  );
}
