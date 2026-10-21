import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Layers } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import {
  getCoverageOptions,
  listContainersOptions,
  listLocalitiesOptions,
  listZonesOptions,
} from '@/client/@tanstack/react-query.gen';
import { FilterChips } from '@/components/filter-chips';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { LayersPanel } from '@/features/map/layers-panel';
import { type MapMetric, NetworkMap } from '@/features/map/network-map';
import { ParishPanel } from '@/features/map/parish-panel';
import { useMunicipalMap } from '@/features/map/use-municipal-map';
import {
  FILL_MODES,
  type LayerState,
  layersFromSearch,
  matchPreset,
  PRESET_IDS,
  type Preset,
  SITES_MODES,
  searchFromLayers,
} from '@/features/municipal/derive';
import { SiteSheet } from '@/features/municipal/site-sheet';
import { useMediaQuery } from '@/hooks/use-media-query';
import { getErrorMessage } from '@/lib/errors';
import { formatNumber, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/map')({
  staticData: { skeleton: 'map' },
  // Camadas da rede municipal: o preset e só o que o utilizador mudou em relação a ele.
  validateSearch: z.object({
    preset: z.enum(PRESET_IDS).optional().catch(undefined),
    loc: z.boolean().optional().catch(undefined),
    fill: z.enum(FILL_MODES).optional().catch(undefined),
    sites: z.enum(SITES_MODES).optional().catch(undefined),
    kinds: z.string().optional().catch(undefined),
    producers: z.boolean().optional().catch(undefined),
    /** Local municipal aberto na folha de detalhe. */
    site: z.string().optional().catch(undefined),
    /** Freguesia selecionada (código INE/app). */
    parish: z.string().optional().catch(undefined),
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listZonesOptions()),
      queryClient.ensureQueryData(listLocalitiesOptions()),
    ]),
  head: () => ({ meta: [{ title: m.title_map() }] }),
  component: NetworkMapPage,
});

const presetLabel: Record<Preset, () => string> = {
  textile: () => m.mapm_preset_textile(),
  municipal: () => m.mapm_preset_municipal(),
  gaps: () => m.mapm_preset_gaps(),
};

function NetworkMapPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: zones } = useSuspenseQuery(listZonesOptions());
  const { data: localities } = useSuspenseQuery(listLocalitiesOptions());
  const [metric, setMetric] = useState<MapMetric>('demand_t');
  const [showContainers, setShowContainers] = useState(true);
  const [selected, setSelected] = useState<string | null>(search.parish ?? null);
  const [layersOpen, setLayersOpen] = useState(false);
  const desktop = useMediaQuery('(min-width: 1280px)');
  const detailRef = useRef<HTMLDivElement>(null);
  // Em ecrã estreito o detalhe da freguesia fica por baixo do mapa: traz-se à vista ao escolher uma.
  const selectParish = (code: string | null) => {
    setSelected(code);
    if (code && !desktop) {
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'nearest' }),
      );
    }
  };

  const preset = search.preset ?? 'textile';
  const layers = layersFromSearch(search);
  const showLocalities = layers.localities;
  const activePreset = matchPreset(layers);
  // Só centra o mapa no local que veio no URL ao abrir; cliques posteriores não deslocam a vista.
  const initialSite = useRef(search.site);
  const selectSite = (id: string | null) =>
    void navigate({ search: (prev) => ({ ...prev, site: id ?? undefined }), replace: true });
  const { map: municipal, panel } = useMunicipalMap(
    layers,
    search.site ?? null,
    search.site !== undefined && search.site === initialSite.current,
    selectSite,
  );
  const changeLayers = (patch: Partial<LayerState>) =>
    void navigate({
      search: (prev) => ({
        ...prev,
        ...searchFromLayers(preset, { ...layers, ...patch }),
      }),
      replace: true,
    });
  const choosePreset = (next: Preset) =>
    void navigate({
      search: (prev) => ({
        preset: next === 'textile' ? undefined : next,
        site: prev.site,
        parish: prev.parish,
      }),
      replace: true,
    });
  const layersPanel = <LayersPanel state={layers} onChange={changeLayers} {...panel} />;

  const containersQuery = useQuery(listContainersOptions({ query: { limit: 1000 } }));
  const coverageQuery = useQuery(getCoverageOptions({ query: { radius_m: 300 } }));
  const containers = containersQuery.data?.items ?? [];
  const containersTotal = containersQuery.data?.total ?? 0;
  const coverageReady = coverageQuery.data?.state === 'ok';
  const coverage = useMemo(
    () =>
      coverageReady
        ? Object.fromEntries(
            (coverageQuery.data?.parishes ?? []).map((p) => [p.parish_code, p.covered_pct]),
          )
        : undefined,
    [coverageReady, coverageQuery.data],
  );

  const population = zones.reduce((s, z) => s + z.population, 0);
  const demand = zones.reduce((s, z) => s + z.demand_t, 0);
  const located = localities.filter((l) => l.latitude != null).length;

  return (
    <Page className="flex flex-col gap-5 space-y-0 sm:gap-7 sm:space-y-0">
      <PageHeader
        eyebrow={m.map_eyebrow()}
        title={m.map_title()}
        description={m.map_description()}
      />
      <StatStrip className="max-lg:order-last">
        <StatCell
          label={m.map_stat_parishes()}
          value={formatNumber(zones.length)}
          hint={m.map_stat_parishes_hint()}
        />
        <StatCell
          label={m.map_stat_population()}
          value={formatNumber(population)}
          hint={m.map_stat_population_hint()}
        />
        <StatCell
          label={m.map_stat_demand()}
          value={formatTonnes(demand, 0)}
          tag={m.common_estimate()}
          tone="primary"
          hint={m.map_stat_demand_hint({
            kg: formatNumber(population > 0 ? (demand * 1000) / population / 12 : 0, 3),
          })}
        />
        <StatCell
          label={m.map_stat_localities()}
          value={`${located}/${localities.length}`}
          hint={m.map_stat_localities_hint()}
        />
      </StatStrip>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips<Preset>
          legend={m.mapm_presets()}
          value={activePreset}
          onChange={(v) => v && choosePreset(v)}
          options={PRESET_IDS.map((id) => ({ value: id, label: presetLabel[id]() }))}
        />
        {!desktop && (
          <Button
            variant="outline"
            className="h-10 gap-2"
            onClick={() => setLayersOpen(true)}
            aria-haspopup="dialog"
          >
            <Layers aria-hidden="true" />
            {m.mapm_open_layers()}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {layers.fill === 'textile' ? (
          <FilterChips<MapMetric>
            legend={m.map_layer()}
            value={metric}
            onChange={(v) => setMetric(v ?? 'demand_t')}
            options={[
              { value: 'demand_t', label: m.map_layer_demand() },
              { value: 'population', label: m.map_layer_population() },
              { value: 'service_days', label: m.map_layer_service() },
              ...(coverageReady
                ? [{ value: 'covered_pct' as const, label: m.mapc_metric_coverage() }]
                : []),
            ]}
          />
        ) : (
          <p className="text-muted-foreground text-xs">{m.mapm_fill_active()}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Label className="flex min-h-10 items-center gap-2 font-normal text-sm">
            <Switch
              checked={showLocalities}
              onCheckedChange={(v) => changeLayers({ localities: v })}
            />
            {m.map_show_localities()}
          </Label>
          <Label className="flex min-h-10 items-center gap-2 font-normal text-sm">
            <Switch
              checked={showContainers}
              onCheckedChange={setShowContainers}
              disabled={containers.length === 0}
            />
            {m.mapc_layer()}
            <span className="text-muted-foreground text-xs tabular-nums">
              {containersQuery.isPending
                ? m.mapc_layer_loading()
                : containers.length > 0
                  ? m.mapc_layer_count({ count: formatNumber(containers.length) })
                  : null}
            </span>
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <NetworkMap
          zones={zones}
          localities={localities}
          metric={metric}
          showLocalities={showLocalities}
          containers={showContainers ? containers : null}
          coverage={coverage}
          municipal={municipal}
          selected={selected}
          onSelect={selectParish}
          className="h-[28rem] overflow-hidden rounded-xl ring-1 ring-foreground/10 sm:h-[34rem] xl:col-span-9 lg:h-[38rem] xl:h-[42rem] [@media(max-height:500px)]:h-[calc(100dvh-8rem)] xl:[@media(max-height:500px)]:h-[calc(100dvh-8rem)]"
        />
        <div ref={detailRef} className="space-y-4 xl:col-span-3">
          {desktop && (
            <section
              aria-label={m.mapm_panel_title()}
              className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              <h2 className="mb-3 font-serif text-lg">{m.mapm_panel_title()}</h2>
              {layersPanel}
            </section>
          )}
          <ParishPanel zone={zones.find((z) => z.code === selected) ?? null} />
        </div>
      </div>
      {!desktop && (
        <Sheet open={layersOpen} onOpenChange={setLayersOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[88dvh] gap-0 overflow-y-auto overscroll-contain rounded-t-2xl"
          >
            <SheetHeader className="pr-14">
              <SheetTitle className="font-serif text-xl">{m.mapm_panel_title()}</SheetTitle>
              <SheetDescription>{m.mapm_panel_desc()}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">{layersPanel}</div>
          </SheetContent>
        </Sheet>
      )}
      <SiteSheet
        siteId={search.site ?? null}
        onClose={() => selectSite(null)}
        showMapLink={false}
      />
      {containersQuery.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">
            {m.mapc_layer_error()} {getErrorMessage(containersQuery.error)}
          </span>
          <Button variant="outline" size="sm" onClick={() => containersQuery.refetch()}>
            {m.common_retry()}
          </Button>
        </div>
      ) : containersQuery.isSuccess && containers.length === 0 ? (
        <p className="text-muted-foreground text-xs">{m.map_containers_note()}</p>
      ) : containersTotal > containers.length ? (
        <p className="text-muted-foreground text-xs">
          {m.mapc_layer_truncated({
            shown: formatNumber(containers.length),
            total: formatNumber(containersTotal),
          })}
        </p>
      ) : null}
    </Page>
  );
}
