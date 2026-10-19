import type { OverviewDataSource, OverviewHighlight, OverviewParish } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { formatDate } from '@/lib/i18n';
import { tipauLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import { EstimateTag, UnverifiedTag } from './story-section';

type Ctx = OverviewHighlight['context'];
const num = (ctx: Ctx, key: string) => Number(ctx[key] ?? 0);
const str = (ctx: Ctx, key: string) => String(ctx[key] ?? '');

/** Texto de cada manchete: a chave da API escolhe a frase; os números vêm todos do servidor. */
const HIGHLIGHT_TEXT: Record<string, (h: OverviewHighlight) => string> = {
  top_entity_share: (h) =>
    m.home_hl_top_entity_share({
      entity: str(h.context, 'entity'),
      tonnes: formatTonnes(num(h.context, 'tonnes')),
    }),
  reuse_share: (h) =>
    m.home_hl_reuse_share({
      reuse: formatTonnes(num(h.context, 'reuse_t')),
      total: formatTonnes(num(h.context, 'total_t')),
    }),
  france_equivalent_t: (h) =>
    m.home_hl_france_equivalent({
      multiple: formatNumber(num(h.context, 'multiple'), 1),
      kg: formatNumber(num(h.context, 'kg_per_inhab_year'), 2),
    }),
  textile_in_mixed_waste: () => m.home_hl_textile_in_mixed_waste(),
  parish_size_ratio: (h) =>
    m.home_hl_parish_ratio({
      largest: str(h.context, 'largest'),
      smallest: str(h.context, 'smallest'),
    }),
  top_parishes_share: (h) => m.home_hl_top_parishes_share({ count: num(h.context, 'count') }),
};

function highlightValue(h: OverviewHighlight): string {
  switch (h.unit) {
    case 'pct':
      return formatPercent(h.value, h.value < 10 ? 2 : 1);
    case 't':
      return formatTonnes(h.value, 0);
    case 'x':
      return `${formatNumber(h.value, 1)}×`;
    case 'kg_per_inhab_year':
      return `${formatNumber(h.value, 2)} kg`;
  }
}

export function Highlights({ highlights }: { highlights: OverviewHighlight[] }) {
  const items = highlights.filter((h) => HIGHLIGHT_TEXT[h.key]);
  return (
    <ul className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((h) => (
        <li key={h.key} className="space-y-2 border-foreground border-t-2 pt-3">
          <p className="font-medium font-serif text-4xl tabular-nums leading-none sm:text-[2.6rem]">
            {highlightValue(h)}
          </p>
          <p className="text-sm leading-snug">{HIGHLIGHT_TEXT[h.key]?.(h)}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {h.is_estimate && <EstimateTag />}
            {!h.verified && <UnverifiedTag />}
            {h.source_label}
          </p>
        </li>
      ))}
    </ul>
  );
}

const KIND_LABEL: Record<OverviewDataSource['kind'], () => string> = {
  operator: () => m.home_kind_operator(),
  public_statistics: () => m.home_kind_public_statistics(),
  public_geodata: () => m.home_kind_public_geodata(),
  other: () => m.home_kind_other(),
};

export function DataSources({ sources }: { sources: OverviewDataSource[] }) {
  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sources.map((s) => (
          <li
            key={s.key}
            className="flex flex-col gap-2 rounded-lg bg-card p-4 ring-1 ring-foreground/10"
          >
            <p className="eyebrow text-[10px] tracking-[0.14em]">{KIND_LABEL[s.kind]()}</p>
            <p className="font-semibold text-sm leading-snug">{s.name}</p>
            <p className="text-muted-foreground text-xs">{s.provider}</p>
            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
              {s.methods.map((method) => (
                <Tooltip key={method}>
                  <TooltipTrigger asChild>
                    <Badge
                      variant={method === 'weighed' ? 'secondary' : 'outline'}
                      className="h-6 cursor-help px-2 font-semibold text-[10px] uppercase tracking-wider"
                    >
                      {method === 'weighed' ? m.method_weighed() : m.method_percentage()}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {method === 'weighed'
                      ? m.home_method_weighed_tip()
                      : m.home_method_percentage_tip()}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {s.period_start && s.period_end
                ? `${formatDate(s.period_start, 'short')} – ${formatDate(s.period_end, 'short')} · `
                : ''}
              {m.home_source_rows({ rows: formatNumber(s.rows) })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ParishesTable({ parishes }: { parishes: OverviewParish[] }) {
  const columns: Column<OverviewParish>[] = [
    {
      id: 'name',
      header: m.home_col_parish(),
      cell: (p) => p.name,
      value: (p) => p.name,
      primary: true,
    },
    {
      id: 'tipau',
      header: m.home_col_tipau(),
      value: (p) => p.tipau ?? '',
      filter: { format: (v) => (v ? tipauLabel[v as keyof typeof tipauLabel]() : '—') },
      cell: (p) => (p.tipau ? tipauLabel[p.tipau]() : '—'),
    },
    {
      id: 'population',
      header: m.home_col_population(),
      align: 'right',
      value: (p) => p.population,
      cell: (p) => formatNumber(p.population),
    },
    {
      id: 'potential',
      header: m.home_col_potential(),
      align: 'right',
      badge: true,
      value: (p) => p.potential_t,
      cell: (p) => formatTonnes(p.potential_t),
    },
    {
      id: 'circuits',
      header: m.home_col_circuits(),
      align: 'right',
      hideable: true,
      value: (p) => p.circuits_count,
      cell: (p) => formatNumber(p.circuits_count),
    },
    {
      id: 'containers',
      header: m.home_col_containers(),
      align: 'right',
      defaultHidden: true,
      value: (p) => p.containers_count,
      cell: (p) => formatNumber(p.containers_count),
    },
  ];
  return (
    <DataTable
      id="home-parishes"
      columns={columns}
      rows={parishes}
      getKey={(p) => p.code}
      caption={m.home_col_parish()}
      initialSort={{ id: 'potential', desc: true }}
    />
  );
}
