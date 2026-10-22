import type { Kpis } from '@/client';

/** Têxtil reutilizável de um cenário, tal como a API o devolve, mais o intervalo do € por tonelada reutilizável. */
export interface ReusableSummary {
  /** Quotas de reutilização observadas em 2025 (0 a 1). */
  share: number;
  shareLow: number | null;
  shareHigh: number | null;
  tonnes: number;
  tonnesLow: number | null;
  tonnesHigh: number | null;
  eurPerTonne: number | null;
  /** € por tonelada reutilizável com a quota mais alta (o melhor caso) e com a mais baixa (o pior). */
  eurPerTonneLow: number | null;
  eurPerTonneHigh: number | null;
}

const per = (cost: number, tonnes: number | null | undefined) =>
  tonnes != null && tonnes > 0 ? cost / tonnes : null;

/**
 * Lê os KPIs de reutilização; `null` em cenários antigos (calculados antes de 22 out 2026, sem estes campos). O
 * intervalo do €/t é o custo anual a dividir pelas toneladas reutilizáveis alta e baixa: os mesmos números da API,
 * sem pressupostos novos.
 */
export function reusableSummary(kpis: Kpis): ReusableSummary | null {
  if (kpis.reusable_t == null || kpis.reuse_share == null) return null;
  return {
    share: kpis.reuse_share,
    shareLow: kpis.reuse_share_low ?? null,
    shareHigh: kpis.reuse_share_high ?? null,
    tonnes: kpis.reusable_t,
    tonnesLow: kpis.reusable_t_low ?? null,
    tonnesHigh: kpis.reusable_t_high ?? null,
    eurPerTonne: kpis.eur_per_reusable_t ?? per(kpis.annual_cost_eur, kpis.reusable_t),
    eurPerTonneLow: per(kpis.annual_cost_eur, kpis.reusable_t_high),
    eurPerTonneHigh: per(kpis.annual_cost_eur, kpis.reusable_t_low),
  };
}
