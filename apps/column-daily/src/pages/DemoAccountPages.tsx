import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArticleCard } from '../components/article/ArticleCard';
import { PageShell } from '../components/layout/PageShell';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { SectionHeading } from '../components/ui/SectionHeading';
import { mostPopularFirst } from '../lib/selectors';
import '../components/article/article.css';
import './demo-account.css';

/**
 * Login / register / my page are presentation only.
 *
 * These screens deliberately contain **no credential inputs at all** — not
 * even a disabled password field. The site has no backend, so offering a
 * password box would invite people to type a real one into a page that cannot
 * protect it.
 */
function DemoNotice({ children }: { readonly children: ReactNode }) {
  return (
    <div className="demo-notice" role="note">
      <p className="label-caps demo-notice__label">Demonstration</p>
      <div className="demo-notice__body">{children}</div>
    </div>
  );
}

interface AccountShellProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly lede: string;
  readonly notice: ReactNode;
  readonly children?: ReactNode;
}

function AccountShell({ eyebrow, title, lede, notice, children }: AccountShellProps) {
  return (
    <PageShell crumbs={[{ label: 'トップ', to: '/' }, { label: title }]}>
      <PageHeader eyebrow={eyebrow} title={title} lede={lede} />
      <DemoNotice>{notice}</DemoNotice>
      {children}
      <div className="demo-actions">
        <Link className="press-button" to="/latest">
          新着コラムを読む
        </Link>
        <Link className="press-button press-button--ghost" to="/">
          トップへ戻る
        </Link>
      </div>
    </PageShell>
  );
}

export function LoginPage() {
  return (
    <AccountShell
      eyebrow="Login"
      title="ログイン"
      lede="会員の方はこちらからログインしていただく画面です。"
      notice={
        <>
          <p>
            この画面はデモンストレーションであり、<strong>認証は行われません</strong>。
            メールアドレスやパスワードの入力欄は、誤って実在の認証情報を入力してしまうことを
            避けるため、意図的に用意していません。
          </p>
          <p>
            コラムの閲覧・検索・カテゴリー一覧は、ログインなしですべてご利用いただけます。
          </p>
        </>
      }
    />
  );
}

export function RegisterPage() {
  return (
    <AccountShell
      eyebrow="Sign Up"
      title="会員登録"
      lede="コラムの保存や投稿ができる会員機能をご案内する画面です。"
      notice={
        <>
          <p>
            この画面はデモンストレーションであり、<strong>会員登録は行われません</strong>。
            個人情報の入力欄は用意しておらず、いかなる情報も収集・送信していません。
          </p>
          <p>
            投稿フォームの使い勝手は「
            <Link className="ink-link" to="/write">
              コラムを書く
            </Link>
            」からお試しいただけます（こちらも保存はされません）。
          </p>
        </>
      }
    />
  );
}

export function MyPage() {
  // Static stand-in content so the screen has something to look at. These are
  // not "the signed-in user's" articles — nobody is signed in.
  const saved = mostPopularFirst().slice(0, 3);

  return (
    <AccountShell
      eyebrow="My Page"
      title="マイページ"
      lede="保存したコラムや下書きを管理する画面です。"
      notice={
        <p>
          この画面はデモンストレーションです。ログイン状態は存在せず、下に並んでいるコラムは
          サンプルとして固定表示しているものです。保存・下書きの内容が記録されることはありません。
        </p>
      }
    >
      <section className="demo-section" aria-labelledby="saved-heading">
        <SectionHeading title="保存したコラム" eyebrow="Saved" level={2} moreLabel="人気のコラムへ" moreTo="/popular" />
        <div className="demo-grid" id="saved-heading">
          {saved.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>

      <section className="demo-section" aria-labelledby="drafts-heading">
        <SectionHeading title="下書き" eyebrow="Drafts" level={2} />
        <div id="drafts-heading">
          <EmptyState
            title="下書きはまだありません"
            description="書きかけのコラムはここに並びます。デモのため、実際には保存されません。"
            actionLabel="コラムを書く"
            actionTo="/write"
          />
        </div>
      </section>
    </AccountShell>
  );
}

export function NotFoundPage() {
  return (
    <PageShell>
      <EmptyState
        tone="alert"
        title="ページが見つかりませんでした"
        description="お探しのページは存在しないか、移動した可能性があります。ナビゲーションから目的のページをお選びください。"
        actionLabel="トップへ戻る"
        actionTo="/"
      />
    </PageShell>
  );
}
