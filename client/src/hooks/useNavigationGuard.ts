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

const isGuardEntry = (): boolean =>
  (window.history.state as Record<string, unknown> | null)?.[GUARD_KEY] ===
  true;

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

/**
 * Hook that blocks navigation when there is unsaved work.
 *
 * Uses `beforeunload` for tab close / refresh, and intercepts in-app
 * navigation via the History `popstate` event (back/forward buttons) and
 * by patching `history.pushState` / `history.replaceState`.  This avoids the
 * need for `useBlocker`, which requires a data-router setup
 * (`createBrowserRouter` / `RouterProvider`).
 */
export const useNavigationGuard = (shouldBlock: boolean, message?: string) => {
  const msg =
    message ?? 'You have unsaved changes. Are you sure you want to leave?';
  const navigate = useNavigate();
  const location = useLocation();

  const [isBlocked, setIsBlocked] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const shouldBlockRef = useRef(shouldBlock);
  shouldBlockRef.current = shouldBlock;

  // Browser-level guard (refresh / close tab)
  useEffect(() => {
    if (!shouldBlock) return;

    const handler = (e: BeforeUnloadEvent) => {
      // Already confirmed in the app's own dialog; don't ask a second time.
      if (isNavigationAllowed()) return;
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldBlock]);

  // In-app back/forward button guard (popstate)
  useEffect(() => {
    if (!shouldBlock) return;

    const guardedPath = location.pathname;

    // One guard entry is enough: when blocking stops and starts again on the
    // same page (cancel a match, start another) the earlier one is still
    // there.
    if (!isGuardEntry()) pushGuardEntry();

    const handler = () => {
      if (!shouldBlockRef.current || isNavigationAllowed()) return;
      // A jump straight to another page (history menu): the router has
      // already left, and there is nothing here to hold on to.
      if (window.location.pathname !== guardedPath) return;
      // Landed on a guard entry: still on the page, still protected.
      if (isGuardEntry()) return;

      // Back from the guard entry onto the page's own: put the guard back
      // and ask.
      pushGuardEntry();

      setPendingPath(null);
      setIsBlocked(true);
    };

    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [shouldBlock, location.pathname]);

  // Intercept programmatic in-app navigation (Link / navigate())
  useEffect(() => {
    if (!shouldBlock) return;

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    const intercept =
      (original: typeof window.history.pushState) =>
      (data: unknown, unused: string, url?: string | URL | null) => {
        if (!shouldBlockRef.current || isNavigationAllowed()) {
          return original(data, unused, url);
        }

        const target = url ? String(url) : null;
        if (target && new URL(target, window.location.origin).pathname === location.pathname) {
          return original(data, unused, url);
        }

        setPendingPath(target);
        setIsBlocked(true);
      };

    window.history.pushState = intercept(originalPushState);
    window.history.replaceState = intercept(originalReplaceState);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [shouldBlock, location.pathname]);

  // Dialog actions
  const proceed = useCallback(() => {
    allowNavigation();
    setIsBlocked(false);

    if (pendingPath) {
      navigate(pendingPath, { replace: true });
      return;
    }

    // Back was pressed: the guard entry is on top of the page's own entry.
    // The router numbers its entries from 0, so at 0 (or with no number,
    // after a full page load) there is nothing of this app to go back to.
    const idx = (window.history.state as { idx?: unknown } | null)?.idx;
    if (typeof idx === 'number' && idx > 0) {
      // Past the guard entry and the page itself
      window.history.go(-2);
    } else {
      navigate(ROUTES.SESSIONS, { replace: true });
    }
  }, [pendingPath, navigate]);

  const reset = useCallback(() => {
    setIsBlocked(false);
    setPendingPath(null);
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
  };
};
