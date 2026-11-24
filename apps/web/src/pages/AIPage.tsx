import {
  FactCheckOutlined,
  PsychologyOutlined,
  TextSnippetOutlined,
  VerifiedUserOutlined,
} from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useNotify } from '../components/Feedback';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/PageState';
import { formatDateTime } from '../utils/format';
import type { DocumentItem, Paginated } from './offers/model';

type Operation = 'SUMMARY' | 'ANOMALY_REVIEW';
type Decision = 'ACCEPTED' | 'REJECTED';

interface Analysis {
  id: string;
  operation: string;
  provider: string;
  confidence: string | null;
  reviewDecision: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  result: Record<string, unknown>;
  document: { title: string; documentType: string } | null;
  requestedBy: { firstName: string; lastName: string } | null;
  reviewedBy: { firstName: string; lastName: string } | null;
}

/** GET /ai/capabilities: what the configured provider really does. */
interface Capabilities {
  provider: string;
  processing: string;
  generativeAi: boolean;
  ocr: boolean;
  operations: Record<string, string>;
  textExtractionMimeTypes: string[];
  unsupported: string[];
  humanReviewRequired: boolean;
}

const trustedHeaders = { 'X-Requested-With': 'EcoSoftWeb' };

const operationLabels: Record<string, string> = {
  OCR: 'Extracción de texto',
  SUMMARY: 'Resumen extractivo',
  ANOMALY_REVIEW: 'Señales heurísticas',
};

const mimeLabels: Record<string, string> = {
  'text/plain': 'Texto plano (.txt)',
  'text/csv': 'CSV',
  'text/markdown': 'Markdown',
  'application/json': 'JSON',
};

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** Human-readable rendering of the three result shapes produced by the provider. */
function AnalysisResult({
  operation,
  result,
}: {
  operation: string;
  result: Record<string, unknown>;
}) {
  const notice = typeof result.notice === 'string' ? result.notice : null;
  if (operation === 'OCR') {
    const text = typeof result.text === 'string' ? result.text : '';
    return (
      <>
        <Box
          component="pre"
          sx={{
            whiteSpace: 'pre-wrap',
            font: 'inherit',
            m: 0,
            maxHeight: 220,
            overflow: 'auto',
            p: 1.5,
            borderRadius: 1,
            bgcolor: 'action.hover',
          }}
        >
          {text.length > 1500 ? `${text.slice(0, 1500)}…` : text || 'Sin texto.'}
        </Box>
        {notice && <Typography variant="caption">{notice}</Typography>}
      </>
    );
  }
  if (operation === 'SUMMARY') {
    return (
      <>
        <Typography>{typeof result.summary === 'string' ? result.summary : '—'}</Typography>
        {notice && <Typography variant="caption">{notice}</Typography>}
      </>
    );
  }
  const signals = asStrings(result.signals);
  const total = typeof result.total_signals === 'number' ? result.total_signals : signals.length;
  return (
    <>
      {signals.length === 0 ? (
        <Typography>No se detectaron señales con las reglas actuales.</Typography>
      ) : (
        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
          {signals.slice(0, 10).map((signal, index) => (
            <li key={`${index}-${signal}`}>
              <Typography variant="body2">{signal}</Typography>
            </li>
          ))}
        </Box>
      )}
      {total > Math.min(10, signals.length) && (
        <Typography variant="caption" display="block">
          Se muestran {Math.min(10, signals.length)} de {total} señales
          {result.truncated === true ? ' (el proveedor limitó el resultado a 100).' : '.'}
        </Typography>
      )}
      {notice && <Typography variant="caption">{notice}</Typography>}
    </>
  );
}

export function AIPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [operation, setOperation] = useState<Operation>('SUMMARY');
  const [reviewing, setReviewing] = useState<{ analysis: Analysis; decision: Decision } | null>(
    null,
  );
  const canReview = user?.permissions.includes('ai.review') ?? false;

  const capabilities = useQuery({
    queryKey: ['ai', 'capabilities'],
    queryFn: () =>
      apiClient.get<{ data: Capabilities }>('/ai/capabilities').then(({ data }) => data.data),
    staleTime: 5 * 60_000,
  });
  const documents = useQuery({
    queryKey: ['documents', 'ai-options'],
    queryFn: () =>
      apiClient
        .get<Paginated<DocumentItem>>('/documents', { params: { pageSize: 100 } })
        .then(({ data }) => data.data),
  });
  const analyses = useQuery({
    queryKey: ['ai-analyses'],
    queryFn: () =>
      apiClient
        .get<{ data: Analysis[]; pagination: { total: number } }>('/ai')
        .then(({ data }) => data),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ai-analyses'] });

  const extract = useMutation({
    mutationFn: (item: DocumentItem) =>
      apiClient.post('/ai/ocr', { documentId: item.id }, { headers: trustedHeaders }),
    onSuccess: async (_, item) => {
      notify(`Texto de «${item.title}» extraído. Ya puede analizarlo.`);
      await invalidate();
    },
  });
  const analyze = useMutation({
    mutationFn: (item: DocumentItem) =>
      apiClient.post(
        '/ai/analyze',
        { documentId: item.id, operation },
        { headers: trustedHeaders },
      ),
    onSuccess: async (_, item) => {
      notify(
        `${operationLabels[operation]} de «${item.title}» generado. Requiere revisión humana.`,
      );
      await invalidate();
    },
  });
  const review = useMutation({
    mutationFn: ({ id, decision, notes }: { id: string; decision: Decision; notes: string }) =>
      apiClient.patch(`/ai/${id}/review`, { decision, notes }, { headers: trustedHeaders }),
    onSuccess: async (_, { decision }) => {
      setReviewing(null);
      notify(decision === 'ACCEPTED' ? 'Resultado aceptado.' : 'Resultado rechazado.');
      await invalidate();
    },
  });

  const latest = document?.versions[0];
  const extractable =
    Boolean(latest) &&
    (capabilities.data?.textExtractionMimeTypes ?? []).includes(latest!.mimeType);
  const busy = extract.isPending || analyze.isPending;
  const actionError = extract.error || analyze.error;
  const caps = capabilities.data;

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Asistencia documental"
        description="Extracción de texto, resúmenes y señales sobre documentos de su ámbito, con trazabilidad y revisión humana obligatoria."
      />

      <Card sx={{ p: 2.5 }} component="section" aria-labelledby="ai-provider-title">
        <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
          <VerifiedUserOutlined color="primary" />
          <Typography variant="h6" component="h2" id="ai-provider-title">
            Qué hace el proveedor configurado
          </Typography>
        </Stack>
        {capabilities.isLoading ? (
          <LoadingState rows={2} label="Consultando capacidades del proveedor" />
        ) : capabilities.isError ? (
          <Alert severity="warning">
            No fue posible consultar el servicio de asistencia (
            {getApiErrorMessage(capabilities.error)}
            ). El historial sigue disponible; las nuevas operaciones fallarán hasta que el servicio
            responda.
          </Alert>
        ) : caps ? (
          <Stack spacing={1.5}>
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Chip label={`Proveedor: ${caps.provider}`} />
              <Chip
                color={caps.processing === 'deterministic' ? 'info' : 'default'}
                label={
                  caps.processing === 'deterministic'
                    ? 'Procesamiento determinista'
                    : `Procesamiento: ${caps.processing}`
                }
              />
              <Chip
                variant="outlined"
                label={caps.generativeAi ? 'IA generativa' : 'Sin IA generativa'}
              />
              <Chip variant="outlined" label={caps.ocr ? 'OCR disponible' : 'Sin OCR'} />
              {caps.humanReviewRequired && (
                <Chip variant="outlined" color="warning" label="Revisión humana obligatoria" />
              )}
            </Stack>
            <Typography variant="body2">
              <strong>Formatos para extraer texto:</strong>{' '}
              {caps.textExtractionMimeTypes.length > 0
                ? caps.textExtractionMimeTypes.map((mime) => mimeLabels[mime] ?? mime).join(', ')
                : 'ninguno'}
              .{' '}
              {!caps.ocr &&
                'Los PDF, imágenes y documentos escaneados no se procesan: no hay OCR configurado.'}
            </Typography>
            {caps.unsupported.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                No soportado: {caps.unsupported.join(' · ')}.
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              Los resultados son asistivos: no adjudican subastas, no aprueban contratos ni
              modifican información oficial.
            </Typography>
          </Stack>
        ) : null}
      </Card>

      <Card sx={{ p: 2.5 }} component="section" aria-labelledby="ai-run-title">
        <Typography variant="h6" component="h2" id="ai-run-title" mb={2}>
          Procesar un documento
        </Typography>
        <Stack spacing={2}>
          <Autocomplete
            options={documents.data ?? []}
            loading={documents.isLoading}
            value={document}
            onChange={(_event, value) => {
              setDocument(value);
              extract.reset();
              analyze.reset();
            }}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            getOptionLabel={(option) => option.title}
            noOptionsText={
              documents.isError
                ? 'No fue posible cargar los documentos.'
                : 'No hay documentos disponibles en su ámbito.'
            }
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {option.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    v{option.currentVersionNumber} · {option.versions[0]?.originalFileName ?? '—'}
                  </Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Documento"
                helperText={
                  latest
                    ? `Versión ${latest.versionNumber} · ${latest.originalFileName} · ${
                        extractable
                          ? 'admite extracción de texto'
                          : 'formato sin extracción con el proveedor actual'
                      }`
                    : 'Busque por título. Solo aparecen documentos de su organización o ámbito.'
                }
              />
            )}
          />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<TextSnippetOutlined />}
              disabled={!document || !extractable || busy}
              onClick={() => document && extract.mutate(document)}
            >
              {extract.isPending ? 'Extrayendo…' : '1. Extraer texto'}
            </Button>
            <FormControl sx={{ minWidth: 220 }}>
              <InputLabel id="ai-operation-label">Análisis</InputLabel>
              <Select
                labelId="ai-operation-label"
                label="Análisis"
                value={operation}
                onChange={(event) => setOperation(event.target.value)}
              >
                <MenuItem value="SUMMARY">Resumen extractivo</MenuItem>
                <MenuItem value="ANOMALY_REVIEW">Señales heurísticas</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<PsychologyOutlined />}
              disabled={!document || busy}
              onClick={() => document && analyze.mutate(document)}
            >
              {analyze.isPending ? 'Analizando…' : '2. Analizar'}
            </Button>
          </Stack>
          {caps?.operations[operation] && (
            <Typography variant="body2" color="text.secondary">
              {caps.operations[operation]} El análisis usa el texto extraído previamente.
            </Typography>
          )}
          {actionError && (
            <Alert severity="error" role="alert">
              {getApiErrorMessage(actionError)}
            </Alert>
          )}
        </Stack>
      </Card>

      <Box component="section" aria-labelledby="ai-history-title">
        <Typography variant="h6" component="h2" id="ai-history-title" mb={1.5}>
          Historial{analyses.data ? ` (${analyses.data.pagination.total})` : ''}
        </Typography>
        {analyses.isLoading ? (
          <LoadingState rows={3} label="Cargando historial de análisis" />
        ) : analyses.isError ? (
          <ErrorState error={analyses.error} onRetry={() => void analyses.refetch()} />
        ) : analyses.data?.data.length === 0 ? (
          <EmptyState
            title="Sin análisis todavía"
            description="Seleccione un documento de texto, extraiga su contenido y genere un resumen o una revisión de señales."
          />
        ) : (
          <Stack spacing={2}>
            {analyses.data?.data.map((item) => (
              <Card key={item.id} sx={{ p: 2.5 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  gap={2}
                >
                  <Stack spacing={1} minWidth={0} flex={1}>
                    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                      <FactCheckOutlined color="primary" />
                      <Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                        {item.document?.title ?? 'Documento'}
                      </Typography>
                      <Chip
                        size="small"
                        label={operationLabels[item.operation] ?? item.operation}
                      />
                      {item.confidence !== null && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Confianza heurística ${Math.round(Number(item.confidence) * 100)} %`}
                        />
                      )}
                      <Chip
                        size="small"
                        color={
                          item.reviewDecision === 'ACCEPTED'
                            ? 'success'
                            : item.reviewDecision === 'REJECTED'
                              ? 'error'
                              : 'warning'
                        }
                        label={
                          item.reviewDecision === 'ACCEPTED'
                            ? 'Aceptado'
                            : item.reviewDecision === 'REJECTED'
                              ? 'Rechazado'
                              : 'Pendiente de revisión'
                        }
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {item.provider} · {formatDateTime(item.createdAt)}
                      {item.requestedBy &&
                        ` · ${item.requestedBy.firstName} ${item.requestedBy.lastName}`}
                    </Typography>
                    <AnalysisResult operation={item.operation} result={item.result} />
                    {item.reviewNotes && (
                      <Typography variant="body2" color="text.secondary">
                        Revisión
                        {item.reviewedBy &&
                          ` de ${item.reviewedBy.firstName} ${item.reviewedBy.lastName}`}
                        {item.reviewedAt && ` (${formatDateTime(item.reviewedAt)})`}:{' '}
                        {item.reviewNotes}
                      </Typography>
                    )}
                  </Stack>
                  {!item.reviewDecision && canReview && (
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Button
                        color="success"
                        onClick={() => {
                          review.reset();
                          setReviewing({ analysis: item, decision: 'ACCEPTED' });
                        }}
                      >
                        Aceptar
                      </Button>
                      <Button
                        color="error"
                        onClick={() => {
                          review.reset();
                          setReviewing({ analysis: item, decision: 'REJECTED' });
                        }}
                      >
                        Rechazar
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </Box>

      <ConfirmDialog
        open={reviewing !== null}
        title={reviewing?.decision === 'ACCEPTED' ? 'Aceptar resultado' : 'Rechazar resultado'}
        description="La revisión es definitiva: cada resultado se acepta o rechaza una sola vez y queda en la auditoría."
        summary={
          reviewing && (
            <>
              <strong>{reviewing.analysis.document?.title ?? 'Documento'}</strong> ·{' '}
              {operationLabels[reviewing.analysis.operation] ?? reviewing.analysis.operation}
            </>
          )
        }
        confirmLabel={
          reviewing?.decision === 'ACCEPTED' ? 'Aceptar resultado' : 'Rechazar resultado'
        }
        destructive={reviewing?.decision === 'REJECTED'}
        reason={{
          label: 'Notas de la revisión',
          minLength: 5,
          maxLength: 1000,
          helper: 'Qué verificó y contra qué fuente. Mínimo 5 caracteres.',
        }}
        pending={review.isPending}
        error={review.error}
        onConfirm={(notes) =>
          reviewing &&
          review.mutate({
            id: reviewing.analysis.id,
            decision: reviewing.decision,
            notes: notes ?? '',
          })
        }
        onClose={() => setReviewing(null)}
      />
    </Stack>
  );
}
