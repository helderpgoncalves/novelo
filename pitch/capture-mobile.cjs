#!/usr/bin/env node
/**
 * Capturas de telemóvel uniformes para o deck (pitch/assets/m-*.png): mesmo ecrã (390 × 844 px a 3x, só o que se vê
 * sem fazer scroll), mesma moldura, mesma proporção. Vêm da produção.
 *
 *   COOKIE_FILE=/caminho/sessao.txt node capture-mobile.cjs      (COOKIE_FILE: linha `access_token=...` de um admin)
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
const sharp = require('sharp');
const { chromium } = createRequire(path.join(__dirname, '../apps/web/package.json'))('@playwright/test');

const BASE = (process.env.BASE || 'https://novelo.helder.si').replace(/\/$/, '');
const LOT = process.env.LOT || 'NOV-6EYRXN';
const OUT = path.join(__dirname, 'assets');
const host = new URL(BASE).hostname;
const line = fs.readFileSync(process.env.COOKIE_FILE, 'utf8').trim();
const cookie = { name: line.split('=')[0], value: line.slice(line.indexOf('=') + 1) };
const W = 390;
const H = 844;
const S = 3;
fs.mkdirSync(OUT, { recursive: true });

const ctxOf = (browser, authed) =>
  browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: S, locale: 'pt-PT', isMobile: true, hasTouch: true }).then(async (ctx) => {
    if (authed) await ctx.addCookies([{ ...cookie, domain: host, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }, { name: 'novelo_session', value: '1', domain: host, path: '/', secure: true }]);
    return ctx;
  });

const settle = async (page, ms = 4500) => {
  await page.waitForTimeout(ms);
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}[data-slot="avatar"] img{display:none!important}' });
};

async function scrollToHeading(page, text, offset = 16) {
  await page.evaluate(({ text, offset }) => {
    const h = [...document.querySelectorAll('h1,h2,h3')].find((e) => e.textContent?.trim().startsWith(text));
    if (h) window.scrollTo(0, Math.max(0, h.getBoundingClientRect().top + window.scrollY - offset));
  }, { text, offset });
  await page.waitForTimeout(1500);
}

// Moldura de telemóvel igual para todas: ecrã com cantos arredondados dentro de uma borda escura.
async function phone(file, out) {
  const B = 14 * S;
  const w = W * S;
  const h = H * S;
  const R = 54 * S;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${R - B}" fill="#fff"/></svg>`);
  const screen = await sharp(file).resize(w, h).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const body = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w + 2 * B}" height="${h + 2 * B}"><rect width="${w + 2 * B}" height="${h + 2 * B}" rx="${R}" fill="#14211D"/></svg>`);
  await sharp(body).composite([{ input: screen, left: B, top: B }]).png().toFile(path.join(OUT, out));
  console.log(out);
}

(async () => {
  const browser = await chromium.launch();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novelo-m-'));
  const snap = async (page, name) => {
    const f = path.join(tmp, `${name}.png`);
    await page.screenshot({ path: f, type: 'png' });
    return f;
  };
  const api = async (ctx, p) => (await ctx.request.get(`${BASE}/api/v1${p}`)).json();

  const auth = await ctxOf(browser, true);
  const refs = await api(auth, '/planning/scenarios/reference');
  const ref60 = refs.find((s) => s.reference_key === 'parish:60000');
  const page = await auth.newPage();
  await page.goto(`${BASE}/pt/scenarios/${ref60.id}`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await phone(await snap(page, 'resumo'), 'm-resumo.png');
  await page.getByRole('tab', { name: /Rede e rotas/ }).click();
  await settle(page, 7000);
  await page.getByText('Mostrar rotas').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => { const m = document.querySelector('.maplibregl-map, .maplibregl-canvas'); if (m) m.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(3500);
  await phone(await snap(page, 'rotas'), 'm-rotas.png');

  // Passaporte público (sem sessão) e a fotografia de uma peça para a triagem.
  const pub = await ctxOf(browser, false);
  const pp = await pub.newPage();
  await pp.goto(`${BASE}/pt/passport/${LOT}`, { waitUntil: 'domcontentloaded' });
  await settle(pp);
  await phone(await snap(pp, 'passaporte'), 'm-passaporte.png');
  await scrollToHeading(pp, 'Fotografias das peças');
  await phone(await snap(pp, 'fotos'), 'm-fotos.png');
  const src = await pp.locator('img[src*="photo"]').nth(3).getAttribute('src');
  const photo = path.join(tmp, 'peca.jpg');
  fs.writeFileSync(photo, await (await pub.request.get(new URL(src, BASE).href)).body());

  const tri = await auth.newPage();
  await tri.goto(`${BASE}/pt/triage`, { waitUntil: 'domcontentloaded' });
  await settle(tri, 5000);
  await tri.locator('input[type=file]').first().setInputFiles(photo);
  await tri.waitForTimeout(1200);
  await tri.getByRole('button', { name: /Analisar peça/ }).click();
  await tri.waitForSelector('text=/Confiança|confiança/', { timeout: 90000 }).catch(() => {});
  await settle(tri, 3000);
  await scrollToHeading(tri, 'Confirma a peça');
  await phone(await snap(tri, 'triagem'), 'm-triagem.png');
  await browser.close();
})();
