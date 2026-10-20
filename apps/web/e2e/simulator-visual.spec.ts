import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Capturas do simulador para revisão visual: formulário, a calcular e resultado, em claro e escuro.
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844, mobile: true },
  { name: '430x932', width: 430, height: 932, mobile: true },
  { name: '1440x900', width: 1440, height: 900, mobile: false },
] as const;

for (const vp of VIEWPORTS) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`simulador ${vp.name} ${scheme}`, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: scheme,
        hasTouch: vp.mobile,
        isMobile: vp.mobile,
      });

      test('formulário e resultado', async ({ page }) => {
        test.setTimeout(120_000);
        await login(page);
        const dir = `test-results/simulator/${vp.name}-${scheme}`;
        await page.goto('/pt/simulator');
        await expect(page.getByRole('heading', { level: 1, name: /Simulador/ })).toBeVisible();
        await page.screenshot({ path: `${dir}-1-form.png` });

        await page
          .getByRole('button', { name: /Pressupostos/ })
          .first()
          .click();
        await page.screenshot({ path: `${dir}-2-assumptions.png` });

        await page.getByRole('button', { name: 'Calcular cenário' }).click();
        await expect(page.getByRole('progressbar').first()).toBeVisible();
        await page.screenshot({ path: `${dir}-3-running.png` });

        await expect(page).toHaveURL(/[?&]r=[0-9a-f-]{36}/, { timeout: 90_000 });
        await expect(page.getByRole('heading', { name: 'Freguesia a freguesia' })).toBeVisible();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${dir}-4-result-top.png` });
        // O scroll vive no <main>: percorre o resultado em passos de um ecrã.
        for (let i = 1; i <= 5; i++) {
          await page.locator('#content').evaluate((el) => el.scrollBy(0, el.clientHeight * 0.85));
          await page.waitForTimeout(500);
          await page.screenshot({ path: `${dir}-5-result-${i}.png` });
        }
        await page.getByRole('heading', { name: 'Porquê estas escolhas' }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${dir}-6-why.png` });
      });
    });
  }
}
