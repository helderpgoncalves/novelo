import type { RouteOut, ScenarioResult } from '@/client';
import { m } from '@/paraglide/messages';

export type Routing = NonNullable<ScenarioResult['routing']>;

/** Duração de condução em h/min ("1 h 05 min", "42 min"); '—' quando não há medição por estrada. */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const min = total % 60;
  if (h === 0) return `${min} min`;
  return `${h} h ${String(min).padStart(2, '0')} min`;
}

/** Cenários antigos vêm sem `routing`: contam como estimativa. */
export function routingOf(result: Pick<ScenarioResult, 'routing'>): Routing {
  return result.routing ?? 'estimate';
}

export const isRoadRoute = (r: Pick<RouteOut, 'source'>) => (r.source ?? 'estimate') === 'road';
export const followsRoads = (r: Pick<RouteOut, 'road_path'>) => r.road_path === true;

/** Texto de proveniência dos km das rotas; `estimate` leva a etiqueta "estimativa" à parte. */
export function routingText(routing: Routing): string {
  if (routing === 'road') return m.routing_road();
  if (routing === 'mixed') return m.routing_mixed();
  return m.routing_estimate();
}
