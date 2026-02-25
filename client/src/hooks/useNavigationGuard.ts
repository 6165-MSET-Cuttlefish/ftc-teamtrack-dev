import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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

  const allowNavRef = useRef(false);

  // Browser-level guard (refresh / close tab)
  useEffect(() => {
    if (!shouldBlock) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldBlock]);

  // In-app back/forward button guard (popstate)
  useEffect(() => {
    if (!shouldBlock) return;

    window.history.pushState(null, '', window.location.href);

    const handler = () => {
      if (!shouldBlockRef.current || allowNavRef.current) return;

      window.history.pushState(null, '', window.location.href);

      setPendingPath(null);
      setIsBlocked(true);
    };

    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [shouldBlock]);

  // Intercept programmatic in-app navigation (Link / navigate())
  useEffect(() => {
    if (!shouldBlock) return;

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    const intercept =
      (original: typeof window.history.pushState) =>
      (data: unknown, unused: string, url?: string | URL | null) => {
        if (!shouldBlockRef.current || allowNavRef.current) {
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
    allowNavRef.current = true;
    setIsBlocked(false);

    if (pendingPath) {
      navigate(pendingPath, { replace: true });
    } else {
      // Go back past the two duplicate states we pushed
      window.history.go(-2);
    }

    setTimeout(() => {
      allowNavRef.current = false;
    }, 0);
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
