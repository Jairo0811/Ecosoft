import {
  BusinessOutlined,
  DescriptionOutlined,
  ElectricBoltOutlined,
  GavelOutlined,
  LocalOfferOutlined,
  ScheduleOutlined,
  SolarPowerOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import ReactApexChart from 'react-apexcharts';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';

interface DashboardAnalytics {
  kpis: {
    activeAuctions: number;
    pendingAuctions: number;
    participantOrganizations: number;
    bidsReceived: number;
    contracts: number;
    activeContracts: number;
    auctionedMw: number;
    offeredMw: number;
    awardedMw: number;
    operationalMw: number;
    operationalContractedMw: number;
    operationalProjects: number;
    approvedAwards: number;
    expiringContracts: number;
  };
  capacityByTechnology: {
    technology: string;
    installedMw: number;
    contractedMw: number;
  }[];
  auctionsByStatus: { status: string; auctions: number; capacityMw: number }[];
  averageAwardPriceByCurrency: { currency: string; price: number }[];
  contractedValueByCurrency: { currency: string; value: number; contracts: number }[];
  trend: { month: string; auctionedMw: number; awardedMw: number }[];
  upcomingEvents: { id: string; title: string; type: string; startsAt: string }[];
  alerts: {
    closingAuctions: { id: string; code: string; title: string; closeAt: string }[];
    expiringContracts: {
      id: string;
      contractNumber: string;
      endDate: string;
      organization: { legalName: string; commercialName: string | null };
    }[];
  };
  recentActivity: {
    id: string;
    action: string;
    module: string;
    entity: string | null;
    result: string;
    createdAt: string;
    user: { firstName: string; lastName: string } | null;
  }[];
}

const integer = new Intl.NumberFormat('es-DO', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-DO', { maximumFractionDigits: 2 });
const technologyLabels: Record<string, string> = {
  SOLAR: 'Solar',
  WIND: 'EÃ³lica',
  HYDRO: 'HidroelÃ©ctrica',
  BIOMASS: 'Biomasa',
};

export function DashboardPage() {
  const { user } = useAuth();
  const analytics = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () =>
      apiClient
        .get<{ data: DashboardAnalytics }>('/analytics/dashboard')
        .then((response) => response.data.data),
  });
  const data = analytics.data;
  const now = new Date();
  const currentDate = format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  const hour = now.getHours();
  let greeting = 'Buenas noches';

  if (hour >= 5 && hour < 12) {
    greeting = 'Buenos días';
  } else if (hour >= 12 && hour < 19) {
    greeting = 'Buenas tardes';
  }
  const kpis = [
    {
      label: 'Subastas activas',
      value: data?.kpis.activeAuctions ?? 0,
      note: `${data?.kpis.pendingAuctions ?? 0} pendientes`,
      icon: <GavelOutlined />,
      color: '#0A5C73',
    },
    {
      label: 'Empresas participantes',
      value: data?.kpis.participantOrganizations ?? 0,
      note: 'Organizaciones habilitadas',
      icon: <BusinessOutlined />,
      color: '#28A96B',
    },
    {
      label: 'Ofertas recibidas',
      value: data?.kpis.bidsReceived ?? 0,
      note: `${decimal.format(data?.kpis.offeredMw ?? 0)} MW ofertados`,
      icon: <LocalOfferOutlined />,
      color: '#3C78C4',
    },
    {
      label: 'Contratos PPA',
      value: data?.kpis.contracts ?? 0,
      note: `${data?.kpis.activeContracts ?? 0} vigentes`,
      icon: <DescriptionOutlined />,
      color: '#6657C8',
    },
    {
      label: 'MW licitados',
      value: decimal.format(data?.kpis.auctionedMw ?? 0),
      note: 'Capacidad total de procesos',
      icon: <ElectricBoltOutlined />,
      color: '#D8891C',
    },
    {
      label: 'MW adjudicados',
      value: decimal.format(data?.kpis.awardedMw ?? 0),
      note: `${data?.kpis.approvedAwards ?? 0} adjudicaciones aprobadas`,
      icon: <GavelOutlined />,
      color: '#128C7E',
    },
    {
      label: 'MW operativos',
      value: decimal.format(data?.kpis.operationalMw ?? 0),
      note: `${data?.kpis.operationalProjects ?? 0} proyectos operativos`,
      icon: <SolarPowerOutlined />,
      color: '#168D4E',
    },
    {
      label: 'Vencen en 90 dÃ­as',
      value: data?.kpis.expiringContracts ?? 0,
      note: 'Contratos que requieren seguimiento',
      icon: <WarningAmberOutlined />,
      color: '#C96C1D',
    },
  ];
  const eventItems = data?.upcomingEvents ?? [];
  const alerts = [
    ...(data?.alerts.closingAuctions.map((item) => ({
      id: `auction-${item.id}`,
      title: `${item.code} cierra ${formatDistanceToNow(new Date(item.closeAt), { locale: es, addSuffix: true })}`,
      type: 'Cierre de subasta',
    })) ?? []),
    ...(data?.alerts.expiringContracts.map((item) => ({
      id: `contract-${item.id}`,
      title: `${item.contractNumber} vence ${formatDistanceToNow(new Date(item.endDate), { locale: es, addSuffix: true })}`,
      type: item.organization.commercialName ?? item.organization.legalName,
    })) ?? []),
  ];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" color="primary" fontWeight={800}>
          {currentDate}
        </Typography>
        <Typography variant="h3" fontSize={{ xs: 30, sm: 38 }}>
          Buenos dÃ­as, {user?.firstName}
        </Typography>
        <Typography color="text.secondary" mt={0.5}>
          Panorama del portafolio energÃ©tico segÃºn tu Ã¡mbito y permisos.
        </Typography>
      </Box>
      {analytics.isLoading && (
        <Stack alignItems="center" py={4}>
          <CircularProgress aria-label="Cargando indicadores" />
        </Stack>
      )}
      {analytics.error && <Alert severity="error">{getApiErrorMessage(analytics.error)}</Alert>}
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
                  <Typography variant="h4" mt={1}>
                    {typeof kpi.value === 'number' ? integer.format(kpi.value) : kpi.value}
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
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', lg: '1.45fr 1fr' }} gap={2.5}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={750}>
              Tendencia de capacidad
            </Typography>
            <Typography variant="body2" color="text.secondary">
              MW licitados y adjudicados por mes
            </Typography>
            <ReactApexChart
              type="area"
              height={320}
              series={[
                { name: 'MW licitados', data: data?.trend.map((item) => item.auctionedMw) ?? [] },
                { name: 'MW adjudicados', data: data?.trend.map((item) => item.awardedMw) ?? [] },
              ]}
              options={{
                chart: { toolbar: { show: false }, fontFamily: 'inherit' },
                colors: ['#0A5C73', '#28A96B'],
                dataLabels: { enabled: false },
                stroke: { curve: 'smooth', width: 3 },
                xaxis: { categories: data?.trend.map((item) => item.month) ?? [] },
                yaxis: { labels: { formatter: (value) => `${integer.format(value)} MW` } },
                noData: { text: 'Sin datos para el perÃ­odo' },
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={750}>
              Subastas por estado
            </Typography>
            <Typography variant="body2" color="text.secondary">
              DistribuciÃ³n del portafolio visible
            </Typography>
            <ReactApexChart
              type="donut"
              height={320}
              series={data?.auctionsByStatus.map((item) => item.auctions) ?? []}
              options={{
                labels:
                  data?.auctionsByStatus.map((item) => item.status.replaceAll('_', ' ')) ?? [],
                legend: { position: 'bottom' },
                dataLabels: { enabled: true },
                noData: { text: 'Sin subastas' },
              }}
            />
          </CardContent>
        </Card>
      </Box>
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', lg: '1.45fr 1fr' }} gap={2.5}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={750}>
              Capacidad de proyectos por tecnologÃ­a
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ComparaciÃ³n entre capacidad instalada y contratada
            </Typography>
            <ReactApexChart
              type="bar"
              height={310}
              series={[
                {
                  name: 'Instalada',
                  data: data?.capacityByTechnology.map((item) => item.installedMw) ?? [],
                },
                {
                  name: 'Contratada',
                  data: data?.capacityByTechnology.map((item) => item.contractedMw) ?? [],
                },
              ]}
              options={{
                chart: { toolbar: { show: false }, fontFamily: 'inherit' },
                colors: ['#0A5C73', '#28A96B'],
                plotOptions: { bar: { borderRadius: 5, columnWidth: '48%' } },
                dataLabels: { enabled: false },
                xaxis: {
                  categories:
                    data?.capacityByTechnology.map(
                      (item) => technologyLabels[item.technology] ?? item.technology,
                    ) ?? [],
                },
                yaxis: { labels: { formatter: (value) => `${integer.format(value)} MW` } },
                noData: { text: 'Sin proyectos registrados' },
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <ScheduleOutlined color="primary" />
              <Typography variant="h6" fontWeight={750}>
                PrÃ³ximos eventos
              </Typography>
            </Stack>
            {eventItems.length === 0 ? (
              <Typography color="text.secondary" py={3}>
                No hay eventos prÃ³ximos en tu Ã¡mbito.
              </Typography>
            ) : (
              <List disablePadding>
                {eventItems.map((event, index) => (
                  <ListItem
                    key={event.id}
                    disableGutters
                    divider={index < eventItems.length - 1}
                    sx={{ py: 1.4 }}
                  >
                    <Box mr={2} bgcolor="action.hover" borderRadius={2} p={1} minWidth={64}>
                      <Typography variant="caption" fontWeight={800} color="primary">
                        {format(new Date(event.startsAt), 'dd MMM', { locale: es }).toUpperCase()}
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
            )}
          </CardContent>
        </Card>
      </Box>
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', lg: '1fr 1fr' }} gap={2.5}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <WarningAmberOutlined color="warning" />
              <Typography variant="h6" fontWeight={750}>
                Alertas operativas
              </Typography>
              <Chip size="small" label={alerts.length} color="warning" variant="outlined" />
            </Stack>
            <Stack spacing={1.5}>
              {alerts.length ? (
                alerts.map((item) => (
                  <Box key={item.id}>
                    <Typography variant="body2" fontWeight={700}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.type}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography color="text.secondary">No hay alertas prÃ³ximas.</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={750}>
              Actividad reciente
            </Typography>
            <Typography color="text.secondary" variant="body2" mb={2}>
              Acciones registradas en auditorÃ­a
            </Typography>
            <Stack spacing={1.5}>
              {data?.recentActivity.length ? (
                data.recentActivity.map((item) => (
                  <Stack key={item.id} direction="row" spacing={1.5} alignItems="center">
                    <Box
                      width={9}
                      height={9}
                      borderRadius="50%"
                      bgcolor={item.result === 'SUCCESS' ? 'success.main' : 'warning.main'}
                    />
                    <Box>
                      <Typography variant="body2" fontWeight={700}>
                        {item.action} Â· {item.module}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.user ? `${item.user.firstName} ${item.user.lastName}` : 'Sistema'} Â·{' '}
                        {formatDistanceToNow(new Date(item.createdAt), {
                          locale: es,
                          addSuffix: true,
                        })}
                      </Typography>
                    </Box>
                  </Stack>
                ))
              ) : (
                <Typography color="text.secondary">Sin actividad reciente.</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
