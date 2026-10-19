import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FrontierPoint } from '@/client';
import { formatEur, formatNumber, formatTonnes } from '@/lib/format';
import { formatList } from '@/lib/i18n';
import { modeLabel } from '@/lib/scenario';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { frontierStats } from './derive';
import { useInView, useMotion } from './motion';

const M = { top: 14, right: 18, bottom: 44, left: 56 };

function niceTicks(min: number, max: number, count = 4): number[] {
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = ([1, 2, 2.5, 5, 10].find((s) => s * mag >= raw) ?? 10) * mag;
  const first = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = first; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

interface FrontierChartProps {
  points: FrontierPoint[];
  /** Toneladas recolhidas hoje, como marca de referência no eixo. */
  collectedT: number;
}

/** Fronteira de Pareto: toneladas por ano (→) contra €/t (↑ mais barato). Cada ponto é um cenário. */
export function FrontierChart({ points, collectedT }: FrontierChartProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const navigate = useNavigate();
  const { enabled } = useMotion();
  const [viewRef, seen] = useInView<HTMLDivElement>(0.2);
  const stats = useMemo(() => frontierStats(points), [points]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const usable = useMemo(
    () => points.filter((p) => p.status === 'feasible' && p.eur_per_tonne !== null),
    [points],
  );
  if (!stats) return null;

  const height = width < 520 ? 320 : 400;
  const innerW = Math.max(10, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const xMax = Math.max(stats.maxTonnes, collectedT) * 1.08;
  const eurs = usable.map((p) => p.eur_per_tonne ?? 0);
  const yMin = Math.floor((Math.min(...eurs) * 0.94) / 10) * 10;
  const yMax = Math.ceil((Math.max(...eurs) * 1.04) / 10) * 10;
  const x = (t: number) => M.left + (t / xMax) * innerW;
  // Eixo invertido: mais barato em cima, para o canto superior direito ser o melhor.
  const y = (e: number) => M.top + ((e - yMin) / (yMax - yMin)) * innerH;
  const step = stats.pareto
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.tonnes_year)} ${y(p.eur_per_tonne ?? 0)}`)
    .join('');
  const hit = usable.find((p) => p.id === active);
  const drawn = seen || !enabled;
  const open = (id: string) =>
    void navigate({ to: '/scenarios/$scenarioId', params: { scenarioId: id } });
  const touch = () => window.matchMedia('(hover: none)').matches;
  const onPick = (id: string) => {
    if (touch() && active !== id) setActive(id);
    else open(id);
  };

  return (
    <div ref={viewRef} className="rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-5">
      <div ref={wrap} className="relative w-full">
        {width > 0 && (
          // biome-ignore lint/a11y/useSemanticElements: grupo de pontos focáveis num SVG
          <svg
            width={width}
            height={height}
            role="group"
            aria-label={m.home_frontier_aria({ total: stats.total, pareto: stats.pareto.length })}
            className="block overflow-visible"
            onPointerLeave={() => !touch() && setActive(null)}
          >
            {niceTicks(yMin, yMax).map((v) => (
              // biome-ignore lint/a11y/noAriaHiddenOnFocusable: decoração SVG; o foco está nos pontos
              <g key={`y${v}`} aria-hidden="true">
                <line
                  x1={M.left}
                  x2={width - M.right}
                  y1={y(v)}
                  y2={y(v)}
                  className="stroke-border"
                />
                <text
                  x={M.left - 8}
                  y={y(v) + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {formatNumber(v)}
                </text>
              </g>
            ))}
            {niceTicks(0, xMax, width < 520 ? 3 : 5).map((v) => (
              // biome-ignore lint/a11y/noAriaHiddenOnFocusable: decoração SVG; o foco está nos pontos
              <text
                key={`x${v}`}
                x={x(v)}
                y={height - M.bottom + 18}
                textAnchor="middle"
                aria-hidden="true"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {formatNumber(v)}
              </text>
            ))}
            {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: decoração SVG; o foco está nos pontos */}
            <text
              x={M.left + innerW / 2}
              y={height - 6}
              textAnchor="middle"
              aria-hidden="true"
              className="fill-muted-foreground text-[11px]"
            >
              {m.home_frontier_x()}
            </text>
            {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: decoração SVG; o foco está nos pontos */}
            <text
              transform={`translate(12 ${M.top + innerH / 2}) rotate(-90)`}
              textAnchor="middle"
              aria-hidden="true"
              className="fill-muted-foreground text-[11px]"
            >
              {m.home_frontier_y()}
            </text>

            {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: decoração SVG; o foco está nos pontos */}
            <g aria-hidden="true">
              <line
                x1={x(collectedT)}
                x2={x(collectedT)}
                y1={M.top}
                y2={M.top + innerH}
                className="stroke-foreground/50"
                strokeDasharray="4 4"
              />
              <text
                x={x(collectedT) + 6}
                y={M.top + 12}
                className="fill-foreground font-semibold text-[11px]"
              >
                {m.home_frontier_today({ t: formatTonnes(collectedT, 0) })}
              </text>
              <path
                d={step}
                fill="none"
                strokeWidth="2"
                className="stroke-primary"
                strokeDasharray="1600"
                strokeDashoffset={drawn ? 0 : 1600}
                style={{ transition: enabled ? 'stroke-dashoffset 1.4s ease-out' : 'none' }}
              />
            </g>

            {[...usable]
              .sort((a, b) => Number(a.is_pareto) - Number(b.is_pareto))
              .map((p) => {
                const cx = x(p.tonnes_year);
                const cy = y(p.eur_per_tonne ?? 0);
                return (
                  // biome-ignore lint/a11y/useSemanticElements: <a> não existe como ponto num SVG com teclado próprio
                  <g
                    key={p.id}
                    role="link"
                    tabIndex={0}
                    aria-label={m.home_frontier_point_aria({
                      label: p.label,
                      tonnes: formatTonnes(p.tonnes_year),
                      eur: formatNumber(p.eur_per_tonne ?? 0),
                    })}
                    className="group cursor-pointer outline-none"
                    onPointerEnter={() => setActive(p.id)}
                    onFocus={() => setActive(p.id)}
                    onBlur={() => setActive(null)}
                    onClick={() => onPick(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        open(p.id);
                      }
                    }}
                  >
                    <circle cx={cx} cy={cy} r={16} fill="transparent" />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={11}
                      fill="none"
                      strokeWidth="2.5"
                      className={cn(
                        'stroke-foreground group-focus-visible:opacity-100',
                        p.id === active ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={p.is_pareto ? 6 : 4}
                      strokeWidth="1.5"
                      className={
                        p.is_pareto
                          ? 'fill-primary stroke-card'
                          : 'fill-card stroke-muted-foreground'
                      }
                    />
                  </g>
                );
              })}
          </svg>
        )}
        {hit && width > 0 && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 rounded-lg bg-popover p-3 text-popover-foreground text-xs shadow-lg ring-1 ring-foreground/15"
            style={{
              left: Math.min(Math.max(x(hit.tonnes_year), 120), width - 120),
              top: Math.min(y(hit.eur_per_tonne ?? 0) + 16, height - 170),
            }}
          >
            <p className="font-semibold text-sm">{hit.label}</p>
            <p className="text-muted-foreground">
              {hit.is_pareto ? m.home_frontier_efficient() : m.home_frontier_dominated()}
            </p>
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="text-muted-foreground">{m.home_frontier_kpi_tonnes()}</dt>
              <dd className="text-right font-semibold tabular-nums">
                {formatTonnes(hit.tonnes_year)}
              </dd>
              <dt className="text-muted-foreground">{m.home_frontier_kpi_eur()}</dt>
              <dd className="text-right font-semibold tabular-nums">
                {formatNumber(hit.eur_per_tonne ?? 0)} €/t
              </dd>
              <dt className="text-muted-foreground">{m.home_frontier_kpi_cost()}</dt>
              <dd className="text-right font-semibold tabular-nums">
                {formatEur(hit.annual_cost_eur)}
              </dd>
              <dt className="text-muted-foreground">{m.home_frontier_kpi_modes()}</dt>
              <dd className="text-right">
                {formatList(hit.modes.map((mode) => modeLabel[mode]()))}
              </dd>
            </dl>
            <p className="mt-1.5 text-primary">{m.home_frontier_open()}</p>
          </div>
        )}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-border border-t pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-primary" aria-hidden="true" />
          {m.home_frontier_legend_pareto()}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full border border-muted-foreground"
            aria-hidden="true"
          />
          {m.home_frontier_legend_other()}
        </span>
        <span className="ml-auto">{m.home_frontier_better()}</span>
      </p>
    </div>
  );
}
