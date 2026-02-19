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
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-team-blue/20 border-t-team-blue"></div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  }

  // If the user has completed at least one session, send them to the sessions list
  if (hasCompletedASession()) {
    return <Navigate to={ROUTES.SESSIONS} replace />;
  }

  // Otherwise, start with the active practice session page
  return <Navigate to={ROUTES.ACTIVE} replace />;
};
