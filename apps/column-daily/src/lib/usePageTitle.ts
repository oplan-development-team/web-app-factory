import { useEffect } from 'react';

const SITE_NAME = 'The Column Daily';

/**
 * Sets `document.title` per route. The app is a hash-router SPA, so the title
 * would otherwise stay on the home page value for every screen — which also
 * makes browser history and bookmarks unreadable.
 */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — 言葉がつくる、わたしの景色。`;
  }, [title]);
}
