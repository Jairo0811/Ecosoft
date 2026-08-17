import { Navigate, Route, Routes } from 'react-router';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { CatalogsPage } from './pages/CatalogsPage';
import { LoginPage } from './pages/LoginPage';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage';
import { OrganizationsPage } from './pages/OrganizationsPage';
import { ActivateAccountPage } from './pages/ActivateAccountPage';
import { UsersPage } from './pages/UsersPage';
import { AuctionsPage } from './pages/AuctionsPage';
import { CalendarPage } from './pages/CalendarPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditPage } from './pages/AuditPage';
import { RegulatoryPage } from './pages/RegulatoryPage';
import { NotificationsPage } from './pages/NotificationsPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/activar-cuenta" element={<ActivateAccountPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="subastas" element={<AuctionsPage />} />
          <Route
            path="contratos"
            element={<ModulePlaceholderPage title="Contratos PPA" phase={6} />}
          />
          <Route path="participantes" element={<OrganizationsPage />} />
          <Route path="catalogos" element={<CatalogsPage />} />
          <Route path="reportes" element={<ReportsPage />} />
          <Route path="calendario" element={<CalendarPage />} />
          <Route path="usuarios" element={<UsersPage />} />
          <Route path="regulacion" element={<RegulatoryPage />} />
          <Route path="notificaciones" element={<NotificationsPage />} />
          <Route path="auditoria" element={<AuditPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
