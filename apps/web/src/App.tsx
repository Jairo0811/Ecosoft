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

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/activar-cuenta" element={<ActivateAccountPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="subastas" element={<ModulePlaceholderPage title="Subastas" phase={3} />} />
          <Route
            path="contratos"
            element={<ModulePlaceholderPage title="Contratos PPA" phase={6} />}
          />
          <Route path="participantes" element={<OrganizationsPage />} />
          <Route path="catalogos" element={<CatalogsPage />} />
          <Route
            path="reportes"
            element={<ModulePlaceholderPage title="Reportes y analítica" phase={7} />}
          />
          <Route
            path="calendario"
            element={<ModulePlaceholderPage title="Calendario y eventos" phase={3} />}
          />
          <Route path="usuarios" element={<UsersPage />} />
          <Route path="auditoria" element={<ModulePlaceholderPage title="Auditoría" phase={8} />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
