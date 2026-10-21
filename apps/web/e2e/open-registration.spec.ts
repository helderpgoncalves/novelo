import { expect, type Page, test } from '@playwright/test';
import { adminApi, deleteByEmail, login, PASSWORD, uniqueEmail } from './helpers';

// Registo aberto: o administrador liga-o em /users, uma pessoa nova regista-se e entra logo (com a apresentação),
// e ao desligar volta a aprovação. A definição é global: o teste deixa-a sempre desligada no fim.
const SHOTS = process.env.E2E_SHOTS;

async function setOpen(open: boolean) {
  const api = await adminApi();
  try {
    const res = await api.patch('/api/v1/admin/settings', { data: { open_registration: open } });
    expect(res.ok(), 'mudar o registo aberto pela API').toBeTruthy();
  } finally {
    await api.dispose();
  }
}

const card = (page: Page) => page.getByTestId('open-registration');
const toggle = (page: Page) => card(page).getByRole('switch', { name: 'Registo aberto' });

test.describe('registo aberto', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 });
  test.afterAll(async () => setOpen(false));

  test('ligar em /users, registar uma conta nova que entra logo, desligar', async ({
    page,
    browser,
    baseURL,
  }) => {
    await setOpen(false);
    await login(page);
    await page.goto('/pt/users');
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('Quem se registar ou entrar com Google entra logo');
    await expect(toggle(page)).not.toBeChecked();

    // Ligar pede confirmação.
    await toggle(page).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('Abrir o registo?');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-open-registration-confirm.png` });
    await confirm.getByRole('button', { name: 'Abrir o registo' }).click();
    await expect(page.getByText('Registo aberto: as contas novas entram logo.')).toBeVisible();
    await expect(toggle(page)).toBeChecked();
    await expect(card(page)).toContainText(/Alterado a .+/);

    // Uma pessoa nova regista-se e entra logo, sem ecrã de espera, com a apresentação.
    const email = uniqueEmail('aberto');
    const context = await browser.newContext({ baseURL, locale: 'pt-PT' });
    const person = await context.newPage();
    try {
      await person.goto('/pt/register');
      await expect(person.getByTestId('register-open-notice')).toContainText(
        'Entras logo, sem esperar aprovação.',
      );
      await expect(person.getByTestId('register-approval-notice')).toHaveCount(0);
      if (SHOTS) await person.screenshot({ path: `${SHOTS}/e2e-register-open.png` });
      await person.getByLabel('Nome (opcional)').fill('Júri Aberto');
      await person.getByLabel('Email').fill(email);
      await person.getByLabel('Palavra-passe', { exact: true }).fill(PASSWORD);
      await person.getByRole('button', { name: 'Criar conta' }).click();
      await expect(person).toHaveURL(/\/pt\/?(#.*)?$/);
      await expect(person.getByTestId('onboarding-story')).toBeVisible();
      await person.keyboard.press('Escape');
      await expect(person.getByTestId('onboarding-story')).toHaveCount(0);
    } finally {
      await context.close();
      await deleteByEmail(email);
    }

    // Desligar é imediato e volta a aprovação.
    await toggle(page).click();
    await expect(
      page.getByText('Registo fechado: as contas novas voltam a esperar aprovação.'),
    ).toBeVisible();
    await expect(toggle(page)).not.toBeChecked();

    const anon = await browser.newContext({ baseURL, locale: 'pt-PT' });
    const visitor = await anon.newPage();
    await visitor.goto('/pt/register');
    await expect(visitor.getByTestId('register-approval-notice')).toBeVisible();
    await expect(visitor.getByTestId('register-open-notice')).toHaveCount(0);
    await anon.close();
  });
});
