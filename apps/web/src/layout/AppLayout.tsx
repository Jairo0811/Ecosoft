import { useState } from 'react';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AssessmentOutlined,
  BalanceOutlined,
  BusinessOutlined,
  CalendarMonthOutlined,
  CategoryOutlined,
  DashboardOutlined,
  DarkModeOutlined,
  DescriptionOutlined,
  GavelOutlined,
  LightModeOutlined,
  LogoutOutlined,
  MenuOutlined,
  NotificationsOutlined,
  PeopleAltOutlined,
  RequestQuoteOutlined,
  RuleOutlined,
  PsychologyOutlined,
  ShieldOutlined,
} from '@mui/icons-material';
import { NavLink, Outlet } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { BrandLogo } from '../branding/BrandLogo';
import { useThemeMode } from '../theme/ThemeContext';

const drawerWidth = 272;
const navigation = [
  { label: 'Panel de control', path: '/', icon: <DashboardOutlined /> },
  { label: 'Subastas', path: '/subastas', icon: <GavelOutlined />, permission: 'auctions.read' },
  {
    label: 'Ofertas y documentos',
    path: '/ofertas',
    icon: <RequestQuoteOutlined />,
    permission: 'bids.read',
  },
  {
    label: 'Evaluación',
    path: '/evaluaciones',
    icon: <RuleOutlined />,
    permission: 'evaluations.read',
  },
  {
    label: 'Proyectos y PPA',
    path: '/contratos',
    icon: <DescriptionOutlined />,
    permission: 'contracts.read',
  },
  { label: 'Asistencia de IA', path: '/ia', icon: <PsychologyOutlined />, permission: 'ai.use' },
  { label: 'Participantes', path: '/participantes', icon: <BusinessOutlined /> },
  { label: 'Catálogos', path: '/catalogos', icon: <CategoryOutlined /> },
  { label: 'Reportes', path: '/reportes', icon: <AssessmentOutlined /> },
  { label: 'Calendario', path: '/calendario', icon: <CalendarMonthOutlined /> },
  { label: 'Usuarios', path: '/usuarios', icon: <PeopleAltOutlined /> },
  {
    label: 'Regulación',
    path: '/regulacion',
    icon: <BalanceOutlined />,
    permission: 'regulatory.read',
  },
  {
    label: 'Notificaciones',
    path: '/notificaciones',
    icon: <NotificationsOutlined />,
    permission: 'notifications.read',
  },
  { label: 'Auditoría', path: '/auditoria', icon: <ShieldOutlined />, permission: 'audit.read' },
];

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const canReadNotifications = user?.permissions.includes('notifications.read') ?? false;
  const unread = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () =>
      apiClient
        .get<{ data: { unread: number } }>('/notifications/unread-count')
        .then(({ data }) => data.data.unread),
    enabled: canReadNotifications,
    refetchInterval: 60_000,
  });
  const visibleNavigation = navigation.filter(
    (item) => !item.permission || user?.permissions.includes(item.permission),
  );

  const drawer = (
    <Box
      sx={{
        height: '100%',
        color: 'white',
        bgcolor: '#073B4C',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box px={3} py={2.25}>
        <BrandLogo maxWidth={224} />
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,.1)' }} />
      <List sx={{ px: 1.5, py: 2 }} aria-label="Navegación principal">
        {visibleNavigation.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            end={item.path === '/'}
            onClick={() => setMobileOpen(false)}
            sx={{
              mb: 0.5,
              borderRadius: 2,
              color: 'rgba(255,255,255,.76)',
              '&.active': {
                bgcolor: 'rgba(40,169,107,.22)',
                color: 'white',
                '& .MuiListItemIcon-root': { color: '#62D79A' },
              },
              '&:hover': { bgcolor: 'rgba(255,255,255,.08)' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 42, color: 'inherit' }}>{item.icon}</ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }}
            />
          </ListItemButton>
        ))}
      </List>
      <Box mt="auto" p={2}>
        <ListItemButton
          onClick={() => void logout()}
          sx={{ borderRadius: 2, color: 'rgba(255,255,255,.76)' }}
        >
          <ListItemIcon sx={{ minWidth: 42, color: 'inherit' }}>
            <LogoutOutlined />
          </ListItemIcon>
          <ListItemText primary="Cerrar sesión" />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box display="flex" minHeight="100vh">
      <AppBar
        position="fixed"
        elevation={0}
        color="inherit"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          <IconButton
            onClick={() => setMobileOpen(true)}
            sx={{ display: { md: 'none' } }}
            aria-label="Abrir menú"
          >
            <MenuOutlined />
          </IconButton>
          <Box flexGrow={1}>
            <Typography fontWeight={700}>Comisión Nacional de Energía</Typography>
            <Typography variant="caption" color="text.secondary">
              Entorno institucional
            </Typography>
          </Box>
          {canReadNotifications && (
            <Tooltip title="Notificaciones">
              <IconButton
                component={NavLink}
                to="/notificaciones"
                aria-label={`${unread.data ?? 0} notificaciones sin leer`}
              >
                <Badge badgeContent={unread.data ?? 0} color="error" max={99}>
                  <NotificationsOutlined />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={mode === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}>
            <IconButton onClick={toggleMode} aria-label="Cambiar tema">
              {mode === 'light' ? <DarkModeOutlined /> : <LightModeOutlined />}
            </IconButton>
          </Tooltip>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Avatar sx={{ bgcolor: 'secondary.main', width: 38, height: 38 }}>
              {user?.firstName[0]}
              {user?.lastName[0]}
            </Avatar>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" fontWeight={700}>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.roles[0]?.replaceAll('_', ' ')}
              </Typography>
            </Box>
          </Stack>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: drawerWidth, border: 0 },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box component="main" flexGrow={1} width={{ md: `calc(100% - ${drawerWidth}px)` }}>
        <Toolbar />
        <Box p={{ xs: 2, sm: 3, lg: 4 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
