import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Restores the reading position on navigation (SPEC UX-05). Without this the
 * router keeps the previous scroll offset and a new article opens mid-page.
 */
export function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, search]);

  return null;
}
