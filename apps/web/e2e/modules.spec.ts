import { expect, test, type Page } from '@playwright/test';
import { MockApi, loginAs, type UserKey } from './support/mock-api';

/**
 * Smoke over every module for both identities: each module linked from the sidebar renders a
 * heading, never lands on "Acceso restringido" (so the menu only offers what the identity may
 * open) and raises no uncaught exceptions. Links are read from the rendered sidebar, so the
 * test follows the real permission-filtered navigation instead of a copy of it.
 */
const visibleModulePaths = async (page: Page): Promise<string[]> => {
  const nav = page.getByRole('navigation', { name: 'Navegación principal' }).last();
  const hrefs = await nav
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  return [...new Set(hrefs.filter((href) => href.startsWith('/')))];
};

for (const key of ['A', 'B'] as UserKey[]) {
  test(`todos los módulos visibles cargan sin errores (${key})`, async ({ page }) => {
    // Walks every module the identity can open (up to 14 routes), so it needs more than 30 s.
    test.setTimeout(120_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) =>
      pageErrors.push(`${new URL(page.url()).pathname}: ${error.message}`),
    );
    await new MockApi().install(page);
    await loginAs(page, key);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const visible = await visibleModulePaths(page);
    expect(visible.length).toBeGreaterThan(5);
    for (const path of visible) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first(), path).toBeVisible();
      await expect(page.getByText('Acceso restringido'), path).toHaveCount(0);
      await page.waitForLoadState('networkidle');
    }
    expect(pageErrors).toEqual([]);
  });
}

test('la empresa participante ve menos módulos que el administrador CNE', async ({ page }) => {
  const api = new MockApi();
  await api.install(page);
  await loginAs(page, 'A');
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const forAdmin = await visibleModulePaths(page);
  await page.getByRole('button', { name: 'Abrir menú de perfil' }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await loginAs(page, 'B');
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const forCompany = await visibleModulePaths(page);
  expect(forCompany.length).toBeLessThan(forAdmin.length);
  // audit.read is granted only to the CNE administrator in the fixture.
  expect(forAdmin).toContain('/auditoria');
  expect(forCompany).not.toContain('/auditoria');
});
