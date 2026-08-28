import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { CATEGORIES } from '../../data/categories';
import { countByCategory } from '../../lib/selectors';
import { CategoryIconGlyph } from '../ui/CategoryIconGlyph';

const PRIMARY_LINKS = [
  { to: '/', label: 'トップ', end: true },
  { to: '/latest', label: '新着コラム', end: false },
  { to: '/popular', label: '人気のコラム', end: false },
  { to: '/series', label: '連載一覧', end: false },
] as const;

export function NavBand() {
  const location = useLocation();
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLLIElement>(null);

  const isCategoryRoute = location.pathname.startsWith('/category');

  // Any navigation closes the menu, otherwise it stays open over the new page.
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  return (
    <nav className="nav-band page-width" aria-label="メインナビゲーション">
      <div className="nav-band__inner">
        <ul className="nav-band__list">
          {PRIMARY_LINKS.map((link) => (
            <li key={link.to} className="nav-band__item">
              <NavLink
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  isActive ? 'nav-band__link nav-band__link--current' : 'nav-band__link'
                }
              >
                {link.label}
              </NavLink>
            </li>
          ))}

          <li
            className="nav-band__item nav-band__item--dropdown"
            ref={dropdownRef}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
          >
            <button
              type="button"
              className={
                isCategoryRoute
                  ? 'nav-band__link nav-band__link--current nav-band__trigger'
                  : 'nav-band__link nav-band__trigger'
              }
              aria-expanded={isOpen}
              aria-controls={panelId}
              aria-haspopup="true"
              onClick={() => setIsOpen((open) => !open)}
            >
              カテゴリー
              <span className={isOpen ? 'nav-band__caret nav-band__caret--open' : 'nav-band__caret'} aria-hidden="true">
                ▾
              </span>
            </button>

            <div id={panelId} className="nav-dropdown" hidden={!isOpen}>
              <p className="label-caps nav-dropdown__eyebrow">Categories</p>
              <ul className="nav-dropdown__grid">
                {CATEGORIES.map((category) => (
                  <li key={category.slug}>
                    <Link className="nav-dropdown__entry" to={`/category/${category.slug}`}>
                      <CategoryIconGlyph icon={category.icon} size={18} />
                      <span className="nav-dropdown__name">{category.name}</span>
                      <span className="nav-dropdown__count">{countByCategory(category.name)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>

          <li className="nav-band__item">
            <NavLink
              to="/write"
              className={({ isActive }) =>
                isActive ? 'nav-band__link nav-band__link--current' : 'nav-band__link'
              }
            >
              コラムを書く
            </NavLink>
          </li>
        </ul>

        <NavLink
          to="/mypage"
          className={({ isActive }) =>
            isActive ? 'nav-band__mypage nav-band__mypage--current' : 'nav-band__mypage'
          }
        >
          マイページ
        </NavLink>
      </div>
    </nav>
  );
}
