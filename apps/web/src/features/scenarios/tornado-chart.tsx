import { useState } from 'react';
import type { TornadoBarOut } from '@/client';
import { SourceBadge } from '@/features/assumptions/source-badge';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { paramLabel } from './param-label';

const COLLAPSED_ROWS = 8;

const paramRange = (bar: TornadoBarOut): string => {
  const pct = bar.unit === '%';
  const f = (v: number) => formatNumber(pct ? v * 100 : v, 2);
  return `${f(bar.low_value)} – ${f(bar.high_value)}${bar.unit ? ` ${bar.unit}` : ''}`;
};

const eur = (v: number) => `${formatNumber(v, 0)} €/t`;

/**
 * Tornado de sensibilidade: cada barra mostra o intervalo de €/t quando um pressuposto varia ±swing.
 * A linha vertical é o plano central. Os números ficam escritos, por isso o gráfico não depende da cor.
 */
export function TornadoChart({
  bars,
  baseEurPerTonne,
  swing,
}: {
  bars: TornadoBarOut[];
  baseEurPerTonne: number;
  swing: number;
}) {
  const [all, setAll] = useState(false);
  const sorted = [...bars].sort((a, b) => b.swing_eur_per_tonne - a.swing_eur_per_tonne);
  const rows = all ? sorted : sorted.slice(0, COLLAPSED_ROWS);

  const values = rows
    .flatMap((b) => [b.low.eur_per_tonne, b.high.eur_per_tonne])
    .filter((v): v is number => v != null);
  const lo = Math.min(baseEurPerTonne, ...values);
  const hi = Math.max(baseEurPerTonne, ...values);
  const pad = Math.max((hi - lo) * 0.04, 1e-6);
  const pos = (v: number) => ((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100;

  return (
    <div className="space-y-4">
      <ol
        aria-label={m.sens_tornado_aria({ swing: formatNumber(swing * 100, 0) })}
        className="space-y-3"
      >
        {rows.map((bar) => {
          const a = bar.low.eur_per_tonne;
          const b = bar.high.eur_per_tonne;
          const from = a != null && b != null ? Math.min(a, b) : null;
          const to = a != null && b != null ? Math.max(a, b) : null;
          const base = pos(baseEurPerTonne);
          return (
            <li
              key={bar.key}
              className="grid gap-x-4 gap-y-1.5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_7.5rem] md:items-center"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-sm leading-snug">{paramLabel(bar.key)}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs tabular-nums">
                  <SourceBadge source={bar.source} />
                  <span>{paramRange(bar)}</span>
                </p>
              </div>
              <div aria-hidden="true" className="relative h-5 rounded-sm bg-muted/60">
                {from != null && to != null && (
                  <>
                    <span
                      className="absolute inset-y-1 rounded-sm bg-primary"
                      style={{
                        left: `${pos(from)}%`,
                        width: `${Math.max(Math.min(pos(to), base) - pos(from), 0)}%`,
                      }}
                    />
                    <span
                      className="absolute inset-y-1 rounded-sm bg-areia"
                      style={{
                        left: `${Math.max(pos(from), base)}%`,
                        width: `${Math.max(pos(to) - Math.max(pos(from), base), 0)}%`,
                      }}
                    />
                  </>
                )}
                <span
                  className="absolute inset-y-0 w-px bg-foreground/70"
                  style={{ left: `${base}%` }}
                />
              </div>
              <p className="text-sm tabular-nums md:text-right">
                {from != null && to != null ? (
                  <>
                    <span className="font-medium">
                      {formatNumber(bar.swing_eur_per_tonne, 0)} €/t
                    </span>
                    <span className="block text-muted-foreground text-xs">
                      {eur(from)} – {eur(to)}
                    </span>
                  </>
                ) : (
                  m.common_dash()
                )}
              </p>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-xs">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" />
            {m.sens_legend_lower()}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-areia" aria-hidden="true" />
            {m.sens_legend_higher()}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-px bg-foreground/70" aria-hidden="true" />
            {m.sens_legend_base({ value: eur(baseEurPerTonne) })}
          </span>
        </p>
        {sorted.length > COLLAPSED_ROWS && (
          <button
            type="button"
            className="min-h-10 rounded-md px-2 font-medium text-foreground underline-offset-4 hover:underline"
            onClick={() => setAll((v) => !v)}
          >
            {all ? m.sens_show_top({ n: COLLAPSED_ROWS }) : m.sens_show_all({ n: sorted.length })}
          </button>
        )}
      </div>
    </div>
  );
}
