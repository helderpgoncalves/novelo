import { expect, test } from '@playwright/test';

// Os gestores de palavras-passe preenchem o DOM sem disparar eventos: o envio tem de os ver mesmo assim.
test('entrar com campos preenchidos automaticamente (sem eventos)', async ({ page }) => {
  await page.goto('/pt/login?method=password');
  const email = page.getByLabel('Email');
  await email.waitFor();
  await page.evaluate(() => {
    const set = (el: HTMLInputElement, v: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, v);
    };
    const form = document.querySelector('form') as HTMLFormElement;
    set(form.elements.namedItem('email') as HTMLInputElement, 'invalido@example.com');
    set(form.elements.namedItem('password') as HTMLInputElement, 'qualquer-coisa-12');
  });
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText('Indica o teu email')).toHaveCount(0);
  await expect(page.getByText('Indica a palavra-passe')).toHaveCount(0);
});

// Regressão: se a página voltar a desenhar o formulário depois do preenchimento e antes de o copiarmos (aqui, a resposta
// de `auth/registration` a chegar), um campo controlado repunha o valor vazio e o envio dizia «Indica o teu email».
test('o preenchimento automático sobrevive a um novo desenho do formulário', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/auth/registration', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/pt/login?method=password');
  await page.getByLabel('Email').waitFor();
  await page.waitForTimeout(600); // depois das sincronizações de 0, 150 e 500 ms ao abrir
  await page.evaluate(() => {
    const set = (el: HTMLInputElement, v: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, v);
    };
    const form = document.querySelector('form') as HTMLFormElement;
    set(form.elements.namedItem('email') as HTMLInputElement, 'invalido@example.com');
    set(form.elements.namedItem('password') as HTMLInputElement, 'qualquer-coisa-12');
  });
  const answered = page.waitForResponse('**/api/v1/auth/registration');
  release();
  await answered;
  await page.waitForTimeout(100); // o React volta a desenhar; o clique chega antes da sincronização dos 1200 ms
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText('Indica o teu email')).toHaveCount(0);
  await expect(page.getByText('Indica a palavra-passe')).toHaveCount(0);
});
