import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const language of ['es-MX', 'en']) {
  test(`shared field errors and keyboard dialog: ${language}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`http://localhost:5173/fixtures/components.html?lang=${language}`);
    const field = page.getByRole('textbox');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(language === 'en' ? 'Enter your full name.' : 'Escribe tu nombre completo.');
    await field.fill('Ana');
    await page.keyboard.press('Tab');
    const trigger = page.getByRole('button', { name: language === 'en' ? 'Open details' : 'Abrir detalles' });
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (let index = 0; index < 4; index++) {
      await page.keyboard.press('Tab');
      await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
    expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(field).toHaveValue('Ana');
    expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
