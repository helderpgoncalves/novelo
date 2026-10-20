// Pré-render leve, depois de `vite build`: escreve dist/{pt,en}/index.html (landing, com resumo semântico) e as páginas
// públicas (login, registo, privacidade, termos, créditos) com `<head>` localizado, mais o sitemap.xml. Zero dependências.
// O nginx serve `<rota>/index.html` antes do fallback do SPA (ver nginx.conf). Funções puras em seo-core.mjs.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALE_IDS, LOCALES, ROUTES, auditHtml, buildSitemap, renderRoute, routePath } from './seo-core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const base = readFileSync(join(dist, 'index.html'), 'utf8');

/** JS do pacote da landing (chunk lazy + dependências estáticas que o arranque ainda não carrega), via manifesto do Vite. */
function landingChunks() {
  const file = join(dist, '.vite', 'manifest.json');
  if (!existsSync(file)) return [];
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  const entry = Object.values(manifest).find((c) => c.src?.endsWith('features/landing/landing-page.tsx'));
  if (!entry) throw new Error('prerender: pacote da landing não encontrado no manifesto do Vite');
  const seen = new Set();
  const walk = (chunk) => {
    for (const key of chunk.imports ?? []) {
      if (!seen.has(key)) {
        seen.add(key);
        walk(manifest[key]);
      }
    }
  };
  walk(entry);
  const loaded = new Set(base.match(/\/assets\/[^"']+\.js/g) ?? []);
  const hrefs = [entry.file, ...[...seen].map((k) => manifest[k].file)].map((f) => `/${f}`);
  return hrefs.filter((h) => !loaded.has(h));
}
const chunks = landingChunks();
/** `<link rel="preload" as="image">` do hero: vêm do manifesto das fotografias (nomes com hash), nunca escritos à mão. */
const heroLinks = JSON.parse(readFileSync(join(root, 'public', 'landing', 'manifest.json'), 'utf8')).preload ?? [];
if (!heroLinks.length) throw new Error('prerender: public/landing/manifest.json sem `preload` (corre `just brand-landing`)');
rmSync(join(dist, '.vite'), { recursive: true, force: true });

const failures = [];
const baseProblems = auditHtml(base);
if (baseProblems.length) failures.push(`index.html: ${baseProblems.join('; ')}`);

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
    const dir = join(dist, LOCALES[locale].prefix, routePath(locale, route));
    mkdirSync(dir, { recursive: true });
    const html = renderRoute(base, route, locale, messages, chunks, heroLinks);
    const problems = auditHtml(html, { publicPage: true });
    if (problems.length) failures.push(`${LOCALES[locale].prefix}/${routePath(locale, route)}: ${problems.join('; ')}`);
    writeFileSync(join(dir, 'index.html'), html);
    written++;
  }
}
if (failures.length) {
  console.error(`prerender: HTML inseguro para a CSP (sem scripts inline):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
writeFileSync(join(dist, 'sitemap.xml'), buildSitemap(lastmod));
console.log(`prerender: ${written} páginas e sitemap.xml (lastmod ${lastmod})`);
