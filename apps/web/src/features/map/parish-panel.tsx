import { MousePointerClick } from 'lucide-react';
import type { ZoneOut } from '@/client';
import { WeekdayDots } from '@/components/weekdays';
import { formatNumber, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

export function ParishPanel({ zone }: { zone: ZoneOut | null }) {
  if (!zone) {
    return (
      <aside className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
        <MousePointerClick className="size-5" aria-hidden="true" />
        {m.map_panel_empty()}
      </aside>
    );
  }
  return (
    <aside className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div>
        <p className="eyebrow">{m.map_panel_eyebrow({ code: zone.code })}</p>
        <h2 className="mt-1 text-2xl">{zone.name}</h2>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">
            {m.map_panel_population({ year: zone.population_year ?? '' })}
          </dt>
          <dd className="font-medium tabular-nums">{formatNumber(zone.population)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">{m.map_panel_demand()}</dt>
          <dd className="font-medium tabular-nums">{formatTonnes(zone.demand_t)}</dd>
        </div>
      </dl>
      <div className="space-y-1.5">
        <p className="text-muted-foreground text-xs">{m.map_panel_service()}</p>
        {zone.service_days > 0 ? (
          <p className="text-sm">{m.map_tip_service({ days: zone.service_days })}</p>
        ) : (
          <p className="text-muted-foreground text-sm">{m.map_panel_no_service()}</p>
        )}
      </div>
      {zone.localities.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs">{m.map_panel_localities()}</p>
          <p className="text-sm leading-relaxed">{zone.localities.join(', ')}</p>
        </div>
      )}
      <WeekdayDots days={Array.from({ length: zone.service_days }, (_, i) => i + 1)} />
    </aside>
  );
}
