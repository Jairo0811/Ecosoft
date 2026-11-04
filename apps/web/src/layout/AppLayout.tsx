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
  useMediaQuery,
  type Theme,
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
import { brandColors, brandGradients, radii } from '../theme/brand';
import { useThemeMode } from '../theme/ThemeContext';
import { formatRole } from '../utils/format';

const drawerWidth = 272;

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const location = useLocation();
  const compactHeader = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
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
  const currentGroup = navigationGroups.find((group) =>
    group.items.some((item) => item.path === current?.path),
  )?.label;
  const unreadCount = unread.data ?? 0;

  const drawer = (
    <Box
      sx={{
        height: '100%',
        color: brandColors.white,
        bgcolor: brandColors.navy900,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* The official logo has dark lettering, so it sits on a white plate to stay legible. */}
      <Box px={2} pt={2} pb={1.5}>
        <Box
          component={RouterLink}
          to="/"
          aria-label="EcoSoft, ir al panel de control"
          sx={{
            display: 'block',
            bgcolor: brandColors.white,
            borderRadius: `${radii.card}px`,
            px: 1.75,
            py: 1.25,
            '&:focus-visible': { outline: `2px solid ${brandColors.teal300}`, outlineOffset: 2 },
          }}
        >
          <BrandLogo maxWidth={208} decorative />
        </Box>
      </Box>
      <Box component="nav" aria-label="Navegación principal" sx={{ px: 1.5, pb: 1.5, flex: 1 }}>
        {groups.map((group) => (
          <List
            key={group.label}
            dense
            disablePadding
            sx={{ mt: 1.5 }}
            subheader={
              <ListSubheader
                disableSticky
                sx={{
                  bgcolor: 'transparent',
                  color: '#8EA3BC',
                  fontSize: 12.5,
                  fontWeight: 500,
                  lineHeight: '28px',
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
                  mb: 0.25,
                  minHeight: 40,
                  borderRadius: `${radii.control}px`,
                  color: '#C9D6E5',
                  position: 'relative',
                  '&.active': {
                    bgcolor: 'rgba(255,255,255,.08)',
                    color: brandColors.white,
                    '& .MuiListItemIcon-root': { color: brandColors.teal300 },
                    // The conductor line: the one brand flourish in the interface.
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: -12,
                      top: 6,
                      bottom: 6,
                      width: 4,
                      borderRadius: '0 3px 3px 0',
                      background: brandGradients.conductorVertical,
                    },
                  },
                  '&:hover': { bgcolor: 'rgba(255,255,255,.06)', color: brandColors.white },
                  '&.Mui-focusVisible': {
                    outline: `2px solid ${brandColors.teal300}`,
                    outlineOffset: -2,
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'inherit', '& svg': { fontSize: 20 } }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{ primary: { fontWeight: 500, fontSize: 14 } }}
                />
              </ListItemButton>
            ))}
          </List>
        ))}
      </Box>
      <Box px={2.5} py={1.75} sx={{ borderTop: '1px solid rgba(201,214,229,.12)' }}>
        <Typography variant="caption" component="p" sx={{ color: '#8EA3BC' }}>
          Edición Enterprise MVP / Piloto
        </Typography>
        <Typography variant="caption" component="p" sx={{ color: '#6F86A1' }}>
          Origen académico UNAPEC · ISO-705
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
                Inicio
              </Link>
              {current && current.path !== '/' && currentGroup && !compactHeader && (
                <Typography color="text.secondary" fontSize={13} noWrap>
                  {currentGroup}
                </Typography>
              )}
              {current && current.path !== '/' && (
                <Typography
                  color="text.primary"
                  fontSize={13}
                  fontWeight={600}
                  noWrap
                  aria-current="page"
                >
                  {current.label}
                </Typography>
              )}
            </Breadcrumbs>
            <Typography
              component="p"
              fontWeight={600}
              fontSize={16}
              noWrap
              sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1.35 }}
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
                    bgcolor: brandColors.navy800,
                    color: brandColors.white,
                    width: 34,
                    height: 34,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {user?.firstName[0]}
                  {user?.lastName[0]}
                </Avatar>
                <Box sx={{ display: { xs: 'none', lg: 'block' }, textAlign: 'left' }}>
                  <Typography
                    variant="body2"
                    fontWeight={600}
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
              <Typography fontWeight={600}>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {user?.email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.roles.map(formatRole).join(', ')}
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
