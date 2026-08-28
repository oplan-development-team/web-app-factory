import { Link } from 'react-router-dom';
import type { Article } from '../../data/types';
import { formatDotted } from '../../lib/format';
import { ArticleImage } from '../article/ArticleImage';
import { CategoryTag } from '../ui/CategoryTag';

interface RankingPanelProps {
  readonly articles: readonly Article[];
}

export function RankingPanel({ articles }: RankingPanelProps) {
  return (
    <section className="paper-panel sidebar-panel" aria-labelledby="ranking-heading">
      <div className="paper-panel__head">
        <h2 className="paper-panel__title" id="ranking-heading">
          人気ランキング
        </h2>
        <Link className="sidebar-panel__more ink-link" to="/popular">
          もっと見る
        </Link>
      </div>

      <ol className="ranking-list">
        {articles.map((article, index) => (
          <li className="ranking-item" key={article.id}>
            <span className={index < 3 ? 'ranking-item__no ranking-item__no--top' : 'ranking-item__no'}>
              {index + 1}
            </span>

            <Link
              className="ranking-item__media"
              to={`/articles/${article.id}`}
              tabIndex={-1}
              aria-hidden="true"
            >
              <span className="image-plate image-plate--thumb">
                <ArticleImage article={article} />
              </span>
            </Link>

            <div className="ranking-item__body min-w-0">
              <h3 className="ranking-item__title">
                <Link className="headline-link" to={`/articles/${article.id}`}>
                  {article.title}
                </Link>
              </h3>
              <div className="ranking-item__meta">
                <CategoryTag category={article.category} />
                <span className="meta meta__date">{formatDotted(article.publishedAt)}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
