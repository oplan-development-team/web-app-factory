import { Link, useSearchParams } from 'react-router-dom';
import { ArticleListing } from '../components/article/ArticleListing';
import { PageShell } from '../components/layout/PageShell';
import { SearchBox } from '../components/layout/SearchBox';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { searchArticlesByTitle } from '../lib/search';
import { topTags } from '../lib/selectors';
import { usePageTitle } from '../lib/usePageTitle';
import '../components/article/article.css';
import './search-page.css';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') ?? '').trim();
  const results = searchArticlesByTitle(query);
  const suggestions = topTags(6);
  usePageTitle(query === '' ? 'コラムを検索' : `「${query}」の検索結果`);

  return (
    <PageShell crumbs={[{ label: 'トップ', to: '/' }, { label: '検索結果' }]}>
      <PageHeader
        eyebrow="Search"
        title={query === '' ? 'コラムを検索' : `「${query}」の検索結果`}
        lede="コラムのタイトルから探せます。"
        count={query === '' ? undefined : results.length}
      >
        <div className="search-page__form">
          <SearchBox id="search-page-input" className="search-box--page" />
        </div>
      </PageHeader>

      {query === '' ? (
        <div className="search-page__prompt">
          <EmptyState
            title="検索したい言葉を入力してください"
            description="コラムのタイトルに含まれる言葉で検索できます。下のタグから探すこともできます。"
            actionLabel="新着コラムを見る"
            actionTo="/latest"
          />
          <div className="search-page__suggestions">
            <p className="label-caps search-page__suggestions-label">Try these</p>
            <ul className="tag-cloud search-page__tags">
              {suggestions.map(({ tag }) => (
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
          </div>
        </div>
      ) : (
        <ArticleListing
          articles={results}
          emptyTitle="一致するコラムは見つかりませんでした"
          emptyDescription={`「${query}」を含むタイトルのコラムはありません。別の言葉に置き換えるか、新着コラムの一覧からお探しください。`}
        />
      )}
    </PageShell>
  );
}
