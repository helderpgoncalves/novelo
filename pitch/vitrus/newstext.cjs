const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.join(__dirname, '../../apps/web/package.json'))('@playwright/test');
const URLS = {
  eco: 'https://eco.sapo.pt/2026/11/03/dois-jovens-de-barcelos-querem-desatar-o-no-da-recolha-de-residuos-texteis-em-guimaraes/',
  maisguimaraes: 'https://maisguimaraes.pt/dupla-de-barcelos-vence-hack4guimaraes-com-um-plano-para-recolher-mais-texteis-gastando-menos',
  ominho: 'https://ominho.pt/engenheiros-de-barcelos-ganham-premio-de-7-500-euros-por-inovacao-na-gestao-dos-residuos-texteis/',
  jornalt: 'https://jornal-t.pt/noticia/novelo-propoe-recolher-431-toneladas-de-texteis-por-ano-em-guimaraes/',
  radioaltominho: 'https://radioaltominho.pt/noticias/novelo-projeto-de-estudante-e-antigo-aluno-da-unipvc-vence-dois-premios-em-guimaraes/',
  oamarense: 'https://oamarense.pt/dois-jovens-de-barcelos-vencem-hack4guimaraes-2035-com-plataforma-para-recolha-de-residuos-texteis/',
};
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const ctx = await b.newContext({ locale: 'pt-PT', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36' });
  for (const [k, u] of Object.entries(URLS)) {
    const p = await ctx.newPage();
    try {
      await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 }); await p.waitForTimeout(2500);
      const t = await p.evaluate(() => { const h = document.querySelector('h1')?.innerText; const ps = [...document.querySelectorAll('article p, .entry-content p, .post-content p, main p')].map((x) => x.innerText.trim()).filter((x) => x.length > 60).slice(0, 7); return { h, ps }; });
      console.log('=====', k); console.log(t.h); t.ps.forEach((x) => console.log('-', x.slice(0, 420)));
    } catch (e) { console.log('FALHOU', k, String(e).slice(0, 80)); }
    await p.close();
  }
  await b.close();
})();
