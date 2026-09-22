import { useSyncExternalStore } from 'react';

import { COMPACT_QUERY } from '@/constants';

/**
 * Subscribes to a CSS media query.
 *
 * Uses `useSyncExternalStore` so the value is read during render rather than
 * in an effect — a layout that switches on this never paints the wrong
 * variant first and then swaps.
 */
export const useMediaQuery = (query: string): boolean => {
  const subscribe = (onChange: () => void) => {
    if (typeof window === 'undefined') return () => {};
    const list = window.matchMedia(query);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  };

  const getSnapshot = () =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches;

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
};

/**
 * True on phone-width viewports. The single source of truth for "should this
 * render the compact layout" — do not re-derive it with another breakpoint.
 */
export const useIsCompact = (): boolean => useMediaQuery(COMPACT_QUERY);
