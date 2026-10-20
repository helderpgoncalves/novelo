import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';
import type { MapSpec } from '@/client';
import { BaseMap } from '@/features/map/base-map';
import { m } from '@/paraglide/messages';
import { fmt } from './chart-options';

const COLORS: Record<string, string> = {
  parishes: '#2e6b57',
  containers: '#c4a06a',
  localities: '#5e6b66',
};

/** Mapa do copiloto: círculos por camada (freguesias, contentores, localidades), com o tamanho a seguir à métrica. */
export default function MapArtifactView({ spec }: { spec: MapSpec }) {
  const layers = useMemo(
    () =>
      spec.layers.map((layer, index) => {
        const values = layer.items.map((i) => i.value ?? 0);
        const max = Math.max(1, ...values);
        return {
          layer,
          index,
          data: {
            type: 'FeatureCollection' as const,
            features: layer.items
              .filter((i) => typeof i.lat === 'number' && typeof i.lon === 'number')
              .map((i) => ({
                type: 'Feature' as const,
                geometry: {
                  type: 'Point' as const,
                  coordinates: [i.lon as number, i.lat as number],
                },
                properties: { label: i.label, scale: (i.value ?? 0) / max },
              })),
          },
        };
      }),
    [spec.layers],
  );
  const drawn = layers.reduce((n, l) => n + l.data.features.length, 0);
  return (
    <div className="space-y-2">
      <div className="h-72 overflow-hidden rounded-lg ring-1 ring-foreground/10 sm:h-80">
        <BaseMap label={spec.title}>
          {layers.map(({ layer, index, data }) => (
            <Source
              key={`${layer.kind}-${index}`}
              id={`copilot-${layer.kind}-${index}`}
              type="geojson"
              data={data}
            >
              <Layer
                id={`copilot-${layer.kind}-${index}-circles`}
                type="circle"
                paint={{
                  'circle-color': COLORS[layer.kind] ?? '#2e6b57',
                  'circle-opacity': 0.7,
                  'circle-stroke-color': '#faf8f3',
                  'circle-stroke-width': 1,
                  'circle-radius': ['interpolate', ['linear'], ['get', 'scale'], 0, 5, 1, 16],
                }}
              />
            </Source>
          ))}
        </BaseMap>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
        {spec.layers.map((layer, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: camadas fixas do artefacto
          <li key={i} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ background: COLORS[layer.kind] ?? '#2e6b57' }}
            />
            {layer.label}
            {layer.metric ? ` · ${layer.metric}${layer.unit ? ` (${layer.unit})` : ''}` : ''}
            <span className="tabular-nums">· {fmt(layer.items.length)}</span>
          </li>
        ))}
      </ul>
      {drawn === 0 && <p className="text-muted-foreground text-xs">{m.chat_map_no_coords()}</p>}
    </div>
  );
}
