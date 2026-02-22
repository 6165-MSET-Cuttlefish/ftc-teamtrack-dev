import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Hook that blocks in-app navigation when there is unsaved work.
 * Returns blocker state so the consuming component can render a
 * custom confirmation dialog instead of relying on window.confirm.
 *
 * Also wires up `beforeunload` so page refresh / tab close is guarded.
 */
export const useNavigationGuard = (shouldBlock: boolean, message?: string) => {
  const msg = message ?? 'You have unsaved changes. Are you sure you want to leave?';

  // Block in-app (React Router) navigation
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      shouldBlock && currentLocation.pathname !== nextLocation.pathname
  );

  // Block browser-level navigation (refresh, close tab)
  useEffect(() => {
    if (!shouldBlock) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldBlock]);

  return {
    /** Whether a navigation attempt is currently blocked */
    isBlocked: blocker.state === 'blocked',
    /** Allow the blocked navigation to continue */
    proceed: () => blocker.state === 'blocked' && blocker.proceed(),
    /** Cancel the blocked navigation */
    reset: () => blocker.state === 'blocked' && blocker.reset(),
    /** The message to display in the confirmation dialog */
    message: msg,
  };
};
