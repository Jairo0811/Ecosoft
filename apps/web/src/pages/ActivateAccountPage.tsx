import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
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
import { CheckCircleOutline, LockOutlined } from '@mui/icons-material';
import { Link, useSearchParams } from 'react-router';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';
import { BrandLogo } from '../branding/BrandLogo';

interface InvitationSummary {
  email: string;
  firstName: string;
  lastName: string;
  organization: { legalName: string; commercialName: string | null } | null;
  roles: { code: string; name: string }[];
  expiresAt: string;
}

export function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    acceptMutation.mutate();
  };

  return (
    <Box
      minHeight="100vh"
      bgcolor="background.default"
      display="grid"
      sx={{ placeItems: 'center' }}
      p={2.5}
    >
      <Card sx={{ width: '100%', maxWidth: 560 }}>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <BrandLogo maxWidth={300} />
          <Stack direction="row" spacing={1.5} alignItems="center" mt={4} mb={1}>
            <LockOutlined color="primary" fontSize="large" />
            <Typography variant="h4" fontSize={30}>
              Activar cuenta
            </Typography>
          </Stack>

          {!token && <Alert severity="error">El enlace de activación está incompleto.</Alert>}
          {invitationQuery.isLoading && (
            <Box display="grid" sx={{ placeItems: 'center' }} minHeight={180}>
              <CircularProgress />
            </Box>
          )}
          {invitationQuery.isError && (
            <Alert severity="error">{getApiErrorMessage(invitationQuery.error)}</Alert>
          )}
          {acceptMutation.isSuccess && (
            <Stack spacing={2.5} alignItems="center" textAlign="center" py={4}>
              <CheckCircleOutline color="success" sx={{ fontSize: 64 }} />
              <Typography variant="h5">Cuenta activada correctamente</Typography>
              <Typography color="text.secondary">
                Ya puede ingresar a EcoSoft con su correo y la contraseña creada.
              </Typography>
              <Button component={Link} to="/login" variant="contained">
                Iniciar sesión
              </Button>
            </Stack>
          )}
          {invitationQuery.data && !acceptMutation.isSuccess && (
            <Box component="form" onSubmit={submit} mt={3}>
              <Typography fontWeight={750}>
                {invitationQuery.data.firstName} {invitationQuery.data.lastName}
              </Typography>
              <Typography color="text.secondary">{invitationQuery.data.email}</Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                {invitationQuery.data.organization?.commercialName ||
                  invitationQuery.data.organization?.legalName}
              </Typography>
              {acceptMutation.isError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {getApiErrorMessage(acceptMutation.error)}
                </Alert>
              )}
              <Stack spacing={2}>
                <TextField
                  label="Nueva contraseña"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  helperText="Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo."
                  required
                  fullWidth
                />
                <TextField
                  label="Confirmar contraseña"
                  type="password"
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
                  disabled={acceptMutation.isPending || password !== confirmPassword}
                >
                  {acceptMutation.isPending ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    'Activar mi cuenta'
                  )}
                </Button>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
