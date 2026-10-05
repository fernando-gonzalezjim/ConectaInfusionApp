import { test, expect } from '@playwright/test';

for (const port of [5173, 5174]) {
  test(`${port}: PostgreSQL settings reach the screen through the development proxy`, async ({ page, request }) => {
    await expect.poll(async () => {
      try { return (await request.get(`http://localhost:${port}/api/v1/ready`)).status(); }
      catch { return 0; }
    }).toBe(200);
    const response = await request.get(`http://localhost:${port}/api/v1/settings/public`);
    expect(response.status()).toBe(200);
    const settings = await response.json();
    expect(settings.displayName).toBe('Conecta Infusion');
    expect(settings.units.map((unit: { code: string }) => unit.code).sort()).toEqual(['cafe', 'studio']);
    expect(Object.keys(settings).sort()).toEqual(['currency','defaultLocale','displayName','supportedLocales','timezone','units']);
    await page.goto(`http://localhost:${port}`);
    if (port === 5173) {
      const overviewResponse = await request.get(`http://localhost:${port}/api/v1/studio/overview`);
      expect(overviewResponse.status()).toBe(200);
      const overview = await overviewResponse.json();
      if (overview.classes.length === 0) {
        await expect(page.getByText('No hay clases programadas por el momento.')).toBeVisible();
      } else {
        const schedule = page.getByRole('region', { name: 'Próximas clases' });
        await expect(schedule.getByRole('article')).toHaveCount(overview.classes.length);
        for (const item of overview.classes) {
          await expect(schedule.getByRole('heading', { name: item.name, exact: true })).toBeVisible();
        }
      }
      await page.getByRole('button', { name: 'Información del estudio' }).click();
    }
    await expect(page.getByText('America/Mexico_City')).toBeVisible();
    expect((await request.post(`http://localhost:${port}/api/v1/settings/public`, { data: { defaultCapacity: 20 } })).status()).toBe(404);
    const audit = await request.get(`http://localhost:${port}/api/v1/audit`);
    expect(audit.status()).toBe(401);
    expect(await audit.json()).toEqual({code:'UNAUTHENTICATED'});
  });
}
