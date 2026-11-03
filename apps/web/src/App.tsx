import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { ProtectedRoute, RequirePermission } from './auth/ProtectedRoute';
import { LoadingState } from './components/PageState';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { ActivateAccountPage } from './pages/ActivateAccountPage';

/** Route-level code splitting: each module (and heavy deps such as ApexCharts) loads on demand. */
const page = <K extends string>(
  loader: () => Promise<Record<K, ComponentType>>,
  name: K,
): LazyExoticComponent<ComponentType> =>
  lazy(() => loader().then((module) => ({ default: module[name] })));

const DashboardPage = page(() => import('./pages/DashboardPage'), 'DashboardPage');
const AuctionsPage = page(() => import('./pages/AuctionsPage'), 'AuctionsPage');
const OffersDocumentsPage = page(
  () => import('./pages/OffersDocumentsPage'),
  'OffersDocumentsPage',
);
const EvaluationsPage = page(() => import('./pages/EvaluationsPage'), 'EvaluationsPage');
const ContractsProjectsPage = page(
  () => import('./pages/ContractsProjectsPage'),
  'ContractsProjectsPage',
);
const AIPage = page(() => import('./pages/AIPage'), 'AIPage');
const OrganizationsPage = page(() => import('./pages/OrganizationsPage'), 'OrganizationsPage');
const CatalogsPage = page(() => import('./pages/CatalogsPage'), 'CatalogsPage');
const ReportsPage = page(() => import('./pages/ReportsPage'), 'ReportsPage');
const CalendarPage = page(() => import('./pages/CalendarPage'), 'CalendarPage');
const UsersPage = page(() => import('./pages/UsersPage'), 'UsersPage');
const RegulatoryPage = page(() => import('./pages/RegulatoryPage'), 'RegulatoryPage');
const NotificationsPage = page(() => import('./pages/NotificationsPage'), 'NotificationsPage');
const AuditPage = page(() => import('./pages/AuditPage'), 'AuditPage');

const guarded = (permission: string, Element: ComponentType) => (
  <RequirePermission permission={permission}>
    <Suspense fallback={<LoadingState label="Cargando módulo" />}>
      <Element />
    </Suspense>
  </RequirePermission>
);

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/activar-cuenta" element={<ActivateAccountPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={guarded('analytics.read', DashboardPage)} />
          <Route path="subastas" element={guarded('auctions.read', AuctionsPage)} />
          <Route path="ofertas" element={guarded('bids.read', OffersDocumentsPage)} />
          <Route path="evaluaciones" element={guarded('evaluations.read', EvaluationsPage)} />
          <Route path="contratos" element={guarded('contracts.read', ContractsProjectsPage)} />
          <Route path="ia" element={guarded('ai.use', AIPage)} />
          <Route path="participantes" element={guarded('organizations.read', OrganizationsPage)} />
          <Route path="catalogos" element={guarded('catalogs.read', CatalogsPage)} />
          <Route path="reportes" element={guarded('reports.read', ReportsPage)} />
          <Route path="calendario" element={guarded('auctions.read', CalendarPage)} />
          <Route path="usuarios" element={guarded('users.manage', UsersPage)} />
          <Route path="regulacion" element={guarded('regulatory.read', RegulatoryPage)} />
          <Route path="notificaciones" element={guarded('notifications.read', NotificationsPage)} />
          <Route path="auditoria" element={guarded('audit.read', AuditPage)} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
