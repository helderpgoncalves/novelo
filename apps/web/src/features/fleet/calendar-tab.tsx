import type { Typology } from '@/client';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';
import { type Density, IssueSummary, Legend } from './calendar-parts';
import {
  CircuitGantt,
  DayList,
  DayStrip,
  UnscheduledTray,
  VehicleGantt,
  type ViewProps,
  WeekGrid,
} from './calendar-views';
import { type Detail, DetailSheet, detailKey, parseDetail } from './detail-sheet';
import { ExportMenu } from './export-menu';
import { FilterBar } from './filter-bar';
import {
  type CalendarView,
  CLEAR_FILTERS,
  type FleetSearch,
  type Focus,
  filtersFromSearch,
  searchFromFilters,
} from './fleet-search';
import {
  buildBlocks,
  type Filters,
  filterOccurrences,
  hasFilters,
  isoWeekday,
  TYPOLOGIES,
} from './schedule';
import { Segmented } from './segmented';
import { TypologyLegend } from './typology-style';
import { useMinWidth } from './use-desktop';
import type { FleetModel } from './use-fleet-model';

interface CalendarTabProps {
  model: FleetModel;
  search: FleetSearch;
  update: (patch: Partial<FleetSearch>) => void;
}

export function CalendarTab({ model, search, update }: CalendarTabProps) {
  const desktop = useMinWidth(768);
  const view: CalendarView = search.view ?? 'week';
  const density: Density = search.dens ?? 'compact';
  const day = search.day ?? isoWeekday();
  const focus: Focus | undefined = search.focus;
  const detail = parseDetail(search.detail);

  // Dia e turno não filtram a grelha da semana: são as próprias colunas e linhas.
  const filters: Filters = { ...filtersFromSearch(search), day: undefined, shift: undefined };
  const filtersActive = hasFilters(filters);
  const occs = filterOccurrences(model.occs, filters, model.circuits);
  const blocks = buildBlocks(occs, model.occs);
  const presentTypologies = TYPOLOGIES.filter((t) => model.occs.some((o) => o.typology === t));

  const open = (d: Detail) => update({ detail: detailKey(d) });
  const viewProps: ViewProps = {
    model,
    occs,
    blocks,
    density,
    focus,
    selected: detail?.kind === 'circuit' ? detail.id : undefined,
    onOpenCircuit: (id) => open({ kind: 'circuit', id }),
    onOpenVehicle: (id) => open({ kind: 'vehicle', id }),
  };

  const setFocus = (next: Focus | undefined) =>
    update({
      focus: next,
      view: next === 'idle' ? 'vehicle' : next === 'nocar' ? 'circuit' : view,
      // As viaturas e os circuitos sem lugar no calendário não têm blocos: os filtros escondê-los-iam.
      ...(next === 'idle' || next === 'nocar' ? CLEAR_FILTERS : {}),
    });

  const dayCounts = new Map<number, number>();
  for (const b of blocks) dayCounts.set(b.day, (dayCounts.get(b.day) ?? 0) + 1);
  const hasAnyShift = blocks.length > 0;

  const body = (() => {
    if (model.occs.length === 0) {
      return <EmptyState title={m.fl_empty_title()} description={m.fl_empty_text()} />;
    }
    if (!hasAnyShift && view !== 'vehicle' && view !== 'circuit') {
      return (
        <EmptyState
          title={m.fl_no_results()}
          description={m.fl_no_results_text()}
          action={
            <Button variant="outline" className="h-10" onClick={() => update(CLEAR_FILTERS)}>
              {m.fl_filters_clear()}
            </Button>
          }
        />
      );
    }
    if (view === 'vehicle') {
      return <VehicleGantt {...viewProps} filtersActive={filtersActive} />;
    }
    if (view === 'circuit') {
      return <CircuitGantt {...viewProps} filtersActive={filtersActive} />;
    }
    if (view === 'week' && desktop) {
      return <WeekGrid {...viewProps} onPickDay={(d) => update({ view: 'day', day: d })} />;
    }
    return (
      <div className="space-y-3">
        <DayStrip day={day} onChange={(d) => update({ day: d })} counts={dayCounts} />
        <DayList {...viewProps} day={day} />
      </div>
    );
  })();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Segmented<CalendarView>
          label={m.fl_view_label()}
          value={view}
          onChange={(v) =>
            update({ view: v, focus: v === 'week' || v === 'day' ? focus : undefined })
          }
          options={[
            { value: 'week', label: m.fl_view_week() },
            { value: 'day', label: m.fl_view_day() },
            { value: 'vehicle', label: m.fl_view_vehicle() },
            { value: 'circuit', label: m.fl_view_circuit() },
          ]}
        />
        <div className="flex items-center gap-2">
          <Segmented<Density>
            label={m.fl_density_label()}
            value={density}
            size="sm"
            onChange={(v) => update({ dens: v })}
            options={[
              { value: 'compact', label: m.fl_density_compact() },
              { value: 'comfortable', label: m.fl_density_comfortable() },
            ]}
          />
          <ExportMenu occs={occs} circuits={model.circuits} />
        </div>
      </div>
      <FilterBar
        filters={filters}
        onChange={(patch) => update(searchFromFilters(patch))}
        onClear={() => update(CLEAR_FILTERS)}
        plates={model.plates}
        circuits={model.circuits.map((c) => c.code)}
        localities={model.localityNames}
        typologies={presentTypologies}
      />
      <IssueSummary issues={model.issues} focus={focus} onFocus={setFocus} />
      <p className="max-w-4xl text-muted-foreground text-xs leading-relaxed">
        {m.fl_calendar_notice()}
      </p>
      {body}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <TypologyLegendRow typologies={presentTypologies} />
        <Legend />
      </div>
      <UnscheduledTray
        model={model}
        onOpenVehicle={(id) => open({ kind: 'vehicle', id })}
        onOpenCircuit={(id) => open({ kind: 'circuit', id })}
      />
      <DetailSheet
        model={model}
        detail={detail}
        onClose={() => update({ detail: undefined })}
        onOpen={open}
        onFilter={(d) =>
          update({
            detail: undefined,
            view: view === 'week' || view === 'day' ? view : 'week',
            ...(d.kind === 'circuit'
              ? { circuit: d.id, plate: undefined }
              : { plate: d.id, circuit: undefined }),
          })
        }
        onMap={(d) =>
          update({
            detail: undefined,
            tab: 'map',
            ...(d.kind === 'circuit'
              ? { circuit: d.id, plate: undefined }
              : { plate: d.id, circuit: undefined }),
          })
        }
      />
    </div>
  );
}

function TypologyLegendRow({ typologies }: { typologies: Typology[] }) {
  return <TypologyLegend only={typologies} />;
}
