import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Crumb {
  readonly label: string;
  readonly to?: string;
}

interface PageShellProps {
  readonly children: ReactNode;
  /** Breadcrumb trail; the last entry renders as the current page. */
  readonly crumbs?: readonly Crumb[];
  readonly wide?: boolean;
}

/**
 * Inner-page wrapper. The home page composes its own grid, so it does not
 * use this shell.
 */
export function PageShell({ children, crumbs, wide = false }: PageShellProps) {
  return (
    <div className={wide ? 'page-shell page-shell--wide' : 'page-shell'}>
      {crumbs && crumbs.length > 0 ? (
        <nav className="breadcrumbs" aria-label="パンくずリスト">
          <ol className="breadcrumbs__list">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} className="breadcrumbs__item">
                  {crumb.to && !isLast ? (
                    <Link className="ink-link" to={crumb.to}>
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current={isLast ? 'page' : undefined}>{crumb.label}</span>
                  )}
                  {!isLast ? (
                    <span className="breadcrumbs__sep" aria-hidden="true">
                      ／
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
      {children}
    </div>
  );
}
