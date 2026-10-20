import { expect, test } from '@playwright/test';
import {
  ADMIN,
  approveByEmail,
  createApprovedUser,
  lastEmail,
  linkFrom,
  login,
  PASSWORD,
  uniqueEmail,
} from './helpers';

test.describe('autenticação', () => {
  test('sem sessão redireciona para a entrada, guardando o destino', async ({ page }) => {
    await page.goto('/pt/circuits');
    await expect(page).toHaveURL(/\/pt\/login\?next=/);
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  });

  test('credenciais erradas mostram o erro traduzido', async ({ page }) => {
    await page.goto('/pt/login?method=password');
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password', { exact: true }).fill('password-errada-1');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toContainText('Email ou password incorretos.');
  });

  test('validação dos campos acontece no cliente, em português', async ({ page }) => {
    await page.goto('/pt/login?method=password');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Indica o teu email')).toBeVisible();
    await expect(page.getByText('Indica a password')).toBeVisible();
  });

  test('entrar, ver a app e terminar sessão', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { level: 1, name: /Guimarães recolhe/ })).toBeVisible();
    await page.getByRole('button', { name: 'Menu da conta' }).click();
    await page.getByRole('menuitem', { name: 'Terminar sessão' }).click();
    await expect(page).toHaveURL(/\/pt\/login/);
    await page.goto('/pt/');
    await expect(page).toHaveURL(/\/pt\/login/);
  });

  test('registo leva ao ecrã de espera; confirmar o email e ser aprovada abre a app', async ({
    page,
  }) => {
    const email = uniqueEmail('novo');
    await page.goto('/pt/register');
    await expect(page.getByTestId('register-approval-notice')).toContainText(
      'aprovadas por um administrador',
    );
    await page.getByLabel('Nome').fill('Rita Silva');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/pt\/pending-approval/);
    await expect(page.getByRole('heading', { name: 'A aguardar aprovação' })).toBeVisible();
    await expect(page.getByText('Confirma o teu email', { exact: true })).toBeVisible();

    const mail = await lastEmail(email);
    expect(mail.subject).toMatch(/Confirma o teu email/);
    await page.goto(linkFrom(mail.text));
    await expect(page.getByRole('heading', { name: 'Email confirmado' })).toBeVisible();
    await expect(page.getByText('Falta só um administrador aprovar')).toBeVisible();
    await page.getByRole('link', { name: 'Ver o estado do pedido' }).click();
    await expect(page.getByRole('heading', { name: 'A aguardar aprovação' })).toBeVisible();
    await expect(page.getByText('Confirma o teu email', { exact: true })).toHaveCount(0);

    await approveByEmail(email);
    await page.getByRole('button', { name: 'Verificar agora' }).click();
    await expect(page).toHaveURL(/\/pt\/?$/, { timeout: 15_000 });
    await expect(page.locator('#content h1').first()).toBeVisible();
  });

  test('registo recusa email repetido com mensagem clara', async ({ page }) => {
    await page.goto('/pt/register');
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByText('Já existe uma conta com este email.')).toBeVisible();
  });

  test('recuperar password de ponta a ponta', async ({ page }) => {
    const email = uniqueEmail('reset');
    await createApprovedUser(email);
    await page.goto('/pt/login');
    await page.getByRole('link', { name: 'Entrar com palavra-passe' }).click();
    await page.getByRole('link', { name: 'Esqueceste-te?' }).click();
    await page.getByLabel('Email da conta').fill(email);
    await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
    await expect(page.getByText('Verifica o teu email')).toBeVisible();

    const mail = await lastEmail(email);
    expect(mail.subject).toMatch(/Redefine a tua password/);
    await page.goto(linkFrom(mail.text));
    await page.getByLabel('Nova password').fill('outra-password-segura-9');
    await page.getByLabel('Repete a password').fill('outra-password-segura-9');
    await page.getByRole('button', { name: 'Redefinir password' }).click();
    await expect(page).toHaveURL(/\/pt\/login/);

    await login(page, { email, password: 'outra-password-segura-9' });
  });

  test('link de recuperação inválido mostra erro e permite pedir outro', async ({ page }) => {
    await page.goto('/pt/reset-password?token=token-invalido-token-invalido-1234');
    await page.getByLabel('Nova password').fill(PASSWORD);
    await page.getByLabel('Repete a password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Redefinir password' }).click();
    await expect(page.getByRole('alert')).toContainText('O link é inválido ou expirou');
    await expect(page.getByRole('link', { name: 'Pedir um novo link' })).toBeVisible();
  });
});
