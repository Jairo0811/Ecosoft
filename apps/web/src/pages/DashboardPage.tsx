import type { ReactNode } from 'react';
import {
  AssessmentOutlined,
  CalendarMonthOutlined,
  DescriptionOutlined,
  EventOutlined,
  GavelOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Link,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link as RouterLink } from 'react-router';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Chart } from '../components/Chart';
import { ErrorState, PageHeader } from '../components/PageState';
import { brandGradients } from '../theme/brand';
import {
  formatAuditAction,
  formatAuditModule,
  formatAuditResult,
  formatDateTime,
  formatNumber,
  formatTechnology,
} from '../utils/format';

interface DashboardAnalytics {
  filters: { organizationId: string | null };
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
  capacityByTechnology: { technology: string; installedMw: number; contractedMw: number }[];
  auctionsByStatus: { status: string; auctions: number; capacityMw: number }[];
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

const statusLabels: Record<string, string> = {
  BORRADOR: 'Borrador',
  PROGRAMADA: 'Programada',
  PUBLICADA: 'Publicada',
  ABIERTA: 'Abierta',
  EN_EVALUACION: 'En evaluación',
  ADJUDICADA: 'Adjudicada',
  CANCELADA: 'Cancelada',
  CERRADA: 'Cerrada',
  FINALIZADA: 'Finalizada',
};
const eventLabels: Record<string, string> = {
  APERTURA: 'Apertura',
  CIERRE: 'Cierre',
  EVALUACION: 'Evaluación',
  ADJUDICACION: 'Adjudicación',
  REUNION: 'Reunión',
  VENCIMIENTO: 'Vencimiento',
  FIRMA: 'Firma',
  RENOVACION: 'Renovación',
  HITO: 'Hito',
};

const greeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

const monthLabel = (month: string) => {
  const [year, value] = month.split('-').map(Number);
  if (!year || !value) return month;
  return new Intl.DateTimeFormat('es-DO', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, value - 1, 1)))
    .replace('.', '');
};

const relative = (value: string) =>
  formatDistanceToNow(new Date(value), { locale: es, addSuffix: true });

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card component="section" aria-label={title} sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Box minWidth={0}>
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
            {description && (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            )}
          </Box>
          {action}
        </Stack>
        <Box mt={2}>{children}</Box>
      </CardContent>
    </Card>
  );
}

/**
 * Capacity moves through a real sequence (tendered → offered → awarded → operating), so it is
 * drawn as a connected flow; each bar is relative to the largest stage.
 */
function CapacityFlow({
  kpis,
  totalAuctions,
}: {
  kpis: DashboardAnalytics['kpis'];
  totalAuctions: number;
}) {
  const stages = [
    {
      label: 'Licitada',
      value: kpis.auctionedMw,
      note: `${formatNumber(totalAuctions)} procesos registrados`,
    },
    {
      label: 'Ofertada',
      value: kpis.offeredMw,
      note: `${formatNumber(kpis.bidsReceived)} ofertas recibidas`,
    },
    {
      label: 'Adjudicada',
      value: kpis.awardedMw,
      note: `${formatNumber(kpis.approvedAwards)} adjudicaciones aprobadas`,
    },
    {
      label: 'Operativa',
      value: kpis.operationalMw,
      note: `${formatNumber(kpis.operationalProjects)} proyectos en operación`,
    },
  ];
  const max = Math.max(...stages.map((stage) => stage.value), 0);
  return (
    <Card component="section" aria-labelledby="capacity-flow-title">
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography id="capacity-flow-title" variant="h6" component="h2">
          Capacidad del portafolio
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Megavatios en cada etapa, desde la licitación hasta la operación.
        </Typography>
        <Box
          component="ol"
          sx={{
            listStyle: 'none',
            p: 0,
            m: 0,
            mt: 2.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
            gap: { xs: 2.5, lg: 0 },
          }}
        >
          {stages.map((stage, index) => (
            <Box
              component="li"
              key={stage.label}
              sx={{
                pr: { lg: 3 },
                pl: { lg: index ? 3 : 0 },
                borderLeft: { lg: index ? 1 : 0 },
                borderColor: { lg: 'divider' },
              }}
            >
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                {stage.label}
              </Typography>
              <Typography
                className="tabular"
                component="p"
                sx={{ fontSize: { xs: 28, sm: 32 }, fontWeight: 600, lineHeight: 1.2, mt: 0.5 }}
              >
                {formatNumber(stage.value)}
                <Box
                  component="span"
                  sx={{ fontSize: 15, fontWeight: 500, color: 'text.secondary', ml: 0.75 }}
                >
                  MW
                </Box>
              </Typography>
              <Box
                aria-hidden
                sx={{
                  mt: 1.25,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: 'action.hover',
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${max ? Math.max((stage.value / max) * 100, stage.value ? 2 : 0) : 0}%`,
                    background: brandGradients.conductor,
                  }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                {stage.note}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

function Indicator({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          {label}
        </Typography>
        <Typography
          className="tabular"
          component="p"
          sx={{ fontSize: 26, fontWeight: 600, mt: 0.5 }}
        >
          {formatNumber(value)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {note}
        </Typography>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <Stack spacing={2.5} role="status" aria-label="Cargando indicadores">
      <Skeleton variant="rounded" height={168} />
      <Box display="grid" gridTemplateColumns={{ xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }} gap={2}>
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} variant="rounded" height={104} />
        ))}
      </Box>
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', lg: '1fr 1fr' }} gap={2}>
        <Skeleton variant="rounded" height={220} />
        <Skeleton variant="rounded" height={220} />
      </Box>
    </Stack>
  );
}

export function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const analytics = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () =>
      apiClient
        .get<{ data: DashboardAnalytics }>('/analytics/dashboard')
        .then((response) => response.data.data),
  });
  const data = analytics.data;
  const canReadAudit = hasPermission('audit.read');

  const quickActions = [
    { label: 'Subastas', to: '/subastas', icon: <GavelOutlined />, permission: 'auctions.read' },
    {
      label: 'Documentos',
      to: '/ofertas',
      icon: <DescriptionOutlined />,
      permission: 'documents.manage',
    },
    {
      label: 'Reportes',
      to: '/reportes',
      icon: <AssessmentOutlined />,
      permission: 'reports.read',
    },
    {
      label: 'Calendario',
      to: '/calendario',
      icon: <CalendarMonthOutlined />,
      permission: 'auctions.read',
    },
  ].filter((action) => hasPermission(action.permission));

  const alerts = data
    ? [
        ...data.alerts.closingAuctions.map((item) => ({
          id: `auction-${item.id}`,
          title: `${item.code} cierra ${relative(item.closeAt)}`,
          detail: `${item.title} · ${formatDateTime(item.closeAt)}`,
          to: '/subastas',
        })),
        ...data.alerts.expiringContracts.map((item) => ({
          id: `contract-${item.id}`,
          title: `${item.contractNumber} vence ${relative(item.endDate)}`,
          detail: item.organization.commercialName ?? item.organization.legalName,
          to: '/contratos',
        })),
      ]
    : [];

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title={`${greeting()}, ${user?.firstName ?? ''}`.trim()}
        description={
          data
            ? data.filters.organizationId
              ? 'Indicadores de su organización.'
              : 'Indicadores de toda la instalación.'
            : 'Resumen del portafolio energético según su ámbito y permisos.'
        }
        actions={quickActions.map((action) => (
          <Button
            key={action.to + action.label}
            component={RouterLink}
            to={action.to}
            variant="outlined"
            size="small"
            startIcon={action.icon}
          >
            {action.label}
          </Button>
        ))}
      />

      {analytics.isLoading && <DashboardSkeleton />}
      {analytics.isError && (
        <ErrorState
          error={analytics.error}
          title="No fue posible cargar los indicadores"
          onRetry={() => void analytics.refetch()}
        />
      )}

      {data && (
        <>
          <CapacityFlow
            kpis={data.kpis}
            totalAuctions={data.auctionsByStatus.reduce((sum, item) => sum + item.auctions, 0)}
          />

          <Box
            display="grid"
            gridTemplateColumns={{ xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, 1fr)' }}
            gap={2}
          >
            <Indicator
              label="Subastas activas"
              value={data.kpis.activeAuctions}
              note={`${formatNumber(data.kpis.pendingAuctions)} en preparación`}
            />
            <Indicator
              label="Empresas participantes"
              value={data.kpis.participantOrganizations}
              note="Habilitadas en al menos una subasta"
            />
            <Indicator
              label="Contratos PPA"
              value={data.kpis.contracts}
              note={`${formatNumber(data.kpis.activeContracts)} vigentes`}
            />
            <Indicator
              label="Vencen en 90 días"
              value={data.kpis.expiringContracts}
              note="Contratos vigentes que requieren seguimiento"
            />
          </Box>

          <Box display="grid" gridTemplateColumns={{ xs: '1fr', lg: '1fr 1fr' }} gap={2}>
            <Section
              title="Alertas operativas"
              description="Subastas que cierran en 7 días y contratos que vencen en 90."
              action={
                alerts.length > 0 && (
                  <Chip size="small" color="warning" variant="outlined" label={alerts.length} />
                )
              }
            >
              {alerts.length ? (
                <List disablePadding dense>
                  {alerts.map((item, index) => (
                    <ListItem key={item.id} disableGutters divider={index < alerts.length - 1}>
                      <WarningAmberOutlined
                        color="warning"
                        fontSize="small"
                        sx={{ mr: 1.5 }}
                        aria-hidden
                      />
                      <ListItemText
                        primary={
                          <Link
                            component={RouterLink}
                            to={item.to}
                            color="text.primary"
                            underline="hover"
                          >
                            {item.title}
                          </Link>
                        }
                        secondary={item.detail}
                        slotProps={{ primary: { fontWeight: 500 } }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary" variant="body2">
                  No hay cierres ni vencimientos próximos.
                </Typography>
              )}
            </Section>
            <Section title="Próximos eventos" description="Calendario de subastas en su ámbito.">
              {data.upcomingEvents.length ? (
                <List disablePadding dense>
                  {data.upcomingEvents.map((event, index) => (
                    <ListItem
                      key={event.id}
                      disableGutters
                      divider={index < data.upcomingEvents.length - 1}
                    >
                      <EventOutlined color="info" fontSize="small" sx={{ mr: 1.5 }} aria-hidden />
                      <ListItemText
                        primary={event.title}
                        secondary={`${eventLabels[event.type] ?? event.type} · ${formatDateTime(event.startsAt)}`}
                        slotProps={{ primary: { fontWeight: 500 } }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary" variant="body2">
                  No hay eventos programados.
                </Typography>
              )}
            </Section>
          </Box>

          <Box display="grid" gridTemplateColumns={{ xs: '1fr', lg: '1.5fr 1fr' }} gap={2}>
            <Section
              title="Tendencia de capacidad"
              description="MW licitados y adjudicados por mes (UTC)."
            >
              <Chart
                type="area"
                height={280}
                label="Gráfico de área con MW licitados y adjudicados por mes"
                series={[
                  { name: 'MW licitados', data: data.trend.map((item) => item.auctionedMw) },
                  { name: 'MW adjudicados', data: data.trend.map((item) => item.awardedMw) },
                ]}
                options={{
                  dataLabels: { enabled: false },
                  stroke: { curve: 'straight', width: 2 },
                  fill: { type: 'solid', opacity: 0.12 },
                  xaxis: { categories: data.trend.map((item) => monthLabel(item.month)) },
                  yaxis: { labels: { formatter: (value) => `${formatNumber(value)} MW` } },
                  legend: { position: 'top', horizontalAlign: 'left' },
                  noData: { text: 'Sin datos para el período' },
                }}
              />
            </Section>
            <Section title="Subastas por estado" description="Cantidad de procesos en cada estado.">
              {data.auctionsByStatus.length ? (
                <Chart
                  type="bar"
                  height={280}
                  label="Gráfico de barras con la cantidad de subastas por estado"
                  series={[
                    { name: 'Subastas', data: data.auctionsByStatus.map((item) => item.auctions) },
                  ]}
                  options={{
                    plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: '55%' } },
                    dataLabels: { enabled: false },
                    xaxis: {
                      categories: data.auctionsByStatus.map(
                        (item) => statusLabels[item.status] ?? item.status,
                      ),
                      // Counts are whole processes: no fractional ticks.
                      tickAmount: Math.max(
                        1,
                        Math.max(...data.auctionsByStatus.map((item) => item.auctions)),
                      ),
                      labels: { formatter: (value) => formatNumber(Math.round(Number(value))) },
                    },
                  }}
                />
              ) : (
                <Typography color="text.secondary" variant="body2">
                  Aún no hay subastas en su ámbito.
                </Typography>
              )}
            </Section>
          </Box>

          <Box
            display="grid"
            gridTemplateColumns={{ xs: '1fr', lg: canReadAudit ? '1.5fr 1fr' : '1fr' }}
            gap={2}
          >
            <Section
              title="Capacidad por tecnología"
              description="Instalada y contratada en proyectos registrados."
            >
              {data.capacityByTechnology.length ? (
                <Chart
                  type="bar"
                  height={280}
                  label="Gráfico de barras con capacidad instalada y contratada por tecnología"
                  series={[
                    {
                      name: 'Instalada',
                      data: data.capacityByTechnology.map((item) => item.installedMw),
                    },
                    {
                      name: 'Contratada',
                      data: data.capacityByTechnology.map((item) => item.contractedMw),
                    },
                  ]}
                  options={{
                    plotOptions: { bar: { borderRadius: 3, columnWidth: '45%' } },
                    dataLabels: { enabled: false },
                    xaxis: {
                      categories: data.capacityByTechnology.map((item) =>
                        formatTechnology(item.technology),
                      ),
                    },
                    yaxis: { labels: { formatter: (value) => `${formatNumber(value)} MW` } },
                    legend: { position: 'top', horizontalAlign: 'left' },
                  }}
                />
              ) : (
                <Typography color="text.secondary" variant="body2">
                  Aún no hay proyectos registrados.
                </Typography>
              )}
            </Section>
            {canReadAudit && (
              <Section
                title="Actividad reciente"
                description="Últimas acciones registradas en auditoría."
                action={
                  <Button component={RouterLink} to="/auditoria" size="small">
                    Ver auditoría
                  </Button>
                }
              >
                {data.recentActivity.length ? (
                  <Stack divider={<Divider flexItem />} spacing={1.25}>
                    {data.recentActivity.map((item) => (
                      <Box key={item.id}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" fontWeight={500}>
                            {formatAuditAction(item.action)} · {formatAuditModule(item.module)}
                          </Typography>
                          {item.result !== 'SUCCESS' && (
                            <Chip
                              size="small"
                              color="warning"
                              variant="outlined"
                              label={formatAuditResult(item.result)}
                            />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {item.user ? `${item.user.firstName} ${item.user.lastName}` : 'Sistema'},{' '}
                          {relative(item.createdAt)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography color="text.secondary" variant="body2">
                    Sin actividad registrada.
                  </Typography>
                )}
              </Section>
            )}
          </Box>
        </>
      )}
    </Stack>
  );
}
