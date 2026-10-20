import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { CircuitOut } from '@/client';
import { formatNumber, formatPercent } from '@/lib/format';
import { weekdayAbbr, weekdayLong, weekdayShort } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { shiftLabel, typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import { BlockChip, type Density, FlagIcons } from './calendar-parts';
import type { Focus } from './fleet-search';
import {
  type Block,
  compareCircuit,
  DAYS,
  groupBySlot,
  isoWeekday,
  loadBySlot,
  type Occurrence,
  SHIFTS,
  slotKey,
} from './schedule';
import { Segmented } from './segmented';
import { blockStyle, TypologyMark } from './typology-style';
import type { FleetModel } from './use-fleet-model';

export interface ViewProps {
  model: FleetModel;
  /** Ocorrências já filtradas. */
  occs: Occurrence[];
  /** Blocos já filtrados e com os sinais (sobreposição, lavagem). */
  blocks: Block[];
  density: Density;
  focus: Focus | undefined;
  selected?: string;
  onOpenCircuit: (code: string) => void;
  onOpenVehicle: (plate: string) => void;
}

const dimmed = (b: Block, focus: Focus | undefined) =>
  (focus === 'overlap' && !b.overlap) || (focus === 'wash' && !b.wash);

/* ------------------------------------------------------------------ semana */

const sticky = 'sticky z-20 bg-card';
const todayTint = 'bg-[color-mix(in_oklab,var(--primary)_5%,transparent)]';

export function WeekGrid({
  model,
  occs,
  blocks,
  density,
  focus,
  selected,
  onOpenCircuit,
  onPickDay,
}: ViewProps & { onPickDay: (day: number) => void }) {
  const by = groupBySlot(blocks);
  const load = new Map(loadBySlot(occs, model.fleetSize).map((s) => [slotKey(s.day, s.shift), s]));
  const today = isoWeekday();

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full table-fixed border-separate border-spacing-0">
        <caption className="sr-only">{m.fl_week_grid_label()}</caption>
        <colgroup>
          <col className="w-[4.25rem]" />
          {DAYS.map((d) => (
            <col key={d} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={cn(sticky, 'top-0 rounded-tl-xl')}>
              <span className="sr-only">{m.fl_filter_shift()}</span>
            </th>
            {DAYS.map((d) => (
              <th
                key={d}
                scope="col"
                className={cn(
                  sticky,
                  'top-0 border-l p-0 text-left font-normal',
                  d === 7 && 'rounded-tr-xl',
                  d === today && 'bg-[color-mix(in_oklab,var(--primary)_9%,var(--card))]',
                )}
              >
                <button
                  type="button"
                  onClick={() => onPickDay(d)}
                  aria-label={m.fl_open_day({ day: weekdayLong(d) })}
                  className={cn(
                    'flex min-h-11 w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left transition-colors hover:bg-muted/60',
                    d === 7 && 'rounded-tr-xl',
                  )}
                >
                  <span className="font-medium text-sm capitalize" aria-hidden="true">
                    <span className="2xl:hidden">{weekdayShort(d)}</span>
                    <span className="hidden 2xl:inline">{weekdayLong(d)}</span>
                  </span>
                  {d === today && (
                    <span className="rounded-full bg-primary px-1.5 font-semibold text-[9px] text-primary-foreground uppercase tracking-wider">
                      {m.fl_today()}
                    </span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SHIFTS.map((s, row) => (
            <tr key={s}>
              <th
                scope="row"
                className={cn(
                  'border-t px-2 py-2 text-left align-top font-medium text-muted-foreground text-xs',
                  row === SHIFTS.length - 1 && 'rounded-bl-xl',
                )}
              >
                {shiftLabel[s]()}
              </th>
              {DAYS.map((d) => {
                const list = by.get(slotKey(d, s)) ?? [];
                const l = load.get(slotKey(d, s));
                return (
                  <td
                    key={d}
                    aria-label={m.fl_cell_label({
                      day: weekdayLong(d),
                      shift: shiftLabel[s](),
                      circuits: list.length,
                      vehicles: l?.vehicles ?? 0,
                    })}
                    className={cn(
                      'relative min-w-0 border-t border-l p-1.5 pt-2.5 align-top',
                      density === 'comfortable' ? 'h-24' : 'h-14',
                      d === today && todayTint,
                      row === SHIFTS.length - 1 && d === 7 && 'rounded-br-xl',
                    )}
                  >
                    {l && l.vehicles > 0 && (
                      <>
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-0 top-0 h-[3px] bg-primary/50"
                          style={{ width: `${Math.min(100, l.rate * 100)}%` }}
                        />
                        <p className="mb-1 flex items-center justify-between gap-1 text-[10px] text-muted-foreground tabular-nums">
                          <span>{m.fl_cell_vehicles({ count: l.vehicles })}</span>
                          <span>{formatPercent(l.rate * 100, 0)}</span>
                        </p>
                      </>
                    )}
                    {list.length === 0 ? (
                      <span
                        className="block text-center text-muted-foreground/40"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                    ) : (
                      <div
                        className={cn(
                          density === 'comfortable'
                            ? 'flex flex-col gap-1'
                            : 'flex flex-wrap gap-1',
                        )}
                      >
                        {list.map((b) => (
                          <BlockChip
                            key={b.key}
                            block={b}
                            density={density}
                            onOpen={onOpenCircuit}
                            dim={dimmed(b, focus)}
                            selected={selected === b.circuit}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------------- dia */

export function DayStrip({
  day,
  onChange,
  counts,
}: {
  day: number;
  onChange: (day: number) => void;
  counts: Map<number, number>;
}) {
  const today = isoWeekday();
  return (
    <div className="sticky top-0 z-20 -mx-1 bg-background/95 px-1 py-1 backdrop-blur">
      <Segmented
        label={m.fl_day_picker()}
        value={String(day)}
        onChange={(v) => onChange(Number(v))}
        fill
        size="lg"
        options={DAYS.map((d) => ({
          value: String(d),
          ariaLabel: `${weekdayLong(d)}${d === today ? `, ${m.fl_today().toLowerCase()}` : ''}: ${m.fl_day_count({ count: counts.get(d) ?? 0 })}`,
          label: (
            <span className="flex flex-col items-center leading-tight">
              <span>{weekdayAbbr(d)}</span>
              <span className="font-normal text-[10px] tabular-nums opacity-70">
                {counts.get(d) ?? 0}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 h-0.5 w-3 rounded-full',
                  d === today ? 'bg-primary' : 'bg-transparent',
                )}
              />
            </span>
          ),
        }))}
      />
    </div>
  );
}

export function DayList({
  model,
  occs,
  blocks,
  focus,
  day,
  onOpenCircuit,
}: ViewProps & { day: number }) {
  const by = groupBySlot(blocks.filter((b) => b.day === day));
  const load = new Map(
    loadBySlot(occs, model.fleetSize)
      .filter((s) => s.day === day)
      .map((s) => [s.shift, s]),
  );
  const any = blocks.some((b) => b.day === day);

  return (
    <div className="space-y-4">
      {!any && (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
          {m.fl_day_empty({ day: weekdayLong(day) })}
        </p>
      )}
      {SHIFTS.map((s) => {
        const list = by.get(slotKey(day, s)) ?? [];
        if (!list.length) return null;
        const l = load.get(s);
        return (
          <section
            key={s}
            aria-label={shiftLabel[s]()}
            className="rounded-xl bg-card ring-1 ring-foreground/10"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-x-3 border-b px-3 py-2">
              <h3 className="font-sans font-semibold text-sm tracking-normal">{shiftLabel[s]()}</h3>
              <p className="text-muted-foreground text-xs tabular-nums">
                {m.fl_shift_summary({
                  circuits: list.length,
                  vehicles: l?.vehicles ?? 0,
                  rate: formatPercent((l?.rate ?? 0) * 100, 0),
                })}
              </p>
            </header>
            <ul className="divide-y">
              {list.map((b) => (
                <li key={b.key}>
                  <button
                    type="button"
                    onClick={() => onOpenCircuit(b.circuit)}
                    aria-haspopup="dialog"
                    className={cn(
                      'grid min-h-12 w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 border-l-[3px] px-3 py-2 text-left transition-colors hover:bg-muted/50 sm:grid-cols-[8rem_9rem_1fr_auto]',
                      dimmed(b, focus) && 'opacity-40',
                    )}
                    style={{ borderLeftColor: blockStyle(b.typology).borderLeftColor }}
                  >
                    <span className="flex items-center gap-1.5 font-semibold tabular-nums">
                      <TypologyMark typology={b.typology} />
                      {b.circuit}
                      <FlagIcons block={b} />
                    </span>
                    <span className="order-last col-span-2 text-muted-foreground text-xs sm:order-none sm:col-span-1">
                      {typologyLabel[b.typology]()}
                    </span>
                    <span className="order-last col-span-2 text-xs tabular-nums sm:order-none sm:col-span-1">
                      {b.plates.join(' · ')}
                      {b.crew > 0 && (
                        <span className="text-muted-foreground">
                          {' '}
                          · {m.fl_crew_short({ count: b.crew })}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ por viatura */

function GanttShell({
  children,
  label,
  corner,
}: {
  children: ReactNode;
  label: string;
  corner: string;
}) {
  const today = isoWeekday();
  return (
    <div className="max-h-[72vh] overflow-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full min-w-[62rem] table-fixed border-separate border-spacing-0">
        <caption className="sr-only">{label}</caption>
        <colgroup>
          <col className="w-[8.5rem]" />
          {DAYS.flatMap((d) => SHIFTS.map((s) => <col key={`${d}${s}`} />))}
        </colgroup>
        <thead>
          <tr>
            <th
              scope="col"
              rowSpan={2}
              className="sticky top-0 left-0 z-30 bg-card px-2 py-1.5 text-left align-bottom font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.14em]"
            >
              {corner}
            </th>
            {DAYS.map((d) => (
              <th
                key={d}
                scope="colgroup"
                colSpan={3}
                aria-label={weekdayLong(d)}
                className={cn(
                  'sticky top-0 z-20 h-7 border-l bg-card px-1 text-center font-medium text-xs capitalize',
                  d === today &&
                    'bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))] text-primary',
                )}
              >
                {weekdayShort(d)}
                {d === today && <span className="sr-only"> ({m.fl_today()})</span>}
              </th>
            ))}
          </tr>
          <tr>
            {DAYS.flatMap((d) =>
              SHIFTS.map((s, i) => (
                <th
                  key={`${d}${s}`}
                  scope="col"
                  aria-label={`${weekdayLong(d)}, ${shiftLabel[s]()}`}
                  title={shiftLabel[s]()}
                  className={cn(
                    'sticky top-7 z-20 bg-card pb-1 text-center font-normal text-[10px] text-muted-foreground',
                    i === 0 ? 'border-l' : 'border-l border-l-border/40',
                    d === today && 'bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))]',
                  )}
                >
                  <span aria-hidden="true">{shiftLabel[s]().charAt(0)}</span>
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function RowHead({ children, issue }: { children: ReactNode; issue?: boolean }) {
  return (
    <th
      scope="row"
      className={cn(
        'sticky left-0 z-10 border-t bg-card px-2 py-1.5 text-left font-normal text-xs',
        issue && 'shadow-[inset_3px_0_0_var(--fleet-warn)]',
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">{children}</div>
    </th>
  );
}

export function VehicleGantt({
  model,
  blocks,
  density,
  focus,
  filtersActive,
  selected,
  onOpenCircuit,
  onOpenVehicle,
}: ViewProps & { filtersActive: boolean }) {
  const today = isoWeekday();
  const byPlate = new Map<string, Map<string, Block[]>>();
  for (const b of blocks) {
    for (const plate of b.plates) {
      const slots = byPlate.get(plate) ?? new Map<string, Block[]>();
      slots.set(slotKey(b.day, b.shift), [...(slots.get(slotKey(b.day, b.shift)) ?? []), b]);
      byPlate.set(plate, slots);
    }
  }
  const idle = new Set(model.issues.filter((i) => i.kind === 'vehicle_idle').map((i) => i.plate));
  const flagged = new Set(
    model.issues
      .filter((i) => i.kind === 'plate_overlap' || i.kind === 'wash_between_flows')
      .filter((i) => (focus === 'wash' ? i.kind === 'wash_between_flows' : true))
      .map((i) => i.plate),
  );
  const rows = model.plates.filter((p) => {
    if (focus === 'idle') return idle.has(p);
    if (idle.has(p)) return !filtersActive;
    return byPlate.has(p);
  });

  if (!rows.length) {
    return <EmptyGrid text={m.fl_no_results()} />;
  }

  return (
    <GanttShell label={m.fl_gantt_vehicles_label()} corner={m.fl_filter_vehicle()}>
      {rows.map((plate) => {
        const slots = byPlate.get(plate);
        const v = model.vehicleMap.get(plate);
        return (
          <tr key={plate}>
            <RowHead issue={flagged.has(plate) && (focus === 'overlap' || focus === 'wash')}>
              <button
                type="button"
                onClick={() => onOpenVehicle(plate)}
                aria-haspopup="dialog"
                className="truncate rounded font-semibold tabular-nums underline-offset-2 hover:underline"
              >
                {plate}
              </button>
              <span className="flex shrink-0 gap-0.5">
                {v?.typologies.map((t) => (
                  <TypologyMark key={t} typology={t} />
                ))}
              </span>
            </RowHead>
            {idle.has(plate) ? (
              <td
                colSpan={21}
                className="border-t border-l px-3 py-2 text-muted-foreground text-xs"
              >
                {m.fl_vehicle_idle_row()}
              </td>
            ) : (
              DAYS.flatMap((d) =>
                SHIFTS.map((s, i) => {
                  const list = slots?.get(slotKey(d, s)) ?? [];
                  return (
                    <td
                      key={`${d}${s}`}
                      aria-label={`${weekdayLong(d)}, ${shiftLabel[s]()}: ${list.map((b) => b.circuit).join(', ') || m.fl_no_service()}`}
                      className={cn(
                        'min-w-0 border-t p-0.5 align-middle',
                        i === 0 ? 'border-l' : 'border-l border-l-border/40',
                        d === today && todayTint,
                      )}
                    >
                      <div className="flex flex-col gap-0.5">
                        {list.map((b) => (
                          <BlockChip
                            key={b.key}
                            block={b}
                            density={density}
                            tiny
                            onOpen={onOpenCircuit}
                            dim={dimmed(b, focus)}
                            selected={selected === b.circuit}
                          />
                        ))}
                      </div>
                    </td>
                  );
                }),
              )
            )}
          </tr>
        );
      })}
    </GanttShell>
  );
}

/* ------------------------------------------------------------ por circuito */

export function CircuitGantt({
  model,
  blocks,
  focus,
  filtersActive,
  selected,
  onOpenCircuit,
}: ViewProps & { filtersActive: boolean }) {
  const today = isoWeekday();
  const byCircuit = new Map<string, Map<number, Block[]>>();
  for (const b of blocks) {
    const days = byCircuit.get(b.circuit) ?? new Map<number, Block[]>();
    days.set(b.day, [...(days.get(b.day) ?? []), b]);
    byCircuit.set(b.circuit, days);
  }
  const noCar = new Set(
    model.issues.filter((i) => i.kind === 'circuit_without_vehicle').map((i) => i.circuit),
  );
  const rows: CircuitOut[] = model.circuits.filter((c) => {
    if (focus === 'nocar') return noCar.has(c.code);
    if (noCar.has(c.code)) return !filtersActive;
    return byCircuit.has(c.code);
  });
  // Agrupados por tipologia (como no ficheiro da Vitrus) e depois pelo código.
  rows.sort((a, b) => a.typology.localeCompare(b.typology) || compareCircuit(a.code, b.code));

  if (!rows.length) return <EmptyGrid text={m.fl_no_results()} />;

  return (
    <div className="max-h-[72vh] overflow-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full min-w-[56rem] table-fixed border-separate border-spacing-0">
        <caption className="sr-only">{m.fl_gantt_circuits_label()}</caption>
        <colgroup>
          <col className="w-[9rem]" />
          {DAYS.map((d) => (
            <col key={d} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky top-0 left-0 z-30 bg-card px-2 py-2 text-left font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.14em]"
            >
              {m.fl_filter_circuit()}
            </th>
            {DAYS.map((d) => (
              <th
                key={d}
                scope="col"
                className={cn(
                  'sticky top-0 z-20 border-l bg-card px-2 py-2 text-left font-medium text-xs capitalize',
                  d === today &&
                    'bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))] text-primary',
                )}
              >
                {weekdayShort(d)}
                {d === today && <span className="sr-only"> ({m.fl_today()})</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const days = byCircuit.get(c.code);
            const none = noCar.has(c.code);
            return (
              <tr key={c.code}>
                <RowHead>
                  <TypologyMark typology={c.typology} />
                  <button
                    type="button"
                    onClick={() => onOpenCircuit(c.code)}
                    aria-haspopup="dialog"
                    className="truncate rounded font-semibold tabular-nums underline-offset-2 hover:underline"
                    title={`${c.code} · ${typologyLabel[c.typology]()}`}
                  >
                    {c.code}
                  </button>
                </RowHead>
                {DAYS.map((d) => {
                  const list = days?.get(d) ?? [];
                  return (
                    <td
                      key={d}
                      aria-label={`${weekdayLong(d)}: ${
                        none && c.weekdays.includes(d)
                          ? m.fl_circuit_no_vehicle()
                          : list
                              .map((b) => `${shiftLabel[b.shift]()} ${b.plates.join(', ')}`)
                              .join('; ') || m.fl_no_service()
                      }`}
                      className={cn(
                        'min-w-0 border-t border-l p-0.5 align-middle',
                        d === today && todayTint,
                      )}
                    >
                      <div className="flex flex-col gap-0.5">
                        {none && c.weekdays.includes(d) && (
                          <span className="flex min-h-6 items-center justify-center rounded-[4px] border border-dashed text-[10px] text-muted-foreground">
                            {m.fl_circuit_no_vehicle_short()}
                          </span>
                        )}
                        {list.map((b) => (
                          <ShiftLine
                            key={b.key}
                            block={b}
                            dim={dimmed(b, focus)}
                            selected={selected === b.circuit}
                            onOpen={onOpenCircuit}
                          />
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Linha de um turno numa célula da vista por circuito: inicial do turno e matrículas. */
function ShiftLine({
  block,
  dim,
  selected,
  onOpen,
}: {
  block: Block;
  dim: boolean;
  selected: boolean;
  onOpen: (code: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(block.circuit)}
      aria-haspopup="dialog"
      aria-label={`${block.circuit}, ${shiftLabel[block.shift]()}: ${block.plates.join(', ')}`}
      title={`${shiftLabel[block.shift]()} · ${block.plates.join(', ')}`}
      style={blockStyle(block.typology)}
      className={cn(
        'relative flex min-h-6 w-full min-w-0 items-center gap-1.5 rounded-[4px] border-l-[3px] px-1.5 text-left text-[11px] ring-1 ring-foreground/10 hover:ring-foreground/35',
        block.overlap && 'ring-2 ring-[var(--fleet-warn)]',
        selected && 'ring-2 ring-primary',
        dim && 'opacity-35',
      )}
    >
      <span className="w-3 shrink-0 font-semibold text-muted-foreground" aria-hidden="true">
        {shiftLabel[block.shift]().charAt(0)}
      </span>
      <span className="truncate tabular-nums">{block.plates.join(' · ')}</span>
      <FlagIcons block={block} className="ml-auto shrink-0" />
    </button>
  );
}

function EmptyGrid({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed px-4 py-10 text-center text-muted-foreground text-sm">
      {text}
    </p>
  );
}

/* ------------------------------------------------- fora do calendário */

export function UnscheduledTray({
  model,
  onOpenVehicle,
  onOpenCircuit,
}: {
  model: FleetModel;
  onOpenVehicle: (plate: string) => void;
  onOpenCircuit: (code: string) => void;
}) {
  const plates = model.issues.filter((i) => i.kind === 'vehicle_idle').map((i) => i.plate ?? '');
  const circuits = model.issues
    .filter((i) => i.kind === 'circuit_without_vehicle')
    .map((i) => i.circuit ?? '');
  if (!plates.length && !circuits.length) return null;
  const chip =
    'inline-flex h-7 items-center rounded-md border border-dashed bg-card px-2 text-xs font-medium tabular-nums hover:bg-muted';
  return (
    <details className="group rounded-xl bg-card ring-1 ring-foreground/10">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm">
        <span className="font-medium">{m.fl_tray_title()}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {m.fl_tray_summary({ vehicles: plates.length, circuits: circuits.length })}
        </span>
      </summary>
      <div className="grid gap-4 border-t px-3 py-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
            {m.fl_tray_vehicles({ count: formatNumber(plates.length) })}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {plates.map((p) => (
              <li key={p}>
                <button type="button" className={chip} onClick={() => onOpenVehicle(p)}>
                  {p}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">{m.fl_tray_vehicles_hint()}</p>
        </div>
        <div className="space-y-1.5">
          <p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
            {m.fl_tray_circuits({ count: formatNumber(circuits.length) })}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {circuits.map((c) => (
              <li key={c}>
                <button type="button" className={chip} onClick={() => onOpenCircuit(c)}>
                  {c}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">{m.fl_tray_circuits_hint()}</p>
        </div>
      </div>
    </details>
  );
}
