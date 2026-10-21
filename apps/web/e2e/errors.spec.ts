import { mkdirSync } from 'node:fs';
import { expect, type Page, request, test } from '@playwright/test';
import { ADMIN, approveByEmail, login, PASSWORD, uniqueEmail } from './helpers';

// Ecrãs de erro de ponta a ponta: 404, 403, rede, API a reiniciar, versão nova, erro de rota, sessão e formulários.
// Com E2E_SHOTS=<pasta> também grava capturas (claro/escuro) para revisão visual.

const API = process.env.E2E_API_URL ?? 'http://localhost:8190';
const SHOTS = process.env.E2E_SHOTS;
const FLEET_API = '**/api/v1/network/fleet*';
const operator = { email: uniqueEmail('erros'), password: PASSWORD };

test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: API });
  const res = await api.post('/api/v1/auth/register', {
    data: {
      email: operator.email,
      password: operator.password,
      name: 'Teste Erros',
      locale: 'pt-PT',
    },
  });
  expect(res.ok()).toBeTruthy();
  await api.dispose();
  await approveByEmail(operator.email); // contas novas esperam por aprovação
});

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const width = page.viewportSize()?.width ?? 0;
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate(
      (t) => document.documentElement.classList.toggle('dark', t === 'dark'),
      theme,
    );
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}-${theme}.png` });
  }
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
}

const goToFleet = (page: Page) =>
  page.getByRole('link', { name: 'Frota e turnos' }).first().click();
const heading = (page: Page, name: string | RegExp) =>
  page.getByRole('heading', { level: 1, name });

test.describe('404', () => {
  test('dentro da app, com menu, pesquisa e atalhos', async ({ page }) => {
    await login(page);
    await page.goto('/pt/cenario-que-nao-existe');
    await expect(heading(page, 'Esta página não existe')).toBeVisible();
    await expect(heading(page, 'Esta página não existe')).toBeFocused();
    // O menu mantém-se.
    await expect(page.getByRole('link', { name: 'Mapa', exact: true }).first()).toBeVisible();
    await expect(page.getByText('/cenario-que-nao-existe')).toBeVisible();
    await shot(page, '404');

    const search = page.getByRole('searchbox', { name: 'Procurar uma secção' });
    await search.fill('mapa');
    await expect(
      page.locator('search').getByRole('link', { name: 'Mapa', exact: true }),
    ).toBeVisible();
    await search.press('Enter');
    await expect(page).toHaveURL(/\/pt\/map/);
  });

  test('sugere a secção parecida com o endereço', async ({ page }) => {
    await login(page);
    await page.goto('/pt/scenario');
    await expect(page.locator('search').getByRole('link', { name: /cenários/i })).toBeVisible();
  });
});

test.describe('403', () => {
  test('conta sem o papel mostra o papel necessário e como pedir acesso, sem mudar o URL', async ({
    page,
  }) => {
    await login(page, operator);
    await page.goto('/pt/users');
    await expect(heading(page, 'Não tens permissão para ver esta página')).toBeVisible();
    // O caminho mantém-se; o router só acrescenta o separador por omissão (`?tab=accounts`).
    await expect(page).toHaveURL(/\/pt\/users(\?tab=accounts)?$/);
    await expect(page.getByText(/só para administradores/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pedir acesso' })).toHaveAttribute(
      'href',
      /^mailto:.+subject=.+users/,
    );
    await shot(page, '403');
  });
});

test.describe('rede e API', () => {
  test('sem rede: ecrã dedicado, mantém o menu e retoma sozinho quando a rede volta', async ({
    page,
    context,
  }) => {
    await login(page);
    // Aquece o ficheiro da rota (na app instalada o service worker já o tem em cache) sem guardar dados.
    await page.route(FLEET_API, (route) => route.fulfill({ status: 500, body: '{}' }));
    await goToFleet(page);
    await expect(heading(page, 'Não conseguimos mostrar esta página')).toBeVisible();
    await page.unroute(FLEET_API);
    await page.getByRole('link', { name: 'Pressupostos' }).first().click();
    await expect(heading(page, /Pressupostos/)).toBeVisible();
    await context.setOffline(true);
    await goToFleet(page);
    await expect(heading(page, 'Estás sem ligação à internet')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mapa', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await shot(page, 'offline');

    await context.setOffline(false);
    await expect(heading(page, 'Frota e turnos')).toBeVisible({ timeout: 15_000 });
  });

  test('API a reiniciar (503 do proxy): "a atualizar", tentar agora e retoma sem recarregar', async ({
    page,
  }) => {
    await login(page);
    await page.evaluate(() => {
      (window as unknown as { __alive: boolean }).__alive = true;
    });
    await page.route(FLEET_API, (route) =>
      route.fulfill({
        status: 503,
        contentType: 'text/html',
        body: '<html>Service Unavailable</html>',
      }),
    );
    await goToFleet(page);
    await expect(heading(page, 'Estamos a atualizar o Novelo. Volta já.')).toBeVisible();
    await expect(page.getByText(/Nova tentativa em \d+ s/)).toBeVisible();
    await shot(page, 'maintenance');

    await page.unroute(FLEET_API);
    await page.getByRole('button', { name: 'Tentar agora' }).click();
    await expect(heading(page, 'Frota e turnos')).toBeVisible({ timeout: 15_000 });
    expect(await page.evaluate(() => (window as unknown as { __alive?: boolean }).__alive)).toBe(
      true,
    );
  });

  test('erro 500 da rota: referência do pedido copiável, reportar e tentar de novo sem recarregar', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await login(page);
    await page.evaluate(() => {
      (window as unknown as { __alive: boolean }).__alive = true;
    });
    await page.route(FLEET_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: { 'x-request-id': 'req-e2e-1234' },
        body: JSON.stringify({ code: 'internal_error', message: 'boom' }),
      }),
    );
    await goToFleet(page);
    await expect(heading(page, 'Não conseguimos mostrar esta página')).toBeVisible();
    await expect(page.getByText('req-e2e-1234')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reportar por email' })).toHaveAttribute(
      'href',
      /req-e2e-1234/,
    );
    await page.getByRole('button', { name: 'Copiar referência' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('req-e2e-1234');
    await shot(page, 'server-error');

    await page.unroute(FLEET_API);
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(heading(page, 'Frota e turnos')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __alive?: boolean }).__alive)).toBe(
      true,
    );
  });

  test('ficheiro de uma versão antiga (deploy novo): "Há uma nova versão" e recarregar', async ({
    page,
  }) => {
    await page.route(/fleet\.tsx\?.*tsr-split/, (route) => route.abort());
    await login(page);
    await goToFleet(page);
    await expect(heading(page, 'Há uma nova versão do Novelo')).toBeVisible();
    await shot(page, 'new-version');
    await page.unroute(/fleet\.tsx\?.*tsr-split/);
    await page.getByRole('button', { name: 'Recarregar' }).click();
    await expect(heading(page, 'Frota e turnos')).toBeVisible();
  });
});

test.describe('sessão', () => {
  test('sessão expirada: volta ao login com mensagem clara e regressa ao sítio onde estavas', async ({
    page,
  }) => {
    await login(page);
    await page.route(FLEET_API, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'session_expired', message: 'expired' }),
      }),
    );
    // Sem sessão a sério: o `me` também recusa, senão o login reencaminhava para o início.
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'unauthenticated', message: 'no session' }),
      }),
    );
    await page.route('**/api/v1/auth/refresh', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'session_expired', message: 'expired' }),
      }),
    );
    await goToFleet(page);
    await expect(page).toHaveURL(
      /\/pt\/login\?.*next=%2Ffleet.*reason=expired|reason=expired.*next=%2Ffleet/,
    );
    await expect(page.getByText('A tua sessão terminou.')).toBeVisible();
    await shot(page, 'session');

    // O login por defeito é o link por email; a password está um clique à frente e mantém o `next`.
    // Clica-se com a sessão ainda recusada, senão o guarda do login reencaminhava para a app.
    await page.getByRole('link', { name: 'Entrar com palavra-passe' }).click();
    await expect(page).toHaveURL(/method=password/);
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
    await expect(page.getByLabel('Email')).toHaveValue(ADMIN.email);
    // Só agora a sessão volta a existir (senão o guarda do login reencaminhava antes de escrever).
    await page.unroute(FLEET_API);
    await page.unroute('**/api/v1/auth/refresh');
    await page.unroute('**/api/v1/auth/me');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/pt\/fleet/);
  });
});

test.describe('formulários', () => {
  test('submeter vazio põe o foco no primeiro campo inválido', async ({ page }) => {
    await page.goto('/pt/register');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByLabel('Email')).toBeFocused();
  });

  test('erro do servidor num campo (email já usado) fica no campo, com foco, sem aviso geral', async ({
    page,
  }) => {
    await page.goto('/pt/register');
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByText('Já existe uma conta com este email.')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeFocused();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

test.describe('copiloto: erro na conversa', () => {
  const sse = (events: object[]) => events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  const stub = async (page: Page, events: object[]) =>
    page.route('**/api/v1/copilot/stream', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: sse(events),
      }),
    );
  const ask = async (page: Page) => {
    const box = page.getByRole('combobox', { name: 'Pergunta ao copiloto' });
    await box.fill('Olá');
    await box.press('Enter');
  };
  const start = { type: 'start', thread_id: 'th-1', message_id: 'm-1', model: 'x' };

  test('orçamento esgotado: explica e não oferece regenerar', async ({ page }) => {
    await login(page, operator);
    await page.goto('/pt/chat');
    await stub(page, [
      start,
      { type: 'error', code: 'ai_budget_exceeded', message: 'x' },
      { type: 'done', finish: 'error' },
    ]);
    await ask(page);
    const error = page.getByTestId('copilot-error');
    await expect(error).toContainText('O orçamento de IA deste mês acabou');
    await expect(error.getByRole('button')).toHaveCount(0);
  });

  test('stream cortado a meio: mensagem recuperável com Gerar de novo', async ({ page }) => {
    await login(page, operator);
    await page.goto('/pt/chat');
    await stub(page, [start, { type: 'text_delta', delta: 'Uma resposta que fica a me' }]);
    await ask(page);
    const error = page.getByTestId('copilot-error');
    await expect(error).toContainText('A resposta ficou a meio');
    await expect(error).toContainText('O texto acima está incompleto');
    await expect(error.getByRole('button', { name: 'Gerar de novo' })).toBeVisible();
    await shot(page, 'copilot-error');
  });
});
