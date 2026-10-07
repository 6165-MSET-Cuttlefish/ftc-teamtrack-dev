import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants';

/** Marks the duplicate history entry the guard puts on top of the page's own. */
const GUARD_KEY = '__guard';

/** How long a confirmed leave has to take effect before the guards re-arm. */
const LEAVE_GRACE_MS = 2000;

/**
 * A performance.now() reading, not the time of day: setting the device clock
 * back must not reopen the window and leave the page unguarded.
 */
let allowedUntil = 0;

const isNavigationAllowed = (): boolean => performance.now() < allowedUntil;

/**
 * Let navigation through unasked for the next moment. For when the user has
 * already confirmed, in this hook's dialog or in one of the caller's own
 * (signing out, say), so they are never asked twice. It is a window rather
 * than a single pass because going back through history, and a page unload,
 * only happen after the code that asked for them has returned.
 */
export const allowNavigation = (): void => {
  allowedUntil = performance.now() + LEAVE_GRACE_MS;
};

/** An in-app navigation held back to ask about first. */
interface PendingNavigation {
  /** The URL it was going to, search and hash included. */
  path: string;
  /** The router state it carried, passed on when it goes ahead. */
  state: unknown;
}

/** The router keeps a navigation's own state under `usr` in the entry. */
const routerStateOf = (data: unknown): unknown =>
  data && typeof data === 'object'
    ? (data as { usr?: unknown }).usr
    : undefined;

const isGuardEntry = (): boolean =>
  (window.history.state as Record<string, unknown> | null)?.[GUARD_KEY] ===
  true;

/**
 * The router's number for the current entry. A guard entry carries its
 * page's, so the two read the same.
 */
const entryIdx = (): unknown =>
  (window.history.state as { idx?: unknown } | null)?.idx;

/** The current entry's number when it is a guard entry, else null */
const guardIdxOf = (): unknown => (isGuardEntry() ? entryIdx() : null);

/**
 * Put a copy of the current entry on top of the stack, so that Back lands on
 * the same page (where it can be asked about) instead of leaving it. The copy
 * keeps the router's own state, `idx` included.
 */
const pushGuardEntry = (): void => {
  window.history.pushState(
    { ...window.history.state, [GUARD_KEY]: true },
    '',
    window.location.href
  );
};

/** `askBefore`'s default, one array for every render */
const NO_PATHS: readonly string[] = [];

/** The path part of an in-app URL */
const pathnameOf = (url: string): string =>
  new URL(url, window.location.origin).pathname;

/**
 * Hook that blocks navigation when there is unsaved work.
 *
 * Uses `beforeunload` for tab close / refresh, and intercepts in-app
 * navigation via the History `popstate` event (back/forward buttons) and
 * by patching `history.pushState` / `history.replaceState`.  This avoids the
 * need for `useBlocker`, which requires a data-router setup
 * (`createBrowserRouter` / `RouterProvider`).
 */
export const useNavigationGuard = (
  shouldBlock: boolean,
  message?: string,
  {
    beforeUnload = true,
    askBefore = NO_PATHS,
  }: {
    /**
     * Also ask the browser's own "leave site?" on reload and tab close. Off
     * where a reload loses nothing (the page comes back as it was).
     */
    beforeUnload?: boolean;
    /**
     * Pages a link from here is asked about even while nothing is blocked
     * (going there costs something of its own). Links only: Back is not.
     */
    askBefore?: readonly string[];
  } = {}
) => {
  const msg =
    message ?? 'You have unsaved changes. Are you sure you want to leave?';
  const navigate = useNavigate();
  const location = useLocation();

  const [isBlocked, setIsBlocked] = useState(false);
  const [pending, setPending] = useState<PendingNavigation | null>(null);

  const shouldBlockRef = useRef(shouldBlock);
  shouldBlockRef.current = shouldBlock;
  const askBeforeRef = useRef(askBefore);
  askBeforeRef.current = askBefore;
  const askKey = askBefore.join('\n');
  const asksAnywhere = askBefore.length > 0;

  /** Where the held navigation goes, when it is one of `askBefore`'s */
  const pendingAsked =
    pending !== null && askBefore.includes(pathnameOf(pending.path));

  // Nothing left to protect (the work was saved or discarded while the
  // question was up): take the question down rather than leave it over a
  // page it no longer applies to.
  useEffect(() => {
    if (shouldBlock || pendingAsked) return;
    setIsBlocked(false);
    setPending(null);
  }, [shouldBlock, pendingAsked]);

  // Browser-level guard (refresh / close tab)
  useEffect(() => {
    if (!shouldBlock || !beforeUnload) return;

    const handler = (e: BeforeUnloadEvent) => {
      // Already confirmed in the app's own dialog; don't ask a second time.
      if (isNavigationAllowed()) return;
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldBlock, beforeUnload]);

  /**
   * The number of the guard entry the page was last seen on (see
   * `entryIdx`), or null when it is on an entry of its own.
   */
  const guardIdxRef = useRef<unknown>(null);

  // One guard entry is enough: when blocking stops and starts again on the
  // same page (save a match, start another) the earlier one is still there.
  useEffect(() => {
    if (shouldBlock && !isGuardEntry()) pushGuardEntry();
    guardIdxRef.current = guardIdxOf();
  }, [shouldBlock, location.pathname]);

  // In-app back/forward button guard (popstate)
  useEffect(() => {
    const guardedPath = location.pathname;

    const handler = () => {
      // Off the guard entry onto the page's own, which is the same page.
      const ontoOwnEntry =
        window.location.pathname === guardedPath &&
        !isGuardEntry() &&
        guardIdxRef.current !== null &&
        entryIdx() === guardIdxRef.current;

      if (!shouldBlockRef.current || isNavigationAllowed()) {
        // Nothing to ask about any more (the match was saved), but the
        // guard entry is still there: that Back did nothing the user could
        // see. Carry it on to where it was going.
        if (ontoOwnEntry && !isNavigationAllowed()) {
          guardIdxRef.current = null;
          window.history.back();
          return;
        }
        guardIdxRef.current = guardIdxOf();
        return;
      }
      // A jump straight to another page (history menu): the router has
      // already left, and there is nothing here to hold on to.
      if (window.location.pathname !== guardedPath) return;
      // Landed on a guard entry: still on the page, still protected.
      if (isGuardEntry()) {
        guardIdxRef.current = guardIdxOf();
        return;
      }

      // Back from the guard entry onto the page's own: put the guard back
      // and ask.
      pushGuardEntry();
      guardIdxRef.current = guardIdxOf();

      setPending(null);
      setIsBlocked(true);
    };

    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [location.pathname]);

  // Intercept programmatic in-app navigation (Link / navigate())
  useEffect(() => {
    if (!shouldBlock && !asksAnywhere) return;

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    const intercept =
      (original: typeof window.history.pushState) =>
      (data: unknown, unused: string, url?: string | URL | null) => {
        const target = url ? String(url) : null;
        const asked =
          shouldBlockRef.current ||
          (target !== null &&
            askBeforeRef.current.includes(pathnameOf(target)));
        if (!asked || isNavigationAllowed()) {
          return original(data, unused, url);
        }

        if (target && pathnameOf(target) === location.pathname) {
          return original(data, unused, url);
        }

        // Keep what the navigation was for (the account menu's Team item
        // asks Sessions to open the team dialog), not only where it went.
        setPending(
          target ? { path: target, state: routerStateOf(data) } : null
        );
        setIsBlocked(true);
      };

    window.history.pushState = intercept(originalPushState);
    window.history.replaceState = intercept(originalReplaceState);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [shouldBlock, asksAnywhere, askKey, location.pathname]);

  // Dialog actions
  const proceed = useCallback(() => {
    allowNavigation();
    setIsBlocked(false);

    if (pending) {
      navigate(pending.path, { replace: true, state: pending.state });
      return;
    }

    // Back was pressed: the guard entry is on top of the page's own entry.
    // The router numbers its entries from 0, so at 0 (or with no number,
    // after a full page load) there is nothing of this app to go back to.
    const idx = entryIdx();
    if (typeof idx === 'number' && idx > 0) {
      // Past the guard entry and the page itself
      window.history.go(-2);
    } else {
      navigate(ROUTES.SESSIONS, { replace: true });
    }
  }, [pending, navigate]);

  const reset = useCallback(() => {
    setIsBlocked(false);
    setPending(null);
  }, []);

  return {
    /** Whether a navigation attempt is currently blocked */
    isBlocked,
    /** Allow the blocked navigation to continue */
    proceed,
    /** Cancel the blocked navigation */
    reset,
    /** The message to display in the confirmation dialog */
    message: msg,
    /**
     * The page the held navigation goes to (a path, no search or hash);
     * null for Back
     */
    target: pending ? pathnameOf(pending.path) : null,
  };
};
