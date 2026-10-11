import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { useAuth } from '@/contexts';
import { ROUTES } from '@/constants';
import {
  hasActiveSession,
  hasCompletedASession,
  readGuestSessions,
} from '@/lib';

/**
 * Where opening the app ("/", a bookmark, the Home Screen icon) lands:
 * - a session under way on this device: back to it, on /active
 * - signed in: Sessions, the account's (and team's) list, whichever device
 *   it is and whether or not a session was ever completed on it
 * - a guest with sessions saved in this browser: Sessions
 * - a brand-new guest: /active, to score straight away
 */
export const HomeRedirect = () => {
  const { user, loading, isGuest } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user && !isGuest) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (hasActiveSession()) {
    return <Navigate to={ROUTES.ACTIVE} replace />;
  }

  if (!isGuest || readGuestSessions().length > 0 || hasCompletedASession()) {
    return <Navigate to={ROUTES.SESSIONS} replace />;
  }

  return <Navigate to={ROUTES.ACTIVE} replace />;
};
