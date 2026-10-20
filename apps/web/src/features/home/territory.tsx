import { useSuspenseQuery } from '@tanstack/react-query';
import { type ReactNode, useMemo } from 'react';
import type { Overview } from '@/client';
import { getCaopParishesGeojsonOptions } from '@/client/@tanstack/react-query.gen';
import { DetailSheet } from '@/components/detail-sheet';
import { Panel } from '@/components/page';
import { formatNumber } from '@/lib/format';
import { useMediaQuery } from '@/lib/motion';
import { m } from '@/paraglide/messages';
import { DecisionMap } from './decision-map';
import { rankParishes } from './derive';
import { buildMapModel, type LayerId, layerValues, parishGapT } from './map-model';
import { ParishDetail } from './parish-detail';

interface TerritoryProps {
  overview: Overview;
  layer: LayerId;
  onLayerChange: (layer: LayerId) => void;
  parish: string | null;
  onParishChange: (code: string | null) => void;
  covered: Set<string> | null;
  coveredNote: string | null;
  /** Controlo de orçamento (coluna lateral em ecrã largo, logo abaixo do mapa em telemóvel). */
  budget: ReactNode;
}

/** O mapa de meio-tom, o detalhe da freguesia e o orçamento: a peça central da sala de decisão. */
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
  const { gap, parishes } = overview;
  const { data: caop } = useSuspenseQuery(getCaopParishesGeojsonOptions());
  const wide = useMediaQuery('(min-width: 1024px)');
  const model = useMemo(() => buildMapModel(caop.features), [caop]);
  const byCode = useMemo(() => new Map(parishes.map((p) => [p.code, p])), [parishes]);
  const ranking = useMemo(() => rankParishes(parishes).sorted, [parishes]);
  const shapes = useMemo(() => new Map(model.parishes.map((p) => [p.code, p])), [model]);
  const municipalContainers = useMemo(
    () => new Map(caop.features.map((f) => [f.properties.dicofre, f.properties.containers])),
    [caop],
  );

  const values = useMemo(
    () =>
      layerValues(layer, {
        parishes,
        capturePct: gap.capture_pct,
        areaKm2: new Map(model.parishes.map((p) => [p.code, p.areaKm2])),
        municipalContainers,
      }),
    [layer, parishes, gap.capture_pct, model, municipalContainers],
  );

  const selected = parish && byCode.has(parish) ? parish : null;
  const selectedParish = selected ? byCode.get(selected) : undefined;

  const detail = selectedParish && (
    <ParishDetail
      parish={selectedParish}
      areaKm2={shapes.get(selectedParish.code)?.areaKm2 ?? 0}
      capturePct={gap.capture_pct}
      municipalContainers={municipalContainers.get(selectedParish.code) ?? 0}
      covered={covered ? covered.has(selectedParish.code) : null}
      onClose={() => onParishChange(null)}
    />
  );
  const topGap = Math.max(1e-9, ...ranking.map((p) => parishGapT(p, gap.capture_pct)));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
      <Panel className="p-3 sm:p-5 lg:col-span-8">
        <DecisionMap
          model={model}
          layer={layer}
          onLayerChange={onLayerChange}
          values={values}
          selected={selected}
          onSelect={onParishChange}
          covered={covered}
          coveredNote={coveredNote}
          fallbackCode={ranking[0]?.code ?? null}
        />
      </Panel>

      <div className="space-y-5 lg:col-span-4">
        <Panel id="orcamento" className="scroll-mt-20">
          {budget}
        </Panel>
        {wide && detail ? (
          <Panel>{detail}</Panel>
        ) : (
          <Panel>
            <h3 className="eyebrow mb-3">{m.home_rank_heading()}</h3>
            <ol className="space-y-1">
              {ranking.slice(0, 8).map((p) => {
                const t = parishGapT(p, gap.capture_pct);
                return (
                  <li key={p.code}>
                    <button
                      type="button"
                      onClick={() => onParishChange(p.code)}
                      className="group grid min-h-10 w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 rounded-md px-2 py-1 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/60"
                    >
                      <span className="truncate font-medium text-sm">{p.name}</span>
                      <span className="text-sm tabular-nums">{formatNumber(t, 1)} t</span>
                      <span
                        className="col-span-2 block h-1 rounded-full bg-primary/70"
                        style={{ width: `${Math.max(3, (t / topGap) * 100)}%` }}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-muted-foreground text-xs">{m.home_rank_note()}</p>
          </Panel>
        )}
      </div>

      {!wide && selectedParish && (
        <DetailSheet
          open
          onOpenChange={(open) => !open && onParishChange(null)}
          title={selectedParish.name}
        >
          {detail}
        </DetailSheet>
      )}
    </div>
  );
}
