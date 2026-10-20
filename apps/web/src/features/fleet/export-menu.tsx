import { Download } from 'lucide-react';
import { toast } from 'sonner';
import type { CircuitOut } from '@/client';
import { downloadBlob, exportFileName, toCsv } from '@/components/data-table/export';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { weekdayLong } from '@/lib/i18n';
import { shiftLabel, typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import { buildIcs, type IcsLabels, type IcsMode, type Occurrence, toCsvRows } from './schedule';

const icsLabels = (): IcsLabels => ({
  shift: {
    morning: shiftLabel.morning(),
    afternoon: shiftLabel.afternoon(),
    night: shiftLabel.night(),
  },
  typology: {
    organic: typologyLabel.organic(),
    undifferentiated: typologyLabel.undifferentiated(),
    recyclable: typologyLabel.recyclable(),
    bulky: typologyLabel.bulky(),
    payt: typologyLabel.payt(),
    support: typologyLabel.support(),
    to_confirm: typologyLabel.to_confirm(),
    unassigned: typologyLabel.unassigned(),
  },
  notice: m.fl_ics_notice(),
  calendarName: m.fl_ics_name(),
  crew: (n) => m.fl_crew_people({ count: n }),
  localities: m.fl_detail_localities(),
  vehicle: m.fl_detail_vehicles(),
  circuit: m.fl_detail_circuit_plural(),
});

/** Exportar o que está filtrado: calendário .ics (por circuito ou por viatura), CSV e impressão. */
export function ExportMenu({ occs, circuits }: { occs: Occurrence[]; circuits: CircuitOut[] }) {
  const disabled = occs.length === 0;

  const ics = (mode: IcsMode) => {
    const text = buildIcs(occs, circuits, mode, icsLabels());
    downloadBlob(
      new Blob([text], { type: 'text/calendar;charset=utf-8' }),
      exportFileName(mode === 'circuit' ? 'frota-circuitos' : 'frota-viaturas', 'ics'),
    );
    toast.success(m.fl_ics_done(), { description: m.fl_ics_notice() });
  };

  const csv = () => {
    const header = [
      m.fl_csv_day(),
      m.fl_csv_shift(),
      m.fl_csv_circuit(),
      m.fl_csv_typology(),
      m.fl_csv_vehicle(),
      m.fl_csv_crew(),
      m.fl_csv_localities(),
    ];
    const rows = toCsvRows(occs, circuits).map((r) => [
      weekdayLong(r.day),
      shiftLabel[r.shift](),
      r.circuit,
      typologyLabel[r.typology](),
      r.plate,
      r.crew,
      r.localities,
    ]);
    const text = toCsv(header, rows, ';');
    downloadBlob(
      new Blob([text], { type: 'text/csv;charset=utf-8' }),
      exportFileName('frota-semana-tipo', 'csv'),
    );
    toast.success(m.fl_csv_done());
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={disabled}>
          <Download aria-hidden="true" />
          {m.fl_export()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="whitespace-normal font-normal text-muted-foreground text-xs leading-relaxed">
          {m.fl_export_notice()}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-10" onSelect={() => ics('circuit')}>
          {m.fl_export_ics_circuit()}
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-10" onSelect={() => ics('vehicle')}>
          {m.fl_export_ics_vehicle()}
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-10" onSelect={csv}>
          {m.fl_export_csv()}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-10" onSelect={() => window.print()}>
          {m.fl_export_print()}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
