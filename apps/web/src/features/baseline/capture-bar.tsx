import type { TextileBaseline } from '@/client';
import { formatPercent, formatTonnes } from '@/lib/format';
import { DESTINATIONS } from './destination';

/** O que já se recolhe (por destino) face ao potencial estimado de Guimarães. */
export function CaptureBar({ baseline }: { baseline: TextileBaseline }) {
  const parts = DESTINATIONS.map((d) => ({ ...d, tonnes: baseline[`${d.key}_t` as const] }));
  const potential = baseline.estimated_demand_t;

  return (
    <div className="space-y-3">
      <div
        role="img"
        aria-label={`${formatTonnes(baseline.total_t)} recolhidas de ${formatTonnes(potential, 0)} estimadas (${formatPercent(baseline.capture_of_demand_pct)})`}
        className="flex h-9 overflow-hidden rounded-lg bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--border)_6px_7px)] ring-1 ring-border"
      >
        {parts.map((p) => (
          <div
            key={p.key}
            className={p.className}
            style={{ width: `${(p.tonnes / potential) * 100}%` }}
            title={`${p.label}: ${formatTonnes(p.tonnes)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs">
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-1.5 text-muted-foreground">
              <span className={`size-2.5 rounded-sm ${p.className}`} aria-hidden="true" />
              {p.label}{' '}
              <span className="font-medium text-foreground tabular-nums">
                {formatTonnes(p.tonnes)}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          A tracejado:{' '}
          <span className="font-medium text-foreground tabular-nums">
            {formatTonnes(baseline.gap_t, 0)}
          </span>{' '}
          por captar
        </p>
      </div>
    </div>
  );
}
