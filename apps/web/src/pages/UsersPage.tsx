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
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useNotify } from '../components/Feedback';
import { PageHeader } from '../components/PageState';
import { formatDateTime } from '../utils/format';

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

  const notify = useNotify();
  /** Sensitive account changes wait here for explicit confirmation. */
  const [pendingAction, setPendingAction] = useState<
    | { kind: 'suspend' | 'reactivate'; user: User }
    | { kind: 'revoke'; invitation: Invitation }
    | null
  >(null);

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
    mutationFn: ({ user, nextStatus }: { user: User; nextStatus: 'ACTIVE' | 'SUSPENDED' }) =>
      apiClient.patch(`/users/${user.id}/status`, { status: nextStatus }),
    onSuccess: async (_, { user, nextStatus }) => {
      setPendingAction(null);
      notify(
        nextStatus === 'SUSPENDED'
          ? `Cuenta de ${user.email} suspendida. Sus sesiones dejan de ser válidas.`
          : `Cuenta de ${user.email} reactivada.`,
      );
      await refresh();
    },
  });
  const unlockMutation = useMutation({
    mutationFn: (user: User) => apiClient.patch(`/users/${user.id}/unlock`),
    onSuccess: async (_, user) => {
      notify(`Cuenta de ${user.email} desbloqueada.`);
      await refresh();
    },
  });
  const rolesMutation = useMutation({
    mutationFn: () => {
      if (!roleTarget) throw new Error('Seleccione un usuario.');
      return apiClient.put(`/users/${roleTarget.id}/roles`, { roleCodes: selectedRoles });
    },
    onSuccess: async () => {
      notify(`Roles de ${roleTarget?.email ?? 'la cuenta'} actualizados.`);
      setRoleTarget(null);
      await refresh();
    },
  });
  const revokeMutation = useMutation({
    mutationFn: (invitation: Invitation) =>
      apiClient.patch(`/users/invitations/${invitation.id}/revoke`),
    onSuccess: async (_, invitation) => {
      setPendingAction(null);
      notify(`Invitación para ${invitation.email} revocada. El enlace ya no es válido.`);
      await refresh();
    },
  });

  // Status and revocation errors are shown inside their confirmation dialog.
  const mutationError = inviteMutation.error || unlockMutation.error || rolesMutation.error;

  const openRoles = (user: User) => {
    setRoleTarget(user);
    setSelectedRoles(user.roles.map(({ role }) => role.code));
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Usuarios"
        description="Invitaciones, roles, acceso y estado de las cuentas por organización."
        actions={
          <>
            <Button
              variant="contained"
              startIcon={<AddOutlined />}
              onClick={() => setInviteOpen(true)}
            >
              Invitar usuario
            </Button>
          </>
        }
      />

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
            <InputLabel id="users-status-filter">Estado</InputLabel>
            <Select
              labelId="users-status-filter"
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
                            disabled={unlockMutation.isPending}
                            onClick={() => unlockMutation.mutate(user)}
                          >
                            Desbloquear
                          </Button>
                        )}
                        {user.status === 'ACTIVE' && (
                          <Button
                            size="small"
                            color="error"
                            onClick={() => {
                              statusMutation.reset();
                              setPendingAction({ kind: 'suspend', user });
                            }}
                          >
                            Suspender
                          </Button>
                        )}
                        {user.status === 'SUSPENDED' && (
                          <Button
                            size="small"
                            color="success"
                            onClick={() => {
                              statusMutation.reset();
                              setPendingAction({ kind: 'reactivate', user });
                            }}
                          >
                            Reactivar
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {usersQuery.data?.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>No hay usuarios con estos filtros.</TableCell>
                  </TableRow>
                )}
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
                    <TableCell>{formatDateTime(item.expiresAt)}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          revokeMutation.reset();
                          setPendingAction({ kind: 'revoke', invitation: item });
                        }}
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

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction?.kind === 'suspend'
            ? 'Suspender cuenta'
            : pendingAction?.kind === 'reactivate'
              ? 'Reactivar cuenta'
              : 'Revocar invitación'
        }
        description={
          pendingAction?.kind === 'suspend'
            ? 'La persona no podrá iniciar sesión y sus sesiones activas quedarán revocadas. Puede reactivarse más adelante.'
            : pendingAction?.kind === 'reactivate'
              ? 'La persona podrá volver a iniciar sesión con sus roles actuales.'
              : 'El enlace de activación dejará de funcionar. Para dar acceso habrá que enviar una invitación nueva.'
        }
        summary={
          pendingAction &&
          (pendingAction.kind === 'revoke' ? (
            <>
              <strong>
                {pendingAction.invitation.user.firstName} {pendingAction.invitation.user.lastName}
              </strong>{' '}
              · {pendingAction.invitation.email}
            </>
          ) : (
            <>
              <strong>
                {pendingAction.user.firstName} {pendingAction.user.lastName}
              </strong>{' '}
              · {pendingAction.user.email} ·{' '}
              {statusLabel[pendingAction.user.status] ?? pendingAction.user.status}
            </>
          ))
        }
        confirmLabel={
          pendingAction?.kind === 'suspend'
            ? 'Suspender cuenta'
            : pendingAction?.kind === 'reactivate'
              ? 'Reactivar cuenta'
              : 'Revocar invitación'
        }
        destructive={pendingAction?.kind !== 'reactivate'}
        pending={statusMutation.isPending || revokeMutation.isPending}
        error={pendingAction?.kind === 'revoke' ? revokeMutation.error : statusMutation.error}
        onConfirm={() => {
          if (!pendingAction) return;
          if (pendingAction.kind === 'revoke') revokeMutation.mutate(pendingAction.invitation);
          else
            statusMutation.mutate({
              user: pendingAction.user,
              nextStatus: pendingAction.kind === 'suspend' ? 'SUSPENDED' : 'ACTIVE',
            });
        }}
        onClose={() => setPendingAction(null)}
      />

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
