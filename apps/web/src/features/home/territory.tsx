import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { type ReactNode, useMemo } from 'react';
import type { Overview } from '@/client';
import { getCaopParishesGeojsonOptions } from '@/client/@tanstack/react-query.gen';
import { AsyncBoundary } from '@/components/async-boundary';
import { DetailSheet } from '@/components/detail-sheet';
import { Panel } from '@/components/page';
import { MapSkeleton } from '@/components/skeletons';
import { useMediaQuery } from '@/lib/motion';
import { DecisionMap } from './decision-map';
import { buildMapModel, type LayerId, layerValues } from './map-model';
import { ParishDetail } from './parish-detail';
import { ParishTable, sortByGap, topRows } from './parish-table';

interface TerritoryProps {
  overview: Overview;
  layer: LayerId;
  onLayerChange: (layer: LayerId) => void;
  parish: string | null;
  onParishChange: (code: string | null) => void;
  covered: Set<string> | null;
  coveredNote: string | null;
  /** Controlo de orçamento: uma faixa por baixo do mapa e da lista. */
  budget: ReactNode;
}

/** O mapa dos contornos CAOP: pede-os e espera por eles à parte, para a lista e o orçamento não esperarem. */
function MapPanel({
  overview,
  layer,
  onLayerChange,
  selected,
  onSelect,
  covered,
  coveredNote,
  fallbackCode,
}: Pick<TerritoryProps, 'overview' | 'layer' | 'onLayerChange' | 'covered' | 'coveredNote'> & {
  selected: string | null;
  onSelect: (code: string | null) => void;
  fallbackCode: string | null;
}) {
  const { parishes } = overview;
  const { data: caop } = useSuspenseQuery(getCaopParishesGeojsonOptions());
  const model = useMemo(() => buildMapModel(caop.features), [caop]);
  const municipalContainers = useMemo(
    () => new Map(caop.features.map((f) => [f.properties.dicofre, f.properties.containers])),
    [caop],
  );
  const areaKm2 = useMemo(() => {
    const out = new Map(model.parishes.map((p) => [p.code, p.areaKm2]));
    for (const p of parishes) if (p.area_km2 && p.area_km2 > 0) out.set(p.code, p.area_km2);
    return out;
  }, [model, parishes]);
  const values = useMemo(
    () =>
      layerValues(layer, {
        parishes,
        areaKm2,
        municipalContainers,
      }),
    [layer, parishes, areaKm2, municipalContainers],
  );
  return (
    <DecisionMap
      model={model}
      layer={layer}
      onLayerChange={onLayerChange}
      values={values}
      selected={selected}
      onSelect={onSelect}
      covered={covered}
      coveredNote={coveredNote}
      fallbackCode={fallbackCode}
    />
  );
}

/**
 * O mapa, a lista das freguesias com mais têxtil por desviar (a mesma informação para quem lê melhor em lista), o
 * detalhe da freguesia escolhida e o orçamento. Em telemóvel: mapa, orçamento, lista; o detalhe abre numa folha.
 */
export function Territory({
  overview,
  layer,
  onLayerChange,
  parish,
  onParishChange,
  covered,
  coveredNote,
  budget,
}: TerritoryProps) {
  const { parishes } = overview;
  const wide = useMediaQuery('(min-width: 1024px)');
  // Mesmo pedido que o mapa (a cache junta-os): aqui só serve para contar contentores municipais no detalhe.
  const caop = useQuery(getCaopParishesGeojsonOptions());
  const rows = useMemo(() => sortByGap(topRows(parishes)), [parishes]);
  const byCode = useMemo(() => new Map(rows.map((r) => [r.parish.code, r])), [rows]);
  const caopProps = useMemo(
    () => new Map((caop.data?.features ?? []).map((f) => [f.properties.dicofre, f.properties])),
    [caop.data],
  );

  const selected = parish && byCode.has(parish) ? parish : null;
  const row = selected ? byCode.get(selected) : undefined;
  const props = selected ? caopProps.get(selected) : undefined;

  const detail = row && (
    <ParishDetail
      parish={row.parish}
      gapT={row.gapT}
      areaKm2={row.parish.area_km2 ?? props?.area_km2 ?? null}
      municipalContainers={props ? props.containers : null}
      covered={covered ? covered.has(row.parish.code) : null}
      onClose={() => onParishChange(null)}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-start">
      <Panel className="p-3 sm:p-5 xl:col-span-7 xl:row-start-1">
        <AsyncBoundary fallback={<MapSkeleton className="lg:h-[40rem]" />}>
          <MapPanel
            overview={overview}
            layer={layer}
            onLayerChange={onLayerChange}
            selected={selected}
            onSelect={onParishChange}
            covered={covered}
            coveredNote={coveredNote}
            fallbackCode={rows[0]?.parish.code ?? null}
          />
        </AsyncBoundary>
      </Panel>

      <Panel id="orcamento" className="scroll-mt-20 xl:col-span-12 xl:row-start-2">
        {budget}
      </Panel>

      <div className="min-w-0 space-y-5 xl:col-span-5 xl:col-start-8 xl:row-start-1">
        {wide && detail && <Panel>{detail}</Panel>}
        <ParishTable rows={rows} selected={selected} onSelect={onParishChange} />
      </div>

      {!wide && row && (
        <DetailSheet
          open
          onOpenChange={(open) => !open && onParishChange(null)}
          title={row.parish.name}
        >
          {detail}
        </DetailSheet>
      )}
    </div>
  );
}
