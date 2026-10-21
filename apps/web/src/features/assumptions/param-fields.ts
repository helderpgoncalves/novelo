import type { PlanningParams } from '@/client';
import { m } from '@/paraglide/messages';

export interface ParamField {
  /** Caminho no objeto de pressupostos, igual ao `key` do OpenAPI (ex.: `modes.existing.capture_rate`). */
  path: string;
  label: () => string;
  kind: 'number' | 'percent' | 'int';
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
}

export interface ParamGroup {
  id: string;
  title: () => string;
  fields: ParamField[];
}

interface ModeLabels {
  capture: () => string;
  coverage: () => string;
  capex: () => string;
  people: () => string;
  minPoints: () => string;
  lifetime: () => string;
  frequency: () => string;
}

const modeFields = (
  mode: 'existing' | 'street' | 'on_demand',
  labels: ModeLabels,
): ParamField[] => [
  { path: `modes.${mode}.capture_rate`, label: labels.capture, kind: 'percent', min: 0, max: 1 },
  {
    path: `modes.${mode}.coverage_factor`,
    label: labels.coverage,
    kind: 'percent',
    min: 0,
    max: 1,
  },
  {
    path: `modes.${mode}.capex_per_point_eur`,
    label: labels.capex,
    kind: 'number',
    unit: '€',
    step: 50,
    min: 0,
  },
  {
    path: `modes.${mode}.people_per_point`,
    label: labels.people,
    kind: 'int',
    unit: m.param_unit_inhabitants(),
    min: 1,
  },
  { path: `modes.${mode}.min_points`, label: labels.minPoints, kind: 'int', min: 0 },
  {
    path: `modes.${mode}.lifetime_years`,
    label: labels.lifetime,
    kind: 'number',
    unit: m.param_unit_years(),
    step: 1,
    min: 1,
  },
  {
    path: `modes.${mode}.collections_per_year`,
    label: labels.frequency,
    kind: 'number',
    unit: m.param_unit_per_year(),
    step: 1,
    min: 0,
  },
];

const labels: ModeLabels = {
  capture: () => m.param_capture_rate(),
  coverage: () => m.param_coverage_factor(),
  capex: () => m.param_capex_per_point(),
  people: () => m.param_people_per_point(),
  minPoints: () => m.param_min_points(),
  lifetime: () => m.param_lifetime_years(),
  frequency: () => m.param_collections_per_year(),
};

// Os grupos seguem o desenho do modelo (docs/engenharia/dados-e-modelo.md).
export const PARAM_GROUPS: ParamGroup[] = [
  {
    id: 'general',
    title: () => m.param_group_general(),
    fields: [
      {
        path: 'kg_per_inhab_month',
        label: () => m.param_kg_per_inhab_month(),
        kind: 'number',
        unit: 'kg',
        step: 0.05,
        min: 0.05,
        max: 5,
      },
    ],
  },
  { id: 'existing', title: () => m.mode_existing(), fields: modeFields('existing', labels) },
  { id: 'on_demand', title: () => m.mode_on_demand(), fields: modeFields('on_demand', labels) },
  // Só referência (ex.: o benchmark francês é de contentores): a Vitrus não tem contentores de têxtil.
  { id: 'street', title: () => m.mode_street(), fields: modeFields('street', labels) },
  {
    id: 'costs',
    title: () => m.param_group_costs(),
    fields: [
      {
        path: 'cost_per_collection_eur',
        label: () => m.param_cost_per_collection(),
        kind: 'number',
        unit: '€',
        step: 0.5,
        min: 0,
      },
      {
        path: 'cost_per_km_eur',
        label: () => m.param_cost_per_km(),
        kind: 'number',
        unit: '€/km',
        step: 0.1,
        min: 0,
      },
      {
        path: 'detour_factor',
        label: () => m.param_detour_factor(),
        kind: 'number',
        unit: 'x',
        step: 0.05,
        min: 1,
        max: 3,
      },
    ],
  },
  {
    id: 'on_demand_ops',
    title: () => m.param_group_on_demand(),
    fields: [
      {
        path: 'on_demand_kg_per_pickup',
        label: () => m.param_on_demand_kg_per_pickup(),
        kind: 'number',
        unit: 'kg',
        step: 1,
        min: 1,
      },
      {
        path: 'piggyback_extra_km',
        label: () => m.param_piggyback_extra_km(),
        kind: 'number',
        unit: 'km',
        step: 0.1,
        min: 0,
      },
      {
        path: 'piggyback_min_days',
        label: () => m.param_piggyback_min_days(),
        kind: 'int',
        unit: m.param_unit_days_week(),
        min: 1,
        max: 7,
      },
    ],
  },
  {
    id: 'fleet',
    title: () => m.param_group_fleet(),
    fields: [
      {
        path: 'vehicle_capacity_t',
        label: () => m.param_vehicle_capacity(),
        kind: 'number',
        unit: 't',
        step: 0.5,
        min: 0.5,
      },
      {
        path: 'depot_lat',
        label: () => m.param_depot_lat(),
        kind: 'number',
        unit: '°',
        step: 0.0001,
        min: -90,
        max: 90,
      },
      {
        path: 'depot_lon',
        label: () => m.param_depot_lon(),
        kind: 'number',
        unit: '°',
        step: 0.0001,
        min: -180,
        max: 180,
      },
      {
        path: 'solver_time_limit_s',
        label: () => m.param_solver_time_limit(),
        kind: 'int',
        unit: 's',
        min: 1,
        max: 120,
      },
    ],
  },
];

export function getParam(params: PlanningParams, path: string): number {
  return path
    .split('.')
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown>)[key], params) as number;
}

/** Devolve uma cópia dos pressupostos com um valor alterado (imutável). */
export function setParam(params: PlanningParams, path: string, value: number): PlanningParams {
  const keys = path.split('.');
  const clone = structuredClone(params) as unknown as Record<string, unknown>;
  let cursor = clone;
  for (const key of keys.slice(0, -1)) cursor = cursor[key] as Record<string, unknown>;
  cursor[keys[keys.length - 1] as string] = value;
  return clone as unknown as PlanningParams;
}

/** Erros de intervalo por campo, para mostrar antes de enviar. */
export function validateParams(params: PlanningParams): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const group of PARAM_GROUPS) {
    for (const f of group.fields) {
      const v = getParam(params, f.path);
      const lo = f.min;
      const hi = f.max;
      if (!Number.isFinite(v)) errors[f.path] = m.validation_number_required();
      else if (lo != null && v < lo)
        errors[f.path] = m.validation_number_min({ min: f.kind === 'percent' ? lo * 100 : lo });
      else if (hi != null && v > hi)
        errors[f.path] = m.validation_number_max({ max: f.kind === 'percent' ? hi * 100 : hi });
    }
  }
  return errors;
}
