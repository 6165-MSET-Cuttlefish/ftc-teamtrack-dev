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

/**
 * The column a page lays its content out in: at most 1152px, centred, with
 * the side padding stepping up at each breakpoint (the Sessions page's).
 * The site header keeps to it too, so the ends of the header line up with
 * the content under it.
 */
export const PAGE_CONTAINER =
  'max-w-[1152px] mx-auto px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8';

/**
 * Where the scoring page's content starts and ends in its full-size layout
 * (a tablet or laptop): its own column, 1152px wide with `md:px-6 lg:px-8`
 * (Active.tsx), plus the `px-4` every section of ActiveDesktopLayout adds
 * inside it. The site header keeps to it on that page instead of
 * `PAGE_CONTAINER`, so its ends line up with the scoring fields under it.
 * That layout is only up from `md`, hence no smaller steps.
 */
export const ACTIVE_PAGE_CONTAINER = 'max-w-6xl mx-auto px-10 lg:px-12';
