import { Link } from 'react-router-dom';
import type { Article } from '../../data/types';
import { formatDotted } from '../../lib/format';
import { AuthorLine } from '../ui/AuthorLine';
import { CategoryTag } from '../ui/CategoryTag';
import { ArticleImage } from './ArticleImage';

interface FeatureArticleProps {
  readonly article: Article;
}

export function FeatureArticle({ article }: FeatureArticleProps) {
  return (
    <article className="feature">
      <div className="feature__grid">
        <div className="feature__text min-w-0">
          <h2 className="feature__title">
            <Link className="headline-link" to={`/articles/${article.id}`}>
              {article.title}
            </Link>
          </h2>

          <div className="feature__meta">
            <CategoryTag category={article.category} />
            <span className="meta meta__date">{formatDotted(article.publishedAt)}</span>
          </div>

          <p className="feature__excerpt">{article.excerpt}</p>

          <div className="feature__byline">
            <AuthorLine author={article.author} size="md" prefix />
            <span className="meta feature__readtime">読了 約{article.readMinutes}分</span>
          </div>
        </div>

        <div className="feature__media min-w-0">
          <p className="label-caps label-caps--accent feature__pick">Editor&apos;s Pick</p>
          <Link className="feature__media-link" to={`/articles/${article.id}`} tabIndex={-1} aria-hidden="true">
            <span className="image-plate image-plate--feature">
              <ArticleImage article={article} />
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}
