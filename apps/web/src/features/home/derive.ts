import type { FrontierPoint, OverviewMilestone, OverviewParish, OverviewReference } from '@/client';

/** Localizações dos contentores chegam nesta data (AGENTS.md, "Regra zero"). */
export const CONTAINERS_ARRIVAL = '2026-10-20';

const DAY_MS = 86_400_000;

/** Dias de calendário entre hoje (hora local) e uma data ISO; negativo se já passou. */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const [y, mo, d] = isoDate.split('-').map(Number);
  const target = Date.UTC(y ?? 0, (mo ?? 1) - 1, d ?? 1);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / DAY_MS);
}

/** A referência externa verificada usada no gancho: França, senão UE-27, senão a primeira verificada. */
export function pickBenchmark(references: OverviewReference[]): OverviewReference | undefined {
  const verified = references.filter((r) => r.verified && r.scope !== 'municipality');
  return (
    verified.find((r) => r.key === 'france_2024') ??
    verified.find((r) => r.key === 'eu27_2020') ??
    verified[0]
  );
}

/** A referência "Guimarães hoje" (dado Vitrus). */
export const pickSelf = (references: OverviewReference[]): OverviewReference | undefined =>
  references.find((r) => r.key === 'guimaraes_2025');

/** O marco em que passam a pagar os produtores (RAP), a data final do relógio. */
export const pickEprMilestone = (timeline: OverviewMilestone[]): OverviewMilestone | undefined =>
  timeline.find((t) => t.who_pays === 'producers');

export interface FrontierStats {
  total: number;
  pareto: FrontierPoint[];
  minEur: number;
  maxEur: number;
  minTonnes: number;
  maxTonnes: number;
}

/** Resumo da fronteira: só cenários viáveis com €/t conhecido entram nos eixos. */
export function frontierStats(points: FrontierPoint[]): FrontierStats | null {
  const usable = points.filter((p) => p.status === 'feasible' && p.eur_per_tonne !== null);
  const pareto = usable.filter((p) => p.is_pareto).sort((a, b) => a.tonnes_year - b.tonnes_year);
  if (pareto.length === 0) return null;
  const eur = pareto.map((p) => p.eur_per_tonne ?? 0);
  const tonnes = pareto.map((p) => p.tonnes_year);
  return {
    total: usable.length,
    pareto,
    minEur: Math.min(...eur),
    maxEur: Math.max(...eur),
    minTonnes: Math.min(...tonnes),
    maxTonnes: Math.max(...tonnes),
  };
}

/** Freguesias por potencial decrescente e a quota das `n` maiores. */
export function rankParishes(parishes: OverviewParish[], n = 5) {
  const sorted = [...parishes].sort((a, b) => b.potential_t - a.potential_t);
  const total = sorted.reduce((s, p) => s + p.potential_t, 0);
  const top = sorted.slice(0, n).reduce((s, p) => s + p.potential_t, 0);
  return { sorted, topSharePct: total > 0 ? (top / total) * 100 : 0, topCount: n };
}
