import { expect, type Page, request, test } from '@playwright/test';
import { approveByEmail, login, PASSWORD, uniqueEmail } from './helpers';

// O copiloto v2 de ponta a ponta, com a API real e o modelo real (a chave OpenRouter está no servidor).
// Uma conta nova para o ficheiro todo: memória, histórico e dados começam vazios e podem ser apagados no fim.

const LLM = 120_000;
const API = process.env.E2E_API_URL ?? 'http://localhost:8190';
const user = { email: uniqueEmail('copiloto'), password: PASSWORD };

test.describe.configure({ mode: 'serial' });
// O modelo real demora: cada teste tem margem para várias voltas.
test.beforeEach(() => test.setTimeout(150_000));

test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: API });
  const res = await api.post('/api/v1/auth/register', {
    data: { email: user.email, password: user.password, name: 'Teste Copiloto', locale: 'pt-PT' },
  });
  expect(res.ok()).toBeTruthy();
  await api.dispose();
  await approveByEmail(user.email); // contas novas esperam por aprovação
});

const composer = (page: Page) => page.getByRole('combobox', { name: 'Pergunta ao copiloto' });
const field = (page: Page) => page.getByTestId('copilot-composer');
const sendButton = (page: Page) => field(page).getByRole('button', { name: 'Enviar', exact: true });
const stopButton = (page: Page) => field(page).getByRole('button', { name: 'Parar', exact: true });
const assistants = (page: Page) => page.getByTestId('copilot-assistant-message');

async function openChat(page: Page, search = '') {
  await login(page, user);
  await page.goto(`/pt/chat${search}`);
  await expect(page.getByTestId('copilot-page')).toBeVisible();
}

async function ask(page: Page, text: string) {
  const box = composer(page);
  await box.fill(text);
  await box.press('Enter');
}

async function waitForAnswer(page: Page, n = 1) {
  const last = assistants(page).nth(n - 1);
  await expect(last).toHaveAttribute('data-state', /complete|error|cancelled/, { timeout: LLM });
  await expect(last).not.toHaveAttribute('data-state', 'error');
  return last;
}

test.describe('conversa em streaming', () => {
  test('pergunta com frases temáticas, resposta verificada e conversa na lista', async ({
    page,
  }) => {
    await openChat(page);
    await expect(page.getByText('Em que posso ajudar?')).toBeVisible();
    await ask(page, 'Quanto têxtil se recolheu em 2025?');

    // Enquanto trabalha: frase animada (sem skeletons) e botão Parar no lugar de Enviar.
    await expect(page.getByTestId('copilot-thinking')).toBeVisible();
    await expect(stopButton(page)).toBeVisible();
    await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
    await expect(page.getByText('Quanto têxtil se recolheu em 2025?').first()).toBeVisible();

    const reply = await waitForAnswer(page);
    await expect(reply.getByText(/Números verificados|Números por verificar/)).toBeVisible();
    await expect(sendButton(page)).toBeVisible();
    // A conversa ganha URL e aparece na lista (com o título gerado).
    await expect(page).toHaveURL(/thread=/);
    await expect(page.getByTestId('copilot-thread-item').first()).toBeVisible();
    await expect(reply.getByRole('button', { name: 'Resposta útil' })).toBeVisible();
    await expect(reply.getByRole('button', { name: 'Gerar de novo' })).toBeVisible();
  });

  test('parar a meio deixa a resposta parcial marcada como interrompida', async ({ page }) => {
    await openChat(page);
    await ask(
      page,
      'Escreve uma explicação longa e detalhada, em muitos parágrafos, sobre como a recolha de têxteis funciona em Guimarães.',
    );
    await expect(stopButton(page)).toBeVisible();
    await page.waitForTimeout(1500);
    await stopButton(page).click();
    await expect(assistants(page).first()).toHaveAttribute('data-state', 'cancelled', {
      timeout: 15_000,
    });
    await expect(page.getByText('Resposta interrompida.')).toBeVisible();
    await expect(sendButton(page)).toBeVisible();
  });

  test('menciona uma freguesia com @ e escolhe com o teclado', async ({ page }) => {
    await openChat(page);
    const box = composer(page);
    await box.click();
    await box.pressSequentially('@Barc');
    const list = page.getByRole('listbox', { name: 'Menções' });
    await expect(list).toBeVisible();
    await expect(list.getByRole('option').first()).toBeVisible();
    await box.press('ArrowDown');
    await box.press('Enter');
    await expect(box).toHaveValue(/^@\S.* $/);
    const typed = (await box.inputValue()).trim();
    await box.pressSequentially('quantos habitantes tem?');
    await box.press('Enter');
    await expect(
      page.getByTestId('copilot-user-message').getByText(typed.slice(1), { exact: false }).first(),
    ).toBeVisible();
    await waitForAnswer(page);
  });

  test('anexa um CSV pelo botão, vê o chip e a mensagem leva o anexo', async ({ page }) => {
    await openChat(page);
    await page.getByTestId('copilot-file-input').setInputFiles({
      name: 'recolhas.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('freguesia,kg\nBarco,120\nCreixomil,340\nUrgezes,210\n'),
    });
    const chip = page.getByTestId('copilot-attachment-chip');
    await expect(chip).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });
    await expect(chip).toContainText('recolhas.csv');
    await ask(page, 'Quantas linhas de dados tem o ficheiro anexado?');
    await expect(page.getByTestId('copilot-user-message').getByText('recolhas.csv')).toBeVisible();
    await expect(chip).toHaveCount(0);
    await waitForAnswer(page);
  });

  test('arrastar e colar ficheiros também anexa', async ({ page }) => {
    await openChat(page);
    await page.evaluate(() => {
      const target = document.querySelector('[data-testid="copilot-composer"]');
      if (!target) throw new Error('sem campo');
      const dt = new DataTransfer();
      dt.items.add(new File(['olá'], 'solto.txt', { type: 'text/plain' }));
      for (const type of ['dragenter', 'dragover', 'drop']) {
        target.dispatchEvent(
          new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }),
        );
      }
    });
    await expect(
      page.getByTestId('copilot-attachment-chip').filter({ hasText: 'solto.txt' }),
    ).toBeVisible();
    await page.evaluate(() => {
      const area = document.querySelector('textarea');
      const dt = new DataTransfer();
      dt.items.add(new File(['colado'], 'colado.txt', { type: 'text/plain' }));
      area?.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    });
    await expect(
      page.getByTestId('copilot-attachment-chip').filter({ hasText: 'colado.txt' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Retirar solto.txt' }).click();
    await expect(page.getByTestId('copilot-attachment-chip')).toHaveCount(1);
  });

  test('comandos com / e menu de comandos por teclado', async ({ page }) => {
    await openChat(page);
    const box = composer(page);
    await box.fill('/');
    const list = page.getByRole('listbox', { name: 'Comandos' });
    await expect(list.getByRole('option', { name: /\/compact/ })).toBeVisible();
    await expect(list.getByRole('option', { name: /\/modelo/ })).toHaveCount(0); // só administradores
    await box.press('Escape');
    await expect(list).toBeHidden();
    await box.fill('/exportar');
    await box.press('Enter');
    await expect(
      page.getByText('Ainda não há conversa: envia primeiro uma pergunta.'),
    ).toBeVisible();
    await expect(box).toHaveValue('');
  });
});

test.describe('artefactos', () => {
  test('um gráfico é desenhado com echarts e fica na galeria, fixável', async ({ page }) => {
    await openChat(page);
    await ask(page, 'Desenha um gráfico de barras com a recolha de têxtil em 2025 por entidade.');
    const reply = await waitForAnswer(page);
    const chart = reply.getByTestId('copilot-chart').first();
    await expect(chart).toBeVisible({ timeout: 30_000 });
    await expect(chart.locator('canvas')).toBeVisible();
    await expect(chart).toHaveAttribute('aria-label', /.{20,}/);
    await expect(reply.getByText(/^Fonte:/)).toBeVisible();

    await reply.getByRole('button', { name: 'Fixar na galeria' }).first().click();
    await expect(reply.getByRole('button', { name: 'Desafixar' }).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Artefactos' }).click();
    await expect(page).toHaveURL(/tab=artifacts/);
    const gallery = page.getByTestId('copilot-gallery-item').first();
    await expect(gallery).toBeVisible();
    await expect(gallery.getByTestId('copilot-chart')).toBeVisible();
    await page.getByRole('switch', { name: 'Só fixados' }).click();
    await expect(page.getByTestId('copilot-gallery-item')).not.toHaveCount(0);
  });

  test('uma tabela usa o DataTable', async ({ page }) => {
    await openChat(page);
    await ask(page, 'Mostra uma tabela com as 10 freguesias com mais população.');
    const reply = await waitForAnswer(page);
    const artifact = reply.locator('[data-testid="copilot-artifact"][data-type="table"]').first();
    await expect(artifact).toBeVisible({ timeout: 30_000 });
    await expect(artifact.getByRole('table')).toBeVisible();
    await expect(artifact.getByRole('columnheader').first()).toBeVisible();
  });
});

test.describe('ações com confirmação e memória', () => {
  test('o copiloto propõe, a pessoa confirma e depois desfaz', async ({ page }) => {
    await openChat(page, '?tab=settings');
    await page.getByRole('tab', { name: 'Comportamento' }).click();
    const confirmSwitch = page.getByRole('switch', {
      name: 'Pedir confirmação antes de criar cenários e relatórios',
    });
    if ((await confirmSwitch.getAttribute('aria-checked')) !== 'true') await confirmSwitch.click();
    await expect(confirmSwitch).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Definições guardadas.').first()).toBeVisible();

    await page.getByRole('tab', { name: 'Conversa' }).click();
    await ask(page, 'Cria um cenário novo com 45 mil euros por ano de orçamento.');
    const reply = await waitForAnswer(page);
    const action = reply.getByTestId('copilot-action').first();
    await expect(action).toBeVisible({ timeout: 30_000 });
    await expect(action).toHaveAttribute('data-status', 'proposed');
    await action.getByRole('button', { name: 'Confirmar' }).click();
    await expect(action).toHaveAttribute('data-status', 'executed', { timeout: 60_000 });
    await expect(action.getByRole('button', { name: 'Desfazer' })).toBeVisible();

    await page.getByRole('tab', { name: 'Ações' }).click();
    await expect(page.getByTestId('copilot-actions').getByRole('table')).toBeVisible();
    await page.getByRole('tab', { name: 'Conversa' }).click();
    // O estado não se perdeu ao mudar de separador.
    await expect(action).toHaveAttribute('data-status', 'executed');
    await action.getByRole('button', { name: 'Desfazer' }).click();
    await expect(action).toHaveAttribute('data-status', 'undone', { timeout: 30_000 });
  });

  test('"lembra-te" guarda na memória com aviso e Desfazer; a memória é editável', async ({
    page,
  }) => {
    await openChat(page);
    await ask(
      page,
      'Lembra-te de que prefiro respostas curtas e que acompanho sobretudo a freguesia de Creixomil.',
    );
    const reply = await waitForAnswer(page);
    const note = reply.getByTestId('copilot-memory-note').first();
    await expect(note).toBeVisible({ timeout: 30_000 });
    await expect(note).toContainText(/memória/);

    await page.goto('/pt/chat?tab=settings');
    const entry = page.getByTestId('copilot-memory-entry').first();
    await expect(entry).toBeVisible();
    await entry.getByRole('button', { name: 'Editar nota' }).click();
    await entry
      .getByRole('textbox', { name: 'Editar nota' })
      .fill('Prefere respostas curtas e acompanha Creixomil.');
    await entry.getByRole('button', { name: 'Guardar' }).click();
    await expect(
      page.getByTestId('copilot-memory-entry').filter({ hasText: 'acompanha Creixomil' }),
    ).toBeVisible();
  });

  test('notas à mão, aprovações pendentes e medidor de memória', async ({ page }) => {
    await openChat(page, '?tab=settings');
    const block = page.getByTestId('copilot-memory-memory');
    await block.getByRole('textbox', { name: /Acrescentar/ }).fill('Usar sempre toneladas por ano');
    await block.getByRole('button', { name: 'Acrescentar' }).click();
    await expect(block.getByText('Usar sempre toneladas por ano')).toBeVisible();
    await expect(block.getByRole('progressbar')).toBeVisible();
    await expect(block.getByText(/caracteres/)).toBeVisible();
    await block
      .getByTestId('copilot-memory-entry')
      .filter({ hasText: 'toneladas por ano' })
      .getByRole('button', { name: 'Apagar nota' })
      .click();
    await expect(block.getByText('Usar sempre toneladas por ano')).toHaveCount(0);

    // Esvazia o que o teste anterior guardou: sem notas, o copiloto propõe um `add` simples.
    const clear = page.getByRole('button', { name: 'Esvaziar' });
    while ((await clear.count()) > 0) {
      const before = await clear.count();
      await clear.first().click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Esvaziar' }).click();
      await expect(page.getByRole('alertdialog')).toBeHidden();
      await expect(clear).toHaveCount(before - 1);
    }
    await expect(page.getByTestId('copilot-memory-entry')).toHaveCount(0);

    // Com aprovação ligada, o copiloto só propõe; a nota aparece em pendentes.
    const approval = page.getByRole('switch', { name: 'Pedir aprovação antes de guardar' });
    await approval.click();
    await expect(approval).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('tab', { name: 'Conversa' }).click();
    await ask(page, 'Lembra-te de que gosto de ver sempre a fonte dos dados.');
    await waitForAnswer(page);
    await page.goto('/pt/chat?tab=settings');
    const pending = page.getByTestId('copilot-memory-pending').first();
    await expect(pending).toBeVisible({ timeout: 20_000 });
    // O copiloto pode propor mais do que uma nota (memória e perfil): aprova todas.
    const all = page.getByTestId('copilot-memory-pending');
    while ((await all.count()) > 0) {
      const before = await all.count();
      await all.first().getByRole('button', { name: 'Aprovar' }).click();
      await expect(all).toHaveCount(before - 1);
    }
    await expect(
      page.getByTestId('copilot-memory-entry').filter({ hasText: /fonte/i }).first(),
    ).toBeVisible();
  });

  test('personalidade com pré-visualização', async ({ page }) => {
    await openChat(page, '?tab=settings');
    await page.getByRole('tab', { name: 'Personalidade' }).click();
    await page.getByRole('radio', { name: /Executivo/ }).click();
    await expect(page.getByRole('radio', { name: /Executivo/ })).toBeChecked();
    await page.getByRole('button', { name: 'Pré-visualizar' }).click();
    await expect(page.getByTestId('copilot-persona-preview').locator('blockquote')).toBeVisible({
      timeout: 60_000,
    });
  });
});

test.describe('histórico e conversas', () => {
  test('cronologia com pesquisa, filtros e abertura da conversa', async ({ page }) => {
    await openChat(page, '?tab=history');
    const history = page.getByTestId('copilot-history');
    await expect(history.getByRole('table')).toBeVisible();
    await expect(history.getByRole('row').nth(1)).toBeVisible();
    await history.getByRole('button', { name: 'Conversa', exact: true }).click();
    await history.getByRole('searchbox', { name: 'Pesquisar no histórico' }).fill('têxtil');
    await expect(history.getByRole('row').nth(1)).toBeVisible();
    await history.getByRole('button', { name: 'Abrir', exact: true }).first().click();
    await expect(page).toHaveURL(/thread=/);
    await expect(page.getByTestId('copilot-user-message').first()).toBeVisible();
    await expect(assistants(page).first()).toBeVisible();
  });

  test('conversas: renomear, fixar, mover, partilhar, arquivar e apagar', async ({ page }) => {
    await openChat(page);
    const items = page.getByTestId('copilot-thread-item');
    await items
      .first()
      .getByRole('button', { name: /Opções de/ })
      .click();
    await page.getByRole('menuitem', { name: 'Renomear' }).click();
    await page.getByRole('textbox', { name: 'Título' }).fill('Conversa E2E renomeada');
    await page.getByRole('button', { name: 'Guardar' }).click();
    const renamed = items.filter({ hasText: 'Conversa E2E renomeada' });
    await expect(renamed).toBeVisible();

    await renamed.getByRole('button', { name: /Opções de/ }).click();
    await page.getByRole('menuitem', { name: 'Fixar', exact: true }).click();
    await expect(items.first()).toContainText('Conversa E2E renomeada');

    await renamed.getByRole('button', { name: /Opções de/ }).click();
    await page.getByRole('menuitem', { name: 'Mover para projeto' }).click();
    await page.getByLabel(/^Projeto/).fill('Piloto E2E');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(renamed.getByText('Piloto E2E')).toBeVisible();

    await renamed.getByRole('button', { name: /Opções de/ }).click();
    await page.getByRole('menuitem', { name: 'Partilhar por ligação' }).click();
    const link = page.getByRole('textbox', { name: 'Ligação de partilha' });
    await expect(link).toHaveValue(/\/chat\/shared\//);
    const shared = await page.context().newPage();
    await shared.goto(await link.inputValue());
    await expect(shared.getByText('Só de leitura')).toBeVisible();
    await expect(shared.getByTestId('copilot-user-message').first()).toBeVisible();
    await expect(shared.getByRole('combobox', { name: 'Pergunta ao copiloto' })).toHaveCount(0);
    await shared.close();
    await page.keyboard.press('Escape');

    await renamed.getByRole('button', { name: /Opções de/ }).click();
    await page.getByRole('menuitem', { name: 'Arquivar' }).click();
    await expect(renamed).toHaveCount(0);
    await page.getByRole('switch', { name: 'Arquivadas' }).click();
    await expect(items.filter({ hasText: 'Conversa E2E renomeada' })).toBeVisible();

    await items
      .filter({ hasText: 'Conversa E2E renomeada' })
      .getByRole('button', { name: /Opções de/ })
      .click();
    await page.getByRole('menuitem', { name: 'Apagar' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Apagar' }).click();
    await expect(items.filter({ hasText: 'Conversa E2E renomeada' })).toHaveCount(0);
  });
});

test.describe('painel ⌘K', () => {
  test('uma pergunta da página inicial abre o painel e é enviada', async ({ page }) => {
    await login(page, user);
    await page
      .getByRole('button', { name: 'Que freguesias têm mais potencial por captar?' })
      .click();
    const panel = page.getByRole('dialog', { name: 'Copiloto Novelo' });
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('copilot-user-message').first()).toBeVisible();
    await waitForAnswer(page);
    await panel.getByRole('button', { name: 'Mais opções' }).click();
    await page.getByRole('menuitem', { name: 'Ecrã inteiro' }).click();
    await expect(page).toHaveURL(/\/pt\/chat\?thread=/);
    await expect(page.getByTestId('copilot-user-message').first()).toBeVisible();
  });

  test('o ecrã atual segue com a pergunta e pode ser removido', async ({ page }) => {
    await login(page, user);
    await page.goto('/pt/scenarios');
    // Só depois de a página montar é que o atalho está ligado.
    await expect(page.locator('#content h1').first()).toBeVisible();
    await page.keyboard.press('Control+k');
    const panel = page.getByRole('dialog', { name: 'Copiloto Novelo' });
    // O copiloto já vê o ecrã atual (linha removível por cima do campo).
    await expect(panel.getByTestId('copilot-context-chip')).toContainText(
      'A ver: Comparar cenários',
    );
    const req = page.waitForRequest((r) => r.url().includes('/copilot/stream'));
    await composer(page).fill('Que ecrã estou a ver?');
    await composer(page).press('Enter');
    const body = (await req).postDataJSON() as { page_context?: { route: string } };
    expect(body.page_context?.route).toBe('/scenarios');
    await waitForAnswer(page);
  });
});

test.describe('rolar e acessibilidade', () => {
  test('segue o fim enquanto escreve, para se subires e mostra "Ir para o fim"', async ({
    page,
  }) => {
    await openChat(page);
    await ask(
      page,
      'Escreve uma resposta longa, com uma lista de pelo menos doze pontos, sobre o ciclo de vida de uma peça de roupa.',
    );
    const scroller = page.getByTestId('copilot-scroller');
    await expect(stopButton(page)).toBeVisible();
    const gap = () => scroller.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
    await expect.poll(gap, { timeout: 30_000 }).toBeLessThan(90);
    await scroller.hover();
    await page.mouse.wheel(0, -4000);
    await expect(page.getByRole('button', { name: 'Ir para o fim' })).toBeVisible();
    const before = await scroller.evaluate((el) => el.scrollTop);
    await page.waitForTimeout(1500);
    expect(await scroller.evaluate((el) => el.scrollTop)).toBeLessThanOrEqual(before + 2);
    await page.getByRole('button', { name: 'Ir para o fim' }).click();
    await expect.poll(gap, { timeout: 5_000 }).toBeLessThan(90);
    await waitForAnswer(page);
  });

  test('movimento reduzido: sem animações nas frases', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openChat(page);
    await ask(page, 'Compara o custo por tonelada de todos os cenários.');
    const thinking = page.getByTestId('copilot-thinking');
    await expect(thinking).toBeVisible();
    const name = await thinking
      .locator('span[aria-hidden="true"] > span')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe('none');
    await waitForAnswer(page);
  });
});

test.describe('telemóvel (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('campo a 16 px, sem rolagem horizontal, lista de conversas em folha', async ({ page }) => {
    await openChat(page);
    const box = composer(page);
    await expect(box).toBeVisible();
    expect(await box.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
    const sized = await field(page)
      .locator('button')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    for (const h of sized) expect(h).toBeGreaterThanOrEqual(40);
    await ask(page, 'Mostra um gráfico de barras da recolha por entidade em 2025.');
    const reply = await waitForAnswer(page);
    await expect(reply.getByTestId('copilot-chart').first()).toBeVisible({ timeout: 30_000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Conversas' }).click();
    const sheet = page.getByRole('dialog', { name: 'Conversas' });
    await expect(sheet.getByTestId('copilot-thread-item').first()).toBeVisible();
    await sheet.getByTestId('copilot-thread-item').first().getByRole('button').first().click();
    await expect(sheet).toBeHidden();
  });

  test('histórico, artefactos, ações e definições cabem no ecrã', async ({ page }) => {
    await openChat(page, '?tab=history');
    await expect(page.getByTestId('copilot-history')).toBeVisible();
    for (const tab of ['history', 'settings', 'actions', 'artifacts']) {
      await page.goto(`/pt/chat?tab=${tab}`);
      await expect(page.getByTestId('copilot-page')).toBeVisible();
      await page.waitForTimeout(800);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });
});

test.describe('os teus dados', () => {
  test('exportar e apagar tudo exige escrever APAGAR', async ({ page }) => {
    await openChat(page, '?tab=settings');
    await page.getByRole('tab', { name: 'Os teus dados' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar tudo' }).click();
    expect((await download).suggestedFilename()).toBe('novelo-copiloto.json');

    await page.getByRole('button', { name: 'Apagar tudo' }).click();
    const dialog = page.getByRole('alertdialog');
    const confirm = dialog.getByRole('button', { name: 'Apagar tudo' });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole('textbox').fill('APAG');
    await expect(confirm).toBeDisabled();
    await dialog.getByRole('textbox').fill('APAGAR');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByText('Dados do copiloto apagados.').first()).toBeVisible();

    await page.getByRole('tab', { name: 'Conversa' }).click();
    await expect(page.getByText('Ainda não tens conversas')).toBeVisible();
    await page.getByRole('tab', { name: 'Histórico' }).click();
    // Fica só o registo da própria eliminação (auditoria); conversas e memórias desapareceram.
    const table = page.getByTestId('copilot-history').getByRole('table');
    await expect(table.getByRole('row')).toHaveCount(2);
    await expect(table.getByText('Conversa', { exact: true })).toHaveCount(0);
  });
});
