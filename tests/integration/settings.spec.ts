import { test, expect } from '@playwright/test';

for (const port of [5173, 5174]) {
  test(`${port}: PostgreSQL settings reach the screen through the development proxy`, async ({ page, request }) => {
    const response = await request.get(`http://localhost:${port}/api/v1/settings/public`);
    expect(response.status()).toBe(200);
    const settings = await response.json();
    expect(settings.displayName).toBe('Conecta Infusion');
    expect(settings.units.map((unit: { code: string }) => unit.code).sort()).toEqual(['cafe', 'studio']);
    expect(Object.keys(settings).sort()).toEqual(['currency','defaultLocale','displayName','supportedLocales','timezone','units']);
    await page.goto(`http://localhost:${port}`);
    if (port === 5173) {
      await expect(page.getByText('No hay clases programadas por el momento.')).toBeVisible();
      await page.getByRole('button', { name: 'Información del estudio' }).click();
    }
    await expect(page.getByText('America/Mexico_City')).toBeVisible();
    expect((await request.post(`http://localhost:${port}/api/v1/settings/public`, { data: { defaultCapacity: 20 } })).status()).toBe(404);
    expect((await request.get(`http://localhost:${port}/api/v1/audit`)).status()).toBe(404);
  });
}
