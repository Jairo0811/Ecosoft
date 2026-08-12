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
import { AddOutlined, BusinessOutlined, SearchOutlined } from '@mui/icons-material';
import {
  organizationStatuses,
  organizationTypes,
  type OrganizationStatus,
  type OrganizationType,
} from '@ecosoft/shared';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';

interface Organization {
  id: string;
  rnc: string | null;
  legalName: string;
  commercialName: string | null;
  type: OrganizationType;
  status: OrganizationStatus;
  contactName: string | null;
  contactEmail: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  _count: { users: number };
}

interface OrganizationList {
  data: Organization[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

interface OrganizationForm {
  rnc: string;
  legalName: string;
  commercialName: string;
  type: OrganizationType;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
}

const emptyForm: OrganizationForm = {
  rnc: '',
  legalName: '',
  commercialName: '',
  type: 'GENERATION_COMPANY',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
};

const statusLabels: Record<OrganizationStatus, string> = {
  PENDING: 'Pendiente',
  UNDER_REVIEW: 'En revisión',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  SUSPENDED: 'Suspendida',
};

const typeLabels: Record<OrganizationType, string> = {
  REGULATORY_AUTHORITY: 'Autoridad reguladora',
  GENERATION_COMPANY: 'Empresa generadora',
  DISTRIBUTION_COMPANY: 'Empresa distribuidora',
  ENERGY_MARKETER: 'Comercializadora',
  FINANCIAL_INSTITUTION: 'Entidad financiera',
  CONSULTING_FIRM: 'Firma consultora',
  OTHER: 'Otra',
};

const statusColor = (status: OrganizationStatus) => {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'error';
  if (status === 'UNDER_REVIEW') return 'info';
  return 'warning';
};

export function OrganizationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.permissions.includes('organizations.manage') ?? false;
  const canApprove = user?.permissions.includes('organizations.approve') ?? false;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<OrganizationStatus | ''>('');
  const [type, setType] = useState<OrganizationType | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<OrganizationForm>(emptyForm);
  const [decision, setDecision] = useState<{
    organization: Organization;
    status: Exclude<OrganizationStatus, 'PENDING'>;
  } | null>(null);
  const [reason, setReason] = useState('');

  const params = useMemo(
    () => ({
      ...(query ? { q: query } : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    }),
    [query, status, type],
  );
  const organizationsQuery = useQuery({
    queryKey: ['organizations', params],
    queryFn: () =>
      apiClient.get<OrganizationList>('/organizations', { params }).then(({ data }) => data),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/organizations', {
        ...form,
        rnc: form.rnc || undefined,
        commercialName: form.commercialName || undefined,
        contactName: form.contactName || undefined,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        website: form.website || undefined,
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  const decisionMutation = useMutation({
    mutationFn: () => {
      if (!decision) throw new Error('No hay una decisión seleccionada.');
      return apiClient.patch(`/organizations/${decision.organization.id}/status`, {
        status: decision.status,
        reason: reason || undefined,
      });
    },
    onSuccess: async () => {
      setDecision(null);
      setReason('');
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  const openDecision = (
    organization: Organization,
    nextStatus: Exclude<OrganizationStatus, 'PENDING'>,
  ) => {
    setReason('');
    setDecision({ organization, status: nextStatus });
  };

  const decisionNeedsReason = decision?.status === 'REJECTED' || decision?.status === 'SUSPENDED';

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Box>
          <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }}>
            Participantes
          </Typography>
          <Typography color="text.secondary" mt={0.5}>
            Registro, revisión y habilitación de organizaciones del mercado energético.
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            Nueva organización
          </Button>
        )}
      </Stack>

      <Card sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Buscar"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre comercial, razón social o RNC"
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
              {organizationStatuses.map((item) => (
                <MenuItem key={item} value={item}>
                  {statusLabels[item]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 230 }}>
            <InputLabel>Tipo</InputLabel>
            <Select value={type} label="Tipo" onChange={(event) => setType(event.target.value)}>
              <MenuItem value="">Todos</MenuItem>
              {organizationTypes.map((item) => (
                <MenuItem key={item} value={item}>
                  {typeLabels[item]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Card>

      {organizationsQuery.isError && (
        <Alert severity="error">{getApiErrorMessage(organizationsQuery.error)}</Alert>
      )}
      <Card>
        {organizationsQuery.isLoading ? (
          <Box display="grid" sx={{ placeItems: 'center' }} minHeight={260}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Organización</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Contacto</TableCell>
                  <TableCell>Usuarios</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {organizationsQuery.data?.data.map((organization) => (
                  <TableRow key={organization.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <BusinessOutlined color="action" />
                        <Box>
                          <Typography fontWeight={750}>
                            {organization.commercialName || organization.legalName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {organization.legalName}
                            {organization.rnc ? ` · RNC ${organization.rnc}` : ''}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{typeLabels[organization.type]}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {organization.contactName || 'Sin contacto'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {organization.contactEmail}
                      </Typography>
                    </TableCell>
                    <TableCell>{organization._count.users}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={statusLabels[organization.status]}
                        color={statusColor(organization.status)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {canApprove && organization.type !== 'REGULATORY_AUTHORITY' && (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {organization.status === 'PENDING' && (
                            <Button
                              size="small"
                              onClick={() => openDecision(organization, 'UNDER_REVIEW')}
                            >
                              Revisar
                            </Button>
                          )}
                          {['PENDING', 'UNDER_REVIEW', 'REJECTED', 'SUSPENDED'].includes(
                            organization.status,
                          ) && (
                            <Button
                              size="small"
                              color="success"
                              onClick={() => openDecision(organization, 'APPROVED')}
                            >
                              Aprobar
                            </Button>
                          )}
                          {['PENDING', 'UNDER_REVIEW'].includes(organization.status) && (
                            <Button
                              size="small"
                              color="error"
                              onClick={() => openDecision(organization, 'REJECTED')}
                            >
                              Rechazar
                            </Button>
                          )}
                          {organization.status === 'APPROVED' && (
                            <Button
                              size="small"
                              color="error"
                              onClick={() => openDecision(organization, 'SUSPENDED')}
                            >
                              Suspender
                            </Button>
                          )}
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!organizationsQuery.data?.data.length && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                      No hay organizaciones que coincidan con los filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
      <Typography variant="caption" color="text.secondary">
        {organizationsQuery.data?.pagination.total ?? 0} organizaciones registradas
      </Typography>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Registrar organización</DialogTitle>
        <DialogContent>
          <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={2} pt={1}>
            <TextField
              label="Razón social"
              required
              value={form.legalName}
              onChange={(event) => setForm({ ...form, legalName: event.target.value })}
            />
            <TextField
              label="Nombre comercial"
              value={form.commercialName}
              onChange={(event) => setForm({ ...form, commercialName: event.target.value })}
            />
            <TextField
              label="RNC"
              value={form.rnc}
              onChange={(event) =>
                setForm({ ...form, rnc: event.target.value.replace(/\D/g, '').slice(0, 9) })
              }
              helperText="9 dígitos"
            />
            <FormControl>
              <InputLabel>Tipo de organización</InputLabel>
              <Select
                value={form.type}
                label="Tipo de organización"
                onChange={(event) => setForm({ ...form, type: event.target.value })}
              >
                {organizationTypes
                  .filter((item) => item !== 'REGULATORY_AUTHORITY')
                  .map((item) => (
                    <MenuItem key={item} value={item}>
                      {typeLabels[item]}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <TextField
              label="Persona de contacto"
              value={form.contactName}
              onChange={(event) => setForm({ ...form, contactName: event.target.value })}
            />
            <TextField
              label="Correo de contacto"
              type="email"
              value={form.contactEmail}
              onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
            />
            <TextField
              label="Teléfono"
              value={form.contactPhone}
              onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
            />
            <TextField
              label="Sitio web"
              value={form.website}
              onChange={(event) => setForm({ ...form, website: event.target.value })}
              placeholder="https://"
            />
          </Box>
          {createMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {getApiErrorMessage(createMutation.error)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!form.legalName.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Registrar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(decision)} onClose={() => setDecision(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {decision ? `${statusLabels[decision.status]} organización` : 'Cambiar estado'}
        </DialogTitle>
        <DialogContent>
          <Typography mb={decisionNeedsReason ? 2 : 0}>
            {decision?.organization.commercialName || decision?.organization.legalName}
          </Typography>
          {decisionNeedsReason && (
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={3}
              label="Motivo"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
            />
          )}
          {decisionMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {getApiErrorMessage(decisionMutation.error)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecision(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color={
              decision?.status === 'APPROVED'
                ? 'success'
                : decisionNeedsReason
                  ? 'error'
                  : 'primary'
            }
            disabled={(decisionNeedsReason && !reason.trim()) || decisionMutation.isPending}
            onClick={() => decisionMutation.mutate()}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
