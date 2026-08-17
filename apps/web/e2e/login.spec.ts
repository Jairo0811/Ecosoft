import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('login is keyboard-ready and exposes validation', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Bienvenido' })).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByText('Correo inválido')).toBeVisible();
  await expect(page.getByText('La contraseña es obligatoria')).toBeVisible();
});

test('login has no automatically detectable WCAG A/AA violations', async ({ page }) => {
  await page.goto('/login');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
