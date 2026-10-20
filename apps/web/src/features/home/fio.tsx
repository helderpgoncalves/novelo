import { useEffect, useMemo, useRef, useState } from 'react';
import type { OverviewGap } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { motionAllowed, useInViewOnce } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { type FioNodeId, fioLayout } from './fio-model';
import { EstimateTag, SourceLine } from './tags';

const NODE_FILL: Record<FioNodeId, string> = {
  potential: 'fill-foreground/80',
  collected: 'fill-primary',
  missing: 'fill-areia',
  reuse: 'fill-primary',
  recycle: 'fill-chart-2',
  reject: 'fill-muted-foreground',
};
const RIBBON_FILL: Record<FioNodeId, string> = {
  potential: 'fill-foreground/15',
  collected: 'fill-primary/30',
  missing: 'fill-areia/25',
  reuse: 'fill-primary/30',
  recycle: 'fill-chart-2/30',
  reject: 'fill-muted-foreground/30',
};
const NODE_LABEL: Record<FioNodeId, () => string> = {
  potential: () => m.home_fio_potential(),
  collected: () => m.home_fio_collected(),
  missing: () => m.home_fio_missing(),
  reuse: () => m.home_fio_reuse(),
  recycle: () => m.home_fio_recycle(),
  reject: () => m.home_fio_reject(),
};

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

interface Row {
  id: FioNodeId;
  tonnes: number;
  pct: number;
}

/**
 * «O fio»: do potencial (estimativa) ao recolhido (medido) e ao seu destino. O troço que falta é o fio solto:
 * desfia-se à direita do recolhido. Desenha-se uma vez ao entrar no ecrã (sem movimento se o sistema o pede).
 */
export function Fio({ gap }: { gap: OverviewGap }) {
  const [wrap, width] = useWidth();
  const seenRef = useRef<HTMLDivElement>(null);
  const seen = useInViewOnce(seenRef);
  const narrow = width < 560;
  const inner = Math.max(width - (narrow ? 24 : 40), 240);
  const { destinations: d } = gap;
  const total = d.reuse_t + d.recycle_t + d.reject_t || 1;

  const layout = useMemo(() => {
    const nodeW = narrow ? 8 : 12;
    const labelRight = narrow ? 118 : 190;
    const w = Math.max(width - (narrow ? 24 : 40), 240);
    return fioLayout(
      {
        potentialT: gap.potential_t,
        collectedT: gap.collected_t,
        reuseT: d.reuse_t,
        recycleT: d.recycle_t,
        rejectT: d.reject_t,
      },
      {
        width: w,
        band: narrow ? 190 : 230,
        nodeW,
        columns: [0, w * (narrow ? 0.34 : 0.3), w - labelRight - nodeW],
        gap: narrow ? 14 : 18,
        minNode: narrow ? 6 : 8,
      },
    );
  }, [gap, d, width, narrow]);

  const rows: Row[] = [
    { id: 'potential', tonnes: gap.potential_t, pct: 100 },
    { id: 'collected', tonnes: gap.collected_t, pct: (gap.collected_t / gap.potential_t) * 100 },
    { id: 'missing', tonnes: gap.missing_t, pct: (gap.missing_t / gap.potential_t) * 100 },
    { id: 'reuse', tonnes: d.reuse_t, pct: (d.reuse_t / total) * 100 },
    { id: 'recycle', tonnes: d.recycle_t, pct: (d.recycle_t / total) * 100 },
    { id: 'reject', tonnes: d.reject_t, pct: (d.reject_t / total) * 100 },
  ];
  const columns: Column<Row>[] = [
    {
      id: 'step',
      header: m.home_fio_col_step(),
      primary: true,
      cell: (r) => NODE_LABEL[r.id](),
      value: (r) => NODE_LABEL[r.id](),
    },
    {
      id: 'tonnes',
      header: m.home_fio_col_tonnes(),
      align: 'right',
      value: (r) => r.tonnes,
      cell: (r) => formatTonnes(r.tonnes),
    },
    {
      id: 'pct',
      header: m.home_fio_col_pct(),
      align: 'right',
      value: (r) => r.pct,
      cell: (r) => formatPercent(r.pct),
    },
  ];

  const node = (id: FioNodeId) => layout.nodes.find((n) => n.id === id);
  const drawn = seen || !motionAllowed();
  const missing = node('missing');
  const collected = node('collected');
  const height = Math.max(layout.height, narrow ? 190 : 230) + 24;
  const ariaLabel = m.home_fio_aria({
    potential: formatTonnes(gap.potential_t, 0),
    collected: formatTonnes(gap.collected_t),
    missing: formatTonnes(gap.missing_t, 0),
    reuse: formatPercent(rows[3]?.pct ?? 0),
    recycle: formatPercent(rows[4]?.pct ?? 0),
    reject: formatPercent(rows[5]?.pct ?? 0),
  });

  return (
    <div className="space-y-3" ref={seenRef}>
      <div
        ref={wrap}
        className={cn(
          'relative w-full overflow-hidden rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-5',
          'transition-[clip-path] duration-[1400ms] ease-out motion-reduce:transition-none',
        )}
        style={{ clipPath: drawn ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)' }}
      >
        {width > 0 && (
          <svg
            role="img"
            aria-label={ariaLabel}
            width={inner}
            height={height}
            viewBox={`0 0 ${inner} ${height}`}
            className="block"
          >
            <title>{ariaLabel}</title>
            <g transform="translate(0 20)">
              {layout.ribbons.map((r) => (
                <path key={r.id} d={r.d} className={RIBBON_FILL[r.to]} />
              ))}
              {/* O fio solto: o que falta desfia-se e não chega a lado nenhum. */}
              {missing && missing.h > 0 && (
                <g>
                  {Array.from({ length: 9 }, (_, i) => {
                    const t = (i + 0.5) / 9;
                    const y = missing.y + missing.h * t;
                    const x0 = missing.x + missing.w;
                    const len = (narrow ? 0.9 : 1.6) * 60 * (1 - 0.35 * Math.abs(t - 0.5) * 2);
                    return (
                      <path
                        // biome-ignore lint/suspicious/noArrayIndexKey: fios decorativos fixos
                        key={i}
                        d={`M${x0} ${y}C${x0 + len * 0.5} ${y} ${x0 + len * 0.7} ${y + 10 + i * 2} ${x0 + len} ${y + 14 + i * 3}`}
                        className="fill-none stroke-areia"
                        strokeWidth={Math.max(1.2, missing.h / 14)}
                        strokeDasharray="5 5"
                        strokeLinecap="round"
                        opacity={0.9 - Math.abs(t - 0.5) * 0.8}
                      />
                    );
                  })}
                </g>
              )}
              {layout.nodes.map((n) => (
                <rect
                  key={n.id}
                  x={n.x}
                  y={n.y}
                  width={n.w}
                  height={Math.max(n.h, 1.5)}
                  rx={2}
                  className={NODE_FILL[n.id]}
                />
              ))}
              {layout.nodes
                .filter((n) => n.id !== 'missing')
                .map((n) => {
                  const top = n.id === 'potential' || n.id === 'collected';
                  const x = n.id === 'potential' ? n.x : n.x + n.w + 8;
                  return (
                    <text
                      key={`l-${n.id}`}
                      x={x}
                      y={top ? -6 : n.y + n.h / 2 - 2}
                      className="fill-foreground text-[12px]"
                    >
                      <tspan className="font-semibold">{NODE_LABEL[n.id]()}</tspan>
                      <tspan
                        {...(top ? { dx: 6 } : { x, dy: 14 })}
                        className="fill-muted-foreground tabular-nums"
                      >
                        {top
                          ? formatTonnes(n.value, n.id === 'potential' ? 0 : 1)
                          : `${formatPercent(n.pct)} · ${formatTonnes(n.value)}`}
                      </tspan>
                    </text>
                  );
                })}
              {missing && collected && (
                <text
                  x={missing.x + missing.w + (narrow ? 70 : 150)}
                  y={missing.y + missing.h / 2 - 4}
                  className="fill-foreground text-[13px]"
                >
                  <tspan className="font-semibold">{m.home_fio_missing()}</tspan>
                  <tspan
                    x={missing.x + missing.w + (narrow ? 70 : 150)}
                    dy="17"
                    className="font-serif text-[22px] tabular-nums"
                  >
                    {`≈ ${formatNumber(missing.value, 0)} t`}
                  </tspan>
                </text>
              )}
            </g>
          </svg>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <EstimateTag />
        <SourceLine className="min-w-0 flex-1">
          {m.home_fio_source({ rate: formatNumber(gap.potential_kg_per_inhab_month, 1) })}
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
