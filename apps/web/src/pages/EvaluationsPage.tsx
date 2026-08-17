import { CheckCircleOutlined, PublishOutlined } from '@mui/icons-material';
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
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';

interface Matrix {
  id: string;
  name: string;
  status: string;
  versionNumber: number;
  auction: { code: string; title: string };
  criteria: { id: string; type: string; title: string; weight: string; maximumScore: string }[];
}
interface Evaluation {
  id: string;
  type: string;
  totalScore: string;
  status: string;
  bid: { projectName: string; organization: { legalName: string }; auction: { code: string } };
  evaluator: { firstName: string; lastName: string };
}
interface Award {
  id: string;
  resolutionNumber: string;
  status: string;
  awardedPrice: string;
  awardedCapacityMw: string;
  bid: { projectName: string; organization: { legalName: string } };
  auction: { code: string };
}
const trustedHeaders = { 'X-Requested-With': 'EcoSoftWeb' };

export function EvaluationsPage() {
  const [tab, setTab] = useState(0);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [awardOpen, setAwardOpen] = useState(false);
  const [matrixForm, setMatrixForm] = useState({
    auctionId: '',
    name: '',
    technicalTitle: 'Calidad técnica de la propuesta',
    financialTitle: 'Competitividad económica de la oferta',
  });
  const [evaluationForm, setEvaluationForm] = useState<{
    matrixId: string;
    bidId: string;
    type: 'TECNICA' | 'FINANCIERA';
    comments: string;
  }>({ matrixId: '', bidId: '', type: 'TECNICA', comments: '' });
  const [scores, setScores] = useState<Record<string, string>>({});
  const [awardForm, setAwardForm] = useState({
    bidId: '',
    resolutionNumber: '',
    awardedPrice: '',
    awardedCapacityMw: '',
    justification: '',
  });
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const matrices = useQuery({
    queryKey: ['evaluation-matrices'],
    queryFn: () =>
      apiClient.get<{ data: Matrix[] }>('/evaluations/matrices').then(({ data }) => data.data),
  });
  const evaluations = useQuery({
    queryKey: ['evaluations'],
    queryFn: () =>
      apiClient.get<{ data: Evaluation[] }>('/evaluations').then(({ data }) => data.data),
  });
  const awards = useQuery({
    queryKey: ['awards'],
    queryFn: () =>
      apiClient.get<{ data: Award[] }>('/evaluations/awards/list').then(({ data }) => data.data),
    enabled: user?.permissions.includes('awards.read') ?? false,
  });
  const publish = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/evaluations/matrices/${id}/publish`, {}, { headers: trustedHeaders }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['evaluation-matrices'] }),
  });
  const approve = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(
        `/evaluations/awards/${id}/approve`,
        { reason: 'Aprobación formal conforme al expediente de evaluación.' },
        { headers: trustedHeaders },
      ),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['awards'] }),
  });
  const createMatrix = useMutation({
    mutationFn: () =>
      apiClient.post(
        '/evaluations/matrices',
        {
          auctionId: matrixForm.auctionId,
          name: matrixForm.name,
          criteria: [
            {
              code: 'TECHNICAL',
              title: matrixForm.technicalTitle,
              type: 'TECNICA',
              weight: 0.5,
              maximumScore: 100,
              sortOrder: 1,
            },
            {
              code: 'FINANCIAL',
              title: matrixForm.financialTitle,
              type: 'FINANCIERA',
              weight: 0.5,
              maximumScore: 100,
              sortOrder: 2,
            },
          ],
        },
        { headers: trustedHeaders },
      ),
    onSuccess: async () => {
      setMatrixOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['evaluation-matrices'] });
    },
  });
  const selectedMatrix = matrices.data?.find((item) => item.id === evaluationForm.matrixId);
  const selectedCriteria =
    selectedMatrix?.criteria.filter((item) => item.type === evaluationForm.type) ?? [];
  const submitEvaluation = useMutation({
    mutationFn: () =>
      apiClient.post(
        '/evaluations',
        {
          ...evaluationForm,
          scores: selectedCriteria.map((criterion) => ({
            criterionId: criterion.id,
            score: scores[criterion.id] ?? '',
          })),
        },
        { headers: trustedHeaders },
      ),
    onSuccess: async () => {
      setEvaluationOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['evaluations'] });
    },
  });
  const createAward = useMutation({
    mutationFn: () => apiClient.post('/evaluations/awards', awardForm, { headers: trustedHeaders }),
    onSuccess: async () => {
      setAwardOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['awards'] });
    },
  });
  const error =
    matrices.error ||
    evaluations.error ||
    awards.error ||
    publish.error ||
    approve.error ||
    createMatrix.error ||
    submitEvaluation.error ||
    createAward.error;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }}>
          Evaluación y adjudicación
        </Typography>
        <Typography color="text.secondary">
          Matrices ponderadas, evaluación separada y decisión formal trazable.
        </Typography>
      </Box>
      {error && <Alert severity="error">{getApiErrorMessage(error)}</Alert>}
      <Card>
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)}>
          <Tab label="Matrices" />
          <Tab label="Evaluaciones" />
          <Tab label="Adjudicaciones" />
        </Tabs>
      </Card>
      {(matrices.isLoading || evaluations.isLoading || awards.isLoading) && <CircularProgress />}
      {tab === 0 && (
        <Stack spacing={2}>
          {user?.permissions.includes('evaluations.manage') && (
            <Box>
              <Button variant="contained" onClick={() => setMatrixOpen(true)}>
                Nueva matriz
              </Button>
            </Box>
          )}
          {matrices.data?.map((item) => (
            <Card key={item.id} sx={{ p: 2.5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
                <Box>
                  <Stack direction="row" spacing={1}>
                    <Typography fontWeight={800}>{item.name}</Typography>
                    <Chip size="small" label={item.status} />
                  </Stack>
                  <Typography color="text.secondary">
                    {item.auction.code} · versión {item.versionNumber} · {item.criteria.length}{' '}
                    criterios
                  </Typography>
                </Box>
                {item.status === 'BORRADOR' && user?.permissions.includes('evaluations.manage') && (
                  <Button startIcon={<PublishOutlined />} onClick={() => publish.mutate(item.id)}>
                    Publicar
                  </Button>
                )}
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
      {tab === 1 && (
        <Stack spacing={2}>
          {user?.permissions.includes('evaluations.submit') && (
            <Box>
              <Button variant="contained" onClick={() => setEvaluationOpen(true)}>
                Registrar evaluación
              </Button>
            </Box>
          )}
          {evaluations.data?.map((item) => (
            <Card key={item.id} sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between">
                <Box>
                  <Typography fontWeight={800}>{item.bid.projectName}</Typography>
                  <Typography color="text.secondary">
                    {item.bid.auction.code} · {item.bid.organization.legalName} · {item.type}
                  </Typography>
                  <Typography variant="caption">
                    Evaluador: {item.evaluator.firstName} {item.evaluator.lastName}
                  </Typography>
                </Box>
                <Chip color="primary" label={`${Number(item.totalScore).toFixed(2)} puntos`} />
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
      {tab === 2 && (
        <Stack spacing={2}>
          {user?.permissions.includes('awards.manage') && (
            <Box>
              <Button variant="contained" onClick={() => setAwardOpen(true)}>
                Nueva adjudicación
              </Button>
            </Box>
          )}
          {awards.data?.map((item) => (
            <Card key={item.id} sx={{ p: 2.5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
                <Box>
                  <Stack direction="row" spacing={1}>
                    <Typography fontWeight={800}>{item.resolutionNumber}</Typography>
                    <Chip size="small" label={item.status} />
                  </Stack>
                  <Typography color="text.secondary">
                    {item.auction.code} · {item.bid.projectName} · {item.bid.organization.legalName}
                  </Typography>
                  <Typography>
                    {String(item.awardedCapacityMw)} MW · {String(item.awardedPrice)}
                  </Typography>
                </Box>
                {item.status === 'BORRADOR' && user?.permissions.includes('awards.approve') && (
                  <Button
                    startIcon={<CheckCircleOutlined />}
                    onClick={() => approve.mutate(item.id)}
                  >
                    Aprobar
                  </Button>
                )}
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
      <Dialog open={matrixOpen} onClose={() => setMatrixOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nueva matriz de evaluación</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              required
              label="ID de subasta cerrada"
              value={matrixForm.auctionId}
              onChange={(event) =>
                setMatrixForm((current) => ({ ...current, auctionId: event.target.value }))
              }
            />
            <TextField
              required
              label="Nombre de matriz"
              value={matrixForm.name}
              onChange={(event) =>
                setMatrixForm((current) => ({ ...current, name: event.target.value }))
              }
            />
            <TextField
              required
              label="Criterio técnico (50%)"
              value={matrixForm.technicalTitle}
              onChange={(event) =>
                setMatrixForm((current) => ({ ...current, technicalTitle: event.target.value }))
              }
            />
            <TextField
              required
              label="Criterio financiero (50%)"
              value={matrixForm.financialTitle}
              onChange={(event) =>
                setMatrixForm((current) => ({ ...current, financialTitle: event.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMatrixOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={createMatrix.isPending}
            onClick={() => createMatrix.mutate()}
          >
            Crear matriz
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={evaluationOpen}
        onClose={() => setEvaluationOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Registrar evaluación</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <FormControl>
              <InputLabel>Matriz publicada</InputLabel>
              <Select
                label="Matriz publicada"
                value={evaluationForm.matrixId}
                onChange={(event) => {
                  setEvaluationForm((current) => ({ ...current, matrixId: event.target.value }));
                  setScores({});
                }}
              >
                {matrices.data
                  ?.filter((item) => item.status === 'PUBLICADA')
                  .map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.auction.code} · {item.name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <TextField
              required
              label="ID de oferta"
              value={evaluationForm.bidId}
              onChange={(event) =>
                setEvaluationForm((current) => ({ ...current, bidId: event.target.value }))
              }
            />
            <FormControl>
              <InputLabel>Tipo</InputLabel>
              <Select
                label="Tipo"
                value={evaluationForm.type}
                onChange={(event) => {
                  setEvaluationForm((current) => ({ ...current, type: event.target.value }));
                  setScores({});
                }}
              >
                <MenuItem value="TECNICA">Técnica</MenuItem>
                <MenuItem value="FINANCIERA">Financiera</MenuItem>
              </Select>
            </FormControl>
            {selectedCriteria.map((criterion) => (
              <TextField
                key={criterion.id}
                required
                type="number"
                label={`${criterion.title} (máx. ${String(criterion.maximumScore)})`}
                value={scores[criterion.id] ?? ''}
                onChange={(event) =>
                  setScores((current) => ({ ...current, [criterion.id]: event.target.value }))
                }
              />
            ))}
            <TextField
              label="Comentarios"
              multiline
              value={evaluationForm.comments}
              onChange={(event) =>
                setEvaluationForm((current) => ({ ...current, comments: event.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEvaluationOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!selectedCriteria.length || submitEvaluation.isPending}
            onClick={() => submitEvaluation.mutate()}
          >
            Enviar evaluación
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={awardOpen} onClose={() => setAwardOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nueva adjudicación</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {Object.entries(awardForm).map(([key, value]) => (
              <TextField
                key={key}
                required
                label={
                  (
                    {
                      bidId: 'ID de oferta evaluada',
                      resolutionNumber: 'Número de resolución',
                      awardedPrice: 'Precio adjudicado',
                      awardedCapacityMw: 'Capacidad adjudicada MW',
                      justification: 'Justificación',
                    } as Record<string, string>
                  )[key]
                }
                multiline={key === 'justification'}
                value={value}
                onChange={(event) =>
                  setAwardForm((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAwardOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={createAward.isPending}
            onClick={() => createAward.mutate()}
          >
            Crear adjudicación
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
