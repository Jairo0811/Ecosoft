import { SearchOutlined, VisibilityOutlined } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
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
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';

interface AuditEvent {
  id: string;
  action: string;
  module: string;
  entity: string | null;
  entityId: string | null;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED';
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string;
  previousValues: string | null;
  newValues: string | null;
  eventHash: string | null;
  createdAt: string;
  user: { email: string; firstName: string; lastName: string } | null;
}

interface AuditResponse {
  data: AuditEvent[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const prettyJson = (value: string | null) => {
  if (!value) return 'Sin valores registrados';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
};

export function AuditPage() {
  const [q, setQ] = useState('');
  const [module, setModule] = useState('');
  const [result, setResult] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const params = useMemo(
    () => ({
      ...(q ? { q } : {}),
      ...(module ? { module } : {}),
      ...(result ? { result } : {}),
      page: page + 1,
      pageSize,
    }),
    [q, module, result, page, pageSize],
  );
  const events = useQuery({
    queryKey: ['audit', params],
    queryFn: () => apiClient.get<AuditResponse>('/audit', { params }).then(({ data }) => data),
  });

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }}>
          Auditoría y trazabilidad
        </Typography>
        <Typography color="text.secondary">
          Evidencia inmutable de accesos sensibles, decisiones y cambios realizados en EcoSoft.
        </Typography>
      </Box>
      <Card sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Buscar"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(0);
            }}
            placeholder="Acción, módulo, entidad o correlación"
            slotProps={{ input: { startAdornment: <SearchOutlined sx={{ mr: 1 }} /> } }}
            fullWidth
          />
          <TextField
            label="Módulo"
            value={module}
            onChange={(event) => {
              setModule(event.target.value.toUpperCase());
              setPage(0);
            }}
            sx={{ minWidth: 200 }}
          />
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>Resultado</InputLabel>
            <Select
              value={result}
              label="Resultado"
              onChange={(event) => {
                setResult(event.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="SUCCESS">Correcto</MenuItem>
              <MenuItem value="FAILURE">Fallido</MenuItem>
              <MenuItem value="DENIED">Denegado</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Card>
      {events.isError && <Alert severity="error">{getApiErrorMessage(events.error)}</Alert>}
      <Card>
        {events.isLoading ? (
          <Box minHeight={280} display="grid" sx={{ placeItems: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha UTC</TableCell>
                    <TableCell>Usuario</TableCell>
                    <TableCell>Módulo / acción</TableCell>
                    <TableCell>Entidad</TableCell>
                    <TableCell>Resultado</TableCell>
                    <TableCell align="right">Detalle</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.data?.data.map((event) => (
                    <TableRow key={event.id} hover>
                      <TableCell>{new Date(event.createdAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {event.user
                            ? `${event.user.firstName} ${event.user.lastName}`
                            : 'Sistema'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {event.user?.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {event.module}
                        </Typography>
                        <Typography variant="caption">{event.action}</Typography>
                      </TableCell>
                      <TableCell>
                        {event.entity ?? '—'}
                        <Typography display="block" variant="caption" color="text.secondary">
                          {event.entityId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={event.result}
                          color={
                            event.result === 'SUCCESS'
                              ? 'success'
                              : event.result === 'DENIED'
                                ? 'warning'
                                : 'error'
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={<VisibilityOutlined />}
                          onClick={() => setSelected(event)}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={events.data?.pagination.total ?? 0}
              page={page}
              rowsPerPage={pageSize}
              onPageChange={(_event, value) => setPage(value)}
              onRowsPerPageChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </Card>
      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="md">
        <DialogTitle>Detalle del evento de auditoría</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack spacing={2}>
              <Typography variant="body2">
                <strong>Correlation ID:</strong> {selected.correlationId}
              </Typography>
              <Typography variant="body2">
                <strong>IP:</strong> {selected.ipAddress ?? 'No disponible'} ·{' '}
                <strong>Hash:</strong> {selected.eventHash ?? 'Registro anterior a Fase 8'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selected.userAgent}
              </Typography>
              <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2}>
                <Box>
                  <Typography fontWeight={700} mb={1}>
                    Valores anteriores
                  </Typography>
                  <Box component="pre" sx={{ p: 2, bgcolor: 'action.hover', overflow: 'auto' }}>
                    {prettyJson(selected.previousValues)}
                  </Box>
                </Box>
                <Box>
                  <Typography fontWeight={700} mb={1}>
                    Valores posteriores
                  </Typography>
                  <Box component="pre" sx={{ p: 2, bgcolor: 'action.hover', overflow: 'auto' }}>
                    {prettyJson(selected.newValues)}
                  </Box>
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
