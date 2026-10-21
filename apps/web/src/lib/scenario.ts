import type { CollectionMode, ScenarioObjective } from '@/client';
import { m } from '@/paraglide/messages';

/**
 * Modos oferecidos (os mesmos que a API usa por omissão): a Vitrus não tem nem quer contentores de têxtil, por isso
 * `street` fica fora dos formulários e só aparece como referência explícita ou em cenários antigos.
 */
export const MODES: CollectionMode[] = ['existing', 'on_demand'];

/** Todos os modos, para mostrar resultados (inclui `street`, só referência). */
export const ALL_MODES: CollectionMode[] = ['existing', 'on_demand', 'street'];

export const modeLabel: Record<CollectionMode, () => string> = {
  street: () => m.mode_street(),
  existing: () => m.mode_existing(),
  on_demand: () => m.mode_on_demand(),
};

export const modeHint: Record<CollectionMode, () => string> = {
  street: () => m.mode_street_hint(),
  existing: () => m.mode_existing_hint(),
  on_demand: () => m.mode_on_demand_hint(),
};

export const objectiveLabel: Record<ScenarioObjective, () => string> = {
  max_tonnes: () => m.objective_max_tonnes(),
  min_cost: () => m.objective_min_cost(),
};

export const objectiveHint: Record<ScenarioObjective, () => string> = {
  max_tonnes: () => m.objective_max_tonnes_hint(),
  min_cost: () => m.objective_min_cost_hint(),
};
