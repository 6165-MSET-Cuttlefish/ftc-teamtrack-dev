import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Hook that blocks in-app navigation when there is unsaved work.
 * Shows a browser-native confirm dialog to let users decide.
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

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const confirmed = window.confirm(msg);
      if (confirmed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker, msg]);

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
};
