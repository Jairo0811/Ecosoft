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
import { brandColors, brandGradients } from '../theme/brand';

const schema = z.object({
  email: z.email('Ingrese un correo válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});
type LoginForm = z.infer<typeof schema>;

const brandPillars = ['Tecnología', 'Eficiencia', 'Sostenibilidad'] as const;

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
          background: brandGradients.hero,
          color: 'white',
          p: { md: 6, lg: 8 },
          flexDirection: 'column',
          justifyContent: 'space-between',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            opacity: 0.34,
            backgroundImage:
              'linear-gradient(rgba(0,183,255,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(0,183,255,.10) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            maskImage: 'linear-gradient(to bottom right, black, transparent 72%)',
            pointerEvents: 'none',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            width: 560,
            height: 560,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(32,200,51,.16), transparent 68%)',
            right: -180,
            bottom: -240,
            pointerEvents: 'none',
          },
        }}
      >
        <Box zIndex={1}>
          <BrandLogo maxWidth={480} />
        </Box>
        <Box zIndex={1} maxWidth={620}>
          <Box
            display="grid"
            sx={{
              placeItems: 'center',
              width: 52,
              height: 52,
              borderRadius: 2.5,
              mb: 2.5,
              color: brandColors.lime500,
              background: 'rgba(0,108,255,.15)',
              border: '1px solid rgba(0,183,255,.24)',
            }}
          >
            <BoltOutlined sx={{ fontSize: 32 }} />
          </Box>
          <Typography variant="h2" fontSize={{ md: 46, lg: 58 }} lineHeight={1.08}>
            Transparencia para el{' '}
            <Box
              component="span"
              sx={{
                backgroundImage: brandGradients.primary,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              futuro energético.
            </Box>
          </Typography>
          <Typography mt={2.5} fontSize={18} sx={{ color: 'rgba(247,251,255,.72)' }}>
            Gestión segura y trazable de subastas renovables y contratos PPA para la República
            Dominicana.
          </Typography>
          <Stack direction="row" spacing={1.25} mt={4} flexWrap="wrap" useFlexGap>
            {brandPillars.map((pillar) => (
              <Box
                key={pillar}
                px={1.6}
                py={0.8}
                borderRadius={999}
                sx={{
                  border: '1px solid rgba(0,183,255,.25)',
                  bgcolor: 'rgba(4,17,38,.56)',
                  color: 'rgba(247,251,255,.86)',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '.02em',
                }}
              >
                {pillar}
              </Box>
            ))}
          </Stack>
        </Box>
        <Typography variant="caption" zIndex={1} sx={{ color: 'rgba(247,251,255,.55)' }}>
          EcoSoft Solutions S.R.L. · Comisión Nacional de Energía
        </Typography>
      </Box>
      <Box
        display="grid"
        sx={{
          placeItems: 'center',
          background:
            'radial-gradient(circle at 82% 16%, rgba(0,183,255,.08), transparent 28%), radial-gradient(circle at 15% 90%, rgba(32,200,51,.07), transparent 24%)',
        }}
        p={2.5}
      >
        <Card sx={{ width: '100%', maxWidth: 500, boxShadow: { xs: 'none', md: undefined } }}>
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Box display={{ md: 'none' }} mb={4}>
              <BrandLogo maxWidth={300} decorative />
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
              <Box
                display="grid"
                sx={{
                  placeItems: 'center',
                  width: 46,
                  height: 46,
                  borderRadius: 2.25,
                  backgroundImage: brandGradients.primary,
                  color: 'white',
                  boxShadow: '0 8px 20px rgba(0,108,255,.22)',
                }}
              >
                <LockOutlined />
              </Box>
              <Box>
                <Typography variant="h4" fontSize={30}>
                  Bienvenido
                </Typography>
                <Typography variant="caption" color="primary.light" fontWeight={700}>
                  Plataforma institucional segura
                </Typography>
              </Box>
            </Stack>
            <Typography color="text.secondary" mb={4} mt={1.25}>
              Ingrese sus credenciales institucionales para continuar en EcoSoft.
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
