import { FactCheckOutlined, PsychologyOutlined, TextSnippetOutlined } from '@mui/icons-material';
import {
  Alert,
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

interface Analysis {
  id: string;
  operation: string;
  provider: string;
  confidence: string | null;
  reviewDecision: string | null;
  createdAt: string;
  result: Record<string, unknown>;
  document: { title: string; documentType: string } | null;
}
interface AnalysisResponse {
  data: Analysis[];
  pagination: { total: number };
}
const trustedHeaders = { 'X-Requested-With': 'EcoSoftWeb' };

export function AIPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [documentId, setDocumentId] = useState('');
  const [operation, setOperation] = useState<'SUMMARY' | 'ANOMALY_REVIEW'>('SUMMARY');
  const analyses = useQuery({
    queryKey: ['ai-analyses'],
    queryFn: () => apiClient.get<AnalysisResponse>('/ai').then(({ data }) => data),
  });
  const invalidate = async () => queryClient.invalidateQueries({ queryKey: ['ai-analyses'] });
  const ocr = useMutation({
    mutationFn: () => apiClient.post('/ai/ocr', { documentId }, { headers: trustedHeaders }),
    onSuccess: invalidate,
  });
  const analyze = useMutation({
    mutationFn: () =>
      apiClient.post('/ai/analyze', { documentId, operation }, { headers: trustedHeaders }),
    onSuccess: invalidate,
  });
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'ACCEPTED' | 'REJECTED' }) =>
      apiClient.patch(
        `/ai/${id}/review`,
        {
          decision,
          notes:
            decision === 'ACCEPTED'
              ? 'Resultado verificado y aceptado por revisión humana.'
              : 'Resultado descartado después de la revisión humana.',
        },
        { headers: trustedHeaders },
      ),
    onSuccess: invalidate,
  });
  const error = analyses.error || ocr.error || analyze.error || review.error;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }}>
          Asistencia de IA
        </Typography>
        <Typography color="text.secondary">
          Extracción y análisis con fuentes, confianza y revisión humana obligatoria.
        </Typography>
      </Box>
      <Alert severity="info">
        La IA es asistiva: sus resultados no adjudican, aprueban ni modifican contratos
        automáticamente.
      </Alert>
      {error && <Alert severity="error">{getApiErrorMessage(error)}</Alert>}
      <Card sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <TextField
            fullWidth
            label="ID del documento"
            value={documentId}
            onChange={(event) => setDocumentId(event.target.value)}
          />
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Operación</InputLabel>
            <Select
              label="Operación"
              value={operation}
              onChange={(event) => setOperation(event.target.value)}
            >
              <MenuItem value="SUMMARY">Resumen</MenuItem>
              <MenuItem value="ANOMALY_REVIEW">Señales de anomalía</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<TextSnippetOutlined />}
            disabled={!documentId || ocr.isPending}
            onClick={() => ocr.mutate()}
          >
            Extraer texto
          </Button>
          <Button
            variant="contained"
            startIcon={<PsychologyOutlined />}
            disabled={!documentId || analyze.isPending}
            onClick={() => analyze.mutate()}
          >
            Analizar
          </Button>
        </Stack>
      </Card>
      <Typography variant="h5">Historial ({analyses.data?.pagination.total ?? 0})</Typography>
      <Stack spacing={2}>
        {analyses.data?.data.map((item) => (
          <Card key={item.id} sx={{ p: 2.5 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FactCheckOutlined color="primary" />
                  <Typography fontWeight={800}>{item.document?.title ?? 'Documento'}</Typography>
                  <Chip size="small" label={item.operation} />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${Math.round(Number(item.confidence ?? 0) * 100)}% confianza`}
                  />
                  {item.reviewDecision && (
                    <Chip
                      size="small"
                      color={item.reviewDecision === 'ACCEPTED' ? 'success' : 'error'}
                      label={item.reviewDecision}
                    />
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {item.provider} · {new Date(item.createdAt).toLocaleString()}
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    font: 'inherit',
                    color: 'text.secondary',
                    maxWidth: 900,
                  }}
                >
                  {JSON.stringify(item.result, null, 2)}
                </Box>
              </Box>
              {!item.reviewDecision && user?.permissions.includes('ai.review') && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    color="success"
                    onClick={() => review.mutate({ id: item.id, decision: 'ACCEPTED' })}
                  >
                    Aceptar
                  </Button>
                  <Button
                    color="error"
                    onClick={() => review.mutate({ id: item.id, decision: 'REJECTED' })}
                  >
                    Rechazar
                  </Button>
                </Stack>
              )}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
