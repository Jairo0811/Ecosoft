import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import {
  BusinessOutlined,
  DescriptionOutlined,
  ElectricBoltOutlined,
  GavelOutlined,
  ScheduleOutlined,
  TrendingUpOutlined,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../auth/AuthContext';

const kpis = [
  {
    label: 'Subastas activas',
    value: '4',
    note: '2 cierran esta semana',
    icon: <GavelOutlined />,
    color: '#0A5C73',
  },
  {
    label: 'Empresas participantes',
    value: '28',
    note: '5 pendientes de revisión',
    icon: <BusinessOutlined />,
    color: '#28A96B',
  },
  {
    label: 'Contratos PPA',
    value: '16',
    note: '13 vigentes',
    icon: <DescriptionOutlined />,
    color: '#6657C8',
  },
  {
    label: 'MW adjudicados',
    value: '342',
    note: '+12.4 % frente al periodo anterior',
    icon: <ElectricBoltOutlined />,
    color: '#D8891C',
  },
];

const events = [
  { date: '12 AGO', title: 'Cierre de ofertas — Solar CNE 2026-02', type: 'Cierre' },
  { date: '15 AGO', title: 'Comité de evaluación técnica', type: 'Evaluación' },
  { date: '22 AGO', title: 'Vencimiento de garantía — Energía Verde', type: 'Alerta' },
];

const capacityByTechnology = [
  { label: 'Solar', mw: 158, percent: 46, color: '#D8891C' },
  { label: 'Eólica', mw: 103, percent: 30, color: '#0A5C73' },
  { label: 'Hidroeléctrica', mw: 58, percent: 17, color: '#3C78C4' },
  { label: 'Biomasa', mw: 23, percent: 7, color: '#28A96B' },
];

export function DashboardPage() {
  const { user } = useAuth();
  const currentDate = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" color="primary" fontWeight={800}>
          {currentDate}
        </Typography>
        <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }}>
          Buenos días, {user?.firstName}
        </Typography>
        <Typography color="text.secondary" mt={0.5}>
          Este es el panorama actual del portafolio energético.
        </Typography>
      </Box>
      <Alert severity="info" variant="outlined">
        Datos demostrativos de Fase 1. Los indicadores se conectarán al dominio de subastas en la
        Fase 3.
      </Alert>
      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }}
        gap={2.5}
      >
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography color="text.secondary" variant="body2" fontWeight={650}>
                    {kpi.label}
                  </Typography>
                  <Typography variant="h3" mt={1}>
                    {kpi.value}
                  </Typography>
                </Box>
                <Box
                  display="grid"
                  sx={{
                    placeItems: 'center',
                    width: 46,
                    height: 46,
                    borderRadius: 2.5,
                    color: kpi.color,
                    bgcolor: `${kpi.color}16`,
                  }}
                >
                  {kpi.icon}
                </Box>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {kpi.note}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', lg: '1.6fr 1fr' }} gap={2.5}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" mb={3}>
              <Box>
                <Typography variant="h6" fontWeight={750}>
                  Capacidad por tecnología
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  MW adjudicados en el periodo actual
                </Typography>
              </Box>
              <Chip
                icon={<TrendingUpOutlined />}
                color="success"
                variant="outlined"
                label="+12.4 %"
              />
            </Stack>
            <Stack spacing={2.5}>
              {capacityByTechnology.map(({ label, mw, percent, color }) => (
                <Box key={label}>
                  <Stack direction="row" justifyContent="space-between" mb={0.75}>
                    <Typography fontWeight={650}>{label}</Typography>
                    <Typography color="text.secondary">{mw} MW</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={percent}
                    sx={{
                      height: 9,
                      borderRadius: 9,
                      bgcolor: 'action.hover',
                      '& .MuiLinearProgress-bar': { bgcolor: color },
                    }}
                  />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <ScheduleOutlined color="primary" />
              <Typography variant="h6" fontWeight={750}>
                Próximos eventos
              </Typography>
            </Stack>
            <List disablePadding>
              {events.map((event, index) => (
                <ListItem
                  key={event.title}
                  disableGutters
                  divider={index < events.length - 1}
                  sx={{ py: 1.6, alignItems: 'flex-start' }}
                >
                  <Box
                    mr={2}
                    textAlign="center"
                    bgcolor="action.hover"
                    borderRadius={2}
                    p={1}
                    minWidth={58}
                  >
                    <Typography variant="caption" fontWeight={800} color="primary">
                      {event.date}
                    </Typography>
                  </Box>
                  <ListItemText
                    primary={event.title}
                    secondary={event.type}
                    primaryTypographyProps={{ fontWeight: 650, fontSize: 14 }}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Box>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={750}>
            Actividad reciente
          </Typography>
          <Typography color="text.secondary" variant="body2" mb={2}>
            Trazabilidad de acciones relevantes
          </Typography>
          <Stack spacing={1.5}>
            {[
              ['Oferta recibida', 'Soluciones Renovables del Caribe · hace 12 min', 'success'],
              [
                'Documento actualizado',
                'Bases de Licitación Solar CNE 2026-02 · hace 48 min',
                'info',
              ],
              [
                'Evaluación pendiente',
                '3 propuestas esperan evaluación financiera · hace 2 h',
                'warning',
              ],
            ].map(([title, subtitle, color]) => (
              <Stack key={title} direction="row" spacing={1.5} alignItems="center">
                <Box width={9} height={9} borderRadius="50%" bgcolor={`${color}.main`} />
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    {title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {subtitle}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
