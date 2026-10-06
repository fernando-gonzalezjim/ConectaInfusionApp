import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/settings/public', route => route.fulfill({ json: { displayName: 'Conecta Infusion', timezone: 'America/Mexico_City', currency: 'MXN' } }));
  await page.route('**/api/v1/studio/overview', route => route.fulfill({ json: { classes: [], products: [] } }));
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 401, json: { code: 'UNAUTHENTICATED' } }));
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ json: { csrfToken: 'test-csrf' } }));
});

for (const width of [320, 360, 768, 1440]) {
  test(`bilingual sign-in is keyboard accessible and fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('http://localhost:5173');
    const trigger = page.getByRole('button', { name: 'Iniciar sesión', exact: true });
    await trigger.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible(); await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeFocused();
    await page.keyboard.press('Tab'); await expect(page.getByLabel('Contraseña', { exact: true })).toBeFocused();
    await page.keyboard.press('Tab'); await expect(page.getByLabel('Recordarme')).toBeFocused();
    await page.keyboard.press('Space'); await expect(page.getByLabel('Recordarme')).toBeChecked();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/login-es-${width}.png` });
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    await page.getByLabel('Idioma', { exact: true }).selectOption('en');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'current-password');
    await expect(page.getByLabel('Remember me')).toBeVisible();
  });
}

test('validation, pending submission and generic errors preserve email but clear the password', async ({ page }) => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let attempts = 0;
  await page.route('**/api/v1/auth/login', async route => { attempts++; await gate; await route.fulfill({ status: 401, json: { code: 'INVALID_CREDENTIALS' } }); });
  await page.goto('http://localhost:5173'); await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeFocused(); expect(attempts).toBe(0);
  await page.getByLabel('Correo electrónico', { exact: true }).fill('invalid');
  await page.getByLabel('Contraseña', { exact: true }).fill('a password');
  await dialog.getByRole('button', { name: 'Iniciar sesión', exact: true }).click(); expect(attempts).toBe(0);
  await page.getByLabel('Correo electrónico', { exact: true }).fill('customer@example.test');
  await dialog.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Iniciando sesión…' })).toBeDisabled();
  release(); await expect(dialog.getByRole('alert')).toContainText('Revisa tu correo y contraseña');
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toHaveValue('customer@example.test');
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue(''); expect(attempts).toBe(1);
});

test('unavailable and throttled replies show safe localized messages', async ({ page }) => {
  let status = 503;
  await page.route('**/api/v1/auth/login', route => route.fulfill({ status, json: { code: status === 503 ? 'UNAVAILABLE' : 'THROTTLED', error: 'private database details' } }));
  await page.goto('http://localhost:5173'); await page.getByLabel('Idioma', { exact: true }).selectOption('en');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await page.getByLabel('Email', { exact: true }).fill('customer@example.test');
  await page.getByLabel('Password', { exact: true }).fill('some password');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Sign-in is unavailable');
  status = 429; await page.getByLabel('Password', { exact: true }).fill('some password');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Too many attempts');
  await expect(dialog).not.toContainText('private database details');
});

test('restored accounts retain access after a failed logout and refresh revoked sessions on window focus', async ({ page }) => {
  let active = true;
  await page.route('**/api/v1/auth/session', route => route.fulfill(active ? { json: {
    account: { id: 'own', personId: 'person', fullName: 'Ana Fixture', email: 'ana@example.test', preferredLocale: 'es-MX', roles: ['customer'] },
    csrfToken: 'session-csrf', expiresAt: '2026-11-01T00:00:00Z', authenticatedAt: '2026-10-03T00:00:00Z'
  } } : { status: 401, json: { code: 'UNAUTHENTICATED' } }));
  await page.route('**/api/v1/auth/logout', route => route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } }));
  await page.goto('http://localhost:5173');
  await page.getByRole('button', { name: 'Mi cuenta', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('ana@example.test');
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('El acceso no está disponible');
  await expect(page.getByRole('dialog')).toContainText('Ana Fixture');
  await page.keyboard.press('Escape');
  active = false; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible();
});
