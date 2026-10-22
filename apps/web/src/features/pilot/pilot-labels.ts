import type { PilotFact, PilotKpiOut } from '@/client';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';

const FACT_LABEL: Record<string, () => string> = {
  population: () => m.pilot_fact_population(),
  density: () => m.pilot_fact_density(),
  service_days: () => m.pilot_fact_service_days(),
  demand_t: () => m.pilot_fact_demand_t(),
  startup_cost_eur: () => m.pilot_fact_startup_cost_eur(),
  reject_share_pct: () => m.pilot_fact_reject_share_pct(),
  half_width_pp: () => m.pilot_fact_half_width_pp(),
  z: () => m.pilot_fact_z(),
  design_effect: () => m.pilot_fact_design_effect(),
  pieces_per_cell: () => m.pilot_fact_pieces_per_cell(),
  piece_kg: () => m.pilot_fact_piece_kg(),
  tonnes_per_cell: () => m.pilot_fact_tonnes_per_cell(),
  cells: () => m.pilot_fact_cells(),
};

export const factLabel = (key: string): string => FACT_LABEL[key]?.() ?? key;

/** Valor com a unidade que a API enviou (as unidades vêm junto do número, com a sua fonte). */
export function factValue(fact: PilotFact): string {
  const digits = Number.isInteger(fact.value) ? 0 : fact.value < 1 ? 3 : 2;
  if (!fact.unit) return formatNumber(fact.value, digits);
  return `${formatNumber(fact.value, digits)}${fact.unit === '%' ? '' : ' '}${fact.unit}`;
}

export const kpiLabel: Record<PilotKpiOut['key'], () => string> = {
  tonnes: () => m.pilot_kpi_tonnes(),
  eur_per_tonne: () => m.pilot_kpi_eur_per_tonne(),
  reject_rate_pct: () => m.pilot_kpi_reject(),
};

export function kpiValue(kpi: PilotKpiOut, value: number): string {
  const digits = kpi.key === 'eur_per_tonne' ? 0 : 1;
  // Percentagem colada ao número, como no resto da app («14,1%»); as outras unidades levam espaço.
  const sep = kpi.unit === '%' ? '' : '\u00a0';
  return `${formatNumber(value, digits)}${sep}${kpi.unit}`;
}
