import { useMemo } from 'react';
import type { SiteSelection } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { formatNumber, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

const precisionLabel: Record<SiteSelection['coord_precision'], () => string> = {
  precise: () => m.site_precision_precise(),
  approximate: () => m.site_precision_approximate(),
};

/** Uma casa decimal; abaixo de 0,1 t, duas, para não mostrar «0 t» num local que serve alguém. */
const tonnesOf = (t: number) => formatTonnes(t, t > 0 && t < 0.1 ? 2 : 1);

const streetOf = (s: SiteSelection) => s.street ?? m.site_street_unknown();

type SiteKind = NonNullable<SiteSelection['kind']>;
const kindLabel: Record<SiteKind, () => string> = {
  public: () => m.site_kind_public(),
  staffed: () => m.site_kind_staffed(),
};

/** Locais abertos de um cenário por locais reais: o que cada um serve, em quantidades estimadas. */
export function SitesTable({ sites }: { sites: SiteSelection[] }) {
  const rows = useMemo(() => [...sites].sort((x, y) => y.tonnes - x.tonnes), [sites]);

  const columns: Column<SiteSelection>[] = [
    {
      id: 'street',
      header: m.site_col_street(),
      primary: true,
      className: 'min-w-44 whitespace-normal',
      value: streetOf,
      cell: (s) => (
        <span className={s.street ? undefined : 'text-muted-foreground'}>{streetOf(s)}</span>
      ),
    },
    {
      id: 'kind',
      header: m.site_col_kind(),
      searchable: false,
      value: (s) => s.kind ?? 'public',
      exportValue: (s) => kindLabel[s.kind ?? 'public'](),
      filter: { format: (v) => kindLabel[v as SiteKind]() },
      cell: (s) =>
        s.kind === 'staffed' ? (
          <Badge variant="outline" className="border-areia/70 bg-areia/15 font-medium">
            {kindLabel.staffed()}
          </Badge>
        ) : (
          <span className="text-muted-foreground">{kindLabel.public()}</span>
        ),
    },
    {
      id: 'parish',
      header: m.site_col_parish(),
      className: 'min-w-44 whitespace-normal text-muted-foreground',
      value: (s) => s.parish_name,
      filter: true,
      cell: (s) => s.parish_name,
    },
    {
      id: 'containers',
      type: 'number',
      aggregate: 'sum',
      format: (n) => formatNumber(n),
      value: (s) => s.containers,
      searchable: false,
      header: m.site_col_containers(),
      align: 'right',
      cell: (s) => formatNumber(s.containers),
    },
    {
      id: 'tonnes',
      type: 'number',
      aggregate: 'sum',
      format: (n) => formatTonnes(n, 1),
      value: (s) => s.tonnes,
      searchable: false,
      badge: true,
      header: m.site_col_tonnes(),
      align: 'right',
      cell: (s) => <span className="tabular-nums">{tonnesOf(s.tonnes)}</span>,
    },
    {
      id: 'population',
      type: 'number',
      aggregate: 'sum',
      format: (n) => formatNumber(n),
      value: (s) => s.population_covered,
      searchable: false,
      header: m.site_col_population(),
      align: 'right',
      cell: (s) => formatNumber(s.population_covered),
    },
    {
      id: 'vehicle',
      type: 'number',
      header: m.site_col_vehicle(),
      align: 'right',
      searchable: false,
      value: (s) => s.vehicle,
      filter: { format: (v) => `#${v}` },
      cell: (s) => (s.vehicle == null ? m.common_dash() : <span>#{s.vehicle}</span>),
    },
    {
      id: 'precision',
      header: m.site_col_precision(),
      // No cartão em telemóvel a coordenada aproximada já se vê no mapa; aqui só ocupava espaço.
      desktopOnly: true,
      searchable: false,
      value: (s) => s.coord_precision,
      filter: { format: (v) => precisionLabel[v as SiteSelection['coord_precision']]() },
      cell: (s) =>
        s.coord_precision === 'approximate' ? (
          <Badge
            variant="outline"
            className="border-areia/70 font-normal"
            title={m.site_precision_approximate_hint()}
          >
            {precisionLabel.approximate()}
          </Badge>
        ) : (
          <span className="text-muted-foreground">{precisionLabel.precise()}</span>
        ),
    },
  ];

  return (
    <DataTable
      id="sites"
      exportName="cenario-locais"
      columns={columns}
      rows={rows}
      getRowId={(s) => s.site_id}
      caption={m.site_title()}
      searchLabel={m.site_search()}
      pageSize={10}
      selectable={false}
      empty={
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          {m.site_empty()}
        </p>
      }
    />
  );
}
