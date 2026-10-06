import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// This controlled-response suite starts only the frontends; auth must also stay local to its fixtures.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 401, json: { code: 'UNAUTHENTICATED' } }));
});

const settings = { displayName: 'Conecta Infusion', currency: 'MXN', timezone: 'America/Mexico_City', defaultLocale: 'es-MX', supportedLocales: ['es-MX','en'], units: [{ code: 'studio', labels: { 'es-MX':'Estudio',en:'Studio' } },{ code:'cafe', labels:{'es-MX':'Cafetería',en:'Café'} }] };
const overview = { mode:'live', classes:[{ id:'1',name:'Yoga',instructor:'Ana',startsAt:'2026-10-03T18:00:00Z',durationMinutes:60,capacity:16,booked:16 }], products:[{id:'1',name:'Latte',category:'coffee',priceMinor:5500,currency:'MXN'}] };
for (const port of [5173,5174]) {
  test(`${port}: loading preserves input`, async ({page}) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/v1/settings/public',async route => { await gate; await route.fulfill({json:settings}); });
    await page.route('**/api/v1/studio/overview',route => route.fulfill({json:overview}));
    await page.goto(`http://localhost:${port}`);
    await expect(page.getByText('Cargando información…')).toBeVisible();
    if (port === 5173) await page.getByLabel('Buscar una clase').fill('Yoga');
    release();
    await expect(page.getByText('Cargando información…')).toHaveCount(0);
    if (port === 5173) await expect(page.getByLabel('Buscar una clase')).toHaveValue('Yoga');
    else await expect(page.getByText('America/Mexico_City')).toBeVisible();
  });
  for (const width of [360,768,1440]) {
    test(`${port}: bilingual, accessible shell at ${width}px`, async ({ page }) => {
      await page.setViewportSize({width,height:1000});
      const errors: string[]=[];page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/api/v1/settings/public',route=>route.fulfill({json:settings}));
      await page.route('**/api/v1/studio/overview',route=>route.fulfill({json:overview}));
      await page.goto(`http://localhost:${port}`);
      await expect(page.locator('html')).toHaveAttribute('lang','es-MX');
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link',{name:'Ir al contenido'})).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link',{name:'Conecta Infusion',exact:true})).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByLabel('Idioma',{exact:true})).toBeFocused();
      await expect(page.getByLabel('Idioma',{exact:true})).toHaveCSS('outline-style','solid');
      await page.screenshot({path:`test-results/${port}-${width}-keyboard.png`,fullPage:true});
      if(port===5173) {
        await page.getByLabel('Buscar una clase').fill('Yoga');
        await expect(page.getByText('Llena',{exact:true})).toBeVisible();
        await expect(page.getByText('55.00',{exact:false})).toBeVisible();
      } else await expect(page.getByText('America/Mexico_City')).toBeVisible();
      await page.getByLabel('Idioma',{exact:true}).selectOption('en');
      await expect(page.locator('html')).toHaveAttribute('lang','en');
      if(port===5173) {
        await expect(page.getByLabel('Find a class')).toHaveValue('Yoga');
        const trigger=page.getByRole('button',{name:'Studio information'});
        await trigger.focus();await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
      }
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
      const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
      expect(audit.violations).toEqual([]);
      await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','en');
      await expect(page.getByText('Loading information…')).toHaveCount(0);
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(errors).toEqual([]);
      await page.screenshot({path:`test-results/${port}-${width}.png`,fullPage:true});
    });
  }
  test(`${port}: outage and retry`, async ({page})=>{
    let failed=true;
    await page.route('**/api/v1/settings/public',route=>route.fulfill(failed ? {status:503,json:{code:'UNAVAILABLE'}} : {json:settings}));
    await page.route('**/api/v1/studio/overview',route=>route.fulfill({json:{...overview,classes:[],products:[]}}));
    await page.goto(`http://localhost:${port}`);
    await expect(page.getByRole('alert').filter({hasText:'No pudimos'})).toBeVisible();
    if(port===5173) await page.getByLabel('Buscar una clase').fill('retained');
    failed=false;await page.getByRole('button',{name:'Intentar de nuevo'}).click();
    await expect(page.getByRole('button',{name:'Intentar de nuevo'})).toHaveCount(0);
    if(port===5173) { await expect(page.getByLabel('Buscar una clase')).toHaveValue('retained');await expect(page.getByText('No hay clases programadas por el momento.')).toBeVisible(); }
    else await expect(page.getByText('America/Mexico_City')).toBeVisible();
  });
}
