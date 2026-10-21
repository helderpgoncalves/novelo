// Gera os dados estáticos da landing a partir de data/processed (geometria das freguesias e localidades) e do repositório
// (contagem de testes). O resultado é versionado em src/features/landing/data/: o build do web não precisa da API nem de
// data/. Correr à mão quando os dados ou o número de testes mudarem: `node scripts/gen-landing-data.mjs`.
// Gera três ficheiros: guimaraes-map.json (freguesias, localidades e totais municipais, importado já), guimaraes-sites.json
// (os locais públicos com o têxtil estimado, carregado só quando o mapa se aproxima) e quality.json (testes).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

// ---- Locais municipais (Vitrus, 20 out 2026): onde o têxtil se perde no lixo e onde a viatura já passa.
// CSV com aspas (nomes de produtores e ruas com vírgulas): leitor mínimo RFC 4180.
function readCsv(file) {
  const text = readFileSync(join(repo, 'data/processed', file), 'utf8');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const allSites = readCsv('municipal_sites.csv');
const containers = readCsv('municipal_containers.csv');
const containersTotal = containers.length;
const byParish = readCsv('municipal_by_parish.csv');
// Procura por ponto, como o modelo (docs/engenharia/dados-e-modelo.md, secção 8; site_service.py, `capacity_weights`): cada
// freguesia reparte o têxtil que ainda vai para o lixo (`textile_gap_t_estimate`) pelos seus locais não-produtores com
// contentores, na proporção da CAPACIDADE (litros); litros desconhecidos = mediana do tipo de contentor (sem nenhum valor
// no tipo: a mediana de todos). Estimativa.
const median = (xs) => {
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length === 0 ? 0 : v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const knownByKind = new Map();
for (const c of containers)
  if (c.capacity_litres !== '') knownByKind.set(c.kind, [...(knownByKind.get(c.kind) ?? []), Number(c.capacity_litres)]);
const medianByKind = new Map([...knownByKind].map(([k, v]) => [k, median(v)]));
const medianAll = median(containers.filter((c) => c.capacity_litres !== '').map((c) => Number(c.capacity_litres)));
const litres = new Map();
for (const c of containers) {
  if (!c.site_id) continue;
  const l = c.capacity_litres !== '' ? Number(c.capacity_litres) : (medianByKind.get(c.kind) ?? medianAll);
  litres.set(c.site_id, (litres.get(c.site_id) ?? 0) + l);
}
const demandSites = allSites.filter(
  (r) => r.site_class !== 'producer' && Number(r.containers) > 0 && (litres.get(r.site_id) ?? 0) > 0,
);
const gapByCaop = new Map(byParish.map((r) => [r.dicofre_caop, Number(r.textile_gap_t_estimate)]));
const caopToMapId = new Map(byParish.map((r) => [r.dicofre_caop, r.dicofre]));
const weight = new Map();
for (const r of demandSites) weight.set(r.parish_dicofre, (weight.get(r.parish_dicofre) ?? 0) + litres.get(r.site_id));
const parishIndex = new Map(parishes.map((p, i) => [p.id, i]));
const pts = demandSites.map((r) => {
  const t = ((gapByCaop.get(r.parish_dicofre) ?? 0) * litres.get(r.site_id)) / weight.get(r.parish_dicofre);
  const pi = parishIndex.get(caopToMapId.get(r.parish_dicofre));
  if (pi === undefined) throw new Error(`freguesia sem geometria: ${r.parish_dicofre}`);
  return { x: px(Number(r.longitude)), y: py(Number(r.latitude)), t, pi };
});
// Centro da onda de entrada: centroide dos locais pesado pelo têxtil (cai no centro da cidade). Dez anéis por distância.
const tSum = pts.reduce((s, p) => s + p.t, 0);
const cx = pts.reduce((s, p) => s + p.x * p.t, 0) / tSum;
const cy = pts.reduce((s, p) => s + p.y * p.t, 0) / tSum;
const dist = (p) => Math.hypot(p.x - cx, p.y - cy);
const maxD = Math.max(...pts.map(dist));
// Menos têxtil primeiro: os pontos maiores ficam por cima.
pts.sort((a, b) => a.t - b.t);
const sitesOut = {
  center: [Math.round(cx), Math.round(cy)],
  // [x, y, têxtil em décimos de tonelada por ano, índice da freguesia em guimaraes-map.json, anel 0-9]
  points: pts.map((p) => [p.x, p.y, Math.max(1, Math.round(p.t * 10)), p.pi, Math.min(9, Math.floor((dist(p) / maxD) * 10))]),
  // Por freguesia (mesma ordem de guimaraes-map.json): têxtil por desviar (décimos de t) e locais com procura.
  parishes: parishes.map((p) => {
    const row = byParish.find((r) => r.dicofre === p.id);
    return [Math.round(Number(row.textile_gap_t_estimate) * 10), pts.filter((q) => q.pi === parishIndex.get(p.id)).length];
  }),
};
writeFileSync(join(out, 'guimaraes-sites.json'), `${JSON.stringify(sitesOut)}\n`);
const municipal = { sites: allSites.length, demandSites: demandSites.length, containers: containersTotal };
writeFileSync(join(out, 'guimaraes-map.json'), `${JSON.stringify({ width: W, height: H, parishes, places, municipal })}\n`);


// ---- Testes: os números que os próprios executores contam (pytest recolhe os parametrizados; o Vitest corre os casos).
const api = Number(/(\d+) tests? collected/.exec(
  execSync('uv run pytest --collect-only -q', { cwd: join(repo, 'apps/api'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
)?.[1]);
const vitestOut = join(tmpdir(), `novelo-vitest-${process.pid}.json`);
execSync(`pnpm exec vitest run --reporter=json --outputFile=${vitestOut}`, { cwd: join(repo, 'apps/web'), stdio: 'ignore' });
const web = JSON.parse(readFileSync(vitestOut, 'utf8')).numTotalTests;
if (!api || !web) throw new Error('contagem de testes falhou');
const date = execSync('date +%Y-%m-%d').toString().trim();
writeFileSync(join(out, 'quality.json'), `${JSON.stringify({ api, web, date })}\n`);
console.log({ parishes: parishes.length, places: places.length, ...municipal, points: pts.length, bytes: JSON.stringify(sitesOut).length, size: [W, H], api, web, date });
