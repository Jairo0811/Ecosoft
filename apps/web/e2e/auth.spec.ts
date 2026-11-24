import { expect, test } from '@playwright/test';
import { MockApi, identities, loginAs } from './support/mock-api';

// A's auctioned capacity (275.5 MW). A regex, not an exact match: the value is rendered with
// its unit in the same element, and the negative assertions below must be able to fail.
const capacityOfA = /275\.5/;

test.describe('autenticación', () => {
  let api: MockApi;
  test.beforeEach(async ({ page }) => {
    api = new MockApi();
    await api.install(page);
  });

  test('valida el formulario antes de enviar', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByText('Ingrese su correo.')).toBeVisible();
    await expect(page.getByText('Ingrese su contraseña.')).toBeVisible();
    await page.getByLabel('Correo electrónico').fill('no-es-un-correo');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByText('Ingrese un correo válido.')).toBeVisible();
    expect(api.requests.filter((request) => request.path === '/auth/login')).toHaveLength(0);
  });

  test('credenciales incorrectas muestran un error uniforme', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('desconocido@ecosoft.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta-123');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos.');
  });

  test('permite mostrar la contraseña y enviar con Enter', async ({ page }) => {
    await page.goto('/login');
    const password = page.getByLabel('Contraseña', { exact: true });
    await page.getByLabel('Correo electrónico').fill(identities.A.email);
    await password.fill(identities.A.password);
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await password.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: /Ana/ })).toBeVisible();
  });

  test('login, logout y mensaje de sesión cerrada', async ({ page }) => {
    await loginAs(page, 'A');
    await expect(page.getByRole('heading', { level: 1, name: /Ana/ })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir menú de perfil' }).click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Sesión cerrada correctamente.')).toBeVisible();
    expect(api.refreshCookie).toBeNull();
  });

  test('cambio de identidad: B nunca ve datos de A, ni desde la caché', async ({ page }) => {
    await loginAs(page, 'A');
    await expect(page.getByText('Indicadores de toda la instalación.')).toBeVisible();
    await expect(page.getByText(capacityOfA)).toBeVisible();
    // Client-side navigation keeps A's dashboard entry in the cache.
    await page
      .getByRole('navigation', { name: 'Navegación principal' })
      .last()
      .getByRole('link', { name: 'Subastas' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Subastas' })).toBeVisible();
    await expect(page.getByText('Subasta solar región norte').first()).toBeVisible();

    await page.getByRole('button', { name: 'Abrir menú de perfil' }).click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);

    // B's dashboard is slow: any cached A data would be visible during this window.
    api.latency.set('/analytics', 1500);
    const firstRequestOfB = api.requests.length;
    // Same tab, no reload: the SPA and its query cache from A are still alive.
    await loginAs(page, 'B', { inPlace: true });
    // While B's request is in flight B must see a loading state. If any cache entry from A
    // survived the switch, A's dashboard would render instantly here instead (verified by
    // disabling resetSessionCache: this assertion then fails).
    await expect(page.getByRole('status', { name: 'Cargando indicadores' })).toBeVisible();
    await expect(page.getByText(capacityOfA)).toHaveCount(0);
    await expect(page.getByText('Indicadores de toda la instalación.')).toHaveCount(0);
    await expect(page.getByText('Indicadores de su organización.')).toBeVisible();
    await expect(page.getByText(capacityOfA)).toHaveCount(0);

    const protectedRequests = api.requests
      .slice(firstRequestOfB)
      .filter((request) => !request.path.startsWith('/auth/'));
    expect(protectedRequests.length).toBeGreaterThan(0);
    expect(protectedRequests.every((request) => request.identity === 'B')).toBe(true);
    // B's navigation reflects B's permissions.
    await expect(page.getByRole('link', { name: 'Auditoría' })).toHaveCount(0);
  });

  test('401 con refresh válido recupera la sesión sin interrumpir', async ({ page }) => {
    await loginAs(page, 'A');
    await expect(page.getByRole('heading', { level: 1, name: /Ana/ })).toBeVisible();
    api.expireAccessTokens();
    await page.getByRole('link', { name: 'Subastas', exact: true }).first().click();
    // Wait for the auctions page itself: the same auction title is also shown on the dashboard.
    await expect(page).toHaveURL(/\/subastas$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Subastas' })).toBeVisible();
    await expect(page.getByText('Subasta solar región norte').first()).toBeVisible();
    await expect
      .poll(() => api.requests.map((request) => `${request.method} ${request.path}`))
      .toEqual(expect.arrayContaining(['POST /auth/refresh', 'GET /auctions']));
    // The retried request carries the renewed token (identity A), with no login screen between.
    const refreshAt = api.requests.findIndex((request) => request.path === '/auth/refresh');
    expect(
      api.requests
        .slice(refreshAt)
        .some((request) => request.path === '/auctions' && request.identity === 'A'),
    ).toBe(true);
    await expect(page).toHaveURL(/\/subastas$/);
  });

  test('refresh fallido termina la sesión y lo explica', async ({ page }) => {
    await loginAs(page, 'A');
    await expect(page.getByRole('heading', { level: 1, name: /Ana/ })).toBeVisible();
    api.expireAccessTokens();
    api.refreshFails = true;
    await page.getByRole('link', { name: 'Subastas', exact: true }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/Su sesión expiró o fue revocada/)).toBeVisible();
    await expect(page.getByText('Subasta solar región norte')).toHaveCount(0);
  });

  test('403 del backend muestra acceso restringido sin cerrar la sesión', async ({ page }) => {
    api.fail(/^\/auctions/, 403, 'FORBIDDEN');
    await loginAs(page, 'A');
    await page.goto('/subastas');
    await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abrir menú de perfil' })).toBeVisible();
  });

  test('rutas sin permiso muestran estado restringido (B en auditoría)', async ({ page }) => {
    await loginAs(page, 'B');
    await expect(page.getByRole('heading', { level: 1, name: /Bruno/ })).toBeVisible();
    await page.goto('/auditoria');
    await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
    expect(api.requests.some((request) => request.path.startsWith('/audit'))).toBe(false);
  });

  test('una visita sin sesión no intenta refrescar (sin 401 en consola)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    expect(api.requests.some((request) => request.path === '/auth/refresh')).toBe(false);
    expect(errors).toEqual([]);
  });
});
