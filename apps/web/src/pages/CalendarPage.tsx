import { useMemo, useState } from 'react';
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
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { AddOutlined, ChevronLeft, ChevronRight } from '@mui/icons-material';
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { calendarEventTypes, type CalendarEventType } from '@ecosoft/shared';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';

interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  source: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
  auction: { id: string; code: string; title: string; status: string } | null;
}
const typeLabels: Record<CalendarEventType, string> = {
  APERTURA: 'Apertura',
  CIERRE: 'Cierre',
  EVALUACION: 'Evaluación',
  REUNION: 'Reunión',
  ADJUDICACION: 'Adjudicación',
  VENCIMIENTO: 'Vencimiento',
  FIRMA: 'Firma',
  RENOVACION: 'Renovación',
  HITO: 'Hito',
};
const emptyEvent = {
  type: 'REUNION' as CalendarEventType,
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  location: '',
  allDay: false,
};

export function CalendarPage() {
  const { user } = useAuth();
  const canManage = user?.permissions.includes('auctions.update') ?? false;
  const queryClient = useQueryClient();
  const [view, setView] = useState<'month' | 'week' | 'list'>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyEvent);
  const range = useMemo(() => {
    if (view === 'week')
      return {
        from: startOfWeek(anchor, { weekStartsOn: 1 }),
        to: endOfWeek(anchor, { weekStartsOn: 1 }),
      };
    const monthFrom = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const monthTo = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
    return { from: monthFrom, to: monthTo };
  }, [anchor, view]);
  const eventsQuery = useQuery({
    queryKey: ['calendar', range.from.toISOString(), range.to.toISOString()],
    queryFn: () =>
      apiClient
        .get<{ data: CalendarEvent[] }>('/calendar', {
          params: { from: range.from.toISOString(), to: range.to.toISOString() },
        })
        .then(({ data }) => data.data),
  });
  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/calendar', {
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setForm(emptyEvent);
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
  const days = eachDayOfInterval({ start: range.from, end: range.to });
  const navigate = (direction: number) =>
    setAnchor((current) =>
      view === 'week' ? addWeeks(current, direction) : addMonths(current, direction),
    );
  const title =
    view === 'week'
      ? `${format(range.from, 'd MMM', { locale: es })} – ${format(range.to, 'd MMM yyyy', { locale: es })}`
      : format(anchor, 'MMMM yyyy', { locale: es });
  const eventsFor = (day: Date) =>
    eventsQuery.data?.filter((event) => isSameDay(new Date(event.startsAt), day)) ?? [];

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Box>
          <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }}>
            Calendario energético
          </Typography>
          <Typography color="text.secondary" mt={0.5}>
            Aperturas, cierres, evaluaciones, reuniones, adjudicaciones e hitos.
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            Nuevo evento
          </Button>
        )}
      </Stack>
      {eventsQuery.isError && (
        <Alert severity="error">{getApiErrorMessage(eventsQuery.error)}</Alert>
      )}
      {createMutation.isError && (
        <Alert severity="error">{getApiErrorMessage(createMutation.error)}</Alert>
      )}
      <Card sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ md: 'center' }}
          gap={2}
        >
          <Stack direction="row" alignItems="center">
            <IconButton onClick={() => navigate(-1)} aria-label="Período anterior">
              <ChevronLeft />
            </IconButton>
            <Typography
              variant="h5"
              textTransform="capitalize"
              minWidth={{ sm: 240 }}
              textAlign="center"
            >
              {title}
            </Typography>
            <IconButton onClick={() => navigate(1)} aria-label="Período siguiente">
              <ChevronRight />
            </IconButton>
            <Button onClick={() => setAnchor(new Date())}>Hoy</Button>
          </Stack>
          <ToggleButtonGroup
            exclusive
            value={view}
            onChange={(_, value: unknown) => {
              if (value === 'month' || value === 'week' || value === 'list') setView(value);
            }}
            size="small"
          >
            <ToggleButton value="month">Mes</ToggleButton>
            <ToggleButton value="week">Semana</ToggleButton>
            <ToggleButton value="list">Lista</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Card>
      {view === 'list' ? (
        <Card sx={{ p: 2.5 }}>
          <Stack spacing={1.5}>
            {eventsQuery.data?.map((event) => (
              <Card key={event.id} variant="outlined" sx={{ p: 2 }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  gap={1}
                >
                  <Box>
                    <Stack direction="row" gap={1} alignItems="center">
                      <Chip
                        size="small"
                        label={typeLabels[event.type]}
                        color={event.source === 'SYSTEM' ? 'primary' : 'secondary'}
                      />
                      <Typography fontWeight={750}>{event.title}</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                      {event.description}
                    </Typography>
                  </Box>
                  <Box textAlign={{ sm: 'right' }}>
                    <Typography fontWeight={700}>
                      {format(new Date(event.startsAt), 'EEEE d MMMM', { locale: es })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {format(new Date(event.startsAt), 'p', { locale: es })}
                      {event.location ? ` · ${event.location}` : ''}
                    </Typography>
                  </Box>
                </Stack>
              </Card>
            ))}
            {eventsQuery.data?.length === 0 && (
              <Typography color="text.secondary">No hay eventos en este período.</Typography>
            )}
          </Stack>
        </Card>
      ) : (
        <Card sx={{ overflow: 'hidden' }}>
          <Box display="grid" gridTemplateColumns="repeat(7, minmax(0,1fr))">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
              <Box key={day} p={1.25} bgcolor="action.hover" borderBottom={1} borderColor="divider">
                <Typography variant="caption" fontWeight={800}>
                  {day}
                </Typography>
              </Box>
            ))}
            {days.map((day) => (
              <Box
                key={day.toISOString()}
                minHeight={view === 'week' ? 360 : 132}
                p={1}
                borderRight={1}
                borderBottom={1}
                borderColor="divider"
                bgcolor={isSameMonth(day, anchor) ? 'background.paper' : 'action.hover'}
              >
                <Typography
                  variant="body2"
                  fontWeight={isSameDay(day, new Date()) ? 900 : 600}
                  color={isSameDay(day, new Date()) ? 'primary.main' : 'text.primary'}
                >
                  {format(day, 'd')}
                </Typography>
                <Stack spacing={0.5} mt={0.75}>
                  {eventsFor(day)
                    .slice(0, view === 'week' ? 10 : 3)
                    .map((event) => (
                      <Box
                        key={event.id}
                        bgcolor={event.source === 'SYSTEM' ? 'primary.main' : 'secondary.main'}
                        color="white"
                        borderRadius={1}
                        px={0.75}
                        py={0.5}
                      >
                        <Typography variant="caption" fontWeight={750} display="block" noWrap>
                          {event.title}
                        </Typography>
                        {view === 'week' && (
                          <Typography variant="caption">
                            {format(new Date(event.startsAt), 'p', { locale: es })}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  {view === 'month' && eventsFor(day).length > 3 && (
                    <Typography variant="caption" color="text.secondary">
                      +{eventsFor(day).length - 3} más
                    </Typography>
                  )}
                </Stack>
              </Box>
            ))}
          </Box>
        </Card>
      )}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nuevo evento de calendario</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Tipo</InputLabel>
              <Select
                value={form.type}
                label="Tipo"
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {calendarEventTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {typeLabels[type]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Título"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Descripción"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              multiline
              minRows={2}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Inicio"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                required
                fullWidth
              />
              <TextField
                label="Fin"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Stack>
            <TextField
              label="Ubicación o enlace"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={createMutation.isPending || !form.title || !form.startsAt}
            onClick={() => createMutation.mutate()}
          >
            Crear evento
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
