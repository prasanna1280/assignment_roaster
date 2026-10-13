import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Center, Spinner } from '@chakra-ui/react';
import { useAuth } from '../../hooks/useAuth';
import { getRedirectPath } from './redirect';

interface RouteGuardProps {
  children: ReactElement;
}

function AuthLoading(): ReactElement {
  return (
    <Center minH="calc(100vh - 64px)" role="status" aria-label="Checking your session">
      <Spinner size="xl" thickness="4px" color="accent.fg" />
    </Center>
  );
}

/** Renders children only for authenticated users; otherwise redirects to /login. */
export function ProtectedRoute({ children }: RouteGuardProps): ReactElement {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

/** Like ProtectedRoute, but also requires an admin user (else redirects to /dashboard). */
export function AdminRoute({ children }: RouteGuardProps): ReactElement {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

/**
 * For login/register pages: authenticated users are sent to the page they came
 * from (location.state.from) or /dashboard.
 */
export function PublicOnlyRoute({ children }: RouteGuardProps): ReactElement {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthLoading />;
  if (isAuthenticated) return <Navigate to={getRedirectPath(location.state)} replace />;
  return children;
}

export default ProtectedRoute;
