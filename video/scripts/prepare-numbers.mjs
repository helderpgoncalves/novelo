// Números do vídeo e do deck, tirados da API de dev (`just dev`): cenário de referência de 60 000 €/ano por freguesia,
// a curva de custo (cenários por freguesia a vários orçamentos), a cobertura, o Monte Carlo e o piloto.
// Escreve src/data/numbers.json. Corre com: node scripts/prepare-numbers.mjs
import { writeFileSync } from 'node:fs';

const API = process.env.API ?? 'http://localhost:8190/api/v1';
const res = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Turnstile-Token': 'XXXX.DUMMY.TOKEN.XXXX' },
  body: JSON.stringify({ email: 'admin@heldergoncalves.io', password: 'admin-novelo-dev-1' }),
});
if (!res.ok) throw new Error(`login ${res.status}`);
const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
async function call(method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers: { cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${method} ${path} ${r.status} ${await r.text()}`);
  return r.json();
}

const refs = await call('GET', '/planning/scenarios/reference');
const ref60 = refs.find((s) => s.reference_key === 'parish:60000');
const s60 = await call('GET', `/planning/scenarios/${ref60.id}`);
const k = s60.result.kpis;

// Curva: o mesmo modelo por freguesia a outros orçamentos (reutiliza cenários já calculados com o mesmo rótulo).
const BUDGETS = [20000, 40000, 100000, 150000];
const existing = await call('GET', '/planning/scenarios?limit=200').catch(() => []);
const list = Array.isArray(existing) ? existing : (existing.items ?? []);
const curve = [];
for (const budget of BUDGETS) {
  const label = `Curva do vídeo · por freguesia · ${budget.toLocaleString('pt-PT')} €/ano · v5`;
  let sc = list.find((s) => s.label === label && s.status === 'computed');
  if (!sc) sc = await call('POST', '/planning/scenarios', { label, objective: 'max_tonnes', budget_eur_year: budget, siting: 'parish' });
  curve.push({ budget, tonnes: sc.tonnes_year, cost: sc.annual_cost_eur, eurPerT: sc.eur_per_tonne });
}
curve.push({ budget: 60000, tonnes: k.tonnes_year, cost: k.annual_cost_eur, eurPerT: k.eur_per_tonne });
curve.sort((a, b) => a.budget - b.budget);

const coverage = await call('GET', `/planning/scenarios/${ref60.id}/coverage`);
const sens = await call('POST', `/planning/scenarios/${ref60.id}/sensitivity`, { n_samples: 500, seed: 7, swing: 0.3 });
const pilot = await call('POST', '/planning/pilot', { k: 2, months: 3, modes: ['existing', 'on_demand'], n_samples: 500, seed: 7, swing: 0.3 });

const out = {
  source: `API de dev, cenário ${ref60.reference_key} (${ref60.created_at})`,
  scenario60: { id: ref60.id, budget: 60000, kpis: k, modes: s60.result.modes },
  curve,
  coverage: coverage.summary ?? coverage.by_type ?? coverage,
  sensitivity: sens.monte_carlo ?? sens.montecarlo ?? sens,
  pilot,
};
writeFileSync(new URL('../src/data/numbers.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('numbers.json', JSON.stringify(curve));
