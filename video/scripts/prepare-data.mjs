// Gera src/data/geo.json para o vídeo a partir dos dados reais: zonas e cenário de referência da API de dev
// (`just dev`) e o pacote municipal em data/processed. Corre com: node scripts/prepare-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';

// Dev: API local com o administrador de dev. Produção: API=https://novelo.helder.si/api/v1 e COOKIE_FILE com a linha
// `__Host-access_token=...` de um administrador (sessão de 15 min).
const API = process.env.API ?? 'http://localhost:8190/api/v1';
const ROOT = new URL('../../', import.meta.url).pathname;
const PROC = `${ROOT}data/processed`;

async function login() {
  if (process.env.COOKIE_FILE) return readFileSync(process.env.COOKIE_FILE, 'utf8').trim();
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Turnstile-Token': 'XXXX.DUMMY.TOKEN.XXXX' },
    body: JSON.stringify({ email: 'admin@heldergoncalves.io', password: 'admin-novelo-dev-1' }),
  });
  if (!res.ok) throw new Error(`login ${res.status}`);
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}
const cookie = await login();
const get = async (p) => {
  const r = await fetch(`${API}${p}`, { headers: { cookie } });
  if (!r.ok) throw new Error(`${p} ${r.status}`);
  return r.json();
};

function csv(path) {
  const [head, ...rows] = readFileSync(path, 'utf8').trim().split('\n');
  const cols = head.split(',');
  return rows.map((line) => {
    const out = [];
    let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return Object.fromEntries(cols.map((c, i) => [c, out[i]]));
  });
}

const zones = await get('/planning/zones');
const refs = await get('/planning/scenarios/reference');
const par60 = refs.find((s) => s.reference_key === 'parish:60000');
const scenario = await get(`/planning/scenarios/${par60.id}`);
const R = scenario.result;

// d3-geo quer anéis exteriores no sentido dos ponteiros do relógio (o GeoJSON da API vem ao contrário).
const area = (ring) => ring.reduce((acc, [x, y], i) => { const [x2, y2] = ring[(i + 1) % ring.length]; return acc + (x2 - x) * (y2 + y); }, 0);
const cw = (ring, outer) => ((area(ring) > 0) === outer ? ring : [...ring].reverse());
const rewind = (g) => g.type === 'Polygon'
  ? { ...g, coordinates: g.coordinates.map((r, i) => cw(r, i === 0)) }
  : { ...g, coordinates: g.coordinates.map((poly) => poly.map((r, i) => cw(r, i === 0))) };
const caop = JSON.parse(readFileSync(`${PROC}/caop_guimaraes.geojson`, 'utf8'));
const caopGeom = Object.fromEntries(caop.features.map((f) => [f.properties.dicofre, f.geometry]));
// Contornos oficiais CAOP 2019 (as zonas da API trazem a mesma geometria, menos em 3 uniões de freguesias).
for (const z of zones) z.geometry = rewind(caopGeom[z.code]);
const fc = { type: 'FeatureCollection', features: zones.map((z) => ({ type: 'Feature', properties: { code: z.code }, geometry: z.geometry })) };
const W = 1000;
const probe = geoMercator().fitWidth(W, fc);
const [[, y0], [, y1]] = geoPath(probe).bounds(fc);
const H = Math.ceil(y1 - y0);
const proj = geoMercator().fitSize([W, H], fc);
const path = geoPath(proj);
const r1 = (n) => Math.round(n * 10) / 10;
const pt = (lon, lat) => proj([lon, lat]).map(r1);

const alloc = Object.fromEntries(R.allocations.map((a) => [a.parish_code, a]));

const parishes = zones.map((z) => {
  const a = alloc[z.code];
  return {
    code: z.code,
    name: z.name,
    pop: z.population,
    tipau: z.tipau,
    d: path({ type: 'Feature', geometry: z.geometry }).replace(/(\d+\.\d)\d+/g, '$1'),
    c: pt(...geoCentroid({ type: 'Feature', geometry: z.geometry })),
    // canais do cenário nesta freguesia: saco à porta (on_demand) e/ou paragem em local existente (existing)
    onDemand: Boolean(a?.modes?.includes('on_demand')),
    existing: Boolean(a?.modes?.includes('existing')),
    mode: a?.mode ?? null,
    tonnes: a ? Math.round(a.tonnes * 10) / 10 : 0,
  };
});

const containers = csv(`${PROC}/municipal_containers.csv`)
  .filter((c) => c.coord_status === 'ok')
  .map((c) => [...pt(+c.longitude, +c.latitude), c.kind]);
const sites = csv(`${PROC}/municipal_sites.csv`);
const schools = sites.filter((s) => s.producer_types === 'Escola').map((s) => pt(+s.longitude, +s.latitude));

// Traçado pela estrada (OSRM) quando existe; senão as paragens em linha reta.
const routes = R.routes.map((r) => ({
  mode: r.mode,
  road: Boolean(r.road_path),
  stops: r.stops.map((s) => pt(s.longitude, s.latitude)),
  path: r.road_path ? r.path.map(([lat, lon]) => pt(lon, lat)) : null,
}));
const depot = pt(R.depot[1], R.depot[0]);

const out = {
  source: `API (zonas e cenário ${par60.reference_key}, ${par60.created_at}) e data/processed`,
  width: W,
  height: H,
  parishes,
  containers,
  containersTotal: csv(`${PROC}/municipal_containers.csv`).length,
  sitesTotal: sites.length,
  schools,
  routes,
  depot,
  kpis: R.kpis,
  modes: R.modes,
};
writeFileSync(new URL('../src/data/geo.json', import.meta.url), JSON.stringify(out));
console.log('geo.json', W, H, parishes.length, 'parishes', containers.length, 'containers', schools.length, 'schools', routes.length, 'routes',
  parishes.filter((p) => p.onDemand).length, 'on demand', parishes.filter((p) => p.existing).length, 'existing');
