import { useMemo } from 'react';
import type { OverviewGap } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { type FioNodeId, type FioSegment, fioBars } from './fio-model';
import { num, pct, tonnes } from './safe';
import { EstimateTag, EYEBROW, SourceLine } from './tags';

const FILL: Record<FioNodeId, string> = {
  collected: 'bg-primary',
  missing: 'bg-areia/45 ring-1 ring-areia ring-inset',
  reuse: 'bg-primary',
  recycle: 'bg-chart-2',
  reject: 'bg-muted-foreground',
};
const LABEL: Record<FioNodeId, () => string> = {
  collected: () => m.home_fio_collected(),
  missing: () => m.home_fio_missing(),
  reuse: () => m.home_fio_reuse(),
  recycle: () => m.home_fio_recycle(),
  reject: () => m.home_fio_reject(),
};

function Bar({ segments, label }: { segments: FioSegment[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex h-10 gap-0.5 overflow-hidden rounded-md">
      {segments.map((s) => (
        <div
          key={s.id}
          className={cn('h-full min-w-1', FILL[s.id])}
          style={{ flexBasis: `${s.pct}%`, flexGrow: 0, flexShrink: 1 }}
        />
      ))}
    </div>
  );
}

function Legend({ segments, showPct }: { segments: FioSegment[]; showPct?: boolean }) {
  return (
    <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:flex sm:flex-wrap">
      {segments.map((s) => (
        <li key={s.id} className="flex items-center gap-2.5 text-sm">
          <span className={cn('size-3.5 shrink-0 rounded-sm', FILL[s.id])} aria-hidden="true" />
          <span className="font-medium">{LABEL[s.id]()}</span>
          <span className="text-muted-foreground tabular-nums">
            {tonnes(s.tonnes, s.id === 'missing' ? 0 : 1)}
            {showPct !== false && ` · ${pct(s.pct)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * «O fio»: duas barras de largura total ligadas por um fio. Em cima o potencial (estimativa) partido no recolhido
 * (medido) e no que falta; em baixo o recolhido partido pelo destino. Formas sólidas, números à vista, sem medir o
 * ecrã (a proporção é CSS) nem animação.
 */
export function Fio({ gap }: { gap: OverviewGap }) {
  const d = gap.destinations;
  const bars = useMemo(
    () =>
      fioBars({
        potentialT: gap.potential_t,
        collectedT: gap.collected_t,
        reuseT: d.reuse_t,
        recycleT: d.recycle_t,
        rejectT: d.reject_t,
      }),
    [gap.potential_t, gap.collected_t, d.reuse_t, d.recycle_t, d.reject_t],
  );
  const missing = bars.top.find((s) => s.id === 'missing');
  const collected = bars.top.find((s) => s.id === 'collected');

  const rows = [...bars.top, ...bars.bottom];
  const columns: Column<FioSegment>[] = [
    {
      id: 'step',
      header: m.home_fio_col_step(),
      primary: true,
      cell: (r) => LABEL[r.id](),
      value: (r) => LABEL[r.id](),
    },
    {
      id: 'tonnes',
      header: m.home_fio_col_tonnes(),
      align: 'right',
      value: (r) => r.tonnes,
      cell: (r) => tonnes(r.tonnes),
    },
    {
      id: 'pct',
      header: m.home_fio_col_pct(),
      align: 'right',
      value: (r) => r.pct,
      cell: (r) => pct(r.pct),
    },
  ];

  const ariaTop = m.home_fio_aria_top({
    potential: tonnes(bars.potentialT, 0),
    collected: tonnes(collected?.tonnes, 1),
    missing: tonnes(missing?.tonnes, 0),
  });
  const ariaBottom = m.home_fio_aria_bottom({
    reuse: pct(bars.bottom.find((s) => s.id === 'reuse')?.pct),
    recycle: pct(bars.bottom.find((s) => s.id === 'recycle')?.pct),
    reject: pct(bars.bottom.find((s) => s.id === 'reject')?.pct),
  });

  return (
    <div className="space-y-3">
      <div className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div className="space-y-1">
              <p className={EYEBROW}>{m.home_fio_top_title()}</p>
              <p className="font-medium font-serif text-3xl tabular-nums leading-none">
                {tonnes(bars.potentialT, 0)}
                <span className="ml-1.5 font-sans text-base text-muted-foreground">
                  {m.home_fio_per_year()}
                </span>
              </p>
            </div>
            <p className="text-right">
              <span className="block text-[13px] text-muted-foreground">
                {m.home_fio_missing()}
              </span>
              <span className="font-medium font-serif text-3xl text-primary tabular-nums leading-none">
                ≈ {num(missing?.tonnes, 0)} t
              </span>
            </p>
          </div>
          <Bar segments={bars.top} label={ariaTop} />
          <Legend segments={bars.top} />
        </div>

        {/* O fio: do recolhido (medido) abre-se até ao destino. */}
        <svg
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          className="my-1 block h-8 w-full text-primary"
          aria-hidden="true"
        >
          <path
            d={`M0 0H${bars.collectedPct.toFixed(2)}L100 24H0Z`}
            fill="currentColor"
            fillOpacity="0.16"
          />
          <path
            d={`M${bars.collectedPct.toFixed(2)} 0L100 24`}
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            fill="none"
          />
          <path
            d="M0 0V24"
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            fill="none"
          />
        </svg>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className={EYEBROW}>{m.home_fio_bottom_title()}</p>
            <p className="font-medium font-serif text-2xl tabular-nums leading-none">
              {tonnes(collected?.tonnes, 1)}
              <span className="ml-1.5 font-sans text-base text-muted-foreground">
                {m.home_fio_collected_in({ year: gap.year })}
              </span>
            </p>
          </div>
          {bars.bottom.length > 0 ? (
            <>
              <Bar segments={bars.bottom} label={ariaBottom} />
              <Legend segments={bars.bottom} />
            </>
          ) : (
            <p className="text-muted-foreground text-sm">{m.home_fio_no_destination()}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <EstimateTag />
        <SourceLine className="min-w-0 flex-1">
          {m.home_fio_source({ source: gap.potential_source_label })}
        </SourceLine>
      </div>
      <details className="group rounded-lg ring-1 ring-foreground/10">
        <summary className="flex min-h-10 cursor-pointer list-none items-center px-3 font-medium text-sm marker:hidden [&::-webkit-details-marker]:hidden">
          {m.home_fio_table_toggle()}
        </summary>
        <div className="p-2 pt-0">
          <DataTable
            id="home-fio"
            columns={columns}
            rows={rows}
            getRowId={(r) => r.id}
            caption={m.home_fio_table_toggle()}
            controls="never"
          />
        </div>
      </details>
    </div>
  );
}
