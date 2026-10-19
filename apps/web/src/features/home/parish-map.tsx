import { MapPinned } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { OverviewParish, Tipau, ZoneOut } from '@/client';
import { formatNumber, formatTonnes } from '@/lib/format';
import { formatDate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { tipauLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import { CONTAINERS_ARRIVAL, daysUntil, rankParishes } from './derive';
import { makeProjection, pathOf, polygonsOf } from './geo';
import { EstimateTag } from './story-section';

const TIPAU_STYLE: Record<Tipau | 'none', { area: string; bubble: string; swatch: string }> = {
  apu: { area: 'fill-chart-1/15', bubble: 'fill-chart-1', swatch: 'bg-chart-1' },
  amu: { area: 'fill-chart-2/20', bubble: 'fill-chart-2', swatch: 'bg-chart-2' },
  apr: {
    area: 'fill-chart-3/20',
    bubble: 'fill-chart-3',
    swatch: 'bg-chart-3 ring-1 ring-foreground/40',
  },
  none: { area: 'fill-muted', bubble: 'fill-muted-foreground', swatch: 'bg-muted-foreground' },
};
const styleOf = (t: Tipau | null) => TIPAU_STYLE[t ?? 'none'];
const TIPAUS: Tipau[] = ['apu', 'amu', 'apr'];
const RANK_ROWS = 8;
const R_MAX = 40;

interface ParishMapProps {
  parishes: OverviewParish[];
  zones: ZoneOut[];
}

/** Potencial por freguesia: bolhas (área = t/ano) sobre o território, cor por TIPAU, ligadas ao ranking. */
export function ParishMap({ parishes, zones }: ParishMapProps) {
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const { sorted } = useMemo(() => rankParishes(parishes), [parishes]);
  const geom = useMemo(() => {
    const byCode = new Map(zones.map((z) => [z.code, polygonsOf(z.geometry)]));
    const points = [
      ...[...byCode.values()].flatMap((polys) => polys.flat(2).filter((p) => p.length >= 2)),
      ...parishes.flatMap((p) => (p.centroid ? [[p.centroid.lon, p.centroid.lat]] : [])),
    ];
    const proj = makeProjection(points);
    return { proj, byCode };
  }, [zones, parishes]);
  const paths = useMemo(
    () =>
      sorted.map((p) => ({
        parish: p,
        d: pathOf(geom.byCode.get(p.code) ?? [], geom.proj),
        c: p.centroid ? geom.proj.project(p.centroid.lon, p.centroid.lat) : null,
      })),
    [sorted, geom],
  );

  const maxT = sorted[0]?.potential_t ?? 1;
  const activeCode = hover ?? pinned ?? sorted[0]?.code ?? null;
  const active = sorted.find((p) => p.code === activeCode);
  const containers = parishes.reduce((s, p) => s + p.containers_count, 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="min-w-0 space-y-3 lg:col-span-7">
        <div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4">
          <svg
            viewBox={`0 0 ${geom.proj.width} ${geom.proj.height}`}
            role="img"
            aria-label={m.home_map_aria({ count: parishes.length })}
            className="mx-auto h-auto max-h-[34rem] w-full"
          >
            <title>{m.home_map_aria({ count: parishes.length })}</title>
            {paths.map(({ parish: p, d }) =>
              d ? (
                // biome-ignore lint/a11y/noStaticElementInteractions: o rato é um extra; a lista ao lado é o equivalente para teclado
                <path
                  key={p.code}
                  d={d}
                  strokeLinejoin="round"
                  className={cn(
                    'cursor-pointer stroke-foreground/30 transition-colors',
                    styleOf(p.tipau).area,
                    p.code === activeCode && 'stroke-foreground stroke-[3]',
                    p.code !== activeCode && 'stroke-[1.2]',
                  )}
                  onPointerEnter={() => setHover(p.code)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => setPinned(p.code)}
                />
              ) : null,
            )}
            {paths.map(({ parish: p, c }) =>
              c ? (
                // biome-ignore lint/a11y/noStaticElementInteractions: o rato é um extra; a lista ao lado é o equivalente para teclado
                <circle
                  key={p.code}
                  cx={c[0]}
                  cy={c[1]}
                  r={Math.max(3.5, R_MAX * Math.sqrt(p.potential_t / maxT))}
                  strokeWidth={p.code === activeCode ? 3 : 1.5}
                  className={cn(
                    'cursor-pointer stroke-card transition-[stroke-width]',
                    styleOf(p.tipau).bubble,
                    p.code === activeCode && 'stroke-foreground',
                  )}
                  fillOpacity={0.88}
                  onPointerEnter={() => setHover(p.code)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => setPinned(p.code)}
                />
              ) : null,
            )}
          </svg>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 border-border border-t pt-3 text-[11px] text-muted-foreground">
            {TIPAUS.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span
                  className={cn('size-3 rounded-full', TIPAU_STYLE[t].swatch)}
                  aria-hidden="true"
                />
                {tipauLabel[t]()}
              </span>
            ))}
            <span className="ml-auto">{m.home_map_legend_size()}</span>
          </div>
        </div>
        <ContainersStatus total={containers} />
      </div>

      <div className="min-w-0 space-y-4 lg:col-span-5">
        <div>
          <h3 className="mb-2 font-sans font-semibold text-sm">
            {m.home_rank_title({ n: RANK_ROWS })}
          </h3>
          <ol className="space-y-0.5">
            {sorted.slice(0, RANK_ROWS).map((p, i) => (
              <li key={p.code}>
                <button
                  type="button"
                  aria-pressed={pinned === p.code}
                  onPointerEnter={() => setHover(p.code)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(p.code)}
                  onBlur={() => setHover(null)}
                  onClick={() => setPinned(pinned === p.code ? null : p.code)}
                  className={cn(
                    'grid min-h-11 w-full grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    p.code === activeCode ? 'bg-accent' : 'hover:bg-accent/60',
                  )}
                >
                  <span className="text-muted-foreground text-xs tabular-nums">{i + 1}</span>
                  <span className="min-w-0 space-y-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block h-1.5 rounded-full bg-muted" aria-hidden="true">
                      <span
                        className={cn('block h-full rounded-full', styleOf(p.tipau).swatch)}
                        style={{ width: `${(p.potential_t / maxT) * 100}%` }}
                      />
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatTonnes(p.potential_t)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        {active && <ParishDetail parish={active} />}
      </div>
    </div>
  );
}

function ParishDetail({ parish: p }: { parish: OverviewParish }) {
  const rows: [string, string][] = [
    [m.home_detail_population(), formatNumber(p.population)],
    [m.home_detail_share(), `${formatNumber(p.share_of_population_pct, 1)}%`],
    [m.home_detail_circuits(), formatNumber(p.circuits_count)],
    [m.home_detail_localities(), formatNumber(p.localities_count)],
  ];
  return (
    <div aria-live="polite" className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-base leading-snug">{p.name}</p>
          <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <span
              className={cn('size-2.5 rounded-full', styleOf(p.tipau).swatch)}
              aria-hidden="true"
            />
            {p.tipau ? tipauLabel[p.tipau]() : m.home_detail_no_tipau()}
          </p>
        </div>
        <p className="text-right">
          <span className="block font-medium font-serif text-3xl tabular-nums leading-none">
            {formatTonnes(p.potential_t)}
          </span>
          <span className="mt-1 flex items-center justify-end gap-1.5 text-muted-foreground text-[11px]">
            {m.home_detail_potential()}
            <EstimateTag />
          </span>
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-border border-t pt-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Estado inteligente dos contentores: 0 até chegarem as localizações (20 out 2026). */
function ContainersStatus({ total }: { total: number }) {
  const days = daysUntil(CONTAINERS_ARRIVAL);
  const when = formatDate(CONTAINERS_ARRIVAL);
  const message =
    total > 0
      ? m.home_containers_active({ count: formatNumber(total) })
      : days > 0
        ? m.home_containers_soon({ date: when, days })
        : days === 0
          ? m.home_containers_today({ date: when })
          : m.home_containers_late({ date: when });
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg p-3 text-sm',
        total > 0 ? 'bg-primary/5 ring-1 ring-primary/30' : 'border border-dashed',
      )}
    >
      <MapPinned className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="leading-snug">
        <span className="font-semibold">{m.home_containers_title()}</span>{' '}
        <span className="text-muted-foreground">{message}</span>
      </p>
    </div>
  );
}
