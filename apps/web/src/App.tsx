import { Navigate, Route, Routes } from 'react-router';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="subastas" element={<ModulePlaceholderPage title="Subastas" phase={3} />} />
          <Route
            path="contratos"
            element={<ModulePlaceholderPage title="Contratos PPA" phase={6} />}
          />
          <Route
            path="participantes"
            element={<ModulePlaceholderPage title="Participantes" phase={2} />}
          />
          <Route
            path="reportes"
            element={<ModulePlaceholderPage title="Reportes y analítica" phase={7} />}
          />
          <Route
            path="calendario"
            element={<ModulePlaceholderPage title="Calendario y eventos" phase={3} />}
          />
          <Route
            path="usuarios"
            element={<ModulePlaceholderPage title="Administración de usuarios" phase={2} />}
          />
          <Route path="auditoria" element={<ModulePlaceholderPage title="Auditoría" phase={8} />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
