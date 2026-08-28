import type { ReactNode } from 'react';

interface PageHeaderProps {
  readonly title: string;
  readonly eyebrow: string;
  readonly lede?: string;
  readonly count?: number;
  readonly children?: ReactNode;
}

export function PageHeader({ title, eyebrow, lede, count, children }: PageHeaderProps) {
  return (
    <header className="page-header">
      <p className="label-caps page-header__eyebrow">{eyebrow}</p>
      <h1 className="page-header__title">{title}</h1>
      {lede ? <p className="page-header__lede">{lede}</p> : null}
      {count !== undefined ? <p className="page-header__count">全 {count} 件</p> : null}
      {children}
    </header>
  );
}
