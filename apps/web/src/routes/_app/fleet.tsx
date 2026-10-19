import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getFleetOptions } from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { PageTabs } from '@/components/page-tabs';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { OccupancyHeatmap } from '@/features/fleet/occupancy-heatmap';
import { TypologyTable } from '@/features/fleet/typology-table';
import { VehiclesTable } from '@/features/fleet/vehicles-table';
import { formatNumber } from '@/lib/format';
import { formatDate } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/fleet')({
  staticData: { skeleton: 'table' },
  validateSearch: z.object({
    tab: z.enum(['occupancy', 'vehicles', 'typologies']).optional().catch(undefined),
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(getFleetOptions()),
  head: () => ({ meta: [{ title: m.title_fleet() }] }),
  component: Fleet,
});

function Fleet() {
  const { data } = useSuspenseQuery(getFleetOptions());
  const { tab = 'occupancy' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const idle = data.vehicles.filter((v) => v.never_assigned).length;
  const multi = data.vehicles.filter((v) => v.multi_typology).length;
  const period =
    data.period_start && data.period_end
      ? m.fleet_period({ start: formatDate(data.period_start), end: formatDate(data.period_end) })
      : '';

  return (
    <Page>
      <PageHeader
        eyebrow={m.fleet_eyebrow({ period })}
        title={m.fleet_title()}
        description={m.rw_fleet_description()}
      />
      <StatStrip>
        <StatCell
          label={m.fleet_stat_assignments()}
          value={formatNumber(data.total_assignments)}
          hint={m.fleet_stat_assignments_hint()}
        />
        <StatCell
          label={m.fleet_stat_crew()}
          value={formatNumber(data.total_crew_shifts_week)}
          hint={m.fleet_stat_crew_hint()}
        />
        <StatCell
          label={m.fleet_stat_vehicles()}
          value={formatNumber(data.vehicles.length)}
          hint={m.fleet_stat_vehicles_hint({ count: idle })}
          tone="primary"
        />
        <StatCell
          label={m.fleet_stat_multi()}
          value={formatNumber(multi)}
          hint={m.fleet_stat_multi_hint()}
        />
      </StatStrip>
      <PageTabs
        label={m.rw_tabs_label()}
        value={tab}
        onValueChange={(next) => void navigate({ search: { tab: next }, replace: true })}
        tabs={[
          {
            id: 'occupancy',
            label: m.fleet_heatmap_title(),
            content: (
              <div className="space-y-3">
                <p className="max-w-3xl text-muted-foreground text-sm">
                  {m.fleet_heatmap_description()}
                </p>
                <OccupancyHeatmap typologies={data.typologies} />
              </div>
            ),
          },
          {
            id: 'vehicles',
            label: m.fleet_vehicles_title(),
            count: data.vehicles.length,
            content: <VehiclesTable vehicles={data.vehicles} />,
          },
          {
            id: 'typologies',
            label: m.fleet_summary_title(),
            content: <TypologyTable typologies={data.typologies} />,
          },
        ]}
      />
    </Page>
  );
}
