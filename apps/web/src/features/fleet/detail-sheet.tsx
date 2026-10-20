import { CalendarDays, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { WeekdayDots } from '@/components/weekdays';
import { formatList } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { circuitStatusLabel, collectionLabel, typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import { issueText } from './calendar-parts';
import { MiniWeek } from './mini-week';
import {
  buildBlocks,
  compareCircuit,
  groupIssues,
  type Issue,
  type Occurrence,
  routeOrder,
} from './schedule';
import { TypologyMark } from './typology-style';
import { useMinWidth } from './use-desktop';
import type { FleetModel } from './use-fleet-model';

export type Detail = { kind: 'circuit'; id: string } | { kind: 'vehicle'; id: string };

export const parseDetail = (value: string | undefined): Detail | null => {
  if (!value) return null;
  const [kind, ...rest] = value.split(':');
  const id = rest.join(':');
  if (!id) return null;
  return kind === 'c' ? { kind: 'circuit', id } : kind === 'v' ? { kind: 'vehicle', id } : null;
};

export const detailKey = (d: Detail | null) =>
  d ? `${d.kind === 'circuit' ? 'c' : 'v'}:${d.id}` : undefined;

interface DetailSheetProps {
  model: FleetModel;
  detail: Detail | null;
  onClose: () => void;
  onOpen: (detail: Detail) => void;
  onFilter: (detail: Detail) => void;
  onMap: (detail: Detail) => void;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-sans font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function IssueList({ issues }: { issues: Issue[] }) {
  if (!issues.length) {
    return <p className="text-muted-foreground text-sm">{m.fl_detail_no_issues()}</p>;
  }
  return (
    <ul className="space-y-1.5 text-sm">
      {groupIssues(issues).map((i) => (
        <li
          key={`${i.kind}-${i.plate}-${i.circuit}-${i.days?.join('')}-${i.shift}`}
          className={cn(
            'rounded-md border-l-2 bg-muted/50 px-3 py-1.5',
            i.kind === 'plate_grouped' ? 'border-muted-foreground' : 'border-[var(--fleet-warn)]',
          )}
        >
          {issueText(i)}
        </li>
      ))}
    </ul>
  );
}

const Chip = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex h-8 items-center gap-1 rounded-md border bg-card px-2.5 font-medium text-xs tabular-nums hover:bg-muted"
  >
    {children}
  </button>
);

function CircuitDetail({
  model,
  code,
  onOpen,
  onFilter,
  onMap,
}: { model: FleetModel; code: string } & Omit<DetailSheetProps, 'detail' | 'onClose' | 'model'>) {
  const circuit = model.circuitMap.get(code);
  const occs = model.occs.filter((o) => o.circuit === code);
  const blocks = buildBlocks(occs, model.occs);
  const plates = [...new Set(occs.map((o) => o.plate))].sort();
  const issues = model.issues.filter(
    (i) =>
      i.circuit === code || i.detail.includes(code) || blocks.some((b) => i.blocks.includes(b.key)),
  );
  const typology = circuit?.typology ?? occs[0]?.typology ?? 'unassigned';
  const collections = [...new Set(occs.map((o) => o.collection))].filter(
    (c) => c !== 'unspecified',
  );
  const planningNotes = [...new Set(occs.map((o) => o.note).filter((n): n is string => !!n))];

  return (
    <>
      <SheetHeader className="space-y-1.5 border-b p-4 pr-12">
        <p className="eyebrow">{m.fl_detail_circuit()}</p>
        <SheetTitle className="flex items-center gap-2 text-2xl">
          <TypologyMark typology={typology} className="size-4" />
          {code}
        </SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-1.5">
          <span>{typologyLabel[typology]()}</span>
          {circuit && circuit.collection_type !== 'unspecified' && (
            <span>· {collectionLabel[circuit.collection_type]()}</span>
          )}
          {circuit && circuit.status !== 'ok' && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              {circuitStatusLabel[circuit.status]()}
            </Badge>
          )}
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <Block title={m.fl_detail_when()}>
          {occs.length ? (
            <MiniWeek
              caption={m.fl_detail_week_caption({ name: code })}
              items={blocks.map((b) => ({
                day: b.day,
                shift: b.shift,
                label: b.plates.map((p) => p.slice(0, 5)).join(' · '),
                typology: b.typology,
              }))}
            />
          ) : (
            <p className="text-muted-foreground text-sm">{m.fl_circuit_no_vehicle()}</p>
          )}
          {circuit && circuit.weekdays.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
              <span>{m.fl_detail_days_circuit()}</span>
              <WeekdayDots days={circuit.weekdays} />
            </div>
          )}
          {circuit?.days_text && (
            <p className="text-muted-foreground text-xs">
              {m.fl_detail_days_text({ text: circuit.days_text })}
            </p>
          )}
        </Block>
        <Block title={m.fl_detail_vehicles()}>
          {plates.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {plates.map((p) => (
                <li key={p}>
                  <Chip onClick={() => onOpen({ kind: 'vehicle', id: p })}>{p}</Chip>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">{m.fl_circuit_no_vehicle()}</p>
          )}
          {occs.length > 0 && (
            <p className="text-muted-foreground text-xs">
              {m.fl_detail_crew({ crew: Math.max(...occs.map((o) => o.crew)) })}
            </p>
          )}
        </Block>
        {(collections.length > 0 || planningNotes.length > 0) && (
          <Block title={m.fl_detail_collection()}>
            {collections.length > 0 && (
              <p className="text-sm">{collections.map((c) => collectionLabel[c]()).join(', ')}</p>
            )}
            {planningNotes.map((n) => (
              <p key={n} className="text-muted-foreground text-xs">
                {n}
              </p>
            ))}
          </Block>
        )}
        <Block title={m.fl_detail_localities()}>
          {circuit?.localities.length ? (
            <p className="text-sm leading-relaxed">{formatList(circuit.localities)}</p>
          ) : (
            <p className="text-muted-foreground text-sm">{m.fl_detail_no_localities()}</p>
          )}
        </Block>
        {circuit?.note && (
          <Block title={m.fl_detail_notes()}>
            <p className="text-sm leading-relaxed">{circuit.note}</p>
          </Block>
        )}
        <Block title={m.fl_detail_issues()}>
          <IssueList issues={issues} />
        </Block>
      </div>
      <Actions
        onFilter={() => onFilter({ kind: 'circuit', id: code })}
        onMap={() => onMap({ kind: 'circuit', id: code })}
      />
    </>
  );
}

function Actions({ onFilter, onMap }: { onFilter: () => void; onMap: () => void }) {
  return (
    <div className="flex flex-wrap gap-2 border-t p-4">
      <Button variant="outline" className="h-10 flex-1 gap-1.5" onClick={onFilter}>
        <CalendarDays aria-hidden="true" />
        {m.fl_detail_filter()}
      </Button>
      <Button variant="outline" className="h-10 flex-1 gap-1.5" onClick={onMap}>
        <MapPin aria-hidden="true" />
        {m.fl_detail_map()}
      </Button>
    </div>
  );
}

function VehicleDetail({
  model,
  plate,
  onOpen,
  onFilter,
  onMap,
}: { model: FleetModel; plate: string } & Omit<DetailSheetProps, 'detail' | 'onClose' | 'model'>) {
  const vehicle = model.vehicleMap.get(plate);
  const occs: Occurrence[] = model.occs.filter((o) => o.plate === plate);
  const circuits = [...new Set(occs.map((o) => o.circuit))].sort(compareCircuit);
  const issues = model.issues.filter((i) => i.plate === plate);
  // Pela ordem do percurso de cada circuito, não alfabética.
  const localities = routeOrder(circuits, model.circuitMap);
  const idle = vehicle?.never_assigned ?? occs.length === 0;

  return (
    <>
      <SheetHeader className="space-y-1.5 border-b p-4 pr-12">
        <p className="eyebrow">{m.fl_detail_vehicle()}</p>
        <SheetTitle className="text-2xl tabular-nums">{plate}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-1.5">
          {vehicle?.typologies.length ? (
            vehicle.typologies.map((t) => (
              <span key={t} className="inline-flex items-center gap-1">
                <TypologyMark typology={t} />
                {typologyLabel[t]()}
              </span>
            ))
          ) : (
            <span>{m.fl_vehicle_idle_row()}</span>
          )}
          {vehicle?.multi_typology && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              {m.fleet_flag_multi()}
            </Badge>
          )}
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <Block title={m.fl_detail_when()}>
          {idle ? (
            <p className="text-muted-foreground text-sm">{m.fl_vehicle_idle_row()}</p>
          ) : (
            <MiniWeek
              caption={m.fl_detail_week_caption({ name: plate })}
              items={buildBlocks(occs, model.occs).flatMap((b) => ({
                day: b.day,
                shift: b.shift,
                label: b.circuit,
                typology: b.typology,
              }))}
            />
          )}
          {vehicle && vehicle.max_crew > 0 && (
            <p className="text-muted-foreground text-xs">
              {m.fl_detail_crew({ crew: vehicle.max_crew })}
            </p>
          )}
        </Block>
        <Block title={m.fl_detail_circuits()}>
          {circuits.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {circuits.map((c) => (
                <li key={c}>
                  <Chip onClick={() => onOpen({ kind: 'circuit', id: c })}>
                    <TypologyMark
                      typology={occs.find((o) => o.circuit === c)?.typology ?? 'unassigned'}
                    />
                    {c}
                  </Chip>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">{m.common_dash()}</p>
          )}
          {circuits.map((c) => {
            const kinds = [
              ...new Set(occs.filter((o) => o.circuit === c).map((o) => o.collection)),
            ].filter((k) => k !== 'unspecified');
            return kinds.length ? (
              <p key={c} className="text-muted-foreground text-xs">
                {m.fl_detail_collection_of({
                  circuit: c,
                  kinds: kinds.map((k) => collectionLabel[k]()).join(', '),
                })}
              </p>
            ) : null;
          })}
        </Block>
        {localities.length > 0 && (
          <Block title={m.fl_detail_localities()}>
            <p className="text-sm leading-relaxed">{formatList(localities)}</p>
          </Block>
        )}
        {vehicle?.note && (
          <Block title={m.fl_detail_notes()}>
            <p className="text-sm leading-relaxed">{vehicle.note}</p>
          </Block>
        )}
        <Block title={m.fl_detail_issues()}>
          <IssueList issues={issues} />
        </Block>
      </div>
      <Actions
        onFilter={() => onFilter({ kind: 'vehicle', id: plate })}
        onMap={() => onMap({ kind: 'vehicle', id: plate })}
      />
    </>
  );
}

/** Folha com o detalhe de um circuito ou de uma viatura: lateral em ecrãs largos, inferior em telemóvel. */
export function DetailSheet({ model, detail, onClose, onOpen, onFilter, onMap }: DetailSheetProps) {
  const desktop = useMinWidth(768);
  const shared = { onOpen, onFilter, onMap };
  return (
    <Sheet open={detail !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        className={
          desktop
            ? 'gap-0 p-0 md:w-[28rem] md:max-w-[28rem]'
            : 'max-h-[88dvh] gap-0 rounded-t-2xl p-0'
        }
      >
        {detail?.kind === 'circuit' && <CircuitDetail model={model} code={detail.id} {...shared} />}
        {detail?.kind === 'vehicle' && (
          <VehicleDetail model={model} plate={detail.id} {...shared} />
        )}
      </SheetContent>
    </Sheet>
  );
}
