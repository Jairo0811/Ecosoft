import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  AddOutlined,
  ContentCopyOutlined,
  LockOpenOutlined,
  SearchOutlined,
} from '@mui/icons-material';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';

interface Role {
  id: string;
  code: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  organization: { id: string; legalName: string; commercialName: string | null } | null;
  roles: { role: Role }[];
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  user: { firstName: string; lastName: string };
}

interface Organization {
  id: string;
  legalName: string;
  commercialName: string | null;
}

interface ListResponse<T> {
  data: T[];
  pagination: { total: number };
}

const emptyInvite = {
  email: '',
  firstName: '',
  lastName: '',
  organizationId: '',
  roleCodes: [] as string[],
};

const statusLabel: Record<string, string> = {
  INVITED: 'Invitado',
  PENDING_CONFIRMATION: 'Pendiente',
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
};

export function UsersPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState(emptyInvite);
  const [activationUrl, setActivationUrl] = useState('');
  const [roleTarget, setRoleTarget] = useState<User | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const params = useMemo(
    () => ({ ...(query ? { q: query } : {}), ...(status ? { status } : {}) }),
    [query, status],
  );

  const usersQuery = useQuery({
    queryKey: ['users', params],
    queryFn: () => apiClient.get<ListResponse<User>>('/users', { params }).then(({ data }) => data),
  });
  const invitationsQuery = useQuery({
    queryKey: ['user-invitations'],
    queryFn: () =>
      apiClient
        .get<ListResponse<Invitation>>('/users/invitations', { params: { status: 'PENDING' } })
        .then(({ data }) => data),
  });
  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiClient.get<{ data: Role[] }>('/roles').then(({ data }) => data.data),
  });
  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'approved-for-users'],
    queryFn: () =>
      apiClient
        .get<ListResponse<Organization>>('/organizations', {
          params: { status: 'APPROVED', pageSize: 100 },
        })
        .then(({ data }) => data.data),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] }),
      queryClient.invalidateQueries({ queryKey: ['roles'] }),
    ]);
  };

  const inviteMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ data: { activationUrl?: string } }>('/users/invitations', invite),
    onSuccess: async ({ data }) => {
      setInviteOpen(false);
      setInvite(emptyInvite);
      setActivationUrl(data.data.activationUrl ?? '');
      await refresh();
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ user, nextStatus }: { user: User; nextStatus: string }) =>
      apiClient.patch(`/users/${user.id}/status`, { status: nextStatus }),
    onSuccess: refresh,
  });
  const unlockMutation = useMutation({
    mutationFn: (user: User) => apiClient.patch(`/users/${user.id}/unlock`),
    onSuccess: refresh,
  });
  const rolesMutation = useMutation({
    mutationFn: () => {
      if (!roleTarget) throw new Error('Seleccione un usuario.');
      return apiClient.put(`/users/${roleTarget.id}/roles`, { roleCodes: selectedRoles });
    },
    onSuccess: async () => {
      setRoleTarget(null);
      await refresh();
    },
  });
  const revokeMutation = useMutation({
    mutationFn: (invitation: Invitation) =>
      apiClient.patch(`/users/invitations/${invitation.id}/revoke`),
    onSuccess: refresh,
  });

  const mutationError =
    inviteMutation.error ||
    statusMutation.error ||
    unlockMutation.error ||
    rolesMutation.error ||
    revokeMutation.error;

  const openRoles = (user: User) => {
    setRoleTarget(user);
    setSelectedRoles(user.roles.map(({ role }) => role.code));
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Box>
          <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }}>
            Usuarios
          </Typography>
          <Typography color="text.secondary" mt={0.5}>
            Invitaciones, roles, acceso y estado de las cuentas por organización.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setInviteOpen(true)}>
          Invitar usuario
        </Button>
      </Stack>

      {mutationError && <Alert severity="error">{getApiErrorMessage(mutationError)}</Alert>}
      <Card sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Buscar"
            placeholder="Nombre o correo"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            slotProps={{
              input: { startAdornment: <SearchOutlined color="action" sx={{ mr: 1 }} /> },
            }}
            fullWidth
          />
          <FormControl sx={{ minWidth: 190 }}>
            <InputLabel>Estado</InputLabel>
            <Select
              value={status}
              label="Estado"
              onChange={(event) => setStatus(event.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="INVITED">Invitado</MenuItem>
              <MenuItem value="ACTIVE">Activo</MenuItem>
              <MenuItem value="SUSPENDED">Suspendido</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Card>

      <Card>
        {usersQuery.isLoading ? (
          <Box display="grid" sx={{ placeItems: 'center' }} minHeight={260}>
            <CircularProgress />
          </Box>
        ) : usersQuery.isError ? (
          <Alert severity="error">{getApiErrorMessage(usersQuery.error)}</Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Usuario</TableCell>
                  <TableCell>Organización</TableCell>
                  <TableCell>Roles</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usersQuery.data?.data.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Typography fontWeight={750}>
                        {user.firstName} {user.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {user.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {user.organization?.commercialName || user.organization?.legalName || '—'}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" gap={0.75} flexWrap="wrap">
                        {user.roles.map(({ role }) => (
                          <Chip key={role.code} label={role.name} size="small" />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={statusLabel[user.status] ?? user.status}
                        color={
                          user.status === 'ACTIVE'
                            ? 'success'
                            : user.status === 'SUSPENDED'
                              ? 'error'
                              : 'warning'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                        <Button size="small" onClick={() => openRoles(user)}>
                          Roles
                        </Button>
                        {user.lockedUntil && (
                          <Button
                            size="small"
                            startIcon={<LockOpenOutlined />}
                            onClick={() => unlockMutation.mutate(user)}
                          >
                            Desbloquear
                          </Button>
                        )}
                        {user.status === 'ACTIVE' && (
                          <Button
                            size="small"
                            color="error"
                            onClick={() => statusMutation.mutate({ user, nextStatus: 'SUSPENDED' })}
                          >
                            Suspender
                          </Button>
                        )}
                        {user.status === 'SUSPENDED' && (
                          <Button
                            size="small"
                            color="success"
                            onClick={() => statusMutation.mutate({ user, nextStatus: 'ACTIVE' })}
                          >
                            Reactivar
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Box>
        <Typography variant="h5" mb={1.5}>
          Invitaciones pendientes
        </Typography>
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Persona</TableCell>
                  <TableCell>Vence</TableCell>
                  <TableCell align="right">Acción</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invitationsQuery.data?.data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.user.firstName} {item.user.lastName}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {item.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {new Intl.DateTimeFormat('es-DO', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(item.expiresAt))}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        color="error"
                        onClick={() => revokeMutation.mutate(item)}
                      >
                        Revocar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {invitationsQuery.data?.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3}>No hay invitaciones pendientes.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Box>

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Invitar usuario</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Nombres"
                value={invite.firstName}
                onChange={(event) => setInvite({ ...invite, firstName: event.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Apellidos"
                value={invite.lastName}
                onChange={(event) => setInvite({ ...invite, lastName: event.target.value })}
                fullWidth
                required
              />
            </Stack>
            <TextField
              label="Correo"
              type="email"
              value={invite.email}
              onChange={(event) => setInvite({ ...invite, email: event.target.value })}
              fullWidth
              required
            />
            <FormControl fullWidth required>
              <InputLabel>Organización</InputLabel>
              <Select
                value={invite.organizationId}
                label="Organización"
                onChange={(event) => setInvite({ ...invite, organizationId: event.target.value })}
              >
                {organizationsQuery.data?.map((organization) => (
                  <MenuItem key={organization.id} value={organization.id}>
                    {organization.commercialName || organization.legalName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Roles</InputLabel>
              <Select
                multiple
                value={invite.roleCodes}
                label="Roles"
                onChange={(event) =>
                  setInvite({ ...invite, roleCodes: event.target.value as string[] })
                }
              >
                {rolesQuery.data?.map((role) => (
                  <MenuItem key={role.code} value={role.code}>
                    {role.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={
              inviteMutation.isPending ||
              !invite.email ||
              !invite.organizationId ||
              invite.roleCodes.length === 0
            }
            onClick={() => inviteMutation.mutate()}
          >
            Enviar invitación
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(roleTarget)}
        onClose={() => setRoleTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Asignar roles</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Roles</InputLabel>
            <Select
              multiple
              value={selectedRoles}
              label="Roles"
              onChange={(event) => setSelectedRoles(event.target.value as string[])}
            >
              {rolesQuery.data?.map((role) => (
                <MenuItem key={role.code} value={role.code}>
                  {role.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleTarget(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={selectedRoles.length === 0 || rolesMutation.isPending}
            onClick={() => rolesMutation.mutate()}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(activationUrl)}
        onClose={() => setActivationUrl('')}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Invitación creada</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>
            La invitación fue registrada. Comparta este enlace temporal por un canal seguro.
          </Alert>
          <TextField
            value={activationUrl}
            fullWidth
            multiline
            slotProps={{ input: { readOnly: true } }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<ContentCopyOutlined />}
            onClick={() => void navigator.clipboard.writeText(activationUrl)}
          >
            Copiar enlace
          </Button>
          <Button variant="contained" onClick={() => setActivationUrl('')}>
            Listo
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
