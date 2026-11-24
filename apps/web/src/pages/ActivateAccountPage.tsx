import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircleOutline,
  CheckOutlined,
  RadioButtonUncheckedOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
} from '@mui/icons-material';
import { Link, useSearchParams } from 'react-router';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';
import { BrandLogo } from '../branding/BrandLogo';
import { brandGradients, radii } from '../theme/brand';
import { formatDateTime } from '../utils/format';

interface InvitationSummary {
  email: string;
  firstName: string;
  lastName: string;
  organization: { legalName: string; commercialName: string | null } | null;
  roles: { code: string; name: string }[];
  expiresAt: string;
}

/** Mirrors the API password policy (users.schemas.ts) so users see each rule as they type. */
const passwordRules = [
  { label: 'Al menos 12 caracteres', test: (value: string) => value.length >= 12 },
  { label: 'Una letra minúscula', test: (value: string) => /[a-z]/.test(value) },
  { label: 'Una letra mayúscula', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'Un número', test: (value: string) => /[0-9]/.test(value) },
  { label: 'Un símbolo', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

export function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const invitationQuery = useQuery({
    queryKey: ['invitation-validation', token],
    queryFn: () =>
      apiClient
        .post<{ data: InvitationSummary }>('/auth/invitations/validate', { token })
        .then(({ data }) => data.data),
    enabled: token.length >= 32,
    retry: false,
  });
  const acceptMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/auth/invitations/accept', { token, password, confirmPassword }),
  });

  const rulesMet = passwordRules.every((rule) => rule.test(password));
  const matches = password.length > 0 && password === confirmPassword;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (rulesMet && matches && !acceptMutation.isPending) acceptMutation.mutate();
  };
  const invitation = invitationQuery.data;

  return (
    <Box
      component="main"
      minHeight="100vh"
      bgcolor="background.default"
      display="grid"
      sx={{ placeItems: 'center' }}
      p={{ xs: 2, sm: 3 }}
    >
      <Paper
        variant="outlined"
        sx={{
          width: '100%',
          maxWidth: 520,
          borderRadius: `${radii.dialog}px`,
          overflow: 'hidden',
          '&::before': {
            content: '""',
            display: 'block',
            height: 4,
            background: brandGradients.conductor,
          },
        }}
      >
        <Box sx={{ p: { xs: 3, sm: 5 } }}>
          <BrandLogo maxWidth={240} />
          <Typography variant="h4" component="h1" mt={3.5}>
            Activar cuenta
          </Typography>

          {(!token || token.length < 32) && (
            <Alert severity="error" sx={{ mt: 2.5 }}>
              El enlace de activación está incompleto. Abra el enlace completo que recibió o
              solicite una nueva invitación al administrador.
            </Alert>
          )}
          {invitationQuery.isLoading && (
            <Stack direction="row" spacing={1.5} alignItems="center" mt={3} role="status">
              <CircularProgress size={22} aria-hidden />
              <Typography color="text.secondary">Verificando la invitación…</Typography>
            </Stack>
          )}
          {invitationQuery.isError && (
            <Alert severity="error" sx={{ mt: 2.5 }}>
              {getApiErrorMessage(invitationQuery.error)} Si el enlace venció, solicite una nueva
              invitación al administrador de su organización.
            </Alert>
          )}
          {acceptMutation.isSuccess && (
            <Stack spacing={2} alignItems="flex-start" mt={3} role="status">
              <Stack direction="row" spacing={1.25} alignItems="center">
                <CheckCircleOutline color="success" aria-hidden />
                <Typography variant="h6" component="p">
                  Cuenta activada
                </Typography>
              </Stack>
              <Typography color="text.secondary">
                Ya puede iniciar sesión con {invitation?.email ?? 'su correo'} y la contraseña que
                acaba de crear.
              </Typography>
              <Button component={Link} to="/login" variant="contained">
                Iniciar sesión
              </Button>
            </Stack>
          )}
          {invitation && !acceptMutation.isSuccess && (
            <Box component="form" onSubmit={submit} mt={2} noValidate>
              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
                <Typography fontWeight={600}>
                  {invitation.firstName} {invitation.lastName}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {invitation.email}
                </Typography>
                {invitation.organization && (
                  <Typography variant="body2" color="text.secondary">
                    {invitation.organization.commercialName || invitation.organization.legalName}
                  </Typography>
                )}
                <Stack direction="row" spacing={0.75} mt={1.25} flexWrap="wrap" useFlexGap>
                  {invitation.roles.map((role) => (
                    <Chip key={role.code} size="small" label={role.name} variant="outlined" />
                  ))}
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  La invitación vence el {formatDateTime(invitation.expiresAt)}.
                </Typography>
              </Paper>
              {acceptMutation.isError && (
                <Alert severity="error" sx={{ mb: 2 }} role="alert">
                  {getApiErrorMessage(acceptMutation.error)}
                </Alert>
              )}
              <Stack spacing={2}>
                <TextField
                  label="Nueva contraseña"
                  type={visible ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  fullWidth
                  slotProps={{
                    htmlInput: { 'aria-describedby': 'password-rules' },
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            edge="end"
                            onClick={() => setVisible((value) => !value)}
                            aria-label={visible ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                            aria-pressed={visible}
                          >
                            {visible ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Box
                  component="ul"
                  id="password-rules"
                  aria-label="Requisitos de la contraseña"
                  sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 0.5 }}
                >
                  {passwordRules.map((rule) => {
                    const met = rule.test(password);
                    return (
                      <Stack
                        key={rule.label}
                        component="li"
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{ color: met ? 'success.main' : 'text.secondary', fontSize: 13.5 }}
                      >
                        {met ? (
                          <CheckOutlined sx={{ fontSize: 16 }} aria-hidden />
                        ) : (
                          <RadioButtonUncheckedOutlined sx={{ fontSize: 14 }} aria-hidden />
                        )}
                        <span>
                          {rule.label}
                          <Box component="span" sx={visuallyHidden}>
                            {met ? ' (cumplido)' : ' (pendiente)'}
                          </Box>
                        </span>
                      </Stack>
                    );
                  })}
                </Box>
                <TextField
                  label="Confirmar contraseña"
                  type={visible ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  error={Boolean(confirmPassword && password !== confirmPassword)}
                  helperText={
                    confirmPassword && password !== confirmPassword
                      ? 'Las contraseñas no coinciden.'
                      : undefined
                  }
                  required
                  fullWidth
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={acceptMutation.isPending || !rulesMet || !matches}
                >
                  {acceptMutation.isPending ? 'Activando…' : 'Activar cuenta'}
                </Button>
              </Stack>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;
