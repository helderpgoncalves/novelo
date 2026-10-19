import type { DayGroup, Shift, TypologyFleet } from '@/client';
import { cn } from '@/lib/utils';
import { dayGroupLabel, shiftLabel, typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

const GROUPS: DayGroup[] = ['weekday', 'saturday', 'sunday'];
const SHIFTS: Shift[] = ['morning', 'afternoon', 'night'];

/** Circuitos servidos por tipologia em cada (dia, turno). A intensidade da cor segue a contagem. */
export function OccupancyHeatmap({ typologies }: { typologies: TypologyFleet[] }) {
  const count = (t: TypologyFleet, g: DayGroup, s: Shift) =>
    t.slots.find((x) => x.day_group === g && x.shift === s)?.assignments ?? 0;
  const max = Math.max(
    1,
    ...typologies.flatMap((t) => GROUPS.flatMap((g) => SHIFTS.map((s) => count(t, g, s)))),
  );

  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="text-muted-foreground text-xs">
            <th scope="col" rowSpan={2} className="p-3 text-left font-medium">
              {m.fleet_typology_header()}
            </th>
            {GROUPS.map((g) => (
              <th
                key={g}
                scope="colgroup"
                colSpan={3}
                className="border-border border-l p-2 font-medium"
              >
                {dayGroupLabel[g]()}
              </th>
            ))}
          </tr>
          <tr className="text-[11px] text-muted-foreground">
            {GROUPS.flatMap((g) =>
              SHIFTS.map((s, i) => (
                <th
                  key={`${g}-${s}`}
                  scope="col"
                  className={cn('p-1.5 font-normal', i === 0 && 'border-border border-l')}
                >
                  {shiftLabel[s]()}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {typologies.map((t) => (
            <tr key={t.typology} className="border-border border-t">
              <th scope="row" className="p-3 text-left font-medium">
                {typologyLabel[t.typology]()}
              </th>
              {GROUPS.flatMap((g) =>
                SHIFTS.map((s, i) => {
                  const n = count(t, g, s);
                  return (
                    <td
                      key={`${g}-${s}`}
                      className={cn('p-1', i === 0 && 'border-border border-l')}
                    >
                      <div
                        className="grid h-9 place-items-center rounded-md font-medium tabular-nums"
                        style={{
                          background: n
                            ? `color-mix(in oklab, var(--primary) ${Math.round(12 + (n / max) * 70)}%, transparent)`
                            : undefined,
                        }}
                        title={`${dayGroupLabel[g]()} · ${shiftLabel[s]()}: ${n}`}
                      >
                        <span
                          className={
                            n === 0
                              ? 'text-muted-foreground/40'
                              : n / max > 0.55
                                ? 'text-primary-foreground'
                                : ''
                          }
                        >
                          {n || '·'}
                        </span>
                      </div>
                    </td>
                  );
                }),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
