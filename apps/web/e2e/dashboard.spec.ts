import { expect, test } from '@playwright/test';
import { MockApi, loginAs } from './support/mock-api';

test.describe('panel de control', () => {
  let api: MockApi;
  test.beforeEach(async ({ page }) => {
    api = new MockApi();
    await api.install(page);
  });

  test('muestra indicadores reales con unidades', async ({ page }) => {
    await loginAs(page, 'A');
    const flow = page.getByRole('region', { name: 'Capacidad del portafolio' });
    await expect(flow).toContainText('275.5');
    await expect(flow).toContainText('MW');
    await expect(page.getByRole('region', { name: 'Alertas operativas' })).toContainText(
      'SUB-2026-001 cierra',
    );
    await expect(page.getByRole('region', { name: 'Actividad reciente' })).toContainText(
      'Cambio de estado · Subastas',
    );
    await expect(page.getByRole('img', { name: /MW licitados y adjudicados/ })).toBeVisible();
  });

  test('estado vacío informativo', async ({ page }) => {
    api.dashboard.B = { ...api.dashboard.B, capacityByTechnology: [], auctionsByStatus: [] };
    await loginAs(page, 'B');
    await expect(page.getByText('Aún no hay proyectos registrados.')).toBeVisible();
    await expect(page.getByText('Aún no hay subastas en su ámbito.')).toBeVisible();
    await expect(page.getByText('No hay cierres ni vencimientos próximos.')).toBeVisible();
  });

  test('error HTTP: no muestra ceros y permite reintentar', async ({ page }) => {
    api.fail(/^\/analytics/, 500);
    await loginAs(page, 'A');
    await expect(page.getByText('No fue posible cargar los indicadores')).toBeVisible();
    await expect(page.getByText(/Referencia: /)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Capacidad del portafolio' })).toHaveCount(0);
    api.clearFailures();
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.getByRole('region', { name: 'Capacidad del portafolio' })).toContainText(
      '275.5',
    );
  });

  test('permisos: la empresa no ve actividad de auditoría ni accesos no autorizados', async ({
    page,
  }) => {
    await loginAs(page, 'B');
    await expect(page.getByText('Indicadores de su organización.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Actividad reciente' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Reportes' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Usuarios y roles' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Auditoría' })).toHaveCount(0);
  });
});
