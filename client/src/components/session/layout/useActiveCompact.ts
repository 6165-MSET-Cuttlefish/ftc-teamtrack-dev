import { useIsCompact, useMediaQuery } from '@/hooks';

/** A viewport too short to stack the header, the clock and the controls. */
const SHORT_QUERY = '(max-height: 500px)';

/**
 * A phone on its side: short, but wide enough for the clock's column (see
 * `ActiveMobileLayout`) and a scoring column no narrower than a phone held
 * upright.
 */
const SHORT_WIDE_QUERY = '(max-height: 500px) and (min-width: 640px)';

/**
 * A phone on its side too narrow for that (an iPhone SE): the clock stays
 * above the scoring controls, on a screen with no height to spare under it.
 * Not under 400px wide, where the clock can't share a row with the title's
 * buttons: that is a phone held upright at 200% zoom (390 x 844 is
 * 195 x 422), laid out as a phone held upright.
 */
const SHORT_NARROW_QUERY =
  '(max-height: 500px) and (min-width: 400px) and (max-width: 639px)';

/**
 * True when the active-session page uses its phone layout: a phone-width
 * viewport, or one too short for the full-size layout (a phone on its side,
 * a squashed browser window). The header follows the same rule so the two
 * never disagree about which layout is up.
 */
export const useActiveCompact = (): boolean => {
  const narrow = useIsCompact();
  const short = useActiveShort();
  return narrow || short;
};

/**
 * True on a viewport too short to give the site header its usual height: a
 * phone on its side. The header slims down, and only stays pinned while a
 * match is running.
 */
export const useActiveShort = (): boolean => useMediaQuery(SHORT_QUERY);

/**
 * True when the phone layout has room to put the clock beside the scoring
 * controls instead of above them.
 */
export const useActiveSideBySide = (): boolean =>
  useMediaQuery(SHORT_WIDE_QUERY);

/**
 * True when the phone layout is stacked on a screen too short for the lines
 * under the clock (see `ActiveMobileLayout`).
 */
export const useActiveShortStacked = (): boolean =>
  useMediaQuery(SHORT_NARROW_QUERY);
