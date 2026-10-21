import { useQuery } from '@tanstack/react-query';
import {
  getB2bChannelOptions,
  getOverviewOptions,
  getPlanningParametersOptions,
  getScenarioOptions,
  listReferenceScenariosOptions,
  readyOptions,
} from '@/client/@tanstack/react-query.gen';
import { pilotQueryOptions } from '@/features/home/pilot-query';
import { useSensitivity } from '@/features/scenarios/uncertainty-panel';
import { pickOnboardingReference } from './story-model';

/** Enquanto o arranque calcula os cenários de referência a lista vem vazia: tenta de novo sozinho. */
const COMPUTING_RETRY_MS = 5_000;

/**
 * Todos os dados da apresentação, pedidos ao abrir (o passo seguinte já está em cache quando se avança). Nada é
 * calculado aqui: só se escolhe o cenário de referência e se encadeiam os pedidos que dependem dele.
 */
export function useStoryData() {
  const overview = useQuery({ ...getOverviewOptions(), staleTime: 5 * 60_000 });
  const refs = useQuery({
    ...listReferenceScenariosOptions(),
    staleTime: 60_000,
    refetchInterval: (q) => (pickOnboardingReference(q.state.data) ? false : COMPUTING_RETRY_MS),
  });
  const reference = pickOnboardingReference(refs.data);
  const scenario = useQuery({
    ...getScenarioOptions({ path: { scenario_id: reference?.id ?? '' } }),
    enabled: reference !== null,
    staleTime: 10 * 60_000,
  });
  const b2b = useQuery({ ...getB2bChannelOptions(), staleTime: 10 * 60_000 });
  const params = useQuery({ ...getPlanningParametersOptions(), staleTime: 10 * 60_000 });
  const ready = useQuery({ ...readyOptions(), staleTime: 60_000 });
  const pilot = useQuery(pilotQueryOptions());
  return { overview, refs, reference, scenario, b2b, params, ready, pilot };
}

export type StoryData = ReturnType<typeof useStoryData>;

/** Intervalo P10–P90 do cenário (o mesmo pedido do Ponto de partida, partilha a cache). */
export const useStorySensitivity = (scenarioId: string) => useSensitivity(scenarioId, 0.3, null);
