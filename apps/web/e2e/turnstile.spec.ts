import { expect, type Page, type Route, test } from '@playwright/test';

// O Turnstile é simulado: o script da Cloudflare e `auth/config` são interceptados. Prova o contrato com a API:
// cabeçalho X-Turnstile-Token com a ação certa, token novo (uso único) a cada tentativa, botão bloqueado até
// haver token, erros de captcha com "Repetir verificação" e honeypot `website` vazio.

const SCRIPT = /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/;

const MOCK = (delayMs: number) => `
window.__ts = { renders: [], resets: 0, n: 0 };
window.turnstile = {
  render(el, o) {
    const id = 'w' + window.__ts.renders.length;
    window.__ts.renders.push({ action: o.action, theme: o.theme, appearance: o.appearance, sitekey: o.sitekey, language: o.language });
    const issue = () => setTimeout(() => o.callback('token-' + (++window.__ts.n)), ${delayMs});
    window.__ts[id] = issue;
    issue();
    return id;
  },
  reset(id) { window.__ts.resets++; window.__ts[id](); },
  remove() {},
};`;

async function mockTurnstile(page: Page, delayMs = 50) {
  await page.route(SCRIPT, (route) =>
    route.fulfill({ contentType: 'application/javascript', body: MOCK(delayMs) }),
  );
  await page.route('**/api/v1/auth/config', async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    await route.fulfill({
      response: res,
      json: { ...body, turnstile_enabled: true, turnstile_site_key: '1x00000000000000000000AA' },
    });
  });
}

test('login: token por tentativa, cabeçalho e ação, botão bloqueado até haver token', async ({
  page,
}) => {
  await mockTurnstile(page, 600);
  const seen: (string | undefined)[] = [];
  await page.route('**/api/v1/auth/login', (route: Route) => {
    seen.push(route.request().headers()['x-turnstile-token']);
    return route.fulfill({
      status: 401,
      json: { code: 'invalid_credentials', message: 'x', details: null },
    });
  });
  await page.goto('/pt/login?method=password');
  await page.getByLabel('Email').fill('x@example.pt');
  await page.getByLabel('Password', { exact: true }).fill('qualquer-coisa-123');
  const submit = page.getByRole('button', { name: /A verificar|Entrar/ });
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveText(/A verificar/);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();

  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  // Uso único: depois de usado o botão volta a esperar por um token novo.
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect.poll(() => seen.length).toBe(2);
  expect(seen[0]).toMatch(/^token-\d+$/);
  expect(seen[1]).toMatch(/^token-\d+$/);
  expect(seen[1]).not.toBe(seen[0]);

  const ts = await page.evaluate(
    () => (window as unknown as { __ts: { renders: Record<string, string>[] } }).__ts.renders,
  );
  expect(ts[0]).toMatchObject({
    action: 'login',
    appearance: 'interaction-only',
    sitekey: '1x00000000000000000000AA',
    language: 'pt-br',
  });
});

test('login: captcha_failed mostra a mensagem e "Repetir verificação"', async ({ page }) => {
  await mockTurnstile(page);
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 403,
      json: { code: 'captcha_failed', message: 'x', details: null },
    }),
  );
  await page.goto('/pt/login?method=password');
  await page.getByLabel('Email').fill('x@example.pt');
  await page.getByLabel('Password', { exact: true }).fill('qualquer-coisa-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText(/Não foi possível confirmar que és uma pessoa/)).toBeVisible();
  const retry = page.getByRole('button', { name: 'Repetir verificação' });
  await expect(retry).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  await retry.click();
  await expect(retry).toBeHidden();
  const resets = await page.evaluate(
    () => (window as unknown as { __ts: { resets: number } }).__ts.resets,
  );
  expect(resets).toBeGreaterThanOrEqual(2); // um após a tentativa, outro no "Repetir"
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
});

test('registo: honeypot invisível vai vazio e a ação é register', async ({ page }) => {
  await mockTurnstile(page);
  let body: Record<string, unknown> = {};
  let header: string | undefined;
  await page.route('**/api/v1/auth/register', (route) => {
    body = route.request().postDataJSON();
    header = route.request().headers()['x-turnstile-token'];
    return route.fulfill({
      status: 409,
      json: { code: 'email_taken', message: 'x', details: null },
    });
  });
  await page.goto('/pt/register');
  const trap = page.locator('input[name="website"]');
  await expect(trap).toHaveAttribute('tabindex', '-1');
  await expect(trap).toHaveAttribute('autocomplete', 'off');
  await expect(trap.locator('xpath=..')).toHaveAttribute('aria-hidden', 'true');
  await page.getByLabel('Email').fill('x@example.pt');
  await page.getByLabel('Password', { exact: true }).fill('uma-password-segura-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect.poll(() => header).toMatch(/^token-/);
  expect(body.website).toBe('');
});

test('/join: sem fricção, token já resolvido quando o formulário é preenchido', async ({
  page,
}) => {
  await mockTurnstile(page);
  let header: string | undefined;
  await page.route('**/api/v1/auth/quick-join/info*', (route) =>
    route.fulfill({ json: { enabled: true } }),
  );
  await page.route('**/api/v1/auth/quick-join', (route) => {
    header = route.request().headers()['x-turnstile-token'];
    return route.fulfill({
      status: 403,
      json: { code: 'invalid_event_code', message: 'x', details: null },
    });
  });
  await page.goto('/pt/join?c=abc');
  await page.getByRole('textbox', { name: 'Nome' }).fill('Ana Silva');
  await page.getByRole('textbox', { name: 'Email' }).fill('ana@example.pt');
  await page.getByRole('checkbox').click();
  // Sem desafio visível: nenhum elemento a pedir interação, o botão já está ativo.
  await expect(page.getByRole('button', { name: /^Entrar$/ }).first()).toBeEnabled();
  await page
    .getByRole('button', { name: /^Entrar$/ })
    .first()
    .click();
  await expect.poll(() => header).toMatch(/^token-/);
});

test('sem Turnstile (config desligada) nada aparece', async ({ page }) => {
  await page.goto('/pt/login?method=password');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  await expect(page.getByTestId('turnstile-field')).toHaveCount(0);
});
