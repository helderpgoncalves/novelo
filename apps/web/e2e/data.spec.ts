import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('dados reais da Vitrus', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('ponto de partida mostra os números reais', async ({ page }) => {
    const strip = page.locator('dl').first();
    await expect(strip).toContainText('301,3 t');
    await expect(strip).toContainText('22,9%');
    await expect(strip).toContainText('0,16 kg');
    await expect(page.getByRole('img', { name: /Fluxo de têxtil/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Ultriplo/ })).toContainText('134,1 t');
    await expect(page.getByRole('row', { name: /Nova Etapa/ })).toContainText('estimativa');
  });

  test('circuitos: pesquisa, filtro, ordenação, colunas e paginação', async ({ page }) => {
    await page.goto('/pt/circuits');
    const table = page.getByRole('table');
    await expect(page.getByText('1–25 de 40')).toBeVisible();
    await expect(page.getByText('Página 1 de 2')).toBeVisible();
    await page.getByRole('button', { name: 'Página seguinte' }).click();
    await expect(page.getByText('26–40 de 40')).toBeVisible();

    await page.getByLabel('Pesquisar circuito ou localidade').fill('Ronfe');
    await expect(table.getByRole('row', { name: /C18/ })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar tudo' }).click();

    await page.getByRole('button', { name: /^Filtros/ }).click();
    await page.getByRole('button', { name: 'Tipologia', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('checkbox', { name: /Orgânicos/ })
      .click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('1–7 de 7 · filtrado de 40')).toBeVisible();

    await page.getByRole('button', { name: 'Ordenar por Circuito' }).click();
    await expect(table.getByRole('columnheader', { name: /Circuito/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await page.getByRole('button', { name: 'Colunas' }).click();
    await page.getByRole('checkbox', { name: 'Viaturas' }).click();
    await page.keyboard.press('Escape');
    await expect(table.getByRole('columnheader', { name: /Viaturas/ })).toHaveCount(0);
  });

  test('frota: calendário da semana tipo, visão geral e viaturas sem circuito', async ({
    page,
  }) => {
    await page.goto('/pt/fleet');
    await expect(page.getByRole('tab', { name: /^Calendário/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('table', { name: /Semana tipo: dias em colunas/ })).toBeVisible();
    await page.getByRole('tab', { name: 'Visão geral' }).click();
    await expect(page).toHaveURL(/tab=overview/);
    await expect(page.getByRole('row', { name: /Orgânicos/ }).first()).toBeVisible();
    await page.getByRole('tab', { name: /^Viaturas/ }).click();
    await page.getByLabel('Pesquisar matrícula ou circuito').fill('29-48-XU');
    await expect(page.getByRole('row', { name: /29-48-XU/ })).toContainText('Sem circuito');
  });

  test('localidades: filtro por frequência', async ({ page }) => {
    await page.goto('/pt/localities');
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await page.getByRole('button', { name: /^Dias\/semana/ }).click();
    await page.getByRole('dialog').getByRole('checkbox').first().click();
    await page.keyboard.press('Escape');
    await expect(page.getByText(/filtrado de \d+/)).toBeVisible();
    await page.getByRole('button', { name: 'Limpar tudo' }).click();
    await page.getByLabel('Pesquisar localidade').fill('Ronfe');
    await expect(page.getByRole('row', { name: /Ronfe/ })).toBeVisible();
  });

  test('qualidade dos dados: resolver e reabrir um alerta', async ({ page }) => {
    await page.goto('/pt/data-quality');
    await page.getByRole('tab', { name: 'Fontes recebidas' }).click();
    await expect(
      page.getByText('Circuitos_Viaturas_Guimaraes.xlsx').locator('visible=true'),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Alertas' }).click();
    // O estado persiste na base de dados: se uma corrida anterior deixou o alerta resolvido, reabre-o.
    await page.getByRole('button', { name: 'Todas', exact: true }).click();
    const existing = page.getByRole('listitem').filter({ hasText: 'Alerta 3' });
    if (await existing.getByRole('button', { name: 'Reabrir' }).count()) {
      await existing.getByRole('button', { name: 'Reabrir' }).click();
      await expect(page.getByText('Alerta atualizado').first()).toBeVisible();
    }
    await page.getByRole('button', { name: 'Por resolver', exact: true }).click();
    const card = page.getByRole('listitem').filter({ hasText: 'Alerta 3' });
    await card.getByLabel('Nota de resolução').fill('Confirmado com a Vitrus');
    await card.getByRole('button', { name: 'Marcar como resolvida' }).click();
    await expect(page.getByText('Alerta atualizado')).toBeVisible();
    await page.getByRole('button', { name: 'Resolvida', exact: true }).click();
    const resolved = page.getByRole('listitem').filter({ hasText: 'Alerta 3' });
    await expect(resolved).toBeVisible();
    await resolved.getByRole('button', { name: 'Reabrir' }).click();
    await expect(page.getByText('Alerta atualizado').first()).toBeVisible();
  });

  test('utilizadores: só administradores', async ({ page }) => {
    await page.goto('/pt/users');
    await expect(page.getByRole('heading', { name: 'Utilizadores', level: 1 })).toBeVisible();
    // Os testes criam muitas contas: procura o administrador em vez de depender da página.
    await page.getByLabel('Pesquisar por nome ou email').fill('admin@heldergoncalves.io');
    await expect(
      page.getByRole('row', { name: /admin@heldergoncalves.io|Administrador/ }).first(),
    ).toBeVisible();
    // O próprio administrador não pode alterar a sua conta.
    await expect(
      page
        .getByRole('row', { name: /Administrador/ })
        .first()
        .getByRole('button', { name: 'Desativar' }),
    ).toBeDisabled();
  });
});
