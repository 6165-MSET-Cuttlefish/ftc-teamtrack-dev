import { useCallback, useSyncExternalStore } from 'react';

import { COMPACT_QUERY } from '@/constants';

const getServerSnapshot = () => false;

/**
 * Subscribes to a CSS media query.
 *
 * Uses `useSyncExternalStore` so the value is read during render rather than
 * in an effect — a layout that switches on this never paints the wrong
 * variant first and then swaps.
 *
 * `subscribe` keeps its identity for as long as the query does: React
 * re-subscribes whenever it changes, so an inline function would take the
 * listener off the MediaQueryList and put it back on every render.
 */
export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(
    () =>
      typeof window === 'undefined' ? false : window.matchMedia(query).matches,
    [query]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

/**
 * True on phone-width viewports. The single source of truth for "should this
 * render the compact layout" — do not re-derive it with another breakpoint.
 */
export const useIsCompact = (): boolean => useMediaQuery(COMPACT_QUERY);
