import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/settings/public', route => route.fulfill({ json: { displayName: 'Conecta Infusion', currency: 'MXN', timezone: 'America/Mexico_City', units: [] } }));
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 401, json: { code: 'UNAUTHENTICATED' } }));
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ json: { csrfToken: 'test-csrf' } }));
});

for (const width of [320, 768, 1440]) {
  test(`management sign-in shares bilingual accessible controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); await page.goto('http://localhost:5174');
    const trigger = page.getByRole('button', { name: 'Iniciar sesión', exact: true });
    await trigger.focus(); await page.keyboard.press('Enter');
    await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeFocused();
    await expect(page.getByLabel('Recordarme')).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/management-login-${width}.png` });
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    await page.getByLabel('Idioma', { exact: true }).selectOption('en');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  });
}

test('client roles alone cannot display administrative access, and failure never exposes the section', async ({ page }) => {
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: {
    account: { id: 'own', personId: 'person', fullName: 'Cached administrator', email: 'own@example.test', roles: ['administrator'], preferredLocale: 'es-MX' },
    csrfToken: 'session-csrf', expiresAt: '2026-11-01T00:00:00Z', authenticatedAt: '2026-10-03T00:00:00Z'
  } }));
  let status = 403;
  await page.route('**/api/v1/management/access', route => route.fulfill({ status, json: { code: status === 403 ? 'FORBIDDEN' : 'UNAVAILABLE' } }));
  await page.goto('http://localhost:5174');
  await expect(page.getByText('Tu cuenta no tiene permisos de administración.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Administración de cuentas' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mi cuenta', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('own@example.test'); await page.keyboard.press('Escape');
  status = 503; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('No pudimos verificar tus permisos. Intenta de nuevo.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Administración de cuentas' })).toHaveCount(0);
});
