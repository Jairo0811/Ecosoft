import { expect, test, type Page } from '@playwright/test';
import { MockApi, loginAs } from './support/mock-api';

const row = (page: Page, title: string) => page.getByRole('row').filter({ hasText: title });

test.describe('subastas', () => {
  let api: MockApi;
  test.beforeEach(async ({ page }) => {
    api = new MockApi();
    await api.install(page);
    await loginAs(page, 'A');
    await page.goto('/subastas');
    await expect(row(page, 'Subasta solar región norte')).toBeVisible();
  });

  test('cancelación exige justificación y confirma explícitamente', async ({ page }) => {
    await row(page, 'Subasta solar región norte')
      .getByRole('button', { name: 'Cancelar subasta' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Cancelar la subasta SUB-2026-001' });
    await expect(dialog).toContainText('Abierta → Cancelada');
    await expect(dialog).toContainText('150 MW');

    const justification = dialog.getByLabel(/Justificación de la cancelación/);
    await justification.fill('corta');
    await dialog.getByRole('button', { name: 'Cancelar subasta' }).click();
    await expect(dialog.getByText(/Escriba al menos 10 caracteres/)).toBeVisible();
    expect(api.requests.some((request) => request.method === 'PATCH')).toBe(false);

    api.latency.set('/auctions/a1000000-0000-4000-8000-000000000001/status', 800);
    let body: unknown;
    page.on('request', (request) => {
      if (request.method() === 'PATCH') body = request.postDataJSON();
    });
    await justification.fill('Reprogramación del cronograma por ajuste regulatorio.');
    const confirm = dialog.getByRole('button', { name: 'Cancelar subasta' });
    await confirm.click();
    // While processing the action cannot be submitted twice.
    await expect(dialog.getByRole('button', { name: 'Procesando…' })).toBeDisabled();
    await expect(page.getByText('Subasta SUB-2026-001 cancelada.')).toBeVisible();
    expect(body).toEqual({
      status: 'CANCELADA',
      reason: 'Reprogramación del cronograma por ajuste regulatorio.',
    });
    expect(api.requests.filter((request) => request.method === 'PATCH')).toHaveLength(1);
    await expect(row(page, 'Subasta solar región norte').getByText('Cancelada')).toBeVisible();
  });

  test('publicación con confirmación y transición autorizada', async ({ page }) => {
    await row(page, 'Subasta eólica Montecristi').getByRole('button', { name: 'Publicar' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Programada → Publicada');
    await dialog.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByText('Subasta SUB-2026-002 publicada.')).toBeVisible();
    await expect(row(page, 'Subasta eólica Montecristi').getByText('Publicada')).toBeVisible();
    await expect(
      row(page, 'Subasta eólica Montecristi').getByRole('button', { name: 'Abrir recepción' }),
    ).toBeVisible();
  });

  test('error del backend se muestra en el diálogo y no cierra', async ({ page }) => {
    api.fail(/\/status$/, 409, 'INVALID_AUCTION_TRANSITION');
    await row(page, 'Subasta hidroeléctrica')
      .getByRole('button', { name: 'Marcar adjudicada' })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Marcar adjudicada' }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('creación de borrador valida cronograma y envía instantes UTC', async ({ page }) => {
    await page.getByRole('button', { name: 'Nueva subasta' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nueva subasta energética' });
    await dialog.getByLabel('Código').fill('sub-2027-001');
    await dialog.getByLabel('Título').fill('Subasta solar 2027');
    await dialog.getByRole('combobox', { name: 'Autoridad administradora' }).click();
    await page.getByRole('option', { name: 'CNE' }).click();
    await dialog.getByRole('combobox', { name: 'Tecnología' }).click();
    await page.getByRole('option', { name: 'Solar fotovoltaica' }).click();
    await dialog.getByLabel('Capacidad (MW)').fill('120');
    await dialog.getByLabel('Apertura').fill('2027-03-10T09:00');
    await dialog.getByLabel('Cierre').fill('2027-03-01T09:00');
    await expect(dialog.getByText('Debe ser posterior a la apertura.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Crear borrador' })).toBeDisabled();
    await dialog.getByLabel('Cierre').fill('2027-04-10T17:00');
    let body: Record<string, unknown> = {};
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/auctions'))
        body = request.postDataJSON() as Record<string, unknown>;
    });
    await dialog.getByRole('button', { name: 'Crear borrador' }).click();
    await expect(page.getByText('Borrador SUB-2027-001 creado.')).toBeVisible();
    expect(body.code).toBe('SUB-2027-001');
    expect(body.openAt).toBe(new Date('2027-03-10T09:00').toISOString());
    expect(body.closeAt).toBe(new Date('2027-04-10T17:00').toISOString());
    expect(body).not.toHaveProperty('maximumPrice', 0);
  });

  test('los filtros afectan la consulta', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Estado' }).click();
    await page.getByRole('option', { name: 'Programada' }).click();
    await expect(row(page, 'Subasta eólica Montecristi')).toBeVisible();
    await expect(row(page, 'Subasta solar región norte')).toHaveCount(0);
    await page.getByLabel('Buscar').fill('zzz');
    await expect(page.getByText('Ninguna subasta coincide con los filtros')).toBeVisible();
  });
});
