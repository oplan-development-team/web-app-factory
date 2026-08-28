import { Link } from 'react-router-dom';
import type { TagCount } from '../../lib/selectors';

interface TagPanelProps {
  readonly tags: readonly TagCount[];
}

export function TagPanel({ tags }: TagPanelProps) {
  return (
    <section className="paper-panel sidebar-panel" aria-labelledby="tag-heading">
      <div className="paper-panel__head">
        <h2 className="paper-panel__title" id="tag-heading">
          注目のタグ
        </h2>
      </div>

      <ul className="tag-cloud">
        {tags.map(({ tag, count }) => (
          <li key={tag}>
            <Link className="tag-chip" to={`/tag/${encodeURIComponent(tag)}`}>
              <span className="tag-chip__hash" aria-hidden="true">
                #
              </span>
              {tag}
              <span className="tag-chip__count">{count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
