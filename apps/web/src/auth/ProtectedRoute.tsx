import { Box, CircularProgress } from '@mui/material';
import { Navigate, Outlet } from 'react-router';
import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box minHeight="100vh" display="grid" sx={{ placeItems: 'center' }}>
        <CircularProgress aria-label="Cargando sesión" />
      </Box>
    );
  }
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
