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
import { AddOutlined, GavelOutlined, SearchOutlined, TuneOutlined } from '@mui/icons-material';
import { auctionStatuses, type AuctionStatus } from '@ecosoft/shared';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';

interface Organization {
  id: string;
  legalName: string;
  commercialName: string | null;
  type: string;
}
interface CatalogItem {
  code: string;
  name: string;
}
interface Requirement {
  code: string;
  title: string;
  category: string;
  isMandatory: boolean;
  sortOrder: number;
}
interface Participant {
  status: string;
  organization: Organization;
}
interface Auction {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: AuctionStatus;
  renewableTechnologyCode: string;
  currencyCode: string;
  capacityMw: string;
  maximumPrice: string | null;
  openAt: string;
  closeAt: string;
  evaluationStartAt: string | null;
  awardPlannedAt: string | null;
  managingOrganization: Organization;
  requirements: Requirement[];
  participants: Participant[];
  _count: { requirements: number; participants: number; events: number };
}
interface ListResponse<T> {
  data: T[];
  pagination: { total: number };
}

const statusLabels: Record<AuctionStatus, string> = {
  BORRADOR: 'Borrador',
  PROGRAMADA: 'Programada',
  PUBLICADA: 'Publicada',
  ABIERTA: 'Abierta',
  CERRADA: 'Cerrada',
  EN_EVALUACION: 'En evaluación',
  ADJUDICADA: 'Adjudicada',
  CANCELADA: 'Cancelada',
  FINALIZADA: 'Finalizada',
};
const nextStatuses: Partial<Record<AuctionStatus, AuctionStatus[]>> = {
  BORRADOR: ['PROGRAMADA', 'PUBLICADA', 'CANCELADA'],
  PROGRAMADA: ['PUBLICADA', 'CANCELADA'],
  PUBLICADA: ['ABIERTA', 'CANCELADA'],
  ABIERTA: ['CERRADA', 'CANCELADA'],
  CERRADA: ['EN_EVALUACION', 'CANCELADA'],
  EN_EVALUACION: ['ADJUDICADA', 'CANCELADA'],
  ADJUDICADA: ['FINALIZADA'],
};
const emptyForm = {
  code: '',
  title: '',
  description: '',
  managingOrganizationId: '',
  renewableTechnologyCode: '',
  currencyCode: 'DOP',
  capacityMw: '',
  maximumPrice: '',
  openAt: '',
  closeAt: '',
  evaluationStartAt: '',
  awardPlannedAt: '',
  timezone: 'America/Santo_Domingo',
};
const emptyRequirement: Requirement = {
  code: 'REQ-01',
  title: '',
  category: 'TECNICO',
  isMandatory: true,
  sortOrder: 10,
};

export function AuctionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = user?.permissions.includes('auctions.create') ?? false;
  const canUpdate = user?.permissions.includes('auctions.update') ?? false;
  const canPublish = user?.permissions.includes('auctions.publish') ?? false;
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<AuctionStatus | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState<Auction | null>(null);
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [requirements, setRequirements] = useState<Requirement[]>([emptyRequirement]);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const params = useMemo(
    () => ({ ...(q ? { q } : {}), ...(status ? { status } : {}) }),
    [q, status],
  );

  const auctionsQuery = useQuery({
    queryKey: ['auctions', params],
    queryFn: () =>
      apiClient.get<ListResponse<Auction>>('/auctions', { params }).then(({ data }) => data),
  });
  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'auction-options'],
    queryFn: () =>
      apiClient
        .get<ListResponse<Organization>>('/organizations', {
          params: { status: 'APPROVED', pageSize: 100 },
        })
        .then(({ data }) => data.data),
    enabled: canCreate || canUpdate,
  });
  const technologyQuery = useQuery({
    queryKey: ['catalogs', 'ENERGY_TECHNOLOGY'],
    queryFn: () =>
      apiClient
        .get<{ data: CatalogItem[] }>('/catalogs', {
          params: { type: 'ENERGY_TECHNOLOGY', active: true },
        })
        .then(({ data }) => data.data),
  });
  const currencyQuery = useQuery({
    queryKey: ['catalogs', 'CURRENCY'],
    queryFn: () =>
      apiClient
        .get<{ data: CatalogItem[] }>('/catalogs', { params: { type: 'CURRENCY', active: true } })
        .then(({ data }) => data.data),
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['auctions'] });
  };
  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/auctions', {
        ...form,
        capacityMw: Number(form.capacityMw),
        maximumPrice: form.maximumPrice ? Number(form.maximumPrice) : undefined,
        openAt: new Date(form.openAt).toISOString(),
        closeAt: new Date(form.closeAt).toISOString(),
        evaluationStartAt: form.evaluationStartAt
          ? new Date(form.evaluationStartAt).toISOString()
          : undefined,
        awardPlannedAt: form.awardPlannedAt
          ? new Date(form.awardPlannedAt).toISOString()
          : undefined,
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setForm(emptyForm);
      await refresh();
    },
  });
  const requirementsMutation = useMutation({
    mutationFn: () => apiClient.put(`/auctions/${selected?.id}/requirements`, { requirements }),
    onSuccess: async () => {
      setRequirementsOpen(false);
      setSelected(null);
      await refresh();
    },
  });
  const participantsMutation = useMutation({
    mutationFn: () =>
      apiClient.put(`/auctions/${selected?.id}/participants`, {
        participants: participantIds.map((organizationId) => ({
          organizationId,
          status: 'HABILITADO',
        })),
      }),
    onSuccess: async () => {
      setParticipantsOpen(false);
      setSelected(null);
      await refresh();
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ auction, next }: { auction: Auction; next: AuctionStatus }) => {
      const reason =
        next === 'CANCELADA'
          ? window.prompt('Indique la justificación de la cancelación (mínimo 10 caracteres):')
          : undefined;
      if (next === 'CANCELADA' && !reason)
        throw new Error('La cancelación requiere una justificación.');
      return apiClient.patch(`/auctions/${auction.id}/status`, { status: next, reason });
    },
    onSuccess: refresh,
  });
  const mutationError =
    createMutation.error ||
    requirementsMutation.error ||
    participantsMutation.error ||
    statusMutation.error;

  const openRequirements = (auction: Auction) => {
    setSelected(auction);
    setRequirements(auction.requirements.length ? auction.requirements : [emptyRequirement]);
    setRequirementsOpen(true);
  };
  const openParticipants = (auction: Auction) => {
    setSelected(auction);
    setParticipantIds(
      auction.participants
        .filter((item) => item.status === 'HABILITADO')
        .map((item) => item.organization.id),
    );
    setParticipantsOpen(true);
  };
  const regulatoryOrganizations =
    organizationsQuery.data?.filter((item) => item.type === 'REGULATORY_AUTHORITY') ?? [];
  const participantOrganizations =
    organizationsQuery.data?.filter((item) => item.type !== 'REGULATORY_AUTHORITY') ?? [];

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Box>
          <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }}>
            Subastas energéticas
          </Typography>
          <Typography color="text.secondary" mt={0.5}>
            Convocatorias, capacidad, cronograma, requisitos y participantes autorizados.
          </Typography>
        </Box>
        {canCreate && (
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            Nueva subasta
          </Button>
        )}
      </Stack>
      {mutationError && <Alert severity="error">{getApiErrorMessage(mutationError)}</Alert>}
      <Card sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Buscar"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Código o título"
            slotProps={{
              input: { startAdornment: <SearchOutlined color="action" sx={{ mr: 1 }} /> },
            }}
            fullWidth
          />
          <FormControl sx={{ minWidth: 210 }}>
            <InputLabel>Estado</InputLabel>
            <Select
              value={status}
              label="Estado"
              onChange={(event) => setStatus(event.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {auctionStatuses.map((item) => (
                <MenuItem key={item} value={item}>
                  {statusLabels[item]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Card>
      <Card>
        {auctionsQuery.isLoading ? (
          <Box display="grid" sx={{ placeItems: 'center' }} minHeight={280}>
            <CircularProgress />
          </Box>
        ) : auctionsQuery.isError ? (
          <Alert severity="error">{getApiErrorMessage(auctionsQuery.error)}</Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Proceso</TableCell>
                  <TableCell>Tecnología</TableCell>
                  <TableCell>Capacidad</TableCell>
                  <TableCell>Cronograma</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auctionsQuery.data?.data.map((auction) => (
                  <TableRow key={auction.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <GavelOutlined color="primary" />
                        <Box>
                          <Typography fontWeight={750}>{auction.title}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {auction.code} ·{' '}
                            {auction.managingOrganization.commercialName ||
                              auction.managingOrganization.legalName}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{auction.renewableTechnologyCode}</TableCell>
                    <TableCell>{Number(auction.capacityMw).toLocaleString('es-DO')} MW</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        Abre{' '}
                        {new Intl.DateTimeFormat('es-DO', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(auction.openAt))}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Cierra{' '}
                        {new Intl.DateTimeFormat('es-DO', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(auction.closeAt))}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={statusLabels[auction.status]}
                        color={
                          auction.status === 'ABIERTA'
                            ? 'success'
                            : auction.status === 'CANCELADA'
                              ? 'error'
                              : auction.status === 'BORRADOR'
                                ? 'default'
                                : 'info'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" gap={0.5} flexWrap="wrap">
                        {canUpdate &&
                          ['BORRADOR', 'PROGRAMADA', 'PUBLICADA'].includes(auction.status) && (
                            <>
                              <Button
                                size="small"
                                startIcon={<TuneOutlined />}
                                onClick={() => openRequirements(auction)}
                              >
                                Requisitos
                              </Button>
                              <Button size="small" onClick={() => openParticipants(auction)}>
                                Participantes
                              </Button>
                            </>
                          )}
                        {canPublish &&
                          nextStatuses[auction.status]?.map((next) => (
                            <Button
                              key={next}
                              size="small"
                              color={next === 'CANCELADA' ? 'error' : 'primary'}
                              onClick={() => statusMutation.mutate({ auction, next })}
                            >
                              {statusLabels[next]}
                            </Button>
                          ))}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {auctionsQuery.data?.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      No hay subastas que coincidan con los filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Nueva subasta energética</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Código"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                fullWidth
                required
              />
              <TextField
                label="Título"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                fullWidth
                required
              />
            </Stack>
            <TextField
              label="Descripción"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              multiline
              minRows={2}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth required>
                <InputLabel>Autoridad administradora</InputLabel>
                <Select
                  value={form.managingOrganizationId}
                  label="Autoridad administradora"
                  onChange={(e) => setForm({ ...form, managingOrganizationId: e.target.value })}
                >
                  {regulatoryOrganizations.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.commercialName || item.legalName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel>Tecnología</InputLabel>
                <Select
                  value={form.renewableTechnologyCode}
                  label="Tecnología"
                  onChange={(e) => setForm({ ...form, renewableTechnologyCode: e.target.value })}
                >
                  {technologyQuery.data?.map((item) => (
                    <MenuItem key={item.code} value={item.code}>
                      {item.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Capacidad (MW)"
                type="number"
                value={form.capacityMw}
                onChange={(e) => setForm({ ...form, capacityMw: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Precio máximo"
                type="number"
                value={form.maximumPrice}
                onChange={(e) => setForm({ ...form, maximumPrice: e.target.value })}
                fullWidth
                required
              />
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Moneda</InputLabel>
                <Select
                  value={form.currencyCode}
                  label="Moneda"
                  onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
                >
                  {currencyQuery.data?.map((item) => (
                    <MenuItem key={item.code} value={item.code}>
                      {item.code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {(['openAt', 'closeAt', 'evaluationStartAt', 'awardPlannedAt'] as const).map(
                (field) => (
                  <TextField
                    key={field}
                    label={
                      {
                        openAt: 'Apertura',
                        closeAt: 'Cierre',
                        evaluationStartAt: 'Inicio de evaluación',
                        awardPlannedAt: 'Adjudicación prevista',
                      }[field]
                    }
                    type="datetime-local"
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    required={field === 'openAt' || field === 'closeAt'}
                  />
                ),
              )}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={
              createMutation.isPending ||
              !form.code ||
              !form.title ||
              !form.managingOrganizationId ||
              !form.renewableTechnologyCode ||
              !form.capacityMw ||
              !form.maximumPrice ||
              !form.openAt ||
              !form.closeAt
            }
            onClick={() => createMutation.mutate()}
          >
            Crear borrador
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={requirementsOpen}
        onClose={() => setRequirementsOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Requisitos · {selected?.code}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {requirements.map((item, index) => (
              <Card key={index} variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <TextField
                    label="Código"
                    value={item.code}
                    onChange={(e) =>
                      setRequirements(
                        requirements.map((r, i) =>
                          i === index ? { ...r, code: e.target.value.toUpperCase() } : r,
                        ),
                      )
                    }
                  />
                  <TextField
                    label="Requisito"
                    value={item.title}
                    onChange={(e) =>
                      setRequirements(
                        requirements.map((r, i) =>
                          i === index ? { ...r, title: e.target.value } : r,
                        ),
                      )
                    }
                    fullWidth
                  />
                  <FormControl sx={{ minWidth: 160 }}>
                    <InputLabel>Categoría</InputLabel>
                    <Select
                      value={item.category}
                      label="Categoría"
                      onChange={(e) =>
                        setRequirements(
                          requirements.map((r, i) =>
                            i === index ? { ...r, category: e.target.value } : r,
                          ),
                        )
                      }
                    >
                      {['LEGAL', 'TECNICO', 'FINANCIERO', 'REGULATORIO', 'OTRO'].map((category) => (
                        <MenuItem key={category} value={category}>
                          {category}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    color="error"
                    disabled={requirements.length === 1}
                    onClick={() => setRequirements(requirements.filter((_, i) => i !== index))}
                  >
                    Quitar
                  </Button>
                </Stack>
              </Card>
            ))}
            <Button
              onClick={() =>
                setRequirements([
                  ...requirements,
                  {
                    ...emptyRequirement,
                    code: `REQ-${String(requirements.length + 1).padStart(2, '0')}`,
                    sortOrder: (requirements.length + 1) * 10,
                  },
                ])
              }
            >
              Agregar requisito
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRequirementsOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={
              requirementsMutation.isPending ||
              requirements.some((item) => !item.code || !item.title)
            }
            onClick={() => requirementsMutation.mutate()}
          >
            Guardar requisitos
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={participantsOpen}
        onClose={() => setParticipantsOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Participantes habilitados · {selected?.code}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Organizaciones</InputLabel>
            <Select
              multiple
              value={participantIds}
              label="Organizaciones"
              onChange={(e) => setParticipantIds(e.target.value as string[])}
            >
              {participantOrganizations.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.commercialName || item.legalName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setParticipantsOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={participantsMutation.isPending || participantIds.length === 0}
            onClick={() => participantsMutation.mutate()}
          >
            Guardar participantes
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
