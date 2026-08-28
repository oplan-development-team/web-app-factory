import { Link } from 'react-router-dom';
import { formatIssueDate } from '../../lib/format';
import { SearchBox } from './SearchBox';

function SunGlyph() {
  return (
    <svg className="utility-bar__weather-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 2.6v3M12 18.4v3M2.6 12h3M18.4 12h3" />
        <path d="M5.4 5.4 7.5 7.5M16.5 16.5l2.1 2.1M18.6 5.4 16.5 7.5M7.5 16.5l-2.1 2.1" />
      </g>
    </svg>
  );
}

export function SiteHeader() {
  const issueDate = formatIssueDate(new Date());

  return (
    <header className="site-header">
      <div className="page-width">
        <div className="utility-bar">
          <p className="utility-bar__issue">
            <SunGlyph />
            <span className="utility-bar__temp">23℃</span>
            <span className="utility-bar__divider" aria-hidden="true" />
            <span className="utility-bar__date">{issueDate}</span>
          </p>

          <div className="utility-bar__account">
            <Link className="ink-link utility-bar__link" to="/login">
              ログイン
            </Link>
            <span className="utility-bar__divider" aria-hidden="true" />
            <Link className="ink-link utility-bar__link" to="/register">
              会員登録
            </Link>
            <SearchBox id="header-search" className="search-box--header" />
          </div>
        </div>

        <hr className="rule--strong draw-rule" />

        <div className="masthead">
          <p className="masthead__aside masthead__aside--left print-in">
            さまざまな視点が
            <br />
            あたらしい気づきを生む
          </p>

          <div className="masthead__center">
            <Link className="masthead__logo-link" to="/">
              <span className="masthead__logo print-in">The Column Daily</span>
            </Link>
            <p className="masthead__catch print-in">言葉がつくる、わたしの景色。</p>
          </div>

          <div className="masthead__aside masthead__aside--right print-in">
            <p className="label-caps masthead__today">Today&apos;s Paper</p>
            <p className="masthead__today-note">最新の注目コラムを毎日お届け</p>
          </div>
        </div>

        <hr className="rule--double draw-rule masthead__closing-rule" />
      </div>
    </header>
  );
}
