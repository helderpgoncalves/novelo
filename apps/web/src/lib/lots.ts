import type { Fibre, GarmentType, LotEventKind, LotState } from '@/client';
import { m } from '@/paraglide/messages';

export const FIBRES: Fibre[] = [
  'cotton',
  'wool',
  'polyester',
  'nylon',
  'viscose',
  'linen',
  'acrylic',
  'elastane',
  'silk',
  'other',
  'unknown',
];
export const GARMENTS: GarmentType[] = [
  'tshirt',
  'shirt',
  'trousers',
  'jumper',
  'jacket',
  'dress',
  'skirt',
  'bedding',
  'towel',
  'other',
];

export const fibreLabel: Record<Fibre, () => string> = {
  cotton: () => m.fibre_cotton(),
  wool: () => m.fibre_wool(),
  polyester: () => m.fibre_polyester(),
  nylon: () => m.fibre_nylon(),
  viscose: () => m.fibre_viscose(),
  linen: () => m.fibre_linen(),
  acrylic: () => m.fibre_acrylic(),
  elastane: () => m.fibre_elastane(),
  silk: () => m.fibre_silk(),
  other: () => m.fibre_other(),
  unknown: () => m.fibre_unknown(),
};

export const garmentLabel: Record<GarmentType, () => string> = {
  tshirt: () => m.garment_tshirt(),
  shirt: () => m.garment_shirt(),
  trousers: () => m.garment_trousers(),
  jumper: () => m.garment_jumper(),
  jacket: () => m.garment_jacket(),
  dress: () => m.garment_dress(),
  skirt: () => m.garment_skirt(),
  bedding: () => m.garment_bedding(),
  towel: () => m.garment_towel(),
  other: () => m.garment_other(),
};

export const lotStateLabel: Record<LotState, () => string> = {
  collected: () => m.lot_state_collected(),
  sorted: () => m.lot_state_sorted(),
  reserved: () => m.lot_state_reserved(),
  delivered: () => m.lot_state_delivered(),
};

export const lotEventLabel: Record<LotEventKind, () => string> = {
  opened: () => m.lot_event_opened(),
  item_added: () => m.lot_event_item_added(),
  sorted: () => m.lot_event_sorted(),
  reserved: () => m.lot_event_reserved(),
  delivered: () => m.lot_event_delivered(),
};

// Pesos médios por peça usados quando o operador altera o tipo (pressuposto; o piloto usa balança).
export const AVERAGE_WEIGHT_G: Record<GarmentType, number> = {
  tshirt: 150,
  shirt: 200,
  trousers: 450,
  jumper: 400,
  jacket: 700,
  dress: 300,
  skirt: 250,
  bedding: 900,
  towel: 500,
  other: 300,
};
