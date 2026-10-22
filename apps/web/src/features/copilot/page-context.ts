import { useQuery } from '@tanstack/react-query';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { useCallback } from 'react';
import type { PageContext } from '@/client';
import { getScenarioOptions } from '@/client/@tanstack/react-query.gen';
import { m } from '@/paraglide/messages';

const toStrings = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (typeof value !== 'object' || value === null) return out;
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      out[k] = String(v);
    else if (Array.isArray(v)) out[k] = v.map(String).join(',');
  }
  return out;
};

/** «Cenário A» já diz que é um cenário: não se escreve «Cenário Cenário A». */
export function scenarioLabel(name: string | undefined): string {
  const plain = m.cp_page_scenario_plain();
  if (!name) return plain;
  return name.toLocaleLowerCase().startsWith(plain.toLocaleLowerCase())
    ? name
    : m.cp_page_scenario({ name });
}

/** O ecrã atual como o servidor o entende: padrão da rota (`/scenarios/$scenarioId`), parâmetros e filtros. */
export function usePageContext() {
  const router = useRouter();
  const get = useCallback((): PageContext | null => {
    const matches = router.state.matches;
    const leaf = matches[matches.length - 1];
    if (!leaf) return null;
    const route = leaf.routeId.replace(/^\/_app/, '').replace(/\/$/, '') || '/';
    if (route === '/chat') return null;
    return { route, params: toStrings(leaf.params), search: toStrings(leaf.search) };
  }, [router]);
  return get;
}

const ROUTE_LABEL: Record<string, () => string> = {
  '/': () => m.nav_baseline(),
  '/map': () => m.nav_map(),
  '/municipal': () => m.nav_municipal(),
  '/validation': () => m.nav_validation(),
  '/circuits': () => m.nav_circuits(),
  '/fleet': () => m.nav_fleet(),
  '/localities': () => m.nav_localities(),
  '/data-quality': () => m.nav_data_quality(),
  '/simulator': () => m.nav_simulator(),
  '/scenarios': () => m.nav_scenarios(),
  '/scenarios/compare': () => m.cp_page_compare(),
  '/triage': () => m.nav_triage(),
  '/lots': () => m.nav_lots(),
  '/reports': () => m.nav_rap(),
  '/pilot': () => m.nav_pilot(),
  '/assumptions': () => m.nav_assumptions(),
  '/admin/ai': () => m.nav_ai_admin(),
  '/users': () => m.nav_users(),
};

export type SuggestionFamily =
  | 'home'
  | 'sim'
  | 'scn'
  | 'cov'
  | 'ops'
  | 'trace'
  | 'data'
  | 'generic';

const FAMILY: Record<string, SuggestionFamily> = {
  '/': 'home',
  '/simulator': 'sim',
  '/scenarios': 'scn',
  '/scenarios/compare': 'scn',
  '/scenarios/$scenarioId': 'scn',
  '/map': 'cov',
  '/municipal': 'cov',
  '/localities': 'cov',
  '/circuits': 'ops',
  '/fleet': 'ops',
  '/lots': 'trace',
  '/lots/$code': 'trace',
  '/triage': 'trace',
  '/data-quality': 'data',
  '/assumptions': 'data',
};

export const familyOfRoute = (route: string | null): SuggestionFamily =>
  (route && FAMILY[route]) || 'generic';

/** Três perguntas que fazem sentido no ecrã onde estás (as genéricas servem para o resto). */
export function suggestionsFor(route: string | null): string[] {
  switch (familyOfRoute(route)) {
    case 'home':
      return [m.cp_sug_home_1(), m.cp_sug_home_2(), m.cp_sug_home_3()];
    case 'sim':
      return [m.cp_sug_sim_1(), m.cp_sug_sim_2(), m.cp_sug_sim_3()];
    case 'scn':
      return [m.cp_sug_scn_1(), m.cp_sug_scn_2(), m.cp_sug_scn_3()];
    case 'cov':
      return [m.cp_sug_cov_1(), m.cp_sug_cov_2(), m.cp_sug_cov_3()];
    case 'ops':
      return [m.cp_sug_ops_1(), m.cp_sug_ops_2(), m.cp_sug_ops_3()];
    case 'trace':
      return [m.cp_sug_trace_1(), m.cp_sug_trace_2(), m.cp_sug_trace_3()];
    case 'data':
      return [m.cp_sug_data_1(), m.cp_sug_data_2(), m.cp_sug_data_3()];
    default:
      return [
        m.copilot_suggestion_simulate(),
        m.copilot_suggestion_compare(),
        m.copilot_suggestion_coverage(),
      ];
  }
}

export interface PageInfo {
  context: PageContext | null;
  /** "Simulador da rede", "Cenário Base"… ou `null` se não há ecrã a partilhar (a página /chat). */
  label: string | null;
}

/** O ecrã atual e um nome legível; atualiza quando se navega. */
export function usePageInfo(): PageInfo {
  const get = usePageContext();
  useRouterState({ select: (s) => s.location.href });
  const context = get();
  const scenarioId =
    context?.route === '/scenarios/$scenarioId' ? (context.params?.scenarioId ?? null) : null;
  const scenario = useQuery({
    ...getScenarioOptions({ path: { scenario_id: scenarioId ?? '' } }),
    enabled: !!scenarioId,
    staleTime: 60_000,
  });
  if (!context) return { context: null, label: null };
  if (scenarioId) {
    return { context, label: scenarioLabel(scenario.data?.label) };
  }
  return { context, label: ROUTE_LABEL[context.route]?.() ?? m.cp_page_unknown() };
}
