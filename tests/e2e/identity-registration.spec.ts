import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/settings/public', route => route.fulfill({ json: { displayName: 'Conecta Infusion', timezone: 'America/Mexico_City', currency: 'MXN' } }));
  await page.route('**/api/v1/studio/overview', route => route.fulfill({ json: { classes: [], products: [] } }));
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 401, json: { code: 'UNAUTHENTICATED' } }));
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ json: { csrfToken: 'fixture-csrf' } }));
});
test('registration is bilingual, keyboard accessible and shows pending confirmation without storing credentials', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await page.goto('http://localhost:5173');
  const trigger = page.getByRole('button', { name: 'Crear cuenta', exact: true }); await trigger.focus(); await page.keyboard.press('Enter');
  await expect(page.getByLabel('Nombre', { exact: true })).toBeFocused();
  await page.getByLabel('Nombre', { exact: true }).fill('Fixture'); await page.getByLabel('Correo electrónico', { exact: true }).fill('fixture@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('A long registration password');
  let body: unknown;
  await page.route('**/api/v1/auth/register', async route => { body = route.request().postDataJSON(); await route.fulfill({ status: 202, json: { code: 'ACCEPTED' } }); });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('correo'); expect(body).toMatchObject({ preferredLocale: 'es-MX' });
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await page.getByLabel('Idioma', { exact: true }).selectOption('en'); await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'new-password');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/registration-en-320.png' });
});
test('confirmation clears fragments and requires deliberate POST; invalid links offer resend', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/v1/auth/confirmation', async route => { attempts++; await route.fulfill({ status: 400, json: { code: 'INVALID_ACTION' } }); });
  await page.goto('http://localhost:5173/auth/action#purpose=email_confirmation&token=' + 'x'.repeat(43));
  await expect(page).toHaveURL('http://localhost:5173/auth/action'); expect(attempts).toBe(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Confirmar correo', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('venció'); expect(attempts).toBe(1);
  await page.getByRole('button', { name: 'Reenviar confirmación', exact: true }).click();
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeFocused();
});

test('registration validates passwords, prevents duplicate sends and clears passwords after safe failures', async ({ page }) => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let attempts = 0;
  await page.route('**/api/v1/auth/register', async route => { attempts++; await gate; await route.fulfill({ status: 503, json: { error: 'private raw failure' } }); });
  await page.goto('http://localhost:5173'); await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Fixture'); await page.getByLabel('Correo electrónico', { exact: true }).fill('fixture@example.test');
  const password = page.getByLabel('Contraseña', { exact: true }); await password.fill('short');
  const submit = page.getByRole('dialog').getByRole('button', { name: 'Crear cuenta', exact: true }); await submit.click(); expect(attempts).toBe(0);
  await password.fill('A valid password with spaces'); await submit.click();
  await expect(page.getByRole('button', { name: 'Enviando…', exact: true })).toBeDisabled(); expect(attempts).toBe(1);
  release(); await expect(page.getByRole('alert')).toContainText('Inténtalo'); await expect(password).toHaveValue('');
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toHaveValue('fixture@example.test');
  await expect(page.getByRole('dialog')).not.toContainText('private raw');
  await page.getByRole('button', { name: 'Reenviar confirmación', exact: true }).click();
  await page.route('**/api/v1/auth/confirmation/resend', route => route.fulfill({ status: 429, headers: { 'Retry-After': '60' }, json: { code: 'THROTTLED' } }));
  await page.getByRole('dialog').getByRole('button', { name: 'Reenviar confirmación', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('intentos');
});

test('confirmation can retry an outage, while unsupported/missing links never redeem', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/v1/auth/confirmation', route => { attempts++; return route.fulfill({ status: attempts === 1 ? 503 : 200, json: attempts === 1 ? { code: 'UNAVAILABLE' } : { code: 'CONFIRMED' } }); });
  await page.goto('http://localhost:5173/auth/action#purpose=email_confirmation&token=' + 'x'.repeat(43));
  await page.getByLabel('Idioma', { exact: true }).selectOption('en');
  await page.getByRole('button', { name: 'Confirm email', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('try again');
  await page.getByRole('button', { name: 'Confirm email', exact: true }).click(); await expect(page.getByRole('status')).toContainText('now sign in');
  await page.goto('http://localhost:5173/auth/action#purpose=family_invitation&token=' + 'x'.repeat(43));
  await expect(page.getByRole('alert')).toContainText('supported'); expect(attempts).toBe(2);
  await expect(page.getByRole('button', { name: 'Confirm email', exact: true })).toHaveCount(0);
  await page.goto('http://localhost:5173/auth/action'); await expect(page.getByRole('alert')).toBeVisible(); expect(attempts).toBe(2);
});

for (const width of [360,768,1440]) {
  test(`registration and confirmation fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); await page.goto('http://localhost:5173');
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('http://localhost:5173/auth/action#purpose=email_confirmation&token=' + 'x'.repeat(43));
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
