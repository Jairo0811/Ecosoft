import { useState, type MouseEvent } from 'react';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Breadcrumbs,
  Divider,
  Drawer,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  DarkModeOutlined,
  LightModeOutlined,
  LogoutOutlined,
  MenuOutlined,
  NotificationsOutlined,
} from '@mui/icons-material';
import { Link as RouterLink, NavLink, Outlet, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { BrandLogo } from '../branding/BrandLogo';
import { canAccess, findNavigationItem, navigationGroups } from '../navigation';
import { brandColors, brandGradients } from '../theme/brand';
import { useThemeMode } from '../theme/ThemeContext';
import { formatRole } from '../utils/format';

const drawerWidth = 280;

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const location = useLocation();
  const canReadNotifications = canAccess(user?.permissions, 'notifications.read');
  const unread = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () =>
      apiClient
        .get<{ data: { unread: number } }>('/notifications/unread-count')
        .then(({ data }) => data.data.unread),
    enabled: canReadNotifications,
    refetchInterval: 60_000,
  });
  const groups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccess(user?.permissions, item.permission)),
    }))
    .filter((group) => group.items.length > 0);
  const current = findNavigationItem(location.pathname);
  const unreadCount = unread.data ?? 0;

  const drawer = (
    <Box
      sx={{
        height: '100%',
        color: 'white',
        background: brandGradients.sidebar,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      <Box px={2.5} py={2} minHeight={96} display="flex" alignItems="center">
        <BrandLogo maxWidth={220} />
      </Box>
      <Divider sx={{ borderColor: 'rgba(0,183,255,.16)' }} />
      <Box component="nav" aria-label="Navegación principal" sx={{ px: 1.5, py: 1.5, flex: 1 }}>
        {groups.map((group) => (
          <List
            key={group.label}
            dense
            disablePadding
            sx={{ mb: 1 }}
            subheader={
              <ListSubheader
                disableSticky
                sx={{
                  bgcolor: 'transparent',
                  color: 'rgba(175,193,216,.82)',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  lineHeight: '32px',
                  px: 1.5,
                }}
              >
                {group.label}
              </ListSubheader>
            }
          >
            {group.items.map((item) => (
              <ListItemButton
                key={item.path}
                component={NavLink}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setMobileOpen(false)}
                sx={{
                  mb: 0.4,
                  minHeight: 42,
                  borderRadius: 2,
                  color: 'rgba(247,251,255,.80)',
                  position: 'relative',
                  '&.active': {
                    bgcolor: 'rgba(0,183,255,.14)',
                    color: 'white',
                    '& .MuiListItemIcon-root': { color: brandColors.lime500 },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 8,
                      bottom: 8,
                      width: 3,
                      borderRadius: 3,
                      background: brandGradients.primary,
                    },
                  },
                  '&:hover': { bgcolor: 'rgba(0,183,255,.10)', color: 'white' },
                  '&.Mui-focusVisible': {
                    outline: `2px solid ${brandColors.cyan500}`,
                    outlineOffset: -2,
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{ primary: { fontWeight: 650, fontSize: 14 } }}
                />
              </ListItemButton>
            ))}
          </List>
        ))}
      </Box>
      <Box px={2.5} py={2} sx={{ borderTop: '1px solid rgba(0,183,255,.12)' }}>
        <Typography variant="caption" sx={{ color: 'rgba(175,193,216,.75)' }}>
          EcoSoft · Enterprise MVP / Pilot Ready
        </Typography>
      </Box>
    </Box>
  );

  const openProfile = (event: MouseEvent<HTMLElement>) => setProfileAnchor(event.currentTarget);

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
          bgcolor: 'background.paper',
          backgroundImage: 'none',
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            onClick={() => setMobileOpen(true)}
            sx={{ display: { md: 'none' } }}
            aria-label="Abrir menú de navegación"
            edge="start"
          >
            <MenuOutlined />
          </IconButton>
          <Box flexGrow={1} minWidth={0}>
            <Breadcrumbs aria-label="Ruta de navegación" sx={{ fontSize: 13 }}>
              <Link component={RouterLink} to="/" underline="hover" color="text.secondary">
                CNE · EcoSoft
              </Link>
              {current && current.path !== '/' && (
                <Typography color="text.primary" fontSize={13} fontWeight={700} noWrap>
                  {current.label}
                </Typography>
              )}
            </Breadcrumbs>
            <Typography
              fontWeight={800}
              noWrap
              sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1.3 }}
            >
              {current?.label ?? 'Comisión Nacional de Energía'}
            </Typography>
          </Box>
          {canReadNotifications && (
            <Tooltip title="Notificaciones">
              <IconButton
                component={NavLink}
                to="/notificaciones"
                aria-label={
                  unread.isError
                    ? 'Notificaciones (estado no disponible)'
                    : `${unreadCount} notificaciones sin leer`
                }
                color="primary"
              >
                <Badge badgeContent={unreadCount} color="error" max={99}>
                  <NotificationsOutlined />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={mode === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}>
            <IconButton onClick={toggleMode} aria-label="Cambiar tema claro u oscuro">
              {mode === 'light' ? <DarkModeOutlined /> : <LightModeOutlined />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Perfil y sesión">
            <IconButton
              onClick={openProfile}
              aria-label="Abrir menú de perfil"
              aria-haspopup="menu"
              aria-expanded={profileAnchor ? 'true' : undefined}
              sx={{ p: 0.5, borderRadius: 2 }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Avatar
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'white',
                    width: 36,
                    height: 36,
                    fontSize: 15,
                  }}
                >
                  {user?.firstName[0]}
                  {user?.lastName[0]}
                </Avatar>
                <Box sx={{ display: { xs: 'none', lg: 'block' }, textAlign: 'left' }}>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    color="text.primary"
                    lineHeight={1.2}
                  >
                    {user?.firstName} {user?.lastName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatRole(user?.roles[0])}
                  </Typography>
                </Box>
              </Stack>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={profileAnchor}
            open={Boolean(profileAnchor)}
            onClose={() => setProfileAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { minWidth: 260, mt: 1 } } }}
          >
            <Box px={2} py={1.25}>
              <Typography fontWeight={800}>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {user?.email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.roles.map(formatRole).join(' · ')}
              </Typography>
            </Box>
            <Divider />
            <MenuItem
              onClick={() => {
                setProfileAnchor(null);
                void logout();
              }}
            >
              <ListItemIcon>
                <LogoutOutlined fontSize="small" />
              </ListItemIcon>
              Cerrar sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: drawerWidth, maxWidth: '86vw', border: 0 },
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
      <Box
        component="main"
        flexGrow={1}
        minWidth={0}
        width={{ md: `calc(100% - ${drawerWidth}px)` }}
      >
        <Toolbar />
        <Box p={{ xs: 2, sm: 3, lg: 4 }} maxWidth={1600} mx="auto">
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
