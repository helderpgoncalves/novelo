import type { DayGroup, Shift, TypologyFleet } from '@/client';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { dayGroupLabel, shiftLabel, typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import { TypologyMark } from './typology-style';

const GROUPS: DayGroup[] = ['weekday', 'saturday', 'sunday'];
const SHIFTS: Shift[] = ['morning', 'afternoon', 'night'];

/**
 * Circuitos servidos por tipologia em cada grupo de dias e turno. A intensidade da cor segue a contagem,
 * que também está escrita em cada célula (a cor nunca é a única pista).
 */
export function OccupancyHeatmap({
  typologies,
  onPickTypology,
}: {
  typologies: TypologyFleet[];
  onPickTypology?: (typology: TypologyFleet['typology']) => void;
}) {
  const count = (t: TypologyFleet, g: DayGroup, s: Shift) =>
    t.slots.find((x) => x.day_group === g && x.shift === s)?.assignments ?? 0;
  const max = Math.max(
    1,
    ...typologies.flatMap((t) => GROUPS.flatMap((g) => SHIFTS.map((s) => count(t, g, s)))),
  );

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <caption className="sr-only">{m.fleet_heatmap_title()}</caption>
          <thead>
            <tr className="text-muted-foreground text-xs">
              <th
                scope="col"
                rowSpan={2}
                className="sticky left-0 z-10 bg-card p-2.5 text-left font-medium"
              >
                {m.fleet_typology_header()}
              </th>
              {GROUPS.map((g) => (
                <th
                  key={g}
                  scope="colgroup"
                  colSpan={3}
                  className="border-border border-l p-1.5 font-medium"
                >
                  {dayGroupLabel[g]()}
                </th>
              ))}
              <th
                scope="col"
                rowSpan={2}
                className="border-border border-l p-2.5 text-right font-medium"
              >
                {m.fl_heatmap_fleet()}
              </th>
            </tr>
            <tr className="text-[11px] text-muted-foreground">
              {GROUPS.flatMap((g) =>
                SHIFTS.map((s, i) => (
                  <th
                    key={`${g}-${s}`}
                    scope="col"
                    className={cn('px-1 pb-1.5 font-normal', i === 0 && 'border-border border-l')}
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
                <th scope="row" className="sticky left-0 z-10 bg-card p-2.5 text-left font-medium">
                  <span className="flex items-center gap-2">
                    <TypologyMark typology={t.typology} />
                    {onPickTypology ? (
                      <button
                        type="button"
                        onClick={() => onPickTypology(t.typology)}
                        className="rounded underline-offset-2 hover:underline"
                        title={m.fl_heatmap_pick()}
                      >
                        {typologyLabel[t.typology]()}
                      </button>
                    ) : (
                      typologyLabel[t.typology]()
                    )}
                  </span>
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
                <td className="border-border border-l p-2.5 text-right text-muted-foreground tabular-nums">
                  {t.fleet_vehicles != null ? (
                    <>
                      <span className="text-foreground">{formatNumber(t.fleet_vehicles)}</span>{' '}
                      {m.fl_heatmap_vehicles()}
                    </>
                  ) : (
                    m.common_dash()
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>0</span>
        <span
          aria-hidden="true"
          className="h-2 w-28 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, color-mix(in oklab, var(--primary) 12%, transparent), var(--primary))',
          }}
        />
        <span className="tabular-nums">{formatNumber(max)}</span>
        <span>{m.fl_heatmap_scale()}</span>
      </div>
    </div>
  );
}
