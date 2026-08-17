import type { ReactNode } from 'react';

interface SectionProps {
  /** Editorial running number, e.g. "01". */
  index: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Section({ index, title, description, children }: SectionProps) {
  return (
    <section className="section">
      <header className="section__head">
        <span className="section__index" aria-hidden="true">
          {index}
        </span>
        <div>
          <h2 className="section__title">{title}</h2>
          {description && <p className="section__desc">{description}</p>}
        </div>
      </header>
      <div className="section__body">{children}</div>
    </section>
  );
}
