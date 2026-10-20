import type { Shift, Typology } from '@/client';
import { weekdayAbbr, weekdayLong } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { shiftLabel, typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import { DAYS, isoWeekday, SHIFTS, slotKey } from './schedule';
import { blockStyle } from './typology-style';

export interface MiniItem {
  day: number;
  shift: Shift;
  label: string;
  typology: Typology;
}

/**
 * Semana tipo em miniatura (dias em colunas, turnos em linhas) para uma viatura ou um circuito.
 * Cada célula lista o que corre nesse dia e turno; a coluna de hoje fica destacada.
 */
export function MiniWeek({ items, caption }: { items: MiniItem[]; caption: string }) {
  const by = new Map<string, MiniItem[]>();
  for (const i of items) {
    const k = slotKey(i.day, i.shift);
    by.set(k, [...(by.get(k) ?? []), i]);
  }
  const today = isoWeekday();
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
      <table className="w-full min-w-[19rem] table-fixed border-collapse text-[11px]">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col className="w-[3.25rem]" />
          {DAYS.map((d) => (
            <col key={d} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <td />
            {DAYS.map((d) => (
              <th
                key={d}
                scope="col"
                aria-label={weekdayLong(d)}
                className={cn(
                  'py-1 text-center font-semibold text-muted-foreground uppercase tracking-wide',
                  d === today && 'bg-primary/10 text-primary',
                )}
              >
                {weekdayAbbr(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SHIFTS.map((s) => (
            <tr key={s}>
              <th
                scope="row"
                className="border-t px-1.5 py-1.5 text-left font-normal text-muted-foreground"
              >
                {shiftLabel[s]()}
              </th>
              {DAYS.map((d) => {
                const list = by.get(slotKey(d, s)) ?? [];
                return (
                  <td
                    key={d}
                    aria-label={
                      list.length
                        ? `${weekdayLong(d)}, ${shiftLabel[s]()}: ${list.map((i) => `${i.label} (${typologyLabel[i.typology]()})`).join(', ')}`
                        : `${weekdayLong(d)}, ${shiftLabel[s]()}: ${m.fl_no_service()}`
                    }
                    className={cn(
                      'h-9 border-t border-l p-0.5 align-middle',
                      d === today && 'bg-primary/5',
                    )}
                  >
                    <div className="flex flex-col gap-0.5">
                      {list.map((i) => (
                        <span
                          key={i.label}
                          style={blockStyle(i.typology)}
                          className="truncate rounded-[3px] border-l-[3px] px-1 py-px text-center font-semibold tabular-nums"
                          title={`${i.label} · ${typologyLabel[i.typology]()}`}
                        >
                          {i.label}
                        </span>
                      ))}
                    </div>
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
