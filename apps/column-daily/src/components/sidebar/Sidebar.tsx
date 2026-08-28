import { mostPopularFirst, topTags } from '../../lib/selectors';
import { CategoryPanel } from './CategoryPanel';
import { RankingPanel } from './RankingPanel';
import { TagPanel } from './TagPanel';
import './sidebar.css';

export function Sidebar() {
  const ranked = mostPopularFirst().slice(0, 5);
  const tags = topTags(10);

  return (
    <aside className="sidebar" aria-label="サイド情報">
      <RankingPanel articles={ranked} />
      <CategoryPanel />
      <TagPanel tags={tags} />
    </aside>
  );
}
