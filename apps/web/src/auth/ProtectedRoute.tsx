import type { ReactNode } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router';
import { RestrictedState } from '../components/PageState';
import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <Box minHeight="100vh" display="grid" sx={{ placeItems: 'center' }}>
        <CircularProgress aria-label="Recuperando sesión" />
      </Box>
    );
  }
  if (!user) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={from === '/' ? undefined : { from }} />;
  }
  return <Outlet />;
}

/**
 * UX guard for a route. It never replaces backend authorization: it only avoids rendering a
 * module whose API calls would be rejected with 403 for the active identity.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission?: string;
  children: ReactNode;
}) {
  const { hasPermission } = useAuth();
  if (permission && !hasPermission(permission)) return <RestrictedState />;
  return <>{children}</>;
}
