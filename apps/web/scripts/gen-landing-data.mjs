// Gera os dados estáticos da landing a partir de data/processed (geometria das freguesias e localidades) e do repositório
// (contagem de testes). O resultado é versionado em src/features/landing/data/: o build do web não precisa da API nem de
// data/. Correr à mão quando os dados ou o número de testes mudarem: `node scripts/gen-landing-data.mjs`.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = new URL('../../../', import.meta.url).pathname;
const out = new URL('../src/features/landing/data/', import.meta.url).pathname;

// ---- Mapa: CAOP 2019 simplificado (Douglas-Peucker) e projetado (equirretangular) para um viewBox de 1000 de largura.
const caop = JSON.parse(readFileSync(join(repo, 'data/processed/caop_guimaraes.geojson'), 'utf8'));
const rings = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).flat();
let minX = 180, maxX = -180, minY = 90, maxY = -90;
for (const f of caop.features)
  for (const r of rings(f.geometry))
    for (const [x, y] of r) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
const scale = 1000 / ((maxX - minX) * k);
const W = 1000;
const H = Math.round((maxY - minY) * scale);
const px = (x) => Math.round((x - minX) * k * scale);
const py = (y) => Math.round((maxY - y) * scale);

function dp(points, eps) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  let idx = -1, max = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1e-12;
    const d = Math.abs(dy * x - dx * y + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [a, b];
  return [...dp(points.slice(0, idx + 1), eps).slice(0, -1), ...dp(points.slice(idx), eps)];
}
// Densidade (habitantes por hectare, INE × área CAOP) em quintis 0-4: dá o tamanho dos pontos do mapa em meio-tom.
const density = (f) => f.properties.population / f.properties.area_ha;
const sorted = caop.features.map(density).sort((a, b) => a - b);
const bucket = (f) => Math.min(4, Math.floor((sorted.indexOf(density(f)) / sorted.length) * 5));
const parishes = caop.features.map((f) => ({
  id: String(f.properties.dicofre),
  name: f.properties.name_short ?? f.properties.name,
  pop: f.properties.population,
  b: bucket(f),
  d: rings(f.geometry)
    .map((r) => {
      // Anel fechado (primeiro = último ponto): simplifica cada metade em separado.
      const full = r.map(([x, y]) => [px(x), py(y)]);
      const mid = Math.floor(full.length / 2);
      const pts = [...dp(full.slice(0, mid + 1), 1.1).slice(0, -1), ...dp(full.slice(mid), 1.1)];
      const uniq = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
      return uniq.length < 3 ? '' : `M${uniq.map((p) => p.join(' ')).join('L')}Z`;
    })
    .join(''),
}));
const places = readFileSync(join(repo, 'data/processed/localities_geo.csv'), 'utf8')
  .trim().split('\n').slice(1)
  .map((l) => l.split(','))
  .filter((c) => c[1] && c[2])
  .map((c) => [px(Number(c[2])), py(Number(c[1]))]);
writeFileSync(join(out, 'guimaraes-map.json'), `${JSON.stringify({ width: W, height: H, parishes, places })}\n`);

// ---- Testes: contagem de funções de teste (API) e de casos (web).
const walk = (dir, accept) =>
  readdirSync(dir).flatMap((n) => {
    if (['node_modules', '__pycache__', '.venv', 'dist'].includes(n)) return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, accept) : accept(p) ? [p] : [];
  });
const count = (files, re) => files.reduce((s, f) => s + (readFileSync(f, 'utf8').match(re) ?? []).length, 0);
const api = count(walk(join(repo, 'apps/api/tests'), (p) => p.endsWith('.py')), /^\s*(?:async )?def test_/gm);
const web = count(walk(join(repo, 'apps/web/src'), (p) => /\.test\.tsx?$/.test(p)), /^\s*(?:it|test)(?:\.each\([^)]*\))?\(/gm);
const date = execSync('date +%Y-%m-%d').toString().trim();
writeFileSync(join(out, 'quality.json'), `${JSON.stringify({ api, web, date })}\n`);
console.log({ parishes: parishes.length, places: places.length, size: [W, H], api, web, date });
