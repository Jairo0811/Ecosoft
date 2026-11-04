import { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
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
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { AddOutlined, GavelOutlined, SearchOutlined, TuneOutlined } from '@mui/icons-material';
import { auctionStatuses, type AuctionStatus } from '@ecosoft/shared';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useNotify } from '../components/Feedback';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/PageState';
import { formatDateTime, formatNumber, formatTechnology } from '../utils/format';

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
/** Action verbs for each target state (buttons say what happens, not the resulting state). */
const transitionLabels: Record<AuctionStatus, string> = {
  BORRADOR: 'Volver a borrador',
  PROGRAMADA: 'Programar',
  PUBLICADA: 'Publicar',
  ABIERTA: 'Abrir recepción',
  CERRADA: 'Cerrar recepción',
  EN_EVALUACION: 'Iniciar evaluación',
  ADJUDICADA: 'Marcar adjudicada',
  CANCELADA: 'Cancelar subasta',
  FINALIZADA: 'Finalizar',
};
/** Past participle for the success toast, matching the action verb. */
const transitionDone: Record<AuctionStatus, string> = {
  BORRADOR: 'devuelta a borrador',
  PROGRAMADA: 'programada',
  PUBLICADA: 'publicada',
  ABIERTA: 'abierta para recibir ofertas',
  CERRADA: 'cerrada a nuevas ofertas',
  EN_EVALUACION: 'en evaluación',
  ADJUDICADA: 'marcada como adjudicada',
  CANCELADA: 'cancelada',
  FINALIZADA: 'finalizada',
};
/** Mirrors apps/api auction-state.ts; the API remains the authority on transitions. */
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
  const [transition, setTransition] = useState<{ auction: Auction; next: AuctionStatus } | null>(
    null,
  );
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const notify = useNotify();
  // Typing does not fire one request per keystroke; the list updates with the settled value.
  const search = useDeferredValue(q.trim());
  const params = useMemo(
    () => ({
      ...(search ? { q: search } : {}),
      ...(status ? { status } : {}),
      page: page + 1,
      pageSize,
    }),
    [search, status, page, pageSize],
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
    mutationFn: ({
      auction,
      next,
      reason,
    }: {
      auction: Auction;
      next: AuctionStatus;
      reason?: string | undefined;
    }) =>
      apiClient.patch(`/auctions/${auction.id}/status`, {
        status: next,
        ...(reason ? { reason } : {}),
      }),
    onSuccess: async (_response, { auction, next }) => {
      setTransition(null);
      notify(`Subasta ${auction.code} ${transitionDone[next]}.`);
      await refresh();
    },
  });
  const mutationError =
    createMutation.error || requirementsMutation.error || participantsMutation.error;

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
      <PageHeader
        title="Subastas energéticas"
        description="Convocatorias, capacidad, cronograma, requisitos y participantes autorizados."
        actions={
          canCreate && (
            <Button
              variant="contained"
              startIcon={<AddOutlined />}
              onClick={() => setCreateOpen(true)}
            >
              Nueva subasta
            </Button>
          )
        }
      />
      {mutationError && <Alert severity="error">{getApiErrorMessage(mutationError)}</Alert>}
      <Card sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Buscar"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(0);
            }}
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
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(0);
              }}
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
          <Box p={2}>
            <LoadingState rows={5} label="Cargando subastas" />
          </Box>
        ) : auctionsQuery.isError ? (
          <Box p={2}>
            <ErrorState error={auctionsQuery.error} onRetry={() => void auctionsQuery.refetch()} />
          </Box>
        ) : auctionsQuery.data?.data.length === 0 ? (
          <Box p={2}>
            <EmptyState
              title={
                q || status ? 'Ninguna subasta coincide con los filtros' : 'Aún no hay subastas'
              }
              description={
                q || status
                  ? 'Pruebe con otro código, título o estado.'
                  : canCreate
                    ? 'Cree la primera convocatoria con «Nueva subasta».'
                    : 'Las convocatorias publicadas aparecerán aquí.'
              }
            />
          </Box>
        ) : (
          <TableContainer>
            <Table sx={{ minWidth: 860 }} aria-label="Subastas">
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
                        <GavelOutlined
                          color="primary"
                          sx={{ display: { xs: 'none', sm: 'block' } }}
                          aria-hidden
                        />
                        <Box>
                          <Typography fontWeight={600}>{auction.title}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {auction.code} ·{' '}
                            {auction.managingOrganization.commercialName ||
                              auction.managingOrganization.legalName}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{formatTechnology(auction.renewableTechnologyCode)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatNumber(auction.capacityMw)} MW
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">Abre {formatDateTime(auction.openAt)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Cierra {formatDateTime(auction.closeAt)}
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
                              variant={next === 'CANCELADA' ? 'text' : 'outlined'}
                              color={next === 'CANCELADA' ? 'error' : 'primary'}
                              onClick={() => {
                                statusMutation.reset();
                                setTransition({ auction, next });
                              }}
                            >
                              {transitionLabels[next]}
                            </Button>
                          ))}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={auctionsQuery.data?.pagination.total ?? 0}
              page={page}
              rowsPerPage={pageSize}
              rowsPerPageOptions={[10, 20, 50]}
              onPageChange={(_event, next) => setPage(next)}
              onRowsPerPageChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
            />
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
      <ConfirmDialog
        open={Boolean(transition)}
        title={
          transition?.next === 'CANCELADA'
            ? `Cancelar la subasta ${transition.auction.code}`
            : `${transition ? transitionLabels[transition.next] : ''}: ${transition?.auction.code ?? ''}`
        }
        description={
          transition?.next === 'CANCELADA'
            ? 'La cancelación es definitiva: la subasta no podrá reabrirse y los participantes verán el motivo.'
            : 'Confirme el cambio de estado. Quedará registrado en la auditoría.'
        }
        summary={
          transition && (
            <Box
              component="dl"
              sx={{
                m: 0,
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                columnGap: 2,
                rowGap: 0.75,
                '& dt': { color: 'text.secondary' },
                '& dd': { m: 0, fontWeight: 500 },
              }}
            >
              <dt>Subasta</dt>
              <dd>{transition.auction.title}</dd>
              <dt>Estado</dt>
              <dd>
                {statusLabels[transition.auction.status]} → {statusLabels[transition.next]}
              </dd>
              <dt>Capacidad</dt>
              <dd>{formatNumber(transition.auction.capacityMw)} MW</dd>
              <dt>Cierre</dt>
              <dd>{formatDateTime(transition.auction.closeAt)}</dd>
            </Box>
          )
        }
        confirmLabel={transition ? transitionLabels[transition.next] : 'Confirmar'}
        destructive={transition?.next === 'CANCELADA'}
        reason={
          transition?.next === 'CANCELADA'
            ? { label: 'Justificación de la cancelación', minLength: 10 }
            : undefined
        }
        pending={statusMutation.isPending}
        error={statusMutation.error}
        onConfirm={(reason) => transition && statusMutation.mutate({ ...transition, reason })}
        onClose={() => setTransition(null)}
      />
    </Stack>
  );
}
