import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { useAuth } from '@/contexts';
import { ROUTES } from '@/constants';
import { hasCompletedASession } from '@/lib';

/**
 * Smart redirect for home route
 * - Until the user has completed a session → /active
 * - After completing at least one session → /sessions
 */
export const HomeRedirect = () => {
  const { user, loading, isGuest } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user && !isGuest) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (hasCompletedASession()) {
    return <Navigate to={ROUTES.SESSIONS} replace />;
  }

  return <Navigate to={ROUTES.ACTIVE} replace />;
};
