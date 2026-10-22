import type { CoverageParish } from '@/client';

export type CoverageChannel = CoverageParish['channels'][number];

/** Ordem fixa dos canais (todos na viatura dedicada): saco à porta, locais existentes e, por último, a referência. */
const ORDER: readonly CoverageChannel[] = ['on_demand', 'existing', 'street'];

/** Canais da freguesia sem repetidos e numa ordem estável (a mesma em todas as linhas, filtros e exportação). */
export function coverageChannels(parish: Pick<CoverageParish, 'channels'>): CoverageChannel[] {
  const set = new Set(parish.channels);
  return ORDER.filter((c) => set.has(c));
}
