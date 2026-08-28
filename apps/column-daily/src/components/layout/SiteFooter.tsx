import { Link } from 'react-router-dom';
import { CATEGORIES } from '../../data/categories';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-width">
        <hr className="rule--double" />
        <div className="site-footer__grid">
          <div className="site-footer__colophon min-w-0">
            <p className="site-footer__logo">The Column Daily</p>
            <p className="site-footer__catch">言葉がつくる、わたしの景色。</p>
            <p className="site-footer__note">
              本サイトはデモンストレーションです。掲載しているコラム・著者・数値はすべて
              架空のもので、会員登録・ログイン・投稿は実際には行われません。
            </p>
          </div>

          <nav className="site-footer__nav" aria-label="カテゴリー">
            <p className="label-caps site-footer__heading">Categories</p>
            <ul className="site-footer__links">
              {CATEGORIES.map((category) => (
                <li key={category.slug}>
                  <Link className="ink-link" to={`/category/${category.slug}`}>
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="site-footer__nav" aria-label="読みもの">
            <p className="label-caps site-footer__heading">Reading</p>
            <ul className="site-footer__links">
              <li>
                <Link className="ink-link" to="/latest">
                  新着コラム
                </Link>
              </li>
              <li>
                <Link className="ink-link" to="/popular">
                  人気のコラム
                </Link>
              </li>
              <li>
                <Link className="ink-link" to="/series">
                  連載一覧
                </Link>
              </li>
              <li>
                <Link className="ink-link" to="/write">
                  コラムを書く
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <hr className="rule" />
        <p className="site-footer__copyright">
          <span>© The Column Daily</span>
          <span aria-hidden="true">・</span>
          <span>a static demo publication</span>
        </p>
      </div>
    </footer>
  );
}
