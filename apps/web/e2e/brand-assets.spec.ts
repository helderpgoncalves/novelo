import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Regenera as capturas do manifesto PWA (public/screenshots) com o logótipo atual.
// Só corre com BRAND_SHOTS=1 (`just brand-shots`): escreve ficheiros, por isso não faz parte da suite normal.
test.skip(!process.env.BRAND_SHOTS, 'BRAND_SHOTS=1 para regenerar as capturas do manifesto');

const OUT = 'public/screenshots';

async function settle(page: import('@playwright/test').Page, ready: string) {
  await expect(page.locator(ready).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
}

test.describe('móvel', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  test('home e mapa', async ({ page }) => {
    await login(page);
    await settle(page, '#content h1');
    await page.screenshot({ path: `${OUT}/mobile-home.png` });
    await page.goto('/pt/map');
    await settle(page, '#content h1');
    await page.screenshot({ path: `${OUT}/mobile-map.png` });
  });
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  test('home', async ({ page }) => {
    await login(page);
    await settle(page, '#content h1');
    await page.screenshot({ path: `${OUT}/desktop-home.png` });
  });
});
