import type {
  AlertKind,
  AlertStatus,
  CircuitStatus,
  CollectionType,
  DayGroup,
  Shift,
  TextileDestination,
  Tipau,
  Typology,
  WasteCategory,
} from '@/client';
import { m } from '@/paraglide/messages';

// Cada vocabulário do OpenAPI tem aqui um Record exaustivo: um valor novo na API parte o `tsc`
// até ter tradução. Os textos vivem em messages/*.json.

export const typologyLabel: Record<Typology, () => string> = {
  organic: () => m.typology_organic(),
  undifferentiated: () => m.typology_undifferentiated(),
  recyclable: () => m.typology_recyclable(),
  bulky: () => m.typology_bulky(),
  payt: () => m.typology_payt(),
  support: () => m.typology_support(),
  to_confirm: () => m.typology_to_confirm(),
  unassigned: () => m.typology_unassigned(),
};

export const collectionLabel: Record<CollectionType, () => string> = {
  door_to_door: () => m.collection_door_to_door(),
  moloks: () => m.collection_moloks(),
  containers: () => m.collection_containers(),
  unspecified: () => m.collection_unspecified(),
};

export const circuitStatusLabel: Record<CircuitStatus, () => string> = {
  ok: () => m.circuit_status_ok(),
  no_vehicle: () => m.circuit_status_no_vehicle(),
  weekend_only: () => m.circuit_status_weekend_only(),
  unassigned: () => m.circuit_status_unassigned(),
};

export const dayGroupLabel: Record<DayGroup, () => string> = {
  weekday: () => m.day_group_weekday(),
  saturday: () => m.day_group_saturday(),
  sunday: () => m.day_group_sunday(),
};

export const shiftLabel: Record<Shift, () => string> = {
  morning: () => m.shift_morning(),
  afternoon: () => m.shift_afternoon(),
  night: () => m.shift_night(),
};

export const alertKindLabel: Record<AlertKind, () => string> = {
  circuit_without_vehicle: () => m.alert_kind_circuit_without_vehicle(),
  vehicle_code: () => m.alert_kind_vehicle_code(),
  unknown_circuit: () => m.alert_kind_unknown_circuit(),
  incomplete_circuit: () => m.alert_kind_incomplete_circuit(),
  duplicate_vehicle: () => m.alert_kind_duplicate_vehicle(),
  possible_plate_error: () => m.alert_kind_possible_plate_error(),
  multi_typology_vehicle: () => m.alert_kind_multi_typology_vehicle(),
  vehicle_without_circuit: () => m.alert_kind_vehicle_without_circuit(),
  undocumented_circuits: () => m.alert_kind_undocumented_circuits(),
  different_dates: () => m.alert_kind_different_dates(),
  normalized_spelling: () => m.alert_kind_normalized_spelling(),
  container_rows_rejected: () => m.alert_kind_container_rows_rejected(),
  container_pending_location: () => m.alert_kind_container_pending_location(),
  container_assumed_values: () => m.alert_kind_container_assumed_values(),
  municipal_blank_rows: () => m.alert_kind_municipal_blank_rows(),
  municipal_boundary_tolerance: () => m.alert_kind_municipal_boundary_tolerance(),
  municipal_caop_version: () => m.alert_kind_municipal_caop_version(),
  municipal_caop_vs_osm: () => m.alert_kind_municipal_caop_vs_osm(),
  municipal_capacity_outlier: () => m.alert_kind_municipal_capacity_outlier(),
  municipal_capacity_unit_assumed: () => m.alert_kind_municipal_capacity_unit_assumed(),
  municipal_capacity_unknown: () => m.alert_kind_municipal_capacity_unknown(),
  municipal_coord_suspect: () => m.alert_kind_municipal_coord_suspect(),
  municipal_coords_artifact: () => m.alert_kind_municipal_coords_artifact(),
  municipal_coords_low_precision: () => m.alert_kind_municipal_coords_low_precision(),
  municipal_coords_missing: () => m.alert_kind_municipal_coords_missing(),
  municipal_coords_swapped: () => m.alert_kind_municipal_coords_swapped(),
  municipal_cross_file_overlap: () => m.alert_kind_municipal_cross_file_overlap(),
  municipal_empty_row: () => m.alert_kind_municipal_empty_row(),
  municipal_not_textile: () => m.alert_kind_municipal_not_textile(),
  municipal_osm_contours_incomplete: () => m.alert_kind_municipal_osm_contours_incomplete(),
  municipal_outside_municipality: () => m.alert_kind_municipal_outside_municipality(),
  municipal_parish_mismatch: () => m.alert_kind_municipal_parish_mismatch(),
  municipal_parish_names_inconsistent: () => m.alert_kind_municipal_parish_names_inconsistent(),
  municipal_parish_unmapped: () => m.alert_kind_municipal_parish_unmapped(),
  municipal_quantity_semantics: () => m.alert_kind_municipal_quantity_semantics(),
  municipal_stacked_units: () => m.alert_kind_municipal_stacked_units(),
  municipal_stream_unknown: () => m.alert_kind_municipal_stream_unknown(),
};

export const alertStatusLabel: Record<AlertStatus, () => string> = {
  open: () => m.alert_status_open(),
  resolved: () => m.alert_status_resolved(),
  wont_fix: () => m.alert_status_wont_fix(),
};

export const destinationLabel: Record<TextileDestination, () => string> = {
  reuse: () => m.destination_reuse(),
  recycle: () => m.destination_recycle(),
  reject: () => m.destination_reject(),
};

export const wasteCategoryLabel: Record<WasteCategory, () => string> = {
  biowaste: () => m.waste_category_biowaste(),
  undifferentiated: () => m.waste_category_undifferentiated(),
  paper: () => m.waste_category_paper(),
  plastic: () => m.waste_category_plastic(),
  glass: () => m.waste_category_glass(),
  wood: () => m.waste_category_wood(),
  metals: () => m.waste_category_metals(),
  others: () => m.waste_category_others(),
  composites: () => m.waste_category_composites(),
  textiles: () => m.waste_category_textiles(),
  sanitary_textiles: () => m.waste_category_sanitary_textiles(),
  bulky: () => m.waste_category_bulky(),
};

export const tipauLabel: Record<Tipau, () => string> = {
  apu: () => m.tipau_apu(),
  amu: () => m.tipau_amu(),
  apr: () => m.tipau_apr(),
};
