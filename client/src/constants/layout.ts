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
 * Routes that have a compact layout. Anything not listed still shows the
 * "use a computer" notice on a phone, so mobile support can ship one screen
 * at a time instead of all at once.
 *
 * (Raw strings, not `ROUTES.ACTIVE` etc. — `ROUTES` lives in `./index`,
 * which re-exports this file first, so importing it back here would be
 * circular.)
 */
export const MOBILE_READY_ROUTES: readonly string[] = [
  '/active',
  '/sessions',
  '/login',
  '/signup',
  '/forgot-password',
  '/analysis',
  '/compare',
  '/charts',
  '/profile',
  '/edit-session',
  '/shared/preview',
  '/join',
];
