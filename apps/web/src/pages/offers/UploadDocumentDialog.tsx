import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { InsertDriveFileOutlined, UploadFileOutlined } from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { getApiErrorMessage } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import {
  acceptAttribute,
  acceptedLabel,
  checkFile,
  entityTypeLabels,
  fileToBase64,
  formatBytes,
  trustedHeaders,
  type Bid,
  type DocumentItem,
  type Paginated,
} from './model';

interface EntityOption {
  id: string;
  label: string;
  detail: string;
  auctionId?: string;
}
interface Requirement {
  code: string;
  title: string;
  isMandatory: boolean;
}

const OTHER_TYPE = '__OTHER__';

/** Entity types a user may attach documents to, with the list endpoint that names them. */
const entitySources = [
  { type: 'BID', permission: 'bids.read' },
  { type: 'ENERGY_PROJECT', permission: 'projects.read' },
  { type: 'PPA_CONTRACT', permission: 'contracts.read' },
  { type: 'AUCTION', permission: 'auctions.update' },
] as const;
type EntityType = (typeof entitySources)[number]['type'];

const loadEntities = async (type: EntityType): Promise<EntityOption[]> => {
  const params = { pageSize: 100 };
  if (type === 'BID') {
    const { data } = await apiClient.get<Paginated<Bid>>('/bids', { params });
    return data.data.map((bid) => ({
      id: bid.id,
      label: bid.projectName,
      detail: `${bid.auction.code} · ${bid.organization.commercialName ?? bid.organization.legalName}`,
      auctionId: bid.auctionId,
    }));
  }
  if (type === 'ENERGY_PROJECT') {
    const { data } = await apiClient.get<
      Paginated<{ id: string; name: string; province: string; renewableTechnologyCode: string }>
    >('/projects', { params });
    return data.data.map((project) => ({
      id: project.id,
      label: project.name,
      detail: `${project.renewableTechnologyCode} · ${project.province}`,
    }));
  }
  if (type === 'PPA_CONTRACT') {
    const { data } = await apiClient.get<
      Paginated<{ id: string; contractNumber: string; status: string }>
    >('/contracts', { params });
    return data.data.map((contract) => ({
      id: contract.id,
      label: contract.contractNumber,
      detail: contract.status,
    }));
  }
  const { data } = await apiClient.get<Paginated<{ id: string; code: string; title: string }>>(
    '/auctions',
    { params },
  );
  return data.data.map((auction) => ({
    id: auction.id,
    label: auction.code,
    detail: auction.title,
  }));
};

interface Props {
  open: boolean;
  onClose: () => void;
  onUploaded: (title: string) => void;
  /** When set, the dialog uploads a new version of this document instead of a new one. */
  versionOf?: DocumentItem | null;
}

export function UploadDocumentDialog({ open, onClose, onUploaded, versionOf }: Props) {
  const { hasPermission } = useAuth();
  const sources = entitySources.filter((source) => hasPermission(source.permission));
  const [entityType, setEntityType] = useState<EntityType>(sources[0]?.type ?? 'BID');
  const [entity, setEntity] = useState<EntityOption | null>(null);
  const [requirementCode, setRequirementCode] = useState('');
  const [customType, setCustomType] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [progress, setProgress] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isVersion = Boolean(versionOf);

  useEffect(() => {
    if (!open) return;
    setEntity(null);
    setRequirementCode('');
    setCustomType('');
    setTitle('');
    setFile(null);
    setFileError('');
    setProgress(0);
    setSubmitted(false);
  }, [open]);

  const entities = useQuery({
    queryKey: ['document-entities', entityType],
    queryFn: () => loadEntities(entityType),
    enabled: open && !isVersion,
  });
  // Bids must carry the auction's mandatory documents: offer its requirement codes.
  const requirements = useQuery({
    queryKey: ['auction-requirements', entity?.auctionId],
    queryFn: () =>
      apiClient
        .get<{ data: { requirements: Requirement[] } }>(`/auctions/${entity?.auctionId}`)
        .then(({ data }) => data.data.requirements),
    enabled: open && entityType === 'BID' && Boolean(entity?.auctionId),
  });

  const documentType = useMemo(() => {
    if (entityType === 'BID' && requirementCode && requirementCode !== OTHER_TYPE)
      return requirementCode;
    return customType.trim().toUpperCase().replace(/\s+/g, '_');
  }, [customType, entityType, requirementCode]);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Seleccione un archivo.');
      const checked = checkFile(file);
      if (!checked.ok) throw new Error(checked.message);
      const filePayload = {
        fileName: file.name,
        mimeType: checked.mime,
        contentBase64: await fileToBase64(file),
      };
      const config = {
        headers: trustedHeaders,
        onUploadProgress: (event: { loaded: number; total?: number | undefined }) =>
          setProgress(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
      };
      if (versionOf) {
        return apiClient.post(`/documents/${versionOf.id}/versions`, filePayload, config);
      }
      return apiClient.post(
        '/documents',
        {
          entityType,
          entityId: entity?.id,
          documentType,
          title: title.trim(),
          confidentiality: 'PRIVATE',
          ...filePayload,
        },
        config,
      );
    },
    onSuccess: () => onUploaded(versionOf?.title ?? title.trim()),
  });

  const selectFile = (selected: File | null) => {
    setFile(selected);
    if (!selected) return setFileError('');
    const checked = checkFile(selected);
    setFileError(checked.ok ? '' : checked.message);
  };

  const missing = {
    entity: !isVersion && !entity,
    type: !isVersion && documentType.length < 2,
    title: !isVersion && title.trim().length < 3,
    file: !file,
  };
  const valid = !Object.values(missing).some(Boolean) && !fileError;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (valid && !upload.isPending) upload.mutate();
  };

  return (
    <Dialog open={open} onClose={upload.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle>
          {isVersion ? `Nueva versión: ${versionOf?.title}` : 'Cargar documento'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.25} mt={0.5}>
            {isVersion ? (
              <Typography variant="body2" color="text.secondary">
                Versión actual: {versionOf?.currentVersionNumber}. La nueva versión conserva el
                historial y su huella SHA-256 queda registrada.
              </Typography>
            ) : (
              <>
                <FormControl fullWidth>
                  <InputLabel id="entity-type-label">Asociar a</InputLabel>
                  <Select
                    labelId="entity-type-label"
                    label="Asociar a"
                    value={entityType}
                    onChange={(event) => {
                      setEntityType(event.target.value);
                      setEntity(null);
                      setRequirementCode('');
                    }}
                  >
                    {sources.map((source) => (
                      <MenuItem key={source.type} value={source.type}>
                        {entityTypeLabels[source.type]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Autocomplete
                  options={entities.data ?? []}
                  loading={entities.isLoading}
                  value={entity}
                  onChange={(_event, value) => {
                    setEntity(value);
                    setRequirementCode('');
                  }}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  getOptionLabel={(option) => option.label}
                  noOptionsText={
                    entities.isError
                      ? 'No fue posible cargar las opciones.'
                      : 'No hay registros disponibles en su ámbito.'
                  }
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {option.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.detail}
                        </Typography>
                      </Box>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      required
                      label={entityTypeLabels[entityType]}
                      placeholder="Buscar por nombre o código"
                      error={submitted && missing.entity}
                      helperText={
                        submitted && missing.entity ? 'Seleccione el registro.' : undefined
                      }
                    />
                  )}
                />
                {entityType === 'BID' && entity && (
                  <FormControl fullWidth required error={submitted && missing.type}>
                    <InputLabel id="requirement-label">Requisito que cumple</InputLabel>
                    <Select
                      labelId="requirement-label"
                      label="Requisito que cumple"
                      value={requirementCode}
                      onChange={(event) => setRequirementCode(event.target.value)}
                    >
                      {(requirements.data ?? []).map((item) => (
                        <MenuItem key={item.code} value={item.code}>
                          {item.code}: {item.title}
                          {item.isMandatory ? ' (obligatorio)' : ''}
                        </MenuItem>
                      ))}
                      <MenuItem value={OTHER_TYPE}>Otro documento de soporte</MenuItem>
                    </Select>
                  </FormControl>
                )}
                {(entityType !== 'BID' || requirementCode === OTHER_TYPE) && (
                  <TextField
                    required
                    label="Tipo documental"
                    value={customType}
                    onChange={(event) => setCustomType(event.target.value)}
                    error={submitted && missing.type}
                    helperText={
                      submitted && missing.type
                        ? 'Indique el tipo documental (mínimo 2 caracteres).'
                        : 'Por ejemplo: ESTUDIO_TECNICO, POLIZA, LICENCIA_AMBIENTAL.'
                    }
                    slotProps={{ htmlInput: { maxLength: 60 } }}
                  />
                )}
                <TextField
                  required
                  label="Título"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  error={submitted && missing.title}
                  helperText={
                    submitted && missing.title ? 'Escriba al menos 3 caracteres.' : undefined
                  }
                  slotProps={{ htmlInput: { maxLength: 240 } }}
                />
              </>
            )}

            <Box>
              <input
                ref={inputRef}
                id="document-file"
                type="file"
                accept={acceptAttribute}
                hidden
                onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
              />
              <Button
                variant="outlined"
                startIcon={<UploadFileOutlined />}
                onClick={() => inputRef.current?.click()}
                aria-describedby="file-requirements"
              >
                {file ? 'Cambiar archivo' : 'Seleccionar archivo'}
              </Button>
              <Typography
                id="file-requirements"
                variant="caption"
                color="text.secondary"
                display="block"
                mt={0.75}
              >
                {acceptedLabel}. Máximo 5 MB.
              </Typography>
              {file && (
                <Stack direction="row" spacing={1} alignItems="center" mt={1.25}>
                  <InsertDriveFileOutlined fontSize="small" color="action" aria-hidden />
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" flexShrink={0}>
                    {formatBytes(file.size)}
                  </Typography>
                </Stack>
              )}
              {(fileError || (submitted && missing.file)) && (
                <Alert severity="error" sx={{ mt: 1.25 }}>
                  {fileError || 'Seleccione el archivo que desea cargar.'}
                </Alert>
              )}
            </Box>

            {upload.isPending && (
              <Box role="status" aria-live="polite">
                <LinearProgress
                  variant={progress ? 'determinate' : 'indeterminate'}
                  value={progress}
                />
                <Typography variant="caption" color="text.secondary">
                  {progress < 100 ? `Enviando… ${progress}%` : 'Verificando integridad…'}
                </Typography>
              </Box>
            )}
            {upload.isError && (
              <Alert severity="error" role="alert">
                {getApiErrorMessage(upload.error)}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={upload.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={upload.isPending || (submitted && !valid)}
          >
            {upload.isPending ? 'Cargando…' : isVersion ? 'Cargar versión' : 'Cargar documento'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
