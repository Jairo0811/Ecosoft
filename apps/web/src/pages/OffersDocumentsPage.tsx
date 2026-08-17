import { CloudUploadOutlined, SendOutlined, UndoOutlined } from '@mui/icons-material';
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
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';

interface Bid {
  id: string;
  projectName: string;
  status: string;
  offeredPowerMw: string;
  offeredPrice: string | null;
  currencyCode: string | null;
  auction: { code: string; title: string };
  organization: { legalName: string };
}
interface DocumentItem {
  id: string;
  title: string;
  documentType: string;
  entityType: string;
  status: string;
  currentVersionNumber: number;
  createdAt: string;
}
interface ListResponse<T> {
  data: T[];
  pagination: { total: number };
}
const trustedHeaders = { 'X-Requested-With': 'EcoSoftWeb' };
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? (reader.result.split(',')[1] ?? '') : '');
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });

export function OffersDocumentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [bidOpen, setBidOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [bid, setBid] = useState({
    auctionId: '',
    projectName: '',
    renewableTechnologyCode: 'SOLAR',
    projectLocation: '',
    offeredPowerMw: '',
    estimatedEnergyMwh: '',
    offeredPrice: '',
    currencyCode: 'USD',
    validUntil: '',
  });
  const [document, setDocument] = useState({
    entityType: 'BID',
    entityId: '',
    documentType: 'TECHNICAL_PROPOSAL',
    title: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const canSubmit = user?.permissions.includes('bids.submit') ?? false;
  const canManageDocuments = user?.permissions.includes('documents.manage') ?? false;
  const bids = useQuery({
    queryKey: ['bids'],
    queryFn: () => apiClient.get<ListResponse<Bid>>('/bids').then(({ data }) => data),
  });
  const documents = useQuery({
    queryKey: ['documents'],
    queryFn: () => apiClient.get<ListResponse<DocumentItem>>('/documents').then(({ data }) => data),
  });
  const createBid = useMutation({
    mutationFn: () => apiClient.post('/bids', bid, { headers: trustedHeaders }),
    onSuccess: async () => {
      setBidOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['bids'] });
    },
  });
  const bidAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'submit' | 'withdraw' }) =>
      apiClient.post(
        `/bids/${id}/${action}`,
        {
          reason:
            action === 'submit'
              ? 'Envío formal de la oferta para evaluación.'
              : 'Retiro formal solicitado por el oferente.',
        },
        { headers: trustedHeaders },
      ),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['bids'] }),
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Seleccione un archivo.');
      return apiClient.post(
        '/documents',
        {
          ...document,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64: await fileToBase64(file),
          confidentiality: 'PRIVATE',
        },
        { headers: trustedHeaders },
      );
    },
    onSuccess: async () => {
      setDocumentOpen(false);
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
  const download = useMutation({
    mutationFn: async (item: DocumentItem) => {
      const response = await apiClient.get<Blob>(`/documents/${item.id}/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = item.title;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });
  const error =
    bids.error ||
    documents.error ||
    createBid.error ||
    bidAction.error ||
    upload.error ||
    download.error;
  const submitBid = (event: FormEvent) => {
    event.preventDefault();
    createBid.mutate();
  };
  const submitDocument = (event: FormEvent) => {
    event.preventDefault();
    upload.mutate();
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }}>
          Ofertas y documentos
        </Typography>
        <Typography color="text.secondary">
          Expediente digital versionado, trazable y aislado por organización.
        </Typography>
      </Box>
      {error && <Alert severity="error">{getApiErrorMessage(error)}</Alert>}
      <Card>
        <Tabs
          value={tab}
          onChange={(_, value: number) => setTab(value)}
          aria-label="Módulos de ofertas y documentos"
        >
          <Tab label={`Ofertas (${bids.data?.pagination.total ?? 0})`} />
          <Tab label={`Documentos (${documents.data?.pagination.total ?? 0})`} />
        </Tabs>
      </Card>
      {tab === 0 && (
        <Stack spacing={2}>
          {canSubmit && (
            <Box>
              <Button variant="contained" onClick={() => setBidOpen(true)}>
                Nueva oferta
              </Button>
            </Box>
          )}
          {bids.isLoading ? (
            <CircularProgress />
          ) : (
            bids.data?.data.map((item) => (
              <Card key={item.id} sx={{ p: 2.5 }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  gap={2}
                >
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontWeight={800}>{item.projectName}</Typography>
                      <Chip size="small" label={item.status} />
                    </Stack>
                    <Typography color="text.secondary">
                      {item.auction.code} · {item.organization.legalName}
                    </Typography>
                    <Typography>
                      {String(item.offeredPowerMw)} MW
                      {item.offeredPrice
                        ? ` · ${String(item.offeredPrice)} ${item.currencyCode}`
                        : ''}
                    </Typography>
                  </Box>
                  {canSubmit && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      {item.status === 'BORRADOR' && (
                        <Button
                          startIcon={<SendOutlined />}
                          onClick={() => bidAction.mutate({ id: item.id, action: 'submit' })}
                        >
                          Enviar
                        </Button>
                      )}
                      {item.status === 'ENVIADA' && (
                        <Button
                          color="warning"
                          startIcon={<UndoOutlined />}
                          onClick={() => bidAction.mutate({ id: item.id, action: 'withdraw' })}
                        >
                          Retirar
                        </Button>
                      )}
                    </Stack>
                  )}
                </Stack>
              </Card>
            ))
          )}
          {!bids.isLoading && !bids.data?.data.length && (
            <Card sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No hay ofertas disponibles.</Typography>
            </Card>
          )}
        </Stack>
      )}
      {tab === 1 && (
        <Stack spacing={2}>
          {canManageDocuments && (
            <Box>
              <Button
                variant="contained"
                startIcon={<CloudUploadOutlined />}
                onClick={() => setDocumentOpen(true)}
              >
                Cargar documento
              </Button>
            </Box>
          )}
          {documents.isLoading ? (
            <CircularProgress />
          ) : (
            documents.data?.data.map((item) => (
              <Card key={item.id} sx={{ p: 2.5 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Box>
                    <Typography fontWeight={800}>{item.title}</Typography>
                    <Typography color="text.secondary">
                      {item.documentType} · {item.entityType} · versión {item.currentVersionNumber}
                    </Typography>
                  </Box>
                  <Button onClick={() => download.mutate(item)} disabled={download.isPending}>
                    Descargar
                  </Button>
                </Stack>
              </Card>
            ))
          )}
        </Stack>
      )}
      <Dialog open={bidOpen} onClose={() => setBidOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={submitBid}>
          <DialogTitle>Nueva oferta</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              {Object.entries(bid).map(([key, value]) => (
                <TextField
                  key={key}
                  required={key !== 'projectLocation'}
                  label={
                    (
                      {
                        auctionId: 'ID de subasta',
                        projectName: 'Proyecto',
                        renewableTechnologyCode: 'Tecnología',
                        projectLocation: 'Ubicación',
                        offeredPowerMw: 'Potencia MW',
                        estimatedEnergyMwh: 'Energía MWh',
                        offeredPrice: 'Precio',
                        currencyCode: 'Moneda',
                        validUntil: 'Válida hasta (ISO)',
                      } as Record<string, string>
                    )[key]
                  }
                  value={value}
                  onChange={(event) =>
                    setBid((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBidOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={createBid.isPending}>
              Guardar borrador
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog open={documentOpen} onClose={() => setDocumentOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={submitDocument}>
          <DialogTitle>Cargar documento</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <TextField
                label="Tipo de entidad"
                value={document.entityType}
                onChange={(event) =>
                  setDocument((current) => ({ ...current, entityType: event.target.value }))
                }
              />
              <TextField
                required
                label="ID de la entidad"
                value={document.entityId}
                onChange={(event) =>
                  setDocument((current) => ({ ...current, entityId: event.target.value }))
                }
              />
              <TextField
                required
                label="Tipo documental"
                value={document.documentType}
                onChange={(event) =>
                  setDocument((current) => ({ ...current, documentType: event.target.value }))
                }
              />
              <TextField
                required
                label="Título"
                value={document.title}
                onChange={(event) =>
                  setDocument((current) => ({ ...current, title: event.target.value }))
                }
              />
              <Button component="label" variant="outlined">
                {file?.name ?? 'Seleccionar archivo'}
                <input
                  hidden
                  type="file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </Button>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDocumentOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={!file || upload.isPending}>
              Cargar
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}
