import { Navigate } from 'react-router-dom';
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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-team-blue/20 border-t-team-blue"></div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!user && !isGuest) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (hasCompletedASession()) {
    return <Navigate to={ROUTES.SESSIONS} replace />;
  }

  return <Navigate to={ROUTES.ACTIVE} replace />;
};
