import { AddOutlined, AutorenewOutlined } from '@mui/icons-material';
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

interface Project {
  id: string;
  name: string;
  status: string;
  renewableTechnologyCode: string;
  province: string;
  municipality: string;
  installedCapacityMw: string;
  contractedCapacityMw: string;
  organization: { legalName: string };
}
interface Contract {
  id: string;
  contractNumber: string;
  status: string;
  capacityMw: string;
  price: string;
  currencyCode: string;
  startDate: string;
  endDate: string;
  project: { name: string };
  organization: { legalName: string };
}
interface ListResponse<T> {
  data: T[];
  pagination: { total: number };
}
const trustedHeaders = { 'X-Requested-With': 'EcoSoftWeb' };
const nextProjectStatus: Record<string, string | undefined> = {
  PROPUESTO: 'EN_DESARROLLO',
  EN_DESARROLLO: 'EN_CONSTRUCCION',
  EN_CONSTRUCCION: 'OPERATIVO',
  OPERATIVO: 'SUSPENDIDO',
  SUSPENDIDO: 'OPERATIVO',
};
const nextContractStatus: Record<string, string | undefined> = {
  BORRADOR: 'PENDIENTE_FIRMA',
  PENDIENTE_FIRMA: 'VIGENTE',
  VIGENTE: 'SUSPENDIDO',
  SUSPENDIDO: 'VIGENTE',
};

export function ContractsProjectsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [project, setProject] = useState({
    name: '',
    renewableTechnologyCode: 'SOLAR',
    province: '',
    municipality: '',
    installedCapacityMw: '',
    estimatedOperationDate: '',
  });
  const [contract, setContract] = useState({
    contractNumber: '',
    awardId: '',
    projectId: '',
    startDate: '',
    endDate: '',
    price: '',
    currencyCode: 'USD',
    capacityMw: '',
    committedEnergyMwh: '',
    conditions: '',
  });
  const projects = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.get<ListResponse<Project>>('/projects').then(({ data }) => data),
  });
  const contracts = useQuery({
    queryKey: ['contracts'],
    queryFn: () => apiClient.get<ListResponse<Contract>>('/contracts').then(({ data }) => data),
  });
  const create = useMutation({
    mutationFn: () => apiClient.post('/projects', project, { headers: trustedHeaders }),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(
        `/projects/${id}/status`,
        { status, reason: 'Actualización del ciclo de vida conforme al seguimiento del proyecto.' },
        { headers: trustedHeaders },
      ),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
  const createContract = useMutation({
    mutationFn: () => apiClient.post('/contracts', contract, { headers: trustedHeaders }),
    onSuccess: async () => {
      setContractOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
  const transitionContract = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(
        `/contracts/${id}/status`,
        {
          status,
          reason: 'Transición contractual autorizada conforme al expediente vigente.',
          ...(status === 'VIGENTE' ? { signatureDate: new Date().toISOString() } : {}),
        },
        { headers: trustedHeaders },
      ),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
  });
  const error =
    projects.error ||
    contracts.error ||
    create.error ||
    transition.error ||
    createContract.error ||
    transitionContract.error;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };
  const submitContract = (event: FormEvent) => {
    event.preventDefault();
    createContract.mutate();
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }}>
          Proyectos y contratos PPA
        </Typography>
        <Typography color="text.secondary">
          Seguimiento desde la adjudicación hasta la operación y vigencia contractual.
        </Typography>
      </Box>
      {error && <Alert severity="error">{getApiErrorMessage(error)}</Alert>}
      <Card>
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)}>
          <Tab label={`Proyectos (${projects.data?.pagination.total ?? 0})`} />
          <Tab label={`Contratos (${contracts.data?.pagination.total ?? 0})`} />
        </Tabs>
      </Card>
      {tab === 0 && (
        <Stack spacing={2}>
          {user?.permissions.includes('projects.manage') && (
            <Box>
              <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setOpen(true)}>
                Nuevo proyecto
              </Button>
            </Box>
          )}
          {projects.data?.data.map((item) => (
            <Card key={item.id} sx={{ p: 2.5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
                <Box>
                  <Stack direction="row" spacing={1}>
                    <Typography fontWeight={800}>{item.name}</Typography>
                    <Chip size="small" label={item.status} />
                  </Stack>
                  <Typography color="text.secondary">
                    {item.organization.legalName} · {item.renewableTechnologyCode} · {item.province}
                    , {item.municipality}
                  </Typography>
                  <Typography>
                    {String(item.contractedCapacityMw)} / {String(item.installedCapacityMw)} MW
                    contratados
                  </Typography>
                </Box>
                {user?.permissions.includes('projects.manage') &&
                  nextProjectStatus[item.status] && (
                    <Button
                      startIcon={<AutorenewOutlined />}
                      onClick={() =>
                        transition.mutate({ id: item.id, status: nextProjectStatus[item.status]! })
                      }
                    >
                      Pasar a {nextProjectStatus[item.status]}
                    </Button>
                  )}
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
      {tab === 1 && (
        <Stack spacing={2}>
          {user?.permissions.includes('contracts.create') && (
            <Box>
              <Button
                variant="contained"
                startIcon={<AddOutlined />}
                onClick={() => setContractOpen(true)}
              >
                Nuevo contrato PPA
              </Button>
            </Box>
          )}
          {contracts.data?.data.map((item) => (
            <Card key={item.id} sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between">
                <Box>
                  <Stack direction="row" spacing={1}>
                    <Typography fontWeight={800}>{item.contractNumber}</Typography>
                    <Chip
                      size="small"
                      color={item.status === 'VIGENTE' ? 'success' : 'default'}
                      label={item.status}
                    />
                  </Stack>
                  <Typography color="text.secondary">
                    {item.project.name} · {item.organization.legalName}
                  </Typography>
                  <Typography>
                    {String(item.capacityMw)} MW · {String(item.price)} {item.currencyCode}
                  </Typography>
                </Box>
                <Stack alignItems="flex-end" spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(item.startDate).toLocaleDateString()} –{' '}
                    {new Date(item.endDate).toLocaleDateString()}
                  </Typography>
                  {nextContractStatus[item.status] &&
                    user?.permissions.includes(
                      nextContractStatus[item.status] === 'VIGENTE'
                        ? 'contracts.approve'
                        : 'contracts.create',
                    ) && (
                      <Button
                        size="small"
                        onClick={() =>
                          transitionContract.mutate({
                            id: item.id,
                            status: nextContractStatus[item.status]!,
                          })
                        }
                      >
                        Pasar a {nextContractStatus[item.status]}
                      </Button>
                    )}
                </Stack>
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={submit}>
          <DialogTitle>Nuevo proyecto energético</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              {Object.entries(project).map(([key, value]) => (
                <TextField
                  key={key}
                  required={key !== 'estimatedOperationDate'}
                  label={
                    (
                      {
                        name: 'Nombre',
                        renewableTechnologyCode: 'Tecnología',
                        province: 'Provincia',
                        municipality: 'Municipio',
                        installedCapacityMw: 'Capacidad instalada MW',
                        estimatedOperationDate: 'Operación estimada (ISO)',
                      } as Record<string, string>
                    )[key]
                  }
                  value={value}
                  onChange={(event) =>
                    setProject((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={create.isPending}>
              Crear
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog open={contractOpen} onClose={() => setContractOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={submitContract}>
          <DialogTitle>Nuevo contrato PPA</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              {Object.entries(contract).map(([key, value]) => (
                <TextField
                  key={key}
                  required={key !== 'conditions'}
                  label={
                    (
                      {
                        contractNumber: 'Número de contrato',
                        awardId: 'ID de adjudicación',
                        projectId: 'ID de proyecto',
                        startDate: 'Inicio (ISO)',
                        endDate: 'Fin (ISO)',
                        price: 'Precio',
                        currencyCode: 'Moneda',
                        capacityMw: 'Capacidad MW',
                        committedEnergyMwh: 'Energía comprometida MWh',
                        conditions: 'Condiciones',
                      } as Record<string, string>
                    )[key]
                  }
                  value={value}
                  multiline={key === 'conditions'}
                  onChange={(event) =>
                    setContract((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setContractOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={createContract.isPending}>
              Crear contrato
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}
