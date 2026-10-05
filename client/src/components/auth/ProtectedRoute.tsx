import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { useAuth } from '@/contexts';
import { ROUTES } from '@/constants';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, isGuest } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user && !isGuest) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
