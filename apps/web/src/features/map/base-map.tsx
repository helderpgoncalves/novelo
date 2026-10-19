import { baseStyle, GUIMARAES_BOUNDS } from '@/lib/map';
import { useTheme } from '@/lib/theme';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type ReactNode, useMemo } from 'react';
import MapGL, {
  type MapLayerMouseEvent,
  NavigationControl,
  ScaleControl,
} from 'react-map-gl/maplibre';

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
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-left" unit="metric" />
        {children}
      </MapGL>
    </section>
  );
}
