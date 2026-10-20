import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  getFleetOptions,
  listCircuitsOptions,
  listLocalitiesOptions,
} from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { PageTabs } from '@/components/page-tabs';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { CalendarTab } from '@/features/fleet/calendar-tab';
import { detailKey } from '@/features/fleet/detail-sheet';
import { type FleetSearch, type FleetTab, fleetSearchSchema } from '@/features/fleet/fleet-search';
import { MapTab } from '@/features/fleet/map-tab';
import { OverviewTab } from '@/features/fleet/overview-tab';
import { issuesOf, SHIFTS } from '@/features/fleet/schedule';
import { TypologyTable } from '@/features/fleet/typology-table';
import { useFleetModel } from '@/features/fleet/use-fleet-model';
import { VehiclesTable } from '@/features/fleet/vehicles-table';
import { formatNumber, formatPercent } from '@/lib/format';
import { formatDate, weekdayLong } from '@/lib/i18n';
import { shiftLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/fleet')({
  staticData: { skeleton: 'table' },
  validateSearch: fleetSearchSchema,
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(getFleetOptions()),
      queryClient.ensureQueryData(listCircuitsOptions()),
      queryClient.ensureQueryData(listLocalitiesOptions()),
    ]),
  head: () => ({ meta: [{ title: m.title_fleet() }] }),
  component: Fleet,
});

function Fleet() {
  const fleetQuery = useSuspenseQuery(getFleetOptions());
  const { data } = fleetQuery;
  const { data: circuits } = useSuspenseQuery(listCircuitsOptions());
  const { data: localities } = useSuspenseQuery(listLocalitiesOptions());
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const tab: FleetTab = search.tab ?? 'calendar';
  const model = useFleetModel(data, circuits.circuits, localities);

  const update = (patch: Partial<FleetSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const idle = issuesOf(model.issues, 'vehicle_idle').length;
  const noCar = issuesOf(model.issues, 'circuit_without_vehicle').length;
  const overlaps = new Set(issuesOf(model.issues, 'plate_overlap').map((i) => i.plate)).size;
  const peak = model.totals.peak;
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
      <StatStrip className="lg:grid-cols-6 max-sm:flex max-sm:snap-x max-sm:overflow-x-auto max-sm:[&>*]:min-w-[9.5rem] max-sm:[&>*]:shrink-0 max-sm:[&>*]:snap-start">
        <StatCell
          label={m.fl_kpi_vehicles()}
          value={formatNumber(model.fleetSize)}
          hint={m.fl_kpi_vehicles_hint()}
          tone="primary"
        />
        <StatCell
          label={m.fl_kpi_circuits()}
          value={formatNumber(circuits.total)}
          hint={m.fl_kpi_circuits_hint({ count: formatNumber(noCar) })}
        />
        <StatCell
          label={m.fl_kpi_shifts()}
          value={formatNumber(model.totals.vehicleShifts)}
          hint={m.fl_kpi_shifts_hint()}
        />
        <StatCell
          label={m.fl_kpi_crew()}
          value={formatNumber(model.totals.crewShifts)}
          hint={m.fl_kpi_crew_hint()}
        />
        <StatCell
          label={m.fl_kpi_peak()}
          value={peak ? formatPercent(peak.rate * 100, 0) : m.common_dash()}
          hint={
            peak
              ? m.fl_kpi_peak_hint({
                  day: weekdayLong(peak.day),
                  shift:
                    shiftLabel[SHIFTS.find((s) => s === peak.shift) ?? 'morning']().toLowerCase(),
                  vehicles: formatNumber(peak.vehicles),
                  fleet: formatNumber(model.fleetSize),
                })
              : undefined
          }
        />
        <StatCell label={m.fl_kpi_idle()} value={formatNumber(idle)} hint={m.fl_kpi_idle_hint()} />
      </StatStrip>
      <PageTabs
        label={m.rw_tabs_label()}
        value={tab}
        onValueChange={(next) => update({ tab: next, detail: undefined })}
        tabs={[
          {
            id: 'calendar',
            label: m.fl_tab_calendar(),
            status: overlaps > 0 ? 'attention' : undefined,
            statusLabel: overlaps > 0 ? m.fl_tab_calendar_attention() : undefined,
            content: <CalendarTab model={model} search={search} update={update} />,
          },
          {
            id: 'map',
            label: m.fl_tab_map(),
            content: (
              <MapTab model={model} localities={localities} search={search} update={update} />
            ),
          },
          {
            id: 'overview',
            label: m.fl_tab_overview(),
            content: <OverviewTab fleet={data} model={model} update={update} />,
          },
          {
            id: 'vehicles',
            label: m.fleet_vehicles_title(),
            count: data.vehicles.length,
            content: (
              <VehiclesTable
                vehicles={data.vehicles}
                occs={model.occs}
                refreshing={fleetQuery.isFetching && !fleetQuery.isLoading}
                error={fleetQuery.error}
                onRetry={() =>
                  void queryClient.invalidateQueries({ queryKey: getFleetOptions().queryKey })
                }
                onOpen={(plate) =>
                  update({ tab: 'calendar', detail: detailKey({ kind: 'vehicle', id: plate }) })
                }
                onCalendar={(plate) =>
                  update({
                    tab: 'calendar',
                    view: 'week',
                    plate,
                    circuit: undefined,
                    focus: undefined,
                  })
                }
                onMap={(plate) =>
                  update({ tab: 'map', plate, circuit: undefined, focus: undefined })
                }
              />
            ),
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
