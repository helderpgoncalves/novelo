#!/usr/bin/env node
/** Capturas das notícias sobre o Novelo no Hack4Guimarães (img/news-*.png). Primeiro ecrã de cada artigo, 1440 × 810. */
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.join(__dirname, '../../apps/web/package.json'))('@playwright/test');
const OUT = path.join(__dirname, 'img');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const PAGES0 = [
  ['eco', 'https://eco.sapo.pt/2026/11/03/dois-jovens-de-barcelos-querem-desatar-o-no-da-recolha-de-residuos-texteis-em-guimaraes/'],
  ['maisguimaraes', 'https://maisguimaraes.pt/dupla-de-barcelos-vence-hack4guimaraes-com-um-plano-para-recolher-mais-texteis-gastando-menos'],
  ['ominho', 'https://ominho.pt/engenheiros-de-barcelos-ganham-premio-de-7-500-euros-por-inovacao-na-gestao-dos-residuos-texteis/'],
  ['jornalt', 'https://jornal-t.pt/noticia/novelo-propoe-recolher-431-toneladas-de-texteis-por-ano-em-guimaraes/'],
  ['portugaltextil', 'https://portugaltextil.com/novelo-quer-tornar-recolha-de-residuos-texteis-mais-eficiente/'],
  ['e24', 'https://e24.pt/guimaraes-plataforma-novelo-vence-hack4guimaraes-e-combate-lixo-textil/'],
  ['radioaltominho', 'https://radioaltominho.pt/noticias/novelo-projeto-de-estudante-e-antigo-aluno-da-unipvc-vence-dois-premios-em-guimaraes/'],
  ['fashionnetwork', 'https://pt.fashionnetwork.com/news/Hack4guimaraes-2035-engenheiros-de-barcelos-ganham-no-concurso-vimaranense-premio-de-7-500-euros-por-inovacao-na-gestao-dos-residuos-texteis-mais-1-000-pela-vitoria-no-desafio-da-vitrus-ambiente,1881327.html'],
  ['oamarense', 'https://oamarense.pt/dois-jovens-de-barcelos-vencem-hack4guimaraes-2035-com-plataforma-para-recolha-de-residuos-texteis/'],
  ['radiofundacao', 'https://radiofundacao.net/projeto-novelo-vence-o-hack4guimaraes-2035-e-o-desafio-textvitrus/'],
];
const PAGES = PAGES0.filter((p) => !ONLY.length || ONLY.includes(p[0]));
const HIDE = `[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],[id*="gdpr" i],[class*="gdpr" i],[class*="sp_message" i],[id*="sp_message" i],[class*="didomi" i],[id*="didomi" i],[class*="cmp" i][class*="banner" i],[class*="popup" i],[class*="modal" i],[class*="newsletter" i]{display:none !important}html,body{overflow:auto !important}`;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1.5, locale: 'pt-PT', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' });
  for (const [name, url] of PAGES) {
    const page = await ctx.newPage();
    try {
      const r = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(3500);
      for (const t of ['Não consentir', 'Recusar', 'Rejeitar', 'Aceitar', 'Aceito', 'Concordo', 'Accept', 'Aceitar todos', 'Permitir']) {
        const b = page.getByRole('button', { name: new RegExp(`^${t}`, 'i') }).first();
        if (await b.count().catch(() => 0)) { await b.click({ timeout: 1500 }).catch(() => {}); break; }
      }
      await page.addStyleTag({ content: HIDE }).catch(() => {});
      await page.evaluate(() => { for (const e of document.querySelectorAll('*')) { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); if ((cs.position === 'fixed' || cs.position === 'sticky') && r.top > 120 && r.width > 200) e.remove(); } document.body.style.overflow = 'auto'; }).catch(() => {});
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, `news-${name}.png`) });
      console.log('ok', name, r && r.status(), (await page.title()).slice(0, 70));
    } catch (e) { console.log('FALHOU', name, String(e).slice(0, 100)); }
    await page.close();
  }
  await browser.close();
})();
