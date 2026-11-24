import { expect, test, type Page } from '@playwright/test';
import { MockApi, loginAs } from './support/mock-api';

const pdf = {
  name: 'garantía-baní.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.7\n%%EOF'),
};

const openDocuments = async (page: Page) => {
  await page.goto('/ofertas');
  await page.getByRole('tab', { name: 'Documentos' }).click();
};

test.describe('ofertas y documentos', () => {
  let api: MockApi;
  test.beforeEach(async ({ page }) => {
    api = new MockApi();
    await api.install(page);
    await loginAs(page, 'B');
    await expect(page.getByRole('heading', { level: 1, name: /Bruno/ })).toBeVisible();
  });

  test('registro de oferta con selector de subasta, validación y valores de la subasta', async ({
    page,
  }) => {
    await page.goto('/ofertas');
    await page.getByRole('button', { name: 'Nueva oferta' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nueva oferta (borrador)' });
    await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(dialog.getByText('Seleccione la subasta.')).toBeVisible();
    await expect(dialog.getByText('Indique la potencia.')).toBeVisible();

    await dialog.getByRole('combobox', { name: 'Subasta' }).click();
    await page.getByRole('option', { name: /SUB-2026-001/ }).click();
    await expect(dialog).toContainText('Moneda USD');
    await dialog.getByLabel('Nombre del proyecto').fill('Parque solar Ocoa');
    await dialog.getByLabel('Potencia ofertada').fill('30');
    await dialog.getByLabel('Energía estimada').fill('58000');
    await dialog.getByLabel('Precio ofertado').fill('79.5');
    await dialog.getByLabel('Válida hasta').fill('2027-01-31');
    let body: Record<string, unknown> = {};
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/bids'))
        body = request.postDataJSON() as Record<string, unknown>;
    });
    await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page.getByText(/Borrador «Parque solar Ocoa» guardado/)).toBeVisible();
    expect(body).toMatchObject({
      auctionId: 'a1000000-0000-4000-8000-000000000001',
      renewableTechnologyCode: 'SOLAR',
      currencyCode: 'USD',
      offeredPowerMw: 30,
      validUntil: '2027-01-31T23:59:59.000Z',
    });
  });

  test('envío y retiro con confirmación; el retiro exige motivo', async ({ page }) => {
    await page.goto('/ofertas');
    const draft = page.getByRole('row').filter({ hasText: 'Parque solar Baní II' });
    await draft.getByRole('button', { name: 'Enviar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Enviar oferta' }).click();
    await expect(page.getByText('Oferta «Parque solar Baní II» enviada.')).toBeVisible();

    const sent = page.getByRole('row').filter({ hasText: 'Parque solar Azua' });
    await sent.getByRole('button', { name: 'Retirar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Retirar oferta' });
    await dialog.getByLabel(/Motivo del retiro/).fill('breve');
    await dialog.getByRole('button', { name: 'Retirar oferta' }).click();
    await expect(dialog.getByText(/Escriba al menos 10 caracteres/)).toBeVisible();
    await dialog
      .getByLabel(/Motivo del retiro/)
      .fill('Cambio en la estrategia de inversión del proyecto.');
    await dialog.getByRole('button', { name: 'Retirar oferta' }).click();
    await expect(page.getByText('Oferta «Parque solar Azua» retirada.')).toBeVisible();
  });

  test('carga válida con entidad y requisito seleccionados (sin UUID manual)', async ({ page }) => {
    await openDocuments(page);
    await page.getByRole('button', { name: 'Cargar documento' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cargar documento' });
    await expect(dialog).toContainText('PDF, PNG, JPG, TXT, DOCX o XLSX. Máximo 5 MB.');
    await dialog.getByRole('combobox', { name: 'Oferta' }).click();
    await page.getByRole('option', { name: /Parque solar Baní II/ }).click();
    await dialog.getByRole('combobox', { name: 'Requisito que cumple' }).click();
    await page.getByRole('option', { name: /ESTUDIO_TECNICO/ }).click();
    await dialog.getByLabel('Título').fill('Estudio de interconexión');
    await dialog.locator('input[type=file]').setInputFiles(pdf);
    await expect(dialog).toContainText('garantía-baní.pdf');
    let body: Record<string, unknown> = {};
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/documents'))
        body = request.postDataJSON() as Record<string, unknown>;
    });
    await dialog.getByRole('button', { name: 'Cargar documento' }).click();
    await expect(page.getByText('Documento «Estudio de interconexión» cargado.')).toBeVisible();
    expect(body).toMatchObject({
      entityType: 'BID',
      entityId: 'b1000000-0000-4000-8000-000000000001',
      documentType: 'ESTUDIO_TECNICO',
      fileName: 'garantía-baní.pdf',
      mimeType: 'application/pdf',
    });
  });

  test('archivos inválidos se rechazan antes de enviar', async ({ page }) => {
    await openDocuments(page);
    await page.getByRole('button', { name: 'Cargar documento' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cargar documento' });
    const input = dialog.locator('input[type=file]');
    await input.setInputFiles({
      name: 'instalador.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('MZ'),
    });
    await expect(dialog.getByText(/Formato no admitido/)).toBeVisible();
    await input.setInputFiles({
      name: 'grande.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 1),
    });
    await expect(dialog.getByText(/el máximo es 5 MB/)).toBeVisible();
    expect(
      api.requests.some((request) => request.method === 'POST' && request.path === '/documents'),
    ).toBe(false);
  });

  test('fallo del servidor durante la carga: error específico y el diálogo se conserva', async ({
    page,
  }) => {
    api.fail(/^\/documents\/[^/]+\/versions$/, 500);
    await openDocuments(page);
    await page.getByRole('button', { name: 'Nueva versión' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type=file]').setInputFiles(pdf);
    await dialog.getByRole('button', { name: 'Cargar versión' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Referencia:');
    await expect(dialog.getByRole('button', { name: 'Cargar versión' })).toBeEnabled();
  });

  test('nueva versión y descarga con el nombre real del archivo', async ({ page }) => {
    await openDocuments(page);
    const row = page.getByRole('row').filter({ hasText: 'Garantía de seriedad' });
    await expect(row).toContainText('v2');
    await expect(row).toContainText('SHA-256 9f86d081884c');
    const downloadPromise = page.waitForEvent('download');
    await row.getByRole('button', { name: 'Descargar' }).click();
    expect((await downloadPromise).suggestedFilename()).toBe('garantía-baní-ii.pdf');

    await row.getByRole('button', { name: 'Nueva versión' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type=file]').setInputFiles(pdf);
    await dialog.getByRole('button', { name: 'Cargar versión' }).click();
    await expect(
      page.getByText(/Nueva versión de «Garantía de seriedad — Baní II» cargada/),
    ).toBeVisible();
    await expect(row).toContainText('v3');
  });
});
