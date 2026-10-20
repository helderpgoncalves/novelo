import { z } from 'zod';
import type { Shift, Typology } from '@/client';
import { EMPTY_FILTERS, type Filters, TYPOLOGIES } from './schedule';

export const FLEET_TABS = ['calendar', 'map', 'overview', 'vehicles', 'typologies'] as const;
export type FleetTab = (typeof FLEET_TABS)[number];
export const CALENDAR_VIEWS = ['week', 'day', 'vehicle', 'circuit'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];
export const FOCUSES = ['overlap', 'wash', 'idle', 'nocar'] as const;
export type Focus = (typeof FOCUSES)[number];

// O router converte "123" em número: aceita ambos e guarda texto.
const text = z
  .union([z.string().min(1).max(80), z.number().transform(String)])
  .optional()
  .catch(undefined);

/** Estado partilhável da página da frota: separador, vista, filtros e o detalhe aberto. */
export const fleetSearchSchema = z.object({
  tab: z.enum(FLEET_TABS).optional().catch(undefined),
  view: z.enum(CALENDAR_VIEWS).optional().catch(undefined),
  day: z.coerce.number().int().min(1).max(7).optional().catch(undefined),
  shift: z.enum(['morning', 'afternoon', 'night']).optional().catch(undefined),
  ty: z.string().max(120).optional().catch(undefined),
  plate: text,
  circuit: text,
  loc: text,
  dens: z.enum(['compact', 'comfortable']).optional().catch(undefined),
  focus: z.enum(FOCUSES).optional().catch(undefined),
  /** Detalhe aberto: `c:<circuito>` ou `v:<matrícula>`. */
  detail: text,
});

export type FleetSearch = z.infer<typeof fleetSearchSchema>;

export const parseTypologies = (ty?: string): Typology[] =>
  (ty ?? '').split(',').filter((t): t is Typology => (TYPOLOGIES as readonly string[]).includes(t));

export function filtersFromSearch(s: FleetSearch): Filters {
  return {
    ...EMPTY_FILTERS,
    typologies: parseTypologies(s.ty),
    plate: s.plate,
    circuit: s.circuit,
    locality: s.loc,
    day: s.day,
    shift: s.shift as Shift | undefined,
  };
}

/** Converte filtros no pedaço do URL (valores vazios saem, para o endereço ficar limpo). */
export function searchFromFilters(f: Partial<Filters>): Partial<FleetSearch> {
  const out: Partial<FleetSearch> = {};
  if ('typologies' in f) out.ty = f.typologies?.length ? f.typologies.join(',') : undefined;
  if ('plate' in f) out.plate = f.plate;
  if ('circuit' in f) out.circuit = f.circuit;
  if ('locality' in f) out.loc = f.locality;
  if ('day' in f) out.day = f.day;
  if ('shift' in f) out.shift = f.shift;
  return out;
}

export const CLEAR_FILTERS: Partial<FleetSearch> = {
  ty: undefined,
  plate: undefined,
  circuit: undefined,
  loc: undefined,
  shift: undefined,
  focus: undefined,
};
