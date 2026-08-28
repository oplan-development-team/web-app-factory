import { useMemo } from 'react';
import type { Author } from '../../data/types';
import { createSeededRandom } from '../../lib/seed';

/**
 * Bylines carry a small engraved portrait rather than a fetched avatar.
 * Same rule as article artwork: deterministic from the author's name.
 */
function AuthorMark({ name, size }: { readonly name: string; readonly size: number }) {
  const { tone, shoulder, tilt } = useMemo(() => {
    const random = createSeededRandom(`author:${name}`);
    const tones = ['#8d7d5f', '#a08d68', '#75694f', '#b09a72'];
    return {
      tone: random.pick(tones),
      shoulder: random.range(15.5, 18),
      tilt: random.range(-6, 6),
    };
  }, [name]);

  return (
    <svg
      className="author-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="16" cy="16" r="16" fill="#e6dcc6" />
      <g transform={`rotate(${tilt} 16 16)`}>
        <circle cx="16" cy="13" r="6.4" fill={tone} />
        <path d={`M4.4 32 Q16 ${shoulder} 27.6 32 Z`} fill={tone} />
      </g>
      <circle cx="16" cy="16" r="15" fill="none" stroke="rgba(44,38,30,0.35)" strokeWidth="1" />
    </svg>
  );
}

interface AuthorLineProps {
  readonly author: Author;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly prefix?: boolean;
}

const MARK_SIZE = { sm: 20, md: 26, lg: 40 } as const;

export function AuthorLine({ author, size = 'sm', prefix = false }: AuthorLineProps) {
  return (
    <span className={`author-line author-line--${size}`}>
      <AuthorMark name={author.name} size={MARK_SIZE[size]} />
      <span className="author-line__name">
        {prefix ? <span className="author-line__by">by </span> : null}
        {author.name}
      </span>
    </span>
  );
}
