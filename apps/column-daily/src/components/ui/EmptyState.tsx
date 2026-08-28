import { Link } from 'react-router-dom';

interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly actionTo?: string;
  readonly tone?: 'quiet' | 'alert';
}

/**
 * Shared empty / error surface. Every dead end in the app routes through this
 * so the user always gets a reason and a way forward (SPEC UX-01 / UX-02).
 */
export function EmptyState({
  title,
  description,
  actionLabel = 'トップへ戻る',
  actionTo = '/',
  tone = 'quiet',
}: EmptyStateProps) {
  return (
    <div className={`empty-state empty-state--${tone}`} role={tone === 'alert' ? 'alert' : undefined}>
      <svg
        className="empty-state__mark"
        viewBox="0 0 72 56"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="4" y="4" width="64" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 16h64" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M14 26h20M14 34h28M14 42h14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path d="M48 28l14 14M62 28l-14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__description">{description}</p>
      <Link className="press-button press-button--ghost" to={actionTo}>
        {actionLabel}
      </Link>
    </div>
  );
}
