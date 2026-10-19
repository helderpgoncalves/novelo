import type { CollectionMode } from '@/client';
import { PARAM_GROUPS } from '@/features/assumptions/param-fields';
import { modeLabel } from '@/lib/scenario';

const FIELDS = PARAM_GROUPS.flatMap((g) => g.fields);

/** Nome legível de um pressuposto a partir do caminho do OpenAPI (`modes.street.capture_rate`). */
export function paramLabel(path: string): string {
  const name = FIELDS.find((f) => f.path === path)?.label() ?? path;
  const mode = /^modes\.(street|existing|on_demand)\./.exec(path)?.[1] as
    | CollectionMode
    | undefined;
  // Os campos por modo têm o mesmo nome nos três modos; o prefixo do modo desfaz a ambiguidade.
  return mode ? `${modeLabel[mode]()} · ${name}` : name;
}
