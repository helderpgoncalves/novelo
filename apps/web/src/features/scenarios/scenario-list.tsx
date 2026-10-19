import { Link, useNavigate } from '@tanstack/react-router';
import { GitCompareArrows } from 'lucide-react';
import { useState } from 'react';
import type { ScenarioSummary } from '@/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{m.scenarios_compare_hint()}</p>
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
      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 w-10 pl-4">
                <span className="sr-only">{m.scenarios_select()}</span>
              </TableHead>
              <TableHead className="h-10">{m.scenarios_col_name()}</TableHead>
              <TableHead className="h-10">{m.scenarios_col_objective()}</TableHead>
              <TableHead className="h-10 text-right">{m.kpi_tonnes()}</TableHead>
              <TableHead className="h-10 text-right">{m.kpi_eur_per_tonne()}</TableHead>
              <TableHead className="h-10 text-right">{m.kpi_annual_cost()}</TableHead>
              <TableHead className="h-10 text-right">{m.kpi_capex()}</TableHead>
              <TableHead className="h-10 text-right">{m.kpi_coverage()}</TableHead>
              <TableHead className="h-10 pr-4">{m.scenarios_col_created()}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scenarios.map((s) => (
              <TableRow key={s.id} data-state={selected.includes(s.id) ? 'selected' : undefined}>
                <TableCell className="pl-4">
                  <Checkbox
                    checked={selected.includes(s.id)}
                    onCheckedChange={() => toggle(s.id)}
                    aria-label={m.scenarios_select_one({ label: s.label })}
                  />
                </TableCell>
                <TableCell className="font-medium">
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
                      className="ml-2 border-destructive/50 font-semibold text-[10px] text-destructive uppercase tracking-wider"
                    >
                      {m.scenario_infeasible_badge()}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {objectiveLabel[s.objective]()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatTonnes(s.tonnes_year)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.eur_per_tonne == null
                    ? m.common_dash()
                    : `${formatNumber(s.eur_per_tonne, 0)} €`}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatEur(s.annual_cost_eur)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatEur(s.capex_eur)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPercent(s.coverage_pct)}
                </TableCell>
                <TableCell className="pr-4 text-muted-foreground tabular-nums">
                  {formatDateTime(s.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
