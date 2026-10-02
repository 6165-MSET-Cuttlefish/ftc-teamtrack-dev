/**
 * Layout tokens shared by every responsive decision in the app.
 *
 * Breakpoints live here rather than inline so a component can never disagree
 * with Tailwind about where "compact" begins. `COMPACT_BREAKPOINT` must stay
 * in sync with Tailwind's `md` screen (tailwind.config.ts).
 */
export const COMPACT_BREAKPOINT = 768;

/** Matches `COMPACT_BREAKPOINT`, for `useMediaQuery` and friends. */
export const COMPACT_QUERY = `(max-width: ${COMPACT_BREAKPOINT - 1}px)`;

/**
 * Where the active-session page splits into two columns, with the breakdown
 * and Match Log pinned beside the scoring fields. Below it the page is one
 * long column. Must stay in sync with Tailwind's `lg` screen.
 */
export const SPLIT_BREAKPOINT = 1024;

/** Matches `SPLIT_BREAKPOINT`, for `useMediaQuery` and friends. */
export const SPLIT_QUERY = `(min-width: ${SPLIT_BREAKPOINT}px)`;
