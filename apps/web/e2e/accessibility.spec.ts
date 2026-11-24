import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { MockApi, loginAs } from './support/mock-api';

const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const audit = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(wcag)
    // ApexCharts' internal SVG is exposed through a labelled role="img" wrapper instead.
    .exclude('.apexcharts-canvas')
    .analyze();
  return results.violations.map((violation) => ({
    id: violation.id,
    nodes: violation.nodes.map((node) => node.target.join(' ')).slice(0, 5),
  }));
};

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accesibilidad (${scheme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await new MockApi().install(page);
    });

    test('login', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await audit(page)).toEqual([]);
    });

    test('panel, subastas, ofertas, documentos y diálogo crítico', async ({ page }) => {
      await loginAs(page, 'A');
      await expect(page.getByRole('region', { name: 'Capacidad del portafolio' })).toBeVisible();
      await expect(
        page
          .getByRole('img', { name: /MW licitados/ })
          .locator('svg')
          .first(),
      ).toBeVisible();
      expect(await audit(page)).toEqual([]);

      await page.goto('/subastas');
      await expect(page.getByRole('table', { name: 'Subastas' })).toBeVisible();
      expect(await audit(page)).toEqual([]);

      await page.getByRole('button', { name: 'Cancelar subasta' }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await audit(page)).toEqual([]);
      await page.keyboard.press('Escape');

      await page.goto('/ofertas');
      await page.getByRole('tab', { name: 'Documentos' }).click();
      await page.getByRole('button', { name: 'Cargar documento' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await audit(page)).toEqual([]);
    });

    test('usuarios y confirmación de suspensión', async ({ page }) => {
      await loginAs(page, 'A');
      await expect(page).not.toHaveURL(/\/login/);
      await page.goto('/usuarios');
      await expect(page.getByText('luis.reyes@cne.gob.do')).toBeVisible();
      expect(await audit(page)).toEqual([]);
      await page.getByRole('button', { name: 'Suspender' }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await audit(page)).toEqual([]);
    });
  });
}

test('navegación por teclado: foco visible y orden lógico en el login', async ({ page }) => {
  await new MockApi().install(page);
  await page.goto('/login');
  await expect(page.getByLabel('Correo electrónico')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Contraseña', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Mostrar contraseña' })).toBeFocused();
  await page.keyboard.press('Tab');
  const submit = page.getByRole('button', { name: 'Iniciar sesión' });
  await expect(submit).toBeFocused();
  const outline = await submit.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe('none');
});

test('navegación por teclado en el menú lateral', async ({ page }) => {
  await new MockApi().install(page);
  await loginAs(page, 'A');
  await expect(page.getByRole('heading', { level: 1, name: /Ana/ })).toBeVisible();
  const link = page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Subastas' });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/subastas$/);
  await expect(link).toHaveAttribute('aria-current', 'page');
});
