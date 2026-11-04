import { useState, type KeyboardEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  FactCheckOutlined,
  FingerprintOutlined,
  GavelOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
} from '@mui/icons-material';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { useAuth } from '../auth/AuthContext';
import { BrandLogo } from '../branding/BrandLogo';
import { brandColors, brandGradients, radii } from '../theme/brand';

const schema = z.object({
  email: z.string().trim().min(1, 'Ingrese su correo.').pipe(z.email('Ingrese un correo válido.')),
  password: z.string().min(1, 'Ingrese su contraseña.'),
});
type LoginForm = z.infer<typeof schema>;

/** What the platform actually does — no marketing claims beyond implemented features. */
const capabilities = [
  { icon: <GavelOutlined />, text: 'Subastas y ofertas con transiciones de estado controladas' },
  { icon: <FingerprintOutlined />, text: 'Documentos versionados con huella SHA-256 verificable' },
  { icon: <FactCheckOutlined />, text: 'Registro de auditoría de cada acción relevante' },
];

/**
 * Messages never reveal whether an account exists: every credential failure reads the same.
 */
const loginErrorMessage = (error: unknown): string => {
  if (!axios.isAxiosError(error)) return 'No fue posible iniciar sesión. Intente nuevamente.';
  if (!error.response) return 'No hay comunicación con el servidor. Verifique su conexión.';
  if (error.response.status === 401 || error.response.status === 400)
    return 'Correo o contraseña incorrectos.';
  if (error.response.status === 429)
    return 'Demasiados intentos. Espere unos minutos antes de volver a intentarlo.';
  return 'El servicio no está disponible en este momento. Intente más tarde.';
};

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
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
      setServerError(loginErrorMessage(error));
    }
  };

  const trackCapsLock = (event: KeyboardEvent) =>
    setCapsLock(event.getModifierState?.('CapsLock') ?? false);

  return (
    <Box
      minHeight="100vh"
      display="grid"
      gridTemplateColumns={{ md: 'minmax(0, 1fr) minmax(0, 1fr)' }}
      bgcolor="background.default"
    >
      <Box
        component="aside"
        aria-label="Acerca de EcoSoft"
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 6,
          bgcolor: brandColors.navy900,
          color: brandColors.white,
          p: { md: 6, lg: 8 },
        }}
      >
        <Box
          sx={{
            alignSelf: 'flex-start',
            bgcolor: brandColors.white,
            borderRadius: `${radii.card}px`,
            px: 2.5,
            py: 1.75,
          }}
        >
          <BrandLogo maxWidth={300} />
        </Box>
        <Box maxWidth={520}>
          <Typography
            component="p"
            sx={{
              fontSize: { md: 32, lg: 38 },
              fontWeight: 600,
              lineHeight: 1.18,
              textWrap: 'balance',
            }}
          >
            Subastas renovables y contratos PPA con trazabilidad de principio a fin.
          </Typography>
          <Stack component="ul" spacing={2} sx={{ listStyle: 'none', p: 0, mt: 4, mb: 0 }}>
            {capabilities.map((item) => (
              <Stack
                key={item.text}
                component="li"
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{ color: '#C9D6E5' }}
              >
                <Box sx={{ color: brandColors.teal300, display: 'flex' }} aria-hidden>
                  {item.icon}
                </Box>
                <Typography>{item.text}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Typography variant="caption" sx={{ color: '#8EA3BC' }}>
          Comisión Nacional de Energía, República Dominicana. Proyecto originado en UNAPEC (ISO-705,
          Grupo 4).
        </Typography>
      </Box>

      <Box component="main" display="grid" sx={{ placeItems: 'center' }} p={{ xs: 2, sm: 3 }}>
        <Paper
          variant="outlined"
          sx={{
            width: '100%',
            maxWidth: 440,
            borderRadius: `${radii.dialog}px`,
            overflow: 'hidden',
            // Conductor line: the brand flourish on the authentication panel.
            '&::before': {
              content: '""',
              display: 'block',
              height: 4,
              background: brandGradients.conductor,
            },
          }}
        >
          <Box sx={{ p: { xs: 3, sm: 5 } }}>
            <Box display={{ md: 'none' }} mb={3}>
              <BrandLogo maxWidth={240} />
            </Box>
            <Typography variant="h4" component="h1">
              Iniciar sesión
            </Typography>
            <Typography color="text.secondary" mt={1} mb={3.5}>
              Use la cuenta institucional que le asignó su organización o la CNE.
            </Typography>
            {serverError && (
              <Alert severity="error" sx={{ mb: 2.5 }} role="alert">
                {serverError}
              </Alert>
            )}
            <Box
              component="form"
              onSubmit={(event) => void handleSubmit(submit)(event)}
              noValidate
              aria-busy={isSubmitting}
            >
              <Stack spacing={2.5}>
                <TextField
                  label="Correo electrónico"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  autoFocus
                  fullWidth
                  error={Boolean(errors.email)}
                  helperText={errors.email?.message}
                  {...register('email')}
                />
                <TextField
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  fullWidth
                  onKeyUp={trackCapsLock}
                  onKeyDown={trackCapsLock}
                  error={Boolean(errors.password)}
                  helperText={
                    errors.password?.message ?? (capsLock ? 'Bloq Mayús está activado.' : undefined)
                  }
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            edge="end"
                            onClick={() => setShowPassword((value) => !value)}
                            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            aria-pressed={showPassword}
                          >
                            {showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                  {...register('password')}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isSubmitting}
                  sx={{ minHeight: 46 }}
                >
                  {isSubmitting ? (
                    <>
                      <CircularProgress size={20} color="inherit" sx={{ mr: 1.25 }} aria-hidden />
                      Verificando…
                    </>
                  ) : (
                    'Iniciar sesión'
                  )}
                </Button>
              </Stack>
            </Box>
            <Typography mt={3} variant="body2" color="text.secondary">
              ¿No puede acceder? Solicite el desbloqueo o una nueva invitación al administrador de
              su organización.
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
