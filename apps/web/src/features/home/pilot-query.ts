import { queryOptions } from '@tanstack/react-query';
import { type CollectionMode, recommendPilot } from '@/client';

/** O piloto recomendado do ecrã inicial, do ecrã do piloto e da apresentação: a Vitrus não tem contentores de têxtil. */
export const PILOT_PARAMS = {
  k: 2,
  months: 3,
  modes: ['existing', 'on_demand'] as CollectionMode[],
  floor: undefined,
};

/** A rota é um POST sem efeitos (cálculo com semente fixa): trata-se como leitura em cache, partilhada por todos. */
export const pilotQueryOptions = () =>
  queryOptions({
    queryKey: ['pilot', PILOT_PARAMS],
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const { data } = await recommendPilot({
        body: {
          k: PILOT_PARAMS.k,
          months: PILOT_PARAMS.months,
          modes: PILOT_PARAMS.modes,
          min_tonnes_pilot: null,
        },
        throwOnError: true,
      });
      return data;
    },
  });
