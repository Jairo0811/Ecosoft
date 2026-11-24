import { expect, test, type Page } from '@playwright/test';
import { MockApi, loginAs, type UserKey } from './support/mock-api';

const row = (page: Page, text: string) => page.getByRole('row').filter({ hasText: text });

const openUsers = async (page: Page, key: UserKey) => {
  await loginAs(page, key);
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto('/usuarios');
  await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
};

test.describe('administración de usuarios', () => {
  let api: MockApi;
  test.beforeEach(async ({ page }) => {
    api = new MockApi();
    await api.install(page);
  });

  test('alcance organizacional: la empresa solo ve sus cuentas e invitaciones', async ({
    page,
  }) => {
    await openUsers(page, 'A');
    await expect(row(page, 'luis.reyes@cne.gob.do')).toBeVisible();
    await expect(row(page, 'carla.diaz@solarcaribe.do')).toBeVisible();

    await page.getByRole('button', { name: 'Abrir menú de perfil' }).click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await loginAs(page, 'B', { inPlace: true });
    await expect(page).not.toHaveURL(/\/login/);
    await page
      .getByRole('navigation', { name: 'Navegación principal' })
      .last()
      .getByRole('link', { name: 'Usuarios y roles' })
      .click();
    await expect(row(page, 'carla.diaz@solarcaribe.do')).toBeVisible();
    await expect(row(page, 'diego.santos@solarcaribe.do')).toBeVisible();
    await expect(page.getByText('luis.reyes@cne.gob.do')).toHaveCount(0);
    const usersRequests = api.requests.filter((request) => request.path === '/users');
    expect(usersRequests.at(-1)?.identity).toBe('B');
  });

  test('suspender exige confirmación explícita y se puede cancelar', async ({ page }) => {
    await openUsers(page, 'A');
    const luis = row(page, 'luis.reyes@cne.gob.do');
    await luis.getByRole('button', { name: 'Suspender' }).click();
    const dialog = page.getByRole('dialog', { name: 'Suspender cuenta' });
    await expect(dialog).toContainText('luis.reyes@cne.gob.do');
    await expect(dialog).toContainText('sesiones activas quedarán revocadas');
    await dialog.getByRole('button', { name: 'Volver' }).click();
    await expect(dialog).toBeHidden();
    expect(api.requests.some((request) => request.method === 'PATCH')).toBe(false);

    await luis.getByRole('button', { name: 'Suspender' }).click();
    await dialog.getByRole('button', { name: 'Suspender cuenta' }).click();
    await expect(page.getByText(/Cuenta de luis\.reyes@cne\.gob\.do suspendida/)).toBeVisible();
    await expect(luis).toContainText('Suspendido');
    await expect(luis.getByRole('button', { name: 'Reactivar' })).toBeVisible();
    expect(
      api.requests.filter(
        (request) => request.method === 'PATCH' && request.path.endsWith('/status'),
      ),
    ).toHaveLength(1);
  });

  test('un error del backend se muestra en el diálogo y no lo cierra', async ({ page }) => {
    api.fail(/\/users\/[^/]+\/status$/, 403, 'FORBIDDEN');
    await openUsers(page, 'A');
    await row(page, 'luis.reyes@cne.gob.do').getByRole('button', { name: 'Suspender' }).click();
    const dialog = page.getByRole('dialog', { name: 'Suspender cuenta' });
    await dialog.getByRole('button', { name: 'Suspender cuenta' }).click();
    await expect(dialog.getByRole('alert')).toContainText('No tiene permisos');
    await expect(dialog).toBeVisible();
    // The table is aria-hidden behind the modal: close it before checking the row.
    await dialog.getByRole('button', { name: 'Volver' }).click();
    await expect(row(page, 'luis.reyes@cne.gob.do')).toContainText('Activo');
  });

  test('revocar una invitación pide confirmación y la retira de la lista', async ({ page }) => {
    await openUsers(page, 'A');
    const invitation = row(page, 'diego.santos@solarcaribe.do');
    await invitation.getByRole('button', { name: 'Revocar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Revocar invitación' });
    await expect(dialog).toContainText('Diego Santos');
    await dialog.getByRole('button', { name: 'Revocar invitación' }).click();
    await expect(
      page.getByText(/Invitación para diego\.santos@solarcaribe\.do revocada/),
    ).toBeVisible();
    await expect(invitation).toHaveCount(0);
    await expect(page.getByText('No hay invitaciones pendientes.')).toBeVisible();
  });

  test('desbloquear una cuenta confirma el resultado', async ({ page }) => {
    await openUsers(page, 'A');
    const carla = row(page, 'carla.diaz@solarcaribe.do');
    await carla.getByRole('button', { name: 'Desbloquear' }).click();
    await expect(
      page.getByText(/Cuenta de carla\.diaz@solarcaribe\.do desbloqueada/),
    ).toBeVisible();
    await expect(carla.getByRole('button', { name: 'Desbloquear' })).toHaveCount(0);
  });
});
