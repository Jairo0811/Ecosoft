import { DownloadOutlined, FilterAltOutlined } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
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
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';

type ReportType =
  'auctions' | 'participants' | 'bids' | 'awards' | 'contracts' | 'projects' | 'capacity' | 'audit';
type ExportFormat = 'csv' | 'xls' | 'pdf';
type ReportCell = string | number | boolean | null;

interface ReportResponse {
  data: Record<string, ReportCell>[];
  columns: string[];
  title: string;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

interface Option {
  id: string;
  code?: string;
  name?: string;
  legalName?: string;
  commercialName?: string | null;
}

const labels: Record<ReportType, string> = {
  auctions: 'Subastas',
  participants: 'Participantes',
  bids: 'Ofertas',
  awards: 'Adjudicaciones',
  contracts: 'Contratos PPA',
  projects: 'Proyectos energéticos',
  capacity: 'Capacidad energética',
  audit: 'Auditoría',
};

const formats: { value: ExportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'xls', label: 'Excel' },
  { value: 'pdf', label: 'PDF' },
];

export function ReportsPage() {
  const { user } = useAuth();
  const [type, setType] = useState<ReportType>('auctions');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [technology, setTechnology] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const canExport = user?.permissions.includes('reports.export') ?? false;
  const canAudit = user?.permissions.includes('audit.read') ?? false;
  const reportOptions = useMemo(
    () =>
      (Object.keys(labels) as ReportType[]).filter(
        (reportType) => reportType !== 'audit' || canAudit,
      ),
    [canAudit],
  );
  const params = {
    ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
    ...(to ? { to: new Date(`${to}T23:59:59`).toISOString() } : {}),
    ...(organizationId ? { organizationId } : {}),
    ...(technology ? { technology } : {}),
    ...(status ? { status } : {}),
    page: page + 1,
    pageSize,
  };
  const report = useQuery({
    queryKey: ['reports', type, params],
    queryFn: () =>
      apiClient
        .get<ReportResponse>(`/reports/${type}`, { params })
        .then((response) => response.data),
  });
  const technologies = useQuery({
    queryKey: ['catalogs', 'report-technologies'],
    queryFn: () =>
      apiClient
        .get<{ data: Option[] }>('/catalogs', {
          params: { type: 'ENERGY_TECHNOLOGY', active: true },
        })
        .then((response) => response.data.data),
  });
  const organizations = useQuery({
    queryKey: ['organizations', 'report-options'],
    queryFn: () =>
      apiClient
        .get<{ data: Option[] }>('/organizations', { params: { pageSize: 100 } })
        .then((response) => response.data.data),
    enabled:
      user?.roles.some((role) =>
        ['SUPER_ADMIN', 'CNE_ADMIN', 'AUDITOR', 'REGULATORY_SUPERVISOR'].includes(role),
      ) ?? false,
  });
  const exportReport = useMutation({
    mutationFn: async (format: ExportFormat) => {
      const response = await apiClient.get<Blob>(`/reports/${type}/export`, {
        params: { ...params, format },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ecosoft-${type}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
  });
  const error = report.error || exportReport.error;
  const resetPage = () => setPage(0);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }}>
          Reportes y analítica
        </Typography>
        <Typography color="text.secondary">
          Información trazable, filtrada por permisos y preparada para exportación institucional.
        </Typography>
      </Box>
      {error && <Alert severity="error">{getApiErrorMessage(error)}</Alert>}
      <Card sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
          <FilterAltOutlined color="primary" />
          <Typography variant="h6">Filtros</Typography>
        </Stack>
        <Box
          display="grid"
          gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }}
          gap={2}
        >
          <FormControl fullWidth>
            <InputLabel>Reporte</InputLabel>
            <Select
              value={type}
              label="Reporte"
              onChange={(event) => {
                setType(event.target.value);
                setStatus('');
                resetPage();
              }}
            >
              {reportOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {labels[option]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Tecnología</InputLabel>
            <Select
              value={technology}
              label="Tecnología"
              onChange={(event) => {
                setTechnology(event.target.value);
                resetPage();
              }}
            >
              <MenuItem value="">Todas</MenuItem>
              {technologies.data?.map((item) => (
                <MenuItem key={item.id} value={item.code}>
                  {item.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Estado"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value.toUpperCase());
              resetPage();
            }}
            placeholder="Ej.: VIGENTE"
          />
          {organizations.isSuccess && (
            <FormControl fullWidth>
              <InputLabel>Organización</InputLabel>
              <Select
                value={organizationId}
                label="Organización"
                onChange={(event) => {
                  setOrganizationId(event.target.value);
                  resetPage();
                }}
              >
                <MenuItem value="">Todas</MenuItem>
                {organizations.data.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.commercialName ?? item.legalName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField
            label="Fecha inicial"
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              resetPage();
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Fecha final"
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              resetPage();
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
      </Card>
      <Card>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          gap={2}
          p={2.5}
        >
          <Box>
            <Typography variant="h6">{report.data?.title ?? labels[type]}</Typography>
            <Typography variant="body2" color="text.secondary">
              {report.data?.pagination.total ?? 0} registros encontrados
            </Typography>
          </Box>
          {canExport && (
            <Stack direction="row" spacing={1}>
              {formats.map((format) => (
                <Button
                  key={format.value}
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadOutlined />}
                  disabled={exportReport.isPending}
                  onClick={() => exportReport.mutate(format.value)}
                >
                  {format.label}
                </Button>
              ))}
            </Stack>
          )}
        </Stack>
        <TableContainer>
          <Table size="small" aria-label={report.data?.title ?? labels[type]}>
            <TableHead>
              <TableRow>
                {report.data?.columns.map((column) => (
                  <TableCell key={column} sx={{ whiteSpace: 'nowrap' }}>
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {report.data?.data.map((row, index) => (
                <TableRow key={`${type}-${index}`} hover>
                  {report.data?.columns.map((column) => (
                    <TableCell key={column} sx={{ whiteSpace: 'nowrap' }}>
                      {String(row[column] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {report.isSuccess && report.data.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={Math.max(1, report.data.columns.length)} align="center">
                    <Typography color="text.secondary" py={4}>
                      No hay información para los filtros seleccionados.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={report.data?.pagination.total ?? 0}
          page={page}
          rowsPerPage={pageSize}
          onPageChange={(_event, value) => setPage(value)}
          onRowsPerPageChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="Filas por página"
        />
      </Card>
    </Stack>
  );
}
