import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiClient } from '../../api/client';
import { getApiErrorMessage } from '../../api/errors';
import { formatDateTime, formatNumber } from '../../utils/format';
import { trustedHeaders, type Paginated } from './model';

interface OpenAuction {
  id: string;
  code: string;
  title: string;
  renewableTechnologyCode: string;
  currencyCode: string;
  maximumPrice: string | null;
  closeAt: string;
}

const positive = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Indique ${label}.`)
    .refine(
      (value) => Number(value) > 0,
      `${label[0]?.toUpperCase()}${label.slice(1)} debe ser mayor que cero.`,
    );

const schema = z.object({
  auctionId: z.string().min(1, 'Seleccione la subasta.'),
  projectName: z.string().trim().min(3, 'Escriba al menos 3 caracteres.').max(240),
  projectLocation: z.string().trim().max(300),
  offeredPowerMw: positive('la potencia'),
  estimatedEnergyMwh: positive('la energía estimada'),
  offeredPrice: positive('el precio'),
  validUntil: z.string().min(1, 'Indique la fecha de validez.'),
});
type BidForm = z.infer<typeof schema>;

const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (projectName: string) => void;
}

/**
 * Draft bid creation. Technology and currency are taken from the selected auction (the API
 * rejects mismatches), so the user cannot enter inconsistent values.
 */
export function NewBidDialog({ open, onClose, onCreated }: Props) {
  const auctions = useQuery({
    queryKey: ['auctions', 'open-for-bids'],
    queryFn: () =>
      apiClient
        .get<Paginated<OpenAuction>>('/auctions', { params: { status: 'ABIERTA', pageSize: 100 } })
        .then(({ data }) => data.data),
    enabled: open,
  });
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<BidForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      auctionId: '',
      projectName: '',
      projectLocation: '',
      offeredPowerMw: '',
      estimatedEnergyMwh: '',
      offeredPrice: '',
      validUntil: '',
    },
  });
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const selected = auctions.data?.find((auction) => auction.id === watch('auctionId'));
  const create = useMutation({
    mutationFn: (values: BidForm) =>
      apiClient.post(
        '/bids',
        {
          auctionId: values.auctionId,
          projectName: values.projectName,
          ...(values.projectLocation ? { projectLocation: values.projectLocation } : {}),
          renewableTechnologyCode: selected?.renewableTechnologyCode,
          currencyCode: selected?.currencyCode,
          offeredPowerMw: Number(values.offeredPowerMw),
          estimatedEnergyMwh: Number(values.estimatedEnergyMwh),
          offeredPrice: Number(values.offeredPrice),
          // Date-only value: end of that day in UTC, so it is valid through the chosen date.
          validUntil: new Date(`${values.validUntil}T23:59:59.000Z`).toISOString(),
        },
        { headers: trustedHeaders },
      ),
    onSuccess: (_response, values) => onCreated(values.projectName),
  });

  return (
    <Dialog open={open} onClose={create.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <Box
        component="form"
        noValidate
        onSubmit={(event) => void handleSubmit((values) => create.mutate(values))(event)}
      >
        <DialogTitle>Nueva oferta (borrador)</DialogTitle>
        <DialogContent>
          <Stack spacing={2.25} mt={0.5}>
            <Controller
              control={control}
              name="auctionId"
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  required
                  label="Subasta"
                  error={Boolean(errors.auctionId)}
                  helperText={
                    errors.auctionId?.message ??
                    (auctions.data?.length === 0
                      ? 'No hay subastas abiertas en las que su organización esté habilitada.'
                      : 'Solo se muestran subastas abiertas.')
                  }
                >
                  {(auctions.data ?? []).map((auction) => (
                    <MenuItem key={auction.id} value={auction.id}>
                      {auction.code}: {auction.title}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            {selected && (
              <Typography variant="body2" color="text.secondary">
                Tecnología {selected.renewableTechnologyCode} · Moneda {selected.currencyCode}
                {selected.maximumPrice
                  ? ` · Precio máximo ${formatNumber(selected.maximumPrice)} ${selected.currencyCode}/MWh`
                  : ''}{' '}
                · Cierra {formatDateTime(selected.closeAt)}
              </Typography>
            )}
            <TextField
              required
              label="Nombre del proyecto"
              error={Boolean(errors.projectName)}
              helperText={errors.projectName?.message}
              {...register('projectName')}
            />
            <TextField label="Ubicación" {...register('projectLocation')} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                required
                fullWidth
                label="Potencia ofertada"
                inputMode="decimal"
                error={Boolean(errors.offeredPowerMw)}
                helperText={errors.offeredPowerMw?.message}
                slotProps={{
                  input: { endAdornment: <InputAdornment position="end">MW</InputAdornment> },
                }}
                {...register('offeredPowerMw')}
              />
              <TextField
                required
                fullWidth
                label="Energía estimada"
                inputMode="decimal"
                error={Boolean(errors.estimatedEnergyMwh)}
                helperText={errors.estimatedEnergyMwh?.message}
                slotProps={{
                  input: { endAdornment: <InputAdornment position="end">MWh</InputAdornment> },
                }}
                {...register('estimatedEnergyMwh')}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                required
                fullWidth
                label="Precio ofertado"
                inputMode="decimal"
                error={Boolean(errors.offeredPrice)}
                helperText={errors.offeredPrice?.message}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        {selected ? `${selected.currencyCode}/MWh` : '/MWh'}
                      </InputAdornment>
                    ),
                  },
                }}
                {...register('offeredPrice')}
              />
              <TextField
                required
                fullWidth
                type="date"
                label="Válida hasta"
                error={Boolean(errors.validUntil)}
                helperText={errors.validUntil?.message ?? 'Fecha incluida (UTC).'}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today() } }}
                {...register('validUntil')}
              />
            </Stack>
            {create.isError && (
              <Alert severity="error" role="alert">
                {getApiErrorMessage(create.error)}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={create.isPending}>
            {create.isPending ? 'Guardando…' : 'Guardar borrador'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
