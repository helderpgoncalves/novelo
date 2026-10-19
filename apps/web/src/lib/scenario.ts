import type { CollectionMode, ScenarioObjective } from '@/client';
import { m } from '@/paraglide/messages';

export const MODES: CollectionMode[] = ['street', 'existing', 'on_demand'];

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
