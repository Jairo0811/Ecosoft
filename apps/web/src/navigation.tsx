import type { ReactNode } from 'react';
import {
  AssessmentOutlined,
  BalanceOutlined,
  BusinessOutlined,
  CalendarMonthOutlined,
  CategoryOutlined,
  DashboardOutlined,
  DescriptionOutlined,
  GavelOutlined,
  NotificationsOutlined,
  PeopleAltOutlined,
  PsychologyOutlined,
  RequestQuoteOutlined,
  RuleOutlined,
  ShieldOutlined,
} from '@mui/icons-material';

export interface NavigationItem {
  label: string;
  path: string;
  icon: ReactNode;
  /** Permission the backend requires for the module's primary read endpoint. */
  permission?: string;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

/**
 * Navigation is derived from the same permissions enforced by the API. Hiding an entry
 * only improves UX: the backend remains the security authority and every route is also
 * guarded by `RequirePermission`.
 */
export const navigationGroups: NavigationGroup[] = [
  {
    label: 'General',
    items: [
      {
        label: 'Panel de control',
        path: '/',
        icon: <DashboardOutlined />,
        permission: 'analytics.read',
      },
      {
        label: 'Notificaciones',
        path: '/notificaciones',
        icon: <NotificationsOutlined />,
        permission: 'notifications.read',
      },
      {
        label: 'Calendario',
        path: '/calendario',
        icon: <CalendarMonthOutlined />,
        permission: 'auctions.read',
      },
    ],
  },
  {
    label: 'Mercado energético',
    items: [
      {
        label: 'Subastas',
        path: '/subastas',
        icon: <GavelOutlined />,
        permission: 'auctions.read',
      },
      {
        label: 'Ofertas y documentos',
        path: '/ofertas',
        icon: <RequestQuoteOutlined />,
        permission: 'bids.read',
      },
      {
        label: 'Evaluación y adjudicación',
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
    ],
  },
  {
    label: 'Análisis y cumplimiento',
    items: [
      {
        label: 'Reportes',
        path: '/reportes',
        icon: <AssessmentOutlined />,
        permission: 'reports.read',
      },
      {
        label: 'Regulación',
        path: '/regulacion',
        icon: <BalanceOutlined />,
        permission: 'regulatory.read',
      },
      {
        label: 'Asistencia documental',
        path: '/ia',
        icon: <PsychologyOutlined />,
        permission: 'ai.use',
      },
      {
        label: 'Auditoría',
        path: '/auditoria',
        icon: <ShieldOutlined />,
        permission: 'audit.read',
      },
    ],
  },
  {
    label: 'Administración',
    items: [
      {
        label: 'Participantes',
        path: '/participantes',
        icon: <BusinessOutlined />,
        permission: 'organizations.read',
      },
      {
        label: 'Usuarios y roles',
        path: '/usuarios',
        icon: <PeopleAltOutlined />,
        permission: 'users.manage',
      },
      {
        label: 'Catálogos',
        path: '/catalogos',
        icon: <CategoryOutlined />,
        permission: 'catalogs.read',
      },
    ],
  },
];

export const navigationItems = navigationGroups.flatMap((group) => group.items);

export const findNavigationItem = (pathname: string): NavigationItem | undefined =>
  navigationItems.find((item) =>
    item.path === '/'
      ? pathname === '/'
      : pathname === item.path || pathname.startsWith(`${item.path}/`),
  );

export const canAccess = (permissions: readonly string[] | undefined, permission?: string) =>
  !permission || Boolean(permissions?.includes(permission));
