import { expect, test, type Page } from '@playwright/test';
import { MockApi, loginAs } from './support/mock-api';

const openAssistant = async (page: Page) => {
  await loginAs(page, 'A');
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto('/ia');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Asistencia documental' }),
  ).toBeVisible();
};

const chooseDocument = async (page: Page, title: string) => {
  await page.getByRole('combobox', { name: 'Documento' }).click();
  await page.getByRole('option', { name: new RegExp(title) }).click();
};

test.describe('asistencia documental', () => {
  let api: MockApi;
  test.beforeEach(async ({ page }) => {
    api = new MockApi();
    await api.install(page);
  });

  test('declara las capacidades reales: determinista, sin IA generativa ni OCR', async ({
    page,
  }) => {
    await openAssistant(page);
    const provider = page.getByRole('region', { name: 'Qué hace el proveedor configurado' });
    await expect(provider).toContainText('LOCAL_DETERMINISTIC');
    await expect(provider).toContainText('Procesamiento determinista');
    await expect(provider).toContainText('Sin IA generativa');
    await expect(provider).toContainText('Sin OCR');
    await expect(provider).toContainText('Texto plano (.txt)');
    await expect(provider).toContainText('no hay OCR configurado');
    await expect(page.getByText('Sin análisis todavía')).toBeVisible();
  });

  test('un PDF no se ofrece para extracción y no se pide ningún UUID', async ({ page }) => {
    await openAssistant(page);
    await expect(page.getByLabel(/ID del documento/)).toHaveCount(0);
    await chooseDocument(page, 'Garantía de seriedad');
    await expect(page.getByText(/formato sin extracción con el proveedor actual/)).toBeVisible();
    await expect(page.getByRole('button', { name: '1. Extraer texto' })).toBeDisabled();
  });

  test('flujo completo: extraer, analizar y revisar con notas', async ({ page }) => {
    await openAssistant(page);
    await chooseDocument(page, 'Acta de visita técnica');
    await expect(page.getByText(/admite extracción de texto/)).toBeVisible();

    // Analyzing before extracting is rejected by the API with a clear message.
    await page.getByRole('button', { name: '2. Analizar' }).click();
    await expect(page.getByRole('alert')).toContainText('Primero debe extraer el texto');

    await page.getByRole('button', { name: '1. Extraer texto' }).click();
    await expect(
      page.getByText(/Texto de «Acta de visita técnica — Baní II» extraído/),
    ).toBeVisible();
    await page.getByRole('button', { name: '2. Analizar' }).click();
    await expect(page.getByText(/Resumen extractivo de «Acta de visita técnica/)).toBeVisible();

    const history = page.getByRole('region', { name: /Historial/ });
    await expect(history).toContainText('Historial (2)');
    const summary = history.locator('.MuiCard-root').filter({ hasText: 'Resumen extractivo' });
    await expect(summary).toContainText('Pendiente de revisión');
    await expect(summary).toContainText('Se verificó el punto de interconexión');
    await expect(summary).not.toContainText('{');

    await summary.getByRole('button', { name: 'Aceptar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Aceptar resultado' });
    const confirm = dialog.getByRole('button', { name: 'Aceptar resultado' });
    await dialog.getByLabel(/Notas de la revisión/).fill('ok');
    await confirm.click();
    await expect(dialog.getByText(/Escriba al menos 5 caracteres/)).toBeVisible();
    expect(api.requests.some((request) => request.path.endsWith('/review'))).toBe(false);
    await dialog.getByLabel(/Notas de la revisión/).fill('Contrastado con el acta firmada.');
    await confirm.click();
    await expect(page.getByText('Resultado aceptado.')).toBeVisible();
    await expect(summary).toContainText('Aceptado');
    await expect(summary).toContainText('Contrastado con el acta firmada.');
    await expect(summary.getByRole('button', { name: 'Aceptar' })).toHaveCount(0);
  });
});
