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
  await expect(page.getByText('Indica o email')).toHaveCount(0);
  await expect(page.getByText('Indica a palavra-passe')).toHaveCount(0);
});
