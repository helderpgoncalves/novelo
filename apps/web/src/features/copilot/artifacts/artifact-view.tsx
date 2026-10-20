import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Download, Pin, PinOff } from 'lucide-react';
import { lazy, type ReactNode, Suspense, useState } from 'react';
import { toast } from 'sonner';
import type {
  ArtifactEnvelope,
  ArtifactOut,
  ComparisonSpec,
  KpisSpec,
  TableColumn,
  TableSpec,
  TimelineSpec,
} from '@/client';
import { pinCopilotArtifactMutation } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { EstimateTag } from '@/components/panel';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { formatEur, formatNumber, formatPercent } from '@/lib/format';
import { formatDateTime } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { invalidateCopilot } from '../cache';
import { CopilotScenarioCard, fromSpec } from '../scenario-card';
import { fmt } from './chart-options';
import { FormArtifactView } from './form-artifact';

const ChartView = lazy(() => import('./chart'));
const MapArtifactView = lazy(() => import('./map-artifact'));

type Artifact = ArtifactEnvelope['artifact'];

function Loading() {
  return (
    <p className="flex h-40 items-center justify-center text-muted-foreground text-sm">
      {m.chat_artifact_drawing()}
    </p>
  );
}

function cellText(value: string | number | null | undefined, col: TableColumn): string {
  if (value === null || value === undefined || value === '') return m.common_dash();
  if (typeof value === 'string') {
    if (col.type === 'date' && !Number.isNaN(Date.parse(value))) return formatDateTime(value);
    return col.unit ? `${value} ${col.unit}` : value;
  }
  switch (col.type) {
    case 'percent':
      return formatPercent(value);
    case 'currency':
      return formatEur(value);
    default:
      return fmt(value, col.unit);
  }
}

type Row = Record<string, string | number | null>;

function SpecTable({ spec, id }: { spec: TableSpec; id: string }) {
  const columns: Column<Row>[] = spec.columns.map((col, index) => {
    const numeric = col.type === 'number' || col.type === 'percent' || col.type === 'currency';
    return {
      id: col.key,
      header: col.label,
      label: col.label,
      cell: (row) => cellText(row[col.key], col),
      value: (row) => row[col.key] ?? null,
      filter: col.type === 'category',
      primary: index === 0,
      align: numeric ? 'right' : 'left',
      className: numeric ? 'tabular-nums' : undefined,
    };
  });
  return (
    <div className="space-y-2">
      <DataTable
        id={`copilot-table-${id}`}
        columns={columns}
        rows={spec.rows}
        getKey={(row) => JSON.stringify(row)}
        pageSize={8}
        controls="auto"
        caption={spec.title}
        initialSort={
          spec.sort_by ? { id: spec.sort_by, desc: spec.sort_dir === 'desc' } : undefined
        }
      />
      {spec.total_rows > spec.rows.length && (
        <p className="text-muted-foreground text-xs">
          {m.chat_table_showing({ shown: spec.rows.length, total: spec.total_rows })}
        </p>
      )}
    </div>
  );
}

function SpecComparison({ spec, id }: { spec: ComparisonSpec; id: string }) {
  type MetricRow = { metric: TableColumn };
  const columns: Column<MetricRow>[] = [
    {
      id: 'metric',
      header: m.chat_compare_metric(),
      label: m.chat_compare_metric(),
      cell: (r) => <span className="font-medium">{r.metric.label}</span>,
      value: (r) => r.metric.label,
      primary: true,
      hideable: false,
    },
    ...spec.columns.map((col) => ({
      id: col.scenario_id,
      header: col.label,
      label: col.label,
      cell: (r: MetricRow) => cellText(col.values[r.metric.key], r.metric),
      value: (r: MetricRow) => col.values[r.metric.key] ?? null,
      align: 'right' as const,
      className: 'tabular-nums',
    })),
  ];
  return (
    <DataTable
      id={`copilot-compare-${id}`}
      columns={columns}
      rows={spec.metrics.map((metric) => ({ metric }))}
      getKey={(r) => r.metric.key}
      controls="never"
      caption={spec.title}
    />
  );
}

function SpecKpis({ spec }: { spec: KpisSpec }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border sm:grid-cols-3">
      {spec.items.map((item) => (
        <div key={item.label} className="min-w-0 space-y-0.5 bg-card px-3 py-3">
          <dt className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
            {item.label}
          </dt>
          <dd className="font-medium font-serif text-2xl tabular-nums leading-tight">
            {typeof item.value === 'number'
              ? fmt(item.value, item.unit)
              : (item.value ?? m.common_dash())}
            {typeof item.value === 'string' && item.unit ? ` ${item.unit}` : ''}
          </dd>
          {item.hint && <p className="text-muted-foreground text-xs">{item.hint}</p>}
        </div>
      ))}
    </dl>
  );
}

function SpecTimeline({ spec }: { spec: TimelineSpec }) {
  return (
    <ol className="space-y-3 border-l pl-4">
      {spec.items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: eventos podem repetir instante e rótulo
        <li key={i} className="relative">
          <span
            aria-hidden="true"
            className="absolute top-1.5 -left-[1.28rem] size-2 rounded-full bg-primary"
          />
          <p className="font-medium text-sm">{item.label}</p>
          <p className="text-muted-foreground text-xs">{formatDateTime(item.at)}</p>
          {item.detail && <p className="mt-0.5 text-sm">{item.detail}</p>}
        </li>
      ))}
    </ol>
  );
}

function ArtifactBody({ id, artifact }: { id: string; artifact: Artifact }) {
  switch (artifact.artifact_type) {
    case 'chart':
      return (
        <Suspense fallback={<Loading />}>
          <ChartView spec={artifact.spec} />
        </Suspense>
      );
    case 'table':
      return <SpecTable spec={artifact.spec} id={id} />;
    case 'map':
      return (
        <Suspense fallback={<Loading />}>
          <MapArtifactView spec={artifact.spec} />
        </Suspense>
      );
    case 'kpis':
      return <SpecKpis spec={artifact.spec} />;
    case 'comparison':
      return <SpecComparison spec={artifact.spec} id={id} />;
    case 'timeline':
      return <SpecTimeline spec={artifact.spec} />;
    case 'scenario_card':
      return <CopilotScenarioCard card={fromSpec(artifact.spec)} />;
    case 'report':
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" className="h-10 gap-2">
            <a href={artifact.spec.download_path} download>
              <Download className="size-4" aria-hidden="true" />
              {m.chat_report_download({ size: formatNumber(artifact.spec.size_kb) })}
            </a>
          </Button>
          <Link to="/reports" className="text-primary text-sm underline underline-offset-2">
            {m.chat_report_open()}
          </Link>
        </div>
      );
    case 'form':
      return <FormArtifactView spec={artifact.spec} />;
    default:
      return null;
  }
}

const sourceOf = (artifact: Artifact): string | null =>
  'source' in artifact.spec && typeof artifact.spec.source === 'string'
    ? artifact.spec.source
    : null;
const estimateOf = (artifact: Artifact): boolean =>
  'estimate' in artifact.spec && artifact.spec.estimate === true;

interface ArtifactViewProps {
  artifact: ArtifactEnvelope | ArtifactOut;
  /** Barra de ações extra (galeria: atualizar, apagar). */
  toolbar?: ReactNode;
  initialPinned?: boolean;
  showPin?: boolean;
}

/** Um artefacto do copiloto: título-conclusão, o conteúdo certo para o tipo, a fonte e o selo "estimativa". */
export function ArtifactView({
  artifact,
  toolbar,
  initialPinned = false,
  showPin = true,
}: ArtifactViewProps) {
  const qc = useQueryClient();
  const [pinned, setPinned] = useState(initialPinned);
  const pin = useMutation({
    ...pinCopilotArtifactMutation(),
    onSuccess: (_data, vars) => {
      setPinned(vars.query?.pinned ?? true);
      void invalidateCopilot(qc, /Artifact|History/);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const body = artifact.artifact;
  const source = sourceOf(body);
  const estimate = estimateOf(body);

  return (
    <figure
      data-testid="copilot-artifact"
      data-type={body.artifact_type}
      className="min-w-0 space-y-3 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10 sm:p-4"
    >
      <figcaption className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-balance font-sans font-semibold text-sm leading-snug">
          {artifact.title}
          {estimate && (
            <span className="ml-2 align-middle">
              <EstimateTag label={m.common_estimate()} />
            </span>
          )}
        </h3>
        {showPin && (
          <Button
            variant="ghost"
            size="icon"
            className="-mt-1 -mr-1 size-10 shrink-0 sm:size-8"
            aria-pressed={pinned}
            aria-label={pinned ? m.chat_artifact_unpin() : m.chat_artifact_pin()}
            disabled={pin.isPending}
            onClick={() =>
              pin.mutate({ path: { artifact_id: artifact.id }, query: { pinned: !pinned } })
            }
          >
            {pinned ? (
              <PinOff className="size-4" aria-hidden="true" />
            ) : (
              <Pin className="size-4" aria-hidden="true" />
            )}
          </Button>
        )}
        {toolbar}
      </figcaption>
      <ArtifactBody id={artifact.id} artifact={body} />
      {(source || ('sources' in artifact && artifact.sources.length > 0)) && (
        <p className="text-muted-foreground text-xs">
          {m.chat_artifact_source({ source: source ?? sourcesText(artifact) })}
        </p>
      )}
    </figure>
  );
}

function sourcesText(artifact: ArtifactEnvelope | ArtifactOut): string {
  return artifact.sources
    .map((s) => ('label' in s && typeof s.label === 'string' ? s.label : ''))
    .filter(Boolean)
    .join(', ');
}
