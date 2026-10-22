import { useState } from 'react';
import type { OverviewParish } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { intlTag } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { stripUnion } from './choropleth';
import { parishGapT } from './map-model';
import { isNum, NO_VALUE, num } from './safe';

/** Toneladas com uma casa decimal fixa («80,0 t»): numa coluna, os números alinham pela vírgula. */
const tonnes1 = (v: number | null | undefined): string =>
  isNum(v)
    ? `${new Intl.NumberFormat(intlTag(), { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: 'always' }).format(v)} t`
    : NO_VALUE;

/** Linha da tabela: a freguesia com o têxtil por desviar. */
export interface TopRow {
  parish: OverviewParish;
  gapT: number;
  density: number | null;
}

/** Freguesias com o têxtil por desviar e a densidade; é o que a tabela ordena. */
export function topRows(parishes: OverviewParish[]): TopRow[] {
  return parishes.map((parish) => ({
    parish,
    gapT: parishGapT(parish),
    density: parish.area_km2 && parish.area_km2 > 0 ? parish.population / parish.area_km2 : null,
  }));
}

/** Freguesias ordenadas por têxtil por desviar, da maior para a menor (valores inválidos no fim). */
export function sortByGap(rows: TopRow[]): TopRow[] {
  const v = (r: TopRow) => (Number.isFinite(r.gapT) ? r.gapT : Number.NEGATIVE_INFINITY);
  return [...rows].sort((a, b) => v(b) - v(a) || a.parish.name.localeCompare(b.parish.name));
}

const TOP_N = 10;

interface ParishTableProps {
  rows: TopRow[];
  selected: string | null;
  onSelect: (code: string | null) => void;
  className?: string;
}

/**
 * «Top freguesias por têxtil por desviar»: a mesma informação do mapa em lista, ordenável e pesquisável. Clicar no
 * nome (ou «Ver no mapa») seleciona a freguesia, que o mapa realça e abre no detalhe.
 */
export function ParishTable({ rows, selected, onSelect, className }: ParishTableProps) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, TOP_N);
  const columns: Column<TopRow>[] = [
    {
      id: 'name',
      header: m.home_col_parish(),
      primary: true,
      width: 170,
      value: (r) => stripUnion(r.parish.name),
      cell: (r) => {
        const on = selected === r.parish.code;
        return (
          <button
            type="button"
            aria-pressed={on}
            title={r.parish.name}
            onClick={() => onSelect(on ? null : r.parish.code)}
            className={cn(
              'inline-flex min-h-8 items-center gap-2 rounded-sm text-left pointer-coarse:min-h-10 outline-none underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/60',
              on ? 'font-semibold text-primary' : 'font-medium',
            )}
          >
            <span
              className={cn('size-2 shrink-0 rounded-full', on ? 'bg-primary' : 'bg-transparent')}
              aria-hidden="true"
            />
            <span className="block max-w-[11rem] whitespace-normal leading-snug">
              {stripUnion(r.parish.name)}
            </span>
          </button>
        );
      },
    },
    {
      id: 'gap',
      width: 150,
      header: m.home_col_gap(),
      align: 'right',
      badge: true,
      type: 'number',
      value: (r) => (Number.isFinite(r.gapT) ? r.gapT : null),
      format: (v) => tonnes1(v),
      aggregate: 'sum',
      // Mesma altura mínima do botão do nome: no cartão em telemóvel, nome e valor ficam na mesma linha.
      cell: (r) => (
        <span className="inline-flex min-h-8 items-center font-medium tabular-nums pointer-coarse:min-h-10">
          {tonnes1(r.gapT)}
        </span>
      ),
    },
    {
      id: 'population',
      width: 86,
      defaultHidden: true,
      hideable: true,
      header: m.home_col_population(),
      align: 'right',
      type: 'number',
      value: (r) => r.parish.population,
      format: (v) => num(v),
      aggregate: 'sum',
      cell: (r) => <span className="tabular-nums">{num(r.parish.population)}</span>,
    },
    {
      id: 'density',
      header: m.home_col_density(),
      align: 'right',
      type: 'number',
      hideable: true,
      defaultHidden: true,
      value: (r) => r.density,
      format: (v) => num(v),
      cell: (r) => <span className="tabular-nums">{num(r.density)}</span>,
    },
    {
      id: 'circuits',
      header: m.home_col_circuits(),
      align: 'right',
      type: 'number',
      hideable: true,
      defaultHidden: true,
      value: (r) => r.parish.circuits_count,
      format: (v) => num(v),
      cell: (r) => <span className="tabular-nums">{num(r.parish.circuits_count)}</span>,
    },
  ];
  return (
    <div className="space-y-2">
      <DataTable
        id="home-top-parishes"
        className={className}
        title={m.home_top_title()}
        caption={m.home_top_title()}
        columns={columns}
        rows={shown}
        controls="never"
        unbounded
        getRowId={(r) => r.parish.code}
        pageSize={8}
        initialSort={{ id: 'gap', desc: true }}
        empty={
          <p className="p-6 text-center text-muted-foreground text-sm">{m.home_top_empty()}</p>
        }
        rowActions={(r) => [
          {
            id: 'show',
            label: m.home_top_show_on_map(),
            onSelect: () => onSelect(r.parish.code),
          },
        ]}
      />
      {rows.length > TOP_N && (
        <Button variant="ghost" className="h-10 w-full" onClick={() => setAll((v) => !v)}>
          {all ? m.home_top_less() : m.home_top_more({ n: rows.length })}
        </Button>
      )}
    </div>
  );
}
