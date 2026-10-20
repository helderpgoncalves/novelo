import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { FleetSummary, Typology } from '@/client';
import { Panel, Section } from '@/components/page';
import { Button } from '@/components/ui/button';
import { formatNumber, formatPercent } from '@/lib/format';
import { formatList, weekdayLong } from '@/lib/i18n';
import { shiftLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import type { FleetSearch } from './fleet-search';
import { LoadChart } from './load-chart';
import { OccupancyHeatmap } from './occupancy-heatmap';
import { issuesOf, type SlotLoad } from './schedule';
import type { FleetModel } from './use-fleet-model';

interface Alert {
  id: string;
  title: ReactNode;
  detail?: string;
  action: string;
  patch: Partial<FleetSearch>;
}

const MAX_LISTED = 6;
const listed = (items: string[]) =>
  items.length > MAX_LISTED
    ? `${formatList(items.slice(0, MAX_LISTED))} +${items.length - MAX_LISTED}`
    : formatList(items);

export function OverviewTab({
  fleet,
  model,
  update,
}: {
  fleet: FleetSummary;
  model: FleetModel;
  update: (patch: Partial<FleetSearch>) => void;
}) {
  const { issues, totals, fleetSize } = model;
  const idle = issuesOf(issues, 'vehicle_idle').map((i) => i.plate ?? '');
  const noCar = issuesOf(issues, 'circuit_without_vehicle').map((i) => i.circuit ?? '');
  const overlaps = issuesOf(issues, 'plate_overlap');
  const grouped = issuesOf(issues, 'plate_grouped');
  const wash = issuesOf(issues, 'wash_between_flows');
  const assumed = issuesOf(issues, 'days_assumed').map((i) => i.circuit ?? '');
  const uniq = (list: (string | undefined)[]) => [...new Set(list.filter(Boolean) as string[])];

  const alerts: Alert[] = [];
  if (idle.length) {
    alerts.push({
      id: 'idle',
      title: m.fl_alert_idle({ count: formatNumber(idle.length) }),
      detail: listed(idle),
      action: m.fl_alert_see_vehicles(),
      patch: { tab: 'calendar', view: 'vehicle', focus: 'idle' },
    });
  }
  if (noCar.length) {
    alerts.push({
      id: 'nocar',
      title: m.fl_alert_nocar({ count: formatNumber(noCar.length) }),
      detail: listed(noCar),
      action: m.fl_alert_see_circuits(),
      patch: { tab: 'calendar', view: 'circuit', focus: 'nocar' },
    });
  }
  if (overlaps.length) {
    const plates = uniq(overlaps.map((i) => i.plate));
    alerts.push({
      id: 'overlap',
      title: m.fl_alert_overlap({ count: formatNumber(plates.length) }),
      detail: `${listed(plates)} · ${m.fl_alert_overlap_hint()}`,
      action: m.fl_alert_see_calendar(),
      patch: { tab: 'calendar', view: 'week', focus: 'overlap' },
    });
  }
  if (grouped.length) {
    const plates = uniq(grouped.map((i) => i.plate));
    alerts.push({
      id: 'grouped',
      title: m.fl_alert_grouped({ count: formatNumber(plates.length) }),
      detail: `${listed(plates)} · ${m.fl_alert_grouped_hint()}`,
      action: m.fl_alert_see_calendar(),
      patch: { tab: 'calendar', view: 'week' },
    });
  }
  if (wash.length) {
    const plates = uniq(wash.map((i) => i.plate));
    alerts.push({
      id: 'wash',
      title: m.fl_alert_wash({ count: formatNumber(plates.length) }),
      detail: listed(plates),
      action: m.fl_alert_see_calendar(),
      patch: { tab: 'calendar', view: 'week', focus: 'wash' },
    });
  }
  if (assumed.length) {
    alerts.push({
      id: 'assumed',
      title: m.fl_alert_assumed({ count: formatNumber(assumed.length) }),
      detail: `${listed(assumed)} · ${m.fl_alert_assumed_hint()}`,
      action: m.fl_alert_see_circuits(),
      patch: { tab: 'calendar', view: 'circuit' },
    });
  }

  const peak = totals.peak;
  const quietest = quietestSlot(model.load);

  return (
    <div className="space-y-5 sm:space-y-7">
      <Section title={m.fl_alerts_title()} description={m.fl_alerts_description()}>
        {alerts.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-muted-foreground text-sm">
            {m.fl_alerts_none()}
          </p>
        ) : (
          <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
              >
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-medium text-sm">{a.title}</p>
                  {a.detail && (
                    <p className="text-muted-foreground text-xs leading-relaxed tabular-nums">
                      {a.detail}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5"
                  onClick={() => update({ ...a.patch, detail: undefined })}
                >
                  {a.action}
                  <ArrowRight aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={m.fl_chart_title()}
        description={
          peak
            ? m.fl_chart_description({
                day: weekdayLong(peak.day),
                shift: shiftLabel[peak.shift]().toLowerCase(),
                vehicles: formatNumber(peak.vehicles),
                fleet: formatNumber(fleetSize),
                rate: formatPercent(peak.rate * 100, 0),
                quiet: quietest
                  ? `${weekdayLong(quietest.day)}, ${shiftLabel[quietest.shift]().toLowerCase()}`
                  : '',
                quietVehicles: formatNumber(quietest?.vehicles ?? 0),
              })
            : undefined
        }
      >
        <Panel>
          <LoadChart load={model.load} fleetSize={fleetSize} />
        </Panel>
      </Section>

      <Section title={m.fleet_heatmap_title()} description={m.fleet_heatmap_description()}>
        <OccupancyHeatmap
          typologies={fleet.typologies}
          onPickTypology={(t: Typology) =>
            update({ tab: 'calendar', view: 'week', ty: t, focus: undefined })
          }
        />
      </Section>
    </div>
  );
}

/** Turno com menos viaturas em uso entre os que têm serviço (a janela mais livre do planeamento). */
function quietestSlot(load: SlotLoad[]): SlotLoad | null {
  return load
    .filter((s) => s.vehicles > 0)
    .reduce<SlotLoad | null>((best, s) => (!best || s.vehicles < best.vehicles ? s : best), null);
}
