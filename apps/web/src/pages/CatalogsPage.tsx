import { useState } from 'react';
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
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { AddOutlined, TuneOutlined } from '@mui/icons-material';
import { catalogTypes, type CatalogType } from '@ecosoft/shared';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';

interface CatalogItem {
  id: string;
  type: CatalogType;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

const typeLabels: Record<CatalogType, string> = {
  ENERGY_TECHNOLOGY: 'Tecnologías energéticas',
  CURRENCY: 'Monedas',
  TIME_ZONE: 'Zonas horarias',
  PROJECT_STATUS: 'Estados de proyectos',
  DOCUMENT_TYPE: 'Tipos de documentos',
};

export function CatalogsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.permissions.includes('catalogs.manage') ?? false;
  const [type, setType] = useState<CatalogType>('ENERGY_TECHNOLOGY');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState(0);

  const catalogsQuery = useQuery({
    queryKey: ['catalogs', type],
    queryFn: () =>
      apiClient
        .get<{ data: CatalogItem[] }>('/catalogs', { params: { type } })
        .then(({ data }) => data.data),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { code, name, description: description || undefined, sortOrder };
      if (editing) {
        await apiClient.patch(`/catalogs/${editing.id}`, payload);
      } else {
        await apiClient.post('/catalogs', { ...payload, type });
      }
    },
    onSuccess: async () => {
      setDialogOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['catalogs'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (item: CatalogItem) =>
      apiClient.patch(`/catalogs/${item.id}/status`, { isActive: !item.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogs'] }),
  });

  const openCreate = () => {
    setEditing(null);
    setCode('');
    setName('');
    setDescription('');
    setSortOrder(0);
    setDialogOpen(true);
  };

  const openEdit = (item: CatalogItem) => {
    setEditing(item);
    setCode(item.code);
    setName(item.name);
    setDescription(item.description ?? '');
    setSortOrder(item.sortOrder);
    setDialogOpen(true);
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Box>
          <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }}>
            Catálogos
          </Typography>
          <Typography color="text.secondary" mt={0.5}>
            Valores controlados que mantienen consistente el dominio energético.
          </Typography>
        </Box>
        {canManage && (
          <Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate}>
            Nuevo elemento
          </Button>
        )}
      </Stack>
      <Card sx={{ p: 2.5 }}>
        <FormControl fullWidth>
          <InputLabel>Catálogo</InputLabel>
          <Select value={type} label="Catálogo" onChange={(event) => setType(event.target.value)}>
            {catalogTypes.map((item) => (
              <MenuItem key={item} value={item}>
                {typeLabels[item]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Card>
      {catalogsQuery.isError && (
        <Alert severity="error">{getApiErrorMessage(catalogsQuery.error)}</Alert>
      )}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell>Orden</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {catalogsQuery.data?.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Chip label={item.code} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={700}>{item.name}</Typography>
                  </TableCell>
                  <TableCell>{item.description || '—'}</TableCell>
                  <TableCell>{item.sortOrder}</TableCell>
                  <TableCell>
                    <Chip
                      label={item.isActive ? 'Activo' : 'Inactivo'}
                      color={item.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    {canManage && (
                      <Stack direction="row" justifyContent="flex-end" alignItems="center">
                        <Button size="small" onClick={() => openEdit(item)}>
                          Editar
                        </Button>
                        <Switch
                          size="small"
                          checked={item.isActive}
                          onChange={() => statusMutation.mutate(item)}
                          inputProps={{
                            'aria-label': `${item.isActive ? 'Desactivar' : 'Activar'} ${item.name}`,
                          }}
                        />
                      </Stack>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!catalogsQuery.data?.length && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    Este catálogo todavía no tiene elementos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <TuneOutlined color="primary" />
            <span>{editing ? 'Editar elemento' : 'Nuevo elemento'}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} pt={1}>
            <TextField
              label="Código"
              required
              value={code}
              onChange={(event) =>
                setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
              }
              helperText="Mayúsculas, números y guion bajo"
            />
            <TextField
              label="Nombre"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              label="Descripción"
              multiline
              minRows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <TextField
              label="Orden"
              type="number"
              value={sortOrder}
              onChange={(event) => setSortOrder(Math.max(0, Number(event.target.value)))}
            />
          </Stack>
          {saveMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {getApiErrorMessage(saveMutation.error)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!code || !name.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
