import { DoneAllOutlined, NotificationsOutlined } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';

interface Notification {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationResponse {
  data: Notification[];
  unread: number;
  pagination: { total: number };
}

const trustedHeaders = { 'X-Requested-With': 'EcoSoftWeb' };

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [unread, setUnread] = useState('');
  const [severity, setSeverity] = useState('');
  const notifications = useQuery({
    queryKey: ['notifications', unread, severity],
    queryFn: () =>
      apiClient
        .get<NotificationResponse>('/notifications', {
          params: { ...(unread ? { unread } : {}), ...(severity ? { severity } : {}) },
        })
        .then(({ data }) => data),
  });
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] }),
    ]);
  };
  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/notifications/${id}/read`, {}, { headers: trustedHeaders }),
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: () => apiClient.post('/notifications/read-all', {}, { headers: trustedHeaders }),
    onSuccess: invalidate,
  });
  const error = notifications.error || markRead.error || markAll.error;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Box>
          <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }}>
            Centro de notificaciones
          </Typography>
          <Typography color="text.secondary">
            Alertas operativas, regulatorias y contractuales según tus permisos.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<DoneAllOutlined />}
          onClick={() => markAll.mutate()}
          disabled={!notifications.data?.unread || markAll.isPending}
        >
          Marcar todas como leídas
        </Button>
      </Stack>
      {error && <Alert severity="error">{getApiErrorMessage(error)}</Alert>}
      <Card sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Lectura</InputLabel>
            <Select
              value={unread}
              label="Lectura"
              onChange={(event) => setUnread(event.target.value)}
            >
              <MenuItem value="">Todas</MenuItem>
              <MenuItem value="true">No leídas</MenuItem>
              <MenuItem value="false">Leídas</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Severidad</InputLabel>
            <Select
              value={severity}
              label="Severidad"
              onChange={(event) => setSeverity(event.target.value)}
            >
              <MenuItem value="">Todas</MenuItem>
              <MenuItem value="INFO">Informativa</MenuItem>
              <MenuItem value="WARNING">Advertencia</MenuItem>
              <MenuItem value="CRITICAL">Crítica</MenuItem>
            </Select>
          </FormControl>
          <Typography alignSelf="center" color="text.secondary">
            {notifications.data?.unread ?? 0} pendientes
          </Typography>
        </Stack>
      </Card>
      {notifications.isLoading ? (
        <Box minHeight={260} display="grid" sx={{ placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {notifications.data?.data.map((notification) => (
            <Card
              key={notification.id}
              sx={{
                p: 2.5,
                borderLeft: 5,
                borderColor:
                  notification.severity === 'CRITICAL'
                    ? 'error.main'
                    : notification.severity === 'WARNING'
                      ? 'warning.main'
                      : 'info.main',
                opacity: notification.readAt ? 0.72 : 1,
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
                <Stack direction="row" spacing={2}>
                  <NotificationsOutlined color={notification.readAt ? 'disabled' : 'primary'} />
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography fontWeight={800}>{notification.title}</Typography>
                      <Chip size="small" label={notification.severity} variant="outlined" />
                      {!notification.readAt && <Chip size="small" label="Nueva" color="primary" />}
                    </Stack>
                    <Typography color="text.secondary" mt={0.5}>
                      {notification.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(notification.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  {notification.actionUrl && (
                    <Button component={Link} to={notification.actionUrl} size="small">
                      Abrir
                    </Button>
                  )}
                  {!notification.readAt && (
                    <Button size="small" onClick={() => markRead.mutate(notification.id)}>
                      Marcar leída
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Card>
          ))}
          {!notifications.data?.data.length && (
            <Card sx={{ p: 5, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No hay notificaciones con estos filtros.
              </Typography>
            </Card>
          )}
        </Stack>
      )}
    </Stack>
  );
}
