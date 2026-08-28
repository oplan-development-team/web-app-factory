import { useParams } from 'react-router-dom';
import { ArticleListing } from '../components/article/ArticleListing';
import { PageShell } from '../components/layout/PageShell';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { findCategoryBySlug } from '../data/categories';
import {
  articlesInCategory,
  articlesWithTag,
  mostPopularFirst,
  newestFirst,
} from '../lib/selectors';
import '../components/article/article.css';

export function LatestPage() {
  const articles = newestFirst();

  return (
    <PageShell crumbs={[{ label: 'トップ', to: '/' }, { label: '新着コラム' }]}>
      <PageHeader
        eyebrow="Latest"
        title="新着コラム"
        lede="公開されたばかりのコラムを、新しい順にすべて並べています。"
        count={articles.length}
      />
      <ArticleListing
        articles={articles}
        emptyTitle="コラムがまだありません"
        emptyDescription="新しいコラムが公開されるとここに並びます。"
      />
    </PageShell>
  );
}

export function PopularPage() {
  const articles = mostPopularFirst();

  return (
    <PageShell crumbs={[{ label: 'トップ', to: '/' }, { label: '人気のコラム' }]}>
      <PageHeader
        eyebrow="Popular"
        title="人気のコラム"
        lede="よく読まれているコラムを順位つきで並べています。"
        count={articles.length}
      />
      <ArticleListing
        articles={articles}
        ranked
        emptyTitle="ランキングを作成できませんでした"
        emptyDescription="対象となるコラムがありません。"
      />
    </PageShell>
  );
}

export function CategoryPage() {
  const { slug } = useParams();
  const category = findCategoryBySlug(slug);

  if (!category) {
    return (
      <PageShell>
        <EmptyState
          tone="alert"
          title="カテゴリーが見つかりませんでした"
          description="指定されたカテゴリーは存在しません。ナビゲーションの「カテゴリー」から選び直してください。"
          actionLabel="新着コラムを見る"
          actionTo="/latest"
        />
      </PageShell>
    );
  }

  const articles = articlesInCategory(category.name);

  return (
    <PageShell
      crumbs={[{ label: 'トップ', to: '/' }, { label: 'カテゴリー' }, { label: category.name }]}
    >
      <PageHeader
        eyebrow="Category"
        title={category.name}
        lede={category.blurb}
        count={articles.length}
      />
      <ArticleListing
        articles={articles}
        emptyTitle="このカテゴリーのコラムはまだありません"
        emptyDescription="ほかのカテゴリーか、新着コラムの一覧をご覧ください。"
      />
    </PageShell>
  );
}

export function TagPage() {
  const { tag } = useParams();
  const decoded = tag ? decodeURIComponent(tag) : '';
  const articles = decoded ? articlesWithTag(decoded) : [];

  return (
    <PageShell crumbs={[{ label: 'トップ', to: '/' }, { label: 'タグ' }, { label: decoded || 'タグ' }]}>
      <PageHeader
        eyebrow="Tag"
        title={`#${decoded}`}
        lede="このタグがついたコラムを新しい順に並べています。"
        count={articles.length}
      />
      <ArticleListing
        articles={articles}
        emptyTitle="このタグのコラムは見つかりませんでした"
        emptyDescription="タグ名が正しくないか、該当するコラムがまだありません。サイドバーの「注目のタグ」からお選びください。"
      />
    </PageShell>
  );
}
