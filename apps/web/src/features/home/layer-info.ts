import { m } from '@/paraglide/messages';
import { num } from './safe';
import type { LayerId } from './tabs';

export interface LayerInfo {
  /** Nome completo (para leitores de ecrã e título da legenda). */
  label: () => string;
  /** Nome curto do botão. */
  short: () => string;
  description: () => string;
  /** Título da legenda: o que mede e em que unidade. */
  legendTitle: () => string;
  unit: () => string;
  /** Valor com a casa decimal certa; a unidade vem à parte. */
  format: (v: number) => string;
}

const oneDecimalBelowTen = (v: number) => num(v, v < 10 ? 1 : 0);

export const LAYER_INFO: Record<LayerId, LayerInfo> = {
  gap: {
    label: () => m.home_layer_gap(),
    short: () => m.home_layer_gap_short(),
    description: () => m.home_layer_gap_desc(),
    legendTitle: () => m.home_layer_gap_legend(),
    unit: () => m.home_layer_gap_unit(),
    format: oneDecimalBelowTen,
  },
  population: {
    label: () => m.home_layer_population(),
    short: () => m.home_layer_population_short(),
    description: () => m.home_layer_population_desc(),
    legendTitle: () => m.home_layer_population_legend(),
    unit: () => m.home_layer_population_unit(),
    format: (v) => num(v),
  },
  density: {
    label: () => m.home_layer_density(),
    short: () => m.home_layer_density_short(),
    description: () => m.home_layer_density_desc(),
    legendTitle: () => m.home_layer_density_legend(),
    unit: () => m.home_layer_density_unit(),
    format: (v) => num(v),
  },
  containers: {
    label: () => m.home_layer_containers(),
    short: () => m.home_layer_containers_short(),
    description: () => m.home_layer_containers_desc(),
    legendTitle: () => m.home_layer_containers_legend(),
    unit: () => m.home_layer_containers_unit(),
    format: (v) => num(v),
  },
  circuits: {
    label: () => m.home_layer_circuits(),
    short: () => m.home_layer_circuits_short(),
    description: () => m.home_layer_circuits_desc(),
    legendTitle: () => m.home_layer_circuits_legend(),
    unit: () => m.home_layer_circuits_unit(),
    format: (v) => num(v),
  },
  data_gaps: {
    label: () => m.home_layer_data_gaps(),
    short: () => m.home_layer_data_gaps_short(),
    description: () => m.home_layer_data_gaps_desc(),
    legendTitle: () => m.home_layer_data_gaps_legend_title(),
    unit: () => m.home_layer_data_gaps_unit(),
    format: (v) => (v > 0 ? m.home_layer_data_gaps_yes() : m.home_layer_data_gaps_no()),
  },
};

/** Valor com unidade para o tooltip e para leitores de ecrã; «—» quando não há valor. */
export function valueText(layer: LayerId, value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return m.home_map_no_data();
  const info = LAYER_INFO[layer];
  return layer === 'data_gaps' ? info.format(value) : `${info.format(value)} ${info.unit()}`;
}
