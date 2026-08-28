import { Link } from 'react-router-dom';
import { CATEGORIES } from '../../data/categories';
import { countByCategory } from '../../lib/selectors';
import { CategoryIconGlyph } from '../ui/CategoryIconGlyph';

export function CategoryPanel() {
  return (
    <section className="paper-panel sidebar-panel" aria-labelledby="category-heading">
      <div className="paper-panel__head">
        <h2 className="paper-panel__title" id="category-heading">
          カテゴリー
        </h2>
        <Link className="sidebar-panel__more ink-link" to="/latest">
          一覧を見る
        </Link>
      </div>

      <ul className="category-grid">
        {CATEGORIES.map((category) => (
          <li key={category.slug}>
            <Link className="category-grid__entry" to={`/category/${category.slug}`}>
              <CategoryIconGlyph icon={category.icon} size={18} />
              <span className="category-grid__name">{category.name}</span>
              <span className="category-grid__count">{countByCategory(category.name)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
