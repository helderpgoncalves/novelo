// Capturas da produção para as cenas especiais do vídeo (copiloto, triagem, lote, passaporte, relatório RAP) →
// public/shots. Precisa do cookie de um administrador (sessão de 15 min criada no contentor da API) e de `pdftoppm`.
//   BASE=https://novelo.helder.si COOKIE_FILE=/caminho/sessao.txt node scripts/capture-ops.mjs [copiloto,triagem,lote,relatorio]
// A conversa e o cenário que o copiloto cria nesta captura são apagados no fim.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const BASE = (process.env.BASE ?? 'https://novelo.helder.si').replace(/\/$/, '');
const LOT = process.env.LOT ?? 'NOV-6EYRXN';
const OUT = new URL('../public/shots/', import.meta.url).pathname;
const OPS = `${OUT}ops/`;
mkdirSync(OPS, { recursive: true });
const host = new URL(BASE).hostname;
const line = readFileSync(process.env.COOKIE_FILE, 'utf8').trim();
const cookie = { name: line.split('=')[0], value: line.slice(line.indexOf('=') + 1) };
const only = process.argv[2]?.split(',');
const want = (id) => !only || only.includes(id);
const tmp = path.join(tmpdir(), `novelo-ops-${Date.now()}`);
mkdirSync(tmp);

const b = await chromium.launch();
const ctxOf = async (viewport, dsf, mobile, authed = true) => {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: dsf, locale: 'pt-PT', timezoneId: 'Europe/Lisbon', colorScheme: 'light', isMobile: mobile, hasTouch: mobile });
  if (authed) await ctx.addCookies([{ ...cookie, domain: host, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }, { name: 'novelo_session', value: '1', domain: host, path: '/', secure: true }]);
  await ctx.addInitScript(() => { try { localStorage.setItem('novelo-theme', 'light'); } catch {} });
  return ctx;
};
const settle = async (page, ms = 4500) => {
  await page.waitForTimeout(ms);
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}::-webkit-scrollbar{display:none!important}[data-slot="avatar"] img{display:none!important}[data-sonner-toaster],[data-testid=starter-checklist]{display:none!important}' });
};
const api = async (ctx, p) => (await ctx.request.get(`${BASE}/api/v1${p}`)).json();
const heading = (page, text, offset = 16) => page.evaluate(({ text, offset }) => {
  const h = [...document.querySelectorAll('h1,h2,h3')].find((e) => e.textContent?.trim().startsWith(text));
  if (h) h.scrollIntoView({ block: 'start' });
  void offset;
}, { text, offset });

const auth = await ctxOf({ width: 1440, height: 900 }, 2, false);
const refs = await api(auth, '/planning/scenarios/reference');
const ref60 = refs.find((s) => s.reference_key === 'parish:60000');

if (want('copiloto')) {
  const ctx = await ctxOf({ width: 1440, height: 900 }, 2, false);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/pt/scenarios/${ref60.id}`, { waitUntil: 'domcontentloaded' });
  await settle(page, 5000);
  await page.getByRole('button', { name: /Abrir o copiloto/ }).first().click();
  await page.waitForTimeout(2000);
  const box = page.getByPlaceholder('Pergunta ao Novelo').last();
  await box.fill(process.env.QUESTION ?? 'E se o orçamento passar de 60 000 para 90 000 euros por ano?');
  await box.press('Enter');
  await page.waitForTimeout(75000);
  await settle(page, 2000);
  await page.screenshot({ path: `${OUT}copilot-desktop.png` });
  const panel = page.locator('[role=dialog]').last();
  const box2 = await panel.boundingBox();
  if (box2) await page.screenshot({ path: `${OUT}copilot-panel.png`, clip: { x: box2.x, y: box2.y, width: box2.width, height: Math.min(box2.height, 900 - box2.y) } });
  const threads = await api(ctx, '/copilot/threads');
  for (const t of (threads.items ?? threads).filter((x) => Date.now() - new Date(x.updated_at ?? x.created_at).getTime() < 5 * 60 * 1000)) await ctx.request.delete(`${BASE}/api/v1/copilot/threads/${t.id}`);
  const scs = await api(ctx, '/planning/scenarios?limit=200');
  for (const sc of (Array.isArray(scs) ? scs : scs.items).filter((x) => /^Copilot ·/.test(x.label) && Date.now() - new Date(x.created_at).getTime() < 10 * 60 * 1000)) await ctx.request.delete(`${BASE}/api/v1/planning/scenarios/${sc.id}`);
  await ctx.close();
  console.log('copiloto');
}

let photo = null;
const pub = await ctxOf({ width: 390, height: 844 }, 3, true, false);
const pp = await pub.newPage();
await pp.goto(`${BASE}/pt/passport/${LOT}`, { waitUntil: 'domcontentloaded' });
await settle(pp);
if (want('lote')) {
  await pp.screenshot({ path: `${OPS}passport-mobile.png` });
  console.log('passaporte');
}
const src = await pp.locator('img[src*="photo"]').nth(3).getAttribute('src');
photo = path.join(tmp, 'peca.jpg');
writeFileSync(photo, await (await pub.request.get(new URL(src, BASE).href)).body());

if (want('lote')) {
  const ctx = await ctxOf({ width: 1440, height: 900 }, 2, false);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/pt/lots/${LOT}`, { waitUntil: 'domcontentloaded' });
  await settle(page, 5000);
  await page.screenshot({ path: `${OPS}lot-desktop.png` });
  await ctx.close();
  console.log('lote');
}

if (want('triagem')) {
  for (const [name, viewport, dsf, mobile] of [['desktop', { width: 1440, height: 900 }, 2, false], ['mobile', { width: 390, height: 844 }, 3, true]]) {
    const ctx = await ctxOf(viewport, dsf, mobile);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/pt/triage`, { waitUntil: 'domcontentloaded' });
    await settle(page, 5000);
    await page.locator('input[type=file]').first().setInputFiles(photo);
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /Analisar peça/ }).click();
    await page.waitForSelector('text=/Confiança|confiança/', { timeout: 90000 }).catch(() => {});
    await settle(page, 3000);
    if (mobile) await heading(page, 'Confirma a peça');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OPS}triage-${name}.png` });
    await ctx.close();
    console.log('triagem', name);
  }
}

if (want('relatorio')) {
  const reports = await api(auth, '/reports');
  const pdf = await auth.request.get(`${BASE}/api/v1/reports/${(reports.items ?? reports)[0].id}/pdf`);
  const file = path.join(tmp, 'rap.pdf');
  writeFileSync(file, await pdf.body());
  execFileSync('pdftoppm', ['-r', '110', '-png', '-f', '1', '-l', '3', file, path.join(tmp, 'rap')]);
  readdirSync(tmp).filter((f) => /^rap-\d+\.png$/.test(f)).sort().forEach((f, i) => copyFileSync(path.join(tmp, f), `${OUT}p-${i + 1}.png`));
  console.log('relatorio');
}
await b.close();
