import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { BoltOutlined, LockOutlined } from '@mui/icons-material';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { useAuth } from '../auth/AuthContext';
import { BrandLogo } from '../branding/BrandLogo';

const schema = z.object({
  email: z.email('Ingrese un correo válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});
type LoginForm = z.infer<typeof schema>;

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) });
  if (user) return <Navigate to="/" replace />;

  const submit = async (values: LoginForm) => {
    setServerError('');
    try {
      await login(values.email, values.password);
      const destination = (location.state as { from?: string } | null)?.from ?? '/';
      void navigate(destination, { replace: true });
    } catch (error) {
      const apiMessage = axios.isAxiosError<{ message?: unknown }>(error)
        ? error.response?.data.message
        : undefined;
      setServerError(
        typeof apiMessage === 'string'
          ? apiMessage
          : 'No fue posible iniciar sesión. Intente nuevamente.',
      );
    }
  };

  return (
    <Box minHeight="100vh" display="grid" gridTemplateColumns={{ md: '1.08fr 1fr' }}>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          position: 'relative',
          overflow: 'hidden',
          bgcolor: '#073B4C',
          color: 'white',
          p: 8,
          flexDirection: 'column',
          justifyContent: 'space-between',
          '&::after': {
            content: '""',
            position: 'absolute',
            width: 520,
            height: 520,
            borderRadius: '50%',
            bgcolor: 'rgba(40,169,107,.17)',
            right: -140,
            bottom: -210,
          },
        }}
      >
        <Box>
          <BrandLogo maxWidth={430} />
        </Box>
        <Box zIndex={1} maxWidth={580}>
          <BoltOutlined sx={{ color: '#72DDA5', fontSize: 52, mb: 2 }} />
          <Typography variant="h2" fontSize={{ md: 48, lg: 58 }} lineHeight={1.08}>
            Transparencia para el futuro energético.
          </Typography>
          <Typography mt={2.5} fontSize={18} sx={{ color: 'rgba(255,255,255,.72)' }}>
            Gestión segura y trazable de subastas renovables y contratos PPA para la República
            Dominicana.
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.55)' }}>
          EcoSoft Solutions S.R.L. · Comisión Nacional de Energía
        </Typography>
      </Box>
      <Box display="grid" sx={{ placeItems: 'center' }} p={2.5}>
        <Card sx={{ width: '100%', maxWidth: 480, boxShadow: { xs: 'none', md: undefined } }}>
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Box display={{ md: 'none' }} mb={4}>
              <Typography variant="h4" color="primary" fontWeight={850}>
                EcoSoft
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
              <Box
                display="grid"
                sx={{
                  placeItems: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  bgcolor: 'primary.main',
                  color: 'white',
                }}
              >
                <LockOutlined />
              </Box>
              <Typography variant="h4" fontSize={30}>
                Bienvenido
              </Typography>
            </Stack>
            <Typography color="text.secondary" mb={4}>
              Ingrese sus credenciales institucionales para continuar.
            </Typography>
            {serverError && (
              <Alert severity="error" sx={{ mb: 2 }} role="alert">
                {serverError}
              </Alert>
            )}
            <Box component="form" onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
              <Stack spacing={2.25}>
                <TextField
                  label="Correo electrónico"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  fullWidth
                  error={Boolean(errors.email)}
                  helperText={errors.email?.message}
                  {...register('email')}
                />
                <TextField
                  label="Contraseña"
                  type="password"
                  autoComplete="current-password"
                  fullWidth
                  error={Boolean(errors.password)}
                  helperText={errors.password?.message}
                  {...register('password')}
                />
                <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                  {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Iniciar sesión'}
                </Button>
              </Stack>
            </Box>
            <Typography mt={3} textAlign="center" variant="body2" color="text.secondary">
              ¿Problemas para acceder? Contacte al administrador de la CNE.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
