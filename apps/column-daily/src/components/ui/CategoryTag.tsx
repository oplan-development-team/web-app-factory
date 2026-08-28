import { Link } from 'react-router-dom';
import { categorySlug } from '../../data/categories';
import type { CategoryName } from '../../data/types';

interface CategoryTagProps {
  readonly category: CategoryName;
  readonly asLink?: boolean;
}

export function CategoryTag({ category, asLink = true }: CategoryTagProps) {
  if (!asLink) {
    return <span className="category-tag">{category}</span>;
  }

  return (
    <Link className="category-tag category-tag--link" to={`/category/${categorySlug(category)}`}>
      {category}
    </Link>
  );
}
