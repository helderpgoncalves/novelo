import { expect, test } from '@playwright/test';
import {
  adminApi,
  createApprovedUser,
  deleteByEmail,
  findUser,
  lastEmail,
  login,
  PASSWORD,
  uniqueEmail,
} from './helpers';

// Registo → ecrã de espera → o administrador decide em /users → a pessoa entra (ou vê o motivo) sem recarregar.
const SHOTS = process.env.E2E_SHOTS;

async function registerViaUi(page: import('@playwright/test').Page, email: string, name: string) {
  await page.goto('/pt/register');
  await page.getByLabel('Nome').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/pt\/pending-approval/);
}

async function openPending(admin: import('@playwright/test').Page, email: string) {
  await admin.goto('/pt/users?tab=pending');
  // A barra de pesquisa só aparece quando a tabela é grande; com poucos pedidos a linha já está à vista.
  await admin.getByRole('heading', { name: 'Utilizadores', level: 1 }).waitFor();
  const search = admin.getByRole('searchbox', { name: /Pesquisar/ }).first();
  if (await search.isVisible()) await search.fill(email);
}

test.describe('aprovação de contas', () => {
  // Dois navegadores e a verificação automática (4 s a 30 s): mais folga que os 30 s por omissão.
  test.describe.configure({ timeout: 90_000 });
  test('espera, o admin aprova em /users e a pessoa entra sozinha com aviso por email', async ({
    browser,
    baseURL,
  }) => {
    const email = uniqueEmail('espera');
    const person = await (await browser.newContext({ baseURL, locale: 'pt-PT' })).newPage();
    await registerViaUi(person, email, 'Marta Espera');

    // O ecrã de espera: título, email, passos e verificação automática.
    await expect(person.getByRole('heading', { name: 'A aguardar aprovação' })).toBeVisible();
    await expect(person.getByText(email).first()).toBeVisible();
    await expect(person.getByTestId('approval-steps')).toContainText('Registo feito');
    await expect(person.getByTestId('approval-steps')).toContainText('Aprovação');
    await expect(person.getByTestId('approval-checking')).toBeVisible();
    await expect(person.getByRole('button', { name: 'Reenviar verificação' })).toBeVisible();
    // Sem navegação da app: é um ecrã próprio.
    await expect(person.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
    if (SHOTS) await person.screenshot({ path: `${SHOTS}/approval-waiting.png` });

    // Uma conta por aprovar não passa das guardas: voltar à app leva de novo ao ecrã de espera.
    await person.goto('/pt/circuits');
    await expect(person).toHaveURL(/\/pt\/pending-approval/, { timeout: 20_000 });

    // O admin vê o pedido, o badge e aprova como operador, avisando por email.
    const adminPage = await (await browser.newContext({ baseURL, locale: 'pt-PT' })).newPage();
    await login(adminPage);
    await openPending(adminPage, email);
    const row = adminPage.getByRole('row', { name: new RegExp(email) });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /^Aprovar/ }).click();
    const dialog = adminPage.getByRole('dialog');
    await expect(dialog.getByRole('radio', { name: /Operador/ })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: /Enviar um email/ })).toBeChecked();
    await dialog.getByRole('button', { name: 'Aprovar', exact: true }).click();
    await expect(adminPage.getByText('foi aprovada')).toBeVisible();

    // O email chega e a página da pessoa abre a app sozinha.
    const mail = await lastEmail(email);
    expect(mail.subject).toMatch(/aprovada/i);
    await expect(person.getByRole('heading', { name: /Aprovado! Bem-vindo/ })).toBeVisible({
      timeout: 25_000,
    });
    await expect(person).toHaveURL(/\/pt\/?$/, { timeout: 15_000 });
    await expect(person.locator('#content h1').first()).toBeVisible();

    await deleteByEmail(email);
  });

  test('rejeição mostra o motivo e o contacto, sem entrar na app', async ({ browser, baseURL }) => {
    const email = uniqueEmail('rejeitada');
    const person = await (await browser.newContext({ baseURL, locale: 'pt-PT' })).newPage();
    await registerViaUi(person, email, 'Rui Rejeitado');

    const adminPage = await (await browser.newContext({ baseURL, locale: 'pt-PT' })).newPage();
    await login(adminPage);
    await openPending(adminPage, email);
    await adminPage
      .getByRole('row', { name: new RegExp(email) })
      .getByRole('button', { name: /^Rejeitar/ })
      .click();
    const dialog = adminPage.getByRole('dialog');
    await dialog.getByLabel('Motivo (opcional)').fill('Não reconhecemos o teu contacto.');
    await dialog.getByRole('checkbox', { name: /email neutro/ }).check();
    await dialog.getByRole('button', { name: 'Rejeitar pedido' }).click();
    await expect(adminPage.getByText(/foi rejeitado|rejeitado$/).first()).toBeVisible();

    await expect(
      person.getByRole('heading', { name: 'O teu pedido não foi aprovado' }),
    ).toBeVisible({
      timeout: 25_000,
    });
    await expect(person.getByText('Não reconhecemos o teu contacto.')).toBeVisible();
    await expect(person.getByRole('link', { name: /Contactar a equipa/ })).toHaveAttribute(
      'href',
      /^mailto:/,
    );
    if (SHOTS) await person.screenshot({ path: `${SHOTS}/approval-rejected.png` });
    await person.goto('/pt/map');
    await expect(person).toHaveURL(/\/pt\/pending-approval/);

    // "Terminar sessão" sai e leva à entrada.
    await person.getByRole('button', { name: 'Terminar sessão' }).click();
    await expect(person).toHaveURL(/\/pt\/login/);

    await deleteByEmail(email);
  });

  test('o admin vê o pedido nas Pendentes e a conta fica à espera na lista', async ({ page }) => {
    const email = uniqueEmail('pendente');
    const api = await adminApi();
    // Cria o pedido pela API pública (sem aprovar).
    const { request } = await import('@playwright/test');
    const anon = await request.newContext({
      baseURL: process.env.E2E_API_URL ?? 'http://localhost:8190',
    });
    const res = await anon.post('/api/v1/auth/register', {
      data: { email, password: PASSWORD, name: 'Pedro Pendente', locale: 'pt-PT' },
      headers: { 'X-Turnstile-Token': 'XXXX.DUMMY.TOKEN.XXXX' },
    });
    expect(res.ok()).toBeTruthy();
    await anon.dispose();

    await login(page);
    await page.goto('/pt/users?tab=pending');
    await expect(page.getByRole('tab', { name: /Pendentes/ })).toBeVisible();
    await expect(page.getByTestId('pending-badge').first()).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(email) })).toBeVisible();

    expect((await findUser(api, email))?.approval_status).toBe('pending');
    await api.dispose();
    await deleteByEmail(email);
  });

  test('conta aprovada entra normalmente e uma conta já criada pelo helper está pronta', async ({
    page,
  }) => {
    const { email, password } = await createApprovedUser(uniqueEmail('pronta'));
    await login(page, { email, password });
    await expect(page).toHaveURL(/\/pt\/?$/);
    await deleteByEmail(email);
  });
});
