#!/usr/bin/env node
/**
 * Imagens do documento «docs/projeto/visao-geral.md» (docs/img/pagina-*.png), geradas da aplicação em produção para que
 * mostrem sempre os números e as rotas que a aplicação mostra hoje. Cada imagem é uma composição da marca: título, frase,
 * logótipo e a captura numa moldura de browser (ou num telemóvel).
 *
 * Uso (precisa do chromium do Playwright: `pnpm --filter web exec playwright install chromium`):
 *   BASE=https://novelo.helder.si COOKIE_FILE=/caminho/sessao.txt node scripts/docs/page-shots.cjs [--only=simulador,rotas]
 *
 * COOKIE_FILE tem uma linha `nome=valor` com o cookie de acesso de um administrador (se for preciso, cria-se uma sessão de
 * 15 minutos dentro do contentor da API com `create_access_token`; nunca se guarda no repositório). As imagens da landing
 * (metodo, prova) são públicas e não precisam dele. A peça da triagem usa uma fotografia real do Wikimedia Commons (PHOTO).
 */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const ROOT = path.resolve(__dirname, '..', '..');
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test');

const BASE = (process.env.BASE || 'https://novelo.helder.si').replace(/\/$/, '');
const OUT = process.env.OUT || path.join(ROOT, 'docs/img');
const TMP = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'novelo-shots-'));
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').replace('--only=', '').split(',').filter(Boolean);
const cookieLine = process.env.COOKIE_FILE ? fs.readFileSync(process.env.COOKIE_FILE, 'utf8').trim() : '';
const [cookieName, cookieValue] = cookieLine ? [cookieLine.split('=')[0], cookieLine.slice(cookieLine.indexOf('=') + 1)] : [];
const host = new URL(BASE).hostname;

const fontDir = path.join(ROOT, 'apps/web/public/fonts');
const logo = fs.readFileSync(path.join(ROOT, 'brand/logotipo/novelo-logotipo-positivo.svg'), 'utf8');
const uri = (f) => `file://${f}`;
const pt = (n, d = 1) => Number(n).toLocaleString('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d });
const eur = (n) => `${Math.round(n).toLocaleString('pt-PT').replace(/ | /g, ' ')} €`;

const CSS = `
@font-face{font-family:Newsreader;src:url(${uri(path.join(fontDir, 'newsreader-latin-standard-normal.woff2'))});font-weight:200 800}
@font-face{font-family:Inter;src:url(${uri(path.join(fontDir, 'inter-latin-standard-normal.woff2'))});font-weight:100 900}
:root{--linho:#F4F1EA;--tinta:#14211D;--floresta:#2E6B57;--pedra:#5E6B66;--linha:#DCD5C8}
*{box-sizing:border-box}html{background:var(--linho)}body{margin:0;background:var(--linho);color:var(--tinta);font-family:Inter,system-ui,sans-serif;width:1600px}
.page{padding:72px 72px 56px;position:relative}
.kick{display:flex;align-items:center;gap:14px;font:600 14px/1 Inter;letter-spacing:.22em;color:var(--floresta);text-transform:uppercase}
.kick:before{content:"";width:28px;height:2px;background:var(--floresta)}
h1{font:500 64px/1.04 Newsreader,Georgia,serif;letter-spacing:-.02em;margin:18px 0 14px;max-width:1150px}
.sub{font:400 22px/1.45 Inter;color:var(--pedra);max-width:1150px;margin:0 0 56px}
.logo{position:absolute;right:72px;top:70px;width:200px}.logo svg{width:100%;height:auto}
.frame{border:1px solid var(--linha);border-radius:20px;background:#fff;box-shadow:0 30px 60px -28px rgba(20,33,29,.28);overflow:hidden}
.bar{height:44px;background:#ebe6db;display:flex;align-items:center;gap:8px;padding:0 18px;position:relative}
.bar i{width:11px;height:11px;border-radius:50%;background:#cfc8ba}
.url{position:absolute;left:50%;transform:translateX(-50%);width:390px;height:28px;background:var(--linho);border-radius:8px;font:500 14px/28px Inter;text-align:center;color:var(--tinta)}
.url b{color:var(--pedra);font-weight:400}
.frame img{display:block;width:100%}
.cap{font:400 18px/1.4 Inter;color:var(--pedra);text-align:center;margin-top:16px}
.phone{border:14px solid var(--tinta);border-radius:54px;overflow:hidden;background:var(--linho);box-shadow:0 30px 60px -28px rgba(20,33,29,.4)}
.phone img{display:block;width:100%}
.duo{display:flex;gap:56px;align-items:flex-end}.trio{display:flex;gap:44px;justify-content:center;align-items:flex-start}
.pages{display:flex;gap:40px;justify-content:center}.pages img{width:560px;border:1px solid var(--linha);box-shadow:0 24px 50px -26px rgba(20,33,29,.35);background:#fff}
`;


async function runTriage(browser, viewport, mobile) {
  const photo = process.env.PHOTO;
  const ctx = await authedContext(browser, viewport, mobile ? { isMobile: true, hasTouch: true } : {});
  const page = await ctx.newPage();
  await page.goto(`${BASE}/pt/triage`, { waitUntil: 'domcontentloaded' });
  await settle(page, 5000);
  await page.locator('input[type=file]').first().setInputFiles(photo);
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Analisar peça/ }).click();
  await page.waitForSelector('text=/Confiança|confiança/', { timeout: 90000 }).catch(() => {});
  await settle(page, 4000);
  return { ctx, page };
}

async function lastReport(browser) {
  const ctx = await authedContext(browser, { width: 800, height: 600 });
  const reports = await api(ctx, '/reports');
  const r = reports[0];
  const pdf = await ctx.request.get(`${BASE}/api/v1/reports/${r.id}/pdf`);
  const file = path.join(TMP, 'rap.pdf');
  fs.writeFileSync(file, await pdf.body());
  await ctx.close();
  require('node:child_process').execFileSync('pdftoppm', ['-r', '90', '-png', '-f', '1', '-l', '2', file, path.join(TMP, 'rap')]);
  return fs.readdirSync(TMP).filter((f) => f.startsWith('rap-') && f.endsWith('.png')).sort().map((f) => path.join(TMP, f));
}

async function api(ctx, p) {
  const r = await ctx.request.get(`${BASE}/api/v1${p}`);
  if (!r.ok()) throw new Error(`GET ${p} ${r.status()}`);
  return r.json();
}

async function authedContext(browser, viewport, extra = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'pt-PT', deviceScaleFactor: 2, ...extra });
  if (cookieName) {
    await ctx.addCookies([
      { name: cookieName, value: cookieValue, domain: host, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' },
      { name: 'novelo_session', value: '1', domain: host, path: '/', secure: true },
    ]);
  }
  return ctx;
}

async function settle(page, ms = 4500) {
  await page.waitForTimeout(ms);
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}[data-slot="avatar"] img{display:none!important}' });
}

/** Captura `clip` (CSS px, relativo à página) para um ficheiro. */
async function grab(page, name, clip) {
  const file = path.join(TMP, `${name}.png`);
  await page.screenshot({ path: file, clip, type: 'png' });
  return file;
}

async function section(page, heading) {
  return page.evaluate((text) => {
    const h = [...document.querySelectorAll('h1,h2,h3')].find((e) => e.textContent?.trim().startsWith(text));
    if (!h) return null;
    const s = h.closest('section') || h.parentElement;
    const r = s.getBoundingClientRect();
    return { y: Math.max(0, r.top + window.scrollY), h: r.height };
  }, heading);
}

const renderHtml = (body) => `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div class="page">${body}</div>`;
const head = (kick, title, sub) =>
  `<div class="logo">${logo}</div><div class="kick">${kick}</div><h1>${title}</h1><p class="sub">${sub}</p>`;
const frame = (file, url) =>
  `<div class="frame"><div class="bar"><i></i><i></i><i></i><span class="url"><b>🔒&nbsp;</b>${url}</span></div><img src="${uri(file)}"></div>`;

async function compose(browser, name, html) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const htmlFile = path.join(TMP, `${name}.html`);
  fs.writeFileSync(htmlFile, html);
  await page.goto(uri(htmlFile), { waitUntil: 'load' });  // via file:// para as imagens e as fontes locais carregarem
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  await page.close();
  console.log('ok', name);
}

async function desktopShot(browser, urlPath, { height, tab, wait, scrollToSection, name, clipSection, minHeight = 0 }) {
  const ctx = await authedContext(browser, { width: 1440, height: 2800 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${urlPath}`, { waitUntil: 'domcontentloaded' });
  await settle(page, wait || 4500);
  if (tab) {
    await page.getByRole('tab', { name: tab }).click();
    await settle(page, 6500);
  }
  let clip = { x: 0, y: 0, width: 1440, height };
  if (clipSection) {
    const s = await section(page, clipSection);
    if (s) clip = { x: 0, y: Math.max(0, s.y - 90), width: 1440, height: Math.min(Math.max(s.h + 130, minHeight), height) };
  }
  const file = await grab(page, name, clip);
  await ctx.close();
  return file;
}

async function phoneShot(browser, urlPath, { tab, height = 1250, name, authed = true, scrollTo, vh = 2400 }) {
  const ctx = authed
    ? await authedContext(browser, { width: 390, height: vh }, { isMobile: true, hasTouch: true })
    : await browser.newContext({ viewport: { width: 390, height: vh }, deviceScaleFactor: 2, locale: 'pt-PT', isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${urlPath}`, { waitUntil: 'domcontentloaded' });
  await settle(page, 5000);
  if (tab) {
    await page.getByRole('tab', { name: tab }).click();
    await settle(page, 6500);
  }
  let y = 0;
  if (scrollTo) {
    const s = await section(page, scrollTo);
    if (s) y = Math.max(0, s.y - 20);
  }
  const file = await grab(page, name, { x: 0, y, width: 390, height });
  await ctx.close();
  return file;
}

(async () => {
  const want = (id) => !ONLY.length || ONLY.includes(id);
  const browser = await chromium.launch();
  const probe = await authedContext(browser, { width: 1440, height: 900 });
  const refs = cookieName ? await api(probe, '/planning/scenarios/reference') : [];
  const ref60 = refs.find((s) => s.reference_key === 'parish:60000');
  const list = cookieName ? await api(probe, '/planning/scenarios?limit=200') : [];
  const items = Array.isArray(list) ? list : list.items || [];
  const find = (label) => items.find((s) => s.label === label);
  const sites60 = find('Demo · Locais reais · 60 000 €/ano') || refs.find((s) => s.reference_key === 'sites:60000');
  const base = ref60 ? await api(probe, `/planning/scenarios/${ref60.id}`) : null;
  await probe.close();
  const k = base?.result.kpis;

  if (want('simulador') && ref60) {
    const f = await desktopShot(browser, `/pt/scenarios/${ref60.id}`, { height: 1500, name: 'simulador' });
    await compose(browser, 'pagina-simulador', renderHtml(
      head('Simulador', 'Orçamento de 60 000 €/ano, rede calculada',
        `Por freguesia: ${pt(k.tonnes_year)} t por ano a ${pt(k.eur_per_tonne)} €/t, custo de ${eur(k.annual_cost_eur)}, uma viatura de têxtil nova e nenhum contentor novo (estimativa).`) + frame(f, `${host}/pt/scenarios`)));
  }
  if (want('rotas') && sites60) {
    const f = await desktopShot(browser, `/pt/scenarios/${sites60.id}`, { height: 1650, tab: /Rede e rotas/, name: 'rotas' });
    const r = sites60.result || (await (async () => { const c = await authedContext(browser, { width: 1440, height: 900 }); const j = await api(c, `/planning/scenarios/${sites60.id}`); await c.close(); return j.result; })());
    const km = r.routes.reduce((a, x) => a + x.km, 0);
    await compose(browser, 'pagina-rotas', renderHtml(
      head('Rotas', 'As rotas seguem as estradas',
        `${r.routes.length} viagens da viatura de têxtil a partir de Polvoreira, ${pt(km, 0)} km no total de uma ronda, medidos pela estrada com OpenStreetMap. Traço cheio: segue as estradas; tracejado: estimativa.`) + frame(f, `${host}/pt/scenarios`)));
  }
  if (want('plano') && ref60) {
    const f = await desktopShot(browser, `/pt/scenarios/${ref60.id}`, { height: 1500, name: 'plano', clipSection: 'Plano da viatura' });
    await compose(browser, 'pagina-plano-recolha', renderHtml(
      head('Plano de recolha', 'Cada freguesia com o seu dia e os seus quilos', 'A viatura de têxtil passa num dia fixo por freguesia e recolhe o saco fechado à porta; nos locais que já existem, pára e recolhe no momento.') + frame(f, `${host}/pt/scenarios`)));
  }
  if (want('reutilizavel') && ref60) {
    const f = await desktopShot(browser, `/pt/scenarios/${ref60.id}`, { height: 1500, name: 'reut', clipSection: 'Têxtil reutilizável', minHeight: 1000 });
    await compose(browser, 'pagina-reutilizavel', renderHtml(
      head('Reutilização', 'Só conta o que se pode reutilizar', `Cada cenário mostra as toneladas reutilizáveis (${pt(k.reusable_t)} t neste) e o custo por tonelada reutilizável, com a quota de 2025 e o intervalo entre entidades (estimativa).`) + frame(f, `${host}/pt/scenarios`)));
  }
  if (want('cobertura') && ref60) {
    const f = await desktopShot(browser, `/pt/scenarios/${ref60.id}`, { height: 1500, tab: /Cobertura/, name: 'cob' });
    await compose(browser, 'pagina-cobertura', renderHtml(
      head('Cobertura', 'A rede não se fica pelas zonas fáceis', 'Os critérios do art. 22.º-C da diretiva, freguesia a freguesia: população, densidade, volume previsto e proximidade (estimativas).') + frame(f, `${host}/pt/scenarios`)));
  }
  if (want('incerteza') && ref60) {
    const f = await desktopShot(browser, `/pt/scenarios/${ref60.id}`, { height: 1700, tab: /Incerteza/, name: 'inc', wait: 8000 });
    await compose(browser, 'pagina-incerteza', renderHtml(
      head('Incerteza', 'E se os pressupostos estiverem errados?', 'O tornado mostra que pressuposto mais pesa e a simulação de Monte Carlo dá o intervalo do custo por tonelada (500 amostras, semente 7).') + frame(f, `${host}/pt/scenarios`)));
  }

  if (want('rastreio')) {
    const f = await desktopShot(browser, '/pt/lots/NOV-6EYRXN', { height: 1500, name: 'lot' });
    const ph = await phoneShot(browser, '/pt/passport/NOV-6EYRXN', { authed: false, height: 1700, name: 'passport' });
    await compose(browser, 'pagina-rastreio', renderHtml(
      head('Rastreio', 'Cada lote com QR e passaporte público', 'Lote de demonstração de 5 peças de lã e malhas, triadas com o modelo real e com a fotografia, o crédito e o histórico de cada peça (estimativa de peso).') +
      `<div class="duo"><div style="flex:1">${frame(f, `${host}/pt/lots/NOV-6EYRXN`)}<div class="cap">Página interna do lote, com QR, composição e fotografias</div></div><div style="width:420px"><div class="phone"><img src="${uri(ph)}"></div><div class="cap">Passaporte público, aberto pelo QR</div></div></div>`));
  }
  if (want('telemovel') && ref60 && sites60) {
    const a = await phoneShot(browser, '/pt/', { authed: false, height: 1500, name: 't1', vh: 1500 });
    const b = await phoneShot(browser, `/pt/scenarios/${ref60.id}`, { height: 1500, name: 't2' });
    const c = await phoneShot(browser, `/pt/scenarios/${sites60.id}`, { height: 1500, name: 't3', tab: /Rede e rotas/, scrollTo: 'A rede no mapa', vh: 3300 });
    await compose(browser, 'pagina-telemovel', renderHtml(
      head('Telemóvel', 'Pensado primeiro para o telemóvel', `Landing, resumo do cenário de 60 000 €/ano (${pt(k.tonnes_year)} t a ${pt(k.eur_per_tonne)} €/t) e as rotas por estrada, a 390 px de largura.`) +
      `<div class="trio">${[[a, 'Página de entrada'], [b, 'Resumo do cenário'], [c, 'Rotas por estrada']].map(([x, t]) => `<div style="width:420px"><div class="phone"><img src="${uri(x)}"></div><div class="cap">${t}</div></div>`).join('')}</div>`));
  }
  if (want('relatorio') && cookieName) {
    const pages = await lastReport(browser);
    await compose(browser, 'pagina-relatorio', renderHtml(
      head('Relatório RAP', 'Um PDF pronto para a câmara', 'Capa e resumo do relatório gerado pela aplicação: o têxtil por desviar, o recolhido, o custo por tipo de território e as rotas medidas pela estrada.') +
      `<div class="pages">${pages.map((x) => `<img src="${uri(x)}">`).join('')}</div>`));
  }
  if (want('triagem') && process.env.PHOTO) {
    const d = await runTriage(browser, { width: 1440, height: 2000 }, false);
    const f = await grab(d.page, 'tri-d', { x: 0, y: 0, width: 1440, height: 1500 });
    await d.ctx.close();
    const m = await runTriage(browser, { width: 390, height: 2200 }, true);
    const pf = await grab(m.page, 'tri-m', { x: 0, y: 0, width: 390, height: 1500 });
    await m.ctx.close();
    await compose(browser, 'pagina-triagem', renderHtml(
      head('Triagem', 'Uma fotografia dá a peça, a fibra e a marca', 'Controlo de qualidade na entrega, com o modelo de visão real: lê a etiqueta (marca e composição) e o operador confirma ou corrige. Peça: Ralph Lauren wool scarf (Amin, CC BY-SA 4.0, Wikimedia Commons).') +
      `<div class="duo"><div style="flex:1">${frame(f, `${host}/pt/triage`)}<div class="cap">No computador</div></div><div style="width:420px"><div class="phone"><img src="${uri(pf)}"></div><div class="cap">No telemóvel</div></div></div>`));
  }
  if (want('copiloto') && cookieName && ref60) {
    const ctx = await authedContext(browser, { width: 1440, height: 1400 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/pt/scenarios/${ref60.id}`, { waitUntil: 'domcontentloaded' });
    await settle(page, 5000);
    await page.getByRole('button', { name: /Abrir o copiloto/ }).first().click();
    await page.waitForTimeout(2000);
    const box = page.getByPlaceholder('Pergunta ao Novelo').last();
    await box.fill(process.env.QUESTION || 'E se o orçamento passar de 60 000 para 90 000 euros por ano?');
    await box.press('Enter');
    await page.waitForTimeout(75000);
    await settle(page, 2000);
    const f = await grab(page, 'chat', { x: 0, y: 0, width: 1440, height: 1200 });
    // apaga a conversa criada por esta captura (a mais recente, criada nos últimos 5 minutos)
    const threads = await api(ctx, '/copilot/threads');
    const rows = threads.items || threads;
    const recent = rows.filter((t) => Date.now() - new Date(t.updated_at || t.created_at).getTime() < 5 * 60 * 1000);
    for (const t of recent) await ctx.request.delete(`${BASE}/api/v1/copilot/threads/${t.id}`);
    // e o cenário que o copiloto criou nesta captura (rótulo «Copilot · …», criado nos últimos 10 minutos)
    const scs = await api(ctx, '/planning/scenarios?limit=200');
    for (const sc of (Array.isArray(scs) ? scs : scs.items).filter((x) => /^Copilot ·/.test(x.label) && Date.now() - new Date(x.created_at).getTime() < 10 * 60 * 1000)) {
      await ctx.request.delete(`${BASE}/api/v1/planning/scenarios/${sc.id}`);
    }
    await ctx.close();
    await compose(browser, 'pagina-copiloto', renderHtml(
      head('Copiloto', 'Pergunta em português, números verificados', 'O copiloto traduz a pergunta, corre o otimizador e explica a diferença; um verificador rejeita qualquer número que não esteja na origem.') + frame(f, `${host}/pt/scenarios`)));
  }

  if (want('metodo') || want('prova')) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, locale: 'pt-PT' });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/pt/`, { waitUntil: 'domcontentloaded' });
    await settle(page, 6000);
    for (const id of ['metodo', 'prova']) {
      if (!want(id)) continue;
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await page.waitForTimeout(2500);
      await page.locator(`#${id}`).screenshot({ path: path.join(OUT, `pagina-${id}.png`) });
      console.log('ok', `pagina-${id}`);
    }
    await ctx.close();
  }
  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
