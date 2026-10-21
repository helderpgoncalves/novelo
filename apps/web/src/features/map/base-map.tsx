import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { baseStyle, GUIMARAES_BOUNDS } from '@/lib/map';
import { useTheme } from '@/lib/theme';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type ReactNode, useMemo } from 'react';
import MapGL, {
  type MapLayerMouseEvent,
  NavigationControl,
  ScaleControl,
} from 'react-map-gl/maplibre';
import { m } from '@/paraglide/messages';

// O MapLibre 6 procura o worker ao lado do seu bundle (assets/maplibre-gl-worker.mjs), mas o Vite não o emite: em
// produção o nginx devolvia o index.html e dava "Worker failed to load". Com `?url` o Vite copia o ficheiro para
// assets/ e o worker é servido do mesmo domínio (cumpre `worker-src 'self'`, sem blob: nem unsafe-eval).
setWorkerUrl(maplibreWorkerUrl);

const COARSE = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

interface BaseMapProps {
  children?: ReactNode;
  interactiveLayerIds?: string[];
  onMouseMove?: (event: MapLayerMouseEvent) => void;
  onMouseLeave?: () => void;
  onClick?: (event: MapLayerMouseEvent) => void;
  className?: string;
  label: string;
}

/** Mapa de Guimarães com o mapa de base do tema atual. Os dados entram como filhos (Source e Layer). */
export function BaseMap({
  children,
  interactiveLayerIds,
  onMouseMove,
  onMouseLeave,
  onClick,
  className,
  label,
}: BaseMapProps) {
  const { resolvedTheme } = useTheme();
  const style = useMemo(() => baseStyle(resolvedTheme === 'dark'), [resolvedTheme]);

  return (
    <section className={className} aria-label={label}>
      <MapGL
        initialViewState={{ bounds: GUIMARAES_BOUNDS, fitBoundsOptions: { padding: 24 } }}
        mapStyle={style}
        interactiveLayerIds={interactiveLayerIds}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        cursor={interactiveLayerIds?.length ? 'pointer' : undefined}
        style={{ width: '100%', height: '100%' }}
        reuseMaps
        // Em ecrãs tácteis o mapa não prende o scroll da página: mover com um dedo desloca a página, com dois o mapa.
        cooperativeGestures={COARSE}
        locale={{
          'CooperativeGesturesHandler.MobileHelpText': m.map_gesture_hint(),
          'CooperativeGesturesHandler.WindowsHelpText': m.map_gesture_hint_ctrl(),
          'CooperativeGesturesHandler.MacHelpText': m.map_gesture_hint_cmd(),
        }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-left" unit="metric" />
        {children}
      </MapGL>
    </section>
  );
}
