import { Link, useNavigate } from '@tanstack/react-router';
import { GitCompareArrows } from 'lucide-react';
import { useState } from 'react';
import type { ScenarioObjective, ScenarioSummary } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { formatDateTime } from '@/lib/i18n';
import { objectiveLabel } from '@/lib/scenario';
import { m } from '@/paraglide/messages';

export function ScenarioList({ scenarios }: { scenarios: ScenarioSummary[] }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.slice(-1), id],
    );

  const columns: Column<ScenarioSummary>[] = [
    {
      id: 'select',
      header: <span className="sr-only">{m.scenarios_select()}</span>,
      className: 'w-10',
      desktopOnly: true,
      label: m.scenarios_select(),
      hideable: false,
      cell: (s) => (
        <Checkbox
          checked={selected.includes(s.id)}
          onCheckedChange={() => toggle(s.id)}
          aria-label={m.scenarios_select_one({ label: s.label })}
        />
      ),
    },
    {
      id: 'name',
      header: m.scenarios_col_name(),
      primary: true,
      label: m.scenarios_col_name(),
      value: (s) => s.label,
      cell: (s) => (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to="/scenarios/$scenarioId"
            params={{ scenarioId: s.id }}
            className="hover:underline"
          >
            {s.label}
          </Link>
          {s.status === 'infeasible' && (
            <Badge
              variant="outline"
              className="border-destructive/50 font-semibold text-[10px] text-destructive uppercase tracking-wider"
            >
              {m.scenario_infeasible_badge()}
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: 'objective',
      header: m.scenarios_col_objective(),
      className: 'text-muted-foreground',
      value: (s) => s.objective,
      filter: { format: (v) => objectiveLabel[v as ScenarioObjective]() },
      cell: (s) => objectiveLabel[s.objective](),
    },
    {
      id: 'tonnes',
      header: m.kpi_tonnes(),
      align: 'right',
      value: (s) => s.tonnes_year,
      cell: (s) => formatTonnes(s.tonnes_year),
    },
    {
      id: 'eurt',
      header: m.kpi_eur_per_tonne(),
      align: 'right',
      value: (s) => s.eur_per_tonne,
      cell: (s) =>
        s.eur_per_tonne == null ? m.common_dash() : `${formatNumber(s.eur_per_tonne, 0)} €`,
    },
    {
      id: 'cost',
      header: m.kpi_annual_cost(),
      align: 'right',
      value: (s) => s.annual_cost_eur,
      cell: (s) => formatEur(s.annual_cost_eur),
    },
    {
      id: 'capex',
      header: m.kpi_capex(),
      align: 'right',
      value: (s) => s.capex_eur,
      cell: (s) => formatEur(s.capex_eur),
    },
    {
      id: 'coverage',
      header: m.kpi_coverage(),
      align: 'right',
      value: (s) => s.coverage_pct,
      cell: (s) => formatPercent(s.coverage_pct),
    },
    {
      id: 'created',
      defaultHidden: true,
      header: m.scenarios_col_created(),
      className: 'text-muted-foreground',
      value: (s) => s.created_at,
      searchable: false,
      cell: (s) => formatDateTime(s.created_at),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          className="h-9 gap-2"
          disabled={selected.length !== 2}
          onClick={() =>
            navigate({ to: '/scenarios/compare', search: { a: selected[0], b: selected[1] } })
          }
        >
          <GitCompareArrows /> {m.scenario_compare()}
        </Button>
      </div>
      <DataTable
        id="scenarios"
        columns={columns}
        rows={scenarios}
        getKey={(s) => s.id}
        caption={m.scenarios_title()}
      />
    </div>
  );
}
