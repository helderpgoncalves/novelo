import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import { login } from './helpers';

/** Os rádios dos segmentos são nativos e escondidos: clica-se no rótulo que os envolve. */
const pick = (page: Page, name: string | RegExp) =>
  page
    .getByRole('radio', { name, exact: typeof name === 'string' })
    .locator('xpath=..')
    .click();

test.describe('frota: calendário, mapa e visão geral', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('semana tipo: grelha, hoje destacado, detalhe de um circuito e URL partilhável', async ({
    page,
  }) => {
    await page.goto('/pt/fleet');
    const grid = page.getByRole('table', { name: /Semana tipo: dias em colunas/ });
    await expect(grid).toBeVisible();
    for (const day of ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']) {
      await expect(
        grid.getByRole('columnheader', { name: new RegExp(`Abrir ${day}`, 'i') }),
      ).toBeVisible();
    }
    for (const shift of ['Manhã', 'Tarde', 'Noite']) {
      await expect(grid.getByRole('rowheader', { name: shift })).toBeVisible();
    }
    // Exatamente um dia é "hoje".
    await expect(grid.getByText('Hoje', { exact: true })).toHaveCount(1);

    await grid
      .getByRole('button', { name: /^C1\. Indiferenciados/ })
      .first()
      .click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: 'C1' })).toBeVisible();
    await expect(sheet.getByText('Quando (semana tipo)')).toBeVisible();
    await expect(page).toHaveURL(/detail=c(%3A|:)C1/);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(page).not.toHaveURL(/detail=/);
  });

  test('conflitos reais: sobreposição de viatura e sem circuito', async ({ page }) => {
    await page.goto('/pt/fleet');
    const overlap = page.getByRole('button', { name: /Viaturas em dois circuitos no mesmo turno/ });
    await expect(overlap).toHaveAttribute('aria-pressed', 'false');
    await overlap.click();
    await expect(overlap).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/focus=overlap/);

    await page
      .getByRole('button', { name: /Viaturas sem circuito/ })
      .first()
      .click();
    await expect(page).toHaveURL(/view=vehicle/);
    await expect(page.getByRole('rowheader', { name: '29-48-XU' })).toBeVisible();
    await expect(page.getByText(/Sem circuito atribuído no planeamento/).first()).toBeVisible();
  });

  test('agrupamento planeado deixa de ser conflito e o detalhe mostra o tipo de recolha', async ({
    page,
  }) => {
    await page.goto('/pt/fleet?tab=overview');
    // 4 viaturas com circuitos agrupados na folha da Vitrus; sobra 1 conflito real (75-ZQ-24).
    await expect(page.getByText('Viaturas com circuitos agrupados: 4')).toBeVisible();
    await expect(page.getByText('Viaturas em dois circuitos no mesmo turno: 1')).toBeVisible();

    await page.goto('/pt/fleet?detail=c:C10');
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: 'C10' })).toBeVisible();
    await expect(sheet.getByText('Tipo de recolha')).toBeVisible();
    await expect(sheet.getByText('Circuito agrupado no planeamento').first()).toBeVisible();
    await expect(sheet.getByText(/circuitos agrupados no planeamento da Vitrus/)).toBeVisible();
  });

  test('vistas por dia, por viatura e por circuito; filtros no URL', async ({ page }) => {
    await page.goto('/pt/fleet');
    await pick(page, 'Por viatura');
    await expect(page).toHaveURL(/view=vehicle/);
    const vehicles = page.getByRole('table', { name: /por viatura/i });
    await expect(vehicles.getByRole('rowheader', { name: '69-TJ-24' })).toBeVisible();

    await pick(page, 'Por circuito');
    const circuits = page.getByRole('table', { name: /por circuito/i });
    await expect(circuits.getByRole('rowheader', { name: /C8/ })).toBeVisible();
    await expect(circuits.getByText('sem viatura').first()).toBeVisible();

    await pick(page, 'Dia');
    await expect(page.getByRole('region', { name: 'Manhã' })).toBeVisible();

    await page.getByRole('combobox', { name: 'Viatura' }).click();
    await page.getByRole('option', { name: '69-TJ-24' }).click();
    await expect(page).toHaveURL(/plate=69-TJ-24/);
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page).not.toHaveURL(/plate=/);

    // Abrir o URL de um filtro reproduz a mesma vista.
    await page.goto('/pt/fleet?view=week&ty=organic');
    const grid = page.getByRole('table', { name: /Semana tipo: dias em colunas/ });
    await expect(grid.getByRole('button', { name: /^BIO 1\./ }).first()).toBeVisible();
    await expect(grid.getByRole('button', { name: /^C1\./ })).toHaveCount(0);
  });

  test('exportar .ics por circuito com o aviso de planeamento tipo', async ({ page }) => {
    await page.goto('/pt/fleet?circuit=C7');
    await page.getByRole('button', { name: 'Exportar' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: /\.ics por circuito/ }).click();
    const file = await (await download).path();
    const text = await readFile(file, 'utf8');
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU,TH,SA');
    expect(text).toContain('SUMMARY:C7');
    expect(text).toMatch(/planeamento semanal tipo/i);
    await expect(page.getByText('Calendário descarregado').first()).toBeVisible();
  });

  test('mapa da frota: localidades, viatura selecionada e linha indicativa', async ({ page }) => {
    await page.goto('/pt/fleet?tab=map');
    await expect(page.getByRole('region', { name: /Mapa das localidades/ })).toBeVisible();
    await expect(page.getByText(/Localidades servidas: \d+ de \d+/)).toBeVisible();
    await page.getByRole('combobox', { name: 'Viatura' }).click();
    await page.getByRole('option', { name: '69-TJ-24' }).click();
    await expect(page.getByText('Ligação indicativa, não é o percurso real')).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Localidades no mapa' })).toContainText(
      'Azurém',
    );
  });

  test('mapa: a lista de localidades de um circuito segue a ordem do percurso', async ({
    page,
  }) => {
    await page.goto('/pt/fleet?tab=map&circuit=BIO%204');
    const panel = page.getByRole('complementary', { name: 'Localidades no mapa' });
    await expect(panel).toContainText('ordem do percurso');
    const names = await panel.locator('li button span.font-medium').allTextContents();
    // BIO 4: Cidade; Costa; Urgezes; Azúrem; Creixomil; Campelos (e não alfabética).
    const order = ['Cidade', 'Costa', 'Urgezes', 'Azúrem', 'Creixomil', 'Campelos'];
    const seen = order.map((n) => names.findIndex((x) => x.startsWith(n)));
    expect(seen.filter((i) => i >= 0).length).toBeGreaterThan(2);
    const found = seen.filter((i) => i >= 0);
    expect([...found].sort((a, b) => a - b)).toEqual(found);
  });

  test('visão geral: alertas acionáveis e gráfico de carga', async ({ page }) => {
    await page.goto('/pt/fleet?tab=overview');
    await expect(
      page.getByRole('img', { name: /Viaturas em uso por dia da semana/ }),
    ).toBeVisible();
    await expect(page.getByText(/Viaturas sem circuito: 2/)).toBeVisible();
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Circuitos sem viatura' })
      .getByRole('button', { name: 'Ver circuitos' })
      .click();
    await expect(page).toHaveURL(/tab=calendar/);
    await expect(page).toHaveURL(/focus=nocar/);
    await expect(page.getByRole('rowheader', { name: /BIO 5/ })).toBeVisible();
  });

  test('viaturas: detalhe expandido com a semana da viatura', async ({ page }) => {
    await page.goto('/pt/fleet?tab=vehicles');
    await page.getByLabel('Pesquisar matrícula ou circuito').fill('69-TJ-24');
    await page
      .getByRole('button', { name: /Expandir|Abrir linha|Mostrar detalhe/i })
      .first()
      .click();
    await expect(page.getByRole('table', { name: /Semana tipo de 69-TJ-24/ })).toBeVisible();
  });
});

test.describe('frota em telemóvel', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('a semana vira lista por dia, sem overflow horizontal', async ({ page }) => {
    await login(page);
    await page.goto('/pt/fleet');
    await expect(page.getByRole('group', { name: 'Dia da semana' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Manhã' })).toBeVisible();
    await pick(page, /quarta-feira/i);
    await expect(page.getByRole('region', { name: 'Manhã' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });
});
