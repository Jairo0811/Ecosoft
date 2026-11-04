import { useState } from 'react';
import {
  AddOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  NoteAddOutlined,
  SendOutlined,
  UndoOutlined,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { bidStatuses, type BidStatus } from '@ecosoft/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useNotify } from '../components/Feedback';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/PageState';
import { formatDateTime, formatNumber } from '../utils/format';
import { getApiErrorMessage } from '../api/errors';
import { NewBidDialog } from './offers/NewBidDialog';
import { UploadDocumentDialog } from './offers/UploadDocumentDialog';
import {
  bidStatusColor,
  bidStatusLabels,
  entityTypeLabels,
  fileNameFromDisposition,
  formatBytes,
  trustedHeaders,
  type Bid,
  type DocumentItem,
  type Paginated,
} from './offers/model';

function BidsPanel() {
  const { hasPermission } = useAuth();
  const canSubmit = hasPermission('bids.submit');
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [status, setStatus] = useState<BidStatus | ''>('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [creating, setCreating] = useState(false);
  const [action, setAction] = useState<{ bid: Bid; kind: 'submit' | 'withdraw' } | null>(null);

  const bids = useQuery({
    queryKey: ['bids', { status, page, pageSize }],
    queryFn: () =>
      apiClient
        .get<Paginated<Bid>>('/bids', {
          params: { ...(status ? { status } : {}), page: page + 1, pageSize },
        })
        .then(({ data }) => data),
    placeholderData: keepPreviousData,
  });
  const bidAction = useMutation({
    mutationFn: ({
      bid,
      kind,
      reason,
    }: {
      bid: Bid;
      kind: 'submit' | 'withdraw';
      reason: string;
    }) => apiClient.post(`/bids/${bid.id}/${kind}`, { reason }, { headers: trustedHeaders }),
    onSuccess: async (_response, { bid, kind }) => {
      setAction(null);
      notify(
        kind === 'submit'
          ? `Oferta «${bid.projectName}» enviada.`
          : `Oferta «${bid.projectName}» retirada.`,
      );
      await queryClient.invalidateQueries({ queryKey: ['bids'] });
    },
  });

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="bid-status-label">Estado</InputLabel>
          <Select
            labelId="bid-status-label"
            label="Estado"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            {bidStatuses.map((item) => (
              <MenuItem key={item} value={item}>
                {bidStatusLabels[item]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {canSubmit && (
          <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setCreating(true)}>
            Nueva oferta
          </Button>
        )}
      </Stack>
      <Card>
        {bids.isLoading ? (
          <Box p={2}>
            <LoadingState rows={4} label="Cargando ofertas" />
          </Box>
        ) : bids.isError ? (
          <Box p={2}>
            <ErrorState error={bids.error} onRetry={() => void bids.refetch()} />
          </Box>
        ) : !bids.data?.data.length ? (
          <Box p={2}>
            <EmptyState
              title={status ? 'Ninguna oferta en este estado' : 'Aún no hay ofertas'}
              description={
                canSubmit
                  ? 'Cree un borrador, adjunte los documentos obligatorios y envíelo antes del cierre.'
                  : 'Las ofertas de su ámbito aparecerán aquí.'
              }
            />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small" aria-label="Ofertas" sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Proyecto</TableCell>
                  <TableCell>Subasta</TableCell>
                  <TableCell align="right">Potencia</TableCell>
                  <TableCell align="right">Precio</TableCell>
                  <TableCell>Estado</TableCell>
                  {canSubmit && <TableCell align="right">Acciones</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {bids.data.data.map((bid) => (
                  <TableRow key={bid.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {bid.projectName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {bid.organization.commercialName ?? bid.organization.legalName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{bid.auction.code}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Cierra {formatDateTime(bid.auction.closeAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {formatNumber(bid.offeredPowerMw)} MW
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {bid.offeredPrice === null ? (
                        <Tooltip title="Información financiera no disponible para su rol">
                          <span>Reservado</span>
                        </Tooltip>
                      ) : (
                        `${formatNumber(bid.offeredPrice)} ${bid.currencyCode ?? ''}/MWh`
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={bidStatusLabels[bid.status]}
                        color={bidStatusColor(bid.status)}
                        variant="outlined"
                      />
                    </TableCell>
                    {canSubmit && (
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {bid.status === 'BORRADOR' && (
                          <Button
                            size="small"
                            startIcon={<SendOutlined />}
                            onClick={() => {
                              bidAction.reset();
                              setAction({ bid, kind: 'submit' });
                            }}
                          >
                            Enviar
                          </Button>
                        )}
                        {bid.status === 'ENVIADA' && (
                          <Button
                            size="small"
                            color="error"
                            startIcon={<UndoOutlined />}
                            onClick={() => {
                              bidAction.reset();
                              setAction({ bid, kind: 'withdraw' });
                            }}
                          >
                            Retirar
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={bids.data.pagination.total}
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
      <NewBidDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(name) => {
          setCreating(false);
          notify(
            `Borrador «${name}» guardado. Adjunte los documentos obligatorios antes de enviarlo.`,
          );
          void queryClient.invalidateQueries({ queryKey: ['bids'] });
        }}
      />
      <ConfirmDialog
        open={Boolean(action)}
        title={action?.kind === 'submit' ? 'Enviar oferta' : 'Retirar oferta'}
        description={
          action?.kind === 'submit'
            ? 'Al enviarla, la oferta queda sellada con su huella de integridad y pasa a evaluación. Se verificará que estén cargados los documentos obligatorios de la subasta.'
            : 'La oferta dejará de participar en la subasta. Esta acción queda registrada en la auditoría.'
        }
        summary={
          action && (
            <Typography variant="body2">
              <strong>{action.bid.projectName}</strong> · {action.bid.auction.code} ·{' '}
              {formatNumber(action.bid.offeredPowerMw)} MW
            </Typography>
          )
        }
        confirmLabel={action?.kind === 'submit' ? 'Enviar oferta' : 'Retirar oferta'}
        destructive={action?.kind === 'withdraw'}
        reason={
          action?.kind === 'withdraw' ? { label: 'Motivo del retiro', minLength: 10 } : undefined
        }
        pending={bidAction.isPending}
        error={bidAction.error}
        onConfirm={(reason) =>
          action &&
          bidAction.mutate({
            ...action,
            reason: reason ?? 'Envío formal de la oferta para evaluación.',
          })
        }
        onClose={() => setAction(null)}
      />
    </Stack>
  );
}

function DocumentsPanel() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('documents.manage');
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [uploading, setUploading] = useState(false);
  const [versionOf, setVersionOf] = useState<DocumentItem | null>(null);

  const documents = useQuery({
    queryKey: ['documents', { entityType, page, pageSize }],
    queryFn: () =>
      apiClient
        .get<Paginated<DocumentItem>>('/documents', {
          params: { ...(entityType ? { entityType } : {}), page: page + 1, pageSize },
        })
        .then(({ data }) => data),
    placeholderData: keepPreviousData,
  });
  const download = useMutation({
    mutationFn: async (item: DocumentItem) => {
      const response = await apiClient.get<Blob>(`/documents/${item.id}/download`, {
        responseType: 'blob',
      });
      const latest = item.versions[0];
      const name = fileNameFromDisposition(
        response.headers['content-disposition'] as string | undefined,
        latest?.originalFileName ?? item.title,
      );
      const url = URL.createObjectURL(response.data);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      URL.revokeObjectURL(url);
      return name;
    },
    onSuccess: (name) => notify(`Descarga de «${name}» iniciada.`, 'info'),
    onError: (error) => notify(getApiErrorMessage(error), 'error'),
  });
  const uploaded = (message: string) => {
    setUploading(false);
    setVersionOf(null);
    notify(message);
    void queryClient.invalidateQueries({ queryKey: ['documents'] });
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="doc-entity-label">Asociado a</InputLabel>
          <Select
            labelId="doc-entity-label"
            label="Asociado a"
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            {Object.entries(entityTypeLabels).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<CloudUploadOutlined />}
            onClick={() => setUploading(true)}
          >
            Cargar documento
          </Button>
        )}
      </Stack>
      <Card>
        {documents.isLoading ? (
          <Box p={2}>
            <LoadingState rows={4} label="Cargando documentos" />
          </Box>
        ) : documents.isError ? (
          <Box p={2}>
            <ErrorState error={documents.error} onRetry={() => void documents.refetch()} />
          </Box>
        ) : !documents.data?.data.length ? (
          <Box p={2}>
            <EmptyState
              title={entityType ? 'No hay documentos de este tipo' : 'Aún no hay documentos'}
              description="Los expedientes cargados aparecerán aquí con su versión vigente y huella de integridad."
            />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small" aria-label="Documentos" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Documento</TableCell>
                  <TableCell>Asociado a</TableCell>
                  <TableCell>Versión vigente</TableCell>
                  <TableCell>Actualizado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {documents.data.data.map((item) => {
                  const latest = item.versions[0];
                  return (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {item.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.documentType}
                        </Typography>
                      </TableCell>
                      <TableCell>{entityTypeLabels[item.entityType] ?? item.entityType}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          v{item.currentVersionNumber}
                          {latest ? ` · ${formatBytes(latest.sizeBytes)}` : ''}
                        </Typography>
                        {latest && (
                          <Tooltip title={`SHA-256 ${latest.sha256}`}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ cursor: 'help' }}
                            >
                              SHA-256 {latest.sha256.slice(0, 12)}…
                            </Typography>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatDateTime(item.updatedAt)}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Button
                          size="small"
                          startIcon={<DownloadOutlined />}
                          onClick={() => download.mutate(item)}
                          disabled={download.isPending && download.variables.id === item.id}
                        >
                          Descargar
                        </Button>
                        {canManage && item.status === 'ACTIVE' && (
                          <Button
                            size="small"
                            startIcon={<NoteAddOutlined />}
                            onClick={() => setVersionOf(item)}
                          >
                            Nueva versión
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={documents.data.pagination.total}
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
      <UploadDocumentDialog
        open={uploading || Boolean(versionOf)}
        versionOf={versionOf}
        onClose={() => {
          setUploading(false);
          setVersionOf(null);
        }}
        onUploaded={(title) =>
          uploaded(
            versionOf ? `Nueva versión de «${title}» cargada.` : `Documento «${title}» cargado.`,
          )
        }
      />
    </Stack>
  );
}

export function OffersDocumentsPage() {
  const { hasPermission } = useAuth();
  const tabs = [
    { key: 'bids', label: 'Ofertas', visible: hasPermission('bids.read') },
    { key: 'documents', label: 'Documentos', visible: hasPermission('documents.read') },
  ].filter((tab) => tab.visible);
  const [tab, setTab] = useState(tabs[0]?.key ?? 'bids');

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Ofertas y documentos"
        description="Ofertas por subasta y expediente digital versionado, con integridad verificable y aislado por organización."
      />
      <Tabs
        value={tab}
        onChange={(_event, value: string) => setTab(value)}
        aria-label="Ofertas y documentos"
      >
        {tabs.map((item) => (
          <Tab
            key={item.key}
            value={item.key}
            label={item.label}
            id={`tab-${item.key}`}
            aria-controls={`panel-${item.key}`}
          />
        ))}
      </Tabs>
      <Box role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'bids' ? <BidsPanel /> : <DocumentsPanel />}
      </Box>
    </Stack>
  );
}
