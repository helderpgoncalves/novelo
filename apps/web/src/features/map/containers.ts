import type { ContainerKind, ContainerOut, ContainerStatus } from '@/client';
import { m } from '@/paraglide/messages';

export const containerKindLabel: Record<ContainerKind, () => string> = {
  textile: () => m.mapc_kind_textile(),
  undifferentiated: () => m.mapc_kind_undifferentiated(),
  organic: () => m.mapc_kind_organic(),
  recyclable: () => m.mapc_kind_recyclable(),
  other: () => m.mapc_kind_other(),
};

export const containerStatusLabel: Record<ContainerStatus, () => string> = {
  active: () => m.mapc_status_active(),
  inactive: () => m.mapc_status_inactive(),
  planned: () => m.mapc_status_planned(),
};

/** Cor por tipo: o têxtil é o protagonista (Floresta), os restantes ficam em tons discretos. */
export const CONTAINER_KIND_COLORS: Record<ContainerKind, string> = {
  textile: '#2e6b57',
  undifferentiated: '#7a746a',
  organic: '#a8814a',
  recyclable: '#4a7fa0',
  other: '#b8b2a4',
};

export const CONTAINER_KINDS = Object.keys(CONTAINER_KIND_COLORS) as ContainerKind[];

/** Contentores como GeoJSON de pontos para o MapLibre. */
export function containersToGeoJson(containers: ContainerOut[]) {
  return {
    type: 'FeatureCollection' as const,
    features: containers.map((c) => ({
      type: 'Feature' as const,
      properties: {
        id: c.id,
        ref: c.external_ref,
        kind: c.kind,
        status: c.status,
        address: c.address ?? '',
        locality: c.locality ?? '',
        capacity: c.capacity_litres ?? 0,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [Number(c.longitude), Number(c.latitude)],
      },
    })),
  };
}
