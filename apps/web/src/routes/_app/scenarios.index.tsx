import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { listScenariosOptions } from '@/client/@tanstack/react-query.gen';
import { Page, Section } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { BenchmarkSection } from '@/features/scenarios/benchmark-section';
import { ScenarioList } from '@/features/scenarios/scenario-list';
import { formatEur, formatNumber, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/scenarios/')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listScenariosOptions()),
  staticData: { skeleton: 'table' },
  head: () => ({ meta: [{ title: m.title_scenarios() }] }),
  component: Scenarios,
});

function Scenarios() {
  const { data } = useSuspenseQuery(listScenariosOptions());
  const feasible = data.filter((s) => s.status !== 'infeasible');
  const cheapest = feasible
    .filter((s) => s.eur_per_tonne != null)
    .sort((a, b) => (a.eur_per_tonne ?? 0) - (b.eur_per_tonne ?? 0))[0];
  const best = [...feasible].sort((a, b) => b.tonnes_year - a.tonnes_year)[0];

  return (
    <Page>
      <PageHeader
        eyebrow={m.scenarios_eyebrow()}
        title={m.scenarios_title()}
        description={m.scenarios_description()}
        actions={
          <Button asChild className="h-10 gap-2 font-semibold">
            <Link to="/simulator">
              <Plus /> {m.scenarios_new()}
            </Link>
          </Button>
        }
      />
      {data.length > 0 && (
        <StatStrip className="lg:grid-cols-3">
          <StatCell
            label={m.scenarios_stat_count()}
            value={formatNumber(data.length)}
            hint={m.scenarios_stat_count_hint({ n: feasible.length })}
          />
          <StatCell
            label={m.scenarios_stat_best_tonnes()}
            value={best ? formatTonnes(best.tonnes_year) : m.common_dash()}
            tone="primary"
            tag={m.common_estimate()}
            hint={best?.label}
          />
          <StatCell
            label={m.scenarios_stat_cheapest()}
            value={
              cheapest?.eur_per_tonne != null
                ? `${formatNumber(cheapest.eur_per_tonne, 0)} €/t`
                : m.common_dash()
            }
            tone="primary"
            tag={m.common_estimate()}
            hint={
              cheapest ? `${cheapest.label} · ${formatEur(cheapest.annual_cost_eur)}` : undefined
            }
          />
        </StatStrip>
      )}
      <Section title={m.scenarios_list_title()} description={m.scenarios_compare_hint()}>
        {data.length === 0 ? (
          <EmptyState
            title={m.scenarios_empty_title()}
            description={m.scenarios_empty_text()}
            action={
              <Button asChild>
                <Link to="/simulator">{m.scenarios_new()}</Link>
              </Button>
            }
          />
        ) : (
          <ScenarioList scenarios={data} />
        )}
      </Section>
      <BenchmarkSection />
    </Page>
  );
}
