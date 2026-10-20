// Pré-render leve, depois de `vite build`: escreve dist/{pt,en}/index.html (landing, com resumo semântico) e as páginas
// públicas (login, registo, privacidade, termos) com `<head>` localizado, mais o sitemap.xml. Zero dependências.
// O nginx serve `<rota>/index.html` antes do fallback do SPA (ver nginx.conf). Funções puras em seo-core.mjs.
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALE_IDS, LOCALES, ROUTES, buildSitemap, renderRoute } from './seo-core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const base = readFileSync(join(dist, 'index.html'), 'utf8');

const lastmod = (() => {
  if (process.env.SITE_LASTMOD) return process.env.SITE_LASTMOD;
  try {
    return execSync('git log -1 --format=%cs -- apps/web', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || new Date().toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
})();

let written = 0;
for (const locale of LOCALE_IDS) {
  const messages = JSON.parse(readFileSync(join(root, 'messages', `${LOCALES[locale].file}.json`), 'utf8'));
  for (const route of ROUTES) {
    const dir = join(dist, LOCALES[locale].prefix, route.path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), renderRoute(base, route, locale, messages));
    written++;
  }
}
writeFileSync(join(dist, 'sitemap.xml'), buildSitemap(lastmod));
console.log(`prerender: ${written} páginas e sitemap.xml (lastmod ${lastmod})`);
