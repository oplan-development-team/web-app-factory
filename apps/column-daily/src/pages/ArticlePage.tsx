import { Link, useParams } from 'react-router-dom';
import { ArticleImage } from '../components/article/ArticleImage';
import { PageShell } from '../components/layout/PageShell';
import { AuthorLine } from '../components/ui/AuthorLine';
import { CategoryTag } from '../components/ui/CategoryTag';
import { EmptyState } from '../components/ui/EmptyState';
import { SectionHeading } from '../components/ui/SectionHeading';
import { findArticleById } from '../data/articles';
import { categorySlug } from '../data/categories';
import { formatLongDate } from '../lib/format';
import { relatedArticles, seriesGroups } from '../lib/selectors';
import { usePageTitle } from '../lib/usePageTitle';
import { ArticleCard } from '../components/article/ArticleCard';
import '../components/article/article.css';
import './article-page.css';

export function ArticlePage() {
  const { id } = useParams();
  const article = findArticleById(id);
  usePageTitle(article ? article.title : 'コラムが見つかりません');

  if (!article) {
    return (
      <PageShell>
        <EmptyState
          tone="alert"
          title="コラムが見つかりませんでした"
          description="お探しのコラムは削除されたか、URLが正しくない可能性があります。新着コラムの一覧からお探しください。"
          actionLabel="新着コラムを見る"
          actionTo="/latest"
        />
      </PageShell>
    );
  }

  const related = relatedArticles(article, 3);
  const group = article.series
    ? seriesGroups().find((candidate) => candidate.name === article.series?.name)
    : undefined;

  return (
    <PageShell
      crumbs={[
        { label: 'トップ', to: '/' },
        { label: article.category, to: `/category/${categorySlug(article.category)}` },
        { label: article.title },
      ]}
    >
      <article className="article-page">
        <header className="article-page__header">
          <div className="article-page__tagline">
            <CategoryTag category={article.category} />
            {article.series ? (
              <span className="article-page__series-badge">
                {article.series.name}・第{article.series.episode}回
              </span>
            ) : null}
          </div>

          <h1 className="article-page__title">{article.title}</h1>

          <div className="article-page__dateline">
            <AuthorLine author={article.author} size="lg" />
            <span className="meta meta__date">{formatLongDate(article.publishedAt)}</span>
            <span className="meta">読了 約{article.readMinutes}分</span>
          </div>
        </header>

        <figure className="article-page__figure">
          <span className="image-plate image-plate--banner">
            <ArticleImage article={article} screenPitch={1.6} />
          </span>
          <figcaption className="article-page__caption">
            挿絵はカテゴリーごとの意匠を記事ごとに変えて描いています
          </figcaption>
        </figure>

        <div className="article-page__body">
          <p className="article-page__lede">{article.excerpt}</p>
          {article.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        <ul className="article-page__tags">
          {article.tags.map((tag) => (
            <li key={tag}>
              <Link className="tag-chip" to={`/tag/${encodeURIComponent(tag)}`}>
                <span className="tag-chip__hash" aria-hidden="true">
                  #
                </span>
                {tag}
              </Link>
            </li>
          ))}
        </ul>

        <aside className="article-page__author paper-panel">
          <div className="paper-panel__head">
            <h2 className="paper-panel__title">この記事を書いた人</h2>
          </div>
          <div className="paper-panel__body article-page__author-body">
            <AuthorLine author={article.author} size="lg" />
            <p className="article-page__author-bio">{article.author.bio}</p>
          </div>
        </aside>

        {group && group.articles.length > 1 ? (
          <section className="article-page__series" aria-labelledby="series-nav-heading">
            <SectionHeading title={group.name} eyebrow="Series" level={3} />
            <ol className="series-nav" id="series-nav-heading">
              {group.articles.map((episode) => {
                const isCurrent = episode.id === article.id;
                return (
                  <li key={episode.id} className={isCurrent ? 'series-nav__item series-nav__item--current' : 'series-nav__item'}>
                    <span className="series-nav__no">第{episode.series?.episode}回</span>
                    {isCurrent ? (
                      <span className="series-nav__title" aria-current="true">
                        {episode.title}
                        <span className="series-nav__now">（この記事）</span>
                      </span>
                    ) : (
                      <Link className="series-nav__title ink-link" to={`/articles/${episode.id}`}>
                        {episode.title}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        <section className="article-page__related" aria-labelledby="related-heading">
          <SectionHeading
            title="あわせて読みたい"
            eyebrow="Read Next"
            level={3}
            moreLabel={`${article.category}の一覧へ`}
            moreTo={`/category/${categorySlug(article.category)}`}
          />
          <div className="related-grid" id="related-heading">
            {related.map((candidate) => (
              <ArticleCard key={candidate.id} article={candidate} />
            ))}
          </div>
        </section>
      </article>
    </PageShell>
  );
}
