import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts';
import { ROUTES } from '@/constants';

/**
 * Smart redirect for home route
 * - Guests: redirect to /active (practice session)
 * - Authenticated users: redirect to /sessions
 */
export const HomeRedirect = () => {
  const { isGuest, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-team-blue"></div>
      </div>
    );
  }

  // Redirect guests to the active practice session page
  if (isGuest) {
    return <Navigate to={ROUTES.ACTIVE} replace />;
  }

  // Redirect authenticated users to their sessions list
  return <Navigate to={ROUTES.SESSIONS} replace />;
};
