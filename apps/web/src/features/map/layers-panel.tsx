import { Link } from '@tanstack/react-router';
import { Table2 } from 'lucide-react';
import type { MunicipalKind } from '@/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  FILL_MODES,
  type FillMode,
  type LayerState,
  SITES_MODES,
  type SitesMode,
} from '@/features/municipal/derive';
import { MunicipalNote } from '@/features/municipal/note';
import {
  CANDIDATE_COLOR,
  KIND_COLORS,
  KIND_ORDER,
  kindLabel,
  NN_BANDS,
  PRODUCER_COLORS,
  PRODUCER_MULTI_COLOR,
  PRODUCER_ORDER,
  producerLabel,
} from '@/features/municipal/vocab';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

type Shape = 'circle' | 'square' | 'triangle' | 'diamond';

/** Amostra de legenda com a mesma forma do marcador no mapa (a cor sozinha nunca basta). */
export function ShapeKey({
  shape,
  color,
  className,
}: {
  shape: Shape;
  color: string;
  className?: string;
}) {
  const common = { fill: color, stroke: 'rgba(20,33,29,0.6)', strokeWidth: 1 };
  return (
    <svg viewBox="0 0 16 16" className={cn('size-4 shrink-0', className)} aria-hidden="true">
      {shape === 'circle' && <circle cx="8" cy="8" r="6" {...common} />}
      {shape === 'square' && <rect x="2.5" y="2.5" width="11" height="11" rx="2" {...common} />}
      {shape === 'triangle' && <polygon points="8,2 14,13.5 2,13.5" {...common} />}
      {shape === 'diamond' && <polygon points="8,1.5 14.5,8 8,14.5 1.5,8" {...common} />}
    </svg>
  );
}

const fillLabel: Record<FillMode, () => string> = {
  textile: () => m.mapm_fill_textile(),
  density: () => m.mapm_fill_density(),
  cover: () => m.mapm_fill_cover(),
  none: () => m.mapm_fill_none(),
};

const sitesLabel: Record<SitesMode, () => string> = {
  kind: () => m.mapm_sites_kind(),
  candidates: () => m.mapm_sites_candidates(),
  isolation: () => m.mapm_sites_isolation(),
  density: () => m.mapm_sites_density(),
  off: () => m.mapm_sites_off(),
};

export interface LayerLoad {
  pending: boolean;
  error: boolean;
  retry: () => void;
}

export interface LayersPanelProps {
  state: LayerState;
  onChange: (patch: Partial<LayerState>) => void;
  counts: {
    kinds: Record<MunicipalKind, number>;
    candidates: number;
    sites: number;
    producerTypes: Record<string, number>;
    producerTotal: number;
  };
  load: { sites: LayerLoad; caop: LayerLoad; producers: LayerLoad };
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function LoadLine({ load, label }: { load: LayerLoad; label: string }) {
  if (load.error) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-destructive text-xs">
        {m.mapm_load_error({ layer: label })}
        <Button variant="outline" className="h-10" onClick={load.retry}>
          {m.common_retry()}
        </Button>
      </div>
    );
  }
  if (load.pending) {
    return (
      <p role="status" className="text-muted-foreground text-xs">
        {m.mapm_loading({ layer: label })}
      </p>
    );
  }
  return null;
}

function Count({ value }: { value: number }) {
  return (
    <span className="ml-auto text-muted-foreground text-xs tabular-nums">
      {formatNumber(value)}
    </span>
  );
}

const rowClass = 'flex min-h-10 cursor-pointer items-center gap-2.5 text-sm font-normal';

export function LayersPanel({ state, onChange, counts, load }: LayersPanelProps) {
  const toggleKind = (k: MunicipalKind, on: boolean) =>
    onChange({
      kinds: on
        ? KIND_ORDER.filter((x) => x === k || state.kinds.includes(x))
        : state.kinds.filter((x) => x !== k),
    });

  return (
    <div className="space-y-5" data-testid="layers-panel">
      <Group title={m.mapm_group_fill()}>
        <RadioGroup
          value={state.fill}
          onValueChange={(v) => onChange({ fill: v as FillMode })}
          className="gap-0"
          aria-label={m.mapm_group_fill()}
        >
          {FILL_MODES.map((f) => (
            <Label key={f} className={rowClass}>
              <RadioGroupItem value={f} />
              {fillLabel[f]()}
            </Label>
          ))}
        </RadioGroup>
        {(state.fill === 'density' || state.fill === 'cover') && (
          <LoadLine load={load.caop} label={m.mapm_layer_caop()} />
        )}
      </Group>

      <Group title={m.mapm_group_sites()}>
        <RadioGroup
          value={state.sites}
          onValueChange={(v) => onChange({ sites: v as SitesMode })}
          className="gap-0"
          aria-label={m.mapm_group_sites()}
        >
          {SITES_MODES.map((s) => (
            <Label key={s} className={rowClass}>
              <RadioGroupItem value={s} />
              {sitesLabel[s]()}
              {s === 'candidates' && !load.sites.pending && <Count value={counts.candidates} />}
              {s === 'kind' && !load.sites.pending && <Count value={counts.sites} />}
            </Label>
          ))}
        </RadioGroup>
        {state.sites !== 'off' && <LoadLine load={load.sites} label={m.mapm_layer_sites()} />}

        {state.sites === 'kind' && (
          <ul className="mt-1 space-y-0 border-l-2 pl-3" aria-label={m.mapm_kinds_label()}>
            {KIND_ORDER.map((k) => (
              <li key={k}>
                <Label className={rowClass}>
                  <Checkbox
                    checked={state.kinds.includes(k)}
                    onCheckedChange={(v) => toggleKind(k, v === true)}
                  />
                  <ShapeKey shape="square" color={KIND_COLORS[k]} />
                  {kindLabel[k]()}
                  <Count value={counts.kinds[k]} />
                </Label>
              </li>
            ))}
          </ul>
        )}
        {state.sites === 'candidates' && (
          <p className="flex items-center gap-2 border-l-2 pl-3 text-muted-foreground text-xs leading-relaxed">
            <ShapeKey shape="diamond" color={CANDIDATE_COLOR} />
            {m.mapm_legend_candidate()}
          </p>
        )}
        {state.sites === 'isolation' && (
          <ul className="space-y-1 border-l-2 pl-3 text-xs" aria-label={m.mapm_sites_isolation()}>
            {NN_BANDS.map((b, i) => {
              const next = NN_BANDS[i + 1];
              return (
                <li key={b.from} className="flex items-center gap-2">
                  <ShapeKey shape="square" color={b.color} />
                  {next
                    ? m.mapm_nn_between({ from: b.from, to: next.from })
                    : m.mapm_nn_above({ from: b.from })}
                </li>
              );
            })}
          </ul>
        )}
        {state.sites === 'density' && (
          <div className="space-y-1 border-l-2 pl-3 text-xs">
            <div
              className="h-2 w-40 rounded-full"
              style={{
                background: 'linear-gradient(90deg, #9fc4b2, #e0b04a, #cc6622, #962814)',
              }}
              aria-hidden="true"
            />
            <p className="text-muted-foreground">{m.mapm_legend_density()}</p>
          </div>
        )}
      </Group>

      <Group title={m.mapm_group_producers()}>
        <Label className={rowClass}>
          <Switch
            checked={state.producers}
            onCheckedChange={(v) => onChange({ producers: v })}
            aria-label={m.mapm_producers()}
          />
          {m.mapm_producers()}
          {state.producers && !load.producers.pending && <Count value={counts.producerTotal} />}
        </Label>
        {state.producers && <LoadLine load={load.producers} label={m.mapm_layer_producers()} />}
        {state.producers && (
          <ul className="space-y-0 border-l-2 pl-3" aria-label={m.mapm_producers()}>
            {PRODUCER_ORDER.map((t) => (
              <li key={t} className="flex min-h-8 items-center gap-2 text-sm">
                <ShapeKey shape="triangle" color={PRODUCER_COLORS[t]} />
                {producerLabel[t]()}
                <Count value={counts.producerTypes[t] ?? 0} />
              </li>
            ))}
            {(counts.producerTypes.multiple ?? 0) > 0 && (
              <li className="flex min-h-8 items-center gap-2 text-sm">
                <ShapeKey shape="triangle" color={PRODUCER_MULTI_COLOR} />
                {m.mapm_producer_multiple()}
                <Count value={counts.producerTypes.multiple ?? 0} />
              </li>
            )}
            <li className="pt-1 text-muted-foreground text-xs">{m.mapm_producers_note()}</li>
          </ul>
        )}
      </Group>

      <Group title={m.mapm_group_key()}>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <li className="flex items-center gap-2">
            <ShapeKey shape="circle" color="#2e6b57" />
            {m.mapm_key_textile()}
          </li>
          <li className="flex items-center gap-2">
            <ShapeKey shape="square" color="#6b6560" />
            {m.mapm_key_municipal()}
          </li>
          <li className="flex items-center gap-2">
            <ShapeKey shape="diamond" color={CANDIDATE_COLOR} />
            {m.mapm_key_candidate()}
          </li>
          <li className="flex items-center gap-2">
            <ShapeKey shape="triangle" color="#862e9c" />
            {m.mapm_key_producer()}
          </li>
        </ul>
      </Group>

      <MunicipalNote>{m.mapm_note()}</MunicipalNote>

      <Button asChild variant="outline" className="h-10 w-full gap-2">
        <Link to="/municipal" search={{ tab: 'sites' }}>
          <Table2 aria-hidden="true" />
          {m.mapm_table_link()}
        </Link>
      </Button>
    </div>
  );
}
