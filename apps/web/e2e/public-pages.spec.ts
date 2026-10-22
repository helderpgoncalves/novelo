import { expect, test } from '@playwright/test';

// Páginas públicas exigidas pela verificação OAuth da Google: acessíveis sem sessão, com Privacidade e Termos à vista.
test.describe('páginas públicas (sem sessão)', () => {
  test('a página inicial mostra o nome, os números com fonte e as ligações legais', async ({
    page,
  }) => {
    await page.goto('/pt/');
    await expect(page).toHaveURL(/\/pt\/?$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Novelo');
    await expect(page.getByText('301,3 t').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('9,1%').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('1,92 vs 4,27').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('estimativa', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Criar conta' })).toBeVisible();
    const legal = page.getByRole('navigation', { name: 'Rodapé' });
    await expect(legal.getByRole('link', { name: 'Privacidade' })).toBeVisible();
    await expect(legal.getByRole('link', { name: 'Termos' })).toBeVisible();
    await expect(legal.getByRole('link', { name: /novelo@heldergoncalves\.io/ })).toBeVisible();
    await expect(page).toHaveTitle(/^Novelo: recolha de têxteis/);
  });

  test('a política em pt e en tem a declaração de Uso Limitado', async ({ page }) => {
    await page.goto('/pt/privacy');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Política de Privacidade' }),
    ).toBeVisible();
    await expect(
      page.getByText('incluindo os requisitos de Uso Limitado.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByText('openid, email e profile')).toBeVisible();
    await page.goto('/en/privacy');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
      page.getByText('will adhere to Google API Services User Data Policy', { exact: false }),
    ).toBeVisible();
  });

  test('os termos abrem e ligam à privacidade', async ({ page }) => {
    await page.goto('/pt/terms');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Termos de Utilização' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Ler a Política de Privacidade' }).click();
    await expect(page).toHaveURL(/\/pt\/privacy/);
  });

  test('o login tem o botão da Google com o consentimento, quando o Google está ativo', async ({
    page,
  }) => {
    await page.goto('/pt/login');
    const google = page.getByRole('link', { name: 'Entrar com o Google' });
    test.skip((await google.count()) === 0, 'Google desligado neste ambiente');
    await expect(google).toBeVisible();
    await expect(page.getByRole('link', { name: 'Termos de Utilização' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Política de Privacidade' }).first()).toBeVisible();
  });

  test('robots.txt e sitemap.xml existem', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.headers()['content-type']).toContain('text/plain');
    expect(await robots.text()).toContain('Sitemap: https://novelo.helder.si/sitemap.xml');
    const sitemap = await request.get('/sitemap.xml');
    expect(await sitemap.text()).toContain('/pt/privacy');
  });
});
