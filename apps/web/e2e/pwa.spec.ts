import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { login } from './helpers';

// O manifest só existe na build (o dev não regista o service worker): `pnpm build` antes de correr este teste.
const BUILT = resolve(import.meta.dirname, '../dist/manifest.webmanifest');

test('o manifest está completo (id, start_url, atalhos, ícones maskable)', async ({ request }) => {
  test.skip(!existsSync(BUILT), 'sem build (dist/manifest.webmanifest)');
  const manifest = JSON.parse(readFileSync(BUILT, 'utf8'));
  expect(manifest.id).toBe('/');
  expect(manifest.start_url).toBe('/?source=pwa');
  expect(manifest.display).toBe('standalone');
  expect(manifest.display_override).toContain('standalone');
  expect(manifest.categories?.length).toBeGreaterThan(0);
  const urls = (manifest.shortcuts as { url: string }[]).map((s) => s.url.split('?')[0]);
  expect(urls).toEqual(['/simulator', '/chat', '/map', '/triage']);
  expect((manifest.icons as { purpose?: string }[]).some((i) => i.purpose === 'maskable')).toBe(
    true,
  );
  for (const shot of manifest.screenshots as { src: string }[]) {
    expect((await request.get(shot.src)).ok(), shot.src).toBe(true);
  }
});

test('o index declara viewport-fit, theme-color por esquema e estilo da barra de estado', async ({
  page,
}) => {
  await page.goto('/pt/login');
  await expect(page.locator('meta[name=viewport]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  );
  await expect(page.locator('meta[name=theme-color]')).toHaveCount(2);
  await expect(page.locator('meta[name=apple-mobile-web-app-status-bar-style]')).toHaveAttribute(
    'content',
    'default',
  );
});

test('o theme-color segue o tema escolhido na app', async ({ page }) => {
  await login(page);
  const colors = () =>
    page.$$eval('meta[name=theme-color]', (ms) => ms.map((m) => (m as HTMLMetaElement).content));
  await page.getByRole('button', { name: 'Mudar tema' }).click();
  await page.getByRole('menuitemradio', { name: 'Escuro' }).click();
  await expect.poll(colors).toEqual(['#0F1815', '#0F1815']);
  await page.getByRole('button', { name: 'Mudar tema' }).click();
  await page.getByRole('menuitemradio', { name: 'Claro' }).click();
  await expect.poll(colors).toEqual(['#F4F1EA', '#F4F1EA']);
  await page.getByRole('button', { name: 'Mudar tema' }).click();
  await page.getByRole('menuitemradio', { name: 'Automático' }).click();
  await expect.poll(colors).toEqual(['#F4F1EA', '#0F1815']);
});

test('"Instalar a app" aparece no menu quando o browser oferece a instalação', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Menu da conta' }).click();
  await expect(page.getByRole('menuitem', { name: 'Instalar a app' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt');
    Object.assign(event, {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(event);
  });
  await page.getByRole('button', { name: 'Menu da conta' }).click();
  await expect(page.getByRole('menuitem', { name: 'Instalar a app' })).toBeVisible();
});

test('no iPhone o menu explica como adicionar ao ecrã principal', async ({ browser }) => {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    locale: 'pt-PT',
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3190',
  });
  const page = await context.newPage();
  await login(page);
  await page.getByRole('button', { name: 'Menu da conta' }).click();
  await page.getByRole('menuitem', { name: 'Instalar a app' }).click();
  const dialog = page.getByRole('dialog', { name: 'Instalar o Novelo no iPhone' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Adicionar ao ecrã principal');
  await dialog.getByRole('button', { name: 'Percebi' }).click();
  await expect(dialog).toBeHidden();
  await context.close();
});
