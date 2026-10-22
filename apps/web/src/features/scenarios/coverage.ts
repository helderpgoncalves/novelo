import type { CoverageParish } from '@/client';

export type CoverageChannel = CoverageParish['channels'][number];

/** Ordem fixa dos canais: primeiro o que não custa km novos, por último a referência (contentor de rua). */
const ORDER: readonly CoverageChannel[] = [
  'door_to_door',
  'existing',
  'detour',
  'on_demand',
  'street',
];

/** Canais da freguesia sem repetidos e numa ordem estável (a mesma em todas as linhas, filtros e exportação). */
export function coverageChannels(parish: Pick<CoverageParish, 'channels'>): CoverageChannel[] {
  const set = new Set(parish.channels);
  return ORDER.filter((c) => set.has(c));
}
