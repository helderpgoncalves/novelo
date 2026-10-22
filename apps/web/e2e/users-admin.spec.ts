import { expect, type Page, test } from '@playwright/test';
import {
  adminApi,
  createApprovedUser,
  deleteByEmail,
  findUser,
  lastEmail,
  linkFrom,
  login,
  PASSWORD,
  uniqueEmail,
} from './helpers';

// Administração de contas ponta a ponta: acesso, convites, eliminar com confirmação e impersonação.
const SHOTS = process.env.E2E_SHOTS;
const created: string[] = [];

// Muitos passos com a API e o Vite a sério: mais folga que os 30 s por omissão.
test.describe.configure({ timeout: 90_000 });

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate(
      (t) => document.documentElement.classList.toggle('dark', t === 'dark'),
      theme,
    );
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/${name}-${theme}.png` });
  }
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
}

async function searchAccount(page: Page, email: string) {
  await page.goto('/pt/users?tab=accounts');
  await page
    .getByRole('searchbox', { name: /Pesquisar por nome/ })
    .first()
    .fill(email);
  const row = page.getByRole('row', { name: new RegExp(email.replace(/[.+]/g, '\\$&')) });
  await expect(row).toBeVisible();
  return row;
}

async function rowAction(page: Page, email: string, action: string | RegExp) {
  const row = await searchAccount(page, email);
  await row.getByRole('button', { name: /^Ações de/ }).click();
  await page.getByRole('menuitem', { name: action }).click();
}

test.afterAll(async () => {
  for (const email of created) await deleteByEmail(email).catch(() => undefined);
});

test.describe('acesso', () => {
  test('operador e convidado não veem /users', async ({ page }) => {
    const email = uniqueEmail('operador');
    created.push(email);
    const operator = await createApprovedUser(email, { name: 'Olga Operadora' });
    await login(page, operator);
    await page.goto('/pt/users');
    await expect(
      page.getByRole('heading', { name: 'Não tens permissão para ver esta página' }),
    ).toBeVisible();
    await expect(page.getByTestId('pending-badge')).toHaveCount(0); // o badge é só para administradores
    await expect(page.getByRole('link', { name: /^Utilizadores/ })).toHaveCount(0);
  });

  test('o admin vê todas as secções e o badge de pendentes na navegação', async ({ page }) => {
    const email = uniqueEmail('aguarda');
    created.push(email);
    const anon = await (await import('@playwright/test')).request.newContext({
      baseURL: process.env.E2E_API_URL ?? 'http://localhost:8190',
    });
    const res = await anon.post('/api/v1/auth/register', {
      data: { email, password: PASSWORD, name: 'Ana Aguarda', locale: 'pt-PT' },
      headers: { 'X-Turnstile-Token': 'XXXX.DUMMY.TOKEN.XXXX' },
    });
    expect(res.ok()).toBeTruthy();
    await anon.dispose();

    await login(page);
    await page.goto('/pt/users');
    for (const name of ['Contas', 'Convites', 'Auditoria']) {
      await expect(page.getByRole('tab', { name: new RegExp(name) })).toBeVisible();
    }
    await expect(page.getByRole('tab')).toHaveCount(3);
    // Sem cartões de resumo: o conteúdo começa logo nos separadores. «Por aprovar» só aparece como estado nas linhas
    // da tabela (a conta acabada de criar está por aprovar), nunca num cartão por cima dela.
    const pendingText = page.getByText('Por aprovar', { exact: true }).filter({ visible: true });
    const inTable = page.getByRole('table').getByText('Por aprovar', { exact: true });
    await expect(inTable.first()).toBeVisible();
    expect(await pendingText.count()).toBe(await inTable.filter({ visible: true }).count());
    // O separador ativo vive no URL.
    await page.getByRole('tab', { name: /Auditoria/ }).click();
    await expect(page).toHaveURL(/tab=audit/);
    await expect(page.getByLabel('Ação', { exact: true })).toBeVisible();
    await expect(page.getByTestId('pending-badge').first()).toBeVisible();
    await shot(page, 'users-audit');
  });

  test('cada conta mostra avatar com iniciais e o nome ao lado', async ({ page }) => {
    const email = uniqueEmail('avatar');
    created.push(email);
    await createApprovedUser(email, { name: 'Bruno Avatar' });
    await login(page);
    const row = await searchAccount(page, email);
    await expect(row.getByText('Bruno Avatar')).toBeVisible();
    await expect(row.getByText('BA', { exact: true })).toBeVisible();
    await expect(row.getByText(email)).toBeVisible();
  });

  test('os emails são uma vista da Auditoria (não um quarto separador)', async ({ page }) => {
    await login(page);
    // O endereço antigo `tab=emails` abre a vista certa.
    await page.goto('/pt/users?tab=emails');
    await expect(page).toHaveURL(/tab=audit/);
    await expect(page).toHaveURL(/view=emails/);
    await expect(page.getByRole('tab')).toHaveCount(3);
    const panel = page.getByTestId('emails-panel');
    await expect(panel).toBeVisible();
    // O que sabemos de cada envio, dito em linguagem simples, e a saúde do DNS.
    await expect(panel.getByTestId('email-tracking')).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Saúde do DNS do remetente' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Endereços bloqueados' })).toBeVisible();

    // Email de teste: mostra o estado a evoluir.
    await panel.getByRole('button', { name: 'Enviar email de teste' }).click();
    await expect(panel.getByTestId('email-test-result')).toBeVisible({ timeout: 15_000 });

    // A tabela de envios tem filtros no servidor e o teste aparece lá.
    await panel.getByLabel('Estado', { exact: true }).click();
    await page.getByRole('option', { name: 'Todos os estados' }).click();
    await expect(
      panel.getByRole('row').filter({ hasText: 'Email de teste' }).first(),
    ).toBeVisible();

    // Voltar às ações da auditoria.
    await page.getByRole('button', { name: 'Ações', exact: true }).click();
    await expect(page.getByLabel('Ação', { exact: true })).toBeVisible();
  });

  test('«Ver emails deste convite» abre a vista de emails já pesquisada', async ({ page }) => {
    const invited = uniqueEmail('ver-emails');
    created.push(invited);
    const api = await adminApi();
    const res = await api.post('/api/v1/users/invitations', {
      data: { email: invited, role: 'operator', locale: 'pt-PT' },
    });
    expect(res.ok()).toBeTruthy();
    await api.dispose();
    await login(page);
    // O convite está no separador Convites (ainda não é uma conta): procura-o lá.
    await page.goto('/pt/users?tab=invitations');
    await page
      .getByRole('searchbox', { name: /Pesquisar por nome/ })
      .first()
      .fill(invited);
    const row = page.getByRole('row', { name: new RegExp(invited.replace(/[.+]/g, '\\$&')) });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /^Ações de/ }).click();
    await page.getByRole('menuitem', { name: /^Ver emails deste convite/ }).click();
    await expect(page).toHaveURL(/view=emails/);
    await expect(page).toHaveURL(/q=/);
    await expect(page.getByRole('searchbox', { name: 'Email do destinatário' })).toHaveValue(
      invited,
    );
  });
});

test.describe('convites', () => {
  test('convidar por email, aceitar o convite e entrar logo', async ({ browser, baseURL }) => {
    test.setTimeout(90_000);
    const invited = uniqueEmail('convidada');
    created.push(invited);
    const adminPage = await (await browser.newContext({ baseURL, locale: 'pt-PT' })).newPage();
    await login(adminPage);
    await adminPage.goto('/pt/users?tab=invitations');
    await adminPage.getByRole('button', { name: 'Convidar' }).first().click();
    const dialog = adminPage.getByRole('dialog');
    await dialog.getByLabel('Email').fill(invited);
    await dialog.getByLabel('Nome (opcional)').fill('Clara Convidada');
    await dialog.getByLabel('Mensagem (opcional)').fill('Bem-vinda à equipa do piloto.');
    // Administrador exige confirmação explícita.
    await dialog.getByRole('radio', { name: /Administrador/ }).click();
    await expect(dialog.getByRole('button', { name: 'Enviar convite' })).toBeDisabled();
    await dialog.getByRole('radio', { name: /Operador/ }).click();
    await shot(adminPage, 'invite-dialog');
    await dialog.getByRole('button', { name: 'Enviar convite' }).click();
    // O diálogo mostra o estado REAL do envio (não um «enviado» otimista) e só fecha em «Concluir».
    await expect(dialog.getByText(`Convite enviado a ${invited}`)).toBeVisible();
    await expect(dialog.getByTestId('invite-result').getByTestId('delivery-badge')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Copiar link' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Concluir' }).click();
    const row = adminPage.getByRole('row', { name: new RegExp(invited.replace(/\./g, '\\.')) });
    await expect(row).toContainText('Pendente');
    // Entrega com ícone e texto (nunca só a cor): o email saiu, por isso não há aviso de convites sem email.
    await expect(row.getByTestId('delivery-badge')).not.toHaveAttribute('data-status', 'failed');
    await expect(adminPage.getByText(/Convites cujo email não saiu/)).toHaveCount(0);

    // A pessoa abre o link do email numa sessão limpa.
    const mail = await lastEmail(invited);
    expect(mail.subject).toContain('convidou-te');
    const link = linkFrom(mail.text);
    const guest = await (await browser.newContext({ baseURL, locale: 'pt-PT' })).newPage();
    await guest.goto(link);
    await expect(guest.getByRole('heading', { name: 'Bem-vindo ao Novelo' })).toBeVisible();
    await expect(guest.getByText(/convidou-te para o Novelo como Operador/)).toBeVisible();
    await expect(guest.getByText(invited)).toBeVisible();
    await expect(guest.getByText('Bem-vinda à equipa do piloto.')).toBeVisible();
    await expect(guest.getByLabel('O teu nome')).toHaveValue('Clara Convidada');
    // O token sai do URL assim que é lido.
    await expect(guest).not.toHaveURL(/token=/);
    await shot(guest, 'accept-invite');

    await guest.getByRole('button', { name: 'Entrar sem palavra-passe' }).click();
    await expect(guest).toHaveURL(/\/pt\/?$/, { timeout: 15_000 });
    await expect(guest.locator('#content h1').first()).toBeVisible();

    // O link só serve uma vez.
    await guest.context().clearCookies();
    await guest.goto(link);
    await expect(
      guest.getByRole('heading', { name: 'Este convite já não é válido' }),
    ).toBeVisible();

    // O admin vê o convite como aceite e a conta nova com a origem "Convite".
    await adminPage.goto('/pt/users?tab=invitations');
    await expect(
      adminPage.getByRole('row', { name: new RegExp(invited.replace(/\./g, '\\.')) }),
    ).toContainText('Aceite');
    const api = await adminApi();
    const user = await findUser(api, invited);
    expect(user?.approval_status).toBe('approved');
    await api.dispose();
  });

  test('convite inválido tem saída amável', async ({ page }) => {
    await page.goto('/pt/accept-invite?token=isto-nao-e-um-convite-valido-1234567890');
    await expect(page.getByRole('heading', { name: 'Este convite já não é válido' })).toBeVisible();
    // Saída neutra: pedir novo convite leva à entrada por email, onde reenviamos o convite.
    await page.getByRole('link', { name: 'Pedir novo convite' }).click();
    await expect(page).toHaveURL(/\/pt\/login\?.*reason=invite/);
    await expect(page.getByText(/reenviamos-to/)).toBeVisible();
    await page.goto('/pt/accept-invite');
    await expect(page.getByRole('heading', { name: 'Este convite já não é válido' })).toBeVisible();
  });

  test('convidar um email que já tem conta mostra o erro no campo', async ({ page }) => {
    await login(page);
    await page.goto('/pt/users?tab=invitations');
    await page.getByRole('button', { name: 'Convidar' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Email').fill('admin@heldergoncalves.io');
    await dialog.getByRole('button', { name: 'Enviar convite' }).click();
    await expect(dialog.getByText('Já existe uma conta com este email.')).toBeVisible();
  });
});

test.describe('eliminar', () => {
  test('pede o email para confirmar e só então elimina', async ({ page }) => {
    const email = uniqueEmail('apagar');
    await createApprovedUser(email, { name: 'Dália Descartável' });
    await login(page);
    await rowAction(page, email, /^Eliminar/);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Eliminar Dália Descartável/ })).toBeVisible();
    await expect(dialog.getByText('O que é apagado')).toBeVisible();
    await expect(dialog.getByText(/anonimizado|sem ligação à pessoa/)).toBeVisible();
    const submit = dialog.getByRole('button', { name: 'Eliminar para sempre' });
    await expect(submit).toBeDisabled();
    const input = dialog.getByLabel(/Para confirmar, escreve o email/);
    await input.fill('outra.pessoa@example.pt');
    await expect(submit).toBeDisabled();
    await input.fill(email);
    await expect(submit).toBeEnabled();
    await shot(page, 'delete-dialog');
    await submit.click();
    await expect(page.getByText('Conta eliminada').first()).toBeVisible();
    const api = await adminApi();
    expect(await findUser(api, email)).toBeUndefined();
    await api.dispose();
  });

  test('não deixa eliminar a própria conta e explica porquê', async ({ page }) => {
    await login(page);
    await rowAction(page, 'admin@heldergoncalves.io', /^Eliminar/);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Não é possível eliminar esta conta')).toBeVisible();
    await expect(dialog.getByText('Não podes fazer isto à tua própria conta.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Eliminar para sempre' })).toHaveCount(0);
  });

  test('dar o perfil de administrador exige confirmação reforçada', async ({ page }) => {
    const email = uniqueEmail('promover');
    created.push(email);
    await createApprovedUser(email, { name: 'Paula Promovida' });
    await login(page);
    await rowAction(page, email, /^Mudar perfil/);
    const dialog = page.getByRole('dialog');
    const save = dialog.getByRole('button', { name: 'Guardar perfil' });
    await expect(save).toBeDisabled();
    await dialog.getByRole('radio', { name: /Administrador/ }).click();
    await expect(save).toBeDisabled();
    await dialog.getByRole('checkbox', { name: /acesso total/ }).check();
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText('Conta atualizada')).toBeVisible();
    const api = await adminApi();
    expect((await findUser(api, email))?.role).toBe('admin');
    await api.dispose();
  });
});

test.describe('impersonação', () => {
  test.describe.configure({ mode: 'serial' });
  const victim = uniqueEmail('vista');

  test.beforeAll(async () => {
    created.push(victim);
    await createApprovedUser(victim, { name: 'Vera Vista' });
  });

  test('motivo obrigatório, faixa global, bloqueios e sair', async ({ page }) => {
    await login(page);
    await rowAction(page, victim, /^Ver como/);
    const dialog = page.getByRole('dialog');
    const start = dialog.getByRole('button', { name: /Começar a ver como/ });
    await expect(dialog.getByText('Fica bloqueado enquanto vês como outra pessoa')).toBeVisible();
    await expect(dialog.getByText(/fica registado na auditoria/)).toBeVisible();
    await expect(start).toBeDisabled();
    await dialog.getByLabel('Motivo (obrigatório)').fill('curto');
    await expect(start).toBeDisabled();
    await dialog
      .getByLabel('Motivo (obrigatório)')
      .fill('Perceber o problema reportado no simulador');
    await expect(start).toBeEnabled();
    await shot(page, 'impersonate-dialog');
    await start.click();

    // Faixa visível, com o nome e a contagem decrescente.
    const banner = page.getByTestId('impersonation-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('A ver como Vera Vista');
    await expect(page.getByTestId('impersonation-countdown')).toContainText(/expira em \d\d:\d\d/);
    await expect(page).toHaveURL(/\/pt\/?$/);
    await shot(page, 'impersonation-banner');

    // Vê a app como a Vera: sem administração.
    await page.goto('/pt/users');
    await expect(
      page.getByRole('heading', { name: 'Não tens permissão para ver esta página' }),
    ).toBeVisible();
    await expect(page.getByTestId('impersonation-banner')).toBeVisible(); // visível em todas as páginas

    // O que a API bloqueia aparece desativado, com explicação.
    await page.goto('/pt/account');
    await expect(page.getByText(/Estás a ver como outra pessoa/)).toBeVisible();
    await expect(page.getByLabel('Nome', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Guardar perfil' })).toBeDisabled();
    // O menu da conta diz que é uma sessão de impersonação e oferece sair em vez de terminar sessão.
    await page.getByRole('button', { name: 'Menu da conta' }).click();
    await expect(page.getByText('Sessão de impersonação').first()).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Terminar sessão' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Sair: volta à administração, sem faixa e sem erros.
    await banner.getByRole('button', { name: 'Sair da impersonação' }).click();
    await expect(page).toHaveURL(/\/pt\/users/);
    await expect(page.getByRole('heading', { name: 'Utilizadores', level: 1 })).toBeVisible();
    await expect(page.getByTestId('impersonation-banner')).toHaveCount(0);

    // Auditoria: início e fim ficaram registados.
    const api = await adminApi();
    const audit = (await (await api.get('/api/v1/users/audit?action=impersonation.')).json()) as {
      items: { action: string }[];
    };
    const actions = audit.items.map((i) => i.action);
    expect(actions).toContain('impersonation.start');
    expect(actions).toContain('impersonation.stop');
    await api.dispose();
  });

  test('ao expirar volta ao administrador sem ecrã de erro', async ({ page }) => {
    await login(page);
    const api = await adminApi();
    const user = await findUser(api, victim);
    await api.dispose();
    expect(user).toBeTruthy();
    // Começa a impersonação pela API e encurta o prazo visto pelo browser (o servidor continua com o seu).
    const api2 = await adminApi();
    const res = await api2.post(`/api/v1/users/${user?.id}/impersonate`, {
      data: { reason: 'Testar a expiração da sessão' },
    });
    expect(res.ok()).toBeTruthy();
    const cookies = (await api2.storageState()).cookies;
    await page
      .context()
      .addCookies(
        cookies
          .filter((c) => c.name === 'access_token')
          .map((c) => ({ ...c, domain: 'localhost', path: '/' })),
      );
    await api2.dispose();
    await page.route('**/api/v1/auth/me', async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      if (json.impersonation?.active)
        json.impersonation.expires_at = new Date(Date.now() + 4000).toISOString();
      await route.fulfill({ response, json });
    });
    await page.goto('/pt/');
    await expect(page.getByTestId('impersonation-banner')).toBeVisible();
    await expect(page).toHaveURL(/\/pt\/users/, { timeout: 20_000 });
    await expect(page.getByTestId('impersonation-banner')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Utilizadores', level: 1 })).toBeVisible();
    await expect(page.getByText('A sessão de impersonação terminou')).toBeVisible();
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('não se pode ver como administrador nem como a própria conta', async ({ page }) => {
    await login(page);
    await rowAction(page, 'admin@heldergoncalves.io', /^Ver como/);
    await expect(
      page
        .getByRole('dialog')
        .getByText('Não se pode ver como um administrador.')
        .or(page.getByRole('dialog').getByText('Não podes fazer isto à tua própria conta.')),
    ).toBeVisible();
    await expect(
      page.getByRole('dialog').getByRole('button', { name: /Começar a ver como/ }),
    ).toHaveCount(0);
  });
});
