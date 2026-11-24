import { expect, test } from '@playwright/test';
import { MockApi, loginAs } from './support/mock-api';

const widths = [360, 390, 768, 1024, 1440];
const routes = ['/', '/subastas', '/ofertas'];

for (const width of widths) {
  test(`sin desbordamiento horizontal a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await new MockApi().install(page);
    await page.goto('/login');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await loginAs(page, 'A');
    await expect(page.getByRole('heading', { level: 1, name: /Ana/ })).toBeVisible();
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${route} a ${width}px`).toBeLessThanOrEqual(0);
    }
  });
}

test('menú móvil: se abre, navega y se cierra', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await new MockApi().install(page);
  await loginAs(page, 'A');
  await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
  const nav = page.getByRole('navigation', { name: 'Navegación principal' }).last();
  await nav.getByRole('link', { name: 'Ofertas y documentos' }).click();
  await expect(page).toHaveURL(/\/ofertas$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Ofertas y documentos' })).toBeVisible();
  await expect(nav).toBeHidden();
});

test('los diálogos caben en pantalla móvil', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await new MockApi().install(page);
  await loginAs(page, 'A');
  await page.goto('/subastas');
  await page.getByRole('button', { name: 'Cancelar subasta' }).first().click();
  const box = await page.getByRole('dialog').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
});
