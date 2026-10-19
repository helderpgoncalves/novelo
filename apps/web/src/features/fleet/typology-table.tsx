import type { TypologyFleet } from '@/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNumber } from '@/lib/format';
import { typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

const num = (value: number | null | undefined) => (value == null ? '-' : formatNumber(value));

export function TypologyTable({ typologies }: { typologies: TypologyFleet[] }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 px-4">{m.fleet_typology_header()}</TableHead>
            <TableHead className="h-10 text-right">{m.fleet_table_circuits()}</TableHead>
            <TableHead className="h-10 text-right">{m.fleet_table_without_vehicle()}</TableHead>
            <TableHead className="h-10 text-right">{m.fleet_table_vehicle_shifts()}</TableHead>
            <TableHead className="h-10 text-right">{m.fleet_table_crew_shifts()}</TableHead>
            <TableHead className="h-10 text-right">{m.fleet_table_fleet_vehicles()}</TableHead>
            <TableHead className="h-10 pr-4 text-right">{m.fleet_table_fleet_crew()}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {typologies.map((t) => (
            <TableRow key={t.typology}>
              <TableCell className="px-4 font-medium">{typologyLabel[t.typology]()}</TableCell>
              <TableCell className="text-right tabular-nums">{num(t.circuits)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {num(t.circuits_without_vehicle)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {num(t.vehicle_shifts_week)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{num(t.crew_shifts_week)}</TableCell>
              <TableCell className="text-right tabular-nums">{num(t.fleet_vehicles)}</TableCell>
              <TableCell className="pr-4 text-right tabular-nums">{num(t.fleet_crew)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
