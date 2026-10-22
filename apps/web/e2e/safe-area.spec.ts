import { expect, type Page, test } from '@playwright/test';
import { login } from './helpers';

// Emula entalhe + barra inicial do iPhone com o próprio Chromium (CDP), sem CSS de teste em produção.
const INSETS = { top: 47, bottom: 34, left: 0, right: 0 };

async function emulateSafeArea(page: Page, insets = INSETS) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
}

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.use({ viewport: { width: 390, height: 844 } });

test('o topo e a barra de separadores respeitam o entalhe e a barra inicial', async ({ page }) => {
  await emulateSafeArea(page);
  await login(page);

  const top = await page.getByTestId('topbar').boundingBox();
  const brand = await page.getByRole('link', { name: 'Novelo, página inicial' }).boundingBox();
  expect(brand?.y ?? 0).toBeGreaterThanOrEqual(INSETS.top);
  const account = await page.getByRole('button', { name: 'Menu da conta' }).boundingBox();
  expect(account?.y ?? 0).toBeGreaterThanOrEqual(INSETS.top);
  expect(top?.height ?? 0).toBeGreaterThanOrEqual(INSETS.top + 56);

  const bar = await page.getByTestId('tab-bar').boundingBox();
  const item = await page.getByRole('link', { name: 'Início' }).boundingBox();
  expect((item?.y ?? 0) + (item?.height ?? 0)).toBeLessThanOrEqual(844 - INSETS.bottom);
  expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeGreaterThanOrEqual(843);
  expect(await noOverflow(page)).toBe(true);
});

test('a gaveta e o copiloto em folha não ficam por baixo do entalhe', async ({ page }) => {
  await emulateSafeArea(page);
  await login(page);
  await page.getByRole('button', { name: 'Mais secções' }).click();
  const close = await page.getByRole('button', { name: 'Fechar' }).boundingBox();
  expect(close?.y ?? 0).toBeGreaterThanOrEqual(INSETS.top);
  const logo = await page
    .getByRole('dialog')
    .getByRole('link', { name: 'Novelo, página inicial' })
    .boundingBox();
  expect(logo?.y ?? 0).toBeGreaterThanOrEqual(INSETS.top);
  await page.keyboard.press('Escape');

  await page
    .getByRole('button', { name: /copiloto/i })
    .first()
    .click();
  const sheetClose = await page.getByRole('button', { name: 'Fechar' }).boundingBox();
  expect(sheetClose?.y ?? 0).toBeGreaterThanOrEqual(INSETS.top);
  const composer = await page.getByTestId('copilot-composer').boundingBox();
  expect((composer?.y ?? 0) + (composer?.height ?? 0)).toBeLessThanOrEqual(844 - 10);
});

test('em paisagem as laterais respeitam o entalhe e o topo continua visível', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await emulateSafeArea(page, { top: 0, bottom: 21, left: 47, right: 47 });
  await login(page);
  const brand = await page.getByRole('link', { name: 'Novelo, página inicial' }).boundingBox();
  expect(brand?.x ?? 0).toBeGreaterThanOrEqual(47);
  const account = await page.getByRole('button', { name: 'Menu da conta' }).boundingBox();
  expect((account?.x ?? 0) + (account?.width ?? 0)).toBeLessThanOrEqual(844 - 47);
  expect(await noOverflow(page)).toBe(true);
});

// Um teste por página (claro e escuro dentro): as 12 navegações num só teste passavam dos 30 s com a suite em paralelo.
for (const route of ['', '/map', '/chat', '/circuits', '/simulator', '/lots']) {
  test(`${route || '/'}: sem overflow nem conteúdo tapado, claro e escuro`, async ({ page }) => {
    await emulateSafeArea(page);
    await login(page);
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/pt${route}`);
      await expect(page.locator('#content')).toBeVisible();
      await page.waitForTimeout(400);
      expect(await noOverflow(page), `${route} ${scheme}`).toBe(true);
      await expect
        .poll(async () => (await page.getByTestId('topbar').boundingBox())?.y, `${route} topo`)
        .toBe(0);
    }
  });
}
