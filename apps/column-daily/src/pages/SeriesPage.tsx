import { Link } from 'react-router-dom';
import { ArticleImage } from '../components/article/ArticleImage';
import { PageShell } from '../components/layout/PageShell';
import { AuthorLine } from '../components/ui/AuthorLine';
import { CategoryTag } from '../components/ui/CategoryTag';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { formatDotted } from '../lib/format';
import { seriesGroups } from '../lib/selectors';
import { usePageTitle } from '../lib/usePageTitle';
import '../components/article/article.css';
import './series-page.css';

export function SeriesPage() {
  usePageTitle('連載一覧');
  const groups = seriesGroups();

  return (
    <PageShell crumbs={[{ label: 'トップ', to: '/' }, { label: '連載一覧' }]}>
      <PageHeader
        eyebrow="Series"
        title="連載一覧"
        lede="ひとつのテーマを続けて書いているコラムをまとめています。第1回から順にどうぞ。"
        count={groups.length}
      />

      {groups.length === 0 ? (
        <EmptyState
          title="連載はまだありません"
          description="連載が始まるとここに並びます。新着コラムの一覧もご覧ください。"
          actionLabel="新着コラムを見る"
          actionTo="/latest"
        />
      ) : (
        <div className="series-list">
          {groups.map((group) => (
            <section className="series-block" key={group.name} aria-label={group.name}>
              <div className="series-block__head">
                <h2 className="series-block__name">{group.name}</h2>
                <p className="meta series-block__count">全{group.articles.length}回・更新中</p>
              </div>

              <ol className="series-block__episodes">
                {group.articles.map((article) => (
                  <li className="episode" key={article.id}>
                    <p className="label-caps episode__no">{`Ep.${String(article.series?.episode ?? 0).padStart(2, '0')}`}</p>

                    <Link
                      className="episode__media"
                      to={`/articles/${article.id}`}
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      <span className="image-plate image-plate--card">
                        <ArticleImage article={article} />
                      </span>
                    </Link>

                    <div className="episode__body min-w-0">
                      <h3 className="episode__title">
                        <Link className="headline-link" to={`/articles/${article.id}`}>
                          {article.title}
                        </Link>
                      </h3>
                      <p className="episode__excerpt">{article.excerpt}</p>
                      <div className="episode__foot">
                        <CategoryTag category={article.category} />
                        <AuthorLine author={article.author} />
                        <span className="meta meta__date">{formatDotted(article.publishedAt)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}
