import type { CalibrationReadingOut } from '@/client';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';

const METRIC_LABEL: Record<CalibrationReadingOut['metric'], () => string> = {
  generation_rate: m.metric_generation_rate,
  kg_per_bag: m.metric_kg_per_bag,
  bags_per_round: m.metric_bags_per_round,
  requests_per_week: m.metric_requests_per_week,
  on_demand_capture: m.metric_on_demand_capture,
};

/** O rótulo da métrica em pt-PT (a captura derivada vem assinalada como tal — nunca é medida). */
export const metricLabel = (metric: CalibrationReadingOut['metric']) =>
  METRIC_LABEL[metric]?.() ?? metric;

const SCOPE_LABEL: Record<CalibrationReadingOut['scope'], () => string> = {
  local: m.scope_local,
  parish: m.scope_parish,
  concelho: m.scope_concelho,
};

export const scopeLabel = (scope: CalibrationReadingOut['scope']) =>
  SCOPE_LABEL[scope]?.() ?? scope;

/** «observado·12» / «estimativa·2» / «pressuposto»: o rótulo vem da API e o painel mostra-o tal como está. */
export const sourceLabel = (row: CalibrationReadingOut) => row.label;

/** O valor na unidade da métrica (kg/dia, kg, sacos, pedidos, fração). */
export const formatValue = (row: CalibrationReadingOut, value: number | null) => {
  if (value === null) return '—';
  if (row.metric === 'on_demand_capture') return `${formatNumber(value * 100, 1)}%`;
  return formatNumber(value, 3);
};
