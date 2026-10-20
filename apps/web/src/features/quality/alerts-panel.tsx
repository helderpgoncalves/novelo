import { useState } from 'react';
import type { AlertKind, AlertStatus, DataAlertOut } from '@/client';
import { FilterChips } from '@/components/filter-chips';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCard } from '@/features/quality/alert-card';
import { alertKindLabel, alertStatusLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

const PAGE = 8;
const ALL = '__all__';

export type AlertOrigin = 'textile' | 'municipal';

const originOf = (a: DataAlertOut): AlertOrigin =>
  a.kind.startsWith('municipal_') ? 'municipal' : 'textile';

interface AlertsPanelProps {
  alerts: DataAlertOut[];
  /** Origem escolhida (vive no URL): `undefined` mostra todas. */
  origin?: AlertOrigin;
  onOriginChange?: (origin: AlertOrigin | undefined) => void;
}

export function AlertsPanel({ alerts, origin, onOriginChange }: AlertsPanelProps) {
  const [status, setStatus] = useState<AlertStatus | null>('open');
  const [kind, setKind] = useState<AlertKind | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const inOrigin = alerts.filter((a) => !origin || originOf(a) === origin);
  const kinds = [...new Set(inOrigin.map((a) => a.kind))];
  const activeKind = kind && kinds.includes(kind) ? kind : null;
  const filtered = inOrigin.filter(
    (a) => (!status || a.status === status) && (!activeKind || a.kind === activeKind),
  );
  const shown = filtered.slice(0, limit);
  const clear = () => {
    setStatus(null);
    setKind(null);
    onOriginChange?.(undefined);
  };

  return (
    <div className="space-y-4">
      {onOriginChange && (
        <FilterChips<AlertOrigin>
          legend={m.quality_filter_origin()}
          value={origin ?? null}
          onChange={(v) => {
            onOriginChange(v ?? undefined);
            setLimit(PAGE);
          }}
          options={[
            { value: null, label: m.quality_origin_all() },
            { value: 'textile', label: m.quality_origin_textile() },
            { value: 'municipal', label: m.quality_origin_municipal() },
          ]}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips<AlertStatus>
          legend={m.quality_filter_status()}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setLimit(PAGE);
          }}
          options={[
            { value: null, label: m.common_all() },
            ...(['open', 'resolved', 'wont_fix'] as const).map((s) => ({
              value: s,
              label: alertStatusLabel[s](),
            })),
          ]}
        />
        <div className="flex items-center gap-3">
          <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
            {m.quality_alerts_count({ shown: shown.length, total: filtered.length })}
          </p>
          <Select
            value={activeKind ?? ALL}
            onValueChange={(v) => {
              setKind(v === ALL ? null : (v as AlertKind));
              setLimit(PAGE);
            }}
          >
            <SelectTrigger
              className="h-10 w-full min-w-56 sm:w-72"
              aria-label={m.quality_filter_kind()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{m.quality_filter_kind_all()}</SelectItem>
              {kinds.map((k) => (
                <SelectItem key={k} value={k}>
                  {alertKindLabel[k]()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title={m.quality_alerts_empty_title()}
          description={m.quality_alerts_empty_description()}
          action={
            <Button variant="outline" className="h-10" onClick={clear}>
              {m.quality_alerts_empty_action()}
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border xl:grid-cols-2">
          {shown.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </ul>
      )}
      {filtered.length > shown.length && (
        <div className="flex justify-center">
          <Button variant="outline" className="h-10" onClick={() => setLimit((l) => l + PAGE)}>
            {m.quality_alerts_more({ count: Math.min(PAGE, filtered.length - shown.length) })}
          </Button>
        </div>
      )}
    </div>
  );
}
