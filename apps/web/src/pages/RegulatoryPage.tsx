import { AddOutlined, BalanceOutlined, SearchOutlined } from '@mui/icons-material';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  regulationScopeTypes,
  regulationStatuses,
  regulationTypes,
  type RegulationScopeType,
  type RegulationStatus,
  type RegulationType,
} from '@ecosoft/shared';
import { useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';

interface Authority {
  id: string;
  legalName: string;
  commercialName: string | null;
}

interface Regulation {
  id: string;
  code: string;
  title: string;
  summary: string | null;
  type: RegulationType;
  status: RegulationStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceUrl: string | null;
  documentReference: string | null;
  issuingOrganization: Authority;
  scopes: Array<{
    id: string;
    entityType: RegulationScopeType;
    entityId: string;
    notes: string | null;
  }>;
}

interface RegulationResponse {
  data: Regulation[];
  pagination: { total: number };
}

interface RegulationForm {
  code: string;
  title: string;
  summary: string;
  type: RegulationType;
  issuingOrganizationId: string;
  effectiveFrom: string;
  effectiveTo: string;
  sourceUrl: string;
  documentReference: string;
  scopeType: RegulationScopeType | '';
  scopeId: string;
  scopeNotes: string;
}

const emptyForm: RegulationForm = {
  code: '',
  title: '',
  summary: '',
  type: 'RESOLUCION',
  issuingOrganizationId: '',
  effectiveFrom: '',
  effectiveTo: '',
  sourceUrl: '',
  documentReference: '',
  scopeType: '',
  scopeId: '',
  scopeNotes: '',
};

const statusLabels: Record<RegulationStatus, string> = {
  BORRADOR: 'Borrador',
  VIGENTE: 'Vigente',
  SUSPENDIDA: 'Suspendida',
  DEROGADA: 'Derogada',
};

const typeLabels: Record<RegulationType, string> = {
  NORMATIVA: 'Normativa',
  RESOLUCION: 'Resolución',
  REGLAMENTO: 'Reglamento',
};

const nextStates: Record<RegulationStatus, RegulationStatus[]> = {
  BORRADOR: ['VIGENTE'],
  VIGENTE: ['SUSPENDIDA', 'DEROGADA'],
  SUSPENDIDA: ['VIGENTE', 'DEROGADA'],
  DEROGADA: [],
};

const trustedHeaders = { 'X-Requested-With': 'EcoSoftWeb' };

export function RegulatoryPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.permissions.includes('regulatory.manage') ?? false;
  const [q, setQ] = useState('');
  const [type, setType] = useState<RegulationType | ''>('');
  const [status, setStatus] = useState<RegulationStatus | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<RegulationForm>(emptyForm);
  const [transition, setTransition] = useState<{
    regulation: Regulation;
    status: RegulationStatus;
  } | null>(null);
  const [reason, setReason] = useState('');
  const params = useMemo(
    () => ({ ...(q ? { q } : {}), ...(type ? { type } : {}), ...(status ? { status } : {}) }),
    [q, type, status],
  );
  const regulations = useQuery({
    queryKey: ['regulatory', params],
    queryFn: () =>
      apiClient.get<RegulationResponse>('/regulatory', { params }).then(({ data }) => data),
  });
  const authorities = useQuery({
    queryKey: ['organizations', 'regulatory-authorities'],
    queryFn: () =>
      apiClient
        .get<{ data: Authority[] }>('/organizations', {
          params: { type: 'REGULATORY_AUTHORITY', status: 'APPROVED', pageSize: 100 },
        })
        .then(({ data }) => data.data),
    enabled: canManage,
  });
  const create = useMutation({
    mutationFn: () =>
      apiClient.post(
        '/regulatory',
        {
          code: form.code,
          title: form.title,
          summary: form.summary || undefined,
          type: form.type,
          issuingOrganizationId: form.issuingOrganizationId,
          effectiveFrom: new Date(`${form.effectiveFrom}T00:00:00`).toISOString(),
          effectiveTo: form.effectiveTo
            ? new Date(`${form.effectiveTo}T23:59:59`).toISOString()
            : undefined,
          sourceUrl: form.sourceUrl || undefined,
          documentReference: form.documentReference || undefined,
          scopes:
            form.scopeType && form.scopeId
              ? [
                  {
                    entityType: form.scopeType,
                    entityId: form.scopeId,
                    notes: form.scopeNotes || undefined,
                  },
                ]
              : [],
        },
        { headers: trustedHeaders },
      ),
    onSuccess: async () => {
      setCreateOpen(false);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ['regulatory'] });
    },
  });
  const changeStatus = useMutation({
    mutationFn: () => {
      if (!transition) throw new Error('No hay una transición seleccionada.');
      return apiClient.patch(
        `/regulatory/${transition.regulation.id}/status`,
        { status: transition.status, reason },
        { headers: trustedHeaders },
      );
    },
    onSuccess: async () => {
      setTransition(null);
      setReason('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['regulatory'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications-unread'] }),
      ]);
    },
  });
  const error = regulations.error || create.error || changeStatus.error;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Box>
          <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }}>
            Regulación
          </Typography>
          <Typography color="text.secondary">
            Normativas, resoluciones y reglamentos vinculados al dominio energético.
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            Nueva regulación
          </Button>
        )}
      </Stack>
      {error && <Alert severity="error">{getApiErrorMessage(error)}</Alert>}
      <Card sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Buscar"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Código o título"
            slotProps={{ input: { startAdornment: <SearchOutlined sx={{ mr: 1 }} /> } }}
            fullWidth
          />
          <FormControl sx={{ minWidth: 190 }}>
            <InputLabel>Tipo</InputLabel>
            <Select value={type} label="Tipo" onChange={(event) => setType(event.target.value)}>
              <MenuItem value="">Todos</MenuItem>
              {regulationTypes.map((value) => (
                <MenuItem key={value} value={value}>
                  {typeLabels[value]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {canManage && (
            <FormControl sx={{ minWidth: 190 }}>
              <InputLabel>Estado</InputLabel>
              <Select
                value={status}
                label="Estado"
                onChange={(event) => setStatus(event.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                {regulationStatuses.map((value) => (
                  <MenuItem key={value} value={value}>
                    {statusLabels[value]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
      </Card>
      <Card>
        {regulations.isLoading ? (
          <Box minHeight={280} display="grid" sx={{ placeItems: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Regulación</TableCell>
                  <TableCell>Autoridad</TableCell>
                  <TableCell>Vigencia</TableCell>
                  <TableCell>Alcance</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {regulations.data?.data.map((regulation) => (
                  <TableRow key={regulation.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <BalanceOutlined color="primary" />
                        <Box>
                          <Typography fontWeight={800}>{regulation.code}</Typography>
                          <Typography variant="body2">{regulation.title}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {typeLabels[regulation.type]}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {regulation.issuingOrganization.commercialName ??
                        regulation.issuingOrganization.legalName}
                    </TableCell>
                    <TableCell>
                      {new Date(regulation.effectiveFrom).toLocaleDateString()}
                      {regulation.effectiveTo
                        ? ` – ${new Date(regulation.effectiveTo).toLocaleDateString()}`
                        : ''}
                    </TableCell>
                    <TableCell>{regulation.scopes.length} relaciones</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={statusLabels[regulation.status]}
                        color={
                          regulation.status === 'VIGENTE'
                            ? 'success'
                            : regulation.status === 'BORRADOR'
                              ? 'warning'
                              : 'default'
                        }
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {canManage && (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {nextStates[regulation.status].map((next) => (
                            <Button
                              key={next}
                              size="small"
                              onClick={() => {
                                setReason('');
                                setTransition({ regulation, status: next });
                              }}
                            >
                              {next === 'VIGENTE'
                                ? regulation.status === 'SUSPENDIDA'
                                  ? 'Reactivar'
                                  : 'Publicar'
                                : next === 'SUSPENDIDA'
                                  ? 'Suspender'
                                  : 'Derogar'}
                            </Button>
                          ))}
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Nueva regulación</DialogTitle>
        <DialogContent dividers>
          <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={2}>
            <TextField
              label="Código"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
              required
            />
            <FormControl required>
              <InputLabel>Tipo</InputLabel>
              <Select
                value={form.type}
                label="Tipo"
                onChange={(event) => setForm({ ...form, type: event.target.value })}
              >
                {regulationTypes.map((value) => (
                  <MenuItem key={value} value={value}>
                    {typeLabels[value]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Título"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
              sx={{ gridColumn: { sm: '1 / -1' } }}
            />
            <TextField
              label="Resumen"
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
              multiline
              minRows={3}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            />
            <FormControl required>
              <InputLabel>Autoridad emisora</InputLabel>
              <Select
                value={form.issuingOrganizationId}
                label="Autoridad emisora"
                onChange={(event) =>
                  setForm({ ...form, issuingOrganizationId: event.target.value })
                }
              >
                {authorities.data?.map((authority) => (
                  <MenuItem key={authority.id} value={authority.id}>
                    {authority.commercialName ?? authority.legalName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Fecha de vigencia"
              type="date"
              value={form.effectiveFrom}
              onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
              required
            />
            <TextField
              label="Fin de vigencia (opcional)"
              type="date"
              value={form.effectiveTo}
              onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="URL de fuente oficial"
              value={form.sourceUrl}
              onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })}
            />
            <TextField
              label="Referencia documental"
              value={form.documentReference}
              onChange={(event) => setForm({ ...form, documentReference: event.target.value })}
            />
            <FormControl>
              <InputLabel>Entidad relacionada</InputLabel>
              <Select
                value={form.scopeType}
                label="Entidad relacionada"
                onChange={(event) => setForm({ ...form, scopeType: event.target.value })}
              >
                <MenuItem value="">Sin relación inicial</MenuItem>
                {regulationScopeTypes.map((value) => (
                  <MenuItem key={value} value={value}>
                    {value.replaceAll('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="ID de entidad"
              value={form.scopeId}
              onChange={(event) => setForm({ ...form, scopeId: event.target.value })}
              disabled={!form.scopeType}
              helperText="UUID de la subasta, contrato, proyecto o evaluación"
            />
            <TextField
              label="Notas del alcance"
              value={form.scopeNotes}
              onChange={(event) => setForm({ ...form, scopeNotes: event.target.value })}
              disabled={!form.scopeType}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => create.mutate()}
            disabled={
              create.isPending ||
              !form.code ||
              !form.title ||
              !form.issuingOrganizationId ||
              !form.effectiveFrom
            }
          >
            Crear borrador
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(transition)}
        onClose={() => setTransition(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {transition ? `${statusLabels[transition.status]} ${transition.regulation.code}` : ''}
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Justificación"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            multiline
            minRows={4}
            fullWidth
            required
            helperText="La decisión quedará registrada en el historial inmutable."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransition(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => changeStatus.mutate()}
            disabled={reason.trim().length < 10 || changeStatus.isPending}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
