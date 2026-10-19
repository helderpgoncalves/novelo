import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { listLocalitiesOptions, listZonesOptions } from '@/client/@tanstack/react-query.gen';
import { FilterChips } from '@/components/data-table-toolbar';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { type MapMetric, NetworkMap } from '@/features/map/network-map';
import { ParishPanel } from '@/features/map/parish-panel';
import { formatNumber, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/map')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listZonesOptions()),
      queryClient.ensureQueryData(listLocalitiesOptions()),
    ]),
  head: () => ({ meta: [{ title: m.title_map() }] }),
  component: NetworkMapPage,
});

function NetworkMapPage() {
  const { data: zones } = useSuspenseQuery(listZonesOptions());
  const { data: localities } = useSuspenseQuery(listLocalitiesOptions());
  const [metric, setMetric] = useState<MapMetric>('demand_t');
  const [showLocalities, setShowLocalities] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const population = zones.reduce((s, z) => s + z.population, 0);
  const demand = zones.reduce((s, z) => s + z.demand_t, 0);
  const located = localities.filter((l) => l.latitude != null).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={m.map_eyebrow()}
        title={m.map_title()}
        description={m.map_description()}
      />
      <StatStrip>
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
          hint={m.map_stat_demand_hint()}
        />
        <StatCell
          label={m.map_stat_localities()}
          value={`${located}/${localities.length}`}
          hint={m.map_stat_localities_hint()}
        />
      </StatStrip>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips<MapMetric>
          legend={m.map_layer()}
          value={metric}
          onChange={(v) => setMetric(v ?? 'demand_t')}
          options={[
            { value: 'demand_t', label: m.map_layer_demand() },
            { value: 'population', label: m.map_layer_population() },
            { value: 'service_days', label: m.map_layer_service() },
          ]}
        />
        <Label className="flex items-center gap-2 font-normal text-sm">
          <Switch checked={showLocalities} onCheckedChange={setShowLocalities} />
          {m.map_show_localities()}
        </Label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <NetworkMap
          zones={zones}
          localities={localities}
          metric={metric}
          showLocalities={showLocalities}
          selected={selected}
          onSelect={setSelected}
          className="h-[34rem] overflow-hidden rounded-xl ring-1 ring-foreground/10"
        />
        <ParishPanel zone={zones.find((z) => z.code === selected) ?? null} />
      </div>
      <p className="text-muted-foreground text-xs">{m.map_containers_note()}</p>
    </div>
  );
}
