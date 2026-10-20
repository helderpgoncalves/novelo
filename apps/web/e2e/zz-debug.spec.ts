import { test } from '@playwright/test';
import { login } from './helpers';
for (const n of [1, 2, 3, 4, 5, 6]) {
  test(`dbg${n}`, async ({ page }) => {
    const reqs: string[] = [];
    page.on('request', (r) => r.url().includes('coverage') && reqs.push(r.url().slice(-40)));
    await login(page);
    await page.goto('/pt/coverage');
    await page.getByRole('button', { name: '500 m' }).click();
    await page.waitForTimeout(3000);
    const st = await page.evaluate(() => ({
      url: location.href,
      btns: [...document.querySelectorAll('fieldset button')].map((b) => `${b.textContent}:${b.getAttribute('aria-pressed')}`),
      body: document.body.innerText.slice(0, 80),
    }));
    console.log(`DBG${n}`, JSON.stringify(st), reqs.join(' | '));
  });
}
