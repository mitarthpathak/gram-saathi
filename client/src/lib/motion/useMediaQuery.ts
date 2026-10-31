import { useCallback, useSyncExternalStore } from 'react';

/** Desktop layout: the app opens as a framed phone over the landing page. */
export const DESKTOP_QUERY = '(min-width: 64rem)';

/** Live result of a CSS media query. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
