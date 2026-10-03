import { useIsCompact, useMediaQuery } from '@/hooks';

/** A phone held sideways: wide, but too short for the desktop layout */
const SHORT_VIEWPORT_QUERY = '(max-height: 500px)';

/**
 * True where the page uses the phone layout: the match buttons are in the
 * bar at the bottom of the screen, and the session buttons at the end of
 * the page. The controls change what they show to suit (shorter labels,
 * Complete Session in the bar), so this has to agree with the layout's own
 * test.
 */
export const useCompactControls = (): boolean => {
  const isCompact = useIsCompact();
  const isShort = useMediaQuery(SHORT_VIEWPORT_QUERY);
  return isCompact || isShort;
};
