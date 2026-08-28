import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface SectionHeadingProps {
  readonly title: string;
  /** Small latin eyebrow printed above the title. */
  readonly eyebrow?: string;
  readonly moreLabel?: string;
  readonly moreTo?: string;
  readonly level?: 2 | 3;
  readonly children?: ReactNode;
}

export function SectionHeading({
  title,
  eyebrow,
  moreLabel,
  moreTo,
  level = 2,
  children,
}: SectionHeadingProps) {
  const Tag = level === 2 ? 'h2' : 'h3';

  return (
    <div className="section-heading">
      <div className="section-heading__text min-w-0">
        {eyebrow ? <p className="label-caps section-heading__eyebrow">{eyebrow}</p> : null}
        <Tag className="section-heading__title">{title}</Tag>
        {children ? <p className="section-heading__lede">{children}</p> : null}
      </div>
      {moreTo && moreLabel ? (
        <Link className="section-heading__more ink-link" to={moreTo}>
          {moreLabel}
          <span aria-hidden="true"> →</span>
        </Link>
      ) : null}
    </div>
  );
}
