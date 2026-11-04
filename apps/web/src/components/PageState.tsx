import type { ReactNode } from 'react';
import { Alert, AlertTitle, Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { InboxOutlined, LockOutlined, RefreshOutlined } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router';
import axios from 'axios';
import { getApiErrorMessage } from '../api/errors';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Primary and secondary actions rendered on the right (wraps below on mobile). */
  actions?: ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', md: 'flex-end' }}
      mb={3}
    >
      <Box minWidth={0}>
        {eyebrow && (
          <Typography variant="overline" color="secondary.main" fontWeight={800} lineHeight={2}>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h4" component="h1" fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>
          {title}
        </Typography>
        {description && (
          <Typography color="text.secondary" mt={0.75} maxWidth={760}>
            {description}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap flexShrink={0}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

export function LoadingState({ rows = 4, label = 'Cargando información' }) {
  return (
    <Box role="status" aria-live="polite" aria-label={label}>
      <Stack spacing={1.25}>
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} variant="rounded" height={index === 0 ? 56 : 44} />
        ))}
      </Stack>
    </Box>
  );
}

const statusOf = (error: unknown) =>
  axios.isAxiosError(error) ? (error.response?.status ?? 0) : 0;

/** Recoverable error with a retry action. 403 is rendered as a permission state, not a fault. */
export function ErrorState({
  error,
  onRetry,
  title = 'No fue posible cargar la información',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  if (statusOf(error) === 403) return <RestrictedState compact />;
  return (
    <Alert
      severity="error"
      variant="outlined"
      action={
        onRetry && (
          <Button color="inherit" size="small" startIcon={<RefreshOutlined />} onClick={onRetry}>
            Reintentar
          </Button>
        )
      }
    >
      <AlertTitle>{title}</AlertTitle>
      {statusOf(error) === 0 && axios.isAxiosError(error)
        ? 'No hay comunicación con el servidor. Verifique su conexión e intente nuevamente.'
        : getApiErrorMessage(error)}
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 3, sm: 5 },
        textAlign: 'center',
        borderStyle: 'dashed',
        bgcolor: 'transparent',
      }}
    >
      <InboxOutlined color="disabled" sx={{ fontSize: 40, mb: 1 }} aria-hidden />
      <Typography fontWeight={750}>{title}</Typography>
      {description && (
        <Typography color="text.secondary" variant="body2" mt={0.5} maxWidth={520} mx="auto">
          {description}
        </Typography>
      )}
      {action && <Box mt={2}>{action}</Box>}
    </Paper>
  );
}

export function RestrictedState({ compact = false }: { compact?: boolean }) {
  return (
    <Paper variant="outlined" sx={{ p: compact ? 3 : { xs: 3, sm: 6 }, textAlign: 'center' }}>
      <LockOutlined color="warning" sx={{ fontSize: compact ? 32 : 44, mb: 1 }} aria-hidden />
      <Typography variant={compact ? 'subtitle1' : 'h5'} component="h2" fontWeight={800}>
        Acceso restringido
      </Typography>
      <Typography color="text.secondary" mt={0.75} maxWidth={520} mx="auto">
        Su rol actual no tiene permiso para consultar este módulo. Si necesita acceso, solicítelo al
        administrador de su organización o de la CNE.
      </Typography>
      {!compact && (
        <Button component={RouterLink} to="/" variant="outlined" sx={{ mt: 3 }}>
          Volver al panel
        </Button>
      )}
    </Paper>
  );
}
